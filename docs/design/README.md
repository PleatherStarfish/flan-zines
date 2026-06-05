# Design contract

**Audience: Claude, Codex, and the team.** This directory is the **authoritative, detailed design of
the Zine tool** — the decisions that the build must honor and that reviews are judged against. It is
written to be _acted on by a model_: normative where it is a contract, with the rationale and the
rejected alternatives recorded so nothing is re-litigated by accident.

It complements, and where noted supersedes, the higher-level docs:

| Doc                                                    | Role                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| [ARCHITECTURE.md](../../ARCHITECTURE.md)               | The original vision + system overview (high level)                       |
| [IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md) | The build sequence + per-step gates (the "when")                         |
| [REQUIREMENTS.md](../../REQUIREMENTS.md)               | The acceptance rubric Codex grades against (the "what correct is")       |
| [docs/best-practices/](../best-practices/README.md)    | Pudding-derived _implementation_ rules (scroll, perf, charts, editorial) |
| **docs/design/ (this set)**                            | The **detailed design contract** (data model, editor, pedagogy, roadmap) |

Where this set and ARCHITECTURE.md disagree on a specific (e.g. the v2 data model vs ARCHITECTURE §4),
**this set wins** and says so explicitly.

---

## How to read this set

| Doc                                                      | Covers                                                                                                                                                                                              |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[scene-timeline.md](scene-timeline.md)** ⭐            | **The current target** — the v3 model (Story → Act → Scene → Beat → Element), the **scene-as-timeline editor**, the effects catalog, the funnels, the Story-Map IA. Read this first.                |
| **[data-model.md](data-model.md)**                       | The data contract — the block contract (reused as Element content), theme/typography, assets, validation. Its Document→Section model is **v2 (the implemented foundation)**; v3 supersedes it.      |
| **[editor.md](editor.md)**                               | The editor's **reused foundations** — state store, Immer undo/redo, decorate-the-renderer, the Inspector contract, autosave/data-loss. Its three-pane UI is superseded by the Story Map + timeline. |
| **[pedagogy.md](pedagogy.md)**                           | The ages-11–16 design philosophy — content-first, progressive disclosure, constrain-to-teach, accessibility-as-teaching, vocabulary, editor IA.                                                     |
| **[roadmap-and-decisions.md](roadmap-and-decisions.md)** | The MVP cut line, sequencing, cross-cutting missing pieces, and the decision log (incl. the **v3 / Story→Act→Scene→Beat reversal**).                                                                |

> **Model status:** the codebase is at **v2** (Document → Section → Block; Steps 0–3 implemented). The
> **target is v3** (Story → Act → Scene → Beat → Element) per [scene-timeline.md](scene-timeline.md).
> The **block contract carries forward unchanged** as Element content; Document→Section is migrated to
> Story→Act→Scene; the editor's store/autosave/registry are reused, its UI re-shaped.

### Decision-status legend (used throughout)

Every design element carries one of these so a reviewer can verify it against the code:

- **[IMPLEMENTED]** — in the codebase today (Steps 0–3: auth/RLS, the v2 block/document model, the
  read-only renderer, and the Step-3 editor foundations — store, autosave, inspector).
- **[COMMITTED]** — the current target; specified here and built next (the v3 model + scene timeline).
- **[RESERVED]** — a named slot in the model now; implemented later (heavy effects, data scenes).
- **[REJECTED]** — considered and deliberately excluded; the "why" is recorded so it stays excluded.

---

## The invariants this contract must never violate

These are the non-negotiables from [REQUIREMENTS.md §B](../../REQUIREMENTS.md); every decision below is
designed to preserve them. A design choice that breaks one of these is a contract bug:

1. **Authorization is in the database (RLS), deny-by-default.** Never UI-only.
2. **The registry is the only extension point.** Adding a block/animation/theme requires no edits to
   the core renderer or editor — no hard-coded type switches.
3. **Document/render separation.** `ZineRenderer` imports nothing from the editor; author ≡ published.
4. **Motion is enhancement.** Every animation declares a `prefers-reduced-motion` fallback; content is
   fully usable with motion off and in plain source order.
5. **All author input is validated (Zod) before persistence or render; never `{@html}` author content.**
6. **Minimal PII, no third-party requests from minors' browsers** (fonts self-hosted, no trackers).
7. **Performance budget** (static/ISR public pages, heavy libs code-split, transform/opacity motion).
8. **TypeScript strict; no `any` leaking through the schema/registry contracts.**

---

## Status of the codebase against this contract (orientation)

Steps 0–2 are built: SvelteKit + tooling + CI (0); auth + 10-table schema + deny-by-default RLS with a
cross-user proof suite (1); the document Zod schema (registry-derived, prop-normalizing via
`.transform()`), the block registry, 6 core blocks, `ZineRenderer`, the `/z/[user]/[slug]` route, and
Storybook (2). **`CURRENT_SCHEMA_VERSION = 1`.** The v2 data model, the editor, and the animation
system in this contract are the forward design — marked **[COMMITTED]** / **[RESERVED]** accordingly.
