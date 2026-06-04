# Best-Practices Library — Pudding-style scrollytelling, for AI implementers

**Audience: Claude, Codex, and other AI agents implementing the Zine tool.** These documents
translate The Pudding's hard-won, empirically-grounded process knowledge into **normative, specific
design recommendations** for _this_ codebase (SvelteKit + the declarative animation system in
[ARCHITECTURE.md](../../ARCHITECTURE.md)). They are reference material: read the relevant one before
implementing a feature it covers, and treat its rules as defaults you must have a stated reason to break.

These are not a summary "for humans to enjoy." They are written to be **acted on by a model**: rules
first, rationale second, copy-pasteable patterns third, failure modes called out explicitly.

---

## How to read these (conventions)

Every rule uses RFC-2119-style force. Obey it literally.

| Word         | Meaning                                                                  |
| ------------ | ------------------------------------------------------------------------ |
| **MUST**     | Non-negotiable. Violating it is a bug / review blocker.                  |
| **MUST NOT** | Forbidden. Do not do this even if it "works."                            |
| **SHOULD**   | Strong default. Deviate only with an explicit, written reason in the PR. |
| **AVOID**    | Strong anti-pattern. Reach for the named alternative instead.            |
| **MAY**      | Genuinely optional.                                                      |

Each rule block follows the same shape so you can parse it:

> **Rule** (the imperative) — **Why** (the reason, usually an empirical Pudding finding) —
> **Pattern** (the concrete code/structure to write in our stack) — **Gotcha** (the specific way it
> breaks if you do it naively).

When a doc says **"Maps to flan-zines,"** it is telling you exactly which preset, registry entry,
route, or Step (per [IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md)) the guidance governs.

---

## The documents

| Doc                                                                | Read it when you are…                                                                      | Governs                                                           |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| **[scrollytelling.md](scrollytelling.md)**                         | Building any scroll-driven motion: `sticky-steps`, `pin-horizontal`, `scroll-zoom`         | The animation system (Step 4), the renderer's scroll wiring       |
| **[responsive-and-performance.md](responsive-and-performance.md)** | Making anything work on a Chromebook / phone, or touching resize, viewport, or scroll perf | C4 performance budgets, C2 reduced-motion, mobile fallbacks       |
| **[data-viz-and-charts.md](data-viz-and-charts.md)**               | Implementing the `dataViz` / chart blocks, or choosing DOM vs SVG vs Canvas                | Chart blocks (Step 4b), `flockingCanvas`, dataViz presets         |
| **[editorial-process.md](editorial-process.md)**                   | Designing templates, the editor outline, teacher review, or student guidance               | Templates & onboarding (Step 3), the publish/review gate (Step 6) |

---

## The non-negotiable through-line

Every one of these documents converges on the same four invariants. If a recommendation below ever
seems to conflict with one of these, **the invariant wins**:

1. **Monitor scroll; never hijack it.** Scrollytelling reacts to the user's scroll. Scrolljacking
   (overriding scroll speed/position) is forbidden — it is a performance _and_ accessibility failure.
2. **Motion is enhancement, never the only channel.** Every animated story MUST be fully
   understandable with motion off (`prefers-reduced-motion`) and in plain source order.
3. **Separate `setup` from `draw` from `resize`.** Anything scroll- or size-driven is built once,
   redrawn cheaply on change, and never rebuilt from scratch on every frame.
4. **Lean on the platform.** Prefer `position: sticky` over JS sticky, `IntersectionObserver` over
   scroll listeners, and CSS layout (Flexbox) over hand-computed pixel math — less code, fewer bugs,
   better performance on weak hardware.

---

## Source material (The Pudding "Process" articles)

These docs distill, and cite back to, the following. Citations in each doc use the short keys below.

| Key                 | Article                                                      | Author(s)                                  |
| ------------------- | ------------------------------------------------------------ | ------------------------------------------ |
| **[SIX-LIBS]**      | How to implement scrollytelling with six different libraries | Russell Samora (Jan 2017)                  |
| **[RESPONSIVE]**    | Responsive scrollytelling best practices                     | Russell Samora (Apr 2017)                  |
| **[PIVOT-SCATTER]** | The Making of the Weighted Pivot Scatter Plot                | Russell Samora (May 2017)                  |
| **[RESIZE]**        | How Many Users Resize Their Browser?                         | Russell Samora (Aug 2017)                  |
| **[SCROLLAMA]**     | An Introduction to Scrollama.js                              | Russell Samora (Nov 2017)                  |
| **[STICKY]**        | Easier scrollytelling with position sticky                   | Elaina Natario & Russell Samora (Jun 2018) |
| **[NO-SVG]**        | Making Data Viz Without SVG Using D3 & Flexbox               | Amber Thomas (Jul 2018)                    |
| **[NO-CODE]**       | How to recreate our charts without code                      | Jan Diehm                                  |
| **[PIVOT]**         | Continue, Pivot, or Put It Down                              | Amber Thomas (Aug 2020)                    |
