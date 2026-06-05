<script lang="ts">
	import { allBlocks } from '$lib/zine/registry';
	import type { Act, Scene, SceneType } from '$lib/zine/schema/document';
	import type { EditorStore } from './store.svelte';
	import SceneMiniPreview from './SceneMiniPreview.svelte';
	import ThemePanel from './ThemePanel.svelte';

	let { store, onOpenScene }: { store: EditorStore; onOpenScene: (sceneId: string) => void } =
		$props();

	let addingForActId = $state<string | null>(null);
	let draggedSceneId = $state<string | null>(null);
	let showTheme = $state(false);

	const sceneChoices: { type: SceneType; label: string }[] = [
		{ type: 'page', label: 'Just writing' },
		{ type: 'feature', label: 'Big picture' },
		{ type: 'reveal', label: 'Reveal steps' },
		{ type: 'parallax', label: 'Picture moves' },
		{ type: 'sidescroll', label: 'Side to side' },
		{ type: 'data', label: 'Data story' }
	];
	const typeLabels: Record<SceneType, string> = {
		page: 'Page',
		feature: 'Feature',
		reveal: 'Reveal',
		parallax: 'Parallax',
		sidescroll: 'Side-scroll',
		data: 'Data'
	};
	const blockLabels = new Map(allBlocks().map((block) => [block.type, block.label]));
	const storyBlockLabels = new Map([
		['heading', 'Title'],
		['richText', 'Words'],
		['image', 'Picture'],
		['linkButton', 'Link'],
		['spacer', 'Pause']
	]);

	function addScene(actId: string | undefined, type: SceneType): void {
		const sceneId = store.addStarterScene(actId, type);
		addingForActId = null;
		onOpenScene(sceneId);
	}

	function addChapter(): void {
		const id = store.addAct(`Chapter ${store.doc.acts.length + 1}`);
		addingForActId = id;
	}

	function displayTitle(scene: Scene, index: number): string {
		return scene.label || firstHeading(scene) || `Scene ${index + 1}`;
	}

	function firstHeading(scene: Scene): string | null {
		for (const element of scene.elements) {
			if (element.block.type === 'heading') {
				const props = element.block.props as { text?: unknown };
				if (typeof props.text === 'string' && props.text.trim()) return props.text;
			}
		}
		return null;
	}

	function summary(scene: Scene): string {
		if (scene.elements.length === 0) return 'Empty';
		const labels = scene.elements
			.slice(0, 3)
			.map(
				(element) =>
					storyBlockLabels.get(element.block.type) ??
					blockLabels.get(element.block.type) ??
					element.block.type
			);
		return labels.join(', ');
	}

	function deleteScene(scene: Scene): void {
		if (confirm('Delete this scene?')) store.removeScene(scene.id);
	}

	function dropBefore(targetSceneId: string): void {
		if (!draggedSceneId) return;
		store.moveSceneBefore(draggedSceneId, targetSceneId);
		draggedSceneId = null;
	}

	function dropAtEnd(act: Act): void {
		if (!draggedSceneId) return;
		store.moveSceneToActEnd(draggedSceneId, act.id);
		draggedSceneId = null;
	}
</script>

<section class="story-map" aria-labelledby="story-map-title">
	<header class="story-map__header">
		<div>
			<p class="story-map__eyebrow">Your zine</p>
			<h2 id="story-map-title" class="story-map__title">Story map</h2>
		</div>
		<div class="story-map__actions">
			<button
				type="button"
				class="secondary-button"
				aria-haspopup="dialog"
				onclick={() => (showTheme = true)}
			>
				🎨 Colours
			</button>
			<button type="button" class="secondary-button" onclick={() => addScene(undefined, 'page')}>
				Add scene
			</button>
			<button type="button" class="primary-button" onclick={addChapter}>Add chapter</button>
		</div>
	</header>

	{#if store.doc.acts.length === 0}
		<div class="empty-map">
			<p>No scenes yet.</p>
			<button type="button" class="primary-button" onclick={() => addScene(undefined, 'page')}>
				Add first scene
			</button>
		</div>
	{/if}

	<div class="story-map__chapters">
		{#each store.doc.acts as act, actIndex (act.id)}
			<section class="chapter-band" aria-label={`Chapter ${actIndex + 1}`}>
				<header class="chapter-band__header">
					<label class="chapter-title">
						<span>Chapter {actIndex + 1}</span>
						<input
							type="text"
							value={act.title ?? ''}
							placeholder="Chapter name"
							oninput={(e) => store.setActTitle(act.id, e.currentTarget.value)}
						/>
					</label>
					<div class="chapter-band__actions">
						<button
							type="button"
							class="small-button"
							onclick={() => store.moveAct(act.id, 'up')}
							aria-label={`Move chapter ${actIndex + 1} up`}
						>
							Move up
						</button>
						<button
							type="button"
							class="small-button"
							onclick={() => store.moveAct(act.id, 'down')}
							aria-label={`Move chapter ${actIndex + 1} down`}
						>
							Move down
						</button>
						<button
							type="button"
							class="small-button"
							aria-expanded={addingForActId === act.id}
							onclick={() => (addingForActId = addingForActId === act.id ? null : act.id)}
						>
							Add scene
						</button>
					</div>
				</header>

				{#if addingForActId === act.id}
					<div class="scene-choices" aria-label="Scene choices">
						{#each sceneChoices as choice (choice.type)}
							<button type="button" onclick={() => addScene(act.id, choice.type)}>
								<span>{choice.label}</span>
								<small>{typeLabels[choice.type]}</small>
							</button>
						{/each}
					</div>
				{/if}

				<div class="scene-strip">
					{#each act.scenes as scene, sceneIndex (scene.id)}
						<article
							class="scene-card"
							class:is-selected={store.selectedId === scene.id}
							draggable={true}
							ondragstart={() => (draggedSceneId = scene.id)}
							ondragover={(e) => e.preventDefault()}
							ondrop={() => dropBefore(scene.id)}
						>
							<SceneMiniPreview {scene} theme={store.doc.theme} />
							<div class="scene-card__body">
								<div class="scene-card__meta">
									<span>{typeLabels[scene.type]}</span>
									<span>{scene.elements.length} items</span>
								</div>
								<h3>{displayTitle(scene, sceneIndex)}</h3>
								<p>{summary(scene)}</p>
								<div class="beat-dots" aria-label={`${scene.beats.length} beats`}>
									{#each scene.beats as beat (beat.id)}
										<span style:left={`${Math.max(0, Math.min(1, beat.at)) * 100}%`}></span>
									{/each}
								</div>
							</div>
							<button
								type="button"
								class="scene-card__open"
								aria-label={`Open ${displayTitle(scene, sceneIndex)}`}
								onclick={() => onOpenScene(scene.id)}
							></button>
							<div class="scene-card__controls">
								<button type="button" onclick={() => store.moveScene(scene.id, 'up')}>Up</button>
								<button type="button" onclick={() => store.moveScene(scene.id, 'down')}>Down</button
								>
								<button type="button" class="danger" onclick={() => deleteScene(scene)}
									>Delete</button
								>
							</div>
						</article>
					{/each}

					<button type="button" class="add-card" onclick={() => (addingForActId = act.id)}>
						Add scene
					</button>
				</div>

				<div
					class="drop-end"
					ondragover={(e) => e.preventDefault()}
					ondrop={() => dropAtEnd(act)}
					aria-hidden="true"
				></div>
			</section>
		{/each}
	</div>
</section>

{#if showTheme}
	<!-- The colour tool is document-level, so it opens from the story map (not a scene). -->
	<div class="theme-drawer" role="dialog" aria-modal="true" aria-label="Colours">
		<button
			type="button"
			class="theme-drawer__scrim"
			aria-label="Close colours"
			onclick={() => (showTheme = false)}
		></button>
		<div class="theme-drawer__panel">
			<header class="theme-drawer__header">
				<h2>Colours</h2>
				<button type="button" class="small-button" onclick={() => (showTheme = false)}>Done</button>
			</header>
			<div class="theme-drawer__body">
				<ThemePanel {store} />
			</div>
		</div>
	</div>
{/if}

<style>
	.story-map {
		min-height: 100%;
		background: hsl(var(--background));
		color: hsl(var(--foreground));
	}
	.story-map__header {
		position: sticky;
		top: 0;
		z-index: 5;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		border-bottom: 1px solid hsl(var(--border));
		background: hsl(var(--background) / 0.96);
		padding: 1rem 1.5rem;
	}
	.story-map__eyebrow {
		margin: 0 0 0.1rem;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: hsl(var(--muted-foreground));
	}
	.story-map__title {
		margin: 0;
		font-size: 1.35rem;
		font-weight: 750;
		line-height: 1.2;
	}
	.story-map__actions,
	.chapter-band__actions,
	.scene-card__controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.primary-button,
	.secondary-button,
	.small-button,
	.scene-card__controls button,
	.add-card,
	.scene-choices button {
		border-radius: 0.5rem;
		font-size: 0.88rem;
		font-weight: 650;
	}
	.primary-button {
		background: hsl(var(--foreground));
		color: hsl(var(--background));
		padding: 0.62rem 0.9rem;
	}
	.secondary-button,
	.small-button {
		border: 1px solid hsl(var(--border));
		background: hsl(var(--background));
		color: hsl(var(--foreground));
		padding: 0.56rem 0.8rem;
	}
	.small-button {
		padding: 0.42rem 0.65rem;
		font-size: 0.78rem;
	}
	.empty-map {
		margin: 2rem auto;
		display: grid;
		max-width: 30rem;
		place-items: center;
		gap: 0.9rem;
		border: 1px dashed hsl(var(--border));
		border-radius: 0.5rem;
		padding: 2rem;
		color: hsl(var(--muted-foreground));
	}
	.story-map__chapters {
		display: grid;
		gap: 1.25rem;
		padding: 1.25rem;
	}
	.chapter-band {
		border: 1px solid hsl(var(--border));
		border-radius: 0.5rem;
		background: hsl(var(--muted) / 0.34);
		padding: 1rem;
	}
	.chapter-band__header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
	}
	.chapter-title {
		display: grid;
		gap: 0.35rem;
		min-width: min(100%, 22rem);
	}
	.chapter-title span {
		font-size: 0.72rem;
		font-weight: 750;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: hsl(var(--muted-foreground));
	}
	.chapter-title input {
		width: 100%;
		border: 0;
		border-bottom: 1px solid transparent;
		background: transparent;
		padding: 0.2rem 0;
		font-size: 1.15rem;
		font-weight: 720;
		color: hsl(var(--foreground));
	}
	.chapter-title input:focus {
		border-bottom-color: hsl(var(--primary));
		outline: none;
	}
	.scene-choices {
		margin-top: 0.9rem;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: 0.6rem;
	}
	.scene-choices button {
		border: 1px solid hsl(var(--border));
		background: hsl(var(--background));
		padding: 0.7rem;
		text-align: left;
		color: hsl(var(--foreground));
	}
	.scene-choices small {
		display: block;
		margin-top: 0.2rem;
		color: hsl(var(--muted-foreground));
	}
	.scene-strip {
		margin-top: 1rem;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: 0.8rem;
	}
	.scene-card {
		position: relative;
		overflow: hidden;
		border: 1px solid hsl(var(--border));
		border-radius: 0.5rem;
		background: hsl(var(--background));
		box-shadow: 0 1px 2px hsl(var(--foreground) / 0.05);
	}
	.scene-card.is-selected {
		border-color: hsl(var(--primary));
		box-shadow: 0 0 0 2px hsl(var(--primary) / 0.16);
	}
	.scene-card__body {
		padding: 0.8rem;
	}
	.scene-card__meta {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		color: hsl(var(--muted-foreground));
	}
	.scene-card h3 {
		margin: 0.35rem 0 0;
		font-size: 1rem;
		font-weight: 750;
		line-height: 1.25;
	}
	.scene-card p {
		margin: 0.25rem 0 0;
		color: hsl(var(--muted-foreground));
		font-size: 0.86rem;
	}
	.beat-dots {
		position: relative;
		margin-top: 0.75rem;
		height: 0.45rem;
		border-radius: 999px;
		background: hsl(var(--muted));
	}
	.beat-dots span {
		position: absolute;
		top: 50%;
		height: 0.55rem;
		width: 0.55rem;
		border-radius: 999px;
		background: hsl(var(--foreground));
		transform: translate(-50%, -50%);
	}
	.scene-card__open {
		position: absolute;
		inset: 0;
		z-index: 1;
		border-radius: 0.5rem;
	}
	.scene-card__open:focus-visible {
		outline: 2px solid hsl(var(--primary));
		outline-offset: -3px;
	}
	.scene-card__controls {
		position: relative;
		z-index: 2;
		border-top: 1px solid hsl(var(--border));
		padding: 0.55rem 0.65rem;
	}
	.scene-card__controls button {
		border: 1px solid hsl(var(--border));
		background: hsl(var(--background));
		padding: 0.35rem 0.5rem;
		color: hsl(var(--foreground));
	}
	.scene-card__controls .danger {
		color: #b42318;
	}
	.add-card {
		min-height: 14rem;
		border: 1px dashed hsl(var(--border));
		background: transparent;
		color: hsl(var(--muted-foreground));
	}
	.drop-end {
		height: 0.35rem;
	}
	/* Colour tool drawer: a right-side panel over a dimming scrim. */
	.theme-drawer {
		position: fixed;
		inset: 0;
		z-index: 60;
		display: flex;
		justify-content: flex-end;
	}
	.theme-drawer__scrim {
		position: absolute;
		inset: 0;
		border: 0;
		background: hsl(var(--foreground) / 0.4);
		cursor: pointer;
	}
	.theme-drawer__panel {
		position: relative;
		display: flex;
		width: min(24rem, 100%);
		flex-direction: column;
		border-left: 1px solid hsl(var(--border));
		background: hsl(var(--background));
		box-shadow: -8px 0 24px hsl(var(--foreground) / 0.15);
	}
	.theme-drawer__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid hsl(var(--border));
		padding: 0.9rem 1.1rem;
	}
	.theme-drawer__header h2 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 750;
	}
	.theme-drawer__body {
		flex: 1 1 auto;
		overflow-y: auto;
		padding: 1.1rem;
	}
	@media (max-width: 720px) {
		.story-map__header,
		.chapter-band__header {
			align-items: stretch;
			flex-direction: column;
		}
		.scene-strip {
			grid-template-columns: 1fr;
		}
	}
</style>
