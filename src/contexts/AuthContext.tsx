import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: "admin" | "reception" | "housekeeping" | null;
  userId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
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
    let timeoutId: NodeJS.Timeout | null = null;
    let isFetching = false; // Prevent concurrent fetches

    const fetchUserProfile = async (userId: string) => {
      // Prevent concurrent fetches for the same user
      if (isFetching) {
        console.log("Profile fetch already in progress, skipping...");
        return;
      }

      isFetching = true;
      const queryStartTime = Date.now();
      
      try {
        console.log("Fetching user profile for auth_id:", userId);
        
        // Shorter timeout (5 seconds) - if query takes longer, it's likely blocked or network issue
        const queryPromise = supabase
          .from("users")
          .select("id, role, name, first_name, last_name, active")
          .eq("auth_id", userId)
          .maybeSingle(); // Use maybeSingle() instead of single() to avoid errors when no rows found

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Query timeout after 5 seconds")), 5000);
        });

        let profile: any = null;
        let error: any = null;

        try {
          // Race between query and timeout - if timeout wins, query is cancelled
          const result = await Promise.race([queryPromise, timeoutPromise]);
          profile = result.data;
          error = result.error;
          const queryDuration = Date.now() - queryStartTime;
          console.log(`Profile query completed in ${queryDuration}ms`, { profile: profile ? "found" : "not found", error });
        } catch (raceError: any) {
          // Promise.race rejected (timeout or other error)
          const queryDuration = Date.now() - queryStartTime;
          error = { message: raceError.message || "Query timeout", code: "TIMEOUT" };
          console.error(`Profile query timed out or failed after ${queryDuration}ms:`, raceError);
        }

        if (!mounted) return;

        // Clear timeout since we got a response
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        if (error) {
          console.error("Error fetching user profile:", error);
          // If user doesn't exist in public.users, that's OK - they're just not active
          if (error.code === 'PGRST116' || error.code === '42703' || error.message?.includes('timeout')) {
            // No rows returned or timeout - user exists in auth but not in public.users
            console.warn("User profile not found in public.users table or query timed out");
          }
          setUserRole(null);
          setUserId(null);
          setLoading(false);
          return;
        }

        if (profile && profile.active) {
          console.log("User profile loaded:", { role: profile.role, userId: profile.id });
          setUserRole(profile.role);
          setUserId(profile.id);
        } else {
          console.warn("User profile found but inactive or null:", profile);
          setUserRole(null);
          setUserId(null);
        }
        setLoading(false);
      } catch (error: any) {
        const queryDuration = Date.now() - queryStartTime;
        console.error(`Unexpected error fetching user profile (after ${queryDuration}ms):`, error);
        if (mounted) {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          setUserRole(null);
          setUserId(null);
          setLoading(false);
        }
      } finally {
        isFetching = false;
      }
    };

    // Safety timeout: Force loading to false after 7 seconds to prevent infinite loading
    // This is slightly longer than the query timeout (5 seconds) to allow error handling
    timeoutId = setTimeout(() => {
      if (mounted) {
        console.warn("Auth profile fetch safety timeout - forcing loading to false (query likely hung)");
        setUserRole(null);
        setUserId(null);
        setLoading(false);
      }
    }, 7000);

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        // Clear timeout since we got an auth state change
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

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
    supabase.auth.getSession()
      .then(async ({ data: { session }, error }) => {
        if (!mounted) return;

        if (error) {
          console.error("Error getting session:", error);
          if (timeoutId) clearTimeout(timeoutId);
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchUserProfile(session.user.id);
        } else {
          if (timeoutId) clearTimeout(timeoutId);
          setLoading(false);
        }
      })
      .catch((error) => {
        console.error("Failed to get session:", error);
        if (mounted) {
          if (timeoutId) clearTimeout(timeoutId);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, name: string) => {
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
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Error signing out:", error);
      }
      // Clear local state
      setUser(null);
      setSession(null);
      setUserRole(null);
      setUserId(null);
      // Navigate to auth page
      navigate("/auth", { replace: true });
    } catch (error) {
      console.error("Error signing out:", error);
      // Still try to navigate even if signOut fails
      setUser(null);
      setSession(null);
      setUserRole(null);
      setUserId(null);
      navigate("/auth", { replace: true });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userRole,
        userId,
        loading,
        signIn,
        signUp,
        signOut,
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