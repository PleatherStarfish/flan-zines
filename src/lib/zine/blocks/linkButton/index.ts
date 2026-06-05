import type { BlockDef } from '../../schema/block';
import { LinkButtonPropsSchema, type LinkButtonProps } from './schema';
import Render from './Render.svelte';
import Inspector from './Inspector.svelte';

export const linkButtonBlock: BlockDef<LinkButtonProps> = {
	type: 'linkButton',
	label: 'Link / Button',
	category: 'structure',
	schema: LinkButtonPropsSchema,
	defaults: { href: 'https://pudding.cool', label: 'Read more', variant: 'link', newTab: false },
	allowedAnimations: ['fade', 'rise', 'pop', 'fly-in'],
	Render,
	Inspector
};
