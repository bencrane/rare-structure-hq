/**
 * AppShell — the authenticated cockpit chrome.
 *
 * Geometry comes from the design system, not hand-tuned utilities: `Stack` /
 * `Inline` carry spacing from the token scale (`gap`/`p`/`px`/`py` take token
 * names, never arbitrary values) and `Text` carries the type scale (size +
 * baked-in tracking). The sidebar's rhythm is therefore systematic and stays
 * in step with the rest of the platform — tune the scale, not this file.
 *
 * Lives under `src/app/` so it may own layout. Sharp edges, mono labels, the
 * institutional slate-blue accent — the instrument the catalyst terminal wears.
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

import { Inline, Stack, Text, cx } from "@rare-structure-hq/ui";

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

// Non-geometry treatments (borders, surfaces) live as named constants so the
// primitives keep carrying only token-scale geometry via their props.
const DIVIDER = "border-[color:var(--color-border-subtle)]";
const SQUARE =
  "flex size-8 shrink-0 items-center justify-center border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-raised)]";

function BrandMark() {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center border border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)]">
      <Crosshair className="size-4 text-[color:var(--color-text-accent)]" />
    </div>
  );
}

function NavRow({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      title={item.label}
      className={({ isActive }) =>
        cx(
          "group flex items-center gap-3 transition-colors",
          collapsed ? "justify-center p-3" : "px-3 py-3",
          isActive
            ? "bg-[color:var(--color-accent-soft)]"
            : "hover:bg-[color:var(--color-surface-raised)]",
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
          {collapsed ? null : (
            <Text as="span" size="mono-sm" mono color={isActive ? "primary" : "muted"}>
              {item.label}
            </Text>
          )}
        </>
      )}
    </NavLink>
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
      {/* Header — brand + collapse toggle. Fixed band height (min-h-16) keeps
          the two collapse states from shifting the rows below. */}
      <Inline
        gap="0"
        align="center"
        justify={collapsed ? "center" : "between"}
        px="4"
        unsafe_className={cx("min-h-16 border-b", DIVIDER)}
      >
        {collapsed ? (
          <button type="button" onClick={onToggleCollapse} title="Expand sidebar">
            <BrandMark />
          </button>
        ) : (
          <>
            <Inline gap="3" align="center" unsafe_className="shrink-0">
              <BrandMark />
              <Stack gap="1">
                <Text
                  as="span"
                  size="body-sm"
                  face="display"
                  color="primary"
                  className="whitespace-nowrap font-semibold uppercase leading-none tracking-[0.16em]"
                >
                  Rare Structure
                </Text>
                <Text as="span" size="mono-xs" mono color="muted" className="whitespace-nowrap">
                  Catalyst Cockpit
                </Text>
              </Stack>
            </Inline>
            {onToggleCollapse ? (
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Collapse sidebar"
                className="hidden text-[color:var(--color-text-subtle)] transition-colors hover:text-[color:var(--color-text-default)] md:block"
              >
                <PanelLeftClose className="size-4" />
              </button>
            ) : null}
          </>
        )}
      </Inline>

      {/* Nav — pushed off the header and spaced on the token scale. */}
      <Stack
        as="nav"
        gap="2"
        px={collapsed ? "2" : "3"}
        unsafe_className="flex-1 overflow-y-auto pt-8 pb-4"
      >
        {NAV.map((item) => (
          <NavRow key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </Stack>

      {/* Footer — operator chip + sign out. */}
      <Stack
        gap="2"
        p="3"
        align={collapsed ? "center" : "stretch"}
        unsafe_className={cx("border-t", DIVIDER)}
      >
        {collapsed ? (
          <>
            <div
              title={email}
              className={cx(SQUARE, "font-mono text-mono-xs text-[color:var(--color-text-muted)]")}
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
            <Inline gap="2" align="center" px="2" py="1">
              <div
                className={cx(
                  SQUARE,
                  "font-mono text-mono-xs text-[color:var(--color-text-muted)]",
                )}
              >
                {initials}
              </div>
              <Text
                as="span"
                size="mono-xs"
                color="muted"
                title={email}
                className="min-w-0 flex-1 truncate"
              >
                {email}
              </Text>
            </Inline>
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex items-center gap-3 px-3 py-3 text-[color:var(--color-text-muted)] transition-colors hover:bg-[color:var(--color-surface-raised)] hover:text-[color:var(--color-text-default)]"
            >
              <LogOut className="size-4 shrink-0" />
              <Text as="span" size="mono-sm" mono color="muted">
                Sign out
              </Text>
            </button>
          </>
        )}
      </Stack>
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
        collapsed ? "md:grid-cols-[4rem_minmax(0,1fr)]" : "md:grid-cols-[16rem_minmax(0,1fr)]",
      )}
    >
      <aside
        className={cx(
          "sticky top-0 hidden h-screen border-r md:block",
          DIVIDER,
          "bg-[color:var(--color-surface-sunken)]",
        )}
      >
        <SidebarContent collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      </aside>

      <div className="flex min-h-screen flex-col">
        {/* Mobile top bar. */}
        <Inline
          align="center"
          justify="between"
          px="4"
          py="3"
          unsafe_className={cx("border-b md:hidden", DIVIDER)}
        >
          <Inline gap="3" align="center">
            <BrandMark />
            <Text
              as="span"
              size="body-sm"
              face="display"
              color="primary"
              className="font-semibold uppercase tracking-[0.16em]"
            >
              Rare Structure
            </Text>
          </Inline>
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-default)]"
          >
            <Menu className="size-5" />
          </button>
        </Inline>
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
          <aside
            className={cx(
              "absolute inset-y-0 left-0 flex w-64 flex-col border-r",
              DIVIDER,
              "bg-[color:var(--color-surface-sunken)]",
            )}
          >
            <Inline justify="end" p="2">
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-default)]"
              >
                <X className="size-5" />
              </button>
            </Inline>
            <div className="min-h-0 flex-1">
              <SidebarContent collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
