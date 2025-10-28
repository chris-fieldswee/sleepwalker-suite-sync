import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: "admin" | "reception" | "housekeeping" | null;
  userId: string | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "reception" | "housekeeping" | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const fetchUserProfile = async (userId: string) => {
      try {
        console.log("Fetching profile for auth_id:", userId);
        
        const { data: profile, error: profileError } = await supabase
          .from("users")
          .select("id, role, name, first_name, last_name, active")
          .eq("auth_id", userId)
          .single();
        
        console.log("Profile query result:", { profile, profileError });
        
        if (mounted) {
          if (profile) {
            console.log("User profile found:", profile);
            if (!profile.active) {
              console.warn("User profile is inactive:", profile);
              setUserRole(null);
              setUserId(null);
            } else {
              setUserRole(profile.role);
              setUserId(profile.id);
            }
          } else {
            console.log("No user profile found for auth_id:", userId);
            setUserRole(null);
            setUserId(null);
          }
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        if (mounted) {
          setUserRole(null);
          setUserId(null);
          setLoading(false);
        }
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state change:", event, session?.user?.id);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        } else {
          setUserRole(null);
          setUserId(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      console.log("Initial session check:", session?.user?.id, error);
      
      if (error) {
        console.error("Error getting session:", error);
        if (mounted) setLoading(false);
        return;
      }
      
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        } else {
          setLoading(false);
        }
      }
    }).catch((error) => {
      console.error("Failed to get session:", error);
      if (mounted) {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    // Don't navigate here - let the auth state change handle the redirect
    return { error };
  };

  const signUp = async (email: string, password: string, name: string) => {
    // Note: role is NOT sent to backend for security - always defaults to 'housekeeping'
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          name,
        },
      },
    });

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userRole,
        userId,
        signIn,
        signUp,
        signOut,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
