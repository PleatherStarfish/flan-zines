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
		schemaVersion: 7,
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
		schemaVersion: 7,
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

const blockStyle = (store: EditorStore) => store.doc.acts[0].scenes[0].elements[0].block.style;

beforeEach(() => localStorage.clear());

describe('BlockInspector', () => {
	it('commits valid edits to the document', async () => {
		const store = setup();
		const { getByDisplayValue, getByRole } = render(BlockInspector, {
			props: { store, element: store.doc.acts[0].scenes[0].elements[0] }
		});
		await fireEvent.click(getByRole('button', { name: 'Open focused editor' }));
		await fireEvent.input(getByDisplayValue('Hi'), { target: { value: 'Hello world' } });
		await fireEvent.click(getByRole('button', { name: 'Save text' }));
		expect(headingText(store)).toBe('Hello world');
		store.dispose();
	});

	it('does NOT corrupt the document on invalid input (empty required heading)', async () => {
		const store = setup();
		const { getByDisplayValue, getByRole } = render(BlockInspector, {
			props: { store, element: store.doc.acts[0].scenes[0].elements[0] }
		});
		await fireEvent.click(getByRole('button', { name: 'Open focused editor' }));
		await fireEvent.input(getByDisplayValue('Hi'), { target: { value: '' } });
		await fireEvent.click(getByRole('button', { name: 'Save text' }));
		// heading text is required → rejected → document unchanged + an error is shown
		expect(headingText(store)).toBe('Hi');
		expect(getByRole('alert')).toBeTruthy();
		store.dispose();
	});

	it('makes text backgrounds an explicit block style choice', async () => {
		const store = setup();
		const { getByLabelText, getByRole, getByText } = render(BlockInspector, {
			props: { store, element: store.doc.acts[0].scenes[0].elements[0] }
		});

		expect(blockStyle(store)?.textBackdrop).toBeUndefined();

		await fireEvent.click(getByRole('button', { name: 'Open focused editor' }));
		await fireEvent.click(getByRole('button', { name: 'Box' }));
		expect(blockStyle(store)?.textBackdrop).toBeUndefined();
		await fireEvent.click(getByRole('button', { name: 'Cancel' }));
		expect(blockStyle(store)?.textBackdrop).toBeUndefined();

		await fireEvent.click(getByRole('button', { name: 'Open focused editor' }));
		await fireEvent.click(getByRole('button', { name: 'Box' }));
		await fireEvent.click(getByRole('button', { name: 'Use #fbfaf7 for background' }));
		await fireEvent.click(getByRole('button', { name: 'Use #fbfaf7 for text' }));
		expect(getByText(/need more contrast/i)).toBeTruthy();
		await fireEvent.input(getByLabelText('Custom text color'), {
			target: { value: '#14181f' }
		});
		await fireEvent.input(getByRole('slider', { name: 'Background padding' }), {
			target: { value: '3.5' }
		});
		await fireEvent.input(getByRole('slider', { name: 'Background opacity' }), {
			target: { value: '0.4' }
		});
		await fireEvent.input(getByLabelText('Custom background color'), {
			target: { value: '#fff3c4' }
		});
		await fireEvent.click(getByRole('button', { name: 'Save text' }));
		expect(blockStyle(store)?.textBackdrop).toEqual({
			shape: 'box',
			color: '#fff3c4',
			opacity: 0.4,
			padding: 3.5
		});
		expect(blockStyle(store)?.textColor).toBe('#14181f');

		await fireEvent.click(getByRole('button', { name: 'Open focused editor' }));
		await fireEvent.click(getByRole('button', { name: 'Circle' }));
		await fireEvent.click(getByRole('button', { name: 'Save text' }));
		expect(blockStyle(store)?.textBackdrop?.shape).toBe('circle');

		await fireEvent.click(getByRole('button', { name: 'Open focused editor' }));
		await fireEvent.click(getByRole('button', { name: 'None' }));
		await fireEvent.click(getByRole('button', { name: 'Save text' }));
		expect(blockStyle(store)?.textBackdrop).toBeUndefined();
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

	it('adds links only to highlighted rich text', async () => {
		const store = setupRichText();
		const { getByLabelText, getByRole } = render(BlockInspector, {
			props: { store, element: store.doc.acts[0].scenes[0].elements[0] }
		});

		await fireEvent.click(getByRole('button', { name: 'Open focused editor' }));
		const editor = getByRole('textbox', { name: 'Rich text editor' });
		const textNode = editor.querySelector('p')?.firstChild;
		expect(textNode).toBeTruthy();
		const range = document.createRange();
		range.setStart(textNode!, 0);
		range.setEnd(textNode!, 5);
		const selection = window.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
		await fireEvent.mouseUp(editor);

		await fireEvent.click(getByRole('button', { name: 'Add link to highlighted text' }));
		const urlInput = getByLabelText('Link URL');
		expect(document.activeElement).toBe(urlInput);
		expect(editor.querySelector('[data-link-selection="true"]')?.textContent).toBe('Start');
		await fireEvent.input(urlInput, {
			target: { value: 'https://example.com' }
		});
		expect(editor.querySelector('[data-link-selection="true"]')?.textContent).toBe('Start');
		await fireEvent.click(getByRole('button', { name: 'Apply link' }));
		expect(editor.querySelector('[data-link-selection="true"]')).toBeNull();
		await fireEvent.click(getByRole('button', { name: 'Save text' }));

		expect(richTextDoc(store).content[0]).toMatchObject({
			type: 'paragraph',
			content: [
				{
					type: 'text',
					text: 'Start',
					marks: [{ type: 'link', attrs: { href: 'https://example.com' } }]
				},
				{ type: 'text', text: ' here' }
			]
		});
		store.dispose();
	});
});
