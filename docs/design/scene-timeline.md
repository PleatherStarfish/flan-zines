# Scene timeline — the authoring model & editor

**The product's centerpiece and the answer to "the UI is bad for 11–16."** This document defines the
v3 authoring model (**Story → Act → Scene → Beat → Element**), the **scene-as-timeline** editor, the
curated effects, and the funnels that keep it simple. It supersedes the three-pane editor of
[editor.md](editor.md) (whose store/autosave/registry foundations are _reused_) and the Section model
of [data-model.md §1–4](data-model.md). Status tags per the
[legend](README.md#decision-status-legend-used-throughout).

> **The core idea:** a **Scene is one unit of scroll**, and the **timeline _is_ that scroll**. As the
> reader scrolls down a scene, its beats fire and its elements animate in, move, and out. A simple
> scene is one beat with everything visible (a page of writing); a rich scene is a choreographed
> timeline. Students compose motion by dragging clips on a scroll-timeline — a video-editor metaphor
> they already know — gated behind picture-based funnels so it never overwhelms.

---

## 1. Mental model (now first-class) [COMMITTED]

```
Story  (the zine)
└── Act        — a chapter / part (editorial grouping)
    └── Scene  — ONE UNIT OF SCROLL  (has a timeline)
        ├── Beat[]      — marked moments on the scene's scroll (the "story beats")
        └── Element[]   — content placed on the scene's timeline (a block + choreography)
```

This **embraces** the Story→Act→Scene→Beat hierarchy (a reversal of the earlier two-level decision —
see [roadmap-and-decisions.md](roadmap-and-decisions.md); the reason is that the timeline metaphor +
funnels make the richer model _more_ approachable for this age, not less).

**Blocks are reused, not replaced.** The block registry, `Render` components, schemas, and the
read-only renderer from Steps 2–3 carry forward unchanged: **a block becomes the _content_ of an
Element.** The Element adds the scroll choreography (when it appears, how it moves). So `heading`,
`richText`, `image`, etc. are still the content units; Scenes choreograph them.

| Their word | Internal  | Student-facing                   | Is                                   |
| ---------- | --------- | -------------------------------- | ------------------------------------ |
| Story      | `Story`   | "your zine"                      | the whole thing                      |
| Act        | `Act`     | "chapter"                        | a group of scenes                    |
| Scene      | `Scene`   | "scene"                          | one unit of scroll (a timeline)      |
| Beat       | `Beat`    | "beat" / "moment"                | a marked point on the scene's scroll |
| Element    | `Element` | the content's name ("the photo") | a block placed on the timeline       |

---

## 2. The v3 data model (normative) [COMMITTED]

```jsonc
Story {
  schemaVersion: 3,
  theme: Theme,                  // §7 of data-model.md — unchanged (palette / fontPair / accent)
  dataSources?: { [name]: DataSourceRef },
  acts: Act[]
}

Act { id: "act_<nanoid>", title?: string, scenes: Scene[] }

Scene {                          // a unit of scroll
  id: "scn_<nanoid>",
  type: 'page' | 'feature' | 'reveal' | 'parallax' | 'sidescroll' | 'data',  // the funnel choice (§6)
  label?: string,                // outline-only authoring name
  length: 'auto' | 'short' | 'medium' | 'long',   // how much scroll the scene occupies (≈ vh)
  background?: { color?: HexColor, effect?: EffectId, params?: Record<string, unknown> },
  beats: Beat[],                 // ordered; a 'page' scene has exactly one implicit beat
  elements: Element[]
}

Beat {
  id: "beat_<nanoid>",
  at: number,                    // 0..1 scroll progress within the scene
  label?: string,                // "Fact 1"
  state?: Record<string, unknown> // FULL figure state at this beat (data scenes — the Pudding rule)
}

Element {                        // a "clip" on the timeline
  id: "el_<nanoid>",
  track: 'content' | 'media' | 'background',   // a small fixed set of lanes
  block: Block,                  // ← an existing registry block is the content (data-model.md §5)
  range: { start: number, end: number },        // 0..1 — WHEN it's on screen (the draggable duration)
  enter?: EffectRef,             // how it appears
  exit?: EffectRef,              // how it leaves
  motion?: EffectRef,            // sustained motion while on screen (parallax / float …)
  anchorBeat?: string            // optional: snap `range.start` to a beat id
}

EffectRef { type: EffectId, params?: Record<string, unknown> }   // EffectId → AnimationDef registry (§5)
```

**Why this shape.** `range` is literally what a student drags ("duration of effect"). `enter`/`exit`/
`motion` are the three things a clip can do (appear, hold-with-motion, leave). `Beat.state` carries the
full-state-per-step discipline so a reader can scrub anywhere and a chart still resolves. Effects are
**references** (`EffectId` + a few params), never code — resolved by the registry to GSAP / Threlte /
Scrollama with **mandatory reduced-motion fallbacks**.

**Validation (normative, enforced before persistence/render):**

1. `range.start < range.end`, both in `[0,1]`; `enter`/`exit` ramps live inside the range.
2. `beats` are ordered by `at`, each in `[0,1]`; a `page` scene has exactly one beat at `0`.
3. `anchorBeat` (if set) references a beat in the same scene.
4. `Beat.state` is only meaningful when the scene's figure element declares a `stateSchema`; each
   state must pass it (data scenes only). Non-data scenes omit `state`.
5. `background.effect` and every `EffectRef.type` must be a registered `EffectId`; params validate
   against that effect's schema.
6. `block` validates against its registry schema exactly as today (the `.transform()` path).

---

## 3. Scene = a unit of scroll (the timeline concept) [COMMITTED]

A Scene maps to a span of scrolling (`length`). Its timeline axis is **scroll progress 0→1**. Elements
occupy `[start,end]` of that progress; as the reader scrolls, each element runs
`enter ramp → hold (+motion) → exit ramp`. **A `page` scene** is the degenerate, most-common case: one
beat, every element `range {0,1}`, no effects → a plain, statically-readable page (simple stays simple).

This makes the model cover the three breakpoint kinds (responsive / narrative-beats / visual-state) and
all four Pudding shapes; the MVP authors the linear forms, the rest reuse the same primitives.

---

## 4. The timeline editor (the centerpiece) [COMMITTED]

A video/music-editor metaphor (iMovie / CapCut / GarageBand) every kid knows — but **the axis is
scroll, not time**: "As your reader scrolls down, this is what they see."

```
┌──────────────────────────────────────────────────────────────┐
│  ← Story map      Scene: The lamp-lit hour     [▶ Play] [Done] │
├──────────────────────────────────────────────────────────────┤
│                 ▌ LIVE PREVIEW of the scene ▐                  │  ← big, content-first
│                 (drag the slider to scroll it)                 │
├──────────────────────────────────────────────────────────────┤
│  Start ◀━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━▶ End  (scrub)  │  ← playhead = reader's scroll
├────────────┬─────────────────────────────────────────────────┤
│            │ ░◣[ Title — Rise ]◢░░░░░░░░░░░░░░░░░░             │ Content
│  ✦ Add ▾   │      ░◣[ Your words — Fade ]◢░░░░░░░░             │
│            │ [ Photo ━━━━ drifts up (parallax) ━━━━━━━━━━━ ]   │ Media
│            │ [ ✨ Bubbles ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ]   │ Background
│            │ │      ◆Beat 1       ◆Beat 2            ◆Beat 3 │ beats
│            │ 0%         25%         50%         75%      100%  │ scroll ruler
└────────────┴─────────────────────────────────────────────────┘
```

**Tracks (lanes):** **Content · Media · Background** by default (a **Data** lane appears only in data
scenes). Few lanes = legible.

**Clips:** rounded bars spanning `[start,end]`. The edge triangles (◣◢) are the **enter/exit ramps**
(audio-fade handles). Labels read "Element — Effect".

**The interactions an 11-year-old needs — all direct manipulation:**

| Gesture                  | Result                                                   |
| ------------------------ | -------------------------------------------------------- |
| Drag clip body           | _when_ it appears as you scroll (`range`)                |
| Drag clip edge           | _how long_ it stays (`range` duration)                   |
| Drag the ramp handle (◣) | _how fast_ it fades/slides in or out (enter/exit length) |
| Drag the **scrubber**    | scroll through the scene and watch it happen (= preview) |
| Tap a clip               | a small card of **choices** (chips, not a form) — §6     |
| Tap the ruler            | drop a **Beat** ("a moment"); beats **snap** clips       |

**Scrub = preview.** There is no "imagine it" button: dragging the playhead scrolls the live scene
above. Cause→effect is continuously visible — the single most important pedagogy move. Beats snap and
label moments so nobody does pixel math. **Keyboard:** clips are focusable; arrow keys nudge
`range`/duration; the scrubber is a slider; every drag has a keyboard equivalent (a11y, not optional).

---

## 5. The curated effects catalog (`AnimationDef` registry) [COMMITTED Step-4 build]

Each effect is **one `AnimationDef`** (the registry reserved in data-model.md §7): a friendly name, a
thumbnail, **≤3 knobs**, a **mandatory reduced-motion fallback**, and a **lazy-loaded** library
binding. Students pick from this fixed palette — they cannot make something janky or inaccessible.

| Group              | Effects                                                      | Backed by                                | Reduced-motion fallback        |
| ------------------ | ------------------------------------------------------------ | ---------------------------------------- | ------------------------------ |
| **Appear / Leave** | Fade, Rise, Slide, Pop, Typewriter, Word-by-word, Highlight  | IntersectionObserver / transitions       | appear instantly, in order     |
| **Keep moving**    | Parallax, Float, Drift, Gentle zoom (Ken Burns), Spin, Pulse | GSAP ScrollTrigger (transform-only)      | static, final position         |
| **Scene moves**    | Side-scroll (horizontal pin), Reveal steps (sticky), Pin     | GSAP pin / `position:sticky` + Scrollama | normal vertical stack          |
| **Add magic**      | Bubbles, Sparkles, Clouds, Water, Stars, Confetti, Flocking  | Threlte / Pixi canvas (FPS-capped)       | a still frame, or off          |
| **Reveal data**    | Bars grow, Sort, Filter-reveal, Count-up, Line draw, Zoom-to | D3 + ScrollTrigger; state per Beat       | final chart + accessible table |

Cross-cutting (all effects, enforced by the registry): **transform/opacity only**; **lazy-loaded** (a
text scene never ships Threlte/GSAP); **mounted near-viewport, unmounted off-screen**; **FPS-capped**
particles on weak hardware; **degraded** under `prefers-reduced-motion`. This is
[best-practices/scrollytelling.md](../best-practices/scrollytelling.md) +
[responsive-and-performance.md](../best-practices/responsive-and-performance.md), surfaced as
student-facing presets. `EffectId` is a union of registered effect ids — adding an effect is a registry
entry (schema + lazy `load()` + `reducedMotion` + thumbnail), **no core edits**.

---

## 6. Simple choices & funnels (so it never overwhelms) [COMMITTED]

Students never face the whole catalog. Every decision is a short, **visual** funnel with thumbnails.

**Funnel A — "What kind of scene?"** (on add-scene → seeds the timeline)

> 🅐 Just writing · 🅑 A big picture · 🅒 Words over a picture · 🅓 A picture that moves ·
> 🅔 Reveal one thing at a time · 🅕 A chart that animates · 🅖 Side-to-side

Each choice **pre-builds a sensible timeline** (clips, ranges, a tasteful default effect). _Most_
scenes are 🅐 `page` — which has **no timeline at all**, just a clean writing area.

**Funnel B — "What should this do?"** (tap a clip → "Add an effect")

> ✨ Appear/Leave → fade · rise · slide · pop · typewriter
> 🎈 Keep moving → drift · float · parallax · gentle zoom
> 🫧 Add magic → bubbles · sparkles · clouds · water · confetti
> 📊 Reveal data → grow · sort · highlight · count up

Pick a category → pick from 3–5 **animated thumbnails** → applied with good defaults. Then **at most
three knobs as chips**: **Speed** (slow/medium/fast), **Direction** (↑↓←→), **Amount** (subtle/strong).
No numbers, no easing curves, no pixels. The pedagogy: **recognition over recall, pictures over fields,
3 choices not 30.**

---

## 7. The editor, re-shaped around the model [COMMITTED]

The three-pane "IDE" is replaced by **two friendly surfaces**:

**(a) Story Map — the editor's home.** A vertical **storyboard**: Acts as soft labeled bands, Scenes as
**preview cards** (a real mini-thumbnail of each scene rendered by `ZineRenderer`), Beats as dots on a
card. Big buttons: **+ Scene**, **+ Chapter**. Drag cards to reorder. A student sees their whole story
like a comic strip, not a file tree.

```
  CHAPTER 1 · Night
  ┌──────────┐   ┌──────────┐   ┌──────────┐
  │  [aA]    │ → │  🖼 ···   │ → │ 📊 ●●●   │     ← scene cards (mini previews); beats = dots
  │  Page    │   │ Reveal   │   │ Data     │
  └──────────┘   └──────────┘   └──────────┘
                 + Scene            + Chapter
```

**(b) Scene editor — tap a card to open it.**

- `page` / `feature` scenes → a calm, full-width **writing / place-a-picture** surface (today's simple
  block editing, friendlier) — **no timeline**.
- `parallax` / `reveal` / `data` / `sidescroll` scenes → the **timeline** (§4).

Everywhere: **Preview** plays real motion; **plain words**; **encouraging empty states**; **undo
always**; autosave keeps its Step-3 data-safety guarantees (revision discipline, 409, offline,
shadow). Warm, large-target chrome — not a dense IDE.

---

## 8. Rendering architecture [COMMITTED]

One scroll-progress signal per scene (a single GSAP `ScrollTrigger` / IntersectionObserver-gated
scroll-progress) drives every element: `progress → enter ramp → hold(+motion) → exit ramp`. Data scenes
interpolate the figure between adjacent `Beat.state`s. **Author ≡ published** holds: the same
`ZineRenderer` powers the editor preview (the scrubber feeds it a fake progress) and the public page
(real scroll feeds it). With `prefers-reduced-motion` (or no JS), the renderer ignores ranges/effects
and lays every element out **in source order** — fully readable. Heavy effect libs are dynamically
imported, absent from a text scene's bundle; published scenes are static/ISR.

---

## 9. Migration v2 → v3 (lossless) [COMMITTED]

`schemaVersion 2 → 3` (the scaffold enforces version-advance + losslessness; unit-tested):

- `Document → Story`; wrap all v2 sections in **one default `Act`**.
- `Section → Scene`: `kind → type` (`prose→page`, `feature→feature`, `split→feature` + note, `sources→page`,
  `scrolly→reveal`); carry `presentation.legacyLayout` forward.
- Each `Block → Element` on `track` inferred from the block's `category` (`text→content`,
  `media→media`, `structure→content`), `range {start:0,end:1}`, no effects → **identical static reading
  experience**.
- v2 scrolly `role:'graphic'`/`role:'step'`(+`state`) → a `reveal` scene: the graphic becomes a sticky
  `media` element; each step becomes a `content` element + a `Beat` carrying its `state`.

Block props are untouched (validated by their registry schemas as today).

---

## 10. Pedagogy alignment (ages 11–16) [COMMITTED]

- **Direct manipulation, not configuration** — drag clips & ramps; pick thumbnails; never type a number.
- **Continuous feedback** — scrub = preview; cause and effect always visible.
- **Progressive disclosure** — most scenes are a clean page; the timeline appears only for motion;
  effects are ≤3 knobs behind funnels.
- **Constrain to liberate** — a fixed, beautiful effect palette; impossible to make it ugly,
  inaccessible, or janky.
- **Familiar metaphor** — a video/music timeline repurposed for scroll.
- **Content-first** — the preview dominates; motion-off is a first-class, readable mode.
- **Forgiving** — undo, autosave, can't-break-it; beats/snapping remove fiddly precision.

(Folds into and extends [pedagogy.md](pedagogy.md).)

---

## 11. Build sequencing [COMMITTED]

1. **Model v3 + migration** (Story/Act/Scene/Beat/Element) — additive over Steps 2–3; blocks reused;
   store/autosave/registry carried forward. Unit-tested migration + round-trip.
2. **Story Map** (storyboard of scene cards) — replaces the outline; immediately friendlier.
3. **Scene editor: `page`/`feature`** (the calm writing surface) — covers ~70% of student scenes with
   zero timeline.
4. **The timeline** for `parallax`/`reveal` + **Appear / Keep-moving** effects (GSAP + Scrollama) — the
   centerpiece, with the scrubber + keyboard parity.
5. **Ambient "magic"** (Threlte/Pixi particles) and **Data** scenes (beats + states) — heavy,
   lazy-loaded effects, last.

---

## 12. Risks & trade-offs

| Decision                                | Trade-off                                                                                |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| Scroll-as-timeline                      | Powerful + familiar, but scrubbing must be buttery — invest in the scroll signal + GSAP. |
| Reuse blocks as element content         | Keeps Steps 2–3; an "element" is a block-in-a-clip (one wrapper).                        |
| Add the Act level + Element/timeline    | Cleanest model, but it's **schemaVersion 3** + a migration (designed above, lossless).   |
| Curated effects only (no custom code)   | A ceiling on expression — but the safety + taste boundary for minors.                    |
| Two surfaces (Story Map + Scene editor) | More to build than one canvas, but far better for the age than a 3-pane IDE.             |
| Timeline complexity                     | Mitigated hard by funnels: `page` scenes never see a timeline.                           |

**Invariants preserved** (unchanged from the design contract): registry is the only extension point
(blocks _and_ effects); `ZineRenderer` imports nothing from the editor (author ≡ published); all input
Zod-validated, never `{@html}`; every effect has a reduced-motion fallback; writes go through the
RLS-scoped client; heavy libs code-split; TS strict, no `any` leak.
