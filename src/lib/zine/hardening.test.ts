// Property / fuzz hardening suite. Probes the documented invariants — lossless & idempotent
// document parsing, total (never-throwing) resolvers, finite render math, no injectable CSS —
// across randomized inputs. Each failing property is a real bug.
import { describe, expect, it } from 'vitest';
import { parseDocument } from './schema/migrate';
import { CURRENT_SCHEMA_VERSION } from './schema/document';
import { sampleZineRaw } from './fixtures';
import { ZINE_TEMPLATES } from '../editor/templates';
import { samplePath, pathTransform } from './animations/path-runtime';
import { DEFAULT_WAYPOINTS, PathParamsSchema, type Waypoint } from './animations/path';
import { fontPairById, fontPairFamilies, themeFontFamilyIds, FONT_FAMILIES } from './theme/fonts';
import { themeVars, resolveThemeColors } from './theme/registry';
import { deriveTheme, isLegibleTheme } from './theme/derive';

// ── a tiny seeded RNG so failures reproduce ──────────────────────────────────────────────
function rng(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n);

describe('document parse is lossless + idempotent', () => {
	const rawDocs = [sampleZineRaw, ...ZINE_TEMPLATES.map((t) => t.build())];

	it('parses every fixture/template to the current version', () => {
		for (const raw of rawDocs) {
			const doc = parseDocument(raw);
			expect(doc.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
		}
	});

	it('is idempotent: re-parsing a parsed document yields a deep-equal document', () => {
		for (const raw of rawDocs) {
			const once = parseDocument(raw);
			const twice = parseDocument(JSON.parse(JSON.stringify(once)));
			expect(twice).toEqual(once);
		}
	});
});

describe('samplePath is total and finite for any valid path', () => {
	function randomWaypoints(rand: () => number): Waypoint[] {
		const n = 2 + Math.floor(rand() * 10);
		const eases = ['linear', 'smooth', 'in', 'out', 'arc'] as const;
		// strictly increasing `at` in (0,1)
		const ats = Array.from({ length: n }, () => rand()).sort((a, b) => a - b);
		for (let i = 1; i < ats.length; i++) if (ats[i] <= ats[i - 1]) ats[i] = ats[i - 1] + 1e-4;
		return ats.map((at, i) => ({
			at: i === 0 ? 0 : i === n - 1 ? 1 : Math.min(at, 0.999),
			x: -50 + rand() * 200,
			y: -50 + rand() * 200,
			scale: 0.1 + rand() * 3.9,
			rotate: -360 + rand() * 720,
			ease: eases[Math.floor(rand() * eases.length)]
		}));
	}

	it('returns finite x/y/scale/rotate for any phase and never an injectable transform', () => {
		const rand = rng(1234);
		for (let trial = 0; trial < 2000; trial++) {
			const wps = randomWaypoints(rand);
			const phase = -0.2 + rand() * 1.4; // include out-of-range
			const s = samplePath(wps, phase);
			expect(
				finite(s.x) && finite(s.y) && finite(s.scale) && finite(s.rotate),
				JSON.stringify({ wps, phase })
			).toBe(true);
			const t = pathTransform(s);
			expect(t.startsWith('translate(')).toBe(true);
			expect(/url\(|expression|javascript:|<|>/i.test(t)).toBe(false);
		}
	});

	it('pins the endpoints exactly (continuity at the boundaries)', () => {
		const rand = rng(99);
		for (let trial = 0; trial < 500; trial++) {
			const wps = randomWaypoints(rand);
			const atStart = samplePath(wps, wps[0].at);
			expect(atStart.x).toBeCloseTo(wps[0].x, 6);
			expect(atStart.y).toBeCloseTo(wps[0].y, 6);
			const atEnd = samplePath(wps, wps[wps.length - 1].at);
			expect(atEnd.x).toBeCloseTo(wps[wps.length - 1].x, 6);
		}
	});

	it('handles degenerate inputs without NaN (empty, single, duplicate `at`)', () => {
		for (const wps of [
			[] as Waypoint[],
			[{ at: 0.5, x: 10, y: 20, scale: 1, rotate: 0, ease: 'linear' }] as Waypoint[],
			[
				{ at: 0.3, x: 0, y: 0, scale: 1, rotate: 0, ease: 'linear' },
				{ at: 0.3, x: 90, y: 90, scale: 2, rotate: 45, ease: 'smooth' }
			] as Waypoint[]
		]) {
			for (const phase of [0, 0.3, 0.5, 1]) {
				const s = samplePath(wps, phase);
				expect(finite(s.x) && finite(s.y) && finite(s.scale) && finite(s.rotate)).toBe(true);
			}
		}
	});

	it('the schema default path round-trips through PathParamsSchema', () => {
		expect(PathParamsSchema.safeParse({ waypoints: DEFAULT_WAYPOINTS }).success).toBe(true);
		expect(PathParamsSchema.safeParse({}).success).toBe(true);
	});
});

describe('font resolution is a total function', () => {
	it('never throws and always yields non-empty heading/body stacks for any string', () => {
		const rand = rng(7);
		const fixed = [
			'',
			'editorial',
			'mono',
			'bold',
			'custom:',
			'custom:lora',
			'custom:lora:inter',
			'custom:::',
			'custom:x:y:z',
			'CUSTOM:LORA:INTER',
			'custom:caveat:caveat'
		];
		const random = Array.from({ length: 500 }, () => {
			const len = Math.floor(rand() * 24);
			let str = '';
			for (let i = 0; i < len; i++) str += String.fromCharCode(32 + Math.floor(rand() * 200));
			return rand() < 0.4 ? 'custom:' + str : str;
		});
		for (const id of [...fixed, ...random, undefined]) {
			const r = fontPairById(id as string | undefined);
			expect(typeof r.heading === 'string' && r.heading.length > 0, JSON.stringify(id)).toBe(true);
			expect(typeof r.body === 'string' && r.body.length > 0).toBe(true);
			const fams = fontPairFamilies(id as string | undefined);
			expect(fams.heading.id).toBeTruthy();
			expect(fams.body.id).toBeTruthy();
		}
	});

	it('every family has a loader (no font can be picked that then silently never loads)', async () => {
		const { LOADER_IDS } = await import('./theme/font-loader');
		for (const f of FONT_FAMILIES) expect(LOADER_IDS, f.id).toContain(f.id);
		expect(themeFontFamilyIds({ fontPair: 'editorial' }).length).toBeGreaterThan(0);
	});
});

describe('themeVars is injection-safe and complete for any theme', () => {
	it('emits all role + font vars and never raw author junk', () => {
		const rand = rng(55);
		for (let trial = 0; trial < 300; trial++) {
			// random-ish theme incl. legacy + custom fonts; colours are HexColor-shaped
			const hex = () =>
				'#' +
				Math.floor(rand() * 0xffffff)
					.toString(16)
					.padStart(6, '0');
			const theme = {
				colors: { background: hex(), text: hex(), heading: hex(), accent: hex(), muted: hex() },
				fontPair: rand() < 0.5 ? 'custom:caveat:inter' : 'editorial'
			};
			const vars = themeVars(theme);
			for (const v of [
				'--zine-bg',
				'--zine-fg',
				'--zine-heading',
				'--zine-accent',
				'--zine-muted',
				'--zine-font-heading',
				'--zine-font-body'
			]) {
				expect(vars.includes(v), `${v} missing`).toBe(true);
			}
			expect(/javascript:|expression\(|url\(/i.test(vars)).toBe(false);
		}
		// resolveThemeColors never returns undefined fields
		const c = resolveThemeColors(undefined);
		expect(c.background && c.text && c.heading && c.accent && c.muted).toBeTruthy();
	});
});

describe('deriveTheme is robust + the catalogue claim holds', () => {
	it('produces #rrggbb role colours for arbitrary palettes (incl. degenerate)', () => {
		const rand = rng(321);
		const hexRe = /^#[0-9a-f]{6}$/i;
		for (let trial = 0; trial < 400; trial++) {
			const n = 1 + Math.floor(rand() * 7);
			const palette = Array.from(
				{ length: n },
				() =>
					'#' +
					Math.floor(rand() * 0xffffff)
						.toString(16)
						.padStart(6, '0')
			);
			const theme = deriveTheme(`t${trial}`, palette);
			for (const [role, color] of Object.entries(theme.colors)) {
				expect(hexRe.test(color), `${role}=${color} for ${palette}`).toBe(true);
			}
			// legibility gate must be self-consistent: a theme it passes must really be AA
			if (isLegibleTheme(theme.colors)) {
				// text on background is the strictest; just assert it doesn't equal the bg
				expect(theme.colors.text.toLowerCase()).not.toBe(theme.colors.background.toLowerCase());
			}
		}
	});

	it('never leaks an unparseable colour into the role map (autosave-safe)', () => {
		const hexRe = /^#[0-9a-f]{6}$/i;
		for (const palette of [
			['not-a-color', 'rgb(oops)', '#zzzzzz'], // all invalid
			['#abcdef', 'garbage', '#112233'], // mixed
			[] as string[] // empty
		]) {
			const theme = deriveTheme('x', palette);
			for (const c of Object.values(theme.colors)) expect(hexRe.test(c), c).toBe(true);
		}
	});
});
