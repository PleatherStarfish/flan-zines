import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DraftSaver, type SavePayload, type SaveResult } from './autosave';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function makeSaver(save: (p: SavePayload) => Promise<SaveResult>) {
	return new DraftSaver({ save, getSnapshot: () => ({ ok: true }), debounceMs: 1000 });
}

describe('DraftSaver', () => {
	it('debounces, then saves and marks saved', async () => {
		const save = vi.fn(
			async (): Promise<SaveResult> => ({ ok: true, clientRev: 1, updatedAt: 't1' })
		);
		const s = makeSaver(save);
		s.markDirty(1);
		expect(save).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1000);
		expect(save).toHaveBeenCalledTimes(1);
		expect(s.status).toBe('saved');
		expect(s.lastAckRev).toBe(1);
		expect(s.baseUpdatedAt).toBe('t1');
		s.dispose();
	});

	it('revision discipline: a stale ack never marks a newer rev saved', async () => {
		let resolveSlow!: (r: SaveResult) => void;
		const save = vi
			.fn<(p: SavePayload) => Promise<SaveResult>>()
			.mockImplementationOnce(() => new Promise<SaveResult>((r) => (resolveSlow = r)))
			.mockImplementation(async (p) => ({ ok: true, clientRev: p.clientRev, updatedAt: 't' }));
		const s = makeSaver(save);

		s.markDirty(1);
		await vi.advanceTimersByTimeAsync(1000); // flush -> in-flight (slow save for rev 1)
		s.markDirty(2);
		s.markDirty(3); // localRev advances to 3 while rev 1 is still in flight

		resolveSlow({ ok: true, clientRev: 1, updatedAt: 't1' }); // stale ack
		await vi.advanceTimersByTimeAsync(0);
		expect(s.status).toBe('saving'); // NOT saved — localRev(3) > lastAckRev(1)

		await vi.advanceTimersByTimeAsync(1000); // next save sends rev 3
		expect(s.lastAckRev).toBe(3);
		expect(s.status).toBe('saved');
		s.dispose();
	});

	it('409 conflict pauses autosave and never auto-overwrites', async () => {
		const save = vi.fn(
			async (): Promise<SaveResult> => ({ ok: false, conflict: true, serverUpdatedAt: 'srv-2' })
		);
		const s = makeSaver(save);
		s.markDirty(1);
		await vi.advanceTimersByTimeAsync(1000);
		expect(s.status).toBe('conflict');
		expect(s.conflictServerUpdatedAt).toBe('srv-2');

		s.markDirty(2); // edits during conflict do NOT trigger a save
		await vi.advanceTimersByTimeAsync(10_000);
		expect(save).toHaveBeenCalledTimes(1);
		s.dispose();
	});

	it('resolveKeepLocal adopts the server token and resumes saving', async () => {
		const save = vi
			.fn<(p: SavePayload) => Promise<SaveResult>>()
			.mockImplementationOnce(async () => ({ ok: false, conflict: true, serverUpdatedAt: 'srv-2' }))
			.mockImplementation(async (p) => ({ ok: true, clientRev: p.clientRev, updatedAt: 'srv-3' }));
		const s = makeSaver(save);
		s.markDirty(1);
		await vi.advanceTimersByTimeAsync(1000);
		expect(s.status).toBe('conflict');

		s.resolveKeepLocal();
		await vi.advanceTimersByTimeAsync(1000);
		expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ baseUpdatedAt: 'srv-2' }));
		expect(s.status).toBe('saved');
		s.dispose();
	});

	it('retries a failed save with backoff, then succeeds', async () => {
		const save = vi
			.fn<(p: SavePayload) => Promise<SaveResult>>()
			.mockImplementationOnce(async () => ({ ok: false, conflict: false, error: 'offline' }))
			.mockImplementation(async (p) => ({ ok: true, clientRev: p.clientRev, updatedAt: 't' }));
		const s = makeSaver(save);
		s.markDirty(1);
		await vi.advanceTimersByTimeAsync(1000); // attempt 1 -> error
		expect(s.status).toBe('error');
		await vi.advanceTimersByTimeAsync(1000); // backoff retry -> success
		expect(s.status).toBe('saved');
		expect(s.lastAckRev).toBe(1);
		s.dispose();
	});
});
