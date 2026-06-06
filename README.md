# Zine

A digital **scrollytelling zine-making tool** for high-school writing students, modeled on
[The Pudding](https://pudding.cool/). Students author rich, scroll-animated visual essays with simple
Wix-like tools; finished zines are published to a public gallery.

- **Design:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Build sequence + per-step review gates:** [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)
- **Acceptance rubric (for Codex review):** [REQUIREMENTS.md](REQUIREMENTS.md)
- **Detailed design contract (data model, editor, pedagogy, roadmap):** [docs/design/](docs/design/README.md)
- **Implementation best practices (for AI):** [docs/best-practices/](docs/best-practices/README.md)

> **Status: Step 3 — The editor.** A student creates a zine from a template, edits blocks via a
> registry-driven inspector on a decorated `ZineRenderer` canvas (author ≡ published), with labelled
> undo/redo and **defense-in-depth autosave** (revision discipline, 409 conflict handling, offline
> retry, localStorage shadow). The document model is **v2** (`kind`/`role`/`presentation`, lossless
> `1→2` migration). See [The editor](#the-editor-step-3) and [scope notes](#scope-notes). (Step 2:
> [Content model & rendering](#content-model--rendering-step-2); Step 1:
> [Accounts, auth & RLS](#accounts-auth--rls-step-1).)

---

## Prerequisites

- **Node 18.13+** (this repo was scaffolded on Node 18; CI runs Node 20)
- **pnpm 9** — `corepack use pnpm@9` or `npm i -g pnpm@9`
- **Docker** — only for the local Supabase stack (`supabase start`), needed from Step 1 on
- **Supabase CLI** — https://supabase.com/docs/guides/cli (for the local database)

## Setup

```bash
pnpm install
cp .env.example .env        # fill in values once you run the database (Step 1+)
pnpm dev                    # http://localhost:5173
```

## Scripts (the gates)

| Command                | What it does                                     | Gate |
| ---------------------- | ------------------------------------------------ | ---- |
| `pnpm dev`             | Run the app in dev mode                          | —    |
| `pnpm build`           | Production build (adapter-node)                  | ✅   |
| `pnpm preview`         | Serve the production build                       | —    |
| `pnpm check`           | `svelte-kit sync` + `svelte-check` (typecheck)   | ✅   |
| `pnpm lint`            | `prettier --check` + `eslint`                    | ✅   |
| `pnpm format`          | Auto-format with Prettier                        | —    |
| `pnpm test`            | Unit + component + RLS/migration suites (Vitest) | ✅   |
| `pnpm test:e2e`        | End-to-end (Playwright; builds + previews)       | ✅   |
| `pnpm storybook`       | Run the block catalog at http://localhost:6006   | —    |
| `pnpm build-storybook` | Build the static block catalog                   | ✅   |

> The **RLS and migration suites** ([`tests/rls`](tests/rls), [`tests/migrations`](tests/migrations))
> run only when `SUPABASE_DB_URL` points at a **disposable** Postgres (they reset the `public`
> schema). Unset, they skip and the rest of `pnpm test` still runs. CI provides a throwaway Postgres.
> Component tests (jsdom + @testing-library/svelte + axe) always run.

**Reproduce the full green build** (what CI does — see [.github/workflows/ci.yml](.github/workflows/ci.yml)):

```bash
pnpm install
pnpm lint && pnpm check && pnpm test && pnpm build
pnpm exec playwright install chromium   # first run only
pnpm test:e2e
```

## Local database

```bash
supabase start             # boots Postgres + Auth + Storage in Docker, applies migrations
supabase db reset          # re-apply migrations + seed.sql
```

`supabase start` prints the local `anon` and `service_role` keys — copy them into `.env`. Seeded dev
logins: any seeded email (e.g. `river@lakeside.test`) + `password123`, or a magic link (captured by
Inbucket at http://127.0.0.1:54324). While running `pnpm dev`, `/login` also shows a temporary
**Continue as Riverwild** shortcut; the server action is guarded by SvelteKit `dev` and is absent from
production preview/builds.

### Running the RLS tests without Docker

The Row-Level Security suites run against **any** Postgres via a Supabase-compatible shim
([`tests/db/supabase-shim.sql`](tests/db/supabase-shim.sql)) — no Docker or Supabase CLI required:

```bash
createdb zine_test                                              # a disposable database
SUPABASE_DB_URL=postgresql://localhost/zine_test pnpm test      # applies shim+migrations+seed, proves RLS
```

## Accounts, auth & RLS (Step 1)

- **Sign-in:** Google OAuth (production) and email **magic-link** (dev) via `@supabase/ssr`. Sessions
  live in cookies, validated in [`src/hooks.server.ts`](src/hooks.server.ts) (`getUser()`, not just
  `getSession()`). `/app` is gated there; `/login`, `/auth/callback`, `/auth/confirm` handle the flow.
- **Roles:** `student | teacher | admin` in `public.users.role`. A user can never escalate their own
  role (DB trigger). UI-shaping helpers live in [`src/lib/server/roles.ts`](src/lib/server/roles.ts).
- **Authorization is in the database.** Every table has RLS, deny-by-default; access flows only through
  explicit policies ([`supabase/migrations/*_rls.sql`](supabase/migrations)). Drafts are private to
  owner + their teacher + admin; published zines are public; the moderation queue is staff-only. The
  [`tests/rls`](tests/rls) suite proves cross-user denial both directions, against real Postgres.
- **Service-role key** is used only by [`src/lib/server/supabase-admin.ts`](src/lib/server/supabase-admin.ts)
  and never reaches the client (lint rule + secret-guard test + `$lib/server` boundary).

## Content model & rendering (Step 2)

A zine is **validated JSON**, not HTML: an ordered list of sections → blocks, each block validated
against its registered schema (see [`src/lib/zine`](src/lib/zine)).

- **See it:** `pnpm dev`, then open **http://localhost:5173/z/riverwild/hidden-rivers-under-the-city** (or click
  “Preview a sample zine” on the homepage). The page is **server-rendered** from a fixture document.
- **The contract is the registry.** `ZineDocument` (Zod) is derived from the block registry, so the
  validator and `ZineRenderer` never drift. The renderer reads only the registry — no hard-coded block
  list — and imports nothing from the editor, so the public page and the (future) editor preview share
  one set of `Render` components.
- **Core blocks:** `heading`, `richText` (links + lists, a safe ProseMirror subset — never `{@html}`),
  `image` (alt required to **publish**), `linkButton`, `divider`, `spacer`.
- **Safety:** all URLs are scheme-checked (`SafeUrlSchema` — no `javascript:`/`data:`); the heading
  outline stays valid (page `<h1>` title → content `h2+`); axe runs on every block in tests.
- **Add a block:** see the playbook → [docs/adding-a-block.md](docs/adding-a-block.md). New folder +
  one `registerBlock(...)` line; no core edits.
- **Browse blocks:** `pnpm storybook` → http://localhost:6006 (a story per block + the full renderer).

## Project structure

```
.storybook/             Storybook config (block catalog)
src/
  app.css               Tailwind + theme tokens + reduced-motion safety net
  hooks.server.ts       Supabase session binding + /app auth guard
  routes/
    +page.svelte        home gallery shell (+ sample-zine link)
    login/ auth/        sign-in + callback / confirm / signout
    app/                authed area (guarded): "My Zines"
    z/[user]/[slug]/    public zine page — SSR from a document (Step 2)
  lib/
    a11y/               reduced-motion store
    supabase/ server/   auth clients, role helper, service-role admin (server-only)
    zine/
      schema/           Zod document contract: document, block, richtext, url, theme, migrate
      blocks/           one folder per block (schema.ts, Render.svelte, *.stories.ts, index.ts)
      render/           ZineRenderer + BlockFrame (document → page)
      registry.ts       block + animation registries (the only extension points)
      fixtures.ts       sample zine (route + tests + stories)
      animations/ theme/  (Step 4 / theme system)
supabase/
  migrations/           schema + RLS (timestamped, forward-only)
  seed.sql              dev users, class, zines for local + RLS tests
tests/
  db/ rls/ migrations/  Supabase shim + harness; cross-user RLS proof; apply/reversibility
  unit/                 Vitest specs (e.g. the secret-guard)
  e2e/                  Playwright specs (auth guard, zine SSR page)
```

> Component/contract tests are **colocated** under `src/lib/zine/**` (`*.test.ts`), where the
> ≥80% coverage target applies; cross-cutting specs live under `tests/`.

## Conventions enforced from Step 0

- **Secret-guard:** the Supabase service-role key may appear only under `src/lib/server/**`.
  [`tests/unit/no-service-role-leak.test.ts`](tests/unit/no-service-role-leak.test.ts) fails CI if it
  leaks elsewhere; SvelteKit also refuses to bundle `$lib/server` into the client.
- **Reduced motion:** [`src/lib/a11y/reduced-motion.ts`](src/lib/a11y/reduced-motion.ts) plus a global
  CSS fallback in `app.css`. Every animation added later must honor it.
- **Extensibility:** new blocks/animations register in `src/lib/zine/registry.ts` — no edits to the
  core renderer/editor. (Contracts in [IMPLEMENTATION_PLAN.md §2](IMPLEMENTATION_PLAN.md).)

## The editor (Step 3)

The Wix-like authoring tool lives in [`src/lib/editor`](src/lib/editor) and mounts at
`/app/zines/[id]/edit` (client-only; the server load fetches the RLS-scoped draft).

- **Create:** “New zine” on `/app` seeds a draft from a template (Blank / Photo essay / Data story /
  Interview) and opens the editor.
- **Author ≡ published:** the canvas is the real `ZineRenderer` decorated via an optional Svelte
  context ([`render/context.ts`](src/lib/zine/render/context.ts)) — blocks become selectable in Edit
  mode and inert on the public page. Edit / Preview toggle + device frames.
- **Registry-driven inspector:** selecting a block renders its `BlockDef.Inspector`; every edit is
  `schema.safeParse`-validated **before** it touches the document — invalid input shows an error and
  never corrupts the draft.
- **Undo/redo** via Immer patches with labelled intents; **autosave** ([`editor/autosave.ts`](src/lib/editor/autosave.ts))
  is the data-loss defense — revision discipline (a stale ack can’t mark a newer rev saved), 409
  conflict pause, offline retry with backoff, and a localStorage shadow.
- **Theme:** curated palettes + accents + font pairs ([`zine/theme/registry.ts`](src/lib/zine/theme/registry.ts)),
  applied as CSS variables by the renderer.

**See it:** the editor needs auth + the database. Browse the UI without a backend via Storybook
(`pnpm storybook` → _Editor / EditorShell_), or run the full stack (`supabase start`, sign in, create
a zine). The store, autosave protocol, migration, and inspector-validation are covered by unit +
component tests (`src/lib/editor/**`, `src/lib/zine/schema/**`); the live select → edit → autosave loop
is verified in Storybook.

## Scope notes

Deliberate, documented deviations so review is judged against intent, not guesswork:

**Step 3**

- **Rich text is an interim plain-text editor; TipTap (bold/italic/links + paste sanitation) is the
  next increment.** The contract is unchanged — the inspector edits `props.doc`, host-validated against
  the richtext schema — so swapping in TipTap touches only the richText inspector.
- **Fonts ship as curated system stacks; self-hosting the exact Google families via `@fontsource` is an
  additive fast-follow** (only the stack strings change). Palettes + accents are fully wired.
- **Canvas selection, not canvas drag-reorder.** Reorder is via the Outline (move up/down + tree); the
  contract calls drag the enhancement and buttons the accessible primitive.
- **Scrolly authoring is deferred to Step 4** (it’s listed but disabled). The v2 schema reserves
  `role`/`state`; the structural guard (role/state only in a scrolly section) is enforced now, the
  graphic/step cardinality + `stateSchema` validation land with the animation system.
- **The full DB-backed author→reload e2e runs against `supabase start`** (Docker wasn’t available here).
  The loop is proven by the store round-trip + autosave protocol + inspector-validation unit/component
  tests and the Storybook visual; the failed-migrate recovery screen (editor.md §7.7) is a follow-up.

**Step 2**

- **Component a11y tests use client-mount + axe, not an SSR-string snapshot.** Under jsdom, Svelte
  resolves its client build, which conflicts with `svelte/server`. So blocks/renderer are mounted via
  `@testing-library/svelte` and axed there; the **real SSR** of the public page is verified by a
  Playwright test that loads `/z/...` with **JavaScript disabled**.
- **Animations are stored but not applied.** Blocks/sections carry validated `animation` descriptors;
  the renderer renders statically (the reduced-motion / graceful-degradation baseline). The animation
  system that applies them lands in Step 4 — `allowedAnimations` names are forward-declarations until
  then.
- **`richText` renders a constrained ProseMirror subset** (paragraphs, lists, bold/italic/link) — never
  arbitrary HTML. TipTap (which produces this JSON) is an _editor_ dependency, added in Step 3.
- **Zod ships in the page bundle for now.** Splitting validation (server) from render (client) is a
  Step 5 perf optimization; the C4 budget targets the heavy animation libs (GSAP/Three/D3), not Zod.

**Step 1**

- **RLS proven on plain Postgres, not the full Supabase stack.** Docker wasn't available in the build
  environment, so the RLS/migration suites apply a Supabase-compatible shim (auth schema, roles, and
  `auth.uid()`/`role()`/`jwt()` copied verbatim from Supabase) to real Postgres. This is a _stronger,
  faster, deterministic_ ownership proof than clicking through magic links, and runs in CI on a
  throwaway Postgres service. The full magic-link happy-path e2e runs against `supabase start`.
- **`zine_publications` and public version reads deferred to Step 5.** Step 1 makes published _zine
  metadata_ public (for the gallery); serving the published _document_ from an immutable, pinned
  snapshot is the publish pipeline's job. Draft/version rows stay owner/teacher/admin-only until then.
- **Hand-written DB types** (`src/lib/supabase/types.ts`) cover the queried tables; swap for
  `supabase gen types` once the CLI is in CI (Step 5).

**Step 0**

- **Tailwind v3** (not v4): the v4 engine targets Node 20+, and this machine runs Node 18. v3 +
  PostCSS is rock-solid here. Tokens are CSS variables, so a v4 upgrade later is mechanical.
- **adapter-node** (not adapter-vercel): guarantees a deterministic local/CI build. The Vercel adapter
  (for ISR + CDN) is swapped in at deploy time in Step 5.
- **shadcn-svelte initialized, components added on demand:** `components.json`, the `cn` util, and the
  token CSS are in place; individual components (`pnpm dlx shadcn-svelte@latest add button`) are pulled
  in when first needed (Step 2+) to keep the skeleton lean.
- **Storybook deferred to Step 2:** there are no blocks to catalog yet. It is wired in alongside the
  first blocks, where it earns its keep as the block-development surface.
- **Component-test libs (jsdom, @testing-library/svelte) deferred to Step 2:** Step 0 tests are pure
  TypeScript (a helper + the secret-guard), so they aren't needed yet.
