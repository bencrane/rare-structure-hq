/**
 * AppShell — the authenticated cockpit chrome.
 *
 * A persistent sidebar (brand · nav · operator chip) wrapping an `<Outlet>` for
 * the tabbed surfaces. The Map tab is the primary canvas; the sidebar stays
 * present beside it and collapses to an icon rail (state persisted per browser)
 * so the map can take the full width on a call. Lives under `src/app/` rather
 * than `src/routes/` so it may own geometry.
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
  PanelLeftClose,
  Radar,
  Workflow,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { cx } from "@rare-structure-hq/ui";

import { useAuth } from "@/lib/auth";

type NavItem = { to: string; label: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { to: "/app/map", label: "Map", icon: Radar },
  { to: "/app/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/app/pipeline", label: "Pipeline", icon: Workflow },
  { to: "/app/applications", label: "Applications", icon: ClipboardList },
  { to: "/app/account", label: "Account", icon: CircleUser },
];

const COLLAPSE_KEY = "rs.cockpit.sidebarCollapsed";

function BrandMark() {
  return (
    <div className="flex size-7 shrink-0 items-center justify-center border border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)]">
      <Crosshair className="size-3.5 text-[color:var(--color-text-accent)]" />
    </div>
  );
}

function SidebarContent({
  collapsed,
  onToggleCollapse,
  onNavigate,
}: {
  collapsed: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}) {
  const { user, signOut } = useAuth();
  const email = user?.email ?? "—";
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <div className="flex h-full flex-col">
      {/* Header — brand + collapse toggle. */}
      <div
        className={cx(
          "flex h-[3.75rem] items-center border-b border-[color:var(--color-border-subtle)]",
          collapsed ? "justify-center px-2" : "justify-between px-4",
        )}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Expand sidebar"
            className="flex items-center justify-center"
          >
            <BrandMark />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2.5">
              <BrandMark />
              <div className="flex flex-col">
                <span className="font-display text-[0.9375rem] font-semibold uppercase leading-none tracking-[0.16em] text-[color:var(--color-text-primary)]">
                  Rare Structure
                </span>
                <span className="mt-1 font-mono text-[0.5625rem] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                  Catalyst Cockpit
                </span>
              </div>
            </div>
            {onToggleCollapse ? (
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Collapse sidebar"
                className="hidden p-1 text-[color:var(--color-text-subtle)] transition-colors hover:text-[color:var(--color-text-default)] md:block"
              >
                <PanelLeftClose className="size-4" />
              </button>
            ) : null}
          </>
        )}
      </div>

      {/* Nav. */}
      <nav
        className={cx(
          "flex flex-1 flex-col gap-0.5 overflow-y-auto py-4",
          collapsed ? "px-2" : "px-3",
        )}
      >
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              title={item.label}
              className={({ isActive }) =>
                cx(
                  "group flex items-center font-mono text-[0.75rem] uppercase tracking-[0.1em] transition-colors",
                  collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
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
                  {collapsed ? null : <span className="truncate">{item.label}</span>}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer — operator chip + sign out. */}
      <div
        className={cx(
          "border-t border-[color:var(--color-border-subtle)] p-3",
          collapsed && "flex flex-col items-center gap-2",
        )}
      >
        {collapsed ? (
          <>
            <div
              title={email}
              className="flex size-8 items-center justify-center border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-raised)] font-mono text-[0.625rem] text-[color:var(--color-text-muted)]"
            >
              {initials}
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              title="Sign out"
              className="flex size-8 items-center justify-center text-[color:var(--color-text-muted)] transition-colors hover:bg-[color:var(--color-surface-raised)] hover:text-[color:var(--color-text-default)]"
            >
              <LogOut className="size-4" />
            </button>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  });

  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const toggleCollapse = () => setCollapsed((c) => !c);

  return (
    <div
      className={cx(
        "grid min-h-screen grid-cols-1 bg-[color:var(--color-surface-base)] transition-[grid-template-columns] duration-200 ease-out",
        collapsed ? "md:grid-cols-[3.75rem_minmax(0,1fr)]" : "md:grid-cols-[16rem_minmax(0,1fr)]",
      )}
    >
      <aside className="sticky top-0 hidden h-screen border-r border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-sunken)] md:block">
        <SidebarContent collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      </aside>

      <div className="flex min-h-screen flex-col">
        {/* Mobile top bar. */}
        <div className="flex items-center justify-between border-b border-[color:var(--color-border-subtle)] px-4 py-3 md:hidden">
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <span className="font-display text-[0.875rem] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-primary)]">
              Rare Structure
            </span>
          </div>
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
              <SidebarContent collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
