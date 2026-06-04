import { readable } from 'svelte/store';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * SSR-safe check of the user's reduced-motion preference.
 * Returns `false` on the server (no `window`).
 */
export function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
		return false;
	}
	return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * Reactive store tracking the reduced-motion preference. The animation system
 * (Step 4) subscribes to this so every preset can degrade. SSR-safe: starts `false`
 * and only attaches a media-query listener in the browser.
 */
export const reducedMotion = readable(prefersReducedMotion(), (set) => {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
		return;
	}
	const mql = window.matchMedia(REDUCED_MOTION_QUERY);
	const update = () => set(mql.matches);
	update();
	mql.addEventListener('change', update);
	return () => mql.removeEventListener('change', update);
});
