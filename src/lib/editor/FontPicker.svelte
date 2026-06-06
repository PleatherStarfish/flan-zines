<script lang="ts">
	import type { EditorStore } from './store.svelte';
	import {
		FONT_FAMILIES,
		FONT_PAIRS,
		customFontPairId,
		familyById,
		fontPairFamilies
	} from '$lib/zine/theme/fonts';
	import { loadAllFonts } from '$lib/zine/theme/font-loader';

	// The font picker pushes students toward a few PLEASING COMBOS — each tile previews the
	// real heading + body fonts so it's clear what they look like — while a "Customize fonts"
	// toggle reveals independent heading/body family pickers for those who want full control.
	let { store }: { store: EditorStore } = $props();

	const fontPair = $derived(store.doc.theme?.fontPair);
	const isCustom = $derived((fontPair ?? '').startsWith('custom:'));
	const current = $derived(fontPairFamilies(fontPair));

	let showCustom = $state(false);
	const customOpen = $derived(showCustom || isCustom);

	// Load every curated family so the tiles preview in their real fonts (editor-only; the
	// reader page loads just the pairing it uses).
	$effect(() => {
		loadAllFonts();
	});

	function applyPair(id: string): void {
		store.setTheme({ fontPair: id });
	}
	function setHeading(id: string): void {
		store.setTheme({ fontPair: customFontPairId(id, current.body.id) });
	}
	function setBody(id: string): void {
		store.setTheme({ fontPair: customFontPairId(current.heading.id, id) });
	}
</script>

<div class="fonts">
	<div class="combo-grid">
		{#each FONT_PAIRS as pair (pair.id)}
			{@const h = familyById(pair.heading)}
			{@const b = familyById(pair.body)}
			<button
				type="button"
				class="combo"
				aria-pressed={!isCustom && current.id === pair.id}
				onclick={() => applyPair(pair.id)}
			>
				<span class="combo__aa" style:font-family={h.stack}>Ag</span>
				<span class="combo__meta">
					<span class="combo__name">{pair.label}</span>
					<span class="combo__vibe">{pair.vibe}</span>
					<span class="combo__body" style:font-family={b.stack}>The quick brown fox jumps.</span>
				</span>
			</button>
		{/each}
	</div>

	<button
		type="button"
		class="customize-toggle"
		aria-expanded={customOpen}
		onclick={() => (showCustom = !customOpen)}
	>
		<span aria-hidden="true">{customOpen ? '▾' : '▸'}</span> Customize fonts
		{#if isCustom}<span class="custom-pill">on</span>{/if}
	</button>

	{#if customOpen}
		<div class="custom">
			<p class="custom-note">Mix any two — your headings and your body text.</p>
			{#each [{ key: 'heading', label: 'Headings', set: setHeading }, { key: 'body', label: 'Body text', set: setBody }] as row (row.key)}
				<div class="custom-row">
					<span class="custom-label">{row.label}</span>
					<div class="family-list">
						{#each FONT_FAMILIES as f (f.id)}
							<button
								type="button"
								class="family"
								aria-pressed={current[row.key as 'heading' | 'body'].id === f.id}
								style:font-family={f.stack}
								onclick={() => row.set(f.id)}
							>
								{f.label}
							</button>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.fonts {
		display: grid;
		gap: 0.6rem;
	}
	.combo-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.45rem;
	}
	.combo {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 0.5rem;
		border: 2px solid var(--pixel-ink, hsl(var(--border)));
		border-radius: var(--pixel-radius, 0.4rem);
		background: hsl(var(--background));
		padding: 0.5rem 0.55rem;
		text-align: left;
		box-shadow: 0.1rem 0.1rem 0 var(--pixel-ink, transparent);
		cursor: pointer;
	}
	.combo[aria-pressed='true'] {
		box-shadow:
			0 0 0 3px var(--pixel-yellow, hsl(var(--primary))),
			0.1rem 0.1rem 0 var(--pixel-ink, transparent);
	}
	.combo__aa {
		font-size: 1.7rem;
		line-height: 1;
		font-weight: 700;
		color: hsl(var(--foreground));
	}
	.combo__meta {
		display: grid;
		gap: 0.05rem;
		min-width: 0;
	}
	.combo__name {
		font-size: 0.82rem;
		font-weight: 850;
		color: hsl(var(--foreground));
	}
	.combo__vibe {
		font-size: 0.64rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: hsl(var(--muted-foreground));
	}
	.combo__body {
		overflow: hidden;
		font-size: 0.78rem;
		white-space: nowrap;
		text-overflow: ellipsis;
		color: hsl(var(--foreground));
	}
	.customize-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		justify-self: start;
		border: 0;
		background: transparent;
		padding: 0.15rem 0;
		font-size: 0.8rem;
		font-weight: 800;
		color: hsl(var(--foreground));
		cursor: pointer;
	}
	.custom-pill {
		border-radius: 999px;
		background: var(--pixel-yellow, hsl(var(--primary)));
		padding: 0 0.4rem;
		font-size: 0.62rem;
		font-weight: 900;
		text-transform: uppercase;
		color: var(--pixel-ink, hsl(var(--primary-foreground)));
	}
	.custom {
		display: grid;
		gap: 0.55rem;
		border: 2px dashed var(--pixel-ink, hsl(var(--border)));
		border-radius: var(--pixel-radius, 0.4rem);
		padding: 0.6rem;
	}
	.custom-note {
		margin: 0;
		font-size: 0.72rem;
		color: hsl(var(--muted-foreground));
	}
	.custom-row {
		display: grid;
		gap: 0.3rem;
	}
	.custom-label {
		font-size: 0.72rem;
		font-weight: 850;
		color: hsl(var(--foreground));
	}
	.family-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}
	.family {
		border: 2px solid var(--pixel-ink, hsl(var(--border)));
		border-radius: var(--pixel-radius, 0.4rem);
		background: hsl(var(--background));
		padding: 0.3rem 0.5rem;
		font-size: 0.92rem;
		color: hsl(var(--foreground));
		cursor: pointer;
	}
	.family[aria-pressed='true'] {
		background: var(--pixel-yellow, hsl(var(--muted)));
		color: var(--pixel-ink, hsl(var(--foreground)));
	}
	.combo:focus-visible,
	.family:focus-visible,
	.customize-toggle:focus-visible {
		outline: 3px solid var(--pixel-cyan, hsl(var(--primary)));
		outline-offset: 2px;
	}
</style>
