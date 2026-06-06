import type { PathEase, Waypoint } from './path';

export interface PathSample {
	x: number;
	y: number;
	scale: number;
	rotate: number;
}

export interface PathSegmentMetric {
	index: number;
	distance: number;
	scrollSpan: number;
}

const EPSILON_AT = 0.001;

function finiteOr(value: number | undefined, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
	return clamp(value, 0, 1);
}

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

function roundAt(value: number): number {
	return Math.round(value * 1000) / 1000;
}

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

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
	const t2 = t * t;
	const t3 = t2 * t;
	return (
		0.5 *
		(2 * p1 +
			(-p0 + p2) * t +
			(2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
			(-p0 + 3 * p1 - 3 * p2 + p3) * t3)
	);
}

function cloneWaypoint(w: Waypoint): Waypoint {
	return {
		at: clamp01(finiteOr(w.at, 0)),
		x: finiteOr(w.x, 50),
		y: finiteOr(w.y, 50),
		scale: finiteOr(w.scale, 1),
		rotate: finiteOr(w.rotate, 0),
		ease: w.ease ?? 'smooth'
	};
}

export function normalizeWaypoints(waypoints: Waypoint[]): Waypoint[] {
	return waypoints.map(cloneWaypoint);
}

function segmentPoint(
	list: Waypoint[],
	segmentEndIndex: number,
	t: number
): { x: number; y: number } {
	const a = list[segmentEndIndex - 1];
	const b = list[segmentEndIndex];
	const te = easeT(b.ease, clamp01(t));
	let x = lerp(a.x, b.x, te);
	let y = lerp(a.y, b.y, te);

	if (b.ease === 'smooth' && list.length > 2) {
		const p0 = list[Math.max(0, segmentEndIndex - 2)];
		const p3 = list[Math.min(list.length - 1, segmentEndIndex + 1)];
		x = catmullRom(p0.x, a.x, b.x, p3.x, te);
		y = catmullRom(p0.y, a.y, b.y, p3.y, te);
	}

	if (b.ease === 'arc') {
		// A parabola peaking at the segment midpoint; taller for longer leaps. Lifts the
		// element up (smaller y) so it arcs over the gap before landing.
		const lift = Math.min(45, Math.max(14, Math.abs(b.x - a.x) * 0.55));
		y -= lift * 4 * t * (1 - t);
	}

	return { x, y };
}

/**
 * The element's position/scale/rotation at scroll `phase` (0..1 across its on-screen hold),
 * interpolated between surrounding waypoints. `smooth` uses a Catmull-Rom curve through the
 * authored points, so the drawn route and draggable handles stay attached.
 */
export function samplePath(waypoints: Waypoint[], phase: number): PathSample {
	if (waypoints.length === 0) return { x: 50, y: 50, scale: 1, rotate: 0 };

	const list = normalizeWaypoints(waypoints);
	const p = clamp01(finiteOr(phase, 0));
	const first = list[0];
	const last = list[list.length - 1];
	if (p <= first.at || list.length === 1) {
		return { x: first.x, y: first.y, scale: first.scale, rotate: first.rotate };
	}
	if (p >= last.at) return { x: last.x, y: last.y, scale: last.scale, rotate: last.rotate };

	let segmentEndIndex = list.length - 1;
	for (let i = 1; i < list.length; i++) {
		if (p <= list[i].at) {
			segmentEndIndex = i;
			break;
		}
	}

	const a = list[segmentEndIndex - 1];
	const b = list[segmentEndIndex];
	const span = b.at - a.at;
	const t = span <= 0 ? 1 : clamp01((p - a.at) / span);
	const te = easeT(b.ease, t);
	const point = segmentPoint(list, segmentEndIndex, t);

	return {
		x: point.x,
		y: point.y,
		scale: lerp(a.scale, b.scale, te),
		rotate: lerp(a.rotate, b.rotate, te)
	};
}

export function pathSvgD(waypoints: Waypoint[], samplesPerSegment = 16): string {
	const list = normalizeWaypoints(waypoints);
	if (list.length === 0) return '';

	const parts = [`M${list[0].x.toFixed(2)},${list[0].y.toFixed(2)}`];
	const steps = Math.max(1, Math.floor(samplesPerSegment));
	for (let i = 1; i < list.length; i++) {
		const a = list[i - 1];
		const b = list[i];
		for (let step = 1; step <= steps; step++) {
			const at = a.at + (b.at - a.at) * (step / steps);
			const sample = step === steps ? b : samplePath(list, at);
			parts.push(`L${sample.x.toFixed(2)},${sample.y.toFixed(2)}`);
		}
	}
	return parts.join(' ');
}

function distance(a: Waypoint, b: Waypoint): number {
	return Math.hypot(b.x - a.x, b.y - a.y);
}

export function pathSegmentMetrics(waypoints: Waypoint[]): PathSegmentMetric[] {
	const list = normalizeWaypoints(waypoints);
	return list.slice(1).map((b, index) => {
		const a = list[index];
		return {
			index,
			distance: distance(a, b),
			scrollSpan: Math.max(EPSILON_AT, b.at - a.at)
		};
	});
}

/**
 * Redistribute waypoint `at` values by cumulative route distance. The visual editor uses this
 * after spatial edits so equal-looking moves take roughly equal scroll time; authors can still
 * override individual timing with the explicit "When" slider.
 */
export function retimeWaypointsByDistance(waypoints: Waypoint[]): Waypoint[] {
	const list = waypoints.map(cloneWaypoint);
	if (list.length <= 1) return list;

	const distances = [0];
	for (let i = 1; i < list.length; i++) {
		distances[i] = distances[i - 1] + distance(list[i - 1], list[i]);
	}

	const total = distances[distances.length - 1];
	const maxMiddleAt = (index: number) => 1 - (list.length - 1 - index) * EPSILON_AT;
	const next = list.map((point, index) => {
		if (index === 0) return { ...point, at: 0 };
		if (index === list.length - 1) return { ...point, at: 1 };
		const raw = total > EPSILON_AT ? distances[index] / total : index / (list.length - 1);
		return {
			...point,
			at: clamp(roundAt(raw), index * EPSILON_AT, maxMiddleAt(index))
		};
	});

	for (let i = 1; i < next.length; i++) {
		if (next[i].at <= next[i - 1].at) {
			next[i].at =
				i === next.length - 1 ? 1 : Math.min(maxMiddleAt(i), next[i - 1].at + EPSILON_AT);
		}
	}
	return next;
}
