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
		if (opacity > 0) next.overlay = { color: '#241f33', opacity: Math.round(opacity * 100) / 100 };
		else delete next.overlay;
		commit(next);
	}

	const activeCanvasDef = $derived(
		fill?.kind === 'canvas' ? getBackground(fill.preset) : undefined
	);
</script>

<section class="bg-picker" aria-label="Scene background">
	<label class="field">
		<span>Background type</span>
		<select value={kind} onchange={(event) => chooseKind(event.currentTarget.value as typeof kind)}>
			{#each kinds as choice (choice.id)}
				<option value={choice.id}>{choice.label}</option>
			{/each}
		</select>
	</label>

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
		<label class="field">
			<span>Animated style</span>
			<select value={fill.preset} onchange={(event) => choosePreset(event.currentTarget.value)}>
				{#each presets as def (def.type)}
					<option value={def.type}>{def.icon} {def.label}</option>
				{/each}
			</select>
		</label>
		{#if activeCanvasDef}
			<details class="bg-picker__details">
				<summary>Tweak animation</summary>
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
			</details>
		{/if}
	{/if}

	{#if fill}
		<details class="bg-picker__details">
			<summary>Make text readable</summary>
			<label class="field">
				<span>Darken behind text ({Math.round(overlayOpacity * 100)}%)</span>
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
				Backgrounds are decorative. They pause and show a still frame for reduced motion.
			</p>
		</details>
	{/if}
</section>

<style>
	.bg-picker {
		display: grid;
		gap: 0.6rem;
	}
	.chip-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}
	.chip-row button {
		flex: 1 1 auto;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		box-shadow: 0.1rem 0.1rem 0 var(--pixel-ink);
		padding: 0.4rem 0.5rem;
		font-size: 0.8rem;
		font-weight: 850;
		color: hsl(var(--foreground));
	}
	.chip-row button[aria-pressed='true'] {
		background: var(--pixel-cyan);
	}
	.field {
		display: grid;
		gap: 0.3rem;
	}
	.field > span {
		font-size: 0.74rem;
		font-weight: 850;
		color: hsl(var(--muted-foreground));
	}
	.field select,
	.field input[type='url'],
	.field input[type='text'] {
		width: 100%;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: oklch(0.97 0.02 82);
		padding: 0.4rem 0.5rem;
		color: hsl(var(--foreground));
		font-size: 0.82rem;
		font-weight: 780;
	}
	.field input[type='range'] {
		width: 100%;
		accent-color: hsl(var(--primary));
	}
	.bg-picker__details {
		border: 2px solid oklch(0.24 0.065 281 / 0.34);
		border-radius: var(--pixel-radius);
		background: oklch(0.985 0.015 82);
		padding: 0.5rem 0.6rem;
	}
	.bg-picker__details summary {
		cursor: pointer;
		color: hsl(var(--foreground));
		font-size: 0.78rem;
		font-weight: 850;
	}
	.bg-picker__details[open] {
		box-shadow: 0.1rem 0.1rem 0 oklch(0.24 0.065 281 / 0.26);
	}
	.bg-picker__details[open] summary {
		margin-bottom: 0.55rem;
	}
	.bg-picker__details .field + .field {
		margin-top: 0.55rem;
	}
	/* "Which colours participate" chips: a round swatch that dims when excluded. */
	.swatch-toggle {
		height: 1.5rem;
		width: 1.5rem;
		flex: 0 0 auto;
		border-radius: var(--pixel-radius);
		border: 2px solid var(--pixel-ink);
		opacity: 0.35;
		cursor: pointer;
	}
	.swatch-toggle[aria-pressed='true'] {
		opacity: 1;
		outline: 3px solid var(--pixel-yellow);
		outline-offset: 2px;
	}
	.hint {
		margin: 0;
		font-size: 0.72rem;
		color: hsl(var(--muted-foreground));
	}
	summary:focus-visible,
	button:focus-visible,
	input:focus-visible,
	select:focus-visible {
		outline: 3px solid var(--pixel-cyan);
		outline-offset: 2px;
	}
</style>
