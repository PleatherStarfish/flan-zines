import type { ZodType } from 'zod';

// The animation extension contract — the SECOND registry (IMPLEMENTATION_PLAN.md §2,
// scene-timeline.md §5). An effect is one `AnimationDef`; register it and the schema,
// inspector funnel, timeline, and renderer all adapt with NO core edits.
//
// This is the v3 (scene-timeline) shape, which supersedes the older AnimationDescriptor
// contract sketched in data-model.md §7: effects are EffectRefs placed in an Element's
// `enter` / `exit` / `motion` slots, driven by one scroll-progress signal per scene.
// Every effect is transform/opacity-only, lazy-loaded, and has a mandatory
// reduced-motion fallback — the safety + performance boundary for ages 11–16.

/** Funnel B categories (scene-timeline.md §6). `magic` / `data` are RESERVED for 4b. */
export type EffectGroup = 'appear' | 'motion';

/** The three things a clip can do: appear, hold-with-motion, leave. */
export type EffectSlot = 'enter' | 'exit' | 'motion';

/**
 * Reduced-motion fallback policy (data-model.md §7). For the Step-4 transform/opacity
 * catalogue, `static` means "render the element in its neutral, fully-visible state";
 * the renderer enforces it globally under `prefers-reduced-motion`.
 */
export type ReducedMotionFallback = 'static' | 'passthrough';

/**
 * What the renderer feeds an effect each frame. `phase` is already normalised by the
 * renderer for the slot being drawn:
 *   enter : 0 at range.start → 1 once the appear ramp completes  (1 = neutral / visible)
 *   exit  : 1 at the exit ramp's start → 0 at range.end          (1 = neutral, 0 = gone)
 *   motion: 0..1 across the element's whole on-screen hold
 * Appear effects therefore work in BOTH the enter and exit slots from one definition.
 */
export interface EffectFrame<P = unknown> {
	phase: number;
	params: P;
}

/**
 * Transform/opacity ONLY — enforced by the shape, not by convention. No raw CSS string
 * is ever accepted from an effect, so a preset can't smuggle in a layout-thrashing or
 * unsafe declaration (scrollytelling.md §5; data-model.md §10).
 */
export interface EffectStyle {
	opacity?: number;
	transform?: string;
}

/** The runtime an effect's lazy `load()` resolves to: a pure phase → style function. */
export type EffectImpl<P = unknown> = (frame: EffectFrame<P>) => EffectStyle;

/** Inspector chip (recognition over recall: words/pictures, never a number field). */
export interface KnobMeta {
	/** The param key this chip writes, e.g. `speed`. */
	key: string;
	/** Student-facing label, e.g. `Speed`. */
	label: string;
	/**
	 * How the inspector renders the knob. `select` (default) = single-choice chips drawn from
	 * `options`. `multiselect` = toggle several of `options` (the param holds an array).
	 * `theme-swatches` = toggle over the LIVE document theme swatches — a theme-aware
	 * background's "which colours participate" control; the param holds an array of swatch
	 * indices and `options` is unused (the choices come from the theme, not from here).
	 */
	kind?: 'select' | 'multiselect' | 'theme-swatches';
	options: { value: string; label: string }[];
}

/**
 * One curated effect. Adding an effect = one `AnimationDef` registered in
 * `animations/registry.ts`; nothing in the core renderer/editor changes.
 */
export interface AnimationDef<P = unknown> {
	/** Stable EffectId stored in the document (`EffectRef.type`). */
	type: string;
	/** Student-facing name shown in the funnel. */
	label: string;
	group: EffectGroup;
	/** Which Element slots this effect may fill. */
	slots: EffectSlot[];
	/** Emoji/thumbnail hint for the picker (kept light; no asset pipeline needed). */
	icon: string;
	/** Validates `EffectRef.params` (and supplies path-aware errors). */
	schema: ZodType<P>;
	/** Valid default params (must pass `schema` — enforced by the registry test). */
	defaults: P;
	/** ≤3 inspector chips. */
	knobs: KnobMeta[];
	reducedMotion: ReducedMotionFallback;
	/** Lazy import → the impl stays out of a text-only zine's base bundle. */
	load: () => Promise<EffectImpl<P>>;
}

// The registry is heterogeneous (P varies per effect), so its stored value erases P.
// Each effect's own AnimationDef<P> stays fully typed via registerEffect<P>(), and the
// document schema validates params at parse time, so nothing untyped escapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyAnimationDef = AnimationDef<any>;
