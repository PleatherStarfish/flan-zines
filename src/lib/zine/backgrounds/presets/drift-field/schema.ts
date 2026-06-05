import { z } from 'zod';
import { AmountSchema, SpeedSchema, TintSchema } from '../../schema';

// A calm field of drifting dots that responds to scroll and cursor. ≤3 knobs.
export const DriftFieldParamsSchema = z.object({
	density: AmountSchema.default('medium'),
	speed: SpeedSchema.default('slow'),
	tint: TintSchema.default('ink')
});
export type DriftFieldParams = z.infer<typeof DriftFieldParamsSchema>;
