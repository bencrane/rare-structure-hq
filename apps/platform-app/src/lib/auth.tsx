/**
 * Auth context — wraps the Supabase session lifecycle.
 *
 * Exposes `<AuthProvider>` (mounted at the App root) and `useAuth()` returning
 * `{ session, user, loading, signIn, signUp, signOut, devSignIn }`. The
 * authenticated cockpit (`/app/*`) gates on `session`; the public surfaces
 * (`/map`, `/proposal/:ref`) do not.
 *
 * Email + password sign-in via Supabase. `signUp` reports `needsConfirmation`
 * when the project requires email confirmation before the account can sign in.
 */
import type { Session, User } from "@supabase/supabase-js";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "./supabase";

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  /**
   * DEV-only: drop a mock session so the cockpit shell is reachable on
   * localhost without a configured Supabase project. `import.meta.env.DEV` is
   * statically false in production builds, so the mock branch is tree-shaken
   * out — it can never mint a session in prod.
   */
  devSignIn: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    // No session back (and no error) means the project requires email
    // confirmation before the account can sign in.
    return { error: error?.message ?? null, needsConfirmation: !error && !data.session };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null); // also clears a DEV mock session
  }, []);

  const devSignIn = useCallback(() => {
    if (!import.meta.env.DEV) return;
    setSession({
      access_token: "dev",
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: "dev",
      user: {
        id: "dev-operator",
        email: "operator@rarestructure.dev",
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      },
    } as unknown as Session);
    setLoading(false);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signIn,
      signUp,
      signOut,
      devSignIn,
    }),
    [session, loading, signIn, signUp, signOut, devSignIn],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
