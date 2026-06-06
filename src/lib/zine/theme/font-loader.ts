// Lazy web-font loading. Each curated family's self-hosted @fontsource CSS is a SEPARATE
// dynamic import with a static specifier, so the bundler code-splits it: the base bundle
// ships no font files. The public reader pulls only the pairing the document uses
// (`loadThemeFonts`); the editor loads all families for the picker previews (`loadAllFonts`).
// Failures are swallowed — the CSS stack's system fallback keeps the text readable.
import type { Theme } from '../schema/theme';
import { FONT_FAMILIES, themeFontFamilyIds } from './fonts';

// family id → its @fontsource CSS import. Variable families load every weight in one file;
// the two static faces load their default weight.
const LOADERS: Record<string, () => Promise<unknown>> = {
	fraunces: () => import('@fontsource-variable/fraunces'),
	'dm-serif': () => import('@fontsource/dm-serif-display'),
	lora: () => import('@fontsource-variable/lora'),
	bitter: () => import('@fontsource-variable/bitter'),
	inter: () => import('@fontsource-variable/inter'),
	'source-sans': () => import('@fontsource-variable/source-sans-3'),
	nunito: () => import('@fontsource-variable/nunito'),
	'space-mono': () => import('@fontsource/space-mono'),
	caveat: () => import('@fontsource-variable/caveat')
};

/** Family ids that have a loader — must cover every FONT_FAMILIES id (guarded by a test) so
 *  no font can be selected that then silently never loads. */
export const LOADER_IDS = Object.keys(LOADERS);

const loaded = new Set<string>();

/** Load one family's web font (idempotent; no-op on the server or for an unknown id). */
export async function loadFamily(id: string): Promise<void> {
	if (typeof document === 'undefined' || loaded.has(id)) return;
	const load = LOADERS[id];
	if (!load) return;
	loaded.add(id);
	try {
		await load();
	} catch {
		loaded.delete(id); // allow a retry; the system fallback renders meanwhile
	}
}

export function loadFamilies(ids: string[]): void {
	for (const id of ids) void loadFamily(id);
}

/** Load just the families a document's theme uses — the public reader path. */
export function loadThemeFonts(theme: Theme | undefined): void {
	loadFamilies(themeFontFamilyIds(theme));
}

/** Load every curated family — the editor, so the font picker can preview them all. */
export function loadAllFonts(): void {
	loadFamilies(FONT_FAMILIES.map((f) => f.id));
}
