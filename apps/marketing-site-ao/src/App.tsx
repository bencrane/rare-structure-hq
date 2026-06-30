import { CoverageVectors } from "./sections/CoverageVectors";
import { DeploymentProtocol } from "./sections/DeploymentProtocol";
import { Hero } from "./sections/Hero";
import { OperatingProtocol } from "./sections/OperatingProtocol";
import { OperationalPrecedent } from "./sections/OperationalPrecedent";
// PublicUtility ("Your Federal Standing" / GovernmentContracted.com) hidden 2026-06-29.
// Component + data retained in src/sections/PublicUtility.tsx; uncomment this import
// and the <PublicUtility /> usage below to restore the section.
// import { PublicUtility } from "./sections/PublicUtility";
import { SiteFooter } from "./sections/SiteFooter";
import { SiteHeader } from "./sections/SiteHeader";

export function App() {
  return (
    <div className="ao-grid min-h-screen sm:p-6 lg:p-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[1560px] flex-col border-[color:var(--color-border-default)] bg-[color:var(--color-surface-base)] sm:border">
        <SiteHeader />
        <main>
          <Hero />
          <OperatingProtocol />
          <OperationalPrecedent />
          <CoverageVectors />
          {/* <PublicUtility /> hidden 2026-06-29 — see import note above to restore. */}
          <DeploymentProtocol />
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
