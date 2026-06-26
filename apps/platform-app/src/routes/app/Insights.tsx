/**
 * Insights — the operator's live call cockpit.
 *
 * Polls the BFF (/api/v1/insights/active-call) ~every 1.5s; edge_api derives the current Close
 * call offline from the raw webhook events. When the Power Dialer connects to a number, the
 * briefing here flips to that company (its site + identity) — the complement to Close's own
 * contact panel on the other screen. Not operator-scoped (one operator). The poll runs only while
 * this tab is mounted, so it's silent during demos (you're on Map/Pipeline, never here).
 */
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/lib/auth";

import { type ActiveCall, getActiveCall } from "@/insights/api";

const POLL_MS = 1500;

function statusTone(status: string | null): string {
  const s = (status ?? "").toLowerCase();
  if (s.includes("answer") || s.includes("progress") || s.includes("connect"))
    return "bg-emerald-500";
  if (s.includes("complete") || s.includes("end")) return "bg-zinc-400";
  return "bg-amber-500"; // dialing / ringing
}

export default function Insights() {
  const { session } = useAuth();
  const token = session?.access_token ?? "";
  const [call, setCall] = useState<ActiveCall | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token) return;
    const tick = async () => {
      try {
        setCall(await getActiveCall(token));
        setErr(null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "poll failed");
      }
    };
    void tick(); // probe immediately, then on the interval
    timer.current = setInterval(() => void tick(), POLL_MS);
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [token]);

  const live = !!call?.active && !!call.normalizedDomain;
  const domain = call?.normalizedDomain ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <span
            className={`h-2.5 w-2.5 rounded-full ${live ? `${statusTone(call?.status ?? null)} animate-pulse` : "bg-zinc-300"}`}
          />
          <span className="font-mono text-xs uppercase tracking-wider text-zinc-500">
            {live ? "On call" : "Idle"}
          </span>
        </div>
        {err && <span className="font-mono text-xs text-red-500">sync error</span>}
      </div>

      {!live ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-medium text-zinc-700">No active call</p>
            <p className="mt-1 text-sm text-zinc-400">
              The briefing appears here the moment you dial a prospect.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-baseline justify-between gap-4 px-6 py-4">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900">
                {call?.companyName ?? domain}
              </h1>
              <a
                href={`https://${domain}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-sm text-sky-700 hover:underline"
              >
                {domain} ↗
              </a>
            </div>
            <div className="text-right font-mono text-sm text-zinc-600">
              {call?.remotePhone && <div>{call.remotePhone}</div>}
              {call?.status && (
                <div className="uppercase tracking-wide text-zinc-400">{call.status}</div>
              )}
            </div>
          </div>

          <div className="relative flex-1 border-t border-zinc-200 bg-zinc-50">
            <iframe
              key={domain}
              src={`https://${domain}`}
              title={call?.companyName ?? domain ?? "site"}
              className="h-full w-full"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
            <div className="pointer-events-none absolute right-3 top-3 rounded bg-white/90 px-2 py-1 font-mono text-xs text-zinc-400 shadow">
              some sites block embedding — use the ↗ link
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
