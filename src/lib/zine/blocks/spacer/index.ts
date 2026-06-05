import type { BlockDef } from '../../schema/block';
import { SpacerPropsSchema, type SpacerProps } from './schema';
import Render from './Render.svelte';
import Inspector from './Inspector.svelte';

export const spacerBlock: BlockDef<SpacerProps> = {
	type: 'spacer',
	label: 'Space',
	category: 'structure',
	schema: SpacerPropsSchema,
	defaults: { size: 'md' },
	allowedAnimations: [],
	Render,
	Inspector
};
