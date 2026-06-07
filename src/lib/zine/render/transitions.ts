// Pure scene-continuity math: given where each scene sits in the viewport, decide how opaque
// each scene's BACKDROP layer should be, so consecutive scenes CROSSFADE as the reader scrolls
// (the Pudding "persistent backdrop" feel) instead of hard-cutting at a section boundary.
// Framework-free + side-effect-free, so the SAME function powers the reader and the editor
// preview (author ≡ published) and is exhaustively unit-testable without a DOM.
//
// Model: consecutive scenes get a soft TRANSITION CORRIDOR around their meeting point. For
// stacked scenes it is the usual focus-window band around the shared edge; when we add
// breathing room between sections, the corridor expands to cover the whole gap as well. That
// keeps the crossfade slow enough to read instead of compressing it into the tiny middle of the
// gap. At most two scenes are ever non-zero, so the renderer keeps ≤2 canvas runtimes live at a
// seam.

export type Pacing = 'tight' | 'cozy' | 'roomy';
export const PACINGS = ['tight', 'cozy', 'roomy'] as const;

export interface SceneMeasure {
	id: string;
	/** Viewport-relative top of the scene section, in px. */
	top: number;
	/** Viewport-relative bottom of the scene section, in px. */
	bottom: number;
}

export interface BackdropSlot {
	id: string;
	/** 0..1 layer opacity for this scene's backdrop. */
	opacity: number;
}

// Focus-window half-height as a fraction of the viewport, per pacing. Larger = softer, longer
// crossfade and more breathing room.
const BAND_FRACTION: Record<Pacing, number> = { tight: 0.12, cozy: 0.22, roomy: 0.34 };
// Extra scroll space inserted BETWEEN scenes (in viewport-heights) so content isn't cramped.
const GAP_SCREENS: Record<Pacing, number> = { tight: 0.25, cozy: 0.5, roomy: 0.85 };

function clamp01(n: number): number {
	return n < 0 ? 0 : n > 1 ? 1 : n;
}

function slotsForPair(scenes: SceneMeasure[], from: number, to: number, f: number): BackdropSlot[] {
	return scenes.map((s, i) => ({ id: s.id, opacity: i === from ? 1 - f : i === to ? f : 0 }));
}

function distanceToScene(scene: SceneMeasure, c: number): number {
	if (c < scene.top) return scene.top - c;
	if (c > scene.bottom) return c - scene.bottom;
	return 0;
}

/** Focus-window half-height in px for a viewport height + pacing. */
export function bandHalfHeight(vh: number, pacing: Pacing = 'cozy'): number {
	return Math.max(1, vh * BAND_FRACTION[pacing]);
}

/** Breathing-room gap between scenes, in viewport-heights, for a pacing preset. */
export function gapScreens(pacing: Pacing = 'cozy'): number {
	return GAP_SCREENS[pacing];
}

/**
 * Per-scene backdrop opacity from the scenes' viewport positions. Returns one slot per input
 * scene (same order). The non-zero slots sum to 1 (a clean crossfade); if the viewport centre
 * sits outside all scene transition corridors, the containing/nearest scene gets full opacity
 * so the backdrop is never blank.
 */
export function backdropPlan(
	scenes: SceneMeasure[],
	vh: number,
	pacing: Pacing = 'cozy'
): BackdropSlot[] {
	if (scenes.length === 0) return [];
	if (scenes.length === 1) return [{ id: scenes[0].id, opacity: 1 }];

	const c = vh / 2;
	const B = bandHalfHeight(vh, pacing);

	let bestTransition:
		| { from: number; to: number; start: number; end: number; center: number }
		| undefined;
	for (let i = 0; i < scenes.length - 1; i += 1) {
		const from = scenes[i];
		const to = scenes[i + 1];
		const center = (from.bottom + to.top) / 2;
		let start = from.bottom - B;
		let end = to.top + B;
		if (end <= start) {
			// Defensive fallback for overlapping/very unusual scene rects: keep a normal 2B
			// corridor centred between the two edges instead of dividing by a negative span.
			start = center - B;
			end = center + B;
		}
		if (c < start || c > end) continue;
		const candidate = { from: i, to: i + 1, start, end, center };
		if (!bestTransition || Math.abs(c - center) < Math.abs(c - bestTransition.center)) {
			bestTransition = candidate;
		}
	}

	if (bestTransition) {
		const f = clamp01(
			(c - bestTransition.start) / Math.max(1, bestTransition.end - bestTransition.start)
		);
		return slotsForPair(scenes, bestTransition.from, bestTransition.to, f);
	}

	// In the stable middle of a scene — or beyond the document ends — keep the containing/nearest
	// scene fully lit so the backdrop never goes blank.
	let only = 0;
	scenes.forEach((scene, i) => {
		if (distanceToScene(scene, c) < distanceToScene(scenes[only], c)) only = i;
	});
	return scenes.map((s, i) => ({ id: s.id, opacity: i === only ? 1 : 0 }));
}
