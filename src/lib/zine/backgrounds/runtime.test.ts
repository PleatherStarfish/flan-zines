import { describe, expect, it, vi } from 'vitest';
import { createBackgroundRuntime, type BackgroundRuntimeOptions } from './runtime';
import type { BackgroundReducedMotion } from './contract';

function harness(over: Partial<BackgroundRuntimeOptions> = {}) {
	const frame = vi.fn();
	const resize = vi.fn();
	const destroy = vi.fn();
	const instance = { frame, resize, destroy };
	const factory = { mount: vi.fn(() => instance) };

	let visibleCb: (v: boolean) => void = () => {};
	let resizeCb: () => void = () => {};
	let loopCb: ((t: number) => void) | null = null;
	const cancelFrame = vi.fn(() => {
		loopCb = null;
	});
	const stopIntersection = vi.fn();
	const stopResize = vi.fn();
	let nowValue = 0;
	const canvas = { width: 0, height: 0 } as HTMLCanvasElement;

	const runtime = createBackgroundRuntime({
		canvas,
		factory,
		params: {},
		fps: 30, // ~33.3ms interval
		reducedMotion: false,
		policy: 'still-frame' as BackgroundReducedMotion,
		getDynamic: () => ({ progress: 0.5, pointer: null, lowPower: false }),
		resizeDebounce: 0,
		deps: {
			requestFrame: (cb) => {
				loopCb = cb;
				return 1;
			},
			cancelFrame,
			observeIntersection: (_el, cb) => {
				visibleCb = cb;
				return stopIntersection;
			},
			observeResize: (_el, cb) => {
				resizeCb = cb;
				return stopResize;
			},
			measure: () => ({ width: 100, height: 50 }),
			dpr: () => 2,
			now: () => nowValue
		},
		...over
	});

	return {
		runtime,
		instance,
		factory,
		canvas,
		frame,
		resize,
		destroy,
		cancelFrame,
		stopIntersection,
		stopResize,
		show: (v: boolean) => visibleCb(v),
		fireResize: () => resizeCb(),
		tick: (t: number) => {
			nowValue = t;
			loopCb?.(t);
		}
	};
}

describe('createBackgroundRuntime', () => {
	it('mounts the factory once and does not draw until visible', () => {
		const h = harness();
		expect(h.factory.mount).toHaveBeenCalledTimes(1);
		expect(h.frame).not.toHaveBeenCalled();
	});

	it('sizes the canvas to DPR-capped device px on activate', () => {
		const h = harness();
		h.show(true);
		// 100×50 css × dpr 2 → 200×100 device px.
		expect(h.canvas.width).toBe(200);
		expect(h.canvas.height).toBe(100);
		expect(h.resize).toHaveBeenLastCalledWith(200, 100);
	});

	it('draws on each rAF tick, capped to the fps interval', () => {
		const h = harness();
		h.show(true);
		h.tick(0);
		expect(h.frame).toHaveBeenCalledTimes(1);
		h.tick(10); // < 33ms → throttled, no new draw
		expect(h.frame).toHaveBeenCalledTimes(1);
		h.tick(40); // ≥ 33ms → draws
		expect(h.frame).toHaveBeenCalledTimes(2);
	});

	it('feeds scroll progress and size into the frame', () => {
		const h = harness();
		h.show(true);
		h.tick(0);
		expect(h.frame).toHaveBeenLastCalledWith(
			expect.objectContaining({ progress: 0.5, width: 200, height: 100, reducedMotion: false })
		);
	});

	it('pauses the loop when scrolled off-screen', () => {
		const h = harness();
		h.show(true);
		h.show(false);
		expect(h.cancelFrame).toHaveBeenCalled();
	});

	it('reduced motion draws exactly one still frame and never loops', () => {
		const h = harness({ reducedMotion: true });
		h.show(true);
		expect(h.frame).toHaveBeenCalledTimes(1); // one still frame on activate
		h.tick(100); // no loop was scheduled
		expect(h.frame).toHaveBeenCalledTimes(1);
	});

	it('tears everything down on destroy', () => {
		const h = harness();
		h.show(true);
		h.tick(0);
		h.runtime.destroy();
		expect(h.cancelFrame).toHaveBeenCalled();
		expect(h.stopIntersection).toHaveBeenCalled();
		expect(h.stopResize).toHaveBeenCalled();
		expect(h.destroy).toHaveBeenCalledTimes(1);
	});
});
