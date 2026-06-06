import type { PathSample } from './path-geometry';
export { samplePath } from './path-geometry';

/**
 * A CSS transform that places an element's centre at the sampled stage point. Uses
 * container-query units so `Xcqw`/`Ycqh` are percentages of the `.zine-stage-overlay`.
 */
export function pathTransform(sample: PathSample): string {
	const parts = [
		`translate(calc(${sample.x.toFixed(2)}cqw - 50%), calc(${sample.y.toFixed(2)}cqh - 50%))`
	];
	if (Math.abs(sample.scale - 1) > 0.001) parts.push(`scale(${sample.scale.toFixed(3)})`);
	if (Math.abs(sample.rotate) > 0.001) parts.push(`rotate(${sample.rotate.toFixed(1)}deg)`);
	return parts.join(' ');
}
