// The block + animation registries — the two extension points (IMPLEMENTATION_PLAN.md
// §2). The document schema, validator, and renderer read ONLY from here; nothing in
// the core hard-codes a block list. Adding a block = a new module + one registration
// line below.
import type { AnyBlockDef, BlockDef } from './schema/block';
import { headingBlock } from './blocks/heading';
import { richTextBlock } from './blocks/richText';
import { imageBlock } from './blocks/image';
import { characterSpriteBlock } from './blocks/characterSprite';
import { linkButtonBlock } from './blocks/linkButton';
import { dividerBlock } from './blocks/divider';
import { spacerBlock } from './blocks/spacer';

const blocks = new Map<string, AnyBlockDef>();

export function registerBlock<P>(def: BlockDef<P>): void {
	if (blocks.has(def.type)) {
		throw new Error(`Duplicate block type registered: "${def.type}".`);
	}
	blocks.set(def.type, def as AnyBlockDef);
}

export function getBlock(type: string): AnyBlockDef | undefined {
	return blocks.get(type);
}

export function allBlocks(): AnyBlockDef[] {
	return [...blocks.values()];
}

export function blockTypes(): string[] {
	return [...blocks.keys()];
}

// Register the core blocks. This is the single place the core "knows" the concrete
// set; everything else discovers them through the functions above.
registerBlock(headingBlock);
registerBlock(richTextBlock);
registerBlock(imageBlock);
registerBlock(characterSpriteBlock);
registerBlock(linkButtonBlock);
registerBlock(dividerBlock);
registerBlock(spacerBlock);

// The animation (effect) registry is the second extension point. It lives in
// ./animations/registry so each effect can co-locate its schema + lazy impl; re-exported
// here so registry.ts stays the one place the core discovers BOTH registries.
export {
	allEffects,
	effectIds,
	effectsForSlot,
	getEffect,
	registerEffect
} from './animations/registry';

// The background registry is the third extension point (scene canvas/media backgrounds).
export {
	allBackgrounds,
	backgroundIds,
	getBackground,
	registerBackground
} from './backgrounds/registry';
