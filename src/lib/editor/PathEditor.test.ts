// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import PathEditor from './PathEditor.svelte';
import { EditorStore } from './store.svelte';
import type { Scene, ZineDocument } from '$lib/zine/schema/document';
import type { Waypoint } from '$lib/zine/animations/path';
import type { SaveResult } from './autosave';

const okSave = async (): Promise<SaveResult> => ({ ok: true, clientRev: 1, updatedAt: 't' });

function makeDocument(): ZineDocument {
	return {
		schemaVersion: 5,
		theme: {},
		acts: [
			{
				id: 'act_1',
				scenes: [
					{
						id: 'scn_1',
						type: 'reveal',
						length: 'long',
						scrollLength: 3,
						beats: [{ id: 'beat_1', at: 0 }],
						elements: [
							{
								id: 'el_1',
								track: 'media',
								placement: 'free',
								block: {
									id: 'blk_1',
									type: 'heading',
									props: { text: 'Sprite', level: 2 }
								},
								range: { start: 0, end: 1 },
								motion: {
									type: 'path',
									params: {
										waypoints: [
											{ at: 0, x: 10, y: 60, scale: 1, rotate: 0, ease: 'smooth' },
											{ at: 1, x: 90, y: 60, scale: 1, rotate: 0, ease: 'smooth' }
										]
									}
								}
							}
						]
					}
				]
			}
		]
	};
}

function setup() {
	const document = makeDocument();
	const store = new EditorStore({
		document,
		zineId: 'z',
		baseUpdatedAt: null,
		save: okSave
	});
	const scene = store.doc.acts[0].scenes[0] as Scene;
	const view = render(PathEditor, {
		props: { store, scene, document: store.doc, elementId: 'el_1', onClose: vi.fn() }
	});
	return { store, view };
}

function pathWaypoints(store: EditorStore): Waypoint[] {
	const motion = store.doc.acts[0].scenes[0].elements[0].motion;
	if (motion?.type !== 'path') throw new Error('Expected a path motion effect');
	return motion.params.waypoints as Waypoint[];
}

beforeEach(() => localStorage.clear());

describe('PathEditor', () => {
	it('adds a new point even when the scrubber is on an existing endpoint', async () => {
		const { store, view } = setup();

		await fireEvent.input(view.getByRole('slider', { name: 'Reader scroll' }), {
			target: { value: '0' }
		});
		await fireEvent.click(view.getByRole('button', { name: '+ Point here' }));

		expect(pathWaypoints(store).map((point) => point.at)).toEqual([0, 0.01, 1]);
		expect(pathWaypoints(store)).toHaveLength(3);
		store.dispose();
		view.unmount();
	});
});
