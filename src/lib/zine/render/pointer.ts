import { readable } from 'svelte/store';

export type PointerPos = { x: number; y: number } | null;

/**
 * A viewport-normalized cursor position (0..1), shared by every interactive background so
 * the page has ONE pointer listener. SSR-safe (starts `null`). Disabled on coarse pointers
 * (touch) so a sketch never gets a phantom hover — touch must not carry required meaning
 * (responsive-and-performance.md §8). rAF-throttled so fast mouse moves don't thrash.
 */
export const pointer = readable<PointerPos>(null, (set) => {
	if (typeof window === 'undefined') return;
	if (window.matchMedia?.('(pointer: coarse)')?.matches) return; // touch → no pointer signal

	let frame = 0;
	let pending: PointerPos = null;

	const flush = () => {
		frame = 0;
		set(pending);
	};
	const onMove = (event: PointerEvent) => {
		pending = {
			x: event.clientX / (window.innerWidth || 1),
			y: event.clientY / (window.innerHeight || 1)
		};
		if (!frame) frame = requestAnimationFrame(flush);
	};
	const onLeave = () => {
		pending = null;
		if (!frame) frame = requestAnimationFrame(flush);
	};

	window.addEventListener('pointermove', onMove, { passive: true });
	document.documentElement.addEventListener('mouseleave', onLeave);
	window.addEventListener('blur', onLeave);

	return () => {
		if (frame) cancelAnimationFrame(frame);
		window.removeEventListener('pointermove', onMove);
		document.documentElement.removeEventListener('mouseleave', onLeave);
		window.removeEventListener('blur', onLeave);
	};
});
