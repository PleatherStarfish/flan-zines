import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer';
import { z } from 'zod';
import { getBlock } from '$lib/zine/registry';
import type {
	Act,
	Block,
	Beat,
	Element,
	ElementPlacement,
	ElementTrack,
	Pacing,
	PinRegion,
	Scene,
	SceneAxis,
	SceneBackground,
	SceneLength,
	SceneType,
	ZineDocument
} from '$lib/zine/schema/document';
import { PathParamsSchema, type Waypoint } from '$lib/zine/animations/path';
import { parseDocument } from '$lib/zine/schema/migrate';
import { BlockStyleSchema, type BlockStyle, type SectionKind } from '$lib/zine/schema/theme';
import type {
	TextKind,
	Theme,
	ThemeColors,
	ThemeRole,
	Typeset,
	TypesetRole
} from '$lib/zine/schema/theme';
import { clampNudge, pinnedContentProblem } from '$lib/zine/render/pinned';
import { defaultContentRole, isTextBlockType, textKindForElement } from '$lib/zine/render/typeset';
import { resolveThemeColors, themeSwatches } from '$lib/zine/theme/registry';
import type { AnimationDescriptor, EffectRef } from '$lib/zine/schema/animation';
import { newActId, newBeatId, newBlockId, newElementId, newSceneId } from './ids';
import { DraftSaver, type SavePayload, type SaveResult, type SaveStatus } from './autosave';

enablePatches();

type HistoryEntry = { patches: Patch[]; inverse: Patch[] };
type StarterBlock = {
	type: string;
	props?: unknown;
	track?: ElementTrack;
	placement?: ElementPlacement;
	motion?: EffectRef;
	range?: Element['range'];
};

// A decorative emoji "sticker" — a richText paragraph, NOT a heading, so playful scenery
// (clouds, platforms, the character) never pollutes the document's heading outline
// (a11y invariant: content headings are real h2+ section titles). Rendered large via CSS.
const sticker = (text: string, extra: Partial<StarterBlock> = {}): StarterBlock => ({
	type: 'richText',
	props: {
		doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
	},
	...extra
});

// A platform sits at a point along the side-scroll track (range.start → its left position);
// the reader scrolls and the stage pans to reveal them left-to-right.
const platform = (at: number): StarterBlock =>
	sticker('🟩🟩🟩', { track: 'media', range: { start: at, end: Math.min(1, at + 0.08) } });
// The character: a free sprite that jumps (arc) across the screen as the reader scrolls.
const jumpWaypoints: Waypoint[] = [
	{ at: 0, x: 18, y: 72, scale: 1, rotate: 0, ease: 'smooth' },
	{ at: 0.5, x: 50, y: 64, scale: 1, rotate: 0, ease: 'arc' },
	{ at: 1, x: 84, y: 70, scale: 1, rotate: 0, ease: 'arc' }
];

const STARTER_SCENES: Record<SceneType, StarterBlock[]> = {
	page: [{ type: 'heading', props: { text: 'New scene', level: 2 } }, { type: 'richText' }],
	feature: [{ type: 'image' }, { type: 'heading', props: { text: 'Picture moment', level: 2 } }],
	reveal: [
		{ type: 'heading', props: { text: 'Reveal moment', level: 2 } },
		{ type: 'richText' },
		{ type: 'image', track: 'media' }
	],
	parallax: [{ type: 'image', track: 'media' }, { type: 'richText' }],
	// A starter platformer: clouds + platforms along the track, and a free character that
	// jumps across the screen on a path. Open the character's clip to fine-tune the jumps.
	sidescroll: [
		sticker('☁️      ☁️', { track: 'background' }),
		platform(0.12),
		platform(0.46),
		platform(0.8),
		sticker('🧍', {
			track: 'media',
			placement: 'free',
			range: { start: 0, end: 1 },
			motion: { type: 'path', params: { waypoints: jumpWaypoints } }
		})
	],
	data: [{ type: 'heading', props: { text: 'What changes?', level: 2 } }, { type: 'richText' }]
};

export interface EditorStoreOptions {
	document: ZineDocument;
	zineId: string;
	baseUpdatedAt: string | null;
	/** Injected for tests; defaults to the PUT /draft endpoint in the browser. */
	save?: (payload: SavePayload) => Promise<SaveResult>;
}

const SHADOW_PREFIX = 'zine-draft-shadow:';
const DraftShadowSchema = z.object({
	document: z.unknown(),
	localRev: z.number().int().nonnegative(),
	baseUpdatedAt: z.string().nullable(),
	writtenAt: z.string()
});
type DraftShadow = Omit<z.infer<typeof DraftShadowSchema>, 'document'> & {
	document: ZineDocument;
};

export class EditorStore {
	doc = $state<ZineDocument>({ schemaVersion: 7, acts: [] });
	selectedId = $state<string | null>(null);
	mode = $state<'edit' | 'preview'>('edit');
	saveStatus = $state<SaveStatus>('idle');
	canUndo = $state(false);
	canRedo = $state(false);
	shadowRestored = $state(false);
	shadowWrittenAt = $state<string | null>(null);

	readonly zineId: string;
	readonly saver: DraftSaver;
	private undoStack: HistoryEntry[] = [];
	private redoStack: HistoryEntry[] = [];

	constructor(opts: EditorStoreOptions) {
		const shadow = readShadow(opts.zineId);
		this.doc = shadow?.document ?? opts.document;
		this.zineId = opts.zineId;
		this.shadowRestored = Boolean(shadow);
		this.shadowWrittenAt = shadow?.writtenAt ?? null;
		this.saver = new DraftSaver({
			save: opts.save ?? createEndpointSave(opts.zineId),
			getSnapshot: () => $state.snapshot(this.doc),
			baseUpdatedAt: shadow?.baseUpdatedAt ?? opts.baseUpdatedAt,
			onStatus: (status) => {
				this.saveStatus = status;
			},
			onAck: (rev) => {
				if (rev >= this.saver.localRev) this.clearShadow();
			}
		});
		if (shadow) this.saver.markDirty(shadow.localRev);
	}

	// ── core mutation engine ──────────────────────────────────────────────────
	private mutate(recipe: (draft: ZineDocument) => void): void {
		const base = $state.snapshot(this.doc) as ZineDocument;
		const [next, patches, inverse] = produceWithPatches(base, recipe);
		this.doc = next as ZineDocument;
		this.undoStack.push({ patches, inverse });
		this.redoStack = [];
		this.afterChange();
	}

	private afterChange(): void {
		this.canUndo = this.undoStack.length > 0;
		this.canRedo = this.redoStack.length > 0;
		const nextRev = this.saver.localRev + 1;
		this.writeShadow(nextRev);
		this.saver.markDirty(nextRev);
	}

	undo(): void {
		const entry = this.undoStack.pop();
		if (!entry) return;
		this.doc = applyPatches(
			$state.snapshot(this.doc) as ZineDocument,
			entry.inverse
		) as ZineDocument;
		this.redoStack.push(entry);
		this.afterChange();
	}

	redo(): void {
		const entry = this.redoStack.pop();
		if (!entry) return;
		this.doc = applyPatches(
			$state.snapshot(this.doc) as ZineDocument,
			entry.patches
		) as ZineDocument;
		this.undoStack.push(entry);
		this.afterChange();
	}

	// ── selection / view ──────────────────────────────────────────────────────
	select(id: string | null): void {
		this.selectedId = id;
	}
	setMode(mode: 'edit' | 'preview'): void {
		this.mode = mode;
	}

	// ── lookups ───────────────────────────────────────────────────────────────
	get selectedElement(): { actId: string; sceneId: string; element: Element } | null {
		for (const act of this.doc.acts) {
			for (const scene of act.scenes) {
				const element = scene.elements.find((candidate) => candidate.id === this.selectedId);
				if (element) return { actId: act.id, sceneId: scene.id, element };
			}
		}
		return null;
	}
	get selectedBlock(): { actId: string; sceneId: string; element: Element; block: Block } | null {
		const selected = this.selectedElement;
		return selected ? { ...selected, block: selected.element.block } : null;
	}
	get selectedScene(): Scene | null {
		for (const act of this.doc.acts) {
			const scene = act.scenes.find((candidate) => candidate.id === this.selectedId);
			if (scene) return scene;
		}
		return null;
	}
	get selectedSection(): Scene | null {
		return this.selectedScene;
	}

	// ── act intents ───────────────────────────────────────────────────────────
	addAct(title?: string): string {
		const id = newActId();
		this.mutate((draft) => {
			draft.acts.push({ id, title: title || undefined, scenes: [] });
		});
		this.selectedId = id;
		return id;
	}
	setActTitle(actId: string, title: string): void {
		this.mutate((draft) => {
			const act = draft.acts.find((candidate) => candidate.id === actId);
			if (act) act.title = title || undefined;
		});
	}
	moveAct(actId: string, dir: 'up' | 'down'): void {
		this.mutate((draft) => move(draft.acts, (act) => act.id === actId, dir));
	}
	removeAct(actId: string): void {
		this.mutate((draft) => {
			draft.acts = draft.acts.filter((act) => act.id !== actId);
		});
		if (this.selectedId === actId) this.selectedId = null;
	}

	// ── scene intents ─────────────────────────────────────────────────────────
	addScene(actId?: string, type: SceneType = 'page'): string {
		const id = newSceneId();
		const newActIdForScene = actId ?? this.doc.acts.at(-1)?.id ?? newActId();
		this.mutate((draft) => {
			let act = draft.acts.find((candidate) => candidate.id === newActIdForScene);
			if (!act) {
				act = { id: newActIdForScene, scenes: [] };
				draft.acts.push(act);
			}
			act.scenes.push(createScene(id, type, []));
		});
		this.selectedId = id;
		return id;
	}
	addStarterScene(actId: string | undefined, type: SceneType = 'page'): string {
		const id = newSceneId();
		const newActIdForScene = actId ?? this.doc.acts.at(-1)?.id ?? newActId();
		this.mutate((draft) => {
			let act = draft.acts.find((candidate) => candidate.id === newActIdForScene);
			if (!act) {
				act = { id: newActIdForScene, scenes: [] };
				draft.acts.push(act);
			}
			const elements = STARTER_SCENES[type]
				.map(createElementFromStarter)
				.filter(Boolean) as Element[];
			act.scenes.push(createScene(id, type, elements));
		});
		this.selectedId = id;
		return id;
	}
	setSceneType(sceneId: string, type: SceneType): void {
		this.mutate((draft) => {
			const scene = findScene(draft, sceneId)?.scene;
			if (!scene) return;
			scene.type = type;
			if (type === 'page') {
				const firstBeat = scene.beats[0] ?? { id: newBeatId(), at: 0 };
				scene.beats = [{ ...firstBeat, at: 0, state: undefined }];
			}
		});
	}
	setSceneLabel(sceneId: string, label: string): void {
		this.mutate((draft) => {
			const scene = findScene(draft, sceneId)?.scene;
			if (scene) scene.label = label || undefined;
		});
	}
	setSceneLength(sceneId: string, length: SceneLength): void {
		this.mutate((draft) => {
			const scene = findScene(draft, sceneId)?.scene;
			if (scene) scene.length = length;
		});
	}
	/** Set (or clear, with `undefined`) the scene's explicit scroll distance in whole screens. */
	setSceneScroll(sceneId: string, screens: number | undefined): void {
		this.mutate((draft) => {
			const scene = findScene(draft, sceneId)?.scene;
			if (!scene) return;
			if (screens == null) delete scene.scrollLength;
			else scene.scrollLength = Math.max(1, Math.round(screens));
		});
	}
	/** Switch a scene between vertical and side-scroll. `vertical` is stored as absence. */
	setSceneScrollAxis(sceneId: string, axis: SceneAxis): void {
		this.mutate((draft) => {
			const scene = findScene(draft, sceneId)?.scene;
			if (!scene) return;
			if (axis === 'vertical') delete scene.scrollAxis;
			else scene.scrollAxis = axis;
		});
	}
	/** Set (or clear, with `undefined`) the scene's background layer. Re-validated on save. */
	setSceneBackground(sceneId: string, background: SceneBackground | undefined): void {
		this.mutate((draft) => {
			const scene = findScene(draft, sceneId)?.scene;
			if (!scene) return;
			if (background) scene.background = background;
			else delete scene.background;
		});
	}
	moveScene(sceneId: string, dir: 'up' | 'down'): void {
		this.mutate((draft) => {
			const found = findScene(draft, sceneId);
			if (found) move(found.act.scenes, (scene) => scene.id === sceneId, dir);
		});
	}
	moveSceneBefore(sceneId: string, targetSceneId: string): void {
		if (sceneId === targetSceneId) return;
		this.mutate((draft) => {
			const moving = takeScene(draft, sceneId);
			if (!moving) return;
			const target = findSceneIndex(draft, targetSceneId);
			if (!target) {
				const fallback = draft.acts.at(-1);
				fallback?.scenes.push(moving);
				return;
			}
			target.act.scenes.splice(target.index, 0, moving);
		});
	}
	moveSceneToActEnd(sceneId: string, actId: string): void {
		this.mutate((draft) => {
			const act = draft.acts.find((candidate) => candidate.id === actId);
			if (!act) return;
			const moving = takeScene(draft, sceneId);
			if (moving) act.scenes.push(moving);
		});
	}
	removeScene(sceneId: string): void {
		this.mutate((draft) => {
			for (const act of draft.acts) {
				act.scenes = act.scenes.filter((scene) => scene.id !== sceneId);
			}
		});
		if (this.selectedId === sceneId) this.selectedId = null;
	}

	// Compatibility wrappers until the Story Map replaces the Step-3 rail.
	addSection(kind: SectionKind = 'prose'): string {
		return this.addScene(this.doc.acts.at(-1)?.id, sectionKindToSceneType(kind));
	}
	setSectionKind(sceneId: string, kind: SectionKind): void {
		this.setSceneType(sceneId, sectionKindToSceneType(kind));
	}
	setSectionLabel(sceneId: string, label: string): void {
		this.setSceneLabel(sceneId, label);
	}
	moveSection(sceneId: string, dir: 'up' | 'down'): void {
		this.moveScene(sceneId, dir);
	}
	removeSection(sceneId: string): void {
		this.removeScene(sceneId);
	}

	// ── element intents ───────────────────────────────────────────────────────
	addElement(sceneId: string, type: string, afterElementId?: string): string | null {
		const def = getBlock(type);
		if (!def) return null;
		const newElement = createElementFromStarter({ type });
		this.mutate((draft) => {
			const scene = findScene(draft, sceneId)?.scene;
			if (!scene || !newElement) return;
			const at = afterElementId
				? scene.elements.findIndex((element) => element.id === afterElementId) + 1
				: scene.elements.length;
			scene.elements.splice(at, 0, newElement);
		});
		this.selectedId = newElement?.id ?? null;
		return newElement?.id ?? null;
	}
	addElementAt(sceneId: string, type: string, track: ElementTrack, start = 0): string | null {
		const newElement = createElementFromStarter({ type, track });
		if (!newElement) return null;
		const duration = track === 'media' ? 0.7 : 0.42;
		newElement.range = rangeFromStart(start, duration);
		this.mutate((draft) => {
			const scene = findScene(draft, sceneId)?.scene;
			if (!scene) return;
			scene.elements.push(newElement);
		});
		this.selectedId = newElement.id;
		return newElement.id;
	}
	updateElementBlockProps(elementId: string, props: unknown): void {
		this.mutate((draft) => {
			const element = findElement(draft, elementId)?.element;
			if (!element) return;
			element.block.props = props;
			if (element.placement === 'pinned' && pinnedContentProblem(element.block)) {
				moveElementToFlow(element);
			}
		});
	}
	updateElementTrack(elementId: string, track: ElementTrack): void {
		this.mutate((draft) => {
			const element = findElement(draft, elementId)?.element;
			if (element) element.track = track;
		});
	}
	updateElementStyle(elementId: string, style: BlockStyle): void {
		const parsed = BlockStyleSchema.safeParse(style);
		if (!parsed.success) return;
		this.mutate((draft) => {
			const element = findElement(draft, elementId)?.element;
			if (!element) return;
			if (Object.keys(parsed.data).length) element.block.style = parsed.data;
			else delete element.block.style;
		});
	}
	updateElementRange(elementId: string, range: Element['range']): void {
		this.mutate((draft) => {
			const element = findElement(draft, elementId)?.element;
			if (element) element.range = normalizeRange(range);
		});
	}
	updateElementLegacyAnimation(
		elementId: string,
		legacyAnimation: AnimationDescriptor | undefined
	): void {
		this.mutate((draft) => {
			const element = findElement(draft, elementId)?.element;
			if (element) element.legacyAnimation = legacyAnimation;
		});
	}
	/**
	 * Set (or clear, with `undefined`) one of an element's choreography slots. `ref` is a
	 * registry EffectRef; it is re-validated against the effect's schema at save/render.
	 */
	setElementEffect(
		elementId: string,
		slot: 'enter' | 'exit' | 'motion',
		ref: EffectRef | undefined
	): void {
		this.mutate((draft) => {
			const element = findElement(draft, elementId)?.element;
			if (!element) return;
			if (slot === 'motion' && element.placement === 'pinned') {
				if (!ref) delete element.motion;
				return;
			}
			if (slot === 'motion' && ref && textKindForElement(element) === 'content') {
				setTextKindOnElement(element, 'other');
			}
			if (ref) element[slot] = ref;
			else delete element[slot];
		});
	}
	/** Set (or clear, with `undefined`/`flow`) an element's placement. `free` = a path-driven
	 *  sprite; `pinned` = content anchored to a screen region. v1 refuses to PIN a block whose
	 *  content is focusable or too large to fit comfortably on screen. */
	setElementPlacement(elementId: string, placement: ElementPlacement | undefined): void {
		this.mutate((draft) => {
			const found = findElement(draft, elementId);
			if (!found) return;
			const { scene, element } = found;
			if (placement === 'free') {
				if (isTextBlockType(element.block.type)) setTextKindOnElement(element, 'other');
				element.placement = 'free';
				delete element.anchor;
			} else if (placement === 'pinned') {
				pinElement(scene, element);
			} else {
				moveElementToFlow(element);
			}
		});
	}

	/** True when an element's block may be pinned. For UI gating. */
	canPin(elementId: string): boolean {
		const element = findElement(this.doc, elementId)?.element;
		return element ? !pinnedContentProblem(element.block) : false;
	}

	/** Set a pinned element's screen region (makes it `pinned` if it wasn't). */
	setElementAnchorRegion(elementId: string, region: PinRegion): void {
		this.mutate((draft) => {
			const found = findElement(draft, elementId);
			if (!found || !pinElement(found.scene, found.element)) return;
			const element = found.element;
			element.anchor = { region, dx: element.anchor?.dx ?? 0, dy: element.anchor?.dy ?? 0 };
		});
	}

	/** Nudge a pinned element by one step on an axis ("move left/right/up/down"), clamped. */
	nudgeAnchor(elementId: string, axis: 'x' | 'y', delta: number): void {
		this.mutate((draft) => {
			const element = findElement(draft, elementId)?.element;
			if (!element?.anchor) return;
			if (axis === 'x') element.anchor.dx = clampNudge(element.anchor.dx + delta);
			else element.anchor.dy = clampNudge(element.anchor.dy + delta);
		});
	}

	/** Reset a pinned element back to its bare region (no nudge). */
	resetAnchorNudge(elementId: string): void {
		this.mutate((draft) => {
			const element = findElement(draft, elementId)?.element;
			if (!element?.anchor) return;
			element.anchor.dx = 0;
			element.anchor.dy = 0;
		});
	}

	/** Merge editorial typeset fields onto a text block (validated; empties cleared). */
	setTypeset(elementId: string, partial: Partial<Typeset>): void {
		this.mutate((draft) => {
			const element = findElement(draft, elementId)?.element;
			if (!element || !isTextBlockType(element.block.type)) return;
			const nextTypeset: Record<string, unknown> = {
				...(element.block.style?.typeset ?? {}),
				...partial
			};
			if (nextTypeset.kind !== 'other') nextTypeset.kind = 'content';
			for (const key of Object.keys(nextTypeset)) {
				if (nextTypeset[key] === undefined || nextTypeset[key] === null) delete nextTypeset[key];
			}
			const nextStyle: Record<string, unknown> = { ...(element.block.style ?? {}) };
			if (Object.keys(nextTypeset).length) nextStyle.typeset = nextTypeset;
			else delete nextStyle.typeset;
			const parsed = BlockStyleSchema.safeParse(nextStyle);
			if (!parsed.success) return;
			if (Object.keys(parsed.data).length) element.block.style = parsed.data;
			else delete element.block.style;
		});
	}

	/** Apply an editorial role preset (or clear it). */
	setTypesetRole(elementId: string, role: TypesetRole | undefined): void {
		this.setTypeset(elementId, { role });
	}

	/** Switch a text block between editorial content and freer diagram/label text. */
	setTextKind(elementId: string, kind: TextKind): void {
		this.mutate((draft) => {
			const element = findElement(draft, elementId)?.element;
			if (!element || !isTextBlockType(element.block.type)) return;
			setTextKindOnElement(element, kind);
		});
	}

	/** Add a pinned heading that animates in after the previous pinned clip (the "one at a time"
	 *  sequence). Promotes a `page` scene to a timeline (`reveal`) scene so there's middle scroll
	 *  to sequence within — a one-way, content-lossless change. */
	addPinnedText(sceneId: string): string | null {
		const headingDef = getBlock('heading');
		if (!headingDef) return null;
		const id = newElementId();
		const blockId = newBlockId();
		this.mutate((draft) => {
			const scene = findScene(draft, sceneId)?.scene;
			if (!scene) return;
			promoteSceneForPinned(scene);
			const pinned = scene.elements.filter((element) => element.placement === 'pinned');
			const prev = pinned.at(-1);
			const start = prev ? Math.min(0.8, roundProgress(prev.range.start + 0.3)) : 0;
			const props =
				headingDef.schema.safeParse({ text: 'New point', level: 2 }).data ?? headingDef.defaults;
			scene.elements.push({
				id,
				track: 'content',
				block: {
					id: blockId,
					type: 'heading',
					props,
					style: { typeset: { kind: 'other' } }
				} as Block,
				range: rangeFromStart(start, 0.42),
				placement: 'pinned',
				anchor: { region: 'center', dx: 0, dy: 0 }
			});
		});
		this.selectedId = id;
		return id;
	}
	/** Make an element a free sprite that follows `waypoints` on scroll (the `path` motion). */
	setElementPath(elementId: string, waypoints: Waypoint[]): void {
		const parsed = PathParamsSchema.safeParse({ waypoints });
		if (!parsed.success) return;
		this.mutate((draft) => {
			const element = findElement(draft, elementId)?.element;
			if (!element) return;
			element.placement = 'free';
			delete element.anchor;
			if (isTextBlockType(element.block.type)) setTextKindOnElement(element, 'other');
			element.motion = {
				type: 'path',
				params: { waypoints: structuredClone(parsed.data.waypoints) }
			};
		});
	}
	moveElement(elementId: string, dir: 'up' | 'down'): void {
		this.mutate((draft) => {
			const found = findElement(draft, elementId);
			if (found) move(found.scene.elements, (element) => element.id === elementId, dir);
		});
	}
	moveElementNear(elementId: string, targetElementId: string, position: 'before' | 'after'): void {
		if (elementId === targetElementId) return;
		this.mutate((draft) => {
			const movingFound = findElement(draft, elementId);
			const targetFound = findElement(draft, targetElementId);
			if (!movingFound || !targetFound || movingFound.scene.id !== targetFound.scene.id) return;
			const elements = movingFound.scene.elements;
			const from = elements.findIndex((element) => element.id === elementId);
			if (from < 0) return;
			const [moving] = elements.splice(from, 1);
			const target = elements.findIndex((element) => element.id === targetElementId);
			if (target < 0) {
				elements.splice(from, 0, moving);
				return;
			}
			elements.splice(position === 'before' ? target : target + 1, 0, moving);
		});
	}
	removeElement(elementId: string): void {
		this.mutate((draft) => {
			for (const act of draft.acts) {
				for (const scene of act.scenes) {
					scene.elements = scene.elements.filter((element) => element.id !== elementId);
				}
			}
		});
		if (this.selectedId === elementId) this.selectedId = null;
	}

	addBeat(sceneId: string, at = 0): string {
		const id = newBeatId();
		let existingPageBeatId: string | null = null;
		this.mutate((draft) => {
			const scene = findScene(draft, sceneId)?.scene;
			if (!scene) return;
			if (scene.type === 'page') {
				const firstBeat = scene.beats[0] ?? { id: newBeatId(), at: 0 };
				scene.beats = [{ ...firstBeat, at: 0, state: undefined }];
				existingPageBeatId = firstBeat.id;
				return;
			}
			scene.beats.push({ id, at });
			scene.beats.sort((a, b) => a.at - b.at);
		});
		return existingPageBeatId ?? id;
	}
	updateBeat(sceneId: string, beatId: string, next: Partial<Beat>): void {
		this.mutate((draft) => {
			const scene = findScene(draft, sceneId)?.scene;
			const beat = scene?.beats.find((candidate) => candidate.id === beatId);
			if (!scene || !beat) return;
			if (scene.type === 'page') {
				beat.label = next.label ?? beat.label;
				beat.at = 0;
				beat.state = undefined;
				scene.beats = [beat];
				return;
			}
			Object.assign(beat, next);
			scene.beats.sort((a, b) => a.at - b.at);
		});
	}
	removeBeat(sceneId: string, beatId: string): void {
		this.mutate((draft) => {
			const scene = findScene(draft, sceneId)?.scene;
			if (!scene || scene.beats.length <= 1) return;
			scene.beats = scene.beats.filter((beat) => beat.id !== beatId);
			for (const element of scene.elements) {
				if (element.anchorBeat === beatId) element.anchorBeat = undefined;
			}
		});
	}

	// Compatibility wrappers until component names are replaced in Increment 2.
	addBlock(sceneId: string, type: string, afterElementId?: string): string | null {
		return this.addElement(sceneId, type, afterElementId);
	}
	updateBlockProps(elementId: string, props: unknown): void {
		this.updateElementBlockProps(elementId, props);
	}
	updateBlockStyle(elementId: string, style: BlockStyle): void {
		this.updateElementStyle(elementId, style);
	}
	moveBlock(elementId: string, dir: 'up' | 'down'): void {
		this.moveElement(elementId, dir);
	}
	removeBlock(elementId: string): void {
		this.removeElement(elementId);
	}

	// ── scene continuity ───────────────────────────────────────────────────────
	/** Set (or clear, with `undefined`) the document pacing — how much scenes breathe and how
	 *  soft the backdrop crossfade is. Absent = the renderer's 'cozy' default. */
	setPacing(pacing: Pacing | undefined): void {
		this.mutate((draft) => {
			if (pacing) draft.pacing = pacing;
			else delete draft.pacing;
		});
	}

	// ── theme ─────────────────────────────────────────────────────────────────
	setTheme(theme: Theme): void {
		this.mutate((draft) => {
			draft.theme = { ...draft.theme, ...theme };
		});
	}

	/** Apply a curated catalogue theme: its swatch pool + role colours, recording its id. */
	applyThemePreset(preset: { id: string; swatches: string[]; colors: ThemeColors }): void {
		this.mutate((draft) => {
			draft.theme = {
				...draft.theme,
				preset: preset.id,
				swatches: [...preset.swatches],
				colors: { ...preset.colors }
			};
		});
	}

	/** Bind one semantic role (background/text/heading/accent/muted) to a colour. */
	setThemeRole(role: ThemeRole, color: string): void {
		this.mutate((draft) => {
			const colors: ThemeColors = { ...resolveThemeColors(draft.theme), [role]: color };
			draft.theme = { ...draft.theme, colors };
		});
	}

	/** Convenience: set the page background colour (the `background` role). */
	setThemeBackgroundColor(color: string): void {
		this.setThemeRole('background', color);
	}

	/** Edit a swatch in the theme's pool, re-pointing any role still bound to its old value. */
	setThemeSwatch(index: number, color: string): void {
		this.mutate((draft) => {
			const swatches = [...themeSwatches(draft.theme)];
			if (index < 0 || index >= swatches.length) return;
			const previous = swatches[index];
			swatches[index] = color;
			const colors: ThemeColors = { ...resolveThemeColors(draft.theme) };
			if (previous) {
				for (const role of Object.keys(colors) as ThemeRole[]) {
					if (colors[role] === previous) colors[role] = color;
				}
			}
			draft.theme = { ...draft.theme, swatches, colors };
		});
	}

	/** Append a custom swatch to the theme's pool (capped at the schema's 12). */
	addThemeSwatch(color: string): void {
		this.mutate((draft) => {
			const swatches = [...themeSwatches(draft.theme), color].slice(0, 12);
			draft.theme = { ...draft.theme, swatches };
		});
	}

	// ── persistence helpers ───────────────────────────────────────────────────
	private writeShadow(localRev = this.saver.localRev): void {
		if (typeof localStorage === 'undefined') return;
		const writtenAt = new Date().toISOString();
		try {
			localStorage.setItem(
				SHADOW_PREFIX + this.zineId,
				JSON.stringify({
					document: $state.snapshot(this.doc),
					localRev,
					baseUpdatedAt: this.saver.baseUpdatedAt,
					writtenAt
				})
			);
			this.shadowWrittenAt = writtenAt;
		} catch {
			// localStorage full / disabled — the server save is still the primary path.
		}
	}
	private clearShadow(): void {
		if (typeof localStorage === 'undefined') return;
		try {
			localStorage.removeItem(SHADOW_PREFIX + this.zineId);
			this.shadowRestored = false;
			this.shadowWrittenAt = null;
		} catch {
			// A stuck shadow is safer than deleting unsaved work by mistake.
		}
	}
	keepLocalAfterConflict(): void {
		this.saver.resolveKeepLocal();
		this.writeShadow(this.saver.localRev);
	}
	discardLocalShadow(): void {
		this.clearShadow();
	}
	get conflictServerUpdatedAt(): string | null {
		return this.saver.conflictServerUpdatedAt;
	}
	flushNow(): Promise<void> {
		return this.saver.flushNow();
	}
	dispose(): void {
		this.saver.dispose();
	}
}

// ── module helpers ──────────────────────────────────────────────────────────
function findScene(draft: ZineDocument, sceneId: string): { act: Act; scene: Scene } | undefined {
	for (const act of draft.acts) {
		const scene = act.scenes.find((candidate) => candidate.id === sceneId);
		if (scene) return { act, scene };
	}
	return undefined;
}

function findSceneIndex(
	draft: ZineDocument,
	sceneId: string
): { act: Act; index: number } | undefined {
	for (const act of draft.acts) {
		const index = act.scenes.findIndex((candidate) => candidate.id === sceneId);
		if (index >= 0) return { act, index };
	}
	return undefined;
}

function takeScene(draft: ZineDocument, sceneId: string): Scene | undefined {
	const found = findSceneIndex(draft, sceneId);
	if (!found) return undefined;
	const [scene] = found.act.scenes.splice(found.index, 1);
	return scene;
}

function findElement(
	draft: ZineDocument,
	elementId: string
): { act: Act; scene: Scene; element: Element } | undefined {
	for (const act of draft.acts) {
		for (const scene of act.scenes) {
			const element = scene.elements.find((candidate) => candidate.id === elementId);
			if (element) return { act, scene, element };
		}
	}
	return undefined;
}

function promoteSceneForPinned(scene: Scene): void {
	if (scene.type !== 'page') return;
	scene.type = 'reveal';
	if (scene.length === 'auto') scene.length = 'long';
}

function pinElement(scene: Scene, element: Element): boolean {
	if (pinnedContentProblem(element.block)) return false;
	if (isTextBlockType(element.block.type)) setTextKindOnElement(element, 'other');
	promoteSceneForPinned(scene);
	element.placement = 'pinned';
	if (!element.anchor) element.anchor = { region: 'center', dx: 0, dy: 0 };
	// v1 pinned actors may enter/exit, but they do not run sustained motion while held.
	delete element.motion;
	return true;
}

function setTextKindOnElement(element: Element, kind: TextKind): void {
	if (!isTextBlockType(element.block.type)) return;
	const nextStyle: BlockStyle = { ...(element.block.style ?? {}) };
	if (kind === 'content') {
		moveElementToFlow(element);
		delete element.motion;
		nextStyle.typeset = {
			...(nextStyle.typeset ?? {}),
			kind: 'content',
			role: nextStyle.typeset?.role ?? defaultContentRole(element.block.type, element.block.props)
		};
	} else {
		nextStyle.typeset = { kind: 'other' };
	}
	if (Object.keys(nextStyle).length) element.block.style = nextStyle;
	else delete element.block.style;
}

function moveElementToFlow(element: Element): void {
	delete element.placement;
	delete element.anchor;
	// A `path` motion only makes sense for a free sprite; drop it so placement and motion stay
	// consistent when the element returns to the story.
	if (element.motion?.type === 'path') delete element.motion;
}

function sectionKindToSceneType(kind: SectionKind): SceneType {
	if (kind === 'feature' || kind === 'split') return 'feature';
	if (kind === 'scrolly') return 'reveal';
	return 'page';
}

function createScene(id: string, type: SceneType, elements: Element[]): Scene {
	return {
		id,
		type,
		length: type === 'reveal' || type === 'parallax' || type === 'sidescroll' ? 'long' : 'auto',
		// A side-scroll scene is born horizontal; everything else scrolls vertically.
		...(type === 'sidescroll' ? { scrollAxis: 'horizontal' as const } : {}),
		beats: [{ id: newBeatId(), at: 0 }],
		elements
	};
}

function createElementFromStarter(starter: StarterBlock): Element | null {
	const def = getBlock(starter.type);
	if (!def) return null;
	const props = starter.props ?? structuredClone(def.defaults);
	const parsed = def.schema.safeParse(props);
	return {
		id: newElementId(),
		track: starter.track ?? (def.category === 'media' ? 'media' : 'content'),
		block: {
			id: newBlockId(),
			type: starter.type,
			props: parsed.success ? parsed.data : def.defaults
		} as Block,
		range: starter.range ?? { start: 0, end: 1 },
		...(starter.placement ? { placement: starter.placement } : {}),
		...(starter.motion ? { motion: starter.motion } : {})
	};
}

function rangeFromStart(start: number, duration: number): Element['range'] {
	const safeDuration = clamp(duration, 0.08, 1);
	const safeStart = clamp(start, 0, 1 - safeDuration);
	return { start: roundProgress(safeStart), end: roundProgress(safeStart + safeDuration) };
}

function normalizeRange(range: Element['range']): Element['range'] {
	const start = clamp(range.start, 0, 0.99);
	const end = clamp(range.end, start + 0.01, 1);
	return { start: roundProgress(start), end: roundProgress(end) };
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function roundProgress(value: number): number {
	return Math.round(value * 1000) / 1000;
}

function move<T>(arr: T[], match: (item: T) => boolean, dir: 'up' | 'down'): void {
	const i = arr.findIndex(match);
	if (i < 0) return;
	const j = dir === 'up' ? i - 1 : i + 1;
	if (j < 0 || j >= arr.length) return;
	[arr[i], arr[j]] = [arr[j], arr[i]];
}

function readShadow(zineId: string): DraftShadow | null {
	if (typeof localStorage === 'undefined') return null;
	const raw = localStorage.getItem(SHADOW_PREFIX + zineId);
	if (!raw) return null;
	try {
		const result = DraftShadowSchema.safeParse(JSON.parse(raw));
		if (!result.success) return null;
		return {
			...result.data,
			document: parseDocument(result.data.document)
		};
	} catch {
		// Preserve the raw shadow for manual recovery; do not load invalid data into the editor.
		return null;
	}
}

function createEndpointSave(zineId: string) {
	return async (payload: SavePayload): Promise<SaveResult> => {
		const res = await fetch(`/app/zines/${zineId}/draft`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload)
		});
		if (res.status === 409) {
			const body = (await res.json()) as { serverUpdatedAt: string };
			return { ok: false, conflict: true, serverUpdatedAt: body.serverUpdatedAt };
		}
		if (!res.ok) {
			return { ok: false, conflict: false, error: `Save failed (${res.status})` };
		}
		const body = (await res.json()) as { clientRev: number; updatedAt: string };
		return { ok: true, clientRev: body.clientRev, updatedAt: body.updatedAt };
	};
}
