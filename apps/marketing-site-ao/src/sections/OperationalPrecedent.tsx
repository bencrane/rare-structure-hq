import { SectionShell } from "../components/SectionShell";
import { precedents } from "../data/site";

export function OperationalPrecedent() {
  return (
    <SectionShell
      id="operational-precedent"
      index="Strategic Outcomes"
      heading="Operational Precedent"
    >
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {precedents.map((item) => (
          <article
            key={item.code}
            className="flex flex-col border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised-translucent)] p-6 sm:p-7"
          >
            <div className="flex items-center justify-between gap-4">
              <span className="border border-[color:var(--color-border-strong)] px-2 py-1 font-mono text-[0.625rem] uppercase tracking-[0.1em] text-[color:var(--color-text-default)]">
                {item.code}
              </span>
              <span className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-[color:var(--color-text-subtle)]">
                {item.duration}
              </span>
            </div>
            <h3 className="mt-6 text-[1.1875rem] font-semibold leading-[1.25] text-[color:var(--color-text-strong)]">
              {item.title}
            </h3>
            <p className="mt-4 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
              {item.district}
            </p>
            <p className="mt-5 text-[0.9375rem] leading-[1.6] text-[color:var(--color-text-muted)]">
              {item.body}
            </p>
          </article>
        ))}
      </div>
    </SectionShell>
  );
}
