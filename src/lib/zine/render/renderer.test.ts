// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import ZineRenderer from './ZineRenderer.svelte';
import { seriousAxeViolations } from './axe-helper';
import { parseDocument } from '../schema/migrate';
import { sampleZineMeta, sampleZineRaw } from '../fixtures';
import type { ZineDocument } from '../schema/document';

let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

beforeAll(() => {
	originalGetContext = HTMLCanvasElement.prototype.getContext;
	const gradient = { addColorStop: () => {} };
	const context = {
		clearRect: () => {},
		createRadialGradient: () => gradient,
		fillRect: () => {},
		beginPath: () => {},
		arc: () => {},
		fill: () => {},
		stroke: () => {},
		moveTo: () => {},
		lineTo: () => {},
		bezierCurveTo: () => {},
		closePath: () => {},
		save: () => {},
		restore: () => {},
		translate: () => {},
		rotate: () => {},
		scale: () => {},
		drawImage: () => {},
		globalAlpha: 1,
		fillStyle: '',
		lineCap: '',
		lineWidth: 1,
		strokeStyle: ''
	} as unknown as CanvasRenderingContext2D;
	HTMLCanvasElement.prototype.getContext = ((contextId: string) =>
		contextId === '2d' ? context : null) as typeof HTMLCanvasElement.prototype.getContext;
});

afterAll(() => {
	HTMLCanvasElement.prototype.getContext = originalGetContext;
});

function renderFixture() {
	const document = parseDocument(sampleZineRaw);
	return render(ZineRenderer, { props: { document, title: sampleZineMeta.title } });
}

function blockContaining(container: HTMLElement, text: string): HTMLElement {
	const block = [...container.querySelectorAll<HTMLElement>('.zine-block')].find((candidate) =>
		candidate.textContent?.includes(text)
	);
	if (!block) throw new Error(`Missing block containing "${text}"`);
	return block;
}

describe('ZineRenderer', () => {
	it('renders the title as the single h1 plus semantic content from every block', () => {
		const { container } = renderFixture();
		expect(container.querySelectorAll('h1')).toHaveLength(1);
		expect(container.querySelector('h1')?.textContent).toBe(sampleZineMeta.title);
		expect(container.querySelector('h2')).toBeTruthy();
		expect(container.querySelector('h3')).toBeTruthy();
		expect(container.querySelector('hr')).toBeTruthy();
		expect(container.querySelector('ul')).toBeTruthy();
		expect(container.querySelector('strong')).toBeTruthy();
		expect(container.querySelector('em')).toBeTruthy();
		expect(container.querySelector('img')?.getAttribute('alt')).toBeTruthy();
		expect(container.querySelector('a[href="https://pudding.cool"]')).toBeTruthy();
	});

	it('produces a valid heading outline (starts at h1, never skips a level)', () => {
		const { container } = renderFixture();
		const headings = [...container.querySelectorAll('h1,h2,h3,h4,h5,h6')];
		const levels = headings.map((h) => Number(h.tagName[1]));
		expect(levels[0]).toBe(1);
		for (let i = 1; i < levels.length; i++) {
			expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
		}
		expect(headings.map((h) => h.textContent?.trim())).not.toContain(
			'A suspiciously specific field guide to storm drains'
		);
	});

	it('renders the sample zine with explicit Content text roles and plain diagram labels', () => {
		const { container } = renderFixture();
		const body = blockContaining(container, 'The first minutes of a storm are not romantic');
		expect(body.getAttribute('data-text-kind')).toBe('content');
		expect(body.getAttribute('data-typeset-role')).toBe('body');
		expect(body.getAttribute('style')).toMatch(/--zine-ts-measure:\s*62ch/);

		const subhead = blockContaining(container, '1. First flush is not a metaphor');
		expect(subhead.getAttribute('data-text-kind')).toBe('content');
		expect(subhead.getAttribute('data-typeset-role')).toBe('subhead');

		const label = blockContaining(container, '75 mm green-roof tray');
		expect(label.getAttribute('data-text-kind')).toBe('other');
		expect(label.hasAttribute('data-typeset')).toBe(false);
		expect(label.hasAttribute('data-typeset-role')).toBe(false);
		expect(label.getAttribute('data-text-backdrop')).toBe('box');
		expect(label.closest('.zine-pinned-actor')?.getAttribute('data-region')).toBe('top-left');
	});

	it('has no critical or serious axe violations', async () => {
		const { container } = renderFixture();
		expect(await seriousAxeViolations(container)).toEqual([]);
	});

	it('applies timeline scrub state only when the editor preview provides scene progress', () => {
		const document = parseDocument({
			schemaVersion: 7,
			theme: {},
			acts: [
				{
					id: 'act_test',
					scenes: [
						{
							id: 'scn_test',
							type: 'reveal',
							length: 'long',
							beats: [{ id: 'beat_start', at: 0 }],
							elements: [
								{
									id: 'el_test',
									track: 'content',
									range: { start: 0.5, end: 0.8 },
									block: {
										id: 'blk_test',
										type: 'heading',
										props: { text: 'Scrubbed scene', level: 2 }
									}
								}
							]
						}
					]
				}
			]
		}) satisfies ZineDocument;

		const staticRender = render(ZineRenderer, { props: { document } });
		expect(staticRender.container.querySelector('.zine-block')?.getAttribute('style')).not.toMatch(
			/opacity/
		);
		staticRender.unmount();

		// Scrubbed before the clip's range (0.5–0.8): the element is faded out by the
		// default appear ramp, so the timeline range is visibly meaningful.
		const beforeRange = render(ZineRenderer, {
			props: { document, sceneProgress: { scn_test: 0.2 } }
		});
		// (jsdom normalises the inline style, e.g. `opacity:0.000` → `opacity: 0`.)
		const beforeStyle = beforeRange.container.querySelector('.zine-block')?.getAttribute('style');
		expect(beforeStyle).toMatch(/opacity:\s*0\b/);
		expect(beforeStyle).toMatch(/pointer-events:\s*none/);
		beforeRange.unmount();

		// Scrubbed inside the range: fully visible, no inline transform forced.
		const inRange = render(ZineRenderer, {
			props: { document, sceneProgress: { scn_test: 0.65 } }
		});
		const inStyle = inRange.container.querySelector('.zine-block')?.getAttribute('style');
		expect(inStyle).toMatch(/opacity:\s*1\b/);
	});

	it('applies element row order as front-to-back z-index', () => {
		const document = parseDocument({
			schemaVersion: 7,
			acts: [
				{
					id: 'act',
					scenes: [
						{
							id: 'scn',
							type: 'reveal',
							length: 'auto',
							beats: [{ id: 'b', at: 0 }],
							elements: [
								{
									id: 'scenery',
									track: 'background',
									range: { start: 0, end: 1 },
									block: {
										id: 'scenery_blk',
										type: 'heading',
										props: { text: 'Scenery', level: 2 }
									}
								},
								{
									id: 'picture',
									track: 'media',
									placement: 'free',
									range: { start: 0, end: 1 },
									block: {
										id: 'picture_blk',
										type: 'image',
										props: { src: '/picture.svg', alt: 'picture' }
									}
								},
								{
									id: 'words',
									track: 'content',
									range: { start: 0, end: 1 },
									block: { id: 'words_blk', type: 'heading', props: { text: 'Words', level: 2 } }
								}
							]
						}
					]
				}
			]
		}) satisfies ZineDocument;

		const { container, unmount } = render(ZineRenderer, {
			props: { document, sceneProgress: { scn: 0 } }
		});

		expect(
			container.querySelector('.zine-flow-actor[data-track="background"]')?.getAttribute('style')
		).toMatch(/z-index:\s*3/);
		expect(
			container.querySelector('.zine-free-actor[data-track="media"]')?.getAttribute('style')
		).toMatch(/z-index:\s*2/);
		expect(
			container.querySelector('.zine-flow-actor[data-track="content"]')?.getAttribute('style')
		).toMatch(/z-index:\s*1/);
		unmount();
	});

	it('renders pinned background parallax in a behind-content stage plane', async () => {
		const document = parseDocument({
			schemaVersion: 7,
			acts: [
				{
					id: 'act',
					scenes: [
						{
							id: 'scn',
							type: 'reveal',
							length: 'auto',
							scrollLength: 4,
							beats: [{ id: 'b', at: 0 }],
							elements: [
								{
									id: 'backdrop',
									track: 'background',
									placement: 'pinned',
									anchor: { region: 'center', dx: 0, dy: 0 },
									range: { start: 0, end: 1 },
									motion: {
										type: 'parallax',
										params: { speed: 'slow', amount: 'subtle', direction: 'up' }
									},
									block: {
										id: 'backdrop_blk',
										type: 'image',
										props: { src: '/backdrop.svg', alt: 'layered backdrop' }
									}
								},
								{
									id: 'words',
									track: 'content',
									range: { start: 0, end: 1 },
									block: {
										id: 'words_blk',
										type: 'heading',
										props: { text: 'Story text stays above', level: 2 }
									}
								}
							]
						}
					]
				}
			]
		}) satisfies ZineDocument;

		const { container } = render(ZineRenderer, {
			props: { document, sceneProgress: { scn: 0.25 } }
		});
		const backPlane = container.querySelector('.zine-stage-overlay--back');
		const frontPlane = container.querySelector('.zine-stage-overlay--front');
		const actor = container.querySelector('.zine-stage-overlay--back .zine-pinned-actor');
		const content = container.querySelector('.zine-flow-actor[data-track="content"]');
		expect(backPlane).toBeTruthy();
		expect(frontPlane).toBeNull();
		expect(actor?.getAttribute('data-track')).toBe('background');
		expect(actor?.getAttribute('data-region')).toBe('center');
		expect(actor?.getAttribute('style')).not.toMatch(/left:/);
		expect(
			(content as HTMLElement).compareDocumentPosition(backPlane as HTMLElement) &
				Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
		await waitFor(() => {
			expect(
				container
					.querySelector('.zine-stage-overlay--back .zine-pinned-actor .zine-block')
					?.getAttribute('style')
			).toMatch(/transform:\s*translateY\(-6\.00px\)/);
		});
	});

	it('keeps horizontal pinned background layers out of track positioning', async () => {
		const document = parseDocument({
			schemaVersion: 7,
			acts: [
				{
					id: 'act',
					scenes: [
						{
							id: 'scn',
							type: 'sidescroll',
							length: 'auto',
							scrollAxis: 'horizontal',
							scrollLength: 5,
							beats: [{ id: 'b', at: 0 }],
							elements: [
								{
									id: 'cloud',
									track: 'background',
									placement: 'pinned',
									anchor: { region: 'top', dx: 0, dy: 0 },
									range: { start: 0.2, end: 0.8 },
									motion: {
										type: 'parallax',
										params: { speed: 'slow', amount: 'subtle', direction: 'up' }
									},
									block: {
										id: 'cloud_blk',
										type: 'image',
										props: { src: '/cloud.svg', alt: 'cloud layer' }
									}
								},
								{
									id: 'platform',
									track: 'media',
									range: { start: 0.65, end: 0.8 },
									block: {
										id: 'platform_blk',
										type: 'heading',
										props: { text: 'Track actor', level: 2 }
									}
								}
							]
						}
					]
				}
			]
		}) satisfies ZineDocument;

		const { container } = render(ZineRenderer, {
			props: { document, sceneProgress: { scn: 0.5 } }
		});
		expect(container.querySelector('.zine-stage')?.getAttribute('style')).toMatch(/width:\s*500%/);
		const pinned = container.querySelector('.zine-stage-overlay--back .zine-pinned-actor');
		expect(pinned).toBeTruthy();
		expect(pinned?.closest('.zine-stage')).toBeNull();
		expect(pinned?.getAttribute('style')).not.toMatch(/left:\s*20/);
		await waitFor(() => {
			expect(
				container
					.querySelector('.zine-stage-overlay--back .zine-pinned-actor .zine-block')
					?.getAttribute('style')
			).toMatch(/opacity:\s*1\b/);
		});
	});

	it('renders text blocks without backdrops by default, with explicit tight readability backdrops', () => {
		const document = parseDocument({
			schemaVersion: 7,
			acts: [
				{
					id: 'act',
					scenes: [
						{
							id: 'scn',
							type: 'page',
							length: 'auto',
							beats: [{ id: 'b', at: 0 }],
							elements: [
								{
									id: 'plain',
									track: 'content',
									range: { start: 0, end: 1 },
									block: { id: 'plain_blk', type: 'heading', props: { text: 'Plain', level: 2 } }
								},
								{
									id: 'boxed',
									track: 'content',
									range: { start: 0, end: 1 },
									block: {
										id: 'boxed_blk',
										type: 'heading',
										props: { text: 'Boxed', level: 2 },
										style: {
											textBackdrop: { shape: 'box', color: '#14181f', opacity: 0.8 }
										}
									}
								},
								{
									id: 'circle',
									track: 'content',
									range: { start: 0, end: 1 },
									block: {
										id: 'circle_blk',
										type: 'richText',
										props: {
											doc: {
												type: 'doc',
												content: [
													{
														type: 'paragraph',
														content: [{ type: 'text', text: 'Circle note' }]
													}
												]
											}
										},
										style: {
											textBackdrop: { shape: 'circle', color: '#FFF3C4', opacity: 0.55 }
										}
									}
								}
							]
						}
					]
				}
			]
		}) satisfies ZineDocument;

		const { container } = render(ZineRenderer, { props: { document } });
		const blocks = container.querySelectorAll('.zine-block');
		expect(blocks[0].hasAttribute('data-text-backdrop')).toBe(false);
		expect(blocks[0].getAttribute('style')).not.toMatch(/--zine-text-backdrop/);

		expect(blocks[1].getAttribute('data-text-backdrop')).toBe('box');
		expect(blocks[1].getAttribute('style')).toMatch(/--zine-text-backdrop-color:\s*#14181f/);
		expect(blocks[1].getAttribute('style')).toMatch(/--zine-text-backdrop-opacity:\s*80%/);
		expect(blocks[1].querySelector(':scope > .zine-heading')).toBeTruthy();

		expect(blocks[2].getAttribute('data-text-backdrop')).toBe('circle');
		expect(blocks[2].getAttribute('style')).toMatch(/--zine-text-backdrop-color:\s*#FFF3C4/);
		expect(blocks[2].getAttribute('style')).toMatch(/--zine-text-backdrop-opacity:\s*55%/);
		expect(blocks[2].querySelector(':scope > .zine-richtext')).toBeTruthy();
	});

	it('renders special text frames from block style data', () => {
		const document = parseDocument({
			schemaVersion: 7,
			acts: [
				{
					id: 'act',
					scenes: [
						{
							id: 'scn',
							type: 'page',
							length: 'auto',
							beats: [{ id: 'b', at: 0 }],
							elements: [
								{
									id: 'speech',
									track: 'content',
									range: { start: 0, end: 1 },
									block: {
										id: 'speech_blk',
										type: 'richText',
										props: {
											doc: {
												type: 'doc',
												content: [
													{
														type: 'paragraph',
														content: [{ type: 'text', text: 'Watch the grate.' }]
													}
												]
											}
										},
										style: {
											typeset: { kind: 'other' },
											textFrame: {
												kind: 'speech',
												mode: 'thought',
												tail: 'none',
												outline: 'sketch',
												fill: 'paper',
												padding: 1.2
											}
										}
									}
								},
								{
									id: 'sms',
									track: 'content',
									range: { start: 0, end: 1 },
									block: {
										id: 'sms_blk',
										type: 'richText',
										props: {
											doc: {
												type: 'doc',
												content: [
													{
														type: 'paragraph',
														content: [{ type: 'text', text: 'Are you seeing this?' }]
													}
												]
											}
										},
										style: {
											typeset: { kind: 'other' },
											textFrame: {
												kind: 'sms',
												side: 'incoming',
												group: 'single',
												fill: 'theme',
												padding: 0.8,
												senderName: 'Maya',
												senderAvatar: {
													src: 'https://example.com/maya.png',
													alt: 'Maya'
												}
											}
										}
									}
								}
							]
						}
					]
				}
			]
		}) satisfies ZineDocument;

		const { container } = render(ZineRenderer, { props: { document } });
		const speech = blockContaining(container, 'Watch the grate.');
		expect(speech.getAttribute('data-text-frame')).toBe('speech');
		expect(speech.getAttribute('data-frame-mode')).toBe('thought');
		expect(speech.getAttribute('data-frame-outline')).toBe('sketch');
		expect(speech.getAttribute('style')).toMatch(/--zine-text-frame-padding:\s*1\.2/);
		expect(speech.querySelector('.zine-rough-frame')).toBeTruthy();

		const sms = blockContaining(container, 'Are you seeing this?');
		expect(sms.getAttribute('data-text-frame')).toBe('sms');
		expect(sms.getAttribute('data-frame-side')).toBe('incoming');
		expect(sms.querySelector('.zine-sms-sender')?.textContent).toBe('Maya');
		expect(sms.querySelector('.zine-sms-avatar')?.getAttribute('alt')).toBe('Maya');
	});

	it('resolves speech bubble tails toward selected scene targets', () => {
		const document = parseDocument({
			schemaVersion: 7,
			acts: [
				{
					id: 'act',
					scenes: [
						{
							id: 'scn',
							type: 'page',
							length: 'auto',
							beats: [{ id: 'b', at: 0 }],
							elements: [
								{
									id: 'bubble',
									track: 'content',
									placement: 'pinned',
									anchor: { region: 'bottom-left', dx: 0, dy: 0 },
									range: { start: 0, end: 1 },
									block: {
										id: 'bubble_blk',
										type: 'richText',
										props: {
											doc: {
												type: 'doc',
												content: [
													{
														type: 'paragraph',
														content: [{ type: 'text', text: 'That drain is talking.' }]
													}
												]
											}
										},
										style: {
											typeset: { kind: 'other' },
											textFrame: {
												kind: 'speech',
												mode: 'speech',
												tail: 'auto',
												speakerElementId: 'speaker',
												outline: 'clean',
												fill: 'paper',
												padding: 1
											}
										}
									}
								},
								{
									id: 'speaker',
									track: 'media',
									placement: 'pinned',
									anchor: { region: 'top-right', dx: 0, dy: 0 },
									range: { start: 0, end: 1 },
									block: {
										id: 'speaker_blk',
										type: 'image',
										props: {
											src: 'https://example.com/drain.png',
											alt: 'A storm drain'
										}
									}
								}
							]
						}
					]
				}
			]
		}) satisfies ZineDocument;

		const { container } = render(ZineRenderer, { props: { document } });
		const bubble = blockContaining(container, 'That drain is talking.');
		expect(bubble.getAttribute('data-frame-speaker')).toBe('speaker');
		expect(bubble.getAttribute('data-frame-tail')).toBe('top-right');
	});

	it('keeps free text transparent over canvas scene backgrounds unless a backdrop is explicit', () => {
		const document = parseDocument({
			schemaVersion: 7,
			theme: {
				colors: {
					background: '#F4EAD5',
					text: '#C5295A',
					heading: '#C5295A',
					accent: '#E94E77',
					muted: '#A08076'
				}
			},
			acts: [
				{
					id: 'act',
					scenes: [
						{
							id: 'clouds',
							type: 'parallax',
							length: 'auto',
							scrollLength: 4,
							background: {
								fill: {
									kind: 'canvas',
									preset: 'organic-gradient',
									params: {
										count: 'some',
										motion: 'gentle',
										opacity: 'soft',
										placement: 'scattered',
										colors: []
									}
								}
							},
							beats: [{ id: 'b', at: 0 }],
							elements: [
								{
									id: 'free_heading',
									track: 'media',
									placement: 'free',
									range: { start: 0, end: 1 },
									block: {
										id: 'free_heading_block',
										type: 'heading',
										props: { text: 'Why We Read at Night', level: 2 }
									},
									motion: {
										type: 'path',
										params: {
											waypoints: [
												{ at: 0, x: 18, y: 25, scale: 1, rotate: 0, ease: 'smooth' },
												{ at: 1, x: 78, y: 70, scale: 1, rotate: 0, ease: 'smooth' }
											]
										}
									}
								}
							]
						}
					]
				}
			]
		}) satisfies ZineDocument;

		const { container } = render(ZineRenderer, {
			props: { document, sceneProgress: { clouds: 0.5 } }
		});
		const actor = container.querySelector('.zine-free-actor');
		expect(actor?.getAttribute('data-track')).toBe('media');
		expect(actor?.getAttribute('data-block-type')).toBe('heading');

		const block = container.querySelector('.zine-free-actor .zine-block');
		expect(block?.hasAttribute('data-text-backdrop')).toBe(false);
		expect(block?.getAttribute('style')).not.toMatch(/--zine-text-backdrop/);
		expect(block?.querySelector(':scope > .zine-heading')?.textContent).toBe(
			'Why We Read at Night'
		);
	});

	it('sizes and pins a timeline scene to its scroll distance, but leaves page scenes in flow', () => {
		const make = (type: string, scrollLength?: number) =>
			parseDocument({
				schemaVersion: 7,
				acts: [
					{
						id: 'act',
						scenes: [
							{
								id: 'scn',
								type,
								length: 'auto',
								...(scrollLength ? { scrollLength } : {}),
								beats: type === 'page' ? [{ id: 'b', at: 0 }] : [{ id: 'b', at: 0 }],
								elements: [
									{
										id: 'el',
										track: 'content',
										range: { start: 0, end: 1 },
										block: { id: 'blk', type: 'heading', props: { text: 'Hi', level: 2 } }
									}
								]
							}
						]
					}
				]
			}) satisfies ZineDocument;

		// A reveal scene with scrollLength 6 → 600svh tall, content pinned (svh, not vh, so a
		// mobile navbar toggle doesn't jump the scroll triggers — responsive-and-performance §3).
		const pinned = render(ZineRenderer, { props: { document: make('reveal', 6) } });
		const section = pinned.container.querySelector('.zine-scene');
		expect(section?.getAttribute('style')).toMatch(/min-height:\s*600svh/);
		expect(pinned.container.querySelector('.zine-scene__inner.is-pinned')).toBeTruthy();
		pinned.unmount();

		// A page scene stays in normal flow — no height, no pin.
		const page = render(ZineRenderer, { props: { document: make('page') } });
		expect(page.container.querySelector('.zine-scene')?.getAttribute('style')).toBeNull();
		expect(page.container.querySelector('.zine-scene__inner.is-pinned')).toBeNull();
		page.unmount();

		// The editor's compact preview (pinScenes=false) never sizes/pins, so it fits its window.
		const preview = render(ZineRenderer, {
			props: { document: make('reveal', 6), pinScenes: false }
		});
		expect(preview.container.querySelector('.zine-scene')?.getAttribute('style')).toBeNull();
		expect(preview.container.querySelector('.zine-scene__inner.is-pinned')).toBeNull();
		preview.unmount();

		// The timeline's laptop preview keeps the real pinned choreography path, but lets the
		// containing screen define the viewport instead of emitting a browser-sized scroll range.
		const framed = render(ZineRenderer, {
			props: { document: make('reveal', 6), viewport: 'frame', sceneProgress: { scn: 0.4 } }
		});
		expect(framed.container.querySelector('.zine')?.getAttribute('data-viewport')).toBe('frame');
		expect(framed.container.querySelector('.zine-scene')?.getAttribute('style')).toBeNull();
		expect(framed.container.querySelector('.zine-scene__inner.is-pinned')).toBeTruthy();
	});

	it('renders a side-scroll scene as a stage of actors that pans with scroll progress', () => {
		const document = parseDocument({
			schemaVersion: 7,
			acts: [
				{
					id: 'act',
					scenes: [
						{
							id: 'scn',
							type: 'reveal',
							length: 'auto',
							scrollAxis: 'horizontal',
							scrollLength: 4,
							beats: [{ id: 'b', at: 0 }],
							elements: [
								{
									id: 'el1',
									track: 'content',
									range: { start: 0, end: 0.5 },
									block: { id: 'blk1', type: 'heading', props: { text: 'Start', level: 2 } }
								},
								{
									id: 'el2',
									track: 'media',
									range: { start: 0.6, end: 1 },
									block: { id: 'blk2', type: 'heading', props: { text: 'Far right', level: 2 } }
								}
							]
						}
					]
				}
			]
		}) satisfies ZineDocument;

		const { container } = render(ZineRenderer, {
			props: { document, sceneProgress: { scn: 0.5 } }
		});
		const stage = container.querySelector('.zine-stage');
		// 4 screens wide; at progress 0.5 → translateX(-0.5·(4-1)/4·100%) = -37.5%.
		expect(stage?.getAttribute('style')).toMatch(/width:\s*400%/);
		expect(stage?.getAttribute('style')).toMatch(/translateX\(\s*-37\.5/);
		const actors = container.querySelectorAll('.zine-actor');
		expect(actors).toHaveLength(2);
		// The second element sits at 60% along the track.
		expect(actors[1].getAttribute('style')).toMatch(/left:\s*60/);
	});

	it('does not pin scenes under reduced motion — they lay out in readable source order', () => {
		const original = window.matchMedia;
		window.matchMedia = ((query: string) => ({
			matches: true,
			media: query,
			onchange: null,
			addEventListener: () => {},
			removeEventListener: () => {},
			addListener: () => {},
			removeListener: () => {},
			dispatchEvent: () => false
		})) as typeof window.matchMedia;
		try {
			const document = parseDocument({
				schemaVersion: 7,
				acts: [
					{
						id: 'act',
						scenes: [
							{
								id: 'scn',
								type: 'reveal',
								length: 'auto',
								scrollAxis: 'horizontal',
								scrollLength: 6,
								beats: [{ id: 'b', at: 0 }],
								elements: [
									{
										id: 'el',
										track: 'content',
										range: { start: 0, end: 1 },
										block: { id: 'blk', type: 'heading', props: { text: 'Hi', level: 2 } }
									}
								]
							}
						]
					}
				]
			}) satisfies ZineDocument;
			const { container } = render(ZineRenderer, { props: { document } });
			expect(container.querySelector('.zine-scene')?.getAttribute('style')).toBeNull();
			expect(container.querySelector('.zine-scene__inner.is-pinned')).toBeNull();
			// A side-scroll scene also degrades to a readable vertical stack — no pan stage.
			expect(container.querySelector('.zine-stage')).toBeNull();
		} finally {
			window.matchMedia = original;
		}
	});

	it('fit-collapses over-tall content and neutralizes flow text animation', async () => {
		const originalMatchMedia = window.matchMedia;
		const originalInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
		const originalRect = HTMLElement.prototype.getBoundingClientRect;
		window.matchMedia = ((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addEventListener: () => {},
			removeEventListener: () => {},
			addListener: () => {},
			removeListener: () => {},
			dispatchEvent: () => false
		})) as typeof window.matchMedia;
		Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
		HTMLElement.prototype.getBoundingClientRect = function () {
			if (
				this instanceof HTMLElement &&
				this.classList.contains('zine-block') &&
				this.textContent?.includes('Readable first')
			) {
				return {
					x: 0,
					y: 0,
					top: 0,
					right: 320,
					bottom: 620,
					left: 0,
					width: 320,
					height: 620,
					toJSON: () => ({})
				} as DOMRect;
			}
			return originalRect.call(this);
		};
		try {
			const document = parseDocument({
				schemaVersion: 7,
				acts: [
					{
						id: 'act',
						scenes: [
							{
								id: 'scn',
								type: 'reveal',
								length: 'auto',
								scrollLength: 5,
								beats: [{ id: 'b', at: 0 }],
								elements: [
									{
										id: 'el',
										track: 'content',
										range: { start: 0.55, end: 0.85 },
										enter: { type: 'rise', params: { speed: 'medium', direction: 'up' } },
										block: {
											id: 'blk',
											type: 'heading',
											props: { text: 'Readable first', level: 2 }
										}
									}
								]
							}
						]
					}
				]
			}) satisfies ZineDocument;
			const { container } = render(ZineRenderer, {
				props: { document, sceneProgress: { scn: 0.1 } }
			});
			await waitFor(() => {
				expect(container.querySelector('.zine-scene')?.getAttribute('data-layout')).toBe('stacked');
			});
			expect(container.querySelector('.zine-scene')?.getAttribute('style')).toBeNull();
			expect(container.querySelector('.zine-scene__inner.is-pinned')).toBeNull();
			expect(container.querySelector('.zine-block')?.getAttribute('style')).not.toMatch(/opacity/);
		} finally {
			window.matchMedia = originalMatchMedia;
			if (originalInnerHeight) Object.defineProperty(window, 'innerHeight', originalInnerHeight);
			HTMLElement.prototype.getBoundingClientRect = originalRect;
		}
	});

	it('keeps horizontal side-scrollers alive when only stage media actors are tall', async () => {
		const originalMatchMedia = window.matchMedia;
		const originalInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
		const originalRect = HTMLElement.prototype.getBoundingClientRect;
		window.matchMedia = ((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addEventListener: () => {},
			removeEventListener: () => {},
			addListener: () => {},
			removeListener: () => {},
			dispatchEvent: () => false
		})) as typeof window.matchMedia;
		Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
		HTMLElement.prototype.getBoundingClientRect = function () {
			if (!(this instanceof HTMLElement) || !this.classList.contains('zine-block')) {
				return originalRect.call(this);
			}
			const text = this.textContent ?? '';
			if (text.includes('Runoff as a very fussy side-scroller')) {
				return {
					x: 0,
					y: 0,
					top: 0,
					right: 320,
					bottom: 120,
					left: 0,
					width: 320,
					height: 120,
					toJSON: () => ({})
				} as DOMRect;
			}
			if (text.includes('Tall stage art')) {
				return {
					x: 0,
					y: 0,
					top: 0,
					right: 320,
					bottom: 520,
					left: 0,
					width: 320,
					height: 520,
					toJSON: () => ({})
				} as DOMRect;
			}
			return originalRect.call(this);
		};
		try {
			const document = parseDocument({
				schemaVersion: 7,
				acts: [
					{
						id: 'act',
						scenes: [
							{
								id: 'scn',
								type: 'sidescroll',
								length: 'auto',
								scrollAxis: 'horizontal',
								scrollLength: 5,
								beats: [{ id: 'b', at: 0 }],
								elements: [
									{
										id: 'title',
										track: 'content',
										range: { start: 0.02, end: 0.18 },
										block: {
											id: 'title_blk',
											type: 'heading',
											props: { text: 'Runoff as a very fussy side-scroller', level: 2 }
										}
									},
									{
										id: 'art_a',
										track: 'background',
										range: { start: 0.2, end: 0.4 },
										block: {
											id: 'art_a_blk',
											type: 'richText',
											props: {
												doc: {
													type: 'doc',
													content: [
														{
															type: 'paragraph',
															content: [{ type: 'text', text: 'Tall stage art A' }]
														}
													]
												}
											}
										}
									},
									{
										id: 'art_b',
										track: 'media',
										range: { start: 0.55, end: 0.75 },
										block: {
											id: 'art_b_blk',
											type: 'richText',
											props: {
												doc: {
													type: 'doc',
													content: [
														{
															type: 'paragraph',
															content: [{ type: 'text', text: 'Tall stage art B' }]
														}
													]
												}
											}
										}
									}
								]
							}
						]
					}
				]
			}) satisfies ZineDocument;

			const { container } = render(ZineRenderer, {
				props: { document, sceneProgress: { scn: 0.5 } }
			});
			await waitFor(() => {
				expect(container.querySelector('.zine-scene')?.getAttribute('data-layout')).toBe(
					'timeline'
				);
			});
			expect(container.querySelector('.zine-scene')?.hasAttribute('data-fit-collapse')).toBe(false);
			expect(container.querySelector('.zine-scene')?.getAttribute('data-axis')).toBe('horizontal');
			expect(container.querySelector('.zine-scene__inner.is-pinned.is-horizontal')).toBeTruthy();
			expect(container.querySelector('.zine-stage')?.getAttribute('style')).toMatch(
				/width:\s*500%/
			);
		} finally {
			window.matchMedia = originalMatchMedia;
			if (originalInnerHeight) Object.defineProperty(window, 'innerHeight', originalInnerHeight);
			HTMLElement.prototype.getBoundingClientRect = originalRect;
		}
	});

	it('fit-collapses over-tall stage actors even when they are not Content text', async () => {
		const originalMatchMedia = window.matchMedia;
		const originalInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
		const originalRect = HTMLElement.prototype.getBoundingClientRect;
		window.matchMedia = ((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addEventListener: () => {},
			removeEventListener: () => {},
			addListener: () => {},
			removeListener: () => {},
			dispatchEvent: () => false
		})) as typeof window.matchMedia;
		Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
		HTMLElement.prototype.getBoundingClientRect = function () {
			if (
				this instanceof HTMLElement &&
				this.classList.contains('zine-block') &&
				this.textContent?.includes('Tall diagram label')
			) {
				return {
					x: 0,
					y: 0,
					top: 0,
					right: 320,
					bottom: 620,
					left: 0,
					width: 320,
					height: 620,
					toJSON: () => ({})
				} as DOMRect;
			}
			return originalRect.call(this);
		};
		try {
			const document = parseDocument({
				schemaVersion: 7,
				acts: [
					{
						id: 'act',
						scenes: [
							{
								id: 'scn',
								type: 'reveal',
								length: 'auto',
								scrollLength: 4,
								beats: [{ id: 'b', at: 0 }],
								elements: [
									{
										id: 'label',
										track: 'media',
										placement: 'pinned',
										anchor: { region: 'center' },
										range: { start: 0, end: 1 },
										block: {
											id: 'label_blk',
											type: 'richText',
											props: {
												doc: {
													type: 'doc',
													content: [
														{
															type: 'paragraph',
															content: [{ type: 'text', text: 'Tall diagram label' }]
														}
													]
												}
											}
										}
									}
								]
							}
						]
					}
				]
			}) satisfies ZineDocument;

			const { container } = render(ZineRenderer, { props: { document } });
			await waitFor(() => {
				expect(container.querySelector('.zine-scene')?.getAttribute('data-fit-collapse')).toBe(
					'true'
				);
			});
			expect(container.querySelector('.zine-scene')?.getAttribute('data-layout')).toBe('stacked');
			expect(container.querySelector('.zine-scene')?.getAttribute('style')).toBeNull();
			expect(container.querySelector('.zine-scene__inner.is-pinned')).toBeNull();
			expect(container.querySelector('.zine-pinned-actor')).toBeNull();
			expect(
				container.querySelector('.zine-flow-actor[data-track="media"] .zine-block')
			).toBeTruthy();
			expect(container.querySelector('.zine-block')?.getAttribute('data-text-kind')).toBe('other');
		} finally {
			window.matchMedia = originalMatchMedia;
			if (originalInnerHeight) Object.defineProperty(window, 'innerHeight', originalInnerHeight);
			HTMLElement.prototype.getBoundingClientRect = originalRect;
		}
	});
});
