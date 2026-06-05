<script lang="ts">
	import { onMount } from 'svelte';
	import { setBlockDecoration } from '$lib/zine/render/context';
	import ZineRenderer from '$lib/zine/render/ZineRenderer.svelte';
	import { themeVars } from '$lib/zine/theme/registry';
	import type { EditorStore } from './store.svelte';
	import Toolbar from './Toolbar.svelte';
	import StoryMap from './StoryMap.svelte';
	import SceneEditor from './SceneEditor.svelte';

	let { store, title }: { store: EditorStore; title: string } = $props();

	// Theme the whole preview surface so it matches the zine (no white bars around it).
	const previewStyle = $derived(themeVars(store.doc.theme));
	let surface = $state<'map' | 'scene'>('map');
	let activeSceneId = $state<string | null>(null);

	// Provide the decoration seam: canvas blocks become selectable in Edit mode only.
	setBlockDecoration(() => ({
		selectedId: store.selectedId,
		select: (id) => store.select(id),
		enabled: store.mode === 'edit' && surface === 'scene'
	}));

	function openScene(sceneId: string): void {
		activeSceneId = sceneId;
		surface = 'scene';
		store.select(sceneId);
	}

	function backToMap(): void {
		surface = 'map';
		store.select(null);
	}

	function exitPreview(): void {
		store.setMode('edit');
	}

	function onWindowKeydown(event: KeyboardEvent): void {
		if (store.mode === 'preview' && event.key === 'Escape') exitPreview();
	}

	onMount(() => {
		const flush = () => void store.flushNow();
		window.addEventListener('beforeunload', flush);
		window.addEventListener('online', flush);
		return () => {
			window.removeEventListener('beforeunload', flush);
			window.removeEventListener('online', flush);
			store.dispose();
		};
	});
</script>

<svelte:window onkeydown={onWindowKeydown} />

{#if store.mode === 'preview'}
	<!-- A true reader view: the exact ZineRenderer the public page uses, full-width with
	     real scroll-driven motion. The only editor affordance is the Back button. -->
	<div class="reader-preview" style={previewStyle}>
		<ZineRenderer document={store.doc} {title} drive />
	</div>
	<button type="button" class="reader-preview__back" onclick={exitPreview}>
		← Back to editor
	</button>
{:else}
	<div class="flex h-screen flex-col bg-muted">
		<Toolbar {store} {title} />

		<div class="min-h-0 flex-1 overflow-y-auto">
			{#if surface === 'scene' && activeSceneId}
				<SceneEditor {store} sceneId={activeSceneId} onBack={backToMap} />
			{:else}
				<StoryMap {store} onOpenScene={openScene} />
			{/if}
		</div>
	</div>
{/if}

<style>
	.reader-preview {
		position: fixed;
		inset: 0;
		z-index: 50;
		overflow-y: auto;
		/* Themed surface (var set via previewStyle) so the zine fills the window edge-to-edge
		   with no white bars — breathing room lives inside the zine itself. */
		background: var(--zine-bg);
	}
	.reader-preview__back {
		position: fixed;
		top: 1rem;
		left: 1rem;
		z-index: 51;
		border-radius: 999px;
		border: 1px solid hsl(var(--border));
		background: hsl(var(--background) / 0.92);
		box-shadow: 0 2px 10px hsl(var(--foreground) / 0.16);
		padding: 0.5rem 0.95rem;
		font-size: 0.88rem;
		font-weight: 650;
		color: hsl(var(--foreground));
		backdrop-filter: blur(6px);
	}
	.reader-preview__back:hover {
		background: hsl(var(--background));
	}
	.reader-preview__back:focus-visible {
		outline: 2px solid hsl(var(--primary));
		outline-offset: 2px;
	}
</style>
