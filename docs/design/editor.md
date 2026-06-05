# Editor architecture (Step 3)

How a student authors a zine end-to-end, safely. Builds on the [data model](data-model.md); governed by
[pedagogy.md](pedagogy.md). Status tags per the [legend](README.md#decision-status-legend-used-throughout).

> **⚠️ Superseded UI; reused foundations.** The **three-pane** layout described in §2 (palette / canvas
> / inspector) is **replaced** by the v3 editor — a **Story Map** + a **scene timeline** — defined in
> [scene-timeline.md](scene-timeline.md), because the three-pane "IDE" is wrong for ages 11–16. What is
> **reused unchanged**: the rune **store** (§1), **Immer undo/redo**, the **decorate-the-renderer**
> seam (§3), the registry-driven **Inspector contract** (§4, now used inside the scene editor), and the
> whole **autosave / data-loss protocol** (§7). Read §1, §3–4, §7, §9–10 as current foundations; read
> §2 (component tree) and §6 (insert/template UX) as **superseded** by scene-timeline.md §4–7.

## 0. Principles

1. **Author ≡ published.** The editor **decorates the real `ZineRenderer`**; it never reimplements
   rendering. One render path, no drift, provably WYSIWYG.
2. **Edit static, preview in motion.** Edit mode is calm and static (selection/drag work; you can't drag
   a parallaxing element). A Preview toggle plays the real read view (with motion once Step 4 lands).
3. **Never lose a student's work.** Autosave + local backup + version snapshots; the contract has _no
   data-loss path_ (Codex check).
4. **The registry, not concrete blocks.** The editor depends on `getBlock(type)` and the `BlockDef`
   contract — never a hard-coded block list.

---

## 1. State model

A `.svelte.ts` rune store is the single source of editor truth:

```ts
class EditorStore {
	doc = $state<ZineDocument>(/* loaded draft, already normalized by parseDocument */);
	selectedId = $state<string | null>(null); // block or section id
	mode = $state<'edit' | 'preview'>('edit');
	device = $state<'desktop' | 'tablet' | 'mobile'>('desktop');
	save = $state<{ status: 'idle' | 'saving' | 'saved' | 'error'; at?: string }>({ status: 'idle' });
	localRev = $state(0); // increments on every accepted local mutation
	lastAckRev = $state(0); // newest localRev acknowledged by the server
	serverUpdatedAt = $state<string | null>(null); // last-known zine_drafts.updated_at
	#undo: Patch[][] = [];
	#redo: Patch[][] = [];
}
```

- **Mutations are named intents** — `insertBlock`, `moveBlock`, `updateBlockProps`, `setSectionKind`,
  `deleteSection`, `setTheme`, … — never ad-hoc object edits. One core applies them:

```ts
mutate(label: string, recipe: (draft: ZineDocument) => void) {
	  const base = $state.snapshot(this.doc);                              // raw object, not the $state proxy
	  const [next, patches, inverse] = produceWithPatches(base, recipe);   // Immer
	  this.doc = next; this.#undo.push(inverse); this.#redo = [];          // patches → undo/redo
	  this.localRev += 1; this.writeShadow();
	  this.scheduleAutosave();
	}
```

- **Why Immer + the `$state.snapshot` bridge:** Immer gives undo/redo _and_ a structural diff for free;
  the snapshot avoids proxy-on-proxy with Svelte 5's deep `$state`. **Why named intents on top:** labeled
  undo ("Undo: delete image"), trivially testable, analytics-ready — without the weight of a full
  event-sourcing/command-log system ([REJECTED] for a single-author MVP).
- **Runed** (Svelte 5 utilities, the lib Pudding uses) supplies runtime viewport/resize/element-size/
  in-view primitives so the editor and renderer don't hand-roll "runtime layout intelligence."

---

## 2. Component tree

```
/app/zines/[id]/edit
  EditorShell
    Toolbar   [ Zine title (inline) ] [ Edit | Preview ] [ device ] [ ↶ ↷ ] [ Saved ✓ ] [ Share → submit ]
    LeftRail  tabs: "Add" (block palette + section templates) · "Outline" (sections/blocks tree)
    Canvas    <ZineRenderer> inside an EditorContext (selection + drag affordances)
    RightRail Inspector (contextual: Content · Design · [Effects = Step 4])
```

On tablet/Chromebook widths the rails collapse to **drawers** so the canvas keeps the screen. Authoring
is desktop/Chromebook-first; phones are for _reading_ (full mobile authoring is a [REJECTED] non-goal).

---

## 3. The canvas = the decorated renderer

`ZineRenderer` mounts in the canvas. `BlockFrame` (the existing style/animation seam) reads an
**`EditorContext` via Svelte context**: present → it adds a selection outline, a drag handle, and a
click target; absent (public page) → inert. **One render path.** [COMMITTED]

Reordering happens primarily in the **Outline tree** (clean, labeled, keyboard-friendly) via
`svelte-dnd-action`, **not** by dragging on a tall scrolling canvas (finicky, and fails the
"can't-drag-a-parallaxing-block" test — also why Edit mode is static). Canvas = select + inline-edit;
Outline = structure. This split is an a11y + clarity win (see [pedagogy.md](pedagogy.md)).

---

## 4. The Inspector (registry-driven)

Selecting a block looks up `registry.getBlock(type).Inspector` and renders it with the block's props +
an `onChange`. **Every `onChange` runs the candidate through `def.schema.safeParse` before committing**
— invalid input shows a friendly field error and **never corrupts the document** (the "inspector writes
validate against block schema" + "no data-loss" checks). [COMMITTED]

- Content fields per block (e.g. `image` → alt **required, with a teaching prompt** + caption + source
  picker + focal point; `heading` → text + level; `linkButton` → href/label/variant/new-tab).
- A thin **Design** tab covers the generic `BlockStyle` (alignment). **Effects** tab is hidden until
  Step 4. Section inspector sets `kind`, `label`, background.
- shadcn-svelte (Bits UI / Melt) supplies accessible inputs, selects, popovers, sliders.

This requires extending `BlockDef` with `Inspector` (see [data-model.md §5](data-model.md#5-the-block-contract-blockdef)).

---

## 5. Rich text — TipTap configured to _be_ our subset

- The `richText` block mounts a **TipTap** editor (`svelte-tiptap`) bound to `props.doc`. TipTap is
  configured with **only** paragraph, bold, italic, bulletList/orderedList/listItem, and Link — so it
  **cannot produce anything outside `schema/richtext.ts`**. No headings inside prose (headings are a
  _block_, keeping heading-level/a11y at the structural level).
- **Bubble menu only**: bold / italic / link on selection. **No font, size, or colour controls** in text
  — typography is the theme's job. (The biggest anti-clutter + taste-teaching decision.)
- **Paste sanitation** (kids paste from Google Docs): `transformPastedHTML` strips to the subset; then a
  **serializer validates TipTap JSON against our Zod richtext schema** on every change — belt-and-
  suspenders and the seam where any drift is caught.
- Link UI: a small popover; URL **scheme-checked** by `SafeUrlSchema`; "open in new tab" toggle.

---

## 6. Insert UX + templates

- **Block palette**: the 6 block types as **click-to-insert** cards (drag is the _enhancement_; click is
  the accessible primitive — better for many 11–16 users), grouped Text / Media / Structure, each with a
  one-line description + mini preview. Inserts after the selection; focus moves to the new block.
- **Section templates**: "+ Add section" → `prose / feature / split / sources` (and `scrolly` listed as
  "comes alive with Effects — Step 4"), each pre-stocked so nobody assembles a pattern from raw parts.
- **Zine templates**: "New zine" → _Blank · Photo essay · Data story · Interview_ — seed `ZineDocument`s
  (the `fixtures.ts` pattern) encoding the editorial gates from [editorial-process.md](../best-practices/editorial-process.md)
  (the Data story opens with a question). Lowers the blank-page barrier and teaches structure.

---

## 7. Autosave & data-loss defenses (the critical risk)

Defense-in-depth — student work must never be lost:

1. **Debounced (~1.5–2 s) full-document `PUT`** to `/app/zines/[id]/draft` (`+server.ts`,
   `locals.supabase` → RLS owner-only, proven in Step 1). Full-doc, not patch — simplest and most robust
   for a sub-100 KB JSON (images are refs, not inline). Body includes
   `{ document, baseUpdatedAt, clientRev }`.
2. **Server validates before persistence:** the endpoint runs `parseDocument(document)` (including any
   migrated/restored local shadow) and rejects invalid input with a clear error. It writes the parsed,
   normalized document only.
   The write is atomic: update `zine_drafts` only when both `zine_id` and `updated_at = baseUpdatedAt`
   match. A read-then-upsert is not acceptable because two tabs can pass the read and last-write-wins.
3. **Optimistic status with revision discipline:** every mutation increments `localRev`. A save response
   is allowed to show `Saved ✓` only when `response.clientRev === localRev` at the moment the response is
   handled. If the response acknowledges an older rev, keep `Saving…` / `Unsaved changes` and continue
   the next queued save. This closes the classic old-request-finishes-last data-loss window.
4. **localStorage shadow copy** keyed by zine id, written synchronously on every mutation:
   `{ document, localRev, baseUpdatedAt, writtenAt }`. This survives crash/refresh/closed lid and is the
   source for offline retry. On editor load, a valid shadow is parsed through `parseDocument`, restored as
   the active local document, and retried with the shadow's original `baseUpdatedAt` token. The shadow is
   cleared only after the server acknowledges the current `localRev`.
5. **Stale/multi-tab guard:** send last-known `baseUpdatedAt`; server returns **409** if the row advanced.
   A 409 never auto-overwrites either side. The UI shows a conflict screen with three safe exits:
   reload server copy, keep local copy as a new draft/version, or inspect both summaries. Until the user
   chooses, autosave is paused and the shadow is preserved.
6. **Offline / failed save:** keep writing the shadow, show `Couldn't save — retrying`, and retry with
   exponential backoff when network returns. The user can keep editing; the save status must not claim
   saved while `localRev > lastAckRev`.
7. **Failed migrate-on-load:** if the server draft or local shadow cannot migrate/parse, do not overwrite
   it. Store the raw payload in a recovery record, show a read-only recovery screen, and require a
   teacher/admin or explicit user choice before replacing it. This is rare, but it is how schema bugs
   avoid becoming data-loss bugs.
8. **Version snapshots**: a `zine_versions` row on publish (Step 5) and on a manual "save a version".

**Save-state invariant:** at all times, either the server has acknowledged the current `localRev`, or the
local shadow contains the current document. Tests should kill the browser during an in-flight request,
drop the network after a mutation, and return stale 409s from a second tab.

---

## 8. Edit / Preview + responsive

- **Edit** = static, selectable, with subtle effect _badges_ ("✨ appears on scroll") so motion is
  discoverable but not distracting.
- **Preview** = the clean `ZineRenderer` read view at the chosen device width (Step 4 adds real motion).
- **Device frames** (desktop/tablet/mobile) constrain canvas width — students see the phone view, where
  most readers are.

---

## 9. Routes, endpoints, data flow

| Route / endpoint                         | Job                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| `/app` (action)                          | "New zine" → insert `zines` + `zine_drafts` (seed = template) → redirect to edit |
| `/app/zines/[id]/edit` `+page.server.ts` | Load draft (RLS-scoped) → `{ document, zineMeta }`                               |
| `/app/zines/[id]/draft` `+server.ts` PUT | `parseDocument` validation; debounced autosave; `updated_at` + `clientRev` guard |
| `/app/zines/[id]/edit` (action)          | "Submit for review" → status `draft → in_review` (the gate proper is Step 6)     |

All writes go through `locals.supabase` (the anon-key, RLS-enforced client) — never the service role.

---

## 10. Build sub-steps, Done-when, tests

| Sub-step                              | Builds                                                                                                                                                                     | Done when                                                                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **3a — Schema v2 + store**            | `kind/role/label/id` + `1→2` migration; rune store; Immer named-intent mutations; undo/redo                                                                                | Migration lossless (v1↔v2 round-trip); store ops + labeled undo/redo unit-tested                                              |
| **3b — Decorated canvas + Outline**   | `EditorContext` in `BlockFrame`; selection; `svelte-dnd-action` reorder + move-up/down                                                                                     | Select/add/move/delete via canvas **and** Outline; keyboard-operable                                                          |
| **3c — Inspector**                    | `BlockDef.Inspector`; host; per-block inspectors; schema-validated `onChange`; alt-text gate                                                                               | Inspector edits validate against the block schema; missing alt blocks submit                                                  |
| **3d — Rich text**                    | TipTap subset; bubble menu; paste sanitation; serializer↔Zod                                                                                                               | Round-trips losslessly; disallowed nodes rejected; pasted Google-Docs junk stripped                                           |
| **3e — Autosave + theme + templates** | Draft endpoint; debounce/optimistic/localStorage/409; palette + fontPair registries + self-hosted fonts; zine/section templates; create flow; Edit/Preview + device frames | **Create → edit → reload preserves the document exactly**; autosave recovers from failure; interrupt mid-save → no corruption |

**Tests** (≥80% coverage on `src/lib/zine/**` and new `src/lib/editor/**`): store-ops + labeled
undo/redo unit; autosave debounce/optimistic/failure-recovery unit; stale response cannot mark a newer
rev saved; 409 conflict preserves both documents; TipTap↔schema serializer unit (subset enforcement);
Inspector-validates-and-never-corrupts component; **full author→reload e2e**; **keyboard-only authoring
e2e**; **kill-mid-save → no-corruption e2e**; failed migration opens recovery without overwriting.

---

## 11. New dependencies (Step 3)

`immer` (undo/redo + diff), `svelte-tiptap` + TipTap extensions (rich text), `svelte-dnd-action`
(reorder), `runed` (runtime viewport utils), `@fontsource/*` (self-hosted font pairs), shadcn-svelte
primitives as needed. All are framework-agnostic or Svelte-native; none reach the public read path
except the chosen font pairing (dynamically imported).
