import type { Meta, StoryObj } from '@storybook/svelte';
import ZineRenderer from './ZineRenderer.svelte';
import { parseDocument } from '../schema/migrate';

// A free "character" sprite choreographed along a jump path (arc easing) over a platform,
// seeded at fixed scroll positions so each story is deterministic — start, apex, landing.
const SCENE = 'scn_jump';

function jumpDoc() {
	return parseDocument({
		schemaVersion: 5,
		theme: {
			swatches: ['#dff0ff', '#123244', '#e4572e'],
			colors: {
				background: '#dff0ff',
				text: '#123244',
				heading: '#123244',
				accent: '#e4572e',
				muted: '#5a7184'
			}
		},
		acts: [
			{
				id: 'act',
				scenes: [
					{
						id: SCENE,
						type: 'feature',
						length: 'medium',
						beats: [{ id: 'b', at: 0 }],
						elements: [
							{
								id: 'el_plat',
								track: 'media',
								range: { start: 0, end: 1 },
								block: { id: 'b1', type: 'heading', props: { text: '🟩🟩🟩', level: 3 } }
							},
							{
								id: 'el_hero',
								track: 'media',
								placement: 'free',
								range: { start: 0, end: 1 },
								block: { id: 'b2', type: 'heading', props: { text: '🧍', level: 2 } },
								motion: {
									type: 'path',
									params: {
										waypoints: [
											{ at: 0, x: 16, y: 74 },
											{ at: 0.5, x: 50, y: 52, ease: 'arc' },
											{ at: 1, x: 84, y: 72, ease: 'arc' }
										]
									}
								}
							}
						]
					}
				]
			}
		]
	});
}

const meta = {
	title: 'Zine/Choreography',
	component: ZineRenderer
} satisfies Meta<typeof ZineRenderer>;
export default meta;

type Story = StoryObj<typeof meta>;

export const JumpStart: Story = { args: { document: jumpDoc(), sceneProgress: { [SCENE]: 0 } } };
export const JumpApex: Story = { args: { document: jumpDoc(), sceneProgress: { [SCENE]: 0.5 } } };
export const JumpLand: Story = { args: { document: jumpDoc(), sceneProgress: { [SCENE]: 1 } } };
