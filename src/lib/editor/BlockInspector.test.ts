// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import BlockInspector from './BlockInspector.svelte';
import { EditorStore } from './store.svelte';
import type { ZineDocument } from '$lib/zine/schema/document';
import type { RichTextDoc } from '$lib/zine/schema/richtext';
import type { SaveResult } from './autosave';

function setup() {
	const document = {
		schemaVersion: 5,
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

function setupRichText() {
	const document = {
		schemaVersion: 5,
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
								block: {
									id: 'blk_1',
									type: 'richText',
									props: {
										doc: {
											type: 'doc',
											content: [
												{
													type: 'paragraph',
													content: [{ type: 'text', text: 'Start here' }]
												}
											]
										}
									}
								},
								range: { start: 0, end: 1 }
							}
						]
					}
				]
			}
		]
	} as unknown as ZineDocument;
	return new EditorStore({
		document,
		zineId: 'z',
		baseUpdatedAt: null,
		save: async (): Promise<SaveResult> => ({ ok: true, clientRev: 1, updatedAt: 't' })
	});
}

const headingText = (store: EditorStore) =>
	(store.doc.acts[0].scenes[0].elements[0].block.props as { text: string }).text;

const richTextDoc = (store: EditorStore) =>
	(store.doc.acts[0].scenes[0].elements[0].block.props as { doc: RichTextDoc }).doc;

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

	it('opens a focused rich text modal and only commits when saved', async () => {
		const store = setupRichText();
		const { getByRole } = render(BlockInspector, {
			props: { store, element: store.doc.acts[0].scenes[0].elements[0] }
		});

		await fireEvent.click(getByRole('button', { name: 'Open focused editor' }));
		const editor = getByRole('textbox', { name: 'Rich text editor' });
		const heading = document.createElement('h2');
		heading.textContent = 'Drain log';
		const paragraph = document.createElement('p');
		const strong = document.createElement('strong');
		strong.textContent = 'storm pulse';
		paragraph.append('Found a ', strong, ' under the grate.');
		editor.replaceChildren(heading, paragraph);
		await fireEvent.input(editor);

		expect(richTextDoc(store).content[0]).toMatchObject({
			type: 'paragraph',
			content: [{ type: 'text', text: 'Start here' }]
		});

		await fireEvent.click(getByRole('button', { name: 'Save text' }));

		expect(richTextDoc(store).content).toEqual([
			{
				type: 'heading',
				attrs: { level: 2 },
				content: [{ type: 'text', text: 'Drain log' }]
			},
			{
				type: 'paragraph',
				content: [
					{ type: 'text', text: 'Found a ' },
					{ type: 'text', text: 'storm pulse', marks: [{ type: 'bold' }] },
					{ type: 'text', text: ' under the grate.' }
				]
			}
		]);
		store.dispose();
	});
});
