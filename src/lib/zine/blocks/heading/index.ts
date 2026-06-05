import type { BlockDef } from '../../schema/block';
import { HeadingPropsSchema, type HeadingProps } from './schema';
import Render from './Render.svelte';
import Inspector from './Inspector.svelte';

export const headingBlock: BlockDef<HeadingProps> = {
	type: 'heading',
	label: 'Heading',
	category: 'text',
	schema: HeadingPropsSchema,
	defaults: { text: 'Section heading', level: 2 },
	allowedAnimations: ['fade', 'rise', 'slide', 'pop', 'fly-in', 'path'],
	Render,
	Inspector
};
