# Proposal: Pinned content placement + editorial typesetting

Status: **Proposal / RFC** (not yet implemented) · Targets schema **v6** · Owner: editor team

## 1. Problem

Two gaps in the editor today:

1. **No way to anchor an element to a screen region for a scene.** Every `flow`
   element stacks centred in the pinned scene column; the only off-column option is
   `placement: 'free'`, a _path-driven sprite_. There's no "this heading sits at the
   top-left and holds there while the reader scrolls, animating in and out." This matters
   most for **text and text-associated images** (a title card, a caption pinned bottom-right,
   a stack of points that reveal one at a time).
2. **Text styling is thin.** A text block has only `align` (left/center/right) and an
   optional backdrop. Real zines and magazines lean on a rich, _rule-bound_ typographic
   vocabulary — kickers, decks, pull quotes, drop caps, measured columns — that we don't offer.

This proposal adds both, designed so the **safe defaults are the beautiful ones** and the
controls speak a student's language (no "padding", no "leading", no point-size fields).

---

## Part A — Pinned content placement

### A.1 Model: a third `placement`

`Element.placement` already encodes layout intent: `flow` (reading column) and `free`
(viewport-fixed sprite on a `path`). Add a third:

> **`pinned`** — the element holds at a chosen **screen region** for the whole scene,
> animating _in_ near `range.start` and _out_ near `range.end`, holding through the middle.

A pinned element reuses the existing **`.zine-stage-overlay`** (already viewport-fixed,
`container-type: size`, and already kept on screen while a pinned scene scrolls). The only
difference from `free` is _how it's positioned_: by a **named anchor** instead of a path.
Enter/exit/motion still flow through the unchanged, transform/opacity-only
`composeElementStyle` — so "stays put during the middle scroll" falls out of the existing
pinned-scene machinery for free.

**"Content text" vs "other text" is a placement, not a new block type.** A `richText`/`heading`
with `placement: 'pinned'` _is_ the content text; the same block left `flow`/`free` is "other
text." This avoids duplicating block types/inspectors and works identically for
text-associated **images**. (Alternative considered: two text block types — rejected as more
code for no extra capability.)

### A.2 Anchor schema (`schema/document.ts`)

```ts
ELEMENT_PLACEMENTS = ['flow', 'free', 'pinned']

AnchorRegion = 'top-left'|'top'|'top-right'
             | 'left'   |'center'|'right'
             | 'bottom-left'|'bottom'|'bottom-right'

Element.anchor?: {
  region: AnchorRegion,        // default 'center'
  dx: int in [-6, 6],          // nudge STEPS (≈0.75rem each), not "padding"
  dy: int in [-6, 6]
}
```

`anchor` is only consumed when `placement === 'pinned'`. Text justification reuses
`block.style.align` (so "centre + centre-justified" = region `center` + align `center`).

### A.3 "Several headings, one at a time"

Pure staggered `range`s — no new concept. Three pinned headings with ranges `0–0.4`,
`0.33–0.7`, `0.6–1` appear/disappear in sequence as the reader scrolls; the existing timeline
already draws and edits these clips. A store helper `addPinnedText(sceneId)` appends a pinned
heading with an auto-staggered range following the previous pinned element.

### A.4 Renderer (`render/ZineRenderer.svelte`)

- Generalise "free" → "stage" elements: the overlay renders **free + pinned**; `isPinned()`
  and the `has-free`→`has-stage` min-height fallback also trigger on pinned elements.
- New `.zine-pinned-actor` (distinct from `.zine-free-actor`, which keeps its centring
  transform). Anchor is **pure CSS** keyed off `data-region` (`top/left/right/bottom` + a
  centring `transform` on the centre axes). The **nudge** rides the separate `translate:`
  longhand (`--nudge-x/--nudge-y` from `dx/dy`), so it never collides with the block's effect
  `transform`. Enter/exit/motion apply to the block child via `timelineStyle` exactly as today.
- **Reduced motion**: pinned falls back to **flow** source order (readable), like `free`.

---

## Part B — Editorial typesetting for text

Grounded in classical typesetting and magazine/zine practice (see §Sources). The guiding
principle: **encode the rule, expose taste.** Controls are bounded enums (injection-safe, per
the existing `theme.ts` rule "safety in the schema, taste in the UX") and recognition-based
chips — never numeric type fields.

### B.1 Text roles (the headline feature)

A **role** is a one-tap editorial preset that applies a _correct_ bundle of type settings.
Picking "Pull quote" is how a student gets hanging quotes, a narrow measure, and an accent
rule — without knowing any of those words. Roles for the `heading` and `richText` blocks:

| Role                            | What it is (magazine term)   | Baked-in typesetting defaults                                                                                            |
| ------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Headline**                    | the title                    | heading font, large, bold, tight leading (≈1.15), **balanced line breaks** (`text-wrap: balance`), flush-left or centred |
| **Kicker** _(a.k.a. eyebrow)_   | small label above a headline | small, **ALL CAPS or small-caps**, tracked (letter-spacing), accent colour                                               |
| **Deck** _(standfirst / intro)_ | the summary under a headline | larger than body (≈1.25×), lighter weight, muted colour, balanced wrap, generous measure                                 |
| **Body**                        | the reading copy             | body font, **measure 60–66ch**, flush-left / ragged-right, `text-wrap: pretty` (kills widows/orphans), leading ≈1.5–1.6  |
| **Pull quote**                  | a quote lifted from the copy | large, **hanging quotation marks**, accent rule/line, narrow measure, optional centred                                   |
| **Block quote**                 | an indented quotation        | indented with a left rule, hanging punctuation, slightly muted                                                           |
| **Caption**                     | text under an image          | small, muted, body font, tight measure                                                                                   |
| **Byline / credit**             | who made it                  | small, tracked, muted (e.g. "WORDS BY …")                                                                                |

Choosing a role sets the defaults below; the student can still nudge any of them.

### B.2 The simple controls (student language → real rule)

Every control is a small set of chips. The **default is always the typographically correct
one**, so doing nothing is already good.

- **Column width** → _Narrow / Medium / Wide_, mapped to a capped **measure**
  (`≈45ch / 62ch / 75ch`). The cap is the guardrail: a student can never create an unreadable
  110-character line. (Rule: 45–75 chars, ~66 optimal; novices read best ~45.)
- **Line spacing** → _Tight / Cozy / Airy_ (≈1.2 / 1.5 / 1.7). Never below word spacing.
- **Line up text** → _Left (ragged) / Centred / Edge-to-edge_. Left is default & recommended.
  "Edge-to-edge" (justified) **auto-enables hyphenation + hanging punctuation** and is only
  offered on a Medium/Wide measure (justifying a narrow column makes rivers — so we hide it).
- **Letters** → _Normal / ALL CAPS / Small caps_ (small caps preferred for kickers/bylines).
- **Big first letter** → a **drop cap** toggle (CSS `::first-letter`) for Body/Pull quote.
- **Tidy line breaks** → on by default for Headline/Deck (`text-wrap: balance`) and Body
  (`text-wrap: pretty`); a toggle to turn off. This is the widow/orphan & balance control,
  named for what it does, not the jargon.
- **Hang the quote marks** → on by default for Pull quote/Block quote (`hanging-punctuation`,
  with a manual negative-indent fallback for engines that lack it).
- **Columns** → _1 / 2_, offered only on a Wide measure / wide scene (CSS multi-column).

### B.3 Typeset schema (`schema/theme.ts`, on `BlockStyle`)

```ts
BLOCK_ALIGNMENTS = ['left','center','right','justify']   // + 'justify'

BlockStyle.typeset?: {
  role?: 'headline'|'kicker'|'deck'|'body'|'pullquote'|'blockquote'|'caption'|'byline',
  measure?: 'narrow'|'medium'|'wide',
  leading?: 'tight'|'cozy'|'airy',
  case?: 'normal'|'upper'|'smallcaps',
  dropCap?: boolean,
  hangingPunctuation?: boolean,
  tidyWrap?: boolean,          // text-wrap balance/pretty
  columns?: 1 | 2
}
```

All bounded → injection-safe. The renderer applies them as **`data-*` attributes** on
`.zine-block` (mirroring today's `data-align` / `data-text-backdrop`) plus CSS — **no inline
raw CSS from authors**, so author≡published and the transform/opacity safety boundary hold.
`role` resolves to its default bundle; explicit fields override the role.

### B.4 Renderer additions

- New CSS keyed off `data-typeset-role`, `data-measure`, `data-leading`, `data-case`,
  `data-dropcap`, `data-columns`, `data-hang`, `data-align='justify'`. Measure caps via `ch`.
- Drop cap via `::first-letter`. Hanging punctuation via `hanging-punctuation: first last`
  with a negative-text-indent fallback. `text-wrap: balance|pretty` are progressive
  enhancements (no layout breakage where unsupported).
- Roles compose with **theme roles** (heading/body/accent/muted colours) and the **FontPicker**
  pair — kickers/quotes pull the accent colour; headlines/decks use the heading font.

---

## Schema migration (v5 → v6)

Both parts are **additive**: new optional `placement` value, optional `anchor`, optional
`BlockStyle.typeset`, and one new `align` value. Migration `5: (doc) => ({...doc,
schemaVersion: 6})` is a **no-op** (lossless). Bump `CURRENT_SCHEMA_VERSION` and update the
**9 hardcoded `schemaVersion: 5`** sites (store default, `SceneEditor`, `SceneMiniPreview`,
`templates`, `fixtures`, 3 stories) + `migrate.test.ts`.

---

## Editor UX

- **Store** (`store.svelte.ts`): `setElementPlacement` accepts `'pinned'` (switching to pinned
  drops `path`; away drops `anchor`); `setElementAnchorRegion`, `nudgeAnchor(id, axis, ±1)`
  (clamped), `addPinnedText`. Typeset: `setTypesetRole`, `setTypeset(partial)` (validated
  through `BlockStyleSchema`).
- **`PlacementPicker.svelte`** (inspector rail): "Where does this sit?" → _In the story /
  Pinned on screen / Free sprite_. When pinned: a **3×3 anchor grid** + **Move ← → ↑ ↓** +
  **Reset**.
- **Text style** section in `BlockInspector` for text blocks: a row of **role** chips
  (Headline / Kicker / Deck / Body / Pull quote / Caption / Byline) then the §B.2 chips. All
  recognition-based; the live preview updates immediately.
- Sequencing stays in `SceneTimeline` (staggered clips already shown there). Pinning content
  pins the scene; for sequences the editor sets a comfortable `scrollLength`.

---

## Tests

- **Schema**: pinned + anchor + typeset round-trip; bad region/role/measure rejected; **5→6
  migration no-op & idempotent**; existing fixtures still parse.
- **Pure helpers**: `regionToCss`, nudge clamp, `roleDefaults(role)` (returns the correct
  measure/leading/case/etc.) — unit-tested, no DOM. These encode the typesetting rules and are
  the most valuable assets.
- **`composeElementStyle`**: unchanged — assert anchor/typeset don't alter timeline output.
- **Renderer/hardening**: pinned actor emits `data-region`/nudge + correct `data-typeset-*`;
  overlay renders & scene pins when pinned present; justified only when measure ≥ medium;
  reduced motion renders pinned in flow.
- **Store**: placement transitions keep `path`/`anchor` consistent; `addPinnedText` staggers;
  typeset writes validate.

## Invariants preserved

author≡published (renderer reads schema only); transform/opacity-only effects (timeline
untouched); reduced-motion fallback; recognition-over-recall UX (no numeric type fields, no
"padding"/"leading" jargon); bounded/injection-safe author values; bundle purity (no new deps;
CSS-only typography).

## Open questions (for review)

1. **`page` scenes** cap scroll at 1 screen (`sceneScrollScreens` hardcodes 1) — fine for one
   pinned block, tight for a sequence. Auto-promote to a timeline scene, or just recommend
   reveal/feature?
2. **Anchor + nudge vs. effect transform** must live on different elements (wrapper vs block):
   confirm the `translate` longhand + `transform` split is robust across all effects.
3. **Pinned in `horizontal` (side-scroll) scenes**: pinned actors should stay viewport-fixed
   (a title over a panning level) — confirm the overlay's separation from the panning stage
   delivers that.
4. Should a pinned element also allow a `motion` effect (float/parallax) on top of its anchor,
   or is pinned strictly static-hold?
5. **Hanging punctuation / `text-wrap: balance|pretty`** have partial browser support — confirm
   the fallbacks degrade cleanly on the target Chromebook fleet.
6. Is the **role → defaults** table (§B.1) the right editorial taste, and is anything
   over/under-specified to begin implementation?

## Sources (typesetting/editorial research)

- Editorial terms (kicker, deck/standfirst, byline, pull quote, drop cap, folio):
  "20 Editorial Design Terms You Should Know" (LinkedIn, H. Flewelling); "Anatomy of a Magazine
  Layout" (yesimadesigner.com).
- Measure / line length 45–75 (~66) chars: UXPin "Optimal Line Length"; Butterick's _Practical
  Typography_, "Line length"; _The Elements of Typographic Style Applied to the Web_ §2.1.2.
- Alignment (flush-left vs justified), leading ≥ word spacing: USWDS Typography; Wikipedia
  "Typographic alignment".
- Hanging punctuation: CuCo Creative typography terminology; PRINT Magazine "Hyphenation,
  Justification and Rags".
- Widows & orphans: Adobe "Widows and orphans"; Google Fonts Knowledge glossary.
- Zine craft (two complementary fonts, grid, borders, white space, handmade aesthetic):
  Creative Market "How to Make a Zine"; Purdue "Designing a Zine"; Blurb "Zine layouts: dos and
  don'ts".
