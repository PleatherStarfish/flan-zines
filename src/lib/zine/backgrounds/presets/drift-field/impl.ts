// Lazy-loaded Canvas2D sketch — dynamically imported by the registry so it stays out of
// the base bundle (the same discipline a Three/D3/P5 preset will reuse). A close rain
// field: slanted streaks, a few impact specks, scroll-reactive speed, and a small pointer
// wake. Pure draw; the runtime owns the loop, FPS cap, resize, reduced-motion, and teardown.
import type { BackgroundInput, BackgroundInstance } from '../../contract';
import { TINT_RGB } from '../../schema';
import type { DriftFieldParams } from './schema';

const DENSITY_MUL = { subtle: 0.7, medium: 1.15, strong: 2.1 } as const;
const SPEED_SCALE = { slow: 0.75, medium: 1.1, fast: 1.55 } as const;

export function mount(canvas: HTMLCanvasElement, params: DriftFieldParams): BackgroundInstance {
	const ctx = canvas.getContext('2d');
	const [r, g, b] = TINT_RGB[params.tint];
	const speed = SPEED_SCALE[params.speed];

	let w = canvas.width || 1;
	let h = canvas.height || 1;
	let count = 0;
	let bx = new Float32Array(0);
	let by = new Float32Array(0);
	let phase = new Float32Array(0);
	let dropLength = new Float32Array(0);
	let dropWidth = new Float32Array(0);
	let depth = new Float32Array(0);
	let splash = new Uint8Array(0);
	let lastProgress = Number.NaN;
	let lastTime = Number.NaN;
	let scrollBoost = 0;
	let rainTravel = 0;

	function seed(width: number, height: number, lowPower: boolean): void {
		w = Math.max(1, width);
		h = Math.max(1, height);
		const target = Math.round(((w * h) / 15000) * DENSITY_MUL[params.density]);
		count = Math.max(24, Math.min(target, lowPower ? 150 : 420));
		bx = new Float32Array(count);
		by = new Float32Array(count);
		phase = new Float32Array(count);
		dropLength = new Float32Array(count);
		dropWidth = new Float32Array(count);
		depth = new Float32Array(count);
		splash = new Uint8Array(count);
		for (let i = 0; i < count; i++) {
			bx[i] = Math.random() * w;
			by[i] = Math.random() * h;
			phase[i] = Math.random() * Math.PI * 2;
			depth[i] = 0.35 + Math.random() * 0.65;
			dropLength[i] = (26 + Math.random() * 54) * depth[i];
			dropWidth[i] = 1.5 + depth[i] * 3.4;
			splash[i] = Math.random() > 0.72 ? 1 : 0;
		}
		lastProgress = Number.NaN;
		lastTime = Number.NaN;
		scrollBoost = 0;
		rainTravel = 0;
	}

	return {
		resize(width, height) {
			seed(width, height, count > 0 && count <= 150);
		},
		frame(input: BackgroundInput) {
			if (!ctx) return;
			if (count === 0) seed(input.width, input.height, input.lowPower);
			ctx.clearRect(0, 0, w, h);
			const t = input.time / 1000;
			const dt = Number.isNaN(lastTime)
				? 1 / 30
				: Math.min(0.12, Math.max(0.001, (input.time - lastTime) / 1000));
			const deltaProgress = Number.isNaN(lastProgress) ? 0 : input.progress - lastProgress;
			const progressPerSecond = Math.abs(deltaProgress) / dt;
			// Scroll velocity is the "rain lever": still page = drizzle, active scroll = downpour.
			const targetBoost = Math.min(1, progressPerSecond / 0.45);
			scrollBoost = scrollBoost * 0.78 + targetBoost * 0.22;
			lastProgress = input.progress;
			lastTime = input.time;
			rainTravel += dt * (80 + 145 * speed) * (1 + scrollBoost * 7.5);
			const scrollPush = input.progress * h * (0.22 + scrollBoost * 0.48);
			const px = input.pointer ? input.pointer.x * w : -1;
			const py = input.pointer ? input.pointer.y * h : -1;
			const radius = Math.min(w, h) * 0.2;
			const gutter = h * 0.78;
			ctx.lineCap = 'round';
			for (let i = 0; i < count; i++) {
				const fall = rainTravel * depth[i] + scrollPush * depth[i];
				let x =
					bx[i] +
					Math.sin(t * (0.65 + scrollBoost * 1.8) + phase[i]) * (7 + scrollBoost * 18) * depth[i];
				let y = ((by[i] + fall) % (h + 140)) - 90;
				if (px >= 0) {
					const dx = x - px;
					const dy = y - py;
					const d2 = dx * dx + dy * dy;
					if (d2 < radius * radius) {
						const d = Math.sqrt(d2) || 1;
						const f = (1 - d / radius) * 42 * depth[i];
						x += (dx / d) * f;
						y += (dy / d) * f;
					}
				}

				const slant = dropLength[i] * (0.32 + depth[i] * 0.16 + scrollBoost * 0.28);
				const alpha = Math.min(0.98, 0.3 + depth[i] * 0.55 + scrollBoost * 0.28);
				ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
				ctx.lineWidth = dropWidth[i] * (1 + scrollBoost * 0.42);
				ctx.beginPath();
				ctx.moveTo(x, y);
				ctx.lineTo(x - slant, y + dropLength[i]);
				ctx.stroke();

				if (splash[i] && y > gutter) {
					const splashAlpha = Math.max(0, 1 - Math.abs(y - gutter) / (h * 0.22)) * 0.6;
					ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${splashAlpha})`;
					ctx.beginPath();
					ctx.arc(
						x - slant,
						gutter + Math.sin(t * 3 + phase[i]) * 8,
						1.6 + depth[i] * 2.6,
						0,
						Math.PI * 2
					);
					ctx.fill();
				}
			}
		},
		destroy() {
			if (ctx) ctx.clearRect(0, 0, w, h);
			count = 0;
		}
	};
}
