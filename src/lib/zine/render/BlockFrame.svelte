<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { BlockStyle, TextKind } from '../schema/theme';
	import type { AnimationDescriptor } from '../schema/animation';
	import { getBlockDecoration } from './context';
	import { resolveTypeset } from './typeset';

	// Shared per-block wrapper. Applies block style (alignment) and is the single seam
	// where the animation system (Step 4) attaches motion. When the editor provides a
	// decoration context, the block becomes a selectable surface (a real, keyboard-
	// operable button overlay); on the public page the context is absent and this is
	// inert. The `animation` descriptor is carried but NOT applied in Step 3 — a static
	// render is the reduced-motion / graceful-degradation baseline.
	let {
		blockId,
		blockType,
		blockProps,
		label,
		style,
		textKind,
		animation,
		timelineStyle,
		timelineActive,
		children
	}: {
		blockId?: string;
		blockType?: string;
		blockProps?: unknown;
		label?: string;
		style?: BlockStyle;
		textKind?: TextKind;
		animation?: AnimationDescriptor;
		timelineStyle?: string;
		timelineActive?: boolean;
		children: Snippet;
	} = $props();

	const decoration = getBlockDecoration();
	const editable = $derived(Boolean(decoration && blockId && decoration().enabled));
	const selected = $derived(decoration && blockId ? decoration().selectedId === blockId : false);
	const textBackdrop = $derived(style?.textBackdrop);
	const textColor = $derived(style?.textColor);
	// Editorial typeset resolved to concrete, bounded values (measure/leading/case/align/wrap).
	const typeset = $derived(resolveTypeset(style, blockType, textKind, blockProps));
	const frameStyle = $derived.by(() => {
		const parts: string[] = [];
		if (timelineStyle) parts.push(timelineStyle);
		if (textColor) parts.push(`--zine-text-color:${textColor}`);
		if (textBackdrop) {
			parts.push(`--zine-text-backdrop-color:${textBackdrop.color}`);
			parts.push(`--zine-text-backdrop-opacity:${Math.round(textBackdrop.opacity * 100)}%`);
			parts.push(`--zine-text-backdrop-padding:${textBackdrop.padding ?? 1}`);
		}
		// Numeric typeset values go through bounded CSS custom properties (never raw author CSS).
		if (typeset.measureCh) parts.push(`--zine-ts-measure:${typeset.measureCh}ch`);
		if (typeset.leading) parts.push(`--zine-ts-leading:${typeset.leading}`);
		if (typeset.tidyWrap) parts.push(`--zine-ts-wrap:${typeset.tidyWrap}`);
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
			data-align={typeset.align}
			data-animation={animation?.type}
			data-text-color={textColor ? true : undefined}
			data-text-backdrop={textBackdrop?.shape}
			data-typeset={typeset.hasTypeset || undefined}
			data-text-kind={typeset.kind}
			data-typeset-role={typeset.role}
			data-text-case={typeset.textCase}
			data-tidy={typeset.tidyWrap}
			style={frameStyle}
		>
			{#if textBackdrop?.shape === 'circle'}
				<span class="zine-circle-shape zine-circle-shape--left" aria-hidden="true"></span>
				<span class="zine-circle-shape zine-circle-shape--right" aria-hidden="true"></span>
			{/if}
			{@render children()}
		</div>
	</div>
{:else}
	<div
		class="zine-block"
		class:is-timeline-active={timelineActive}
		data-align={typeset.align}
		data-animation={animation?.type}
		data-text-color={textColor ? true : undefined}
		data-text-backdrop={textBackdrop?.shape}
		data-typeset={typeset.hasTypeset || undefined}
		data-text-kind={typeset.kind}
		data-typeset-role={typeset.role}
		data-text-case={typeset.textCase}
		data-tidy={typeset.tidyWrap}
		style={frameStyle}
	>
		{#if textBackdrop?.shape === 'circle'}
			<span class="zine-circle-shape zine-circle-shape--left" aria-hidden="true"></span>
			<span class="zine-circle-shape zine-circle-shape--right" aria-hidden="true"></span>
		{/if}
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
