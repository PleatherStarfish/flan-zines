import type { PathEase, Waypoint } from './path';

export interface PathSample {
	x: number;
	y: number;
	scale: number;
	rotate: number;
}

function clamp01(n: number): number {
	return n < 0 ? 0 : n > 1 ? 1 : n;
}

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

// Eased local progress for a segment. `arc` returns linear here; its parabolic lift is
// applied separately to `y` so the element rises and falls, not its timing.
function easeT(ease: PathEase, t: number): number {
	switch (ease) {
		case 'smooth':
			return t * t * (3 - 2 * t);
		case 'in':
			return t * t;
		case 'out':
			return t * (2 - t);
		case 'arc':
		case 'linear':
		default:
			return t;
	}
}

/**
 * The element's position/scale/rotation at scroll `phase` (0..1 across its on-screen hold),
 * interpolated between the surrounding waypoints with the segment's easing. Phase outside
 * the waypoints' `at` range clamps to the first/last point.
 */
export function samplePath(waypoints: Waypoint[], phase: number): PathSample {
	if (waypoints.length === 0) return { x: 50, y: 50, scale: 1, rotate: 0 };
	const p = clamp01(phase);
	const first = waypoints[0];
	const last = waypoints[waypoints.length - 1];
	if (p <= first.at) return { x: first.x, y: first.y, scale: first.scale, rotate: first.rotate };
	if (p >= last.at) return { x: last.x, y: last.y, scale: last.scale, rotate: last.rotate };

	let a = first;
	let b = last;
	for (let i = 1; i < waypoints.length; i++) {
		if (p <= waypoints[i].at) {
			a = waypoints[i - 1];
			b = waypoints[i];
			break;
		}
	}
	const span = b.at - a.at;
	const t = span <= 0 ? 1 : (p - a.at) / span;
	const te = easeT(b.ease, t);

	let y = lerp(a.y, b.y, te);
	if (b.ease === 'arc') {
		// A parabola peaking at the segment midpoint; taller for longer leaps. Lifts the
		// element up (smaller y) so it arcs over the gap before landing.
		const lift = Math.min(45, Math.max(14, Math.abs(b.x - a.x) * 0.55));
		y -= lift * 4 * t * (1 - t);
	}
	return {
		x: lerp(a.x, b.x, te),
		y,
		scale: lerp(a.scale, b.scale, te),
		rotate: lerp(a.rotate, b.rotate, te)
	};
}

/**
 * A CSS transform that places an element's centre at the sampled stage point. Uses
 * container-query units so `Xcqw`/`Ycqh` are percentages of the `.zine-stage-overlay`.
 */
export function pathTransform(sample: PathSample): string {
	const parts = [
		`translate(calc(${sample.x.toFixed(2)}cqw - 50%), calc(${sample.y.toFixed(2)}cqh - 50%))`
	];
	if (Math.abs(sample.scale - 1) > 0.001) parts.push(`scale(${sample.scale.toFixed(3)})`);
	if (Math.abs(sample.rotate) > 0.001) parts.push(`rotate(${sample.rotate.toFixed(1)}deg)`);
	return parts.join(' ');
}
