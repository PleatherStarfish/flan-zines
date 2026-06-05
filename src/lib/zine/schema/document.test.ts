import { describe, expect, it } from 'vitest';
import { DocumentError, parseDocument, publishBlockers, safeParseDocument } from './migrate';
import { sampleZineRaw } from '../fixtures';

const wrap = (block: unknown) => ({
	schemaVersion: 1,
	sections: [{ id: 'sec', blocks: [block] }]
});

describe('document schema', () => {
	it('parses the sample fixture as the current v3 story model', () => {
		const doc = parseDocument(sampleZineRaw);
		expect(doc.schemaVersion).toBe(3);
		expect(doc.acts).toHaveLength(1);
		expect(doc.acts[0].scenes).toHaveLength(2);
		expect(doc.acts[0].scenes[0].type).toBe('page');
		expect(doc.acts[0].scenes[0].presentation?.legacyLayout).toBe('centered');
	});

	it('returns registry-parsed block props, including defaults', () => {
		const doc = parseDocument(wrap({ id: 'b', type: 'heading', props: { text: 'Default me' } }));
		expect(doc.acts[0].scenes[0].elements[0].block.props).toEqual({
			text: 'Default me',
			level: 2
		});
	});

	it('rejects a page scene without exactly one beat at 0', () => {
		const result = safeParseDocument({
			schemaVersion: 3,
			acts: [
				{
					id: 'act',
					scenes: [
						{
							id: 'scn',
							type: 'page',
							length: 'auto',
							beats: [{ id: 'beat', at: 0.5 }],
							elements: []
						}
					]
				}
			]
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.message).toMatch(/one beat at 0/i);
	});

	it('rejects an element anchorBeat outside its scene', () => {
		const result = safeParseDocument({
			schemaVersion: 3,
			acts: [
				{
					id: 'act',
					scenes: [
						{
							id: 'scn',
							type: 'feature',
							length: 'auto',
							beats: [{ id: 'beat', at: 0 }],
							elements: [
								{
									id: 'el',
									track: 'content',
									block: { id: 'b', type: 'heading', props: { text: 'x' } },
									range: { start: 0, end: 1 },
									anchorBeat: 'missing'
								}
							]
						}
					]
				}
			]
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.message).toMatch(/anchorBeat/i);
	});

	it('rejects an unknown block type with a clear, pointed error', () => {
		const result = safeParseDocument(wrap({ id: 'b', type: 'whoops', props: {} }));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.message).toMatch(/Unknown block type: "whoops"/);
	});

	it('rejects invalid block props with a props-path error', () => {
		// heading requires non-empty `text`
		const result = safeParseDocument(wrap({ id: 'b', type: 'heading', props: { level: 2 } }));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.message).toMatch(/props/);
	});

	it('rejects an unsafe (javascript:) link URL', () => {
		const result = safeParseDocument(
			wrap({ id: 'b', type: 'linkButton', props: { href: 'javascript:alert(1)', label: 'x' } })
		);
		expect(result.ok).toBe(false);
	});

	it('rejects a rich-text link with an unsafe URL', () => {
		const doc = {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [
						{
							type: 'text',
							text: 'x',
							marks: [{ type: 'link', attrs: { href: 'data:text/html,x' } }]
						}
					]
				}
			]
		};
		expect(safeParseDocument(wrap({ id: 'b', type: 'richText', props: { doc } })).ok).toBe(false);
	});

	it('rejects unsafe author-controlled CSS values before render', () => {
		expect(
			safeParseDocument({
				schemaVersion: 1,
				theme: { accent: '#E4572E;background:url(https://example.com/x)' },
				sections: []
			}).ok
		).toBe(false);

		expect(
			safeParseDocument({
				schemaVersion: 1,
				sections: [{ id: 'sec', background: { color: 'url(javascript:alert(1))' }, blocks: [] }]
			}).ok
		).toBe(false);
	});

	it('accepts an image with empty alt as a draft, but flags it at publish time', () => {
		const doc = parseDocument(wrap({ id: 'b', type: 'image', props: { src: '/x.svg', alt: '' } }));
		const blockers = publishBlockers(doc);
		expect(blockers).toHaveLength(1);
		expect(blockers[0]).toMatch(/alt text/i);
	});

	it('reports no publish blockers for the complete fixture', () => {
		expect(publishBlockers(parseDocument(sampleZineRaw))).toEqual([]);
	});

	it('throws DocumentError for non-object input', () => {
		expect(() => parseDocument(42)).toThrow(DocumentError);
	});
});
