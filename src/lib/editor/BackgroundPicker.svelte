<script lang="ts">
	import { allBackgrounds, getBackground } from '$lib/zine/registry';
	import { themeSwatches } from '$lib/zine/theme/registry';
	import type { BackgroundFill, Scene, SceneBackground } from '$lib/zine/schema/document';
	import type { EditorStore } from './store.svelte';

	// Scene background picker: None / Image / Video / Animated (a curated canvas preset),
	// plus a "darken for text" scrim. Writes a SceneBackground; canvas params are validated
	// against the preset schema on save (like effects). Image/GIF use the image kind.
	let { store, section }: { store: EditorStore; section: Scene } = $props();

	const presets = allBackgrounds();
	const bg = $derived<SceneBackground | undefined>(section.background);
	const fill = $derived<BackgroundFill | undefined>(bg?.fill);
	const kind = $derived(fill?.kind ?? 'none');
	const overlayOpacity = $derived(bg?.overlay?.opacity ?? 0);

	const kinds: { id: 'none' | 'image' | 'video' | 'canvas'; label: string }[] = [
		{ id: 'none', label: 'None' },
		{ id: 'image', label: 'Image / GIF' },
		{ id: 'video', label: 'Video' },
		{ id: 'canvas', label: 'Animated' }
	];

	function commit(next: SceneBackground): void {
		store.setSceneBackground(
			section.id,
			next.fill || next.overlay || next.color ? next : undefined
		);
	}

	function setFill(nextFill: BackgroundFill | undefined): void {
		const next: SceneBackground = { ...(bg ?? {}) };
		if (nextFill) next.fill = nextFill;
		else delete next.fill;
		commit(next);
	}

	function chooseKind(id: 'none' | 'image' | 'video' | 'canvas'): void {
		if (id === 'none') return setFill(undefined);
		if (id === 'image') return setFill({ kind: 'image', fit: 'cover' });
		if (id === 'video') return setFill({ kind: 'video', fit: 'cover', loop: true });
		const preset = presets[0];
		if (preset)
			setFill({
				kind: 'canvas',
				preset: preset.type,
				params: structuredClone(preset.defaults) as Record<string, unknown>
			});
	}

	function setMediaSrc(value: string): void {
		if (fill?.kind !== 'image' && fill?.kind !== 'video') return;
		setFill({ ...fill, src: value.trim() || undefined });
	}

	function setFit(value: 'cover' | 'contain'): void {
		if (fill?.kind !== 'image' && fill?.kind !== 'video') return;
		setFill({ ...fill, fit: value });
	}

	function setAlt(value: string): void {
		if (fill?.kind !== 'image') return;
		setFill({ ...fill, alt: value || undefined });
	}

	function choosePreset(type: string): void {
		const def = getBackground(type);
		if (!def) return;
		setFill({
			kind: 'canvas',
			preset: type,
			params: structuredClone(def.defaults) as Record<string, unknown>
		});
	}

	function canvasParam(key: string): unknown {
		if (fill?.kind !== 'canvas') return undefined;
		return (fill.params as Record<string, unknown>)[key];
	}

	function canvasKnobValue(key: string): string {
		const value = canvasParam(key);
		return typeof value === 'string' ? value : '';
	}

	function canvasKnobArray(key: string): unknown[] {
		const value = canvasParam(key);
		return Array.isArray(value) ? value : [];
	}

	function setCanvasKnob(key: string, value: unknown): void {
		if (fill?.kind !== 'canvas') return;
		const def = getBackground(fill.preset);
		if (!def) return;
		const nextParams = { ...(fill.params as Record<string, unknown>), [key]: value };
		const parsed = def.schema.safeParse(nextParams);
		setFill({
			kind: 'canvas',
			preset: fill.preset,
			params: (parsed.success ? parsed.data : def.defaults) as Record<string, unknown>
		});
	}

	// A `theme-swatches` knob holds indices into the live theme palette; an EMPTY array means
	// "all colours participate". Toggling materialises the full set first, then removes/adds
	// one; if every swatch ends up selected we store [] again (canonical "all").
	function swatchSelected(key: string, index: number): boolean {
		const current = canvasKnobArray(key) as number[];
		return current.length === 0 || current.includes(index);
	}

	function toggleSwatch(key: string, index: number, total: number): void {
		const current = canvasKnobArray(key) as number[];
		const base = current.length ? current : Array.from({ length: total }, (_, i) => i);
		const next = base.includes(index)
			? base.filter((i) => i !== index)
			: [...base, index].sort((a, b) => a - b);
		setCanvasKnob(key, next.length >= total ? [] : next);
	}

	function toggleOption(key: string, value: string): void {
		const current = canvasKnobArray(key) as string[];
		const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
		setCanvasKnob(key, next);
	}

	const swatches = $derived(themeSwatches(store.doc.theme));

	function setOverlay(opacity: number): void {
		const next: SceneBackground = { ...(bg ?? {}) };
		if (opacity > 0) next.overlay = { color: '#000000', opacity: Math.round(opacity * 100) / 100 };
		else delete next.overlay;
		commit(next);
	}

	const activeCanvasDef = $derived(
		fill?.kind === 'canvas' ? getBackground(fill.preset) : undefined
	);
</script>

<section class="bg-picker" aria-label="Scene background">
	<h3>Background</h3>
	<div class="kind-row">
		{#each kinds as choice (choice.id)}
			<button type="button" aria-pressed={kind === choice.id} onclick={() => chooseKind(choice.id)}>
				{choice.label}
			</button>
		{/each}
	</div>

	{#if fill?.kind === 'image' || fill?.kind === 'video'}
		<label class="field">
			<span>{fill.kind === 'video' ? 'Video URL' : 'Image / GIF URL'}</span>
			<input
				type="url"
				value={fill.src ?? ''}
				placeholder="https://…"
				oninput={(e) => setMediaSrc(e.currentTarget.value)}
			/>
		</label>
		<div class="field">
			<span>Fit</span>
			<div class="chip-row">
				<button type="button" aria-pressed={fill.fit === 'cover'} onclick={() => setFit('cover')}>
					Fill
				</button>
				<button
					type="button"
					aria-pressed={fill.fit === 'contain'}
					onclick={() => setFit('contain')}
				>
					Contain
				</button>
			</div>
		</div>
		{#if fill.kind === 'image'}
			<label class="field">
				<span>Describe it (alt text)</span>
				<input
					type="text"
					value={fill.alt ?? ''}
					placeholder="e.g. a starry night sky"
					oninput={(e) => setAlt(e.currentTarget.value)}
				/>
			</label>
		{/if}
	{:else if fill?.kind === 'canvas'}
		<div class="preset-grid">
			{#each presets as def (def.type)}
				<button
					type="button"
					aria-pressed={fill.preset === def.type}
					onclick={() => choosePreset(def.type)}
				>
					<span aria-hidden="true">{def.icon}</span>{def.label}
				</button>
			{/each}
		</div>
		{#if activeCanvasDef}
			{#each activeCanvasDef.knobs as knob (knob.key)}
				<div class="field">
					<span>{knob.label}</span>
					{#if knob.kind === 'theme-swatches'}
						{#if swatches.length}
							<div class="chip-row">
								{#each swatches as sw, i (i)}
									<button
										type="button"
										class="swatch-toggle"
										aria-pressed={swatchSelected(knob.key, i)}
										style:background={sw}
										aria-label="Toggle {sw}"
										onclick={() => toggleSwatch(knob.key, i, swatches.length)}
									></button>
								{/each}
							</div>
						{:else}
							<p class="hint">Pick a colour theme to choose which colours appear.</p>
						{/if}
					{:else if knob.kind === 'multiselect'}
						<div class="chip-row">
							{#each knob.options as option (option.value)}
								<button
									type="button"
									aria-pressed={(canvasKnobArray(knob.key) as string[]).includes(option.value)}
									onclick={() => toggleOption(knob.key, option.value)}
								>
									{option.label}
								</button>
							{/each}
						</div>
					{:else}
						<div class="chip-row">
							{#each knob.options as option (option.value)}
								<button
									type="button"
									aria-pressed={canvasKnobValue(knob.key) === option.value}
									onclick={() => setCanvasKnob(knob.key, option.value)}
								>
									{option.label}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	{/if}

	{#if fill}
		<label class="field">
			<span>Darken for text ({Math.round(overlayOpacity * 100)}%)</span>
			<input
				type="range"
				min="0"
				max="0.8"
				step="0.05"
				value={overlayOpacity}
				oninput={(e) => setOverlay(Number(e.currentTarget.value))}
			/>
		</label>
		<p class="hint">
			Backgrounds are decorative — they pause and show a still frame for reduced motion.
		</p>
	{/if}
</section>

<style>
	.bg-picker {
		display: grid;
		gap: 0.6rem;
	}
	.bg-picker h3 {
		margin: 0;
		font-size: 0.78rem;
		font-weight: 760;
		color: hsl(var(--foreground));
	}
	.kind-row,
	.chip-row,
	.preset-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}
	.preset-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.kind-row button,
	.chip-row button,
	.preset-grid button {
		flex: 1 1 auto;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		border: 1px solid hsl(var(--border));
		border-radius: 0.4rem;
		background: hsl(var(--background));
		padding: 0.4rem 0.5rem;
		font-size: 0.8rem;
		font-weight: 700;
		color: hsl(var(--foreground));
	}
	.kind-row button[aria-pressed='true'],
	.chip-row button[aria-pressed='true'],
	.preset-grid button[aria-pressed='true'] {
		border-color: hsl(var(--primary));
		background: hsl(var(--muted));
	}
	.field {
		display: grid;
		gap: 0.3rem;
	}
	.field > span {
		font-size: 0.74rem;
		font-weight: 700;
		color: hsl(var(--muted-foreground));
	}
	.field input[type='url'],
	.field input[type='text'] {
		width: 100%;
		border: 1px solid hsl(var(--border));
		border-radius: 0.4rem;
		background: hsl(var(--background));
		padding: 0.4rem 0.5rem;
		font-size: 0.82rem;
		color: hsl(var(--foreground));
	}
	.field input[type='range'] {
		width: 100%;
		accent-color: hsl(var(--primary));
	}
	/* "Which colours participate" chips: a round swatch that dims when excluded. */
	.swatch-toggle {
		height: 1.5rem;
		width: 1.5rem;
		flex: 0 0 auto;
		border-radius: 999px;
		border: 1px solid hsl(var(--border));
		opacity: 0.35;
		cursor: pointer;
	}
	.swatch-toggle[aria-pressed='true'] {
		opacity: 1;
		outline: 2px solid hsl(var(--foreground));
		outline-offset: 1px;
	}
	.hint {
		margin: 0;
		font-size: 0.72rem;
		color: hsl(var(--muted-foreground));
	}
	button:focus-visible,
	input:focus-visible {
		outline: 2px solid hsl(var(--primary));
		outline-offset: 2px;
	}
</style>
