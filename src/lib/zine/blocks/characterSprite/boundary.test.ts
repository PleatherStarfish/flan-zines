import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(process.cwd());
const ROOTS: Record<string, string[]> = {
	'src/lib/zine/blocks/characterSprite/index.ts': [
		'gifenc',
		'$lib/editor/',
		'../editor/',
		'../../editor/',
		'pixel-character'
	],
	'src/lib/zine/render/ZineRenderer.svelte': ['gifenc', 'pixel-character']
};

describe('character sprite reader boundary', () => {
	it('keeps gifenc and editor-only modules out of the reader graph', () => {
		for (const [root, forbiddenSpecifiers] of Object.entries(ROOTS)) {
			const visited = new Set<string>();
			const offenders = walk(resolve(ROOT, root), visited).filter((item) =>
				forbiddenSpecifiers.some(
					(forbidden) => item.specifier === forbidden || item.specifier.includes(forbidden)
				)
			);
			expect(offenders, root).toEqual([]);
		}
	});
});

function walk(file: string, visited: Set<string>): { file: string; specifier: string }[] {
	if (visited.has(file) || !existsSync(file)) return [];
	visited.add(file);
	const source = readFileSync(file, 'utf8');
	const imports = importSpecifiers(source);
	const offenders = imports.map((specifier) => ({ file, specifier }));
	for (const specifier of imports) {
		const next = resolveImport(file, specifier);
		if (next && next.startsWith(resolve(ROOT, 'src/lib/zine')))
			offenders.push(...walk(next, visited));
	}
	return offenders;
}

function importSpecifiers(source: string): string[] {
	const specs: string[] = [];
	const patterns = [
		/import\s+(?:type\s+)?[^'"]*?\s+from\s+['"]([^'"]+)['"]/g,
		/import\s*?\(\s*['"]([^'"]+)['"]\s*?\)/g
	];
	for (const pattern of patterns) {
		let match: RegExpExecArray | null;
		while ((match = pattern.exec(source))) specs.push(match[1]);
	}
	return specs;
}

function resolveImport(importer: string, specifier: string): string | null {
	if (specifier.startsWith('$lib/'))
		return resolveCandidate(resolve(ROOT, 'src/lib', specifier.slice(5)));
	if (specifier.startsWith('.')) return resolveCandidate(resolve(dirname(importer), specifier));
	return null;
}

function resolveCandidate(base: string): string | null {
	const candidates = [
		base,
		`${base}.ts`,
		`${base}.svelte`,
		`${base}.js`,
		resolve(base, 'index.ts'),
		resolve(base, 'index.svelte')
	];
	return (
		candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null
	);
}
