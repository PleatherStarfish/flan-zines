<script lang="ts">
	import { getBlock, getEffect } from '../registry';
	import {
		sceneScrollScreens,
		type Element,
		type Scene,
		type ZineDocument
	} from '../schema/document';
	import { themeVars, themeSwatchesRgb } from '../theme/registry';
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
	let {
		document,
		title,
		sceneProgress = {},
		drive = false,
		pinScenes = true
	}: {
		document: ZineDocument;
		title?: string;
		sceneProgress?: Record<string, number>;
		drive?: boolean;
		/** Size + pin timeline scenes to their scroll distance (the real page). The editor's
		 * compact scrubbed preview turns this OFF so the scene fits its little window. */
		pinScenes?: boolean;
	} = $props();

	const rootStyle = $derived(themeVars(document.theme));
	// The theme's swatch colours (RGB) handed to theme-aware canvas backgrounds so a
	// generative background paints with the student's palette.
	const themePalette = $derived(themeSwatchesRgb(document.theme));
	const rm = $derived($reducedMotion);

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

	function isPinned(scene: Scene): boolean {
		// Under reduced motion every scene lays out in normal source order (scene-timeline.md
		// §8) — no tall pinned region to scroll past, just a readable page. A canvas background
		// pins so it can be the full-screen backdrop the design calls for.
		return pinScenes && !rm && (scene.type !== 'page' || hasCanvasBackground(scene));
	}

	function sceneSectionStyle(scene: Scene): string | undefined {
		const parts: string[] = [];
		if (scene.background?.color) parts.push(`background:${scene.background.color}`);
		if (isPinned(scene)) {
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

<article class="zine" style={rootStyle} bind:this={rootEl}>
	{#if title}<h1 class="zine-title">{title}</h1>{/if}
	{#each document.acts as act (act.id)}
		<div class="zine-act" data-act={act.id}>
			{#each act.scenes as scene (scene.id)}
				{@const progress = progressFor(scene.id)}
				{@const horizontal = isHorizontal(scene)}
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
							{themePalette}
						/>
					{/if}
					<div
						class="zine-scene__inner"
						class:is-pinned={isPinned(scene)}
						class:is-horizontal={horizontal}
					>
						{#if horizontal}
							<div class="zine-stage" style={stageStyle(scene, progress)}>
								{#each scene.elements as element (element.id)}
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
							{#each scene.elements as element (element.id)}
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
</style>
