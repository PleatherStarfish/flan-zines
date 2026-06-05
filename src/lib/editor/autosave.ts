// The autosave engine (editor.md §7). Framework-agnostic + injectable so the full
// data-loss protocol is unit-testable with mock saves + fake timers:
//   - debounce
//   - revision discipline (a stale ack can never claim a newer rev is saved)
//   - 409 conflict → pause, never auto-overwrite
//   - offline/error → retry with exponential backoff
// The store owns the document + the localStorage shadow; this owns the network state.

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

export interface SavePayload {
	document: unknown;
	baseUpdatedAt: string | null;
	clientRev: number;
}

export type SaveResult =
	| { ok: true; clientRev: number; updatedAt: string }
	| { ok: false; conflict: true; serverUpdatedAt: string }
	| { ok: false; conflict: false; error: string };

export interface DraftSaverOptions {
	save: (payload: SavePayload) => Promise<SaveResult>;
	getSnapshot: () => unknown;
	baseUpdatedAt?: string | null;
	debounceMs?: number;
	maxBackoffMs?: number;
	onStatus?: (status: SaveStatus) => void;
	onAck?: (rev: number, updatedAt: string) => void;
}

export class DraftSaver {
	localRev = 0;
	lastAckRev = 0;
	baseUpdatedAt: string | null;
	conflictServerUpdatedAt: string | null = null;
	status: SaveStatus = 'idle';

	private readonly opts: DraftSaverOptions;
	private readonly debounceMs: number;
	private readonly maxBackoffMs: number;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private inFlight = false;
	private retryMs = 1000;

	constructor(opts: DraftSaverOptions) {
		this.opts = opts;
		this.debounceMs = opts.debounceMs ?? 1500;
		this.maxBackoffMs = opts.maxBackoffMs ?? 30_000;
		this.baseUpdatedAt = opts.baseUpdatedAt ?? null;
	}

	private setStatus(next: SaveStatus): void {
		if (this.status !== next) {
			this.status = next;
			this.opts.onStatus?.(next);
		}
	}

	private schedule(delay: number): void {
		if (this.timer) clearTimeout(this.timer);
		this.timer = setTimeout(() => {
			this.timer = null;
			void this.flush();
		}, delay);
	}

	/** Called by the store after every accepted mutation (rev already incremented). */
	markDirty(rev: number): void {
		this.localRev = rev;
		// A conflict pauses autosave until the user resolves it; never auto-overwrite.
		if (this.status === 'conflict') return;
		if (this.localRev > this.lastAckRev) this.setStatus('saving');
		this.schedule(this.debounceMs);
	}

	async flush(): Promise<void> {
		if (this.inFlight || this.status === 'conflict') return;
		if (this.localRev <= this.lastAckRev) {
			this.setStatus(this.localRev === 0 ? 'idle' : 'saved');
			return;
		}

		this.inFlight = true;
		const payload: SavePayload = {
			document: this.opts.getSnapshot(),
			baseUpdatedAt: this.baseUpdatedAt,
			clientRev: this.localRev
		};

		let result: SaveResult;
		try {
			result = await this.opts.save(payload);
		} catch (err) {
			result = {
				ok: false,
				conflict: false,
				error: err instanceof Error ? err.message : String(err)
			};
		}
		this.inFlight = false;

		if (result.ok) {
			if (result.clientRev > this.lastAckRev) {
				this.lastAckRev = result.clientRev;
				this.baseUpdatedAt = result.updatedAt;
				this.opts.onAck?.(result.clientRev, result.updatedAt);
			}
			this.retryMs = 1000;
			// Revision discipline: "Saved ✓" only once the server has caught up to the
			// newest local rev. A stale ack leaves us dirty and schedules another save.
			if (this.localRev > this.lastAckRev) {
				this.setStatus('saving');
				this.schedule(this.debounceMs);
			} else {
				this.setStatus('saved');
			}
		} else if (result.conflict) {
			this.conflictServerUpdatedAt = result.serverUpdatedAt;
			this.setStatus('conflict');
		} else {
			this.setStatus('error');
			this.schedule(this.retryMs);
			this.retryMs = Math.min(this.retryMs * 2, this.maxBackoffMs);
		}
	}

	/** Force an immediate save attempt (e.g. before navigating away). */
	flushNow(): Promise<void> {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		return this.flush();
	}

	/** Conflict resolution: keep my local copy, overwriting the server's. */
	resolveKeepLocal(): void {
		if (this.conflictServerUpdatedAt) this.baseUpdatedAt = this.conflictServerUpdatedAt;
		this.conflictServerUpdatedAt = null;
		this.status = 'idle';
		this.markDirty(this.localRev);
	}

	dispose(): void {
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
	}
}
