/**
 * App — the platform-app router shell.
 *
 * Routes:
 *   `/`                          → redirects to `/map`.
 *   `/map`                       → unauthenticated catalyst map demo.
 *   `/proposal/:ref`             → public engagement proposal (unauth, by ref).
 *   `/opportunities`             → SAM.gov active opportunities list (auth).
 *   `/opportunities/:notice_id`  → single opportunity detail (auth).
 *
 * The /opportunities surface is gated by <RequireAuth>; the map and
 * /proposal/:ref routes remain anonymous (the proposal's unguessable ref is
 * its own capability credential). The apex `/` redirects to `/map`. All
 * branches live under one <AuthProvider> at the App root so that signing in
 * on the /opportunities page also reflects on any other authenticated surface
 * without a remount.
 */

import { Navigate, Route, Routes } from "react-router-dom";

import MapDemo from "./routes/MapDemo";
import Proposal from "./routes/proposal/Proposal";
import { AuthProvider, useAuth } from "./lib/auth";
import { SignIn } from "./opportunities/SignIn";
import OppsList from "./opportunities/OppsList";
import OppDetail from "./opportunities/OppDetail";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) return <SignIn />;
  return <>{children}</>;
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/map" replace />} />
        <Route path="/map" element={<MapDemo />} />
        <Route path="/proposal/:ref" element={<Proposal />} />
        <Route
          path="/opportunities"
          element={
            <RequireAuth>
              <OppsList />
            </RequireAuth>
          }
        />
        <Route
          path="/opportunities/:notice_id"
          element={
            <RequireAuth>
              <OppDetail />
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
