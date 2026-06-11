<script lang="ts">
	import { getBlock, getEffect } from '../registry';
	import {
		sceneScrollScreens,
		type Element,
		type PinRegion,
		type Scene,
		type ZineDocument
	} from '../schema/document';
	import type { SpeechFrameTail } from '../schema/theme';
	import { themeVars, themeSwatchesRgb, resolveThemeColors } from '../theme/registry';
	import { reducedMotion } from '$lib/a11y/reduced-motion';
	import BlockFrame from './BlockFrame.svelte';
	import SceneBackground from './SceneBackground.svelte';
	import Backdrop from './Backdrop.svelte';
	import { composeElementStyle, type EffectImplMap } from './timeline';
	import { pinNudgeStyle, pinRegion } from './pinned';
	import { textKindForElement } from './typeset';
	import { backdropPlan, gapScreens, type Pacing } from './transitions';

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

	// Narrow viewports collapse timeline scenes to readable stacked flow (the Pudding "stack it"
	// fallback): absolute/sticky anchoring would overlap on a phone. CSS below applies this at
	// first paint; JS mirrors it after hydration so stage actors move into source-order DOM. Short
	// desktop windows are handled by the measured fit pass below, not a blanket media query, so
	// side-scrollers can remain side-scrollers when their readable content fits.
	let narrow = $state(false);
	$effect(() => {
		if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
		const narrowMql = window.matchMedia('(max-width: 700px)');
		const update = () => (narrow = narrowMql.matches);
		update();
		narrowMql.addEventListener('change', update);
		return () => narrowMql.removeEventListener('change', update);
	});
	// Text/content must never depend on fitting inside a viewport-locked sticky box. After
	// hydration, measure each pin-candidate scene's source-order actor stack against the real
	// visible viewport height (Pudding perf §3: JS-measured fit → px from innerHeight). Over-tall
	// scenes fall back to source-order flow instead of nested scrolling or clipping.
	let layoutOverflowSceneIds = $state<Set<string>>(new Set());

	// Scene continuity (transitions.ts): the document `pacing` preset drives the crossfading
	// backdrop + the breathing-room gap between scenes.
	//
	// IMPORTANT — the crossfading backdrop is a progressive ENHANCEMENT of the driven, full-page
	// reader, NOT the source of truth for backgrounds. SSR / no-JS / reduced motion / scrubbed or
	// framed previews keep PER-SCENE in-section backgrounds (the readable baseline), so a
	// background never depends on JS to appear. `mounted` only flips true on the client after
	// hydration, so SSR and the first hydration render match (no mismatch); then we enhance to the
	// single fixed crossfade layer. (Fixes the earlier bug where backgrounds vanished because a
	// z-index:-1 fixed layer was painted behind the article's own opaque background.)
	const pacing = $derived<Pacing>((document.pacing ?? 'cozy') as Pacing);
	const allScenes = $derived(document.acts.flatMap((act) => act.scenes));
	const sceneById = $derived(new Map(allScenes.map((scene) => [scene.id, scene])));
	let mounted = $state(false);
	$effect(() => {
		mounted = true;
	});
	const enhanced = $derived(mounted && !rm && drive && pinScenes && !framedViewport);
	// Per-scene backdrop opacity (the crossfade), filled by the driven measure below. Falls back
	// so the first hydration frame still shows a coherent first scene before the measure runs.
	let backdropOpacity = $state<Record<string, number>>({});
	const resolvedBackdropOpacity = $derived.by(() => {
		if (Object.keys(backdropOpacity).length) return backdropOpacity;
		const out: Record<string, number> = {};
		allScenes.forEach((scene, i) => {
			out[scene.id] = sceneProgress[scene.id] != null || i === 0 ? 1 : 0;
		});
		return out;
	});
	const backdropProgressFor = (id: string): number => progressFor(id) ?? 0;
	const gapStyle = $derived(`--zine-gap:${(gapScreens(pacing) * 100).toFixed(1)}svh`);

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
			const rects: { id: string; top: number; bottom: number }[] = [];
			for (const el of root.querySelectorAll<HTMLElement>('[data-scene-id]')) {
				const id = el.dataset.sceneId;
				if (!id) continue;
				const rect = el.getBoundingClientRect();
				const total = rect.height + vh;
				next[id] = total > 0 ? Math.max(0, Math.min(1, (vh - rect.top) / total)) : 0;
				rects.push({ id, top: rect.top, bottom: rect.bottom });
			}
			driven = next;
			// Same single rAF-throttled measure also drives the backdrop crossfade (no extra
			// scroll listener — Pudding §6).
			backdropOpacity = Object.fromEntries(
				backdropPlan(rects, vh, pacing).map((slot) => [slot.id, slot.opacity])
			);
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

	$effect(() => {
		if (typeof window === 'undefined') return;
		const root = rootEl;
		if (!root) return;
		let frame = 0;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const fitBlocksFor = (section: HTMLElement, scene: Scene): HTMLElement[] => {
			const selector =
				scene.scrollAxis === 'horizontal'
					? [
							'.zine-flow-actor[data-track="content"] > .zine-block',
							'.zine-actor[data-track="content"] > .zine-block',
							'.zine-free-actor[data-track="content"] > .zine-block',
							'.zine-pinned-actor[data-track="content"] > .zine-block'
						].join(',')
					: [
							'.zine-flow-actor > .zine-block',
							'.zine-actor > .zine-block',
							'.zine-free-actor > .zine-block',
							'.zine-pinned-actor > .zine-block'
						].join(',');
			return [...section.querySelectorAll<HTMLElement>(selector)].filter(
				(block) => block.getBoundingClientRect().height > 0
			);
		};
		const measureSceneFit = () => {
			frame = 0;
			const viewportHeight = framedViewport
				? root.getBoundingClientRect().height
				: window.innerHeight || 1;
			if (viewportHeight <= 0) return;
			const next = new Set<string>();
			for (const section of root.querySelectorAll<HTMLElement>('[data-pin-candidate]')) {
				const id = section.dataset.sceneId;
				if (!id) continue;
				const scene = sceneById.get(id);
				if (!scene) continue;
				const actorBlocks = fitBlocksFor(section, scene);
				if (!actorBlocks.length) continue;
				const stackHeight = actorBlocks.reduce(
					(total, block) => total + block.getBoundingClientRect().height,
					Math.max(0, actorBlocks.length - 1) * 16
				);
				if (stackHeight > viewportHeight * 0.88) next.add(id);
			}
			layoutOverflowSceneIds = next;
		};
		const scheduleSoon = () => {
			if (!frame) frame = requestAnimationFrame(measureSceneFit);
		};
		const scheduleResize = () => {
			if (timer) clearTimeout(timer);
			timer = setTimeout(scheduleSoon, 150);
		};
		scheduleSoon();
		window.addEventListener('resize', scheduleResize, { passive: true });
		root.addEventListener('load', scheduleResize, { capture: true });
		const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleResize);
		ro?.observe(root);
		void globalThis.document?.fonts?.ready?.then(scheduleResize);
		return () => {
			if (frame) cancelAnimationFrame(frame);
			if (timer) clearTimeout(timer);
			window.removeEventListener('resize', scheduleResize);
			root.removeEventListener('load', scheduleResize, { capture: true });
			ro?.disconnect();
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

	function hasStagePlacement(scene: Scene): boolean {
		return scene.elements.some(
			(element) => element.placement === 'free' || element.placement === 'pinned'
		);
	}

	function isPinCandidate(scene: Scene): boolean {
		return (
			pinScenes &&
			!rm &&
			(scene.type !== 'page' || hasCanvasBackground(scene) || hasStagePlacement(scene))
		);
	}

	function isStackedScene(scene: Scene): boolean {
		return rm || (!framedViewport && narrow) || layoutOverflowSceneIds.has(scene.id);
	}

	// Stage elements float over the scene in the viewport-fixed overlay: `free` = a path-driven
	// sprite; `pinned` = content anchored to a screen region. Under reduced motion, narrow/short
	// viewports, or a measured over-tall scene, everything falls back to normal in-flow
	// source order (fully readable, no overlay).
	function isBackgroundStageElement(element: Element): boolean {
		return element.track === 'background';
	}
	function freeElementsFor(scene: Scene, plane: 'background' | 'foreground'): Element[] {
		return isStackedScene(scene)
			? []
			: scene.elements.filter(
					(element) =>
						element.placement === 'free' &&
						(plane === 'background'
							? isBackgroundStageElement(element)
							: !isBackgroundStageElement(element))
				);
	}
	function pinnedElementsFor(scene: Scene, plane: 'background' | 'foreground'): Element[] {
		return isStackedScene(scene)
			? []
			: scene.elements.filter(
					(element) =>
						element.placement === 'pinned' &&
						(plane === 'background'
							? isBackgroundStageElement(element)
							: !isBackgroundStageElement(element))
				);
	}
	function flowElementsFor(scene: Scene): Element[] {
		if (isStackedScene(scene)) return scene.elements; // readable source order
		return scene.elements.filter((element) => {
			if (element.placement === 'free') return false; // free → stage
			if (element.placement === 'pinned') return false; // pinned → stage unless stacked
			return true;
		});
	}
	function isPinned(scene: Scene): boolean {
		// Stacked scenes lay out in normal source order (scene-timeline.md §8) — no tall pinned
		// region to scroll past, just a readable page. A canvas background or stage elements
		// (free sprites / pinned actors) otherwise pin so they get a full-screen stage to play over.
		return isPinCandidate(scene) && !isStackedScene(scene);
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
			// When the continuous backdrop is on it paints the scene colour (crossfading) — the
			// section MUST stay transparent or it would cover the fixed backdrop behind it. We
			// still derive light text for a dark scene so content over the backdrop stays legible.
			if (!enhanced) parts.push(`background:${scene.background.color}`);
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
		return !isStackedScene(scene) && scene.scrollAxis === 'horizontal';
	}

	function stageStyle(scene: Scene, progress: number | undefined): string {
		const screens = sceneScrollScreens(scene);
		const shift = screens > 1 ? ((progress ?? 0) * (screens - 1)) / screens : 0;
		return `width:${screens * 100}%;transform:translateX(${(-shift * 100).toFixed(3)}%)`;
	}

	function elementZIndex(scene: Scene, element: Element): number {
		const index = scene.elements.findIndex((candidate) => candidate.id === element.id);
		return scene.elements.length - (index < 0 ? scene.elements.length - 1 : index);
	}

	function actorStyle(scene: Scene, element: Element): string {
		return `left:${(element.range.start * 100).toFixed(2)}%;z-index:${elementZIndex(scene, element)}`;
	}

	function flowActorStyle(scene: Scene, element: Element): string {
		return `z-index:${elementZIndex(scene, element)}`;
	}

	// A pinned actor's WRAPPER style: stacking + the optional nudge (a `translate` longhand that
	// composes with the region's centring transform). Its region comes from `data-region`; the
	// block child carries the effect transform/opacity. Never goes through actorStyle()/track
	// positioning, so its `range` always means an enter/exit window (even in horizontal scenes).
	function pinnedActorStyle(scene: Scene, element: Element): string {
		const z = `z-index:${elementZIndex(scene, element)}`;
		const nudge = pinNudgeStyle(element.anchor);
		return nudge ? `${z};${nudge}` : z;
	}

	const REGION_POINTS: Record<PinRegion, [number, number]> = {
		'top-left': [0.12, 0.12],
		top: [0.5, 0.12],
		'top-right': [0.88, 0.12],
		left: [0.12, 0.5],
		center: [0.5, 0.5],
		right: [0.88, 0.5],
		'bottom-left': [0.12, 0.88],
		bottom: [0.5, 0.88],
		'bottom-right': [0.88, 0.88]
	};

	function clamp01(value: number): number {
		return Math.max(0, Math.min(1, value));
	}

	function pathPoint(element: Element, progress: number | undefined): [number, number] | null {
		if (element.motion?.type !== 'path') return null;
		const params = element.motion.params as { waypoints?: unknown[] } | undefined;
		const waypoints = (params?.waypoints ?? [])
			.map((point) => {
				const p = point as { at?: unknown; x?: unknown; y?: unknown };
				return typeof p.at === 'number' && typeof p.x === 'number' && typeof p.y === 'number'
					? { at: p.at, x: p.x, y: p.y }
					: null;
			})
			.filter((point): point is { at: number; x: number; y: number } => point != null)
			.sort((a, b) => a.at - b.at);
		if (!waypoints.length) return null;
		const rangeDuration = Math.max(0.0001, element.range.end - element.range.start);
		const phase = clamp01(
			((progress ?? element.range.start) - element.range.start) / rangeDuration
		);
		let previous = waypoints[0];
		for (const next of waypoints.slice(1)) {
			if (phase <= next.at) {
				const segment = Math.max(0.0001, next.at - previous.at);
				const local = clamp01((phase - previous.at) / segment);
				return [
					clamp01((previous.x + (next.x - previous.x) * local) / 100),
					clamp01((previous.y + (next.y - previous.y) * local) / 100)
				];
			}
			previous = next;
		}
		return [clamp01(previous.x / 100), clamp01(previous.y / 100)];
	}

	function elementPoint(
		scene: Scene,
		element: Element,
		progress: number | undefined
	): [number, number] {
		if (element.placement === 'pinned') {
			const [x, y] = REGION_POINTS[pinRegion(element.anchor)];
			return [
				clamp01(x + (element.anchor?.dx ?? 0) * 0.035),
				clamp01(y + (element.anchor?.dy ?? 0) * 0.035)
			];
		}
		const path = pathPoint(element, progress);
		if (path) return path;
		const index = Math.max(
			0,
			scene.elements.findIndex((candidate) => candidate.id === element.id)
		);
		const sourceY = clamp01((index + 1) / (scene.elements.length + 1));
		if (scene.scrollAxis === 'horizontal') return [clamp01(element.range.start), sourceY];
		return [0.5, sourceY];
	}

	function tailToward(from: [number, number], to: [number, number]): SpeechFrameTail {
		const dx = to[0] - from[0];
		const dy = to[1] - from[1];
		if (Math.abs(dx) > Math.abs(dy) * 1.25) return dx < 0 ? 'left' : 'right';
		if (dy < 0) {
			if (dx < -0.18) return 'top-left';
			if (dx > 0.18) return 'top-right';
			return 'top';
		}
		if (dx < -0.18) return 'bottom-left';
		if (dx > 0.18) return 'bottom-right';
		return 'bottom';
	}

	function fallbackSpeechTail(element: Element): SpeechFrameTail {
		const frame = element.block.style?.textFrame;
		if (frame?.kind !== 'speech') return 'none';
		if (frame.tail !== 'auto') return frame.tail;
		return frame.mode === 'thought' ? 'none' : 'bottom-left';
	}

	function speechTailFor(
		scene: Scene,
		element: Element,
		progress: number | undefined
	): SpeechFrameTail | undefined {
		const frame = element.block.style?.textFrame;
		if (frame?.kind !== 'speech') return undefined;
		if (!frame.speakerElementId) return fallbackSpeechTail(element);
		const target = scene.elements.find((candidate) => candidate.id === frame.speakerElementId);
		if (!target) return fallbackSpeechTail(element);
		return tailToward(
			elementPoint(scene, element, progress),
			elementPoint(scene, target, progress)
		);
	}
</script>

<article
	class="zine"
	class:has-backdrop={enhanced}
	lang="en"
	data-viewport={viewport}
	data-hydrated={mounted || undefined}
	style={`${rootStyle};${gapStyle}`}
	bind:this={rootEl}
>
	{#if enhanced}
		<Backdrop
			scenes={allScenes}
			opacities={resolvedBackdropOpacity}
			progressFor={backdropProgressFor}
			{themePalette}
			framed={framedViewport}
		/>
	{/if}
	{#if title}<h1 class="zine-title">{title}</h1>{/if}
	{#each document.acts as act (act.id)}
		<div class="zine-act" data-act={act.id}>
			{#each act.scenes as scene (scene.id)}
				{@const progress = progressFor(scene.id)}
				{@const stacked = isStackedScene(scene)}
				{@const horizontal = isHorizontal(scene)}
				{@const flowElements = flowElementsFor(scene)}
				{@const backgroundFreeElements = freeElementsFor(scene, 'background')}
				{@const backgroundPinnedElements = pinnedElementsFor(scene, 'background')}
				{@const foregroundFreeElements = freeElementsFor(scene, 'foreground')}
				{@const foregroundPinnedElements = pinnedElementsFor(scene, 'foreground')}
				<section
					class="zine-scene"
					data-type={scene.type}
					data-length={scene.length}
					data-axis={horizontal ? 'horizontal' : 'vertical'}
					data-scene-id={scene.id}
					data-pin-candidate={isPinCandidate(scene) || undefined}
					data-layout={stacked ? 'stacked' : 'timeline'}
					data-fit-collapse={layoutOverflowSceneIds.has(scene.id) || undefined}
					style={sceneSectionStyle(scene)}
				>
					{#if !enhanced && (scene.background?.fill || scene.background?.overlay)}
						<!-- Reduced motion: per-scene static background (no crossfade), in source order.
						     With motion on, the continuous <Backdrop> above renders this instead. -->
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
						class:has-free={backgroundFreeElements.length > 0 ||
							backgroundPinnedElements.length > 0 ||
							foregroundFreeElements.length > 0 ||
							foregroundPinnedElements.length > 0}
					>
						{#if horizontal}
							<div class="zine-stage" style={stageStyle(scene, progress)}>
								{#each flowElements as element (element.id)}
									{@const def = getBlock(element.block.type)}
									{@const timeline = composeElementStyle(element, progress, impls, {
										reducedMotion: stacked,
										axis: 'horizontal'
									})}
									{#if def}
										{@const Render = def.Render}
										<div
											class="zine-actor"
											data-track={element.track}
											style={actorStyle(scene, element)}
										>
											<BlockFrame
												blockId={element.id}
												blockType={element.block.type}
												blockProps={element.block.props}
												label={def.label}
												style={element.block.style}
												textKind={textKindForElement(element)}
												animation={element.legacyAnimation}
												timelineStyle={timeline.style || undefined}
												timelineActive={timeline.active}
												speechTail={speechTailFor(scene, element, progress)}
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
									reducedMotion: stacked
								})}
								{#if def}
									{@const Render = def.Render}
									<div
										class="zine-flow-actor"
										data-track={element.track}
										style={flowActorStyle(scene, element)}
									>
										<BlockFrame
											blockId={element.id}
											blockType={block.type}
											blockProps={block.props}
											label={def.label}
											style={block.style}
											textKind={textKindForElement(element)}
											animation={element.legacyAnimation}
											timelineStyle={timeline.style || undefined}
											timelineActive={timeline.active}
											speechTail={speechTailFor(scene, element, progress)}
										>
											<Render props={block.props} />
										</BlockFrame>
									</div>
								{/if}
							{/each}
						{/if}

						{#if backgroundFreeElements.length || backgroundPinnedElements.length}
							<!-- Backdrop layer plane: stage actors behind the story content. It is still a
							     sibling of the panning side-scroll stage, so pinned `range` keeps timeline
							     semantics instead of becoming horizontal track position. In CSS-first
							     stacked fallbacks it comes after the prose, preserving readability. -->
							<div class="zine-stage-overlay zine-stage-overlay--back">
								{#each backgroundFreeElements as element (element.id)}
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
											style={flowActorStyle(scene, element)}
										>
											<BlockFrame
												blockId={element.id}
												blockType={element.block.type}
												blockProps={element.block.props}
												label={def.label}
												style={element.block.style}
												textKind={textKindForElement(element)}
												animation={element.legacyAnimation}
												timelineStyle={timeline.style || undefined}
												timelineActive={timeline.active}
												speechTail={speechTailFor(scene, element, progress)}
											>
												<Render props={element.block.props} />
											</BlockFrame>
										</div>
									{/if}
								{/each}
								{#each backgroundPinnedElements as element (element.id)}
									{@const def = getBlock(element.block.type)}
									{@const timeline = composeElementStyle(element, progress, impls, {
										reducedMotion: rm
									})}
									{#if def}
										{@const Render = def.Render}
										<div
											class="zine-pinned-actor"
											data-track={element.track}
											data-block-type={element.block.type}
											data-region={pinRegion(element.anchor)}
											inert={timeline.hidden || undefined}
											aria-hidden={timeline.hidden || undefined}
											style={pinnedActorStyle(scene, element)}
										>
											<BlockFrame
												blockId={element.id}
												blockType={element.block.type}
												blockProps={element.block.props}
												label={def.label}
												style={element.block.style}
												textKind={textKindForElement(element)}
												animation={element.legacyAnimation}
												timelineStyle={timeline.style || undefined}
												timelineActive={timeline.active}
												speechTail={speechTailFor(scene, element, progress)}
											>
												<Render props={element.block.props} />
											</BlockFrame>
										</div>
									{/if}
								{/each}
							</div>
						{/if}

						{#if foregroundFreeElements.length || foregroundPinnedElements.length}
							<!-- Foreground stage plane: free sprites and pinned labels above the story. -->
							<div class="zine-stage-overlay zine-stage-overlay--front">
								{#each foregroundFreeElements as element (element.id)}
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
											style={flowActorStyle(scene, element)}
										>
											<BlockFrame
												blockId={element.id}
												blockType={element.block.type}
												blockProps={element.block.props}
												label={def.label}
												style={element.block.style}
												textKind={textKindForElement(element)}
												animation={element.legacyAnimation}
												timelineStyle={timeline.style || undefined}
												timelineActive={timeline.active}
												speechTail={speechTailFor(scene, element, progress)}
											>
												<Render props={element.block.props} />
											</BlockFrame>
										</div>
									{/if}
								{/each}
								{#each foregroundPinnedElements as element (element.id)}
									{@const def = getBlock(element.block.type)}
									<!-- Pinned actors compose with TIMELINE semantics (no axis), so `range` is
									     an enter/exit window even in horizontal scenes. -->
									{@const timeline = composeElementStyle(element, progress, impls, {
										reducedMotion: rm
									})}
									{#if def}
										{@const Render = def.Render}
										<div
											class="zine-pinned-actor"
											data-track={element.track}
											data-block-type={element.block.type}
											data-region={pinRegion(element.anchor)}
											inert={timeline.hidden || undefined}
											aria-hidden={timeline.hidden || undefined}
											style={pinnedActorStyle(scene, element)}
										>
											<BlockFrame
												blockId={element.id}
												blockType={element.block.type}
												blockProps={element.block.props}
												label={def.label}
												style={element.block.style}
												textKind={textKindForElement(element)}
												animation={element.legacyAnimation}
												timelineStyle={timeline.style || undefined}
												timelineActive={timeline.active}
												speechTail={speechTailFor(scene, element, progress)}
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
		--zine-gap: 0svh;
		/* A positioning context (relative) so the framed backdrop anchors here, AND a NEW stacking
		   context (isolation) so the z-index:-1 backdrop is scoped INSIDE this article — painted
		   above its own --zine-bg and below its content. Without the stacking context the fixed
		   z-index:-1 layer escapes to the root and is buried behind this opaque background. */
		position: relative;
		isolation: isolate;
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
		letter-spacing: 0;
		color: var(--zine-heading, var(--zine-fg));
	}
	.zine-scene {
		position: relative;
		/* Above the z-index:-1 continuous backdrop. */
		z-index: 0;
		padding: 1.5rem 0;
		color: var(--zine-fg);
	}
	/* Breathing room: with the crossfading backdrop on, insert a pacing-scaled gap of scroll
	   between scenes so one idea owns the screen and the backdrop has room to crossfade. The
	   first scene gets none. (Reduced motion removes the gap — see the media block below.) */
	.zine.has-backdrop .zine-scene {
		margin-top: var(--zine-gap, 0);
	}
	.zine.has-backdrop .zine-act:first-child .zine-scene:first-child {
		margin-top: 0;
	}
	/* Content sits above the background layer (SceneBackground is z-index 0). */
	.zine-scene__inner {
		position: relative;
		z-index: 1;
		isolation: isolate;
	}
	.zine-flow-actor {
		position: relative;
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
		z-index: 10;
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
		container-type: size;
		overflow: hidden;
		pointer-events: none;
	}
	.zine-stage-overlay--back {
		z-index: 0;
	}
	.zine-stage-overlay--front {
		z-index: 1000;
	}
	.zine-free-actor {
		position: absolute;
		left: 0;
		top: 0;
		pointer-events: auto;
	}
	.zine-free-actor[data-track='background'] {
		pointer-events: none;
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
	.zine-free-actor[data-block-type='richText']
		:global(.zine-block[data-text-frame] .zine-richtext) {
		font-size: 1rem;
		line-height: 1.25;
		text-align: inherit;
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
	/* Pinned actors: anchored to a screen region in the stage overlay (ordinary absolute
	   positioning, NOT CSS Anchor Positioning). The wrapper does region + nudge (the nudge is an
	   inline `translate` longhand that composes with the centring transform); the block child
	   carries the effect transform. Side-specific safe-area gutters; a size guard so content can't
	   spill past the screen (the editor refuses over-long pinned actors — no inner scroll). */
	.zine-pinned-actor {
		position: absolute;
		z-index: 1;
		--pin-g: clamp(0.9rem, 4vw, 2.5rem);
		display: flex;
		flex-direction: column;
		max-inline-size: min(34rem, calc(100% - 2 * var(--pin-g)));
		max-block-size: calc(100svh - 2 * var(--pin-g));
		overflow: hidden;
		pointer-events: auto;
	}
	.zine-pinned-actor[data-track='background'] {
		pointer-events: none;
		max-inline-size: min(88cqw, 62rem);
		opacity: 0.86;
	}
	.zine-pinned-actor :global(.zine-block) {
		max-width: 100%;
		margin: 0;
		padding: 0;
	}
	.zine-pinned-actor[data-track='background'] :global(.zine-image) {
		width: auto;
	}
	.zine-pinned-actor[data-track='background'] :global(.zine-image img) {
		width: min(88cqw, 62rem);
		max-height: 72cqh;
		object-fit: contain;
	}
	.zine-pinned-actor[data-region='top-left'] {
		top: calc(var(--pin-g) + env(safe-area-inset-top, 0px));
		left: calc(var(--pin-g) + env(safe-area-inset-left, 0px));
	}
	.zine-pinned-actor[data-region='top'] {
		top: calc(var(--pin-g) + env(safe-area-inset-top, 0px));
		left: 50%;
		transform: translateX(-50%);
	}
	.zine-pinned-actor[data-region='top-right'] {
		top: calc(var(--pin-g) + env(safe-area-inset-top, 0px));
		right: calc(var(--pin-g) + env(safe-area-inset-right, 0px));
	}
	.zine-pinned-actor[data-region='left'] {
		top: 50%;
		left: calc(var(--pin-g) + env(safe-area-inset-left, 0px));
		transform: translateY(-50%);
	}
	.zine-pinned-actor[data-region='center'] {
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}
	.zine-pinned-actor[data-region='right'] {
		top: 50%;
		right: calc(var(--pin-g) + env(safe-area-inset-right, 0px));
		transform: translateY(-50%);
	}
	.zine-pinned-actor[data-region='bottom-left'] {
		bottom: calc(var(--pin-g) + env(safe-area-inset-bottom, 0px));
		left: calc(var(--pin-g) + env(safe-area-inset-left, 0px));
	}
	.zine-pinned-actor[data-region='bottom'] {
		bottom: calc(var(--pin-g) + env(safe-area-inset-bottom, 0px));
		left: 50%;
		transform: translateX(-50%);
	}
	.zine-pinned-actor[data-region='bottom-right'] {
		bottom: calc(var(--pin-g) + env(safe-area-inset-bottom, 0px));
		right: calc(var(--pin-g) + env(safe-area-inset-right, 0px));
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
	/* Justified is only emitted by resolveTypeset() on a medium/wide measure (narrow → left). */
	:global(.zine .zine-block[data-align='justify']) {
		text-align: justify;
		hyphens: auto;
	}
	/* Editorial typeset — data-attrs / custom props set by BlockFrame from resolveTypeset()
	   (bounded values only). Measure caps line length; leading is role-floored. */
	:global(.zine .zine-block[data-typeset]) {
		line-height: var(--zine-ts-leading, inherit);
	}
	:global(.zine .zine-block[data-typeset]:not([data-text-kind='content'])) {
		max-width: var(--zine-ts-measure, var(--zine-measure));
	}
	/* Content text shares a common left rail. Individual roles still keep their readable
	   measure on the inner heading/prose, but the outer block no longer recentres every
	   role independently. This keeps article headings, subheads, body copy, and quotes aligned. */
	:global(.zine .zine-block[data-text-kind='content']) {
		max-width: var(--zine-measure);
	}
	:global(.zine .zine-block[data-text-kind='content'] > .zine-heading),
	:global(.zine .zine-block[data-text-kind='content'] > .zine-richtext) {
		max-width: var(--zine-ts-measure, 100%);
		margin-inline: 0 auto;
	}
	:global(.zine .zine-block[data-text-kind='content'][data-align='center'] > .zine-heading),
	:global(.zine .zine-block[data-text-kind='content'][data-align='center'] > .zine-richtext) {
		margin-inline: auto;
	}
	:global(.zine .zine-block[data-text-kind='content'][data-align='right'] > .zine-heading),
	:global(.zine .zine-block[data-text-kind='content'][data-align='right'] > .zine-richtext) {
		margin-inline: auto 0;
	}
	:global(.zine .zine-block[data-text-case='upper']) {
		text-transform: uppercase;
	}
	:global(.zine .zine-block[data-text-case='smallcaps']) {
		font-variant-caps: small-caps;
	}
	/* "Tidy line breaks": balance (display) / pretty (body). Progressive — falls back to normal
	   wrapping where unsupported; `pretty` improves the rag/orphans (it does not remove widows). */
	:global(.zine .zine-block[data-tidy='balance']) {
		text-wrap: balance;
	}
	:global(.zine .zine-block[data-tidy='pretty']) {
		text-wrap: pretty;
	}
	/* Roles size/colour the text CONTENT so the richText/heading defaults don't override them.
	   "Headline" is visual only — it never changes the block's heading level (h1/h2+ invariant). */
	:global(.zine .zine-block[data-typeset-role='headline'] .zine-heading),
	:global(.zine .zine-block[data-typeset-role='headline'] .zine-richtext) {
		font-family: var(--zine-font-heading);
		font-weight: 800;
		font-size: clamp(1.9rem, 4.5vw, 3rem);
		color: var(--zine-heading, var(--zine-fg));
	}
	:global(.zine .zine-block[data-typeset-role='subhead'] .zine-heading),
	:global(.zine .zine-block[data-typeset-role='subhead'] .zine-richtext) {
		font-family: var(--zine-font-heading);
		font-weight: 800;
		font-size: clamp(1.28rem, 2.1vw, 1.72rem);
		color: var(--zine-heading, var(--zine-fg));
	}
	:global(.zine .zine-block[data-typeset-role='kicker'] .zine-heading),
	:global(.zine .zine-block[data-typeset-role='kicker'] .zine-richtext) {
		font-family: var(--zine-font-body);
		font-weight: 800;
		font-size: 0.82rem;
		letter-spacing: 0.12em;
		color: var(--zine-accent);
	}
	:global(.zine .zine-block[data-typeset-role='deck'] .zine-heading),
	:global(.zine .zine-block[data-typeset-role='deck'] .zine-richtext) {
		font-weight: 500;
		font-size: 1.25rem;
		color: var(--zine-muted);
	}
	:global(.zine .zine-block[data-typeset-role='pullquote']) {
		border-left: 4px solid var(--zine-accent);
		padding-left: 0.8em;
	}
	:global(.zine .zine-block[data-typeset-role='pullquote'] .zine-richtext),
	:global(.zine .zine-block[data-typeset-role='pullquote'] .zine-richtext p) {
		font-family: var(--zine-font-heading);
		font-weight: 700;
		font-size: clamp(1.4rem, 3vw, 2rem);
		color: var(--zine-heading, var(--zine-fg));
	}
	/* Manual hanging opening quote — `hanging-punctuation` isn't reliable on the fleet. */
	:global(.zine .zine-block[data-typeset-role='pullquote'] .zine-richtext p:first-child) {
		text-indent: -0.5ch;
	}
	:global(.zine .zine-block[data-typeset-role='blockquote']) {
		border-left: 3px solid color-mix(in oklch, var(--zine-accent), transparent 55%);
		padding-left: 0.9em;
	}
	:global(.zine .zine-block[data-typeset-role='blockquote'] .zine-richtext) {
		color: var(--zine-muted);
	}
	:global(.zine .zine-block[data-typeset-role='caption'] .zine-richtext),
	:global(.zine .zine-block[data-typeset-role='caption'] .zine-richtext p) {
		font-size: 0.85rem;
		color: var(--zine-muted);
	}
	:global(.zine .zine-block[data-typeset-role='byline'] .zine-richtext),
	:global(.zine .zine-block[data-typeset-role='byline'] .zine-richtext p) {
		font-size: 0.8rem;
		letter-spacing: 0.08em;
		color: var(--zine-muted);
	}
	:global(.zine .zine-block[data-text-color] > .zine-heading),
	:global(.zine .zine-block[data-text-color] > .zine-richtext),
	:global(.zine .zine-block[data-text-color] > .zine-text-frame-body > .zine-heading),
	:global(.zine .zine-block[data-text-color] > .zine-text-frame-body > .zine-richtext),
	:global(.zine .zine-block[data-text-color] > .zine-richtext h2),
	:global(.zine .zine-block[data-text-color] > .zine-richtext h3),
	:global(.zine .zine-block[data-text-color] > .zine-richtext h4),
	:global(.zine .zine-block[data-text-color] > .zine-text-frame-body > .zine-richtext h2),
	:global(.zine .zine-block[data-text-color] > .zine-text-frame-body > .zine-richtext h3),
	:global(.zine .zine-block[data-text-color] > .zine-text-frame-body > .zine-richtext h4) {
		color: var(--zine-text-color);
	}
	:global(.zine .zine-block[data-text-backdrop] > .zine-heading),
	:global(.zine .zine-block[data-text-backdrop] > .zine-richtext) {
		--zine-text-backdrop-pad-y: calc(0.1em + var(--zine-text-backdrop-padding, 1) * 0.34em);
		--zine-text-backdrop-pad-x: calc(0.16em + var(--zine-text-backdrop-padding, 1) * 0.62em);
		--zine-text-backdrop-circle-pad: calc(0.45rem + var(--zine-text-backdrop-padding, 1) * 1.05rem);
		--zine-text-backdrop-circle-size: min(
			calc(12rem + var(--zine-text-backdrop-padding, 1) * 5.5rem),
			100%
		);
		box-sizing: border-box;
		max-width: 100%;
		overflow-wrap: anywhere;
	}
	:global(.zine .zine-block[data-text-backdrop='box'] > .zine-heading),
	:global(.zine .zine-block[data-text-backdrop='box'] > .zine-richtext) {
		display: inline-block;
		border-radius: 0.45rem;
		background: color-mix(
			in srgb,
			var(--zine-text-backdrop-color, var(--zine-bg)) var(--zine-text-backdrop-opacity, 72%),
			transparent
		);
		padding: var(--zine-text-backdrop-pad-y) var(--zine-text-backdrop-pad-x);
	}
	:global(.zine .zine-block[data-text-backdrop='circle']) {
		--zine-text-backdrop-circle-pad: calc(0.45rem + var(--zine-text-backdrop-padding, 1) * 1.05rem);
		--zine-text-backdrop-circle-size: min(
			calc(14rem + var(--zine-text-backdrop-padding, 1) * 5.5rem),
			100%
		);
		display: block;
		inline-size: var(--zine-text-backdrop-circle-size);
		max-inline-size: 100%;
		aspect-ratio: 1;
		margin-inline: auto;
		border-radius: 50%;
		background: color-mix(
			in srgb,
			var(--zine-text-backdrop-color, var(--zine-bg)) var(--zine-text-backdrop-opacity, 72%),
			transparent
		);
		padding: var(--zine-text-backdrop-circle-pad);
		text-align: center;
		overflow: hidden;
	}
	:global(.zine .zine-block[data-text-backdrop='circle'] > .zine-heading),
	:global(.zine .zine-block[data-text-backdrop='circle'] > .zine-richtext) {
		margin-block: 0;
	}
	/* Circle backdrops get a circle-shaped text measure too. The guides are empty spans
	   emitted by BlockFrame only for circle mode; `shape-outside` degrades to a rectangular
	   readable measure if a browser does not support it. */
	:global(.zine .zine-block[data-text-backdrop='circle'] > .zine-circle-shape) {
		width: 50%;
		height: 100%;
		shape-margin: 0.18rem;
	}
	:global(.zine .zine-block[data-text-backdrop='circle'] > .zine-circle-shape--left) {
		float: left;
		shape-outside: polygon(
			0 0,
			100% 0,
			63% 6%,
			36% 16%,
			16% 31%,
			0 50%,
			16% 69%,
			36% 84%,
			63% 94%,
			100% 100%,
			0 100%
		);
	}
	:global(.zine .zine-block[data-text-backdrop='circle'] > .zine-circle-shape--right) {
		float: right;
		shape-outside: polygon(
			0 0,
			100% 0,
			100% 100%,
			0 100%,
			37% 94%,
			64% 84%,
			84% 69%,
			100% 50%,
			84% 31%,
			64% 16%,
			37% 6%
		);
	}
	:global(.zine .zine-block[data-text-backdrop] > .zine-richtext > :last-child) {
		margin-bottom: 0;
	}
	:global(.zine .zine-block[data-text-frame]) {
		--zine-frame-stroke: var(--zine-heading, var(--zine-fg));
		--zine-frame-bg: var(--zine-bg);
		display: flex;
		align-items: flex-end;
		gap: 0.55rem;
		inline-size: fit-content;
		max-inline-size: min(var(--zine-measure), calc(100% - 2.5rem));
		overflow: visible;
		text-align: left;
	}
	:global(.zine .zine-block[data-text-frame][data-frame-fill='paper']) {
		--zine-frame-bg: var(--zine-bg);
	}
	:global(.zine .zine-block[data-text-frame][data-frame-fill='theme']) {
		--zine-frame-bg: color-mix(in oklch, var(--zine-muted), var(--zine-bg) 84%);
	}
	:global(.zine .zine-block[data-text-frame][data-frame-fill='accent']) {
		--zine-frame-bg: color-mix(in oklch, var(--zine-accent), var(--zine-bg) 76%);
	}
	:global(
		.zine .zine-block[data-text-frame='sms'][data-frame-fill='message'][data-frame-side='incoming']
	) {
		--zine-frame-bg: oklch(0.92 0.006 255);
		--zine-frame-fg: oklch(0.22 0.024 260);
	}
	:global(
		.zine .zine-block[data-text-frame='sms'][data-frame-fill='message'][data-frame-side='outgoing']
	) {
		--zine-frame-bg: oklch(0.58 0.215 255);
		--zine-frame-fg: oklch(0.99 0.004 255);
	}
	:global(.zine .zine-block[data-text-frame][data-frame-fill='custom']) {
		--zine-frame-bg: var(--zine-text-frame-color, var(--zine-bg));
	}
	:global(.zine .zine-block[data-text-frame] > .zine-text-frame-body) {
		position: relative;
		box-sizing: border-box;
		max-inline-size: min(30rem, 100%);
		border: 2px solid var(--zine-frame-stroke);
		background: var(--zine-frame-bg);
		color: var(--zine-text-color, var(--zine-frame-fg, var(--zine-fg)));
		padding-block: calc(0.42rem + var(--zine-text-frame-padding, 1) * 0.28rem);
		padding-inline: calc(0.55rem + var(--zine-text-frame-padding, 1) * 0.42rem);
		overflow: visible;
		overflow-wrap: anywhere;
	}
	:global(.zine .zine-block[data-text-frame] > .zine-text-frame-body > :not(.zine-rough-frame)) {
		position: relative;
		z-index: 1;
	}
	:global(.zine .zine-block[data-text-frame] .zine-richtext),
	:global(.zine .zine-block[data-text-frame] .zine-heading) {
		margin-block: 0;
		max-inline-size: 100%;
	}
	:global(.zine .zine-block[data-text-frame] .zine-richtext p:last-child),
	:global(.zine .zine-block[data-text-frame] .zine-richtext ul:last-child),
	:global(.zine .zine-block[data-text-frame] .zine-richtext ol:last-child) {
		margin-bottom: 0;
	}
	:global(.zine .zine-block[data-text-frame='speech'] > .zine-text-frame-body) {
		border-radius: 1.05rem;
	}
	:global(
		.zine .zine-block[data-text-frame='speech'][data-frame-mode='thought'] > .zine-text-frame-body
	) {
		border-radius: 999px;
		padding-inline: calc(0.75rem + var(--zine-text-frame-padding, 1) * 0.58rem);
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-mode='speech']:not([data-frame-tail='none'])
			> .zine-text-frame-body::after
	) {
		position: absolute;
		z-index: 0;
		width: 1.05rem;
		height: 1.05rem;
		background: var(--zine-frame-bg);
		content: '';
		rotate: 45deg;
	}
	:global(
		.zine .zine-block[data-text-frame='speech'][data-frame-outline='sketch'] > .zine-text-frame-body
	) {
		border-color: transparent;
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-outline='sketch']
			> .zine-text-frame-body::before
	),
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-outline='sketch']
			> .zine-text-frame-body::after
	) {
		display: none;
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-tail='bottom-left']
			> .zine-text-frame-body::after
	) {
		bottom: -0.45rem;
		left: 1.3rem;
		border-right: 2px solid var(--zine-frame-stroke);
		border-bottom: 2px solid var(--zine-frame-stroke);
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-tail='bottom-right']
			> .zine-text-frame-body::after
	) {
		right: 1.3rem;
		bottom: -0.45rem;
		border-right: 2px solid var(--zine-frame-stroke);
		border-bottom: 2px solid var(--zine-frame-stroke);
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-tail='top-left']
			> .zine-text-frame-body::after
	) {
		top: -0.45rem;
		left: 1.3rem;
		border-top: 2px solid var(--zine-frame-stroke);
		border-left: 2px solid var(--zine-frame-stroke);
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-tail='top-right']
			> .zine-text-frame-body::after
	) {
		top: -0.45rem;
		right: 1.3rem;
		border-top: 2px solid var(--zine-frame-stroke);
		border-left: 2px solid var(--zine-frame-stroke);
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-tail='top']
			> .zine-text-frame-body::after
	) {
		top: -0.45rem;
		left: calc(50% - 0.52rem);
		border-top: 2px solid var(--zine-frame-stroke);
		border-left: 2px solid var(--zine-frame-stroke);
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-tail='right']
			> .zine-text-frame-body::after
	) {
		top: calc(50% - 0.52rem);
		right: -0.45rem;
		border-top: 2px solid var(--zine-frame-stroke);
		border-right: 2px solid var(--zine-frame-stroke);
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-tail='bottom']
			> .zine-text-frame-body::after
	) {
		bottom: -0.45rem;
		left: calc(50% - 0.52rem);
		border-right: 2px solid var(--zine-frame-stroke);
		border-bottom: 2px solid var(--zine-frame-stroke);
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-tail='left']
			> .zine-text-frame-body::after
	) {
		top: calc(50% - 0.52rem);
		left: -0.45rem;
		border-bottom: 2px solid var(--zine-frame-stroke);
		border-left: 2px solid var(--zine-frame-stroke);
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-mode='thought']
			> .zine-text-frame-body::before
	),
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-mode='thought']
			> .zine-text-frame-body::after
	) {
		position: absolute;
		border: 2px solid var(--zine-frame-stroke);
		border-radius: 50%;
		background: var(--zine-frame-bg);
		content: '';
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-mode='thought']
			> .zine-text-frame-body::before
	) {
		bottom: -0.65rem;
		left: 1.65rem;
		width: 0.72rem;
		height: 0.72rem;
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-mode='thought']
			> .zine-text-frame-body::after
	) {
		bottom: -1.15rem;
		left: 1.1rem;
		width: 0.42rem;
		height: 0.42rem;
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-mode='thought'][data-frame-tail='none']
			> .zine-text-frame-body::before
	),
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-mode='thought'][data-frame-tail='none']
			> .zine-text-frame-body::after
	) {
		display: none;
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-mode='thought'][data-frame-tail='top-left']
			> .zine-text-frame-body::before
	) {
		top: -0.5rem;
		bottom: auto;
		left: 1.4rem;
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-mode='thought'][data-frame-tail='top-left']
			> .zine-text-frame-body::after
	) {
		top: -0.9rem;
		bottom: auto;
		left: 0.75rem;
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-mode='thought'][data-frame-tail='top']
			> .zine-text-frame-body::before
	) {
		top: -0.5rem;
		bottom: auto;
		left: calc(50% - 0.36rem);
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-mode='thought'][data-frame-tail='top']
			> .zine-text-frame-body::after
	) {
		top: -0.95rem;
		bottom: auto;
		left: calc(50% - 0.21rem);
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-mode='thought'][data-frame-tail='top-right']
			> .zine-text-frame-body::before
	) {
		top: -0.5rem;
		right: 1.4rem;
		bottom: auto;
		left: auto;
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-mode='thought'][data-frame-tail='top-right']
			> .zine-text-frame-body::after
	) {
		top: -0.9rem;
		right: 0.75rem;
		bottom: auto;
		left: auto;
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-mode='thought'][data-frame-tail='right']
			> .zine-text-frame-body::before
	) {
		top: calc(50% - 0.36rem);
		right: -0.52rem;
		bottom: auto;
		left: auto;
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-mode='thought'][data-frame-tail='right']
			> .zine-text-frame-body::after
	) {
		top: calc(50% - 0.21rem);
		right: -0.98rem;
		bottom: auto;
		left: auto;
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-mode='thought'][data-frame-tail='bottom-right']
			> .zine-text-frame-body::before
	) {
		right: 1.55rem;
		left: auto;
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-mode='thought'][data-frame-tail='bottom-right']
			> .zine-text-frame-body::after
	) {
		right: 0.95rem;
		left: auto;
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-mode='thought'][data-frame-tail='bottom']
			> .zine-text-frame-body::before
	) {
		left: calc(50% - 0.36rem);
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-mode='thought'][data-frame-tail='bottom']
			> .zine-text-frame-body::after
	) {
		left: calc(50% - 0.21rem);
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-mode='thought'][data-frame-tail='left']
			> .zine-text-frame-body::before
	) {
		top: calc(50% - 0.36rem);
		bottom: auto;
		left: -0.52rem;
	}
	:global(
		.zine
			.zine-block[data-text-frame='speech'][data-frame-mode='thought'][data-frame-tail='left']
			> .zine-text-frame-body::after
	) {
		top: calc(50% - 0.21rem);
		bottom: auto;
		left: -0.98rem;
	}
	:global(.zine .zine-block[data-text-frame='sms']) {
		inline-size: min(32rem, calc(100% - 2.5rem));
		max-inline-size: min(32rem, calc(100% - 2.5rem));
		align-items: flex-end;
	}
	:global(.zine .zine-block[data-text-frame='sms'][data-frame-side='incoming']) {
		margin-inline: 0 auto;
		justify-content: flex-start;
	}
	:global(.zine .zine-block[data-text-frame='sms'][data-frame-side='outgoing']) {
		margin-inline: auto 0;
		justify-content: flex-end;
	}
	:global(
		.zine .zine-block[data-text-frame='sms'][data-frame-side='outgoing'] > .zine-text-frame-body
	) {
		background: var(--zine-frame-bg);
		color: var(--zine-text-color, var(--zine-frame-fg, var(--zine-fg)));
	}
	:global(.zine .zine-block[data-text-frame='sms'] > .zine-text-frame-body) {
		max-inline-size: min(24rem, 100%);
		border: 0;
		border-radius: 1.15rem;
		box-shadow: none;
		font-size: 0.98rem;
		line-height: 1.32;
		padding-block: calc(0.36rem + var(--zine-text-frame-padding, 0.8) * 0.18rem);
		padding-inline: calc(0.62rem + var(--zine-text-frame-padding, 0.8) * 0.28rem);
	}
	:global(
		.zine .zine-block[data-text-frame='sms'][data-frame-group='first'] > .zine-text-frame-body
	) {
		border-end-start-radius: 0.42rem;
	}
	:global(
		.zine .zine-block[data-text-frame='sms'][data-frame-group='middle'] > .zine-text-frame-body
	) {
		border-start-start-radius: 0.42rem;
		border-end-start-radius: 0.42rem;
	}
	:global(
		.zine .zine-block[data-text-frame='sms'][data-frame-group='last'] > .zine-text-frame-body
	) {
		border-start-start-radius: 0.42rem;
	}
	:global(
		.zine
			.zine-block[data-text-frame='sms'][data-frame-side='outgoing'][data-frame-group='first']
			> .zine-text-frame-body
	) {
		border-end-start-radius: 1.15rem;
		border-end-end-radius: 0.42rem;
	}
	:global(
		.zine
			.zine-block[data-text-frame='sms'][data-frame-side='outgoing'][data-frame-group='middle']
			> .zine-text-frame-body
	) {
		border-start-start-radius: 1.15rem;
		border-end-start-radius: 1.15rem;
		border-start-end-radius: 0.42rem;
		border-end-end-radius: 0.42rem;
	}
	:global(
		.zine
			.zine-block[data-text-frame='sms'][data-frame-side='outgoing'][data-frame-group='last']
			> .zine-text-frame-body
	) {
		border-start-start-radius: 1.15rem;
		border-start-end-radius: 0.42rem;
	}
	:global(
		.zine
			.zine-block[data-text-frame='sms'][data-frame-group='single']
			> .zine-text-frame-body::before
	),
	:global(
		.zine
			.zine-block[data-text-frame='sms'][data-frame-group='last']
			> .zine-text-frame-body::before
	),
	:global(
		.zine
			.zine-block[data-text-frame='sms'][data-frame-group='single']
			> .zine-text-frame-body::after
	),
	:global(
		.zine .zine-block[data-text-frame='sms'][data-frame-group='last'] > .zine-text-frame-body::after
	) {
		position: absolute;
		bottom: 0;
		content: '';
	}
	:global(
		.zine
			.zine-block[data-text-frame='sms'][data-frame-group='single']
			> .zine-text-frame-body::after
	),
	:global(
		.zine .zine-block[data-text-frame='sms'][data-frame-group='last'] > .zine-text-frame-body::after
	) {
		z-index: 0;
		width: 0.88rem;
		height: 0.88rem;
		background: var(--zine-frame-bg);
	}
	:global(
		.zine
			.zine-block[data-text-frame='sms'][data-frame-group='single']
			> .zine-text-frame-body::before
	),
	:global(
		.zine
			.zine-block[data-text-frame='sms'][data-frame-group='last']
			> .zine-text-frame-body::before
	) {
		z-index: 1;
		width: 0.72rem;
		height: 1rem;
		background: var(--zine-bg);
	}
	:global(
		.zine
			.zine-block[data-text-frame='sms'][data-frame-side='incoming'][data-frame-group='single']
			> .zine-text-frame-body::after
	),
	:global(
		.zine
			.zine-block[data-text-frame='sms'][data-frame-side='incoming'][data-frame-group='last']
			> .zine-text-frame-body::after
	) {
		left: -0.32rem;
		border-bottom-right-radius: 0.95rem;
	}
	:global(
		.zine
			.zine-block[data-text-frame='sms'][data-frame-side='incoming'][data-frame-group='single']
			> .zine-text-frame-body::before
	),
	:global(
		.zine
			.zine-block[data-text-frame='sms'][data-frame-side='incoming'][data-frame-group='last']
			> .zine-text-frame-body::before
	) {
		left: -0.78rem;
		border-bottom-right-radius: 0.86rem;
	}
	:global(
		.zine
			.zine-block[data-text-frame='sms'][data-frame-side='outgoing'][data-frame-group='single']
			> .zine-text-frame-body::after
	),
	:global(
		.zine
			.zine-block[data-text-frame='sms'][data-frame-side='outgoing'][data-frame-group='last']
			> .zine-text-frame-body::after
	) {
		right: -0.32rem;
		border-bottom-left-radius: 0.95rem;
	}
	:global(
		.zine
			.zine-block[data-text-frame='sms'][data-frame-side='outgoing'][data-frame-group='single']
			> .zine-text-frame-body::before
	),
	:global(
		.zine
			.zine-block[data-text-frame='sms'][data-frame-side='outgoing'][data-frame-group='last']
			> .zine-text-frame-body::before
	) {
		right: -0.78rem;
		border-bottom-left-radius: 0.86rem;
	}
	:global(.zine .zine-sms-avatar) {
		flex: 0 0 auto;
		width: 2rem;
		height: 2rem;
		border: 2px solid var(--zine-frame-stroke);
		border-radius: 50%;
		object-fit: cover;
		background: var(--zine-bg);
	}
	:global(.zine .zine-sms-sender) {
		display: block;
		margin: 0 0 0.2rem 0.25rem;
		color: color-mix(in oklch, currentColor, transparent 28%);
		font-size: 0.72rem;
		font-weight: 800;
		line-height: 1.1;
	}
	:global(.zine .zine-block[data-text-frame='sms'][data-frame-side='outgoing'] .zine-sms-sender) {
		margin-right: 0.25rem;
		margin-left: 0;
		text-align: right;
	}
	:global(.zine .zine-heading) {
		margin: 1.75rem 0 0.75rem;
		font-family: var(--zine-font-heading);
		font-weight: 700;
		line-height: 1.2;
		letter-spacing: 0;
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
	:global(.zine .zine-block[data-text-kind='content'] .zine-richtext ul),
	:global(.zine .zine-block[data-text-kind='content'] .zine-richtext ol) {
		padding-left: 0;
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
		font-weight: 750;
		text-decoration-line: underline;
		text-decoration-thickness: 0.11em;
		text-decoration-color: color-mix(in oklch, var(--zine-accent), transparent 20%);
		text-decoration-skip-ink: auto;
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

	/* Baseline readability: before JS hydrates (or for a measured over-tall scene),
	   timeline scenes flatten to source order. Hydration may enhance back to sticky only after
	   the renderer can measure real viewport height; no-JS readers never get clipped prose. */
	.zine:not([data-viewport='frame']):not([data-hydrated]) .zine-scene,
	.zine:not([data-viewport='frame']) .zine-scene[data-fit-collapse] {
		min-height: 0 !important;
	}
	.zine:not([data-viewport='frame']):not([data-hydrated]) .zine-scene__inner.is-pinned,
	.zine:not([data-viewport='frame']):not([data-hydrated]) .zine-scene__inner.is-horizontal,
	.zine:not([data-viewport='frame']):not([data-hydrated])
		.zine-scene__inner.is-horizontal.is-pinned,
	.zine:not([data-viewport='frame']) .zine-scene[data-fit-collapse] .zine-scene__inner,
	.zine:not([data-viewport='frame'])
		.zine-scene[data-fit-collapse]
		.zine-scene__inner.is-horizontal.is-pinned {
		position: static;
		min-height: 0;
		height: auto;
		display: block;
		overflow: visible;
	}
	.zine:not([data-viewport='frame']):not([data-hydrated]) .zine-stage,
	.zine:not([data-viewport='frame']):not([data-hydrated]) .zine-stage-overlay,
	.zine:not([data-viewport='frame']) .zine-scene[data-fit-collapse] .zine-stage,
	.zine:not([data-viewport='frame']) .zine-scene[data-fit-collapse] .zine-stage-overlay {
		position: static;
		width: auto;
		height: auto;
		transform: none !important;
		container-type: normal;
	}
	.zine:not([data-viewport='frame']):not([data-hydrated]) .zine-actor,
	.zine:not([data-viewport='frame']):not([data-hydrated]) .zine-free-actor,
	.zine:not([data-viewport='frame']):not([data-hydrated]) .zine-pinned-actor,
	.zine:not([data-viewport='frame']) .zine-scene[data-fit-collapse] .zine-actor,
	.zine:not([data-viewport='frame']) .zine-scene[data-fit-collapse] .zine-free-actor,
	.zine:not([data-viewport='frame']) .zine-scene[data-fit-collapse] .zine-pinned-actor {
		position: static;
		max-block-size: none;
		max-inline-size: 100%;
		overflow: visible;
		translate: none !important;
	}
	.zine:not([data-viewport='frame']):not([data-hydrated]) .zine-free-actor :global(.zine-block),
	.zine:not([data-viewport='frame']):not([data-hydrated]) .zine-pinned-actor :global(.zine-block),
	.zine:not([data-viewport='frame'])
		.zine-scene[data-fit-collapse]
		.zine-free-actor
		:global(.zine-block),
	.zine:not([data-viewport='frame'])
		.zine-scene[data-fit-collapse]
		.zine-pinned-actor
		:global(.zine-block) {
		transform: none !important;
	}

	/* Reduced motion is a first-class, CSS-driven layout — so a reduced-motion reader gets the
	   flat, source-order page IMMEDIATELY (server-rendered), with no pinned/transformed layout
	   flashing before hydration corrects it. Mirrors the JS reduced-motion path (which the
	   renderer also applies), but without the SSR→hydration mismatch. `!important` overrides
	   the inline `min-height`/transform the motion path emits. */
	@media (prefers-reduced-motion: reduce) {
		.zine-scene {
			min-height: 0 !important;
			/* No crossfade under reduced motion → no breathing-room gap either (per-scene static
			   backgrounds render in source order). */
			margin-top: 0 !important;
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
		.zine-free-actor,
		.zine-pinned-actor {
			position: static;
			max-block-size: none;
			max-inline-size: 100%;
			overflow: visible;
			translate: none !important;
		}
		.zine-free-actor :global(.zine-block),
		.zine-pinned-actor :global(.zine-block) {
			transform: none !important;
		}
	}

	/* Same readable-stack fallback on narrow viewports, applied before hydration so pinned/sticky
	   actors never clip prose on phones. Short-but-wide windows use the measured fit collapse
	   above, which keeps horizontal scenes interactive when their readable content fits. */
	@media (max-width: 700px) {
		.zine:not([data-viewport='frame']) .zine-scene {
			min-height: 0 !important;
		}
		.zine:not([data-viewport='frame']) .zine-scene__inner.is-pinned,
		.zine:not([data-viewport='frame']) .zine-scene__inner.is-horizontal,
		.zine:not([data-viewport='frame']) .zine-scene__inner.is-horizontal.is-pinned {
			position: static;
			min-height: 0;
			height: auto;
			display: block;
			overflow: visible;
		}
		.zine:not([data-viewport='frame']) .zine-stage,
		.zine:not([data-viewport='frame']) .zine-stage-overlay {
			position: static;
			width: auto;
			height: auto;
			transform: none !important;
			container-type: normal;
		}
		.zine:not([data-viewport='frame']) .zine-actor,
		.zine:not([data-viewport='frame']) .zine-free-actor,
		.zine:not([data-viewport='frame']) .zine-pinned-actor {
			position: static;
			max-block-size: none;
			max-inline-size: 100%;
			overflow: visible;
			translate: none !important;
		}
		.zine:not([data-viewport='frame']) .zine-free-actor :global(.zine-block),
		.zine:not([data-viewport='frame']) .zine-pinned-actor :global(.zine-block) {
			transform: none !important;
		}
	}
</style>
