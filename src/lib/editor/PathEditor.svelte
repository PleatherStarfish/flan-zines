<script lang="ts">
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import { getBlock } from '$lib/zine/registry';
	import ZineRenderer from '$lib/zine/render/ZineRenderer.svelte';
	import BlockFrame from '$lib/zine/render/BlockFrame.svelte';
	import {
		DEFAULT_WAYPOINTS,
		MAX_PATH_WAYPOINTS,
		type PathEase,
		type Waypoint
	} from '$lib/zine/animations/path';
	import { pathSvgD, retimeWaypointsByDistance } from '$lib/zine/animations/path-geometry';
	import { pathTransform, samplePath } from '$lib/zine/animations/path-runtime';
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
	let scrub = $state(0.5);
	let selected = $state(0);
	let dialogEl = $state<HTMLDivElement | null>(null);
	let stageEl = $state<HTMLDivElement | null>(null);
	let doneButtonEl = $state<HTMLButtonElement | null>(null);
	let previousFocus: HTMLElement | null = null;
	// A live preview of the waypoints during a drag (committed on pointer-up).
	let draft = $state<Waypoint[] | null>(null);
	let dragCleanup: (() => void) | null = null;
	let dragElementId: string | null = null;
	let pathStatus = $state('');

	const liveDocument = $derived(store.doc ?? document);
	const liveScene = $derived.by(() => {
		for (const act of liveDocument.acts) {
			const candidate = act.scenes.find((item) => item.id === scene.id);
			if (candidate) return candidate;
		}
		return scene;
	});
	const freeElements = $derived(
		liveScene.elements.filter((element) => element.placement === 'free')
	);
	const element = $derived<Element | undefined>(
		freeElements.find((candidate) => candidate.id === activeId) ?? freeElements[0]
	);

	function waypointsOf(el: Element | undefined): Waypoint[] {
		const raw = el?.motion?.type === 'path' ? el.motion.params?.waypoints : undefined;
		return Array.isArray(raw) && raw.length >= 2 ? (raw as Waypoint[]) : DEFAULT_WAYPOINTS;
	}
	const waypoints = $derived(draft ?? waypointsOf(element));
	const canAddPoint = $derived(waypoints.length < MAX_PATH_WAYPOINTS);

	// The backdrop = the scene with free sprites stripped, so ZineRenderer draws only the
	// scenery/content (we draw the sprites ourselves, interactively, on top).
	const backdropDoc = $derived<ZineDocument>({
		...liveDocument,
		acts: liveDocument.acts.map((act) => ({
			...act,
			scenes: act.scenes.map((candidate) =>
				candidate.id === liveScene.id
					? { ...candidate, elements: candidate.elements.filter((el) => el.placement !== 'free') }
					: candidate
			)
		}))
	});
	const backdropProgress = $derived({ [liveScene.id]: scrub });

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

	function stagePoint(event: PointerEvent): { x: number; y: number } | null {
		const rect = stageEl?.getBoundingClientRect();
		if (!rect || rect.width === 0 || rect.height === 0) return null;
		return {
			x: round(clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100)),
			y: round(clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100))
		};
	}

	function commit(elementId: string | undefined, next: Waypoint[]): void {
		if (elementId) store.setElementPath(elementId, next);
	}

	function nearestWaypoint(list: Waypoint[], at: number): Waypoint {
		return list.reduce(
			(best, w) => (Math.abs(w.at - at) < Math.abs(best.at - at) ? w : best),
			list[0]
		);
	}

	function appendAtEnd(x: number, y: number): Waypoint[] {
		const list = waypointsOf(element).map((w) => ({ ...w }));
		if (list.length >= MAX_PATH_WAYPOINTS) {
			pathStatus = `This path already has ${MAX_PATH_WAYPOINTS} points. Move or delete one to add another.`;
			return list;
		}
		const neighbour = list[list.length - 1] ?? DEFAULT_WAYPOINTS[DEFAULT_WAYPOINTS.length - 1];
		const point: Waypoint = { ...neighbour, at: 1, x, y };
		const next = retimeWaypointsByDistance([...list, point]);
		selected = next.length - 1;
		pathStatus = `Added point ${selected + 1} at the end. Pacing was smoothed by distance.`;
		return next;
	}

	function addAt(at: number, x: number, y: number): Waypoint[] {
		const list = waypointsOf(element).map((w) => ({ ...w }));
		if (list.length >= MAX_PATH_WAYPOINTS) {
			pathStatus = `This path already has ${MAX_PATH_WAYPOINTS} points. Move or delete one to add another.`;
			return list;
		}
		const targetAt = safeAt(at, list);
		const neighbour = nearestWaypoint(list, targetAt);
		const point: Waypoint = { ...neighbour, at: targetAt, x, y };
		const insertAt = list.findIndex((w) => targetAt < w.at);
		const next =
			insertAt === -1
				? [...list, point]
				: [...list.slice(0, insertAt), point, ...list.slice(insertAt)];
		selected = insertAt === -1 ? next.length - 1 : insertAt;
		pathStatus =
			Math.abs(targetAt - round(clamp(at, 0, 1))) < 0.001
				? `Added point ${selected + 1}.`
				: `Added point ${selected + 1} at ${Math.round(targetAt * 100)}% scroll.`;
		return next;
	}

	function setSelected<K extends keyof Waypoint>(key: K, value: Waypoint[K]): void {
		const list = waypointsOf(element).map((w) => ({ ...w }));
		if (!list[selected]) return;
		if (key === 'at') {
			list[selected] = {
				...list[selected],
				at: safeAtForIndex(Number(value), list, selected)
			};
			commit(element?.id, list);
			return;
		}
		list[selected] = { ...list[selected], [key]: value };
		const next = key === 'x' || key === 'y' ? retimeWaypointsByDistance(list) : list;
		commit(element?.id, next);
	}

	function appendPointAtPreview(): void {
		if (!element) return;
		if (!canAddPoint) {
			pathStatus = `This path already has ${MAX_PATH_WAYPOINTS} points. Move or delete one to add another.`;
			return;
		}
		const sample = samplePath(waypoints, scrub);
		const next = appendAtEnd(round(sample.x), round(sample.y));
		commit(element.id, next);
	}

	function insertPointAtScroll(): void {
		if (!element) return;
		if (!canAddPoint) {
			pathStatus = `This path already has ${MAX_PATH_WAYPOINTS} points. Move or delete one to add another.`;
			return;
		}
		const sample = samplePath(waypoints, scrub);
		const next = addAt(scrub, round(sample.x), round(sample.y));
		commit(element.id, next);
	}

	function smoothPacing(): void {
		if (!element) return;
		const next = retimeWaypointsByDistance(waypointsOf(element));
		selected = Math.min(selected, next.length - 1);
		commit(element.id, next);
		pathStatus = 'Smoothed timing so longer moves get more scroll time.';
	}

	function deleteSelected(): void {
		deleteAt(selected);
	}

	function deleteAt(index: number): void {
		const list = waypointsOf(element);
		if (list.length <= 2) return; // a path needs at least two points
		commit(element?.id, retimeWaypointsByDistance(list.filter((_, i) => i !== index)));
		selected = Math.max(0, index - 1);
		pathStatus = `Deleted point ${index + 1}.`;
	}

	// ── point dragging (robust): capture the pointer on the grabbed element so move/up ALWAYS
	//    reach us — the point can never get stuck to the cursor — even off the stage. ──────────
	function beginDrag(
		event: PointerEvent,
		index: number,
		target: HTMLElement,
		elementId: string,
		initialDraft?: Waypoint[]
	): void {
		finishDrag(true);
		selected = index;
		dragElementId = elementId;
		if (initialDraft) draft = initialDraft.map((w) => ({ ...w }));
		const pointerId = event.pointerId;
		try {
			target.setPointerCapture(pointerId);
		} catch {
			/* capture unsupported — the element listeners below still fire */
		}
		const move = (e: PointerEvent) => {
			if (e.pointerId !== pointerId) return;
			const point = stagePoint(e);
			if (!point) return;
			const { x, y } = point;
			const list = (draft ?? waypointsOf(element)).map((w) => ({ ...w }));
			if (!list[index]) return;
			list[index] = { ...list[index], x, y };
			draft = retimeWaypointsByDistance(list);
		};
		const end = (e?: PointerEvent) => {
			if (e && e.pointerId !== pointerId) return;
			finishDrag(true);
		};
		dragCleanup = () => {
			target.removeEventListener('pointermove', move);
			target.removeEventListener('pointerup', end);
			target.removeEventListener('pointercancel', end);
			target.removeEventListener('lostpointercapture', end);
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', end);
			window.removeEventListener('pointercancel', end);
			try {
				target.releasePointerCapture(pointerId);
			} catch {
				/* already released */
			}
		};
		target.addEventListener('pointermove', move);
		target.addEventListener('pointerup', end);
		target.addEventListener('pointercancel', end);
		target.addEventListener('lostpointercapture', end);
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', end);
		window.addEventListener('pointercancel', end);
	}

	function finishDrag(shouldCommit: boolean): void {
		const cleanup = dragCleanup;
		dragCleanup = null;
		if (cleanup) cleanup();
		if (shouldCommit && draft && dragElementId) commit(dragElementId, draft);
		draft = null;
		dragElementId = null;
	}

	// Drag an existing control point.
	function beginMarkerDrag(event: PointerEvent, index: number): void {
		if (!element || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0))
			return;
		event.preventDefault();
		event.stopPropagation();
		pathStatus = `Moving point ${index + 1}.`;
		beginDrag(event, index, event.currentTarget as HTMLElement, element.id);
	}

	// Click (or click-drag) anywhere on the empty stage to append a new route stop. Markers
	// stop propagation, so moving existing points stays explicit: drag the numbered dots.
	function onStageDown(event: PointerEvent): void {
		if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
		if (!element || !stageEl) return;
		event.preventDefault();
		stageEl.focus();
		if (!canAddPoint) {
			pathStatus = `This path already has ${MAX_PATH_WAYPOINTS} points. Move or delete one to add another.`;
			return;
		}
		const point = stagePoint(event);
		if (!point) return;
		const next = appendAtEnd(point.x, point.y); // sets `selected` to the new point
		draft = next;
		beginDrag(event, selected, stageEl, element.id, next);
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
		commit(element?.id, retimeWaypointsByDistance(list));
		pathStatus = `Moved point ${selected + 1}.`;
	}

	function onPointKeydown(event: KeyboardEvent): void {
		event.stopPropagation();
		if (event.key === 'Delete' || event.key === 'Backspace') {
			event.preventDefault();
			deleteSelected();
			return;
		}
		nudgeSelected(event);
	}

	function onStageKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			appendPointAtPreview();
			return;
		}
		if (event.key === 'Delete' || event.key === 'Backspace') {
			event.preventDefault();
			deleteSelected();
			return;
		}
		nudgeSelected(event);
	}

	function safeAt(at: number, others: Waypoint[]): number {
		const used = new Set(others.map((w) => round(w.at).toFixed(2)));
		const preferred = round(clamp(at, 0, 1));
		const key = (value: number) => value.toFixed(2);
		if (!used.has(key(preferred))) return preferred;

		for (let step = 1; step <= 100; step++) {
			const offset = step / 100;
			const candidates = [preferred + offset, preferred - offset];
			for (const candidate of candidates) {
				if (candidate < 0 || candidate > 1) continue;
				const rounded = round(candidate);
				if (!used.has(key(rounded))) return rounded;
			}
		}
		return preferred;
	}

	function safeAtForIndex(at: number, list: Waypoint[], index: number): number {
		const current = list[index]?.at ?? 0;
		const min = index === 0 ? 0 : round((list[index - 1]?.at ?? 0) + 0.01);
		const max = index === list.length - 1 ? 1 : round((list[index + 1]?.at ?? 1) - 0.01);
		if (min > max) return current;
		return round(clamp(at, min, max));
	}

	function switchElement(id: string): void {
		finishDrag(true);
		activeId = id;
		selected = 0;
		pathStatus = '';
	}

	function closeEditor(): void {
		finishDrag(true);
		onClose();
	}

	function focusableNodes(): HTMLElement[] {
		if (!dialogEl) return [];
		return [
			...dialogEl.querySelectorAll<HTMLElement>(
				'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
			)
		].filter((node) => node.offsetParent !== null || node === stageEl);
	}

	function onDialogKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			closeEditor();
			return;
		}
		if (event.key !== 'Tab') return;
		const nodes = focusableNodes();
		if (nodes.length === 0) return;
		const first = nodes[0];
		const last = nodes[nodes.length - 1];
		if (event.shiftKey && globalThis.document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && globalThis.document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	$effect(() => {
		if (selected >= waypoints.length) selected = Math.max(0, waypoints.length - 1);
	});

	// The path as an SVG polyline sampled by segment, including every authored point exactly.
	const pathD = $derived(pathSvgD(waypoints));
	const ghost = $derived(samplePath(waypoints, scrub));

	onMount(() => {
		previousFocus =
			globalThis.document.activeElement instanceof HTMLElement
				? globalThis.document.activeElement
				: null;
		void tick().then(() => (stageEl ?? doneButtonEl)?.focus());
	});

	onDestroy(() => {
		finishDrag(true);
		previousFocus?.focus();
	});
</script>

<div
	class="path-editor"
	role="dialog"
	aria-modal="true"
	aria-labelledby="path-editor-title"
	bind:this={dialogEl}
	tabindex="-1"
	onkeydown={onDialogKeydown}
>
	<button type="button" class="scrim" aria-label="Close" onclick={closeEditor}></button>
	<div class="panel">
		<header class="panel__head">
			<h2 id="path-editor-title">Choreograph movement</h2>
			<button type="button" class="done" bind:this={doneButtonEl} onclick={closeEditor}>Done</button
			>
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
							onclick={() => switchElement(candidate.id)}
						>
							{getBlock(candidate.block.type)?.label ?? candidate.block.type}
						</button>
					{/each}
				</div>
			{/if}

			<div class="path-tools" aria-describedby="path-editor-hint">
				<button type="button" disabled={!canAddPoint} onclick={appendPointAtPreview}>
					+ Point
				</button>
				<button type="button" onclick={smoothPacing}>Smooth pacing</button>
				<button type="button" disabled={!canAddPoint} onclick={insertPointAtScroll}>
					Insert at scroll
				</button>
				<button
					type="button"
					class="danger"
					disabled={waypoints.length <= 2}
					onclick={deleteSelected}
				>
					Delete point
				</button>
				<span>Click the stage to append the next stop.</span>
			</div>

			<!-- The stage: a backdrop (real renderer) + the sprite ghost + the path overlay.
			     `container-type: size` so the sprite's cqw/cqh resolve here exactly as they do on
			     the published page. Click the surface to drop a point; drag the dots to move them. -->
			<div
				class="stage"
				bind:this={stageEl}
				role="button"
				tabindex="0"
				aria-label="Path stage. Click or press Enter to append a point, arrow keys to move the selected point, Delete to remove it."
				onpointerdown={onStageDown}
				onkeydown={onStageKeydown}
			>
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
						onfocus={() => (selected = i)}
						ondblclick={(event) => {
							event.stopPropagation();
							deleteAt(i);
						}}
						onkeydown={onPointKeydown}
					>
						<span>{i + 1}</span>
					</button>
				{/each}
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
			<p class="hint" id="path-editor-hint">
				Scrub to preview the move. Click the stage or press Enter to append the next stop. Drag dots
				or use arrow keys to move them; Delete removes the selected point.
			</p>
			<p class="status" aria-live="polite">
				{pathStatus || `${waypoints.length} of ${MAX_PATH_WAYPOINTS} points used.`}
			</p>

			<div class="points">
				<div class="points__head">
					<span>Point {selected + 1} of {waypoints.length}</span>
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
		background:
			linear-gradient(90deg, oklch(0.24 0.065 281 / 0.24) 1px, transparent 1px),
			oklch(0.24 0.065 281 / 0.68);
		background-size: 8px 8px;
		cursor: pointer;
	}
	.panel {
		position: relative;
		display: grid;
		gap: 0.7rem;
		width: min(72rem, 100%);
		max-height: calc(100vh - 3rem);
		overflow-y: auto;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		box-shadow: var(--pixel-shadow);
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
		font-weight: 950;
		text-shadow: 0.08rem 0.08rem 0 var(--pixel-yellow);
	}
	.done {
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-magenta);
		box-shadow: 0.12rem 0.12rem 0 var(--pixel-ink);
		color: hsl(var(--primary-foreground));
		padding: 0.5rem 0.85rem;
		font-weight: 900;
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
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		box-shadow: 0.1rem 0.1rem 0 var(--pixel-ink);
		padding: 0.35rem 0.6rem;
		font-size: 0.82rem;
		font-weight: 850;
		color: hsl(var(--foreground));
	}
	.switcher button[aria-pressed='true'] {
		background: var(--pixel-green);
	}
	.path-tools {
		position: sticky;
		top: -1rem;
		z-index: 8;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.45rem;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		box-shadow: var(--pixel-shadow-sm);
		padding: 0.55rem 0.65rem;
	}
	.path-tools button {
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-yellow);
		box-shadow: 0.1rem 0.1rem 0 var(--pixel-ink);
		padding: 0.38rem 0.62rem;
		font-size: 0.78rem;
		font-weight: 900;
		color: var(--pixel-ink);
	}
	.path-tools button:nth-of-type(2) {
		background: var(--pixel-cyan);
	}
	.path-tools button:nth-of-type(3) {
		background: var(--pixel-paper);
	}
	.path-tools .danger {
		background: var(--pixel-magenta);
		color: hsl(var(--primary-foreground));
	}
	.path-tools button:disabled {
		opacity: 0.42;
	}
	.path-tools span {
		min-width: min(100%, 18rem);
		font-size: 0.72rem;
		font-weight: 760;
		color: hsl(var(--muted-foreground));
	}
	.stage {
		position: relative;
		container-type: size;
		aspect-ratio: 16 / 10;
		height: clamp(18rem, 52vh, 34rem);
		width: 100%;
		overflow: hidden;
		border: 3px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--zine-bg, hsl(var(--muted)));
		box-shadow: inset 0 0 0 3px oklch(0.24 0.065 281 / 0.12);
		touch-action: none;
		user-select: none;
	}
	.stage:focus-visible {
		outline: 3px solid var(--pixel-cyan);
		outline-offset: 2px;
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
		outline: 3px dashed var(--pixel-magenta);
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
		stroke: var(--pixel-magenta);
		stroke-width: 2;
		stroke-dasharray: 4 3;
		opacity: 0.85;
	}
	.ghost {
		fill: oklch(0.82 0.16 86 / 0.58);
		stroke: var(--pixel-ink);
		stroke-width: 1;
	}
	.marker {
		position: absolute;
		z-index: 4;
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-magenta);
		color: hsl(var(--primary-foreground));
		font-size: 0.7rem;
		font-weight: 800;
		transform: translate(-50%, -50%);
		cursor: grab;
		touch-action: none;
	}
	.marker.is-selected {
		background: var(--pixel-green);
		color: var(--pixel-ink);
		outline: 3px solid var(--pixel-yellow);
		outline-offset: 2px;
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
	.status {
		margin: -0.3rem 0 0;
		font-size: 0.74rem;
		font-weight: 700;
		color: hsl(var(--foreground));
	}
	.points {
		display: grid;
		gap: 0.55rem;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: oklch(0.97 0.02 82);
		box-shadow: var(--pixel-shadow-sm);
		padding: 0.7rem 0.8rem;
	}
	.points__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.8rem;
		font-weight: 750;
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
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		padding: 0.32rem 0.4rem;
		font-size: 0.76rem;
		font-weight: 850;
		color: hsl(var(--foreground));
	}
	.chips button[aria-pressed='true'] {
		background: var(--pixel-cyan);
	}
	button:focus-visible,
	input:focus-visible {
		outline: 3px solid var(--pixel-cyan);
		outline-offset: 2px;
	}
</style>
