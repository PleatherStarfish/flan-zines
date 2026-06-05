# Pedagogy & UX (ages 11–16)

Why the tool is shaped the way it is. This governs decisions in [data-model.md](data-model.md) and
[editor.md](editor.md) as much as the visuals — the data model is **two levels and curated** _because_
of this audience, not in spite of it. Our users are high-school **writers**, so the design is also a
curriculum.

## The lens

1. **Content is the figure; tools are the ground.** The student's words and images own the screen;
   chrome is contextual and recedes. This is Pudding's own aesthetic and the antidote to
   flashy-effects-first.
2. **Constrain to liberate.** Curated themes, fonts, blocks, and effects — not arbitrary knobs. An
   11-year-old should not be _able_ to make something illegible, inaccessible, or unsafe. Constraint is
   the pedagogy (and, for minors, the safety boundary).
3. **Center content, not effects.** A new zine is clean prose with no motion; effects are opt-in and
   framed as "supporting your story."

## Principles → how they show up

| Principle                           | In the product                                                                                                                                                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Progressive disclosure**          | New zine = a title + one prose block. Effects, themes, scrolly, advanced blocks reveal as students explore — discoverable panels, collapsed by default, never a wall of options.                               |
| **Plain, concrete language**        | Surface blocks by type ("Text," "Image," "Heading," "Link," "Space"), not "block." Sections are named bands in the Outline. Tooltips, not manuals.                                                             |
| **Content-first chrome**            | The Inspector is contextual — it appears on selection, hides on deselect so the canvas breathes. Content always dominates the viewport.                                                                        |
| **Forgiving by default**            | Labeled undo everywhere; autosave + localStorage + version recovery; confirm-before-delete; "parking a draft is normal" framing ([editorial-process.md](../best-practices/editorial-process.md)).              |
| **Accessibility taught implicitly** | Alt text required with a _kind_ prompt ("Describe this picture for someone who can't see it"); heading levels managed for them (no skips); reduced-motion honored. They learn a11y because the tool models it. |
| **Explore without clutter**         | Empty states teach ("Add your first section"); templates surface possibilities; a per-panel "?" gives help. Discovery is _invited_, not dumped.                                                                |
| **Effects serve story**             | Effects are opt-in, described as supporting the narrative, and respect reduced motion — echoing Pudding's craft ([scrollytelling.md](../best-practices/scrollytelling.md)).                                    |
| **Keyboard-first**                  | "Move up / move down" buttons are the accessible reorder primitive; drag is the enhancement.                                                                                                                   |

## Vocabulary decisions

We keep the data model's **Section / Block** but surface them in plain terms; we do **not** adopt the
research's Scene/Beat/Act jargon in the UI (a [REJECTED] choice for this age — see
[data-model.md §9](data-model.md#9-pudding-mapping--synonyms) for the internal synonym map).

| Concept (data)          | Student-facing                     | Notes                                                            |
| ----------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| Zine / Document         | "your zine"                        | The whole project                                                |
| Section (`kind`)        | a labeled band on the canvas       | Optional `label` lets them name parts ("intro," "the data part") |
| Block                   | its type name ("Text," "Image," …) | "Block" rarely appears in the UI                                 |
| `role:'step'` (scrolly) | "step"                             | Only inside an Effects-enabled scrolly section (Step 4)          |

## Editor information architecture (v3 — see [scene-timeline.md](scene-timeline.md))

The early three-pane "IDE" tested badly for this age (it asks a child to think like a developer). The
v3 editor is **two friendly surfaces** built on a metaphor they already know — a **video/music
timeline**:

- **Story Map (home).** A vertical **storyboard**: chapters (Acts) as soft bands, **scenes as preview
  cards** (mini-renders), beats as dots. Big **+ Scene / + Chapter** buttons; drag cards to reorder. A
  student sees the whole story like a comic strip, not a file tree.
- **Scene editor.** Tap a card. Simple `page`/`feature` scenes open a **calm writing surface** (no
  timeline). Motion scenes open the **scene timeline** — drag clips along a scroll axis, drag their
  duration, and **scrub the playhead to preview** the scroll live.
- **Funnels, not forms.** Every complex choice is a short **visual funnel** with animated thumbnails
  ("What kind of scene?", "What should this do?"), narrowing to **≤3 chip knobs** (speed / direction /
  amount). Recognition over recall; pictures over fields; 3 choices not 30.
- **Scrub = preview.** There is no "imagine it" button — dragging the playhead scrolls the live scene,
  so cause→effect is continuously visible. This is the load-bearing pedagogy move.
- **Empty states teach** ("Add your first scene ✨"); templates/scene-types pre-build sensible
  timelines so nobody assembles motion from raw parts.
- **Keyboard parity** — every drag (move clip, resize duration, scrub) has an arrow-key equivalent;
  clips are focusable. Accessibility is not optional.

## Well-being & safety as design

- **Never lose work** is a felt promise: autosave status, restore-from-crash, version history framed as
  "your earlier takes."
- **Alt text as teaching, not a gate that nags** — required to _publish_, explained kindly, framed as
  writing practice (describe the image well).
- **Public-by-default is off.** Submitting is "share with my teacher," not "publish to the internet" —
  the teacher-approval gate (Step 6) is the real boundary; the UI never implies a student can go
  world-public alone.
- **Destructive actions confirm** and are reversible where possible.

## What we deliberately do NOT do (for this audience)

- **No arbitrary code / custom components for students** — the registry is dev-extended only ([data-model.md §12](data-model.md#12-explicitly-out-of-the-data-model-and-why)).
- **No font/size/colour controls on text** — typography is the theme's job; this teaches taste and keeps
  output legible and consistent.
- **No raw hex / open color picker** for accents — curated, pre-contrasted swatches only.
- **No deep nesting or modes in MVP** — two levels, one story shape (linear scrolly essay); see
  [roadmap-and-decisions.md](roadmap-and-decisions.md).
