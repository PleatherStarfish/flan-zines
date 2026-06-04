import { z } from 'zod';
import { SafeUrlSchema } from '../../schema/url';

// A link, optionally styled as a button. It is always an <a> (it navigates), never a
// <button> — semantics follow behaviour. href is scheme-checked.
export const LinkButtonPropsSchema = z.object({
	href: SafeUrlSchema,
	label: z.string().min(1),
	variant: z.enum(['link', 'button']).default('link'),
	newTab: z.boolean().default(false)
});

export type LinkButtonProps = z.infer<typeof LinkButtonPropsSchema>;
