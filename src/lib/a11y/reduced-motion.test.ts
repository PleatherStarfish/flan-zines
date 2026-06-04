import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { REDUCED_MOTION_QUERY, prefersReducedMotion, reducedMotion } from './reduced-motion';

describe('reduced-motion', () => {
	it('exposes the standard media query', () => {
		expect(REDUCED_MOTION_QUERY).toBe('(prefers-reduced-motion: reduce)');
	});

	it('is SSR-safe and defaults to false when there is no window', () => {
		// The vitest "node" environment has no window/matchMedia, standing in for SSR.
		expect(prefersReducedMotion()).toBe(false);
		expect(get(reducedMotion)).toBe(false);
	});
});
