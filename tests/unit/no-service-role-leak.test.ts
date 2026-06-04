import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

// Secret-guard: the Supabase service-role key (and anything matching these tokens)
// must never appear in client-reachable code. It is permitted ONLY under
// src/lib/server/** (which SvelteKit also refuses to bundle into the client).
// This test fails CI if that boundary is crossed.

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const SERVER_PREFIX = ['src', 'lib', 'server'].join(sep) + sep;
const FORBIDDEN = [/SERVICE_ROLE/i, /service[_-]?role[_-]?key/i];

function sourceFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			out.push(...sourceFiles(full));
		} else if (/\.(ts|js|svelte)$/.test(entry)) {
			out.push(full);
		}
	}
	return out;
}

describe('secret-guard: service-role key never leaks to client code', () => {
	const files = sourceFiles(SRC);

	it('finds source files to scan', () => {
		expect(files.length).toBeGreaterThan(0);
	});

	it('has no service-role references outside src/lib/server', () => {
		const offenders: string[] = [];
		for (const file of files) {
			const rel = file.slice(ROOT.length + 1);
			if (rel.startsWith(SERVER_PREFIX)) continue; // server-only is allowed
			if (/\.(test|spec)\./.test(rel)) continue; // this guard references the token by design
			if (FORBIDDEN.some((re) => re.test(readFileSync(file, 'utf8')))) {
				offenders.push(rel);
			}
		}
		expect(offenders, `service-role references leaked into: ${offenders.join(', ')}`).toEqual([]);
	});
});
