import { z } from 'zod';

// Keyframe path choreography — the schema/defaults shared by the registry and visual Path
// Editor. Runtime interpolation lives in path-runtime.ts so the reader's base bundle does
// not pull in the path implementation until a document actually uses it. A `path` motion
// moves an element between ordered CONTROL POINTS as the reader scrolls.
//
// This is the sanctioned exception to the "≤3 picture-chips, never a number/curve" effect
// rule: a path is authored by direct manipulation on a live stage, not knob chips.

export const PATH_EASINGS = ['linear', 'smooth', 'in', 'out', 'arc'] as const;
export const PathEaseSchema = z.enum(PATH_EASINGS);
export type PathEase = z.infer<typeof PathEaseSchema>;
export const MAX_PATH_WAYPOINTS = 12;

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
		waypoints: z.array(WaypointSchema).min(2).max(MAX_PATH_WAYPOINTS).default(DEFAULT_WAYPOINTS)
	})
	.superRefine((params, ctx) => {
		for (let i = 1; i < params.waypoints.length; i++) {
			if (params.waypoints[i].at <= params.waypoints[i - 1].at) {
				ctx.addIssue({
					code: 'custom',
					path: ['waypoints', i, 'at'],
					message: 'Waypoints must be in strictly increasing scroll order (`at`).'
				});
			}
		}
	});
export type PathParams = z.infer<typeof PathParamsSchema>;
