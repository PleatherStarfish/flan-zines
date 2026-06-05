<script lang="ts">
	import type { EditorStore } from './store.svelte';
	import BlockInspector from './BlockInspector.svelte';
	import SectionInspector from './SectionInspector.svelte';

	let { store }: { store: EditorStore } = $props();

	const selectedBlock = $derived(store.selectedBlock);
	const selectedSection = $derived(store.selectedSection);
</script>

{#if selectedBlock}
	{#key selectedBlock.element.id}
		<BlockInspector {store} element={selectedBlock.element} />
	{/key}
{:else if selectedSection}
	{#key selectedSection.id}
		<SectionInspector {store} section={selectedSection} />
	{/key}
{:else}
	<p class="text-sm text-muted-foreground">
		Select a block on the canvas, or a section in the Outline, to edit it.
	</p>
{/if}
