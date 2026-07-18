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

import { type ReactNode, Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./app/AppShell";
import { ActiveDealProvider } from "./lib/activeDeal";
import { AuthProvider, useAuth } from "./lib/auth";
// `/map` is un-hosted (see route below). MapDemo is kept on disk for quick
// re-enable; do not delete. Restore this import (lazy) to bring the route back.
// const MapDemo = lazy(() => import("./routes/MapDemo"));
import SignIn from "./routes/SignIn";

// Route-level code splitting: every surface behind the sign-in gate (and the
// prospect /p/* pages) loads on demand. Only the gate itself ships in the main
// chunk — the demo narratives, the viewer (and its baked JSON fixtures), the
// settings tree, and the cockpit tabs each become their own chunk.
const Viewer = lazy(() => import("./routes/Viewer"));
const Account = lazy(() => import("./routes/app/Account"));
const Application = lazy(() => import("./routes/app/Application"));
const Applications = lazy(() => import("./routes/app/Applications"));
const Calendar = lazy(() => import("./routes/app/Calendar"));
const CapabilityDetail = lazy(() => import("./routes/app/CapabilityDetail"));
const DealDetails = lazy(() => import("./routes/app/DealDetails"));
const DemoGallery = lazy(() => import("./routes/app/DemoGallery"));
const DemoTour = lazy(() => import("./routes/app/DemoTour"));
const DocumensoTemplateMirror = lazy(() => import("./routes/app/DocumensoTemplateMirror"));
const DocumensoTemplatesEditor = lazy(() => import("./routes/app/DocumensoTemplatesEditor"));
const DocumensoTemplatesManage = lazy(() => import("./routes/app/DocumensoTemplatesManage"));
const Dossier = lazy(() => import("./routes/app/Dossier"));
const EngagementTemplateToDocumenso = lazy(
  () => import("./routes/app/EngagementTemplateToDocumenso"),
);
const EngagementTemplatesRender = lazy(() => import("./routes/app/EngagementTemplatesRender"));
const Insights = lazy(() => import("./routes/app/Insights"));
const JtbdReview = lazy(() => import("./routes/app/JtbdReview"));
const ManageDocumensoTemplates = lazy(() => import("./routes/app/ManageDocumensoTemplates"));
const Mandate = lazy(() => import("./routes/app/Mandate"));
const MandateBrief = lazy(() => import("./routes/app/MandateBrief"));
const MapTab = lazy(() => import("./routes/app/MapTab"));
const DealIntake = lazy(() => import("./routes/app/DealIntake"));
const MarketSpec = lazy(() => import("./routes/app/MarketSpec"));
const Overview = lazy(() => import("./routes/app/Overview"));
const Preferences = lazy(() => import("./routes/app/Preferences"));
const Research = lazy(() => import("./routes/app/Research"));
const Settings = lazy(() => import("./routes/app/Settings"));
const SettingsDocumenso = lazy(() => import("./routes/app/SettingsDocumenso"));
const SettingsEngagement = lazy(() => import("./routes/app/SettingsEngagement"));
const SettingsNewDeal = lazy(() => import("./routes/app/SettingsNewDeal"));
const SettingsOrigination = lazy(() => import("./routes/app/SettingsOrigination"));
const SettingsProposalTemplates = lazy(() => import("./routes/app/SettingsProposalTemplates"));
const TemplateEditor = lazy(() => import("./routes/app/TemplateEditor"));
const TemplatesTable = lazy(() => import("./routes/app/TemplatesTable"));
const DirectTemplateSignPage = lazy(() => import("./routes/p/DirectTemplateSignPage"));
const DocumentPaymentPage = lazy(() => import("./routes/p/DocumentPaymentPage"));
const DocumentSignPage = lazy(() => import("./routes/p/DocumentSignPage"));

// Minimal route-load fallback — same visual register as the RequireAuth
// "Authorizing…" state so lazy-chunk loads read as part of the shell.
function RouteFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[color:var(--color-surface-base)]">
      <span className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
        Loading…
      </span>
    </div>
  );
}

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
      <Suspense fallback={<RouteFallback />}>
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

          {/* Internal data viewer — its own shell + sidebar, outside AppShell. */}
          <Route
            path="/viewer"
            element={
              <RequireAuth>
                <RequireOperator>
                  <Viewer />
                </RequireOperator>
              </RequireAuth>
            }
          />

          {/* Authenticated cockpit — persistent sidebar shell wraps the tabs. */}
          <Route
            path="/app"
            element={
              <RequireAuth>
                <ActiveDealProvider>
                  <AppShell />
                </ActiveDealProvider>
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
              path="demo"
              element={
                <RequireOperator>
                  <DemoGallery />
                </RequireOperator>
              }
            />
            <Route
              path="demo/:narrativeId"
              element={
                <RequireOperator>
                  <DemoTour />
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
            <Route
              path="market"
              element={
                <RequireOperator>
                  <MarketSpec />
                </RequireOperator>
              }
            />
            {/* Deal intake — PROTOTYPE: capital-provider intake answers compiled live
              into the Market result card (per-deal instrument; persistence TBD). */}
            <Route
              path="deal"
              element={
                <RequireOperator>
                  <DealIntake />
                </RequireOperator>
              }
            />
            {/* Phrase review — canonicalization quality audit (350 canonical phrases →
              their GPT-5.4 variants). */}
            <Route
              path="jtbd"
              element={
                <RequireOperator>
                  <JtbdReview />
                </RequireOperator>
              }
            />
            {/* Capability profile — opened by UEI. Server-of-record card: identity + designations
              + sub/prime activity + evidence-tiered recommended NAICS+PSC lanes (catalyst). */}
            <Route
              path="capability/:uei"
              element={
                <RequireOperator>
                  <CapabilityDetail />
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
            {/* Mandate editor — opened from an Application by the deal's 8-char handle. Shows the
              attached template + signatory and originates a prefilled Documenso doc (the /p/m link). */}
            <Route
              path="m/:handle"
              element={
                <RequireOperator>
                  <Mandate />
                </RequireOperator>
              }
            />
            {/* Firmographic-brief VARIANT of the mandate surface — a template example; the
              original commercial-terms Mandate above keeps /app/m/:handle. */}
            <Route
              path="m/:handle/brief"
              element={
                <RequireOperator>
                  <MandateBrief />
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
              path="settings/new-deal"
              element={
                <RequireOperator>
                  <SettingsNewDeal />
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
              path="settings/documenso-template-mirror"
              element={
                <RequireOperator>
                  <DocumensoTemplateMirror />
                </RequireOperator>
              }
            />
            <Route
              path="settings/manage-documenso-templates"
              element={
                <RequireOperator>
                  <ManageDocumensoTemplates />
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
            <Route path="account" element={<Account />} />
            <Route path="preferences" element={<Preferences />} />
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
