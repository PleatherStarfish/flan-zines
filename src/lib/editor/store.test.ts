import { afterEach, describe, expect, it } from 'vitest';
import { EditorStore } from './store.svelte';
import { parseDocument } from '$lib/zine/schema/migrate';
import type { ZineDocument } from '$lib/zine/schema/document';
import type { SaveResult } from './autosave';

const okSave = async (): Promise<SaveResult> => ({ ok: true, clientRev: 1, updatedAt: 't' });

function makeStore(): EditorStore {
	const document = {
		schemaVersion: 4,
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

	it('adds a timeline clip at the requested scroll position', () => {
		store = makeStore();
		const id = store.addElementAt('scn_1', 'richText', 'content', 0.55)!;
		expect(id).toBeTruthy();
		expect(elements(store)[0]).toMatchObject({
			id,
			track: 'content',
			range: { start: 0.55, end: 0.97 },
			block: { type: 'richText' }
		});
		expect(store.selectedId).toBe(id);
	});

	it('keeps timeline ranges valid when clips are dragged past the edge', () => {
		store = makeStore();
		const id = store.addElement('scn_1', 'heading')!;
		store.updateElementRange(id, { start: -0.2, end: 1.8 });
		expect(elements(store)[0].range).toEqual({ start: 0, end: 1 });
		store.updateElementRange(id, { start: 0.9, end: 0.2 });
		expect(elements(store)[0].range).toEqual({ start: 0.9, end: 0.91 });
	});

	it('moves clips between timeline lanes and stores curated motion choices', () => {
		store = makeStore();
		const id = store.addElement('scn_1', 'heading')!;
		store.updateElementTrack(id, 'background');
		store.updateElementLegacyAnimation(id, { type: 'fade-up', trigger: 'scroll' });
		expect(elements(store)[0]).toMatchObject({
			track: 'background',
			legacyAnimation: { type: 'fade-up', trigger: 'scroll' }
		});
		store.updateElementLegacyAnimation(id, undefined);
		expect(elements(store)[0].legacyAnimation).toBeUndefined();
	});

	it('sets and clears registry effects on an element, surviving a reload round-trip', () => {
		store = makeStore();
		const id = store.addElement('scn_1', 'heading')!;
		store.setElementEffect(id, 'enter', { type: 'rise', params: { speed: 'fast' } });
		store.setElementEffect(id, 'motion', { type: 'parallax', params: {} });
		expect(elements(store)[0].enter).toMatchObject({ type: 'rise' });

		const reparsed = parseDocument(JSON.parse(JSON.stringify(store.doc)));
		const reElement = reparsed.acts[0].scenes[0].elements[0];
		expect(reElement.enter).toMatchObject({ type: 'rise', params: { speed: 'fast' } });
		expect(reElement.motion?.type).toBe('parallax');

		store.setElementEffect(id, 'enter', undefined);
		expect(elements(store)[0].enter).toBeUndefined();
	});

	it('sets and clears a scene scroll length', () => {
		const s = makeStore();
		store = s;
		const sceneId = s.addScene('act_1', 'reveal');
		s.setSceneScroll(sceneId, 6);
		const scene = () => s.doc.acts[0].scenes.find((scn) => scn.id === sceneId)!;
		expect(scene().scrollLength).toBe(6);
		s.setSceneScroll(sceneId, 3.4); // snapped to whole screens
		expect(scene().scrollLength).toBe(3);
		s.setSceneScroll(sceneId, undefined);
		expect(scene().scrollLength).toBeUndefined();
	});

	it('switches a scene between vertical and side-scroll', () => {
		const s = makeStore();
		store = s;
		// A sidescroll scene is born horizontal.
		const sideId = s.addScene('act_1', 'sidescroll');
		const scene = (id: string) => s.doc.acts[0].scenes.find((x) => x.id === id)!;
		expect(scene(sideId).scrollAxis).toBe('horizontal');
		// Vertical is stored as absence of the field.
		s.setSceneScrollAxis(sideId, 'vertical');
		expect(scene(sideId).scrollAxis).toBeUndefined();
		s.setSceneScrollAxis(sideId, 'horizontal');
		expect(scene(sideId).scrollAxis).toBe('horizontal');
	});

	it('adds scenes and reorders them', () => {
		store = makeStore();
		const s2 = store.addScene('act_1', 'feature');
		expect(store.doc.acts[0].scenes.map((scene) => scene.id)).toEqual(['scn_1', s2]);
		store.moveScene(s2, 'up');
		expect(store.doc.acts[0].scenes.map((scene) => scene.id)).toEqual([s2, 'scn_1']);
		expect(store.doc.acts[0].scenes[0].type).toBe('feature');
	});

	it('adds starter scenes in one undoable mutation', () => {
		store = makeStore();
		const sceneId = store.addStarterScene('act_1', 'page');
		const scene = store.doc.acts[0].scenes.find((candidate) => candidate.id === sceneId);
		expect(scene?.elements.map((element) => element.block.type)).toEqual(['heading', 'richText']);
		expect(scene?.elements[0].range).toEqual({ start: 0, end: 1 });
		store.undo();
		expect(store.doc.acts[0].scenes.find((candidate) => candidate.id === sceneId)).toBeUndefined();
	});

	it('moves a scene before another scene by id', () => {
		store = makeStore();
		const s2 = store.addScene('act_1', 'feature');
		const s3 = store.addScene('act_1', 'reveal');
		store.moveSceneBefore(s3, 'scn_1');
		expect(store.doc.acts[0].scenes.map((scene) => scene.id)).toEqual([s3, 'scn_1', s2]);
	});

	it('does not drop a scene when moving to a missing chapter', () => {
		store = makeStore();
		store.moveSceneToActEnd('scn_1', 'missing');
		expect(store.doc.acts[0].scenes.map((scene) => scene.id)).toEqual(['scn_1']);
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

	it('applies a curated theme preset and assigns a colour to a role', () => {
		const s = makeStore();
		store = s;
		s.applyThemePreset({
			id: 'np-7',
			swatches: ['#102030', '#f0f0f0', '#ff6a3d'],
			colors: {
				background: '#f0f0f0',
				text: '#102030',
				heading: '#102030',
				accent: '#ff6a3d',
				muted: '#557788'
			}
		});
		expect(s.doc.theme?.preset).toBe('np-7');
		expect(s.doc.theme?.swatches).toEqual(['#102030', '#f0f0f0', '#ff6a3d']);
		expect(s.doc.theme?.colors?.background).toBe('#f0f0f0');

		s.setThemeRole('heading', '#ff6a3d');
		expect(s.doc.theme?.colors?.heading).toBe('#ff6a3d');
		// Other roles are untouched.
		expect(s.doc.theme?.colors?.text).toBe('#102030');
	});

	it('re-points roles bound to a swatch when that swatch is edited', () => {
		const s = makeStore();
		store = s;
		s.applyThemePreset({
			id: 'np-1',
			swatches: ['#111111', '#eeeeee', '#3366ff'],
			colors: {
				background: '#eeeeee',
				text: '#111111',
				heading: '#111111',
				accent: '#3366ff',
				muted: '#888888'
			}
		});
		// Edit swatch 0 (#111111), which both text and heading point at → both follow.
		s.setThemeSwatch(0, '#202020');
		expect(s.doc.theme?.swatches?.[0]).toBe('#202020');
		expect(s.doc.theme?.colors?.text).toBe('#202020');
		expect(s.doc.theme?.colors?.heading).toBe('#202020');
		// The accent (a different swatch) is unaffected.
		expect(s.doc.theme?.colors?.accent).toBe('#3366ff');
	});
});
