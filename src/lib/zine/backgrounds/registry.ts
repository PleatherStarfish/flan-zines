// The background (scene canvas/media) registry — the third extension point, alongside the
// block and effect registries. The document schema, inspector picker, and renderer read
// ONLY from here; nothing hard-codes a preset list. Adding a curated background =
// one registerBackground(...) line + its schema + a lazy load() + a reduced-motion policy.
import type { AnyBackgroundDef, BackgroundDef } from './contract';
import { driftFieldBackground } from './presets/drift-field';
import { fishFlockBackground } from './presets/fish-flock';
import { organicGradientBackground } from './presets/organic-gradient';

const backgrounds = new Map<string, AnyBackgroundDef>();

export function registerBackground<P>(def: BackgroundDef<P>): void {
	if (backgrounds.has(def.type)) {
		throw new Error(`Duplicate background type registered: "${def.type}".`);
	}
	backgrounds.set(def.type, def as AnyBackgroundDef);
}

export function getBackground(type: string): AnyBackgroundDef | undefined {
	return backgrounds.get(type);
}

export function allBackgrounds(): AnyBackgroundDef[] {
	return [...backgrounds.values()];
}

export function backgroundIds(): string[] {
	return [...backgrounds.keys()];
}

// ── The curated catalogue ────────────────────────────────────────────────────────────
registerBackground(driftFieldBackground);
registerBackground(fishFlockBackground);
registerBackground(organicGradientBackground);
