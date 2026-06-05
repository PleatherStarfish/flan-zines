// Colour derivation + WCAG contrast helpers (culori). EDITOR-ONLY: imported by the theme
// catalogue and the editor's contrast badges — NEVER by the public reader or the
// parse/migration path (those stay culori-free, so the reader bundle carries no colour-math
// library). Pure and deterministic, so deriveTheme is straightforward to unit-test.
import { formatHex, oklch, wcagContrast } from 'culori';
import type { ThemeColors } from '../schema/theme';

// A catalogue entry: a source palette plus a legible role→colour mapping derived from it.
// `applyThemePreset` copies `swatches` + `colors` into the document theme and records `id`.
export interface CatalogueTheme {
	id: string;
	swatches: string[];
	colors: ThemeColors;
}

const AA_TEXT = 4.5; // WCAG AA, body-size text
const AA_LARGE = 3; // WCAG AA, large text / UI components

function clamp01(n: number): number {
	return n < 0 ? 0 : n > 1 ? 1 : n;
}

function lightnessOf(hex: string): number {
	return oklch(hex)?.l ?? 0;
}

/** WCAG 2.x contrast ratio (1–21) between two colours, either order. */
export function contrastRatio(a: string, b: string): number {
	return wcagContrast(a, b);
}

/** Does `fg` meet WCAG AA on `bg`? (4.5 for body text; 3 for large text / UI.) */
export function meetsAA(fg: string, bg: string, large = false): boolean {
	return contrastRatio(fg, bg) >= (large ? AA_LARGE : AA_TEXT);
}

/**
 * Nudge `color`'s lightness in OKLCH (preserving hue/chroma) until it meets `ratio` on `bg`
 * — darker on a light background, lighter on a dark one. Keeps the colour's character while
 * guaranteeing legibility. Bounded best-effort: bails after a fixed number of steps.
 */
export function adjustToContrast(color: string, bg: string, ratio = AA_TEXT): string {
	let c = oklch(color);
	if (!c) return color;
	const towardDark = lightnessOf(bg) > 0.5;
	let hex = formatHex(c) ?? color;
	for (let i = 0; i < 120 && contrastRatio(hex, bg) < ratio; i++) {
		c = { ...c, l: clamp01(c.l + (towardDark ? -0.02 : 0.02)) };
		hex = formatHex(c) ?? hex;
	}
	return hex;
}

/** Most chromatic swatch that reads on `bg`; adjusted to large-text contrast if it falls short. */
function pickAccent(swatches: string[], bg: string, exclude: string[]): string {
	const ranked = swatches
		.filter((s) => !exclude.includes(s))
		.map((s) => ({ s, c: oklch(s)?.c ?? 0 }))
		.sort((a, b) => b.c - a.c);
	const best = ranked[0]?.s ?? swatches[0] ?? bg;
	return meetsAA(best, bg, true) ? best : adjustToContrast(best, bg, AA_LARGE);
}

/**
 * Derive a legible theme from an arbitrary colour palette: the lightest swatch becomes the
 * page background, the darkest becomes text (darkened toward AA if needed), the most
 * chromatic becomes the accent, and a mid swatch becomes muted. Adjustments preserve hue,
 * so the palette's character survives while readability is guaranteed.
 */
export function deriveTheme(id: string, palette: string[]): CatalogueTheme {
	const swatches = palette.map((p) => formatHex(p) ?? p);
	const byLight = [...swatches].sort((a, b) => lightnessOf(a) - lightnessOf(b));
	const background = byLight[byLight.length - 1];
	const text = adjustToContrast(byLight[0], background, AA_TEXT);
	const heading = text;
	const accent = pickAccent(swatches, background, [background]);
	const midRaw = byLight[Math.floor(byLight.length / 2)];
	const muted = meetsAA(midRaw, background, true)
		? midRaw
		: adjustToContrast(midRaw, background, AA_LARGE);
	return { id, swatches, colors: { background, text, heading, accent, muted } };
}

/** A theme is shippable if every role reads on the background (text/heading AA, accent/muted large). */
export function isLegibleTheme(colors: ThemeColors): boolean {
	return (
		meetsAA(colors.text, colors.background) &&
		meetsAA(colors.heading, colors.background) &&
		meetsAA(colors.accent, colors.background, true) &&
		meetsAA(colors.muted, colors.background, true)
	);
}
