<script lang="ts">
	import { onMount } from 'svelte';
	import { setBlockDecoration } from '$lib/zine/render/context';
	import ZineRenderer from '$lib/zine/render/ZineRenderer.svelte';
	import type { EditorStore } from './store.svelte';
	import Toolbar from './Toolbar.svelte';
	import LeftRail from './LeftRail.svelte';
	import InspectorHost from './InspectorHost.svelte';

	let { store, title }: { store: EditorStore; title: string } = $props();

	// Provide the decoration seam: canvas blocks become selectable in Edit mode only.
	setBlockDecoration(() => ({
		selectedId: store.selectedId,
		select: (id) => store.select(id),
		enabled: store.mode === 'edit'
	}));

	const deviceWidth = $derived({ desktop: '100%', tablet: '768px', mobile: '390px' }[store.device]);

	onMount(() => {
		const flush = () => void store.flushNow();
		window.addEventListener('beforeunload', flush);
		window.addEventListener('online', flush);
		return () => {
			window.removeEventListener('beforeunload', flush);
			window.removeEventListener('online', flush);
			store.dispose();
		};
	});
</script>

<div class="flex h-screen flex-col bg-muted">
	<Toolbar {store} {title} />

	<div class="flex min-h-0 flex-1">
		{#if store.mode === 'edit'}
			<aside class="w-64 shrink-0 overflow-y-auto border-r border-border bg-background">
				<LeftRail {store} />
			</aside>
		{/if}

		<!-- Click empty canvas space to deselect. -->
		<main
			class="flex-1 overflow-y-auto p-6"
			role="presentation"
			onclick={(e) => {
				if (e.target === e.currentTarget) store.select(null);
			}}
		>
			<div
				class="mx-auto bg-[var(--zine-bg,#fff)] shadow-sm transition-[max-width] duration-200"
				style:max-width={deviceWidth}
			>
				<ZineRenderer document={store.doc} {title} />
			</div>
		</main>

		{#if store.mode === 'edit'}
			<aside class="w-72 shrink-0 overflow-y-auto border-l border-border bg-background p-4">
				<InspectorHost {store} />
			</aside>
		{/if}
	</div>
</div>
