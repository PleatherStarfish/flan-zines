import { z } from 'zod';
import { SafeUrlSchema } from '../../schema/url';

export const SPRITE_ACTIONS = [
	'idle',
	'faceForward',
	'runRight',
	'runLeft',
	'jump',
	'wave',
	'hold',
	'cast'
] as const;
export const SpriteActionSchema = z.enum(SPRITE_ACTIONS);
export type SpriteAction = z.infer<typeof SpriteActionSchema>;

export const EXPORT_SIZES = ['tiny', 'small', 'medium', 'large'] as const;
export const ExportSizeSchema = z.enum(EXPORT_SIZES);
export type ExportSize = z.infer<typeof ExportSizeSchema>;

export const CharacterSpriteSourceSchema = z
	.object({
		assetId: z.string().min(1).max(128).optional(),
		src: SafeUrlSchema.optional(),
		posterAssetId: z.string().min(1).max(128).optional(),
		poster: SafeUrlSchema.optional(),
		width: z.number().int().positive().max(4096),
		height: z.number().int().positive().max(4096),
		frameCount: z.number().int().min(1).max(32),
		durationMs: z.number().int().min(0).max(30000)
	})
	.superRefine((source, ctx) => {
		if (!source.src) {
			ctx.addIssue({
				code: 'custom',
				path: ['src'],
				message: 'Paste a safe character GIF URL until media asset resolution is wired.'
			});
		}
		if (!source.poster) {
			ctx.addIssue({
				code: 'custom',
				path: ['poster'],
				message: 'Paste a safe still image URL for reduced motion.'
			});
		}
	});
export type CharacterSpriteSource = z.infer<typeof CharacterSpriteSourceSchema>;

export const CharacterSpritePropsSchema = z.object({
	characterId: z.string().min(1).max(128).optional(),
	action: SpriteActionSchema.default('idle'),
	size: ExportSizeSchema.default('small'),
	source: CharacterSpriteSourceSchema,
	alt: z.string()
});
export type CharacterSpriteProps = z.infer<typeof CharacterSpritePropsSchema>;

export const CHARACTER_ACTION_LABELS: Record<SpriteAction, string> = {
	idle: 'Standing',
	faceForward: 'Facing forward',
	runRight: 'Running right',
	runLeft: 'Running left',
	jump: 'Jumping',
	wave: 'Waving',
	hold: 'Holding something',
	cast: 'Casting magic'
};

export const CHARACTER_SIZE_LABELS: Record<ExportSize, string> = {
	tiny: 'Tiny',
	small: 'Small',
	medium: 'Medium',
	large: 'Large'
};
