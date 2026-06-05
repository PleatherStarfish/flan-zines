// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import StoryMap from './StoryMap.svelte';
import SceneEditor from './SceneEditor.svelte';
import { EditorStore } from './store.svelte';
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
				title: 'Night',
				scenes: [
					{
						id: 'scn_1',
						type: 'page',
						label: 'Intro',
						length: 'auto',
						beats: [{ id: 'beat_1', at: 0 }],
						elements: [
							{
								id: 'el_1',
								track: 'content',
								block: {
									id: 'blk_1',
									type: 'heading',
									props: { text: 'The first scene', level: 2 }
								},
								range: { start: 0, end: 1 }
							}
						]
					}
				]
			}
		]
	} satisfies ZineDocument;
	return new EditorStore({ document, zineId: 'z', baseUpdatedAt: null, save: okSave });
}

beforeEach(() => localStorage.clear());

describe('StoryMap', () => {
	it('opens a scene card through the callback', async () => {
		const store = makeStore();
		const onOpenScene = vi.fn();
		const { getByRole } = render(StoryMap, { props: { store, onOpenScene } });

		await fireEvent.click(getByRole('button', { name: 'Open Intro' }));
		expect(onOpenScene).toHaveBeenCalledWith('scn_1');
		store.dispose();
	});

	it('adds a starter scene from the map', async () => {
		const store = makeStore();
		const onOpenScene = vi.fn();
		const { getAllByRole } = render(StoryMap, { props: { store, onOpenScene } });

		await fireEvent.click(getAllByRole('button', { name: 'Add scene' })[0]);
		expect(store.doc.acts[0].scenes).toHaveLength(2);
		expect(store.doc.acts[0].scenes[1].elements.map((element) => element.block.type)).toEqual([
			'heading',
			'richText'
		]);
		expect(onOpenScene).toHaveBeenCalledWith(store.doc.acts[0].scenes[1].id);
		store.dispose();
	});
});

describe('SceneEditor', () => {
	it('adds content through the registry palette', async () => {
		const store = makeStore();
		const { getByRole } = render(SceneEditor, {
			props: { store, sceneId: 'scn_1', onBack: vi.fn() }
		});

		expect(getByRole('slider', { name: 'Reader scroll' })).toBeTruthy();
		await fireEvent.click(getByRole('button', { name: 'Words' }));
		expect(store.doc.acts[0].scenes[0].elements.map((element) => element.block.type)).toEqual([
			'heading',
			'richText'
		]);
		expect(store.selectedBlock?.block.type).toBe('richText');
		store.dispose();
	});

	it('turns a page scene into a reveal scene when adding a new moment', async () => {
		const store = makeStore();
		const { getByRole } = render(SceneEditor, {
			props: { store, sceneId: 'scn_1', onBack: vi.fn() }
		});

		await fireEvent.click(getByRole('button', { name: '+ Moment' }));
		expect(store.doc.acts[0].scenes[0].type).toBe('reveal');
		expect(store.doc.acts[0].scenes[0].beats.map((beat) => beat.at)).toEqual([0, 0.5]);
		store.dispose();
	});
});
