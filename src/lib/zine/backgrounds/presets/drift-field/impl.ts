// Lazy-loaded Canvas2D sketch — dynamically imported by the registry so it stays out of
// the base bundle (the same discipline a Three/D3/P5 preset will reuse). A calm dot field
// that drifts with scroll `progress` and parts around the `pointer`. Pure draw; the
// runtime owns the loop, FPS cap, resize, reduced-motion, and teardown.
import type { BackgroundInput, BackgroundInstance } from '../../contract';
import { TINT_RGB } from '../../schema';
import type { DriftFieldParams } from './schema';

const DENSITY_MUL = { subtle: 0.5, medium: 1, strong: 1.8 } as const;
const SPEED_SCALE = { slow: 0.15, medium: 0.35, fast: 0.7 } as const;

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
	let size = new Float32Array(0);
	let depth = new Float32Array(0);

	function seed(width: number, height: number, lowPower: boolean): void {
		w = Math.max(1, width);
		h = Math.max(1, height);
		const target = Math.round(((w * h) / 22000) * DENSITY_MUL[params.density]);
		count = Math.max(12, Math.min(target, lowPower ? 90 : 260));
		bx = new Float32Array(count);
		by = new Float32Array(count);
		phase = new Float32Array(count);
		size = new Float32Array(count);
		depth = new Float32Array(count);
		for (let i = 0; i < count; i++) {
			bx[i] = Math.random() * w;
			by[i] = Math.random() * h;
			phase[i] = Math.random() * Math.PI * 2;
			depth[i] = 0.3 + Math.random() * 0.7;
			size[i] = (0.8 + Math.random() * 1.8) * depth[i] * 1.4;
		}
		if (ctx) ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
	}

	return {
		resize(width, height) {
			seed(width, height, count > 0 && count <= 90);
		},
		frame(input: BackgroundInput) {
			if (!ctx) return;
			if (count === 0) seed(input.width, input.height, input.lowPower);
			ctx.clearRect(0, 0, w, h);
			const t = input.time / 1000;
			const shift = input.progress;
			const px = input.pointer ? input.pointer.x * w : -1;
			const py = input.pointer ? input.pointer.y * h : -1;
			const radius = Math.min(w, h) * 0.18;
			for (let i = 0; i < count; i++) {
				let x = bx[i] + Math.sin(t * speed + phase[i]) * 14 * depth[i];
				let y = by[i] + Math.cos(t * speed * 0.8 + phase[i]) * 14 * depth[i];
				// scroll parallax: deeper dots drift further as the reader scrolls
				y -= shift * h * 0.25 * depth[i];
				y = ((y % h) + h) % h;
				if (px >= 0) {
					const dx = x - px;
					const dy = y - py;
					const d2 = dx * dx + dy * dy;
					if (d2 < radius * radius) {
						const d = Math.sqrt(d2) || 1;
						const f = (1 - d / radius) * 30 * depth[i];
						x += (dx / d) * f;
						y += (dy / d) * f;
					}
				}
				ctx.globalAlpha = 0.2 + depth[i] * 0.5;
				ctx.beginPath();
				ctx.arc(x, y, size[i], 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.globalAlpha = 1;
		},
		destroy() {
			if (ctx) ctx.clearRect(0, 0, w, h);
			count = 0;
		}
	};
}
