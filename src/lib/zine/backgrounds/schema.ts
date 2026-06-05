import { z } from 'zod';
import type { KnobMeta } from '../animations/contract';
import { AMOUNT_KNOB, AmountSchema, SPEED_KNOB, SpeedSchema } from '../animations/schema';

// Backgrounds reuse the effect knob vocabulary (Speed / Amount) so the inspector reads
// identically, plus a curated colour "tint" so a sketch matches the zine without a raw
// colour field. Resolved to RGB by the preset impl.
export { AMOUNT_KNOB, AmountSchema, SPEED_KNOB, SpeedSchema };

export const TintSchema = z.enum(['ink', 'accent', 'cool', 'warm', 'mono']);
export type Tint = z.infer<typeof TintSchema>;

export const TINT_RGB: Record<Tint, [number, number, number]> = {
	ink: [20, 24, 31],
	accent: [228, 87, 46],
	cool: [70, 120, 200],
	warm: [230, 150, 60],
	mono: [120, 124, 130]
};

export const TINT_KNOB: KnobMeta = {
	key: 'tint',
	label: 'Colour',
	options: [
		{ value: 'ink', label: 'Ink' },
		{ value: 'accent', label: 'Accent' },
		{ value: 'cool', label: 'Cool' },
		{ value: 'warm', label: 'Warm' },
		{ value: 'mono', label: 'Mono' }
	]
};
