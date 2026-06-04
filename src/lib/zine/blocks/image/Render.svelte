<script lang="ts">
	import type { ImageProps } from './schema';

	let { props }: { props: ImageProps } = $props();
</script>

<figure class="zine-image">
	<img
		src={props.src}
		alt={props.alt}
		width={props.width}
		height={props.height}
		loading="lazy"
		decoding="async"
	/>
	{#if props.caption}<figcaption>{props.caption}</figcaption>{/if}
</figure>
