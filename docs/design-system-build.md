# Design-system foundation — how it is built

This document describes the design-system foundation of the `rare-structure-hq`
monorepo: the four packages under `packages/`, how each layer works, and how the
two apps under `apps/` consume them.

Scope: `packages/tokens`, `packages/ui`, `packages/shared`,
`packages/eslint-plugin-rare-structure-hq`, the Storybook setup inside
`packages/ui`, and the wiring points in `apps/marketing-site` and
`apps/platform-app`. Every statement below was verified by reading the named
source file or by running the named command.

The foundation landed in a single content commit, `2983d05`
(`feat: scaffold design-system foundation monorepo`), merged via PR #1 as
`5e30406`. That commit added 32 files / 1967 insertions under `packages/`
(verified with `git show --stat 2983d05 -- packages/`). The apps were added
later in `f2520b3`.

---

## 1. Overview — the package graph

The repository is a Bun workspace. The root `package.json` declares
`"workspaces": ["apps/*", "packages/*"]` and `"engines": { "bun": ">=1.3.0",
"node": ">=22" }`.

Four packages live under `packages/`:

| Package | `name` field | Built? | Role |
|---|---|---|---|
| `packages/tokens` | `@rare-structure-hq/tokens` | Yes — `build.ts` | Design tokens → CSS variables, Tailwind preset, typed TS exports |
| `packages/ui` | `@rare-structure-hq/ui` | No — source-exported | React primitives (layout + visual) |
| `packages/shared` | `@rare-structure-hq/shared` | No — types-only | Zod schemas (the catalyst-event data contract) |
| `packages/eslint-plugin-rare-structure-hq` | `eslint-plugin-rare-structure-hq` | Yes — `tsc` | Custom ESLint rule(s) |

Dependency edges, verified from each package's `package.json`
`dependencies` / `devDependencies` / `peerDependencies`:

- `@rare-structure-hq/ui` → `@rare-structure-hq/tokens` (`workspace:*`), plus
  runtime deps `clsx` `2.1.1`, `react` `19.0.0`, `react-dom` `19.0.0`.
- `@rare-structure-hq/tokens` → no runtime dependencies; only a `typescript`
  devDependency.
- `@rare-structure-hq/shared` → `zod` `3.23.8`.
- `eslint-plugin-rare-structure-hq` → `@typescript-eslint/utils` `8.18.2`
  (dependency); `eslint >=9` (peerDependency).

There are no other edges between the four packages. `tokens`, `shared`, and the
ESLint plugin do not depend on each other; `ui` is the only package that depends
on another (`tokens`).

The root `package.json` `scripts` orchestrate the packages:

- `build` — runs `@rare-structure-hq/tokens build`, then
  `@rare-structure-hq/ui build`, then both apps' builds.
- `typecheck` — `tsc --noEmit` per package, then `tsc -b --noEmit` per app.
- `lint` — builds the ESLint plugin first, then runs `biome check` over the
  package/app sources, then `bun x eslint` over `apps/*/src/routes/**/*.tsx`.
- `test` — runs the `shared`, `tokens`, `eslint-plugin`, and `ui` test scripts.
- `storybook` / `storybook:build` — delegate to `@rare-structure-hq/ui`.

`tsconfig.base.json` is the shared TS base (`target: ES2023`, `module: ESNext`,
`moduleResolution: Bundler`, `strict: true`, `jsx: preserve`). Every package's
`tsconfig.json` extends it. `biome.json` configures Biome 1.9.4 as the
formatter and primary linter (2-space indent, 100-char line width, double
quotes, `noExplicitAny: error`); it ignores `dist`, `node_modules`,
`storybook-static`.

---

## 2. Design tokens — `@rare-structure-hq/tokens`

### 2.1 The token source

`packages/tokens/src/tokens.ts` is the single source of truth. It exports eight
token groups as `as const` objects, plus an aggregate `tokens` object that
re-bundles all eight, plus `Tokens` and per-group key types. `src/index.ts` is
one line: `export * from "./tokens";`.

The eight groups and their exact leaf counts (counted from the source):

| Group | Export | Leaves | Notes |
|---|---|---|---|
| Spacing | `spacing` | 13 | Keys `0,1,2,3,4,5,6,8,10,12,16,20,24`; rem values (`4` = `1rem`). |
| Type scale | `fontSize` | 13 | Each value is `[size, { lineHeight, letterSpacing? }]`. 4 `body-*`, 6 `display-*`, 3 `mono-*`. |
| Color | `color` | 28 | Semantic roles, not a raw palette (see below). |
| Radius | `radius` | 5 | `none/sm/md/lg` all `"0"`; `xl` = `0.75rem` (the only non-zero — "sharp-edge house style"). |
| Motion | `motion` | 5 | `duration` (3: `fast/base/slow`) + `easing` (2: `out/inOut`). |
| Breakpoint | `breakpoint` | 5 | `sm/md/lg/xl/2xl`, `640px`–`1536px`. |
| Z-index | `z` | 7 | `base(0)/raised(10)/sticky(20)/nav(30)/overlay(40)/modal(50)/toast(60)`. |
| Page width | `pageWidth` | 3 | `narrow(48rem)/default(72rem)/wide(84rem)`. |

The `color` group has five sub-roles totalling 28 leaves: `surface` (5: `base`,
`raised`, `sunken`, `overlay`, `raised-translucent`), `border` (4: `subtle`,
`default`, `strong`, `accent`), `text` (7: `primary`, `strong`, `default`,
`muted`, `subtle`, `accent`, `onAccent`), `accent` (5: `primary`,
`primaryHover`, `primaryActive`, `soft`, `softer`), `state` (7: `info`,
`success`, `warn`, `error`, `successSoft`, `warnSoft`, `errorSoft`).

Colors are named by semantic role (`surface.*`, `border.*`, `text.*`,
`accent.*`, `state.*`) rather than as a raw palette (`blue-500`). The single
accent is `accent.primary` = `#3461c4` ("institutional slate-blue"). The source
file's comments record WCAG contrast figures for each `text.*` value against
`surface.base` (`#09090b`) — e.g. `text.subtle` (`#82828c`) noted at 5.23:1.
These figures are comments in the source, not computed by any build step.

The source also exports key-type aliases: `SpacingToken`, `FontSizeToken`,
`ColorPathLeaf` (a template-literal union over the five color sub-roles),
`RadiusToken`, `BreakpointToken`, `ZToken`, `PageWidthToken`, and `Tokens`.

### 2.2 The build pipeline

`packages/tokens` is a built package. Its `package.json` `build` script is
`bun run ./build.ts`. `package.json` points `main`/`types`/`exports` at `dist/`
(`./dist/ts/index.js`, `./dist/css/tokens.css`, `./dist/tailwind/preset.js`),
so `dist/` must exist before consumers resolve the package.

`build.ts` (read in full) does the following:

1. Resolves `dist/` and freshly recreates three subdirectories (`css`,
   `tailwind`, `ts`) — each is removed if present, then `mkdir`-ed.
2. **`dist/css/tokens.css`** — builds a CSS string in two blocks:
   - An `@theme { ... }` block (Tailwind v4 reads tokens from `@theme`). It
     emits `--spacing-{k}` for spacing; `--text-{name}` plus
     `--text-{name}--line-height` and `--text-{name}--letter-spacing` for
     `fontSize`; `--color-{role}-{k}` for all five color sub-roles via an
     `emitColors` helper; `--radius-{k}` for radius; `--breakpoint-{k}` for
     breakpoints.
   - A `:root { ... }` block for the tokens Tailwind does not consume via
     `@theme`: `--motion-duration-*`, `--motion-easing-*`, `--z-*`,
     `--page-width-*`.
   The file is prefixed with `/* Auto-generated by packages/tokens/build.ts —
   do not edit. */`.
3. **`dist/tailwind/preset.{ts,js,d.ts}`** — three hand-written string
   artifacts. Tailwind v4 reads tokens from the CSS `@theme` block, not from a
   JS preset, so this "preset" does not configure Tailwind. Each artifact
   exports `tokensCss` — the resolved absolute path to the generated
   `tokens.css` (computed at runtime via `fileURLToPath`/`resolve`) — and
   re-exports the `tokens` tree (and `Tokens` type) from `../ts/index.js`, for
   tooling that introspects token values programmatically.
4. **`dist/ts/index.{js,d.ts}`** — `build.ts` spawns `bun x tsc -p .`, which
   compiles `src/` per `packages/tokens/tsconfig.json` (that config sets
   `outDir: ./dist/ts`, `rootDir: ./src`, `declaration: true`, `noEmit: false`,
   and `exclude`s `build.ts`). If `tsc` exits non-zero the build aborts.

Verified: `bun run --filter @rare-structure-hq/tokens build` exits 0 and prints
`✓ tokens build complete` with the three artifact families. `build.test.ts`
(8 tests, `bun test`) asserts the build output exists and that
`dist/css/tokens.css` contains the `@theme {` block and specific tokens — e.g.
`--spacing-4: 1rem`, `--color-surface-base: #09090b`,
`--color-accent-primary: #3461c4`, `--text-body-md: 1rem` with
`--text-body-md--line-height: 1.5rem`, `--motion-duration-base: 200ms`,
`--z-modal: 50`, `--page-width-default: 72rem`. `bun run --filter
@rare-structure-hq/tokens test` reports `8 pass / 0 fail`.

`dist/` is gitignored and is not committed; it is produced by the build.

### 2.3 The three consumable exports

The `exports` map in `package.json` exposes three entrypoints:

- `@rare-structure-hq/tokens` — the typed TS exports (`tokens` object + types).
- `@rare-structure-hq/tokens/css` — the generated `tokens.css`, imported by
  consumers in their own CSS.
- `@rare-structure-hq/tokens/tailwind` — the `preset.js` artifact (the
  `tokensCss` path + `tokens` re-export).

---

## 3. Primitives — `@rare-structure-hq/ui`

`@rare-structure-hq/ui` is **not** a built package. `package.json` points
`main`/`types`/`exports` at `./src/index.ts`; consumers import the TypeScript
source directly (via workspace symlink). The `build` script is `tsc --noEmit` —
a typecheck, not an emit. React `19.0.0` is a hard dependency.

### 3.1 The two-sub-layer split

`src/index.ts` documents and exports two deliberately distinct sub-layers:

- **Layout primitives** (`src/layout.tsx`) — own geometry (spacing, sizing,
  width). 6 primitives: `Stack`, `Inline`, `Grid`, `Box`, `Divider`, `Page`.
- **Visual primitives** (`src/visual.tsx`) — own surface, type, and color. 4
  primitives: `Text`, `Card`, `Badge`, `Button`.

10 primitives total. The architectural rule, stated in both files' header
comments: a layout primitive never carries a brand color or type treatment; a
visual primitive never owns page geometry (no `max-w-*`, no route-level
padding).

### 3.2 `src/utils.ts` — the token-prop mapping layer

`utils.ts` is the single point of contact between token names and Tailwind
classes. It contains:

- `cx(...inputs)` — a thin wrapper over `clsx`, re-exported as the design
  system's stable class-composer name.
- `SpacingProp` — aliased to the token source's `SpacingToken`. A
  `SPACING_KEYS` array (the 13 spacing keys) drives a `spacingTable(prefix)`
  helper that builds `Record<SpacingProp, string>` class maps. `space` exposes
  six such tables: `gap`, `p`, `px`, `py`, `mt`, `mb`.
- `textColor` — `Record<TextColorProp, string>`, 7 entries, each mapping a
  `text.*` role to `text-[color:var(--color-text-*)]`.
- `surfaceBg` — `Record<SurfaceProp, string>`, 5 entries → `bg-[color:var(...)]`.
- `borderColor` — `Record<BorderProp, string>`, 4 entries → `border-[color:...]`.
- `fontSize` — `Record<FontSizeProp, string>`, 13 entries, each mapping a type
  token to its Tailwind `text-*` utility (`text-body-md`, `text-display-lg`,
  `text-mono-xs`, …).
- `pageMaxWidth` — `Record<PageVariantProp, string>`, 4 entries:
  `narrow→max-w-[48rem]`, `default→max-w-[72rem]`, `wide→max-w-[84rem]`,
  `full→max-w-none`.

`PageVariantProp` is `"narrow" | "default" | "wide" | "full"`. Note: the
`tokens` package's `pageWidth` group has only 3 keys (`narrow`, `default`,
`wide`); `utils.ts` adds a fourth UI-only variant `full` that has no
corresponding token. The `SPACING_KEYS` array, the `textColor`/`surfaceBg`/
`borderColor`/`fontSize` keys, and `PageVariantProp` are hand-maintained
mirrors of the token source — the prop *types* (`SpacingProp`, `TextColorProp`,
`SurfaceProp`, `BorderProp`, `FontSizeProp`) are derived from
`@rare-structure-hq/tokens` types so they cannot drift, but the mapping table
*values* are written out by hand in this file.

### 3.3 Layout primitives (`src/layout.tsx`)

All six are dark-themed geometry helpers. Five (`Stack`, `Inline`, `Grid`,
`Box`, `Page`) are `forwardRef` components; `Divider` is a plain function
component. Each accepts only token-name props, never raw numbers. A shared
`CommonProps` interface contributes `children`, `as?: ElementType`, and
`unsafe_className?: string` (an escape hatch, documented as "last resort").

| Primitive | Props (beyond `CommonProps` / DOM attrs) |
|---|---|
| `Stack` | `gap?: SpacingProp` (default `"4"`), `align?: "start"\|"center"\|"end"\|"stretch"`, `justify?: "start"\|"center"\|"end"\|"between"\|"around"`, `p?`/`px?`/`py?: SpacingProp`. Renders `flex flex-col`. |
| `Inline` | `gap?` (default `"4"`), `align?: "start"\|"center"\|"end"\|"baseline"\|"stretch"` (default `"center"`), `justify?` (same 5 as Stack), `wrap?: boolean`, `p?`/`px?`/`py?`. Renders `flex`. |
| `Grid` | `cols?`/`mdCols?`/`lgCols?: 1\|2\|3\|4\|6\|12` (`cols` default `1`), `gap?` (default `"4"`). Renders `grid` with `grid-cols-*` / `md:` / `lg:` classes from fixed maps. |
| `Box` | `bg?: SurfaceProp`, `border?: BorderProp`, `p?`/`px?`/`py?: SpacingProp`, `rounded?: "none"\|"xl"`. Generic styled container. |
| `Divider` | `axis?: "horizontal"\|"vertical"` (default `"horizontal"`), `color?: BorderProp` (default `"subtle"`), `unsafe_className?`. Horizontal renders `<hr>`; vertical renders an `aria-hidden` `<span>`. Reuses the `borderColor` class with `border-`→`bg-` string replacement. |
| `Page` | `variant?: PageVariantProp` (default `"default"`), `py?: SpacingProp` (default `"12"`). Renders `mx-auto w-full` + the `pageMaxWidth[variant]` class. |

`Page` is the geometry boundary between routes and the design system: its header
comment states a route returns `<Page variant="…">…</Page>` and never sets
`max-w-*`/`mx-auto` itself — the discipline enforced by the `no-route-geometry`
ESLint rule (§5).

### 3.4 Visual primitives (`src/visual.tsx`)

All four carry type/color/surface styling. `Text`, `Card`, `Button` are
`forwardRef`; `Badge` is a plain function component. Color values are applied
as arbitrary Tailwind classes referencing the generated CSS variables
(`bg-[color:var(--color-...)]`).

| Primitive | Props | Behavior |
|---|---|---|
| `Text` | `size?: FontSizeProp` (default `"body-md"`), `color?: TextColorProp` (default `"default"`), `as?: "p"\|"span"\|"div"\|"h1"\|"h2"\|"h3"\|"h4"\|"label"` (default `"p"`), `mono?: boolean`. | The typographic primitive. `mono` adds `font-mono uppercase`. |
| `Card` | `variant?: "default"\|"raised"` (default `"default"`), `interactive?: boolean`. | The surface primitive. Always `rounded-xl border`. `default` = translucent raised surface + `backdrop-blur-sm`; `raised` = solid `surface.raised`. `interactive` adds a hover border transition. |
| `Badge` | `tone?: BadgeTone` (default `"default"`). `BadgeTone` = `"default"\|"accent"\|"info"\|"success"\|"warn"\|"error"` (6 tones). | The mono-label primitive. `inline-flex`, `rounded-none`, `font-mono text-mono-xs uppercase`; per-tone border/bg/text classes from a `badgeTones` record. |
| `Button` | `variant?: ButtonVariant` (default `"primary"`), `size?: ButtonSize` (default `"md"`), `type` (default `"button"`). `ButtonVariant` = `"primary"\|"secondary"\|"ghost"`; `ButtonSize` = `"sm"\|"md"`. | The action primitive. `rounded-none`, `transition-colors`, disabled + `focus-visible` outline styling. `primary` uses the accent token; `sm` = `h-8`, `md` = `h-10`. |

### 3.5 Public surface and test

`src/index.ts` re-exports all 10 primitives, their prop types/unions, and the
token-prop utilities (`cx` + the six prop-type aliases). `src/__primitives.test.ts`
is a smoke test (`bun test`) that asserts all 10 primitive names plus `cx` are
exported and that `cx` merges classes. `bun run --filter @rare-structure-hq/ui
test` reports `12 pass / 0 fail` (10 export checks + 2 `cx` checks).

---

## 4. `@rare-structure-hq/shared`

`packages/shared` is a types-only package — its `build` script is
`echo 'no build — types-only package'`. It depends on `zod` `3.23.8`.
`exports` exposes `.` (→ `src/index.ts`) and `./schemas` (→
`src/schemas/index.ts`). It is not part of the design-system rendering layer;
it is the data contract. It is documented here for completeness because it is
one of the four `packages/`.

`src/schemas/` contains:

- `common.ts` — `uuidSchema` (v4 UUID string), `isoTimestampSchema` (ISO-8601
  with offset), `paginationSchema` (cursor envelope: `limit` 1–100 default 20,
  `offset` ≥0 default 0), `errorSchema` (uniform error envelope) + the
  `ErrorResponse` inferred type.
- `catalyst-event.ts` — the catalyst-event contract. Enums:
  `catalystKindSchema` (7 values), `catalystSeveritySchema` (4),
  `catalystStatusSchema` (4). `catalystLocationSchema` — `{ lon, lat, region }`
  with WGS-84 range bounds. `catalystEventSchema` — the full event (required
  core + optional "growth seam" fields including `location`).
  `catalystEventCreateSchema` omits `id` + `ingested_at`. Inferred types are
  exported alongside each schema.
- `index.ts` re-exports both files.

`src/schemas.test.ts` (`bun test`) has 6 tests covering valid parsing/defaults,
enum rejection, field-bound rejection, the create-schema omission, and the
optional `location` field. `bun run --filter @rare-structure-hq/shared test`
reports `6 pass / 0 fail`.

---

## 5. The ESLint plugin — `eslint-plugin-rare-structure-hq`

A built package: `build` is `tsc -p tsconfig.build.json` (emits to `dist/`,
including `src/index.ts` and `src/no-route-geometry.ts`, excluding tests).
`package.json` points `main`/`exports` at `dist/`. It declares `eslint >=9` as
a peer dependency and `@typescript-eslint/utils` `8.18.2` as a dependency.

### 5.1 Plugin entry — `src/index.ts`

The default export is a plugin object with `meta` (`name`, `version`) and a
`rules` map. The map currently contains exactly **one** rule:
`"no-route-geometry"`. `noRouteGeometry` is also re-exported by name.

### 5.2 The `no-route-geometry` rule — `src/no-route-geometry.ts`

Built with `@typescript-eslint/utils`' `ESLintUtils.RuleCreator`. The rule type
is `"problem"`; it has one message id, `banned`; its `schema` is `[]` (no
options).

**What it enforces.** The rule bans hand-rolled page-geometry Tailwind
utilities on *top-level JSX* in route files. The intent (stated in the header
and the `description`): routes describe content; the layout primitives
(`<Page>`, `<Stack>`, `<Inline>`, `<Grid>`) own geometry.

**Where it applies.** `create()` reads the filename and returns an empty
visitor (no-op) unless the path matches `/\/apps\/[^/]+\/src\/routes\//` —
i.e. any app's `src/routes/` directory. Outside route files the rule does
nothing.

**Banned utilities.** The `BANNED` array holds five regexes, matched as whole
tokens inside `className` string-literal values:

- `/\bmx-auto\b/` — `mx-auto`
- `/\bmax-w-[a-z0-9./-]+/` — any `max-w-*`
- `/\bpx-[0-9]+(?:\.[0-9]+)?\b/` — numeric `px-{N}` / `px-{N}.{N}`
- `/\bpy-[0-9]+(?:\.[0-9]+)?\b/` — numeric `py-{N}` / `py-{N}.{N}`
- `/\bgap-[0-9]+(?:\.[0-9]+)?\b/` — numeric `gap-{N}` / `gap-{N}.{N}`

**What is exempt.**
- The `EXEMPT_TAGS` set — `Page`, `PublicPage`, `AuthPage` — is skipped
  entirely; a banned class on one of those JSX tags does not report.
- The `unsafe_className` attribute is the escape hatch:
  `checkClassName` returns early when the attribute name is `unsafe_className`.
  It only inspects attributes literally named `className`.

**"Top-level JSX" detection.** `isTopLevelJSX` walks up from a `JSXElement`
through its parent chain (capped at depth 24). It returns `false` as soon as it
hits an enclosing `JSXElement`, `JSXFragment`, or `JSXAttribute` (meaning the
element is nested). A `JSXExpressionContainer` is treated as transparent unless
its parent is itself JSX. The element counts as top-level only if the walk
reaches a `FunctionDeclaration` with a PascalCase name (regex `/^_*[A-Z]/`,
optional leading underscores) or an arrow/function expression assigned to a
PascalCase `VariableDeclarator`. So the rule fires only on the element a
route's exported component returns directly — not on nested children.

**How a violation is reported.** The `JSXElement` visitor calls
`isTopLevelJSX`, then `checkOpening`, which iterates the opening element's
attributes, extracts string values from `Literal` and
`JSXExpressionContainer`-wrapped `Literal` nodes, runs `checkClassName`, and
collects every matched class into a `hits` list. If `hits` is non-empty it
calls `context.report` with `messageId: "banned"` and interpolates the
comma-joined hits into the message.

### 5.3 Rule test — `src/no-route-geometry.test.ts`

Uses `@typescript-eslint/rule-tester`'s `RuleTester` wired into `bun:test`
globals. It defines 4 `valid` cases (a clean `<Page>`; `unsafe_className` with
`mx-auto max-w-md` on `<Page>`; a non-route file that is therefore exempt;
banned classes on a *nested* `<div>` inside `<Page>`) and 3 `invalid` cases
(`mx-auto max-w-3xl px-6 py-12`, `px-6 py-8`, `max-w-7xl` — each on a
top-level `<div>`/`<section>` in a route file). `bun run --filter
eslint-plugin-rare-structure-hq test` reports `7 pass / 0 fail` (4 + 3 cases).

### 5.4 How the rule is wired into the repo

The root `eslint.config.mjs` is a flat config scoped to
`apps/*/src/routes/**/*.tsx`. It registers the plugin under the namespace
`rare-structure-hq` and sets `rare-structure-hq/no-route-geometry` to
`"error"`, with `@typescript-eslint/parser` as the parser. The config header
notes Biome remains the primary linter; ESLint exists only to host custom AST
rules Biome cannot express. The root `lint` script builds the plugin, then runs
`bun x eslint apps/*/src/routes/**/*.tsx`.

---

## 6. Storybook

Storybook lives inside `packages/ui`. It is Storybook `8.4.7`
(`@storybook/react-vite`). The `ui` package scripts: `storybook` =
`storybook dev -p 6006 --no-open`; `storybook:build` = `storybook build -o
storybook-static`. The root `storybook` / `storybook:build` scripts delegate
here.

### 6.1 Config — `.storybook/`

- `main.ts` — `stories` glob `../src/**/*.stories.@(ts|tsx)`; addons
  `@storybook/addon-essentials` and `@storybook/addon-a11y`; framework
  `@storybook/react-vite`. `typescript.check` is `false`; `docs.autodocs` is
  `false` (no auto-generated docs pages).
- `preview.ts` — sets the default background to `dark`, configures control
  matchers, and enables the a11y addon's `color-contrast` rule.
- `preview.css` — imports `tailwindcss` and `@rare-structure-hq/tokens/css`
  (the generated token CSS), so stories render with the production tokens. It
  adds an `@theme` block defining `--font-sans` / `--font-mono` from system
  font stacks (the comment notes the real typefaces are deliberately not loaded
  in Storybook — the apps own font loading), and sets the
  `surface.base` background / `text.strong` color on the Storybook roots.

`packages/ui/vite.config.ts` (used by Storybook's Vite builder) registers the
`@vitejs/plugin-react` and `@tailwindcss/vite` plugins and sets no path
aliases — workspace symlinks plus the `tokens` package `exports` field resolve
`@rare-structure-hq/tokens` and `…/css` directly.

### 6.2 Stories — `src/*.stories.tsx`

There are 2 story files containing **10 story objects total**, one per
primitive:

- `layout.stories.tsx` — `title: "Layout"`, 6 stories: `Stack`, `Inline`,
  `Grid`, `Box`, `Divider`, `Page` (each a `StoryObj` with a `render`
  function).
- `visual.stories.tsx` — `title: "Visual"`, 4 stories: `Text`, `Card`,
  `Badge`, `Button`.

Each story renders the primitive in representative configurations (e.g. the
`Button` story renders all three variants, a small size, and a disabled state;
the `Badge` story renders all six tones). There are no other `*.stories.tsx`
files and no Storybook MDX docs.

---

## 7. Consumption — how the apps wire in the foundation

Both apps (`apps/marketing-site`, `apps/platform-app`) are Vite + React 19 apps.
Each declares `@rare-structure-hq/tokens` and `@rare-structure-hq/ui` as
`workspace:*` dependencies; `platform-app` additionally depends on
`@rare-structure-hq/shared`.

### 7.1 The tokens CSS

Each app's `src/index.css` begins with:

```css
@import "tailwindcss";
@import "@rare-structure-hq/tokens/css";
```

The second import pulls the generated `tokens.css` — the full `@theme` block
(color / spacing / type / radius / breakpoints) and the `:root` block (motion /
z / page-width). Each app's `index.css` then adds only an `@theme` block for
fonts (`--font-sans` / `--font-mono` / `--font-display`, all from the
`@fontsource-variable/geist` packages, which the tokens package does not own),
and base `html, body` rules that reference `--color-surface-base` and
`--color-text-strong`. `platform-app`'s `index.css` additionally defines one
app-local utility class, `.rs-scanlines` (a repeating-gradient texture built
on the `surface.sunken` token). The comment in each file states that anything
that should be a token belongs in `packages/tokens/src/tokens.ts`, not in the
app CSS.

`src/index.css` is imported by each app's `src/main.tsx` (after the two
Fontsource font imports).

### 7.2 The Tailwind preset

Neither app imports `@rare-structure-hq/tokens/tailwind`. Tailwind v4 reads its
theme from the `@theme` block in the imported CSS, so the `/tailwind` preset
entrypoint is not needed for app styling — the `@import
"@rare-structure-hq/tokens/css"` line is what feeds Tailwind. Each app's
`vite.config.ts` registers `@tailwindcss/vite` and `@vitejs/plugin-react`;
`marketing-site`'s config also adds an `fs.allow` entry for the workspace root
so Vite will serve the hoisted Fontsource/token files.

### 7.3 The UI components

Components are imported from the `@rare-structure-hq/ui` package entry (its
`src/index.ts`, since the package is source-exported). Verified usage: one
import across the two apps' source — `apps/marketing-site/src/components/
Wordmark.tsx` imports `{ Text }` from `@rare-structure-hq/ui`. The two other
`@rare-structure-hq/tokens` references in app source
(`Wordmark.tsx`, `Starfield.tsx`) are in comments, not import statements.
`platform-app`'s demo tree under `src/demo/**` does not import from
`@rare-structure-hq/ui` — it styles directly with Tailwind classes that resolve
against the token-derived `@theme` variables.

### 7.4 Route discipline at the app boundary

Both apps author route files under `src/routes/` — `marketing-site` has
`routes/Home.tsx`, `platform-app` has `routes/MapDemo.tsx`. These are the files
the `no-route-geometry` rule (§5) lints. Both route components are written to
the discipline: `Home.tsx`'s top-level `<main>` uses only flex alignment +
viewport sizing and pushes container geometry into `<Wordmark>`; `MapDemo.tsx`
is a thin mount with a top-level `<div className="h-screen w-full">`. Neither
top-level element carries a banned `mx-auto` / `max-w-*` / numeric `px-*` /
`py-*` / `gap-*` class.

---

## Appendix — verified numbers

| Quantity | Value | How verified |
|---|---|---|
| Packages under `packages/` | 4 | `ls packages/`; each `package.json` read |
| Design-token groups | 8 | `tokens.ts` exports |
| Token leaves (spacing / type / color / radius / motion / breakpoint / z / pageWidth) | 13 / 13 / 28 / 5 / 5 / 5 / 7 / 3 | counted from `tokens.ts` |
| Token build artifact families | 3 (css, tailwind, ts) | `build.ts`; build run exits 0 |
| UI primitives | 10 (6 layout + 4 visual) | `layout.tsx`, `visual.tsx`, `index.ts` |
| ESLint rules | 1 (`no-route-geometry`) | `eslint-plugin .../src/index.ts` |
| Banned-utility regexes in the rule | 5 | `no-route-geometry.ts` `BANNED` |
| Story files / story objects | 2 / 10 | `layout.stories.tsx`, `visual.stories.tsx` |
| Test results — tokens / ui / shared / eslint-plugin | 8 / 12 / 6 / 7 pass, 0 fail | `bun run --filter … test` for each |

### Notes and divergences

- **`dist/` contents not directly read.** The `dist/` directory is excluded by
  this environment's file-access settings, so the *generated* `tokens.css`,
  `preset.*`, and `ts/index.*` files were not opened byte-for-byte. Their
  contents are documented from `build.ts` (the deterministic generator, read in
  full) and from `build.test.ts`, whose 8 assertions on specific generated
  strings all pass. The build was executed and exits 0.
- **`pageWidth` token vs `PageVariantProp`.** `packages/tokens` defines 3
  `pageWidth` tokens (`narrow`, `default`, `wide`). `packages/ui`'s
  `utils.ts` defines a 4-value `PageVariantProp` adding `full`
  (`max-w-none`), which has no backing token. This is a real code fact, noted
  in §3.2.
- **`utils.ts` mapping tables are hand-written.** The prop *types* in
  `utils.ts` derive from the `tokens` package so they cannot drift, but the
  class-string *values* (`SPACING_KEYS`, and the `textColor` / `surfaceBg` /
  `borderColor` / `fontSize` / `pageMaxWidth` records) are maintained by hand.
- **The ESLint rule's docs URL.** `RuleCreator` generates a
  `…/docs/no-route-geometry.md` documentation URL, but no `docs/` directory
  exists in the `eslint-plugin-rare-structure-hq` package — the URL is a
  convention, not a shipped file.
- **`index.ts` vs test import path in the ESLint plugin.** `src/index.ts`
  imports the rule from `./no-route-geometry.js` (post-build path);
  `no-route-geometry.test.ts` imports from `./no-route-geometry` (the TS
  source). Both are correct for their context.
