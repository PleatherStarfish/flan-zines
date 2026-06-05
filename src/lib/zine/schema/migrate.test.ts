import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION } from './document';
import { DocumentError, migrateToLatest, parseDocument } from './migrate';

const currentDoc = { schemaVersion: CURRENT_SCHEMA_VERSION, acts: [] };

describe('document migrations', () => {
	it('passes a current-version document through unchanged', () => {
		expect(migrateToLatest(currentDoc)).toEqual(currentDoc);
	});

	it('requires an explicit schemaVersion (a versionless doc is version 0)', () => {
		expect(() => migrateToLatest({ acts: [] })).toThrow(/schemaVersion 0/);
	});

	it('rejects a future schema version it cannot understand', () => {
		expect(() => parseDocument({ schemaVersion: 99, acts: [] })).toThrow(DocumentError);
	});

	it('rejects non-object / array input', () => {
		expect(() => migrateToLatest(null)).toThrow(DocumentError);
		expect(() => migrateToLatest([])).toThrow(DocumentError);
	});

	it('migrates v1 layout → v3 scenes, preserving layout and kind notes losslessly', () => {
		const raw = migrateToLatest({
			schemaVersion: 1,
			sections: [
				{ id: 'sec_a', layout: 'grid', blocks: [] },
				{ id: 'sec_b', layout: 'full-bleed', blocks: [] },
				{ id: 'sec_c', layout: 'split', blocks: [] }
			]
		});
		expect(raw.schemaVersion).toBe(3);
		const acts = raw.acts as Array<{ scenes: Array<Record<string, unknown>> }>;
		expect(acts).toHaveLength(1);
		expect(acts[0].scenes.map((scene) => scene.type)).toEqual(['page', 'feature', 'feature']);
		expect(acts[0].scenes.map((scene) => scene.presentation)).toEqual([
			{ legacyLayout: 'grid', legacyKind: 'prose' },
			{ legacyLayout: 'full-bleed', legacyKind: 'feature' },
			{ legacyLayout: 'split', legacyKind: 'split' }
		]);
		expect('sections' in raw).toBe(false);
	});

	it('migrates a v2 document into one default act with block-backed elements', () => {
		const doc = parseDocument({
			schemaVersion: 2,
			sections: [
				{
					id: 'sec_a',
					kind: 'split',
					presentation: { legacyLayout: 'split' },
					blocks: [{ id: 'blk_1', type: 'heading', props: { text: 'Hi' } }]
				},
				{ id: 'sec_b', kind: 'sources', blocks: [] }
			]
		});

		expect(doc.schemaVersion).toBe(3);
		expect(doc.acts).toHaveLength(1);
		expect(doc.acts[0].scenes.map((scene) => scene.type)).toEqual(['feature', 'page']);
		expect(doc.acts[0].scenes[0].presentation).toEqual({
			legacyLayout: 'split',
			legacyKind: 'split'
		});
		expect(doc.acts[0].scenes[0].elements[0]).toMatchObject({
			id: 'el_1',
			track: 'content',
			range: { start: 0, end: 1 },
			block: { id: 'blk_1', type: 'heading', props: { text: 'Hi', level: 2 } }
		});
	});

	it('migrates v2 scrolly steps into a reveal scene with beats carrying state', () => {
		const doc = parseDocument({
			schemaVersion: 2,
			sections: [
				{
					id: 'sec_scroll',
					kind: 'scrolly',
					blocks: [
						{ id: 'blk_fig', type: 'image', role: 'graphic', props: { src: '/x.svg', alt: 'x' } },
						{
							id: 'blk_s1',
							type: 'richText',
							role: 'step',
							props: {
								doc: {
									type: 'doc',
									content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }]
								}
							},
							state: { view: 'one' }
						},
						{
							id: 'blk_s2',
							type: 'richText',
							role: 'step',
							props: {
								doc: {
									type: 'doc',
									content: [{ type: 'paragraph', content: [{ type: 'text', text: 'two' }] }]
								}
							},
							state: { view: 'two' }
						}
					]
				}
			]
		});

		const scene = doc.acts[0].scenes[0];
		expect(scene.type).toBe('reveal');
		expect(scene.beats).toEqual([
			{ id: 'beat_s1', at: 0, state: { view: 'one' } },
			{ id: 'beat_s2', at: 1, state: { view: 'two' } }
		]);
		expect(scene.elements.map((element) => element.track)).toEqual(['media', 'content', 'content']);
		expect(scene.elements[1].anchorBeat).toBe('beat_s1');
		expect(scene.elements[2].anchorBeat).toBe('beat_s2');
	});
});
