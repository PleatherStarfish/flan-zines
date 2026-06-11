import { describe, expect, it } from 'vitest';
import { BlockStyleSchema, ThemeSchema } from './theme';

const colors = {
	background: '#ffffff',
	text: '#101010',
	heading: '#101010',
	accent: '#e4572e',
	muted: '#6b7280'
};

describe('ThemeSchema (v4)', () => {
	it('accepts the full role/swatch model', () => {
		const parsed = ThemeSchema.safeParse({
			preset: 'np-12',
			fontPair: 'editorial',
			swatches: ['#ffffff', '#101010', '#e4572e'],
			colors
		});
		expect(parsed.success).toBe(true);
	});

	it('still accepts the legacy palette/accent keys', () => {
		expect(ThemeSchema.safeParse({ palette: 'ink', accent: '#e4572e' }).success).toBe(true);
	});

	it('rejects an unsafe (injection) colour in a role', () => {
		const parsed = ThemeSchema.safeParse({
			colors: { ...colors, accent: '#e4572e;background:url(https://x)' }
		});
		expect(parsed.success).toBe(false);
	});

	it('rejects an unsafe colour in the swatch pool', () => {
		expect(ThemeSchema.safeParse({ swatches: ['url(javascript:alert(1))'] }).success).toBe(false);
	});

	it('caps the swatch pool at twelve', () => {
		const swatches = Array.from({ length: 13 }, () => '#123456');
		expect(ThemeSchema.safeParse({ swatches }).success).toBe(false);
	});

	it('requires every role when colours are given (a complete render contract)', () => {
		expect(ThemeSchema.safeParse({ colors: { background: '#fff' } }).success).toBe(false);
	});
});

describe('BlockStyleSchema text frames', () => {
	it('accepts speech and thought frame defaults', () => {
		const parsed = BlockStyleSchema.safeParse({ textFrame: { kind: 'speech' } });
		expect(parsed.success).toBe(true);
		if (!parsed.success) return;
		expect(parsed.data.textFrame).toEqual({
			kind: 'speech',
			mode: 'speech',
			tail: 'auto',
			outline: 'clean',
			fill: 'paper',
			padding: 1
		});
	});

	it('accepts an optional speech target element id', () => {
		const parsed = BlockStyleSchema.safeParse({
			textFrame: { kind: 'speech', speakerElementId: 'speaker_image' }
		});
		expect(parsed.success).toBe(true);
		if (!parsed.success) return;
		expect(parsed.data.textFrame).toMatchObject({
			kind: 'speech',
			tail: 'auto',
			speakerElementId: 'speaker_image'
		});
	});

	it('accepts SMS sender metadata with safe image URLs only', () => {
		const parsed = BlockStyleSchema.safeParse({
			textFrame: {
				kind: 'sms',
				senderName: 'Maya',
				senderAvatar: { src: 'https://example.com/maya.png', alt: 'Maya smiling' }
			}
		});
		expect(parsed.success).toBe(true);
		if (parsed.success) expect(parsed.data.textFrame?.fill).toBe('message');
		expect(
			BlockStyleSchema.safeParse({
				textFrame: {
					kind: 'sms',
					senderAvatar: { src: 'javascript:alert(1)' }
				}
			}).success
		).toBe(false);
	});

	it('keeps frame colours bounded to hex', () => {
		expect(
			BlockStyleSchema.safeParse({
				textFrame: {
					kind: 'speech',
					fill: 'custom',
					color: '#fff;background:url(https://x)'
				}
			}).success
		).toBe(false);
	});
});
