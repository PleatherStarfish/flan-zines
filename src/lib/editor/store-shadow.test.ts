// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorStore } from './store.svelte';
import type { ZineDocument } from '$lib/zine/schema/document';
import type { SavePayload, SaveResult } from './autosave';

const shadowKey = 'zine-draft-shadow:z-shadow';

function documentWithText(text: string): ZineDocument {
	return {
		schemaVersion: 3,
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
								block: { id: 'blk_1', type: 'heading', props: { text, level: 2 } },
								range: { start: 0, end: 1 }
							}
						]
					}
				]
			}
		]
	};
}

function headingText(store: EditorStore): string {
	return (store.doc.acts[0].scenes[0].elements[0].block.props as { text: string }).text;
}

beforeEach(() => {
	vi.useFakeTimers();
	localStorage.clear();
});

afterEach(() => {
	vi.useRealTimers();
	localStorage.clear();
});

describe('EditorStore local shadow recovery', () => {
	it('writes a shadow synchronously and clears it only after the current rev is acknowledged', async () => {
		const save = vi.fn(
			async (payload: SavePayload): Promise<SaveResult> => ({
				ok: true,
				clientRev: payload.clientRev,
				updatedAt: 'srv-2'
			})
		);
		const store = new EditorStore({
			document: documentWithText('Server'),
			zineId: 'z-shadow',
			baseUpdatedAt: 'srv-1',
			save
		});

		store.updateBlockProps('el_1', { text: 'Local', level: 2 });
		expect(JSON.parse(localStorage.getItem(shadowKey) ?? '{}')).toMatchObject({
			localRev: 1,
			baseUpdatedAt: 'srv-1'
		});

		await vi.advanceTimersByTimeAsync(1500);
		expect(save).toHaveBeenCalledOnce();
		expect(localStorage.getItem(shadowKey)).toBeNull();
		store.dispose();
	});

	it('restores a valid shadow, retries it with the original concurrency token, and preserves it on conflict', async () => {
		localStorage.setItem(
			shadowKey,
			JSON.stringify({
				document: documentWithText('Local'),
				localRev: 2,
				baseUpdatedAt: 'srv-1',
				writtenAt: '2026-06-04T20:00:00.000Z'
			})
		);
		const save = vi.fn(
			async (): Promise<SaveResult> => ({
				ok: false,
				conflict: true,
				serverUpdatedAt: 'srv-2'
			})
		);

		const store = new EditorStore({
			document: documentWithText('Server'),
			zineId: 'z-shadow',
			baseUpdatedAt: 'srv-2',
			save
		});

		expect(store.shadowRestored).toBe(true);
		expect(headingText(store)).toBe('Local');

		await vi.advanceTimersByTimeAsync(1500);
		expect(save).toHaveBeenCalledWith(
			expect.objectContaining({ baseUpdatedAt: 'srv-1', clientRev: 2 })
		);
		expect(store.saveStatus).toBe('conflict');
		expect(localStorage.getItem(shadowKey)).toBeTruthy();
		store.dispose();
	});
});
