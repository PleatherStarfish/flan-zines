import { describe, expect, it } from 'vitest';
import { resolveThemeColors, themeSwatches, themeVars } from './registry';

describe('theme resolution (reader-safe)', () => {
	it('prefers the v4 colours map for the role variables', () => {
		const vars = themeVars({
			colors: {
				background: '#101010',
				text: '#fafafa',
				heading: '#ffd700',
				accent: '#ff5050',
				muted: '#9aa0aa'
			}
		});
		expect(vars).toContain('--zine-bg:#101010');
		expect(vars).toContain('--zine-fg:#fafafa');
		expect(vars).toContain('--zine-heading:#ffd700');
		expect(vars).toContain('--zine-accent:#ff5050');
		expect(vars).toContain('--zine-muted:#9aa0aa');
	});

	it('falls back to the legacy palette/accent keys for old documents', () => {
		const colors = resolveThemeColors({ palette: 'dusk', accent: '#38bdf8' });
		expect(colors.background).toBe('#161a23');
		expect(colors.accent).toBe('#38bdf8');
		expect(themeVars({ palette: 'dusk' })).toContain('--zine-bg:#161a23');
	});

	it('exposes explicit swatches, else the resolved role colours', () => {
		expect(themeSwatches({ swatches: ['#111111', '#eeeeee'] })).toEqual(['#111111', '#eeeeee']);
		const fallback = themeSwatches({ palette: 'ink' });
		expect(fallback.length).toBeGreaterThan(0);
	});
});
