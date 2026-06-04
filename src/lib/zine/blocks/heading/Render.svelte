<script lang="ts">
	import type { HeadingProps } from './schema';

	let { props }: { props: HeadingProps } = $props();
	const tag = $derived(`h${props.level}` as 'h2' | 'h3' | 'h4');
</script>

<svelte:element this={tag} class="zine-heading">{props.text}</svelte:element>
