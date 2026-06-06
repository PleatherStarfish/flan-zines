import { z } from 'zod';
import { RichTextDocSchema } from '../../schema/richtext';

// Rich text is stored as the validated document subset (see schema/richtext.ts).
// The focused text editor produces this JSON; the renderer only interprets it.
export const RichTextPropsSchema = z.object({
	doc: RichTextDocSchema
});

export type RichTextProps = z.infer<typeof RichTextPropsSchema>;
