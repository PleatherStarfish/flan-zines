import type { Meta, StoryObj } from '@storybook/svelte';
import ZineRenderer from '../render/ZineRenderer.svelte';
import { parseDocument } from '../schema/migrate';
import type { ZineDocument } from '../schema/document';

// The Step-4 effect catalogue, shown through the SAME renderer the public page uses
// (author ≡ published). Each story pins `sceneProgress` to a fixed scroll position — the
// deterministic seek the design calls for (scene-timeline.md §8; visual-test discipline
// in IMPLEMENTATION_PLAN §3) — so reviewers can see each effect mid-flight.
const document: ZineDocument = parseDocument({
	schemaVersion: 4,
	theme: {},
	acts: [
		{
			id: 'act_demo',
			scenes: [
				{
					id: 'scn_demo',
					type: 'reveal',
					length: 'long',
					beats: [{ id: 'beat_start', at: 0 }],
					elements: [
						{
							id: 'el_title',
							track: 'content',
							range: { start: 0.05, end: 0.95 },
							block: {
								id: 'blk_title',
								type: 'heading',
								props: { text: 'The lamp-lit hour', level: 2 }
							},
							enter: {
								type: 'rise',
								params: { speed: 'medium', amount: 'strong', direction: 'up' }
							},
							exit: { type: 'fade', params: { speed: 'medium' } }
						},
						{
							id: 'el_words',
							track: 'content',
							range: { start: 0.2, end: 0.9 },
							block: {
								id: 'blk_words',
								type: 'richText',
								props: {
									doc: {
										type: 'doc',
										content: [
											{
												type: 'paragraph',
												content: [
													{ type: 'text', text: 'As you scroll, the words fade up into view.' }
												]
											}
										]
									}
								}
							},
							enter: { type: 'fade', params: { speed: 'slow' } }
						},
						{
							id: 'el_photo',
							track: 'media',
							range: { start: 0, end: 1 },
							block: {
								id: 'blk_photo',
								type: 'image',
								props: { src: '/zine-sample.svg', alt: 'A lamp' }
							},
							motion: {
								type: 'parallax',
								params: { speed: 'medium', amount: 'strong', direction: 'up' }
							}
						}
					]
				}
			]
		}
	]
});

const meta = {
	title: 'Zine/Effects',
	component: ZineRenderer
} satisfies Meta<typeof ZineRenderer>;
export default meta;

type Story = StoryObj<typeof meta>;

export const ScrollStart: Story = { args: { document, sceneProgress: { scn_demo: 0 } } };
export const ScrollEarly: Story = { args: { document, sceneProgress: { scn_demo: 0.25 } } };
export const ScrollMiddle: Story = { args: { document, sceneProgress: { scn_demo: 0.5 } } };
export const ScrollEnd: Story = { args: { document, sceneProgress: { scn_demo: 1 } } };
