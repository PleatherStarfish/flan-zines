import { z } from 'zod';
import type { KnobMeta } from './contract';

// The shared "knob" vocabulary for the inspector funnel (scene-timeline.md §6): at most
// three chips per effect — Speed, Direction, Amount — never a number, easing curve, or
// pixel field. Each effect's params schema is built from these so the picker reads
// identically across the whole catalogue.

export const SpeedSchema = z.enum(['slow', 'medium', 'fast']);
export type Speed = z.infer<typeof SpeedSchema>;

export const AmountSchema = z.enum(['subtle', 'medium', 'strong']);
export type Amount = z.infer<typeof AmountSchema>;

export const DirectionSchema = z.enum(['up', 'down', 'left', 'right']);
export type Direction = z.infer<typeof DirectionSchema>;

export const AxisDirectionSchema = z.enum(['up', 'down']);
export type AxisDirection = z.infer<typeof AxisDirectionSchema>;

export const SPEED_KNOB: KnobMeta = {
	key: 'speed',
	label: 'Speed',
	options: [
		{ value: 'slow', label: 'Slow' },
		{ value: 'medium', label: 'Medium' },
		{ value: 'fast', label: 'Fast' }
	]
};
export const AMOUNT_KNOB: KnobMeta = {
	key: 'amount',
	label: 'Amount',
	options: [
		{ value: 'subtle', label: 'Subtle' },
		{ value: 'medium', label: 'Medium' },
		{ value: 'strong', label: 'Strong' }
	]
};
export const DIRECTION_KNOB: KnobMeta = {
	key: 'direction',
	label: 'Direction',
	options: [
		{ value: 'up', label: 'Up' },
		{ value: 'down', label: 'Down' },
		{ value: 'left', label: 'Left' },
		{ value: 'right', label: 'Right' }
	]
};
export const AXIS_DIRECTION_KNOB: KnobMeta = {
	key: 'direction',
	label: 'Direction',
	options: [
		{ value: 'up', label: 'Up' },
		{ value: 'down', label: 'Down' }
	]
};
// For effects that enter from a screen EDGE: the value is the side the element comes from.
export const FROM_KNOB: KnobMeta = {
	key: 'direction',
	label: 'From',
	options: [
		{ value: 'left', label: 'Left' },
		{ value: 'right', label: 'Right' },
		{ value: 'up', label: 'Top' },
		{ value: 'down', label: 'Bottom' }
	]
};

// ── Per-effect params (≤3 knobs each) ───────────────────────────────────────────────

export const FadeParamsSchema = z.object({ speed: SpeedSchema.default('medium') });
export type FadeParams = z.infer<typeof FadeParamsSchema>;

export const RiseParamsSchema = z.object({
	speed: SpeedSchema.default('medium'),
	amount: AmountSchema.default('medium'),
	direction: AxisDirectionSchema.default('up')
});
export type RiseParams = z.infer<typeof RiseParamsSchema>;

export const SlideParamsSchema = z.object({
	speed: SpeedSchema.default('medium'),
	amount: AmountSchema.default('medium'),
	direction: DirectionSchema.default('left')
});
export type SlideParams = z.infer<typeof SlideParamsSchema>;

export const PopParamsSchema = z.object({
	speed: SpeedSchema.default('medium'),
	amount: AmountSchema.default('medium')
});
export type PopParams = z.infer<typeof PopParamsSchema>;

// Fly in: the element starts fully OFF the screen edge and scrolls all the way on. Unlike
// `slide` (a small nudge), the travel is a whole viewport, so it can "scroll on from the
// top/left" — `direction` is the edge it comes from.
export const FlyInParamsSchema = z.object({
	speed: SpeedSchema.default('medium'),
	direction: DirectionSchema.default('left')
});
export type FlyInParams = z.infer<typeof FlyInParamsSchema>;

export const ParallaxParamsSchema = z.object({
	speed: SpeedSchema.default('medium'),
	amount: AmountSchema.default('medium'),
	direction: AxisDirectionSchema.default('up')
});
export type ParallaxParams = z.infer<typeof ParallaxParamsSchema>;

export const FloatParamsSchema = z.object({
	speed: SpeedSchema.default('medium'),
	amount: AmountSchema.default('subtle')
});
export type FloatParams = z.infer<typeof FloatParamsSchema>;

export const KenBurnsParamsSchema = z.object({
	speed: SpeedSchema.default('slow'),
	amount: AmountSchema.default('subtle')
});
export type KenBurnsParams = z.infer<typeof KenBurnsParamsSchema>;
