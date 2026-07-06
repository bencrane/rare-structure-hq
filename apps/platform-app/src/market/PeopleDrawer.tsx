/**
 * PeopleDrawer — the right-side people preview for one entity row.
 *
 * Fetches people/query narrowed to the clicked entity's uei (`ueis` pin on the
 * shared filter shape + a client-side uei filter as belt-and-braces) and lists
 * each SAM person: name, title, enrichment_state badge, phone/email presence.
 * Overlay pattern mirrors AppShell's mobile drawer (backdrop button + aside).
 */
import { Mail, Phone, Users, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge, type BadgeTone, Stack, Text } from "@rare-structure-hq/ui";

import { EmptyState } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import { type AudienceFilters, type PersonRow, queryPeople } from "./api";
import { secondaryBtnCls } from "./ui";

const STATE_TONE: Record<string, BadgeTone> = {
  dialable: "success",
  emailable: "info",
  bridged_no_contacts: "warn",
  unbridged: "default",
};

function personName(p: PersonRow): string {
  const n = p.display_name ?? [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ?? "";
  return n || p.sam_person_id;
}

export function PeopleDrawer({
  uei,
  entityName,
  filters,
  onClose,
}: {
  uei: string;
  entityName: string;
  /** The applied audience filters — person-grain gates carry into the drawer. */
  filters: AudienceFilters;
  onClose: () => void;
}) {
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const [people, setPeople] = useState<PersonRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setPeople(null);
    setError(null);
    queryPeople(token, { ...filters, ueis: [uei] }, 200)
      .then((page) => {
        if (cancelled) return;
        // Belt-and-braces: keep only the pinned entity's rows.
        setPeople(page.rows.filter((p) => p.uei === uei));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load people");
      });
    return () => {
      cancelled = true;
    };
  }, [token, uei, filters]);

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close people panel"
        onClick={onClose}
        className="absolute inset-0 bg-[color:var(--color-surface-overlay)]"
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-[color:var(--color-border-subtle)] border-l bg-[color:var(--color-surface-sunken)]">
        <div className="flex items-start justify-between gap-4 border-[color:var(--color-border-subtle)] border-b px-5 py-4">
          <Stack gap="1">
            <Text size="body-sm" color="primary" className="truncate">
              {entityName}
            </Text>
            <Text size="mono-xs" mono color="subtle">
              {uei} · SAM people
            </Text>
          </Stack>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="shrink-0 text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-default)]"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error ? (
            <Stack gap="3" align="center" px="5" py="16" unsafe_className="text-center">
              <Text size="body-sm" color="default">
                Couldn’t load people
              </Text>
              <Text size="mono-xs" mono color="subtle" className="max-w-xs break-words">
                {error}
              </Text>
              <button type="button" onClick={onClose} className={secondaryBtnCls}>
                Close
              </button>
            </Stack>
          ) : people === null ? (
            <div className="px-5 py-16 text-center font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase">
              Loading…
            </div>
          ) : people.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No people"
              description="No SAM people match the applied person-grain filters for this entity."
            />
          ) : (
            <ul className="divide-y divide-[color:var(--color-border-subtle)]">
              {people.map((p) => (
                <li
                  key={p.sam_person_id}
                  className="flex items-start justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <Text size="body-sm" color="primary" className="block truncate">
                      {personName(p)}
                    </Text>
                    <Text size="mono-xs" mono color="subtle" className="block truncate">
                      {p.title ?? "—"}
                    </Text>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Phone
                      aria-label={p.phone ? "Has phone" : "No phone"}
                      className={`size-3.5 ${
                        p.phone
                          ? "text-[color:var(--color-state-success)]"
                          : "text-[color:var(--color-text-subtle)] opacity-40"
                      }`}
                    />
                    <Mail
                      aria-label={p.email ? "Has email" : "No email"}
                      className={`size-3.5 ${
                        p.email
                          ? "text-[color:var(--color-state-info)]"
                          : "text-[color:var(--color-text-subtle)] opacity-40"
                      }`}
                    />
                    {p.enrichment_state ? (
                      <Badge tone={STATE_TONE[p.enrichment_state] ?? "default"}>
                        {p.enrichment_state.replace(/_/g, " ")}
                      </Badge>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {people !== null && !error ? (
          <div className="border-[color:var(--color-border-subtle)] border-t px-5 py-3">
            <Text size="mono-xs" mono color="subtle">
              {people.length} {people.length === 1 ? "person" : "people"}
            </Text>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
