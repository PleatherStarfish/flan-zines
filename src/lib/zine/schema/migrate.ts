import { z } from 'zod';
import { getBlock } from '../registry';
import { CURRENT_SCHEMA_VERSION, ZineDocumentSchema, type ZineDocument } from './document';

// Versioned migration scaffold. Forward migrations are keyed by the version they
// UPGRADE FROM and return the next version's shape. Only v1 exists today; the
// structure makes adding v2 mechanical (and a schemaVersion bump enforced).
type RawDocument = Record<string, unknown>;
type Migration = (doc: RawDocument) => RawDocument;

const migrations: Record<number, Migration> = {
	// Example for the future:
	// 1: (doc) => ({ ...doc, schemaVersion: 2, sections: upgradeSections(doc.sections) })
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
 * image missing alt text). Empty array = publishable. Used by the publish pipeline
 * (Step 5/6); exposed here so the editor (Step 3) can warn earlier.
 */
export function publishBlockers(doc: ZineDocument): string[] {
	const blockers: string[] = [];
	doc.sections.forEach((section, si) =>
		section.blocks.forEach((block, bi) => {
			const def = getBlock(block.type);
			for (const message of def?.requiredForPublish?.(block.props) ?? []) {
				blockers.push(`Section ${si + 1}, block ${bi + 1} (${block.type}): ${message}`);
			}
		})
	);
	return blockers;
}
