/**
 * Rare Structure e2e smoke suite.
 *
 * Two surfaces, exercised against their running dev servers (both booted by
 * `e2e/playwright.config.ts`'s `webServer` array):
 *
 *   1. marketing-site (5174) — the homepage renders, the "RARE STRUCTURE"
 *      wordmark is present, and the page loads with zero console errors.
 *   2. platform-app (5173) — the root lands on the sign-in gate (the public
 *      /map cockpit demo was un-hosted in #100; `/` has redirected to /signin
 *      since #30), and the DEV "Preview: operator" affordance boots the
 *      authenticated shell through to the operator's home tab.
 *
 * Screenshots of each surface are written to `test-results/` (gitignored).
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

  await page.screenshot({ path: `${SHOTS}/marketing-homepage.png`, fullPage: true });

  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});

// ───────────────────────────────────────────────────────────────────
// platform-app — sign-in gate → authenticated shell.
// ───────────────────────────────────────────────────────────────────

test("platform-app root lands on the sign-in gate and the operator preview boots the shell", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  // ── The sign-in gate — the app's public surface ───────────────────
  await page.goto(`${PLATFORM_URL}/`, { waitUntil: "networkidle" });

  // `/` redirects to the email + password gate.
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByText("Rare Structure")).toBeVisible();
  await expect(page.locator("#email")).toBeVisible();
  await expect(page.locator("#password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

  await page.screenshot({ path: `${SHOTS}/platform-1-signin.png`, fullPage: true });

  // The public surface loads clean — no console errors before auth. (The
  // authenticated shell is excluded from this assertion: its tabs fetch
  // platform-api, which the e2e web servers do not boot.)
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);

  // ── DEV preview → the authenticated shell ─────────────────────────
  // The dev servers run with `import.meta.env.DEV`, so the preview affordance
  // drops a mock operator session without a configured Supabase project.
  await page.getByRole("button", { name: /preview: operator/i }).click();

  // The operator's home tab is /app/map (AppIndex redirect).
  await expect(page).toHaveURL(/\/app\/map$/);
  // The shell's persistent sidebar renders alongside the routed tab.
  await expect(page.locator("aside").first()).toBeAttached();
  await expect(page.locator("main")).toBeVisible();

  await page.screenshot({ path: `${SHOTS}/platform-2-shell.png`, fullPage: true });
});
