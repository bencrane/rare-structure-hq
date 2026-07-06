/**
 * EntitiesTable — the Market tab's results surface (entity grain).
 *
 * Renders one server page (limit 50, prime_obl_24mo DESC upstream) with
 * client-side sorting of the returned page (Research.tsx table idiom + the
 * demo ResultsTable's SortHeader). A row click opens the people drawer for
 * that entity; the count strip carries Prev/Next offset paging.
 */
import { ChevronRight, Radar } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge, Text } from "@rare-structure-hq/ui";

import { EmptyState, Panel } from "@/app/cockpit";
import type { EntityPage, EntityRow } from "./api";
import { designations, fmtNum, fmtUsd, secondaryBtnCls, thCls } from "./ui";

type SortKey = "name" | "state" | "band" | "sub" | "prime" | "dialable" | "people";

const str = (v: string | null | undefined) => v ?? "";
const num = (v: number | null | undefined) => v ?? -1;

const COMPARATORS: Record<SortKey, (a: EntityRow, b: EntityRow) => number> = {
  name: (a, b) => str(a.legal_business_name).localeCompare(str(b.legal_business_name)),
  state: (a, b) => str(a.physical_state).localeCompare(str(b.physical_state)),
  band: (a, b) => str(a.employee_size_band).localeCompare(str(b.employee_size_band)),
  sub: (a, b) => num(a.sub_amt_24mo) - num(b.sub_amt_24mo),
  prime: (a, b) => num(a.prime_obl_24mo) - num(b.prime_obl_24mo),
  dialable: (a, b) => num(a.n_dialable) - num(b.n_dialable),
  people: (a, b) => num(a.n_sam_people) - num(b.n_sam_people),
};

function SortHeader({
  label,
  sortKey,
  active,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  active: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const on = active.key === sortKey;
  return (
    <th className={`px-4 py-2.5 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`font-mono font-normal text-mono-xs uppercase tracking-[0.14em] transition-colors ${
          on
            ? "text-[color:var(--color-text-accent)]"
            : "text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-text-default)]"
        }`}
      >
        {label}
        {on ? <span className="ml-1">{active.dir === "asc" ? "↑" : "↓"}</span> : null}
      </button>
    </th>
  );
}

function MoneyCell({ amount, band }: { amount: number | null; band: string | null }) {
  return (
    <td className="px-4 py-3 text-right">
      <Text as="span" size="body-sm" color="default" className="block tabular-nums">
        {fmtUsd(amount)}
      </Text>
      {band ? (
        <Badge tone="default" className="mt-1">
          {band}
        </Badge>
      ) : null}
    </td>
  );
}

const MAX_DESIGNATION_BADGES = 3;

export function EntitiesTable({
  page,
  offset,
  limit,
  selectedUei,
  onSelect,
  onPage,
  paging,
}: {
  page: EntityPage;
  offset: number;
  limit: number;
  selectedUei: string | null;
  onSelect: (row: EntityRow) => void;
  onPage: (nextOffset: number) => void;
  paging: boolean;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "prime",
    dir: "desc",
  });

  const sorted = useMemo(() => {
    const list = [...page.rows];
    const dir = sort.dir === "asc" ? 1 : -1;
    const cmp = COMPARATORS[sort.key];
    list.sort(
      (a, b) =>
        cmp(a, b) * dir || str(a.legal_business_name).localeCompare(str(b.legal_business_name)),
    );
    return list;
  }, [page.rows, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" || key === "state" || key === "band" ? "asc" : "desc" },
    );

  if (page.rows.length === 0) {
    return (
      <Panel padded={false}>
        <EmptyState
          icon={Radar}
          title="No entities match"
          description="Loosen the filters — every gate ANDs into the cohort."
        />
      </Panel>
    );
  }

  const from = offset + 1;
  const to = offset + page.rows.length;

  return (
    <Panel padded={false}>
      <div className="flex items-center justify-between border-[color:var(--color-border-subtle)] border-b px-4 py-2.5">
        <Text size="mono-xs" mono color="subtle">
          {from.toLocaleString("en-US")}–{to.toLocaleString("en-US")} of{" "}
          {page.total.toLocaleString("en-US")} entities
          {page.asOf ? ` · as of ${page.asOf}` : ""}
        </Text>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={paging || offset === 0}
            onClick={() => onPage(Math.max(0, offset - limit))}
            className={secondaryBtnCls}
          >
            Prev
          </button>
          <button
            type="button"
            disabled={paging || to >= page.total}
            onClick={() => onPage(offset + limit)}
            className={secondaryBtnCls}
          >
            Next
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-[color:var(--color-border-subtle)] border-b">
              <SortHeader label="Name" sortKey="name" active={sort} onSort={toggleSort} />
              <th className={thCls}>Domain</th>
              <SortHeader label="State" sortKey="state" active={sort} onSort={toggleSort} />
              <SortHeader label="Band" sortKey="band" active={sort} onSort={toggleSort} />
              <SortHeader
                label="Sub $ 24m"
                sortKey="sub"
                active={sort}
                onSort={toggleSort}
                align="right"
              />
              <SortHeader
                label="Prime $ 24m"
                sortKey="prime"
                active={sort}
                onSort={toggleSort}
                align="right"
              />
              <th className={thCls}>Designations</th>
              <SortHeader
                label="Dialable"
                sortKey="dialable"
                active={sort}
                onSort={toggleSort}
                align="right"
              />
              <SortHeader
                label="People"
                sortKey="people"
                active={sort}
                onSort={toggleSort}
                align="right"
              />
              <th className="w-10" aria-hidden />
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-border-subtle)]">
            {sorted.map((row) => {
              const badges = designations(row);
              const selected = row.uei === selectedUei;
              return (
                <tr
                  key={row.uei}
                  onClick={() => onSelect(row)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(row);
                    }
                  }}
                  tabIndex={0}
                  aria-label={`Open people for ${row.legal_business_name ?? row.uei}`}
                  className={`group cursor-pointer outline-none transition-colors focus-visible:bg-[color:var(--color-surface-raised)] ${
                    selected
                      ? "bg-[color:var(--color-accent-soft)]"
                      : "hover:bg-[color:var(--color-surface-raised)]"
                  }`}
                >
                  <td className="px-4 py-3">
                    <Text
                      size="body-sm"
                      color="primary"
                      className="block max-w-[28ch] truncate"
                      title={row.legal_business_name ?? row.uei}
                    >
                      {row.legal_business_name ?? "—"}
                    </Text>
                    <Text size="mono-xs" mono color="subtle" className="block truncate">
                      {row.uei}
                    </Text>
                  </td>
                  <td className="px-4 py-3">
                    <Text
                      size="mono-xs"
                      mono
                      color="subtle"
                      className="block max-w-[20ch] truncate"
                    >
                      {row.normalized_domain ?? "—"}
                    </Text>
                  </td>
                  <td className="px-4 py-3">
                    <Text size="mono-xs" mono color="muted">
                      {row.physical_state ?? "—"}
                    </Text>
                  </td>
                  <td className="px-4 py-3">
                    <Text size="mono-xs" mono color="muted">
                      {row.employee_size_band ?? "—"}
                    </Text>
                  </td>
                  <MoneyCell amount={row.sub_amt_24mo} band={row.sub_amt_24mo_band} />
                  <MoneyCell amount={row.prime_obl_24mo} band={row.prime_obl_24mo_band} />
                  <td className="px-4 py-3">
                    {badges.length === 0 ? (
                      <Text size="mono-xs" mono color="subtle">
                        —
                      </Text>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {badges.slice(0, MAX_DESIGNATION_BADGES).map((d) => (
                          <Badge key={d} tone="info">
                            {d}
                          </Badge>
                        ))}
                        {badges.length > MAX_DESIGNATION_BADGES ? (
                          <Badge tone="default">+{badges.length - MAX_DESIGNATION_BADGES}</Badge>
                        ) : null}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Text as="span" size="body-sm" color="default" className="tabular-nums">
                      {fmtNum(row.n_dialable)}
                    </Text>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Text as="span" size="body-sm" color="muted" className="tabular-nums">
                      {fmtNum(row.n_sam_people)}
                    </Text>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className="ml-auto size-3.5 text-[color:var(--color-text-subtle)] opacity-0 transition-opacity group-hover:opacity-100" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
