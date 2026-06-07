import { afterEach, describe, expect, it } from 'vitest';
import { EditorStore } from './store.svelte';
import type { ZineDocument } from '$lib/zine/schema/document';
import type { SaveResult } from './autosave';

const okSave = async (): Promise<SaveResult> => ({ ok: true, clientRev: 1, updatedAt: 't' });

function makeStore(): EditorStore {
	const document = {
		schemaVersion: 7,
		theme: {},
		acts: [
			{
				id: 'act_1',
				scenes: [
					{
						id: 'scn_1',
						type: 'page',
						length: 'auto',
						beats: [{ id: 'beat_1', at: 0 }],
						elements: []
					}
				]
			}
		]
	} satisfies ZineDocument;
	return new EditorStore({ document, zineId: 'z1', baseUpdatedAt: null, save: okSave });
}

function scene(store: EditorStore) {
	return store.doc.acts[0].scenes[0];
}
function el(store: EditorStore, id: string) {
	return scene(store).elements.find((e) => e.id === id)!;
}

let store: EditorStore | undefined;
afterEach(() => store?.dispose());

describe('pinned placement intents', () => {
	it('pins a heading with a default centre anchor and drops any path motion', () => {
		store = makeStore();
		const id = store.addElement('scn_1', 'heading')!;
		store.setElementPath(id, [
			{ at: 0, x: 0, y: 0, scale: 1, rotate: 0, ease: 'smooth' },
			{ at: 1, x: 50, y: 50, scale: 1, rotate: 0, ease: 'smooth' }
		]);
		expect(el(store, id).placement).toBe('free');
		store.setElementPlacement(id, 'pinned');
		expect(el(store, id).placement).toBe('pinned');
		expect(el(store, id).block.style?.typeset?.kind).toBe('other');
		expect(el(store, id).anchor).toEqual({ region: 'center', dx: 0, dy: 0 });
		expect(el(store, id).motion).toBeUndefined(); // path dropped — pinned isn't path-driven
	});

	it('manual pinning promotes a page scene to reveal', () => {
		store = makeStore();
		const id = store.addElement('scn_1', 'heading')!;
		expect(scene(store).type).toBe('page');
		store.setElementPlacement(id, 'pinned');
		expect(scene(store).type).toBe('reveal');
		expect(scene(store).length).toBe('long');
	});

	it('clears the anchor when switching back to the story', () => {
		store = makeStore();
		const id = store.addElement('scn_1', 'heading')!;
		store.setElementAnchorRegion(id, 'top-left');
		expect(el(store, id).anchor?.region).toBe('top-left');
		store.setElementPlacement(id, undefined);
		expect(el(store, id).placement).toBeUndefined();
		expect(el(store, id).anchor).toBeUndefined();
	});

	it('refuses to pin focusable content (a link button) and reports canPin', () => {
		store = makeStore();
		const id = store.addElement('scn_1', 'linkButton')!;
		expect(store.canPin(id)).toBe(false);
		store.setElementPlacement(id, 'pinned');
		expect(el(store, id).placement).toBeUndefined(); // guard refused the change
	});

	it('refuses to pin over-long text', () => {
		store = makeStore();
		const id = store.addElement('scn_1', 'richText')!;
		store.updateElementBlockProps(id, {
			doc: {
				type: 'doc',
				content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x'.repeat(241) }] }]
			}
		});
		expect(store.canPin(id)).toBe(false);
		store.setElementPlacement(id, 'pinned');
		expect(el(store, id).placement).toBeUndefined();
	});

	it('moves a pinned actor back with the scene when edits make it too large', () => {
		store = makeStore();
		const id = store.addElement('scn_1', 'heading')!;
		store.setElementAnchorRegion(id, 'top');
		expect(el(store, id).placement).toBe('pinned');
		store.updateElementBlockProps(id, { text: 'x'.repeat(121), level: 2 });
		expect(el(store, id).placement).toBeUndefined();
		expect(el(store, id).anchor).toBeUndefined();
	});

	it('does not allow sustained motion on a pinned actor', () => {
		store = makeStore();
		const id = store.addElement('scn_1', 'image')!;
		store.setElementPlacement(id, 'pinned');
		store.setElementEffect(id, 'motion', { type: 'float', params: { distance: 'small' } });
		expect(el(store, id).motion).toBeUndefined();
		store.setElementEffect(id, 'enter', { type: 'fade', params: { direction: 'in' } });
		expect(el(store, id).enter?.type).toBe('fade');
	});

	it('clears stale anchors when path motion makes a pinned element free', () => {
		store = makeStore();
		const id = store.addElement('scn_1', 'heading')!;
		store.setElementAnchorRegion(id, 'bottom-left');
		store.setElementPath(id, [
			{ at: 0, x: 0, y: 0, scale: 1, rotate: 0, ease: 'smooth' },
			{ at: 1, x: 50, y: 50, scale: 1, rotate: 0, ease: 'smooth' }
		]);
		expect(el(store, id).placement).toBe('free');
		expect(el(store, id).block.style?.typeset?.kind).toBe('other');
		expect(el(store, id).anchor).toBeUndefined();
		expect(el(store, id).motion?.type).toBe('path');
	});

	it('moves the region and nudges within the clamped range', () => {
		store = makeStore();
		const id = store.addElement('scn_1', 'heading')!;
		store.setElementAnchorRegion(id, 'bottom-right');
		expect(el(store, id).anchor?.region).toBe('bottom-right');
		for (let i = 0; i < 10; i++) store.nudgeAnchor(id, 'x', 1);
		store.nudgeAnchor(id, 'y', -2);
		expect(el(store, id).anchor?.dx).toBe(6); // clamped
		expect(el(store, id).anchor?.dy).toBe(-2);
		store.resetAnchorNudge(id);
		expect(el(store, id).anchor).toMatchObject({ dx: 0, dy: 0 });
	});

	it('writes and clears editorial typeset on a text block', () => {
		store = makeStore();
		const id = store.addElement('scn_1', 'heading')!;
		store.setTypesetRole(id, 'kicker');
		store.setTypeset(id, { measure: 'narrow', case: 'upper' });
		expect(el(store, id).block.style?.typeset).toEqual({
			kind: 'content',
			role: 'kicker',
			measure: 'narrow',
			case: 'upper'
		});
		store.setTypesetRole(id, undefined);
		store.setTypeset(id, { measure: undefined, case: undefined });
		expect(el(store, id).block.style?.typeset).toEqual({ kind: 'content' });
	});

	it('switches text between editorial content and freer other text', () => {
		store = makeStore();
		const id = store.addElement('scn_1', 'heading')!;
		store.setElementPath(id, [
			{ at: 0, x: 0, y: 0, scale: 1, rotate: 0, ease: 'smooth' },
			{ at: 1, x: 50, y: 50, scale: 1, rotate: 0, ease: 'smooth' }
		]);
		expect(el(store, id).placement).toBe('free');
		store.setTextKind(id, 'content');
		expect(el(store, id).placement).toBeUndefined();
		expect(el(store, id).motion).toBeUndefined();
		expect(el(store, id).block.style?.typeset).toMatchObject({
			kind: 'content',
			role: 'headline'
		});
		store.setTextKind(id, 'other');
		expect(el(store, id).block.style?.typeset).toEqual({ kind: 'other' });
	});

	it('addPinnedText promotes a page scene to reveal and staggers each clip', () => {
		store = makeStore();
		expect(scene(store).type).toBe('page');
		const a = store.addPinnedText('scn_1')!;
		expect(scene(store).type).toBe('reveal'); // promoted (one-way)
		expect(el(store, a).placement).toBe('pinned');
		expect(el(store, a).block.style?.typeset?.kind).toBe('other');
		expect(el(store, a).range.start).toBe(0);
		const b = store.addPinnedText('scn_1')!;
		// the second clip starts after the first → "one at a time"
		expect(el(store, b).range.start).toBeGreaterThan(el(store, a).range.start);
	});
});
