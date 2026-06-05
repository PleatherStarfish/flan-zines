import type { BackgroundDef, BackgroundFactory } from '../../contract';
import { AMOUNT_KNOB, SPEED_KNOB, TINT_KNOB } from '../../schema';
import { FishFlockParamsSchema, type FishFlockParams } from './schema';

export const fishFlockBackground: BackgroundDef<FishFlockParams> = {
	type: 'fish-flock',
	label: 'Schooling fish',
	engine: 'canvas2d',
	icon: '🐟',
	schema: FishFlockParamsSchema,
	defaults: FishFlockParamsSchema.parse({}),
	knobs: [AMOUNT_KNOB, SPEED_KNOB, TINT_KNOB],
	reducedMotion: 'still-frame',
	fps: 36,
	needsPointer: true,
	load: () => import('./impl').then((m) => m as BackgroundFactory<FishFlockParams>)
};
