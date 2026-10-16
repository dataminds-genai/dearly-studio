import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface UserProfile {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SignUpResult {
  error: Error | null;
  needsEmailConfirmation?: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isEmailVerified: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string, fullName?: string) => Promise<SignUpResult>;
  signOut: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  updateProfile: (updates: {
    fullName?: string;
    avatarUrl?: string;
  }) => Promise<{ error: Error | null }>;
  resendVerificationEmail: (email: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function buildFallbackProfile(user: User): UserProfile {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const fullName =
    typeof meta?.["full_name"] === "string"
      ? (meta["full_name"] as string)
      : typeof meta?.["name"] === "string"
        ? (meta["name"] as string)
        : user.email
          ? (user.email.split("@")[0] ?? null)
          : null;

  const avatarUrl =
    typeof meta?.["avatar_url"] === "string" ? (meta["avatar_url"] as string) : null;

  return {
    id: user.id,
    email: user.email ?? null,
    fullName,
    avatarUrl,
    createdAt: user.created_at,
    updatedAt: user.updated_at ?? user.created_at,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = useCallback(async (currentUser: User) => {
    try {
      // Safely query optional public.profiles table
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (!error && data) {
        const meta = currentUser.user_metadata as Record<string, unknown> | undefined;
        setProfile({
          id: data["id"] as string,
          email: (data["email"] as string) ?? currentUser.email ?? null,
          fullName: (data["full_name"] as string) ?? (meta?.["full_name"] as string) ?? null,
          avatarUrl: (data["avatar_url"] as string) ?? (meta?.["avatar_url"] as string) ?? null,
          createdAt: (data["created_at"] as string) ?? currentUser.created_at,
          updatedAt:
            (data["updated_at"] as string) ?? currentUser.updated_at ?? currentUser.created_at,
        });
        return;
      }
    } catch {
      // Ignore if profiles table is not yet provisioned; fall back to user metadata
    }

    setProfile(buildFallbackProfile(currentUser));
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initSession() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn("[Auth] Session initialization warning:", error.message);
        }
        if (mounted) {
          setSession(data.session);
          setUser(data.session?.user ?? null);
          if (data.session?.user) {
            await fetchProfile(data.session.user);
          }
        }
      } catch (err) {
        console.error("[Auth] Session fetch failed:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void initSession();

    let subscription: { unsubscribe: () => void } | undefined;
    try {
      const authListener = supabase.auth.onAuthStateChange(async (_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          await fetchProfile(newSession.user);
        } else {
          setProfile(null);
        }
        setLoading(false);
      });
      subscription = authListener?.data?.subscription;
    } catch (err) {
      console.warn("[Auth] onAuthStateChange setup warning:", err);
      setLoading(false);
    }

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [fetchProfile]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) return { error };
        if (data.user) {
          setUser(data.user);
          setSession(data.session);
          await fetchProfile(data.user);
        }
        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err : new Error(String(err)) };
      }
    },
    [fetchProfile],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, fullName?: string) => {
      try {
        const redirectUrl =
          typeof window !== "undefined" ? `${window.location.origin}/auth` : undefined;

        const options: { emailRedirectTo?: string; data?: Record<string, unknown> } = {};
        if (redirectUrl) options.emailRedirectTo = redirectUrl;
        if (fullName) options.data = { full_name: fullName.trim() };

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options,
        });

        if (error) return { error, needsEmailConfirmation: false };

        const needsEmailConfirmation =
          !data.session && Boolean(data.user && !data.user.email_confirmed_at);

        if (data.session?.user) {
          setUser(data.session.user);
          setSession(data.session);
          await fetchProfile(data.session.user);
        }

        return { error: null, needsEmailConfirmation };
      } catch (err) {
        return {
          error: err instanceof Error ? err : new Error(String(err)),
          needsEmailConfirmation: false,
        };
      }
    },
    [fetchProfile],
  );

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) return { error };
      setUser(null);
      setSession(null);
      setProfile(null);
      if (typeof window !== "undefined") {
        try {
          sessionStorage.removeItem("dearly_guest_preview");
          window.dispatchEvent(new Event("dearly_auth_changed"));
        } catch {
          // ignore
        }
      }
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      const redirectUrl =
        typeof window !== "undefined" ? `${window.location.origin}/auth?mode=recovery` : undefined;

      const options: { redirectTo?: string } = {};
      if (redirectUrl) options.redirectTo = redirectUrl;

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), options);
      if (error) return { error };
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return { error };
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  }, []);

  const updateProfile = useCallback(
    async (updates: { fullName?: string; avatarUrl?: string }) => {
      if (!user) return { error: new Error("User not authenticated") };

      try {
        const metadataUpdates: Record<string, unknown> = {};
        if (updates.fullName !== undefined) metadataUpdates["full_name"] = updates.fullName;
        if (updates.avatarUrl !== undefined) metadataUpdates["avatar_url"] = updates.avatarUrl;

        // 1. Update Supabase Auth user metadata
        const { data: updatedAuth, error: authError } = await supabase.auth.updateUser({
          data: metadataUpdates,
        });

        if (authError) return { error: authError };

        // 2. Try updating public.profiles table if it exists
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("profiles")
            .update({
              full_name: updates.fullName,
              avatar_url: updates.avatarUrl,
              updated_at: new Date().toISOString(),
            })
            .eq("id", user.id);
        } catch {
          // profiles table might not exist yet, metadata update is sufficient
        }

        if (updatedAuth.user) {
          setUser(updatedAuth.user);
          await fetchProfile(updatedAuth.user);
        }

        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err : new Error(String(err)) };
      }
    },
    [user, fetchProfile],
  );

  const resendVerificationEmail = useCallback(async (email: string) => {
    try {
      const redirectUrl =
        typeof window !== "undefined" ? `${window.location.origin}/auth` : undefined;

      const options: { emailRedirectTo?: string } = {};
      if (redirectUrl) options.emailRedirectTo = redirectUrl;

      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options,
      });
      if (error) return { error };
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user);
    }
  }, [user, fetchProfile]);

  const isEmailVerified = useMemo(() => {
    if (!user) return false;
    return Boolean(user.email_confirmed_at);
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      loading,
      isEmailVerified,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      resetPassword,
      updatePassword,
      updateProfile,
      resendVerificationEmail,
      refreshProfile,
    }),
    [
      user,
      session,
      profile,
      loading,
      isEmailVerified,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      resetPassword,
      updatePassword,
      updateProfile,
      resendVerificationEmail,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
