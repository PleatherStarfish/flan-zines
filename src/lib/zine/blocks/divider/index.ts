import type { BlockDef } from '../../schema/block';
import { DividerPropsSchema, type DividerProps } from './schema';
import Render from './Render.svelte';
import Inspector from './Inspector.svelte';

export const dividerBlock: BlockDef<DividerProps> = {
	type: 'divider',
	label: 'Divider',
	category: 'structure',
	schema: DividerPropsSchema,
	defaults: {},
	allowedAnimations: ['fade'],
	Render,
	Inspector
};
