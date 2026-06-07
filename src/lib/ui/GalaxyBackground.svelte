<script lang="ts">
	// A slowly-scrolling, generative pixel-art universe for the homepage backdrop. It renders into
	// a deliberately LOW-RES canvas that CSS upscales with `image-rendering: pixelated`, so every
	// star/planet is a crisp chunky pixel. The scene (see ./galaxy.ts) is seeded from the clock, so
	// the sky is different on every reload.
	//
	// Depth is CONTINUOUS: each object carries its own parallax. Distant things (stars/nebulas/
	// galaxies) sit in a narrow, gentle band; planets are the close foreground — they move faster
	// AND drift sideways, carry tiny orbiting moons, and come in many procedurally-textured types
	// (rocky/water/desert/gas/ice/lava). Each object also wraps over its own world height, so the
	// layers never re-align and the field essentially never repeats.
	//
	// Honors prefers-reduced-motion by painting a single still frame. All canvas/DOM/loop work
	// lives inside the browser-only $effect; SSR emits just the <canvas>.
	import {
		decayBoost,
		freshSeed,
		generateScene,
		mulberry32,
		type AsteroidSpec,
		type GalaxyScene,
		type GalaxySpec,
		type NebulaSpec,
		type PlanetSpec
	} from './galaxy';
	import { prefersReducedMotion } from '$lib/a11y/reduced-motion';

	let canvas = $state<HTMLCanvasElement | null>(null);

	const PIXEL = 3; // CSS px per low-res px — the chunkiness of the pixel art
	const BASE_SPEED = 4; // ambient upward drift, low-res px/sec
	const WHEEL_GAIN = 0.5; // scroll → boost conversion (low-res px/sec)
	const SCROLL_GAIN = 0.6;
	const TOUCH_GAIN = 0.8;
	const MAX_BOOST = 160;
	const FRAME_MS = 1000 / 30; // ~30fps is plenty and easy on the battery

	type Sprite<T> = { canvas: HTMLCanvasElement; spec: T };

	function mod(n: number, m: number): number {
		return ((n % m) + m) % m;
	}
	function clamp01(n: number): number {
		return n < 0 ? 0 : n > 1 ? 1 : n;
	}
	function clampCh(n: number): number {
		return n < 0 ? 0 : n > 255 ? 255 : n;
	}
	function clamp(n: number, lo: number, hi: number): number {
		return n < lo ? lo : n > hi ? hi : n;
	}
	function lerp(a: number, b: number, t: number): number {
		return a + (b - a) * t;
	}
	type C3 = [number, number, number];
	function mix(a: C3, b: C3, t: number): C3 {
		return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
	}
	function scaleC(a: C3, f: number): C3 {
		return [clampCh(a[0] * f), clampCh(a[1] * f), clampCh(a[2] * f)];
	}

	// --- procedural value-noise (for planet surfaces) ----------------------------------------
	function hash2(ix: number, iy: number, seed: number): number {
		let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
		h = Math.imul(h ^ (h >>> 13), 1274126177);
		return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
	}
	function vnoise(x: number, y: number, seed: number): number {
		const x0 = Math.floor(x);
		const y0 = Math.floor(y);
		const fx = x - x0;
		const fy = y - y0;
		const sx = fx * fx * (3 - 2 * fx);
		const sy = fy * fy * (3 - 2 * fy);
		const n00 = hash2(x0, y0, seed);
		const n10 = hash2(x0 + 1, y0, seed);
		const n01 = hash2(x0, y0 + 1, seed);
		const n11 = hash2(x0 + 1, y0 + 1, seed);
		return (n00 * (1 - sx) + n10 * sx) * (1 - sy) + (n01 * (1 - sx) + n11 * sx) * sy;
	}
	function fbm(x: number, y: number, seed: number): number {
		return (
			0.6 * vnoise(x, y, seed) +
			0.3 * vnoise(x * 2.1 + 5.2, y * 2.1 + 1.3, seed ^ 0x9e37) +
			0.1 * vnoise(x * 4.3, y * 4.3, seed ^ 0x1b54)
		);
	}

	function makeBuffer(
		w: number,
		h: number
	): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
		const c = document.createElement('canvas');
		c.width = Math.max(1, w);
		c.height = Math.max(1, h);
		const ctx = c.getContext('2d')!;
		ctx.imageSmoothingEnabled = false;
		return { canvas: c, ctx };
	}

	// --- planet surface: albedo (+emissive) per type at a sphere-mapped point -----------------
	// Reads the instance's PlanetParams (feature scale, domain warp, contrast, band/coverage/cap
	// knobs) so two planets of the same prototype render as different worlds.
	function planetSurface(
		spec: PlanetSpec,
		nx: number,
		ny: number,
		craters: { cx: number; cy: number; r: number }[]
	): { col: C3; emis: number } {
		const base: C3 = [spec.r, spec.g, spec.b];
		const acc: C3 = [spec.r2, spec.g2, spec.b2];
		const detail: C3 = [spec.r3, spec.g3, spec.b3];
		const s = spec.seed;
		const p = spec.params;
		const ns = p.noiseScale;
		// Domain warp — swirl the sampling coordinates so features marble/curl realistically.
		let wx = nx;
		let wy = ny;
		if (p.warp > 0) {
			wx = nx + (fbm(nx * ns * 0.6 + 11, ny * ns * 0.6 + 3, s) - 0.5) * p.warp;
			wy = ny + (fbm(nx * ns * 0.6 + 5, ny * ns * 0.6 + 9, s ^ 0x1234) - 0.5) * p.warp;
		}
		switch (spec.type) {
			case 'gas': {
				const turb = (fbm(wx * 1.6 + 3, wy * ns, s) - 0.5) * 2 * p.contrast;
				const band = 0.5 + 0.5 * Math.sin(wy * Math.PI * p.bandCount * 0.5 + turb * 2.4);
				const t = Math.round(band * 4) / 4;
				let col = mix(scaleC(base, 0.74), scaleC(base, 1.18), t);
				if (fbm(wx * 2.3 + 9, wy * ns * 1.3, s ^ 0x77) > 0.72) col = mix(col, acc, 0.6);
				if (fbm(wx * 3.1 + 1, wy * ns * 1.7, s ^ 0x3b) > 0.82) col = mix(col, detail, 0.4);
				if (spec.storm) {
					const dx = nx - 0.26;
					const dy = ny + 0.16;
					if ((dx * dx) / 0.11 + (dy * dy) / 0.045 < 1) col = mix(acc, detail, 0.4);
				}
				return { col, emis: 0 };
			}
			case 'water': {
				if (Math.abs(ny) > p.capSize) return { col: detail, emis: 0 }; // polar ice
				const land = fbm(wx * ns + 1, wy * ns + 4, s);
				if (land > p.coverage) {
					const shade2 = fbm(wx * ns * 1.8 + 2, wy * ns * 1.8 + 7, s ^ 0x5a);
					return { col: mix(acc, scaleC(acc, 0.66), shade2), emis: 0 }; // continents
				}
				const deep = clamp01((p.coverage - land) * 2.2);
				let col = mix(base, scaleC(base, 0.68), deep);
				if (fbm(wx * 3 + 8, wy * 3 + 2, s ^ 0x33) > 1 - p.featureA) col = mix(col, detail, 0.55); // clouds
				return { col, emis: 0 };
			}
			case 'desert': {
				const streak = fbm(wx * 2.2, wy * (p.bandCount * 0.9 + 1), s);
				let col = mix(scaleC(base, 0.82), scaleC(base, 1.14), Math.round(streak * 3) / 3);
				if (Math.abs(ny) > p.capSize) col = mix(col, detail, 0.5);
				if (fbm(wx * 3.4 + 6, wy * 3.4 + 1, s ^ 0x2c) < p.coverage) col = mix(col, acc, 0.55); // canyons
				return { col, emis: 0 };
			}
			case 'ice': {
				const ridged = Math.abs(fbm(wx * (ns + 0.4), wy * (ns + 0.4), s) - 0.5) * 2;
				let col = mix(base, scaleC(base, 0.88 + 0.22 * p.contrast), fbm(wx * 2, wy * 2, s ^ 0x12));
				if (ridged < p.coverage) col = mix(base, acc, 0.7); // cracks
				if (Math.abs(ny) > p.capSize) col = mix(col, detail, 0.6);
				return { col, emis: 0 };
			}
			case 'lava': {
				const ridged = Math.abs(fbm(wx * ns + 2, wy * ns, s) - 0.5) * 2;
				if (ridged < p.coverage) {
					const heat = clamp01((p.coverage - ridged) / Math.max(0.0001, p.coverage));
					return { col: mix(acc, detail, heat), emis: 0.55 + 0.45 * p.contrast * heat };
				}
				return { col: mix(base, scaleC(base, 1.3), fbm(wx * (ns + 1), wy * (ns + 1), s)), emis: 0 };
			}
			default: {
				// rocky: mottled base + maria (dark plains) + craters
				let col = mix(scaleC(base, 0.85), scaleC(base, 1.14), fbm(wx * ns, wy * ns, s));
				if (p.featureA > 0.01 && fbm(nx * 1.2 + 7, ny * 1.2 + 2, s ^ 0x9d) < p.featureA * 0.5) {
					col = mix(scaleC(col, 0.62), acc, 0.3); // maria
				}
				for (const cr of craters) {
					const dd = Math.hypot(nx - cr.cx, ny - cr.cy);
					if (dd < cr.r) col = scaleC(col, 0.72);
					else if (dd < cr.r * 1.3) col = scaleC(col, 1.18);
				}
				return { col, emis: 0 };
			}
		}
	}

	function bakePlanet(spec: PlanetSpec): HTMLCanvasElement {
		const R = spec.radius;
		const ringInner = R * 1.35;
		const ringOuter = R * 2.15;
		const ringSquash = spec.ringSquash;
		const halfW = Math.ceil(spec.ring ? ringOuter : R) + 2;
		const halfH = Math.ceil(spec.ring ? Math.max(R, ringOuter * ringSquash) : R) + 2;
		const { canvas: c, ctx } = makeBuffer(halfW * 2, halfH * 2);
		const cx = halfW;
		const cy = halfH;
		const lx = Math.cos(spec.lightAngle);
		const ly = Math.sin(spec.lightAngle);
		const lz = 0.65;

		const rndC = mulberry32(spec.seed ^ 0xc7a7e);
		const craters =
			spec.type === 'rocky'
				? Array.from({ length: Math.round(3 + spec.params.coverage * 9) }, () => ({
						cx: (rndC() - 0.5) * 1.6,
						cy: (rndC() - 0.5) * 1.6,
						r: 0.1 + rndC() * 0.22
					}))
				: [];

		// A banded ring (concentric ellipses with gaps + slight colour drift) → clearly visible.
		const ringBase: C3 = [spec.ringR, spec.ringG, spec.ringB];
		const rndR = mulberry32(spec.seed ^ 0x71a6);
		const ringBandCount = 6 + Math.floor(rndR() * 5);
		const ringBands = Array.from({ length: ringBandCount }, (_, bi) => {
			const t = ringBandCount === 1 ? 0 : bi / (ringBandCount - 1);
			return {
				rr: lerp(ringInner, ringOuter, t),
				gap: rndR() < 0.2,
				a: 0.45 + rndR() * 0.45,
				col: mix(ringBase, scaleC(ringBase, 0.7 + rndR() * 0.5), rndR())
			};
		});
		const ringPass = (front: boolean) => {
			if (!spec.ring) return;
			for (const band of ringBands) {
				if (band.gap) continue;
				ctx.fillStyle = `rgba(${band.col[0] | 0},${band.col[1] | 0},${band.col[2] | 0},${band.a.toFixed(3)})`;
				const step = 0.6 / band.rr;
				for (let a = 0; a < Math.PI * 2; a += step) {
					if (Math.sin(a) > 0 !== front) continue;
					ctx.fillRect(
						Math.floor(cx + Math.cos(a) * band.rr),
						Math.floor(cy + Math.sin(a) * band.rr * ringSquash),
						1,
						1
					);
				}
			}
		};

		ringPass(false); // ring behind the planet
		const atmospheric = spec.type === 'water' || spec.type === 'ice' || spec.type === 'gas';
		for (let py = -R; py <= R; py++) {
			for (let px = -R; px <= R; px++) {
				const dist = Math.hypot(px, py);
				if (dist > R) continue;
				const nx = px / R;
				const ny = py / R;
				const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
				const { col, emis } = planetSurface(spec, nx, ny, craters);
				const lambert = Math.max(0, nx * lx + ny * ly + nz * lz);
				const shade = clamp01(0.22 + 0.85 * (Math.round(lambert * 5) / 5));
				let r = col[0] * shade;
				let g = col[1] * shade;
				let b = col[2] * shade;
				if (emis > 0) {
					// self-lit (lava cracks) — keep glowing on the dark side
					r = Math.max(r, col[0] * emis);
					g = Math.max(g, col[1] * emis);
					b = Math.max(b, col[2] * emis);
				}
				if (lambert > 0.95 && (spec.type === 'water' || spec.type === 'ice')) {
					r = (r + 255) / 2;
					g = (g + 255) / 2;
					b = (b + 255) / 2;
				}
				if (atmospheric && dist > R - 1.4 && lambert > 0.12) {
					r = lerp(r, 255, 0.22);
					g = lerp(g, 255, 0.22);
					b = lerp(b, 255, 0.22);
				}
				ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
				ctx.fillRect(cx + px, cy + py, 1, 1);
			}
		}
		ringPass(true); // ring crossing in front
		return c;
	}

	function bakeAsteroid(spec: AsteroidSpec): HTMLCanvasElement {
		const R = spec.size;
		const { canvas: c, ctx } = makeBuffer(R * 2 + 2, R * 2 + 2);
		const cx = R + 1;
		const cy = R + 1;
		const seed = spec.seed;
		const lx = Math.cos(seed);
		const ly = Math.sin(seed);
		for (let py = -R; py <= R; py++) {
			for (let px = -R; px <= R; px++) {
				// Irregular outline: warp the radius with noise so it isn't a clean disc.
				const ang = Math.atan2(py, px);
				const edge =
					R * (0.62 + 0.38 * fbm(Math.cos(ang) * 1.5 + 3, Math.sin(ang) * 1.5 + 3, seed));
				if (Math.hypot(px, py) > edge) continue;
				const lit = (px * lx + py * ly) / R;
				const f = clamp01(0.5 + 0.5 * lit) * (0.7 + 0.3 * fbm(px * 0.6, py * 0.6, seed ^ 0x9b));
				ctx.fillStyle = `rgb(${(spec.r * (0.45 + f)) | 0},${(spec.g * (0.45 + f)) | 0},${(spec.b * (0.45 + f)) | 0})`;
				ctx.fillRect(cx + px, cy + py, 1, 1);
			}
		}
		return c;
	}

	function bakeGalaxy(spec: GalaxySpec): HTMLCanvasElement {
		const R = spec.radius;
		const size = R * 2 + 4;
		const { canvas: c, ctx } = makeBuffer(size, size);
		const cx = size / 2;
		const cy = size / 2;
		const rnd = mulberry32(spec.seed);
		const ci = Math.cos(spec.incline);
		const si = Math.sin(spec.incline);
		ctx.globalCompositeOperation = 'lighter';

		const steps = Math.floor(R * 4);
		for (let arm = 0; arm < spec.arms; arm++) {
			const base = spec.rotation + (arm * Math.PI * 2) / spec.arms;
			for (let i = 0; i < steps; i++) {
				const frac = i / steps;
				const rad = frac * R + (rnd() - 0.5) * R * 0.08;
				const ang = base + frac * spec.spin * Math.PI * 4 + (rnd() - 0.5) * 0.3;
				// inclined, squashed disk
				const lxp = Math.cos(ang) * rad;
				const lyp = Math.sin(ang) * rad * spec.squash;
				const x = cx + lxp * ci - lyp * si;
				const y = cy + lxp * si + lyp * ci;
				const bright = (1 - frac) * (0.55 + 0.45 * rnd());
				const r = lerp(spec.aR, spec.bR, frac);
				const g = lerp(spec.aG, spec.bG, frac);
				const b = lerp(spec.aB, spec.bB, frac);
				ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${bright.toFixed(3)})`;
				ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
			}
		}
		const dust = Math.floor(R * 3);
		for (let i = 0; i < dust; i++) {
			const ang = rnd() * Math.PI * 2;
			const rad = Math.sqrt(rnd()) * R;
			const lxp = Math.cos(ang) * rad;
			const lyp = Math.sin(ang) * rad * spec.squash;
			ctx.fillStyle = `rgba(${spec.bR},${spec.bG},${spec.bB},0.16)`;
			ctx.fillRect(
				Math.floor(cx + lxp * ci - lyp * si),
				Math.floor(cy + lxp * si + lyp * ci),
				1,
				1
			);
		}
		const coreR = Math.max(2, R * 0.2);
		for (let py = -coreR; py <= coreR; py++) {
			for (let px = -coreR; px <= coreR; px++) {
				const d = Math.hypot(px, py);
				if (d > coreR) continue;
				const a = Math.pow(1 - d / coreR, 2) * 0.9;
				ctx.fillStyle = `rgba(255,246,226,${a.toFixed(3)})`;
				ctx.fillRect(Math.floor(cx + px), Math.floor(cy + py), 1, 1);
			}
		}
		return c;
	}

	function bakeNebula(spec: NebulaSpec): HTMLCanvasElement {
		const R = spec.radius;
		const majorR = R * spec.stretch;
		// The buffer must contain the whole stretched/rotated fade ellipse (semi-major = R*stretch
		// in any orientation), or the glow gets sliced off with a straight edge where the canvas
		// ends. Size to the major axis + margin so it always fades to nothing inside the sprite.
		const ext = Math.ceil(majorR) + 3;
		const size = ext * 2;
		const { canvas: c, ctx } = makeBuffer(size, size);
		const cx = ext;
		const cy = ext;
		const rnd = mulberry32(spec.seed);
		const ca = Math.cos(-spec.angle);
		const sa = Math.sin(-spec.angle);
		const cf = Math.cos(spec.angle);
		const sf = Math.sin(spec.angle);
		const lobeCount = 3 + Math.floor(rnd() * 5);
		// Place lobes INSIDE the stretched/rotated ellipse so the cloud aligns with the filament
		// direction and every lobe sits well within the fade (no lobe pinned to an edge).
		const lobes = Array.from({ length: lobeCount }, () => {
			const mx = (rnd() - 0.5) * 1.2 * majorR;
			const my = (rnd() - 0.5) * 1.2 * R;
			return {
				lx: cx + mx * cf - my * sf,
				ly: cy + mx * sf + my * cf,
				s: 0.5 + rnd() * 0.9,
				sig: R * (0.26 + rnd() * 0.4)
			};
		});
		const CELL = 2;
		for (let gy = 0; gy < size; gy += CELL) {
			for (let gx = 0; gx < size; gx += CELL) {
				const px = gx + CELL / 2;
				const py = gy + CELL / 2;
				// stretched, rotated radial falloff → filament shapes, squared for a soft outer fade.
				const rx = (px - cx) * ca - (py - cy) * sa;
				const ry = (px - cx) * sa + (py - cy) * ca;
				let fall = 1 - Math.hypot(rx / majorR, ry / R);
				if (fall <= 0) continue;
				fall *= fall;
				let v = 0;
				for (const lobe of lobes) {
					const dx = px - lobe.lx;
					const dy = py - lobe.ly;
					v += lobe.s * Math.exp(-(dx * dx + dy * dy) / (2 * lobe.sig * lobe.sig));
				}
				v *= fall;
				if (v <= 0.02) continue;
				const m = Math.min(1, v);
				const r = lerp(spec.aR, spec.bR, m);
				const g = lerp(spec.aG, spec.bG, m);
				const b = lerp(spec.aB, spec.bB, m);
				ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${Math.min(0.5, v * 0.6).toFixed(3)})`;
				ctx.fillRect(gx, gy, CELL, CELL);
			}
		}
		return c;
	}

	$effect(() => {
		const el = canvas;
		if (!el) return;
		const ctx = el.getContext('2d');
		if (!ctx) return;

		const reduced = prefersReducedMotion();
		const seed = freshSeed();

		let lw = 0;
		let lh = 0;
		let scene: GalaxyScene | null = null;
		let planetSprites: Sprite<PlanetSpec>[] = [];
		let asteroidSprites: Sprite<AsteroidSpec>[] = [];
		let galaxySprites: Sprite<GalaxySpec>[] = [];
		let nebulaSprites: Sprite<NebulaSpec>[] = [];

		function setup(): void {
			const w = Math.max(1, Math.ceil(window.innerWidth / PIXEL));
			const h = Math.max(1, Math.ceil(window.innerHeight / PIXEL));
			if (w === lw && h === lh && scene) return;
			lw = w;
			lh = h;
			el!.width = lw;
			el!.height = lh;
			ctx!.imageSmoothingEnabled = false;

			scene = generateScene(lw, lh, seed);
			planetSprites = scene.planets.map((spec) => ({ canvas: bakePlanet(spec), spec }));
			asteroidSprites = scene.asteroids.map((spec) => ({ canvas: bakeAsteroid(spec), spec }));
			galaxySprites = scene.galaxies.map((spec) => ({ canvas: bakeGalaxy(spec), spec }));
			nebulaSprites = scene.nebulas.map((spec) => ({ canvas: bakeNebula(spec), spec }));
		}

		// Blit a sprite that scrolls only vertically, wrapping over its own world height.
		function blitV(
			img: HTMLCanvasElement,
			x: number,
			sy: number,
			worldH: number,
			additive: boolean
		): void {
			const dx = Math.floor(x - img.width / 2);
			if (additive) ctx!.globalCompositeOperation = 'lighter';
			for (const yy of [sy, sy - worldH]) {
				const dy = Math.floor(yy - img.height / 2);
				if (dy > lh || dy + img.height < 0) continue;
				ctx!.drawImage(img, dx, dy);
			}
			if (additive) ctx!.globalCompositeOperation = 'source-over';
		}

		function drawMoonDisk(
			mx: number,
			my: number,
			size: number,
			r: number,
			g: number,
			b: number,
			lx: number,
			ly: number
		): void {
			for (let dy = -size; dy <= size; dy++) {
				for (let dx = -size; dx <= size; dx++) {
					if (dx * dx + dy * dy > size * size) continue;
					const f = (dx * lx + dy * ly) / (size || 1) > 0 ? 1 : 0.55;
					ctx!.fillStyle = `rgb(${(r * f) | 0},${(g * f) | 0},${(b * f) | 0})`;
					ctx!.fillRect(Math.floor(mx + dx), Math.floor(my + dy), 1, 1);
				}
			}
		}

		function drawMoons(
			spec: PlanetSpec,
			px: number,
			py: number,
			timeMs: number,
			front: boolean,
			lx: number,
			ly: number
		): void {
			for (const m of spec.moons) {
				const ang = timeMs * m.speed + m.phase;
				if (Math.sin(ang) > 0 !== front) continue;
				const ox = Math.cos(ang) * m.orbitR;
				const oy = Math.sin(ang) * m.orbitR * m.squash;
				const mx = px + ox * Math.cos(m.tilt) - oy * Math.sin(m.tilt);
				const my = py + ox * Math.sin(m.tilt) + oy * Math.cos(m.tilt);
				drawMoonDisk(mx, my, m.size, m.r, m.g, m.b, lx, ly);
			}
		}

		function drawPlanet(sprite: Sprite<PlanetSpec>, offset: number, timeMs: number): void {
			const { canvas: img, spec } = sprite;
			const hw = img.width / 2;
			const hh = img.height / 2;
			const sx = mod(spec.x - offset * spec.driftX, lw);
			const sy = mod(spec.y - offset * spec.parallaxY, spec.worldH);
			const lx = Math.cos(spec.lightAngle);
			const ly = Math.sin(spec.lightAngle);
			const reach = Math.max(hw, hh) + spec.moons.reduce((mx, m) => Math.max(mx, m.orbitR), 0);
			for (const cxp of [sx, sx - lw, sx + lw]) {
				if (cxp + reach < 0 || cxp - reach > lw) continue;
				for (const cyp of [sy, sy - spec.worldH]) {
					if (cyp + reach < 0 || cyp - reach > lh) continue;
					drawMoons(spec, cxp, cyp, timeMs, false, lx, ly);
					ctx!.drawImage(img, Math.floor(cxp - hw), Math.floor(cyp - hh));
					drawMoons(spec, cxp, cyp, timeMs, true, lx, ly);
				}
			}
		}

		function drawStars(offset: number, timeMs: number): void {
			for (const s of scene!.stars) {
				const wy = mod(s.y - offset * s.parallax, s.worldH);
				if (wy >= lh + 2) continue;
				const flick = s.twinkle
					? 1 - s.twinkle * (0.5 + 0.5 * Math.sin(timeMs * s.twFreq + s.twPhase))
					: 1;
				const a = clamp01(s.baseA * flick);
				if (s.shape === 'spike') {
					// A closer star: soft halo + tapering diffraction spikes (the "distortion pattern").
					ctx!.globalCompositeOperation = 'lighter';
					ctx!.fillStyle = `rgba(${s.r},${s.g},${s.b},${(a * 0.16).toFixed(3)})`;
					ctx!.fillRect(s.x - 1, wy - 1, 4, 4);
					for (let k = 1; k <= s.spikeLen; k++) {
						const fade = a * 0.55 * (1 - k / (s.spikeLen + 1));
						ctx!.fillStyle = `rgba(${s.r},${s.g},${s.b},${fade.toFixed(3)})`;
						ctx!.fillRect(s.x, wy - k, 1, 1);
						ctx!.fillRect(s.x, wy + k, 1, 1);
						ctx!.fillRect(s.x - k, wy, 1, 1);
						ctx!.fillRect(s.x + k, wy, 1, 1);
					}
					ctx!.globalCompositeOperation = 'source-over';
					ctx!.fillStyle = `rgba(${s.r},${s.g},${s.b},${a.toFixed(3)})`;
					ctx!.fillRect(s.x, wy, 2, 2);
					continue;
				}
				if (s.glow) {
					ctx!.globalCompositeOperation = 'lighter';
					ctx!.fillStyle = `rgba(${s.r},${s.g},${s.b},${(a * 0.22).toFixed(3)})`;
					ctx!.fillRect(s.x - 1, wy - 1, 3, 3);
					ctx!.globalCompositeOperation = 'source-over';
				}
				ctx!.fillStyle = `rgba(${s.r},${s.g},${s.b},${a.toFixed(3)})`;
				if (s.shape === 'plus') {
					ctx!.fillRect(s.x, wy, 1, 1);
					ctx!.fillStyle = `rgba(${s.r},${s.g},${s.b},${(a * 0.5).toFixed(3)})`;
					ctx!.fillRect(s.x - 1, wy, 1, 1);
					ctx!.fillRect(s.x + 1, wy, 1, 1);
					ctx!.fillRect(s.x, wy - 1, 1, 1);
					ctx!.fillRect(s.x, wy + 1, 1, 1);
				} else {
					ctx!.fillRect(s.x, wy, s.size, s.size);
				}
			}
		}

		function draw(offset: number, timeMs: number): void {
			const g = ctx!.createLinearGradient(0, 0, 0, lh);
			g.addColorStop(0, '#0b0a1f');
			g.addColorStop(0.5, '#070611');
			g.addColorStop(1, '#120a22');
			ctx!.fillStyle = g;
			ctx!.fillRect(0, 0, lw, lh);

			// Broad galactic haze, barely moving (least parallax of all).
			const hy = mod(lh * 0.35 - offset * 0.22, lh);
			const haze = ctx!.createRadialGradient(lw * 0.5, hy, 0, lw * 0.5, hy, lh * 0.95);
			haze.addColorStop(0, 'rgba(70,58,120,0.22)');
			haze.addColorStop(1, 'rgba(70,58,120,0)');
			ctx!.fillStyle = haze;
			ctx!.fillRect(0, 0, lw, lh);

			// Back to front: nebulas → galaxies → stars → asteroids → planets (+ moons).
			for (const n of nebulaSprites) {
				blitV(
					n.canvas,
					n.spec.x,
					mod(n.spec.y - offset * n.spec.parallax, n.spec.worldH),
					n.spec.worldH,
					true
				);
			}
			for (const gx of galaxySprites) {
				blitV(
					gx.canvas,
					gx.spec.x,
					mod(gx.spec.y - offset * gx.spec.parallax, gx.spec.worldH),
					gx.spec.worldH,
					true
				);
			}
			drawStars(offset, timeMs);
			for (const a of asteroidSprites) {
				blitV(
					a.canvas,
					a.spec.x,
					mod(a.spec.y - offset * a.spec.parallax, a.spec.worldH),
					a.spec.worldH,
					false
				);
			}
			for (const p of planetSprites) drawPlanet(p, offset, timeMs);
		}

		setup();

		if (reduced) {
			draw(0, 0);
			const onResize = () => {
				setup();
				draw(0, 0);
			};
			window.addEventListener('resize', onResize);
			return () => window.removeEventListener('resize', onResize);
		}

		let offset = 0;
		let boost = 0;
		let lastDraw = performance.now();
		let raf = 0;
		let lastScrollY = window.scrollY;
		let lastTouchY: number | null = null;

		const addBoost = (delta: number) => {
			boost = clamp(boost + delta, -MAX_BOOST, MAX_BOOST);
		};
		const onWheel = (e: WheelEvent) => addBoost(e.deltaY * WHEEL_GAIN);
		const onScroll = () => {
			addBoost((window.scrollY - lastScrollY) * SCROLL_GAIN);
			lastScrollY = window.scrollY;
		};
		const onTouchStart = (e: TouchEvent) => {
			lastTouchY = e.touches[0]?.clientY ?? null;
		};
		const onTouchMove = (e: TouchEvent) => {
			const y = e.touches[0]?.clientY ?? null;
			if (y !== null && lastTouchY !== null) addBoost((lastTouchY - y) * TOUCH_GAIN);
			lastTouchY = y;
		};
		const onResize = () => setup();

		const loop = (now: number) => {
			raf = requestAnimationFrame(loop);
			if (now - lastDraw < FRAME_MS) return;
			const dt = Math.min(0.1, (now - lastDraw) / 1000);
			lastDraw = now;
			offset += (BASE_SPEED + boost) * dt;
			boost = decayBoost(boost, dt);
			draw(offset, now);
		};

		window.addEventListener('wheel', onWheel, { passive: true });
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('touchstart', onTouchStart, { passive: true });
		window.addEventListener('touchmove', onTouchMove, { passive: true });
		window.addEventListener('resize', onResize);
		raf = requestAnimationFrame(loop);

		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener('wheel', onWheel);
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('touchstart', onTouchStart);
			window.removeEventListener('touchmove', onTouchMove);
			window.removeEventListener('resize', onResize);
		};
	});
</script>

<canvas bind:this={canvas} class="galaxy" aria-hidden="true"></canvas>

<style>
	.galaxy {
		position: fixed;
		inset: 0;
		z-index: 0;
		width: 100%;
		height: 100%;
		display: block;
		pointer-events: none;
		image-rendering: pixelated;
		/* Dark base so there's no flash before the first paint (and under reduced motion). */
		background: #070611;
	}
</style>
