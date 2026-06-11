import { describe, expect, it } from 'vitest';
import { CharacterSpritePropsSchema } from '$lib/zine/blocks/characterSprite/schema';
import { defaultCharacterProject } from './project';
import { actionFrameCount, renderCharacterFrames } from './draw';
import { encodeGif } from './export';

describe('pixel character generator', () => {
	it('renders every action at the requested export size', () => {
		const project = defaultCharacterProject();
		const frames = renderCharacterFrames(project, 'runRight', 'small');
		expect(frames).toHaveLength(actionFrameCount('runRight'));
		expect(frames[0].width).toBe(48);
		expect(frames[0].height).toBe(64);
		expect(opaqueCount(frames[0].data)).toBeGreaterThan(300);
	});

	it('uses a hand-sized tiny layout that preserves head, torso, and legs', () => {
		const project = defaultCharacterProject();
		const [frame] = renderCharacterFrames(project, 'idle', 'tiny');
		expect(frame.width).toBe(16);
		expect(frame.height).toBe(24);
		expect(rowBandOpaque(frame, 2, 8), 'head pixels').toBeGreaterThan(12);
		expect(rowBandOpaque(frame, 8, 16), 'torso pixels').toBeGreaterThan(18);
		expect(rowBandOpaque(frame, 16, 24), 'leg pixels').toBeGreaterThan(12);
	});

	it('mirrors run-left from run-right', () => {
		const project = defaultCharacterProject();
		const [right] = renderCharacterFrames(project, 'runRight', 'tiny');
		const [left] = renderCharacterFrames(project, 'runLeft', 'tiny');
		for (let y = 0; y < right.height; y++) {
			for (let x = 0; x < right.width; x++) {
				const ri = (y * right.width + x) * 4;
				const li = (y * left.width + (left.width - 1 - x)) * 4;
				expect(Array.from(left.data.slice(li, li + 4))).toEqual(
					Array.from(right.data.slice(ri, ri + 4))
				);
			}
		}
	});

	it('encodes a transparent animated GIF', async () => {
		const project = defaultCharacterProject();
		const gif = await encodeGif(renderCharacterFrames(project, 'wave', 'tiny'));
		const header = String.fromCharCode(...gif.slice(0, 6));
		expect(header).toBe('GIF89a');
		expect(gif.length).toBeGreaterThan(100);
	});

	it('rejects unsafe generated preview URLs in persisted sprite props', () => {
		const result = CharacterSpritePropsSchema.safeParse({
			action: 'idle',
			size: 'small',
			source: {
				src: 'blob:https://example.com/1',
				poster: 'data:image/png;base64,abc',
				width: 48,
				height: 64,
				frameCount: 1,
				durationMs: 0
			},
			alt: 'A pixel-art character'
		});
		expect(result.success).toBe(false);
	});
});

function opaqueCount(data: Uint8ClampedArray): number {
	let count = 0;
	for (let i = 3; i < data.length; i += 4) if (data[i] > 0) count++;
	return count;
}

function rowBandOpaque(
	frame: { width: number; data: Uint8ClampedArray },
	y0: number,
	y1: number
): number {
	let count = 0;
	for (let y = y0; y < y1; y++) {
		for (let x = 0; x < frame.width; x++) {
			const alpha = frame.data[(y * frame.width + x) * 4 + 3];
			if (alpha > 0) count++;
		}
	}
	return count;
}
