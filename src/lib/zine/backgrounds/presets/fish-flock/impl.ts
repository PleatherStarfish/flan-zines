// Lazy-loaded Canvas2D boids — dynamically imported so it never enters the base bundle.
// A school of tiny fish that flock (separation / alignment / cohesion), gently follow the
// cursor, wander slowly + randomly when the reader is still, and swim faster + more
// coherently in the scroll direction while scrolling. Pure draw; the runtime owns the loop.
//
// "Scrolling vs still" is derived from frame-to-frame `progress` deltas — no extra signal
// needed: the runtime feeds `progress` (0..1) and `time` (ms), so velocity = Δprogress/Δt.
import type { BackgroundInput, BackgroundInstance } from '../../contract';
import { TINT_RGB } from '../../schema';
import type { FishFlockParams } from './schema';

const COUNT = { subtle: 28, medium: 55, strong: 95 } as const;
const BASE_SPEED = { slow: 0.9, medium: 1.5, fast: 2.4 } as const; // device px / frame at rest

export function mount(canvas: HTMLCanvasElement, params: FishFlockParams): BackgroundInstance {
	const ctx = canvas.getContext('2d');
	const [r, g, b] = TINT_RGB[params.tint];
	const baseSpeed = BASE_SPEED[params.speed];

	let w = canvas.width || 1;
	let h = canvas.height || 1;
	let n = 0;
	let px = new Float32Array(0);
	let py = new Float32Array(0);
	let vx = new Float32Array(0);
	let vy = new Float32Array(0);

	// scroll-velocity tracking (smoothed) + persisted direction
	let lastProgress = Number.NaN;
	let lastTime = 0;
	let scrollSpeed = 0; // progress / second, smoothed
	let scrollDir = 1; // +1 forward, -1 back

	function seed(width: number, height: number, lowPower: boolean): void {
		w = Math.max(1, width);
		h = Math.max(1, height);
		const target = Math.round(COUNT[params.density] * (lowPower ? 0.5 : 1));
		n = Math.max(8, target);
		px = new Float32Array(n);
		py = new Float32Array(n);
		vx = new Float32Array(n);
		vy = new Float32Array(n);
		for (let i = 0; i < n; i++) {
			px[i] = Math.random() * w;
			py[i] = Math.random() * h;
			const a = Math.random() * Math.PI * 2;
			vx[i] = Math.cos(a) * baseSpeed;
			vy[i] = Math.sin(a) * baseSpeed;
		}
		lastProgress = Number.NaN;
		if (ctx) ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
	}

	function step(input: BackgroundInput): void {
		// ── scroll speed/direction from progress deltas ──
		if (Number.isNaN(lastProgress)) {
			lastProgress = input.progress;
			lastTime = input.time;
		}
		const dt = Math.max(1, input.time - lastTime);
		const dProgress = input.progress - lastProgress;
		lastProgress = input.progress;
		lastTime = input.time;
		if (Math.abs(dProgress) > 1e-4) scrollDir = Math.sign(dProgress);
		const instSpeed = (Math.abs(dProgress) / dt) * 1000; // progress / second
		scrollSpeed = scrollSpeed * 0.82 + instSpeed * 0.18;
		const flow = Math.min(scrollSpeed / 0.7, 1); // 0 still → 1 fast scroll

		// behaviour blends with scroll state
		const maxSpeed = baseSpeed * (1 + 2.5 * flow);
		const minSpeed = baseSpeed * 0.35;
		const alignW = 0.03 + 0.13 * flow; // more directional while scrolling
		const cohW = 0.0011;
		const sepW = 0.05;
		const wanderW = 0.45 * (1 - flow); // more random while still
		const cursorW = 0.0017; // gentle follow
		const curX = flow * 0.05; // a slight cross-current while scrolling
		const curY = flow * scrollDir * 0.16; // surge in the scroll direction

		const radius = Math.min(Math.max(Math.min(w, h) * 0.14, 40), 150);
		const r2 = radius * radius;
		const sep2 = radius * 0.42 * (radius * 0.42);
		const pointerX = input.pointer ? input.pointer.x * w : -1;
		const pointerY = input.pointer ? input.pointer.y * h : -1;

		for (let i = 0; i < n; i++) {
			let cohX = 0;
			let cohY = 0;
			let aliX = 0;
			let aliY = 0;
			let sepX = 0;
			let sepY = 0;
			let count = 0;
			for (let j = 0; j < n; j++) {
				if (j === i) continue;
				const dx = px[j] - px[i];
				const dy = py[j] - py[i];
				const d2 = dx * dx + dy * dy;
				if (d2 > r2 || d2 === 0) continue;
				count++;
				cohX += px[j];
				cohY += py[j];
				aliX += vx[j];
				aliY += vy[j];
				if (d2 < sep2) {
					sepX -= dx / d2;
					sepY -= dy / d2;
				}
			}

			let ax = curX;
			let ay = curY;
			if (count > 0) {
				ax += (cohX / count - px[i]) * cohW + (aliX / count - vx[i]) * alignW;
				ay += (cohY / count - py[i]) * cohW + (aliY / count - vy[i]) * alignW;
			}
			ax += sepX * sepW * radius;
			ay += sepY * sepW * radius;
			ax += (Math.random() - 0.5) * wanderW;
			ay += (Math.random() - 0.5) * wanderW;
			if (pointerX >= 0) {
				ax += (pointerX - px[i]) * cursorW;
				ay += (pointerY - py[i]) * cursorW;
			}

			vx[i] += ax;
			vy[i] += ay;
			const sp = Math.hypot(vx[i], vy[i]);
			if (sp > maxSpeed) {
				vx[i] = (vx[i] / sp) * maxSpeed;
				vy[i] = (vy[i] / sp) * maxSpeed;
			} else if (sp < minSpeed && sp > 0) {
				vx[i] = (vx[i] / sp) * minSpeed;
				vy[i] = (vy[i] / sp) * minSpeed;
			}
			// wrap around the edges for an endless school
			px[i] = (((px[i] + vx[i]) % w) + w) % w;
			py[i] = (((py[i] + vy[i]) % h) + h) % h;
		}
	}

	function draw(): void {
		if (!ctx) return;
		ctx.clearRect(0, 0, w, h);
		const len = Math.min(Math.max(Math.min(w, h) * 0.007, 3.5), 9);
		const wid = len * 0.5;
		ctx.globalAlpha = 0.85;
		ctx.beginPath();
		for (let i = 0; i < n; i++) {
			const sp = Math.hypot(vx[i], vy[i]) || 1;
			const cx = vx[i] / sp;
			const cy = vy[i] / sp;
			const x = px[i];
			const y = py[i];
			ctx.moveTo(x + cx * len, y + cy * len); // nose
			ctx.lineTo(x - cx * len * 0.5 - cy * wid, y - cy * len * 0.5 + cx * wid);
			ctx.lineTo(x - cx * len * 0.5 + cy * wid, y - cy * len * 0.5 - cx * wid);
			ctx.closePath();
		}
		ctx.fill();
		ctx.globalAlpha = 1;
	}

	return {
		resize(width, height) {
			seed(width, height, n > 0 && n <= COUNT.subtle);
		},
		frame(input: BackgroundInput) {
			if (!ctx) return;
			if (n === 0) seed(input.width, input.height, input.lowPower);
			step(input);
			draw();
		},
		destroy() {
			if (ctx) ctx.clearRect(0, 0, w, h);
			n = 0;
		}
	};
}
