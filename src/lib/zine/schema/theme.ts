import { z } from 'zod';

// Section LAYOUT is the v1 vocabulary (appearance). v2 renames the primary axis to
// `kind` (purpose) and preserves the original layout under section.presentation so the
// 1→2 migration is lossless (data-model.md §2).
export const SECTION_LAYOUTS = ['centered', 'split', 'grid', 'full-bleed'] as const;
export const SectionLayoutSchema = z.enum(SECTION_LAYOUTS);
export type SectionLayout = z.infer<typeof SectionLayoutSchema>;

// Section KIND (v2) — purpose, not appearance. Drives layout, the blocks/animations
// offered, and the editor's affordances. `scrolly` authoring arrives with Step 4.
export const SECTION_KINDS = ['prose', 'feature', 'split', 'scrolly', 'sources'] as const;
export const SectionKindSchema = z.enum(SECTION_KINDS);
export type SectionKind = z.infer<typeof SectionKindSchema>;

// Render hints that are not the primary editorial purpose. `legacyLayout` is the
// original v1 layout, carried forward by the migration so no information is dropped.
export const SectionPresentationSchema = z.object({
	legacyLayout: SectionLayoutSchema.optional()
});
export type SectionPresentation = z.infer<typeof SectionPresentationSchema>;

export const BLOCK_ALIGNMENTS = ['left', 'center', 'right', 'justify'] as const;

// Author-controlled values that become inline CSS must be deliberately narrow.
// Step 2 supports hex colors only; richer palette-token resolution arrives with
// the later theme system. This rejects declaration injection, `url(...)`, and
// non-color strings before the renderer sees them.
export const HexColorSchema = z
	.string()
	.trim()
	.regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
		message: 'Color must be a hex value like #E4572E.'
	});
export type HexColor = z.infer<typeof HexColorSchema>;

export const TEXT_BACKDROP_SHAPES = ['box', 'circle'] as const;
export const TextBackdropShapeSchema = z.enum(TEXT_BACKDROP_SHAPES);
export type TextBackdropShape = z.infer<typeof TextBackdropShapeSchema>;

const LEGACY_TEXT_BACKDROP_PADDINGS: Record<string, number> = {
	tight: 0.55,
	cozy: 1,
	roomy: 1.55
};
export const TextBackdropPaddingSchema = z.preprocess(
	(value) => (typeof value === 'string' ? (LEGACY_TEXT_BACKDROP_PADDINGS[value] ?? value) : value),
	z.number().min(0).max(4)
);
export type TextBackdropPadding = z.infer<typeof TextBackdropPaddingSchema>;

export const TextBackdropSchema = z.object({
	shape: TextBackdropShapeSchema,
	color: HexColorSchema,
	opacity: z.number().min(0).max(1).default(0.72),
	padding: TextBackdropPaddingSchema.optional()
});
export type TextBackdrop = z.infer<typeof TextBackdropSchema>;

// Editorial typesetting (docs/design/pinned-content-and-typesetting.md, Part B). A `role` is a
// one-tap preset (magazine roles); the rest are bounded chips. All injection-safe enums — the
// renderer resolves these to a measure/leading/etc. via the pure `resolveTypeset()` helper
// (author ≡ published). Defaults are the typographically correct ones (45–75ch measure,
// flush-left, body leading floor 1.45). v1 ships these; dropCap/columns are reserved for v2.
export const TYPESET_ROLES = [
	'headline',
	'subhead',
	'kicker',
	'deck',
	'body',
	'pullquote',
	'blockquote',
	'caption',
	'byline'
] as const;
export const TypesetRoleSchema = z.enum(TYPESET_ROLES);
export type TypesetRole = z.infer<typeof TypesetRoleSchema>;

export const TYPESET_MEASURES = ['narrow', 'medium', 'wide'] as const;
export const TYPESET_LEADINGS = ['tight', 'cozy', 'airy'] as const;
export const TYPESET_CASES = ['normal', 'upper', 'smallcaps'] as const;
export const TEXT_KINDS = ['content', 'other'] as const;
export const TextKindSchema = z.enum(TEXT_KINDS);
export type TextKind = z.infer<typeof TextKindSchema>;

export const TypesetSchema = z.object({
	kind: TextKindSchema.optional(),
	role: TypesetRoleSchema.optional(),
	measure: z.enum(TYPESET_MEASURES).optional(),
	leading: z.enum(TYPESET_LEADINGS).optional(),
	case: z.enum(TYPESET_CASES).optional(),
	tidyWrap: z.boolean().optional()
});
export type Typeset = z.infer<typeof TypesetSchema>;

export const BlockStyleSchema = z.object({
	align: z.enum(BLOCK_ALIGNMENTS).optional(),
	textColor: HexColorSchema.optional(),
	// Explicit background treatment for text blocks. Default is absent/transparent.
	// Rendered tightly around the text content, never as a full-width bar.
	textBackdrop: TextBackdropSchema.optional(),
	typeset: TypesetSchema.optional()
});
export type BlockStyle = z.infer<typeof BlockStyleSchema>;

export const SectionBackgroundSchema = z.object({
	color: HexColorSchema.optional()
});
export type SectionBackground = z.infer<typeof SectionBackgroundSchema>;

// The semantic colour roles the renderer paints. A theme assigns one colour to each:
// `background` (the page), `text` (body copy), `heading` (titles), `accent` (links +
// buttons), `muted` (captions, dividers). The editor lets students bind any swatch — or a
// custom colour — to each role (data-model.md §7). Resolved to `--zine-bg/fg/heading/
// accent/muted` by themeVars().
export const THEME_ROLES = ['background', 'text', 'heading', 'accent', 'muted'] as const;
export const ThemeRoleSchema = z.enum(THEME_ROLES);
export type ThemeRole = z.infer<typeof ThemeRoleSchema>;

export const ThemeColorsSchema = z.object({
	background: HexColorSchema,
	text: HexColorSchema,
	heading: HexColorSchema,
	accent: HexColorSchema,
	muted: HexColorSchema
});
export type ThemeColors = z.infer<typeof ThemeColorsSchema>;

// Theme tokens carried as data (ARCHITECTURE.md §4).
//
// v4 model — `colors` is the source of truth the renderer reads (one HexColor per role);
// `swatches` is the theme's source palette the editor offers for assignment/customization;
// `preset` records which catalogue theme was applied (for relinking in the UI). Every value
// stays `HexColorSchema`-validated (injection-safe) — safety in the schema, taste in the UX.
//
// Legacy `palette`/`accent` (v3 keys into the built-in palette registry) are kept so old
// documents still resolve; themeVars() prefers `colors` and falls back to them. `fontPair`
// is unchanged. The schemaVersion 3→4 migration resolves legacy keys into `colors`/`swatches`.
export const ThemeSchema = z.object({
	// Curated registry keys + a `custom:<headingId>:<bodyId>` font combo. Bounded so a
	// pathological value can't bloat the persisted document (resolution sanitises ids anyway).
	palette: z.string().max(64).optional(),
	fontPair: z.string().max(64).optional(),
	accent: HexColorSchema.optional(),
	preset: z.string().max(64).optional(),
	swatches: z.array(HexColorSchema).max(12).optional(),
	colors: ThemeColorsSchema.optional()
});
export type Theme = z.infer<typeof ThemeSchema>;
