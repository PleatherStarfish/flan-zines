// Pure scroll-progress → CSS for one element on a scene's timeline (scene-timeline.md
// §3, §8). Kept framework-free and side-effect-free so it is exhaustively unit-testable
// without a DOM, and so the SAME function powers the editor scrubber and the public
// page (author ≡ published). The renderer supplies the loaded effect impls; this module
// only composes phases.
import type { Element } from '../schema/document';
import type { EffectImpl } from '../animations/contract';
import type { Speed } from '../animations/schema';

export type EffectImplMap = Map<string, EffectImpl>;

export interface TimelineState {
	/** Fully faded out (opacity ~0) — used to drop pointer events. */
	hidden: boolean;
	/** Within the hold (fully entered, not yet leaving). */
	active: boolean;
	/** Inline style declaration; `''` means "no inline style" (neutral / static). */
	style: string;
}

// Ramp length as a fraction of the element's duration, keyed by the effect's `speed`
// knob. Slower = a longer fade/slide window as the reader scrolls. Exported so the
// timeline editor can draw each clip's enter/exit ramp at its REAL length and snap a
// dragged ramp back to a speed.
export const RAMP: Record<Speed, number> = { slow: 0.45, medium: 0.28, fast: 0.14 };
const DEFAULT_RAMP = RAMP.medium;

const NEUTRAL: TimelineState = { hidden: false, active: true, style: '' };

// Default appear ramp when an element has a narrowed range but no explicit enter/exit
// effect — so dragging a clip's duration is visibly meaningful before any effect is
// picked. Phase 1 = visible, 0 = gone.
const defaultRamp: EffectImpl = ({ phase }) => ({ opacity: clamp01(phase) });

function clamp01(n: number): number {
	return Math.max(0, Math.min(1, n));
}

/** The ramp length, as a fraction of an element's duration, an enter/exit effect uses. */
export function rampFraction(ref: Element['enter']): number {
	const speed = ref?.params?.speed;
	if (speed === 'slow' || speed === 'medium' || speed === 'fast') return RAMP[speed];
	return DEFAULT_RAMP;
}

function styleString(opacity: number, transforms: string[], hidden: boolean): string {
	const parts = [`opacity:${opacity.toFixed(3)}`];
	if (transforms.length) parts.push(`transform:${transforms.join(' ')}`);
	parts.push('transition:opacity 120ms ease-out');
	if (hidden) parts.push('pointer-events:none');
	return parts.join(';');
}

/**
 * Compose the inline style for `element` at the given scene scroll `progress` (0..1, or
 * `null`/`undefined` for "no scroll signal"). Returns NEUTRAL (no inline style, fully
 * visible) when reduced-motion is on, when there is no progress signal, or for a plain
 * full-range element with no effects — keeping simple scenes statically readable.
 */
export function composeElementStyle(
	element: Element,
	progress: number | null | undefined,
	impls: EffectImplMap,
	opts: { reducedMotion?: boolean; axis?: 'vertical' | 'horizontal' } = {}
): TimelineState {
	if (opts.reducedMotion || progress == null) return NEUTRAL;

	const { start, end } = element.range;
	// In a side-scroll scene the element's `range` is its POSITION along the track, not a
	// fade window — the stage pan reveals it physically — so we only apply effects the
	// author set explicitly, never the default appear/leave ramp.
	const horizontal = opts.axis === 'horizontal';
	const applyEnter = Boolean(element.enter) || (!horizontal && start > 0);
	const applyExit = Boolean(element.exit) || (!horizontal && end < 1);
	if (!applyEnter && !applyExit && !element.motion) return NEUTRAL;

	const duration = Math.max(end - start, 0.001);
	const cap = duration / 2; // never let enter and exit ramps overlap
	const enterRamp = Math.min(rampFraction(element.enter) * duration, cap);
	const exitRamp = Math.min(rampFraction(element.exit) * duration, cap);
	const enterEnd = start + enterRamp;
	const exitStart = end - exitRamp;

	const enterImpl = (element.enter && impls.get(element.enter.type)) || defaultRamp;
	const exitImpl = (element.exit && impls.get(element.exit.type)) || defaultRamp;
	const enterParams = element.enter?.params ?? {};
	const exitParams = element.exit?.params ?? {};

	let opacity = 1;
	const transforms: string[] = [];
	const apply = (s: { opacity?: number; transform?: string }): void => {
		if (s.opacity != null) opacity *= s.opacity;
		if (s.transform) transforms.push(s.transform);
	};

	if (applyEnter) {
		if (progress <= start) apply(enterImpl({ phase: 0, params: enterParams }));
		else if (progress < enterEnd)
			apply(enterImpl({ phase: (progress - start) / enterRamp, params: enterParams }));
	}
	if (applyExit) {
		if (progress >= end) apply(exitImpl({ phase: 0, params: exitParams }));
		else if (progress > exitStart)
			apply(exitImpl({ phase: 1 - (progress - exitStart) / exitRamp, params: exitParams }));
	}
	if (element.motion && progress >= start && progress <= end) {
		const motionImpl = impls.get(element.motion.type);
		if (motionImpl)
			apply(
				motionImpl({ phase: (progress - start) / duration, params: element.motion.params ?? {} })
			);
	}

	const hidden = opacity <= 0.001;
	const active = progress >= enterEnd && progress <= exitStart;
	return { hidden, active, style: styleString(opacity, transforms, hidden) };
}
