import { SectionShell } from "../components/SectionShell";
import { coverageVectors } from "../data/site";

const headerCell =
  "px-5 py-4 text-[0.6875rem] font-normal uppercase tracking-[0.12em] text-[color:var(--color-text-subtle)]";

export function CoverageVectors() {
  return (
    <SectionShell
      id="coverage-vectors"
      index="III. Coverage Vectors"
      heading="Active Coverage Vectors"
    >
      <div className="overflow-x-auto border border-[color:var(--color-border-default)]">
        <table className="w-full min-w-[40rem] border-collapse text-left font-mono">
          <thead>
            <tr className="border-b border-[color:var(--color-border-strong)]">
              <th className={headerCell}>Vector</th>
              <th className={headerCell}>Target Baseline / Inflection Point</th>
              <th className={headerCell}>Structural Resolution</th>
            </tr>
          </thead>
          <tbody>
            {coverageVectors.map((row) => (
              <tr
                key={row.vector}
                className="border-b border-[color:var(--color-border-subtle)] align-top last:border-b-0"
              >
                <td className="px-5 py-5 text-[0.8125rem] tracking-[0.02em] text-[color:var(--color-text-accent)]">
                  {row.vector}
                </td>
                <td className="px-5 py-5 text-[0.8125rem] leading-[1.5] text-[color:var(--color-text-default)]">
                  {row.baseline}
                </td>
                <td className="px-5 py-5 text-[0.8125rem] leading-[1.5] text-[color:var(--color-text-muted)]">
                  {row.resolution}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionShell>
  );
}
