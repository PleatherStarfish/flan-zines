import type { Component } from 'svelte';
import type { ZodType } from 'zod';
import type { AnimationType } from './types';

// The block extension contract (IMPLEMENTATION_PLAN.md §2, data-model.md §5). A block
// is one module satisfying this interface; register it and the validator, renderer,
// AND editor adapt with no core edits.
//
// Refinement vs §2: `Render` receives only `props`. Block style and the `animation`
// descriptor are applied by the renderer's shared BlockFrame wrapper, NOT per block.
// This keeps every block animation-agnostic, so adding an animation preset (Step 4)
// never touches a block's Render — strengthening "the registry is the only
// extension point."

export type BlockCategory = 'text' | 'media' | 'structure' | 'interactive';

export interface BlockRenderProps<P> {
	props: P;
}

// The editor half of a block. `onChange` MUST be validated against `schema` by the
// inspector host before committing — invalid input never mutates the document.
export interface BlockInspectorProps<P> {
	value: P;
	onChange: (next: P) => void;
}

// Structured accessibility fallback for blocks whose visual output is opaque to
// assistive tech (canvas/SVG/chart). Deliberately not a bare string (data-model.md §5).
export type A11yFallback =
	| { kind: 'text'; text: string }
	| {
			kind: 'table';
			caption: string;
			columns: { key: string; label: string }[];
			rows: Record<string, string | number | boolean | null>[];
	  }
	| { kind: 'text-with-table'; text: string; table: Extract<A11yFallback, { kind: 'table' }> };

export interface A11yContext {
	/** Resolved, already server-filtered data for dataViz fallbacks (Step 4b). */
	dataSources?: Record<string, unknown>;
}

export interface BlockDef<P, S = never> {
	/** Stable, unique discriminator stored in the document. */
	type: string;
	/** Human-facing name used by the editor palette / outline. */
	label: string;
	category: BlockCategory;
	/** Validates this block's props at save / publish / render. */
	schema: ZodType<P>;
	/** Valid default props (must pass `schema` — enforced by the registry test). */
	defaults: P;
	/** Animation presets this block may use (validated against the animation registry in Step 4). */
	allowedAnimations: AnimationType[];
	/** The published component. Shared by the reader and the editor preview. */
	Render: Component<BlockRenderProps<P>>;
	/** The editor inspector (content + style fields). Schema-validated by the host. */
	Inspector: Component<BlockInspectorProps<P>>;
	/** Publish-time gate, e.g. `["Add alt text"]`. Empty/undefined = nothing blocking. */
	requiredForPublish?: (props: P) => string[];
	/** Per-step figure state shape, for blocks used as a scrolly graphic. [RESERVED Step 4] */
	stateSchema?: ZodType<S>;
	/** Text/table alternative for canvas/chart blocks. [COMMITTED for new opaque blocks] */
	a11yFallback?: (props: P, ctx: A11yContext) => A11yFallback | null;
}

// The registry is heterogeneous (P varies per block), so its stored value erases P.
// This is the ONLY place `any` is permitted: each block's own BlockDef<P> stays
// fully typed via registerBlock<P>(), and the document schema validates props at
// parse time, so nothing untyped escapes into application code.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyBlockDef = BlockDef<any>;
