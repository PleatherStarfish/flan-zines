import { afterEach, describe, expect, it } from 'vitest';
import { EditorStore } from './store.svelte';
import { parseDocument } from '$lib/zine/schema/migrate';
import type { ZineDocument } from '$lib/zine/schema/document';
import type { SaveResult } from './autosave';

const okSave = async (): Promise<SaveResult> => ({ ok: true, clientRev: 1, updatedAt: 't' });

function makeStore(): EditorStore {
	const document = {
		schemaVersion: 3,
		theme: {},
		acts: [
			{
				id: 'act_1',
				scenes: [
					{
						id: 'scn_1',
						type: 'page',
						length: 'auto',
						beats: [{ id: 'beat_1', at: 0 }],
						elements: []
					}
				]
			}
		]
	} satisfies ZineDocument;
	return new EditorStore({ document, zineId: 'z1', baseUpdatedAt: null, save: okSave });
}

function elements(store: EditorStore) {
	return store.doc.acts[0].scenes[0].elements;
}

let store: EditorStore | undefined;
afterEach(() => store?.dispose());

describe('EditorStore', () => {
	it('adds an element with registry defaults and selects it', () => {
		store = makeStore();
		const id = store.addElement('scn_1', 'heading');
		expect(id).toBeTruthy();
		expect(store.selectedId).toBe(id);
		expect(elements(store)).toHaveLength(1);
		expect(elements(store)[0].block.props).toEqual({ text: 'Section heading', level: 2 });
		expect(elements(store)[0].range).toEqual({ start: 0, end: 1 });
	});

	it('undo and redo an element insert', () => {
		store = makeStore();
		store.addElement('scn_1', 'heading');
		expect(elements(store)).toHaveLength(1);
		expect(store.canUndo).toBe(true);
		store.undo();
		expect(elements(store)).toHaveLength(0);
		expect(store.canRedo).toBe(true);
		store.redo();
		expect(elements(store)).toHaveLength(1);
	});

	it('moves and removes elements', () => {
		store = makeStore();
		const a = store.addElement('scn_1', 'heading')!;
		const b = store.addElement('scn_1', 'divider')!;
		expect(elements(store).map((element) => element.id)).toEqual([a, b]);
		store.moveElement(b, 'up');
		expect(elements(store).map((element) => element.id)).toEqual([b, a]);
		store.removeElement(a);
		expect(elements(store).map((element) => element.id)).toEqual([b]);
	});

	it('updateElementBlockProps replaces the nested block props', () => {
		store = makeStore();
		const id = store.addElement('scn_1', 'heading')!;
		store.updateElementBlockProps(id, { text: 'New', level: 3 });
		expect(store.selectedBlock?.block.props).toEqual({ text: 'New', level: 3 });
	});

	it('adds scenes and reorders them', () => {
		store = makeStore();
		const s2 = store.addScene('act_1', 'feature');
		expect(store.doc.acts[0].scenes.map((scene) => scene.id)).toEqual(['scn_1', s2]);
		store.moveScene(s2, 'up');
		expect(store.doc.acts[0].scenes.map((scene) => scene.id)).toEqual([s2, 'scn_1']);
		expect(store.doc.acts[0].scenes[0].type).toBe('feature');
	});

	it('adds, updates, orders, and removes beats', () => {
		store = makeStore();
		store.setSceneType('scn_1', 'reveal');
		const b2 = store.addBeat('scn_1', 0.75);
		const b1 = store.addBeat('scn_1', 0.25);
		expect(store.doc.acts[0].scenes[0].beats.map((beat) => beat.id)).toEqual(['beat_1', b1, b2]);
		store.updateBeat('scn_1', b2, { at: 0.5, label: 'Middle' });
		expect(store.doc.acts[0].scenes[0].beats[2]).toMatchObject({
			id: b2,
			at: 0.5,
			label: 'Middle'
		});
		store.removeBeat('scn_1', b1);
		expect(store.doc.acts[0].scenes[0].beats.map((beat) => beat.id)).toEqual(['beat_1', b2]);
	});

	it('keeps compatibility wrappers for the temporary Step-3 shell', () => {
		store = makeStore();
		const sceneId = store.addSection('feature');
		expect(store.doc.acts[0].scenes.at(-1)?.type).toBe('feature');
		const elementId = store.addBlock(sceneId, 'heading')!;
		store.updateBlockProps(elementId, { text: 'Compat', level: 2 });
		expect(store.selectedBlock?.block.props).toEqual({ text: 'Compat', level: 2 });
	});

	it('produces a document that re-parses cleanly (reload round-trip)', () => {
		store = makeStore();
		store.addElement('scn_1', 'heading');
		store.updateElementBlockProps(store.selectedId!, { text: 'Hello', level: 2 });
		store.addScene('act_1', 'feature');
		const plain = JSON.parse(JSON.stringify(store.doc));
		const reparsed = parseDocument(plain);
		expect(reparsed.acts[0].scenes).toHaveLength(2);
		expect(reparsed.acts[0].scenes[0].elements[0].block.props).toEqual({
			text: 'Hello',
			level: 2
		});
		expect(reparsed.acts[0].scenes[1].type).toBe('feature');
	});
});
