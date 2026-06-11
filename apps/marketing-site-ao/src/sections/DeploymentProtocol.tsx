import { type FormEvent, useState } from "react";
import { SectionLabel } from "../components/SectionLabel";
import { StatusDot } from "../components/StatusDot";
import { ArrowIcon } from "../components/icons";
import { vectorOptions } from "../data/site";

const fieldLabel =
  "font-mono text-[0.625rem] uppercase tracking-[0.16em] text-[color:var(--color-text-subtle)]";
const fieldControl =
  "mt-2 w-full border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)] px-3 py-2.5 text-[0.875rem] text-[color:var(--color-text-default)] transition-colors placeholder:text-[color:var(--color-text-subtle)] focus:border-[color:var(--color-border-strong)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-text-accent)]";

export function DeploymentProtocol() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <section
      id="deployment-protocol"
      aria-labelledby="deployment-protocol-heading"
      className="scroll-mt-6 border-t border-[color:var(--color-border-subtle)] px-6 py-16 sm:px-12 sm:py-24"
    >
      <SectionLabel index="IV. Deployment Protocol" />

      <div className="mt-10 grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2
            id="deployment-protocol-heading"
            className="font-display text-[2rem] font-semibold uppercase leading-[1.05] tracking-[-0.01em] text-[color:var(--color-text-primary)] sm:text-[2.5rem]"
          >
            Network Allocation
          </h2>
          <p className="mt-6 max-w-[32rem] text-[0.9375rem] leading-[1.65] text-[color:var(--color-text-muted)]">
            Our syndicate deploys capital and infrastructure only when precise operational
            parameters are met. To request routing for an immediate hazard or liquidity cliff,
            submit your entity details for clearance review.
          </p>
          <p className="mt-10 flex max-w-[32rem] items-start gap-2 font-mono text-[0.625rem] uppercase leading-[1.7] tracking-[0.14em] text-[color:var(--color-state-error)]">
            <StatusDot tone="error" className="mt-[0.35em]" />
            <span>
              Warning: Unauthorized or non-critical submissions will be permanently blackholed.
            </span>
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised-translucent)] p-6 sm:p-8"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="ao-entity" className={fieldLabel}>
                Corporate Entity
              </label>
              <input id="ao-entity" name="entity" type="text" className={fieldControl} />
            </div>
            <div>
              <label htmlFor="ao-vector" className={fieldLabel}>
                Vector Classification
              </label>
              <select id="ao-vector" name="vector" defaultValue="" className={fieldControl}>
                <option value="" disabled>
                  Select Vector...
                </option>
                {vectorOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5">
            <label htmlFor="ao-sitrep" className={fieldLabel}>
              Baseline Constraint (SITREP)
            </label>
            <textarea
              id="ao-sitrep"
              name="sitrep"
              rows={4}
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
              Request Clearance
              <ArrowIcon />
            </button>
          )}
        </form>
      </div>
    </section>
  );
}
