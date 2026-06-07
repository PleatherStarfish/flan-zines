// A generative pixel-art universe for the homepage backdrop. This module is the PURE half:
// given a seed and the (low-res) canvas size it deterministically lays out the whole scene —
// stars, planets (with orbiting moons + rings), asteroids, spiral galaxies and nebulas — as
// plain data. The Svelte component owns the canvas, the loop and the pixel-pushing.
//
// PLANETS use a "prototype + variation" model: there are six PROTOTYPES (rocky, water, desert,
// gas, ice, lava) and each instance rolls a VARIATION — a palette pulled from that prototype's
// family plus a bag of noise parameters (feature scale, domain-warp amount, contrast, band
// count, land/crack coverage, polar-cap size, …). So two planets of the same prototype — even
// in one scene — look genuinely different, and the renderer turns those numbers into surfaces
// with domain-warped value noise.
//
// The deep field wraps gently because it reads as atmosphere. Foreground planets do NOT wrap:
// they are a seeded stream of one-time passes, each with its own entry edge, curve, wobble,
// scale and surface seed. That keeps the universe reproducible in tests without making a
// memorable planet climb out of the same corner over and over.

type RGB = readonly [number, number, number];

export const PLANET_TYPES = ['rocky', 'water', 'desert', 'gas', 'ice', 'lava'] as const;
export type PlanetType = (typeof PLANET_TYPES)[number];

export interface StarSpec {
	x: number; // [0, lw)
	y: number; // [0, worldH)
	worldH: number; // vertical wrap height (>= lh)
	parallax: number; // gentle distant band — except `near` stars, which sit closer
	near: boolean; // a closer star, drawn with a diffraction/distortion pattern
	size: 1 | 2;
	shape: 'dot' | 'plus' | 'spike';
	spikeLen: number; // diffraction-spike length (near stars)
	glow: boolean;
	r: number;
	g: number;
	b: number;
	baseA: number; // peak brightness 0..1
	twinkle: number; // 0 = steady
	twFreq: number; // radians per millisecond
	twPhase: number;
}

export interface MoonSpec {
	orbitR: number; // px from planet centre
	squash: number; // ellipse y-scale (orbit tilt toward viewer)
	tilt: number; // rotation of the orbit plane, radians
	speed: number; // radians per ms, signed (orbit direction)
	phase: number;
	size: number; // 1..3
	r: number;
	g: number;
	b: number;
}

// The per-instance variation knobs. Not every field matters to every prototype; the renderer
// reads the ones relevant to the planet's type.
export interface PlanetParams {
	noiseScale: number; // base feature frequency
	warp: number; // domain-warp amount (swirls/marbles the surface)
	contrast: number; // tone spread
	bandCount: number; // gas/desert banding
	coverage: number; // land fraction / crack density / crater density (per type)
	capSize: number; // polar-cap latitude threshold
	featureA: number; // spare knob (clouds, maria, …)
	featureB: number;
}

export interface PlanetSpec {
	passIndex: number;
	start: number; // scroll/ambient offset at which this one-time pass begins
	span: number; // offset distance from off-screen entry to off-screen exit
	entryEdge: 'bottom' | 'left' | 'right' | 'top';
	fromX: number;
	fromY: number;
	toX: number;
	toY: number;
	curveX: number;
	curveY: number;
	wobble: number;
	wobblePhase: number;
	depth: number; // foreground depth; higher = larger/faster-feeling
	scale: number;
	type: PlanetType; // the prototype
	radius: number;
	r: number; // base tone
	g: number;
	b: number;
	r2: number; // accent tone
	g2: number;
	b2: number;
	r3: number; // detail tone (clouds / glow / highlights)
	g3: number;
	b3: number;
	params: PlanetParams;
	storm: boolean; // a great-spot storm (gas giants)
	lightAngle: number;
	ring: boolean;
	ringR: number;
	ringG: number;
	ringB: number;
	ringSquash: number; // ring ellipse y-scale (tilt)
	moons: MoonSpec[];
	seed: number; // surface-texture sub-seed
}

export interface AsteroidSpec {
	x: number;
	y: number;
	worldH: number;
	parallax: number;
	size: number;
	stretchX: number;
	stretchY: number;
	rotation: number;
	facets: number;
	craters: { x: number; y: number; r: number }[];
	r: number;
	g: number;
	b: number;
	seed: number;
}

export interface GalaxySpec {
	x: number;
	y: number;
	worldH: number;
	parallax: number;
	radius: number;
	arms: number;
	spin: number;
	rotation: number;
	squash: number;
	incline: number;
	aR: number;
	aG: number;
	aB: number;
	bR: number;
	bG: number;
	bB: number;
	seed: number;
}

export interface NebulaSpec {
	x: number;
	y: number;
	worldH: number;
	parallax: number;
	radius: number;
	stretch: number;
	angle: number;
	aR: number;
	aG: number;
	aB: number;
	bR: number;
	bG: number;
	bB: number;
	seed: number;
}

export interface GalaxyScene {
	lw: number;
	lh: number;
	seed: number;
	stars: StarSpec[];
	planets: PlanetSpec[]; // initial foreground pass queue, sorted by start
	asteroids: AsteroidSpec[];
	galaxies: GalaxySpec[];
	nebulas: NebulaSpec[];
}

export interface PlanetPassPosition {
	progress: number;
	visible: boolean;
	x: number;
	y: number;
}

// --- PRNG -----------------------------------------------------------------
export function mulberry32(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** A fresh seed per page load, mixing the clock with entropy so each visit is a new sky. */
export function freshSeed(): number {
	return (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
}

// --- small helpers --------------------------------------------------------
function range(rnd: () => number, a: number, b: number): number {
	return a + rnd() * (b - a);
}
function pick<T>(rnd: () => number, arr: readonly T[]): T {
	return arr[Math.floor(rnd() * arr.length)];
}
function clamp(n: number, lo: number, hi: number): number {
	return n < lo ? lo : n > hi ? hi : n;
}
function jitter(rnd: () => number, [r, g, b]: RGB, amt: number): [number, number, number] {
	const j = () => (rnd() - 0.5) * 2 * amt;
	return [clamp(r + j(), 0, 255), clamp(g + j(), 0, 255), clamp(b + j(), 0, 255)];
}

/** Slowly decay a transient scroll "boost" back toward the ambient drift. Pure → testable. */
export function decayBoost(boost: number, dt: number, rate = 3): number {
	return boost * Math.exp(-dt * rate);
}

// --- palettes -------------------------------------------------------------
// Stars: a weighted spread (white dominates, then blue/yellow giants, with rarer exotic hues).
const STAR_COLORS: RGB[] = [
	[255, 255, 255],
	[255, 255, 255],
	[255, 255, 255],
	[244, 248, 255],
	[208, 224, 255],
	[180, 205, 255],
	[190, 240, 255],
	[255, 246, 214],
	[255, 226, 170],
	[255, 196, 150],
	[255, 168, 150],
	[236, 200, 255]
];

const RING_COLORS: RGB[] = [
	[235, 222, 190],
	[200, 224, 240],
	[230, 200, 235],
	[214, 206, 176],
	[206, 188, 224]
];

// Each prototype's palette FAMILY: a list of [base, accent, detail] schemes. Picking a scheme
// (then jittering it) is the first big lever of variation between two planets of one prototype.
const PLANET_PALETTES: Record<PlanetType, [RGB, RGB, RGB][]> = {
	rocky: [
		[
			[124, 112, 102],
			[74, 66, 60],
			[150, 140, 130]
		],
		[
			[120, 96, 80],
			[70, 52, 42],
			[152, 122, 98]
		],
		[
			[150, 92, 80],
			[92, 52, 46],
			[182, 122, 110]
		],
		[
			[96, 98, 108],
			[56, 58, 66],
			[132, 134, 142]
		]
	],
	water: [
		[
			[42, 96, 176],
			[92, 156, 86],
			[236, 244, 252]
		],
		[
			[36, 110, 150],
			[120, 150, 74],
			[230, 238, 245]
		],
		[
			[40, 80, 162],
			[150, 120, 80],
			[240, 240, 250]
		],
		[
			[30, 132, 140],
			[90, 160, 120],
			[226, 246, 240]
		]
	],
	desert: [
		[
			[204, 152, 92],
			[150, 100, 58],
			[236, 222, 190]
		],
		[
			[196, 110, 72],
			[140, 70, 50],
			[230, 200, 170]
		],
		[
			[214, 170, 96],
			[160, 116, 60],
			[240, 228, 200]
		]
	],
	gas: [
		[
			[206, 168, 124],
			[150, 110, 70],
			[240, 214, 170]
		], // jovian tan
		[
			[120, 150, 200],
			[70, 100, 170],
			[210, 230, 245]
		], // neptune blue
		[
			[214, 196, 150],
			[170, 150, 100],
			[245, 235, 205]
		], // saturn gold
		[
			[170, 120, 200],
			[120, 70, 160],
			[230, 200, 240]
		], // exotic violet
		[
			[150, 180, 170],
			[90, 140, 140],
			[220, 240, 235]
		] // pale teal
	],
	ice: [
		[
			[200, 222, 240],
			[150, 184, 222],
			[248, 252, 255]
		],
		[
			[180, 210, 225],
			[120, 170, 200],
			[240, 250, 255]
		],
		[
			[206, 220, 236],
			[168, 190, 222],
			[250, 250, 255]
		]
	],
	lava: [
		[
			[60, 46, 46],
			[255, 138, 44],
			[255, 230, 120]
		], // orange
		[
			[54, 40, 44],
			[255, 96, 40],
			[255, 180, 90]
		], // red
		[
			[50, 44, 40],
			[255, 170, 40],
			[255, 240, 160]
		] // yellow-white
	]
};

const PLANET_TYPE_WEIGHTS: [PlanetType, number][] = [
	['rocky', 0.24],
	['water', 0.18],
	['desert', 0.16],
	['gas', 0.16],
	['ice', 0.13],
	['lava', 0.13]
];

const GALAXY_TINTS: [RGB, RGB][] = [
	[
		[255, 226, 188],
		[150, 170, 255]
	],
	[
		[255, 214, 236],
		[150, 120, 230]
	],
	[
		[214, 240, 255],
		[110, 150, 240]
	],
	[
		[255, 236, 210],
		[210, 140, 255]
	],
	[
		[222, 255, 236],
		[120, 200, 200]
	]
];

const NEBULA_PAIRS: [RGB, RGB][] = [
	[
		[180, 60, 150],
		[60, 70, 190]
	],
	[
		[60, 150, 200],
		[60, 80, 200]
	],
	[
		[200, 80, 140],
		[120, 60, 200]
	],
	[
		[60, 170, 150],
		[70, 120, 200]
	],
	[
		[210, 110, 70],
		[150, 60, 140]
	],
	[
		[90, 200, 160],
		[60, 110, 180]
	],
	[
		[150, 90, 210],
		[60, 60, 160]
	]
];

const MOON_COLORS: RGB[] = [
	[210, 210, 216],
	[190, 186, 180],
	[176, 184, 200],
	[206, 196, 178]
];

function weightedType(rnd: () => number): PlanetType {
	let r = rnd();
	for (const [type, w] of PLANET_TYPE_WEIGHTS) {
		if (r < w) return type;
		r -= w;
	}
	return 'rocky';
}

// Roll a prototype's variation knobs. The per-type ranges are what make a "gas giant" read as a
// banded jovian one time and a turbulent storm-world the next.
function makeParams(type: PlanetType, rnd: () => number): PlanetParams {
	const p: PlanetParams = {
		noiseScale: range(rnd, 2.2, 4.2),
		warp: range(rnd, 0, 0.5),
		contrast: range(rnd, 0.4, 1),
		bandCount: 0,
		coverage: 0,
		capSize: 0,
		featureA: rnd(),
		featureB: rnd()
	};
	switch (type) {
		case 'gas':
			p.bandCount = Math.round(range(rnd, 4, 11));
			p.warp = range(rnd, 0.25, 1.05);
			p.contrast = range(rnd, 0.5, 1.25);
			break;
		case 'water':
			p.coverage = range(rnd, 0.34, 0.62); // sea level → land fraction
			p.capSize = range(rnd, 0.58, 0.86);
			p.featureA = range(rnd, 0, 0.55); // cloud coverage
			p.noiseScale = range(rnd, 2.2, 4);
			p.warp = range(rnd, 0, 0.4);
			break;
		case 'desert':
			p.bandCount = Math.round(range(rnd, 3, 8));
			p.coverage = range(rnd, 0.14, 0.36); // canyon density
			p.capSize = range(rnd, 0.7, 0.92);
			break;
		case 'ice':
			p.coverage = range(rnd, 0.08, 0.22); // crack density
			p.capSize = range(rnd, 0.52, 0.8);
			p.contrast = range(rnd, 0.4, 0.95);
			break;
		case 'lava':
			p.coverage = range(rnd, 0.1, 0.24); // crack density
			p.contrast = range(rnd, 0.6, 1.35);
			p.noiseScale = range(rnd, 2.6, 5);
			break;
		case 'rocky':
			p.coverage = range(rnd, 0.2, 1); // crater density
			p.featureA = range(rnd, 0, 0.5); // maria (dark plains)
			p.warp = range(rnd, 0, 0.3);
			break;
	}
	return p;
}

function makeMoons(rnd: () => number, planetRadius: number): MoonSpec[] {
	const roll = rnd();
	const max = planetRadius >= 12 ? 3 : planetRadius >= 8 ? 2 : 1;
	let count = roll < 0.5 ? 0 : roll < 0.8 ? 1 : roll < 0.94 ? 2 : 3;
	count = Math.min(count, max);
	const moons: MoonSpec[] = [];
	for (let i = 0; i < count; i++) {
		const [r, g, b] = jitter(rnd, pick(rnd, MOON_COLORS), 12);
		moons.push({
			orbitR: planetRadius + range(rnd, 3, planetRadius * 1.3 + 4) + i * 2,
			squash: range(rnd, 0.22, 0.55),
			tilt: range(rnd, -0.7, 0.7),
			speed: (rnd() < 0.5 ? -1 : 1) * range(rnd, 0.0008, 0.0032),
			phase: rnd() * Math.PI * 2,
			size: Math.max(1, Math.round(range(rnd, 1, Math.min(3, planetRadius * 0.28)))),
			r,
			g,
			b
		});
	}
	return moons;
}

function seedFor(seed: number, index: number, salt = 0): number {
	let h = (seed ^ Math.imul(index + 1, 0x9e3779b9) ^ salt) >>> 0;
	h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
	h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
	return (h ^ (h >>> 16)) >>> 0;
}

function edgePoint(
	rnd: () => number,
	edge: PlanetSpec['entryEdge'],
	w: number,
	h: number,
	pad: number,
	exit = false
): { x: number; y: number } {
	switch (edge) {
		case 'left':
			return {
				x: exit ? w + pad : -pad,
				y: exit ? range(rnd, -pad, h * 0.58) : range(rnd, h * 0.36, h + pad)
			};
		case 'right':
			return {
				x: exit ? -pad : w + pad,
				y: exit ? range(rnd, -pad, h * 0.58) : range(rnd, h * 0.36, h + pad)
			};
		case 'top':
			return {
				x: exit ? range(rnd, -pad, w + pad) : range(rnd, 0, w),
				y: exit ? h + pad : -pad
			};
		default:
			return {
				x: range(rnd, -pad, w + pad),
				y: exit ? -pad : h + pad
			};
	}
}

function makePlanetPassBody(
	rnd: () => number,
	w: number,
	h: number,
	passIndex: number
): PlanetSpec {
	const type = weightedType(rnd);
	const depth = range(rnd, 0.72, 1.36);
	const isGas = type === 'gas';
	const radius = Math.round(
		(isGas ? range(rnd, 14, 28) : range(rnd, 5, 16) * (rnd() < 0.15 ? 0.65 : 1)) *
			(0.82 + depth * 0.28)
	);
	const [baseRGB, accentRGB, detailRGB] = pick(rnd, PLANET_PALETTES[type]);
	const [r, g, b] = jitter(rnd, baseRGB, 16);
	const [r2, g2, b2] = jitter(rnd, accentRGB, 16);
	const [r3, g3, b3] = jitter(rnd, detailRGB, 16);
	const [ringR, ringG, ringB] = jitter(rnd, pick(rnd, RING_COLORS), 12);
	const edgeRoll = rnd();
	const entryEdge: PlanetSpec['entryEdge'] =
		edgeRoll < 0.52 ? 'bottom' : edgeRoll < 0.72 ? 'left' : edgeRoll < 0.92 ? 'right' : 'top';
	const pad = Math.max(radius * 3.2, 28);
	const from = edgePoint(rnd, entryEdge, w, h, pad);
	const to = edgePoint(rnd, entryEdge, w, h, pad, true);
	const diagonal = Math.hypot(to.x - from.x, to.y - from.y);
	const span = Math.max(h * 1.15, diagonal * range(rnd, 1.5, 2.8) * (1.25 - depth * 0.22));
	const sideways = entryEdge === 'bottom' || entryEdge === 'top';
	const curve = range(rnd, h * 0.08, h * 0.38) * (rnd() < 0.5 ? -1 : 1);

	return {
		passIndex,
		start: 0,
		span,
		entryEdge,
		fromX: from.x,
		fromY: from.y,
		toX: to.x,
		toY: to.y,
		curveX: sideways ? curve : range(rnd, -w * 0.08, w * 0.08),
		curveY: sideways ? range(rnd, -h * 0.08, h * 0.08) : curve,
		wobble: range(rnd, 2, 10) * depth,
		wobblePhase: rnd() * Math.PI * 2,
		depth,
		scale: range(rnd, 0.88, 1.18),
		type,
		radius: Math.max(4, radius),
		r,
		g,
		b,
		r2,
		g2,
		b2,
		r3,
		g3,
		b3,
		params: makeParams(type, rnd),
		storm: isGas && rnd() < 0.65,
		lightAngle: rnd() * Math.PI * 2,
		ring: isGas ? rnd() < 0.6 : rnd() < 0.2,
		ringR,
		ringG,
		ringB,
		ringSquash: range(rnd, 0.3, 0.52),
		moons: makeMoons(rnd, Math.max(4, radius)),
		seed: Math.floor(rnd() * 0x7fffffff)
	};
}

export function createPlanetPass(
	lw: number,
	lh: number,
	seed: number,
	index: number,
	cursor: number
): { planet: PlanetSpec; nextCursor: number } {
	const w = Math.max(1, Math.floor(lw));
	const h = Math.max(1, Math.floor(lh));
	const rnd = mulberry32(seedFor(seed, index, 0x706c616e));
	const first = index === 0;
	const cluster = !first && rnd() < 0.18;
	const gap = first
		? range(rnd, -h * 0.65, h * 0.75)
		: cluster
			? range(rnd, h * 0.18, h * 0.56)
			: range(rnd, h * 0.78, h * 2.8);
	const start = cursor + gap;
	const planet = makePlanetPassBody(rnd, w, h, index);
	planet.start = start;
	return { planet, nextCursor: start };
}

export function generatePlanetPasses(
	lw: number,
	lh: number,
	seed: number,
	count: number,
	cursor = -Math.max(1, Math.floor(lh)) * 0.58,
	startIndex = 0
): PlanetSpec[] {
	const passes: PlanetSpec[] = [];
	let nextCursor = cursor;
	for (let i = 0; i < count; i++) {
		const next = createPlanetPass(lw, lh, seed, startIndex + i, nextCursor);
		passes.push(next.planet);
		nextCursor = next.nextCursor;
	}
	return passes;
}

export function planetPassPosition(spec: PlanetSpec, offset: number): PlanetPassPosition {
	const progress = (offset - spec.start) / spec.span;
	const t = clamp(progress, 0, 1);
	const arch = Math.sin(t * Math.PI);
	const wobble = Math.sin(t * Math.PI * 2 + spec.wobblePhase) * spec.wobble * arch;
	return {
		progress,
		visible: progress >= 0 && progress <= 1,
		x: rangeValue(spec.fromX, spec.toX, t) + spec.curveX * arch + wobble,
		y: rangeValue(spec.fromY, spec.toY, t) + spec.curveY * arch - wobble * 0.35
	};
}

function rangeValue(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

export interface GenerateOptions {
	starDensity?: number;
}

/**
 * Lay out the whole universe for a `lw × lh` low-res canvas, deterministically from `seed`.
 * The deep field is static scene data. Planets are the initial chunk of a deterministic
 * foreground pass stream; the renderer can extend that stream as the page keeps moving.
 */
export function generateScene(
	lw: number,
	lh: number,
	seed: number,
	options: GenerateOptions = {}
): GalaxyScene {
	const w = Math.max(1, Math.floor(lw));
	const h = Math.max(1, Math.floor(lh));
	const rnd = mulberry32(seed);
	const area = w * h;
	const starDensity = options.starDensity ?? 0.011;

	// --- stars (gentle distant band + a few CLOSER, distorted ones) ---
	const stars: StarSpec[] = [];
	const starCount = clamp(Math.round(area * starDensity), 80, 4200);
	for (let i = 0; i < starCount; i++) {
		const depth = rnd();
		const dust = rnd() < 0.4;
		const near = !dust && rnd() < 0.06; // sits closer → diffraction/distortion pattern
		const [cr, cg, cb] = jitter(rnd, pick(rnd, STAR_COLORS), 10);
		const bright = rnd();
		const baseA = dust
			? range(rnd, 0.05, 0.18)
			: near
				? clamp(0.72 + bright * 0.28, 0, 1)
				: clamp(0.22 + depth * 0.5 + bright * 0.3, 0, 1);
		const shape: StarSpec['shape'] = near
			? 'spike'
			: !dust && depth > 0.82 && bright > 0.94
				? 'plus'
				: 'dot';
		stars.push({
			x: Math.floor(rnd() * w),
			worldH: Math.round(h * range(rnd, 1.6, 3.2)),
			y: 0,
			parallax: near ? 0.72 + depth * 0.23 : 0.5 + depth * 0.2,
			near,
			size: near || (!dust && depth > 0.7 && bright > 0.8) ? 2 : 1,
			shape,
			spikeLen: near ? Math.round(range(rnd, 3, 6)) : 0,
			glow: near || (!dust && depth > 0.85 && rnd() < 0.12),
			r: cr,
			g: cg,
			b: cb,
			baseA,
			twinkle: !dust && rnd() < 0.55 ? range(rnd, 0.3, 0.9) : 0,
			twFreq: range(rnd, 0.001, 0.005),
			twPhase: rnd() * Math.PI * 2
		});
		stars[i].y = Math.floor(rnd() * stars[i].worldH);
	}

	// --- planets (foreground event stream; one-time passes, not wrapping tiles) ---
	const planets = generatePlanetPasses(w, h, seed, 12);

	// --- asteroids (occasional singles + the odd loose belt; mid-near band) ---
	const asteroids: AsteroidSpec[] = [];
	const pushAsteroid = (cx: number, cy: number, worldH: number, parallax: number) => {
		const [r, g, b] = jitter(rnd, [128, 120, 112], 22);
		const size = Math.max(2, Math.round(range(rnd, 2, 8)));
		const craterCount = Math.round(range(rnd, size > 5 ? 2 : 1, size > 5 ? 5 : 3));
		asteroids.push({
			x: Math.floor(((cx % w) + w) % w),
			y: Math.floor(((cy % worldH) + worldH) % worldH),
			worldH,
			parallax,
			size,
			stretchX: range(rnd, 0.82, 1.34),
			stretchY: range(rnd, 0.72, 1.16),
			rotation: rnd() * Math.PI * 2,
			facets: Math.round(range(rnd, 7, 13)),
			craters: Array.from({ length: craterCount }, () => ({
				x: range(rnd, -0.45, 0.45),
				y: range(rnd, -0.45, 0.45),
				r: range(rnd, 0.12, 0.28)
			})),
			r,
			g,
			b,
			seed: Math.floor(rnd() * 0x7fffffff)
		});
	};
	const singleSlots = clamp(Math.round(area / 100000), 1, 4);
	for (let i = 0; i < singleSlots; i++) {
		if (rnd() > 0.4) continue;
		const worldH = Math.round(h * range(rnd, 1.4, 2.4));
		pushAsteroid(rnd() * w, rnd() * worldH, worldH, 0.74 + rnd() * 0.16);
	}
	if (rnd() < 0.4) {
		const worldH = Math.round(h * range(rnd, 1.4, 2.2));
		const parallax = 0.76 + rnd() * 0.14;
		const cx = rnd() * w;
		const cy = rnd() * worldH;
		const spreadX = range(rnd, w * 0.12, w * 0.3);
		const spreadY = range(rnd, h * 0.08, h * 0.22);
		const n = Math.round(range(rnd, 4, 9));
		for (let i = 0; i < n; i++) {
			pushAsteroid(cx + (rnd() - 0.5) * spreadX, cy + (rnd() - 0.5) * spreadY, worldH, parallax);
		}
	}

	// --- galaxies (farthest band 0.38–0.46; varied inclination/arms) ---
	const galaxies: GalaxySpec[] = [];
	const galaxyCount = clamp(Math.round(area / 130000), 1, 3);
	for (let i = 0; i < galaxyCount; i++) {
		const depth = rnd();
		const radius = Math.round(range(rnd, 14, 36));
		const [[aR, aG, aB], [bR, bG, bB]] = pick(rnd, GALAXY_TINTS);
		const armRoll = rnd();
		galaxies.push({
			x: Math.floor(rnd() * w),
			worldH: Math.round(h * range(rnd, 1.5, 2.6)),
			y: 0,
			parallax: 0.38 + depth * 0.08,
			radius,
			arms: armRoll < 0.45 ? 2 : armRoll < 0.8 ? 3 : 4,
			spin: range(rnd, 0.5, 1.1),
			rotation: rnd() * Math.PI * 2,
			squash: range(rnd, 0.42, 1),
			incline: rnd() * Math.PI,
			aR,
			aG,
			aB,
			bR,
			bG,
			bB,
			seed: Math.floor(rnd() * 0x7fffffff)
		});
		galaxies[i].y = Math.floor(rnd() * galaxies[i].worldH);
	}

	// --- nebulas (very far band 0.42–0.52; varied colour + filament stretch) ---
	const nebulas: NebulaSpec[] = [];
	const nebulaCount = clamp(Math.round(area / 90000), 1, 4);
	for (let i = 0; i < nebulaCount; i++) {
		const depth = rnd();
		const radius = Math.round(range(rnd, 20, 52));
		const [[aR, aG, aB], [bR, bG, bB]] = pick(rnd, NEBULA_PAIRS);
		nebulas.push({
			x: Math.floor(rnd() * w),
			worldH: Math.round(h * range(rnd, 1.5, 2.5)),
			y: 0,
			parallax: 0.42 + depth * 0.1,
			radius,
			stretch: range(rnd, 1, 2.1),
			angle: rnd() * Math.PI,
			aR,
			aG,
			aB,
			bR,
			bG,
			bB,
			seed: Math.floor(rnd() * 0x7fffffff)
		});
		nebulas[i].y = Math.floor(rnd() * nebulas[i].worldH);
	}

	return { lw: w, lh: h, seed, stars, planets, asteroids, galaxies, nebulas };
}
