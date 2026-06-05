import { z } from 'zod';

// Keyframe path choreography — the data + pure math shared by the renderer (via the lazy
// impl) and the visual Path Editor. A `path` motion moves an element between ordered
// CONTROL POINTS as the reader scrolls: each waypoint is a position in scene-stage % at a
// scroll position (`at`), with an easing for the segment ending at it. `arc` adds a
// parabolic lift — a natural jump (scene-timeline.md: "jump up to the platform").
//
// This is the sanctioned exception to the "≤3 picture-chips, never a number/curve" effect
// rule: a path is authored by direct manipulation on a live stage, not knob chips.

export const PATH_EASINGS = ['linear', 'smooth', 'in', 'out', 'arc'] as const;
export const PathEaseSchema = z.enum(PATH_EASINGS);
export type PathEase = z.infer<typeof PathEaseSchema>;

// A control point. `x`/`y` are % of the scene stage (0,0 = top-left; 50,50 = centre). A
// little past the edges is allowed so an element can enter/leave off-screen.
export const WaypointSchema = z.object({
	at: z.number().min(0).max(1),
	x: z.number().min(-50).max(150),
	y: z.number().min(-50).max(150),
	scale: z.number().min(0.1).max(4).default(1),
	rotate: z.number().min(-360).max(360).default(0),
	ease: PathEaseSchema.default('smooth')
});
export type Waypoint = z.infer<typeof WaypointSchema>;

// A gentle left→right drift across the centre — a sensible starting path before the author
// opens the editor. Fully-shaped (every field present) so it passes as a schema default.
export const DEFAULT_WAYPOINTS: Waypoint[] = [
	{ at: 0, x: 22, y: 50, scale: 1, rotate: 0, ease: 'smooth' },
	{ at: 1, x: 78, y: 50, scale: 1, rotate: 0, ease: 'smooth' }
];

export const PathParamsSchema = z
	.object({
		waypoints: z.array(WaypointSchema).min(2).max(12).default(DEFAULT_WAYPOINTS)
	})
	.superRefine((params, ctx) => {
		for (let i = 1; i < params.waypoints.length; i++) {
			if (params.waypoints[i].at < params.waypoints[i - 1].at) {
				ctx.addIssue({
					code: 'custom',
					path: ['waypoints', i, 'at'],
					message: 'Waypoints must be ordered by scroll position (`at`).'
				});
			}
		}
	});
export type PathParams = z.infer<typeof PathParamsSchema>;

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

// Eased local progress for a segment. `arc` returns linear here — its parabolic lift is
// applied separately to `y` so the element rises and falls (a jump), not its timing.
function easeT(ease: PathEase, t: number): number {
	switch (ease) {
		case 'smooth':
			return t * t * (3 - 2 * t); // smoothstep
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
 * interpolated between the surrounding waypoints with the segment's easing. Pure and
 * framework-free, so the renderer impl and the editor's path overlay agree exactly. Phase
 * outside the waypoints' `at` range clamps to the first/last point.
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
 * A CSS transform that places an element's CENTRE at the sampled stage point. Uses
 * container-query units so it's responsive: `Xcqw`/`Ycqh` are % of the stage (the
 * `.zine-stage-overlay`, which is `container-type: size`), and `- 50%` centres the element
 * on the point. Transform-only → GPU-composited, the effect-system safety boundary.
 */
export function pathTransform(sample: PathSample): string {
	const parts = [
		`translate(calc(${sample.x.toFixed(2)}cqw - 50%), calc(${sample.y.toFixed(2)}cqh - 50%))`
	];
	if (Math.abs(sample.scale - 1) > 0.001) parts.push(`scale(${sample.scale.toFixed(3)})`);
	if (Math.abs(sample.rotate) > 0.001) parts.push(`rotate(${sample.rotate.toFixed(1)}deg)`);
	return parts.join(' ');
}
