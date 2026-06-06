import type { BackgroundDef, BackgroundFactory } from '../../contract';
import { AMOUNT_KNOB, SPEED_KNOB, TINT_KNOB } from '../../schema';
import { DriftFieldParamsSchema, type DriftFieldParams } from './schema';

export const driftFieldBackground: BackgroundDef<DriftFieldParams> = {
	type: 'drift-field',
	label: 'Rain streaks',
	engine: 'canvas2d',
	icon: '╱',
	schema: DriftFieldParamsSchema,
	defaults: DriftFieldParamsSchema.parse({}),
	knobs: [AMOUNT_KNOB, SPEED_KNOB, TINT_KNOB],
	reducedMotion: 'still-frame',
	fps: 30,
	needsPointer: true,
	load: () => import('./impl').then((m) => m as BackgroundFactory<DriftFieldParams>)
};
