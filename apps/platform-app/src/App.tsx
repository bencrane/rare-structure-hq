/**
 * App — the platform-app router shell.
 *
 * Routes:
 *   `/`                          → redirects to `/map`.
 *   `/map`                       → unauthenticated catalyst map demo.
 *   `/opportunities`             → SAM.gov active opportunities list (auth).
 *   `/opportunities/:notice_id`  → single opportunity detail (auth).
 *
 * The /opportunities surface is gated by <RequireAuth>; the map route
 * remains anonymous so the demo link still works. The apex `/` redirects
 * to `/map` so the bare-domain link keeps landing on the demo. Both
 * branches live under one <AuthProvider> at the App root so that signing
 * in on the /opportunities page also reflects on any other future
 * authenticated surface without a remount.
 */

import { Navigate, Route, Routes } from "react-router-dom";

import MapDemo from "./routes/MapDemo";
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
