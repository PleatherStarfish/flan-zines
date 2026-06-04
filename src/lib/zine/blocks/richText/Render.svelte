<script lang="ts">
	import type { RichTextProps } from './schema';
	import Inline from './Inline.svelte';

	let { props }: { props: RichTextProps } = $props();
	const content = $derived(props.doc.content);
</script>

<div class="zine-richtext">
	{#each content as node, i (i)}
		{#if node.type === 'paragraph'}
			<p><Inline nodes={node.content ?? []} /></p>
		{:else if node.type === 'bulletList'}
			<ul>
				{#each node.content as item, j (j)}
					<li>
						{#each item.content as p, k (k)}<p><Inline nodes={p.content ?? []} /></p>{/each}
					</li>
				{/each}
			</ul>
		{:else if node.type === 'orderedList'}
			<ol start={node.attrs?.start}>
				{#each node.content as item, j (j)}
					<li>
						{#each item.content as p, k (k)}<p><Inline nodes={p.content ?? []} /></p>{/each}
					</li>
				{/each}
			</ol>
		{/if}
	{/each}
</div>
