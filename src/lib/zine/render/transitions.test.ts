import { describe, expect, it } from 'vitest';
import { backdropPlan, bandHalfHeight, gapScreens, type SceneMeasure } from './transitions';

const vh = 1000;
// helper: place scene `i` as a viewport-tall section, scrolled up by `scroll` px.
function stack(count: number, scroll: number, sceneH = vh): SceneMeasure[] {
	return Array.from({ length: count }, (_, i) => {
		const top = i * sceneH - scroll;
		return { id: `s${i}`, top, bottom: top + sceneH };
	});
}
// helper: scenes separated by a breathing-room GAP (margin) between sections.
function gapped(count: number, scroll: number, sceneH = vh, gap = vh * 0.5): SceneMeasure[] {
	return Array.from({ length: count }, (_, i) => {
		const top = i * (sceneH + gap) - scroll;
		return { id: `s${i}`, top, bottom: top + sceneH };
	});
}
function gappedAtFocus(
	worldCenter: number,
	count = 3,
	sceneH = vh,
	gap = vh * 0.5
): SceneMeasure[] {
	return gapped(count, worldCenter - vh / 2, sceneH, gap);
}
const opacity = (slots: { id: string; opacity: number }[], id: string) =>
	slots.find((s) => s.id === id)!.opacity;

describe('backdropPlan', () => {
	it('shows a single scene fully', () => {
		expect(backdropPlan([{ id: 's0', top: 0, bottom: vh }], vh)).toEqual([
			{ id: 's0', opacity: 1 }
		]);
	});

	it('is fully opaque on the centred scene and dark on the others', () => {
		// scene 0 centred (scroll = 0), scene 1 a full viewport below
		const slots = backdropPlan(stack(2, 0), vh);
		expect(opacity(slots, 's0')).toBe(1);
		expect(opacity(slots, 's1')).toBe(0);
	});

	it('crossfades to ~50/50 at the boundary between two scenes', () => {
		// scroll so the boundary between scene 0 and 1 sits at the viewport centre
		const slots = backdropPlan(stack(2, vh / 2), vh);
		expect(opacity(slots, 's0')).toBeCloseTo(0.5, 1);
		expect(opacity(slots, 's1')).toBeCloseTo(0.5, 1);
	});

	it('non-zero layers always sum to 1 (a clean crossfade, no dip)', () => {
		for (let scroll = 0; scroll <= 3 * vh; scroll += 137) {
			const slots = backdropPlan(stack(4, scroll), vh);
			const total = slots.reduce((sum, s) => sum + s.opacity, 0);
			expect(total).toBeCloseTo(1, 5);
		}
	});

	it('keeps at most two layers non-zero at any scroll position (≤2 live runtimes)', () => {
		for (let scroll = -vh; scroll <= 5 * vh; scroll += 53) {
			const slots = backdropPlan(stack(5, scroll), vh, 'roomy');
			expect(slots.filter((s) => s.opacity > 0.0001).length).toBeLessThanOrEqual(2);
		}
	});

	it('a softer pacing widens the crossfade band', () => {
		expect(bandHalfHeight(vh, 'roomy')).toBeGreaterThan(bandHalfHeight(vh, 'tight'));
		expect(gapScreens('roomy')).toBeGreaterThan(gapScreens('cozy'));
		expect(gapScreens('cozy')).toBeGreaterThan(gapScreens('tight'));
	});

	it('never goes blank past the document ends (nearest scene wins)', () => {
		// scrolled far past the last scene → the last scene stays lit
		const slots = backdropPlan(stack(3, 10 * vh), vh);
		expect(opacity(slots, 's2')).toBe(1);
		const total = slots.reduce((sum, s) => sum + s.opacity, 0);
		expect(total).toBe(1);
	});

	it('returns one slot per scene, in order', () => {
		const slots = backdropPlan(stack(3, vh), vh);
		expect(slots.map((s) => s.id)).toEqual(['s0', 's1', 's2']);
	});

	// Regression: with breathing-room GAPS (wider than the band), the focus window can fall
	// entirely in the gap and overlap neither scene — it must still CROSSFADE across the gap,
	// not hard-cut to the nearest scene.
	describe('crossfade bridges the breathing-room gap', () => {
		const gap = vh * 0.6; // wider than any band → the window can sit fully inside it

		it('crossfades ~50/50 at the middle of the gap between two scenes', () => {
			// scene 0: [0, vh]; gap: [vh, vh+gap]; scene 1: [vh+gap, ...]. Put the gap middle at
			// the viewport centre: scroll so (vh + gap/2) maps to vh/2.
			const scroll = vh + gap / 2 - vh / 2;
			const slots = backdropPlan(gapped(3, scroll, vh, gap), vh);
			expect(opacity(slots, 's0')).toBeCloseTo(0.5, 1);
			expect(opacity(slots, 's1')).toBeCloseTo(0.5, 1);
		});

		it('keeps sum=1 and ≤2 non-zero across a full scroll WITH gaps (no hard cut)', () => {
			let everSawTwo = false;
			for (let scroll = 0; scroll <= 5 * (vh + gap); scroll += 41) {
				const slots = backdropPlan(gapped(4, scroll, vh, gap), vh, 'tight');
				const nonZero = slots.filter((s) => s.opacity > 0.0001);
				expect(nonZero.length).toBeLessThanOrEqual(2);
				const total = slots.reduce((sum, s) => sum + s.opacity, 0);
				expect(total).toBeCloseTo(1, 5);
				if (nonZero.length === 2) everSawTwo = true;
			}
			// the gap is bridged with a real crossfade somewhere along the scroll
			expect(everSawTwo).toBe(true);
		});

		it('starts at the section edge instead of compressing into the tiny middle gap', () => {
			const cozyGap = vh * 0.5;
			const B = bandHalfHeight(vh, 'cozy');
			const span = cozyGap + 2 * B;
			const slots = backdropPlan(gappedAtFocus(vh, 3, vh, cozyGap), vh, 'cozy');

			expect(opacity(slots, 's0')).toBeCloseTo(1 - B / span, 3);
			expect(opacity(slots, 's1')).toBeCloseTo(B / span, 3);
			expect(opacity(slots, 's1')).toBeGreaterThan(0.2);
		});

		it('is continuous where the focus window leaves and enters the section edges', () => {
			const cozyGap = vh * 0.5;
			const B = bandHalfHeight(vh, 'cozy');
			const outgoingSeam = vh + B;
			const incomingSeam = vh + cozyGap - B;

			const beforeOutgoing = backdropPlan(
				gappedAtFocus(outgoingSeam - 0.5, 3, vh, cozyGap),
				vh,
				'cozy'
			);
			const afterOutgoing = backdropPlan(
				gappedAtFocus(outgoingSeam + 0.5, 3, vh, cozyGap),
				vh,
				'cozy'
			);
			const beforeIncoming = backdropPlan(
				gappedAtFocus(incomingSeam - 0.5, 3, vh, cozyGap),
				vh,
				'cozy'
			);
			const afterIncoming = backdropPlan(
				gappedAtFocus(incomingSeam + 0.5, 3, vh, cozyGap),
				vh,
				'cozy'
			);

			expect(Math.abs(opacity(afterOutgoing, 's1') - opacity(beforeOutgoing, 's1'))).toBeLessThan(
				0.01
			);
			expect(Math.abs(opacity(afterIncoming, 's1') - opacity(beforeIncoming, 's1'))).toBeLessThan(
				0.01
			);
		});
	});
});
