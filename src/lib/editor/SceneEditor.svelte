<script lang="ts">
	import { getBlock } from '$lib/zine/registry';
	import type { Element, Scene, SceneType, ZineDocument } from '$lib/zine/schema/document';
	import BlockInspector from './BlockInspector.svelte';
	import EffectPicker from './EffectPicker.svelte';
	import SectionInspector from './SectionInspector.svelte';
	import SceneTimeline from './SceneTimeline.svelte';
	import PathEditor from './PathEditor.svelte';
	import type { EditorStore } from './store.svelte';

	let { store, sceneId, onBack }: { store: EditorStore; sceneId: string; onBack: () => void } =
		$props();

	// The choreography ("click-through") stage opens for one free element at a time.
	let pathEditorElementId = $state<string | null>(null);
	function openPathEditor(id: string): void {
		store.select(id);
		pathEditorElementId = id;
	}

	const typeLabels: Record<SceneType, string> = {
		page: 'Page',
		feature: 'Feature',
		reveal: 'Reveal',
		parallax: 'Parallax',
		sidescroll: 'Side-scroll',
		data: 'Data'
	};

	const scene = $derived(findScene(store.doc, sceneId));
	const selectedBlock = $derived(
		store.selectedBlock?.sceneId === sceneId ? store.selectedBlock : null
	);
	const document = $derived<ZineDocument | null>(
		scene
			? {
					schemaVersion: 5,
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

	function elementTitle(element: Element): string {
		if (element.block.type === 'heading') {
			const props = element.block.props as { text?: unknown };
			if (typeof props.text === 'string' && props.text.trim()) return props.text;
		}
		return getBlock(element.block.type)?.label ?? 'Clip';
	}

	function elementDepthLabel(scene: Scene, element: Element): string {
		const index = scene.elements.findIndex((candidate) => candidate.id === element.id);
		if (index < 0 || scene.elements.length === 1) return 'Only track';
		if (index === 0) return 'Shows on top';
		if (index === scene.elements.length - 1) return 'Shows on bottom';
		return `Track ${index + 1} of ${scene.elements.length}`;
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
				<SceneTimeline {store} {scene} {document} onEditPath={openPathEditor} />
			</main>

			<aside class="scene-inspector" aria-label="Scene inspector">
				{#if selectedBlock}
					{#key selectedBlock.element.id}
						<section class="rail-hero" aria-label="Current selection">
							<p>Now editing</p>
							<h3>{elementTitle(selectedBlock.element)}</h3>
							<div class="rail-hero__meta">
								<span>{getBlock(selectedBlock.block.type)?.label ?? selectedBlock.block.type}</span>
								<span>{elementDepthLabel(scene, selectedBlock.element)}</span>
							</div>
							<button type="button" onclick={() => store.select(scene.id)}>
								Edit scene settings
							</button>
						</section>
						<BlockInspector {store} element={selectedBlock.element} />
						<EffectPicker {store} element={selectedBlock.element} onEditPath={openPathEditor} />
					{/key}
				{:else}
					<section class="rail-hero" aria-label="Current scene">
						<p>Scene settings</p>
						<h3>{scene.label || sceneTitle(scene)}</h3>
						<div class="rail-hero__meta">
							<span>{typeLabels[scene.type]}</span>
							<span>{scene.elements.length} {scene.elements.length === 1 ? 'clip' : 'clips'}</span>
						</div>
					</section>
					<SectionInspector {store} section={scene} />
				{/if}
			</aside>
		</div>

		{#if pathEditorElementId}
			<PathEditor
				{store}
				{scene}
				{document}
				elementId={pathEditorElementId}
				onClose={() => (pathEditorElementId = null)}
			/>
		{/if}
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
		background:
			linear-gradient(90deg, oklch(0.24 0.065 281 / 0.08) 1px, transparent 1px),
			linear-gradient(oklch(0.24 0.065 281 / 0.06) 1px, transparent 1px),
			linear-gradient(
				135deg,
				oklch(0.67 0.15 200 / 0.16) 0 25%,
				transparent 25% 50%,
				oklch(0.55 0.19 339 / 0.1) 50% 75%,
				transparent 75% 100%
			),
			var(--pixel-backdrop);
		background-size:
			24px 24px,
			24px 24px,
			96px 96px,
			auto;
	}
	.scene-editor__header {
		position: sticky;
		top: 0;
		z-index: 8;
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 1rem;
		border-bottom: 2px solid var(--pixel-ink);
		background:
			linear-gradient(90deg, oklch(0.24 0.065 281 / 0.08) 1px, transparent 1px),
			linear-gradient(0deg, oklch(0.24 0.065 281 / 0.06) 1px, transparent 1px),
			oklch(0.92 0.035 84 / 0.97);
		background-size: 12px 12px;
		box-shadow: 0 0.18rem 0 oklch(0.24 0.065 281 / 0.16);
		padding: 0.85rem 1.25rem;
	}
	.scene-editor__header p {
		margin: 0 0 0.1rem;
		font-size: 0.72rem;
		font-weight: 750;
		letter-spacing: 0;
		text-transform: uppercase;
		color: hsl(var(--muted-foreground));
		font-family: var(--pixel-font-ui);
	}
	.scene-editor__header h2 {
		margin: 0;
		font-size: 1.15rem;
		font-weight: 950;
		line-height: 1.2;
		text-shadow: 0.08rem 0.08rem 0 var(--pixel-yellow);
	}
	.scene-editor__header-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: end;
		gap: 0.5rem;
	}
	.back-button,
	.done-button {
		border-radius: var(--pixel-radius);
		font-family: var(--pixel-font-ui);
		font-size: 0.88rem;
		font-weight: 850;
		text-transform: uppercase;
	}
	.back-button {
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		box-shadow: 0.12rem 0.12rem 0 var(--pixel-ink);
		color: hsl(var(--foreground));
		padding: 0.52rem 0.72rem;
	}
	.done-button {
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-magenta);
		box-shadow: 0.12rem 0.12rem 0 var(--pixel-ink);
		color: hsl(var(--primary-foreground));
		padding: 0.56rem 0.84rem;
	}
	.back-button:hover,
	.done-button:hover {
		background: var(--pixel-yellow);
		color: var(--pixel-ink);
	}
	.scene-editor__layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(19.5rem, 23rem);
		min-height: calc(100vh - 7rem);
	}
	.timeline-surface {
		overflow: auto;
		padding: 1rem 1.25rem 2rem;
	}
	.scene-inspector {
		display: grid;
		align-content: start;
		gap: 0.8rem;
		border-left: 2px solid var(--pixel-ink);
		background:
			linear-gradient(90deg, oklch(0.24 0.065 281 / 0.055) 1px, transparent 1px),
			linear-gradient(0deg, oklch(0.24 0.065 281 / 0.045) 1px, transparent 1px),
			oklch(0.9 0.038 82 / 0.92);
		background-size: 14px 14px;
		padding: 1rem;
	}
	.rail-hero {
		display: grid;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: oklch(0.97 0.02 82);
		box-shadow: var(--pixel-shadow-sm);
		padding: 0.85rem;
	}
	.rail-hero {
		gap: 0.45rem;
	}
	.rail-hero p {
		margin: 0;
		color: hsl(var(--muted-foreground));
		font-size: 0.68rem;
		font-weight: 900;
		letter-spacing: 0;
		text-transform: uppercase;
		font-family: var(--pixel-font-ui);
	}
	.rail-hero h3 {
		margin: 0;
		color: hsl(var(--foreground));
		font-size: 1rem;
		font-weight: 950;
		line-height: 1.15;
	}
	.rail-hero__meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.rail-hero__meta span {
		border: 1px solid oklch(0.24 0.065 281 / 0.32);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		padding: 0.12rem 0.4rem;
		color: hsl(var(--muted-foreground));
		font-family: var(--pixel-font-ui);
		font-size: 0.7rem;
		font-weight: 800;
	}
	.rail-hero button {
		justify-self: start;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		box-shadow: var(--pixel-shadow-xs);
		padding: 0.42rem 0.62rem;
		color: hsl(var(--foreground));
		font-family: var(--pixel-font-ui);
		font-size: 0.8rem;
		font-weight: 850;
		text-transform: uppercase;
	}
	.rail-hero button:focus-visible {
		outline: 3px solid var(--pixel-cyan);
		outline-offset: 2px;
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
			border-top: 2px solid var(--pixel-ink);
		}
	}
	@media (max-width: 640px) {
		.scene-editor__header {
			grid-template-columns: 1fr;
		}
	}
</style>
