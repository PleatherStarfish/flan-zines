// The background lifecycle runtime — one place that enforces every reliability rule from
// the Pudding perf/scrolly best-practices, so presets stay pure draws:
//   • mount near-viewport, pause off-screen (IntersectionObserver), and when the tab hides
//   • one rAF loop, FPS-capped (the Chromebook budget)
//   • size from the element's box in DPR-capped device px (never `vh`); resize debounced
//   • reduced-motion → a single still frame, no loop
//   • destroy → cancel rAF, disconnect observers, dispose the instance
// Browser APIs are injectable so this is unit-testable without a DOM.
import type { BackgroundFactory, BackgroundInstance, BackgroundReducedMotion } from './contract';

export interface BackgroundRuntimeDeps {
	requestFrame: (cb: (t: number) => void) => number;
	cancelFrame: (id: number) => void;
	/** Observe near-viewport visibility; returns a disconnect fn. */
	observeIntersection: (el: Element, cb: (visible: boolean) => void) => () => void;
	/** Observe size changes; returns a disconnect fn. */
	observeResize: (el: Element, cb: () => void) => () => void;
	measure: (el: HTMLElement) => { width: number; height: number };
	dpr: () => number;
	now: () => number;
}

export interface BackgroundDynamic {
	progress: number;
	pointer: { x: number; y: number } | null;
	lowPower: boolean;
	/** Resolved theme swatch colours (RGB) for theme-aware backgrounds; defaults to none. */
	palette?: [number, number, number][];
}

export interface BackgroundRuntimeOptions {
	canvas: HTMLCanvasElement;
	factory: BackgroundFactory;
	params: unknown;
	fps: number;
	reducedMotion: boolean;
	policy: BackgroundReducedMotion;
	getDynamic: () => BackgroundDynamic;
	/** ms; resize is debounced to avoid rebuild thrash (best-practice ~150ms). */
	resizeDebounce?: number;
	deps?: Partial<BackgroundRuntimeDeps>;
}

export interface BackgroundRuntime {
	destroy(): void;
}

function browserDeps(): BackgroundRuntimeDeps {
	return {
		requestFrame: (cb) => requestAnimationFrame(cb),
		cancelFrame: (id) => cancelAnimationFrame(id),
		observeIntersection: (el, cb) => {
			const io = new IntersectionObserver(
				(entries) => {
					for (const e of entries) cb(e.isIntersecting);
				},
				{ rootMargin: '200px' }
			);
			io.observe(el);
			return () => io.disconnect();
		},
		observeResize: (el, cb) => {
			const ro = new ResizeObserver(() => cb());
			ro.observe(el);
			return () => ro.disconnect();
		},
		measure: (el) => {
			const r = el.getBoundingClientRect();
			return { width: r.width, height: r.height };
		},
		dpr: () =>
			typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1,
		now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
	};
}

export function createBackgroundRuntime(opts: BackgroundRuntimeOptions): BackgroundRuntime {
	const deps = { ...browserDeps(), ...opts.deps };
	const { canvas, fps, reducedMotion, policy, getDynamic } = opts;
	const interval = fps > 0 ? 1000 / fps : 0;
	const debounceMs = opts.resizeDebounce ?? 150;

	const instance: BackgroundInstance = opts.factory.mount(canvas, opts.params);
	const startTime = deps.now();

	let raf = 0;
	let lastDraw = -Infinity;
	let visible = false;
	let resizeTimer: ReturnType<typeof setTimeout> | null = null;
	let destroyed = false;

	function size(): void {
		const { width, height } = deps.measure(canvas);
		const ratio = Math.min(Math.max(deps.dpr(), 1), 2);
		const dw = Math.max(1, Math.round(width * ratio));
		const dh = Math.max(1, Math.round(height * ratio));
		if (dw !== canvas.width || dh !== canvas.height) {
			canvas.width = dw;
			canvas.height = dh;
		}
		instance.resize(canvas.width, canvas.height);
	}

	function draw(t: number): void {
		const dyn = getDynamic();
		instance.frame({
			progress: dyn.progress,
			pointer: dyn.pointer,
			lowPower: dyn.lowPower,
			palette: dyn.palette ?? [],
			width: canvas.width,
			height: canvas.height,
			time: t - startTime,
			reducedMotion
		});
	}

	function loop(t: number): void {
		raf = deps.requestFrame(loop);
		if (t - lastDraw < interval) return;
		lastDraw = t;
		draw(t);
	}

	function startLoop(): void {
		if (raf || destroyed) return;
		raf = deps.requestFrame(loop);
	}

	function stopLoop(): void {
		if (raf) {
			deps.cancelFrame(raf);
			raf = 0;
		}
	}

	function activate(): void {
		visible = true;
		size();
		if (reducedMotion) {
			// One still frame (unless the preset opts fully off), then no loop.
			if (policy !== 'off') draw(deps.now());
			return;
		}
		startLoop();
	}

	function deactivate(): void {
		visible = false;
		stopLoop();
	}

	const stopIntersection = deps.observeIntersection(canvas, (isVisible) => {
		if (isVisible) activate();
		else deactivate();
	});

	const stopResize = deps.observeResize(canvas, () => {
		if (resizeTimer) clearTimeout(resizeTimer);
		resizeTimer = setTimeout(() => {
			resizeTimer = null;
			if (!visible) return;
			size();
			if (reducedMotion && policy !== 'off') draw(deps.now());
		}, debounceMs);
	});

	// Pause when the tab is backgrounded (saves frames/battery); resume when visible.
	const onVisibility =
		typeof document !== 'undefined'
			? () => {
					if (document.visibilityState === 'hidden') stopLoop();
					else if (visible && !reducedMotion) startLoop();
				}
			: null;
	if (onVisibility) document.addEventListener('visibilitychange', onVisibility);

	return {
		destroy() {
			destroyed = true;
			stopLoop();
			if (resizeTimer) clearTimeout(resizeTimer);
			stopIntersection();
			stopResize();
			if (onVisibility) document.removeEventListener('visibilitychange', onVisibility);
			instance.destroy();
		}
	};
}
