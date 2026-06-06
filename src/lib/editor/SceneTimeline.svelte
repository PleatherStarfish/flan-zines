<script lang="ts">
	import { onDestroy } from 'svelte';
	import { getBlock, getEffect } from '$lib/zine/registry';
	import ZineRenderer from '$lib/zine/render/ZineRenderer.svelte';
	import {
		sceneScrollScreens,
		type Beat,
		type Element,
		type ElementTrack,
		type Scene,
		type TimelineRange,
		type ZineDocument
	} from '$lib/zine/schema/document';
	import { RAMP } from '$lib/zine/render/timeline';
	import type { Speed } from '$lib/zine/animations/schema';
	import type { EditorStore } from './store.svelte';

	let {
		store,
		scene,
		document,
		onEditPath
	}: {
		store: EditorStore;
		scene: Scene;
		document: ZineDocument;
		onEditPath?: (elementId: string) => void;
	} = $props();

	// A `path` (Choreograph) clip is the "click-through": tapping its bar opens the stage editor.
	function isPathElement(element: Element): boolean {
		return element.motion?.type === 'path';
	}
	function onClipClick(element: Element): void {
		store.select(element.id);
		if (isPathElement(element)) onEditPath?.(element.id);
	}

	const tracks: ElementTrack[] = ['content', 'media', 'background'];
	const trackLabels: Record<ElementTrack, string> = {
		content: 'Words',
		media: 'Pictures',
		background: 'Backdrop'
	};
	const timelineBlockLabels: Record<string, string> = {
		heading: 'Title',
		richText: 'Words',
		image: 'Picture',
		linkButton: 'Link',
		spacer: 'Pause'
	};
	const addChoices: { label: string; type: string; track: ElementTrack }[] = [
		{ label: 'Title', type: 'heading', track: 'content' },
		{ label: 'Words', type: 'richText', track: 'content' },
		{ label: 'Picture', type: 'image', track: 'media' },
		{ label: 'Link', type: 'linkButton', track: 'content' },
		{ label: 'Pause', type: 'spacer', track: 'content' }
	];

	let scrub = $state(0);
	let axisEl = $state<HTMLDivElement | null>(null);
	let dragPreview = $state<{ elementId: string; range: TimelineRange } | null>(null);
	let beatPreview = $state<{ beatId: string; at: number } | null>(null);
	let clipDrag = $state<{
		elementId: string;
		mode: 'move' | 'start' | 'end';
		originX: number;
		originRange: TimelineRange;
	} | null>(null);
	let beatDrag = $state<{ beatId: string; originAt: number; originX: number } | null>(null);
	let scrubbing = $state(false);
	let rampDrag = $state<{
		elementId: string;
		slot: 'enter' | 'exit';
		speed: Speed;
		left: number;
		width: number;
	} | null>(null);

	const sceneProgress = $derived({ [scene.id]: scrub });
	const screens = $derived(sceneScrollScreens(scene));

	// The whole-screen markers shown on the ruler and as lane gridlines: one tick per
	// screen of scroll distance, so a clip's position reads in real screens.
	const screenSpans = $derived(
		Array.from({ length: Math.max(1, Math.round(screens)) }, (_, i) => ({
			n: i + 1,
			start: i / screens,
			center: (i + 0.5) / screens
		}))
	);

	// One channel per element (DAW-style). Grouped by track so related clips cluster, but
	// every clip gets its own legible row — so you can see and add an arbitrary number.
	const lanes = $derived(
		tracks.flatMap((track) => scene.elements.filter((element) => element.track === track))
	);

	function addClip(type: string, track: ElementTrack): void {
		store.addElementAt(scene.id, type, track, scrub);
	}

	function addMoment(): void {
		const at = scene.type === 'page' && scrub === 0 ? 0.5 : scrub;
		if (scene.type === 'page') store.setSceneType(scene.id, 'reveal');
		store.addBeat(scene.id, at);
	}

	function rangeFor(element: Element): TimelineRange {
		return dragPreview?.elementId === element.id ? dragPreview.range : element.range;
	}

	function beatAt(beat: Beat): number {
		return beatPreview?.beatId === beat.id ? beatPreview.at : beat.at;
	}

	function elementLabel(element: Element): string {
		if (element.block.type === 'heading') {
			const props = element.block.props as { text?: unknown };
			if (typeof props.text === 'string' && props.text.trim()) return props.text;
		}
		if (timelineBlockLabels[element.block.type]) return timelineBlockLabels[element.block.type];
		return getBlock(element.block.type)?.label ?? element.block.type;
	}

	// The clip's choreography, as small chips in the channel head (scene-timeline.md §4).
	function effectChips(element: Element): { slot: string; label: string; icon: string }[] {
		const out: { slot: string; label: string; icon: string }[] = [];
		const add = (slot: string, ref: Element['enter']) => {
			if (!ref) return;
			const def = getEffect(ref.type);
			if (def) out.push({ slot, label: def.label, icon: def.icon });
		};
		add('In', element.enter);
		add('Move', element.motion);
		add('Out', element.exit);
		return out;
	}

	// The clip's primary effect, labelled on the bar itself.
	function clipEffectLabel(element: Element): string | null {
		const ref = element.enter ?? element.motion ?? element.exit;
		return ref ? (getEffect(ref.type)?.label ?? null) : null;
	}

	function progressFromPointer(event: PointerEvent): number {
		const rect = axisEl?.getBoundingClientRect();
		if (!rect || rect.width === 0) return scrub;
		return clamp((event.clientX - rect.left) / rect.width, 0, 1);
	}

	// ── scrubbing the playhead (click/drag the ruler or empty lane, wheel the preview) ──
	function setScrubFromPointer(event: PointerEvent): void {
		scrub = round(progressFromPointer(event));
	}

	function beginScrub(event: PointerEvent): void {
		event.preventDefault();
		scrubbing = true;
		setScrubFromPointer(event);
		window.addEventListener('pointermove', setScrubFromPointer);
		window.addEventListener('pointerup', endScrub, { once: true });
	}

	function endScrub(): void {
		scrubbing = false;
		window.removeEventListener('pointermove', setScrubFromPointer);
	}

	function onPreviewWheel(event: WheelEvent): void {
		// Scroll over the preview = scroll the scene: drive the same progress the slider does.
		event.preventDefault();
		scrub = round(clamp(scrub + event.deltaY / 700, 0, 1));
	}

	// ── clip drag (when it appears / how long it stays) ─────────────────────────────────
	function beginClipDrag(
		event: PointerEvent,
		element: Element,
		mode: 'move' | 'start' | 'end'
	): void {
		event.preventDefault();
		event.stopPropagation();
		store.select(element.id);
		clipDrag = {
			elementId: element.id,
			mode,
			originX: progressFromPointer(event),
			originRange: { ...rangeFor(element) }
		};
		window.addEventListener('pointermove', onClipPointerMove);
		window.addEventListener('pointerup', finishClipDrag, { once: true });
	}

	function onClipPointerMove(event: PointerEvent): void {
		if (!clipDrag) return;
		const pointer = progressFromPointer(event);
		const next = nextRange(clipDrag.originRange, clipDrag.mode, pointer, clipDrag.originX);
		dragPreview = { elementId: clipDrag.elementId, range: next };
	}

	function finishClipDrag(): void {
		if (clipDrag && dragPreview?.elementId === clipDrag.elementId) {
			store.updateElementRange(clipDrag.elementId, dragPreview.range);
		}
		clipDrag = null;
		dragPreview = null;
		window.removeEventListener('pointermove', onClipPointerMove);
	}

	function beginBeatDrag(event: PointerEvent, beat: Beat): void {
		event.preventDefault();
		event.stopPropagation();
		beatDrag = { beatId: beat.id, originAt: beat.at, originX: progressFromPointer(event) };
		window.addEventListener('pointermove', onBeatPointerMove);
		window.addEventListener('pointerup', finishBeatDrag, { once: true });
	}

	function onBeatPointerMove(event: PointerEvent): void {
		if (!beatDrag) return;
		const delta = progressFromPointer(event) - beatDrag.originX;
		beatPreview = { beatId: beatDrag.beatId, at: round(clamp(beatDrag.originAt + delta, 0, 1)) };
	}

	function finishBeatDrag(): void {
		if (beatDrag && beatPreview?.beatId === beatDrag.beatId) {
			store.updateBeat(scene.id, beatDrag.beatId, { at: beatPreview.at });
		}
		beatDrag = null;
		beatPreview = null;
		window.removeEventListener('pointermove', onBeatPointerMove);
	}

	// ── enter/exit ramp (the audio-fade wedge = the effect's Speed) ─────────────────────
	function rampSpeed(element: Element, slot: 'enter' | 'exit'): Speed {
		if (rampDrag && rampDrag.elementId === element.id && rampDrag.slot === slot)
			return rampDrag.speed;
		const speed = (slot === 'enter' ? element.enter : element.exit)?.params?.speed;
		return speed === 'slow' || speed === 'medium' || speed === 'fast' ? speed : 'medium';
	}

	function rampWidthPct(element: Element, slot: 'enter' | 'exit'): number {
		return RAMP[rampSpeed(element, slot)] * 100;
	}

	function speedFromFraction(frac: number): Speed {
		if (frac >= (RAMP.slow + RAMP.medium) / 2) return 'slow';
		if (frac >= (RAMP.medium + RAMP.fast) / 2) return 'medium';
		return 'fast';
	}

	function commitRamp(element: Element, slot: 'enter' | 'exit', speed: Speed): void {
		const ref = slot === 'enter' ? element.enter : element.exit;
		if (ref)
			store.setElementEffect(element.id, slot, {
				type: ref.type,
				params: { ...ref.params, speed }
			});
	}

	function beginRampDrag(event: PointerEvent, element: Element, slot: 'enter' | 'exit'): void {
		event.preventDefault();
		event.stopPropagation();
		store.select(element.id);
		const clipEl = (event.currentTarget as HTMLElement).closest('.clip');
		if (!clipEl) return;
		const rect = clipEl.getBoundingClientRect();
		rampDrag = {
			elementId: element.id,
			slot,
			speed: rampSpeed(element, slot),
			left: rect.left,
			width: rect.width
		};
		window.addEventListener('pointermove', onRampMove);
		window.addEventListener('pointerup', finishRampDrag, { once: true });
	}

	function onRampMove(event: PointerEvent): void {
		if (!rampDrag || rampDrag.width === 0) return;
		const fromStart = (event.clientX - rampDrag.left) / rampDrag.width;
		const frac = rampDrag.slot === 'enter' ? fromStart : 1 - fromStart;
		rampDrag = { ...rampDrag, speed: speedFromFraction(clamp(frac, 0, 1)) };
	}

	function finishRampDrag(): void {
		if (rampDrag) {
			const element = scene.elements.find((e) => e.id === rampDrag!.elementId);
			if (element) commitRamp(element, rampDrag.slot, rampDrag.speed);
		}
		rampDrag = null;
		window.removeEventListener('pointermove', onRampMove);
	}

	function keyRamp(event: KeyboardEvent, element: Element, slot: 'enter' | 'exit'): void {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		event.preventDefault();
		const order: Speed[] = ['fast', 'medium', 'slow']; // left = shorter/faster, right = longer
		const idx = clamp(
			order.indexOf(rampSpeed(element, slot)) + (event.key === 'ArrowRight' ? 1 : -1),
			0,
			order.length - 1
		);
		commitRamp(element, slot, order[idx]);
	}

	function nextRange(
		origin: TimelineRange,
		mode: 'move' | 'start' | 'end',
		pointer: number,
		originPointer: number
	): TimelineRange {
		const minDuration = 0.06;
		if (mode === 'start') {
			return { start: round(clamp(pointer, 0, origin.end - minDuration)), end: origin.end };
		}
		if (mode === 'end') {
			return { start: origin.start, end: round(clamp(pointer, origin.start + minDuration, 1)) };
		}
		const duration = origin.end - origin.start;
		const start = clamp(origin.start + pointer - originPointer, 0, 1 - duration);
		return { start: round(start), end: round(start + duration) };
	}

	function keyClip(event: KeyboardEvent, element: Element): void {
		const step = event.shiftKey ? 0.08 : 0.02;
		const range = rangeFor(element);
		if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
			event.preventDefault();
			const dir = event.key === 'ArrowLeft' ? -step : step;
			store.updateElementRange(
				element.id,
				nextRange(range, 'move', range.start + dir, range.start)
			);
		}
		if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			event.preventDefault();
			store.updateElementTrack(
				element.id,
				nearbyTrack(element.track, event.key === 'ArrowUp' ? -1 : 1)
			);
		}
	}

	function keyBeat(event: KeyboardEvent, beat: Beat): void {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		event.preventDefault();
		const step = event.shiftKey ? 0.08 : 0.02;
		const dir = event.key === 'ArrowLeft' ? -step : step;
		store.updateBeat(scene.id, beat.id, { at: round(clamp(beat.at + dir, 0, 1)) });
	}

	function nearbyTrack(track: ElementTrack, delta: number): ElementTrack {
		const index = tracks.indexOf(track);
		return tracks[clamp(index + delta, 0, tracks.length - 1)];
	}

	function clamp(value: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, value));
	}

	function round(value: number): number {
		return Math.round(value * 1000) / 1000;
	}

	onDestroy(() => {
		window.removeEventListener('pointermove', onClipPointerMove);
		window.removeEventListener('pointermove', onBeatPointerMove);
		window.removeEventListener('pointermove', setScrubFromPointer);
		window.removeEventListener('pointermove', onRampMove);
	});
</script>

<div class="timeline-workbench">
	<section class="preview-panel" aria-label="Scene preview">
		<div class="preview-panel__canvas" onwheel={onPreviewWheel}>
			<ZineRenderer {document} {sceneProgress} pinScenes={false} />
		</div>
		<label class="scrubber">
			<span>Reader scroll</span>
			<input
				type="range"
				aria-label="Reader scroll"
				min="0"
				max="1"
				step="0.001"
				value={scrub}
				oninput={(event) => (scrub = Number(event.currentTarget.value))}
			/>
			<output>{Math.round(scrub * 100)}%</output>
		</label>

		<p class="preview-hint">
			Scroll over the preview to play it, or drag the slider. Scene travel lives in the sidebar.
		</p>
	</section>

	<section class="timeline-panel" aria-label="Scene timeline">
		<div class="timeline-toolbar">
			<span class="timeline-toolbar__label">Add</span>
			{#each addChoices as choice (choice.label)}
				<button type="button" onclick={() => addClip(choice.type, choice.track)}>
					{choice.label}
				</button>
			{/each}
			<button type="button" class="moment-button" onclick={addMoment}>+ Moment</button>
		</div>

		<div class="timeline-grid" style:--screens={screens}>
			<div class="timeline-rulerrow">
				<div class="timeline-rulerrow__gutter">
					{screens === 1 ? '1 screen' : `${screens} screens`}
				</div>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="timeline-axis" bind:this={axisEl} onpointerdown={beginScrub}>
					<div class="playhead" class:is-active={scrubbing} style:left={`${scrub * 100}%`}></div>
					{#each screenSpans as span (span.n)}
						{#if span.n > 1}
							<span class="screen-line" style:left={`${span.start * 100}%`}></span>
						{/if}
						<span class="screen-label" style:left={`${span.center * 100}%`}>{span.n}</span>
					{/each}
					{#each scene.beats as beat (beat.id)}
						<button
							type="button"
							class="beat"
							style:left={`${beatAt(beat) * 100}%`}
							aria-label={`Moment at ${Math.round(beatAt(beat) * 100)} percent`}
							onpointerdown={(event) => beginBeatDrag(event, beat)}
							onkeydown={(event) => keyBeat(event, beat)}
						></button>
					{/each}
				</div>
			</div>

			{#if lanes.length === 0}
				<div class="timeline-empty">
					<p>
						No clips yet. Add a <strong>Title</strong> or <strong>Picture</strong> above, then tap it
						to give it an effect.
					</p>
				</div>
			{:else}
				<div class="timeline-lanes">
					{#each lanes as element (element.id)}
						{@const range = rangeFor(element)}
						{@const chips = effectChips(element)}
						{@const selected = store.selectedId === element.id}
						<div class="lane" data-track={element.track} class:is-selected={selected}>
							<button
								type="button"
								class="lane__head"
								aria-pressed={selected}
								onclick={() => store.select(element.id)}
							>
								<span class="lane__tag">{trackLabels[element.track]}</span>
								<span class="lane__name">{elementLabel(element)}</span>
								<span class="lane__fx">
									{#if chips.length}
										{#each chips as chip (chip.slot)}
											<span class="lane__chip" title={`${chip.slot}: ${chip.label}`}>
												<span aria-hidden="true">{chip.icon}</span>{chip.label}
											</span>
										{/each}
									{:else}
										<span class="lane__chip lane__chip--empty">Tap to add an effect</span>
									{/if}
								</span>
							</button>
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div class="lane__track" onpointerdown={beginScrub}>
								<div class="playhead" style:left={`${scrub * 100}%`}></div>
								<div
									class="clip"
									class:is-selected={selected}
									class:has-enter={Boolean(element.enter)}
									class:has-exit={Boolean(element.exit)}
									style:left={`${range.start * 100}%`}
									style:width={`${(range.end - range.start) * 100}%`}
								>
									{#if element.enter}
										<button
											type="button"
											class="clip__ramp clip__ramp--in"
											style:width={`${rampWidthPct(element, 'enter')}%`}
											aria-label={`Fade-in length for ${elementLabel(element)} (${rampSpeed(element, 'enter')}) — drag to change`}
											onpointerdown={(event) => beginRampDrag(event, element, 'enter')}
											onkeydown={(event) => keyRamp(event, element, 'enter')}
										></button>
									{/if}
									<button
										type="button"
										class="clip__handle clip__handle--start"
										aria-label={`Shorten ${elementLabel(element)} from the start`}
										onpointerdown={(event) => beginClipDrag(event, element, 'start')}
									></button>
									<button
										type="button"
										class="clip__body"
										class:is-path={isPathElement(element)}
										aria-label={`${elementLabel(element)}${clipEffectLabel(element) ? ' · ' + clipEffectLabel(element) : ''} from ${Math.round(range.start * 100)} to ${Math.round(range.end * 100)} percent${isPathElement(element) ? ' — open the path editor' : ''}`}
										aria-pressed={selected}
										onclick={() => onClipClick(element)}
										onpointerdown={(event) => beginClipDrag(event, element, 'move')}
										onkeydown={(event) => keyClip(event, element)}
									>
										<span>{elementLabel(element)}</span>
										{#if isPathElement(element)}
											<span class="clip__fx">🧭 Edit path</span>
										{:else if clipEffectLabel(element)}
											<span class="clip__fx">{clipEffectLabel(element)}</span>
										{/if}
									</button>
									<button
										type="button"
										class="clip__handle clip__handle--end"
										aria-label={`Extend ${elementLabel(element)} to the end`}
										onpointerdown={(event) => beginClipDrag(event, element, 'end')}
									></button>
									{#if element.exit}
										<button
											type="button"
											class="clip__ramp clip__ramp--out"
											style:width={`${rampWidthPct(element, 'exit')}%`}
											aria-label={`Fade-out length for ${elementLabel(element)} (${rampSpeed(element, 'exit')}) — drag to change`}
											onpointerdown={(event) => beginRampDrag(event, element, 'exit')}
											onkeydown={(event) => keyRamp(event, element, 'exit')}
										></button>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</section>
</div>

<style>
	.timeline-workbench {
		display: grid;
		gap: 1rem;
		--gutter: 12rem;
	}
	.preview-panel,
	.timeline-panel {
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: oklch(0.97 0.02 82);
		box-shadow: var(--pixel-shadow-sm);
	}
	.preview-panel {
		overflow: hidden;
	}
	.preview-panel__canvas {
		height: min(18rem, 42vh);
		max-height: 18rem;
		overflow: hidden;
		background: var(--zine-bg, hsl(var(--background)));
		overscroll-behavior: contain;
		cursor: ns-resize;
	}
	.preview-panel__canvas :global(.zine-title) {
		display: none;
	}
	.scrubber {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr) max-content;
		align-items: center;
		gap: 0.8rem;
		border-top: 2px solid var(--pixel-ink);
		padding: 0.7rem 1rem 0.4rem;
	}
	.scrubber span {
		font-size: 0.78rem;
		font-weight: 750;
		color: hsl(var(--muted-foreground));
	}
	.scrubber input {
		width: 100%;
		accent-color: hsl(var(--primary));
	}
	.scrubber output {
		font-size: 0.78rem;
		font-weight: 760;
		font-variant-numeric: tabular-nums;
		color: hsl(var(--foreground));
	}
	.preview-hint {
		margin: 0;
		padding: 0 1rem 0.7rem;
		font-size: 0.74rem;
		color: hsl(var(--muted-foreground));
	}
	.timeline-panel {
		display: grid;
		grid-template-rows: max-content minmax(0, 1fr);
		overflow: hidden;
	}
	.timeline-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		border-bottom: 2px solid var(--pixel-ink);
		background:
			linear-gradient(90deg, oklch(0.24 0.065 281 / 0.08) 1px, transparent 1px),
			oklch(0.88 0.045 78);
		background-size: 12px 12px;
		padding: 0.6rem 0.75rem;
	}
	.timeline-toolbar__label {
		margin-right: 0.15rem;
		font-size: 0.72rem;
		font-weight: 760;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: hsl(var(--muted-foreground));
	}
	.timeline-toolbar button {
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: oklch(0.97 0.02 82);
		box-shadow: 0.1rem 0.1rem 0 var(--pixel-ink);
		color: hsl(var(--foreground));
		padding: 0.4rem 0.7rem;
		font-size: 0.84rem;
		font-weight: 850;
	}
	.timeline-toolbar .moment-button {
		margin-left: auto;
		background: var(--pixel-magenta);
		color: hsl(var(--primary-foreground));
		border-color: var(--pixel-ink);
	}
	.timeline-grid {
		display: grid;
		grid-template-rows: max-content minmax(0, 1fr);
		min-height: 0;
	}
	.timeline-rulerrow {
		display: grid;
		grid-template-columns: var(--gutter) minmax(0, 1fr);
		border-bottom: 2px solid var(--pixel-ink);
		background: oklch(0.94 0.032 83);
		/* keep the ruler axis aligned with lane tracks despite the lanes' scrollbar */
		scrollbar-gutter: stable;
	}
	.timeline-rulerrow__gutter {
		display: flex;
		align-items: center;
		border-right: 2px solid var(--pixel-ink);
		padding: 0 0.75rem;
		font-size: 0.72rem;
		font-weight: 760;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: hsl(var(--muted-foreground));
	}
	.timeline-axis {
		position: relative;
		height: 2.1rem;
		cursor: ew-resize;
		touch-action: none;
	}
	.screen-line {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		background: oklch(0.24 0.065 281 / 0.28);
		pointer-events: none;
	}
	.screen-label {
		position: absolute;
		bottom: 0.2rem;
		transform: translateX(-50%);
		font-size: 0.64rem;
		font-weight: 750;
		font-variant-numeric: tabular-nums;
		color: hsl(var(--muted-foreground));
		pointer-events: none;
	}
	.playhead {
		position: absolute;
		top: 0;
		bottom: 0;
		z-index: 6;
		width: 2px;
		background: var(--pixel-magenta);
		pointer-events: none;
	}
	.playhead.is-active {
		width: 3px;
	}
	.beat {
		position: absolute;
		top: 55%;
		z-index: 7;
		width: 0.85rem;
		height: 0.85rem;
		border: 2px solid var(--pixel-ink);
		border-radius: 0.2rem;
		background: var(--pixel-yellow);
		transform: translate(-50%, -50%) rotate(45deg);
	}
	.beat:focus-visible {
		outline: 2px solid hsl(var(--primary));
		outline-offset: 3px;
	}
	.timeline-lanes {
		overflow-y: auto;
		scrollbar-gutter: stable;
		max-height: 22rem;
		min-height: 8rem;
	}
	.timeline-empty {
		display: grid;
		place-items: center;
		min-height: 8rem;
		padding: 1.5rem;
		text-align: center;
		color: hsl(var(--muted-foreground));
	}
	.timeline-empty p {
		margin: 0;
		max-width: 28rem;
		font-size: 0.9rem;
	}
	.lane {
		display: grid;
		grid-template-columns: var(--gutter) minmax(0, 1fr);
		align-items: stretch;
		border-bottom: 2px solid oklch(0.24 0.065 281 / 0.34);
		/* per-track channel colour */
		--lane-accent: 215 16% 47%;
	}
	.lane[data-track='content'] {
		--lane-accent: 200 78% 42%;
	}
	.lane[data-track='media'] {
		--lane-accent: 146 55% 39%;
	}
	.lane[data-track='background'] {
		--lane-accent: 325 70% 45%;
	}
	.lane.is-selected {
		background: hsl(var(--lane-accent) / 0.07);
	}
	.lane__head {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		grid-template-rows: auto auto;
		align-content: center;
		gap: 0.1rem 0.5rem;
		border: 0;
		border-right: 2px solid var(--pixel-ink);
		background: hsl(var(--lane-accent) / 0.1);
		padding: 0.5rem 0.6rem;
		text-align: left;
		cursor: pointer;
	}
	.lane__head:hover {
		background: hsl(var(--lane-accent) / 0.08);
	}
	.lane__head[aria-pressed='true'] {
		background: hsl(var(--lane-accent) / 0.12);
	}
	.lane__tag {
		grid-row: 1;
		align-self: center;
		border: 1px solid hsl(var(--lane-accent) / 0.55);
		border-radius: var(--pixel-radius);
		background: hsl(var(--lane-accent) / 0.18);
		padding: 0.08rem 0.4rem;
		font-size: 0.66rem;
		font-weight: 760;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: hsl(var(--lane-accent));
	}
	.lane__name {
		grid-row: 1;
		align-self: center;
		overflow: hidden;
		font-size: 0.84rem;
		font-weight: 740;
		white-space: nowrap;
		text-overflow: ellipsis;
		color: hsl(var(--foreground));
	}
	.lane__fx {
		grid-row: 2;
		grid-column: 1 / -1;
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	.lane__chip {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		border: 1px solid oklch(0.24 0.065 281 / 0.32);
		border-radius: var(--pixel-radius);
		background: oklch(0.92 0.035 84);
		padding: 0.05rem 0.34rem;
		font-size: 0.68rem;
		font-weight: 700;
		color: hsl(var(--foreground));
	}
	.lane__chip--empty {
		background: transparent;
		font-weight: 600;
		font-style: italic;
		color: hsl(var(--muted-foreground));
	}
	.lane__track {
		position: relative;
		min-height: 3.4rem;
		background-color: oklch(0.94 0.032 83);
		background-image: linear-gradient(to right, oklch(0.24 0.065 281 / 0.2) 2px, transparent 2px);
		/* one cell per screen, so the gridlines line up with the ruler's screen markers */
		background-size: calc(100% / var(--screens, 4)) 100%;
		cursor: ew-resize;
		touch-action: none;
	}
	.clip {
		position: absolute;
		top: 0.55rem;
		bottom: 0.55rem;
		display: grid;
		grid-template-columns: 0.7rem minmax(1rem, 1fr) 0.7rem;
		min-width: 3.2rem;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: hsl(var(--lane-accent));
		color: hsl(var(--primary-foreground));
		box-shadow: 0.12rem 0.12rem 0 var(--pixel-ink);
	}
	.clip.is-selected {
		box-shadow:
			0 0 0 3px var(--pixel-yellow),
			0.12rem 0.12rem 0 var(--pixel-ink);
	}
	.clip__body,
	.clip__handle {
		min-width: 0;
		border: 0;
		background: transparent;
		color: inherit;
		cursor: grab;
		padding: 0;
	}
	.clip__body {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.05rem;
		overflow: hidden;
		padding: 0 0.2rem;
		text-align: left;
	}
	.clip__body > span:first-child {
		overflow: hidden;
		font-size: 0.78rem;
		font-weight: 760;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.clip__fx {
		overflow: hidden;
		font-size: 0.66rem;
		font-weight: 600;
		white-space: nowrap;
		text-overflow: ellipsis;
		opacity: 0.85;
	}
	.clip__handle {
		position: relative;
		z-index: 3; /* stay grabbable above the ramp wedges */
		background: hsl(var(--primary-foreground) / 0.22);
		cursor: ew-resize;
	}
	.clip__handle--start {
		border-radius: 0.38rem 0 0 0.38rem;
	}
	.clip__handle--end {
		border-radius: 0 0.38rem 0.38rem 0;
	}
	/* Enter/exit ramps — the audio-fade wedges (scene-timeline.md §4). The width is the
	   effect's REAL ramp length (its Speed), and dragging the wedge changes that speed, so
	   the triangle is a live effect parameter, not decoration. */
	.clip__ramp {
		position: absolute;
		top: 0;
		bottom: 0;
		z-index: 2;
		min-width: 0.5rem;
		border: 0;
		padding: 0;
		cursor: ew-resize;
		touch-action: none;
	}
	.clip__ramp::after {
		content: '';
		position: absolute;
		top: 0.18rem;
		bottom: 0.18rem;
		width: 2px;
		border-radius: 1px;
		background: hsl(var(--primary-foreground) / 0.85);
	}
	.clip__ramp--in {
		left: 0;
		background: linear-gradient(
			to right,
			hsl(var(--primary-foreground) / 0.55),
			hsl(var(--primary-foreground) / 0)
		);
		border-radius: 0.42rem 0 0 0.42rem;
	}
	.clip__ramp--in::after {
		right: 0;
	}
	.clip__ramp--out {
		right: 0;
		background: linear-gradient(
			to left,
			hsl(var(--primary-foreground) / 0.55),
			hsl(var(--primary-foreground) / 0)
		);
		border-radius: 0 0.42rem 0.42rem 0;
	}
	.clip__ramp--out::after {
		left: 0;
	}
	.clip button:focus-visible,
	.clip__ramp:focus-visible,
	.lane__head:focus-visible {
		outline: 2px solid hsl(var(--primary));
		outline-offset: 2px;
	}
	@media (max-width: 760px) {
		.timeline-workbench {
			--gutter: 8rem;
		}
		.lane__fx {
			display: none;
		}
	}
</style>
