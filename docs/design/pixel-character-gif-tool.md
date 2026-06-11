# Pixel character GIF tool

Status: architectural plan, not yet implemented.

This feature adds a student-facing tool for designing a small human pixel-art character and exporting
looping action GIFs such as run right, run left, face forward, jump, wave, hold computer, cast wand, and
idle. Once the media pipeline is wired, the generated GIFs become ordinary zine media assets, so a scene
can create a side-scrolling game effect by swapping character actions while the existing timeline, path,
parallax, and pinned/layering systems move the actor. Before that pipeline exists, the builder can still
export local files and show editor-only previews, but it must not persist generated `blob:` URLs into a
zine document.

## Goals

- Let students customize a recognizably human character through presets, outfit cards, accessory cards,
  and color swatches.
- Export a complete action set at several pixel-perfect sizes: tiny through large.
- Support re-skinning without redrawing every frame: skin, hair, clothes, glasses, armor, computer,
  wizard outfit, wand, Halloween costume, and future generic costumes.
- Keep the published reader simple: no character builder, no GIF encoder, no sprite editor library.
- Preserve the zine invariants: registry extension only, author equals published, no unsafe CSS input,
  reduced-motion fallback, Chromebook-safe performance, no third-party requests, no reader import of the
  editor/export toolchain.

## Non-goals for v1

- No freehand pixel painting as the main workflow. That is a v2 escape hatch once the guided generator is
  solid.
- No AI image generation in the student browser.
- No copyrighted character templates or named costume lookalikes.
- No runtime procedural character generation in published zines.
- No scrolljacking, sprite physics engine, or game loop. Scroll remains native; movement remains the
  existing scene timeline plus transform-only effects.

## Library choice

Use `gifenc` for v1 GIF export, loaded only inside an editor/export worker.

Why:

- It is a small JavaScript GIF encoder with no runtime dependency chain, browser and Node support, built
  in quantization, palette mapping, transparency, animation delays, and repeat control.
- It takes RGBA frame data, which matches our Canvas2D/ImageData frame generator.
- It can run in Web Workers, which keeps Chromebook UI responsive during multi-size export.

Why not make `gif.js` the default:

- It is useful and worker-based, but it requires a separately served `gif.worker.js` asset and is an
  older, more black-box API. That is extra packaging surface for SvelteKit.

Why not make APNG/WebP primary:

- APNG via `UPNG.js` and animated WebP are good future options, but the user-facing ask is GIF, GIF is
  the most portable authoring artifact, and we can add newer formats as export variants later.

Why not use a pixel editor library:

- The available browser pixel-editor packages are either old, framework-specific, or aimed at freehand
  editing. Our need is a constrained, reskinnable human rig with accessible presets. Build the rig and UI
  ourselves; use a library only for encoding.

## Product model

The tool should feel like choosing and dressing a tiny game character, not like editing a texture atlas.
Use recognition-first controls:

- Body preset cards: short, tall, round, slim, sturdy.
- Hair cards: short, long, curly, tied back, hat-hidden.
- Outfit cards: everyday, hoodie, jacket, lab, armor, robe, costume.
- Extra cards: glasses, mask, cape, backpack, computer, book, wand.
- Color chips from the zine theme swatches, plus a small custom color option.
- Action preview strip: idle, face forward, run right, run left, jump, wave, hold, cast.
- Size preview strip: tiny, small, medium, large shown at their real exported sizes.

Avoid numeric fields. Where exact values exist internally, present them as named choices: "Tiny",
"Small", "Medium", "Large", "Fast loop", "Calm loop", "Bouncy loop".

## Recognizable-human constraints

The generator should enforce a silhouette grammar borrowed from early game sprites:

- Use a dark outline at every LOD.
- Give the head a large share of the sprite height, roughly 25 to 33 percent.
- Separate head, torso, legs, and feet with contrast changes.
- Reserve at least one visible skin/face area and one hair/hat area.
- Exaggerate arms and legs in action frames. A run frame must read from silhouette alone.
- Use asymmetry for direction: nose/hair/hand/prop offset one pixel toward the facing side.
- Keep props large and iconic: a computer is a rectangle, a wand is a diagonal line with one bright tip,
  armor is broad shoulders plus chest shine, glasses are a bold 2-pixel face cue at standard size and
  larger.
- Tiny output uses a simplified LOD, not a naive downscale. Accessories may collapse into a color mark or
  a silhouette feature.

The editor should lint the generated character before export:

- Warn if skin/hair/shirt/pants have too little contrast.
- Warn if the tiny LOD loses head/torso/legs separation.
- Warn if an accessory appears only as isolated single pixels.
- Warn if the frame bounds change between frames and would cause GIF wobble.

## Data contracts

The editable project is editor/media metadata, not a renderer dependency.

```ts
type PixelCharacterProject = {
	id: string;
	name: string;
	baseRig: 'human-24x32';
	body: BodyPreset;
	hair: HairPreset;
	outfit: OutfitPreset;
	accessories: AccessoryPreset[];
	props: PropPreset[];
	palette: CharacterPalette;
	actionTuning: Partial<Record<SpriteAction, ActionTuning>>;
	createdAt: string;
	updatedAt: string;
};
```

All enum values are bounded. All colors use the existing `HexColorSchema`. Since colors are rasterized
into image assets, they do not reach CSS except in the editor preview.

```ts
type CharacterPalette = {
	skin: HexColor;
	skinShadow: HexColor;
	hair: HexColor;
	outline: HexColor;
	shirt: HexColor;
	pants: HexColor;
	shoes: HexColor;
	accent: HexColor;
	prop: HexColor;
	magic: HexColor;
};

type SpriteAction =
	| 'idle'
	| 'faceForward'
	| 'runRight'
	| 'runLeft'
	| 'jump'
	| 'wave'
	| 'hold'
	| 'cast';

type ExportSize = 'tiny' | 'small' | 'medium' | 'large';
```

The generated action set is editor/media metadata, not inline block content.

```ts
type CharacterAssetManifest = {
	id: string;
	version: number;
	defaultAction: SpriteAction;
	actions: Record<SpriteAction, Partial<Record<ExportSize, CharacterSpriteSource>>>;
};
```

The published zine stores only the selected action, selected size, and the one source needed to render
that element. This avoids duplicating a full action manifest across every "action clip" element in a
side-scroller scene. Re-editing a character later is an editor operation that rewrites the affected
clips from the durable `CharacterAssetManifest`.

```ts
type CharacterSpriteProps = {
	characterId?: string;
	action: SpriteAction;
	size: ExportSize;
	source: CharacterSpriteSource;
	alt: string;
};

type CharacterSpriteSource = {
	assetId?: string;
	src?: string;
	posterAssetId?: string;
	poster?: string;
	width: number;
	height: number;
	frameCount: number;
	durationMs: number;
};
```

`assetId` is the durable path once media upload/storage is wired. Until the reader has an
`assetId -> URL` resolver, v1 validation requires SafeUrl `src` and `poster` values. Those URLs must
never be `blob:` or `data:` URLs, because drafts use the same document parser as published zines. The
closest existing precedent is `BackgroundFillSchema` (`assetId?` plus SafeUrl media fallback), not the
current image block, whose schema still requires `src`.

## Rig and renderer internals

Use a deterministic part-based pixel rig.

```ts
type PixelPart = {
	id: string;
	layer: number;
	lod: 'tiny' | 'standard';
	mask: PixelMask;
	paletteSlots: CharacterPaletteSlot[];
	mirrorable: boolean;
};

type SpriteFrameRecipe = {
	durationMs: number;
	parts: Record<string, PartPose>;
	visibleParts?: string[];
};

type PartPose = {
	x: number;
	y: number;
	flipX?: boolean;
	rotateQuarterTurns?: -1 | 0 | 1;
	paletteOverride?: CharacterPaletteSlot;
};
```

The editor generator composes parts into ImageData:

1. Resolve the LOD: tiny uses hand-authored tiny masks; all other sizes use the standard 24x32 rig.
2. Resolve the outfit/accessory layers into ordered `PixelPart`s.
3. Resolve the action frame recipes.
4. Paint opaque pixels to an integer canvas.
5. Trim transparent padding only if every frame in the action gets the same final bounds.
6. Scale by nearest-neighbor integer scale for exported sizes.
7. Hand the RGBA frames to the export worker.

Recommended base sizes:

| Export size | Logical art | File pixels | Intended use                            |
| ----------- | ----------: | ----------: | --------------------------------------- |
| `tiny`      |     16 x 24 |     16 x 24 | labels, small actors, dense diagrams    |
| `small`     |     24 x 32 |     48 x 64 | ordinary side-scroller actor            |
| `medium`    |     24 x 32 |    96 x 128 | hero actor, pinned foreground           |
| `large`     |     24 x 32 |   192 x 256 | title moments, close-ups, large screens |

Large sizes are integer-scaled from the standard logical rig to preserve pixel art. They should not add
fine detail that vanishes at smaller sizes.

## Export pipeline

Create an editor-only export worker:

```
src/lib/editor/pixel-character/export.worker.ts
```

Worker responsibilities:

- Receive a `PixelCharacterProject`, action list, and size list.
- Generate RGBA frames using pure renderer functions.
- Encode GIFs with `gifenc`.
- Emit PNG still posters from the first readable frame for reduced motion.
- Return Blobs plus an editor-only manifest draft.
- Support cancellation and progress.

Encoding defaults:

- 4 to 6 frames per loop for run and cast.
- 2 to 4 frames for idle, face forward, hold, and wave.
- 90 to 140 ms per frame, depending on action.
- Transparent background.
- Repeat forever for GIFs.
- Shared palette per action when possible to reduce flicker.
- Hard caps: max 8 frames per action, max 192 x 256 output, max 8 actions per batch in v1.

When storage upload is available:

- Store each GIF and poster as an `assets.kind = 'image'` row.
- Put files under `characters/{ownerId}/{characterId}/{version}/{action}-{size}.gif`.
- Keep moderation status consistent with the media pipeline. Assets default to `pending`, and students
  cannot self-approve them. A future server policy may batch or prioritize constrained first-party
  generator output, but teacher/admin or service-role approval is still the real publishing boundary.

Before upload is available:

- Allow local download of the generated set.
- Allow editor previews with ephemeral object URLs held outside the document.
- Do not insert a `characterSprite` element into persisted draft or published document data unless it has
  a durable `assetId` or a user-supplied SafeUrl. No `blob:` or `data:` URL should ever pass through the
  schema.
- This means the core "insert into zine and publish" value prop is blocked until the media upload plus
  `assetId -> URL` resolver lands. A local-export-only builder is useful, but it is not the complete v1
  product.

## Zine integration

Add a registry block:

```
src/lib/zine/blocks/characterSprite/
```

Block contract:

- Category: `media`.
- Props: `CharacterSpriteProps`.
- Render: a semantic `<figure>` with `<img>` using the selected action and size.
- CSS: `image-rendering: pixelated`; no layout animation inside the block.
- Publish gate: alt text required, selected GIF and poster must have SafeUrl URLs in v1. This can relax
  to `assetId` once the reader resolver exists.
- Reduced motion: render both the GIF and the selected action's poster, then toggle them with
  `@media (prefers-reduced-motion: reduce)`. Do not read the reduced-motion store inside the block; the
  CSS path is SSR-safe and avoids a GIF-to-poster hydration flash.

This block should not import any editor code or the GIF encoder. Published zines only render images.

## Reader-bundle boundary

Keep the reader-safe block props schema in:

```
src/lib/zine/blocks/characterSprite/schema.ts
```

Keep the generator, rig masks, Canvas2D/ImageData renderer, and export worker in:

```
src/lib/editor/pixel-character/
```

The editor may import the reader-safe block schema. The block and renderer must never import back from
the editor directory. Do not add a barrel that re-exports both the schema and generator; that would make
it easy for `characterSprite` to pull the GIF toolchain into the published reader.

Add an explicit import-boundary gate before implementation is considered done:

- a static import-graph test or ESLint boundary rule that fails if `src/lib/zine/**` imports
  `src/lib/editor/**`, `gifenc`, or `src/lib/editor/pixel-character/**`;
- a focused assertion that `characterSprite` and `ZineRenderer` have no transitive import of `gifenc`.

## Action swapping in scenes

Do not model action swapping as an `EffectRef`. Effects are intentionally transform/opacity-only. The
selected character action is content state, not motion CSS.

V1 should use timeline-native swapping:

- A "Character track" editor convenience can create several `characterSprite` elements that share the
  same `characterId` but choose different `action`, `size`, and `source` values from the editor-side
  `CharacterAssetManifest`.
- Each element has its own `range`, `enter`, `exit`, `motion`, `track`, and `placement`.
- For side-scrolling game scenes, students can combine:
  - `runRight` plus `placement:'free'` plus `motion:{ type:'path' }`;
  - a short `jump` clip over the path segment with an arc;
  - a `wave` or `faceForward` clip when the character stops.
- The published renderer sees ordinary elements and ordinary block props.

This is slightly more verbose in the document but very safe: no core renderer special case, no
scroll-progress prop added to all blocks, no violation of the transform/opacity boundary. The caveat is
that GIF cadence is fixed; legs will not automatically run faster or slower based on scroll velocity.
That is acceptable in v1 and should not be hidden from reviews.

V2 can add a generic `Element.variantTimeline` only if repeated character swaps become too cumbersome
and if more block types need state variants. That would be a schema feature, not an effect feature:

```ts
type ElementVariantTimeline = {
	key: 'action';
	segments: { start: number; end: number; value: SpriteAction }[];
};
```

Do not build this until the multi-element v1 proves too awkward.

## Editor surfaces

New route or modal:

```
src/lib/editor/pixel-character/CharacterBuilder.svelte
```

Layout:

- Left: preset library and parts, shown as cards.
- Center: live pixel preview, with transparent checkerboard and theme background toggle.
- Right: action and size previews, export status, insert buttons.
- Bottom: frame strip for the selected action.

Student-facing modes:

- "Look": body, hair, face.
- "Clothes": outfit, armor, robe, costume.
- "Extras": glasses, hat, cape, backpack.
- "Held thing": none, computer, book, wand.
- "Moves": preview and choose which actions to export.
- "Save": name, alt text starter, export sizes.

The Scene editor should offer "Add character" next to Image in the media palette. If a scene already has
a character manifest, "Add action clip" should reuse it instead of making the student reselect the
character.

## Accessibility

- Every inserted `characterSprite` needs alt text. Suggested default: "Pixel-art character running",
  customized by action and outfit, but editable before publish.
- Reduced motion uses CSS-only poster switching plus source order, matching existing renderer behavior.
- A character GIF must not be the only carrier of information. Any required story meaning should appear
  in text or an accessible caption.
- Do not autoplay sound. This feature has no audio in v1.

## Performance

- The reader downloads only selected GIFs/posters referenced by the zine document.
- The editor loads the generator and `gifenc` only when the character builder opens.
- GIF export runs in a Worker and reports progress.
- Generated assets are small, palette-limited, and capped.
- Use `loading="lazy"` except when the character is in the first viewport.
- Keep movement as existing transform-only effects. The GIF animates pixels inside the image; the
  scene effect moves the image wrapper with compositor-friendly transforms.
- Use `image-rendering: pixelated` so browser scaling keeps hard edges, but also export real integer
  sizes so non-browser uses look correct.

## Implementation plan

1. Add the reader-safe `characterSprite` block schema with `SpriteAction`, `ExportSize`,
   `CharacterSpriteSource`, and source/poster validators.
2. Add the import-boundary gate so reader-bundle leaks fail early.
3. Add `gifenc` as an editor/export dependency.
4. Add editor-only generator modules under `src/lib/editor/pixel-character/`.
5. Add the human rig, LOD masks, outfit/accessory masks, and action recipes.
6. Add frame-generation tests using stable hashes for representative presets at tiny and standard LOD.
7. Add the export worker and a GIF encode smoke test.
8. Add the `characterSprite` block and registry entry.
9. Add render tests for selected action, CSS-only reduced-motion poster, alt gate, and bundle purity.
10. Add the Character Builder UI.
11. Wire insertion only after durable `assetId` resolution exists, or gate insertion to user-supplied
    SafeUrls and local download.
12. Add a Scene editor convenience: "Add action clip" reuses the selected character asset manifest.
13. Add a sample side-scroller character to the example zine once durable assets are available.

## Tests and review gates

- Schema rejects unknown enum values, unsafe URLs, missing selected action source, invalid hex colors.
- All defaults pass their schemas.
- Generated tiny character hashes preserve head/torso/leg pixels.
- Mirrored run-left equals run-right mirror except for explicitly non-mirrored accessories.
- Worker export returns GIFs and posters for every selected action/size.
- Static import-boundary gate proves `characterSprite` and `ZineRenderer` do not import editor modules
  or `gifenc`, directly or transitively.
- Reduced motion uses CSS-only poster switching.
- `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build`.
- Browser smoke test: side-scroller with run, jump, and wave clips at desktop and narrow stacked
  fallback.

## Main risks

- Tiny characters become unreadable if we rely on downscaling. Mitigation: hand-authored tiny LOD masks.
- GIF file size grows quickly. Mitigation: short loops, low palettes, hard caps, posters, size choices,
  lazy loading.
- The "character track" editor could hide too much document complexity. Mitigation: keep it as a UI
  convenience over normal elements and make the DAW/layers reflect the generated clips.
- Action swapping tied automatically to path velocity would tempt a renderer special case. Mitigation:
  defer automatic swapping; use explicit clips in v1.
- Storage and moderation are not fully wired today. Mitigation: support local export now, durable
  `assetId` insertion when the media pipeline lands, and do not persist preview-only object URLs.
- Bundle purity is correct by design but not protected by the current test suite. Mitigation: add the
  import-boundary gate before adding the block.
- Full-manifest duplication across action clips would bloat documents and make re-skinning brittle.
  Mitigation: block props store only the selected source; the full action manifest remains editor/media
  metadata keyed by `characterId`.

## Sources checked

- `gifenc`: https://github.com/mattdesl/gifenc and https://www.npmjs.com/package/gifenc
- `gif.js`: https://github.com/jnordberg/gif.js
- `UPNG.js`: https://github.com/photopea/UPNG.js
- `image-rendering`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/image-rendering
