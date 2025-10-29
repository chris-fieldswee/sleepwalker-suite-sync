import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabaseAdmin, isAdminClientAvailable } from "@/integrations/supabase/admin-client";
import { supabase } from "@/integrations/supabase/client";

interface UserCreationResult {
  name: string;
  success: boolean;
  error?: string;
  userId?: string;
}

export const BulkCreateHousekeepingUsers: React.FC = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [results, setResults] = useState<UserCreationResult[]>([]);
  const { toast } = useToast();

  const housekeepingUsers = [
    { name: 'Agata Dec', firstName: 'Agata', lastName: 'Dec', email: 'agata.dec@sleepwalker.com' },
    { name: 'Aleksandra Bednarz', firstName: 'Aleksandra', lastName: 'Bednarz', email: 'aleksandra.bednarz@sleepwalker.com' },
    { name: 'Alina Yarmolchuk', firstName: 'Alina', lastName: 'Yarmolchuk', email: 'alina.yarmolchuk@sleepwalker.com' },
    { name: 'Ewelina Szczudlek', firstName: 'Ewelina', lastName: 'Szczudlek', email: 'ewelina.szczudlek@sleepwalker.com' },
    { name: 'Maja Adamczyk', firstName: 'Maja', lastName: 'Adamczyk', email: 'maja.adamczyk@sleepwalker.com' },
    { name: 'Natalia Bolharenkova', firstName: 'Natalia', lastName: 'Bolharenkova', email: 'natalia.bolharenkova@sleepwalker.com' },
    { name: 'Olha Kryvosheieva', firstName: 'Olha', lastName: 'Kryvosheieva', email: 'olha.kryvosheieva@sleepwalker.com' },
    { name: 'Szymon Sworczak', firstName: 'Szymon', lastName: 'Sworczak', email: 'szymon.sworczak@sleepwalker.com' },
  ];

  const createUsers = async () => {
    if (!supabaseAdmin) {
      toast({
        title: "Error",
        description: "Admin client not available. Please ensure VITE_SUPABASE_SERVICE_ROLE_KEY is set in .env.local",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    setResults([]);
    
    const creationResults: UserCreationResult[] = [];

    for (const user of housekeepingUsers) {
      try {
        // Check if user already exists
        const { data: existingUser } = await supabase
          .from('users')
          .select('id, name, auth_id')
          .eq('name', user.name)
          .single();

        if (existingUser) {
          if (existingUser.auth_id) {
            creationResults.push({
              name: user.name,
              success: true,
              error: 'User already exists with auth account',
              userId: existingUser.id
            });
          } else {
            creationResults.push({
              name: user.name,
              success: true,
              error: 'User exists but needs auth account - please create manually',
              userId: existingUser.id
            });
          }
          continue;
        }

        // Step 1: Create auth user using admin client
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: 'housekeeping123', // Default password
          email_confirm: true,
          user_metadata: {
            name: user.name,
            first_name: user.firstName,
            last_name: user.lastName,
          },
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error("Failed to create auth user");

        // Step 2: Insert user into public.users table
        const { data: userData, error: userError } = await supabase
          .from("users")
          .insert([
            {
              auth_id: authData.user.id,
              name: user.name,
              first_name: user.firstName,
              last_name: user.lastName,
              role: "housekeeping",
              active: true,
            },
          ])
          .select()
          .single();

        if (userError) {
          // Cleanup: delete the auth user if database insert fails
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          throw userError;
        }

        // Step 3: Insert role into user_roles table
        const { error: roleError } = await supabase
          .from("user_roles")
          .upsert([
            {
              user_id: authData.user.id,
              role: "housekeeping",
            },
          ], {
            onConflict: 'user_id,role'
          });

        if (roleError) {
          // Cleanup if role insert fails
          await supabase.from("users").delete().eq("auth_id", authData.user.id);
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          throw roleError;
        }

        creationResults.push({
          name: user.name,
          success: true,
          userId: userData.id
        });

      } catch (error: any) {
        console.error(`Error creating user ${user.name}:`, error);
        creationResults.push({
          name: user.name,
          success: false,
          error: error.message || 'Unknown error'
        });
      }
    }

    setResults(creationResults);
    setIsCreating(false);

    const successCount = creationResults.filter(r => r.success).length;
    const errorCount = creationResults.filter(r => !r.success).length;

    toast({
      title: "Bulk User Creation Complete",
      description: `Successfully created ${successCount} users. ${errorCount} failed.`,
      variant: errorCount > 0 ? "destructive" : "default",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Housekeeping Users</CardTitle>
        <CardDescription>
          Create the housekeeping users needed for staff availability mapping.
          These users will match the "Pracownik" names in your CSV import.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          {housekeepingUsers.map((user, index) => (
            <div key={index} className="p-2 bg-muted rounded">
              <div className="font-medium">{user.name}</div>
              <div className="text-muted-foreground">{user.email}</div>
            </div>
          ))}
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            All users will be created with the default password: <strong>housekeeping123</strong>
            <br />
            Users should change their password on first login.
          </AlertDescription>
        </Alert>

        <Button 
          onClick={createUsers} 
          disabled={isCreating}
          className="w-full"
        >
          {isCreating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating Users...
            </>
          ) : (
            'Create All Housekeeping Users'
          )}
        </Button>

        {results.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Creation Results:</h4>
            {results.map((result, index) => (
              <div key={index} className="flex items-center gap-2 p-2 rounded border">
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <div className="flex-1">
                  <div className="font-medium">{result.name}</div>
                  {result.error && (
                    <div className="text-sm text-muted-foreground">{result.error}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
