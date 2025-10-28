import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && userRole) {
      console.log("Current user role:", userRole); // Debug log
      
      // Add a small delay to prevent rapid redirects
      const timeoutId = setTimeout(() => {
        if (userRole === "housekeeping") {
          navigate("/housekeeping");
        } else if (userRole === "reception") {
          navigate("/reception");
        } else if (userRole === "admin") {
          console.log("Redirecting admin to /admin"); // Debug log
          navigate("/admin");
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    } else if (!loading && !userRole) {
      // User is not authenticated, redirect to auth
      navigate("/auth");
    }
  }, [userRole, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">SleepWalker Boutique Suites</h1>
        <p className="text-xl text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
};

export default Index;
