<script lang="ts">
	import { untrack } from 'svelte';
	import type { Theme } from '$lib/zine/schema/theme';
	import {
		ACCESSORY_LABELS,
		ACCESSORY_PRESETS,
		ACTION_LABELS,
		BODY_LABELS,
		BODY_PRESETS,
		CHARACTER_ACTIONS,
		CHARACTER_EXPORT_SIZES,
		HAIR_LABELS,
		HAIR_PRESETS,
		OUTFIT_LABELS,
		OUTFIT_PRESETS,
		PROP_LABELS,
		PROP_PRESETS,
		SIZE_LABELS,
		defaultCharacterProject,
		updateProject,
		type AccessoryPreset,
		type CharacterAction,
		type CharacterExportSize,
		type CharacterPalette,
		type PixelCharacterProject
	} from './project';
	import type { CharacterExportFile, CharacterExportRequest } from './export';
	import { renderCharacterFrames } from './draw';

	let { theme, onClose }: { theme?: Theme; onClose: () => void } = $props();

	let project = $state<PixelCharacterProject>(untrack(() => defaultCharacterProject(theme)));
	let previewAction = $state<CharacterAction>('runRight');
	let exportActions = $state<CharacterAction[]>(['idle', 'runRight', 'runLeft', 'jump', 'wave']);
	let exportSizes = $state<CharacterExportSize[]>(['small', 'medium']);
	let files = $state<(CharacterExportFile & { url: string })[]>([]);
	let progress = $state<{ done: number; total: number } | null>(null);
	let error = $state<string | null>(null);
	let exporting = $state(false);
	let canvas = $state<HTMLCanvasElement | null>(null);
	let frameIndex = $state(0);

	const previewFrames = $derived(renderCharacterFrames(project, previewAction, 'small'));
	const progressLabel = $derived(
		progress
			? `Exporting ${progress.done} of ${progress.total}`
			: exporting
				? 'Starting export'
				: ''
	);

	$effect(() => {
		if (!canvas) return;
		const frame = previewFrames[frameIndex % previewFrames.length];
		canvas.width = frame.width;
		canvas.height = frame.height;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.clearRect(0, 0, frame.width, frame.height);
		ctx.putImageData(
			new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height),
			0,
			0
		);
	});

	$effect(() => {
		let raf = 0;
		let last = performance.now();
		function tick(now: number) {
			const frame = previewFrames[frameIndex % previewFrames.length];
			if (now - last >= frame.durationMs) {
				frameIndex = (frameIndex + 1) % previewFrames.length;
				last = now;
			}
			raf = requestAnimationFrame(tick);
		}
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});

	$effect(() => {
		return () => {
			for (const file of files) URL.revokeObjectURL(file.url);
		};
	});

	function patch(partial: Partial<PixelCharacterProject>): void {
		project = updateProject(project, partial);
		frameIndex = 0;
	}

	function patchPalette(key: keyof CharacterPalette, color: string): void {
		patch({ palette: { ...project.palette, [key]: color } });
	}

	function toggleAccessory(accessory: AccessoryPreset): void {
		const next = project.accessories.includes(accessory)
			? project.accessories.filter((item) => item !== accessory)
			: [...project.accessories, accessory].slice(0, 4);
		patch({ accessories: next });
	}

	function toggleAction(action: CharacterAction): void {
		exportActions = exportActions.includes(action)
			? exportActions.filter((item) => item !== action)
			: [...exportActions, action];
	}

	function toggleSize(size: CharacterExportSize): void {
		exportSizes = exportSizes.includes(size)
			? exportSizes.filter((item) => item !== size)
			: [...exportSizes, size];
	}

	function snapshotProject(value: PixelCharacterProject): PixelCharacterProject {
		return {
			...value,
			accessories: [...value.accessories],
			palette: { ...value.palette }
		};
	}

	async function exportFiles(): Promise<void> {
		if (!exportActions.length || !exportSizes.length) {
			error = 'Choose at least one move and one size.';
			return;
		}
		error = null;
		exporting = true;
		progress = { done: 0, total: exportActions.length * exportSizes.length * 2 };
		for (const file of files) URL.revokeObjectURL(file.url);
		files = [];
		try {
			const exported = await exportWithWorker(
				{
					project: snapshotProject(project),
					actions: [...exportActions],
					sizes: [...exportSizes]
				},
				(done, total) => (progress = { done, total })
			);
			files = exported.map((file) => ({ ...file, url: URL.createObjectURL(file.blob) }));
		} catch (err) {
			error = err instanceof Error ? err.message : 'Export failed.';
		} finally {
			exporting = false;
		}
	}

	async function exportWithWorker(
		request: CharacterExportRequest,
		onProgress: (done: number, total: number) => void
	): Promise<CharacterExportFile[]> {
		if (typeof Worker === 'undefined') {
			const { exportCharacterSet } = await import('./export');
			return exportCharacterSet(request, onProgress);
		}
		return new Promise((resolve, reject) => {
			const id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
			const worker = new Worker(new URL('./export.worker.ts', import.meta.url), { type: 'module' });
			worker.onmessage = (
				event: MessageEvent<
					| { id: string; type: 'progress'; done: number; total: number }
					| { id: string; type: 'done'; files: CharacterExportFile[] }
					| { id: string; type: 'error'; message: string }
				>
			) => {
				if (event.data.id !== id) return;
				if (event.data.type === 'progress') onProgress(event.data.done, event.data.total);
				if (event.data.type === 'done') {
					worker.terminate();
					resolve(event.data.files);
				}
				if (event.data.type === 'error') {
					worker.terminate();
					reject(new Error(event.data.message));
				}
			};
			worker.onerror = () => {
				worker.terminate();
				reject(new Error('Character export worker failed.'));
			};
			worker.postMessage({ id, request });
		});
	}
</script>

<div
	class="character-builder"
	role="dialog"
	aria-modal="true"
	aria-labelledby="character-builder-title"
>
	<div class="character-builder__panel">
		<header>
			<div>
				<p>Pixel character</p>
				<h2 id="character-builder-title">Make a tiny runner</h2>
			</div>
			<button type="button" onclick={onClose} aria-label="Close character builder">Close</button>
		</header>

		<div class="character-builder__body">
			<section class="preview" aria-label="Character preview">
				<div class="preview__stage">
					<canvas bind:this={canvas} aria-label="Animated pixel character preview"></canvas>
				</div>
				<div class="preview__actions" role="group" aria-label="Preview move">
					{#each CHARACTER_ACTIONS as action (action)}
						<button
							type="button"
							aria-pressed={previewAction === action}
							onclick={() => {
								previewAction = action;
								frameIndex = 0;
							}}
						>
							{ACTION_LABELS[action]}
						</button>
					{/each}
				</div>
			</section>

			<section class="controls" aria-label="Character controls">
				<label>
					<span>Name</span>
					<input
						value={project.name}
						oninput={(event) => patch({ name: event.currentTarget.value || 'Pixel runner' })}
					/>
				</label>

				<div class="control-group">
					<h3>Body</h3>
					<div class="chips">
						{#each BODY_PRESETS as body (body)}
							<button
								type="button"
								aria-pressed={project.body === body}
								onclick={() => patch({ body })}
							>
								{BODY_LABELS[body]}
							</button>
						{/each}
					</div>
				</div>

				<div class="control-group">
					<h3>Hair</h3>
					<div class="chips">
						{#each HAIR_PRESETS as hair (hair)}
							<button
								type="button"
								aria-pressed={project.hair === hair}
								onclick={() => patch({ hair })}
							>
								{HAIR_LABELS[hair]}
							</button>
						{/each}
					</div>
				</div>

				<div class="control-group">
					<h3>Clothes</h3>
					<div class="chips">
						{#each OUTFIT_PRESETS as outfit (outfit)}
							<button
								type="button"
								aria-pressed={project.outfit === outfit}
								onclick={() => patch({ outfit })}
							>
								{OUTFIT_LABELS[outfit]}
							</button>
						{/each}
					</div>
				</div>

				<div class="control-group">
					<h3>Extras</h3>
					<div class="chips">
						{#each ACCESSORY_PRESETS as accessory (accessory)}
							<button
								type="button"
								aria-pressed={project.accessories.includes(accessory)}
								onclick={() => toggleAccessory(accessory)}
							>
								{ACCESSORY_LABELS[accessory]}
							</button>
						{/each}
					</div>
				</div>

				<div class="control-group">
					<h3>Held thing</h3>
					<div class="chips">
						{#each PROP_PRESETS as prop (prop)}
							<button
								type="button"
								aria-pressed={project.prop === prop}
								onclick={() => patch({ prop })}
							>
								{PROP_LABELS[prop]}
							</button>
						{/each}
					</div>
				</div>

				<div class="control-group">
					<h3>Colors</h3>
					<div class="color-grid">
						{#each Object.entries(project.palette) as [key, color] (key)}
							<label>
								<span>{key}</span>
								<input
									type="color"
									value={color}
									oninput={(event) =>
										patchPalette(key as keyof CharacterPalette, event.currentTarget.value)}
								/>
							</label>
						{/each}
					</div>
				</div>
			</section>

			<section class="export" aria-label="Export character">
				<div class="control-group">
					<h3>Moves to export</h3>
					<div class="chips">
						{#each CHARACTER_ACTIONS as action (action)}
							<button
								type="button"
								aria-pressed={exportActions.includes(action)}
								onclick={() => toggleAction(action)}
							>
								{ACTION_LABELS[action]}
							</button>
						{/each}
					</div>
				</div>

				<div class="control-group">
					<h3>Sizes</h3>
					<div class="chips">
						{#each CHARACTER_EXPORT_SIZES as size (size)}
							<button
								type="button"
								aria-pressed={exportSizes.includes(size)}
								onclick={() => toggleSize(size)}
							>
								{SIZE_LABELS[size]}
							</button>
						{/each}
					</div>
				</div>

				<button type="button" class="export-button" disabled={exporting} onclick={exportFiles}>
					{exporting ? progressLabel : 'Export GIFs'}
				</button>
				<p class="note">
					Downloads are local files for now. They are not inserted into the zine until media upload
					can save them as approved assets.
				</p>
				{#if error}<p class="error" role="alert">{error}</p>{/if}

				{#if files.length}
					<div class="downloads">
						<h3>Downloads</h3>
						{#each files as file (file.fileName)}
							<a href={file.url} download={file.fileName}>
								<span>{file.fileName}</span>
								<small>{file.width} x {file.height}</small>
							</a>
						{/each}
					</div>
				{/if}
			</section>
		</div>
	</div>
</div>

<style>
	.character-builder {
		position: fixed;
		inset: 0;
		z-index: 40;
		display: grid;
		place-items: center;
		background: oklch(0.18 0.04 275 / 0.62);
		padding: 1rem;
	}

	.character-builder__panel {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		width: min(1180px, 100%);
		max-height: min(860px, calc(100svh - 2rem));
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		box-shadow: 0.25rem 0.25rem 0 var(--pixel-ink);
		overflow: hidden;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		border-bottom: 2px solid var(--pixel-ink);
		background: oklch(0.94 0.04 84);
		padding: 0.9rem 1rem;
	}

	header p,
	h2,
	h3 {
		margin: 0;
	}

	header p {
		font-family: var(--pixel-font-ui);
		font-size: 0.72rem;
		font-weight: 850;
		text-transform: uppercase;
		color: hsl(var(--muted-foreground));
	}

	h2 {
		font-size: 1.2rem;
		font-weight: 950;
	}

	h3 {
		font-size: 0.84rem;
		font-weight: 900;
	}

	button,
	a {
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		color: hsl(var(--foreground));
		box-shadow: 0.08rem 0.08rem 0 var(--pixel-ink);
		font-family: var(--pixel-font-ui);
		font-weight: 850;
		text-decoration: none;
	}

	button {
		cursor: pointer;
	}

	button:disabled {
		cursor: wait;
		opacity: 0.68;
	}

	button[aria-pressed='true'] {
		background: var(--pixel-yellow);
	}

	.character-builder__body {
		display: grid;
		grid-template-columns: minmax(260px, 0.9fr) minmax(320px, 1.2fr) minmax(270px, 0.9fr);
		min-height: 0;
		overflow: auto;
	}

	.preview,
	.controls,
	.export {
		display: grid;
		align-content: start;
		gap: 1rem;
		padding: 1rem;
	}

	.preview,
	.controls {
		border-right: 2px solid oklch(0.24 0.065 281 / 0.2);
	}

	.preview__stage {
		display: grid;
		place-items: center;
		min-height: 320px;
		border: 2px solid var(--pixel-ink);
		background:
			linear-gradient(45deg, oklch(0.88 0.02 260) 25%, transparent 25%),
			linear-gradient(-45deg, oklch(0.88 0.02 260) 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, oklch(0.88 0.02 260) 75%),
			linear-gradient(-45deg, transparent 75%, oklch(0.88 0.02 260) 75%), oklch(0.98 0.01 90);
		background-position:
			0 0,
			0 8px,
			8px -8px,
			-8px 0;
		background-size: 16px 16px;
	}

	canvas {
		width: 192px;
		height: 256px;
		image-rendering: pixelated;
	}

	.preview__actions,
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.preview__actions button,
	.chips button {
		padding: 0.42rem 0.58rem;
		font-size: 0.78rem;
	}

	label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.8rem;
		font-weight: 850;
	}

	input {
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: oklch(0.97 0.02 82);
		padding: 0.55rem 0.65rem;
		color: hsl(var(--foreground));
	}

	input[type='color'] {
		width: 100%;
		min-height: 2.2rem;
		padding: 0.15rem;
	}

	.control-group {
		display: grid;
		gap: 0.5rem;
	}

	.color-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.55rem;
	}

	.color-grid span {
		text-transform: capitalize;
	}

	.export-button {
		padding: 0.68rem 0.8rem;
		background: var(--pixel-green);
	}

	.note,
	.error {
		margin: 0;
		font-size: 0.78rem;
		line-height: 1.45;
	}

	.note {
		color: hsl(var(--muted-foreground));
	}

	.error {
		color: oklch(0.45 0.16 27);
		font-weight: 800;
	}

	.downloads {
		display: grid;
		gap: 0.5rem;
	}

	.downloads a {
		display: grid;
		grid-template-columns: minmax(0, 1fr) max-content;
		gap: 0.5rem;
		align-items: center;
		padding: 0.5rem 0.6rem;
		font-size: 0.78rem;
	}

	.downloads span {
		overflow-wrap: anywhere;
	}

	.downloads small {
		color: hsl(var(--muted-foreground));
	}

	@media (max-width: 900px) {
		.character-builder__body {
			grid-template-columns: 1fr;
		}

		.preview,
		.controls {
			border-right: 0;
			border-bottom: 2px solid oklch(0.24 0.065 281 / 0.2);
		}
	}
</style>
