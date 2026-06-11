<script lang="ts">
	import type { CharacterSpriteProps } from './schema';

	let { props }: { props: CharacterSpriteProps } = $props();

	const gifSrc = $derived(props.source.src ?? props.source.poster ?? '');
	const posterSrc = $derived(props.source.poster ?? props.source.src ?? '');
	const width = $derived(props.source.width);
	const height = $derived(props.source.height);
</script>

<figure class="zine-character-sprite" data-action={props.action} data-size={props.size}>
	{#if gifSrc}
		<img
			class="zine-character-sprite__gif"
			src={gifSrc}
			alt={props.alt}
			{width}
			{height}
			loading="lazy"
			decoding="async"
		/>
	{/if}
	{#if posterSrc}
		<img
			class="zine-character-sprite__poster"
			src={posterSrc}
			alt={props.alt}
			{width}
			{height}
			loading="lazy"
			decoding="async"
		/>
	{/if}
	{#if !gifSrc && !posterSrc}
		<div class="zine-character-sprite__missing" role="img" aria-label={props.alt}>
			Character image missing
		</div>
	{/if}
</figure>

<style>
	.zine-character-sprite {
		display: inline-grid;
		margin: 0;
		max-width: 100%;
	}

	.zine-character-sprite__gif,
	.zine-character-sprite__poster {
		display: block;
		max-width: 100%;
		height: auto;
		image-rendering: pixelated;
		image-rendering: crisp-edges;
	}

	.zine-character-sprite__poster {
		display: none;
	}

	.zine-character-sprite__missing {
		border: 2px dashed currentColor;
		padding: 0.75rem;
		font-size: 0.9rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.zine-character-sprite__gif {
			display: none;
		}

		.zine-character-sprite__poster {
			display: block;
		}
	}
</style>
