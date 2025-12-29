import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ForcePasswordChange } from "@/components/ForcePasswordChange";
import { supabase } from "@/integrations/supabase/client";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  const { signIn, user, userRole, loading, requiresPasswordChange } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Handle password change completion
  const handlePasswordChanged = async () => {
    // Refresh the session to get updated user metadata
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setPasswordChanged(true);
      // The auth state change will handle redirect
    }
  };

  // Redirect if user is already authenticated and password change is not required
  useEffect(() => {
    if (!loading && user && userRole && !requiresPasswordChange) {
      if (passwordChanged) {
        // After password change, redirect based on role
        if (userRole === "admin") {
          navigate("/admin", { replace: true });
        } else if (userRole === "reception") {
          navigate("/reception", { replace: true });
        } else if (userRole === "housekeeping") {
          navigate("/housekeeping", { replace: true });
        }
      } else {
        // Normal redirect for already authenticated users
        if (userRole === "admin") {
          navigate("/admin", { replace: true });
        } else if (userRole === "reception") {
          navigate("/reception", { replace: true });
        } else if (userRole === "housekeeping") {
          navigate("/housekeeping", { replace: true });
        }
      }
    }
  }, [user, userRole, loading, requiresPasswordChange, passwordChanged, navigate]);

  // Show password change screen if required (after all hooks)
  if (!loading && user && requiresPasswordChange) {
    return <ForcePasswordChange onPasswordChanged={handlePasswordChanged} />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const trimmedEmail = email.trim();

    try {
      const { error } = await signIn(trimmedEmail, password);
      if (error) {
        console.error("Login error details:", {
          message: error.message,
          status: error.status,
          code: error.code,
          error: error
        });
        toast({
          title: "Błąd",
          description: error.message || `Logowanie nieudane: ${error.status || 'Nieznany błąd'}`,
          variant: "destructive",
        });
        setSubmitting(false);
      } else {
        // Success - auth state change will handle redirect
        toast({
          title: "Sukces",
          description: "Logowanie...",
        });
        // Don't set submitting to false here - let auth state change handle redirect
      }
    } catch (error: any) {
      toast({
        title: "Błąd",
        description: error.message || "Wystąpił nieoczekiwany błąd.",
        variant: "destructive",
      });
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ backgroundColor: '#7d212b' }}>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <img 
              src="/hotel-logo.svg" 
              alt="Hotel Logo" 
              className="h-16 w-auto"
              style={{ filter: 'brightness(0)' }}
            />
          </div>
          <CardTitle className="text-2xl font-bold">
            Zaloguj
          </CardTitle>
          <CardDescription>
            Wprowadź swoje dane, aby uzyskać dostęp do systemu
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Hasło</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6} // Added minimum password length as per Supabase default
              />
            </div>


            <Button type="submit" className="w-full" disabled={submitting || loading}>
              {submitting ? "Ładowanie..." : "Zaloguj"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
