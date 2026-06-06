<script lang="ts">
	import { onMount } from 'svelte';
	import { setBlockDecoration } from '$lib/zine/render/context';
	import ZineRenderer from '$lib/zine/render/ZineRenderer.svelte';
	import { themeVars } from '$lib/zine/theme/registry';
	import { loadThemeFonts } from '$lib/zine/theme/font-loader';
	import type { EditorStore } from './store.svelte';
	import Toolbar from './Toolbar.svelte';
	import StoryMap from './StoryMap.svelte';
	import SceneEditor from './SceneEditor.svelte';

	let { store, title }: { store: EditorStore; title: string } = $props();

	// Theme the whole preview surface so it matches the zine (no white bars around it).
	const previewStyle = $derived(themeVars(store.doc.theme));
	// Load the web fonts the current theme uses so every editor preview renders in the real
	// fonts (the picker loads the full set for its tiles).
	$effect(() => {
		loadThemeFonts(store.doc.theme);
	});
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
	<div class="editor-workbench">
		<Toolbar {store} {title} />

		<div class="editor-workbench__surface">
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
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		box-shadow: 0.16rem 0.16rem 0 var(--pixel-ink);
		padding: 0.5rem 0.95rem;
		font-size: 0.88rem;
		font-weight: 850;
		color: hsl(var(--foreground));
	}
	.reader-preview__back:hover {
		background: var(--pixel-yellow);
	}
	.reader-preview__back:focus-visible {
		outline: 3px solid var(--pixel-cyan);
		outline-offset: 2px;
	}
	.editor-workbench {
		display: flex;
		height: 100vh;
		min-height: 100vh;
		flex-direction: column;
		background:
			linear-gradient(90deg, oklch(0.24 0.065 281 / 0.055) 1px, transparent 1px),
			linear-gradient(oklch(0.24 0.065 281 / 0.045) 1px, transparent 1px), var(--pixel-paper);
		background-size: 32px 32px;
		color: hsl(var(--foreground));
	}
	.editor-workbench__surface {
		min-height: 0;
		flex: 1 1 auto;
		overflow-y: auto;
	}
</style>
