// The block + animation registries — the two extension points (IMPLEMENTATION_PLAN.md
// §2). The document schema, validator, and renderer read ONLY from here; nothing in
// the core hard-codes a block list. Adding a block = a new module + one registration
// line below.
import type { AnimationType } from './schema/types';
import type { AnyBlockDef, BlockDef } from './schema/block';
import { headingBlock } from './blocks/heading';
import { richTextBlock } from './blocks/richText';
import { imageBlock } from './blocks/image';
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
registerBlock(linkButtonBlock);
registerBlock(dividerBlock);
registerBlock(spacerBlock);

// The animation registry is populated in Step 4; kept here as the second extension
// point so its consumers have a stable import path.
export const animationRegistry = new Map<AnimationType, unknown>();
