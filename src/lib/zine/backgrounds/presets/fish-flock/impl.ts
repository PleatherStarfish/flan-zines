// Lazy-loaded Canvas2D boids — dynamically imported so it never enters the base bundle.
// A school of tiny top-view koi that flock (separation / alignment / cohesion), gently
// follow the cursor, wander slowly + randomly when the reader is still, and swim faster +
// more coherently in the scroll direction while scrolling. Pure draw; the runtime owns
// the loop.
//
// "Scrolling vs still" is derived from frame-to-frame `progress` deltas — no extra signal
// needed: the runtime feeds `progress` (0..1) and `time` (ms), so velocity = Δprogress/Δt.
import type { BackgroundInput, BackgroundInstance } from '../../contract';
import { TINT_RGB } from '../../schema';
import type { FishFlockParams } from './schema';

const COUNT = { subtle: 28, medium: 55, strong: 95 } as const;
const BASE_SPEED = { slow: 0.9, medium: 1.5, fast: 2.4 } as const; // device px / frame at rest

interface KoiSprite {
	img: HTMLImageElement | null;
	ready: boolean;
}

export function mount(canvas: HTMLCanvasElement, params: FishFlockParams): BackgroundInstance {
	const ctx = canvas.getContext('2d');
	const [r, g, b] = TINT_RGB[params.tint];
	const baseSpeed = BASE_SPEED[params.speed];
	const koiSprites = createKoiSprites(`rgb(${r}, ${g}, ${b})`);

	let w = canvas.width || 1;
	let h = canvas.height || 1;
	let n = 0;
	let px = new Float32Array(0);
	let py = new Float32Array(0);
	let vx = new Float32Array(0);
	let vy = new Float32Array(0);
	let turn = new Int8Array(0); // -1 = left pose, 0 = straight, 1 = right pose
	let pattern = new Uint8Array(0);
	let wag = new Float32Array(0);

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
		turn = new Int8Array(n);
		pattern = new Uint8Array(n);
		wag = new Float32Array(n);
		for (let i = 0; i < n; i++) {
			px[i] = Math.random() * w;
			py[i] = Math.random() * h;
			const a = Math.random() * Math.PI * 2;
			vx[i] = Math.cos(a) * baseSpeed;
			vy[i] = Math.sin(a) * baseSpeed;
			pattern[i] = Math.floor(Math.random() * 3);
			wag[i] = Math.random() * Math.PI * 2;
		}
		lastProgress = Number.NaN;
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
			const oldVx = vx[i];
			const oldVy = vy[i];
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
			const nextSp = Math.hypot(vx[i], vy[i]) || 1;
			const turnAmount = (oldVx * vy[i] - oldVy * vx[i]) / Math.max(nextSp * nextSp, 0.001);
			turn[i] = turnAmount > 0.035 ? 1 : turnAmount < -0.035 ? -1 : 0;
			// wrap around the edges for an endless school
			px[i] = (((px[i] + vx[i]) % w) + w) % w;
			py[i] = (((py[i] + vy[i]) % h) + h) % h;
		}
	}

	function makeKoiSvg(pose: number, patch: string): string {
		const bend = pose * 2.1;
		const tailTop = -4.2 + bend;
		const tailBottom = 4.2 + bend;
		const bodyTop = -5.2 + bend;
		const bodyBottom = 5.2 + bend;
		return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-16 -10 32 20">
<path d="M-7.5 ${bend * 0.4} L-14 ${tailTop} L-11 ${bend * 0.8} L-14 ${tailBottom} Z" fill="#fff0b8" stroke="#59464f" stroke-opacity=".34" stroke-width=".9" opacity=".82"/>
<path d="M10.8 0 C7.2 -5.2 -1.8 ${bodyTop} -8.8 ${bend * 0.55} C-1.8 ${bodyBottom} 7.2 5.2 10.8 0 Z" fill="#fffce8" stroke="#59464f" stroke-opacity=".38" stroke-width=".95"/>
<path d="M.5 ${-3.5 + bend * 0.2} L-4.4 ${-8 + bend} L-2.2 ${-2.4 + bend * 0.4} Z M.5 ${3.5 + bend * 0.2} L-4.4 ${8 + bend} L-2.2 ${2.4 + bend * 0.4} Z" fill="#ffeeb6" stroke="#59464f" stroke-opacity=".24" stroke-width=".65" opacity=".78"/>
<circle cx="3.8" cy="-1.6" r="2.3" fill="${patch}" opacity=".96"/>
<circle cx="-2.8" cy="${2.4 + bend * 0.4}" r="2.5" fill="${patch}" opacity=".9"/>
<circle cx="8.3" cy="-1.1" r=".55" fill="#14181f" opacity=".45"/>
<circle cx="8.3" cy="1.1" r=".55" fill="#14181f" opacity=".45"/>
</svg>`;
	}

	function createKoiSprites(patch: string): KoiSprite[] {
		if (typeof Image === 'undefined') {
			return [
				{ img: null, ready: false },
				{ img: null, ready: false },
				{ img: null, ready: false }
			];
		}
		return [-1, 0, 1].map((pose) => {
			const sprite: KoiSprite = { img: new Image(), ready: false };
			if (!sprite.img) return sprite;
			sprite.img.onload = () => {
				sprite.ready = true;
			};
			sprite.img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(makeKoiSvg(pose, patch))}`;
			return sprite;
		});
	}

	function drawKoiFallback(
		x: number,
		y: number,
		angle: number,
		size: number,
		pose: number,
		variant: number,
		time: number,
		flicker: number
	): void {
		if (!ctx) return;
		const bend = pose * 1.7;
		const tailFlick = Math.sin(time * 0.009 + flicker) * 1.2;

		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(angle);
		ctx.scale(size, size);
		ctx.globalAlpha = 0.88;

		// Forked tail, bending into the current turn.
		ctx.fillStyle = 'rgba(252, 248, 221, 0.86)';
		ctx.strokeStyle = 'rgba(89, 70, 79, 0.34)';
		ctx.lineWidth = 0.9;
		ctx.beginPath();
		ctx.moveTo(-7.5, bend * 0.4);
		ctx.lineTo(-13.2, -4.2 + bend + tailFlick);
		ctx.lineTo(-11.2, -0.4 + bend * 1.2);
		ctx.lineTo(-13.4, 4.1 + bend - tailFlick);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();

		// Body silhouette: a simple SVG-like bezier koi viewed from above.
		ctx.fillStyle = 'rgba(255, 252, 232, 0.94)';
		ctx.strokeStyle = 'rgba(89, 70, 79, 0.38)';
		ctx.lineWidth = 0.95;
		ctx.beginPath();
		ctx.moveTo(10.8, 0);
		ctx.bezierCurveTo(7.2, -5.2, -1.8, -5.5 + bend, -8.8, bend * 0.55);
		ctx.bezierCurveTo(-1.8, 5.5 + bend, 7.2, 5.2, 10.8, 0);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();

		// Side fins.
		ctx.fillStyle = 'rgba(255, 238, 182, 0.72)';
		ctx.beginPath();
		ctx.moveTo(0.5, -3.5 + bend * 0.2);
		ctx.lineTo(-4.2, -8.2 + bend);
		ctx.lineTo(-2.2, -2.4 + bend * 0.4);
		ctx.closePath();
		ctx.moveTo(0.5, 3.5 + bend * 0.2);
		ctx.lineTo(-4.2, 8.2 + bend);
		ctx.lineTo(-2.2, 2.4 + bend * 0.4);
		ctx.closePath();
		ctx.fill();

		// Koi patches. Three tiny variants keep the school from looking stamped.
		ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.94)`;
		ctx.beginPath();
		if (variant % 3 === 0) {
			ctx.arc(3.8, -1.6, 2.3, 0, Math.PI * 2);
			ctx.moveTo(-2.8, 2.4 + bend * 0.4);
			ctx.arc(-2.8, 2.4 + bend * 0.4, 2.5, 0, Math.PI * 2);
		} else if (variant % 3 === 1) {
			ctx.arc(1.2, 2.1, 2.7, 0, Math.PI * 2);
			ctx.moveTo(6.2, -1.1);
			ctx.arc(6.2, -1.1, 1.7, 0, Math.PI * 2);
		} else {
			ctx.arc(-4.0, -1.3 + bend * 0.5, 2.5, 0, Math.PI * 2);
			ctx.moveTo(4.8, 1.8);
			ctx.arc(4.8, 1.8, 2.0, 0, Math.PI * 2);
		}
		ctx.fill();

		ctx.fillStyle = 'rgba(20, 24, 31, 0.42)';
		ctx.beginPath();
		ctx.arc(8.3, -1.1, 0.55, 0, Math.PI * 2);
		ctx.arc(8.3, 1.1, 0.55, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}

	function drawKoi(
		x: number,
		y: number,
		angle: number,
		size: number,
		pose: number,
		variant: number,
		time: number,
		flicker: number
	): void {
		if (!ctx) return;
		const sprite = koiSprites[pose + 1];
		if (sprite?.ready && sprite.img) {
			const tailFlick = Math.sin(time * 0.009 + flicker) * pose * 0.08;
			ctx.save();
			ctx.translate(x, y);
			ctx.rotate(angle + tailFlick);
			ctx.scale(size, size);
			ctx.globalAlpha = 0.9;
			ctx.drawImage(sprite.img, -16, -10, 32, 20);
			ctx.restore();
			return;
		}
		drawKoiFallback(x, y, angle, size, pose, variant, time, flicker);
	}

	function draw(input: BackgroundInput): void {
		if (!ctx) return;
		ctx.clearRect(0, 0, w, h);
		const size = Math.min(Math.max(Math.min(w, h) * 0.0027, 0.72), 1.65);
		for (let i = 0; i < n; i++) {
			const sp = Math.hypot(vx[i], vy[i]) || 1;
			const angle = Math.atan2(vy[i], vx[i]);
			const pulse = 1 + Math.sin(input.time * 0.01 + wag[i]) * 0.08;
			drawKoi(
				px[i],
				py[i],
				angle,
				size * pulse * (0.85 + (sp / Math.max(baseSpeed, 0.1)) * 0.1),
				turn[i],
				pattern[i],
				input.time,
				wag[i]
			);
		}
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
			draw(input);
		},
		destroy() {
			if (ctx) ctx.clearRect(0, 0, w, h);
			n = 0;
		}
	};
}
