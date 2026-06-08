/**
 * AppShell — the authenticated cockpit chrome.
 *
 * A persistent sidebar (brand · nav · operator chip) wrapping an `<Outlet>` for
 * the tabbed surfaces. Lives under `src/app/` rather than `src/routes/` so it
 * may own geometry; the route files it frames stay geometry-free.
 *
 * House style: sharp edges, mono labels, the institutional slate-blue accent —
 * the same instrument the catalyst terminal wears, not Outbound's green.
 */
import {
  CircleUser,
  ClipboardList,
  Crosshair,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Menu,
  Radar,
  Workflow,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { cx } from "@rare-structure-hq/ui";

import { useAuth } from "@/lib/auth";

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };

const NAV: NavItem[] = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/app/map", label: "Map", icon: Radar },
  { to: "/app/pipeline", label: "Pipeline", icon: Workflow },
  { to: "/app/applications", label: "Applications", icon: ClipboardList },
  { to: "/app/account", label: "Account", icon: CircleUser },
];

function Brand() {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2.5">
        <div className="flex size-7 items-center justify-center border border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)]">
          <Crosshair className="size-3.5 text-[color:var(--color-text-accent)]" />
        </div>
        <span className="font-display text-[0.9375rem] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-primary)]">
          Rare Structure
        </span>
      </div>
      <div className="flex items-center gap-1.5 pl-[2.375rem]">
        <span className="size-1.5 animate-pulse bg-[color:var(--color-accent-primary)]" />
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
          Catalyst Cockpit
        </span>
      </div>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth();
  const email = user?.email ?? "—";
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[color:var(--color-border-subtle)] px-5 py-5">
        <Brand />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cx(
                  "group flex items-center gap-3 px-3 py-2 font-mono text-[0.75rem] uppercase tracking-[0.1em] transition-colors",
                  isActive
                    ? "bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-primary)]"
                    : "text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-raised)] hover:text-[color:var(--color-text-default)]",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cx(
                      "size-4 shrink-0 transition-colors",
                      isActive
                        ? "text-[color:var(--color-text-accent)]"
                        : "text-[color:var(--color-text-subtle)] group-hover:text-[color:var(--color-text-default)]",
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-[color:var(--color-border-subtle)] p-3">
        <div className="mb-2 flex items-center gap-2.5 px-2 py-1">
          <div className="flex size-7 shrink-0 items-center justify-center border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-raised)] font-mono text-[0.625rem] text-[color:var(--color-text-muted)]">
            {initials}
          </div>
          <span
            className="truncate font-mono text-[0.6875rem] text-[color:var(--color-text-muted)]"
            title={email}
          >
            {email}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex w-full items-center gap-3 px-3 py-2 font-mono text-[0.75rem] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)] transition-colors hover:bg-[color:var(--color-surface-raised)] hover:text-[color:var(--color-text-default)]"
        >
          <LogOut className="size-4 shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  );
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="grid min-h-screen grid-cols-1 bg-[color:var(--color-surface-base)] md:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen border-r border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-sunken)] md:block">
        <SidebarContent />
      </aside>

      <div className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between border-b border-[color:var(--color-border-subtle)] px-4 py-3 md:hidden">
          <Brand />
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="p-1.5 text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-default)]"
          >
            <Menu className="size-5" />
          </button>
        </div>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-[color:var(--color-surface-overlay)]"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-sunken)]">
            <div className="flex justify-end p-2">
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="p-1.5 text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-default)]"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
