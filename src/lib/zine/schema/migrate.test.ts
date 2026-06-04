import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION } from './document';
import { DocumentError, migrateToLatest, parseDocument } from './migrate';

const currentDoc = { schemaVersion: CURRENT_SCHEMA_VERSION, sections: [] };

describe('document migrations', () => {
	it('passes a current-version document through unchanged', () => {
		expect(migrateToLatest(currentDoc)).toEqual(currentDoc);
	});

	it('requires an explicit schemaVersion (a versionless doc is version 0)', () => {
		expect(() => migrateToLatest({ sections: [] })).toThrow(/schemaVersion 0/);
	});

	it('rejects a future schema version it cannot understand', () => {
		expect(() => parseDocument({ schemaVersion: 99, sections: [] })).toThrow(DocumentError);
	});

	it('rejects non-object / array input', () => {
		expect(() => migrateToLatest(null)).toThrow(DocumentError);
		expect(() => migrateToLatest([])).toThrow(DocumentError);
	});
});
