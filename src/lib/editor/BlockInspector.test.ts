// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import BlockInspector from './BlockInspector.svelte';
import { EditorStore } from './store.svelte';
import type { ZineDocument } from '$lib/zine/schema/document';
import type { SaveResult } from './autosave';

function setup() {
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
						elements: [
							{
								id: 'el_1',
								track: 'content',
								block: { id: 'blk_1', type: 'heading', props: { text: 'Hi', level: 2 } },
								range: { start: 0, end: 1 }
							}
						]
					}
				]
			}
		]
	} as unknown as ZineDocument;
	const store = new EditorStore({
		document,
		zineId: 'z',
		baseUpdatedAt: null,
		save: async (): Promise<SaveResult> => ({ ok: true, clientRev: 1, updatedAt: 't' })
	});
	return store;
}

const headingText = (store: EditorStore) =>
	(store.doc.acts[0].scenes[0].elements[0].block.props as { text: string }).text;

beforeEach(() => localStorage.clear());

describe('BlockInspector', () => {
	it('commits valid edits to the document', async () => {
		const store = setup();
		const { getByDisplayValue } = render(BlockInspector, {
			props: { store, element: store.doc.acts[0].scenes[0].elements[0] }
		});
		await fireEvent.input(getByDisplayValue('Hi'), { target: { value: 'Hello world' } });
		expect(headingText(store)).toBe('Hello world');
		store.dispose();
	});

	it('does NOT corrupt the document on invalid input (empty required heading)', async () => {
		const store = setup();
		const { getByDisplayValue, getByRole } = render(BlockInspector, {
			props: { store, element: store.doc.acts[0].scenes[0].elements[0] }
		});
		await fireEvent.input(getByDisplayValue('Hi'), { target: { value: '' } });
		// heading text is required → rejected → document unchanged + an error is shown
		expect(headingText(store)).toBe('Hi');
		expect(getByRole('alert')).toBeTruthy();
		store.dispose();
	});
});
