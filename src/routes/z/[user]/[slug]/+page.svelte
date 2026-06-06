<script lang="ts">
	import ZineRenderer from '$lib/zine/render/ZineRenderer.svelte';
	import { themeVars } from '$lib/zine/theme/registry';
	import { loadThemeFonts } from '$lib/zine/theme/font-loader';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Theme the whole page surface so the zine fills any window edge-to-edge (no white bars).
	const pageStyle = $derived(themeVars(data.document.theme));

	// Self-host + lazy-load ONLY the web fonts this zine's theme uses (no third-party request);
	// the system-fallback stack renders until they arrive.
	$effect(() => {
		loadThemeFonts(data.document.theme);
	});
</script>

<svelte:head>
	<title>{data.title} — Zine</title>
	<meta name="description" content={`A student zine by ${data.author}.`} />
</svelte:head>

<div class="zine-page" style={pageStyle}>
	<ZineRenderer document={data.document} title={data.title} drive />
	<footer class="zine-byline">
		<p>By {data.author}</p>
		<a href="/">← Back to the gallery</a>
	</footer>
</div>

<style>
	/* The themed surface (vars set via pageStyle) is the page background, so the zine sits in
	   its own colour at any window size — no white bars. */
	.zine-page {
		min-height: 100vh;
		min-height: 100dvh;
		background: var(--zine-bg);
	}
	.zine-byline {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		max-width: var(--zine-measure, 42rem);
		margin: 0 auto;
		padding: 1.5rem 1.25rem 3.5rem;
		border-top: 1px solid var(--zine-muted);
		font-family: var(--zine-font-body, ui-sans-serif, system-ui, sans-serif);
		font-size: 0.9rem;
		color: var(--zine-muted);
		opacity: 0.85;
	}
	.zine-byline a {
		color: inherit;
	}
</style>
