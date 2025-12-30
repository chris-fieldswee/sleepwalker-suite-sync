import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { adminApi } from "@/lib/admin-api";
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
    if (!adminApi.isAvailable()) {
      toast({
        title: "Błąd",
        description: "Klient administratora niedostępny. Upewnij się, że VITE_SUPABASE_SERVICE_ROLE_KEY jest ustawiony w .env.local (lokalnie) lub SUPABASE_SERVICE_ROLE_KEY w Vercel (produkcja)",
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
          .maybeSingle();

        if (existingUser) {
          if (existingUser.auth_id) {
            creationResults.push({
              name: user.name,
              success: true,
              error: 'Użytkownik już istnieje z kontem autoryzacji',
              userId: existingUser.id
            });
          } else {
            creationResults.push({
              name: user.name,
              success: true,
              error: 'Użytkownik istnieje, ale potrzebuje konta autoryzacji - utwórz ręcznie',
              userId: existingUser.id
            });
          }
          continue;
        }

        // Create user using admin API
        const result = await adminApi.createUser({
          email: user.email,
          password: 'housekeeping123', // Default password
          name: user.name,
          first_name: user.firstName,
          last_name: user.lastName,
          role: "housekeeping",
          active: true,
        });

        creationResults.push({
          name: user.name,
          success: true,
          userId: result.user.id
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
      title: "Tworzenie Użytkowników Zakończone",
      description: `Pomyślnie utworzono ${successCount} użytkowników. ${errorCount} nie powiodło się.`,
      variant: errorCount > 0 ? "destructive" : "default",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Utwórz użytkowników sprzątających</CardTitle>
        <CardDescription>
          Utwórz użytkowników sprzątających potrzebnych do mapowania dostępności personelu.
          Ci użytkownicy będą pasować do nazw "Pracownik" w imporcie CSV.
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
            Wszyscy użytkownicy zostaną utworzeni z domyślnym hasłem: <strong>housekeeping123</strong>
            <br />
            Użytkownicy powinni zmienić hasło przy pierwszym logowaniu.
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
              Tworzenie Użytkowników...
            </>
          ) : (
            'Utwórz Wszystkich Użytkowników Sprzątających'
          )}
        </Button>

        {results.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Wyniki Tworzenia:</h4>
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
