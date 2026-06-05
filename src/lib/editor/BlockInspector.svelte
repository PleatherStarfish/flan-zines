<script lang="ts">
	import { untrack } from 'svelte';
	import type { EditorStore } from './store.svelte';
	import type { Element } from '$lib/zine/schema/document';
	import { getBlock } from '$lib/zine/registry';
	import type { BlockStyle } from '$lib/zine/schema/theme';

	let { store, element }: { store: EditorStore; element: Element } = $props();

	const block = $derived(element.block);
	const def = $derived(getBlock(block.type)!);
	const Inspector = $derived(def.Inspector);

	// Local working copy so the user can type freely; only VALID changes are committed
	// to the document (the contract: inspector writes never corrupt). Keyed by block id
	// in the host, so this re-initialises on selection change.
	let working = $state<unknown>(untrack(() => $state.snapshot(block.props)));
	let error = $state<string | null>(null);

	function onChange(next: unknown): void {
		working = next;
		const result = def.schema.safeParse(next);
		if (result.success) {
			error = null;
			store.updateBlockProps(element.id, result.data);
		} else {
			error = result.error.issues[0]?.message ?? 'Please check this field.';
		}
	}

	const aligns: { v: NonNullable<BlockStyle['align']>; l: string }[] = [
		{ v: 'left', l: 'Left' },
		{ v: 'center', l: 'Center' },
		{ v: 'right', l: 'Right' }
	];
</script>

<div class="space-y-5">
	<section>
		<h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
			Content
		</h3>
		<Inspector value={working} {onChange} />
		{#if error}<p role="alert" class="mt-2 text-sm text-red-700">{error}</p>{/if}
	</section>

	<section>
		<h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Design</h3>
		<div class="flex gap-1" role="group" aria-label="Alignment">
			{#each aligns as a (a.v)}
				<button
					type="button"
					aria-pressed={block.style?.align === a.v || (!block.style?.align && a.v === 'left')}
					onclick={() => store.updateBlockStyle(element.id, { align: a.v })}
					class="flex-1 rounded-md border border-border px-2 py-1.5 text-sm text-foreground hover:bg-muted aria-pressed:border-primary aria-pressed:bg-muted"
				>
					{a.l}
				</button>
			{/each}
		</div>
	</section>

	<button
		type="button"
		onclick={() => store.removeBlock(element.id)}
		class="text-sm font-medium text-red-700 hover:underline"
	>
		Delete this block
	</button>
</div>
