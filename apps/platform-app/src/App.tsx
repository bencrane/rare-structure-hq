/**
 * App — the platform-app router shell.
 *
 * Public surfaces (anonymous):
 *   `/`                  → redirects to `/map`.
 *   `/map`               → catalyst map demo.
 *   `/proposal/:ref`     → engagement proposal (the ref is its own credential).
 *   `/proposal`          → "reference required" prompt.
 *
 * Auth + cockpit:
 *   `/signin`            → email + password gate.
 *   `/app`               → authenticated cockpit shell (sidebar) with tabs:
 *                          Overview · Map · Pipeline · Applications · Account.
 *
 * <AuthProvider> wraps everything; only the `/app/*` subtree gates on a session
 * via <RequireAuth>. The public surfaces stay anonymous.
 */

import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./app/AppShell";
import { AuthProvider, useAuth } from "./lib/auth";
import MapDemo from "./routes/MapDemo";
import SignIn from "./routes/SignIn";
import Account from "./routes/app/Account";
import Applications from "./routes/app/Applications";
import MapTab from "./routes/app/MapTab";
import Overview from "./routes/app/Overview";
import Pipeline from "./routes/app/Pipeline";
import Proposal from "./routes/proposal/Proposal";

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[color:var(--color-surface-base)]">
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
          Authorizing…
        </span>
      </div>
    );
  }
  if (!session) return <Navigate to="/signin" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public surfaces. */}
        <Route path="/" element={<Navigate to="/map" replace />} />
        <Route path="/map" element={<MapDemo />} />
        <Route path="/proposal" element={<Proposal />} />
        <Route path="/proposal/:ref" element={<Proposal />} />

        {/* Email + password gate. */}
        <Route path="/signin" element={<SignIn />} />

        {/* Authenticated cockpit — persistent sidebar shell wraps the tabs. */}
        <Route
          path="/app"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Overview />} />
          <Route path="map" element={<MapTab />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="applications" element={<Applications />} />
          <Route path="account" element={<Account />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
