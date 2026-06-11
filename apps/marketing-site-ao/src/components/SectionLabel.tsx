interface SectionLabelProps {
  /** Bracketed mono index, e.g. "II. Operating Protocol". */
  index: string;
}

/** Bracketed mono section label + hairline rule. Shared by SectionShell and DeploymentProtocol. */
export function SectionLabel({ index }: SectionLabelProps) {
  return (
    <>
      <p className="font-mono text-[0.625rem] uppercase tracking-[0.28em] text-[color:var(--color-text-subtle)]">
        [ {index} ]
      </p>
      <div className="mt-4 h-px w-full bg-[color:var(--color-border-subtle)]" />
    </>
  );
}
