// Integration hardening: the store must never produce a document that fails its own schema
// (that would make autosave silently reject the student's work). Exercises the scene
// starters, the path/theme intents, undo/redo, and the equal-`at` guard.
import { afterEach, describe, expect, it } from 'vitest';
import { EditorStore } from './store.svelte';
import { parseDocument } from '$lib/zine/schema/migrate';
import { SCENE_TYPES, type ZineDocument } from '$lib/zine/schema/document';
import { getThemeCatalogue } from '$lib/zine/theme/catalogue';
import type { SaveResult } from './autosave';
import type { Waypoint } from '$lib/zine/animations/path';

const okSave = async (): Promise<SaveResult> => ({ ok: true, clientRev: 1, updatedAt: 't' });

function makeStore(): EditorStore {
	const document = {
		schemaVersion: 7,
		theme: {},
		acts: [{ id: 'act_1', scenes: [] }]
	} satisfies ZineDocument;
	return new EditorStore({ document, zineId: 'z1', baseUpdatedAt: null, save: okSave });
}

/** Re-parse the store's live document exactly as autosave/reload would. */
function reparse(store: EditorStore): ZineDocument {
	return parseDocument(JSON.parse(JSON.stringify(store.doc)));
}

let store: EditorStore | undefined;
afterEach(() => store?.dispose());

describe('every scene starter is schema-valid (autosave-safe)', () => {
	for (const type of SCENE_TYPES) {
		it(`addStarterScene('${type}') produces a parseable document`, () => {
			store = makeStore();
			store.addStarterScene('act_1', type);
			expect(() => reparse(store!)).not.toThrow();
		});
	}

	it('the side-scroller starter uses no decorative heading blocks (clean heading outline)', () => {
		store = makeStore();
		store.addStarterScene('act_1', 'sidescroll');
		const scene = store.doc.acts[0].scenes.at(-1)!;
		// decorative sprites (clouds/platforms/character) must not be headings
		expect(scene.elements.every((e) => e.block.type !== 'heading')).toBe(true);
		// …and it still has a free, path-choreographed character
		expect(scene.elements.some((e) => e.placement === 'free' && e.motion?.type === 'path')).toBe(
			true
		);
	});
});

describe('path + placement intents keep the document valid', () => {
	const validPath: Waypoint[] = [
		{ at: 0, x: 10, y: 80, scale: 1, rotate: 0, ease: 'smooth' },
		{ at: 0.5, x: 50, y: 40, scale: 1, rotate: 0, ease: 'arc' },
		{ at: 1, x: 90, y: 80, scale: 1, rotate: 0, ease: 'arc' }
	];

	it('setElementPath makes the element a valid free path sprite', () => {
		store = makeStore();
		const sceneId = store.addScene('act_1', 'reveal');
		const id = store.addElement(sceneId, 'image')!;
		store.setElementPath(id, validPath);
		const doc = reparse(store);
		const el = doc.acts[0].scenes.find((s) => s.id === sceneId)!.elements.find((e) => e.id === id)!;
		expect(el.placement).toBe('free');
		expect(el.motion?.type).toBe('path');
	});

	it('rejects an equal-`at` (schema-invalid) path without corrupting the document', () => {
		store = makeStore();
		const sceneId = store.addScene('act_1', 'reveal');
		const id = store.addElement(sceneId, 'image')!;
		const bad: Waypoint[] = [
			{ at: 0.5, x: 0, y: 0, scale: 1, rotate: 0, ease: 'linear' },
			{ at: 0.5, x: 90, y: 90, scale: 1, rotate: 0, ease: 'linear' } // duplicate `at`
		];
		store.setElementPath(id, bad);
		// The document must still parse (the bad path was rejected, not written).
		expect(() => reparse(store!)).not.toThrow();
		const el = reparse(store)
			.acts[0].scenes.find((s) => s.id === sceneId)!
			.elements.find((e) => e.id === id)!;
		expect(el.motion?.type).not.toBe('path'); // not applied
	});

	it('clears an orphaned path motion when an element leaves free placement', () => {
		store = makeStore();
		const sceneId = store.addScene('act_1', 'reveal');
		const id = store.addElement(sceneId, 'image')!;
		store.setElementPath(id, validPath); // → free + path
		store.setElementPlacement(id, undefined); // → flow; the path must not be left orphaned
		const el = reparse(store)
			.acts[0].scenes.find((s) => s.id === sceneId)!
			.elements.find((e) => e.id === id)!;
		expect(el.placement).toBeUndefined();
		expect(el.motion?.type).not.toBe('path');
	});

	it('addBackdropLayer produces a valid pinned background parallax actor', () => {
		store = makeStore();
		const sceneId = store.addScene('act_1', 'reveal');
		const id = store.addBackdropLayer(sceneId)!;
		const el = reparse(store)
			.acts[0].scenes.find((s) => s.id === sceneId)!
			.elements.find((e) => e.id === id)!;
		expect(el.track).toBe('background');
		expect(el.placement).toBe('pinned');
		expect(el.motion?.type).toBe('parallax');
	});
});

describe('theme intents keep the document valid + undo round-trips', () => {
	it('applying every catalogue theme yields a parseable document', () => {
		store = makeStore();
		for (const theme of getThemeCatalogue().slice(0, 40)) {
			store!.applyThemePreset(theme);
			expect(() => reparse(store!), theme.id).not.toThrow();
		}
	});

	it('setThemeRole + a custom font keep the document valid', () => {
		store = makeStore();
		store.setThemeRole('accent', '#123456');
		store.setTheme({ fontPair: 'custom:caveat:inter' });
		const doc = reparse(store);
		expect(doc.theme?.colors?.accent).toBe('#123456');
		expect(doc.theme?.fontPair).toBe('custom:caveat:inter');
	});

	it('undo restores the previous theme exactly', () => {
		store = makeStore();
		const before = JSON.stringify(store.doc.theme ?? {});
		store.setThemeRole('background', '#abcdef');
		expect(JSON.stringify(store.doc.theme)).not.toBe(before);
		store.undo();
		expect(JSON.stringify(store.doc.theme ?? {})).toBe(before);
	});
});

describe('the curated theme catalogue is always document-valid', () => {
	const hexRe = /^#[0-9a-f]{6}$/i;
	it('every catalogue theme has HexColor role colours + swatches', () => {
		const catalogue = getThemeCatalogue();
		expect(catalogue.length).toBeGreaterThan(20);
		for (const theme of catalogue) {
			for (const c of Object.values(theme.colors))
				expect(hexRe.test(c), `${theme.id} ${c}`).toBe(true);
			for (const sw of theme.swatches)
				expect(hexRe.test(sw), `${theme.id} swatch ${sw}`).toBe(true);
		}
	});
});
