import { Route, Routes } from "react-router-dom";
import { SiteHeader } from "./components/SiteHeader";
import Home from "./routes/Home";
import Briefing from "./routes/Briefing";
import SbaInsights from "./routes/SbaInsights";
import Proposal from "./routes/Proposal";

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
