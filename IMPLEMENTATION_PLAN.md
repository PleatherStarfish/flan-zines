# Zine — Implementation Plan (SvelteKit)

How we build the tool described in [ARCHITECTURE.md](ARCHITECTURE.md), with a **Codex review gate at
every step**. Pair this with [REQUIREMENTS.md](REQUIREMENTS.md) — that file is the rubric Codex grades
against; this file is the sequence of work and the per-step acceptance criteria.

> **Authority note:** Where this plan and ARCHITECTURE.md disagree on stack specifics, this plan wins
> (the frontend is **SvelteKit**, not React). ARCHITECTURE.md §3/§5/§16 have been updated to match.

---

## 0. How to use this document

### The working agreement

- **One Step = one branch = one PR.** Steps are sequenced; don't start N+1 before N is merged.
- Every PR must pass **CI gates** (automated) **and** a **Codex review** (against the Step's
  _Done when_ list + the global invariants in REQUIREMENTS.md).
- The **Definition of Done** (§5) applies to _every_ step on top of its specific criteria.

### The Codex review loop (run on every PR)

Give Codex three inputs — the **PR diff**, this plan's **Step N** section, and **REQUIREMENTS.md** —
with this prompt:

```
You are the reviewer for Step N of the Zine project. Do not write features; evaluate.
Inputs: the PR diff, IMPLEMENTATION_PLAN.md (Step N), REQUIREMENTS.md.

Produce a checklist with PASS / FAIL / N-A and file:line evidence for:
  1. Every "Done when" criterion in Step N.
  2. Every Global Invariant in REQUIREMENTS.md §B that this diff touches
     (security/RLS, child-safety, accessibility, reduced-motion, schema-driven,
      performance budgets, extensibility, privacy).
  3. The shared Definition of Done (IMPLEMENTATION_PLAN §5): lint, typecheck,
     unit, component, e2e, build all green; no secrets; no service-role key in
     client code; docs updated.
  4. No regression to earlier steps' criteria.

Classify each finding as BLOCKING or SUGGESTION. Treat security, child-safety,
data-loss, and critical-a11y findings as BLOCKING regardless of severity wording.
End with an overall GO / NO-GO and the shortest list of required changes.
Cite code; do not approve on vibes.
```

A Step is "done" only when CI is green **and** Codex returns **GO**.

---

## 1. Starter kit & libraries (don't build what we can borrow)

**Scaffold once** with the official SvelteKit setup, then layer on the picks below:

```bash
pnpm dlx sv create zine        # TypeScript, ESLint, Prettier, Vitest, Playwright, Tailwind
pnpm dlx shadcn-svelte init     # accessible UI primitives (Bits UI + Tailwind) we own
pnpm dlx supabase init          # local Postgres + Auth + Storage via Docker, migrations
```

| Need              | Library / kit                                                         | What it saves us from building                                     |
| ----------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| App framework     | **SvelteKit** (`sv create`)                                           | Routing, SSR/SSG/ISR, form actions, endpoints                      |
| UI components     | **shadcn-svelte** (Bits UI + **Melt UI** headless + Tailwind)         | Accessible dialogs, dropdowns, popovers, sliders for the inspector |
| Backend           | **Supabase** (CLI for local)                                          | Auth/SSO, Postgres, Storage, row-level security, instant APIs      |
| Auth glue         | **`@supabase/ssr`**                                                   | SvelteKit session/cookie handling                                  |
| Validation        | **Zod**                                                               | The document schema contract (one source of truth)                 |
| Drag & drop       | **`svelte-dnd-action`**                                               | Editor canvas/palette/layers reordering                            |
| Rich text         | **TipTap** (`svelte-tiptap`, ProseMirror)                             | Headings/links/lists as structured JSON                            |
| Immutable edits   | **Immer**                                                             | Undo/redo via patches, clean autosave diffs                        |
| Scroll core       | **GSAP + ScrollTrigger**                                              | Pin, scrub, horizontal scroll, timelines                           |
| Scroll steps      | **Scrollama**                                                         | Sticky-graphic scrollytelling triggers                             |
| Smooth scroll     | **Lenis**                                                             | Buttery parallax (gated by reduced-motion)                         |
| Dataviz           | **D3**                                                                | Scroll-scrubbed / zooming charts                                   |
| 3D / flocking     | **Threlte** (`@threlte/core`, Three.js)                               | Declarative boids/particles in Svelte                              |
| Vector anim       | **lottie-web**                                                        | Designer animations as small JSON                                  |
| Media             | **Cloudinary** (or Supabase Storage + transforms)                     | Resize/format (AVIF/WebP), upload widget                           |
| Testing           | **Vitest**, **@testing-library/svelte**, **Playwright**, **axe-core** | Unit/component/e2e/a11y                                            |
| Component catalog | **Storybook (Svelte)**                                                | Block development surface + visual review                          |
| Hosting           | **Vercel** (`adapter-vercel`, ISR)                                    | Static published pages + revalidation                              |
| CI                | **GitHub Actions**                                                    | The automated gates Codex relies on                                |

> Parallax and simple enter/exit motion use **Svelte's built-in** `svelte/motion` + `svelte/transition`
> — no Framer Motion needed. R3F → **Threlte**. Everything else (GSAP, Scrollama, D3, Lottie, Lenis)
> is framework-agnostic and carries over unchanged.

### Repo layout (the boundaries that make it extensible)

```
src/lib/zine/
  schema/      # Zod document schema + versioned migrations  ← the contract
  blocks/      # one folder per block: schema.ts, Render.svelte, Inspector.svelte, index.ts
  animations/  # one folder per preset: schema.ts, impl (lazy), reduced-motion fallback
  registry.ts  # block + animation registries  ← the ONLY place core knows about extensions
  render/      # ZineRenderer.svelte (document → page), shared by editor preview AND reader
  theme/       # theme tokens as data
src/lib/editor/  # canvas, palette, inspector host, layers, document store (undo/redo, autosave)
src/lib/server/  # supabase clients, auth guards, publish service, moderation hooks
src/lib/ui/      # shadcn-svelte components
src/routes/
  (marketing)/         # / homepage gallery        (prerender/ISR)
  z/[user]/[slug]/     # public zine               (ISR)
  app/                 # authed editor             (SSR/CSR)
supabase/migrations/   # SQL + RLS policies        supabase/seed.sql
tests/e2e/             # Playwright       .storybook/      .github/workflows/
```

---

## 2. Extensibility contracts (enforced, not aspirational)

Two registries are the **only** extension points. Adding a feature must not require editing the core
renderer or editor — Codex checks this on every relevant PR.

```ts
// A block = one module satisfying this. Register it; the editor, validator, and reader all adapt.
export interface BlockDef<P> {
	type: string;
	category: 'text' | 'media' | 'structure' | 'interactive';
	schema: ZodType<P>; // validates props at save/publish/render
	defaults: P;
	allowedAnimations: AnimationType[]; // which presets this block may use
	Render: Component<{ props: P; animation?: AnimationDescriptor }>;
	Inspector: Component<{ value: P; onChange: (p: P) => void }>;
	requiredForPublish?: (p: P) => string[]; // e.g. ["Image needs alt text"] — a11y gate
}

// An animation preset = one module. `load()` is lazy so heavy libs are code-split.
export interface AnimationDef<Params> {
	type: string;
	label: string; // student-facing name
	schema: ZodType<Params>;
	defaults: Params;
	load: () => Promise<AnimationImpl<Params>>; // dynamic import → not in base bundle
	reducedMotion: 'static' | 'still-frame' | 'passthrough'; // mandatory fallback
}
```

**Document = data.** `ZineDocument` (sections → blocks → animation descriptors) is a Zod schema with a
`schemaVersion` and forward migrations. The editor produces it; `ZineRenderer` consumes it; both share
the same block `Render` components, so author ≡ published.

---

## 3. Testing strategy

| Layer               | Tool                                                         | Covers                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema / unit       | Vitest + Zod                                                 | Document validates; migrations are lossless; **registry integrity** (every block's `defaults` pass its `schema`; every `allowedAnimations` exists; every animation has a reduced-motion fallback)  |
| Component           | @testing-library/svelte + **axe-core**                       | Each block renders; inspector edits mutate the doc; alt-text/heading a11y rules; no critical axe violations                                                                                        |
| Store / integration | Vitest                                                       | add/move/delete/**undo/redo**; autosave debounce; publish snapshot is immutable                                                                                                                    |
| E2E                 | Playwright                                                   | sign-in → create → add blocks → set animation → autosave → publish → public page → gallery; **RLS** (user A cannot open/edit user B's draft); **reduced-motion** degrades; keyboard-only authoring |
| Visual / motion     | Playwright screenshots (scroll seeked to fixed positions)    | Smoke-check each animation preset deterministically                                                                                                                                                |
| Perf                | Lighthouse CI on a sample zine (mid-tier Chromebook profile) | Core Web Vitals + base-JS budget (REQUIREMENTS §B)                                                                                                                                                 |

CI runs `lint → typecheck (svelte-check) → unit → component → e2e → build → lighthouse` on every PR.
Coverage target: **≥80%** on `src/lib/zine/**` (the contract code), pragmatic elsewhere.

---

## 4. The steps

Seven steps (0–6). Each is a self-contained, reviewable increment.

### Step 0 — Foundation & tooling

**Goal:** a green skeleton with every gate wired, so reviews are automatic from here on.
**Build:** scaffold (`sv create` + shadcn-svelte + supabase init); repo layout from §1; Tailwind +
theme tokens; global `prefers-reduced-motion` plumbing stub; ESLint rule/test forbidding
service-role key imports outside `src/lib/server`; GitHub Actions CI; README run steps; Storybook boots.
**Done when:**

- `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm test:e2e`, `pnpm check`, `pnpm lint` all succeed.
- `supabase start` runs Postgres locally; an empty initial migration applies.
- CI is green on the PR; no secrets committed; `.env.example` documents required vars.
  **Tests:** one trivial unit + one Playwright smoke (home route renders).
  **Codex checks:** folder structure matches §1; CI actually gates (fails on a broken test); reduced-motion
  plumbing present; secret-guard rule works; README reproduces the green build.

### Step 1 — Data model, Auth, RLS _(security-critical)_

**Goal:** real accounts and ironclad ownership.
**Build:** migrations for `users/roles, classes/class_members, zines, zine_drafts, zine_versions,
assets, moderation_items, reports` (per ARCHITECTURE §8); **RLS policies** (deny-by-default; owner +
owner's teacher can write; published reads public); seed script; Supabase Auth with **Google OAuth**
(magic-link in local dev) via `@supabase/ssr`; session in SvelteKit hooks; protected `/app`; role helper;
"My Zines" list (empty state).
**Done when:**

- A seeded student can sign in and see only their own zines.
- RLS **denies** cross-user read/write of drafts (proven by test, not inspection).
- No service-role key reaches the client bundle.
  **Tests:** RLS e2e (user A blocked from user B's draft, both directions); auth happy-path e2e; migration
  apply/rollback unit.
  **Codex checks:** every new table has an explicit RLS policy + a deny test; authz is at the DB, not just
  UI; OAuth secrets server-only; roles enforced; migrations reversible.

### Step 2 — Document schema, block registry, read-only renderer

**Goal:** the content contract and a page that renders from JSON.
**Build:** `ZineDocument` Zod schema (sections/blocks/animation descriptors, `schemaVersion`, migration
scaffold); the **BlockDef registry**; core blocks — `heading, richText (TipTap, links), image (required
alt), link/button, divider, spacer`; `ZineRenderer.svelte`; render a fixture document on `z/[user]/[slug]`
(static for now); Storybook stories per block.
**Done when:**

- A fixture zine renders as a semantic, accessible page (proper heading levels, alt text).
- Registry-integrity test passes; an invalid document is rejected with a clear error.
- Adding a block is documented and demonstrated by the 6 core blocks.
  **Tests:** schema/migration unit; registry integrity; per-block component + axe; renderer SSR snapshot.
  **Codex checks:** renderer reads only the registry (no hard-coded block list); schema is the single source
  of truth; a11y clean; document/render separation intact (renderer has no editor imports).

### Step 3 — Editor core (the Wix-like tool)

**Goal:** author a zine end-to-end, safely autosaved.
**Build:** editor canvas; block palette (drag in) and **layers** panel (reorder) via `svelte-dnd-action`;
selection → registry-driven **Inspector** (content + style); document **store** with **undo/redo** (Immer
patches); **debounced autosave** to `zine_drafts` (optimistic, "Saved ✓"); **Edit/Preview toggle** (Edit =
static); responsive width preview; load/persist round-trip.
**Done when:**

- Create → edit → reload preserves the document exactly.
- Undo/redo and add/move/delete behave correctly; autosave debounces and recovers from failure.
- Image inspector **blocks missing alt text**; editor is keyboard-operable.
  **Tests:** store-ops unit (incl. undo/redo); autosave debounce/optimistic unit; full authoring e2e;
  keyboard-only e2e.
  **Codex checks:** no data-loss paths (interrupt mid-save → no corruption); inspector writes validate
  against block schema; editor depends on registry, not concrete blocks; a11y of editor chrome.

### Step 4 — Animation system & "fancy" blocks _(the differentiator)_

**Goal:** Pudding-style motion, configurable without code, accessible and performant.
**Build (4a — framework):** **AnimationDef registry** + `use:animate` wrapper; presets `parallax`
(Svelte motion), `appear-on-scroll` (Scrollama), `sticky-steps` (Scrollama), `pin-horizontal` /
side-scroll (GSAP), `scroll-zoom` (GSAP); **lazy `load()` per preset** (code-split); global
**reduced-motion** degrade; IntersectionObserver mount/unmount; transform/opacity-only; animation
controls in the Inspector limited to the block's `allowedAnimations`; Preview plays real motion.
**Build (4b — heavy blocks):** `dataViz` (D3 scroll-scrubbed / zoom-from-side), `flockingCanvas`
(Threlte boids), `lottie`, `gallery`/`embed`; per-preset FPS caps; mobile/low-power fallbacks.
**Done when:**

- All listed presets work in Preview and on the public page and are configurable from the inspector.
- `prefers-reduced-motion` turns every preset into its declared fallback (proven by e2e).
- A text-only zine's base bundle excludes GSAP/Three.js/D3 (proven from the build report).
  **Tests:** per-preset params-schema unit; reduced-motion e2e; deterministic visual screenshots; bundle-
  split assertion; WebGL mount/unmount integration.
  **Codex checks:** every preset has params schema + lazy loader + reduced-motion fallback; heavy libs
  absent from base chunk; FPS caps present; WebGL canvases unmount off-screen; new preset added via
  registry only.

### Step 5 — Publish pipeline & public gallery

**Goal:** safe, fast, shareable published zines.
**Build:** publish service (validate → snapshot to `zine_versions` → set status → **ISR revalidate**);
draft↔published separation; public zine route (ISR, **OpenGraph**); homepage **gallery** (published only,
featured row, search/filter); share links.
**Done when:**

- Publishing a zine makes it appear at a stable public URL and on the homepage.
- Editing the draft afterward does **not** change the live page until re-published.
- Drafts/unpublished never appear publicly; published pages are statically cached.
- Lighthouse budget met on a sample zine (REQUIREMENTS §B Performance).
  **Tests:** publish-snapshot immutability unit; draft-vs-live e2e; "draft never public" e2e; gallery-
  filter e2e; Lighthouse CI.
  **Codex checks:** snapshot immutable; visibility tiers enforced server-side (not just hidden in UI);
  public routes cacheable/static; OG tags present.

### Step 6 — Safety, moderation, teacher tools & a11y hardening _(school-readiness)_

**Goal:** ship-to-a-classroom safe and accessible.
**Build:** **teacher dashboard** (class roster via join code; review/approve **publish queue**); image
**moderation** hook (SafeSearch → quarantine); **report** button on public pages; visibility tiers
(`draft → in_review → published/unlisted`) enforced; full **a11y audit** pass (axe across flows,
keyboard, contrast in theme picker); admin runbook (Supabase Studio / optional Directus or AdminJS).
**Done when:**

- With class approval-required on, a student **cannot** make a zine public without teacher approval.
- Uploaded images are screened; flagged assets quarantined; report routes to teacher/admin.
- Accessibility audit is clean (no critical/serious axe issues) across the core flows.
  **Tests:** approval-gate e2e (bypass attempt fails server-side); moderation-quarantine integration;
  report-flow e2e; full a11y sweep; reduced-motion regression.
  **Codex checks:** approval/visibility enforced at the server/DB, not the client; moderation can't be
  skipped; no minor PII leaked to third parties/trackers; a11y AA across flows.

---

## 5. Definition of Done (applies to **every** step)

- [ ] `lint`, `check` (svelte-check), `unit`, `component`, `e2e`, `build` green in CI.
- [ ] No secrets committed; **service-role key never imported outside `src/lib/server`** (lint+test enforced).
- [ ] New/changed UI passes **axe** (no critical/serious) and is keyboard-operable.
- [ ] Any animation respects **`prefers-reduced-motion`** with a declared fallback.
- [ ] **RLS not weakened**; new tables ship with policies + a deny-by-default test.
- [ ] Draft/published separation preserved; nothing unpublished is reachable publicly.
- [ ] Document-shape changes include a **migration + `schemaVersion` bump**.
- [ ] New block/animation = **registry entry + Storybook story + tests**, with **no edits to core
      renderer/editor internals**.
- [ ] README/docs updated; REQUIREMENTS traceability updated if scope shifted.
- [ ] **Codex returns GO.**

---

## 6. Extensibility playbook (for contributors & Codex)

- **Add a block:** create `src/lib/zine/blocks/<type>/` with `schema.ts`, `Render.svelte`,
  `Inspector.svelte`, `index.ts` (the `BlockDef`); register it; add a story + tests. Nothing else changes.
- **Add an animation preset:** create `src/lib/zine/animations/<type>/` with `schema.ts`, a lazily
  `load()`-ed impl, and a **reduced-motion fallback**; register the `AnimationDef`; list it in the
  relevant blocks' `allowedAnimations`; add a deterministic visual test.
- **Add a theme:** add tokens under `theme/`; no code changes.
- **Golden rule Codex enforces:** if a feature required editing `render/ZineRenderer.svelte` or the
  editor core to special-case a type, it's **NO-GO** — it belongs behind a registry.
