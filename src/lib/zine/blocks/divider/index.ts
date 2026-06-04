import type { BlockDef } from '../../schema/block';
import { DividerPropsSchema, type DividerProps } from './schema';
import Render from './Render.svelte';

export const dividerBlock: BlockDef<DividerProps> = {
	type: 'divider',
	category: 'structure',
	schema: DividerPropsSchema,
	defaults: {},
	allowedAnimations: ['fade-up'],
	Render
};
