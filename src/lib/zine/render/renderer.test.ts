// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
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
		const levels = [...container.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) =>
			Number(h.tagName[1])
		);
		expect(levels[0]).toBe(1);
		for (let i = 1; i < levels.length; i++) {
			expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
		}
	});

	it('has no critical or serious axe violations', async () => {
		const { container } = renderFixture();
		expect(await seriousAxeViolations(container)).toEqual([]);
	});

	it('applies timeline scrub state only when the editor preview provides scene progress', () => {
		const document = parseDocument({
			schemaVersion: 5,
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
		expect(staticRender.container.querySelector('.zine-block')?.getAttribute('style')).toBeNull();
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

	it('renders text blocks transparent by default, with explicit tight readability backdrops', () => {
		const document = parseDocument({
			schemaVersion: 5,
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
		expect(blocks[0].getAttribute('style')).toBeNull();

		expect(blocks[1].getAttribute('data-text-backdrop')).toBe('box');
		expect(blocks[1].getAttribute('style')).toMatch(/--zine-text-backdrop-color:\s*#14181f/);
		expect(blocks[1].getAttribute('style')).toMatch(/--zine-text-backdrop-opacity:\s*80%/);
		expect(blocks[1].querySelector(':scope > .zine-heading')).toBeTruthy();

		expect(blocks[2].getAttribute('data-text-backdrop')).toBe('circle');
		expect(blocks[2].getAttribute('style')).toMatch(/--zine-text-backdrop-color:\s*#FFF3C4/);
		expect(blocks[2].getAttribute('style')).toMatch(/--zine-text-backdrop-opacity:\s*55%/);
		expect(blocks[2].querySelector(':scope > .zine-richtext')).toBeTruthy();
	});

	it('keeps free text transparent over canvas scene backgrounds unless a backdrop is explicit', () => {
		const document = parseDocument({
			schemaVersion: 5,
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
				schemaVersion: 5,
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
			schemaVersion: 5,
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
				schemaVersion: 5,
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
});
