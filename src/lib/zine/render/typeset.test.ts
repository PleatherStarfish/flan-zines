import { describe, expect, it } from 'vitest';
import { resolveTypeset, textKindForElement } from './typeset';
import type { BlockStyle } from '../schema/theme';

const style = (s: BlockStyle): BlockStyle => s;

describe('resolveTypeset', () => {
	it('returns hasTypeset=false for a plain/empty style', () => {
		expect(resolveTypeset(undefined).hasTypeset).toBe(false);
		expect(resolveTypeset(style({ align: 'center' })).hasTypeset).toBe(false);
	});

	it('applies editorial defaults to content text and leaves other text plain', () => {
		const heading = resolveTypeset(style({ typeset: { kind: 'content' } }), 'heading', 'content');
		expect(heading.hasTypeset).toBe(true);
		expect(heading.role).toBe('headline');
		expect(heading.tidyWrap).toBe('balance');

		const subhead = resolveTypeset(style({ typeset: { kind: 'content' } }), 'heading', 'content', {
			text: 'A detail',
			level: 3
		});
		expect(subhead.role).toBe('subhead');
		expect(subhead.tidyWrap).toBe('balance');

		const body = resolveTypeset(style({ typeset: { kind: 'content' } }), 'richText', 'content');
		expect(body.role).toBe('body');
		expect(body.measureCh).toBe(62);
		expect(body.leading).toBeGreaterThanOrEqual(1.45);

		const other = resolveTypeset(
			style({ typeset: { kind: 'other', role: 'body' } }),
			'richText',
			'other'
		);
		expect(other.hasTypeset).toBe(false);
		expect(other.role).toBeUndefined();
	});

	it('maps the three measures to the classic 45 / 62 / 75 ch', () => {
		expect(resolveTypeset(style({ typeset: { measure: 'narrow' } })).measureCh).toBe(45);
		expect(resolveTypeset(style({ typeset: { measure: 'medium' } })).measureCh).toBe(62);
		expect(resolveTypeset(style({ typeset: { measure: 'wide' } })).measureCh).toBe(75);
	});

	it('gives a role a sensible default measure', () => {
		expect(resolveTypeset(style({ typeset: { role: 'body' } })).measureCh).toBe(62);
		expect(resolveTypeset(style({ typeset: { role: 'subhead' } })).measureCh).toBe(62);
		expect(resolveTypeset(style({ typeset: { role: 'pullquote' } })).measureCh).toBe(45);
		expect(resolveTypeset(style({ typeset: { role: 'deck' } })).measureCh).toBe(75);
	});

	it('floors body leading at 1.45 and lets display roles run tighter', () => {
		// Body "tight" must not go below 1.45 (readability rule).
		expect(resolveTypeset(style({ typeset: { role: 'body', leading: 'tight' } })).leading).toBe(
			1.45
		);
		expect(
			resolveTypeset(style({ typeset: { role: 'body', leading: 'airy' } })).leading
		).toBeGreaterThan(1.45);
		// A headline can be much tighter.
		expect(
			resolveTypeset(style({ typeset: { role: 'headline', leading: 'tight' } })).leading
		).toBeLessThan(1.45);
		expect(resolveTypeset(style({ typeset: { role: 'subhead', leading: 'tight' } })).leading).toBe(
			1.12
		);
	});

	it('enforces justify only on a medium/wide measure (narrow → left)', () => {
		expect(resolveTypeset(style({ align: 'justify', typeset: { measure: 'narrow' } })).align).toBe(
			'left'
		);
		expect(resolveTypeset(style({ align: 'justify', typeset: { measure: 'wide' } })).align).toBe(
			'justify'
		);
		// pullquote defaults to a narrow measure → justify is downgraded.
		expect(resolveTypeset(style({ align: 'justify', typeset: { role: 'pullquote' } })).align).toBe(
			'left'
		);
		// No measure set → default is wide enough, justify stays.
		expect(resolveTypeset(style({ align: 'justify' })).align).toBe('justify');
	});

	it('defaults kicker/byline to small caps and honours an explicit case', () => {
		expect(resolveTypeset(style({ typeset: { role: 'kicker' } })).textCase).toBe('smallcaps');
		expect(resolveTypeset(style({ typeset: { role: 'byline' } })).textCase).toBe('smallcaps');
		expect(resolveTypeset(style({ typeset: { role: 'body', case: 'upper' } })).textCase).toBe(
			'upper'
		);
		expect(
			resolveTypeset(style({ typeset: { role: 'kicker', case: 'normal' } })).textCase
		).toBeUndefined();
	});

	it('tidies line breaks: balance for display, pretty for body, off when disabled', () => {
		expect(resolveTypeset(style({ typeset: { role: 'headline' } })).tidyWrap).toBe('balance');
		expect(resolveTypeset(style({ typeset: { role: 'body' } })).tidyWrap).toBe('pretty');
		expect(
			resolveTypeset(style({ typeset: { role: 'headline', tidyWrap: false } })).tidyWrap
		).toBeUndefined();
		// A non-tidy role (caption) doesn't balance unless asked.
		expect(resolveTypeset(style({ typeset: { role: 'caption' } })).tidyWrap).toBeUndefined();
	});

	it('defaults text on non-content tracks to other text unless explicitly content', () => {
		const mediaLabel = textKindForElement({
			track: 'media',
			block: { id: 'blk', type: 'heading', props: { text: 'Diagram label', level: 3 } }
		});
		expect(mediaLabel).toBe('other');

		const explicitContent = textKindForElement({
			track: 'media',
			block: {
				id: 'blk',
				type: 'heading',
				props: { text: 'Essay label', level: 3 },
				style: { typeset: { kind: 'content' } }
			}
		});
		expect(explicitContent).toBe('content');
	});
});
