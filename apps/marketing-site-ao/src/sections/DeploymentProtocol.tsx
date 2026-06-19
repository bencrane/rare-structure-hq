import { type FormEvent, useState } from "react";
import { SectionShell, leadText } from "../components/SectionShell";
import { StatusDot } from "../components/StatusDot";
import { ArrowIcon, ChevronDownIcon } from "../components/icons";
import { vectorOptions } from "../data/site";

const fieldLabel =
  "font-mono text-[0.625rem] uppercase tracking-[0.16em] text-[color:var(--color-text-subtle)]";
// Two-up row labels: reserve a uniform two-line height so a wrapping label
// (e.g. "Corporate Entity Website") can't push its input out of alignment with
// the sibling field.
const rowLabel = `${fieldLabel} flex min-h-[2.6em] flex-col justify-end leading-[1.3]`;
const fieldControl =
  "mt-2 w-full border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)] px-3 py-2.5 text-[0.875rem] text-[color:var(--color-text-default)] transition-colors placeholder:text-[color:var(--color-text-subtle)] focus:border-[color:var(--color-border-strong)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-text-accent)]";
const selectControl =
  "w-full cursor-pointer appearance-none border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)] py-2.5 pl-3 pr-10 text-[0.875rem] transition-colors focus:border-[color:var(--color-border-strong)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-text-accent)]";

export function DeploymentProtocol() {
  const [submitted, setSubmitted] = useState(false);
  const [need, setNeed] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <SectionShell
      id="deployment-protocol"
      index="Deployment Protocol"
      heading="Network Allocation"
      layout="split"
      lead="Our syndicate deploys capital and infrastructure only when precise operational parameters are met. To request routing for an immediate hazard or liquidity cliff, submit your entity details for clearance review."
      aside={
        <form
          onSubmit={handleSubmit}
          className="border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised-translucent)] p-6 sm:p-7"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="ao-entity" className={rowLabel}>
                Corporate Entity Name
              </label>
              <input id="ao-entity" name="entity" type="text" className={fieldControl} />
            </div>
            <div>
              <label htmlFor="ao-website" className={rowLabel}>
                Corporate Entity Website
              </label>
              <input
                id="ao-website"
                name="website"
                type="url"
                placeholder="https://"
                className={fieldControl}
              />
            </div>
          </div>

          <div className="mt-5">
            <label htmlFor="ao-need" className={fieldLabel}>
              Primary Need
            </label>
            <div className="relative mt-2">
              <select
                id="ao-need"
                name="need"
                value={need}
                onChange={(e) => setNeed(e.target.value)}
                className={`${selectControl} ${
                  need
                    ? "text-[color:var(--color-text-default)]"
                    : "text-[color:var(--color-text-subtle)]"
                }`}
              >
                <option value="" disabled>
                  Select primary need...
                </option>
                {vectorOptions.map((option) => (
                  <option
                    key={option}
                    value={option}
                    className="text-[color:var(--color-text-default)]"
                  >
                    {option}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-subtle)]" />
            </div>
          </div>

          <div className="mt-5">
            <label htmlFor="ao-sitrep" className={fieldLabel}>
              Baseline Constraint (SITREP)
            </label>
            <textarea
              id="ao-sitrep"
              name="sitrep"
              rows={3}
              placeholder="Describe immediate hazard or liquidity cliff..."
              className={`${fieldControl} resize-none`}
            />
          </div>

          {submitted ? (
            <output className="mt-7 flex items-center gap-2 border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-4 py-3 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-[color:var(--color-text-accent)]">
              <StatusDot tone="success" />
              Clearance requested — entity under review.
            </output>
          ) : (
            <button
              type="submit"
              className="mt-7 flex w-full items-center justify-center gap-2 bg-[color:var(--color-text-default)] py-3.5 font-mono text-[0.75rem] uppercase tracking-[0.16em] text-[color:var(--color-surface-base)] transition-colors hover:bg-[color:var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-text-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface-base)]"
            >
              Request Consultation
              <ArrowIcon />
            </button>
          )}
        </form>
      }
    >
      <p className={leadText}>
        Each submission is assessed against active coverage vectors and current network capacity —
        qualification, not a queue. Where the parameters align, an operator is assigned and
        mobilization begins on the enforcement timeline.
      </p>
    </SectionShell>
  );
}
