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

export const BLOCK_ALIGNMENTS = ['left', 'center', 'right'] as const;
export const BlockStyleSchema = z.object({
	align: z.enum(BLOCK_ALIGNMENTS).optional()
});
export type BlockStyle = z.infer<typeof BlockStyleSchema>;

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

export const SectionBackgroundSchema = z.object({
	color: HexColorSchema.optional()
});
export type SectionBackground = z.infer<typeof SectionBackgroundSchema>;

// Theme tokens carried as data (ARCHITECTURE.md §4). `palette`/`fontPair` are keys
// into curated registries (src/lib/zine/theme); `accent` is applied as the
// `--zine-accent` custom property by the renderer.
export const ThemeSchema = z.object({
	palette: z.string().optional(),
	fontPair: z.string().optional(),
	accent: HexColorSchema.optional()
});
export type Theme = z.infer<typeof ThemeSchema>;
