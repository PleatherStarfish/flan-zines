<script lang="ts">
	import type { RichTextInline } from '../../schema/richtext';
	import Marks from './Marks.svelte';

	let { nodes }: { nodes: RichTextInline[] } = $props();
</script>

{#each nodes as node, i (i)}{#if node.type === 'text'}<Marks
			marks={node.marks ?? []}
			text={node.text}
		/>{:else if node.type === 'hardBreak'}<br />{/if}{/each}
