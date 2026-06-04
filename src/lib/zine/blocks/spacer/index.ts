import type { BlockDef } from '../../schema/block';
import { SpacerPropsSchema, type SpacerProps } from './schema';
import Render from './Render.svelte';

export const spacerBlock: BlockDef<SpacerProps> = {
	type: 'spacer',
	category: 'structure',
	schema: SpacerPropsSchema,
	defaults: { size: 'md' },
	allowedAnimations: [],
	Render
};
