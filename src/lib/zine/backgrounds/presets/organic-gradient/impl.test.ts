import { describe, expect, it } from 'vitest';
import { selectColors } from './impl';

type RGB = [number, number, number];

const palette: RGB[] = [
	[10, 10, 10],
	[20, 20, 20],
	[30, 30, 30],
	[40, 40, 40]
];

describe('organic-gradient colour selection', () => {
	it('uses curated defaults when the theme has no swatches', () => {
		const out = selectColors([], []);
		expect(out.length).toBeGreaterThanOrEqual(2);
	});

	it('uses every swatch when no specific colours are chosen', () => {
		expect(selectColors(palette, [])).toEqual(palette);
	});

	it('keeps only the chosen swatches, in the requested order', () => {
		expect(selectColors(palette, [2, 0])).toEqual([
			[30, 30, 30],
			[10, 10, 10]
		]);
	});

	it('ignores out-of-range indices and falls back to all if none remain', () => {
		expect(selectColors(palette, [1, 9])).toEqual([[20, 20, 20]]);
		expect(selectColors(palette, [99])).toEqual(palette);
	});

	it('caps participation at eight stops', () => {
		const many = Array.from({ length: 12 }, (_, i) => [i, i, i] as RGB);
		expect(selectColors(many, []).length).toBe(8);
	});
});
