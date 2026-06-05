<script lang="ts">
	import { untrack } from 'svelte';
	import EditorShell from '$lib/editor/EditorShell.svelte';
	import { EditorStore } from '$lib/editor/store.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Client-only (ssr=false), so this constructs exactly once in the browser.
	const store = untrack(
		() =>
			new EditorStore({
				document: data.document,
				zineId: data.zine.id,
				baseUpdatedAt: data.baseUpdatedAt
			})
	);
</script>

<svelte:head>
	<title>Editing {data.zine.title}</title>
</svelte:head>

<EditorShell {store} title={data.zine.title} />
