import { z } from 'zod';
import { getBlock } from '../registry';
import { AnimationDescriptorSchema } from './animation';
import {
	BlockStyleSchema,
	SectionBackgroundSchema,
	SectionLayoutSchema,
	ThemeSchema
} from './theme';

// The document IS the contract. A zine = ordered Sections → ordered Blocks, each
// block validated against its registered schema. The schema is the single source of
// truth, derived from the registry — so adding a block needs no edits here.
export const CURRENT_SCHEMA_VERSION = 1 as const;

// A block envelope. `props` is parsed through the registry schema for `type`,
// yielding precise, path-aware errors ("Unknown block type", or
// `props.<field>: <reason>") and returning the normalized/defaulted props. This
// keeps the block registry schemas as the source of truth for render-time data.
export const BlockSchema = z
	.object({
		id: z.string().min(1),
		type: z.string().min(1),
		props: z.unknown(),
		style: BlockStyleSchema.optional(),
		animation: AnimationDescriptorSchema.optional()
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

export const SectionSchema = z.object({
	id: z.string().min(1),
	layout: SectionLayoutSchema.default('centered'),
	background: SectionBackgroundSchema.optional(),
	animation: AnimationDescriptorSchema.optional(),
	blocks: z.array(BlockSchema)
});
export type Section = z.infer<typeof SectionSchema>;

export const ZineDocumentSchema = z.object({
	schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
	theme: ThemeSchema.optional(),
	sections: z.array(SectionSchema)
});
export type ZineDocument = z.infer<typeof ZineDocumentSchema>;
