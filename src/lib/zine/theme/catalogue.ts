// The curated theme catalogue — EDITOR-ONLY. Derives a legible role mapping (deriveTheme)
// from a curated colour-palette dataset, giving students a WIDE selection of ready themes.
// This module is only ever imported by the editor's theme browser (ThemePanel), so the
// dataset + culori land in the editor chunk and never reach the public reader bundle. The
// derivation is computed once and memoised.
//
// The palettes come from `palettes.data.ts`, a committed first-party module generated from
// nice-color-palettes (`pnpm build:themes`) — a direct node_modules JSON import is silently
// dropped by the production bundler, so the data is checked in instead.
import { NICE_PALETTES } from './palettes.data';
import { deriveTheme, isLegibleTheme, type CatalogueTheme } from './derive';

let cache: CatalogueTheme[] | null = null;

function build(): CatalogueTheme[] {
	const seen = new Set<string>();
	const themes: CatalogueTheme[] = [];
	NICE_PALETTES.forEach((palette, i) => {
		if (!Array.isArray(palette) || palette.length < 3) return;
		const theme = deriveTheme(`np-${i}`, palette);
		if (!isLegibleTheme(theme.colors)) return;
		const key = theme.swatches.join(',').toLowerCase();
		if (seen.has(key)) return;
		seen.add(key);
		themes.push(theme);
	});
	return themes;
}

/** The derived, legibility-filtered theme catalogue (built once, memoised). Synchronous —
 *  the data is committed and the derivation is pure, so there's nothing to await. */
export function getThemeCatalogue(): CatalogueTheme[] {
	if (!cache) cache = build();
	return cache;
}

/** Async convenience wrapper around {@link getThemeCatalogue}. */
export async function loadThemeCatalogue(): Promise<CatalogueTheme[]> {
	return getThemeCatalogue();
}
