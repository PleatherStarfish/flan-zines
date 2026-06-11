import type { CharacterAction, CharacterExportSize, PixelCharacterProject } from './project';
import { renderCharacterFrames, renderPosterFrame, type PixelFrame } from './draw';

export type CharacterExportFile = {
	action: CharacterAction;
	size: CharacterExportSize;
	kind: 'gif' | 'poster';
	fileName: string;
	blob: Blob;
	width: number;
	height: number;
	frameCount: number;
	durationMs: number;
};

export type CharacterExportRequest = {
	project: PixelCharacterProject;
	actions: CharacterAction[];
	sizes: CharacterExportSize[];
};

export async function exportCharacterSet(
	request: CharacterExportRequest,
	onProgress?: (done: number, total: number) => void
): Promise<CharacterExportFile[]> {
	const files: CharacterExportFile[] = [];
	const total = request.actions.length * request.sizes.length * 2;
	let done = 0;
	for (const action of request.actions) {
		for (const size of request.sizes) {
			const frames = renderCharacterFrames(request.project, action, size);
			const gif = await encodeGif(frames);
			files.push({
				action,
				size,
				kind: 'gif',
				fileName: `${safeName(request.project.name)}-${action}-${size}.gif`,
				blob: new Blob([arrayBufferFor(gif)], { type: 'image/gif' }),
				width: frames[0].width,
				height: frames[0].height,
				frameCount: frames.length,
				durationMs: frames.reduce((sum, frame) => sum + frame.durationMs, 0)
			});
			onProgress?.(++done, total);

			const poster = renderPosterFrame(request.project, action, size);
			files.push({
				action,
				size,
				kind: 'poster',
				fileName: `${safeName(request.project.name)}-${action}-${size}.png`,
				blob: await encodePng(poster),
				width: poster.width,
				height: poster.height,
				frameCount: 1,
				durationMs: 0
			});
			onProgress?.(++done, total);
		}
	}
	return files;
}

export async function encodeGif(frames: PixelFrame[]): Promise<Uint8Array> {
	const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
	const width = frames[0]?.width;
	const height = frames[0]?.height;
	if (!width || !height) throw new Error('Cannot encode an empty character animation.');
	const combined = new Uint8ClampedArray(frames.reduce((sum, frame) => sum + frame.data.length, 0));
	let offset = 0;
	for (const frame of frames) {
		combined.set(frame.data, offset);
		offset += frame.data.length;
	}
	const palette = quantize(combined, 64, { format: 'rgba4444', oneBitAlpha: true });
	const transparentIndex = Math.max(
		0,
		palette.findIndex((color: number[]) => color[3] === 0)
	);
	const gif = GIFEncoder();
	for (const frame of frames) {
		const index = applyPalette(frame.data, palette, 'rgba4444');
		gif.writeFrame(index, width, height, {
			palette,
			delay: frame.durationMs,
			repeat: 0,
			transparent: true,
			transparentIndex
		});
	}
	gif.finish();
	return gif.bytes();
}

export async function encodePng(frame: PixelFrame): Promise<Blob> {
	if (typeof OffscreenCanvas !== 'undefined') {
		const canvas = new OffscreenCanvas(frame.width, frame.height);
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Could not create a canvas context.');
		ctx.putImageData(imageDataFor(frame), 0, 0);
		return canvas.convertToBlob({ type: 'image/png' });
	}
	if (typeof document !== 'undefined') {
		const canvas = document.createElement('canvas');
		canvas.width = frame.width;
		canvas.height = frame.height;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Could not create a canvas context.');
		ctx.putImageData(imageDataFor(frame), 0, 0);
		return new Promise((resolve, reject) => {
			canvas.toBlob((blob) => {
				if (blob) resolve(blob);
				else reject(new Error('Could not encode character poster.'));
			}, 'image/png');
		});
	}
	throw new Error('PNG export requires a browser canvas.');
}

function imageDataFor(frame: PixelFrame): ImageData {
	return new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height);
}

function arrayBufferFor(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function safeName(name: string): string {
	return (
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '') || 'pixel-character'
	);
}
