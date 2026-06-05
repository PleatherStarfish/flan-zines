import type { BackgroundDef, BackgroundFactory } from '../../contract';
import {
	COLORS_KNOB,
	COUNT_KNOB,
	MOTION_KNOB,
	OPACITY_KNOB,
	PLACEMENT_KNOB,
	OrganicGradientParamsSchema,
	type OrganicGradientParams
} from './schema';

// A calm generative fog/cloud gradient that paints with the document theme's colours
// (BackgroundInput.palette). Canvas2D — large, soft, low-opacity clouds whose control points
// drift independently and shift subtly on scroll. Lazily imported; reduced motion → one still
// frame (the runtime policy).
export const organicGradientBackground: BackgroundDef<OrganicGradientParams> = {
	type: 'organic-gradient',
	label: 'Soft clouds',
	engine: 'canvas2d',
	icon: '🌫️',
	schema: OrganicGradientParamsSchema,
	defaults: OrganicGradientParamsSchema.parse({}),
	knobs: [COLORS_KNOB, PLACEMENT_KNOB, COUNT_KNOB, MOTION_KNOB, OPACITY_KNOB],
	reducedMotion: 'still-frame',
	fps: 30,
	needsPointer: false,
	load: () => import('./impl').then((m) => m as BackgroundFactory<OrganicGradientParams>)
};
