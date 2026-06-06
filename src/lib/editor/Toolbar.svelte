<script lang="ts">
	import type { EditorStore } from './store.svelte';

	let { store, title }: { store: EditorStore; title: string } = $props();
	let showConflictDetails = $state(false);

	const statusLabel: Record<string, string> = {
		idle: 'All changes saved',
		saving: 'Saving…',
		saved: 'Saved ✓',
		error: 'Couldn’t save — retrying',
		conflict: 'Opened in another tab'
	};
</script>

<header class="toolbar">
	<div class="toolbar__title">
		<a href="/app" class="toolbar__back">My zines</a>
		<span>{title}</span>
	</div>

	<div class="toolbar__controls">
		<div class="mode-switch" role="group" aria-label="Editor mode">
			<button
				type="button"
				class:active={store.mode === 'edit'}
				onclick={() => store.setMode('edit')}
			>
				Edit
			</button>
			<button
				type="button"
				class:active={store.mode === 'preview'}
				onclick={() => store.setMode('preview')}
			>
				Preview
			</button>
		</div>

		<div class="history-buttons">
			<button
				type="button"
				aria-label="Undo"
				disabled={!store.canUndo}
				onclick={() => store.undo()}
			>
				↶
			</button>
			<button
				type="button"
				aria-label="Redo"
				disabled={!store.canRedo}
				onclick={() => store.redo()}
			>
				↷
			</button>
		</div>

		<span class="save-status" data-testid="save-status">
			{statusLabel[store.saveStatus] ?? ''}
		</span>
	</div>
</header>

{#if store.saveStatus === 'conflict'}
	<section class="conflict-banner" role="alert" aria-live="assertive">
		<div class="conflict-banner__row">
			<div>
				<p class="font-medium">Another save happened before this one finished.</p>
				<p>Your local edits are preserved. Choose which copy to keep before autosave continues.</p>
			</div>
			<div class="conflict-banner__actions">
				<button
					type="button"
					onclick={() => {
						store.discardLocalShadow();
						location.reload();
					}}
				>
					Reload server copy
				</button>
				<button type="button" onclick={() => store.keepLocalAfterConflict()}>
					Keep local copy
				</button>
				<button
					type="button"
					aria-expanded={showConflictDetails}
					onclick={() => (showConflictDetails = !showConflictDetails)}
				>
					Inspect
				</button>
			</div>
		</div>
		{#if showConflictDetails}
			<dl class="conflict-banner__details">
				<div>
					<dt class="font-semibold">Local copy</dt>
					<dd>
						{store.shadowWrittenAt
							? `Stored locally ${new Date(store.shadowWrittenAt).toLocaleString()}`
							: 'Stored in this editor session'}
					</dd>
				</div>
				<div>
					<dt class="font-semibold">Server copy</dt>
					<dd>
						{store.conflictServerUpdatedAt
							? `Saved ${new Date(store.conflictServerUpdatedAt).toLocaleString()}`
							: 'Saved after this editor opened'}
					</dd>
				</div>
			</dl>
		{/if}
	</section>
{/if}

<style>
	.toolbar {
		z-index: 25;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		border-bottom: 2px solid var(--pixel-ink);
		background: var(--pixel-ink);
		padding: 0.65rem 0.8rem;
		color: hsl(var(--primary-foreground));
	}
	.toolbar__title,
	.toolbar__controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.65rem;
	}
	.toolbar__back {
		border: 2px solid hsl(var(--primary-foreground));
		border-radius: var(--pixel-radius);
		padding: 0.28rem 0.5rem;
		color: hsl(var(--primary-foreground));
		font-size: 0.8rem;
		font-weight: 850;
		text-decoration: none;
	}
	.toolbar__back:hover {
		background: var(--pixel-yellow);
		color: var(--pixel-ink);
	}
	.toolbar__title span {
		font-weight: 900;
	}
	.mode-switch,
	.history-buttons {
		display: flex;
		gap: 0.25rem;
	}
	.mode-switch button,
	.history-buttons button,
	.conflict-banner button {
		border: 2px solid hsl(var(--primary-foreground));
		border-radius: var(--pixel-radius);
		background: transparent;
		color: hsl(var(--primary-foreground));
		font-size: 0.84rem;
		font-weight: 850;
	}
	.mode-switch button {
		padding: 0.35rem 0.65rem;
	}
	.mode-switch button.active {
		background: var(--pixel-green);
		color: var(--pixel-ink);
	}
	.history-buttons button {
		min-width: 2rem;
		padding: 0.3rem 0.45rem;
	}
	.history-buttons button:not(:disabled):hover,
	.mode-switch button:not(.active):hover {
		background: hsl(var(--primary-foreground) / 0.14);
	}
	.history-buttons button:disabled {
		opacity: 0.42;
	}
	.save-status {
		min-width: 8.5rem;
		color: oklch(0.9 0.04 86);
		font-size: 0.76rem;
		font-weight: 800;
		text-align: right;
	}
	.conflict-banner {
		border-bottom: 2px solid var(--pixel-ink);
		background: var(--pixel-yellow);
		padding: 0.75rem 0.9rem;
		color: var(--pixel-ink);
		font-size: 0.9rem;
	}
	.conflict-banner p {
		margin: 0;
	}
	.conflict-banner__row,
	.conflict-banner__actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.conflict-banner__actions button {
		border-color: var(--pixel-ink);
		color: var(--pixel-ink);
		padding: 0.4rem 0.65rem;
	}
	.conflict-banner__actions button:hover {
		background: hsl(var(--primary-foreground) / 0.7);
	}
	.conflict-banner__details {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
		margin: 0.75rem 0 0;
		font-size: 0.78rem;
	}
	@media (max-width: 720px) {
		.toolbar,
		.toolbar__controls {
			align-items: stretch;
			flex-direction: column;
		}
		.save-status {
			text-align: left;
		}
		.conflict-banner__details {
			grid-template-columns: 1fr;
		}
	}
</style>
