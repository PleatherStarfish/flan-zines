import { z } from 'zod';
import { getBlock } from '../registry';
import { AnimationDescriptorSchema, EffectRefSchema } from './animation';
import { BlockStyleSchema, SectionPresentationSchema, ThemeSchema } from './theme';
import { HexColorSchema } from './theme';

// The document IS the contract. v3 follows scene-timeline.md §2:
// Story → Act → Scene → Beat → Element, where each Element wraps a registry block.
// The block registry remains the single source of truth for content props.
export const CURRENT_SCHEMA_VERSION = 3 as const;

// Source-data tier (RESERVED Step 4b). Charts reference a named dataset; large/messy
// data is processed server-side and never inlined.
const DataSourceRefSchema = z.union([
	z.object({ kind: z.enum(['csv', 'json']), path: z.string().min(1) }),
	z.object({ kind: z.literal('inline'), rows: z.array(z.unknown()) })
]);

// A block envelope. `props` is parsed through the registry schema for `type`,
// yielding precise, path-aware errors ("Unknown block type", or
// `props.<field>: <reason>") and returning the normalized/defaulted props. This keeps
// the block registry schemas as the source of truth for render-time data. `role`/
// `state` support the scrolly model (data-model.md §4); they are envelope fields
// validated alongside `props`, with cross-block rules enforced by the section below.
export const BlockSchema = z
	.object({
		id: z.string().min(1),
		type: z.string().min(1),
		props: z.unknown(),
		style: BlockStyleSchema.optional()
	})
	.transform((block, ctx) => {
		const def = getBlock(block.type);
		if (!def) {
			ctx.addIssue({
				code: 'custom',
				path: ['type'],
				message: `Unknown block type: "${block.type}".`
			});
			return z.NEVER;
		}
		const result = def.schema.safeParse(block.props);
		if (!result.success) {
			for (const issue of result.error.issues) {
				ctx.addIssue({ code: 'custom', path: ['props', ...issue.path], message: issue.message });
			}
			return z.NEVER;
		}
		const props: unknown = result.data;
		return { ...block, props };
	});
export type Block = z.infer<typeof BlockSchema>;

export const SCENE_TYPES = ['page', 'feature', 'reveal', 'parallax', 'sidescroll', 'data'] as const;
export const SceneTypeSchema = z.enum(SCENE_TYPES);
export type SceneType = z.infer<typeof SceneTypeSchema>;

export const SCENE_LENGTHS = ['auto', 'short', 'medium', 'long'] as const;
export const SceneLengthSchema = z.enum(SCENE_LENGTHS);
export type SceneLength = z.infer<typeof SceneLengthSchema>;

export const ELEMENT_TRACKS = ['content', 'media', 'background'] as const;
export const ElementTrackSchema = z.enum(ELEMENT_TRACKS);
export type ElementTrack = z.infer<typeof ElementTrackSchema>;

export const TimelineRangeSchema = z
	.object({
		start: z.number().min(0).max(1),
		end: z.number().min(0).max(1)
	})
	.superRefine((range, ctx) => {
		if (range.start >= range.end) {
			ctx.addIssue({
				code: 'custom',
				path: ['start'],
				message: 'Element range.start must be before range.end.'
			});
		}
	});
export type TimelineRange = z.infer<typeof TimelineRangeSchema>;

export const BeatSchema = z.object({
	id: z.string().min(1),
	at: z.number().min(0).max(1),
	label: z.string().optional(),
	state: z.record(z.string(), z.unknown()).optional()
});
export type Beat = z.infer<typeof BeatSchema>;

const ScenePresentationSchema = SectionPresentationSchema.extend({
	legacyKind: z.enum(['prose', 'feature', 'split', 'scrolly', 'sources']).optional(),
	legacyAnimation: AnimationDescriptorSchema.optional()
});
export type ScenePresentation = z.infer<typeof ScenePresentationSchema>;

const SceneBackgroundSchema = z
	.object({
		color: HexColorSchema.optional(),
		effect: z.string().optional(),
		params: z.record(z.string(), z.unknown()).optional()
	})
	.superRefine((background, ctx) => {
		if (!background.effect) return;
		const result = EffectRefSchema.safeParse({
			type: background.effect,
			params: background.params
		});
		if (!result.success) {
			for (const issue of result.error.issues) {
				ctx.addIssue({ code: 'custom', path: ['effect', ...issue.path], message: issue.message });
			}
		}
	});
export type SceneBackground = z.infer<typeof SceneBackgroundSchema>;

export const ElementSchema = z.object({
	id: z.string().min(1),
	track: ElementTrackSchema,
	block: BlockSchema,
	range: TimelineRangeSchema,
	enter: EffectRefSchema.optional(),
	exit: EffectRefSchema.optional(),
	motion: EffectRefSchema.optional(),
	anchorBeat: z.string().optional(),
	legacyAnimation: AnimationDescriptorSchema.optional()
});
export type Element = z.infer<typeof ElementSchema>;

export const SceneSchema = z
	.object({
		id: z.string().min(1),
		type: SceneTypeSchema,
		label: z.string().optional(),
		length: SceneLengthSchema.default('auto'),
		background: SceneBackgroundSchema.optional(),
		presentation: ScenePresentationSchema.optional(),
		beats: z.array(BeatSchema),
		elements: z.array(ElementSchema)
	})
	.superRefine((scene, ctx) => {
		let previous = -Infinity;
		scene.beats.forEach((beat, i) => {
			if (beat.at < previous) {
				ctx.addIssue({
					code: 'custom',
					path: ['beats', i, 'at'],
					message: 'Beats must be ordered by scroll position.'
				});
			}
			previous = beat.at;
			if (beat.state && scene.type !== 'data' && scene.type !== 'reveal') {
				ctx.addIssue({
					code: 'custom',
					path: ['beats', i, 'state'],
					message: 'Beat state is only valid in reveal or data scenes.'
				});
			}
		});
		if (scene.type === 'page') {
			if (scene.beats.length !== 1 || scene.beats[0]?.at !== 0) {
				ctx.addIssue({
					code: 'custom',
					path: ['beats'],
					message: 'Page scenes must have exactly one beat at 0.'
				});
			}
		}
		const beatIds = new Set(scene.beats.map((beat) => beat.id));
		scene.elements.forEach((element, i) => {
			if (element.anchorBeat && !beatIds.has(element.anchorBeat)) {
				ctx.addIssue({
					code: 'custom',
					path: ['elements', i, 'anchorBeat'],
					message: 'anchorBeat must reference a beat in the same scene.'
				});
			}
		});
	});
export type Scene = z.infer<typeof SceneSchema>;

export const ActSchema = z.object({
	id: z.string().min(1),
	title: z.string().optional(),
	scenes: z.array(SceneSchema)
});
export type Act = z.infer<typeof ActSchema>;

export const ZineDocumentSchema = z.object({
	schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
	theme: ThemeSchema.optional(),
	dataSources: z.record(z.string(), DataSourceRefSchema).optional(),
	acts: z.array(ActSchema)
});
export type ZineDocument = z.infer<typeof ZineDocumentSchema>;
