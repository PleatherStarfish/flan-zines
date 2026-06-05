<script lang="ts">
	import { getBlock } from '../registry';
	import type { ZineDocument } from '../schema/document';
	import { themeVars } from '../theme/registry';
	import BlockFrame from './BlockFrame.svelte';

	// Story → page. Reads ONLY the block registry (no hard-coded block list) and
	// imports nothing from the editor — the same component renders the public page and
	// the editor preview. The zine TITLE is the single <h1>; content headings are h2+.
	let { document, title }: { document: ZineDocument; title?: string } = $props();

	const rootStyle = $derived(themeVars(document.theme));
</script>

<article class="zine" style={rootStyle}>
	{#if title}<h1 class="zine-title">{title}</h1>{/if}
	{#each document.acts as act (act.id)}
		<div class="zine-act" data-act={act.id}>
			{#each act.scenes as scene (scene.id)}
				<section
					class="zine-scene"
					data-type={scene.type}
					data-length={scene.length}
					style={scene.background?.color ? `background:${scene.background.color}` : undefined}
				>
					{#each scene.elements as element (element.id)}
						{@const block = element.block}
						{@const def = getBlock(block.type)}
						{#if def}
							{@const Render = def.Render}
							<BlockFrame
								blockId={element.id}
								label={def.label}
								style={block.style}
								animation={element.legacyAnimation}
							>
								<Render props={block.props} />
							</BlockFrame>
						{/if}
					{/each}
				</section>
			{/each}
		</div>
	{/each}
</article>

<style>
	/* Reading styles. Block Render components live in child components, so these target
	   them with :global(). Theme tokens (--zine-*) are set by themeVars() on the root. */
	.zine {
		--zine-bg: #fbfaf7;
		--zine-fg: #14181f;
		--zine-muted: #6b7280;
		--zine-accent: hsl(var(--primary));
		--zine-font-heading: ui-serif, Georgia, serif;
		--zine-font-body: ui-sans-serif, system-ui, sans-serif;
		--zine-measure: 42rem;
		background: var(--zine-bg);
		color: var(--zine-fg);
		font-family: var(--zine-font-body);
		line-height: 1.6;
	}
	.zine-title {
		max-width: var(--zine-measure);
		margin: 0 auto 2rem;
		padding: 0 1.25rem;
		font-family: var(--zine-font-heading);
		font-size: clamp(2.25rem, 5vw, 3.5rem);
		font-weight: 800;
		line-height: 1.1;
		letter-spacing: -0.02em;
	}
	.zine-scene {
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
		font-family: var(--zine-font-heading);
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
		font-family: var(--zine-font-body);
		font-size: 0.85rem;
		color: var(--zine-muted);
	}
	:global(.zine .zine-button) {
		display: inline-block;
		padding: 0.6rem 1.1rem;
		border-radius: 0.5rem;
		background: var(--zine-accent);
		color: #fff;
		font-family: var(--zine-font-body);
		font-weight: 600;
		text-decoration: none;
	}
	:global(.zine .zine-divider) {
		max-width: var(--zine-measure);
		margin: 2rem auto;
		border: 0;
		border-top: 1px solid var(--zine-muted);
		opacity: 0.35;
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
