/**
 * App — the platform-app router shell.
 *
 * Routes:
 *   `/`                          → redirects to `/map`.
 *   `/map`                       → unauthenticated catalyst map demo.
 *   `/proposal/:ref`             → public engagement proposal (unauth, by ref).
 *   `/proposal`                  → "reference required" prompt (no deal shown).
 *
 * Every route is anonymous: the map is a public demo and the proposal's
 * unguessable ref is its own capability credential. <AuthProvider> stays
 * mounted at the root so the Supabase session layer is live and ready for a
 * future authenticated surface, but no current route gates on it.
 */

import { Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./lib/auth";
import MapDemo from "./routes/MapDemo";
import Proposal from "./routes/proposal/Proposal";

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/map" replace />} />
        <Route path="/map" element={<MapDemo />} />
        <Route path="/proposal" element={<Proposal />} />
        <Route path="/proposal/:ref" element={<Proposal />} />
      </Routes>
    </AuthProvider>
  );
}
