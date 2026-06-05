// Lazy-loaded Canvas2D fog/cloud background — soft radial colour clouds painted with the
// theme's palette. Each cloud is an independent "control point": it drifts on its own slow
// phase and (optionally) shifts on scroll by its own small vector, so the field breathes and
// deforms rather than translating as a rigid unit. The student controls where the clouds pool
// (edges/centre/scattered), how many there are, how much they move, and how strong the colour
// reads. Pure draw; the runtime owns the loop, FPS cap, resize, reduced-motion still-frame
// and teardown.
//
// (A WebGL shader harness — ./../../webgl.ts — is kept in the tree for future, heavier
// presets; this calm effect doesn't need the GPU.)
import type { BackgroundInput, BackgroundInstance } from '../../contract';
import type { OrganicGradientParams } from './schema';

type RGB = [number, number, number];

// Peak per-cloud alpha — ranges from a whisper to a clearly-present tint.
const OPACITY = { faint: 0.07, soft: 0.15, bold: 0.28, vivid: 0.45 } as const;
// Number of cloud control points.
const COUNT = { few: 3, some: 5, many: 8 } as const;
// [ambient-drift amplitude multiplier, scroll-shift multiplier] per movement mode.
const MOTION = {
	still: [0, 0],
	gentle: [1, 0],
	flowing: [2.2, 0],
	scroll: [0.8, 1]
} as const;

const DEFAULT_COLORS: RGB[] = [
	[120, 150, 200],
	[200, 175, 150],
	[150, 185, 170]
];

/** Resolve which theme swatches participate → up to 8 RGB stops (defaults if none). */
export function selectColors(palette: RGB[], indices: number[]): RGB[] {
	let chosen: RGB[];
	if (palette.length === 0) {
		chosen = DEFAULT_COLORS;
	} else if (indices.length > 0) {
		chosen = indices.map((i) => palette[i]).filter((c): c is RGB => Array.isArray(c));
		if (chosen.length === 0) chosen = palette;
	} else {
		chosen = palette;
	}
	return chosen.slice(0, 8);
}

interface Cloud {
	color: RGB;
	bx: number; // base position, normalized 0..1
	by: number;
	phase: number;
	freqX: number; // very slow ambient oscillation
	freqY: number;
	ampX: number; // small drift amplitude (fraction of viewport)
	ampY: number;
	scrollDX: number; // this cloud's own scroll-shift vector (independent of the others)
	scrollDY: number;
	radius: number; // fraction of the short edge — large & soft
}

// A tiny PRNG. Seeded ONCE per mount (below), so the cloud layout is stable within a session
// (no reseed flicker on resize) but differs every time the preview / live zine reloads.
function mulberry32(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// A fresh seed on each mount (every page load) so the clouds re-randomise on reload — the
// background feels alive and different each visit, not a fixed picture.
function freshSeed(): number {
	return (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
}

// Bias a cloud's base position by where the student wants the clouds to pool.
function placeCloud(
	placement: OrganicGradientParams['placement'],
	rnd: () => number
): { bx: number; by: number } {
	if (placement === 'center') {
		return { bx: 0.5 + (rnd() - 0.5) * 0.45, by: 0.5 + (rnd() - 0.5) * 0.45 };
	}
	if (placement === 'edges') {
		// Pull toward whichever edge is nearer on each axis (a soft framing/vignette).
		const edge = (r: number) => (r < 0.5 ? rnd() * 0.22 : 1 - rnd() * 0.22);
		return { bx: edge(rnd()), by: edge(rnd()) };
	}
	return { bx: 0.12 + rnd() * 0.76, by: 0.12 + rnd() * 0.76 }; // scattered
}

function seedClouds(
	colors: RGB[],
	placement: OrganicGradientParams['placement'],
	count: number,
	seed: number
): Cloud[] {
	const rnd = mulberry32(seed);
	const clouds: Cloud[] = [];
	for (let i = 0; i < count; i++) {
		const { bx, by } = placeCloud(placement, rnd);
		clouds.push({
			color: colors[i % colors.length],
			bx,
			by,
			phase: rnd() * Math.PI * 2,
			freqX: 0.025 + rnd() * 0.035,
			freqY: 0.025 + rnd() * 0.035,
			ampX: 0.035 + rnd() * 0.05,
			ampY: 0.035 + rnd() * 0.05,
			scrollDX: (rnd() - 0.5) * 0.22,
			scrollDY: (rnd() - 0.5) * 0.22,
			radius: 0.55 + rnd() * 0.35
		});
	}
	return clouds;
}

export function mount(
	canvas: HTMLCanvasElement,
	params: OrganicGradientParams
): BackgroundInstance {
	const ctx = canvas.getContext('2d');
	const alpha = OPACITY[params.opacity];
	const [driftMul, scrollMul] = MOTION[params.motion];
	const count = COUNT[params.count];
	// One random seed per mount → a different cloud arrangement on every reload (but stable
	// across resizes and live colour edits within this session).
	const seed = freshSeed();

	let clouds: Cloud[] = [];
	let colorsKey = '';

	function ensureClouds(palette: RGB[]): void {
		const colors = selectColors(palette, params.colors);
		const key = colors.map((c) => c.join(',')).join('|');
		if (key !== colorsKey) {
			clouds = seedClouds(colors, params.placement, count, seed);
			colorsKey = key;
		}
	}

	return {
		// Positions are normalized, so a resize needs no reseed — the next frame rescales.
		resize() {},
		frame(input: BackgroundInput) {
			if (!ctx) return;
			ensureClouds(input.palette as RGB[]);
			const w = input.width;
			const h = input.height;
			const minDim = Math.min(w, h);
			const t = input.time / 1000;
			const p = input.progress;
			// Fewer clouds on low-power screens (each is a full-canvas fill).
			const n = input.lowPower ? Math.min(clouds.length, 3) : clouds.length;

			ctx.clearRect(0, 0, w, h);
			for (let i = 0; i < n; i++) {
				const c = clouds[i];
				const x =
					(c.bx +
						Math.sin(t * c.freqX + c.phase) * c.ampX * driftMul +
						p * c.scrollDX * scrollMul) *
					w;
				const y =
					(c.by +
						Math.cos(t * c.freqY + c.phase) * c.ampY * driftMul +
						p * c.scrollDY * scrollMul) *
					h;
				const r = c.radius * minDim;
				const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
				const [cr, cg, cb] = c.color;
				grad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${alpha})`);
				grad.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
				ctx.fillStyle = grad;
				ctx.fillRect(0, 0, w, h);
			}
		},
		destroy() {
			ctx?.clearRect(0, 0, canvas.width, canvas.height);
		}
	};
}
