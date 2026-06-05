import { z } from 'zod';
import type { KnobMeta } from '../../../animations/contract';

// A generative fog/cloud background — soft colour clouds painted from the theme palette,
// with control over where they pool, how many there are, how much they move, and how strong
// the colour reads. Backgrounds are a creative surface, so this preset carries more knobs
// than an element effect (which stays ≤3).
//   • colours    — WHICH theme swatches participate (indices; empty = all). Fed live via
//                  BackgroundInput.palette.
//   • placement  — where the clouds pool: toward the edges, the centre, or scattered.
//   • count      — how many cloud control points (more = busier, richer texture).
//   • motion     — how much the clouds move (still → flowing), or shift on scroll.
//   • opacity    — how strong/visible the colour is (faint whisper → vivid).
export const OrganicGradientParamsSchema = z.object({
	colors: z.array(z.number().int().min(0)).max(8).default([]),
	placement: z.enum(['edges', 'center', 'scattered']).default('scattered'),
	count: z.enum(['few', 'some', 'many']).default('some'),
	motion: z.enum(['still', 'gentle', 'flowing', 'scroll']).default('gentle'),
	opacity: z.enum(['faint', 'soft', 'bold', 'vivid']).default('soft')
});
export type OrganicGradientParams = z.infer<typeof OrganicGradientParamsSchema>;

// "Which colours participate" is a multi-select over the LIVE theme swatches — its options
// come from the document theme, not from here (see KnobMeta.kind === 'theme-swatches').
export const COLORS_KNOB: KnobMeta = {
	key: 'colors',
	label: 'Colours',
	kind: 'theme-swatches',
	options: []
};

export const PLACEMENT_KNOB: KnobMeta = {
	key: 'placement',
	label: 'Where',
	options: [
		{ value: 'edges', label: 'Edges' },
		{ value: 'center', label: 'Center' },
		{ value: 'scattered', label: 'Scattered' }
	]
};

export const COUNT_KNOB: KnobMeta = {
	key: 'count',
	label: 'Clouds',
	options: [
		{ value: 'few', label: 'Few' },
		{ value: 'some', label: 'Some' },
		{ value: 'many', label: 'Many' }
	]
};

export const MOTION_KNOB: KnobMeta = {
	key: 'motion',
	label: 'Movement',
	options: [
		{ value: 'still', label: 'Still' },
		{ value: 'gentle', label: 'Gentle' },
		{ value: 'flowing', label: 'Flowing' },
		{ value: 'scroll', label: 'On scroll' }
	]
};

export const OPACITY_KNOB: KnobMeta = {
	key: 'opacity',
	label: 'Strength',
	options: [
		{ value: 'faint', label: 'Faint' },
		{ value: 'soft', label: 'Soft' },
		{ value: 'bold', label: 'Bold' },
		{ value: 'vivid', label: 'Vivid' }
	]
};
