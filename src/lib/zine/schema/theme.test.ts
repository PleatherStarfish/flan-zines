import { describe, expect, it } from 'vitest';
import { ThemeSchema } from './theme';

const colors = {
	background: '#ffffff',
	text: '#101010',
	heading: '#101010',
	accent: '#e4572e',
	muted: '#6b7280'
};

describe('ThemeSchema (v4)', () => {
	it('accepts the full role/swatch model', () => {
		const parsed = ThemeSchema.safeParse({
			preset: 'np-12',
			fontPair: 'editorial',
			swatches: ['#ffffff', '#101010', '#e4572e'],
			colors
		});
		expect(parsed.success).toBe(true);
	});

	it('still accepts the legacy palette/accent keys', () => {
		expect(ThemeSchema.safeParse({ palette: 'ink', accent: '#e4572e' }).success).toBe(true);
	});

	it('rejects an unsafe (injection) colour in a role', () => {
		const parsed = ThemeSchema.safeParse({
			colors: { ...colors, accent: '#e4572e;background:url(https://x)' }
		});
		expect(parsed.success).toBe(false);
	});

	it('rejects an unsafe colour in the swatch pool', () => {
		expect(ThemeSchema.safeParse({ swatches: ['url(javascript:alert(1))'] }).success).toBe(false);
	});

	it('caps the swatch pool at twelve', () => {
		const swatches = Array.from({ length: 13 }, () => '#123456');
		expect(ThemeSchema.safeParse({ swatches }).success).toBe(false);
	});

	it('requires every role when colours are given (a complete render contract)', () => {
		expect(ThemeSchema.safeParse({ colors: { background: '#fff' } }).success).toBe(false);
	});
});
