<script lang="ts">
	import ZineRenderer from '$lib/zine/render/ZineRenderer.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.title} — Zine</title>
	<meta name="description" content={`A student zine by ${data.author}.`} />
</svelte:head>

<div class="zine-page">
	<ZineRenderer document={data.document} title={data.title} />
	<footer class="zine-byline">
		<p>By {data.author}</p>
		<a href="/">← Back to the gallery</a>
	</footer>
</div>

<style>
	.zine-page {
		padding: 3rem 0 5rem;
	}
	.zine-byline {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		max-width: 42rem;
		margin: 3rem auto 0;
		padding: 1.5rem 1.25rem 0;
		border-top: 1px solid hsl(var(--border));
		font-family: ui-sans-serif, system-ui, sans-serif;
		font-size: 0.9rem;
		color: hsl(var(--muted-foreground));
	}
	.zine-byline a {
		color: inherit;
	}
</style>
