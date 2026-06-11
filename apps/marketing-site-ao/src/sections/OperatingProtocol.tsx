import { SectionShell } from "../components/SectionShell";
import { networkArchitecture } from "../data/site";

export function OperatingProtocol() {
  return (
    <SectionShell
      id="operating-protocol"
      index="II. Operating Protocol"
      heading="Network Architecture"
    >
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-14">
        {networkArchitecture.map((pillar) => (
          <div key={pillar.num}>
            <div className="h-px w-full bg-[color:var(--color-border-default)]" />
            <p className="mt-6 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-[color:var(--color-text-default)]">
              {pillar.num}. {pillar.title}
            </p>
            <p className="mt-5 text-[0.9375rem] leading-[1.65] text-[color:var(--color-text-muted)]">
              {pillar.body}
            </p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
