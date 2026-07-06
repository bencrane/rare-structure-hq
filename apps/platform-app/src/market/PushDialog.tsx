/**
 * PushDialog — the Market tab's push-to-Close flow, as a centered overlay panel.
 *
 * Lifecycle: mount → dry-run (synchronous preview: nLeads / nContacts /
 * nAlreadyLedgered; re-runs when the contact strategy changes) → Confirm →
 * live push returns a runId → poll GET /runs/:id every 2s (the Insights
 * active-call polling idiom) → progress line → terminal success/error Badge.
 * All state is local; the parent only opens/closes the dialog.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Badge, Inline, Stack, Text } from "@rare-structure-hq/ui";

import { Panel } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import {
  type AudienceFilters,
  type ContactStrategy,
  type PushDryRun,
  type PushRun,
  getRun,
  pushAudience,
} from "./api";
import { fmtNum, inputCls, primaryBtnCls, secondaryBtnCls, selectCls } from "./ui";

const POLL_MS = 2000;

const STRATEGIES: { value: ContactStrategy; label: string }[] = [
  { value: "dialable_plus_best", label: "Dialable + best contact" },
  { value: "dialable_only", label: "Dialable only" },
  { value: "all", label: "All contacts" },
];

/** market_YYYYMMDD — the default cohort name for today's push. */
export function defaultCohortName(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `market_${y}${m}${d}`;
}

type Phase = "preview" | "pushing" | "done" | "error";

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-raised)] px-4 py-3">
      <Text size="mono-xs" mono color="muted">
        {label}
      </Text>
      <Text size="display-sm" face="display" color="strong" className="mt-1 tabular-nums">
        {value}
      </Text>
    </div>
  );
}

export function PushDialog({
  filters,
  onClose,
}: {
  /** The APPLIED audience filters — the cohort the push targets. */
  filters: AudienceFilters;
  onClose: () => void;
}) {
  const { session } = useAuth();
  const token = session?.access_token ?? "";
  const id = useId();

  const [phase, setPhase] = useState<Phase>("preview");
  const [strategy, setStrategy] = useState<ContactStrategy>("dialable_plus_best");
  const [cohortName, setCohortName] = useState(defaultCohortName());
  const [preview, setPreview] = useState<PushDryRun | null>(null);
  const [run, setRun] = useState<PushRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  // Dry-run preview — refreshed when the contact strategy changes.
  useEffect(() => {
    if (!token || phase !== "preview") return;
    let cancelled = false;
    setPreview(null);
    setError(null);
    pushAudience(token, { filters, contactStrategy: strategy, cohortName: "", dryRun: true })
      .then((res) => {
        if (cancelled) return;
        if ("runId" in res) throw new Error("dry-run returned a runId");
        setPreview(res);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Dry run failed");
      });
    return () => {
      cancelled = true;
    };
  }, [token, filters, strategy, phase]);

  useEffect(() => stopPolling, [stopPolling]);

  const confirm = async () => {
    if (!token) return;
    setPhase("pushing");
    setError(null);
    try {
      const res = await pushAudience(token, {
        filters,
        contactStrategy: strategy,
        cohortName: cohortName.trim() || defaultCohortName(),
        dryRun: false,
      });
      if (!("runId" in res)) throw new Error("live push returned no runId");
      const { runId } = res;
      const tick = async () => {
        try {
          const r = await getRun(token, runId);
          setRun(r);
          if (r.status !== "running") {
            stopPolling();
            setPhase(r.status === "done" ? "done" : "error");
            if (r.status === "error") setError(r.error ?? "Push run failed");
          }
        } catch (e) {
          stopPolling();
          setPhase("error");
          setError(e instanceof Error ? e.message : "Run poll failed");
        }
      };
      void tick();
      timer.current = setInterval(() => void tick(), POLL_MS);
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : "Push failed");
    }
  };

  const busy = phase === "pushing";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        aria-label="Close push dialog"
        onClick={busy ? undefined : onClose}
        className="absolute inset-0 bg-[color:var(--color-surface-overlay)]"
      />
      <div className="relative w-full max-w-lg px-6">
        <Panel tone="raised">
          <Stack gap="5">
            <Stack gap="1">
              <Text size="body-md" color="strong">
                Push to Close
              </Text>
              <Text size="mono-xs" mono color="subtle">
                {phase === "preview"
                  ? "Dry run — nothing is written until you confirm"
                  : phase === "pushing"
                    ? "Live push in progress"
                    : phase === "done"
                      ? "Push complete"
                      : "Push failed"}
              </Text>
            </Stack>

            {phase === "preview" ? (
              <>
                {error ? (
                  <Text size="mono-xs" mono color="subtle" className="break-words">
                    {error}
                  </Text>
                ) : preview === null ? (
                  <div className="py-6 text-center font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase">
                    Running dry run…
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <PreviewStat label="Leads" value={fmtNum(preview.nLeads)} />
                    <PreviewStat label="Contacts" value={fmtNum(preview.nContacts)} />
                    <PreviewStat label="Ledgered" value={fmtNum(preview.nAlreadyLedgered)} />
                  </div>
                )}

                <Stack gap="2">
                  <label
                    htmlFor={`${id}-strategy`}
                    className="block font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]"
                  >
                    Contact strategy
                  </label>
                  <select
                    id={`${id}-strategy`}
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value as ContactStrategy)}
                    className={selectCls}
                  >
                    {STRATEGIES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Stack>

                <Stack gap="2">
                  <label
                    htmlFor={`${id}-cohort`}
                    className="block font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]"
                  >
                    Cohort name
                  </label>
                  <input
                    id={`${id}-cohort`}
                    value={cohortName}
                    onChange={(e) => setCohortName(e.target.value)}
                    className={inputCls}
                  />
                </Stack>

                <Inline gap="2" justify="end">
                  <button type="button" onClick={onClose} className={secondaryBtnCls}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirm()}
                    disabled={preview === null || !!error}
                    className={primaryBtnCls}
                  >
                    Confirm push
                  </button>
                </Inline>
              </>
            ) : (
              <>
                <Inline gap="2" align="center">
                  {phase === "pushing" ? (
                    <Badge tone="info">Running</Badge>
                  ) : phase === "done" ? (
                    <Badge tone="success">Done</Badge>
                  ) : (
                    <Badge tone="error">Error</Badge>
                  )}
                  <Text size="mono-xs" mono color="subtle">
                    {run
                      ? `${fmtNum(run.n_leads_created)} leads · ${fmtNum(run.n_contacts_created)} contacts · ${fmtNum(run.n_skipped_ledgered)} skipped (ledgered)`
                      : "Starting run…"}
                  </Text>
                </Inline>
                {error ? (
                  <Text size="mono-xs" mono color="subtle" className="break-words">
                    {error}
                  </Text>
                ) : null}
                <Inline gap="2" justify="end">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={busy}
                    className={secondaryBtnCls}
                  >
                    {busy ? "Pushing…" : "Close"}
                  </button>
                </Inline>
              </>
            )}
          </Stack>
        </Panel>
      </div>
    </div>
  );
}
