/**
 * Auth context — wraps the Supabase session lifecycle.
 *
 * Exposes `<AuthProvider>` (mounted at the App root) and `useAuth()` returning
 * `{ session, user, role, isOperator, loading, signIn, signUp, signOut,
 * devSignIn }`. The cockpit (`/app/*`) gates on `session`; operator-only tabs
 * gate on `isOperator`. Public surfaces (`/map`, `/proposal/:ref`) gate on
 * nothing.
 *
 * Role comes from `app_metadata.role` on the Supabase user — server-set and
 * carried in the JWT, so it's tamper-proof. `operator` ⇒ full cockpit; absent
 * ⇒ client (scoped portal).
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

type Role = "operator" | "client";

interface AuthState {
  session: Session | null;
  user: User | null;
  /** `app_metadata.role` from the JWT, or null. */
  role: string | null;
  /** Convenience: the signed-in user carries the operator role. */
  isOperator: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  /**
   * DEV-only: drop a mock session (operator or client) so both portal variants
   * are reachable on localhost without real logins. `import.meta.env.DEV` is
   * statically false in production builds, so the mock branch is tree-shaken
   * out — it can never mint a session in prod.
   */
  devSignIn: (as?: Role) => void;
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

  const devSignIn = useCallback((as: Role = "operator") => {
    if (!import.meta.env.DEV) return;
    const operator = as === "operator";
    setSession({
      access_token: "dev",
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: "dev",
      user: {
        id: operator ? "dev-operator" : "dev-client",
        email: operator ? "operator@rarestructure.dev" : "client@thehardmoneyco.com",
        app_metadata: operator ? { role: "operator" } : {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      },
    } as unknown as Session);
    setLoading(false);
  }, []);

  const role = (session?.user?.app_metadata?.role as string | undefined) ?? null;

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      role,
      isOperator: role === "operator",
      loading,
      signIn,
      signUp,
      signOut,
      devSignIn,
    }),
    [session, role, loading, signIn, signUp, signOut, devSignIn],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
