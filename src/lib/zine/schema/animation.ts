import { z } from 'zod';

// A declarative animation descriptor on a block or section. The full per-preset
// validation (unknown type / unsupported trigger / invalid params rejected) lives in
// the AnimationDef registry in Step 4 (data-model.md §7). Here we validate only the
// SHAPE — a non-empty `type`, an optional `trigger`, and arbitrary preset params,
// carried through (not stripped).
//
// IMPORTANT: in Step 3 the renderer does NOT apply animations. Descriptors are part
// of the document contract so the schema, editor, and renderer agree on their shape
// before motion is wired in. A static render is also the reduced-motion / graceful-
// degradation baseline (docs/best-practices/scrollytelling.md §6).

// The trigger vocabulary Step 4's registry will validate against. Kept here as the
// canonical list; the descriptor schema stays permissive until then.
export const ANIMATION_TRIGGERS = ['scroll', 'enter-view', 'tap', 'time'] as const;
export type AnimationTrigger = (typeof ANIMATION_TRIGGERS)[number];

export const AnimationDescriptorSchema = z
	.object({
		type: z.string().min(1),
		trigger: z.string().optional()
	})
	.catchall(z.unknown());

export type AnimationDescriptor = z.infer<typeof AnimationDescriptorSchema>;

// v3 scene-timeline effects are references resolved through the AnimationDef registry
// (scene-timeline.md §5). The full registry lands in Increment 4; until then the
// registry is intentionally empty, so effect references validate only when absent.
export const REGISTERED_EFFECT_IDS = [] as const;
export type EffectId = (typeof REGISTERED_EFFECT_IDS)[number];

export const EffectRefSchema = z.object({
	type: z
		.string()
		.min(1)
		.refine((type) => (REGISTERED_EFFECT_IDS as readonly string[]).includes(type), {
			message: 'Unknown effect type.'
		}),
	params: z.record(z.string(), z.unknown()).optional()
});
export type EffectRef = z.infer<typeof EffectRefSchema>;
