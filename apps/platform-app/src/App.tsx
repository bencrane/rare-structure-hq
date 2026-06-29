/**
 * App — the platform-app router shell.
 *
 * Public surfaces (anonymous):
 *   `/`                  → redirects to `/signin` (the gate is the front door).
 *   `/map`               → un-hosted; redirects to `/signin`. The catalyst map
 *                          demo component is kept at routes/MapDemo.tsx for
 *                          re-enable (not deleted).
 *   `/p/:ref`            → engagement proposal summary (the ref is its own credential).
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
// `/map` is un-hosted (see route below). MapDemo is kept on disk for quick
// re-enable; do not delete. Restore this import to bring the route back.
// import MapDemo from "./routes/MapDemo";
import SignIn from "./routes/SignIn";
import Account from "./routes/app/Account";
import Application from "./routes/app/Application";
import Applications from "./routes/app/Applications";
import DealDetails from "./routes/app/DealDetails";
import Calendar from "./routes/app/Calendar";
import DocumensoTemplatesEditor from "./routes/app/DocumensoTemplatesEditor";
import DocumensoTemplatesManage from "./routes/app/DocumensoTemplatesManage";
import Dossier from "./routes/app/Dossier";
import EngagementTemplateToDocumenso from "./routes/app/EngagementTemplateToDocumenso";
import EngagementTemplatesRender from "./routes/app/EngagementTemplatesRender";
import Insights from "./routes/app/Insights";
import MapTab from "./routes/app/MapTab";
import Overview from "./routes/app/Overview";
import Preferences from "./routes/app/Preferences";
import Research from "./routes/app/Research";
import Settings from "./routes/app/Settings";
import SettingsDocumenso from "./routes/app/SettingsDocumenso";
import SettingsEngagement from "./routes/app/SettingsEngagement";
import SettingsOrigination from "./routes/app/SettingsOrigination";
import SettingsProposalTemplates from "./routes/app/SettingsProposalTemplates";
import SettingsRenderPush from "./routes/app/SettingsRenderPush";
import TemplateEditor from "./routes/app/TemplateEditor";
import TemplatesTable from "./routes/app/TemplatesTable";
import DirectTemplateSignPage from "./routes/p/DirectTemplateSignPage";
import DocumentPaymentPage from "./routes/p/DocumentPaymentPage";
import DocumentSignPage from "./routes/p/DocumentSignPage";

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
        {/* `/map` is un-hosted. Restore the MapDemo import above and swap the
            element back to `<MapDemo />` to re-enable. */}
        <Route path="/map" element={<Navigate to="/signin" replace />} />
        {/* Direct-to-documenso prospect signing — the opportunity UUID is the unguessable access
            capability, the numeric document id a disambiguator behind it. The static `/p/m/` segment
            ranks above the dynamic `/p/:ref`, so there is no collision. */}
        <Route path="/p/m/:opportunityId/:documentId" element={<DocumentSignPage />} />
        {/* Direct-to-documenso EMBED-TEMPLATE (self-serve direct link) — the embed-template lane,
            PARALLEL to /p/m/ above. No document exists up front: the path carries the opportunity
            handle + the reusable Documenso DIRECT-TEMPLATE token (the capability). The signer
            self-identifies; Documenso creates the document on completion. The static `/p/t/` segment
            ranks above the dynamic `/p/:ref`, so there is no collision. */}
        <Route path="/p/t/:opportunityId/:directToken" element={<DirectTemplateSignPage />} />
        {/* Direct-to-documenso ACH payment — same (opportunity, document) pair; reached from the
            signed-confirmation "Continue to payment" CTA. Ranks above the dynamic /p/:ref/pay. */}
        <Route path="/p/m/:opportunityId/:documentId/pay" element={<DocumentPaymentPage />} />

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
            path="applications"
            element={
              <RequireOperator>
                <Applications />
              </RequireOperator>
            }
          />
          <Route
            path="research"
            element={
              <RequireOperator>
                <Research />
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
          {/* Application detail — opened from an Applications row by the deal's 8-char handle.
              Resolves handle → deal → last booking for the company profile + originate. */}
          <Route
            path="applications/:handle"
            element={
              <RequireOperator>
                <Application />
              </RequireOperator>
            }
          />
          {/* Deal Details editor — opened from a Research row by the deal's 8-char handle.
              Editable deal_details (contacts + attached Documenso template), saved to business.deal_details. */}
          <Route
            path="deals/:handle"
            element={
              <RequireOperator>
                <DealDetails />
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
            path="insights"
            element={
              <RequireOperator>
                <Insights />
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
            path="settings/proposal-templates"
            element={
              <RequireOperator>
                <SettingsProposalTemplates />
              </RequireOperator>
            }
          />
          <Route
            path="settings/origination"
            element={
              <RequireOperator>
                <SettingsOrigination />
              </RequireOperator>
            }
          />
          <Route
            path="settings/documenso"
            element={
              <RequireOperator>
                <SettingsDocumenso />
              </RequireOperator>
            }
          />
          <Route
            path="settings/documenso/templates"
            element={
              <RequireOperator>
                <DocumensoTemplatesManage />
              </RequireOperator>
            }
          />
          <Route
            path="settings/engagement"
            element={
              <RequireOperator>
                <SettingsEngagement />
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
          <Route
            path="settings/documenso-templates"
            element={
              <RequireOperator>
                <DocumensoTemplatesEditor />
              </RequireOperator>
            }
          />
          <Route
            path="settings/engagement-templates"
            element={
              <RequireOperator>
                <EngagementTemplatesRender />
              </RequireOperator>
            }
          />
          <Route
            path="settings/engagement-templates/documenso"
            element={
              <RequireOperator>
                <EngagementTemplateToDocumenso />
              </RequireOperator>
            }
          />
          <Route
            path="settings/render-push"
            element={
              <RequireOperator>
                <SettingsRenderPush />
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
