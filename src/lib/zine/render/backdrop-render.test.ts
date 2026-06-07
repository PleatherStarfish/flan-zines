// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import ZineRenderer from './ZineRenderer.svelte';
import { seriousAxeViolations } from './axe-helper';
import { parseDocument } from '../schema/migrate';

function twoSceneRaw(pacing?: string) {
	return {
		schemaVersion: 7,
		...(pacing ? { pacing } : {}),
		acts: [
			{
				id: 'act_1',
				scenes: [
					{
						id: 'scn_a',
						type: 'feature',
						length: 'auto',
						background: { color: '#102030' },
						beats: [{ id: 'b1', at: 0 }],
						elements: [
							{
								id: 'el_a',
								track: 'content',
								range: { start: 0, end: 1 },
								block: { id: 'blk_a', type: 'heading', props: { text: 'Scene A', level: 2 } }
							}
						]
					},
					{
						id: 'scn_b',
						type: 'feature',
						length: 'auto',
						background: { color: '#a0c0ff' },
						beats: [{ id: 'b2', at: 0 }],
						elements: [
							{
								id: 'el_b',
								track: 'content',
								range: { start: 0, end: 1 },
								block: { id: 'blk_b', type: 'heading', props: { text: 'Scene B', level: 2 } }
							}
						]
					}
				]
			}
		]
	};
}

describe('continuous backdrop crossfade', () => {
	it('hoists scene backgrounds into ONE viewport backdrop with a slot per scene', () => {
		const doc = parseDocument(twoSceneRaw());
		const { container, unmount } = render(ZineRenderer, { props: { document: doc, drive: true } });
		const backdrop = container.querySelector('.zine-backdrop');
		expect(backdrop).toBeTruthy();
		expect(backdrop!.querySelectorAll('.zine-backdrop__slot')).toHaveLength(2);
		// the scene sections themselves no longer paint an opaque background (it would cover the
		// fixed backdrop) — the slots carry the colour instead.
		const slotBgs = [...backdrop!.querySelectorAll<HTMLElement>('.zine-backdrop__slot')].map((s) =>
			s.style.background.replace(/\s/g, '')
		);
		expect(slotBgs).toContain('rgb(16,32,48)'); // #102030
		const section = container.querySelector<HTMLElement>('[data-scene-id="scn_a"]');
		expect(section!.style.background).toBe('');
		unmount();
	});

	it('applies the breathing-room gap variable from pacing', () => {
		const doc = parseDocument(twoSceneRaw('roomy'));
		const { container, unmount } = render(ZineRenderer, { props: { document: doc, drive: true } });
		const article = container.querySelector<HTMLElement>('.zine.has-backdrop');
		expect(article).toBeTruthy();
		// roomy → a larger svh gap than the default cozy
		expect(article!.style.getPropertyValue('--zine-gap')).toMatch(/svh$/);
		unmount();
	});

	it('keeps per-scene backgrounds as the baseline when NOT enhanced (no-JS / no drive)', () => {
		// Regression: the crossfade must be a progressive enhancement. Without `drive` (the
		// pre-hydration / no-JS / non-reader case) backgrounds still appear per-scene, and the
		// fixed backdrop — which would otherwise hide behind the article's own background — is
		// not rendered at all.
		const doc = parseDocument(twoSceneRaw());
		const { container, unmount } = render(ZineRenderer, { props: { document: doc } });
		expect(container.querySelector('.zine-backdrop')).toBeNull();
		// each scene paints its own background in its section (the readable baseline)
		const section = container.querySelector<HTMLElement>('[data-scene-id="scn_a"]');
		expect(section!.style.background.replace(/\s/g, '')).toContain('rgb(16,32,48)');
		unmount();
	});

	it('has no serious accessibility violations (backdrop is aria-hidden)', async () => {
		const doc = parseDocument(twoSceneRaw());
		const { container, unmount } = render(ZineRenderer, {
			props: { document: doc, title: 'A zine', drive: true }
		});
		expect(container.querySelector('.zine-backdrop')!.getAttribute('aria-hidden')).toBe('true');
		expect(await seriousAxeViolations(container)).toEqual([]);
		unmount();
	});
});
