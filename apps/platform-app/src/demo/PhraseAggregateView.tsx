/**
 * PhraseAggregateView — the chart surface for a free-typed AGGREGATE phrase
 * (the `total …` grammar). Owns the 3-state load against the verbatim phrase
 * broker and hands the resolved bars to `AggregateView` — the same renderer
 * the canned charts and the narrative tour use. A refusal surfaces verbatim
 * (the compiler names the unbound token — the vocabulary-teaching loop).
 */

import { useEffect, useState } from "react";
import { AggregateView } from "./AggregateView";
import { fetchAggregatePhrase, toResolvedAggregate } from "./aggregatePhrase";
import type { ResolvedAggregate } from "./types";

export function PhraseAggregateView({
  phrase,
  onInvokeCommand,
}: {
  phrase: string;
  onInvokeCommand: () => void;
}) {
  const [resolved, setResolved] = useState<ResolvedAggregate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResolved(null);
    setError(null);
    fetchAggregatePhrase(phrase)
      .then((res) => {
        if (!cancelled) setResolved(toResolvedAggregate(res));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "phrase failed");
      });
    return () => {
      cancelled = true;
    };
  }, [phrase]);

  if (resolved) {
    return <AggregateView resolved={resolved} onInvokeCommand={onInvokeCommand} />;
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[color:var(--color-surface-base)] px-6">
      {error ? (
        <div className="max-w-[620px] border border-[color:var(--color-status-danger,var(--color-border-strong))] bg-[color:var(--color-surface-raised)] px-3 py-1.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs">
          {error}
        </div>
      ) : (
        <span className="font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
          compiling · {phrase}
        </span>
      )}
    </div>
  );
}
