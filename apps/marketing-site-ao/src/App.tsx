import { CoverageVectors } from "./sections/CoverageVectors";
import { DeploymentProtocol } from "./sections/DeploymentProtocol";
import { Hero } from "./sections/Hero";
import { OperatingProtocol } from "./sections/OperatingProtocol";
import { OperationalPrecedent } from "./sections/OperationalPrecedent";
import { SiteFooter } from "./sections/SiteFooter";
import { SiteHeader } from "./sections/SiteHeader";

export function App() {
  return (
    <div className="ao-grid min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1560px] flex-col border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-base)] sm:border-x">
        <SiteHeader />
        <main>
          <Hero />
          <OperatingProtocol />
          <OperationalPrecedent />
          <CoverageVectors />
          <DeploymentProtocol />
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
