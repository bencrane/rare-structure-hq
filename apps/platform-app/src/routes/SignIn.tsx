import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@rare-structure-hq/ui";

import { useAuth } from "@/lib/auth";

type Mode = "signin" | "signup";

/**
 * SignIn — email + password gate for the authenticated cockpit (`/app/*`).
 *
 * Full-screen, sidebar-free. A live session bounces straight to `/app`. In DEV
 * a preview affordance drops a mock session so the shell is reachable on
 * localhost without a configured Supabase project.
 */
export default function SignIn() {
  const { signIn, signUp, devSignIn, session } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) navigate("/app", { replace: true });
  }, [session, navigate]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    if (mode === "signin") {
      const { error: err } = await signIn(email, password);
      if (err) setError(err);
      else navigate("/app");
    } else {
      const { error: err, needsConfirmation } = await signUp(email, password);
      if (err) setError(err);
      else if (needsConfirmation) setNotice("Account created. Confirm your email, then sign in.");
      else navigate("/app");
    }
    setBusy(false);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[color:var(--color-surface-base)]">
      <div className="w-full max-w-[22rem] px-6">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <span className="font-display text-[0.9375rem] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-primary)]">
            Rare Structure
          </span>
          <span className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-[color:var(--color-text-accent)]">
            Catalyst Cockpit
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="email"
              className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-[color:var(--color-text-subtle)]"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@firm.com"
              className="border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)] px-3 py-2.5 text-body-sm text-[color:var(--color-text-primary)] outline-none placeholder:text-[color:var(--color-text-subtle)] focus:border-[color:var(--color-text-accent)]"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="password"
              className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-[color:var(--color-text-subtle)]"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)] px-3 py-2.5 text-body-sm text-[color:var(--color-text-primary)] outline-none placeholder:text-[color:var(--color-text-subtle)] focus:border-[color:var(--color-text-accent)]"
            />
          </div>

          {error ? (
            <p className="font-mono text-[0.6875rem] text-[color:var(--color-state-error)]">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="font-mono text-[0.6875rem] text-[color:var(--color-text-accent)]">
              {notice}
            </p>
          ) : null}

          <Button type="submit" variant="primary" disabled={busy} className="w-full">
            {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setNotice(null);
          }}
          className="mt-5 w-full text-center font-mono text-[0.625rem] uppercase tracking-[0.12em] text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-default)]"
        >
          {mode === "signin" ? "Need an account? Create one" : "Have an account? Sign in"}
        </button>

        {import.meta.env.DEV ? (
          <button
            type="button"
            onClick={devSignIn}
            className="mt-3 w-full text-center font-mono text-[0.625rem] uppercase tracking-[0.16em] text-[color:var(--color-text-subtle)] transition-colors hover:text-[color:var(--color-text-accent)]"
          >
            Preview as operator (dev)
          </button>
        ) : null}
      </div>
    </div>
  );
}
