import type { Theme, ThemeColors } from '../schema/theme';
import { fontPairById } from './fonts';

// Curated theme registries (data-model.md §7). Palettes and font pairs are KEYS the
// document stores; the renderer resolves them to CSS variables. Each palette is
// pre-checked for legibility, and accents are a curated, pre-contrasted set — students
// pick from good options and cannot make an unreadable page.
//
// Fonts ship as curated system stacks in Step 3; self-hosting the exact Google
// families via @fontsource (no third-party request) is an additive fast-follow —
// only the `body`/`heading` stack strings change.

export interface Palette {
	id: string;
	label: string;
	bg: string;
	fg: string;
	muted: string;
	accents: string[];
}

export const PALETTES: Palette[] = [
	{
		id: 'ink',
		label: 'Ink',
		bg: '#fbfaf7',
		fg: '#14181f',
		muted: '#6b7280',
		accents: ['#E4572E', '#2563eb', '#0f766e']
	},
	{
		id: 'paper',
		label: 'Paper',
		bg: '#ffffff',
		fg: '#1f2937',
		muted: '#6b7280',
		accents: ['#b45309', '#7c3aed', '#be123c']
	},
	{
		id: 'dusk',
		label: 'Dusk',
		bg: '#161a23',
		fg: '#f1f5f9',
		muted: '#94a3b8',
		accents: ['#f59e0b', '#38bdf8', '#f472b6']
	},
	{
		id: 'sunrise',
		label: 'Sunrise',
		bg: '#fffaf2',
		fg: '#3b2a1f',
		muted: '#8a6d5a',
		accents: ['#ea580c', '#0891b2', '#16a34a']
	},
	{
		id: 'forest',
		label: 'Forest',
		bg: '#f4f7f3',
		fg: '#15241a',
		muted: '#5d7264',
		accents: ['#15803d', '#b45309', '#0e7490']
	}
];

// Fonts live in ./fonts (curated families + pairs, custom resolution). Re-exported here so
// existing `$lib/zine/theme/registry` import sites keep working.
export * from './fonts';

export const DEFAULT_PALETTE = 'ink';

export function paletteById(id: string | undefined): Palette {
	return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

/**
 * Resolve a theme to its five role colours. Prefers the v4 `colors` map; falls back to the
 * legacy `palette`/`accent` keys (then the default palette) so older documents still render.
 * Pure and culori-free — safe on the public reader path.
 */
export function resolveThemeColors(theme: Theme | undefined): ThemeColors {
	if (theme?.colors) return theme.colors;
	const palette = paletteById(theme?.palette);
	const accent = theme?.accent ?? palette.accents[0];
	return {
		background: palette.bg,
		text: palette.fg,
		heading: palette.fg,
		accent,
		muted: palette.muted
	};
}

/**
 * The theme's source palette — the swatch pool the editor offers and the colours a
 * theme-aware background may draw from. Uses the explicit `swatches` when present, else the
 * resolved role colours. Culori-free (reader-safe).
 */
export function themeSwatches(theme: Theme | undefined): string[] {
	if (theme?.swatches?.length) return theme.swatches;
	const c = resolveThemeColors(theme);
	return [...new Set([c.accent, c.background, c.text, c.muted, c.heading])];
}

function hexToRgb(hex: string): [number, number, number] {
	let h = hex.replace('#', '').trim();
	if (h.length === 3)
		h = h
			.split('')
			.map((c) => c + c)
			.join('');
	const n = Number.parseInt(h, 16);
	return Number.isNaN(n) ? [0, 0, 0] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * The theme's swatch pool as RGB triplets (0–255) — what a theme-aware background is fed so
 * it can paint with the student's colours. Culori-free (a tiny hex parser), so it stays on
 * the public reader path.
 */
export function themeSwatchesRgb(theme: Theme | undefined): [number, number, number][] {
	return themeSwatches(theme).map(hexToRgb);
}

/** Resolve a document theme to the CSS custom properties the renderer applies. */
export function themeVars(theme: Theme | undefined): string {
	const font = fontPairById(theme?.fontPair);
	const colors = resolveThemeColors(theme);
	return [
		`--zine-bg:${colors.background}`,
		`--zine-fg:${colors.text}`,
		`--zine-heading:${colors.heading}`,
		`--zine-muted:${colors.muted}`,
		`--zine-accent:${colors.accent}`,
		`--zine-font-heading:${font.heading}`,
		`--zine-font-body:${font.body}`
	].join(';');
}
