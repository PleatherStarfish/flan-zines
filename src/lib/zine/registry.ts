// The two extension points (IMPLEMENTATION_PLAN.md §2). Block and animation
// definitions register here; the renderer and editor read ONLY from these maps —
// never a hard-coded type switch. Typed entries (BlockDef / AnimationDef) and the
// register helpers arrive with the schema in Steps 2 and 4.
import type { AnimationType, BlockType } from './schema/types';

export const blockRegistry = new Map<BlockType, unknown>();
export const animationRegistry = new Map<AnimationType, unknown>();
