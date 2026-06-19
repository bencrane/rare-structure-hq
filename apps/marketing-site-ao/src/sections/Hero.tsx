import { type FormEvent, useState } from "react";
import { Eyebrow } from "../components/Eyebrow";
import { StatusDot } from "../components/StatusDot";
import { ArrowIcon, MailIcon } from "../components/icons";
import { LiveFeed } from "./LiveFeed";

export function Hero() {
  const [entity, setEntity] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (entity.trim()) setSubmitted(true);
  }

  return (
    <section className="grid gap-12 px-6 py-16 sm:px-12 sm:py-20 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
      <div className="flex min-w-0 flex-col">
        <Eyebrow label="Institutional Standard" tone="accent" />
        <h1 className="mt-8 font-display text-[2.25rem] font-semibold uppercase leading-[0.96] tracking-[-0.02em] text-[color:var(--color-text-primary)] sm:text-[3.25rem] xl:text-[4rem]">
          Precision Remediation. Immediate Deployment.
        </h1>
        <p className="mt-8 max-w-[34rem] text-[1.0625rem] leading-[1.6] text-[color:var(--color-text-muted)]">
          We deploy our collective expertise exclusively during critical moments of operational
          inflection, regulatory transition, or capital constraint.
        </p>

        {submitted ? (
          <output className="mt-10 flex max-w-[34rem] items-center gap-3 border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-4 py-3.5 font-mono text-[0.75rem] uppercase tracking-[0.12em] text-[color:var(--color-text-accent)]">
            <StatusDot tone="success" />
            Access request received — credentials under review.
          </output>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-10 flex max-w-[34rem] items-stretch border border-[color:var(--color-border-default)]"
          >
            <label htmlFor="ao-access" className="sr-only">
              Work Email
            </label>
            <div className="flex min-w-0 flex-1 items-center gap-3 px-4 text-[color:var(--color-text-subtle)] focus-within:ring-1 focus-within:ring-[color:var(--color-text-accent)]">
              <MailIcon />
              <input
                id="ao-access"
                name="access"
                type="email"
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
                className="w-full min-w-0 bg-transparent py-3.5 font-mono text-[0.8125rem] tracking-[0.02em] text-[color:var(--color-text-default)] placeholder:text-[color:var(--color-text-subtle)] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="flex items-center gap-2 bg-[color:var(--color-text-default)] px-5 font-mono text-[0.75rem] uppercase tracking-[0.14em] text-[color:var(--color-surface-base)] transition-colors hover:bg-[color:var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-text-accent)]"
            >
              Request Briefing
              <ArrowIcon />
            </button>
          </form>
        )}
      </div>

      <LiveFeed />
    </section>
  );
}
