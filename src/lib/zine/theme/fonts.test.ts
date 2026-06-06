import { describe, expect, it } from 'vitest';
import {
	FONT_FAMILIES,
	FONT_PAIRS,
	customFontPairId,
	familyById,
	fontPairById,
	fontPairFamilies,
	themeFontFamilyIds
} from './fonts';

const familyIds = new Set(FONT_FAMILIES.map((f) => f.id));

describe('font registry', () => {
	it('every curated pair references registered families', () => {
		for (const pair of FONT_PAIRS) {
			expect(familyIds.has(pair.heading), `${pair.id} heading`).toBe(true);
			expect(familyIds.has(pair.body), `${pair.id} body`).toBe(true);
		}
	});

	it('resolves a curated pair to its heading/body CSS stacks', () => {
		const editorial = fontPairById('editorial');
		expect(editorial.heading).toBe(familyById('fraunces').stack);
		expect(editorial.body).toBe(familyById('source-sans').stack);
	});

	it('falls back to the default pair for an unknown/absent id', () => {
		expect(fontPairById(undefined).id).toBe('editorial');
		expect(fontPairById('nope').id).toBe('editorial');
	});

	it('resolves a custom combo encoded in the fontPair string', () => {
		const id = customFontPairId('lora', 'inter');
		expect(id).toBe('custom:lora:inter');
		const fams = fontPairFamilies(id);
		expect(fams.heading.id).toBe('lora');
		expect(fams.body.id).toBe('inter');
		expect(fontPairById(id).heading).toBe(familyById('lora').stack);
	});

	it('sanitises unknown family ids in a custom combo to the default family', () => {
		const fams = fontPairFamilies('custom:<script>:bogus');
		expect(fams.heading.id).toBe(FONT_FAMILIES[0].id);
		expect(fams.body.id).toBe(FONT_FAMILIES[0].id);
	});

	it('maps legacy pre-webfont ids to their nearest combo', () => {
		expect(fontPairFamilies('mono').id).toBe('typewriter');
		expect(fontPairFamilies('bold').id).toBe('clean');
	});

	it('lists the family ids a theme uses (deduped) for the lazy loader', () => {
		expect(themeFontFamilyIds({ fontPair: 'editorial' })).toEqual(['fraunces', 'source-sans']);
		expect(themeFontFamilyIds({ fontPair: 'classic' })).toEqual(['lora']); // heading == body
	});
});
