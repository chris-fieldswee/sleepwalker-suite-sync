import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { signIn, signUp, user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect if user is already authenticated
  useEffect(() => {
    if (!loading && user && userRole) {
      if (userRole === "admin") {
        navigate("/admin", { replace: true });
      } else if (userRole === "reception") {
        navigate("/reception", { replace: true });
      } else if (userRole === "housekeeping") {
        navigate("/housekeeping", { replace: true });
      }
    }
  }, [user, userRole, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const trimmedEmail = email.trim();

    try {
      if (isLogin) {
        const { error } = await signIn(trimmedEmail, password);
        if (error) {
          console.error("Login error details:", {
            message: error.message,
            status: error.status,
            code: error.code,
            error: error
          });
          toast({
            title: "Error",
            description: error.message || `Login failed: ${error.status || 'Unknown error'}`,
            variant: "destructive",
          });
          setSubmitting(false);
        } else {
          // Success - auth state change will handle redirect
          toast({
            title: "Success",
            description: "Signing in...",
          });
          // Don't set submitting to false here - let auth state change handle redirect
        }
      } else {
        // Role is always set to housekeeping by default on backend for security
        const { error } = await signUp(trimmedEmail, password, name);
        if (error) {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
          setSubmitting(false);
        } else {
          toast({
            title: "Success",
            description: "Account created successfully. Contact admin for role assignment.",
          });
          setIsLogin(true);
          setEmail("");
          setPassword("");
          setName("");
          setSubmitting(false);
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">
            {isLogin ? "Sign In" : "Create Account"}
          </CardTitle>
          <CardDescription>
            {isLogin
              ? "Enter your credentials to access the system"
              : "Fill in your details to create an account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                />
              </div>
            )}

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
              <Label htmlFor="password">Password</Label>
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
              {submitting ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            {isLogin ? (
              <>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className="font-medium text-primary hover:underline"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className="font-medium text-primary hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
