import { describe, expect, it } from 'vitest';
import { adjustToContrast, contrastRatio, deriveTheme, isLegibleTheme, meetsAA } from './derive';
import { loadThemeCatalogue } from './catalogue';

describe('colour derivation', () => {
	it('derives an AA-legible theme from an arbitrary palette', () => {
		const theme = deriveTheme('np-0', ['#69d2e7', '#a7dbd8', '#e0e4cc', '#f38630', '#fa6900']);
		expect(theme.swatches).toHaveLength(5);
		expect(isLegibleTheme(theme.colors)).toBe(true);
		expect(meetsAA(theme.colors.text, theme.colors.background)).toBe(true);
	});

	it('keeps even a low-contrast palette legible by adjusting lightness', () => {
		// Five near-identical mid-greys: text must be pushed to a legible lightness.
		const theme = deriveTheme('flat', ['#888888', '#8a8a8a', '#868686', '#909090', '#7e7e7e']);
		expect(isLegibleTheme(theme.colors)).toBe(true);
	});

	it('adjustToContrast reaches the requested ratio on a light background', () => {
		const out = adjustToContrast('#cccccc', '#ffffff', 4.5);
		expect(contrastRatio(out, '#ffffff')).toBeGreaterThanOrEqual(4.5);
	});

	it('every catalogue entry is legible and uniquely keyed', async () => {
		const catalogue = await loadThemeCatalogue();
		expect(catalogue.length).toBeGreaterThan(20);
		const ids = new Set<string>();
		for (const theme of catalogue) {
			expect(isLegibleTheme(theme.colors), theme.id).toBe(true);
			expect(ids.has(theme.id)).toBe(false);
			ids.add(theme.id);
		}
	});
});
