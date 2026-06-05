import { z } from 'zod';
import { AmountSchema, SpeedSchema, TintSchema } from '../../schema';

// A school of tiny boids that flocks, gently follows the cursor, wanders slowly when the
// reader is still, and surges in the scroll direction while scrolling. ≤3 knobs.
export const FishFlockParamsSchema = z.object({
	density: AmountSchema.default('medium'),
	speed: SpeedSchema.default('medium'),
	tint: TintSchema.default('cool')
});
export type FishFlockParams = z.infer<typeof FishFlockParamsSchema>;
