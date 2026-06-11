<script lang="ts">
	import type { SpeechFrameMode, SpeechFrameTail } from '../schema/theme';

	let {
		mode = 'speech',
		tail = 'bottom-left'
	}: {
		mode?: SpeechFrameMode;
		tail?: SpeechFrameTail;
	} = $props();

	let svgEl = $state<SVGSVGElement | null>(null);

	function roundedRectPath(
		left: number,
		top: number,
		right: number,
		bottom: number,
		radius: number
	): string {
		return [
			`M ${left + radius} ${top}`,
			`L ${right - radius} ${top}`,
			`Q ${right} ${top} ${right} ${top + radius}`,
			`L ${right} ${bottom - radius}`,
			`Q ${right} ${bottom} ${right - radius} ${bottom}`,
			`L ${left + radius} ${bottom}`,
			`Q ${left} ${bottom} ${left} ${bottom - radius}`,
			`L ${left} ${top + radius}`,
			`Q ${left} ${top} ${left + radius} ${top}`,
			'Z'
		].join(' ');
	}

	function tailPath(
		kind: SpeechFrameTail,
		left: number,
		top: number,
		right: number,
		bottom: number
	) {
		const width = right - left;
		const height = bottom - top;
		const leftX = left + Math.min(width * 0.24, 64);
		const midX = left + width / 2;
		const rightX = right - Math.min(width * 0.24, 64);
		const midY = top + height / 2;
		if (kind === 'none' || kind === 'auto') return '';
		if (kind === 'top-left')
			return `M ${leftX - 10} ${top + 2} L ${leftX + 2} 3 L ${leftX + 15} ${top + 4}`;
		if (kind === 'top') return `M ${midX - 12} ${top + 2} L ${midX} 3 L ${midX + 14} ${top + 4}`;
		if (kind === 'top-right')
			return `M ${rightX - 15} ${top + 4} L ${rightX - 2} 3 L ${rightX + 10} ${top + 2}`;
		if (kind === 'right')
			return `M ${right - 2} ${midY - 12} L ${right + 13} ${midY} L ${right - 4} ${midY + 14}`;
		if (kind === 'bottom-right')
			return `M ${rightX - 15} ${bottom - 4} L ${rightX - 2} ${bottom + 13} L ${rightX + 10} ${bottom - 2}`;
		if (kind === 'bottom')
			return `M ${midX - 12} ${bottom - 2} L ${midX} ${bottom + 13} L ${midX + 14} ${bottom - 4}`;
		if (kind === 'bottom-left')
			return `M ${leftX - 10} ${bottom - 2} L ${leftX + 2} ${bottom + 13} L ${leftX + 15} ${bottom - 4}`;
		if (kind === 'left')
			return `M ${left + 2} ${midY - 12} L ${left - 13} ${midY} L ${left + 4} ${midY + 14}`;
		const _exhaustive: never = kind;
		void _exhaustive;
		return '';
	}

	function thoughtDots(
		kind: SpeechFrameTail,
		left: number,
		top: number,
		right: number,
		bottom: number
	): [[number, number, number], [number, number, number]] | [] {
		const width = right - left;
		const height = bottom - top;
		const xLeft = left + Math.min(width * 0.18, 58);
		const xMid = left + width / 2;
		const xRight = right - Math.min(width * 0.18, 58);
		const yMid = top + height / 2;
		switch (kind) {
			case 'top-left':
				return [
					[xLeft, top + 1, 9],
					[xLeft - 18, top - 9, 6]
				];
			case 'top':
				return [
					[xMid, top + 1, 9],
					[xMid, top - 12, 6]
				];
			case 'top-right':
				return [
					[xRight, top + 1, 9],
					[xRight + 18, top - 9, 6]
				];
			case 'right':
				return [
					[right - 1, yMid, 9],
					[right + 13, yMid, 6]
				];
			case 'bottom-right':
				return [
					[xRight, bottom - 1, 9],
					[xRight + 18, bottom + 10, 6]
				];
			case 'bottom':
				return [
					[xMid, bottom - 1, 9],
					[xMid, bottom + 12, 6]
				];
			case 'bottom-left':
				return [
					[xLeft, bottom - 1, 9],
					[xLeft - 18, bottom + 10, 6]
				];
			case 'left':
				return [
					[left + 1, yMid, 9],
					[left - 13, yMid, 6]
				];
			case 'auto':
			case 'none':
				return [];
			default: {
				const _exhaustive: never = kind;
				void _exhaustive;
				return [];
			}
		}
	}

	$effect(() => {
		const node = svgEl;
		const frameMode = mode;
		const frameTail = tail;
		if (!node || typeof window === 'undefined') return;

		let cancelled = false;
		let frame = 0;
		let roughApi: typeof import('roughjs/bin/rough').default | null = null;

		const draw = () => {
			frame = 0;
			if (!roughApi || cancelled) return;
			const rect = node.getBoundingClientRect();
			const width = Math.max(24, Math.round(rect.width));
			const height = Math.max(24, Math.round(rect.height));
			node.replaceChildren();
			node.setAttribute('viewBox', `0 0 ${width} ${height}`);
			node.setAttribute('width', String(width));
			node.setAttribute('height', String(height));

			const stroke = getComputedStyle(node).color || '#14181f';
			const rc = roughApi.svg(node);
			const options = {
				stroke,
				strokeWidth: 2,
				fill: 'transparent',
				roughness: 1.3,
				bowing: 1.15,
				seed: frameMode === 'thought' ? 12 : 7
			};
			const inset = 12;
			const left = inset;
			const top = inset;
			const right = width - inset;
			const bottom = height - inset;
			if (frameMode === 'thought') {
				const dots = thoughtDots(frameTail, left, top, right, bottom);
				node.append(
					rc.ellipse(
						width / 2,
						height / 2,
						Math.max(12, right - left),
						Math.max(12, bottom - top),
						options
					)
				);
				node.append(...dots.map(([x, y, size]) => rc.circle(x, y, size, options)));
				return;
			}
			const radius = Math.min(22, Math.max(10, Math.min(right - left, bottom - top) * 0.18));
			node.append(rc.path(roundedRectPath(left, top, right, bottom, radius), options));
			const tail = tailPath(frameTail, left, top, right, bottom);
			if (tail) node.append(rc.path(tail, options));
		};

		const schedule = () => {
			if (frame) cancelAnimationFrame(frame);
			frame = requestAnimationFrame(draw);
		};

		void import('roughjs/bin/rough').then((module) => {
			roughApi = module.default;
			if (!cancelled) schedule();
		});

		const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
		ro?.observe(node);
		window.addEventListener('resize', schedule, { passive: true });
		return () => {
			cancelled = true;
			if (frame) cancelAnimationFrame(frame);
			ro?.disconnect();
			window.removeEventListener('resize', schedule);
		};
	});
</script>

<span class="zine-rough-frame" aria-hidden="true">
	<svg bind:this={svgEl} focusable="false"></svg>
</span>

<style>
	.zine-rough-frame {
		position: absolute;
		inset: -0.85rem;
		z-index: 0;
		color: var(--zine-frame-stroke, currentColor);
		pointer-events: none;
	}
	.zine-rough-frame svg {
		display: block;
		width: 100%;
		height: 100%;
		overflow: visible;
	}
</style>
