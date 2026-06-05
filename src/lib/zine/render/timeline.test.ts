import { describe, expect, it } from 'vitest';
import { composeElementStyle, rampFraction, RAMP, type EffectImplMap } from './timeline';
import type { EffectImpl } from '../animations/contract';
import type { Element } from '../schema/document';
import { fade, flyIn, rise } from '../animations/impls/appear';
import { parallax } from '../animations/impls/motion';
import { path } from '../animations/impls/path';

function element(over: Partial<Element>): Element {
	return {
		id: 'el_test',
		track: 'content',
		range: { start: 0, end: 1 },
		block: { id: 'blk', type: 'heading', props: { text: 'Hi', level: 2 } },
		...over
	} as Element;
}

const noImpls: EffectImplMap = new Map();

describe('composeElementStyle', () => {
	it('renders neutral (no inline style) under reduced motion', () => {
		const el = element({ range: { start: 0.5, end: 0.8 } });
		const state = composeElementStyle(el, 0.2, noImpls, { reducedMotion: true });
		expect(state.style).toBe('');
		expect(state.active).toBe(true);
	});

	it('renders neutral when there is no scroll signal', () => {
		const el = element({ range: { start: 0.5, end: 0.8 } });
		expect(composeElementStyle(el, undefined, noImpls).style).toBe('');
		expect(composeElementStyle(el, null, noImpls).style).toBe('');
	});

	it('keeps a full-range element with no effects static', () => {
		const el = element({ range: { start: 0, end: 1 } });
		expect(composeElementStyle(el, 0.5, noImpls).style).toBe('');
	});

	it('hides a narrowed-range element before its clip starts (default ramp)', () => {
		const el = element({ range: { start: 0.5, end: 0.8 } });
		const state = composeElementStyle(el, 0.2, noImpls);
		expect(state.hidden).toBe(true);
		expect(state.style).toContain('opacity:0.000');
		expect(state.style).toContain('pointer-events:none');
	});

	it('is fully visible during the hold', () => {
		const el = element({ range: { start: 0.3, end: 0.9 } });
		const state = composeElementStyle(el, 0.6, noImpls);
		expect(state.active).toBe(true);
		expect(state.hidden).toBe(false);
		expect(state.style).toContain('opacity:1.000');
	});

	it('applies a loaded enter effect during the enter ramp', () => {
		const el = element({
			range: { start: 0.2, end: 0.9 },
			enter: { type: 'rise', params: { speed: 'medium', amount: 'medium', direction: 'up' } }
		});
		const impls: EffectImplMap = new Map([['rise', rise as never]]);
		// Just inside the ramp: partially risen + partially faded.
		const state = composeElementStyle(el, 0.25, impls);
		expect(state.style).toMatch(/transform:translateY\([0-9.]+px\)/);
		expect(state.style).not.toContain('opacity:1.000');
	});

	it('applies motion across a full-range element without forcing a ramp', () => {
		const el = element({
			range: { start: 0, end: 1 },
			motion: { type: 'parallax', params: { speed: 'medium', amount: 'medium', direction: 'up' } }
		});
		const impls: EffectImplMap = new Map([['parallax', parallax as never]]);
		const state = composeElementStyle(el, 0.5, impls);
		expect(state.style).toContain('opacity:1.000');
		expect(state.style).toMatch(/transform:translateY/);
	});

	it('treats range as position (no default fade) in a side-scroll scene', () => {
		const el = element({ range: { start: 0.5, end: 0.8 } });
		// Vertical: a narrowed range fades out before its start.
		expect(composeElementStyle(el, 0.2, noImpls).hidden).toBe(true);
		// Horizontal: range is a position on the track — the pan reveals it — so no auto-fade.
		expect(composeElementStyle(el, 0.2, noImpls, { axis: 'horizontal' }).style).toBe('');
	});

	it('still plays explicit effects in a side-scroll scene', () => {
		const el = element({
			range: { start: 0.3, end: 0.9 },
			enter: { type: 'rise', params: { speed: 'medium', amount: 'medium', direction: 'up' } }
		});
		const impls: EffectImplMap = new Map([['rise', rise as never]]);
		const state = composeElementStyle(el, 0.35, impls, { axis: 'horizontal' });
		expect(state.style).toMatch(/transform:translateY\([0-9.]+px\)/);
	});

	it('exposes the ramp length for an effect speed', () => {
		expect(rampFraction({ type: 'fade', params: { speed: 'slow' } })).toBe(RAMP.slow);
		expect(rampFraction({ type: 'fade', params: { speed: 'fast' } })).toBe(RAMP.fast);
		expect(rampFraction(undefined)).toBe(RAMP.medium);
	});

	it('fly-in enters from a full viewport off the chosen edge', () => {
		// from the left: off the left edge at phase 0, settled at phase 1.
		expect(flyIn({ phase: 0, params: { speed: 'medium', direction: 'left' } }).transform).toMatch(
			/translateX\(-1\d\d(\.\d+)?vw\)/
		);
		expect(flyIn({ phase: 1, params: { speed: 'medium', direction: 'left' } }).transform).toBe(
			'translateX(-0.00vw)'
		);
		// from the top uses the vertical axis.
		expect(flyIn({ phase: 0, params: { speed: 'medium', direction: 'up' } }).transform).toMatch(
			/translateY\(-1\d\d(\.\d+)?vh\)/
		);
		// fly-in is a pure slide — no opacity fade.
		expect(
			flyIn({ phase: 0.5, params: { speed: 'medium', direction: 'left' } }).opacity
		).toBeUndefined();
	});

	it('falls back to the default ramp while an explicit effect impl is still loading', () => {
		const el = element({
			range: { start: 0.4, end: 0.9 },
			enter: { type: 'rise', params: { speed: 'medium', amount: 'medium', direction: 'up' } }
		});
		// Impl not yet in the map → default fade ramp keeps the clip meaningful, never broken.
		const state = composeElementStyle(el, 0.4, noImpls);
		expect(state.hidden).toBe(true);
		expect(state.style).toContain('opacity:0.000');
		expect(fade({ phase: 0, params: { speed: 'medium' } }).opacity).toBe(0);
	});

	it('drives a free element along its path motion (control points → transform)', () => {
		const el = element({
			placement: 'free',
			motion: {
				type: 'path',
				params: {
					waypoints: [
						{ at: 0, x: 10, y: 50, scale: 1, rotate: 0, ease: 'linear' },
						{ at: 1, x: 90, y: 50, scale: 1, rotate: 0, ease: 'linear' }
					]
				}
			}
		});
		const impls: EffectImplMap = new Map([['path', path as unknown as EffectImpl]]);
		expect(composeElementStyle(el, 0, impls).style).toContain('translate(calc(10.00cqw - 50%)');
		expect(composeElementStyle(el, 0.5, impls).style).toContain('translate(calc(50.00cqw - 50%)');
		expect(composeElementStyle(el, 1, impls).style).toContain('translate(calc(90.00cqw - 50%)');
	});
});
