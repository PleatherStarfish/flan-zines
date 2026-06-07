<script lang="ts">
	import SceneBackground from './SceneBackground.svelte';
	import type { Scene } from '../schema/document';

	// The continuous backdrop: ONE viewport-fixed layer behind all scene content, with one
	// stacked slot per scene. Each slot's opacity comes from the renderer's `backdropPlan`
	// (see ./transitions.ts), so consecutive scenes CROSSFADE as the reader scrolls instead of
	// hard-cutting at a section boundary. A canvas preset's runtime mounts only while its slot
	// is visible (`live`), so at most two are alive at a seam — one live GPU/rAF budget.
	let {
		scenes,
		opacities,
		progressFor,
		themePalette = [],
		framed = false
	}: {
		scenes: Scene[];
		opacities: Record<string, number>;
		progressFor: (id: string) => number;
		themePalette?: [number, number, number][];
		framed?: boolean;
	} = $props();

	// Only scenes with *some* backdrop (a flat colour, a media fill, or a scrim) need a layer.
	const slots = $derived(
		scenes.filter((s) => s.background?.color || s.background?.fill || s.background?.overlay)
	);
</script>

<div class="zine-backdrop" class:is-framed={framed} aria-hidden="true">
	{#each slots as scene (scene.id)}
		{@const opacity = opacities[scene.id] ?? 0}
		<div class="zine-backdrop__slot" style:opacity style:background={scene.background?.color}>
			{#if scene.background?.fill || scene.background?.overlay}
				<SceneBackground
					background={scene.background}
					progress={progressFor(scene.id)}
					live={opacity > 0}
					{themePalette}
					{framed}
				/>
			{/if}
		</div>
	{/each}
</div>

<style>
	/* Viewport-fixed behind all content (z-index -1, so the article's --zine-bg shows through a
	   transparent slot). In a framed editor preview it anchors to the frame instead. */
	.zine-backdrop {
		position: fixed;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		pointer-events: none;
		contain: layout paint;
	}
	.zine-backdrop.is-framed {
		position: absolute;
	}
	.zine-backdrop__slot {
		position: absolute;
		inset: 0;
		/* opacity is the crossfade; only transform/opacity animate (perf budget). */
		will-change: opacity;
	}
</style>
