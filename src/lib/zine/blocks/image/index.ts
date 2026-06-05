import type { BlockDef } from '../../schema/block';
import { ImagePropsSchema, type ImageProps } from './schema';
import Render from './Render.svelte';
import Inspector from './Inspector.svelte';

export const imageBlock: BlockDef<ImageProps> = {
	type: 'image',
	label: 'Image',
	category: 'media',
	schema: ImagePropsSchema,
	defaults: { src: '/zine-sample.svg', alt: '' },
	allowedAnimations: ['fade', 'rise', 'slide', 'pop', 'fly-in', 'parallax', 'float', 'ken-burns'],
	Render,
	Inspector,
	requiredForPublish: (props) =>
		props.alt.trim().length > 0 ? [] : ['Add alt text describing this image before publishing.']
};
