import { afterEach, describe, expect, it } from 'vitest';
import { EditorStore } from './store.svelte';
import type { ZineDocument } from '$lib/zine/schema/document';
import type { SaveResult } from './autosave';

const okSave = async (): Promise<SaveResult> => ({ ok: true, clientRev: 1, updatedAt: 't' });

function makeStore(): EditorStore {
	const document = { schemaVersion: 7, theme: {}, acts: [] } satisfies ZineDocument;
	return new EditorStore({ document, zineId: 'z1', baseUpdatedAt: null, save: okSave });
}

let store: EditorStore | undefined;
afterEach(() => store?.dispose());

describe('document pacing intent', () => {
	it('sets and clears the scene-flow pacing', () => {
		store = makeStore();
		expect(store.doc.pacing).toBeUndefined(); // absent = the renderer's cozy default
		store.setPacing('roomy');
		expect(store.doc.pacing).toBe('roomy');
		store.setPacing('tight');
		expect(store.doc.pacing).toBe('tight');
		store.setPacing(undefined);
		expect(store.doc.pacing).toBeUndefined();
	});
});
