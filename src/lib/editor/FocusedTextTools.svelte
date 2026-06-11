<script lang="ts">
	import ZineRenderer from '$lib/zine/render/ZineRenderer.svelte';
	import { defaultContentRole } from '$lib/zine/render/typeset';
	import type { TextFrameTarget } from '$lib/zine/schema/block';
	import type { Block } from '$lib/zine/schema/document';
	import { resolveThemeColors, themeSwatches } from '$lib/zine/theme/registry';
	import type {
		BlockStyle,
		SmsFrameGroup,
		SmsFrameSide,
		SpeechFrameMode,
		SpeechFrameTail,
		TextBackdropShape,
		TextFrame,
		TextFrameFill,
		TextFrameOutline,
		TextKind,
		Theme,
		ThemeColors,
		Typeset,
		TypesetRole
	} from '$lib/zine/schema/theme';
	import type { ZineDocument } from '$lib/zine/schema/document';

	let {
		block,
		style,
		textKind = 'content',
		theme,
		frameTargetOptions = [],
		onStyleChange,
		onTextKindChange
	}: {
		block: Pick<Block, 'id' | 'type' | 'props'>;
		style?: BlockStyle;
		textKind?: TextKind;
		theme?: Theme;
		frameTargetOptions?: TextFrameTarget[];
		onStyleChange?: (next: BlockStyle) => void;
		onTextKindChange?: (kind: TextKind) => void;
	} = $props();

	const typeset = $derived(style?.typeset);
	const effectiveRole = $derived<TypesetRole | undefined>(
		textKind === 'content'
			? (typeset?.role ?? defaultContentRole(block.type, block.props))
			: undefined
	);
	const tidyOn = $derived(
		typeset?.tidyWrap ??
			(effectiveRole === 'headline' ||
				effectiveRole === 'subhead' ||
				effectiveRole === 'deck' ||
				effectiveRole === 'body')
	);
	const backdrop = $derived(style?.textBackdrop);
	const textFrame = $derived(style?.textFrame);
	const themeColors = $derived(resolveThemeColors(theme));
	const colorSwatches = $derived(themeSwatches(theme));
	const effectiveTextColor = $derived(
		style?.textColor ?? defaultTextColor(effectiveRole, block.type, themeColors)
	);
	const effectiveBackdropColor = $derived(
		backdrop
			? blendHex(backdrop.color, themeColors.background, backdrop.opacity)
			: themeColors.background
	);
	const textContrast = $derived(contrastRatio(effectiveTextColor, effectiveBackdropColor));
	const textContrastOk = $derived(!backdrop || textContrast >= 4.5);

	const roleLabels: Record<TypesetRole, string> = {
		headline: 'Headline',
		subhead: 'Section heading',
		kicker: 'Tiny label',
		deck: 'Intro',
		body: 'Body',
		pullquote: 'Big quote',
		blockquote: 'Quote block',
		caption: 'Caption',
		byline: 'Credit'
	};
	const roleOptions = $derived<TypesetRole[]>(
		block.type === 'heading'
			? ['headline', 'subhead', 'kicker', 'deck']
			: block.type === 'richText'
				? ['deck', 'body', 'pullquote', 'blockquote', 'caption', 'byline']
				: []
	);
	const aligns: { v: NonNullable<BlockStyle['align']>; l: string }[] = [
		{ v: 'left', l: 'Left' },
		{ v: 'center', l: 'Center' },
		{ v: 'right', l: 'Right' },
		{ v: 'justify', l: 'Even edges' }
	];
	const measures: { v: 'narrow' | 'medium' | 'wide'; l: string }[] = [
		{ v: 'narrow', l: 'Narrow' },
		{ v: 'medium', l: 'Medium' },
		{ v: 'wide', l: 'Wide' }
	];
	const leadings: { v: 'tight' | 'cozy' | 'airy'; l: string }[] = [
		{ v: 'tight', l: 'Tight' },
		{ v: 'cozy', l: 'Cozy' },
		{ v: 'airy', l: 'Airy' }
	];
	const cases: { v: 'normal' | 'upper' | 'smallcaps'; l: string }[] = [
		{ v: 'normal', l: 'Normal' },
		{ v: 'upper', l: 'ALL CAPS' },
		{ v: 'smallcaps', l: 'Small caps' }
	];
	const backdropShapes: { v: TextBackdropShape | 'none'; l: string }[] = [
		{ v: 'none', l: 'None' },
		{ v: 'box', l: 'Box' },
		{ v: 'circle', l: 'Circle' }
	];
	const frameChoices: { v: 'none' | 'speech' | 'thought' | 'sms'; l: string }[] = [
		{ v: 'none', l: 'None' },
		{ v: 'speech', l: 'Speech bubble' },
		{ v: 'thought', l: 'Thought bubble' },
		{ v: 'sms', l: 'Text message' }
	];
	const speechTails: { v: SpeechFrameTail; l: string }[] = [
		{ v: 'none', l: 'No tail' },
		{ v: 'top-left', l: 'Top left' },
		{ v: 'top', l: 'Top' },
		{ v: 'top-right', l: 'Top right' },
		{ v: 'right', l: 'Right' },
		{ v: 'bottom-right', l: 'Bottom right' },
		{ v: 'bottom', l: 'Bottom' },
		{ v: 'bottom-left', l: 'Bottom left' },
		{ v: 'left', l: 'Left' }
	];
	const frameFills: { v: TextFrameFill; l: string }[] = [
		{ v: 'paper', l: 'Paper' },
		{ v: 'theme', l: 'Soft theme' },
		{ v: 'accent', l: 'Accent' },
		{ v: 'message', l: 'Message app' },
		{ v: 'custom', l: 'Custom' }
	];
	const frameFillsForCurrent = $derived(
		textFrame?.kind === 'sms' ? frameFills : frameFills.filter((fill) => fill.v !== 'message')
	);
	const smsSides: { v: SmsFrameSide; l: string }[] = [
		{ v: 'incoming', l: 'Left side' },
		{ v: 'outgoing', l: 'Right side' }
	];
	const smsGroups: { v: SmsFrameGroup; l: string }[] = [
		{ v: 'single', l: 'Single' },
		{ v: 'first', l: 'First' },
		{ v: 'middle', l: 'Middle' },
		{ v: 'last', l: 'Last' }
	];
	const outlines: { v: TextFrameOutline; l: string }[] = [
		{ v: 'clean', l: 'Clean' },
		{ v: 'sketch', l: 'Sketchy' }
	];
	const RECOMMENDED_BACKDROP_PADDING = 1;
	const MAX_BACKDROP_PADDING = 4;
	const RECOMMENDED_FRAME_PADDING = 1;
	const MAX_FRAME_PADDING = 4;

	const previewDocument = $derived<ZineDocument>({
		schemaVersion: 7,
		theme,
		acts: [
			{
				id: 'act_text_preview',
				scenes: [
					{
						id: 'scn_text_preview',
						type: 'page',
						length: 'auto',
						beats: [{ id: 'beat_text_preview', at: 0 }],
						elements: [
							{
								id: 'el_text_preview',
								track: 'content',
								range: { start: 0, end: 1 },
								block: {
									id: 'blk_text_preview',
									type: block.type,
									props: block.props,
									style
								} as Block
							}
						]
					}
				]
			}
		]
	});

	function emitStyle(next: BlockStyle): void {
		onStyleChange?.(next);
	}

	function setAlign(align: NonNullable<BlockStyle['align']>): void {
		emitStyle({ ...(style ?? {}), align });
	}

	function setTypeset(partial: Partial<Typeset>): void {
		const nextTypeset: Typeset = { ...(style?.typeset ?? {}), kind: 'content', ...partial };
		const next: BlockStyle = {
			...(style ?? {}),
			typeset: nextTypeset
		};
		for (const key of Object.keys(nextTypeset) as (keyof Typeset)[]) {
			if (nextTypeset[key] === undefined || nextTypeset[key] === null) {
				delete nextTypeset[key];
			}
		}
		emitStyle(next);
	}

	function setTextKind(kind: TextKind): void {
		if (kind === 'content' && style?.textFrame) {
			const next: BlockStyle = { ...(style ?? {}) };
			delete next.textFrame;
			emitStyle(next);
		}
		onTextKindChange?.(kind);
	}

	function setBackdropShape(shape: TextBackdropShape | 'none'): void {
		const next: BlockStyle = { ...(style ?? {}) };
		if (shape === 'none') {
			delete next.textBackdrop;
		} else {
			next.textBackdrop = {
				shape,
				color: backdrop?.color ?? '#14181f',
				opacity: backdrop?.opacity ?? 0.72,
				padding: backdrop?.padding ?? RECOMMENDED_BACKDROP_PADDING
			};
		}
		emitStyle(next);
	}

	function selectedFrameChoice(): 'none' | 'speech' | 'thought' | 'sms' {
		if (!textFrame) return 'none';
		if (textFrame.kind === 'sms') return 'sms';
		return textFrame.mode === 'thought' ? 'thought' : 'speech';
	}

	function setTextFrame(choice: 'none' | 'speech' | 'thought' | 'sms'): void {
		const next: BlockStyle = { ...(style ?? {}), typeset: { kind: 'other' } };
		delete next.textBackdrop;
		if (choice === 'none') {
			delete next.textFrame;
		} else if (choice === 'sms') {
			next.textFrame = {
				kind: 'sms',
				side: 'incoming',
				group: 'single',
				fill: 'message',
				padding: 0.8
			};
		} else {
			const targetId = frameTargetOptions[0]?.id;
			next.textFrame = {
				kind: 'speech',
				mode: choice as SpeechFrameMode,
				tail: targetId ? 'auto' : choice === 'thought' ? 'none' : 'bottom-left',
				speakerElementId: targetId,
				outline: 'clean',
				fill: 'paper',
				padding: RECOMMENDED_FRAME_PADDING
			};
		}
		onTextKindChange?.('other');
		emitStyle(next);
	}

	function updateTextFrame(partial: Partial<TextFrame>): void {
		if (!textFrame) return;
		emitStyle({
			...(style ?? {}),
			typeset: { kind: 'other' },
			textFrame: { ...textFrame, ...partial } as TextFrame
		});
	}

	function updateSpeechFrame(partial: Partial<Extract<TextFrame, { kind: 'speech' }>>): void {
		if (textFrame?.kind !== 'speech') return;
		updateTextFrame({ ...partial, kind: 'speech' });
	}

	function setSpeechTarget(targetId: string): void {
		if (textFrame?.kind !== 'speech') return;
		updateSpeechFrame({
			speakerElementId: targetId || undefined,
			tail: targetId
				? 'auto'
				: textFrame.tail === 'auto'
					? textFrame.mode === 'thought'
						? 'none'
						: 'bottom-left'
					: textFrame.tail
		});
	}

	function updateSmsFrame(partial: Partial<Extract<TextFrame, { kind: 'sms' }>>): void {
		if (textFrame?.kind !== 'sms') return;
		updateTextFrame({ ...partial, kind: 'sms' });
	}

	function setTextFrameColor(color: string): void {
		if (!textFrame) return;
		updateTextFrame({ color } as Partial<TextFrame>);
	}

	function setTextFramePadding(padding: number): void {
		if (!textFrame) return;
		updateTextFrame({
			padding: Math.max(0, Math.min(MAX_FRAME_PADDING, padding))
		} as Partial<TextFrame>);
	}

	function setTextColor(color: string): void {
		emitStyle({ ...(style ?? {}), textColor: color });
	}

	function clearTextColor(): void {
		const next: BlockStyle = { ...(style ?? {}) };
		delete next.textColor;
		emitStyle(next);
	}

	function setBackdropColor(color: string): void {
		if (!backdrop) return;
		emitStyle({ ...(style ?? {}), textBackdrop: { ...backdrop, color } });
	}

	function setBackdropOpacity(opacity: number): void {
		if (!backdrop) return;
		emitStyle({ ...(style ?? {}), textBackdrop: { ...backdrop, opacity } });
	}

	function setBackdropPadding(padding: number): void {
		if (!backdrop) return;
		emitStyle({
			...(style ?? {}),
			textBackdrop: { ...backdrop, padding: Math.max(0, Math.min(MAX_BACKDROP_PADDING, padding)) }
		});
	}

	function paddingLabel(value: number | undefined): string {
		const padding = value ?? RECOMMENDED_BACKDROP_PADDING;
		if (Math.abs(padding - RECOMMENDED_BACKDROP_PADDING) < 0.01) return 'Recommended';
		if (padding < RECOMMENDED_BACKDROP_PADDING) {
			return `${Math.round((1 - padding) * 100)}% less`;
		}
		return `${Math.round((padding - 1) * 100)}% more`;
	}

	function defaultTextColor(
		role: TypesetRole | undefined,
		blockType: string,
		colors: ThemeColors
	): string {
		if (role === 'kicker') return colors.accent;
		if (role === 'deck' || role === 'blockquote' || role === 'caption' || role === 'byline') {
			return colors.muted;
		}
		if (
			role === 'headline' ||
			role === 'subhead' ||
			role === 'pullquote' ||
			blockType === 'heading'
		) {
			return colors.heading;
		}
		return colors.text;
	}

	function parseHex(hex: string): [number, number, number] {
		let value = hex.replace('#', '').trim();
		if (value.length === 3)
			value = value
				.split('')
				.map((char) => char + char)
				.join('');
		const n = Number.parseInt(value, 16);
		if (Number.isNaN(n)) return [0, 0, 0];
		return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	}

	function toHex([r, g, b]: [number, number, number]): string {
		return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
	}

	function blendHex(fg: string, bg: string, alpha: number): string {
		const f = parseHex(fg);
		const b = parseHex(bg);
		return toHex([
			f[0] * alpha + b[0] * (1 - alpha),
			f[1] * alpha + b[1] * (1 - alpha),
			f[2] * alpha + b[2] * (1 - alpha)
		]);
	}

	function channelToLinear(value: number): number {
		const channel = value / 255;
		return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	}

	function luminance(hex: string): number {
		const [r, g, b] = parseHex(hex).map(channelToLinear);
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	}

	function contrastRatio(a: string, b: string): number {
		const l1 = luminance(a);
		const l2 = luminance(b);
		const light = Math.max(l1, l2);
		const dark = Math.min(l1, l2);
		return (light + 0.05) / (dark + 0.05);
	}
</script>

<section class="text-tools" aria-label="Text tools">
	<div class="text-tools__panel">
		<div class="text-tools__row">
			<span class="text-tools__label">Text kind</span>
			<div class="text-kind-choices" role="group" aria-label="Text kind">
				<button
					type="button"
					aria-pressed={textKind === 'content'}
					onclick={() => setTextKind('content')}
				>
					<span>Content text</span>
					<small>Article, caption, quote</small>
				</button>
				<button
					type="button"
					aria-pressed={textKind === 'other'}
					onclick={() => setTextKind('other')}
				>
					<span>Other text</span>
					<small>Label, sticker, diagram note</small>
				</button>
			</div>
		</div>

		{#if textKind === 'other' || textFrame}
			<div class="text-tools__row">
				<span class="text-tools__label">Special style</span>
				<div class="chips" role="group" aria-label="Special text style">
					{#each frameChoices as choice (choice.v)}
						<button
							type="button"
							aria-pressed={selectedFrameChoice() === choice.v}
							onclick={() => setTextFrame(choice.v)}
						>
							{choice.l}
						</button>
					{/each}
				</div>
				{#if textFrame}
					<div class="frame-tools">
						<div class="chips" role="group" aria-label="Bubble fill">
							{#each frameFillsForCurrent as fill (fill.v)}
								<button
									type="button"
									aria-pressed={textFrame.fill === fill.v}
									onclick={() => updateTextFrame({ fill: fill.v } as Partial<TextFrame>)}
								>
									{fill.l}
								</button>
							{/each}
						</div>

						{#if textFrame.fill === 'custom'}
							<label class="custom-color">
								<span>Custom fill</span>
								<input
									type="color"
									aria-label="Custom bubble color"
									value={textFrame.color ?? themeColors.background}
									oninput={(event) => setTextFrameColor(event.currentTarget.value)}
								/>
							</label>
						{/if}

						<div class="background-padding">
							<div class="background-padding__topline">
								<span>Bubble padding</span>
								<button
									type="button"
									disabled={Math.abs(
										(textFrame.padding ?? RECOMMENDED_FRAME_PADDING) - RECOMMENDED_FRAME_PADDING
									) < 0.01}
									onclick={() => setTextFramePadding(RECOMMENDED_FRAME_PADDING)}
								>
									Reset
								</button>
							</div>
							<input
								type="range"
								aria-label="Bubble padding"
								min="0"
								max={MAX_FRAME_PADDING}
								step="0.05"
								value={textFrame.padding ?? RECOMMENDED_FRAME_PADDING}
								oninput={(event) => setTextFramePadding(Number(event.currentTarget.value))}
							/>
							<output>{paddingLabel(textFrame.padding ?? RECOMMENDED_FRAME_PADDING)}</output>
						</div>

						{#if textFrame.kind === 'speech'}
							<div class="chips" role="group" aria-label="Bubble outline">
								{#each outlines as outline (outline.v)}
									<button
										type="button"
										aria-pressed={textFrame.outline === outline.v}
										onclick={() => updateSpeechFrame({ outline: outline.v })}
									>
										{outline.l}
									</button>
								{/each}
							</div>
							{#if frameTargetOptions.length}
								<label class="text-input">
									<span>Points to</span>
									<select
										aria-label="Speech bubble points to"
										value={textFrame.speakerElementId ?? ''}
										onchange={(event) => setSpeechTarget(event.currentTarget.value)}
									>
										<option value="">No speaker</option>
										{#each frameTargetOptions as target (target.id)}
											<option value={target.id}>{target.label}</option>
										{/each}
									</select>
								</label>
							{/if}
							{#if textFrame.mode === 'speech' && !textFrame.speakerElementId}
								<div class="chips" role="group" aria-label="Bubble tail">
									{#each speechTails as tail (tail.v)}
										<button
											type="button"
											aria-pressed={textFrame.tail === tail.v}
											onclick={() => updateSpeechFrame({ tail: tail.v })}
										>
											{tail.l}
										</button>
									{/each}
								</div>
							{/if}
						{:else}
							<div class="chips" role="group" aria-label="Message side">
								{#each smsSides as side (side.v)}
									<button
										type="button"
										aria-pressed={textFrame.side === side.v}
										onclick={() => updateSmsFrame({ side: side.v })}
									>
										{side.l}
									</button>
								{/each}
							</div>
							<div class="chips" role="group" aria-label="Message group">
								{#each smsGroups as group (group.v)}
									<button
										type="button"
										aria-pressed={textFrame.group === group.v}
										onclick={() => updateSmsFrame({ group: group.v })}
									>
										{group.l}
									</button>
								{/each}
							</div>
							<label class="text-input">
								<span>Sender name</span>
								<input
									type="text"
									aria-label="Sender name"
									value={textFrame.senderName ?? ''}
									maxlength="48"
									oninput={(event) =>
										updateSmsFrame({ senderName: event.currentTarget.value || undefined })}
								/>
							</label>
							<label class="text-input">
								<span>Sender picture URL</span>
								<input
									type="url"
									aria-label="Sender picture URL"
									value={textFrame.senderAvatar?.src ?? ''}
									oninput={(event) =>
										updateSmsFrame({
											senderAvatar: event.currentTarget.value
												? {
														...(textFrame.senderAvatar ?? {}),
														src: event.currentTarget.value,
														alt: textFrame.senderAvatar?.alt ?? ''
													}
												: undefined
										})}
								/>
							</label>
							{#if textFrame.senderAvatar?.src}
								<label class="text-input">
									<span>Picture description</span>
									<input
										type="text"
										aria-label="Sender picture description"
										value={textFrame.senderAvatar.alt ?? ''}
										maxlength="160"
										oninput={(event) =>
											updateSmsFrame({
												senderAvatar: {
													...textFrame.senderAvatar,
													alt: event.currentTarget.value
												}
											})}
									/>
								</label>
							{/if}
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		<div class="text-tools__row">
			<span class="text-tools__label">Alignment</span>
			<div class="chips" role="group" aria-label="Alignment">
				{#each aligns as a (a.v)}
					<button
						type="button"
						aria-pressed={style?.align === a.v || (!style?.align && a.v === 'left')}
						onclick={() => setAlign(a.v)}
					>
						{a.l}
					</button>
				{/each}
			</div>
		</div>

		<div class="text-tools__row">
			<span class="text-tools__label">Text color</span>
			<div class="color-tools">
				<button
					type="button"
					class="default-color-button"
					aria-pressed={!style?.textColor}
					onclick={clearTextColor}
				>
					Default
				</button>
				<div>
					<span class="text-tools__subtle-label">Theme colors</span>
					<div class="color-swatches" role="group" aria-label="Text theme colors">
						{#each colorSwatches as sw, i (`text-${sw}-${i}`)}
							<button
								type="button"
								class:selected={style?.textColor?.toLowerCase() === sw.toLowerCase()}
								style:background={sw}
								aria-label="Use {sw} for text"
								onclick={() => setTextColor(sw)}
							></button>
						{/each}
					</div>
				</div>
				<label class="custom-color">
					<span>Custom color</span>
					<input
						type="color"
						aria-label="Custom text color"
						value={style?.textColor ?? effectiveTextColor}
						oninput={(event) => setTextColor(event.currentTarget.value)}
					/>
				</label>
			</div>
		</div>

		{#if textKind === 'content'}
			<div class="text-tools__row">
				<span class="text-tools__label">Style</span>
				<div class="chips" role="group" aria-label="Text style">
					<button
						type="button"
						aria-pressed={!typeset?.role}
						onclick={() => setTypeset({ role: undefined })}
					>
						Default
					</button>
					{#each roleOptions as r (r)}
						<button
							type="button"
							aria-pressed={effectiveRole === r}
							onclick={() => setTypeset({ role: r })}
						>
							{roleLabels[r]}
						</button>
					{/each}
				</div>
			</div>
			<div class="text-tools__row">
				<span class="text-tools__label">Column width</span>
				<div class="chips" role="group" aria-label="Column width">
					{#each measures as m (m.v)}
						<button
							type="button"
							aria-pressed={typeset?.measure === m.v}
							onclick={() => setTypeset({ measure: m.v })}
						>
							{m.l}
						</button>
					{/each}
				</div>
			</div>
			<div class="text-tools__row">
				<span class="text-tools__label">Line spacing</span>
				<div class="chips" role="group" aria-label="Line spacing">
					{#each leadings as l (l.v)}
						<button
							type="button"
							aria-pressed={typeset?.leading === l.v}
							onclick={() => setTypeset({ leading: l.v })}
						>
							{l.l}
						</button>
					{/each}
				</div>
			</div>
			<div class="text-tools__row">
				<span class="text-tools__label">Letters</span>
				<div class="chips" role="group" aria-label="Letters">
					{#each cases as c (c.v)}
						<button
							type="button"
							aria-pressed={(typeset?.case ?? 'normal') === c.v}
							onclick={() => setTypeset({ case: c.v })}
						>
							{c.l}
						</button>
					{/each}
				</div>
			</div>
			<div class="text-tools__row">
				<span class="text-tools__label">Tidy line breaks</span>
				<div class="chips" role="group" aria-label="Tidy line breaks">
					<button type="button" aria-pressed={tidyOn} onclick={() => setTypeset({ tidyWrap: true })}
						>On</button
					>
					<button
						type="button"
						aria-pressed={!tidyOn}
						onclick={() => setTypeset({ tidyWrap: false })}>Off</button
					>
				</div>
			</div>
		{/if}

		<div class="text-tools__row">
			<span class="text-tools__label">Background</span>
			<div class="chips" role="group" aria-label="Text background">
				{#each backdropShapes as shape (shape.v)}
					<button
						type="button"
						aria-pressed={shape.v === 'none' ? !backdrop : backdrop?.shape === shape.v}
						onclick={() => setBackdropShape(shape.v)}
					>
						{shape.l}
					</button>
				{/each}
			</div>
			{#if backdrop}
				<div class="background-tools">
					<div>
						<span class="text-tools__subtle-label">Theme colors</span>
						<div class="color-swatches" role="group" aria-label="Background theme colors">
							{#each colorSwatches as sw, i (`background-${sw}-${i}`)}
								<button
									type="button"
									class:selected={backdrop.color.toLowerCase() === sw.toLowerCase()}
									style:background={sw}
									aria-label="Use {sw} for background"
									onclick={() => setBackdropColor(sw)}
								></button>
							{/each}
						</div>
					</div>

					<label class="custom-color">
						<span>Custom color</span>
						<input
							type="color"
							aria-label="Custom background color"
							value={backdrop.color}
							oninput={(event) => setBackdropColor(event.currentTarget.value)}
						/>
					</label>

					<div class="background-padding">
						<div class="background-padding__topline">
							<span>Padding</span>
							<button
								type="button"
								disabled={Math.abs(
									(backdrop.padding ?? RECOMMENDED_BACKDROP_PADDING) - RECOMMENDED_BACKDROP_PADDING
								) < 0.01}
								onclick={() => setBackdropPadding(RECOMMENDED_BACKDROP_PADDING)}
							>
								Reset
							</button>
						</div>
						<input
							type="range"
							aria-label="Background padding"
							min="0"
							max={MAX_BACKDROP_PADDING}
							step="0.05"
							value={backdrop.padding ?? RECOMMENDED_BACKDROP_PADDING}
							oninput={(event) => setBackdropPadding(Number(event.currentTarget.value))}
						/>
						<output>{paddingLabel(backdrop.padding)}</output>
					</div>

					<label class="backdrop-opacity">
						<span>Opacity</span>
						<input
							type="range"
							aria-label="Background opacity"
							min="0"
							max="1"
							step="0.05"
							value={backdrop.opacity}
							oninput={(event) => setBackdropOpacity(Number(event.currentTarget.value))}
						/>
						<output>{Math.round(backdrop.opacity * 100)}%</output>
					</label>

					{#if !textContrastOk}
						<p class="contrast-warning" role="status">
							Text and background need more contrast. Try a lighter or darker color.
							<span>{textContrast.toFixed(1)}:1</span>
						</p>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<div class="text-preview" aria-label="Text preview">
		<div class="text-preview__chrome">
			<span>Preview</span>
		</div>
		<div class="text-preview__surface">
			<ZineRenderer document={previewDocument} pinScenes={false} />
		</div>
	</div>
</section>

<style>
	.text-tools {
		display: grid;
		grid-template-columns: minmax(15rem, 0.78fr) minmax(18rem, 1fr);
		gap: 0.85rem;
		min-height: 0;
	}
	.text-tools__panel {
		display: grid;
		align-content: start;
		gap: 0.58rem;
		overflow: auto;
		min-height: 0;
		border-right: 2px solid var(--pixel-ink);
		padding: 0.75rem 0.85rem 0.85rem;
	}
	.text-tools__row {
		display: grid;
		gap: 0.28rem;
	}
	.text-tools__label {
		color: hsl(var(--muted-foreground));
		font-size: 0.72rem;
		font-weight: 850;
	}
	.text-tools__subtle-label {
		display: block;
		margin-bottom: 0.22rem;
		color: hsl(var(--muted-foreground));
		font-size: 0.68rem;
		font-weight: 800;
	}
	.text-kind-choices {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.38rem;
	}
	.text-kind-choices button,
	.chips button {
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		box-shadow: 0.1rem 0.1rem 0 var(--pixel-ink);
		color: hsl(var(--foreground));
		cursor: pointer;
		font-weight: 850;
	}
	.text-kind-choices button {
		display: grid;
		gap: 0.16rem;
		align-content: start;
		padding: 0.46rem 0.5rem;
		text-align: left;
	}
	.text-kind-choices button[aria-pressed='true'],
	.chips button[aria-pressed='true'] {
		background: var(--pixel-green);
	}
	.text-kind-choices span {
		font-size: 0.78rem;
		font-weight: 900;
	}
	.text-kind-choices small {
		color: hsl(var(--muted-foreground));
		font-size: 0.64rem;
		font-weight: 750;
		line-height: 1.2;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.28rem;
	}
	.chips button {
		padding: 0.32rem 0.48rem;
		font-size: 0.76rem;
	}
	.color-tools {
		display: grid;
		gap: 0.4rem;
	}
	.default-color-button {
		justify-self: start;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		box-shadow: 0.1rem 0.1rem 0 var(--pixel-ink);
		padding: 0.32rem 0.48rem;
		color: hsl(var(--foreground));
		font-size: 0.76rem;
		font-weight: 850;
	}
	.default-color-button[aria-pressed='true'] {
		background: var(--pixel-green);
	}
	.background-tools {
		display: grid;
		gap: 0.4rem;
		margin-top: 0.18rem;
	}
	.frame-tools {
		display: grid;
		gap: 0.42rem;
		margin-top: 0.18rem;
		border-left: 2px solid oklch(0.24 0.065 281 / 0.24);
		padding-left: 0.55rem;
	}
	.color-swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 0.28rem;
	}
	.color-swatches button {
		width: 1.45rem;
		height: 1.45rem;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		box-shadow: 0.08rem 0.08rem 0 var(--pixel-ink);
		cursor: pointer;
	}
	.color-swatches button.selected {
		outline: 3px solid var(--pixel-yellow);
		outline-offset: 2px;
	}
	.backdrop-opacity {
		display: grid;
		grid-template-columns: 4rem minmax(0, 1fr) max-content;
		align-items: center;
		gap: 0.5rem;
		color: hsl(var(--muted-foreground));
		font-size: 0.74rem;
		font-weight: 800;
	}
	.background-padding {
		display: grid;
		gap: 0.22rem;
		color: hsl(var(--muted-foreground));
		font-size: 0.74rem;
		font-weight: 800;
	}
	.background-padding__topline {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.background-padding__topline button {
		border: 1px solid oklch(0.24 0.065 281 / 0.38);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		padding: 0.16rem 0.36rem;
		color: hsl(var(--muted-foreground));
		font-size: 0.68rem;
		font-weight: 850;
	}
	.background-padding__topline button:disabled {
		opacity: 0.45;
	}
	.background-padding input[type='range'] {
		width: 100%;
	}
	.background-padding output {
		color: hsl(var(--foreground));
		font-size: 0.72rem;
		font-weight: 850;
	}
	.custom-color {
		position: relative;
		display: inline-grid;
		grid-template-columns: max-content 1.35rem;
		align-items: center;
		justify-self: start;
		gap: 0.42rem;
		opacity: 0.74;
		color: hsl(var(--muted-foreground));
		font-size: 0.7rem;
		font-weight: 800;
	}
	.custom-color input[type='color'] {
		width: 1.35rem;
		height: 1.35rem;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: conic-gradient(red, yellow, lime, aqua, blue, magenta, red);
		padding: 0;
	}
	.text-input {
		display: grid;
		gap: 0.18rem;
		color: hsl(var(--muted-foreground));
		font-size: 0.7rem;
		font-weight: 800;
	}
	.text-input input {
		min-width: 0;
		padding: 0.34rem 0.42rem;
		font: inherit;
		font-size: 0.74rem;
	}
	.backdrop-opacity input[type='range'] {
		width: 100%;
	}
	.backdrop-opacity output {
		color: hsl(var(--foreground));
		font-size: 0.72rem;
		font-weight: 850;
	}
	.contrast-warning {
		margin: 0.1rem 0 0;
		border: 2px solid oklch(0.7 0.16 60);
		border-radius: var(--pixel-radius);
		background: oklch(0.97 0.06 82);
		padding: 0.42rem 0.5rem;
		color: oklch(0.28 0.08 55);
		font-size: 0.72rem;
		font-weight: 850;
		line-height: 1.25;
	}
	.contrast-warning span {
		font-variant-numeric: tabular-nums;
	}
	button:focus-visible,
	input:focus-visible {
		outline: 3px solid var(--pixel-cyan);
		outline-offset: 2px;
	}
	.text-preview {
		display: grid;
		grid-template-rows: max-content minmax(0, 1fr);
		min-height: 0;
		padding: 0.75rem 0.85rem 0.85rem 0;
	}
	.text-preview__chrome {
		display: flex;
		justify-content: flex-end;
		padding-bottom: 0.45rem;
	}
	.text-preview__chrome span {
		border: 1px solid oklch(0.24 0.065 281 / 0.32);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		padding: 0.14rem 0.4rem;
		color: hsl(var(--muted-foreground));
		font-size: 0.68rem;
		font-weight: 850;
	}
	.text-preview__surface {
		overflow: auto;
		min-height: 0;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: oklch(0.985 0.012 82);
		box-shadow: inset 0.12rem 0.12rem 0 oklch(0.24 0.065 281 / 0.08);
	}
	.text-preview__surface :global(.zine) {
		min-height: auto;
	}
	.text-preview__surface :global(.zine-title) {
		display: none;
	}
	.text-preview__surface :global(.zine-scene),
	.text-preview__surface :global(.zine-scene__inner) {
		min-height: 0 !important;
	}
	.text-preview__surface :global(.zine-scene__inner) {
		padding: clamp(1rem, 3vw, 1.5rem) 0;
	}
	@media (max-width: 760px) {
		.text-tools {
			grid-template-columns: 1fr;
		}
		.text-tools__panel {
			border-right: 0;
			border-bottom: 2px solid var(--pixel-ink);
			padding-right: 0;
		}
		.text-preview {
			padding: 0 0.85rem 0.85rem;
		}
	}
</style>
