<script lang="ts">
	import ZineRenderer from '$lib/zine/render/ZineRenderer.svelte';
	import type { Scene, ZineDocument } from '$lib/zine/schema/document';
	import type { Theme } from '$lib/zine/schema/theme';

	let { scene, theme }: { scene: Scene; theme?: Theme } = $props();

	const document = $derived<ZineDocument>({
		schemaVersion: 4,
		theme,
		acts: [{ id: 'act_preview', scenes: [scene] }]
	});
</script>

<div class="scene-mini-preview" inert aria-hidden="true">
	<div class="scene-mini-preview__scale">
		<ZineRenderer {document} />
	</div>
</div>

<style>
	.scene-mini-preview {
		height: 8rem;
		overflow: hidden;
		border-bottom: 1px solid hsl(var(--border));
		background: var(--zine-bg, hsl(var(--background)));
	}
	.scene-mini-preview__scale {
		width: 220%;
		transform: scale(0.45);
		transform-origin: top left;
		pointer-events: none;
	}
	.scene-mini-preview :global(.zine-scene) {
		padding: 0.75rem 0;
	}
	.scene-mini-preview :global(.zine-block) {
		padding-inline: 1rem;
	}
</style>
