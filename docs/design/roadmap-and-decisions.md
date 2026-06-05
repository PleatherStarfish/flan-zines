# Roadmap & decision log

The MVP cut line, the sequence, the cross-cutting gaps not captured by any numbered step, and the
**decision log** for the Pudding research (what we adopted, held, and rejected, with reasons). Status
tags per the [legend](README.md#decision-status-legend-used-throughout).

---

## 1. The MVP bar

> sign in → create a zine → author with blocks (+ light motion) → submit → **teacher approves** →
> stable public URL + appears on the gallery → reader views it (works on a Chromebook, motion-off safe).

For minors publishing publicly, the **safety floor is non-negotiable**: nothing reaches the public web
without a teacher gate; a report path exists; media is controlled.

## 2. The cut line (remaining work, re-scoped to MVP)

| Plan step                                               | MVP slice (in)                                                                                                       | Deferred (post-MVP)                                                                                  |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **3 — Editor**                                          | All of it ([editor.md](editor.md)) — the long pole                                                                   | —                                                                                                    |
| **Media upload** _(hidden long pole, cross-cuts 3/5/6)_ | Upload + Storage RLS, gated so images go public only via teacher approval                                            | Automated SafeSearch, image transforms/AVIF                                                          |
| **4 — Animations**                                      | `fade-up`, `parallax`, `sticky-steps` + inspector + reduced-motion                                                   | `pin-horizontal`, `scroll-zoom`, `dataViz` (LayerCake), `flockingCanvas` (Threlte), `lottie`, embeds |
| **5 — Publish + gallery**                               | Publish service, wire `/z/*` to the published snapshot, **static/ISR public route**, basic gallery, slug, share link | Search/filter/featured, polished OG cards, advanced CDN tuning                                       |
| **6 — Safety**                                          | **Teacher-approval gate (server-enforced) + report button + minimal review queue**                                   | Auto-moderation, full teacher dashboard, admin runbook, analytics                                    |
| **Deploy/ops** _(not a numbered step)_                  | Hosted Supabase, Google SSO (domain-restricted), a real deploy                                                       | Vercel ISR adapter, Sentry, district SSO                                                             |

## 3. Sequencing

1. **Editor (Step 3)** — gate to everything; the riskiest, ~half the remaining effort.
2. **Publish + gallery + the safety gate, _together_ (Step 5 + Step 6 subset)** — you cannot ship
   publish _without_ the teacher gate for minors, and published reads must stay static/ISR with no
   per-request draft DB calls; they are one increment.
3. **Animations-lite (Step 4a)** — `fade-up`/`parallax`/`sticky-steps` behind the `BlockFrame` seam.
4. **Media upload** lands with the editor's image inspector, governed by the approval gate.
5. **Deploy/ops + rostering** — small but blocking; before students arrive, not after.

## 4. Cross-cutting missing pieces (not owned by any numbered step)

- **The Inspector half of `BlockDef`** — Step 2 shipped only `Render`; Step 3 adds `Inspector`
  ([data-model.md §5](data-model.md#5-the-block-contract-blockdef)).
- **Media upload + Storage RLS** — the `assets` table exists but is unwired; the image block takes a raw
  `src` today.
- **Zine create/delete/rename + slug + cover** — "My Zines" lists zines but "New zine" is a disabled stub.
- **Rostering / onboarding** — Step 1 locked `class_members` inserts to teacher/admin (so a guessed class
  id can't leak a join code); students can't self-enroll yet. MVP needs either a teacher "add student"
  UI or the validated join-code `SECURITY DEFINER` RPC. **Don't let a pilot stall on this.**
- **Public route → published snapshot** — `/z/[user]/[slug]` renders a fixture; Step 5 wires it to the
  immutable published snapshot and serves it static/ISR. The public read path must not query drafts.
- **Deploy/config** — hosted Supabase project, Google OAuth creds + domain restriction, a deploy target.

---

## 5. Pudding research — decision log

Source: the deep-research report on pudding.cool structure + the accompanying Story-engine analysis. Its
punchline — _"a typed story grammar with a component registry, then custom components only inside
well-defined boundaries"_ — **is our architecture**; that is strong external validation. We diverge where
our audience (11–16 writing students) and our safety obligations differ from a pro editorial shop.

### ⭐ Reversal (post Step-3 review): adopt Story → Act → Scene → Beat + a scene timeline

After building the Step-3 three-pane editor, it was judged **wrong for ages 11–16** (it asks a child to
think like a developer) and it buried the product's whole point — motion. We **reversed** two earlier
"held" decisions:

- **Embrace the four-level hierarchy** `Story → Act → Scene → Beat → Element` (schemaVersion **v3**).
- **A Scene is a unit of scroll, authored on a timeline** — students drag content/effect "clips" along a
  scroll axis and scrub to preview. See **[scene-timeline.md](scene-timeline.md)** (now the primary
  target doc).

**Why the reversal is consistent, not a flip-flop:** the original concern was that the richer hierarchy
would _overwhelm_ young students. The timeline metaphor (which they know from iMovie/CapCut) plus
**picture-based funnels** make the richer model _more_ approachable, not less — while the safety
boundaries (curated effects, no student code, registry-only extension, RLS, reduced-motion, content-
first) are **all preserved**. Blocks are reused as Element content; the store/autosave/registry from
Step 3 carry forward.

### Confirmed (held, now with evidence)

Declarative document + registries + bounded extensibility · animations-as-**state** not timelines ·
author ≡ published · curated themes + **self-hosted** fonts (token discipline) · static/ISR publishing ·
a11y + reduced-motion as a contract · **in-app editor over ArchieML/Google-Docs** and **registry
dev-extended only** (our authors are students — the report explicitly says a broad platform must "turn
implicit craft into explicit guardrails").

### Adopted (genuine refinements — folded into the data model)

| #   | Adoption                                                                                                        | Where it lives                                                                                         | Status               |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------- |
| 1   | **Full-state-per-step** — scrolly steps each carry a _complete_ figure state, on the step (no dangling id-list) | [data-model.md §4](data-model.md#4-the-scrolly-model--full-state-per-step-the-most-important-decision) | [RESERVED Step 4]    |
| 2   | **Triggers as a typed concept** (`scroll` MVP; tap/time/enter-view later)                                       | `AnimationDescriptor.trigger`                                                                          | [RESERVED Step 4]    |
| 3   | **`dataSources` tier** — charts reference a named dataset; big data processed server-side                       | [data-model.md §8](data-model.md#8-assets--data-sources)                                               | [RESERVED Step 4b]   |
| 4   | **`sources`/methods section** — teaches citation, matches Pudding's trust end-matter                            | `Section.kind:'sources'`                                                                               | [COMMITTED Step 3]   |
| 5   | **a11y as an explicit contract field** (`a11yFallback`, mandatory `reducedMotion`)                              | [data-model.md §5](data-model.md#5-the-block-contract-blockdef)                                        | [COMMITTED/RESERVED] |
| 6   | **Name the 4 shapes; MVP = linear scrolly essay**; diary/progress is the likely next                            | §7 below                                                                                               | [COMMITTED scope]    |

### Held against the research's pull (deliberate, for our audience)

| Research proposes                             | We hold                                        | Why                                                                                  |
| --------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| ~~Story→Act→Scene→Beat (3–4 levels)~~         | **REVERSED → now adopted as v3** (see above)   | The timeline + funnels make the richer model _more_ approachable for this age        |
| ~15 scene kinds, 7 motion tracks              | **~6 blocks, ~5 scene types, curated effects** | Progressive disclosure; the long tail lands via the registry _when a class needs it_ |
| App-level `modes`/`uiState`, branching graphs | **No modes/branching in MVP**                  | They power explorer/collection/diary; the linear essay doesn't need them             |
| ArchieML + Google Docs copy pipeline          | **In-app TipTap editing**                      | Our authors are students, not journalists                                            |
| Per-story custom Svelte components            | **Registry, dev-extended only**                | A student custom-code hatch is an unacceptable safety/maintenance surface for minors |

## 6. Stack deltas from the research

- **Charts: LayerCake (+ D3 scales), not raw D3** — Svelte-native, declarative, far more maintainable for
  a student-facing block; it's what Pudding's recent repos use. [RESERVED Step 4b]
- **Lean on CSS `position: sticky` + Svelte state + IntersectionObserver; reserve GSAP for genuinely
  scrubbed presets only** (`pin-horizontal`/`scroll-zoom`) — the newest Pudding work ships no Scrollama
  and no GSAP. Shrinks the base animation weight on Chromebooks. [RESERVED Step 4]
- **Runed** for the editor/renderer's runtime viewport utilities (resize/in-view) instead of hand-rolling.
  [COMMITTED Step 3]
- **Self-hosted fonts (`@fontsource`)**, dynamically imported per pairing. [COMMITTED Step 3]
- **Immer + named intents** for undo/redo (not event-sourcing). [COMMITTED Step 3]

## 7. The four Pudding story shapes

| Shape                                    | Example                       | Our support                                                                                    |
| ---------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------- |
| **Linear scrolly essay**                 | `pockets`, `foundation-names` | **MVP** — prose/feature/split/scrolly sections                                                 |
| Diary / chapter stack + global progress  | `walkachusetts`               | **Next** — simplest deferred shape (sections + a progress affordance); great writing-class fit |
| Guided explorer (modes, language, audio) | `cdmx`                        | Deferred — needs an app-level `mode`/`uiState` layer                                           |
| Collection → playable detail             | `abortion-mazes`              | Deferred — needs item catalog + selection/play state                                           |

The model **reserves** the path to the deferred shapes (a future top-level `mode`/`uiState` + section
visibility by mode) without retrofitting them into the MVP editor.

---

## 8. Open questions / risks to revisit

- **Editor build-vs-buy** — no Svelte page-builder exists; the canvas/inspector/dnd are hand-built. The
  schedule and UX risk. Validate the "edit static / preview motion" model with real students early.
- **Media for minors** — the highest-risk surface; the gated-upload-behind-approval stance (not automated
  SafeSearch) is an MVP cost/latency/DPA trade-off to revisit at scale.
- **Per-step `state` ergonomics (Step 4)** — authoring full figure states per step must stay simple for
  students; the figure `stateSchema` + a state inspector is the open UX problem.
- **`dataSources` for 11–16** — do students upload CSVs, or do we ship curated datasets first? Likely
  curated-first.
- **Diary-shape progress affordance** — when we add shape #2, decide whether progress is a section-derived
  computation or stored state.
