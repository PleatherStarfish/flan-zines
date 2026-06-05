import { describe, expect, it } from 'vitest';
import { EffectRefSchema, registeredEffectIds } from './animation';
import { ElementSchema } from './document';

describe('EffectRefSchema (validated through the animation registry)', () => {
	it('exposes the registered effect ids', () => {
		expect(registeredEffectIds()).toContain('fade');
		expect(registeredEffectIds()).toContain('parallax');
	});

	it('rejects an unknown effect type with a path-aware error', () => {
		const result = EffectRefSchema.safeParse({ type: 'sparkles' });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].path).toEqual(['type']);
			expect(result.error.issues[0].message).toMatch(/Unknown effect type/);
		}
	});

	it('accepts a known effect and fills in default params', () => {
		const result = EffectRefSchema.safeParse({ type: 'fade' });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual({ type: 'fade', params: { speed: 'medium' } });
		}
	});

	it('rejects params that fail the effect schema, scoped to params.<field>', () => {
		const result = EffectRefSchema.safeParse({ type: 'rise', params: { amount: 'gigantic' } });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].path).toEqual(['params', 'amount']);
		}
	});

	it('validates an element placed on the timeline with enter/motion effects', () => {
		const ok = ElementSchema.safeParse({
			id: 'el_1',
			track: 'media',
			range: { start: 0.1, end: 0.8 },
			block: { id: 'blk_1', type: 'image', props: { src: '/x.svg', alt: 'A photo' } },
			enter: { type: 'rise' },
			motion: { type: 'parallax', params: { direction: 'down' } }
		});
		expect(ok.success).toBe(true);
		if (ok.success) {
			expect(ok.data.enter).toEqual({
				type: 'rise',
				params: { speed: 'medium', amount: 'medium', direction: 'up' }
			});
			expect(ok.data.motion?.params).toMatchObject({ direction: 'down' });
		}

		const bad = ElementSchema.safeParse({
			id: 'el_2',
			track: 'content',
			range: { start: 0, end: 1 },
			block: { id: 'blk_2', type: 'heading', props: { text: 'Hi', level: 2 } },
			enter: { type: 'not-an-effect' }
		});
		expect(bad.success).toBe(false);
	});
});
