// Pure helpers for `placement: 'pinned'` actors — the region/nudge math and the interactive-
// content guard. Framework-free + side-effect-free so the reader, the editor, and the publish
// gate share one source of truth (author ≡ published) and it's unit-testable without a DOM.
import type { Block } from '../schema/document';
import type { ElementAnchor, PinRegion } from '../schema/document';
import type { RichTextDoc, RichTextInline } from '../schema/richtext';

export const DEFAULT_PIN_REGION: PinRegion = 'center';
export const PINNED_INTERACTIVE_MESSAGE =
	'Pinned items can’t contain links or buttons — keep those with the scene instead.';
export const PINNED_TOO_LONG_MESSAGE =
	'Pinned text needs to stay short enough to fit on one screen — shorten it or keep it with the scene.';
export const PINNED_TALL_IMAGE_MESSAGE =
	'Pinned images should be landscape or square so they fit on screen — crop it or keep it in the story.';

const PINNED_HEADING_MAX_CHARS = 120;
const PINNED_RICHTEXT_MAX_CHARS = 240;
const PINNED_RICHTEXT_MAX_BLOCKS = 3;
const PINNED_IMAGE_MAX_ASPECT = 1.35;

/** Clamp a nudge value into the bounded step range and snap to an integer. */
export function clampNudge(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.max(-6, Math.min(6, Math.round(n)));
}

/** The region a pinned element sits at (default center). */
export function pinRegion(anchor: ElementAnchor | undefined): PinRegion {
	return anchor?.region ?? DEFAULT_PIN_REGION;
}

/**
 * Inline style for a pinned actor WRAPPER: the nudge only. The region positioning is static CSS
 * keyed off `data-region`; the nudge rides the `translate` longhand so it composes with the
 * region's centring `transform` and never collides with the block child's effect transform.
 * Each step ≈ 0.75rem. Returns '' when there's no nudge.
 */
export function pinNudgeStyle(anchor: ElementAnchor | undefined): string {
	const dx = clampNudge(anchor?.dx ?? 0);
	const dy = clampNudge(anchor?.dy ?? 0);
	if (dx === 0 && dy === 0) return '';
	return `translate:${(dx * 0.75).toFixed(2)}rem ${(dy * 0.75).toFixed(2)}rem`;
}

function richTextHasLink(doc: unknown): boolean {
	const content = (doc as RichTextDoc | undefined)?.content;
	if (!Array.isArray(content)) return false;
	const inlineHasLink = (inline: RichTextInline): boolean =>
		inline.type === 'text' && (inline.marks ?? []).some((mark) => mark.type === 'link');
	const scan = (nodes: unknown[]): boolean =>
		nodes.some((node) => {
			const n = node as { type?: string; content?: unknown[] };
			if (n.type === 'text' || n.type === 'hardBreak') return inlineHasLink(n as RichTextInline);
			return Array.isArray(n.content) ? scan(n.content) : false;
		});
	return scan(content);
}

function richTextStats(doc: unknown): { textLength: number; blockCount: number } {
	const content = (doc as RichTextDoc | undefined)?.content;
	if (!Array.isArray(content)) return { textLength: 0, blockCount: 0 };
	const scan = (nodes: unknown[]): { textLength: number; blockCount: number } =>
		nodes.reduce<{ textLength: number; blockCount: number }>(
			(stats, node) => {
				const n = node as { type?: string; text?: unknown; content?: unknown[] };
				if (n.type === 'text') {
					return {
						textLength: stats.textLength + (typeof n.text === 'string' ? n.text.length : 0),
						blockCount: stats.blockCount
					};
				}
				if (n.type === 'hardBreak') {
					return { textLength: stats.textLength + 1, blockCount: stats.blockCount };
				}
				const childStats = Array.isArray(n.content)
					? scan(n.content)
					: { textLength: 0, blockCount: 0 };
				return {
					textLength: stats.textLength + childStats.textLength,
					blockCount: stats.blockCount + 1 + childStats.blockCount
				};
			},
			{ textLength: 0, blockCount: 0 }
		);
	return scan(content);
}

/**
 * Is this block's content focusable / interactive? A `linkButton` block, or a `richText` that
 * contains a link mark. v1 refuses to PIN such blocks (focus/read-while-hidden hazard), and the
 * publish gate flags any that slip through. Pure — works on raw props.
 */
export function blockHasInteractiveContent(block: Pick<Block, 'type' | 'props'>): boolean {
	if (block.type === 'linkButton') return true;
	if (block.type === 'richText') {
		const props = block.props as { doc?: unknown } | undefined;
		return richTextHasLink(props?.doc);
	}
	return false;
}

/**
 * v1 pinned actors are intentionally brief: no focusable controls, no body-copy chunks, and no
 * tall portrait images that would be clipped in the viewport overlay. This is a deterministic
 * content guard, not DOM measurement; the renderer still has a max-size safety rail.
 */
export function pinnedContentProblem(block: Pick<Block, 'type' | 'props'>): string | null {
	if (blockHasInteractiveContent(block)) return PINNED_INTERACTIVE_MESSAGE;
	if (block.type === 'heading') {
		const text = ((block.props as { text?: unknown } | undefined)?.text ?? '').toString().trim();
		if (text.length > PINNED_HEADING_MAX_CHARS) return PINNED_TOO_LONG_MESSAGE;
	}
	if (block.type === 'richText') {
		const props = block.props as { doc?: unknown } | undefined;
		const stats = richTextStats(props?.doc);
		if (
			stats.textLength > PINNED_RICHTEXT_MAX_CHARS ||
			stats.blockCount > PINNED_RICHTEXT_MAX_BLOCKS
		) {
			return PINNED_TOO_LONG_MESSAGE;
		}
	}
	if (block.type === 'image') {
		const props = block.props as { width?: unknown; height?: unknown } | undefined;
		const width = typeof props?.width === 'number' ? props.width : 0;
		const height = typeof props?.height === 'number' ? props.height : 0;
		if (width > 0 && height / width > PINNED_IMAGE_MAX_ASPECT) return PINNED_TALL_IMAGE_MESSAGE;
	}
	return null;
}
