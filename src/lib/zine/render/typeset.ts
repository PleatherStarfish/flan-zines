// Pure resolver: a text kind + editorial typeset `role` + chips → concrete, bounded type settings the
// renderer applies as data-attributes / CSS custom properties on `.zine-block`. Framework-free
// and side-effect-free so the SAME function powers the reader and the editor preview
// (author ≡ published) and is exhaustively unit-testable without a DOM.
//
// It encodes the typographic RULES (docs/design/pinned-content-and-typesetting.md Part B):
//   • measure 45 / 62 / 75 ch (the cap is the readability guardrail)
//   • body leading floored at 1.45 (display roles may be tighter)
//   • justified is only valid on a medium/wide measure — clamped to left on a narrow one
//     (renderer-side enforcement, not merely hidden UI)
//   • "tidy line breaks" = text-wrap balance (display) / pretty (body)
import type { BlockStyle, TextKind, TypesetRole } from '../schema/theme';
import type { Element } from '../schema/document';

export interface ResolvedTypeset {
	/** True when any typeset field is set (so the renderer applies the measure/leading/role CSS). */
	hasTypeset: boolean;
	kind?: TextKind;
	role?: TypesetRole;
	/** Max line length in `ch` (the measure), or undefined to inherit the default. */
	measureCh?: number;
	/** Resolved line-height, or undefined to inherit. */
	leading?: number;
	/** Letter casing treatment, or undefined for normal. */
	textCase?: 'upper' | 'smallcaps';
	/** Effective alignment (justify clamped to left on a narrow measure). */
	align?: 'left' | 'center' | 'right' | 'justify';
	/** `text-wrap` value, or undefined to leave wrapping alone. */
	tidyWrap?: 'balance' | 'pretty';
}

const MEASURE_CH: Record<'narrow' | 'medium' | 'wide', number> = {
	narrow: 45,
	medium: 62,
	wide: 75
};

const TEXT_BLOCK_TYPES = new Set(['heading', 'richText']);

export function isTextBlockType(type: string): boolean {
	return TEXT_BLOCK_TYPES.has(type);
}

function headingLevel(props: unknown): number | undefined {
	if (!props || typeof props !== 'object') return undefined;
	const level = (props as { level?: unknown }).level;
	return typeof level === 'number' ? level : undefined;
}

export function defaultContentRole(
	blockType: string | undefined,
	props?: unknown
): TypesetRole | undefined {
	if (blockType === 'heading') return (headingLevel(props) ?? 2) >= 3 ? 'subhead' : 'headline';
	if (blockType === 'richText') return 'body';
	return undefined;
}

export function textKindForElement(
	element: Pick<Element, 'track' | 'placement' | 'motion' | 'block'>
): TextKind | undefined {
	if (!isTextBlockType(element.block.type)) return undefined;
	const explicit = element.block.style?.typeset?.kind;
	if (explicit) return explicit;
	if (element.track !== 'content') return 'other';
	if (element.placement || element.motion) return 'other';
	return 'content';
}

// A role's default measure when the author hasn't picked one explicitly.
const ROLE_MEASURE: Partial<Record<TypesetRole, 'narrow' | 'medium' | 'wide'>> = {
	subhead: 'medium',
	deck: 'wide',
	body: 'medium',
	pullquote: 'narrow',
	blockquote: 'medium',
	caption: 'narrow',
	byline: 'narrow'
};

// Display roles can use tight leading; text roles are floored at 1.45 for readability.
const DISPLAY_ROLES: ReadonlySet<TypesetRole> = new Set([
	'headline',
	'subhead',
	'kicker',
	'deck',
	'pullquote',
	'byline'
]);

function leadingValue(
	role: TypesetRole | undefined,
	leading: 'tight' | 'cozy' | 'airy' | undefined
): number | undefined {
	if (!role && !leading) return undefined;
	if (role && DISPLAY_ROLES.has(role)) {
		const map = { tight: 1.12, cozy: 1.25, airy: 1.4 } as const;
		if (leading) return map[leading];
		if (role === 'deck') return 1.3;
		if (role === 'subhead') return 1.22;
		return 1.15;
	}
	// body / blockquote / caption (text-level): never below 1.45.
	const map = { tight: 1.45, cozy: 1.6, airy: 1.8 } as const;
	return leading ? map[leading] : 1.55;
}

/** Resolve a block's style into concrete, bounded typeset values for the renderer. */
export function resolveTypeset(
	style: BlockStyle | undefined,
	blockType?: string,
	textKind?: TextKind,
	blockProps?: unknown
): ResolvedTypeset {
	const ts = style?.typeset;
	const kind = textKind ?? ts?.kind;
	const isContent = kind === 'content';
	const role = isContent ? (ts?.role ?? defaultContentRole(blockType, blockProps)) : ts?.role;
	const hasTypeset = Boolean(
		isContent ||
		(kind !== 'other' &&
			ts &&
			(ts.role || ts.measure || ts.leading || ts.case || ts.tidyWrap !== undefined))
	);

	if (kind === 'other') {
		return {
			hasTypeset: false,
			kind,
			align: style?.align
		};
	}

	const measureKey = ts?.measure ?? (role ? ROLE_MEASURE[role] : undefined);
	const measureCh = measureKey ? MEASURE_CH[measureKey] : undefined;

	// Justified is only valid on a medium/wide measure → clamp to left on a narrow one.
	let align = style?.align;
	if (align === 'justify' && measureKey === 'narrow') align = 'left';

	const rawCase = ts?.case ?? (role === 'kicker' || role === 'byline' ? 'smallcaps' : undefined);
	const textCase = rawCase === 'normal' || rawCase === undefined ? undefined : rawCase;

	const wantTidy =
		ts?.tidyWrap ??
		(role === 'headline' || role === 'subhead' || role === 'deck' || role === 'body'
			? true
			: false);
	const tidyWrap = wantTidy
		? role === 'body' || role === 'blockquote' || role === 'caption'
			? 'pretty'
			: 'balance'
		: undefined;

	return {
		hasTypeset,
		kind,
		role,
		measureCh,
		leading: leadingValue(role, ts?.leading),
		textCase,
		align,
		tidyWrap
	};
}
