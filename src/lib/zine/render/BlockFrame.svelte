<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { BlockStyle } from '../schema/theme';
	import type { AnimationDescriptor } from '../schema/animation';
	import { getBlockDecoration } from './context';

	// Shared per-block wrapper. Applies block style (alignment) and is the single seam
	// where the animation system (Step 4) attaches motion. When the editor provides a
	// decoration context, the block becomes a selectable surface (a real, keyboard-
	// operable button overlay); on the public page the context is absent and this is
	// inert. The `animation` descriptor is carried but NOT applied in Step 3 — a static
	// render is the reduced-motion / graceful-degradation baseline.
	let {
		blockId,
		label,
		style,
		animation,
		timelineStyle,
		timelineActive,
		children
	}: {
		blockId?: string;
		label?: string;
		style?: BlockStyle;
		animation?: AnimationDescriptor;
		timelineStyle?: string;
		timelineActive?: boolean;
		children: Snippet;
	} = $props();

	const decoration = getBlockDecoration();
	const editable = $derived(Boolean(decoration && blockId && decoration().enabled));
	const selected = $derived(decoration && blockId ? decoration().selectedId === blockId : false);
	const textBackdrop = $derived(style?.textBackdrop);
	const frameStyle = $derived.by(() => {
		const parts: string[] = [];
		if (timelineStyle) parts.push(timelineStyle);
		if (textBackdrop) {
			parts.push(`--zine-text-backdrop-color:${textBackdrop.color}`);
			parts.push(`--zine-text-backdrop-opacity:${Math.round(textBackdrop.opacity * 100)}%`);
		}
		return parts.length ? parts.join(';') : undefined;
	});
</script>

{#if editable && decoration && blockId}
	<div class="zine-block-shell" class:is-selected={selected}>
		<button
			type="button"
			class="zine-block-select"
			aria-label={`Select ${label ?? 'block'}`}
			aria-pressed={selected}
			onclick={(e) => {
				e.stopPropagation();
				decoration().select(blockId);
			}}
		></button>
		<div
			class="zine-block"
			class:is-timeline-active={timelineActive}
			data-align={style?.align}
			data-animation={animation?.type}
			data-text-backdrop={textBackdrop?.shape}
			style={frameStyle}
		>
			{@render children()}
		</div>
	</div>
{:else}
	<div
		class="zine-block"
		class:is-timeline-active={timelineActive}
		data-align={style?.align}
		data-animation={animation?.type}
		data-text-backdrop={textBackdrop?.shape}
		style={frameStyle}
	>
		{@render children()}
	</div>
{/if}

<style>
	.zine-block-shell {
		position: relative;
	}
	.zine-block-select {
		position: absolute;
		inset: -0.25rem 0;
		z-index: 2;
		width: 100%;
		cursor: pointer;
		border: 2px solid transparent;
		border-radius: 0.5rem;
		background: transparent;
		padding: 0;
	}
	.zine-block-shell:hover .zine-block-select {
		border-color: hsl(var(--primary) / 0.3);
	}
	.zine-block-select:focus-visible {
		outline: 2px solid hsl(var(--primary));
		outline-offset: 2px;
	}
	.zine-block-shell.is-selected .zine-block-select {
		border-color: hsl(var(--primary));
	}
</style>
