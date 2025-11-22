import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const Index = () => {
  const { userRole, loading, user } = useAuth();
  const navigate = useNavigate();
  const hasNavigated = useRef(false);

  useEffect(() => {
    // Prevent multiple navigations
    if (hasNavigated.current) return;

    if (!loading) {
      if (userRole) {
        hasNavigated.current = true;
        if (userRole === "housekeeping") {
          navigate("/housekeeping", { replace: true });
        } else if (userRole === "reception") {
          navigate("/reception", { replace: true });
        } else if (userRole === "admin") {
          navigate("/admin", { replace: true });
        }
      } else if (!user) {
        // No user session - redirect to auth
        // Only redirect if there's no user at all
        hasNavigated.current = true;
        navigate("/auth", { replace: true });
      }
      // If user exists but userRole is null (e.g., profile fetch failed), stay on Index
      // This prevents redirect loops when profile fetch times out but user is authenticated
    }
  }, [userRole, loading, navigate, user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // If user exists but no role (profile fetch may have failed), show message
  if (!loading && user && !userRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">SleepWalker Boutique Suites</h1>
          <p className="text-xl text-muted-foreground">Nie udało się załadować profilu użytkownika. Odśwież stronę lub skontaktuj się z pomocą techniczną.</p>
          <Button onClick={() => window.location.reload()}>Odśwież Stronę</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">SleepWalker Boutique Suites</h1>
        <p className="text-xl text-muted-foreground">Przekierowywanie...</p>
      </div>
    </div>
  );
};

export default Index;
