import { z } from 'zod';
import { getBlock } from '../registry';
import { getBackground } from '../backgrounds/registry';
import { AnimationDescriptorSchema, EffectRefSchema } from './animation';
import { BlockStyleSchema, SectionPresentationSchema, ThemeSchema } from './theme';
import { HexColorSchema } from './theme';
import { SafeUrlSchema } from './url';

// The document IS the contract. v3 follows scene-timeline.md §2:
// Story → Act → Scene → Beat → Element, where each Element wraps a registry block.
// The block registry remains the single source of truth for content props.
// v4 expands the theme to a role→colour model (schema/theme.ts §7); the change is additive
// (all new theme fields optional) plus a lossless 3→4 migration (schema/migrate.ts).
// v5 adds Element.placement ('free' sprites that float over a scene on a path) — additive +
// a no-op 4→5 migration.
export const CURRENT_SCHEMA_VERSION = 5 as const;

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

// The axis a scene scrolls along (scene-timeline.md §3). `vertical` is the default —
// the reader scrolls down and effects play on the vertical axis. `horizontal` turns the
// scene into a side-scroller: the reader still scrolls down, but the scene is pinned and
// its stage pans sideways, so elements laid along the track come into view left-to-right
// (a platformer "level"). Either axis still allows effects entering from any side.
export const SCENE_AXES = ['vertical', 'horizontal'] as const;
export const SceneAxisSchema = z.enum(SCENE_AXES);
export type SceneAxis = z.infer<typeof SceneAxisSchema>;

export const ELEMENT_TRACKS = ['content', 'media', 'background'] as const;
export const ElementTrackSchema = z.enum(ELEMENT_TRACKS);
export type ElementTrack = z.infer<typeof ElementTrackSchema>;

// How an element is laid out (scene-timeline.md). `flow` (default, absent) = the normal
// reading column / stage actor. `free` = a sprite that floats over the scene in a
// viewport-fixed overlay, positioned by its `path` motion in stage % — the side-scroller's
// jumping character. Orthogonal to `track` (which lane it groups under in the editor).
export const ELEMENT_PLACEMENTS = ['flow', 'free'] as const;
export const ElementPlacementSchema = z.enum(ELEMENT_PLACEMENTS);
export type ElementPlacement = z.infer<typeof ElementPlacementSchema>;

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

// A scene's background layer: a flat tint plus an optional media/canvas FILL and a scrim
// overlay for text legibility. `image` covers stills and GIFs; `canvas` references a
// curated, registry-validated background preset (P5/Three/D3/Canvas2D). `src` is an
// http(s)/relative URL only; durable asset upload is the Step-5 pipeline (data-model §8).
export const BACKGROUND_FITS = ['cover', 'contain'] as const;
const BackgroundFitSchema = z.enum(BACKGROUND_FITS);
const FocalPointSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });

const ImageFillSchema = z.object({
	kind: z.literal('image'),
	src: SafeUrlSchema.optional(),
	assetId: z.string().optional(),
	fit: BackgroundFitSchema.default('cover'),
	focalPoint: FocalPointSchema.optional(),
	poster: SafeUrlSchema.optional(), // shown under reduced motion (a GIF can't be paused)
	alt: z.string().optional()
});
const VideoFillSchema = z.object({
	kind: z.literal('video'),
	src: SafeUrlSchema.optional(),
	assetId: z.string().optional(),
	fit: BackgroundFitSchema.default('cover'),
	poster: SafeUrlSchema.optional(),
	loop: z.boolean().default(true)
});
const CanvasFillSchema = z.object({
	kind: z.literal('canvas'),
	preset: z.string().min(1),
	params: z.record(z.string(), z.unknown()).optional()
});
export const BackgroundFillSchema = z.discriminatedUnion('kind', [
	ImageFillSchema,
	VideoFillSchema,
	CanvasFillSchema
]);
export type BackgroundFill = z.infer<typeof BackgroundFillSchema>;

const BackgroundOverlaySchema = z.object({
	color: HexColorSchema.optional(),
	opacity: z.number().min(0).max(1).default(0.35)
});

const SceneBackgroundSchema = z
	.object({
		color: HexColorSchema.optional(),
		fill: BackgroundFillSchema.optional(),
		overlay: BackgroundOverlaySchema.optional()
	})
	.transform((background, ctx) => {
		// Validate a canvas fill THROUGH the background registry (like blocks/effects):
		// unknown preset or invalid params → path-aware error, params defaulted.
		if (background.fill?.kind === 'canvas') {
			const def = getBackground(background.fill.preset);
			if (!def) {
				ctx.addIssue({
					code: 'custom',
					path: ['fill', 'preset'],
					message: `Unknown background: "${background.fill.preset}".`
				});
				return z.NEVER;
			}
			const result = def.schema.safeParse(background.fill.params ?? {});
			if (!result.success) {
				for (const issue of result.error.issues) {
					ctx.addIssue({
						code: 'custom',
						path: ['fill', 'params', ...issue.path],
						message: issue.message
					});
				}
				return z.NEVER;
			}
			return {
				...background,
				fill: { ...background.fill, params: result.data as Record<string, unknown> }
			};
		}
		return background;
	});
export type SceneBackground = z.infer<typeof SceneBackgroundSchema>;

export const ElementSchema = z.object({
	id: z.string().min(1),
	track: ElementTrackSchema,
	block: BlockSchema,
	range: TimelineRangeSchema,
	placement: ElementPlacementSchema.optional(), // absent = 'flow'
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
		// The axis the scene scrolls along; absent = vertical (back-compat). `horizontal`
		// makes it a side-scroller (see SceneAxisSchema).
		scrollAxis: SceneAxisSchema.optional(),
		// Explicit scroll distance, in viewport-heights (vertical) or -widths (horizontal),
		// that the scene's timeline is interpolated over (scene-timeline.md §3). Overrides the
		// coarse `length` preset so authors can pace effects — e.g. "scroll 6 screens before
		// the photo fades in".
		scrollLength: z.number().min(1).max(20).optional(),
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

// Default scroll distance (in viewport-heights) per coarse `length` preset, when no
// explicit `scrollLength` is set.
const LENGTH_SCREENS: Record<SceneLength, number> = {
	auto: 2,
	short: 1,
	medium: 3,
	long: 6
};

/**
 * Resolved scroll distance, in viewport-heights, that a scene's timeline interpolates
 * over. Page scenes flow naturally (1 screen); timeline scenes use an explicit
 * `scrollLength` if set, else a sensible default for their `length` preset.
 */
export function sceneScrollScreens(scene: Pick<Scene, 'type' | 'length' | 'scrollLength'>): number {
	if (scene.type === 'page') return 1;
	return scene.scrollLength ?? LENGTH_SCREENS[scene.length];
}

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
