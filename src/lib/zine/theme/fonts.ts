import type { Theme } from '../schema/theme';

// The font registry — curated FAMILIES, curated PAIRS, and resolution of a stored
// `theme.fontPair` to CSS stacks. Pure DATA (no @fontsource imports here), so it stays on
// the public reader path; the actual web-font files are lazy-loaded by `font-loader.ts`.
//
// `theme.fontPair` is a stored string. It is either a curated pair id (e.g. `editorial`) or a
// custom combo encoded as `custom:<headingFamilyId>:<bodyFamilyId>` — so a student can pick
// their own heading/body without a schema change, and every id is validated back through the
// registry (unknown → the default family), keeping it injection-safe.

export type FontCategory = 'display' | 'serif' | 'slab' | 'sans' | 'rounded' | 'mono' | 'hand';

export interface FontFamily {
	/** Stable key stored in the document. */
	id: string;
	/** Student-facing name. */
	label: string;
	category: FontCategory;
	/** Full CSS stack: the self-hosted web family first, then safe system fallbacks (shown
	 *  until the web font loads, and forever under a load failure). */
	stack: string;
}

// Each family is self-hosted via @fontsource (font-loader.ts). The quoted name matches the
// `font-family` the @fontsource CSS defines (e.g. "Inter Variable").
export const FONT_FAMILIES: FontFamily[] = [
	{
		id: 'fraunces',
		label: 'Fraunces',
		category: 'display',
		stack: `'Fraunces Variable', Georgia, 'Times New Roman', serif`
	},
	{
		id: 'dm-serif',
		label: 'DM Serif',
		category: 'display',
		stack: `'DM Serif Display', Georgia, 'Times New Roman', serif`
	},
	{
		id: 'lora',
		label: 'Lora',
		category: 'serif',
		stack: `'Lora Variable', Georgia, 'Times New Roman', serif`
	},
	{
		id: 'bitter',
		label: 'Bitter',
		category: 'slab',
		stack: `'Bitter Variable', Rockwell, Georgia, serif`
	},
	{
		id: 'inter',
		label: 'Inter',
		category: 'sans',
		stack: `'Inter Variable', system-ui, sans-serif`
	},
	{
		id: 'source-sans',
		label: 'Source Sans',
		category: 'sans',
		stack: `'Source Sans 3 Variable', system-ui, sans-serif`
	},
	{
		id: 'nunito',
		label: 'Nunito',
		category: 'rounded',
		stack: `'Nunito Variable', system-ui, sans-serif`
	},
	{
		id: 'space-mono',
		label: 'Space Mono',
		category: 'mono',
		stack: `'Space Mono', ui-monospace, 'Courier New', monospace`
	},
	{
		id: 'caveat',
		label: 'Caveat',
		category: 'hand',
		stack: `'Caveat Variable', 'Comic Sans MS', cursive`
	}
];

const FAMILY_BY_ID = new Map(FONT_FAMILIES.map((f) => [f.id, f]));

/** Resolve a family id to its definition; an unknown id falls back to the default family. */
export function familyById(id: string | undefined): FontFamily {
	return (id ? FAMILY_BY_ID.get(id) : undefined) ?? FONT_FAMILIES[0];
}

export interface FontPair {
	id: string;
	label: string;
	/** A short student-facing descriptor of the mood. */
	vibe: string;
	/** Family ids (resolve via familyById). */
	heading: string;
	body: string;
}

// The curated combos the UI pushes students toward — pleasing, legible, varied.
export const FONT_PAIRS: FontPair[] = [
	{
		id: 'editorial',
		label: 'Editorial',
		vibe: 'Classic magazine',
		heading: 'fraunces',
		body: 'source-sans'
	},
	{ id: 'classic', label: 'Classic', vibe: 'Timeless & literary', heading: 'lora', body: 'lora' },
	{ id: 'clean', label: 'Clean', vibe: 'Modern & simple', heading: 'inter', body: 'inter' },
	{
		id: 'magazine',
		label: 'Magazine',
		vibe: 'Big bold headline',
		heading: 'fraunces',
		body: 'inter'
	},
	{ id: 'friendly', label: 'Friendly', vibe: 'Warm & rounded', heading: 'nunito', body: 'nunito' },
	{ id: 'playful', label: 'Playful', vibe: 'Hand-written fun', heading: 'caveat', body: 'nunito' },
	{ id: 'slab', label: 'Slab', vibe: 'Sturdy & confident', heading: 'bitter', body: 'source-sans' },
	{
		id: 'elegant',
		label: 'Elegant',
		vibe: 'High-contrast serif',
		heading: 'dm-serif',
		body: 'lora'
	},
	{
		id: 'typewriter',
		label: 'Typewriter',
		vibe: 'Mono & techy',
		heading: 'space-mono',
		body: 'inter'
	}
];

export const DEFAULT_FONT_PAIR = 'editorial';
const CUSTOM_PREFIX = 'custom:';

// The pre-webfont catalogue had `bold`/`mono`; map them to their nearest new combo so older
// documents keep their intent instead of silently falling back to the default.
const LEGACY_PAIR_ALIASES: Record<string, string> = { bold: 'clean', mono: 'typewriter' };

/** Encode a custom heading/body family choice as a `fontPair` string. */
export function customFontPairId(headingId: string, bodyId: string): string {
	return `${CUSTOM_PREFIX}${familyById(headingId).id}:${familyById(bodyId).id}`;
}

/** The heading/body FAMILIES a stored `fontPair` resolves to (curated id or `custom:h:b`). */
export function fontPairFamilies(fontPair: string | undefined): {
	id: string;
	label: string;
	heading: FontFamily;
	body: FontFamily;
} {
	if (fontPair && fontPair.startsWith(CUSTOM_PREFIX)) {
		const [headingId, bodyId] = fontPair.slice(CUSTOM_PREFIX.length).split(':');
		return {
			id: fontPair,
			label: 'Your fonts',
			heading: familyById(headingId),
			body: familyById(bodyId)
		};
	}
	const id = (fontPair && LEGACY_PAIR_ALIASES[fontPair]) ?? fontPair;
	const pair = FONT_PAIRS.find((p) => p.id === id) ?? FONT_PAIRS[0];
	return {
		id: pair.id,
		label: pair.label,
		heading: familyById(pair.heading),
		body: familyById(pair.body)
	};
}

export interface ResolvedFontPair {
	id: string;
	label: string;
	/** Full CSS stacks (what the renderer puts in `--zine-font-*`). */
	heading: string;
	body: string;
}

/** Resolve a stored `fontPair` to its CSS stacks (curated or custom). */
export function fontPairById(fontPair: string | undefined): ResolvedFontPair {
	const fams = fontPairFamilies(fontPair);
	return { id: fams.id, label: fams.label, heading: fams.heading.stack, body: fams.body.stack };
}

/** The family ids a theme uses, for the lazy font loader. */
export function themeFontFamilyIds(theme: Theme | undefined): string[] {
	const fams = fontPairFamilies(theme?.fontPair);
	return [...new Set([fams.heading.id, fams.body.id])];
}
