import type { Component } from 'svelte';
import type { ZodType } from 'zod';
import type { AnimationType } from './types';

// The block extension contract (IMPLEMENTATION_PLAN.md §2). A block is one module
// satisfying this interface; register it and the validator + renderer adapt with no
// core edits. The editor's Inspector is added per-block in Step 3.
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

export interface BlockDef<P> {
	/** Stable, unique discriminator stored in the document. */
	type: string;
	category: BlockCategory;
	/** Validates this block's props at save / publish / render. */
	schema: ZodType<P>;
	/** Valid default props (must pass `schema` — enforced by the registry test). */
	defaults: P;
	/** Animation presets this block may use (validated against the animation registry in Step 4). */
	allowedAnimations: AnimationType[];
	/** The published component. Shared by the reader and the editor preview. */
	Render: Component<BlockRenderProps<P>>;
	/** Publish-time gate, e.g. `["Add alt text"]`. Empty/undefined = nothing blocking. */
	requiredForPublish?: (props: P) => string[];
}

// The registry is heterogeneous (P varies per block), so its stored value erases P.
// This is the ONLY place `any` is permitted: each block's own BlockDef<P> stays
// fully typed via registerBlock<P>(), and the document schema validates props at
// parse time, so nothing untyped escapes into application code.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyBlockDef = BlockDef<any>;
