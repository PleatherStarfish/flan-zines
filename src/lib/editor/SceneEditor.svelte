<script lang="ts">
	import type { ElementTrack, Scene, SceneType, ZineDocument } from '$lib/zine/schema/document';
	import BlockInspector from './BlockInspector.svelte';
	import EffectPicker from './EffectPicker.svelte';
	import SectionInspector from './SectionInspector.svelte';
	import SceneTimeline from './SceneTimeline.svelte';
	import type { EditorStore } from './store.svelte';

	let { store, sceneId, onBack }: { store: EditorStore; sceneId: string; onBack: () => void } =
		$props();

	const typeLabels: Record<SceneType, string> = {
		page: 'Page',
		feature: 'Feature',
		reveal: 'Reveal',
		parallax: 'Parallax',
		sidescroll: 'Side-scroll',
		data: 'Data'
	};
	const trackChoices: { track: ElementTrack; label: string }[] = [
		{ track: 'content', label: 'Words' },
		{ track: 'media', label: 'Pictures' },
		{ track: 'background', label: 'Backdrop' }
	];

	const scene = $derived(findScene(store.doc, sceneId));
	const selectedBlock = $derived(
		store.selectedBlock?.sceneId === sceneId ? store.selectedBlock : null
	);
	const document = $derived<ZineDocument | null>(
		scene
			? {
					schemaVersion: 4,
					theme: store.doc.theme,
					acts: [{ id: 'act_scene_editor', scenes: [scene] }]
				}
			: null
	);

	function sceneTitle(scene: Scene): string {
		for (const element of scene.elements) {
			if (element.block.type === 'heading') {
				const props = element.block.props as { text?: unknown };
				if (typeof props.text === 'string' && props.text.trim()) return props.text;
			}
		}
		return 'Untitled scene';
	}

	function findScene(doc: ZineDocument, id: string): Scene | null {
		for (const act of doc.acts) {
			const found = act.scenes.find((candidate) => candidate.id === id);
			if (found) return found;
		}
		return null;
	}
</script>

{#if scene && document}
	<section class="scene-editor" aria-labelledby="scene-editor-title">
		<header class="scene-editor__header">
			<button type="button" class="back-button" onclick={onBack}>Story map</button>
			<div>
				<p>{typeLabels[scene.type]}</p>
				<h2 id="scene-editor-title">{scene.label || sceneTitle(scene)}</h2>
			</div>
			<div class="scene-editor__header-actions">
				<button type="button" class="back-button" onclick={() => store.select(scene.id)}>
					Scene settings
				</button>
				<button type="button" class="done-button" onclick={onBack}>Done</button>
			</div>
		</header>

		<div class="scene-editor__layout">
			<main class="timeline-surface">
				<SceneTimeline {store} {scene} {document} />
			</main>

			<aside class="scene-inspector" aria-label="Scene inspector">
				{#if selectedBlock}
					{#key selectedBlock.element.id}
						<EffectPicker {store} element={selectedBlock.element} />
						<section class="choice-panel" aria-label="Clip placement">
							<h3>Where does it live?</h3>
							<div class="chip-grid">
								{#each trackChoices as choice (choice.track)}
									<button
										type="button"
										aria-pressed={selectedBlock.element.track === choice.track}
										onclick={() => store.updateElementTrack(selectedBlock.element.id, choice.track)}
									>
										{choice.label}
									</button>
								{/each}
							</div>
						</section>
						<BlockInspector {store} element={selectedBlock.element} />
					{/key}
				{:else}
					<SectionInspector {store} section={scene} />
				{/if}
			</aside>
		</div>
	</section>
{:else}
	<section class="missing-scene">
		<p>That scene is no longer here.</p>
		<button type="button" class="done-button" onclick={onBack}>Back to map</button>
	</section>
{/if}

<style>
	.scene-editor {
		min-height: 100%;
		background: hsl(var(--background));
	}
	.scene-editor__header {
		position: sticky;
		top: 0;
		z-index: 8;
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 1rem;
		border-bottom: 1px solid hsl(var(--border));
		background: hsl(var(--background) / 0.96);
		padding: 0.85rem 1.25rem;
	}
	.scene-editor__header p {
		margin: 0 0 0.1rem;
		font-size: 0.72rem;
		font-weight: 750;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: hsl(var(--muted-foreground));
	}
	.scene-editor__header h2 {
		margin: 0;
		font-size: 1.15rem;
		font-weight: 760;
		line-height: 1.2;
	}
	.scene-editor__header-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: end;
		gap: 0.5rem;
	}
	.back-button,
	.done-button {
		border-radius: 0.5rem;
		font-size: 0.88rem;
		font-weight: 650;
	}
	.back-button {
		border: 1px solid hsl(var(--border));
		background: hsl(var(--background));
		color: hsl(var(--foreground));
		padding: 0.52rem 0.72rem;
	}
	.done-button {
		background: hsl(var(--foreground));
		color: hsl(var(--background));
		padding: 0.56rem 0.84rem;
	}
	.scene-editor__layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(18rem, 21rem);
		min-height: calc(100vh - 7rem);
	}
	.timeline-surface {
		overflow: auto;
		padding: 1rem 1.25rem 2rem;
	}
	.scene-inspector {
		display: grid;
		align-content: start;
		gap: 1rem;
		border-left: 1px solid hsl(var(--border));
		background: hsl(var(--muted) / 0.26);
		padding: 1rem;
	}
	.choice-panel {
		display: grid;
		gap: 0.7rem;
		border: 1px solid hsl(var(--border));
		border-radius: 0.5rem;
		background: hsl(var(--background));
		padding: 0.85rem;
	}
	.choice-panel h3 {
		margin: 0;
		font-size: 0.78rem;
		font-weight: 760;
		color: hsl(var(--foreground));
	}
	.chip-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.45rem;
	}
	.chip-grid button {
		border: 1px solid hsl(var(--border));
		border-radius: 0.35rem;
		background: hsl(var(--background));
		padding: 0.45rem 0.5rem;
		font-size: 0.8rem;
		font-weight: 700;
		color: hsl(var(--foreground));
	}
	.chip-grid button[aria-pressed='true'] {
		border-color: hsl(var(--primary));
		background: hsl(var(--muted));
	}
	.missing-scene {
		display: grid;
		min-height: 100%;
		place-items: center;
		gap: 1rem;
	}
	@media (max-width: 980px) {
		.scene-editor__layout {
			grid-template-columns: 1fr;
		}
		.scene-inspector {
			border-left: 0;
			border-top: 1px solid hsl(var(--border));
		}
	}
	@media (max-width: 640px) {
		.scene-editor__header {
			grid-template-columns: 1fr;
		}
	}
</style>
