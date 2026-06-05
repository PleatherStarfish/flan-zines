import { describe, expect, it } from 'vitest';
import { allEffects, effectIds, effectsForSlot, getEffect, registerEffect } from './registry';
import type { EffectGroup, EffectSlot, ReducedMotionFallback } from './contract';
import { allBlocks } from '../registry';

const CATALOGUE = ['fade', 'rise', 'slide', 'pop', 'fly-in', 'parallax', 'float', 'ken-burns'];
const GROUPS: EffectGroup[] = ['appear', 'motion'];
const SLOTS: EffectSlot[] = ['enter', 'exit', 'motion'];
const FALLBACKS: ReducedMotionFallback[] = ['static', 'passthrough'];

describe('effect registry integrity', () => {
	it('registers the curated Step-4 catalogue', () => {
		expect(new Set(effectIds())).toEqual(new Set(CATALOGUE));
	});

	it("every effect's defaults satisfy its own params schema", () => {
		for (const def of allEffects()) {
			const result = def.schema.safeParse(def.defaults);
			expect(result.success, `${def.type} defaults fail schema`).toBe(true);
		}
	});

	it('every effect declares a valid group, slots, fallback, and label', () => {
		for (const def of allEffects()) {
			expect(GROUPS, `${def.type} group`).toContain(def.group);
			expect(def.slots.length, `${def.type} has no slots`).toBeGreaterThan(0);
			for (const slot of def.slots) expect(SLOTS).toContain(slot);
			expect(FALLBACKS, `${def.type} reducedMotion`).toContain(def.reducedMotion);
			expect(def.label.trim().length, `${def.type} missing label`).toBeGreaterThan(0);
			expect(def.icon.trim().length, `${def.type} missing icon`).toBeGreaterThan(0);
		}
	});

	it('exposes at most three knobs, each with non-empty options', () => {
		for (const def of allEffects()) {
			expect(def.knobs.length, `${def.type} has too many knobs`).toBeLessThanOrEqual(3);
			for (const knob of def.knobs) {
				expect(knob.options.length, `${def.type}.${knob.key} has no options`).toBeGreaterThan(0);
			}
		}
	});

	it('lazily loads a transform/opacity-only impl for every effect', async () => {
		for (const def of allEffects()) {
			expect(typeof def.load, `${def.type} load`).toBe('function');
			const impl = await def.load();
			expect(typeof impl, `${def.type} impl`).toBe('function');
			for (const phase of [0, 0.5, 1]) {
				const style = impl({ phase, params: def.defaults });
				const keys = Object.keys(style);
				expect(keys.every((k) => k === 'opacity' || k === 'transform')).toBe(true);
				if (style.transform) {
					expect(style.transform).toMatch(/^(translate|translateY|scale)/);
					expect(style.transform).not.toMatch(/url\(|expression|javascript:/i);
				}
			}
		}
	});

	it('appear effects are neutral at phase 1 and hidden/offset at phase 0', async () => {
		for (const def of effectsForSlot('enter', 'appear')) {
			const impl = await def.load();
			// phase 1 = settled in place: full opacity (or none, i.e. opaque).
			expect(impl({ phase: 1, params: def.defaults }).opacity ?? 1).toBeCloseTo(1);
			// phase 0 = not yet arrived: either faded out, or pushed off-screen by a transform.
			const gone = impl({ phase: 0, params: def.defaults });
			const hidden =
				(gone.opacity ?? 1) < 0.05 ||
				(gone.transform != null && gone.transform !== 'none' && /[1-9]/.test(gone.transform));
			expect(hidden, `${def.type} should be hidden or off-screen at phase 0`).toBe(true);
		}
	});

	it('motion effects drive transform without forcing opacity', async () => {
		for (const def of effectsForSlot('motion', 'motion')) {
			const impl = await def.load();
			const style = impl({ phase: 0.3, params: def.defaults });
			expect(style.transform).toBeTruthy();
			expect(style.opacity).toBeUndefined();
		}
	});

	it('rejects duplicate registration of an effect type', () => {
		const fade = getEffect('fade');
		expect(fade).toBeTruthy();
		expect(() => registerEffect(fade!)).toThrow(/Duplicate effect type/);
	});

	it("every block's allowedAnimations references a registered effect", () => {
		const ids = new Set(effectIds());
		for (const block of allBlocks()) {
			for (const id of block.allowedAnimations) {
				expect(ids.has(id), `${block.type} allows unregistered effect "${id}"`).toBe(true);
			}
		}
	});
});
