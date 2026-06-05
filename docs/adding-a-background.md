# Playbook: add a background

**Audience: AI (and humans) extending the scene-background catalogue.** A background is a curated,
student-pickable scene backdrop — an interactive canvas sketch (Canvas2D or WebGL) or a media fill.
The **background registry is the third extension point** (alongside [blocks](adding-a-block.md) and
[effects](adding-an-effect.md)): adding one touches _only_ new files plus one registration line. If you
find yourself editing `render/SceneBackground.svelte`, `backgrounds/runtime.ts`, `schema/document.ts`,
or the editor to special-case a preset, stop — that is a design smell and a review blocker.

## The contract

Every background is a [`BackgroundDef<P>`](../src/lib/zine/backgrounds/contract.ts):

```ts
interface BackgroundDef<P> {
	type: string; // unique id stored in the document (background.fill.preset)
	label: string; // student-facing name in the picker
	engine: 'canvas2d' | 'webgl' | 'p5' | 'three' | 'd3'; // metadata; the preset owns getContext
	icon: string; // emoji/thumbnail hint
	schema: ZodType<P>; // validates background.fill.params (≤3 knobs)
	defaults: P; // must pass `schema` (registry test enforces it)
	knobs: KnobMeta[]; // the ≤3 inspector chips
	reducedMotion: 'static' | 'still-frame' | 'off'; // MANDATORY fallback policy
	fps: number; // frame cap (the Chromebook budget; ambient backgrounds stay low)
	needsPointer: boolean; // whether the preset reads the cursor
	load: () => Promise<BackgroundFactory<P>>; // lazy → a heavy engine never enters the base bundle
}
```

The **runtime owns the whole lifecycle** ([`runtime.ts`](../src/lib/zine/backgrounds/runtime.ts)) so a
preset stays a pure draw: mount near-viewport (IntersectionObserver), one FPS-capped rAF loop, resize in
DPR-capped device px, pause off-screen + when the tab hides, a reduced-motion still frame, and teardown.
A preset only implements `mount(canvas, params) → { frame, resize, destroy }`.

The runtime feeds each `frame` a [`BackgroundInput`](../src/lib/zine/backgrounds/contract.ts):
`progress` (0..1 scene scroll), `pointer`, `width`/`height` (device px), `time` (ms), `reducedMotion`,
`lowPower`, and **`palette`** — the document theme's swatch colours as RGB triplets, so a background can
paint with the student's own colours instead of a fixed tint.

Three rules that keep backgrounds safe, fast, and accessible:

- **Pure draw, runtime owns the loop.** Never start your own rAF/timer; read `BackgroundInput` and draw.
- **Lazy `load()`.** The impl is `import()`-ed on demand, so a text-only zine ships zero background code.
- **Declare `reducedMotion` + degrade gracefully.** `still-frame` draws one frame then stops. A preset
  that needs a context that may be missing (e.g. WebGL2) MUST fall back rather than break the page.

## The recipe (schema + impl + 1 line)

A preset lives in its own folder: `backgrounds/presets/<name>/{schema.ts, impl.ts, index.ts}`. The
worked example below is the Canvas2D **organic-gradient** (soft fog/clouds) preset.

**1. Params schema + knobs** — [`presets/organic-gradient/schema.ts`](../src/lib/zine/backgrounds/presets/organic-gradient/schema.ts).
Backgrounds are a creative "wallpaper" surface, so a preset may carry up to **6 knobs** (more than
an element effect, which stays ≤3 for young students) — still few and recognisable. A knob can be a
single-select (default), a `multiselect`, or a `theme-swatches` toggle whose choices come from the
**live theme** (its `options` stay empty):

```ts
export const OrganicGradientParamsSchema = z.object({
	colors: z.array(z.number().int().min(0)).max(8).default([]), // which theme swatches participate
	placement: z.enum(['edges', 'center', 'scattered']).default('scattered'), // where clouds pool
	count: z.enum(['few', 'some', 'many']).default('some'), // how many control points
	motion: z.enum(['still', 'gentle', 'flowing', 'scroll']).default('gentle'), // how much it moves
	opacity: z.enum(['faint', 'soft', 'bold', 'vivid']).default('soft') // how strong the colour reads
});

export const COLORS_KNOB: KnobMeta = {
	key: 'colors',
	label: 'Colours',
	kind: 'theme-swatches',
	options: []
};
```

**2. Impl** — [`presets/organic-gradient/impl.ts`](../src/lib/zine/backgrounds/presets/organic-gradient/impl.ts).
Export `mount(canvas, params): BackgroundInstance`. Read `input.palette` to paint with the theme's
colours; read `input.progress`/`input.time` for motion; halve work when `input.lowPower`. The
organic-gradient draws a few large, soft, low-opacity radial clouds whose control points drift
**independently** (and shift independently on scroll), so the field deforms rather than translating as a
unit — calm by design. For a heavier shader-based preset, the shared
[`webgl.ts`](../src/lib/zine/backgrounds/webgl.ts) fullscreen-shader helper is kept available (it returns
`null` when WebGL2 is unavailable — fall back to a Canvas2D draw so the page never breaks).

**3. Register it** — one line in [`backgrounds/registry.ts`](../src/lib/zine/backgrounds/registry.ts):

```ts
registerBackground(organicGradientBackground);
```

That is the whole change. `SceneBackgroundSchema` now validates the preset's params, the
`BackgroundPicker` offers it (rendering each knob `kind` generically), and the renderer mounts it — no
core edits.

## Theme-aware colours

To paint with the student's palette, read `input.palette` (RGB triplets, theme order) each frame and let
a `theme-swatches` knob store which entries participate (indices; empty = all). The renderer resolves the
theme → `BackgroundInput.palette` for you ([`ZineRenderer.svelte`](../src/lib/zine/render/ZineRenderer.svelte)
→ `themeSwatchesRgb`); editing the theme updates the background live (no remount).

## Tests to add

- The shared [registry test](../src/lib/zine/backgrounds/registry.test.ts) already covers `defaults`
  pass `schema`, a valid engine/fallback/fps, ≤3 knobs, and a lazy `mount()` — once your preset is added
  to its `CATALOGUE` (and any new engine to `ENGINES`).
- Extract any non-trivial pure helper (e.g. colour selection) and unit-test it; a GPU/canvas draw itself
  is not reliably testable headless.
- Add a deterministic visual entry to [`Backgrounds.stories.ts`](../src/lib/zine/backgrounds/Backgrounds.stories.ts).

## Checklist

- [ ] New `schema.ts` + `impl.ts` + `index.ts`; **no edits** to `SceneBackground` / `runtime.ts` /
      `document.ts` to special-case it.
- [ ] Pure draw (runtime owns the loop); lazy `load()`; `reducedMotion` declared; ≤3 knobs.
- [ ] Degrades gracefully when its context/engine is unavailable.
- [ ] Registered in `backgrounds/registry.ts`; added to the registry test's `CATALOGUE` (+ `ENGINES` for
      a new engine).
- [ ] Storybook story + `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build` green.
