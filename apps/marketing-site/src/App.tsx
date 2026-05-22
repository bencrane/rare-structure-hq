import { Route, Routes } from "react-router-dom";
import { SiteHeader } from "./components/SiteHeader";
import Briefing from "./routes/Briefing";
import Home from "./routes/Home";
import Proposal from "./routes/Proposal";
import SbaInsights from "./routes/SbaInsights";

export function App() {
  return (
    <Routes>
      <Route path="/proposal" element={<Proposal />} />
      <Route
        path="*"
        element={
          <>
            <SiteHeader />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/briefing" element={<Briefing />} />
              <Route path="/briefings/sba-pipeline" element={<SbaInsights />} />
            </Routes>
          </>
        }
      />
    </Routes>
  );
}
