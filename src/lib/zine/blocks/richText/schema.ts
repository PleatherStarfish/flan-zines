import { z } from 'zod';
import { RichTextDocSchema } from '../../schema/richtext';

// Rich text is stored as the validated ProseMirror-subset document (see
// schema/richtext.ts). The editor (Step 3) produces it via TipTap; this block only
// renders it.
export const RichTextPropsSchema = z.object({
	doc: RichTextDocSchema
});

export type RichTextProps = z.infer<typeof RichTextPropsSchema>;
