# Proposal: Pinned placement + editorial typesetting

Status: **v1 IMPLEMENTED** (schema v6) · revision 4 · Owner: editor team

> **Implemented (v1):** schema v6 (`placement:'pinned'` + `Element.anchor`; `BlockStyle.typeset`
>
> - `kind` + `justify`); pure helpers `render/pinned.ts` (`pinNudgeStyle`/`clampNudge`/
>   `pinRegion`/`pinnedContentProblem`) and `render/typeset.ts` (`textKindForElement`/
>   `resolveTypeset`); renderer overlay + region CSS + typeset CSS +
>   reduced-motion/`max-width:700px` collapse; store intents
>   (`setElementPlacement('pinned')`, `setElementAnchorRegion`, `nudgeAnchor`, `resetAnchorNudge`,
>   `setTextKind`, `setTypeset`/`setTypesetRole`, `addPinnedText` with page→reveal promotion,
>   `canPin`); publish gate for interactive/over-long pinned actors; editor `BlockInspector`
>   "Text kind" + Content text style controls + `PlacementPicker` only for Other text/non-text.
>   **Deferred to v2** (as planned): drop caps, columns, true hanging punctuation, pinned
>   sustained motion (`float`/`parallax`).

> **Rev 4 changelog:** Reframed text around the actual author decision: **Content text** vs
> **Other text**. Content text gets prescriptive editorial typesetting defaults and cannot use
> placement choreography or sustained motion (enter/exit animation remains allowed). Other text
> is for labels, stickers, and diagram notes: it can move on a path or pin to a screen region,
> with optional enter/exit animation, and does not receive editorial typesetting presets.

> **Rev 3 changelog (lock-in):** Resolved the last review nits. Blessed **`svh`** in
> `responsive-and-performance.md` §3 (stable viewport unit; fixed value immune to the
> navbar toggle) and made the Pudding cross-check honest about it. Made `regionToCss`
> concrete: **side-specific safe-area gutters** (`env(safe-area-inset-top, 0px)` etc., not a
> `*` placeholder) and a **`max-block-size` guard + editor refusal of over-long pinned
> actors** (no nested scroll). Extended the v1 interactive-pinned ban to **richText links**,
> not just button blocks. Defined the **exact responsive-collapse query** (`prefers-reduced-motion`
> OR `max-width: 700px`; dropped "low-power"/"coarse-pointer" as unreliable/unneeded).
> Noted `page`→`reveal` promotion is **one-way** (not auto-reverted). Open questions resolved.
>
> **Rev 2 changelog (superseded by Rev 4):** Earlier wording treated "content text" as a
> misnomer and framed this mainly as screen placement. Rev 4 restores Content text as the
> primary text kind and keeps pinning as the freer Other-text/non-text placement tool. Rev 2
> still locked down the under-specified mechanics: horizontal-scene `range` meaning,
> `page`→timeline promotion, exact region CSS, a11y of hidden interactive content,
> visual-only "Headline," and `lang`/hyphenation. Corrected typographic facts (`text-wrap:
pretty` does **not** fix widows; body leading floor 1.45; `hanging-punctuation` is **not**
> reliable on Chromebooks). Adopted a **phased scope** (v1 ships the core; drop caps, columns,
> true hanging punctuation, and pinned motion are deferred to v2). Added an explicit
> **alignment check against the Pudding best-practices** (`responsive-and-performance.md`,
> `scrollytelling.md`).

## 1. Problem

1. **No way to anchor an element to a screen region for a scene.** Every `flow` element
   stacks centred in the pinned scene column; the only off-column option is `placement:
'free'`, a _path-driven sprite_. There's no "this heading sits at the top-left and holds
   there while the reader scrolls, animating in and out." Matters most for **text and
   text-associated images** (a title card, a caption pinned bottom-right, a few points that
   reveal one at a time).
2. **Text styling is thin.** A text block has only `align` and an optional backdrop. Real
   zines/magazines lean on a _rule-bound_ typographic vocabulary we don't offer.

Designed so the **safe defaults are the beautiful ones** and controls speak a student's
language (no "padding"/"leading"/point-size fields).

---

## Part A — Pinned placement

### A.1 Model: text kind first, placement second

Text blocks have a first-class **kind** in `BlockStyle.typeset.kind`:

- **`content`**: article/deck/body/caption/quote text. It gets editorial typesetting defaults
  (measure, leading, tidy wrapping, role defaults) and cannot use placement choreography or
  sustained motion. It may still animate in/out with the normal enter/exit effects.
- **`other`**: label/sticker/diagram-note text. It is freer: it may move on a path or pin to a
  screen region, with or without enter/exit animation, and it does not receive editorial
  typesetting presets.

`Element.placement` still encodes _layout intent_ for non-content actors: `flow` (moves with
the scene), `free` (viewport-fixed sprite on a `path`), and:

> **`pinned`** — the element holds at a chosen **screen region** for the scene, animating _in_
> near `range.start` and _out_ near `range.end`, holding through the middle.

Pinning is **choreography, not editorial content semantics.** For text, it is available to
**Other text**; for Content text, the editor hides placement controls and the store/schema clear
or reject placement choreography. Pinning also works for **images** and other non-text actors.

A pinned element reuses the existing **`.zine-stage-overlay`** (already viewport-fixed,
`container-type: size`, kept on screen while a pinned scene scrolls). The difference from
`free` is only _how it's positioned_: by a **named region using ordinary CSS absolute
positioning** — **not** the experimental CSS Anchor Positioning feature.

### A.2 Schema (`schema/document.ts`)

```ts
ELEMENT_PLACEMENTS = ['flow', 'free', 'pinned']

PinRegion = 'top-left'|'top'|'top-right'
          | 'left'   |'center'|'right'
          | 'bottom-left'|'bottom'|'bottom-right'

Element.anchor?: {
  region: PinRegion,   // default 'center'
  dx: int in [-6, 6],  // nudge STEPS (≈0.75rem each) — "move left/right", never "padding"
  dy: int in [-6, 6]
}

BlockStyle.typeset?: {
  kind?: 'content' | 'other',
  role?: TypesetRole,
  ...
}
```

`anchor` is consumed only when `placement === 'pinned'`. Justification reuses
`block.style.align` (so "centre, centred" = region `center` + align `center`).

### A.3 Timing semantics — the same in vertical AND horizontal scenes

For a pinned actor, `range` ALWAYS means an **enter/exit visibility window** (not a track
position). The renderer therefore composes a pinned actor with **timeline semantics** —
`composeElementStyle(el, progress, impls, { reducedMotion })` with **no `axis:'horizontal'`** —
even inside a side-scroll scene. (Flow actors in a horizontal scene keep track semantics; only
pinned actors override.) This is what makes "several headings, one at a time" work everywhere.

### A.4 "Several headings, one at a time"

Pure staggered `range`s — no new concept. Pinned headings at `0–0.4`, `0.33–0.7`, `0.6–1`
appear/disappear in sequence; the timeline already draws/edits these clips. `addPinnedText`
appends a pinned heading with an auto-staggered range after the previous pinned element, and —
per Pudding "keep stories short" — **nudges toward 3–5**, not fifteen.

### A.5 `page` scenes auto-promote to a timeline scene

A `page` scene is capped at **1 screen** (`sceneScrollScreens` hardcodes 1) — no real middle
scroll for a sequence. So **adding a pinned actor to a `page` scene promotes it to `reveal`**
(a timeline scene) and sets a comfortable `scrollLength`. `addPinnedText` creates pinned
**Other text**; the placement picker warns + offers it when you pin on a `page` scene. (Promotion is
content-lossless: a `reveal` scene is a superset; the single page beat at 0 carries over.) It
is **one-way**, not auto-reverted: removing the last pinned element leaves the scene a `reveal`
(it changes the scene's editing mode/timeline exposure, so silently flipping it back would be
surprising); the author can change the scene type back by hand.

### A.6 Renderer (`render/ZineRenderer.svelte`)

- Generalise "free" → "stage" elements: the overlay renders **free + pinned**; `isPinned()`
  and the `has-free`→`has-stage` min-height fallback also trigger on pinned elements. The
  overlay is a **sibling of `.zine-stage`** (the panning side-scroll stage), so pinned actors
  stay viewport-fixed while a horizontal level pans beneath them.
- New `.zine-pinned-actor` (separate from `.zine-free-actor`, which keeps its centring
  transform). **`regionToCss(region)` is a pure shared helper** (so author ≡ published).
  Region = ordinary absolute positioning within the overlay, with a safe **gutter**; the
  centre axes use a centring `transform`; the **nudge** rides the separate `translate:`
  longhand (`--nx/--ny` from `dx/dy`) so it never collides with the block's effect `transform`
  (which stays on the `.zine-block` child via `timelineStyle`, unchanged). Concretely:

  | region                     | CSS (inside overlay; `--g` = gutter)                |
  | -------------------------- | --------------------------------------------------- | -------------------------------------------------- |
  | top-left / top-right       | `top:--g; {left                                     | right}:--g`                                        |
  | bottom-left / bottom-right | `bottom:--g; {left                                  | right}:--g`                                        |
  | top / bottom               | `{top                                               | bottom}:--g; left:50%; transform:translateX(-50%)` |
  | left / right               | `top:50%; {left                                     | right}:--g; transform:translateY(-50%)`            |
  | center                     | `top:50%; left:50%; transform:translate(-50%,-50%)` |

  **Gutters are side-specific** (the `*` form is not valid CSS): base `--g: clamp(0.9rem, 4vw,
2.5rem)`, and each used side adds its own safe-area inset, e.g. top regions use
  `top: calc(var(--g) + env(safe-area-inset-top, 0px))`, left regions
  `left: calc(var(--g) + env(safe-area-inset-left, 0px))`, and so on for `right`/`bottom`.
  The nudge rides the longhand: `translate: calc(var(--nx,0)*0.75rem) calc(var(--ny,0)*0.75rem)`.

  **Size guard (no nested scroll).** The actor is bounded — `max-inline-size: min(var(--measure),
calc(100% - 2*var(--g)))` and `max-block-size: calc(100svh - 2*var(--g))` — so pinned actors
  can never spill past the screen. We deliberately do **not** add inner scroll: pinned text is
  short by design. The editor enforces this rather than relying on clipping — the placement
  picker **warns**, and a **publish-time check** flags, an over-long pinned text/image (e.g. body
  copy that exceeds the block guard), so over-tall pinned actors never ship. _(Resolves former
  open question #1.)_

- **Hidden = inert.** When `timeline.hidden` (opacity ≈ 0 outside the range), the actor gets
  `inert` + `aria-hidden="true"` so links/buttons in a not-yet-entered pinned block can't be
  focused or read by a screen reader. (v1 also disallows interactive blocks — see A.7.)
- **Reduced motion** AND **responsive collapse**: pinned falls back to **flow source order**
  (stacked, fully readable), so anchored corners can't overlap on a phone — the Pudding "stack
  it" fallback. The **exact trigger is one centralized query**, shared by CSS `@media` and any
  JS `matchMedia` (perf §7): `@media (prefers-reduced-motion: reduce), (max-width: 700px)`.
  (Width is the real constraint for corner anchoring; **"low-power" and bare "coarse-pointer"
  are dropped** — there is no reliable low-power media feature, and coarse-pointer alone isn't a
  layout problem since interactive pinned actors are banned in v1. 700px is the chosen
  breakpoint, defined once as a constant so CSS and JS can't drift.) The collapse is **CSS-first**
  to stay SSR-safe (no hydration flash, mirroring the reduced-motion approach): the query
  flattens `.zine-stage-overlay` + `.zine-pinned-actor` to `position: static` normal flow, and
  since the overlay is the **last child** of the scene inner, the actors stack after the scene
  body in readable source order. `.zine-pinned-actor` MUST appear in both the reduced-motion and
  the `max-width` flattening blocks.

### A.7 v1 scope guards

- **Enter/exit animations ARE fully supported (a core feature, not deferred).** Fade, rise,
  slide, pop, and fly-in run through the unchanged `composeElementStyle` and apply
  transform/opacity to the `.zine-block` child — kept separate from the wrapper's anchor
  transform + nudge, so there is no collision. A pinned block can fade/animate _in_ near
  `range.start` and _out_ near `range.end`, holding through the middle. What v1 defers is only
  the sustained **`motion` slot** on pinned: `path` is disallowed (free-sprite only) and
  `float`/`parallax`-on-pinned wait for v2. (Caveat: the overlay is `overflow:hidden`, so the
  very start of a dramatic _off-screen_ fly-in at an edge-anchored region can clip — same as
  free sprites today; fade/rise/pop/short-slide are unaffected and always resolve to the
  visible anchored position.)
- **No interactive pinned actors in v1.** This is not just the `linkButton` block — it
  includes a `richText` block that contains a **link mark**. The editor refuses to pin (and a
  publish-time check flags) any block whose content is focusable: `linkButton`, or `richText`
  with one or more `link` marks. This sidesteps the focus/read-while-hidden problem entirely;
  `inert`-when-hidden (A.6) is defense-in-depth, and allowing pinned interactive content is
  revisited in v2 once `inert` is proven across the fleet.

---

## Part B — Editorial typesetting for text

Grounded in classical typesetting + magazine/zine practice (§Sources). Principle: **encode the
rule, expose taste.** Controls are bounded enums (injection-safe) and recognition chips — never
numeric type fields. **Role defaults + clamps are a pure shared helper `resolveTypeset()` used
by the renderer** (author ≡ published), not editor-only code.

### B.1 Text roles (student label → magazine term)

A **role** is a one-tap preset that applies a _correct_ bundle. Student-facing labels avoid
jargon; the internal id is in parentheses.

| Student label   | (role id / magazine term) | Eligible blocks   | Baked-in defaults                                                                                                                |
| --------------- | ------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Headline**    | `headline`                | heading           | heading font, large, bold, leading 1.15, **balanced line breaks**, flush-left/centred. **Visual only — never an `h1`** (see B.5) |
| **Tiny label**  | `kicker` / eyebrow        | heading           | small, small-caps or ALL-CAPS, tracked, accent colour — sits above a headline                                                    |
| **Intro**       | `deck` / standfirst       | heading, richText | ~1.25× body, lighter, muted, balanced wrap, generous measure                                                                     |
| **Body**        | `body`                    | richText          | body font, **measure ~62ch**, flush-left/ragged, leading **≥1.45**, tidy wrapping                                                |
| **Big quote**   | `pullquote`               | richText          | large, accent rule, narrow measure, optional centred, light first-line "hang" (B.4)                                              |
| **Quote block** | `blockquote`              | richText          | indented with a left rule, slightly muted                                                                                        |
| **Caption**     | `caption`                 | richText          | small, muted, tight measure                                                                                                      |
| **Credit**      | `byline`                  | richText          | small, tracked, muted ("WORDS BY …")                                                                                             |

Choosing a role sets the chips below; the student can still nudge each.

### B.2 Controls (default is always the correct one)

- **Column width** → _Narrow / Medium / Wide_ = capped **measure** `≈45ch / 62ch / 75ch`. The
  cap is the guardrail (rule: 45–75, ~66 optimal; novices ~45) — an unreadable 110-char line is
  impossible.
- **Line spacing** → _Tight / Cozy / Airy_, **role-aware & clamped**: Body = **1.45 / 1.6 /
  1.8** (never below 1.45); display roles (headline/intro/tiny-label/big-quote) may use
  1.15–1.3. (Leading ≥ word spacing.)
- **Line up text** → _Left / Centred / Even edges_. **Left is the default & recommended.**
  "Even edges" (justified) is offered **only on Medium/Wide** measure, and the renderer
  **enforces** it (a pure normaliser clamps justify→left on a Narrow measure — not just hidden
  UI). Justified sets `text-align:justify; hyphens:auto` and relies on the document `lang`
  (B.6). It does **not** depend on `hanging-punctuation` (B.4).
- **Letters** → _Normal / ALL CAPS / Small caps_ (small caps for tiny-label/credit).
- **Tidy line breaks** → on by default for Headline/Intro (`text-wrap: balance`) and Body
  (`text-wrap: pretty`, which improves the last-line rag and **reduces orphans — it does not
  remove widows**); a toggle to disable. Pure decoration: where unsupported it falls back to
  normal wrapping with no layout change.

### B.3 Typeset schema (`schema/theme.ts`, on `BlockStyle`)

```ts
BLOCK_ALIGNMENTS = ['left','center','right','justify']   // + 'justify'

BlockStyle.typeset?: {                 // all optional, all bounded
  role?: 'headline'|'kicker'|'deck'|'body'|'pullquote'|'blockquote'|'caption'|'byline',
  measure?: 'narrow'|'medium'|'wide',
  leading?: 'tight'|'cozy'|'airy',
  case?: 'normal'|'upper'|'smallcaps',
  tidyWrap?: boolean
  // dropCap, columns, hangingQuote → DEFERRED to v2 (B.7)
}
```

Bounded → injection-safe. Applied as **`data-*` attributes** on `.zine-block` (like today's
`data-align`/`data-text-backdrop`) + CSS — **no inline raw CSS from authors**. `role` resolves
to its default bundle via `resolveTypeset()`; explicit fields override. Roles set
**container-level** type scale/colour; structural children of a `richText` (nested `h2/h3`,
lists, blockquotes) keep their existing sensible styles unless the role is specifically a
text-level role (Big quote/Quote block style the paragraphs).

### B.4 Big quote "hang" — manual, not `hanging-punctuation`

`hanging-punctuation` is **unsupported on Chrome/Edge/Firefox** (partial Safari only, ~15%
global), so it is **decorative-only** and never required. The Big-quote role gets a believable
hang via a **manual first-line negative indent** (`text-indent: -0.5ch` on the first line / an
oversized opening-quote glyph positioned with `::before`), which works everywhere. True
hanging punctuation is a v2 progressive enhancement behind `@supports`.

### B.5 "Headline" is visual only (heading-outline invariant)

The Headline role changes _appearance_, never document semantics. The **zine title stays the
only `h1`; content headings stay `h2+`** (existing a11y invariant). A `heading` block keeps its
chosen level; the role just styles it. (Decorative sprite text already stays out of the
outline as `richText`.)

### B.6 `lang` / hyphenation

`hyphens:auto` needs a language. The renderer sets `lang` on the zine root (document-level,
default `"en"`); justified blocks inherit it. (A future per-document language picker can set it;
not required for v1.)

### B.7 Deferred to v2 (specified now so it's ready)

- **Drop caps** — `role`-gated on Body/Big-quote, applied to the **first paragraph only**:
  `:first-of-type::first-letter { float:left; font-family:heading; font-size:3.1em;
line-height:0.82; margin:0.02em 0.1em 0 0; }`. Fallback: unsupported `::first-letter` simply
  renders normal text. (`::first-letter` alone isn't a drop cap — the `float`+`line-height` is
  the recipe.)
- **Columns** — CSS multi-column is awkward inside scroll stories; deferred until there's a
  clear need.
- **True hanging punctuation** — `@supports (hanging-punctuation: first)` enhancement.
- **Pinned motion** — `float`/`parallax` on a pinned actor.

---

## Schema migration (v5 → v6)

Additive: new `placement` value, optional `anchor`, optional `BlockStyle.typeset`, one new
`align` value. Migration `5: (doc) => ({...doc, schemaVersion: 6})` is a **no-op** (lossless).
Bump `CURRENT_SCHEMA_VERSION`; update the **9 hardcoded `schemaVersion: 5`** sites + `migrate.test.ts`.

---

## Alignment with the Pudding best-practices

Checked against [`scrollytelling.md`](../best-practices/scrollytelling.md) and
[`responsive-and-performance.md`](../best-practices/responsive-and-performance.md):

- **Source-order authoring → graceful degradation** (scrolly §5/§6): pinned elements stay in
  source order in the markup, so reduced-motion / small-screen collapse to a coherent stacked
  article. ✓
- **Reduced-motion = stacked, readable** (scrolly §6): pinned → flow source order. ✓
- **Stick with CSS, not JS** (scrolly §3): reuses the existing `position: sticky` scene; no JS
  sticky math. ✓
- **Stable sticky height, not `vh`** (perf §3): reuses the existing pinned-scene height in
  **`svh`** — the _stable_ small-viewport unit now **blessed in perf §3** as the sanctioned
  CSS-sticky path (a fixed value immune to the navbar toggle). New measures are `ch`,
  line-heights unitless. No bare `vh`, and no new JS height math. ✓ _(This is a sanctioned
  modern unit, not a literal "px from innerHeight" — perf §3 was updated so the claim is honest.)_
- **Transform/opacity-only animation** (perf §4): `composeElementStyle` untouched; typeset is
  **static layout**, not animated on scroll. ✓
- **No extra scroll listener; reuses the existing rAF-throttled progress** (perf §6): pinned
  placement is **not** IO-triggered — it rides the renderer's existing single rAF-throttled
  `drive` signal and adds no listener of its own. ✓
- **Stack-it on mobile/low-power** (perf §2/§5): the responsive collapse (A.6) is exactly this.
  ✓
- **Keep stories short** (scrolly §7): `addPinnedText` nudges to 3–5 staggered blocks. ✓
- **Resize is first-class** (perf §5): anchored positions are pure CSS — they reflow on resize
  with no JS rebuild. ✓

**One sanctioned deviation, now documented:** the sticky height is `svh`, not "px from
`innerHeight`." `svh` is a stable, fixed unit immune to the navbar trap (the rule's actual
concern), so perf §3 was updated to bless it for pure-CSS sticky ranges. With that, no clashes
remain. (One reinforcement: the small-screen collapse is **required**, not optional, because
absolute corner-anchoring on a phone would otherwise overlap.)

---

## Editor UX

- **Store**: `setTextKind('content'|'other')` is the primary text intent. Content text clears
  free/pinned placement and sustained motion, then applies editorial defaults; Other text clears
  editorial presets and may be placed/choreographed. `setElementPlacement` accepts `'pinned'`
  (→ marks text as Other, drops `path`; away → drops `anchor`);
  `setElementAnchorRegion`, `nudgeAnchor(id, axis, ±1)` (clamped), `addPinnedText` (auto-stagger
  - page→reveal promotion). Typeset: `setTypesetRole`, `setTypeset(partial)` (validated through
    `BlockStyleSchema`).
- **Text kind** in `BlockInspector` (text blocks): **Content text / Other text**. Content text
  reveals **Text style** role chips (Headline / Tiny label / Intro / Body / Big quote / Quote
  block / Caption / Credit) and the B.2 chips, filtered by block eligibility. Other text hides
  those editorial controls.
- **`PlacementPicker.svelte`** (rail): shown only for **Other text** and non-text actors.
  "Place other text" / "Place on screen" → _With the scene / Pinned to screen_. When pinned: a
  **3×3 region grid** + **Move ← → ↑ ↓** + **Reset**; if the scene is a `page`, a one-line
  "this will make the scene scrollable" note.
- Sequencing stays in `SceneTimeline` (staggered clips already shown).

---

## Tests

- **Schema**: pinned + anchor + typeset/text-kind round-trip; bad region/role/measure/kind
  rejected; explicit Content text with placement choreography rejected; **5→6 no-op &
  idempotent**; existing fixtures still parse; justify-on-narrow normalised to left.
- **Pure helpers (highest value — they encode the rules)**: `regionToCss`, nudge clamp,
  `resolveTypeset(role/overrides)` (correct measure/leading floors/case/justify-clamp),
  page→reveal promotion. No DOM.
- **`composeElementStyle`**: unchanged; assert pinned uses timeline (not horizontal) semantics
  and anchor/typeset don't alter its output.
- **Renderer/hardening**: pinned actor emits `data-region`/nudge; Content text emits
  `data-typeset-*`, Other text does not; overlay is a sibling of the stage; scene pins when
  pinned present; `inert`+`aria-hidden` when hidden; reduced-motion & small-screen → flow source
  order.
- **Store**: text-kind transitions clear/apply the right controls; placement transitions keep
  `path`/`anchor` consistent; `addPinnedText` creates Other text, staggers + promotes `page`;
  typeset writes validate.

## Invariants preserved

author ≡ published (region/role resolution in shared pure helpers, renderer reads schema only);
transform/opacity-only effects; reduced-motion + small-screen stacked fallback;
recognition-over-recall UX (no numeric/jargon fields); bounded/injection-safe author values;
heading-outline (visual-only Headline); Content text has no placement choreography/sustained
motion; bundle purity (CSS-only typography, no new deps).

## Resolved decisions (locked)

1. **Over-tall pinned actors** → a `max-block-size` guard (A.6), **no inner scroll**; the
   editor warns and a publish-time check refuses over-long pinned text/images.
2. **`addPinnedText` promotion target** → `reveal` (content-lossless, one-way; A.5).
3. **Interactive pinned actors** → **banned in v1**, including `richText` with link marks, not
   just the `linkButton` block (A.7). `inert`-when-hidden is defense-in-depth; revisit in v2.
4. **Responsive collapse trigger** → `@media (prefers-reduced-motion: reduce), (max-width:
700px)`, one shared constant; "low-power"/bare "coarse-pointer" dropped (A.6).

## Sources

**Editorial / typesetting:** "20 Editorial Design Terms You Should Know" (LinkedIn,
H. Flewelling); "Anatomy of a Magazine Layout" (yesimadesigner.com); UXPin "Optimal Line
Length"; Butterick's _Practical Typography_ "Line length"; _Elements of Typographic Style
Applied to the Web_ §2.1.2; USWDS Typography; Wikipedia "Typographic alignment"; PRINT
"Hyphenation, Justification & Rags"; Adobe + Google Fonts "Widows & orphans"; CuCo "typography
terminology"; zine craft — Creative Market, Purdue, Blurb.

**Browser support (review-checked):** `hanging-punctuation` — MDN + Can I Use: no Chrome/Edge/
Firefox, partial Safari (~15% global) → decorative only. `text-wrap: balance` — broad support
incl. Chrome → safe progressive enhancement. `text-wrap: pretty` — Chrome/Edge yes, Firefox no
→ fallback to normal wrapping; **handles orphans, not widows** (Chrome docs).

**Pudding best-practices (internal):** `docs/best-practices/scrollytelling.md`,
`docs/best-practices/responsive-and-performance.md`.
