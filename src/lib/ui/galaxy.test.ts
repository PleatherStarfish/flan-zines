import { describe, expect, it } from 'vitest';
import {
	decayBoost,
	freshSeed,
	generateScene,
	mulberry32,
	PLANET_TYPES,
	type GalaxyScene
} from './galaxy';

describe('mulberry32', () => {
	it('is deterministic for a given seed', () => {
		const a = mulberry32(42);
		const b = mulberry32(42);
		expect(Array.from({ length: 5 }, () => a())).toEqual(Array.from({ length: 5 }, () => b()));
	});

	it('produces values in [0, 1)', () => {
		const rnd = mulberry32(12345);
		for (let i = 0; i < 1000; i++) {
			const v = rnd();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});
});

describe('freshSeed', () => {
	it('returns a uint32', () => {
		const s = freshSeed();
		expect(Number.isInteger(s)).toBe(true);
		expect(s).toBeGreaterThanOrEqual(0);
		expect(s).toBeLessThanOrEqual(0xffffffff);
	});
});

describe('generateScene', () => {
	it('is fully deterministic for the same seed + size', () => {
		expect(generateScene(480, 300, 99)).toEqual(generateScene(480, 300, 99));
	});

	it('produces a different sky for a different seed', () => {
		const a = generateScene(480, 300, 1);
		const b = generateScene(480, 300, 2);
		expect(JSON.stringify(a.stars)).not.toEqual(JSON.stringify(b.stars));
	});

	it('places every star in-bounds for its own wrap height (x wraps over lw, y over worldH)', () => {
		const { stars } = generateScene(400, 250, 7);
		for (const s of stars) {
			expect(s.x).toBeGreaterThanOrEqual(0);
			expect(s.x).toBeLessThan(400);
			expect(s.worldH).toBeGreaterThanOrEqual(250); // taller than the viewport
			expect(s.y).toBeGreaterThanOrEqual(0);
			expect(s.y).toBeLessThan(s.worldH);
		}
	});

	it('keeps most stars in a GENTLE band but lets a few sit CLOSER (distorted)', () => {
		const scene = collect(40, 500, 320);
		let nearCount = 0;
		for (const s of scene.stars) {
			if (s.near) {
				nearCount++;
				expect(s.shape).toBe('spike'); // closer stars get the diffraction/distortion pattern
				expect(s.parallax).toBeGreaterThan(0.7); // closer than the distant band
				expect(s.parallax).toBeLessThanOrEqual(0.96);
				expect(s.spikeLen).toBeGreaterThan(0);
			} else {
				expect(s.parallax).toBeGreaterThanOrEqual(0.5);
				expect(s.parallax).toBeLessThanOrEqual(0.7); // narrow → little parallax between stars
			}
		}
		expect(nearCount).toBeGreaterThan(0); // some closer stars exist
		for (const n of scene.nebulas) expect(n.parallax).toBeLessThan(0.55);
		for (const g of scene.galaxies) expect(g.parallax).toBeLessThan(0.47);
		for (const p of scene.planets) expect(p.parallaxY).toBeGreaterThanOrEqual(1.0); // foreground
	});

	it('gives each planet a prototype + a noise VARIATION (so same-prototype planets differ)', () => {
		// Collect variations per prototype across seeds; the param bags should not be all-identical.
		const byType = new Map<string, string[]>();
		for (let seed = 0; seed < 220; seed++) {
			for (const p of generateScene(640, 400, seed).planets) {
				expect(p.params).toBeTruthy();
				expect(p.params.noiseScale).toBeGreaterThan(0);
				const sig = JSON.stringify([p.params, p.r, p.g, p.b, p.r2, p.r3]);
				const list = byType.get(p.type) ?? [];
				list.push(sig);
				byType.set(p.type, list);
			}
		}
		// For at least one well-represented prototype, the instances vary (not a single fixed look).
		const varied = [...byType.values()].some((sigs) => sigs.length >= 3 && new Set(sigs).size > 1);
		expect(varied).toBe(true);
	});

	it('brings back occasional ringed planets (across prototypes)', () => {
		const ringedTypes = new Set<string>();
		let ringed = 0;
		for (let seed = 0; seed < 200; seed++) {
			for (const p of generateScene(640, 400, seed).planets) {
				if (p.ring) {
					ringed++;
					ringedTypes.add(p.type);
					expect(p.ringSquash).toBeGreaterThan(0);
				}
			}
		}
		expect(ringed).toBeGreaterThan(0);
		expect(ringedTypes.size).toBeGreaterThanOrEqual(1);
	});

	it('makes planets rare (often zero, occasionally a couple) and lets them drift on X', () => {
		let withZero = 0;
		let maxCount = 0;
		let sawDrift = false;
		for (let seed = 0; seed < 60; seed++) {
			const { planets } = generateScene(500, 320, seed);
			if (planets.length === 0) withZero++;
			maxCount = Math.max(maxCount, planets.length);
			for (const p of planets) {
				expect(PLANET_TYPES).toContain(p.type);
				expect(p.radius).toBeGreaterThan(0);
				if (Math.abs(p.driftX) > 0.03) sawDrift = true; // closer → scrolls on the X axis too
			}
		}
		expect(withZero).toBeGreaterThan(0); // genuinely sometimes empty
		expect(maxCount).toBeLessThanOrEqual(3);
		expect(sawDrift).toBe(true);
	});

	it('covers the full spread of planet types across seeds', () => {
		const seen = new Set<string>();
		for (let seed = 0; seed < 200; seed++) {
			for (const p of generateScene(640, 400, seed).planets) seen.add(p.type);
		}
		// Expect a rich variety — at least most of the catalogue shows up.
		expect(seen.size).toBeGreaterThanOrEqual(4);
	});

	it('gives some planets orbiting moons', () => {
		let withMoons = 0;
		for (let seed = 0; seed < 80; seed++) {
			for (const p of generateScene(640, 400, seed).planets) {
				if (p.moons.length > 0) {
					withMoons++;
					for (const m of p.moons) {
						expect(m.orbitR).toBeGreaterThan(p.radius); // orbits outside the planet
						expect(m.speed).not.toBe(0);
					}
				}
			}
		}
		expect(withMoons).toBeGreaterThan(0);
	});

	it('scatters occasional asteroids (sometimes none, sometimes a belt)', () => {
		let sawNone = false;
		let sawMany = false;
		for (let seed = 0; seed < 80; seed++) {
			const n = generateScene(560, 360, seed).asteroids.length;
			if (n === 0) sawNone = true;
			if (n >= 4) sawMany = true; // a belt cluster
		}
		expect(sawNone).toBe(true);
		expect(sawMany).toBe(true);
	});

	it('always lays out at least one galaxy and one nebula', () => {
		const scene = generateScene(600, 400, 21);
		expect(scene.galaxies.length).toBeGreaterThanOrEqual(1);
		expect(scene.nebulas.length).toBeGreaterThanOrEqual(1);
	});

	it('scales star count with canvas area', () => {
		expect(generateScene(800, 600, 5).stars.length).toBeGreaterThan(
			generateScene(200, 150, 5).stars.length
		);
	});

	it('clamps absurd sizes without throwing', () => {
		expect(() => generateScene(1, 1, 0)).not.toThrow();
		expect(generateScene(1, 1, 0).stars.length).toBeGreaterThanOrEqual(80);
	});
});

describe('decayBoost', () => {
	it('is a no-op at dt=0', () => {
		expect(decayBoost(50, 0)).toBe(50);
	});

	it('eases a boost toward zero over time', () => {
		const after = decayBoost(100, 0.5);
		expect(after).toBeGreaterThan(0);
		expect(after).toBeLessThan(100);
	});

	it('preserves sign (a downward boost stays negative)', () => {
		expect(decayBoost(-80, 0.2)).toBeLessThan(0);
	});

	it('decays faster with a larger rate', () => {
		expect(decayBoost(100, 0.5, 6)).toBeLessThan(decayBoost(100, 0.5, 1));
	});
});

/** Gather objects across many seeds so per-property assertions see real variety. */
function collect(seeds: number, lw: number, lh: number): GalaxyScene {
	const all: GalaxyScene = {
		lw,
		lh,
		seed: 0,
		stars: [],
		planets: [],
		asteroids: [],
		galaxies: [],
		nebulas: []
	};
	for (let seed = 0; seed < seeds; seed++) {
		const s = generateScene(lw, lh, seed);
		all.stars.push(...s.stars);
		all.planets.push(...s.planets);
		all.asteroids.push(...s.asteroids);
		all.galaxies.push(...s.galaxies);
		all.nebulas.push(...s.nebulas);
	}
	return all;
}
