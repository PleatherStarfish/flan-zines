import { describe, expect, it } from 'vitest';
import { DEFAULT_WAYPOINTS, PathParamsSchema, type Waypoint } from './path';
import { pathTransform, samplePath } from './path-runtime';

const wp = (at: number, x: number, y: number, ease: Waypoint['ease'] = 'linear'): Waypoint => ({
	at,
	x,
	y,
	scale: 1,
	rotate: 0,
	ease
});

describe('path choreography math', () => {
	const path = [wp(0, 0, 50), wp(1, 100, 50)];

	it('returns the endpoints at and beyond the path ends', () => {
		expect(samplePath(path, 0)).toMatchObject({ x: 0, y: 50 });
		expect(samplePath(path, 1)).toMatchObject({ x: 100, y: 50 });
		expect(samplePath(path, -0.5).x).toBe(0); // clamps below first.at
		expect(samplePath(path, 2).x).toBe(100); // clamps above last.at
	});

	it('interpolates linearly between control points', () => {
		expect(samplePath(path, 0.5).x).toBeCloseTo(50);
		expect(samplePath(path, 0.25).x).toBeCloseTo(25);
	});

	it('picks the correct segment with 3+ waypoints', () => {
		const three = [wp(0, 0, 0), wp(0.5, 100, 0), wp(1, 100, 100)];
		expect(samplePath(three, 0.25).x).toBeCloseTo(50); // first segment, half way
		expect(samplePath(three, 0.75).y).toBeCloseTo(50); // second segment, half way
	});

	it('smooth easing is symmetric and differs from linear off-centre', () => {
		const smooth = [wp(0, 0, 50), wp(1, 100, 50, 'smooth')];
		expect(samplePath(smooth, 0.5).x).toBeCloseTo(50); // smoothstep midpoint == linear
		expect(samplePath(smooth, 0.25).x).toBeLessThan(25); // eases in slower than linear
	});

	it('arc easing lifts the element up at mid-segment (a jump)', () => {
		const jump = [wp(0, 0, 80), wp(1, 100, 80, 'arc')];
		const mid = samplePath(jump, 0.5);
		expect(mid.x).toBeCloseTo(50); // horizontally midway
		expect(mid.y).toBeLessThan(80); // lifted up (smaller y) — the arc peak
	});

	it('emits a transform that centres the element on the stage point', () => {
		const t = pathTransform(samplePath(path, 0.5));
		expect(t.startsWith('translate(')).toBe(true);
		expect(t).toContain('cqw');
		expect(t).toContain('cqh');
		expect(t).not.toMatch(/url\(|javascript:/i);
	});
});

describe('PathParamsSchema', () => {
	it('defaults to a valid two-point path', () => {
		const parsed = PathParamsSchema.parse({});
		expect(parsed.waypoints.length).toBe(2);
		expect(parsed.waypoints).toEqual(DEFAULT_WAYPOINTS);
	});

	it('fills per-waypoint defaults (scale/rotate/ease)', () => {
		const parsed = PathParamsSchema.parse({
			waypoints: [
				{ at: 0, x: 10, y: 10 },
				{ at: 1, x: 90, y: 10 }
			]
		});
		expect(parsed.waypoints[0]).toMatchObject({ scale: 1, rotate: 0, ease: 'smooth' });
	});

	it('rejects out-of-order, duplicate, too-long, and too-short paths', () => {
		expect(
			PathParamsSchema.safeParse({
				waypoints: [
					{ at: 0.8, x: 0, y: 0 },
					{ at: 0.2, x: 1, y: 1 }
				]
			}).success
		).toBe(false);
		expect(
			PathParamsSchema.safeParse({
				waypoints: [
					{ at: 0, x: 0, y: 0 },
					{ at: 0, x: 1, y: 1 }
				]
			}).success
		).toBe(false);
		expect(
			PathParamsSchema.safeParse({
				waypoints: Array.from({ length: 13 }, (_, i) => ({
					at: i / 12,
					x: i,
					y: i
				}))
			}).success
		).toBe(false);
		expect(PathParamsSchema.safeParse({ waypoints: [{ at: 0, x: 0, y: 0 }] }).success).toBe(false);
	});
});
