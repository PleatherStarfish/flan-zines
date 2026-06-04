import type { BlockDef } from '../../schema/block';
import { HeadingPropsSchema, type HeadingProps } from './schema';
import Render from './Render.svelte';

export const headingBlock: BlockDef<HeadingProps> = {
	type: 'heading',
	category: 'text',
	schema: HeadingPropsSchema,
	defaults: { text: 'Section heading', level: 2 },
	allowedAnimations: ['fade-up'],
	Render
};
