# Data model — the zine contract

The load-bearing contract: the **document shape** every other system negotiates through — editor,
renderer, animation, publish, gallery. This supersedes [ARCHITECTURE.md §4](../../ARCHITECTURE.md) where
they differ. Status tags per the [legend](README.md#decision-status-legend-used-throughout).

> **Design rule:** model **what the reader thinks is happening**, not what the DOM does. If they think
> they're scrolling through steps, store steps; if a step shows a chart in a certain state, store that
> **full state**. (Pudding's own scrollytelling lesson — see [roadmap-and-decisions.md](roadmap-and-decisions.md).)

> **⚠️ Model status — v2 (implemented) → v3 (target).** §1–4 below describe the **v2** model
> (`Document → Section → Block`), implemented in code (Steps 2–3, `schemaVersion = 2`). The **current
> target is v3** — `Story → Act → Scene → Beat → Element` — defined in
> [scene-timeline.md](scene-timeline.md). What carries forward **unchanged** is the **block contract
> (§5)**: a block becomes the _content of an Element_. What changes: `Document→Story`, sections wrap in
> `Act`s, `Section→Scene` (a unit of scroll with a timeline), and an `Element` layer adds choreography.
> Theme (§7), assets/dataSources (§8), validation/safety (§10), and metadata-vs-content (§11) carry
> forward. Read §5–11 as current; read §1–4 as the v2 baseline the v2→v3 migration upgrades.

---

## 1. Mental model

A zine is **one vertical scroll**: an ordered list of **sections**, each an ordered list of **blocks**.
**Two levels of nesting — deliberately.** [REJECTED] a third "Act" tier (and the Story→Act→Scene→Beat
naming): over-structure for short student zines and jargon for ages 11–16. Our `role:'step'` block _is_
the research's "Beat." See the [synonym map](#9-pudding-mapping--synonyms).

```
ZineDocument
└── Section[]        (kind: prose | feature | split | scrolly | sources)
    └── Block[]      (role?: graphic | step)   ← role is meaningful only inside a scrolly section
```

---

## 2. v1 (in code) → v2 (target) at a glance

`CURRENT_SCHEMA_VERSION = 1`. The v2 changes are additive except one rename (`layout → kind`), bundled
as the **schemaVersion 1→2 migration** [COMMITTED] (the scaffold in `schema/migrate.ts` already enforces
"a migration must advance the version").

| Element                 | v1 (today) [IMPLEMENTED]                  | v2 (target) [COMMITTED]/[RESERVED]                                    |
| ----------------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| `Section.layout`        | `centered \| split \| grid \| full-bleed` | renamed **`kind`**: `prose \| feature \| split \| scrolly \| sources` |
| `Section.presentation`  | —                                         | optional render hints; migration preserves old `layout` here          |
| `Section.label`         | —                                         | optional outline-only authoring name [COMMITTED]                      |
| `Block.role`            | —                                         | optional `graphic \| step` (scrolly) [COMMITTED]                      |
| `Block.state`           | —                                         | optional full figure-state on `role:'step'` [RESERVED Step 4]         |
| `Document.dataSources`  | —                                         | named source datasets [RESERVED Step 4b]                              |
| `BlockDef.Inspector`    | — (Render half only)                      | required editor half [COMMITTED]                                      |
| `BlockDef.stateSchema`  | —                                         | figure's per-step state shape [RESERVED Step 4]                       |
| `BlockDef.a11yFallback` | — (informal)                              | structured text/table alternative [COMMITTED for new blocks]          |
| `AnimationDef` registry | empty `Map` stub                          | full contract [RESERVED Step 4]                                       |

Migration `1→2` value map (purpose): `centered→prose`, `full-bleed→feature`, `split→split`,
`grid→prose`. **Losslessness requirement:** the original v1 value is also copied to
`section.presentation.legacyLayout`, so a migrated `grid` section still carries the fact that it used a
grid arrangement even though its new editorial purpose is `prose`. The migration test MUST assert this
round-trip fact; dropping `grid` on the floor is a contract bug.

---

## 3. The v2 schema (normative)

```jsonc
ZineDocument {
  schemaVersion: 2,
  theme: Theme,                       // §7
  dataSources?: { [name: string]: DataSourceRef },   // §8 — [RESERVED Step 4b]
  sections: Section[]
}

Section {
  id: "sec_<nanoid>",                 // §6 — stable, prefixed
  kind: 'prose' | 'feature' | 'split' | 'scrolly' | 'sources',
  label?: string,                     // outline-only; NOT rendered
  background?: { color?: HexColor },  // HexColor = injection-safe (already in code)
  presentation?: { legacyLayout?: 'centered' | 'split' | 'grid' | 'full-bleed' },
  animation?: AnimationDescriptor,    // section-scope, e.g. { type:'sticky-steps', trigger:'scroll' }
  blocks: Block[]
}

Block {
  id: "blk_<nanoid>",
  type: string,                       // discriminator into the block registry
  role?: 'graphic' | 'step',          // scrolly only: ONE graphic (figure) + ordered steps
  props: <validated + normalized per the registry schema for `type`>,
  style?: { align?: 'left'|'center'|'right' },
  animation?: AnimationDescriptor,    // block-scope, e.g. { type:'fade-up' } | { type:'parallax' }
  state?: Record<string, unknown>     // [RESERVED Step 4] role:'step' only — FULL figure state at this step
}
```

**Codebase reconciliation (do not regress):** `schema/document.ts` validates a block via a Zod
`.transform()` that looks up the registry schema for `type`, **returns the normalized/defaulted props**,
and emits path-aware errors (`Unknown block type`, `props.<field>: <reason>`). So `parseDocument`
yields a document whose block props are already defaulted — the editor and renderer both rely on this.
v2 keeps that mechanism; `role`/`state` are envelope fields validated alongside `props`.

`kind` is **purpose, not appearance** — it drives section layout **and** which blocks/animations are
offered **and** the editor's affordances. It is the single lever that encodes Pudding patterns (§9) and
scaffolds students.

---

## 4. The scrolly model — full-state-per-step (the most important decision)

Pudding's hardest-won lesson: a reader can skip through steps fast, so **every step must declare the
complete visual state**, never a delta ("move dot 20px"). We adopt this and reconcile it with the
"no dangling id-list" stance:

- A `kind:'scrolly'` section holds **one `role:'graphic'` block** (the pinned figure) + ordered
  **`role:'step'` blocks** (the prose beats). [COMMITTED]
- **Each step carries its own `state`** — the figure's _full_ configuration when that step is active.
  State lives **on the step**, so there is no parallel `steps:[id]` array to desync (delete a step → its
  state goes with it). [RESERVED Step 4 for the payload; the slot is v2]

```jsonc
// kind: 'scrolly', animation: { type:'sticky-steps', trigger:'scroll' }
blocks: [
  { id:"blk_fig", type:"dataViz", role:"graphic", props:{ dataRef:"main", view:"map" } },
  { id:"blk_s1",  type:"richText", role:"step", props:{…},
    state:{ filter:{ genre:"jazz" }, highlight:["high_traffic"], camera:{ zoom:1.4 } } },  // beat 1
  { id:"blk_s2",  type:"richText", role:"step", props:{…},
    state:{ filter:{}, sort:"earnings_desc", annotation:"gap" } }                          // beat 2
]
```

- The figure renders the `state` of the **currently-active** step; the **renderer owns the transition**
  between consecutive states (a "transition policy"), it is **not** stored. This is the state-based, not
  timeline-based, motion model (REQUIREMENTS R4 / [best-practices/scrollytelling.md](../best-practices/scrollytelling.md)).
- The figure block declares **`stateSchema`** (§5) so each step's `state` is validated against what that
  figure accepts. [RESERVED Step 4]
- **Reduced-motion / Step-3 baseline:** a scrolly section with no motion renders as the figure followed
  by the steps in source order — fully readable. That static render _is_ the degraded baseline.

This makes the model cover the research's **three breakpoint kinds**: responsive (device frames),
narrative (section/step boundaries), and **state** (`block.state`).

### Scrolly validation rules (normative)

The generic `Block` envelope keeps `role`/`state` cheap, but the **section schema** owns the cross-block
rules. Step 4's Zod schema MUST enforce these before persistence/render:

1. `role` and `state` are valid only inside `kind:'scrolly'` sections. Non-scrolly sections reject them.
2. A `kind:'scrolly'` section has exactly **one** `role:'graphic'` block and at least **one**
   `role:'step'` block. Unroled supporting blocks are not allowed in the scrolly section; put interludes
   in adjacent `prose` sections.
3. Only `role:'step'` blocks may carry `state`.
4. If the graphic block's `BlockDef` declares `stateSchema`, every step MUST carry a complete `state` and
   each state MUST pass that `stateSchema`. If the graphic has no `stateSchema`, steps MUST omit `state`;
   the section is a static figure-plus-prose pattern, not stateful scrollytelling.
5. The active state is resolved by source order: current step index → that step's full state. No section
   stores a parallel `steps:[id]` list.
6. Editor operations preserve these invariants: reorder moves prose and state together; duplicate copies
   the full state and then focuses the state inspector; delete removes prose and state together. Deleting
   the sole graphic is a confirm-destructive action; if confirmed, the editor must demote the section to
   `prose` or insert a replacement graphic before saving. It must never persist a scrolly section whose
   steps cannot resolve to a graphic.

---

## 5. The block contract (`BlockDef`)

`src/lib/zine/schema/block.ts` today (the `Render` half) [IMPLEMENTED], plus the v2 additions:

```ts
interface BlockDef<P, S = never> {
	type: string;
	label: string; // human-facing editor palette / outline label
	category: 'text' | 'media' | 'structure' | 'interactive';
	schema: ZodType<P>; // validates + normalizes props
	defaults: P; // must pass schema (registry test enforces)
	allowedAnimations: AnimationType[]; // presets this block may use
	Render: Component<{ props: P }>; // published component (also editor preview)
	requiredForPublish?: (props: P) => string[]; // e.g. ["Add alt text"] — a11y publish gate

	// v2 additions:
	Inspector: Component<{ value: P; onChange: (next: P) => void }>; // [COMMITTED Step 3]
	stateSchema?: ZodType<S>; // per-step figure state (scrolly) [RESERVED Step 4]
	a11yFallback?: (props: P, ctx: A11yContext) => A11yFallback | null; // [COMMITTED new blocks]
}

type A11yFallback =
	| { kind: 'text'; text: string }
	| {
			kind: 'table';
			caption: string;
			columns: { key: string; label: string }[];
			rows: Record<string, string | number | boolean | null>[];
	  }
	| { kind: 'text-with-table'; text: string; table: Extract<A11yFallback, { kind: 'table' }> };

type A11yContext = {
	dataSources?: Record<string, unknown>; // resolved, already server-filtered data for dataViz fallbacks
};
```

Registry rules (unchanged, enforced by `registry.test.ts`): unique `type`; non-empty `label`;
`defaults` pass `schema`; `allowedAnimations` are strings; **adding a block edits no core file** (the golden rule). The internal
registry map is the sole permitted `any` (heterogeneous `BlockDef<any>`); each block stays fully typed.

**Inspector contract:** `onChange` MUST run the candidate props through `def.schema.safeParse` before
committing; invalid input shows a field error and **never mutates the document** (no data-loss path).

`a11yFallback` is deliberately structured, not a string. Canvas/SVG/chart blocks need a text
description and, for non-trivial data, a table that assistive technology can traverse. A `dataViz` block
therefore receives resolved `dataSources` in the fallback context and emits either text, table, or both.

---

## 6. Identity, ordering, versioning

- **IDs** [COMMITTED]: `sec_`/`blk_` + nanoid; stable across edits (selection, undo patches, and
  future step references depend on stability). The editor mints them on insert.
- **Ordering** [COMMITTED]: array order = document order. Reorder = array splice. Single-author, so no
  fractional indexing / CRDT (realtime collaboration is a [REJECTED] non-goal).
- **Versioning**: `schema/migrate.ts` chains forward migrations keyed by from-version; any shape change
  bumps `schemaVersion` + adds a migration + is lossless (unit-tested). `zine_versions` snapshots carry
  the full document (+ a copy of the title for fidelity).

---

## 7. Theme & typography

> **⚠️ Theme model — v4 (implemented).** The theme expanded from `{ palette?, fontPair?, accent? }` to a
> **role→colour model** (`schemaVersion 4`, additive + a lossless 3→4 migration in `schema/migrate.ts`):
>
> ```ts
> Theme = {
>   fontPair?,                          // unchanged — keys the font-pair registry
>   preset?: string,                    // the applied catalogue theme's id (for relinking in the UI)
>   swatches?: HexColor[],              // the theme's source palette — the pool the editor offers (≤12)
>   colors?: {                          // the source of truth the renderer reads (one HexColor per role)
>     background, text, heading, accent, muted
>   },
>   palette?, accent?                   // LEGACY v3 keys — kept; themeVars() falls back to them
> }
> ```
>
> `colors` resolves to `--zine-bg/fg/heading/accent/muted`; `swatches` is what the **colour tool** lets
> students browse, **assign to elements** (each role → a swatch or a custom colour), and **customize**
> (editing a swatch re-points every role bound to it). Every value stays `HexColorSchema`-validated
> (safety in the schema); the editor shows a live **WCAG contrast badge** and **warns rather than blocks**
> on a low-contrast custom pick. A **wide curated catalogue** is derived (via `culori`) from a
> palette dataset, kept **editor-only** (never in the public reader bundle). Generative scene
> backgrounds (e.g. the Canvas2D soft-cloud gradient) read these same colours via `BackgroundInput.palette`
> ([adding-a-background.md](../adding-a-background.md)). Everything below is the v2/v3 baseline this
> superseded.

`Theme = { palette?, fontPair?, accent? }` [IMPLEMENTED shape]; `accent` is a `HexColor`
(injection-safe regex in `schema/theme.ts`). The v2 system makes `palette`/`fontPair` **keys into
curated registries** [COMMITTED Step 3]:

- **Palette registry** (~5–6: `ink` default, `paper`, `dusk` dark, `sunrise`, `forest`). Each = the
  CSS-var set (`--zine-bg/fg/accent/muted`), **pre-checked for WCAG AA contrast**. Students cannot pick
  an unreadable combination.
- **Font-pair registry** (curated Google Fonts, e.g. _Editorial_ Fraunces+Inter, _Classic_
  Lora+Source Sans, _Bold_ Archivo+Inter, _Friendly_ Quicksand+Nunito Sans, _Mono_ Space Mono+IBM Plex).
  Sets `--zine-font-heading/body`.
- **Fonts are SELF-HOSTED** via `@fontsource`, never hot-linked from Google's CDN [COMMITTED] — no
  third-party request from a minor's browser (invariant #6), faster on Chromebooks. The public page
  **dynamically imports only the pairing it uses** (`theme.fontPair` → that pairing's CSS).
- **`accent`**: the schema accepts safe hex; the _inspector_ presents a **curated swatch set per
  palette** (each pre-contrasted) rather than a raw hex field — safety in the schema, taste in the UX.

Theme tokens are CSS variables (the Style-Dictionary discipline Pudding uses, lightweight version);
art-direction overrides consume tokens, never raw CSS.

### Animation contract (`AnimationDef`) [RESERVED Step 4]

The current code only stores an `AnimationDescriptor` shape. Step 4 fills the second registry with this
full contract; anything weaker violates the reduced-motion and code-splitting invariants:

```ts
type AnimationTrigger = 'scroll' | 'enter-view' | 'tap' | 'time';

interface AnimationDescriptor<Params = unknown> {
	type: string;
	trigger?: AnimationTrigger;
	params?: Params;
}

interface AnimationDef<Params> {
	type: string;
	label: string;
	schema: ZodType<Params>; // validates descriptor params
	defaults: Params;
	allowedTriggers: AnimationTrigger[];
	appliesTo: 'block' | 'section' | 'both';
	load: () => Promise<AnimationImpl<Params>>; // lazy; heavy libs absent from base bundle
	reducedMotion: 'static' | 'still-frame' | 'passthrough'; // mandatory fallback
}
```

The animation registry validates `{ type, trigger, params }`: unknown type, unsupported trigger, or
invalid params rejects the document before persistence/render. `sticky-steps` is section-only and uses
the scrolly validation rules above; its reduced-motion fallback is the plain source-order stack.

---

## 8. Assets & data sources

**Image block props** evolve to reference assets durably [COMMITTED shape; upload RESERVED Step 5]:

```jsonc
image.props = {
  assetId?: string,    // durable ref into the `assets` table (storage/CDN-resolved, moderation-tracked)
  src?: string,        // external/paste fallback — SafeUrlSchema (http(s)/relative; no javascript:/data:)
  alt: string,         // empty allowed in DRAFT; required to PUBLISH (requiredForPublish)
  caption?: string,
  focalPoint?: { x: number, y: number }   // art-directed responsive cropping
}
```

- A **resolver** maps `assetId → URL`; `src` is the fallback. [RESERVED Step 5]
- **Step 3 image sources, in safety order:** a curated, pre-moderated **sticker/image library** + **URL
  paste**. Real **upload** (Storage + Storage-RLS + moderation) lands with Step 5 media; the _shape_ is
  correct now, so upload is additive.

**`dataSources`** [RESERVED Step 4b] — the missing **source-data tier** (Pudding separates copy /
config / source data; big or messy data is processed server-side):

```ts
type DataSourceRef =
	| { kind: 'csv' | 'json'; path: string } // processed via +page.server, browser gets only what it needs
	| { kind: 'inline'; rows: Json[] }; // small data only
```

Chart/`dataViz` blocks reference a **named dataset** (`dataRef: "main"`), never inline rows. Copy stays
inline in the document (right for beginners — no ArchieML; see [roadmap-and-decisions.md](roadmap-and-decisions.md)).

---

## 9. Pudding mapping & synonyms

The model expresses all four Pudding story shapes; **MVP supports the linear-scrolly-essay shape**, the
rest are [RESERVED] (need an app-level `mode`/`uiState` layer — see roadmap):

| Pudding pattern                  | Our representation                                                                |
| -------------------------------- | --------------------------------------------------------------------------------- |
| Prose reading column             | `kind:'prose'` · `heading`/`richText` blocks                                      |
| Full-bleed hero / graphic        | `kind:'feature'` · `image` (+ optional overlaid heading)                          |
| Side-by-side text + media        | `kind:'split'`                                                                    |
| Sticky scrollytelling            | `kind:'scrolly'` · `role:'graphic'` + `role:'step'`(state) · `sticky-steps`       |
| Methods / sources (trust)        | `kind:'sources'` (pedagogy win — teaches citation)                                |
| Pull quote                       | a `pullQuote` block (demonstrates the registry)                                   |
| Parallax / appear-on-scroll      | block `animation: parallax`/`fade-up`                                             |
| Dataviz zoom-from-side, flocking | `dataViz` / `flockingCanvas` blocks + registry animations; no `background.effect` |

**Synonym map** (so we read the research fluently): their _Story_ = our Document · _Act_ = (absent) ·
_Scene_ = Section+`kind` · _Beat_ = `role:'step'` block + `state` · _Block_ = Block · _Trigger_ =
`animation.trigger` · _State_ = `block.state` · _Renderer_ = block `Render` + figure renderer.

---

## 10. Validation & safety invariants (contract-level)

- **All author input is Zod-validated before persistence or render.** The document `.transform()`
  rejects unknown block types and invalid props with path-aware errors.
- **URLs** → `SafeUrlSchema` (http(s)/mailto/relative only; rejects `javascript:`/`data:`). Applies to
  links, link-buttons, image `src`, and rich-text link marks.
- **Colors** → `HexColorSchema` (rejects declaration injection, `url(...)`, non-color strings).
- **Rich text** is a constrained ProseMirror subset (`schema/richtext.ts`); the renderer interprets it
  with components — **never `{@html}` of author content**, anywhere.
- **Alt text** is required to _publish_ (not to draft) via `requiredForPublish` → `publishBlockers`.
- **Heading outline**: the page `<h1>` is the zine title (metadata, §11); content headings are `h2+`,
  unskipped — checked by axe.

---

## 11. Metadata vs content (resolving the theme duplication)

| Lives in                 | What                                                                | Why                                                                                                       |
| ------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **`zines` table (meta)** | `title`, `slug`, `cover_asset_id`, denormalized card palette/accent | Gallery + OG cards need these **without parsing the document**; `title` is the single `<h1>` + share text |
| **`document` (content)** | `theme`, all `sections`/`blocks`                                    | Presentation is content; it must **snapshot with `zine_versions`** so reverting restores the look         |

**Resolution of the live `zines.theme` vs `document.theme` duplication** [COMMITTED]: theme is
**authoritative in the document**; `zines` keeps only the **denormalized card projection** (palette/
accent), set on publish. Title/cover are page chrome from metadata, edited in the toolbar — not blocks.
Trade-off: less bespoke cover design, bought for one `<h1>`, a consistent gallery/OG card, and a single
source of truth. [REJECTED] a "cover section" with special-cased blocks.

Publish MUST update these surfaces atomically: parse the draft document, create the immutable
`zine_versions` snapshot, set publication metadata, and copy only the card projection from
`document.theme` into `zines`. The editor never writes `zines.theme` as an independent source of truth.

---

## 12. Explicitly out of the data model (and why)

- **[REJECTED] Act tier / Scene/Beat naming** — over-structure + jargon for ages 11–16.
- **[REJECTED] App-level modes / branching graphs / `uiState`** in the document — those power the
  explorer/collection/diary shapes; the linear essay (MVP) doesn't need them and they'd bloat the
  editor. Reserved as a future top-level layer, not retrofitted into sections.
- **[REJECTED] Student-authored custom components / arbitrary code** — an unacceptable safety and
  maintenance surface for minors. The registry _is_ the bounded escape hatch, exercised by developers.
- **[REJECTED] Inlining large datasets** — charts reference named `dataSources`; big data is processed
  server-side.
