// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import SceneTimeline from './SceneTimeline.svelte';
import { EditorStore } from './store.svelte';
import type { Scene, ZineDocument } from '$lib/zine/schema/document';
import type { SaveResult } from './autosave';

const okSave = async (): Promise<SaveResult> => ({ ok: true, clientRev: 1, updatedAt: 't' });

function setup() {
	const zine = {
		schemaVersion: 5,
		theme: {},
		acts: [
			{
				id: 'act_1',
				scenes: [
					{
						id: 'scn_1',
						type: 'reveal',
						length: 'auto',
						beats: [{ id: 'beat_1', at: 0 }],
						elements: [
							{
								id: 'el_title',
								track: 'content',
								block: {
									id: 'blk_title',
									type: 'heading',
									props: { text: 'Opening title', level: 2 }
								},
								range: { start: 0, end: 1 }
							},
							{
								id: 'el_picture',
								track: 'media',
								block: {
									id: 'blk_picture',
									type: 'image',
									props: { src: '/rain.svg', alt: 'Rain gauge' }
								},
								range: { start: 0.12, end: 0.82 }
							},
							{
								id: 'el_note',
								track: 'content',
								block: {
									id: 'blk_note',
									type: 'richText',
									props: {
										doc: {
											type: 'doc',
											content: [
												{
													type: 'paragraph',
													content: [{ type: 'text', text: 'Field note' }]
												}
											]
										}
									}
								},
								range: { start: 0.28, end: 1 }
							}
						]
					}
				]
			}
		]
	} satisfies ZineDocument;
	const store = new EditorStore({
		document: zine,
		zineId: 'z',
		baseUpdatedAt: null,
		save: okSave
	});
	const scene = store.doc.acts[0].scenes[0] as Scene;
	const view = render(SceneTimeline, { props: { store, scene, document: store.doc } });
	return { store, view };
}

function elementOrder(store: EditorStore): string[] {
	return store.doc.acts[0].scenes[0].elements.map((element) => element.id);
}

beforeEach(() => localStorage.clear());

describe('SceneTimeline', () => {
	it('shows direct track depth without semantic lane controls', () => {
		const { store, view } = setup();

		expect(view.getByText('Shows on top')).toBeTruthy();
		expect(view.getByText('Shows on bottom')).toBeTruthy();
		expect(view.queryByRole('combobox', { name: /stage lane/i })).toBeNull();
		expect(view.queryByRole('group', { name: /Words lane/i })).toBeNull();
		expect(view.queryByText('Scenery')).toBeNull();

		store.dispose();
		view.unmount();
	});

	it('reorders visual tracks from the row handle keyboard controls', async () => {
		const { store, view } = setup();

		await fireEvent.keyDown(
			view.getByRole('button', { name: 'Move Opening title track (Shows on top)' }),
			{ key: 'ArrowDown' }
		);
		expect(elementOrder(store)).toEqual(['el_picture', 'el_title', 'el_note']);

		await view.rerender({
			store,
			scene: store.doc.acts[0].scenes[0] as Scene,
			document: store.doc
		});
		await fireEvent.keyDown(
			view.getByRole('button', { name: 'Move Opening title track (Track 2)' }),
			{ key: 'ArrowUp' }
		);
		expect(elementOrder(store)).toEqual(['el_title', 'el_picture', 'el_note']);

		store.dispose();
		view.unmount();
	});

	it('reorders visual tracks by dragging a row handle', async () => {
		const { store, view } = setup();
		const originalElementFromPoint = document.elementFromPoint;
		const targetLane = view.container.querySelector<HTMLElement>('[data-element-id="el_note"]');

		expect(targetLane).toBeTruthy();
		targetLane!.getBoundingClientRect = () =>
			({
				top: 0,
				right: 100,
				bottom: 100,
				left: 0,
				width: 100,
				height: 100,
				x: 0,
				y: 0,
				toJSON: () => ({})
			}) as DOMRect;
		document.elementFromPoint = vi.fn(() => targetLane);

		try {
			await fireEvent.pointerDown(
				view.getByRole('button', { name: 'Move Opening title track (Shows on top)' }),
				{ pointerId: 1, clientX: 10, clientY: 10 }
			);
			await fireEvent.pointerMove(window, { pointerId: 1, clientX: 10, clientY: 90 });
			await fireEvent.pointerUp(window, { pointerId: 1, clientX: 10, clientY: 90 });
		} finally {
			document.elementFromPoint = originalElementFromPoint;
		}

		expect(elementOrder(store)).toEqual(['el_picture', 'el_note', 'el_title']);

		store.dispose();
		view.unmount();
	});
});
