import type { BlockDef } from '../../schema/block';
import { CharacterSpritePropsSchema, type CharacterSpriteProps } from './schema';
import Render from './Render.svelte';
import Inspector from './Inspector.svelte';

export const characterSpriteBlock: BlockDef<CharacterSpriteProps> = {
	type: 'characterSprite',
	label: 'Character',
	category: 'media',
	schema: CharacterSpritePropsSchema,
	defaults: {
		action: 'idle',
		size: 'small',
		source: {
			src: '/zine-sample.svg',
			poster: '/zine-sample.svg',
			width: 48,
			height: 64,
			frameCount: 1,
			durationMs: 0
		},
		alt: ''
	},
	allowedAnimations: [
		'fade',
		'rise',
		'slide',
		'pop',
		'fly-in',
		'parallax',
		'float',
		'ken-burns',
		'path'
	],
	Render,
	Inspector,
	requiredForPublish: (props) => {
		const blockers: string[] = [];
		if (props.alt.trim().length === 0)
			blockers.push('Add alt text describing this character before publishing.');
		if (!props.source.src) blockers.push('Choose a character GIF URL before publishing.');
		if (!props.source.poster)
			blockers.push('Choose a still image URL for reduced motion before publishing.');
		return blockers;
	}
};
