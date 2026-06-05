import { describe, expect, it } from 'vitest';
import { allBlocks, blockTypes, getBlock, registerBlock } from './registry';

const CORE = ['heading', 'richText', 'image', 'linkButton', 'divider', 'spacer'];
const CATEGORIES = ['text', 'media', 'structure', 'interactive'];

describe('block registry integrity', () => {
	it('registers exactly the six core blocks', () => {
		expect(new Set(blockTypes())).toEqual(new Set(CORE));
	});

	it("every block's defaults satisfy its own schema", () => {
		for (const def of allBlocks()) {
			const result = def.schema.safeParse(def.defaults);
			expect(result.success, `${def.type} defaults fail schema`).toBe(true);
		}
	});

	it('every block declares a valid category and string allowedAnimations', () => {
		for (const def of allBlocks()) {
			expect(CATEGORIES).toContain(def.category);
			expect(Array.isArray(def.allowedAnimations)).toBe(true);
			for (const a of def.allowedAnimations) expect(typeof a).toBe('string');
		}
	});

	it('every block declares an editor label', () => {
		for (const def of allBlocks()) {
			expect(def.label.trim().length, `${def.type} missing label`).toBeGreaterThan(0);
		}
	});

	it('exposes a Render and an Inspector component for every block', () => {
		for (const def of allBlocks()) {
			expect(def.Render, `${def.type} missing Render`).toBeTruthy();
			expect(def.Inspector, `${def.type} missing Inspector`).toBeTruthy();
		}
	});

	it('rejects duplicate registration of a type', () => {
		const heading = getBlock('heading');
		expect(heading).toBeTruthy();
		expect(() => registerBlock(heading!)).toThrow(/Duplicate block type/);
	});
});
