import { z } from 'zod';

// A declarative animation descriptor on a block or section. Per-preset parameter
// schemas (and the registry that validates them) arrive with the animation system
// in Step 4; here we validate only the SHAPE — a non-empty preset `type` plus
// arbitrary preset params, which are carried through, not stripped.
//
// IMPORTANT: in Step 2 the renderer does NOT apply animations. Descriptors are part
// of the document contract now so the schema, editor, and renderer agree on their
// shape before motion is wired in. A static render is also the reduced-motion and
// graceful-degradation baseline (see docs/best-practices/scrollytelling.md).
export const AnimationDescriptorSchema = z
	.object({ type: z.string().min(1) })
	.catchall(z.unknown());

export type AnimationDescriptor = z.infer<typeof AnimationDescriptorSchema>;
