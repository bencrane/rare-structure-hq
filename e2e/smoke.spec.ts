/**
 * Rare Structure e2e smoke suite.
 *
 * Two surfaces, exercised against their running dev servers (both booted by
 * `e2e/playwright.config.ts`'s `webServer` array):
 *
 *   1. marketing-site (5174) — the homepage renders, the "RARE STRUCTURE"
 *      wordmark is present, and the page loads with zero console errors.
 *   2. platform-app (5173) — the market cockpit: the US map renders (real
 *      state-path geometry in the DOM), ⌘K runs a map-query that lights up
 *      company dots, clicking a dot opens its profile with Capital
 *      Catalysts, and an aggregate command swaps the map for the chart.
 *
 * Screenshots of the homepage and each cockpit step are written to
 * `test-results/` (gitignored).
 */

import { expect, test } from "@playwright/test";
import { MARKETING_URL, PLATFORM_URL } from "./playwright.config";

const SHOTS = "test-results";

// ───────────────────────────────────────────────────────────────────
// marketing-site — the homepage.
// ───────────────────────────────────────────────────────────────────

test("marketing-site homepage renders the wordmark with zero console errors", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await page.goto(`${MARKETING_URL}/`, { waitUntil: "networkidle" });

  // The wordmark is split across two <span>s ("RARE" + "STRUCTURE") inside the
  // single <h1>. Assert both the heading and its words.
  const heading = page.locator("h1");
  await expect(heading).toBeVisible();
  await expect(heading).toContainText("Rare", { ignoreCase: true });
  await expect(heading).toContainText("Structure", { ignoreCase: true });

  // The animated starfield canvas is present.
  await expect(page.locator("canvas")).toBeVisible();

  await page.screenshot({ path: `${SHOTS}/marketing-homepage.png`, fullPage: true });

  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});

// ───────────────────────────────────────────────────────────────────
// platform-app — the market cockpit.
// ───────────────────────────────────────────────────────────────────

test("platform-app cockpit runs the ⌘K query → profile → aggregate loop", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  // ── The map — the cockpit's home surface ──────────────────────────
  await page.goto(`${PLATFORM_URL}/`, { waitUntil: "networkidle" });

  // The cockpit starts on the `map` view.
  const cockpit = page.locator("[data-cockpit-view]");
  await expect(cockpit).toHaveAttribute("data-cockpit-view", "map");

  // Real US geography — state-path geometry in the DOM. The map renders 51
  // states across three SVG layers (fill + border + edge), so well over 50
  // <path> elements is the geometry tell vs. a geometry-free dot blob.
  const statePaths = page.locator("svg path");
  await expect(async () => {
    expect(await statePaths.count()).toBeGreaterThan(50);
  }).toPass();

  await page.screenshot({ path: `${SHOTS}/cockpit-1-map.png`, fullPage: true });

  // ── Run a map-query command via the ⌘K palette ────────────────────
  await page.getByRole("button", { name: /query the market/i }).click();
  const palette = page.locator('[role="dialog"][aria-label="Cockpit command palette"]');
  await expect(palette).toBeVisible();

  await page.getByRole("button", { name: /companies in heavy construction/i }).click();
  await expect(palette).toBeHidden();

  // The query lights up the map with clickable company dots — the entrance
  // animation fades them in, so poll until the point groups are present.
  const companyDots = page.locator('svg g[role="button"]');
  await expect(async () => {
    expect(await companyDots.count()).toBeGreaterThan(0);
  }).toPass({ timeout: 15_000 });

  await page.screenshot({ path: `${SHOTS}/cockpit-2-query.png`, fullPage: true });

  // ── Click a company dot → its profile drawer ──────────────────────
  // SVG <g> elements overlap the land-fill <path> geometry, so a positional
  // click is intercepted — dispatch the click event directly.
  await companyDots.first().dispatchEvent("click");
  const profile = page.getByRole("dialog", { name: /^Profile/ });
  await expect(profile).toBeVisible();
  await expect(profile.getByText("Capital Catalysts")).toBeVisible();

  await page.screenshot({ path: `${SHOTS}/cockpit-3-profile.png`, fullPage: true });

  await page.keyboard.press("Escape");
  await expect(profile).toBeHidden();

  // ── Run an aggregate command → the chart view ─────────────────────
  await page.getByRole("button", { name: /query the market/i }).click();
  await expect(palette).toBeVisible();
  await page
    .getByRole("button", { name: /aggregate federal contract spend by industry/i })
    .click();

  await expect(cockpit).toHaveAttribute("data-cockpit-view", "aggregate");
  await expect(
    page.getByRole("heading", { name: /federal contract spend by industry/i }),
  ).toBeVisible();

  await page.screenshot({ path: `${SHOTS}/cockpit-4-aggregate.png`, fullPage: true });

  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});
