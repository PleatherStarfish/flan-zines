<script lang="ts">
	import { getBlock, getEffect } from '../registry';
	import {
		sceneScrollScreens,
		type Element,
		type Scene,
		type ZineDocument
	} from '../schema/document';
	import { themeVars, themeSwatchesRgb, resolveThemeColors } from '../theme/registry';
	import { reducedMotion } from '$lib/a11y/reduced-motion';
	import BlockFrame from './BlockFrame.svelte';
	import SceneBackground from './SceneBackground.svelte';
	import { composeElementStyle, type EffectImplMap } from './timeline';

	// Story → page. Reads ONLY the registries (no hard-coded block/effect list) and
	// imports nothing from the editor — the same component renders the public page and
	// the editor preview. The zine TITLE is the single <h1>; content headings are h2+.
	//
	// Scroll choreography (scene-timeline.md §8): one progress signal per scene drives
	// every element (enter ramp → hold + motion → exit ramp). `sceneProgress` is the
	// explicit override the editor scrubber feeds; otherwise, with `drive`, the renderer
	// self-computes each scene's progress from real scroll. Under reduced-motion (or no
	// JS / SSR / no signal) every element renders neutral, in source order — fully
	// readable. Effect impls are dynamically imported, so a text-only zine ships none.
	type ViewportMode = 'page' | 'frame';

	let {
		document,
		title,
		sceneProgress = {},
		drive = false,
		pinScenes = true,
		viewport = 'page'
	}: {
		document: ZineDocument;
		title?: string;
		sceneProgress?: Record<string, number>;
		drive?: boolean;
		/** Size + pin timeline scenes to their scroll distance (the real page). The editor's
		 * compact scrubbed preview turns this OFF so the scene fits its little window. */
		pinScenes?: boolean;
		/** Render inside a fixed frame instead of the browser viewport. Used by editor previews
		 * that need the same pinned/free-sprite choreography inside a miniature screen. */
		viewport?: ViewportMode;
	} = $props();

	const rootStyle = $derived(themeVars(document.theme));
	// The theme's swatch colours (RGB) handed to theme-aware canvas backgrounds so a
	// generative background paints with the student's palette.
	const themePalette = $derived(themeSwatchesRgb(document.theme));
	const rm = $derived($reducedMotion);
	const framedViewport = $derived(viewport === 'frame');

	// Effect ids actually used anywhere in the document.
	const usedEffects = $derived.by(() => {
		const types = new Set<string>();
		for (const act of document.acts) {
			for (const scene of act.scenes) {
				for (const el of scene.elements) {
					if (el.enter) types.add(el.enter.type);
					if (el.exit) types.add(el.exit.type);
					if (el.motion) types.add(el.motion.type);
				}
			}
		}
		return types;
	});

	// Lazily load the impls for the used effects (code-split). Reassigning the Map
	// triggers a recompute once each chunk resolves.
	let impls = $state<EffectImplMap>(new Map());
	$effect(() => {
		if (rm) return;
		const types = usedEffects;
		let cancelled = false;
		(async () => {
			const next = new Map(impls);
			let changed = false;
			for (const type of types) {
				if (next.has(type)) continue;
				const def = getEffect(type);
				if (!def) continue;
				try {
					next.set(type, await def.load());
					changed = true;
				} catch {
					// A failed chunk degrades to the default ramp / no motion — never breaks.
				}
			}
			if (!cancelled && changed) impls = next;
		})();
		return () => {
			cancelled = true;
		};
	});

	// Self-driven scroll progress for the public page / preview. getBoundingClientRect is
	// viewport-relative, so one capturing scroll listener works whether the window or an
	// inner editor pane is the scroller.
	let rootEl = $state<HTMLElement | null>(null);
	let driven = $state<Record<string, number>>({});
	$effect(() => {
		if (
			!drive ||
			rm ||
			typeof window === 'undefined' ||
			typeof IntersectionObserver === 'undefined'
		)
			return;
		const root = rootEl;
		if (!root) return;
		let frame = 0;
		const measure = () => {
			frame = 0;
			const vh = window.innerHeight || 1;
			const next: Record<string, number> = {};
			for (const el of root.querySelectorAll<HTMLElement>('[data-scene-id]')) {
				const id = el.dataset.sceneId;
				if (!id) continue;
				const rect = el.getBoundingClientRect();
				const total = rect.height + vh;
				next[id] = total > 0 ? Math.max(0, Math.min(1, (vh - rect.top) / total)) : 0;
			}
			driven = next;
		};
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(measure);
		};
		measure();
		window.addEventListener('scroll', onScroll, { capture: true, passive: true });
		window.addEventListener('resize', onScroll, { passive: true });
		return () => {
			if (frame) cancelAnimationFrame(frame);
			window.removeEventListener('scroll', onScroll, { capture: true });
			window.removeEventListener('resize', onScroll);
		};
	});

	function progressFor(sceneId: string): number | undefined {
		return sceneProgress[sceneId] ?? driven[sceneId];
	}

	// A timeline scene occupies its scroll distance (scene-timeline.md §3): the section is
	// made `scrollLength` screens tall and its content is pinned (sticky) inside, so the
	// reader scrolls that whole distance while the effects interpolate. Page scenes — and
	// the editor's compact preview (pinScenes=false) — stay in normal flow.
	function hasCanvasBackground(scene: Scene): boolean {
		return scene.background?.fill?.kind === 'canvas';
	}

	// `free` elements are sprites that float over the scene on a path. Under reduced motion they
	// fall back to normal in-flow source order (fully readable, no overlay), so `free` only
	// applies when motion is on. Keyed off the general `placement` field, never the effect type.
	function hasFreeElements(scene: Scene): boolean {
		return !rm && scene.elements.some((element) => element.placement === 'free');
	}
	function freeElementsFor(scene: Scene): Element[] {
		return rm ? [] : scene.elements.filter((element) => element.placement === 'free');
	}
	function flowElementsFor(scene: Scene): Element[] {
		return rm ? scene.elements : scene.elements.filter((element) => element.placement !== 'free');
	}

	function isPinned(scene: Scene): boolean {
		// Under reduced motion every scene lays out in normal source order (scene-timeline.md
		// §8) — no tall pinned region to scroll past, just a readable page. A canvas background
		// or free sprites pin so they get a full-screen, viewport-fixed stage to play over.
		return (
			pinScenes &&
			!rm &&
			(scene.type !== 'page' || hasCanvasBackground(scene) || hasFreeElements(scene))
		);
	}

	function hexToRgb(hex: string): [number, number, number] | null {
		const normalized = hex.trim();
		const short = /^#([0-9a-f]{3})$/i.exec(normalized);
		if (short) {
			const [r, g, b] = [...short[1]].map((channel) => parseInt(channel + channel, 16));
			return [r, g, b];
		}
		const long = /^#([0-9a-f]{6})$/i.exec(normalized);
		if (!long) return null;
		const value = parseInt(long[1], 16);
		return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
	}

	function relativeLuminance([r, g, b]: [number, number, number]): number {
		const toLinear = (channel: number) => {
			const value = channel / 255;
			return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
		};
		return toLinear(r) * 0.2126 + toLinear(g) * 0.7152 + toLinear(b) * 0.0722;
	}

	function isDarkBackground(color: string | undefined): boolean {
		const rgb = color ? hexToRgb(color) : null;
		return rgb ? relativeLuminance(rgb) < 0.22 : false;
	}

	function relativeLuminanceHex(hex: string): number {
		const rgb = hexToRgb(hex);
		return rgb ? relativeLuminance(rgb) : 0;
	}

	// A dark per-scene background needs light text. Derive it FROM THE THEME (the lightest of
	// its colours) instead of a hardcoded cream, so the override stays on-brand for any theme
	// (incl. dark themes, whose own text is already light). Reader-safe (no culori).
	function darkSceneVars(): string[] {
		const c = resolveThemeColors(document.theme);
		const light = [c.text, c.heading, c.muted, c.accent].reduce(
			(best, col) => (relativeLuminanceHex(col) > relativeLuminanceHex(best) ? col : best),
			c.background
		);
		const accent = relativeLuminanceHex(c.accent) > 0.3 ? c.accent : light;
		return [
			`--zine-fg:${light}`,
			`--zine-heading:${light}`,
			`--zine-muted:${light}`,
			`--zine-accent:${accent}`
		];
	}

	function sceneSectionStyle(scene: Scene): string | undefined {
		const parts: string[] = [];
		if (scene.background?.color) {
			parts.push(`background:${scene.background.color}`);
			if (isDarkBackground(scene.background.color)) parts.push(...darkSceneVars());
		}
		if (isPinned(scene) && !framedViewport) {
			// The scroll-range height uses `svh` (the *stable* small viewport) so a mobile
			// navbar toggling doesn't resize the range and jump the scroll triggers
			// (responsive-and-performance.md §3). svh is Baseline-2023 (fine on Chromebooks).
			parts.push(`min-height:${Math.round(sceneScrollScreens(scene) * 100)}svh`);
		}
		return parts.length ? parts.join(';') : undefined;
	}

	// A side-scroll scene (scene-timeline.md §3): the reader scrolls down a pinned scene
	// while its stage pans sideways. Degrades to a normal vertical stack under reduced
	// motion. The stage is `scrollLength` container-widths wide and translates by progress;
	// each element sits at `range.start` along the track (a future layer will add precise
	// per-progress positions — "jump up to the platform").
	function isHorizontal(scene: Scene): boolean {
		return !rm && scene.scrollAxis === 'horizontal';
	}

	function stageStyle(scene: Scene, progress: number | undefined): string {
		const screens = sceneScrollScreens(scene);
		const shift = screens > 1 ? ((progress ?? 0) * (screens - 1)) / screens : 0;
		return `width:${screens * 100}%;transform:translateX(${(-shift * 100).toFixed(3)}%)`;
	}

	function actorStyle(element: Element): string {
		return `left:${(element.range.start * 100).toFixed(2)}%`;
	}
</script>

<article class="zine" data-viewport={viewport} style={rootStyle} bind:this={rootEl}>
	{#if title}<h1 class="zine-title">{title}</h1>{/if}
	{#each document.acts as act (act.id)}
		<div class="zine-act" data-act={act.id}>
			{#each act.scenes as scene (scene.id)}
				{@const progress = progressFor(scene.id)}
				{@const horizontal = isHorizontal(scene)}
				{@const flowElements = flowElementsFor(scene)}
				{@const freeElements = freeElementsFor(scene)}
				<section
					class="zine-scene"
					data-type={scene.type}
					data-length={scene.length}
					data-axis={horizontal ? 'horizontal' : 'vertical'}
					data-scene-id={scene.id}
					style={sceneSectionStyle(scene)}
				>
					{#if scene.background?.fill || scene.background?.overlay}
						<SceneBackground
							background={scene.background}
							{progress}
							pinned={isPinned(scene)}
							framed={framedViewport}
							{themePalette}
						/>
					{/if}
					<div
						class="zine-scene__inner"
						class:is-pinned={isPinned(scene)}
						class:is-horizontal={horizontal}
						class:has-free={freeElements.length > 0}
					>
						{#if horizontal}
							<div class="zine-stage" style={stageStyle(scene, progress)}>
								{#each flowElements as element (element.id)}
									{@const def = getBlock(element.block.type)}
									{@const timeline = composeElementStyle(element, progress, impls, {
										reducedMotion: rm,
										axis: 'horizontal'
									})}
									{#if def}
										{@const Render = def.Render}
										<div class="zine-actor" data-track={element.track} style={actorStyle(element)}>
											<BlockFrame
												blockId={element.id}
												label={def.label}
												style={element.block.style}
												animation={element.legacyAnimation}
												timelineStyle={timeline.style || undefined}
												timelineActive={timeline.active}
											>
												<Render props={element.block.props} />
											</BlockFrame>
										</div>
									{/if}
								{/each}
							</div>
						{:else}
							{#each flowElements as element (element.id)}
								{@const block = element.block}
								{@const def = getBlock(block.type)}
								{@const timeline = composeElementStyle(element, progress, impls, {
									reducedMotion: rm
								})}
								{#if def}
									{@const Render = def.Render}
									<BlockFrame
										blockId={element.id}
										label={def.label}
										style={block.style}
										animation={element.legacyAnimation}
										timelineStyle={timeline.style || undefined}
										timelineActive={timeline.active}
									>
										<Render props={block.props} />
									</BlockFrame>
								{/if}
							{/each}
						{/if}

						{#if freeElements.length}
							<!-- Free sprites float over the scene in a viewport-fixed stage (a `size`
							     container so a path's cqw/cqh resolve to viewport %). Their `path`
							     motion positions them; with no motion they centre. Under reduced motion
							     free elements instead lay out in flow above (so this overlay is empty). -->
							<div class="zine-stage-overlay">
								{#each freeElements as element (element.id)}
									{@const def = getBlock(element.block.type)}
									{@const timeline = composeElementStyle(element, progress, impls, {
										reducedMotion: rm
									})}
									{#if def}
										{@const Render = def.Render}
										<div
											class="zine-free-actor"
											data-track={element.track}
											data-block-type={element.block.type}
										>
											<BlockFrame
												blockId={element.id}
												label={def.label}
												style={element.block.style}
												animation={element.legacyAnimation}
												timelineStyle={timeline.style || undefined}
												timelineActive={timeline.active}
											>
												<Render props={element.block.props} />
											</BlockFrame>
										</div>
									{/if}
								{/each}
							</div>
						{/if}
					</div>
				</section>
			{/each}
		</div>
	{/each}
</article>

<style>
	/* Reading styles. Block Render components live in child components, so these target
	   them with :global(). Theme tokens (--zine-*) are set by themeVars() on the root. */
	.zine {
		--zine-bg: #fbfaf7;
		--zine-fg: #14181f;
		--zine-heading: #14181f;
		--zine-muted: #6b7280;
		--zine-accent: hsl(var(--primary));
		--zine-font-heading: ui-serif, Georgia, serif;
		--zine-font-body: ui-sans-serif, system-ui, sans-serif;
		--zine-measure: 42rem;
		background: var(--zine-bg);
		color: var(--zine-fg);
		font-family: var(--zine-font-body);
		line-height: 1.6;
		/* The themed surface fills the window so the zine never floats in a white box at any
		   size (dvh = the visible viewport, navbar-aware; vh fallback for old engines). */
		min-height: 100vh;
		min-height: 100dvh;
		/* Off-screen entrances (fly-in / slide) translate past the edge — clip so they never
		   add a horizontal scrollbar. `clip` (not `hidden`) keeps sticky pinning working. */
		overflow-x: clip;
	}
	/* A framed renderer is a miniature reader viewport (timeline laptop preview). Pinned
	   scenes still pin and free sprites still use cqw/cqh, but everything resolves against the
	   frame instead of the real browser window. */
	.zine[data-viewport='frame'] {
		height: 100%;
		min-height: 100%;
		overflow: hidden;
	}
	.zine[data-viewport='frame'] .zine-act,
	.zine[data-viewport='frame'] .zine-scene {
		height: 100%;
		min-height: 100%;
	}
	.zine[data-viewport='frame'] .zine-scene {
		padding: 0;
	}
	.zine[data-viewport='frame'] .zine-scene__inner {
		container-type: size;
		height: 100%;
		min-height: 100%;
	}
	.zine[data-viewport='frame'] .zine-scene__inner.is-pinned {
		position: relative;
		top: auto;
		height: 100%;
		min-height: 100%;
	}
	.zine[data-viewport='frame'] .zine-scene__inner.is-horizontal,
	.zine[data-viewport='frame'] .zine-scene__inner.is-horizontal.is-pinned {
		position: relative;
		top: auto;
		height: 100%;
	}
	.zine[data-viewport='frame'] .zine-scene__inner.has-free:not(.is-pinned):not(.is-horizontal) {
		height: 100%;
		min-height: 100%;
	}
	.zine[data-viewport='frame'] .zine-actor {
		width: min(34rem, 78cqw);
	}
	.zine-title {
		max-width: var(--zine-measure);
		margin: 0 auto 2rem;
		/* Breathing room above the title now lives inside the themed surface (the page/preview
		   wrapper no longer adds white padding around the zine). */
		padding: clamp(2rem, 7vh, 4.5rem) 1.25rem 0;
		font-family: var(--zine-font-heading);
		font-size: clamp(2.25rem, 5vw, 3.5rem);
		font-weight: 800;
		line-height: 1.1;
		letter-spacing: -0.02em;
		color: var(--zine-heading, var(--zine-fg));
	}
	.zine-scene {
		position: relative;
		padding: 1.5rem 0;
		color: var(--zine-fg);
	}
	/* Content sits above the background layer (SceneBackground is z-index 0). */
	.zine-scene__inner {
		position: relative;
		z-index: 1;
	}
	/* A pinned timeline scene: the section is `scrollLength` screens tall (inline style),
	   and this inner wrapper sticks in the viewport while the reader scrolls that whole
	   distance, so the effects interpolate over real scroll. Page scenes leave it inert. */
	.zine-scene__inner.is-pinned {
		position: sticky;
		top: 0;
		display: flex;
		min-height: 100vh;
		min-height: 100dvh;
		flex-direction: column;
		justify-content: center;
		overflow: hidden;
	}
	/* Side-scroll stage: the inner is a fixed window; the stage is `scrollLength` widths
	   wide and pans horizontally (translateX) as the reader scrolls. Actors are positioned
	   along the track. Height: a compact window in the editor preview, the full viewport on
	   the pinned real page. */
	.zine-scene__inner.is-horizontal {
		position: relative;
		display: block;
		height: 20rem;
		overflow: hidden;
	}
	/* A free-sprite scene that ISN'T pinned (e.g. the editor's compact scrubbed mini-preview,
	   pinScenes=false) would collapse to 0 height with nothing in normal flow, hiding the
	   sprites. Give it a stage-sized window so the overlay (inset:0) has room. */
	.zine-scene__inner.has-free:not(.is-pinned):not(.is-horizontal) {
		position: relative;
		min-height: 16rem;
	}
	.zine-scene__inner.is-horizontal.is-pinned {
		/* Re-assert sticky here: this 3-class rule must win over `.is-horizontal`'s
		   `position: relative` above, or the stage scrolls away instead of pinning. */
		position: sticky;
		top: 0;
		height: 100vh;
		height: 100dvh;
	}
	.zine-stage {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		will-change: transform;
	}
	.zine-actor {
		position: absolute;
		top: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		width: min(34rem, 78vw);
	}
	.zine-actor :global(.zine-block) {
		max-width: 100%;
	}
	/* Free-sprite stage: a viewport-fixed layer over the pinned scene. `container-type: size`
	   makes a path's cqw/cqh resolve to this layer (≈ the viewport), so positions are stage %.
	   The layer ignores the pointer so it never blocks scrolling; sprites opt back in. */
	.zine-stage-overlay {
		position: absolute;
		inset: 0;
		z-index: 2;
		container-type: size;
		overflow: hidden;
		pointer-events: none;
	}
	.zine-free-actor {
		position: absolute;
		left: 0;
		top: 0;
		pointer-events: auto;
	}
	.zine-free-actor[data-track='background'] {
		z-index: 0;
		pointer-events: none;
	}
	.zine-free-actor[data-track='media'] {
		z-index: 1;
	}
	/* The block carries the path transform (inline, from the timeline). Its default — used when
	   there's no motion, e.g. reduced-motion — centres the sprite on the stage. `- 50%` offsets
	   by the sprite's own half-size so the waypoint is its CENTRE. */
	.zine-free-actor :global(.zine-block) {
		max-width: min(46cqw, 22rem);
		width: max-content;
		margin: 0;
		padding: 0;
		transform: translate(calc(50cqw - 50%), calc(50cqh - 50%));
		will-change: transform;
	}
	/* A text/emoji sprite (e.g. the platformer character) renders large so it reads as a
	   sprite, not body copy — without being a heading (it's a richText paragraph, so it stays
	   out of the document heading outline). */
	.zine-free-actor[data-block-type='richText'] :global(.zine-richtext) {
		font-size: clamp(2rem, 9cqw, 4rem);
		line-height: 1;
		text-align: center;
	}
	.zine-free-actor[data-block-type='richText'] :global(.zine-richtext p) {
		margin: 0;
	}
	.zine-free-actor :global(.zine-image),
	.zine-free-actor :global(.zine-image img) {
		max-height: 46cqh;
		max-width: none;
		width: max-content;
	}
	.zine-free-actor :global(.zine-image img) {
		width: clamp(2.6rem, 5.5cqw, 5.8rem);
		height: auto;
	}
	.zine-free-actor[data-track='background'] :global(.zine-block) {
		max-width: min(88cqw, 62rem);
	}
	.zine-free-actor[data-track='background'] :global(.zine-image img) {
		width: min(88cqw, 62rem);
		max-height: 72cqh;
		opacity: 0.86;
	}
	.zine-free-actor[data-track='background'] :global(.zine-image) {
		width: auto;
	}
	:global(.zine .zine-block) {
		max-width: var(--zine-measure);
		margin: 0 auto;
		padding: 0 1.25rem;
	}
	:global(.zine .zine-block[data-align='center']) {
		text-align: center;
	}
	:global(.zine .zine-block[data-align='right']) {
		text-align: right;
	}
	:global(.zine .zine-block[data-text-backdrop] > .zine-heading),
	:global(.zine .zine-block[data-text-backdrop] > .zine-richtext) {
		box-sizing: border-box;
		max-width: 100%;
		background: color-mix(
			in srgb,
			var(--zine-text-backdrop-color, var(--zine-bg)) var(--zine-text-backdrop-opacity, 72%),
			transparent
		);
		overflow-wrap: anywhere;
	}
	:global(.zine .zine-block[data-text-backdrop='box'] > .zine-heading),
	:global(.zine .zine-block[data-text-backdrop='box'] > .zine-richtext) {
		display: inline-block;
		border-radius: 0.45rem;
		padding: 0.32em 0.55em;
	}
	:global(.zine .zine-block[data-text-backdrop='circle'] > .zine-heading),
	:global(.zine .zine-block[data-text-backdrop='circle'] > .zine-richtext) {
		display: inline-grid;
		place-items: center;
		inline-size: min(18rem, 100%);
		aspect-ratio: 1;
		border-radius: 50%;
		padding: 1.35rem;
		text-align: center;
	}
	:global(.zine .zine-block[data-text-backdrop='circle'] > .zine-richtext) {
		inline-size: min(22rem, 100%);
	}
	:global(.zine .zine-block[data-text-backdrop] > .zine-richtext > :last-child) {
		margin-bottom: 0;
	}
	:global(.zine .zine-heading) {
		margin: 1.75rem 0 0.75rem;
		font-family: var(--zine-font-heading);
		font-weight: 700;
		line-height: 1.2;
		letter-spacing: -0.01em;
		color: var(--zine-heading, var(--zine-fg));
	}
	:global(.zine h2.zine-heading) {
		font-size: 1.9rem;
	}
	:global(.zine h3.zine-heading) {
		font-size: 1.45rem;
	}
	:global(.zine h4.zine-heading) {
		font-size: 1.2rem;
	}
	:global(.zine .zine-richtext) {
		font-size: 1.15rem;
	}
	:global(.zine .zine-richtext p) {
		margin: 0 0 1.1rem;
	}
	:global(.zine .zine-richtext h2),
	:global(.zine .zine-richtext h3),
	:global(.zine .zine-richtext h4) {
		margin: 1.35rem 0 0.65rem;
		font-family: var(--zine-font-heading);
		font-weight: 800;
		line-height: 1.18;
		color: var(--zine-heading, var(--zine-fg));
	}
	:global(.zine .zine-richtext h2) {
		font-size: 1.45em;
	}
	:global(.zine .zine-richtext h3) {
		font-size: 1.25em;
	}
	:global(.zine .zine-richtext h4) {
		font-size: 1.08em;
	}
	:global(.zine .zine-richtext li > p) {
		margin: 0;
	}
	:global(.zine .zine-richtext ul),
	:global(.zine .zine-richtext ol) {
		margin: 0 0 1.1rem;
		padding-left: 1.5rem;
	}
	:global(.zine .zine-richtext ul) {
		list-style: disc;
	}
	:global(.zine .zine-richtext ol) {
		list-style: decimal;
	}
	:global(.zine .zine-richtext li) {
		margin: 0.3rem 0;
	}
	:global(.zine .zine-richtext blockquote) {
		margin: 0 0 1.1rem;
		border: 2px solid color-mix(in oklch, var(--zine-accent), transparent 52%);
		border-radius: 0.35rem;
		background: transparent;
		padding: 0.85rem 1rem;
	}
	:global(.zine .zine-richtext blockquote p:last-child) {
		margin-bottom: 0;
	}
	:global(.zine .zine-richtext a),
	:global(.zine .zine-link) {
		color: var(--zine-accent);
		text-underline-offset: 0.18em;
	}
	:global(.zine .zine-image) {
		margin: 0;
	}
	:global(.zine .zine-image img) {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 0.5rem;
	}
	:global(.zine .zine-image figcaption) {
		margin-top: 0.5rem;
		font-family: var(--zine-font-body);
		font-size: 0.85rem;
		color: var(--zine-muted);
	}
	:global(.zine .zine-button) {
		display: inline-block;
		padding: 0.6rem 1.1rem;
		border-radius: 0.5rem;
		background: var(--zine-accent);
		color: #fff;
		font-family: var(--zine-font-body);
		font-weight: 600;
		text-decoration: none;
	}
	:global(.zine .zine-divider) {
		max-width: var(--zine-measure);
		margin: 2rem auto;
		border: 0;
		border-top: 1px solid var(--zine-muted);
		opacity: 0.35;
	}
	:global(.zine .zine-spacer[data-size='sm']) {
		height: 1rem;
	}
	:global(.zine .zine-spacer[data-size='md']) {
		height: 2.5rem;
	}
	:global(.zine .zine-spacer[data-size='lg']) {
		height: 5rem;
	}

	/* Reduced motion is a first-class, CSS-driven layout — so a reduced-motion reader gets the
	   flat, source-order page IMMEDIATELY (server-rendered), with no pinned/transformed layout
	   flashing before hydration corrects it. Mirrors the JS reduced-motion path (which the
	   renderer also applies), but without the SSR→hydration mismatch. `!important` overrides
	   the inline `min-height`/transform the motion path emits. */
	@media (prefers-reduced-motion: reduce) {
		.zine-scene {
			min-height: 0 !important;
		}
		.zine-scene__inner.is-pinned,
		.zine-scene__inner.is-horizontal,
		.zine-scene__inner.is-horizontal.is-pinned {
			position: static;
			min-height: 0;
			height: auto;
			display: block;
			overflow: visible;
		}
		.zine-stage,
		.zine-stage-overlay {
			position: static;
			width: auto;
			height: auto;
			transform: none !important;
			container-type: normal;
		}
		.zine-actor,
		.zine-free-actor {
			position: static;
		}
		.zine-free-actor :global(.zine-block) {
			transform: none !important;
		}
	}
</style>
