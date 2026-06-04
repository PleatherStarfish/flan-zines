import { z } from 'zod';

// Vertical breathing room. Decorative — the Render marks it aria-hidden.
export const SpacerPropsSchema = z.object({
	size: z.enum(['sm', 'md', 'lg']).default('md')
});

export type SpacerProps = z.infer<typeof SpacerPropsSchema>;
