import { describe, expect, it } from 'vitest';
import { DocumentError, parseDocument, publishBlockers, safeParseDocument } from './migrate';
import { sampleZineRaw } from '../fixtures';

const wrap = (block: unknown) => ({
	schemaVersion: 1,
	sections: [{ id: 'sec', blocks: [block] }]
});

describe('document schema', () => {
	it('parses the sample fixture into a typed document', () => {
		const doc = parseDocument(sampleZineRaw);
		expect(doc.schemaVersion).toBe(1);
		expect(doc.sections.length).toBe(2);
		// section.layout defaulted by the schema
		expect(doc.sections[0].layout).toBe('centered');
	});

	it('returns registry-parsed block props, including defaults', () => {
		const doc = parseDocument(wrap({ id: 'b', type: 'heading', props: { text: 'Default me' } }));
		expect(doc.sections[0].blocks[0].props).toEqual({ text: 'Default me', level: 2 });
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
