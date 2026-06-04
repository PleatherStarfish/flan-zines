import { z } from 'zod';

// Section layout (owns how blocks are arranged within a section). Backgrounds and
// canvas effects (flocking etc.) are layered on in Step 4; Step 2 ships a minimal
// optional color background.
export const SECTION_LAYOUTS = ['centered', 'split', 'grid', 'full-bleed'] as const;
export const SectionLayoutSchema = z.enum(SECTION_LAYOUTS);
export type SectionLayout = z.infer<typeof SectionLayoutSchema>;

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

// Theme tokens carried as data (ARCHITECTURE.md §4). `accent` is applied as the
// `--zine-accent` custom property by the renderer; palette/fontPair hook into the
// theme system in a later step.
export const ThemeSchema = z.object({
	palette: z.string().optional(),
	fontPair: z.string().optional(),
	accent: HexColorSchema.optional()
});
export type Theme = z.infer<typeof ThemeSchema>;
