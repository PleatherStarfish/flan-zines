// Stable, prefixed ids for the v3 story hierarchy. Selection, undo patches, and
// future beat/element references depend on them being stable + collision-free.
// crypto.randomUUID is available in Node 18+ and every modern browser.

function rid(): string {
	const c = globalThis.crypto;
	if (c?.randomUUID) return c.randomUUID().replace(/-/g, '').slice(0, 12);
	// Fallback for environments without Web Crypto (e.g. older Node test runners).
	return Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

export const newActId = (): string => `act_${rid()}`;
export const newSceneId = (): string => `scn_${rid()}`;
export const newBeatId = (): string => `beat_${rid()}`;
export const newElementId = (): string => `el_${rid()}`;
export const newBlockId = (): string => `blk_${rid()}`;
