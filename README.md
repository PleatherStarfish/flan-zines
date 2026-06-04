# Zine

A digital **scrollytelling zine-making tool** for high-school writing students, modeled on
[The Pudding](https://pudding.cool/). Students author rich, scroll-animated visual essays with simple
Wix-like tools; finished zines are published to a public gallery.

- **Design:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Build sequence + per-step review gates:** [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)
- **Acceptance rubric (for Codex review):** [REQUIREMENTS.md](REQUIREMENTS.md)

> **Status: Step 0 — Foundation & tooling.** This is the green skeleton; product features land in
> Steps 1–6. See [Step 0 scope notes](#step-0-scope-notes) for what is intentionally deferred.

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

| Command         | What it does                                     | Gate |
| --------------- | ------------------------------------------------ | ---- |
| `pnpm dev`      | Run the app in dev mode                          | —    |
| `pnpm build`    | Production build (adapter-node)                  | ✅   |
| `pnpm preview`  | Serve the production build                       | —    |
| `pnpm check`    | `svelte-kit sync` + `svelte-check` (typecheck)   | ✅   |
| `pnpm lint`     | `prettier --check` + `eslint`                    | ✅   |
| `pnpm format`   | Auto-format with Prettier                        | —    |
| `pnpm test`     | Unit tests (Vitest)                              | ✅   |
| `pnpm test:e2e` | End-to-end smoke (Playwright; builds + previews) | ✅   |

**Reproduce the full green build** (what CI does — see [.github/workflows/ci.yml](.github/workflows/ci.yml)):

```bash
pnpm install
pnpm lint && pnpm check && pnpm test && pnpm build
pnpm exec playwright install chromium   # first run only
pnpm test:e2e
```

## Local database (Step 1+)

```bash
supabase start             # boots Postgres + Auth + Storage in Docker, applies migrations
supabase db reset          # re-apply migrations + seed.sql
```

`supabase start` prints the local `anon` and `service_role` keys — copy them into `.env`.

## Project structure

```
src/
  app.css               Tailwind + theme tokens + reduced-motion safety net
  routes/               SvelteKit routes (home gallery for now)
  lib/
    a11y/               reduced-motion store (accessibility plumbing)
    server/             server-ONLY code (service-role key lives here; never client-bundled)
    ui/                 shadcn-svelte components (added on demand)
    editor/             Wix-like authoring canvas        (Step 3)
    zine/
      schema/           Zod document schema + types      (Step 2)
      blocks/           one folder per block type        (Step 2)
      animations/       one folder per animation preset  (Step 4)
      render/           ZineRenderer (document → page)   (Step 2)
      theme/            theme tokens                     (Step 2)
      registry.ts       the block + animation registries (the only extension points)
supabase/               config, migrations, seed
tests/
  unit/                 Vitest specs not colocated with source (e.g. the secret-guard)
  e2e/                  Playwright specs
```

## Conventions enforced from Step 0

- **Secret-guard:** the Supabase service-role key may appear only under `src/lib/server/**`.
  [`tests/unit/no-service-role-leak.test.ts`](tests/unit/no-service-role-leak.test.ts) fails CI if it
  leaks elsewhere; SvelteKit also refuses to bundle `$lib/server` into the client.
- **Reduced motion:** [`src/lib/a11y/reduced-motion.ts`](src/lib/a11y/reduced-motion.ts) plus a global
  CSS fallback in `app.css`. Every animation added later must honor it.
- **Extensibility:** new blocks/animations register in `src/lib/zine/registry.ts` — no edits to the
  core renderer/editor. (Contracts in [IMPLEMENTATION_PLAN.md §2](IMPLEMENTATION_PLAN.md).)

## Step 0 scope notes

Deliberate, documented deviations so review is judged against intent, not guesswork:

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
