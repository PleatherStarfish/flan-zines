import { z } from 'zod';
import { effectIds, getEffect } from '../animations/registry';

// Re-export the effect registry's contract types so the editor + schema share one
// import surface for animation concerns.
export type {
	AnimationDef,
	AnyAnimationDef,
	EffectGroup,
	EffectSlot,
	KnobMeta
} from '../animations/contract';

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
// (scene-timeline.md §5). Like BlockSchema, the ref is parsed THROUGH the registry: an
// unknown effect type, or params that fail that effect's own schema, are rejected with
// path-aware errors, and the normalized/defaulted params are returned. The registry is
// the single source of truth for which effects exist and what they accept.
export type EffectId = string;

/** The currently registered effect ids (for tests, inspectors, and migrations). */
export function registeredEffectIds(): string[] {
	return effectIds();
}

export const EffectRefSchema = z
	.object({
		type: z.string().min(1),
		params: z.record(z.string(), z.unknown()).optional()
	})
	.transform((ref, ctx) => {
		const def = getEffect(ref.type);
		if (!def) {
			ctx.addIssue({
				code: 'custom',
				path: ['type'],
				message: `Unknown effect type: "${ref.type}".`
			});
			return z.NEVER;
		}
		const result = def.schema.safeParse(ref.params ?? {});
		if (!result.success) {
			for (const issue of result.error.issues) {
				ctx.addIssue({ code: 'custom', path: ['params', ...issue.path], message: issue.message });
			}
			return z.NEVER;
		}
		return { type: ref.type, params: result.data as Record<string, unknown> };
	});
export type EffectRef = z.infer<typeof EffectRefSchema>;
