import { z } from 'zod';

// Heading block = an in-content subheading. The page renders the zine TITLE as the
// single <h1>, so content headings start at level 2 — this keeps a valid, unskipped
// heading outline (an accessibility requirement, checked by axe in tests).
export const HeadingPropsSchema = z.object({
	text: z.string().min(1),
	level: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(2)
});

export type HeadingProps = z.infer<typeof HeadingPropsSchema>;
