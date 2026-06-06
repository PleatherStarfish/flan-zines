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
	function mockStageRect(stage: HTMLElement): void {
		stage.getBoundingClientRect = () =>
			({
				x: 0,
				y: 0,
				left: 0,
				top: 0,
				width: 200,
				height: 100,
				right: 200,
				bottom: 100,
				toJSON: () => ({})
			}) as DOMRect;
	}

	function pointerEvent(
		type: 'pointerdown' | 'pointerup' | 'pointermove',
		init: { clientX: number; clientY: number; pointerId?: number }
	): PointerEvent {
		const event = new MouseEvent(type, {
			bubbles: true,
			cancelable: true,
			button: 0,
			clientX: init.clientX,
			clientY: init.clientY
		}) as PointerEvent;
		Object.defineProperties(event, {
			pointerId: { value: init.pointerId ?? 1 },
			pointerType: { value: 'mouse' },
			isPrimary: { value: true }
		});
		return event;
	}

	it('appends a new route point from a stage click instead of inserting it mid-path', async () => {
		const { store, view } = setup();
		const stage = view.getByRole('button', { name: /Path stage/i });
		mockStageRect(stage);

		await fireEvent(stage, pointerEvent('pointerdown', { clientX: 100, clientY: 25 }));
		await fireEvent(stage, pointerEvent('pointerup', { clientX: 100, clientY: 25 }));

		const points = pathWaypoints(store);
		expect(points).toHaveLength(3);
		expect(points.map((point) => [point.x, point.y])).toEqual([
			[10, 60],
			[90, 60],
			[50, 25]
		]);
		expect(points[0].at).toBe(0);
		expect(points[1].at).toBeGreaterThan(0);
		expect(points[1].at).toBeLessThan(1);
		expect(points[2].at).toBe(1);
		store.dispose();
		view.unmount();
	});

	it('clamps timing edits between neighbours without reordering the route', async () => {
		const { store, view } = setup();
		const stage = view.getByRole('button', { name: /Path stage/i });
		mockStageRect(stage);

		await fireEvent(stage, pointerEvent('pointerdown', { clientX: 100, clientY: 25 }));
		await fireEvent(stage, pointerEvent('pointerup', { clientX: 100, clientY: 25 }));
		await fireEvent.click(view.getByRole('button', { name: /Point 2 at/i }));
		await fireEvent.input(view.getByRole('slider', { name: /^When \(scroll\)/ }), {
			target: { value: '1' }
		});

		const points = pathWaypoints(store);
		expect(points.map((point) => [point.x, point.y])).toEqual([
			[10, 60],
			[90, 60],
			[50, 25]
		]);
		expect(points[0].at).toBeLessThan(points[1].at);
		expect(points[1].at).toBeLessThan(points[2].at);
		expect(points[1].at).toBeLessThanOrEqual(0.99);
		store.dispose();
		view.unmount();
	});

	it('does not redraw the route line into a different order while scrubbing preview', async () => {
		const { store, view } = setup();
		const stage = view.getByRole('button', { name: /Path stage/i });
		mockStageRect(stage);

		await fireEvent(stage, pointerEvent('pointerdown', { clientX: 100, clientY: 25 }));
		await fireEvent(stage, pointerEvent('pointerup', { clientX: 100, clientY: 25 }));
		const route = view.container.querySelector('.route');
		const before = route?.getAttribute('d');

		await fireEvent.input(view.getByRole('slider', { name: 'Reader scroll' }), {
			target: { value: '0.75' }
		});

		expect(route?.getAttribute('d')).toBe(before);
		store.dispose();
		view.unmount();
	});
});
