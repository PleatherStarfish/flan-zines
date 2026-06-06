// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import ZineRenderer from './ZineRenderer.svelte';
import { seriousAxeViolations } from './axe-helper';
import { composeElementStyle, type EffectImplMap } from './timeline';
import { parseDocument } from '../schema/migrate';
import { getEffect } from '../registry';
import { DEFAULT_WAYPOINTS } from '../animations/path';
import type { Element, ZineDocument } from '../schema/document';

function freeSceneRaw() {
	return {
		schemaVersion: 5,
		theme: { fontPair: 'custom:caveat:inter' },
		acts: [
			{
				id: 'act_1',
				scenes: [
					{
						id: 'scn_free',
						type: 'feature',
						length: 'auto',
						beats: [{ id: 'beat_1', at: 0 }],
						elements: [
							{
								id: 'el_char',
								track: 'media',
								placement: 'free',
								block: {
									id: 'blk_char',
									type: 'image',
									props: { src: '/x.svg', alt: 'a character' }
								},
								range: { start: 0, end: 1 },
								motion: { type: 'path', params: { waypoints: DEFAULT_WAYPOINTS } }
							}
						]
					}
				]
			}
		]
	};
}

describe('free-element scene rendering', () => {
	it('renders the free sprite in the viewport stage overlay (not in flow)', () => {
		const doc = parseDocument(freeSceneRaw());
		const { container, unmount } = render(ZineRenderer, {
			props: { document: doc, sceneProgress: { scn_free: 0.5 } }
		});
		const overlay = container.querySelector('.zine-stage-overlay');
		expect(overlay).toBeTruthy();
		expect(overlay!.querySelector('.zine-free-actor')).toBeTruthy();
		unmount();
	});

	it('has no serious accessibility violations', async () => {
		const doc = parseDocument(freeSceneRaw());
		const { container, unmount } = render(ZineRenderer, {
			props: { document: doc, title: 'A zine', sceneProgress: { scn_free: 0 } }
		});
		expect(await seriousAxeViolations(container)).toEqual([]);
		unmount();
	});
});

describe('path motion drives a transform; reduced motion neutralises it', () => {
	it('applies the interpolated path transform mid-scroll', async () => {
		const impl = await getEffect('path')!.load();
		const impls: EffectImplMap = new Map([['path', impl]]);
		const element = {
			id: 'el',
			track: 'media',
			placement: 'free',
			block: { id: 'b', type: 'image', props: { src: '/x.svg', alt: 'x' } },
			range: { start: 0, end: 1 },
			motion: { type: 'path', params: { waypoints: DEFAULT_WAYPOINTS } }
		} as unknown as Element;
		const mid = composeElementStyle(element, 0.5, impls, { reducedMotion: false });
		expect(mid.style).toContain('translate(calc(');
		expect(mid.style).toContain('cqw');
		// reduced motion → neutral, no transform (free element falls back to flow centring)
		const reduced = composeElementStyle(element, 0.5, impls, { reducedMotion: true });
		expect(reduced.style).toBe('');
	});
});

describe('the full v1 → v5 migration chain is lossless for content', () => {
	it('migrates a v1 document to v5 preserving acts/scenes/blocks', () => {
		const v1 = {
			schemaVersion: 1,
			theme: { palette: 'dusk', fontPair: 'mono', accent: '#38bdf8' },
			sections: [
				{
					id: 'sec_a',
					layout: 'centered',
					blocks: [
						{ id: 'blk_h', type: 'heading', props: { text: 'Hello', level: 2 } },
						{
							id: 'blk_p',
							type: 'richText',
							props: {
								doc: {
									type: 'doc',
									content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body' }] }]
								}
							}
						}
					]
				}
			]
		};
		const doc: ZineDocument = parseDocument(v1);
		expect(doc.schemaVersion).toBe(5);
		const scene = doc.acts[0].scenes[0];
		expect(scene.elements.map((e) => e.block.type)).toEqual(['heading', 'richText']);
		// the heading text survives the section→scene→element migration
		expect((scene.elements[0].block.props as { text: string }).text).toBe('Hello');
		// legacy theme keys are resolved into the v4 colour model + fontPair carried forward
		expect(doc.theme?.colors?.background).toBe('#161a23'); // dusk bg
		expect(doc.theme?.fontPair).toBe('mono');
	});
});

describe('quality fixes', () => {
	it('derives dark-scene text from the theme, not a hardcoded colour', () => {
		const doc = parseDocument({
			schemaVersion: 5,
			theme: {
				colors: {
					background: '#ffffff',
					text: '#111111',
					heading: '#111111',
					accent: '#ff5500',
					muted: '#777777'
				}
			},
			acts: [
				{
					id: 'a',
					scenes: [
						{
							id: 'dark',
							type: 'feature',
							length: 'auto',
							background: { color: '#0b0b18' },
							beats: [{ id: 'b', at: 0 }],
							elements: [
								{
									id: 'el',
									track: 'content',
									block: { id: 'blk', type: 'heading', props: { text: 'Hi', level: 2 } },
									range: { start: 0, end: 1 }
								}
							]
						}
					]
				}
			]
		});
		const { container, unmount } = render(ZineRenderer, { props: { document: doc } });
		const style = container.querySelector('.zine-scene')?.getAttribute('style') ?? '';
		expect(style).toMatch(/--zine-fg:\s*#ffffff/i); // theme's lightest tone
		expect(style).not.toMatch(/#fff3c4/i); // not the old hardcoded cream
		unmount();
	});

	it('gives a non-pinned free scene the has-free stage class (visible in mini-preview)', () => {
		const doc = parseDocument(freeSceneRaw());
		const { container, unmount } = render(ZineRenderer, {
			props: { document: doc, pinScenes: false, sceneProgress: { scn_free: 0 } }
		});
		const inner = container.querySelector('.zine-scene__inner.has-free');
		expect(inner).toBeTruthy();
		expect(inner!.classList.contains('is-pinned')).toBe(false);
		unmount();
	});
});
