// Lazy-loaded path-motion impl. A pure `phase → transform` like the other motion presets,
// but the transform comes from interpolating the element's authored waypoints (../path.ts).
// Transform-only; the heavy authoring lives in the editor, the render math is tiny.
import type { EffectImpl } from '../contract';
import type { PathParams } from '../path';
import { pathTransform, samplePath } from '../path-runtime';

export const path: EffectImpl<PathParams> = ({ phase, params }) => ({
	transform: pathTransform(samplePath(params.waypoints, phase))
});
