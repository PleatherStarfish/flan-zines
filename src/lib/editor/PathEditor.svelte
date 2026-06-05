<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { getBlock } from '$lib/zine/registry';
	import ZineRenderer from '$lib/zine/render/ZineRenderer.svelte';
	import BlockFrame from '$lib/zine/render/BlockFrame.svelte';
	import {
		DEFAULT_WAYPOINTS,
		pathTransform,
		samplePath,
		type PathEase,
		type Waypoint
	} from '$lib/zine/animations/path';
	import type { Element, Scene, ZineDocument } from '$lib/zine/schema/document';
	import type { EditorStore } from './store.svelte';

	// The "click-through" choreography stage: scrub the scroll, click the stage to drop control
	// points, drag the dots to move them (double-click to remove), and shape the path between
	// them. Renders the live scene as a backdrop (the same ZineRenderer the public page uses) so
	// authoring is WYSIWYG. Writes waypoints through the store (autosave + undo). All free elements
	// in the scene are choreographable in one session.
	let {
		store,
		scene,
		document,
		elementId,
		onClose
	}: {
		store: EditorStore;
		scene: Scene;
		document: ZineDocument;
		elementId: string;
		onClose: () => void;
	} = $props();

	// Initialise from the opened element; the in-stage switcher then changes it locally.
	let activeId = $state(untrack(() => elementId));
	let scrub = $state(0);
	let selected = $state(0);
	let stageEl = $state<HTMLDivElement | null>(null);
	// A live preview of the waypoints during a drag (committed on pointer-up).
	let draft = $state<Waypoint[] | null>(null);

	const freeElements = $derived(scene.elements.filter((element) => element.placement === 'free'));
	const element = $derived<Element | undefined>(
		freeElements.find((candidate) => candidate.id === activeId) ?? freeElements[0]
	);

	function waypointsOf(el: Element | undefined): Waypoint[] {
		const raw = el?.motion?.type === 'path' ? el.motion.params?.waypoints : undefined;
		return Array.isArray(raw) && raw.length >= 2 ? (raw as Waypoint[]) : DEFAULT_WAYPOINTS;
	}
	const waypoints = $derived(draft ?? waypointsOf(element));

	// The backdrop = the scene with free sprites stripped, so ZineRenderer draws only the
	// scenery/content (we draw the sprites ourselves, interactively, on top).
	const backdropDoc = $derived<ZineDocument>({
		...document,
		acts: document.acts.map((act) => ({
			...act,
			scenes: act.scenes.map((candidate) =>
				candidate.id === scene.id
					? { ...candidate, elements: candidate.elements.filter((el) => el.placement !== 'free') }
					: candidate
			)
		}))
	});
	const backdropProgress = $derived({ [scene.id]: scrub });

	const EASES: { value: PathEase; label: string }[] = [
		{ value: 'linear', label: 'Straight' },
		{ value: 'smooth', label: 'Smooth' },
		{ value: 'in', label: 'Slow start' },
		{ value: 'out', label: 'Slow end' },
		{ value: 'arc', label: 'Jump' }
	];
	const SCALES = [0.5, 0.75, 1, 1.5, 2];

	function clamp(value: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, value));
	}
	function round(value: number): number {
		return Math.round(value * 100) / 100;
	}

	function stagePoint(event: PointerEvent): { x: number; y: number } {
		const rect = stageEl?.getBoundingClientRect();
		if (!rect || rect.width === 0 || rect.height === 0) return { x: 50, y: 50 };
		return {
			x: round(clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100)),
			y: round(clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100))
		};
	}

	function commit(next: Waypoint[]): void {
		if (element) store.setElementPath(element.id, next);
	}

	// Insert or move the control point nearest the current scrub to (x,y) — the "scrub + drag a
	// keyframe" gesture. A point already near this scroll position is moved; otherwise a new one
	// is dropped at `scrub`, inheriting the look of its neighbour.
	function upsertAt(at: number, x: number, y: number): Waypoint[] {
		const list = waypointsOf(element).map((w) => ({ ...w }));
		const near = list.findIndex((w) => Math.abs(w.at - at) < 0.04);
		if (near >= 0) {
			list[near] = { ...list[near], x, y };
			selected = near;
			return list;
		}
		const neighbour = list.reduce(
			(best, w) => (Math.abs(w.at - at) < Math.abs(best.at - at) ? w : best),
			list[0]
		);
		const point: Waypoint = { ...neighbour, at: round(at), x, y };
		const next = [...list, point].sort((a, b) => a.at - b.at);
		selected = next.indexOf(point);
		return next;
	}

	function setSelected<K extends keyof Waypoint>(key: K, value: Waypoint[K]): void {
		const list = waypointsOf(element).map((w) => ({ ...w }));
		if (!list[selected]) return;
		list[selected] = { ...list[selected], [key]: value };
		if (key === 'at') list.sort((a, b) => a.at - b.at);
		commit(list);
	}

	function addPointHere(): void {
		const sample = samplePath(waypoints, scrub);
		commit(upsertAt(scrub, round(sample.x), round(sample.y)));
	}

	function deleteSelected(): void {
		deleteAt(selected);
	}

	function deleteAt(index: number): void {
		const list = waypointsOf(element);
		if (list.length <= 2) return; // a path needs at least two points
		commit(list.filter((_, i) => i !== index));
		selected = Math.max(0, index - 1);
	}

	// ── point dragging (robust): capture the pointer on the grabbed element so move/up ALWAYS
	//    reach us — the point can never get stuck to the cursor — even off the stage. ──────────
	function beginDrag(event: PointerEvent, index: number, target: HTMLElement): void {
		selected = index;
		const pointerId = event.pointerId;
		try {
			target.setPointerCapture(pointerId);
		} catch {
			/* capture unsupported — the element listeners below still fire */
		}
		const move = (e: PointerEvent) => {
			const { x, y } = stagePoint(e);
			const list = (draft ?? waypointsOf(element)).map((w) => ({ ...w }));
			if (!list[index]) return;
			list[index] = { ...list[index], x, y };
			draft = list;
		};
		const end = () => {
			target.removeEventListener('pointermove', move);
			target.removeEventListener('pointerup', end);
			target.removeEventListener('pointercancel', end);
			try {
				target.releasePointerCapture(pointerId);
			} catch {
				/* already released */
			}
			if (draft) commit(draft);
			draft = null;
		};
		target.addEventListener('pointermove', move);
		target.addEventListener('pointerup', end);
		target.addEventListener('pointercancel', end);
	}

	// Drag an existing control point.
	function beginMarkerDrag(event: PointerEvent, index: number): void {
		event.preventDefault();
		event.stopPropagation();
		beginDrag(event, index, event.currentTarget as HTMLElement);
	}

	// Click (or click-drag) anywhere on the empty stage to ADD a point there at the current
	// scroll moment — the easy, arbitrary "place a point" gesture. Markers stop propagation, so
	// this only fires on the stage surface. A click near an existing point's moment moves it.
	function onStageDown(event: PointerEvent): void {
		if (!element || !stageEl) return;
		event.preventDefault();
		const { x, y } = stagePoint(event);
		commit(upsertAt(scrub, x, y)); // sets `selected` to the new/moved point
		beginDrag(event, selected, stageEl);
	}

	function nudgeSelected(event: KeyboardEvent): void {
		const step = event.shiftKey ? 5 : 1;
		const list = waypointsOf(element).map((w) => ({ ...w }));
		const w = list[selected];
		if (!w) return;
		if (event.key === 'ArrowLeft') w.x = clamp(w.x - step, 0, 100);
		else if (event.key === 'ArrowRight') w.x = clamp(w.x + step, 0, 100);
		else if (event.key === 'ArrowUp') w.y = clamp(w.y - step, 0, 100);
		else if (event.key === 'ArrowDown') w.y = clamp(w.y + step, 0, 100);
		else return;
		event.preventDefault();
		commit(list);
	}

	// The path as an SVG polyline sampled finely (so eased/arc segments curve).
	const pathD = $derived.by(() => {
		const steps = 48;
		let d = '';
		for (let i = 0; i <= steps; i++) {
			const s = samplePath(waypoints, i / steps);
			d += `${i === 0 ? 'M' : 'L'}${s.x.toFixed(2)},${s.y.toFixed(2)} `;
		}
		return d.trim();
	});
	const ghost = $derived(samplePath(waypoints, scrub));

	onDestroy(() => {
		// Listeners are one-shot (added per drag, removed on pointer-up); nothing persistent.
	});
</script>

<div class="path-editor" role="dialog" aria-modal="true" aria-label="Choreograph movement">
	<button type="button" class="scrim" aria-label="Close" onclick={onClose}></button>
	<div class="panel">
		<header class="panel__head">
			<h2>Choreograph movement</h2>
			<button type="button" class="done" onclick={onClose}>Done</button>
		</header>

		{#if !element}
			<p class="empty">Add a free element to this scene to choreograph it.</p>
		{:else}
			{#if freeElements.length > 1}
				<div class="switcher" role="group" aria-label="Which element">
					{#each freeElements as candidate (candidate.id)}
						<button
							type="button"
							aria-pressed={candidate.id === element.id}
							onclick={() => (activeId = candidate.id)}
						>
							{getBlock(candidate.block.type)?.label ?? candidate.block.type}
						</button>
					{/each}
				</div>
			{/if}

			<!-- The stage: a backdrop (real renderer) + the sprite ghost + the path overlay.
			     `container-type: size` so the sprite's cqw/cqh resolve here exactly as they do on
			     the published page. Click the surface to drop a point; drag the dots to move them. -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="stage" bind:this={stageEl} onpointerdown={onStageDown}>
				<div class="stage__backdrop" aria-hidden="true">
					<ZineRenderer document={backdropDoc} sceneProgress={backdropProgress} pinScenes={false} />
				</div>

				{#each freeElements as candidate (candidate.id)}
					{@const def = getBlock(candidate.block.type)}
					{@const isActive = candidate.id === element.id}
					{@const sample = samplePath(isActive ? waypoints : waypointsOf(candidate), scrub)}
					{#if def}
						{@const Render = def.Render}
						<div class="sprite" class:is-active={isActive} style:transform={pathTransform(sample)}>
							<BlockFrame label={def.label}>
								<Render props={candidate.block.props} />
							</BlockFrame>
						</div>
					{/if}
				{/each}

				<svg class="overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
					<path d={pathD} class="route" vector-effect="non-scaling-stroke" />
					<circle
						cx={ghost.x}
						cy={ghost.y}
						r="1.6"
						class="ghost"
						vector-effect="non-scaling-stroke"
					/>
				</svg>
				{#each waypoints as w, i (i)}
					<button
						type="button"
						class="marker"
						class:is-selected={i === selected}
						style:left={`${w.x}%`}
						style:top={`${w.y}%`}
						aria-label={`Point ${i + 1} at ${Math.round(w.at * 100)}% scroll — drag to move, double-click to remove`}
						onpointerdown={(event) => beginMarkerDrag(event, i)}
						onclick={() => (selected = i)}
						ondblclick={(event) => {
							event.stopPropagation();
							deleteAt(i);
						}}
						onkeydown={nudgeSelected}
					>
						<span>{i + 1}</span>
					</button>
				{/each}
			</div>

			<label class="scrubber">
				<span>Reader scroll</span>
				<input
					type="range"
					min="0"
					max="1"
					step="0.001"
					value={scrub}
					oninput={(event) => (scrub = Number(event.currentTarget.value))}
				/>
				<output>{Math.round(scrub * 100)}%</output>
			</label>
			<p class="hint">
				Scrub the scroll, then <strong>click the stage</strong> to drop a point there. Drag a
				numbered point to move it; <strong>double-click</strong> it to remove it.
			</p>

			<div class="points">
				<div class="points__head">
					<span>Point {selected + 1} of {waypoints.length}</span>
					<div>
						<button type="button" onclick={addPointHere}>+ Point here</button>
						<button
							type="button"
							class="danger"
							disabled={waypoints.length <= 2}
							onclick={deleteSelected}
						>
							Delete
						</button>
					</div>
				</div>
				{#if waypoints[selected]}
					<label class="point-when">
						<span>When (scroll)</span>
						<input
							type="range"
							min="0"
							max="1"
							step="0.01"
							value={waypoints[selected].at}
							oninput={(event) => setSelected('at', Number(event.currentTarget.value))}
						/>
						<output>{Math.round(waypoints[selected].at * 100)}%</output>
					</label>
					<div class="point-row" role="group" aria-label="Movement into this point">
						<span>Movement</span>
						<div class="chips">
							{#each EASES as ease (ease.value)}
								<button
									type="button"
									aria-pressed={waypoints[selected].ease === ease.value}
									onclick={() => setSelected('ease', ease.value)}
								>
									{ease.label}
								</button>
							{/each}
						</div>
					</div>
					<div class="point-row" role="group" aria-label="Size at this point">
						<span>Size</span>
						<div class="chips">
							{#each SCALES as s (s)}
								<button
									type="button"
									aria-pressed={Math.abs((waypoints[selected].scale ?? 1) - s) < 0.01}
									onclick={() => setSelected('scale', s)}
								>
									{s}×
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.path-editor {
		position: fixed;
		inset: 0;
		z-index: 70;
		display: grid;
		place-items: center;
		padding: 1.5rem;
	}
	.scrim {
		position: absolute;
		inset: 0;
		border: 0;
		background: hsl(var(--foreground) / 0.45);
		cursor: pointer;
	}
	.panel {
		position: relative;
		display: grid;
		gap: 0.7rem;
		width: min(56rem, 100%);
		max-height: calc(100vh - 3rem);
		overflow-y: auto;
		border-radius: 0.7rem;
		background: hsl(var(--background));
		box-shadow: 0 18px 48px hsl(var(--foreground) / 0.25);
		padding: 1rem 1.1rem 1.2rem;
	}
	.panel__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.panel__head h2 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 760;
	}
	.done {
		border: 0;
		border-radius: 0.5rem;
		background: hsl(var(--foreground));
		color: hsl(var(--background));
		padding: 0.5rem 0.85rem;
		font-weight: 700;
	}
	.empty {
		color: hsl(var(--muted-foreground));
	}
	.switcher {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.switcher button {
		border: 1px solid hsl(var(--border));
		border-radius: 0.4rem;
		background: hsl(var(--background));
		padding: 0.35rem 0.6rem;
		font-size: 0.82rem;
		font-weight: 700;
		color: hsl(var(--foreground));
	}
	.switcher button[aria-pressed='true'] {
		border-color: hsl(var(--primary));
		background: hsl(var(--muted));
	}
	.stage {
		position: relative;
		container-type: size;
		aspect-ratio: 16 / 10;
		overflow: hidden;
		border: 1px solid hsl(var(--border));
		border-radius: 0.5rem;
		background: var(--zine-bg, hsl(var(--muted)));
		touch-action: none;
		user-select: none;
	}
	.stage__backdrop {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
	}
	.stage__backdrop :global(.zine) {
		min-height: 100%;
	}
	.stage__backdrop :global(.zine-title) {
		display: none;
	}
	.sprite {
		position: absolute;
		left: 0;
		top: 0;
		z-index: 2;
		width: max-content;
		max-width: 46cqw;
		/* A preview ghost — editing is via the stage (add) and the markers (move/remove). */
		pointer-events: none;
	}
	.sprite.is-active {
		outline: 2px dashed hsl(var(--primary));
		outline-offset: 3px;
	}
	.sprite :global(.zine-block) {
		margin: 0;
		padding: 0;
		max-width: 46cqw;
	}
	.sprite :global(.zine-image img) {
		max-height: 46cqh;
		width: auto;
	}
	.overlay {
		position: absolute;
		inset: 0;
		z-index: 3;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	.route {
		fill: none;
		stroke: hsl(var(--primary));
		stroke-width: 2;
		stroke-dasharray: 4 3;
		opacity: 0.85;
	}
	.ghost {
		fill: hsl(var(--primary) / 0.5);
		stroke: hsl(var(--background));
		stroke-width: 1;
	}
	.marker {
		position: absolute;
		z-index: 4;
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border: 2px solid hsl(var(--background));
		border-radius: 999px;
		background: hsl(var(--primary));
		color: #fff;
		font-size: 0.7rem;
		font-weight: 800;
		transform: translate(-50%, -50%);
		cursor: grab;
		touch-action: none;
	}
	.marker.is-selected {
		outline: 2px solid hsl(var(--foreground));
		outline-offset: 1px;
	}
	.scrubber {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr) max-content;
		align-items: center;
		gap: 0.7rem;
	}
	.scrubber span,
	.point-when span,
	.point-row > span {
		font-size: 0.78rem;
		font-weight: 750;
		color: hsl(var(--muted-foreground));
	}
	.scrubber input,
	.point-when input {
		width: 100%;
		accent-color: hsl(var(--primary));
	}
	.scrubber output,
	.point-when output {
		font-variant-numeric: tabular-nums;
		font-weight: 760;
		font-size: 0.78rem;
	}
	.hint {
		margin: 0;
		font-size: 0.74rem;
		color: hsl(var(--muted-foreground));
	}
	.points {
		display: grid;
		gap: 0.55rem;
		border: 1px solid hsl(var(--border));
		border-radius: 0.5rem;
		padding: 0.7rem 0.8rem;
	}
	.points__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.8rem;
		font-weight: 750;
	}
	.points__head div {
		display: flex;
		gap: 0.4rem;
	}
	.points__head button {
		border: 1px solid hsl(var(--border));
		border-radius: 0.4rem;
		background: hsl(var(--background));
		padding: 0.32rem 0.55rem;
		font-size: 0.78rem;
		font-weight: 700;
		color: hsl(var(--foreground));
	}
	.points__head .danger {
		color: #b42318;
	}
	.points__head button:disabled {
		opacity: 0.4;
	}
	.point-when {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr) max-content;
		align-items: center;
		gap: 0.6rem;
	}
	.point-row {
		display: grid;
		grid-template-columns: 5rem minmax(0, 1fr);
		align-items: center;
		gap: 0.5rem;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}
	.chips button {
		flex: 1 1 auto;
		border: 1px solid hsl(var(--border));
		border-radius: 0.35rem;
		background: hsl(var(--background));
		padding: 0.32rem 0.4rem;
		font-size: 0.76rem;
		font-weight: 700;
		color: hsl(var(--foreground));
	}
	.chips button[aria-pressed='true'] {
		border-color: hsl(var(--primary));
		background: hsl(var(--muted));
	}
	button:focus-visible,
	input:focus-visible {
		outline: 2px solid hsl(var(--primary));
		outline-offset: 2px;
	}
</style>
