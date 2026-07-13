/**
 * DemoGallery — /app/demo: the narrative gallery. Each card is one audience's
 * assemblage of beats; clicking enters that narrative's tour
 * (/app/demo/:narrativeId) for presenting or prototyping.
 */

import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Text } from "@rare-structure-hq/ui";

import { NARRATIVES } from "@/demo/narratives";

export default function DemoGallery() {
  const navigate = useNavigate();

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-[color:var(--color-surface-base)] px-10">
      <div className="w-full max-w-4xl">
        <div className="mb-8 text-center">
          <Text as="div" size="mono-xs" mono color="accent" className="uppercase tracking-[0.18em]">
            Narratives
          </Text>
          <Text as="div" size="display-lg" color="primary" className="mt-2 font-display font-semibold">
            Every story is an assemblage of queries
          </Text>
          <Text as="div" size="mono-xs" mono color="subtle" className="mt-2 uppercase tracking-[0.12em]">
            pick one to present or prototype
          </Text>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {NARRATIVES.map((n) => {
            const acts = new Set(n.beats.map((b) => b.act)).size;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => navigate(`/app/demo/${n.id}`)}
                className="group border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-sunken)] px-6 py-6 text-left transition-colors hover:border-[color:var(--color-border-accent)] hover:bg-[color:var(--color-accent-soft)]"
              >
                <div className="flex items-center justify-between">
                  <Text as="div" size="mono-xs" mono color="accent" className="uppercase tracking-[0.16em]">
                    {n.audience}
                  </Text>
                  {n.status === "draft" && (
                    <Text as="span" size="mono-xs" mono color="subtle" className="border border-[color:var(--color-border-subtle)] px-1.5 py-0.5 uppercase tracking-[0.1em]">
                      draft
                    </Text>
                  )}
                </div>
                <Text as="div" size="display-md" color="primary" className="mt-2 font-display font-semibold">
                  {n.title}
                </Text>
                <Text as="div" size="body-sm" color="muted" className="mt-2">
                  {n.blurb}
                </Text>
                <span className="mt-4 flex items-center gap-2">
                  <Text as="span" size="mono-xs" mono color="subtle" className="uppercase tracking-[0.12em] tabular-nums">
                    {n.beats.length} beats · {acts} acts
                  </Text>
                  <ArrowRight className="size-3.5 text-[color:var(--color-text-subtle)] transition-transform group-hover:translate-x-1" />
                </span>
              </button>
            );
          })}
        </div>

        <Text as="div" size="mono-xs" mono color="subtle" className="mt-8 text-center uppercase tracking-[0.12em]">
          ⌘P · demo — clone a narrative in src/demo/narratives
        </Text>
      </div>
    </div>
  );
}
