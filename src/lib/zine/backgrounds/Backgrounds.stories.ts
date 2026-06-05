import type { Meta, StoryObj } from '@storybook/svelte';
import ZineRenderer from '../render/ZineRenderer.svelte';
import { parseDocument } from '../schema/migrate';
import type { OrganicGradientParams } from './presets/organic-gradient/schema';

// Visual review of the generative organic-gradient (watercolour) background, painted with a
// theme's swatches and seeded at a fixed scroll position so each story is deterministic.
const meta = {
	title: 'Zine/Backgrounds',
	component: ZineRenderer
} satisfies Meta<typeof ZineRenderer>;
export default meta;

type Story = StoryObj<typeof meta>;

const SCENE_ID = 'scn_gradient';

function gradientDoc(params: Partial<OrganicGradientParams>) {
	return parseDocument({
		schemaVersion: 5,
		theme: {
			swatches: ['#1d3557', '#457b9d', '#a8dadc', '#f1faee', '#e63946'],
			colors: {
				background: '#f1faee',
				text: '#1d3557',
				heading: '#1d3557',
				accent: '#e63946',
				muted: '#457b9d'
			}
		},
		acts: [
			{
				id: 'act_1',
				scenes: [
					{
						id: SCENE_ID,
						type: 'feature',
						length: 'auto',
						background: {
							fill: { kind: 'canvas', preset: 'organic-gradient', params },
							overlay: { color: '#000000', opacity: 0.15 }
						},
						beats: [{ id: 'beat_1', at: 0 }],
						elements: [
							{
								id: 'el_h',
								track: 'content',
								range: { start: 0, end: 1 },
								block: { id: 'blk_h', type: 'heading', props: { text: 'Watercolour', level: 2 } }
							}
						]
					}
				]
			}
		]
	});
}

// The calm default: all colours, scattered, a few clouds, gentle drift, soft strength.
export const SoftClouds: Story = {
	args: {
		document: gradientDoc({
			colors: [],
			placement: 'scattered',
			count: 'some',
			motion: 'gentle',
			opacity: 'soft'
		}),
		sceneProgress: { [SCENE_ID]: 0.5 }
	}
};

// The bolder end: cool colours only, pooled at the edges, many clouds, vivid, scroll-shifted.
export const EdgesVivid: Story = {
	args: {
		document: gradientDoc({
			colors: [0, 1, 2],
			placement: 'edges',
			count: 'many',
			motion: 'scroll',
			opacity: 'vivid'
		}),
		sceneProgress: { [SCENE_ID]: 0.5 }
	}
};

// Colour pooled in the centre, a few clouds, still — a calm centred glow.
export const CenterStill: Story = {
	args: {
		document: gradientDoc({
			colors: [],
			placement: 'center',
			count: 'few',
			motion: 'still',
			opacity: 'bold'
		}),
		sceneProgress: { [SCENE_ID]: 0 }
	}
};
