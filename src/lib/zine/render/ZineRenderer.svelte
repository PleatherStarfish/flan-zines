<script lang="ts">
	import { getBlock } from '../registry';
	import type { ZineDocument } from '../schema/document';
	import BlockFrame from './BlockFrame.svelte';

	// Document → page. Reads ONLY the registry (no hard-coded block list) and imports
	// nothing from the editor — the same component renders the public page and the
	// editor preview. The zine TITLE is the single <h1>; content headings are h2+.
	let { document, title }: { document: ZineDocument; title?: string } = $props();

	const accentStyle = $derived(
		document.theme?.accent ? `--zine-accent:${document.theme.accent}` : undefined
	);
</script>

<article class="zine" style={accentStyle}>
	{#if title}<h1 class="zine-title">{title}</h1>{/if}
	{#each document.sections as section (section.id)}
		<section
			class="zine-section"
			data-layout={section.layout}
			style={section.background?.color ? `background:${section.background.color}` : undefined}
		>
			{#each section.blocks as block (block.id)}
				{@const def = getBlock(block.type)}
				{#if def}
					{@const Render = def.Render}
					<BlockFrame style={block.style} animation={block.animation}>
						<Render props={block.props} />
					</BlockFrame>
				{/if}
			{/each}
		</section>
	{/each}
</article>

<style>
	/* Reading styles for the rendered document. Block Render components live in child
	   components, so these target them with :global(). Themeable via --zine-accent. */
	.zine {
		--zine-accent: hsl(var(--primary));
		--zine-measure: 42rem;
		color: hsl(var(--foreground));
		font-family: ui-serif, Georgia, 'Times New Roman', serif;
		line-height: 1.6;
	}
	.zine-title {
		max-width: var(--zine-measure);
		margin: 0 auto 2rem;
		padding: 0 1.25rem;
		font-size: clamp(2.25rem, 5vw, 3.5rem);
		font-weight: 800;
		line-height: 1.1;
		letter-spacing: -0.02em;
	}
	.zine-section {
		padding: 1.5rem 0;
	}
	:global(.zine .zine-block) {
		max-width: var(--zine-measure);
		margin: 0 auto;
		padding: 0 1.25rem;
	}
	:global(.zine .zine-block[data-align='center']) {
		text-align: center;
	}
	:global(.zine .zine-block[data-align='right']) {
		text-align: right;
	}
	:global(.zine .zine-heading) {
		margin: 1.75rem 0 0.75rem;
		font-weight: 700;
		line-height: 1.2;
		letter-spacing: -0.01em;
	}
	:global(.zine h2.zine-heading) {
		font-size: 1.9rem;
	}
	:global(.zine h3.zine-heading) {
		font-size: 1.45rem;
	}
	:global(.zine h4.zine-heading) {
		font-size: 1.2rem;
	}
	:global(.zine .zine-richtext) {
		font-size: 1.15rem;
	}
	:global(.zine .zine-richtext p) {
		margin: 0 0 1.1rem;
	}
	:global(.zine .zine-richtext li > p) {
		margin: 0;
	}
	/* Tailwind Preflight resets list styling; restore it for prose lists. */
	:global(.zine .zine-richtext ul),
	:global(.zine .zine-richtext ol) {
		margin: 0 0 1.1rem;
		padding-left: 1.5rem;
	}
	:global(.zine .zine-richtext ul) {
		list-style: disc;
	}
	:global(.zine .zine-richtext ol) {
		list-style: decimal;
	}
	:global(.zine .zine-richtext li) {
		margin: 0.3rem 0;
	}
	:global(.zine .zine-richtext a),
	:global(.zine .zine-link) {
		color: var(--zine-accent);
		text-underline-offset: 0.18em;
	}
	:global(.zine .zine-image) {
		margin: 0;
	}
	:global(.zine .zine-image img) {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 0.5rem;
	}
	:global(.zine .zine-image figcaption) {
		margin-top: 0.5rem;
		font-family: ui-sans-serif, system-ui, sans-serif;
		font-size: 0.85rem;
		color: hsl(var(--muted-foreground));
	}
	:global(.zine .zine-button) {
		display: inline-block;
		padding: 0.6rem 1.1rem;
		border-radius: 0.5rem;
		background: var(--zine-accent);
		color: hsl(var(--primary-foreground));
		font-family: ui-sans-serif, system-ui, sans-serif;
		font-weight: 600;
		text-decoration: none;
	}
	:global(.zine .zine-divider) {
		max-width: var(--zine-measure);
		margin: 2rem auto;
		border: 0;
		border-top: 1px solid hsl(var(--border));
	}
	:global(.zine .zine-spacer[data-size='sm']) {
		height: 1rem;
	}
	:global(.zine .zine-spacer[data-size='md']) {
		height: 2.5rem;
	}
	:global(.zine .zine-spacer[data-size='lg']) {
		height: 5rem;
	}
</style>
