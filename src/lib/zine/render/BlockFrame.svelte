<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { BlockStyle } from '../schema/theme';
	import type { AnimationDescriptor } from '../schema/animation';

	// Shared per-block wrapper. Applies block style (alignment) and is the single seam
	// where the animation system (Step 4) will attach motion via `use:animate`. The
	// `animation` descriptor is carried as a data attribute now but NOT applied — a
	// static render is the correct reduced-motion / graceful-degradation baseline
	// (docs/best-practices/scrollytelling.md §6). Centralising this here means adding
	// an animation preset never edits a block's Render.
	let {
		style,
		animation,
		children
	}: { style?: BlockStyle; animation?: AnimationDescriptor; children: Snippet } = $props();
</script>

<div class="zine-block" data-align={style?.align} data-animation={animation?.type}>
	{@render children()}
</div>
