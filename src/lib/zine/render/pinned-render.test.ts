// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import ZineRenderer from './ZineRenderer.svelte';
import { seriousAxeViolations } from './axe-helper';
import { parseDocument } from '../schema/migrate';

function pinnedSceneRaw(progressElements = true) {
	return {
		schemaVersion: 7,
		acts: [
			{
				id: 'act_1',
				scenes: [
					{
						id: 'scn_pin',
						type: 'reveal',
						length: 'long',
						beats: [{ id: 'beat_1', at: 0 }],
						elements: [
							{
								id: 'el_pin',
								track: 'content',
								placement: 'pinned',
								anchor: { region: 'top-left', dx: 2, dy: 0 },
								block: {
									id: 'blk_pin',
									type: 'heading',
									props: { text: 'A pinned title', level: 2 },
									style: { typeset: { role: 'headline' } }
								},
								range: { start: 0, end: 0.5 }
							},
							// a flow block to confirm justify is clamped on a narrow measure
							...(progressElements
								? [
										{
											id: 'el_body',
											track: 'content',
											block: {
												id: 'blk_body',
												type: 'richText',
												props: {
													doc: {
														type: 'doc',
														content: [
															{ type: 'paragraph', content: [{ type: 'text', text: 'Body copy.' }] }
														]
													}
												},
												style: { align: 'justify', typeset: { measure: 'narrow' } }
											},
											range: { start: 0, end: 1 }
										}
									]
								: [])
						]
					}
				]
			}
		]
	};
}

describe('pinned-content scene rendering', () => {
	it('renders pinned other text in the overlay at its region without editorial typeset', () => {
		const doc = parseDocument(pinnedSceneRaw());
		const { container, unmount } = render(ZineRenderer, {
			props: { document: doc, sceneProgress: { scn_pin: 0.2 } }
		});
		const actor = container.querySelector<HTMLElement>('.zine-stage-overlay .zine-pinned-actor');
		expect(actor).toBeTruthy();
		expect(actor!.getAttribute('data-region')).toBe('top-left');
		// the nudge rides the `translate` longhand (composes with the region transform)
		expect(actor!.getAttribute('style')).toContain('translate:');
		// pinned text is Other text now, so it does not carry editorial Content text typesetting.
		const block = actor!.querySelector('.zine-block');
		expect(block!.getAttribute('data-text-kind')).toBe('other');
		expect(block!.getAttribute('data-typeset-role')).toBeNull();
		// it's visible mid-range → not inert
		expect(actor!.hasAttribute('inert')).toBe(false);
		unmount();
	});

	it('marks the pinned actor inert + aria-hidden once it has animated out', () => {
		const doc = parseDocument(pinnedSceneRaw());
		const { container, unmount } = render(ZineRenderer, {
			props: { document: doc, sceneProgress: { scn_pin: 0.95 } } // past range.end (0.5)
		});
		const actor = container.querySelector<HTMLElement>('.zine-pinned-actor');
		// aria-hidden is a reflected attribute; `inert` is set as a DOM property by Svelte.
		expect(actor!.getAttribute('aria-hidden')).toBe('true');
		expect(actor!.inert).toBe(true);
		unmount();
	});

	it('clamps justify to left on a narrow measure (renderer-enforced, not just hidden UI)', () => {
		const doc = parseDocument(pinnedSceneRaw());
		const { container, unmount } = render(ZineRenderer, {
			props: { document: doc, sceneProgress: { scn_pin: 0.2 } }
		});
		const body = container.querySelector('[data-block-id], .zine-flow-actor .zine-block');
		// find the body block by its typeset measure marker
		const bodyBlock = [...container.querySelectorAll('.zine-block')].find((b) =>
			(b.getAttribute('style') ?? '').includes('--zine-ts-measure')
		);
		expect(bodyBlock).toBeTruthy();
		expect(bodyBlock!.getAttribute('data-align')).toBe('left'); // justify downgraded
		void body;
		unmount();
	});

	it('has no serious accessibility violations', async () => {
		const doc = parseDocument(pinnedSceneRaw());
		const { container, unmount } = render(ZineRenderer, {
			props: { document: doc, title: 'A zine', sceneProgress: { scn_pin: 0.2 } }
		});
		expect(await seriousAxeViolations(container)).toEqual([]);
		unmount();
	});
});
