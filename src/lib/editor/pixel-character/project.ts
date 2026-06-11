import { z } from 'zod';
import { HexColorSchema, type HexColor, type Theme } from '$lib/zine/schema/theme';
import { resolveThemeColors } from '$lib/zine/theme/registry';

export const BODY_PRESETS = ['classic', 'short', 'tall', 'round', 'sturdy'] as const;
export const BodyPresetSchema = z.enum(BODY_PRESETS);
export type BodyPreset = z.infer<typeof BodyPresetSchema>;

export const HAIR_PRESETS = ['short', 'long', 'curly', 'tiedBack', 'hatHidden'] as const;
export const HairPresetSchema = z.enum(HAIR_PRESETS);
export type HairPreset = z.infer<typeof HairPresetSchema>;

export const OUTFIT_PRESETS = [
	'everyday',
	'hoodie',
	'jacket',
	'lab',
	'armor',
	'wizard',
	'halloween'
] as const;
export const OutfitPresetSchema = z.enum(OUTFIT_PRESETS);
export type OutfitPreset = z.infer<typeof OutfitPresetSchema>;

export const ACCESSORY_PRESETS = ['glasses', 'hat', 'cape', 'backpack', 'mask'] as const;
export const AccessoryPresetSchema = z.enum(ACCESSORY_PRESETS);
export type AccessoryPreset = z.infer<typeof AccessoryPresetSchema>;

export const PROP_PRESETS = ['none', 'computer', 'book', 'wand'] as const;
export const PropPresetSchema = z.enum(PROP_PRESETS);
export type PropPreset = z.infer<typeof PropPresetSchema>;

export const CHARACTER_ACTIONS = [
	'idle',
	'faceForward',
	'runRight',
	'runLeft',
	'jump',
	'wave',
	'hold',
	'cast'
] as const;
export const CharacterActionSchema = z.enum(CHARACTER_ACTIONS);
export type CharacterAction = z.infer<typeof CharacterActionSchema>;

export const CHARACTER_EXPORT_SIZES = ['tiny', 'small', 'medium', 'large'] as const;
export const CharacterExportSizeSchema = z.enum(CHARACTER_EXPORT_SIZES);
export type CharacterExportSize = z.infer<typeof CharacterExportSizeSchema>;

export const CharacterPaletteSchema = z.object({
	skin: HexColorSchema,
	skinShadow: HexColorSchema,
	hair: HexColorSchema,
	outline: HexColorSchema,
	shirt: HexColorSchema,
	pants: HexColorSchema,
	shoes: HexColorSchema,
	accent: HexColorSchema,
	prop: HexColorSchema,
	magic: HexColorSchema
});
export type CharacterPalette = z.infer<typeof CharacterPaletteSchema>;

export const PixelCharacterProjectSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1).max(80),
	baseRig: z.literal('human-24x32').default('human-24x32'),
	body: BodyPresetSchema.default('classic'),
	hair: HairPresetSchema.default('short'),
	outfit: OutfitPresetSchema.default('everyday'),
	accessories: z.array(AccessoryPresetSchema).max(4).default([]),
	prop: PropPresetSchema.default('none'),
	palette: CharacterPaletteSchema,
	createdAt: z.string(),
	updatedAt: z.string()
});
export type PixelCharacterProject = z.infer<typeof PixelCharacterProjectSchema>;

export const ACTION_LABELS: Record<CharacterAction, string> = {
	idle: 'Standing',
	faceForward: 'Facing forward',
	runRight: 'Running right',
	runLeft: 'Running left',
	jump: 'Jumping',
	wave: 'Waving',
	hold: 'Holding something',
	cast: 'Casting magic'
};

export const SIZE_LABELS: Record<CharacterExportSize, string> = {
	tiny: 'Tiny',
	small: 'Small',
	medium: 'Medium',
	large: 'Large'
};

export const BODY_LABELS: Record<BodyPreset, string> = {
	classic: 'Classic',
	short: 'Short',
	tall: 'Tall',
	round: 'Round',
	sturdy: 'Sturdy'
};

export const HAIR_LABELS: Record<HairPreset, string> = {
	short: 'Short',
	long: 'Long',
	curly: 'Curly',
	tiedBack: 'Tied back',
	hatHidden: 'Under hat'
};

export const OUTFIT_LABELS: Record<OutfitPreset, string> = {
	everyday: 'Everyday',
	hoodie: 'Hoodie',
	jacket: 'Jacket',
	lab: 'Lab coat',
	armor: 'Armor',
	wizard: 'Wizard',
	halloween: 'Halloween'
};

export const ACCESSORY_LABELS: Record<AccessoryPreset, string> = {
	glasses: 'Glasses',
	hat: 'Hat',
	cape: 'Cape',
	backpack: 'Backpack',
	mask: 'Mask'
};

export const PROP_LABELS: Record<PropPreset, string> = {
	none: 'None',
	computer: 'Computer',
	book: 'Book',
	wand: 'Magic wand'
};

export function defaultCharacterProject(theme?: Theme): PixelCharacterProject {
	const colors = resolveThemeColors(theme);
	const now = new Date().toISOString();
	return {
		id: `chr_${Math.random().toString(36).slice(2, 10)}`,
		name: 'Pixel runner',
		baseRig: 'human-24x32',
		body: 'classic',
		hair: 'short',
		outfit: 'everyday',
		accessories: ['hat'],
		prop: 'none',
		palette: {
			skin: '#f0ae5d',
			skinShadow: '#d1803d',
			hair: '#5a341f',
			outline: '#4a2a14',
			shirt: '#2f8bd8',
			pants: '#82c98b',
			shoes: '#7a431f',
			accent: '#ef2b1f',
			prop: colors.muted as HexColor,
			magic: '#6ee7f9'
		},
		createdAt: now,
		updatedAt: now
	};
}

export function updateProject(
	project: PixelCharacterProject,
	partial: Partial<PixelCharacterProject>
): PixelCharacterProject {
	return PixelCharacterProjectSchema.parse({
		...project,
		...partial,
		palette: { ...project.palette, ...(partial.palette ?? {}) },
		updatedAt: new Date().toISOString()
	});
}
