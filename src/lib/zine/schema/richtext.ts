import { z } from 'zod';
import { SafeUrlSchema } from './url';

// A constrained subset of the ProseMirror/TipTap document model — exactly the nodes
// and marks our rich-text block supports. The editor (Step 3, TipTap) PRODUCES this
// JSON; the read-only renderer (Step 2) INTERPRETS it. Keeping the renderer on a
// validated subset (not arbitrary HTML) is the safety + document/render-separation
// boundary: there is no `{@html}` of author content anywhere.

const BoldMark = z.object({ type: z.literal('bold') });
const ItalicMark = z.object({ type: z.literal('italic') });
const LinkMark = z.object({
	type: z.literal('link'),
	attrs: z.object({ href: SafeUrlSchema, target: z.string().optional() })
});
export const RichTextMarkSchema = z.discriminatedUnion('type', [BoldMark, ItalicMark, LinkMark]);
export type RichTextMark = z.infer<typeof RichTextMarkSchema>;

const TextNode = z.object({
	type: z.literal('text'),
	text: z.string(),
	marks: z.array(RichTextMarkSchema).optional()
});
const HardBreakNode = z.object({ type: z.literal('hardBreak') });
const InlineNode = z.discriminatedUnion('type', [TextNode, HardBreakNode]);
export type RichTextInline = z.infer<typeof InlineNode>;

const ParagraphNode = z.object({
	type: z.literal('paragraph'),
	content: z.array(InlineNode).optional()
});
const ListItemNode = z.object({
	type: z.literal('listItem'),
	content: z.array(ParagraphNode).min(1)
});
const BulletListNode = z.object({
	type: z.literal('bulletList'),
	content: z.array(ListItemNode)
});
const OrderedListNode = z.object({
	type: z.literal('orderedList'),
	attrs: z.object({ start: z.number().int().optional() }).optional(),
	content: z.array(ListItemNode)
});
const BlockContentNode = z.discriminatedUnion('type', [
	ParagraphNode,
	BulletListNode,
	OrderedListNode
]);
export type RichTextBlockNode = z.infer<typeof BlockContentNode>;

export const RichTextDocSchema = z.object({
	type: z.literal('doc'),
	content: z.array(BlockContentNode)
});
export type RichTextDoc = z.infer<typeof RichTextDocSchema>;
