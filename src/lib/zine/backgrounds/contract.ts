import type { ZodType } from 'zod';
import type { KnobMeta } from '../animations/contract';

// The background extension contract — the THIRD registry (alongside blocks and effects).
// A scene background can be a curated, interactive canvas sketch (Canvas2D now; P5 / Three
// / D3 in Phase 2) picked from a gallery — never author-written code, so no sandbox is
// needed. The renderer owns the whole lifecycle (mount near-viewport, FPS-capped rAF,
// resize, reduced-motion still-frame, teardown); a preset is a pure DRAW given inputs.
export type { KnobMeta };

export type BackgroundEngine = 'canvas2d' | 'webgl' | 'p5' | 'three' | 'd3';

/** Reduced-motion fallback policy. `still-frame` = draw one frame then stop; `off` = blank. */
export type BackgroundReducedMotion = 'static' | 'still-frame' | 'off';

/** What the runtime feeds a background each frame. */
export interface BackgroundInput {
	/** 0..1 scene scroll progress (from the renderer's existing single scroll signal). */
	progress: number;
	/** 0..1 viewport-normalized cursor, or `null` on touch / when the pointer left. */
	pointer: { x: number; y: number } | null;
	/** Canvas backing-store size in device px (DPR-capped) — set by the runtime. */
	width: number;
	height: number;
	/** ms since mount, for time-based ambient motion. */
	time: number;
	reducedMotion: boolean;
	/** Small/low-power screen — presets MUST halve density when true. */
	lowPower: boolean;
	/**
	 * The document theme's swatch colours (RGB, 0–255), in theme order. Lets a theme-aware
	 * background draw from the student's own palette instead of a fixed tint. Empty when the
	 * theme has no swatches; the runtime always supplies the array (never undefined).
	 */
	palette: [number, number, number][];
}

/** A live background. `resize` is called before the first `frame` and on every size change. */
export interface BackgroundInstance {
	frame(input: BackgroundInput): void;
	resize(width: number, height: number): void;
	destroy(): void;
}

/** The runtime an effect's lazy `load()` resolves to: mounts onto a host canvas. */
export interface BackgroundFactory<P = unknown> {
	mount(canvas: HTMLCanvasElement, params: P): BackgroundInstance;
}

/** One curated background. Adding one = a registry entry; no core renderer edits. */
export interface BackgroundDef<P = unknown> {
	type: string;
	label: string;
	engine: BackgroundEngine;
	icon: string;
	schema: ZodType<P>;
	defaults: P;
	knobs: KnobMeta[];
	reducedMotion: BackgroundReducedMotion;
	/** Frame-rate cap (the Chromebook budget; ambient backgrounds stay low). */
	fps: number;
	/** Whether the preset reads the cursor (drives whether we feed it the pointer). */
	needsPointer: boolean;
	/** Lazy import → a heavy engine (Three/D3/P5) never enters the base bundle. */
	load(): Promise<BackgroundFactory<P>>;
}

// Heterogeneous registry value (P varies per preset); each def stays typed via
// registerBackground<P>() and params validate at parse time, so nothing untyped escapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyBackgroundDef = BackgroundDef<any>;
