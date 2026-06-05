import { getContext, setContext } from 'svelte';

// The editor-decoration seam. The renderer (and BlockFrame) own this optional
// context; the EDITOR provides it to turn blocks into selectable surfaces. When it is
// absent (the public page), BlockFrame is inert — so ZineRenderer imports nothing from
// the editor and author ≡ published still holds.
export interface BlockDecoration {
	selectedId: string | null;
	select: (id: string) => void;
	/** False in Preview mode → BlockFrame renders inert (no selection chrome). */
	enabled: boolean;
}

const KEY = Symbol('zine.block-decoration');

/** Editor calls this with a getter so BlockFrame reads the CURRENT reactive value. */
export function setBlockDecoration(get: () => BlockDecoration): void {
	setContext(KEY, get);
}

export function getBlockDecoration(): (() => BlockDecoration) | undefined {
	return getContext(KEY);
}
