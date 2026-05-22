import { BriefingDeepDive } from "@/components/BriefingDeepDive";
import { BriefingMap } from "@/components/BriefingMap";
import { BriefingTakeaway } from "@/components/BriefingTakeaway";
import { NarrativeSection } from "@/components/NarrativeSection";
import type { BriefingPhase } from "@/data/briefing-data";
import { NARRATIVE_SECTIONS } from "@/data/briefing-data";
import { useMotionValueEvent, useScroll } from "framer-motion";
import { useRef, useState } from "react";

const PHASE_ORDER: BriefingPhase[] = [
  "national",
  "state-focus",
  "sector-drill",
  "cross-ref",
  "cta",
];

function phaseFromProgress(p: number): BriefingPhase {
  const idx = Math.min(Math.floor(p * PHASE_ORDER.length), PHASE_ORDER.length - 1);
  return PHASE_ORDER[idx];
}

export default function Briefing() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<BriefingPhase>("national");

  const { scrollYProgress } = useScroll({ container: containerRef });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setPhase(phaseFromProgress(v));
  });

  return (
    <div
      ref={containerRef}
      className="h-screen overflow-y-auto bg-[color:var(--color-surface-base)]"
    >
      {/* Sticky map — stays pinned while narrative scrolls over it. */}
      <div className="sticky top-0 z-0 h-screen">
        <BriefingMap phase={phase} />
      </div>

      {/* Narrative sections — overlaid on the sticky map. */}
      <div className="relative z-10 -mt-[100vh]">
        {/* Title card — frames what the visitor is about to see. */}
        <section className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <div className="max-w-[600px]">
            <div className="mb-6 font-mono text-[0.625rem] uppercase tracking-[0.2em] text-[color:var(--color-text-accent)]">
              Market Intelligence
            </div>
            <h1 className="font-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.02em] text-[color:var(--color-text-primary)] sm:text-[2.75rem]">
              Sovereign Capital Meets
              <br />
              Commercial Leverage
            </h1>
            <p className="mx-auto mt-6 max-w-[460px] text-[0.9375rem] leading-[1.6] text-[color:var(--color-text-muted)]">
              A structural view of where federal contract revenue intersects with active commercial
              debt — and why that intersection is the highest-conviction origination signal in
              mid-market lending.
            </p>
            <div className="mt-10 font-mono text-[0.625rem] uppercase tracking-[0.22em] text-[color:var(--color-text-subtle)]">
              Scroll to begin ↓
            </div>
          </div>
        </section>

        {NARRATIVE_SECTIONS.map((section) => (
          <NarrativeSection key={section.id} section={section} />
        ))}
      </div>

      {/* Post-narrative: these break free of the sticky map. */}
      <div className="relative z-10">
        <BriefingDeepDive />
        <BriefingTakeaway />
      </div>

      {/* Footer */}
      <div className="relative z-10 border-t border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-base)] py-8 text-center">
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-[color:var(--color-text-subtle)]">
          ©2026 Rare Structure LLC All Rights Reserved
        </span>
      </div>
    </div>
  );
}
