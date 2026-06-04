/**
 * Auth context — wraps the Supabase session lifecycle.
 *
 * Exposes `<AuthProvider>` (mounted at the App root) and `useAuth()`
 * returning { session, loading, signOut }. No route currently gates on it —
 * it is kept live so a future authenticated surface can consume the session
 * without re-wiring the provider.
 *
 * Magic-link sign-in: enter email → Supabase emails a link → click
 * lands back on the SPA, `detectSessionInUrl: true` parses the hash and
 * stores the session. No password forms, no third-party providers.
 */
import type { Session } from "@supabase/supabase-js";
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
  loading: boolean;
  signOut: () => Promise<void>;
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

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(() => ({ session, loading, signOut }), [session, loading, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
