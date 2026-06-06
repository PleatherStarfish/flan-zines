<script lang="ts">
	import type { EditorStore } from './store.svelte';
	import BackgroundPicker from './BackgroundPicker.svelte';
	import {
		SCENE_TYPES,
		sceneScrollScreens,
		type Scene,
		type SceneType
	} from '$lib/zine/schema/document';

	let { store, section }: { store: EditorStore; section: Scene } = $props();

	const screens = $derived(sceneScrollScreens(section));
	const axis = $derived(section.scrollAxis ?? 'vertical');
	const travelLabel = $derived(
		`${axis === 'horizontal' ? 'Sideways' : 'Down'} · ${screens} ${screens === 1 ? 'screen' : 'screens'}`
	);
	const backgroundLabel = $derived(
		section.background?.fill
			? section.background.fill.kind === 'canvas'
				? 'Animated'
				: section.background.fill.kind === 'video'
					? 'Video'
					: 'Image'
			: 'None'
	);

	const typeLabels: Record<SceneType, string> = {
		page: 'Page (just writing)',
		feature: 'Feature (big picture)',
		reveal: 'Reveal',
		parallax: 'Parallax',
		sidescroll: 'Side-scroll',
		data: 'Data'
	};

	function deleteScene(): void {
		if (confirm('Delete this scene?')) store.removeScene(section.id);
	}
</script>

<div class="section-inspector">
	<section class="section-inspector__start" aria-label="Scene basics">
		<div class="section-inspector__heading">
			<h3>Scene basics</h3>
			<p>Name the scene and choose the kind of reading moment it should be.</p>
		</div>
		<label class="field">
			<span>Scene name <small>(just for you)</small></span>
			<input
				type="text"
				value={section.label ?? ''}
				placeholder="e.g. Intro"
				oninput={(e) => store.setSceneLabel(section.id, e.currentTarget.value)}
			/>
		</label>

		<label class="field">
			<span>Scene type</span>
			<select
				value={section.type}
				onchange={(e) => store.setSceneType(section.id, e.currentTarget.value as SceneType)}
			>
				{#each SCENE_TYPES as type (type)}
					<option value={type} disabled={type === 'data'}>{typeLabels[type]}</option>
				{/each}
			</select>
		</label>
	</section>

	{#if section.type !== 'page'}
		<details class="rail-disclosure" open>
			<summary>
				<span>Scene travel</span>
				<strong>{travelLabel}</strong>
			</summary>
			<div class="intent-note">
				<strong>Whole scene, not one clip.</strong>
				<span>
					This sets how the reader moves through the stage. Clip choreography still happens on the
					timeline and path editor.
				</span>
			</div>
			<div class="field" role="group" aria-label="Scene travel direction">
				<span>Reader path</span>
				<div class="button-row">
					<button
						type="button"
						aria-pressed={axis === 'vertical'}
						onclick={() => store.setSceneScrollAxis(section.id, 'vertical')}
					>
						Down
					</button>
					<button
						type="button"
						aria-pressed={axis === 'horizontal'}
						onclick={() => store.setSceneScrollAxis(section.id, 'horizontal')}
					>
						Sideways
					</button>
				</div>
				<small>
					Down keeps the scene pinned while effects play. Sideways pans the stage like a
					side-scroller while the page still scrolls down.
				</small>
			</div>

			<label class="field">
				<span>
					Scene duration
					<small>({screens} {screens === 1 ? 'screen' : 'screens'})</small>
				</span>
				<input
					type="range"
					aria-label="Scene duration in screens"
					min="1"
					max="12"
					step="1"
					value={screens}
					oninput={(e) => store.setSceneScroll(section.id, Number(e.currentTarget.value))}
				/>
				<small>More screens gives reveals, parallax, and paths more scroll time.</small>
			</label>
		</details>
	{/if}

	<details class="rail-disclosure" open={Boolean(section.background?.fill)}>
		<summary>
			<span>Background</span>
			<strong>{backgroundLabel}</strong>
		</summary>
		<BackgroundPicker {store} {section} />
	</details>

	<details class="rail-disclosure rail-disclosure--danger">
		<summary>Arrange or remove</summary>
		<div class="button-row">
			<button type="button" onclick={() => store.moveScene(section.id, 'up')}>Move up</button>
			<button type="button" onclick={() => store.moveScene(section.id, 'down')}>Move down</button>
		</div>
		<button type="button" onclick={deleteScene} class="section-inspector__delete">
			Delete this scene
		</button>
	</details>
</div>

<style>
	.section-inspector {
		display: grid;
		gap: 0.75rem;
	}
	.section-inspector__start {
		display: grid;
		gap: 0.65rem;
	}
	.section-inspector__heading {
		display: grid;
		gap: 0.15rem;
	}
	.section-inspector__heading h3 {
		margin: 0;
		color: hsl(var(--foreground));
		font-size: 0.88rem;
		font-weight: 900;
	}
	.section-inspector__heading p {
		margin: 0;
		color: hsl(var(--muted-foreground));
		font-size: 0.78rem;
		line-height: 1.35;
	}
	.field {
		display: grid;
		gap: 0.4rem;
	}
	.field > span {
		color: hsl(var(--foreground));
		font-size: 0.86rem;
		font-weight: 850;
	}
	.field small {
		color: hsl(var(--muted-foreground));
		font-size: 0.74rem;
		font-weight: 650;
		line-height: 1.35;
	}
	.field input[type='text'],
	.field select {
		width: 100%;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: oklch(0.97 0.02 82);
		padding: 0.55rem 0.65rem;
		color: hsl(var(--foreground));
		font-size: 0.86rem;
	}
	.field input[type='range'] {
		width: 100%;
		accent-color: hsl(var(--primary));
	}
	.rail-disclosure {
		border: 2px solid oklch(0.24 0.065 281 / 0.34);
		border-radius: var(--pixel-radius);
		background: oklch(0.985 0.015 82);
		padding: 0.55rem 0.65rem;
	}
	.rail-disclosure summary {
		display: grid;
		grid-template-columns: minmax(0, 1fr) max-content;
		align-items: center;
		gap: 0.45rem;
		cursor: pointer;
		color: hsl(var(--foreground));
		font-size: 0.8rem;
		font-weight: 850;
	}
	.rail-disclosure summary strong {
		border: 1px solid oklch(0.24 0.065 281 / 0.32);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		padding: 0.12rem 0.38rem;
		color: hsl(var(--muted-foreground));
		font-size: 0.7rem;
		font-weight: 800;
	}
	.rail-disclosure[open] {
		box-shadow: 0.1rem 0.1rem 0 oklch(0.24 0.065 281 / 0.28);
	}
	.rail-disclosure[open] summary {
		margin-bottom: 0.6rem;
	}
	.rail-disclosure .field + .field,
	.rail-disclosure .button-row + .section-inspector__delete {
		margin-top: 0.6rem;
	}
	.intent-note {
		display: grid;
		gap: 0.15rem;
		border: 2px dashed oklch(0.24 0.065 281 / 0.28);
		border-radius: var(--pixel-radius);
		background: oklch(0.94 0.035 82);
		margin-bottom: 0.65rem;
		padding: 0.55rem 0.6rem;
	}
	.intent-note strong {
		color: hsl(var(--foreground));
		font-size: 0.76rem;
		font-weight: 900;
	}
	.intent-note span {
		color: hsl(var(--muted-foreground));
		font-size: 0.74rem;
		line-height: 1.35;
	}
	.button-row {
		display: flex;
		gap: 0.4rem;
	}
	.button-row button {
		flex: 1 1 auto;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		box-shadow: 0.1rem 0.1rem 0 var(--pixel-ink);
		padding: 0.42rem 0.55rem;
		color: hsl(var(--foreground));
		font-size: 0.82rem;
		font-weight: 850;
	}
	.button-row button[aria-pressed='true'] {
		background: var(--pixel-cyan);
	}
	.section-inspector__delete {
		justify-self: start;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: oklch(0.98 0.025 25);
		box-shadow: 0.1rem 0.1rem 0 var(--pixel-ink);
		color: hsl(var(--destructive));
		padding: 0.42rem 0.65rem;
		font-size: 0.86rem;
		font-weight: 850;
	}
	summary:focus-visible,
	button:focus-visible,
	input:focus-visible,
	select:focus-visible {
		outline: 3px solid var(--pixel-cyan);
		outline-offset: 2px;
	}
</style>
