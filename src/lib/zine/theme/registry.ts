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

export interface FontPair {
	id: string;
	label: string;
	heading: string;
	body: string;
}

export const FONT_PAIRS: FontPair[] = [
	{
		id: 'editorial',
		label: 'Editorial',
		heading: 'ui-serif, Georgia, "Times New Roman", serif',
		body: 'ui-sans-serif, system-ui, sans-serif'
	},
	{
		id: 'classic',
		label: 'Classic',
		heading: 'Georgia, "Times New Roman", serif',
		body: 'Georgia, "Times New Roman", serif'
	},
	{
		id: 'bold',
		label: 'Bold',
		heading: 'ui-sans-serif, system-ui, sans-serif',
		body: 'ui-sans-serif, system-ui, sans-serif'
	},
	{
		id: 'mono',
		label: 'Mono',
		heading: 'ui-monospace, "SFMono-Regular", monospace',
		body: 'ui-sans-serif, system-ui, sans-serif'
	}
];

export const DEFAULT_PALETTE = 'ink';
export const DEFAULT_FONT_PAIR = 'editorial';

export function paletteById(id: string | undefined): Palette {
	return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}
export function fontPairById(id: string | undefined): FontPair {
	return FONT_PAIRS.find((f) => f.id === id) ?? FONT_PAIRS[0];
}

/** Resolve a document theme to the CSS custom properties the renderer applies. */
export function themeVars(
	theme: { palette?: string; fontPair?: string; accent?: string } | undefined
): string {
	const palette = paletteById(theme?.palette);
	const font = fontPairById(theme?.fontPair);
	const accent = theme?.accent ?? palette.accents[0];
	return [
		`--zine-bg:${palette.bg}`,
		`--zine-fg:${palette.fg}`,
		`--zine-muted:${palette.muted}`,
		`--zine-accent:${accent}`,
		`--zine-font-heading:${font.heading}`,
		`--zine-font-body:${font.body}`
	].join(';');
}
