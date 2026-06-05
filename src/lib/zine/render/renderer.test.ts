// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import ZineRenderer from './ZineRenderer.svelte';
import { seriousAxeViolations } from './axe-helper';
import { parseDocument } from '../schema/migrate';
import { sampleZineMeta, sampleZineRaw } from '../fixtures';
import type { ZineDocument } from '../schema/document';

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
			schemaVersion: 3,
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

	it('sizes and pins a timeline scene to its scroll distance, but leaves page scenes in flow', () => {
		const make = (type: string, scrollLength?: number) =>
			parseDocument({
				schemaVersion: 3,
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

		// A reveal scene with scrollLength 6 → 600vh tall, content pinned.
		const pinned = render(ZineRenderer, { props: { document: make('reveal', 6) } });
		const section = pinned.container.querySelector('.zine-scene');
		expect(section?.getAttribute('style')).toMatch(/min-height:\s*600vh/);
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
	});

	it('renders a side-scroll scene as a stage of actors that pans with scroll progress', () => {
		const document = parseDocument({
			schemaVersion: 3,
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
				schemaVersion: 3,
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
