<script lang="ts">
	import { onDestroy } from 'svelte';
	import { getBackground } from '../registry';
	import { reducedMotion } from '$lib/a11y/reduced-motion';
	import { createBackgroundRuntime, type BackgroundRuntime } from '../backgrounds/runtime';
	import { pointer, type PointerPos } from './pointer';
	import type { SceneBackground } from '../schema/document';

	// A scene's decorative background layer: a media fill (image / GIF / video) or a curated
	// interactive canvas, plus a scrim overlay for text legibility. The whole layer is
	// aria-hidden and pointer-events:none (content stays readable + clickable). For a canvas
	// it wires the lifecycle runtime (mount near-viewport, FPS-capped, scroll + cursor in,
	// reduced-motion still-frame, teardown). SSR renders the element but never mounts.
	let {
		background,
		progress = 0,
		pinned = false
	}: { background?: SceneBackground; progress?: number; pinned?: boolean } = $props();

	const fill = $derived(background?.fill);
	const overlay = $derived(background?.overlay);
	const rm = $derived($reducedMotion);

	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let runtime: BackgroundRuntime | null = null;

	// One manual subscription so the rAF loop can read the latest cursor without making the
	// background-mount effect depend on (and re-create on) every pointer move.
	let pointerValue: PointerPos = null;
	const unsubPointer = pointer.subscribe((v) => (pointerValue = v));

	const lowPower =
		typeof window !== 'undefined' &&
		Boolean(
			window.matchMedia?.('(max-width: 800px)')?.matches ||
			(navigator.hardwareConcurrency ?? 8) <= 4
		);

	function objectPosition(point?: { x: number; y: number }): string | null {
		return point ? `${(point.x * 100).toFixed(1)}% ${(point.y * 100).toFixed(1)}%` : null;
	}

	// (Re)mount the canvas runtime when the preset/params or reduced-motion change — never on
	// scroll/pointer, which flow through getDynamic.
	$effect(() => {
		const canvas = canvasEl;
		const current = fill;
		const reduced = rm;
		if (!canvas || current?.kind !== 'canvas') return;
		const def = getBackground(current.preset);
		if (!def) return;
		const params = current.params;
		let cancelled = false;
		def
			.load()
			.then((factory) => {
				if (cancelled) return;
				runtime?.destroy();
				runtime = createBackgroundRuntime({
					canvas,
					factory,
					params,
					fps: def.fps,
					reducedMotion: reduced,
					policy: def.reducedMotion,
					getDynamic: () => ({
						progress: progress ?? 0,
						pointer: def.needsPointer ? pointerValue : null,
						lowPower
					})
				});
			})
			.catch(() => {
				/* a failed background never breaks the page — the content reads fine without it */
			});
		return () => {
			cancelled = true;
			runtime?.destroy();
			runtime = null;
		};
	});

	onDestroy(() => {
		unsubPointer();
		runtime?.destroy();
	});
</script>

{#if fill || overlay}
	<div class="zine-bg" class:is-pinned={pinned} aria-hidden="true">
		{#if fill?.kind === 'image'}
			<img
				class="zine-bg__media"
				src={rm && fill.poster ? fill.poster : fill.src}
				alt=""
				loading="lazy"
				decoding="async"
				style:object-fit={fill.fit}
				style:object-position={objectPosition(fill.focalPoint)}
			/>
		{:else if fill?.kind === 'video'}
			{#if rm && fill.poster}
				<img class="zine-bg__media" src={fill.poster} alt="" style:object-fit={fill.fit} />
			{:else}
				<video
					class="zine-bg__media"
					src={fill.src}
					poster={fill.poster}
					autoplay
					muted
					loop={fill.loop}
					playsinline
					style:object-fit={fill.fit}
				></video>
			{/if}
		{:else if fill?.kind === 'canvas'}
			<canvas class="zine-bg__media zine-bg__canvas" bind:this={canvasEl}></canvas>
		{/if}

		{#if overlay}
			<div
				class="zine-bg__scrim"
				style:background={overlay.color ?? 'hsl(0 0% 0%)'}
				style:opacity={overlay.opacity}
			></div>
		{/if}
	</div>
{/if}

<style>
	.zine-bg {
		position: absolute;
		inset: 0;
		z-index: 0;
		overflow: hidden;
		pointer-events: none;
	}
	/* Pinned scenes: a full-viewport sticky backdrop behind the pinned content. `100vh` is
	   fine here (decorative, not gating a scroll trigger); the canvas reads its real px size
	   from a ResizeObserver, so mobile-navbar height changes just re-size it. */
	.zine-bg.is-pinned {
		position: sticky;
		top: 0;
		height: 100vh;
	}
	.zine-bg__media {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.zine-bg__canvas {
		display: block;
	}
	.zine-bg__scrim {
		position: absolute;
		inset: 0;
	}
</style>
