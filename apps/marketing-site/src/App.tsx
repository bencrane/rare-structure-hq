import { Route, Routes } from "react-router-dom";
import { SiteHeader } from "./components/SiteHeader";
import Home from "./routes/Home";
import Briefing from "./routes/Briefing";

export function App() {
  return (
    <>
      <SiteHeader />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/briefing" element={<Briefing />} />
      </Routes>
    </>
  );
}
