// Keep-moving impls (scene-timeline.md §5). Dynamically imported by the registry. Each
// is a PURE function of `phase` (0..1 across the element's on-screen hold) and returns a
// transform ONLY (opacity left to the enter/exit ramps). Transform-only keeps every
// preset on the GPU compositor — the performance boundary from
// responsive-and-performance.md.
import type { EffectImpl } from '../contract';
import type { FloatParams, KenBurnsParams, ParallaxParams } from '../schema';

const TRAVEL = { subtle: 24, medium: 56, strong: 110 } as const; // px total
const FLOAT_AMP = { subtle: 6, medium: 12, strong: 22 } as const;
const FLOAT_CYCLES = { slow: 1, medium: 2, fast: 3 } as const;
const ZOOM = { subtle: 0.06, medium: 0.12, strong: 0.2 } as const;

export const parallax: EffectImpl<ParallaxParams> = ({ phase, params }) => {
	// Travels through ±travel/2 across the hold; `up` drifts upward as the reader scrolls.
	const sign = params.direction === 'down' ? 1 : -1;
	const y = sign * (0.5 - phase) * TRAVEL[params.amount];
	return { transform: `translateY(${y.toFixed(2)}px)` };
};

export const float: EffectImpl<FloatParams> = ({ phase, params }) => {
	const y = Math.sin(phase * Math.PI * 2 * FLOAT_CYCLES[params.speed]) * FLOAT_AMP[params.amount];
	return { transform: `translateY(${y.toFixed(2)}px)` };
};

export const kenBurns: EffectImpl<KenBurnsParams> = ({ phase, params }) => {
	const scale = 1 + ZOOM[params.amount] * Math.max(0, Math.min(1, phase));
	return { transform: `scale(${scale.toFixed(3)})` };
};
