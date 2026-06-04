import type { BlockDef } from '../../schema/block';
import { LinkButtonPropsSchema, type LinkButtonProps } from './schema';
import Render from './Render.svelte';

export const linkButtonBlock: BlockDef<LinkButtonProps> = {
	type: 'linkButton',
	category: 'structure',
	schema: LinkButtonPropsSchema,
	defaults: { href: 'https://pudding.cool', label: 'Read more', variant: 'link', newTab: false },
	allowedAnimations: ['fade-up'],
	Render
};
