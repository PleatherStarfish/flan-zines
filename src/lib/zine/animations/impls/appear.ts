// Appear / Leave impls (scene-timeline.md §5). Dynamically imported by the registry so
// they never enter a text-only zine's base bundle. Each is a PURE phase → style
// function with the shared appear convention: phase 1 = neutral/visible, phase 0 =
// hidden/offset. The same function therefore powers both the `enter` and `exit` slots.
// Transform/opacity ONLY.
import type { EffectImpl } from '../contract';
import type { FadeParams, FlyInParams, PopParams, RiseParams, SlideParams } from '../schema';

const DISTANCE = { subtle: 16, medium: 36, strong: 72 } as const; // px travel
const SCALE_FROM = { subtle: 0.94, medium: 0.86, strong: 0.7 } as const;

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

export const fade: EffectImpl<FadeParams> = ({ phase }) => ({ opacity: clamp01(phase) });

export const rise: EffectImpl<RiseParams> = ({ phase, params }) => {
	const p = clamp01(phase);
	// `up` rises in from below (starts at +y, settles to 0); `down` sinks in from above.
	const sign = params.direction === 'down' ? -1 : 1;
	const y = (1 - p) * DISTANCE[params.amount] * sign;
	return { opacity: p, transform: `translateY(${y.toFixed(2)}px)` };
};

export const slide: EffectImpl<SlideParams> = ({ phase, params }) => {
	const p = clamp01(phase);
	const d = DISTANCE[params.amount] * (1 - p);
	const offset: Record<SlideParams['direction'], [number, number]> = {
		up: [0, d],
		down: [0, -d],
		left: [d, 0],
		right: [-d, 0]
	};
	const [x, y] = offset[params.direction];
	return { opacity: p, transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)` };
};

export const pop: EffectImpl<PopParams> = ({ phase, params }) => {
	const p = clamp01(phase);
	const from = SCALE_FROM[params.amount];
	const scale = from + (1 - from) * p;
	return { opacity: p, transform: `scale(${scale.toFixed(3)})` };
};

// Starts a whole viewport off the chosen edge (phase 0) and scrolls fully on (phase 1).
// `direction` is the edge it comes FROM: left/right → x, up=top / down=bottom → y. Travel
// is in vw/vh so it clears the screen; the scene's overflow clips it while off.
export const flyIn: EffectImpl<FlyInParams> = ({ phase, params }) => {
	const off = 1 - clamp01(phase); // 1 = off-screen, 0 = in place
	const dist = (off * 110).toFixed(2); // 110% of the viewport, so it's safely off-edge
	switch (params.direction) {
		case 'right':
			return { transform: `translateX(${dist}vw)` };
		case 'up':
			return { transform: `translateY(-${dist}vh)` };
		case 'down':
			return { transform: `translateY(${dist}vh)` };
		case 'left':
		default:
			return { transform: `translateX(-${dist}vw)` };
	}
};
