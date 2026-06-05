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

<header
	class="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-4 py-2"
>
	<div class="flex items-center gap-3">
		<a href="/app" class="text-sm text-muted-foreground hover:text-foreground">← My zines</a>
		<span class="font-semibold text-foreground">{title}</span>
	</div>

	<div class="flex items-center gap-3">
		<div class="flex overflow-hidden rounded-md border border-border text-sm">
			<button
				type="button"
				class="px-3 py-1.5 {store.mode === 'edit'
					? 'bg-foreground text-background'
					: 'text-foreground'}"
				onclick={() => store.setMode('edit')}
			>
				Edit
			</button>
			<button
				type="button"
				class="px-3 py-1.5 {store.mode === 'preview'
					? 'bg-foreground text-background'
					: 'text-foreground'}"
				onclick={() => store.setMode('preview')}
			>
				Preview
			</button>
		</div>

		<div class="flex gap-1">
			<button
				type="button"
				aria-label="Undo"
				disabled={!store.canUndo}
				onclick={() => store.undo()}
				class="rounded-md border border-border px-2 py-1 text-sm disabled:opacity-40"
			>
				↶
			</button>
			<button
				type="button"
				aria-label="Redo"
				disabled={!store.canRedo}
				onclick={() => store.redo()}
				class="rounded-md border border-border px-2 py-1 text-sm disabled:opacity-40"
			>
				↷
			</button>
		</div>

		<span class="min-w-28 text-right text-xs text-muted-foreground" data-testid="save-status">
			{statusLabel[store.saveStatus] ?? ''}
		</span>
	</div>
</header>

{#if store.saveStatus === 'conflict'}
	<section
		class="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
		role="alert"
		aria-live="assertive"
	>
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<p class="font-medium">Another save happened before this one finished.</p>
				<p>Your local edits are preserved. Choose which copy to keep before autosave continues.</p>
			</div>
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					class="rounded-md border border-amber-700 px-3 py-1.5 font-medium hover:bg-amber-100"
					onclick={() => {
						store.discardLocalShadow();
						location.reload();
					}}
				>
					Reload server copy
				</button>
				<button
					type="button"
					class="rounded-md bg-amber-900 px-3 py-1.5 font-medium text-white hover:opacity-90"
					onclick={() => store.keepLocalAfterConflict()}
				>
					Keep local copy
				</button>
				<button
					type="button"
					class="rounded-md border border-amber-700 px-3 py-1.5 font-medium hover:bg-amber-100"
					aria-expanded={showConflictDetails}
					onclick={() => (showConflictDetails = !showConflictDetails)}
				>
					Inspect
				</button>
			</div>
		</div>
		{#if showConflictDetails}
			<dl class="mt-3 grid gap-1 text-xs sm:grid-cols-2">
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
