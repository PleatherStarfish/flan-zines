import type { BlockDef } from '../../schema/block';
import { RichTextPropsSchema, type RichTextProps } from './schema';
import Render from './Render.svelte';
import Inspector from './Inspector.svelte';

export const richTextBlock: BlockDef<RichTextProps> = {
	type: 'richText',
	label: 'Text',
	category: 'text',
	schema: RichTextPropsSchema,
	defaults: {
		doc: {
			type: 'doc',
			content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Start writing…' }] }]
		}
	},
	allowedAnimations: ['fade', 'rise', 'slide', 'fly-in'],
	Render,
	Inspector
};
