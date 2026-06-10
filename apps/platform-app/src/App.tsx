/**
 * App — the platform-app router shell.
 *
 * Public surfaces (anonymous):
 *   `/`                  → redirects to `/signin` (the gate is the front door).
 *   `/map`               → catalyst map demo.
 *   `/p/:ref`            → engagement proposal shell (the ref is its own credential).
 *   `/p/:ref/sign`       → full-page Documenso signing view.
 *
 * Auth + cockpit:
 *   `/signin`            → email + password gate.
 *   `/app`               → authenticated cockpit, role-gated on
 *                          `app_metadata.role`. Operator: full set (Map ·
 *                          Overview · Pipeline · Applications · Account), lands
 *                          on Map. Client: Account · Preferences, lands on
 *                          Account. The sidebar is collapsible (persisted).
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
import BookingProfile from "./routes/app/BookingProfile";
import Calendar from "./routes/app/Calendar";
import Dossier from "./routes/app/Dossier";
import MapTab from "./routes/app/MapTab";
import Overview from "./routes/app/Overview";
import Pipeline from "./routes/app/Pipeline";
import Preferences from "./routes/app/Preferences";
import Proposals from "./routes/app/Proposals";
import Settings from "./routes/app/Settings";
import TemplateEditor from "./routes/app/TemplateEditor";
import TemplatesTable from "./routes/app/TemplatesTable";
import PayPage from "./routes/p/PayPage";
import ProposalShellPage from "./routes/p/ProposalShell";
import SignPage from "./routes/p/SignPage";

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

// `/app` index → the role's home tab.
function AppIndex() {
  const { isOperator } = useAuth();
  return <Navigate to={isOperator ? "/app/map" : "/app/account"} replace />;
}

// Operator-only surface. A client who reaches one (e.g. by typing the URL) is
// bounced to their home tab. Real per-tenant data scoping is server-side; this
// gates the UI.
function RequireOperator({ children }: { children: ReactNode }) {
  const { isOperator } = useAuth();
  return isOperator ? <>{children}</> : <Navigate to="/app/account" replace />;
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public surfaces. The root lands on the sign-in gate; the map keeps
            its own path. */}
        <Route path="/" element={<Navigate to="/signin" replace />} />
        <Route path="/map" element={<MapDemo />} />
        {/* Engagement proposal shell — the ref is its own credential. */}
        <Route path="/p/:ref" element={<ProposalShellPage />} />
        {/* Full-page signing view — Documenso two-column embed, on our domain. */}
        <Route path="/p/:ref/sign" element={<SignPage />} />
        {/* ACH payment view — Stripe Elements, on our domain, after signing. */}
        <Route path="/p/:ref/pay" element={<PayPage />} />

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
          <Route index element={<AppIndex />} />
          <Route
            path="map"
            element={
              <RequireOperator>
                <MapTab />
              </RequireOperator>
            }
          />
          <Route
            path="overview"
            element={
              <RequireOperator>
                <Overview />
              </RequireOperator>
            }
          />
          <Route
            path="pipeline"
            element={
              <RequireOperator>
                <Pipeline />
              </RequireOperator>
            }
          />
          <Route
            path="applications"
            element={
              <RequireOperator>
                <Applications />
              </RequireOperator>
            }
          />
          <Route
            path="dossier"
            element={
              <RequireOperator>
                <Dossier />
              </RequireOperator>
            }
          />
          {/* Booking-meeting profile — opened from a Pipeline row. Shows the cal booking
              now; enrichment populates the full dossier later. */}
          <Route
            path="bookings/:bookingId"
            element={
              <RequireOperator>
                <BookingProfile />
              </RequireOperator>
            }
          />
          <Route
            path="proposals"
            element={
              <RequireOperator>
                <Proposals />
              </RequireOperator>
            }
          />
          <Route
            path="calendar"
            element={
              <RequireOperator>
                <Calendar />
              </RequireOperator>
            }
          />
          <Route
            path="settings"
            element={
              <RequireOperator>
                <Settings />
              </RequireOperator>
            }
          />
          <Route
            path="settings/templates"
            element={
              <RequireOperator>
                <TemplatesTable />
              </RequireOperator>
            }
          />
          <Route
            path="settings/templates/new"
            element={
              <RequireOperator>
                <TemplateEditor />
              </RequireOperator>
            }
          />
          <Route
            path="settings/templates/:id"
            element={
              <RequireOperator>
                <TemplateEditor />
              </RequireOperator>
            }
          />
          <Route path="account" element={<Account />} />
          <Route path="preferences" element={<Preferences />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
