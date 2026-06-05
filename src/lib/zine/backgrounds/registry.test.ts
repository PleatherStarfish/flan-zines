import { describe, expect, it } from 'vitest';
import { allBackgrounds, backgroundIds, getBackground, registerBackground } from './registry';
import type { BackgroundEngine, BackgroundReducedMotion } from './contract';

const CATALOGUE = ['drift-field', 'fish-flock'];
const ENGINES: BackgroundEngine[] = ['canvas2d', 'p5', 'three', 'd3'];
const FALLBACKS: BackgroundReducedMotion[] = ['static', 'still-frame', 'off'];

describe('background registry integrity', () => {
	it('registers the Phase-1 catalogue', () => {
		expect(new Set(backgroundIds())).toEqual(new Set(CATALOGUE));
	});

	it("every background's defaults satisfy its own schema", () => {
		for (const def of allBackgrounds()) {
			expect(def.schema.safeParse(def.defaults).success, `${def.type} defaults`).toBe(true);
		}
	});

	it('every background declares a valid engine, fallback, fps, and ≤3 knobs', () => {
		for (const def of allBackgrounds()) {
			expect(ENGINES, `${def.type} engine`).toContain(def.engine);
			expect(FALLBACKS, `${def.type} reducedMotion`).toContain(def.reducedMotion);
			expect(def.fps, `${def.type} fps`).toBeGreaterThan(0);
			expect(def.knobs.length, `${def.type} knobs`).toBeLessThanOrEqual(3);
			for (const knob of def.knobs) expect(knob.options.length).toBeGreaterThan(0);
			expect(def.label.trim().length).toBeGreaterThan(0);
			expect(def.icon.trim().length).toBeGreaterThan(0);
		}
	});

	it('lazily loads a factory exposing mount() for every background', async () => {
		for (const def of allBackgrounds()) {
			expect(typeof def.load).toBe('function');
			const factory = await def.load();
			expect(typeof factory.mount).toBe('function');
		}
	});

	it('rejects duplicate registration of a type', () => {
		const drift = getBackground('drift-field');
		expect(drift).toBeTruthy();
		expect(() => registerBackground(drift!)).toThrow(/Duplicate background type/);
	});
});
