/**
 * DocumentSummaryScaffold — the shared engagement-proposal document body for the direct-to-documenso
 * mandate. Two surfaces render the SAME structure so they read identically:
 *
 *   - operator cockpit  (`MandateDraftShell`, /app/m/:ref)  — Execution box = the operator's signature
 *                                                             pad; action = "Confirm & originate". Drives
 *                                                             the field `values` and can edit them inline.
 *   - prospect entry    (`DocumentSignPage`, /p/m/:envelopeId) — Execution box = "Proceed to Proposal"
 *                                                             (reveals the Documenso embed); no action,
 *                                                             read-only (no `values` ⇒ every field "—").
 *
 * Sections: Prepared for · Strategic Origination Mandate (narrative) · Mandate Parameters ·
 * Commercial Terms · Execution. The field values are passed in: the operator cockpit holds them in
 * state and (when unlocked) renders inline inputs; the prospect surface passes none, so every field
 * shows its read-only placeholder. Persisting the values to the draft / showing them on the prospect
 * side is a later wiring step — today this is the operator's edit prototype.
 */
import type { ReactNode } from "react";

/** The editable mandate fields. Free-text for now (prototype) — typed/structured pricing lands with the
 * draft-data wiring. */
export interface MandateSummaryValues {
  preparedFor: string;
  targetMarket: string;
  keyInflectionPoints: string;
  coreCapabilities: string;
  regionalActivity: string;
  dataInfrastructureFee: string;
  accessAllocationPayment: string;
  termDuration: string;
  billingCadence: string;
  total: string;
}

export const EMPTY_MANDATE_SUMMARY_VALUES: MandateSummaryValues = {
  preparedFor: "",
  targetMarket: "",
  keyInflectionPoints: "",
  coreCapabilities: "",
  regionalActivity: "",
  dataInfrastructureFee: "",
  accessAllocationPayment: "",
  termDuration: "",
  billingCadence: "",
  total: "",
};

export function DocumentSummaryScaffold({
  execution,
  action,
  values = EMPTY_MANDATE_SUMMARY_VALUES,
  editable = false,
  onChange,
}: {
  /** Content of the bordered Execution box — the operator's signature pad, or the prospect's
   * "Proceed to Proposal" CTA. */
  execution: ReactNode;
  /** Optional action area below the Execution box (the operator's "Confirm & originate"). */
  action?: ReactNode;
  /** Field values. Defaults to all-empty (the prospect surface), which renders the "—" placeholders. */
  values?: MandateSummaryValues;
  /** When true (operator cockpit, unlocked) every field renders an inline input. */
  editable?: boolean;
  /** Field edit handler — required for `editable` to do anything. */
  onChange?: (key: keyof MandateSummaryValues, value: string) => void;
}) {
  const set = (key: keyof MandateSummaryValues) => (v: string) => onChange?.(key, v);
  return (
    <div className="px-6 pt-10 pb-14 md:px-10 md:pt-12 md:pb-16">
      {/* Prepared for */}
      <div className="mb-10 border-[color:var(--color-border-subtle)] border-b pb-4">
        <div className="mb-1 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.16em]">
          Prepared for
        </div>
        {editable ? (
          <input
            value={values.preparedFor}
            onChange={(e) => set("preparedFor")(e.target.value)}
            placeholder="—"
            className="w-28 border-[color:var(--color-border-default)] border-b bg-transparent py-0.5 text-[0.9375rem] text-[color:var(--color-text-primary)] outline-none transition-colors placeholder:text-[color:var(--color-text-subtle)] focus:border-[color:var(--color-text-accent)]"
          />
        ) : (
          <div
            className={`text-[0.9375rem] ${values.preparedFor ? "text-[color:var(--color-text-primary)]" : "text-[color:var(--color-text-subtle)]"}`}
          >
            {values.preparedFor || "—"}
          </div>
        )}
      </div>

      {/* Strategic Origination Mandate — the mandate narrative. */}
      <div className="mb-10">
        <SectionHeading>Strategic Origination Mandate</SectionHeading>
        <p className="text-[0.9375rem] text-[color:var(--color-text-muted)] leading-[1.65]">
          Active Operators will allocate localized routing capacity exclusively to Acme Corp. This
          mandate establishes a dedicated information channel for identifying high-probability
          corporate inflection points prior to broader market awareness.
        </p>
      </div>

      {/* Mandate Parameters */}
      <div className="mb-10">
        <SectionHeading>Mandate Parameters</SectionHeading>
        <TermRow
          label="Target Market"
          value={values.targetMarket}
          editable={editable}
          onChange={set("targetMarket")}
        />
        <TermRow
          label="Key Inflection Points"
          value={values.keyInflectionPoints}
          editable={editable}
          onChange={set("keyInflectionPoints")}
        />
        <TermRow
          label="Core Capabilities"
          value={values.coreCapabilities}
          editable={editable}
          onChange={set("coreCapabilities")}
        />
        <TermRow
          label="Regional Activity"
          value={values.regionalActivity}
          editable={editable}
          onChange={set("regionalActivity")}
        />
      </div>

      {/* Commercial Terms */}
      <div className="mb-10">
        <SectionHeading>Commercial Terms</SectionHeading>
        <TermRow
          label="Data Infrastructure Fee"
          value={values.dataInfrastructureFee}
          editable={editable}
          onChange={set("dataInfrastructureFee")}
        />
        <TermRow
          label="Access Allocation Payment"
          value={values.accessAllocationPayment}
          editable={editable}
          onChange={set("accessAllocationPayment")}
        />
        <TermRow
          label="Term Duration"
          value={values.termDuration}
          editable={editable}
          onChange={set("termDuration")}
        />
        <TermRow
          label="Billing Cadence"
          value={values.billingCadence}
          editable={editable}
          onChange={set("billingCadence")}
        />
        <TermRow label="Total" value={values.total} editable={editable} onChange={set("total")} />
      </div>

      {/* Execution — the operator signs here; the prospect proceeds to the Documenso document. */}
      <div>
        <SectionHeading>Execution</SectionHeading>
        <div className="border border-[color:var(--color-border-subtle)] p-6">{execution}</div>
      </div>

      {action}
    </div>
  );
}

// Section heading — the blue accent label (the "Strategic Origination Mandate" style). Shared by every
// section so the document reads as one system.
function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 font-mono text-[0.625rem] text-[color:var(--color-text-accent)] uppercase tracking-[0.2em]">
      {children}
    </div>
  );
}

// One label/value row. Read-only shows the value (or the "—" placeholder); editable swaps the value for
// an inline input that fills the remaining width (values can be short figures or longer phrases).
function TermRow({
  label,
  value,
  editable,
  onChange,
}: {
  label: string;
  value: string;
  editable: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-[color:var(--color-border-subtle)] border-b py-3">
      <span className="shrink-0 font-mono text-[0.6875rem] text-[color:var(--color-text-muted)] uppercase tracking-[0.12em]">
        {label}
      </span>
      {editable ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          className="w-28 border-[color:var(--color-border-default)] border-b bg-transparent py-0.5 text-right text-[0.9375rem] text-[color:var(--color-text-primary)] outline-none transition-colors placeholder:text-[color:var(--color-text-subtle)] focus:border-[color:var(--color-text-accent)]"
        />
      ) : (
        <span
          className={`text-right text-[0.9375rem] tabular-nums ${value ? "text-[color:var(--color-text-primary)]" : "text-[color:var(--color-text-subtle)]"}`}
        >
          {value || "—"}
        </span>
      )}
    </div>
  );
}
