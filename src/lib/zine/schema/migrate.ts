import { z } from 'zod';
import { getBlock } from '../registry';
import { pinnedContentProblem } from '../render/pinned';
import { paletteById } from '../theme/registry';
import { CURRENT_SCHEMA_VERSION, ZineDocumentSchema, type ZineDocument } from './document';
import { SECTION_LAYOUTS, type SectionKind, type SectionLayout } from './theme';

// Versioned migration scaffold. Forward migrations are keyed by the version they
// UPGRADE FROM and return the next version's shape. A migration MUST advance the
// version and be lossless (data-model.md §6).
type RawDocument = Record<string, unknown>;
type Migration = (doc: RawDocument) => RawDocument;

// v1 `layout` (appearance) → v2 `kind` (purpose). The original layout is ALSO copied
// to section.presentation.legacyLayout so nothing is dropped — notably `grid`, whose
// editorial purpose maps to `prose` but whose arrangement intent is preserved.
const LAYOUT_TO_KIND: Record<SectionLayout, SectionKind> = {
	centered: 'prose',
	split: 'split',
	grid: 'prose',
	'full-bleed': 'feature'
};
const KIND_TO_SCENE_TYPE: Record<SectionKind, 'page' | 'feature' | 'reveal'> = {
	prose: 'page',
	feature: 'feature',
	split: 'feature',
	scrolly: 'reveal',
	sources: 'page'
};

function isLayout(value: unknown): value is SectionLayout {
	return typeof value === 'string' && (SECTION_LAYOUTS as readonly string[]).includes(value);
}

function isSectionKind(value: unknown): value is SectionKind {
	return (
		typeof value === 'string' &&
		(['prose', 'feature', 'split', 'scrolly', 'sources'] as readonly string[]).includes(value)
	);
}

function sceneIdFrom(sectionId: unknown, i: number): string {
	if (typeof sectionId !== 'string' || !sectionId.trim()) return `scn_migrated_${i + 1}`;
	return sectionId.startsWith('scn_') ? sectionId : sectionId.replace(/^sec_/, 'scn_');
}

function elementIdFrom(blockId: unknown, i: number): string {
	if (typeof blockId !== 'string' || !blockId.trim()) return `el_migrated_${i + 1}`;
	return blockId.startsWith('el_') ? blockId : blockId.replace(/^blk_/, 'el_');
}

function beatIdFrom(blockId: unknown, i: number): string {
	if (typeof blockId !== 'string' || !blockId.trim()) return `beat_migrated_${i + 1}`;
	return blockId.startsWith('beat_') ? blockId : blockId.replace(/^blk_/, 'beat_');
}

function trackForBlock(block: RawDocument): 'content' | 'media' | 'background' {
	const type = typeof block.type === 'string' ? block.type : '';
	const category = getBlock(type)?.category;
	if (category === 'media') return 'media';
	if (category === 'structure' || category === 'interactive' || category === 'text')
		return 'content';
	return 'content';
}

function blockContent(block: RawDocument): RawDocument {
	const { role, state, animation, ...rest } = block;
	void role;
	void state;
	void animation;
	return rest;
}

function elementFromBlock(block: RawDocument, i: number, overrides: RawDocument = {}): RawDocument {
	const animation = block.animation;
	return {
		id: elementIdFrom(block.id, i),
		track: trackForBlock(block),
		block: blockContent(block),
		range: { start: 0, end: 1 },
		...(animation ? { legacyAnimation: animation } : {}),
		...overrides
	};
}

// v3 theme `{ palette?, accent?, fontPair? }` (keys into the built-in palette registry) →
// v4 `{ colors, swatches, fontPair? }` (data-model.md §7). The legacy keys are RESOLVED
// through `paletteById` into the same colours they rendered, so appearance is preserved and
// nothing is dropped (lossless): `colors` captures the role→colour mapping, `swatches` the
// pool the editor offers. Resolves only via the built-in palettes — no culori on the parse
// path. A document with no `theme` stays themeless (the renderer's defaults apply).
function migrateThemeV3toV4(rawTheme: unknown): RawDocument | undefined {
	if (!rawTheme || typeof rawTheme !== 'object') return undefined;
	const theme = rawTheme as RawDocument;
	const palette = paletteById(typeof theme.palette === 'string' ? theme.palette : undefined);
	// Carry the legacy accent through FAITHFULLY (don't sanitize here) so `HexColorSchema`
	// still rejects an unsafe author value downstream — migration stays fail-closed. Only an
	// absent accent falls back to the palette default.
	const accent = typeof theme.accent === 'string' ? theme.accent : palette.accents[0];
	const colors = {
		background: palette.bg,
		text: palette.fg,
		heading: palette.fg,
		accent,
		muted: palette.muted
	};
	// Source palette: chosen accent first, then the palette's other accents and its structural
	// colours, de-duplicated — the swatch pool the editor surfaces for assignment.
	const swatches = [
		...new Set([accent, ...palette.accents, palette.bg, palette.fg, palette.muted])
	];
	const next: RawDocument = { colors, swatches };
	if (typeof theme.fontPair === 'string') next.fontPair = theme.fontPair;
	return next;
}

const migrations: Record<number, Migration> = {
	1: (doc) => {
		const sections = Array.isArray(doc.sections) ? doc.sections : [];
		return {
			...doc,
			schemaVersion: 2,
			sections: sections.map((raw) => {
				const section = (raw && typeof raw === 'object' ? raw : {}) as RawDocument;
				const { layout, presentation, ...rest } = section;
				const legacyLayout = isLayout(layout) ? layout : undefined;
				const kind = legacyLayout ? LAYOUT_TO_KIND[legacyLayout] : 'prose';
				const prevPresentation =
					presentation && typeof presentation === 'object' ? (presentation as RawDocument) : {};
				return {
					...rest,
					kind,
					presentation: legacyLayout ? { ...prevPresentation, legacyLayout } : prevPresentation
				};
			})
		};
	},
	2: (doc) => {
		const sections = Array.isArray(doc.sections) ? doc.sections : [];
		const scenes = sections.map((rawSection, si) => {
			const section = (
				rawSection && typeof rawSection === 'object' ? rawSection : {}
			) as RawDocument;
			const kind = isSectionKind(section.kind) ? section.kind : 'prose';
			const presentation =
				section.presentation && typeof section.presentation === 'object'
					? (section.presentation as RawDocument)
					: {};
			const legacyLayout =
				typeof presentation.legacyLayout === 'string' ? presentation.legacyLayout : undefined;
			const scenePresentation = {
				...presentation,
				legacyKind: kind,
				...(section.animation ? { legacyAnimation: section.animation } : {})
			};
			const blocks = Array.isArray(section.blocks)
				? section.blocks.map(
						(block) => (block && typeof block === 'object' ? block : {}) as RawDocument
					)
				: [];
			const background =
				section.background && typeof section.background === 'object'
					? (section.background as RawDocument)
					: undefined;

			if (kind === 'scrolly') {
				const graphic = blocks.find((block) => block.role === 'graphic');
				const steps = blocks.filter((block) => block.role === 'step');
				const supporting = blocks.filter(
					(block) => block.role !== 'graphic' && block.role !== 'step'
				);
				const beats =
					steps.length > 0
						? steps.map((step, i) => ({
								id: beatIdFrom(step.id, i),
								at: steps.length === 1 ? 0 : i / (steps.length - 1),
								...(step.state && typeof step.state === 'object' ? { state: step.state } : {})
							}))
						: [{ id: `beat_${sceneIdFrom(section.id, si).replace(/^scn_/, '')}_start`, at: 0 }];
				const elements = [
					...(graphic ? [elementFromBlock(graphic, 0, { track: 'media' })] : []),
					...steps.map((step, i) =>
						elementFromBlock(step, i + 1, {
							track: 'content',
							anchorBeat: beats[i]?.id
						})
					),
					...supporting.map((block, i) => elementFromBlock(block, i + 1 + steps.length))
				];
				return {
					id: sceneIdFrom(section.id, si),
					type: 'reveal',
					label: typeof section.label === 'string' ? section.label : undefined,
					length: 'long',
					...(background ? { background } : {}),
					presentation: scenePresentation,
					beats,
					elements
				};
			}

			return {
				id: sceneIdFrom(section.id, si),
				type: KIND_TO_SCENE_TYPE[kind],
				label: typeof section.label === 'string' ? section.label : undefined,
				length: 'auto',
				...(background ? { background } : {}),
				presentation: legacyLayout || kind ? scenePresentation : undefined,
				beats: [{ id: `beat_${sceneIdFrom(section.id, si).replace(/^scn_/, '')}_start`, at: 0 }],
				elements: blocks.map((block, i) => elementFromBlock(block, i))
			};
		});
		const { sections: _sections, ...rest } = doc;
		void _sections;
		return {
			...rest,
			schemaVersion: 3,
			acts: [{ id: 'act_migrated', scenes }]
		};
	},
	3: (doc) => {
		const theme = migrateThemeV3toV4(doc.theme);
		const { theme: _theme, ...rest } = doc;
		void _theme;
		return {
			...rest,
			schemaVersion: 4,
			...(theme ? { theme } : {})
		};
	},
	// v4 → v5 adds the optional Element.placement field. Nothing to transform — existing
	// elements default to 'flow' (absent) — so this is a pure version advance (lossless).
	4: (doc) => ({ ...doc, schemaVersion: 5 }),
	// v5 → v6 adds the optional `pinned` placement + Element.anchor and BlockStyle.typeset.
	// All new fields are optional with safe defaults, so this is a pure version advance.
	5: (doc) => ({ ...doc, schemaVersion: 6 }),
	// v6 → v7 adds the optional document-level `pacing` (scene-continuity preset). Absent =
	// the renderer's 'cozy' default, so this is a pure version advance (lossless).
	6: (doc) => ({ ...doc, schemaVersion: 7 })
};

export class DocumentError extends Error {
	constructor(
		message: string,
		readonly issues?: readonly unknown[]
	) {
		super(message);
		this.name = 'DocumentError';
	}
}

/** Bring a raw document up to the current schema version via the migration chain. */
export function migrateToLatest(input: unknown): RawDocument {
	if (typeof input !== 'object' || input === null || Array.isArray(input)) {
		throw new DocumentError('Document must be an object.');
	}
	let doc = input as RawDocument;
	let version = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 0;
	while (version < CURRENT_SCHEMA_VERSION) {
		const migrate = migrations[version];
		if (!migrate) {
			throw new DocumentError(`No migration path from schemaVersion ${version}.`);
		}
		doc = migrate(doc);
		const next = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : version;
		if (next <= version) {
			throw new DocumentError(
				`Migration from schemaVersion ${version} did not advance the version.`
			);
		}
		version = next;
	}
	return doc;
}

/** Migrate + validate a raw document. Throws DocumentError with a readable message. */
export function parseDocument(input: unknown): ZineDocument {
	const migrated = migrateToLatest(input);
	const result = ZineDocumentSchema.safeParse(migrated);
	if (!result.success) {
		throw new DocumentError(z.prettifyError(result.error), result.error.issues);
	}
	return result.data;
}

/** Non-throwing variant. */
export function safeParseDocument(
	input: unknown
): { ok: true; document: ZineDocument } | { ok: false; error: DocumentError } {
	try {
		return { ok: true, document: parseDocument(input) };
	} catch (error) {
		return {
			ok: false,
			error: error instanceof DocumentError ? error : new DocumentError(String(error))
		};
	}
}

/**
 * Publish-time accessibility/quality gate: collect every block's blockers (e.g. an
 * image missing alt text). Empty array = publishable.
 */
export function publishBlockers(doc: ZineDocument): string[] {
	const blockers: string[] = [];
	doc.acts.forEach((act, ai) =>
		act.scenes.forEach((scene, si) =>
			scene.elements.forEach((element, ei) => {
				const block = element.block;
				const def = getBlock(block.type);
				for (const message of def?.requiredForPublish?.(block.props) ?? []) {
					blockers.push(
						`Act ${ai + 1}, scene ${si + 1}, element ${ei + 1} (${block.type}): ${message}`
					);
				}
				if (element.placement === 'pinned') {
					const problem = pinnedContentProblem(block);
					if (problem) {
						blockers.push(
							`Act ${ai + 1}, scene ${si + 1}, element ${ei + 1} (${block.type}): ${problem}`
						);
					}
				}
			})
		)
	);
	return blockers;
}
