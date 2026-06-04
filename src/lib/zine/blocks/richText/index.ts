import type { BlockDef } from '../../schema/block';
import { RichTextPropsSchema, type RichTextProps } from './schema';
import Render from './Render.svelte';

export const richTextBlock: BlockDef<RichTextProps> = {
	type: 'richText',
	category: 'text',
	schema: RichTextPropsSchema,
	defaults: {
		doc: {
			type: 'doc',
			content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Start writing…' }] }]
		}
	},
	allowedAnimations: ['fade-up'],
	Render
};
