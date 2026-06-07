<script lang="ts">
	import type { EditorStore } from './store.svelte';
	import type { ThemeRole } from '$lib/zine/schema/theme';
	import { resolveThemeColors, themeSwatches } from '$lib/zine/theme/registry';
	import { getThemeCatalogue } from '$lib/zine/theme/catalogue';
	import ContrastBadge from './ContrastBadge.svelte';
	import FontPicker from './FontPicker.svelte';

	// The colour tool: browse a wide catalogue of curated themes, pick the page background,
	// assign theme colours to specific elements (with live contrast warnings), and customize
	// individual swatches. The catalogue (dataset + culori) is lazy-loaded here so it never
	// touches the public reader bundle.
	let { store }: { store: EditorStore } = $props();

	const colors = $derived(resolveThemeColors(store.doc.theme));
	const swatches = $derived(themeSwatches(store.doc.theme));
	const activePreset = $derived(store.doc.theme?.preset);

	const ROLES: { key: ThemeRole; label: string; large: boolean; badge: boolean }[] = [
		{ key: 'background', label: 'Page background', large: false, badge: false },
		{ key: 'text', label: 'Body text', large: false, badge: true },
		{ key: 'heading', label: 'Headings', large: false, badge: true },
		{ key: 'accent', label: 'Links & buttons', large: true, badge: true },
		{ key: 'muted', label: 'Captions & lines', large: true, badge: true }
	];

	// The curated catalogue is committed data derived synchronously (memoised), so it's
	// available immediately when the panel opens — no loading state needed.
	const catalogue = getThemeCatalogue();

	let addingSwatch = $state('#888888');
</script>

<div class="space-y-5">
	<!-- Browse curated themes -->
	<section>
		<p class="section-label">Themes</p>
		<div class="theme-grid">
			{#each catalogue as theme (theme.id)}
				<button
					type="button"
					class="theme-tile"
					aria-label="Apply theme {theme.id}"
					aria-pressed={activePreset === theme.id}
					onclick={() => store.applyThemePreset(theme)}
				>
					{#each theme.swatches as sw, i (i)}
						<span class="seg" style:background={sw}></span>
					{/each}
				</button>
			{/each}
		</div>
	</section>

	<!-- Assign colours to elements -->
	<section>
		<p class="section-label">Colours by element</p>
		<div class="space-y-3">
			{#each ROLES as role (role.key)}
				<div>
					<div class="mb-1 flex items-center justify-between">
						<span class="role-label">{role.label}</span>
						{#if role.badge}
							<ContrastBadge fg={colors[role.key]} bg={colors.background} large={role.large} />
						{/if}
					</div>
					<div class="swatch-row">
						{#each swatches as sw, i (i)}
							<button
								type="button"
								class="swatch"
								class:selected={colors[role.key].toLowerCase() === sw.toLowerCase()}
								style:background={sw}
								aria-label="Use {sw} for {role.label}"
								onclick={() => store.setThemeRole(role.key, sw)}
							></button>
						{/each}
						<label class="custom-swatch" title="Custom colour">
							<input
								type="color"
								value={colors[role.key]}
								oninput={(e) => store.setThemeRole(role.key, e.currentTarget.value)}
							/>
						</label>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- Customize the swatch pool -->
	<section>
		<p class="section-label">Your palette</p>
		<div class="swatch-row">
			{#each swatches as sw, i (i)}
				<label class="custom-swatch" title="Edit swatch">
					<span class="swatch" style:background={sw} aria-hidden="true"></span>
					<input
						type="color"
						value={sw}
						oninput={(e) => store.setThemeSwatch(i, e.currentTarget.value)}
					/>
				</label>
			{/each}
			<label class="add-swatch" title="Add a colour">
				+
				<input
					type="color"
					value={addingSwatch}
					onchange={(e) => store.addThemeSwatch(e.currentTarget.value)}
				/>
			</label>
		</div>
		<p class="hint">Editing a swatch updates every element using it.</p>
	</section>

	<!-- Fonts: pleasing combos (previewed) + a customize toggle -->
	<section>
		<p class="section-label">Fonts</p>
		<FontPicker {store} />
	</section>
</div>

<style>
	.section-label {
		margin-bottom: 0.4rem;
		font-size: 0.7rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0;
		color: hsl(var(--muted-foreground));
	}
	.hint {
		margin-top: 0.4rem;
		font-size: 0.72rem;
		color: hsl(var(--muted-foreground));
	}
	.role-label {
		font-size: 0.82rem;
		font-weight: 850;
		color: hsl(var(--foreground));
	}
	/* Curated themes: a scrollable grid of swatch strips. */
	.theme-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.4rem;
		max-height: 14rem;
		overflow-y: auto;
		padding-right: 0.2rem;
	}
	.theme-tile {
		display: flex;
		height: 1.9rem;
		overflow: hidden;
		border-radius: var(--pixel-radius);
		border: 2px solid var(--pixel-ink);
		box-shadow: 0.1rem 0.1rem 0 var(--pixel-ink);
	}
	.theme-tile[aria-pressed='true'] {
		box-shadow:
			0 0 0 3px var(--pixel-yellow),
			0.1rem 0.1rem 0 var(--pixel-ink);
	}
	.theme-tile .seg {
		flex: 1 1 auto;
	}
	/* Swatch chips for assignment + customization. */
	.swatch-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
	}
	.swatch {
		display: inline-block;
		height: 1.4rem;
		width: 1.4rem;
		border-radius: var(--pixel-radius);
		border: 2px solid var(--pixel-ink);
		cursor: pointer;
	}
	button.swatch.selected {
		outline: 3px solid var(--pixel-yellow);
		outline-offset: 2px;
	}
	/* A native colour picker hidden behind a round chip / "+" affordance. */
	.custom-swatch,
	.add-swatch {
		position: relative;
		display: inline-flex;
		height: 1.4rem;
		width: 1.4rem;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.add-swatch {
		border-radius: var(--pixel-radius);
		border: 2px dashed var(--pixel-ink);
		font-size: 0.9rem;
		font-weight: 900;
		color: hsl(var(--muted-foreground));
	}
	.custom-swatch input[type='color'],
	.add-swatch input[type='color'] {
		position: absolute;
		inset: 0;
		height: 100%;
		width: 100%;
		cursor: pointer;
		opacity: 0;
	}
	.custom-swatch:not(:has(.swatch)) {
		border-radius: var(--pixel-radius);
		border: 2px solid var(--pixel-ink);
		background: conic-gradient(red, yellow, lime, aqua, blue, magenta, red);
	}
	button:focus-visible,
	input:focus-visible {
		outline: 3px solid var(--pixel-cyan);
		outline-offset: 2px;
	}
</style>
