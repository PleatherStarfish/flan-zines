import { describe, expect, it } from 'vitest';
import {
	blockHasInteractiveContent,
	clampNudge,
	pinNudgeStyle,
	pinRegion,
	pinnedContentProblem
} from './pinned';
import type { Block } from '../schema/document';

describe('clampNudge', () => {
	it('clamps to the bounded step range and rounds', () => {
		expect(clampNudge(0)).toBe(0);
		expect(clampNudge(3.4)).toBe(3);
		expect(clampNudge(99)).toBe(6);
		expect(clampNudge(-99)).toBe(-6);
	});
	it('treats a non-finite nudge as zero', () => {
		expect(clampNudge(NaN)).toBe(0);
		expect(clampNudge(Infinity)).toBe(0);
	});
});

describe('pinRegion', () => {
	it('defaults to center', () => {
		expect(pinRegion(undefined)).toBe('center');
		expect(pinRegion({ region: 'top-left', dx: 0, dy: 0 })).toBe('top-left');
	});
});

describe('pinNudgeStyle', () => {
	it('is empty with no nudge (so no stray translate overrides the region transform)', () => {
		expect(pinNudgeStyle(undefined)).toBe('');
		expect(pinNudgeStyle({ region: 'center', dx: 0, dy: 0 })).toBe('');
	});
	it('emits a translate longhand in rem steps', () => {
		expect(pinNudgeStyle({ region: 'center', dx: 2, dy: -1 })).toBe('translate:1.50rem -0.75rem');
	});
	it('clamps an out-of-range nudge', () => {
		expect(pinNudgeStyle({ region: 'center', dx: 99, dy: 0 })).toBe('translate:4.50rem 0.00rem');
	});
});

describe('blockHasInteractiveContent', () => {
	const richText = (doc: unknown): Pick<Block, 'type' | 'props'> => ({
		type: 'richText',
		props: { doc } as Block['props']
	});

	it('flags a linkButton block', () => {
		expect(blockHasInteractiveContent({ type: 'linkButton', props: {} as Block['props'] })).toBe(
			true
		);
	});

	it('flags a richText with a link mark (even nested in a list)', () => {
		const doc = {
			type: 'doc',
			content: [
				{
					type: 'bulletList',
					content: [
						{
							type: 'listItem',
							content: [
								{
									type: 'paragraph',
									content: [
										{ type: 'text', text: 'see ', marks: [] },
										{
											type: 'text',
											text: 'here',
											marks: [{ type: 'link', attrs: { href: 'https://x.test' } }]
										}
									]
								}
							]
						}
					]
				}
			]
		};
		expect(blockHasInteractiveContent(richText(doc))).toBe(true);
	});

	it('does not flag plain richText or a heading', () => {
		const doc = {
			type: 'doc',
			content: [{ type: 'paragraph', content: [{ type: 'text', text: 'plain' }] }]
		};
		expect(blockHasInteractiveContent(richText(doc))).toBe(false);
		expect(
			blockHasInteractiveContent({
				type: 'heading',
				props: { text: 'Title', level: 2 } as Block['props']
			})
		).toBe(false);
	});
});

describe('pinnedContentProblem', () => {
	it('reuses the interactive-content guard message', () => {
		expect(pinnedContentProblem({ type: 'linkButton', props: {} as Block['props'] })).toMatch(
			/links or buttons/i
		);
	});

	it('flags pinned text that is too long for the screen', () => {
		const doc = {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'x'.repeat(241) }]
				}
			]
		};
		expect(pinnedContentProblem({ type: 'richText', props: { doc } as Block['props'] })).toMatch(
			/short enough/i
		);
		expect(
			pinnedContentProblem({
				type: 'heading',
				props: { text: 'A short point', level: 2 } as Block['props']
			})
		).toBeNull();
	});

	it('flags tall portrait images when dimensions are known', () => {
		expect(
			pinnedContentProblem({
				type: 'image',
				props: { src: '/x.svg', alt: 'x', width: 300, height: 600 } as Block['props']
			})
		).toMatch(/landscape or square/i);
		expect(
			pinnedContentProblem({
				type: 'image',
				props: { src: '/x.svg', alt: 'x', width: 600, height: 360 } as Block['props']
			})
		).toBeNull();
	});
});
