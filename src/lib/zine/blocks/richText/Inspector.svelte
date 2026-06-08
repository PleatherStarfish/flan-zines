<script lang="ts">
	import { tick, untrack } from 'svelte';
	import FocusedTextTools from '$lib/editor/FocusedTextTools.svelte';
	import { defaultContentRole } from '$lib/zine/render/typeset';
	import { SafeUrlSchema } from '../../schema/url';
	import type { BlockStyle, TextKind, Theme } from '../../schema/theme';
	import type {
		RichTextBlockNode,
		RichTextDoc,
		RichTextInline,
		RichTextMark
	} from '../../schema/richtext';
	import type { RichTextProps } from './schema';

	let {
		value,
		onChange,
		style,
		onStyleChange,
		textKind = 'content',
		onTextKindChange,
		theme
	}: {
		value: RichTextProps;
		onChange: (next: RichTextProps) => void;
		style?: BlockStyle;
		onStyleChange?: (next: BlockStyle) => void;
		textKind?: TextKind;
		onTextKindChange?: (kind: TextKind) => void;
		theme?: Theme;
	} = $props();

	let open = $state(false);
	let editorWrapEl = $state<HTMLDivElement | null>(null);
	let editorEl = $state<HTMLDivElement | null>(null);
	let panelEl = $state<HTMLDivElement | null>(null);
	let openButtonEl = $state<HTMLButtonElement | null>(null);
	let linkInputEl = $state<HTMLInputElement | null>(null);
	let linkPanelOpen = $state(false);
	let linkHref = $state('');
	let linkError = $state<string | null>(null);
	let linkSelectionText = $state('');
	let linkBubble = $state<{ left: number; top: number; text: string } | null>(null);
	let draftDoc = $state<RichTextDoc>(untrack(() => structuredClone($state.snapshot(value.doc))));
	let draftStyle = $state<BlockStyle | undefined>(untrack(() => cloneStyle(style)));
	let draftTextKind = $state<TextKind>(untrack(() => textKind));
	let draftStyleDirty = $state(false);
	let draftTextKindDirty = $state(false);
	let savedRange: Range | null = null;
	let activeLinkHighlight: HTMLElement | null = null;

	const preview = $derived(docToPlainText(value.doc));

	async function openEditor(): Promise<void> {
		open = true;
		draftDoc = structuredClone($state.snapshot(value.doc));
		draftStyle = cloneStyle(style);
		draftTextKind = textKind;
		draftStyleDirty = false;
		draftTextKindDirty = false;
		linkPanelOpen = false;
		linkError = null;
		linkSelectionText = '';
		linkBubble = null;
		clearLinkHighlight();
		await tick();
		if (!editorEl) return;
		renderDocIntoEditor(draftDoc, editorEl);
		editorEl.focus();
	}

	function closeEditor(): void {
		clearLinkHighlight();
		open = false;
		linkPanelOpen = false;
		linkBubble = null;
		linkError = null;
		linkSelectionText = '';
		savedRange = null;
		tick().then(() => openButtonEl?.focus());
	}

	function saveEditor(): void {
		clearLinkHighlight();
		updateDraftFromEditor();
		onChange({ doc: draftDoc });
		if (draftTextKindDirty) onTextKindChange?.(draftTextKind);
		if (draftStyleDirty) onStyleChange?.(draftStyle ?? {});
		closeEditor();
	}

	function updateDraftFromEditor(): void {
		if (!editorEl) return;
		savedRange = selectionRangeInEditor();
		draftDoc = editorToDoc(editorEl);
	}

	function cloneStyle(source: BlockStyle | undefined): BlockStyle | undefined {
		return source ? structuredClone($state.snapshot(source)) : undefined;
	}

	function setDraftStyle(next: BlockStyle): void {
		draftStyle = structuredClone($state.snapshot(next));
		draftStyleDirty = true;
	}

	function setDraftTextKind(kind: TextKind): void {
		draftTextKind = kind;
		draftTextKindDirty = true;
		draftStyleDirty = true;
		const next: BlockStyle = { ...(draftStyle ?? {}) };
		if (kind === 'other') {
			next.typeset = { kind: 'other' };
		} else {
			next.typeset = {
				...(next.typeset ?? {}),
				kind: 'content',
				role: next.typeset?.role ?? defaultContentRole('richText', draftDoc)
			};
		}
		draftStyle = next;
	}

	function onModalKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			closeEditor();
			return;
		}
		if (event.key === 'Tab') trapFocus(event);
	}

	function trapFocus(event: KeyboardEvent): void {
		if (!panelEl) return;
		const focusables = Array.from(
			panelEl.querySelectorAll<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			)
		).filter((el) => !el.hasAttribute('disabled'));
		if (!focusables.length) return;
		const first = focusables[0];
		const last = focusables[focusables.length - 1];
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	function exec(command: string, commandValue?: string): void {
		restoreSelection();
		document.execCommand(command, false, commandValue);
		editorEl?.focus();
		updateDraftFromEditor();
	}

	function setBlockStyle(tag: 'p' | 'h2' | 'h3' | 'blockquote'): void {
		exec('formatBlock', tag);
	}

	async function openLinkPanel(): Promise<void> {
		const range = selectionRangeInEditor() ?? savedRange;
		linkSelectionText = range?.toString().trim() ?? '';
		linkError = null;
		if (!range || range.collapsed || !linkSelectionText) {
			linkError = 'Highlight the words to link first.';
			return;
		}
		savedRange = range.cloneRange();
		linkHref = currentLinkHref();
		linkBubble = bubbleFromRange(range, linkSelectionText);
		if (!highlightLinkSelection()) return;
		linkPanelOpen = true;
		await tick();
		linkInputEl?.focus();
	}

	function applyLink(): void {
		const parsed = SafeUrlSchema.safeParse(linkHref);
		if (!parsed.success) {
			linkError = parsed.error.issues[0]?.message ?? 'Enter a safe URL.';
			return;
		}
		if (!linkSelectionText) {
			linkError = 'Highlight the words to link first.';
			return;
		}
		if (activeLinkHighlight && editorEl?.contains(activeLinkHighlight)) {
			const anchor = document.createElement('a');
			anchor.href = parsed.data;
			while (activeLinkHighlight.firstChild) anchor.append(activeLinkHighlight.firstChild);
			activeLinkHighlight.replaceWith(anchor);
			activeLinkHighlight = null;
			selectAfter(anchor);
		} else {
			restoreSelection();
			const selection = window.getSelection();
			if (!selection || !editorEl) return;
			if (selection.rangeCount === 0 || selection.isCollapsed) {
				linkError = 'Highlight the words to link first.';
				return;
			}
			const range = selection.getRangeAt(0);
			const anchor = document.createElement('a');
			anchor.href = parsed.data;
			anchor.append(range.extractContents());
			range.insertNode(anchor);
			selectAfter(anchor);
		}
		linkPanelOpen = false;
		linkBubble = null;
		linkError = null;
		linkSelectionText = '';
		editorEl?.focus();
		updateDraftFromEditor();
	}

	function removeLink(): void {
		if (activeLinkHighlight && editorEl?.contains(activeLinkHighlight)) {
			for (const anchor of Array.from(activeLinkHighlight.querySelectorAll('a'))) {
				while (anchor.firstChild) anchor.parentNode?.insertBefore(anchor.firstChild, anchor);
				anchor.remove();
			}
			clearLinkHighlight();
			updateDraftFromEditor();
		} else {
			exec('unlink');
		}
		linkPanelOpen = false;
		linkBubble = null;
		linkSelectionText = '';
	}

	function cancelLinkPanel(): void {
		clearLinkHighlight();
		linkPanelOpen = false;
		linkBubble = null;
		linkHref = '';
		linkError = null;
		linkSelectionText = '';
		editorEl?.focus();
	}

	function refreshLinkBubble(): void {
		if (!open || !editorWrapEl) {
			linkBubble = null;
			return;
		}
		if (linkPanelOpen) return;
		const range = selectionRangeInEditor();
		const text = range?.toString().trim() ?? '';
		if (!range || range.collapsed || !text) {
			linkBubble = null;
			return;
		}
		savedRange = range;
		linkSelectionText = text;
		linkBubble = bubbleFromRange(range, text);
	}

	function bubbleFromRange(
		range: Range,
		text: string
	): { left: number; top: number; text: string } {
		const rect =
			'getBoundingClientRect' in range
				? range.getBoundingClientRect()
				: ({ left: 0, top: 0, width: 0 } as Pick<DOMRect, 'left' | 'top' | 'width'>);
		const wrapRect = editorWrapEl?.getBoundingClientRect() ?? { left: 0, top: 0 };
		const wrapWidth = editorWrapEl?.clientWidth || 320;
		const left = Math.max(54, Math.min(wrapWidth - 54, rect.left - wrapRect.left + rect.width / 2));
		const top = Math.max(6, rect.top - wrapRect.top - 38);
		return { left, top, text };
	}

	$effect(() => {
		if (!open || typeof document === 'undefined' || typeof window === 'undefined') return;
		document.addEventListener('selectionchange', refreshLinkBubble);
		window.addEventListener('resize', refreshLinkBubble);
		return () => {
			document.removeEventListener('selectionchange', refreshLinkBubble);
			window.removeEventListener('resize', refreshLinkBubble);
		};
	});

	function selectionRangeInEditor(): Range | null {
		if (!editorEl) return null;
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return null;
		const range = selection.getRangeAt(0);
		const container =
			range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
				? range.commonAncestorContainer
				: range.commonAncestorContainer.parentElement;
		return container && editorEl.contains(container) ? range.cloneRange() : null;
	}

	function restoreSelection(): void {
		if (!savedRange) return;
		const selection = window.getSelection();
		if (!selection) return;
		selection.removeAllRanges();
		selection.addRange(savedRange);
	}

	function highlightLinkSelection(): boolean {
		clearLinkHighlight();
		restoreSelection();
		const selection = window.getSelection();
		if (!selection || !editorEl || selection.rangeCount === 0 || selection.isCollapsed)
			return false;
		const range = selection.getRangeAt(0);
		const highlight = document.createElement('span');
		highlight.dataset.linkSelection = 'true';
		highlight.append(range.extractContents());
		range.insertNode(highlight);
		const nextRange = document.createRange();
		nextRange.selectNodeContents(highlight);
		selection.removeAllRanges();
		selection.addRange(nextRange);
		savedRange = nextRange.cloneRange();
		activeLinkHighlight = highlight;
		return true;
	}

	function clearLinkHighlight(): void {
		const highlight = activeLinkHighlight;
		activeLinkHighlight = null;
		if (!highlight?.parentNode) return;
		const parent = highlight.parentNode;
		while (highlight.firstChild) parent.insertBefore(highlight.firstChild, highlight);
		parent.removeChild(highlight);
		parent.normalize();
	}

	function selectAfter(node: Node): void {
		const selection = window.getSelection();
		if (!selection) return;
		const range = document.createRange();
		range.setStartAfter(node);
		range.collapse(true);
		selection.removeAllRanges();
		selection.addRange(range);
		savedRange = range.cloneRange();
	}

	function currentLinkHref(): string {
		const range = selectionRangeInEditor();
		const node = range?.commonAncestorContainer;
		const el = node?.nodeType === Node.ELEMENT_NODE ? (node as Element) : node?.parentElement;
		return el?.closest('a')?.getAttribute('href') ?? '';
	}

	function onPaste(event: ClipboardEvent): void {
		const text = event.clipboardData?.getData('text/plain');
		if (text == null) return;
		event.preventDefault();
		document.execCommand('insertText', false, text);
		updateDraftFromEditor();
	}

	function renderDocIntoEditor(doc: RichTextDoc, target: HTMLElement): void {
		target.replaceChildren(...doc.content.map(blockToElement));
		if (!target.childNodes.length) target.append(document.createElement('p'));
	}

	function blockToElement(node: RichTextBlockNode): HTMLElement {
		if (node.type === 'paragraph') {
			const p = document.createElement('p');
			p.append(...inlineToDomNodes(node.content ?? []));
			if (!p.childNodes.length) p.append(document.createElement('br'));
			return p;
		}
		if (node.type === 'heading') {
			const heading = document.createElement(`h${node.attrs.level}`);
			heading.append(...inlineToDomNodes(node.content ?? []));
			if (!heading.childNodes.length) heading.append(document.createElement('br'));
			return heading;
		}
		if (node.type === 'bulletList' || node.type === 'orderedList') {
			const list = document.createElement(node.type === 'bulletList' ? 'ul' : 'ol');
			if (node.type === 'orderedList' && node.attrs?.start) {
				list.setAttribute('start', String(node.attrs.start));
			}
			for (const item of node.content) {
				const li = document.createElement('li');
				for (const pNode of item.content) li.append(blockToElement(pNode));
				list.append(li);
			}
			return list;
		}
		const quote = document.createElement('blockquote');
		for (const pNode of node.content) quote.append(blockToElement(pNode));
		return quote;
	}

	function inlineToDomNodes(nodes: RichTextInline[]): Node[] {
		return nodes.map((node) => {
			if (node.type === 'hardBreak') return document.createElement('br');
			let current: Node = document.createTextNode(node.text);
			const marks = node.marks ?? [];
			for (let i = marks.length - 1; i >= 0; i--) {
				current = wrapWithMark(current, marks[i]);
			}
			return current;
		});
	}

	function wrapWithMark(child: Node, mark: RichTextMark): HTMLElement {
		const tag =
			mark.type === 'bold'
				? 'strong'
				: mark.type === 'italic'
					? 'em'
					: mark.type === 'underline'
						? 'u'
						: 'a';
		const el = document.createElement(tag);
		if (mark.type === 'link') {
			el.setAttribute('href', mark.attrs.href);
			if (mark.attrs.target) el.setAttribute('target', mark.attrs.target);
		}
		el.append(child);
		return el;
	}

	function editorToDoc(root: HTMLElement): RichTextDoc {
		const content = Array.from(root.childNodes).flatMap(blocksFromDomNode);
		return {
			type: 'doc',
			content: content.length ? content : [{ type: 'paragraph', content: [] }]
		};
	}

	function blocksFromDomNode(node: Node): RichTextBlockNode[] {
		if (node.nodeType === Node.TEXT_NODE) {
			const text = node.textContent ?? '';
			return text.trim() ? [{ type: 'paragraph', content: [{ type: 'text', text }] }] : [];
		}
		if (!(node instanceof HTMLElement)) return [];
		const tag = node.tagName.toLowerCase();
		if (tag === 'ul' || tag === 'ol') {
			const items = Array.from(node.children)
				.filter((child) => child.tagName.toLowerCase() === 'li')
				.map((li) => ({
					type: 'listItem' as const,
					content: childParagraphs(li as HTMLElement)
				}));
			if (tag === 'ul') return [{ type: 'bulletList', content: items }];
			const start = Number(node.getAttribute('start'));
			const ordered: Extract<RichTextBlockNode, { type: 'orderedList' }> = {
				type: 'orderedList',
				content: items
			};
			if (Number.isInteger(start) && start > 1) ordered.attrs = { start };
			return [ordered];
		}
		if (tag === 'blockquote') {
			const paragraphs = childParagraphs(node);
			return [
				{ type: 'blockquote', content: paragraphs.length ? paragraphs : [{ type: 'paragraph' }] }
			];
		}
		if (/^h[1-6]$/.test(tag)) {
			const level = tag === 'h2' || tag === 'h3' ? Number(tag.slice(1)) : 4;
			return [
				{
					type: 'heading',
					attrs: { level: level as 2 | 3 | 4 },
					content: inlineFromDomNodes(Array.from(node.childNodes))
				}
			];
		}
		if (tag === 'p' || tag === 'div') {
			return [paragraphFromInline(Array.from(node.childNodes))];
		}
		return Array.from(node.childNodes).flatMap(blocksFromDomNode);
	}

	function childParagraphs(
		element: HTMLElement
	): Extract<RichTextBlockNode, { type: 'paragraph' }>[] {
		const blockChildren = Array.from(element.children).filter((child) => {
			const tag = child.tagName.toLowerCase();
			return tag === 'p' || tag === 'div' || /^h[1-6]$/.test(tag);
		});
		if (!blockChildren.length) return [paragraphFromInline(Array.from(element.childNodes))];
		return blockChildren.map((child) => paragraphFromInline(Array.from(child.childNodes)));
	}

	function paragraphFromInline(nodes: Node[]): Extract<RichTextBlockNode, { type: 'paragraph' }> {
		return { type: 'paragraph', content: inlineFromDomNodes(nodes) };
	}

	function inlineFromDomNodes(nodes: Node[], activeMarks: RichTextMark[] = []): RichTextInline[] {
		const out: RichTextInline[] = [];
		for (const node of nodes) {
			if (node.nodeType === Node.TEXT_NODE) {
				const text = node.textContent ?? '';
				if (text) pushText(out, text, activeMarks);
				continue;
			}
			if (!(node instanceof HTMLElement)) continue;
			const tag = node.tagName.toLowerCase();
			if (tag === 'br') {
				out.push({ type: 'hardBreak' });
				continue;
			}
			out.push(
				...inlineFromDomNodes(Array.from(node.childNodes), marksForElement(node, activeMarks))
			);
		}
		return out;
	}

	function marksForElement(element: HTMLElement, activeMarks: RichTextMark[]): RichTextMark[] {
		const tag = element.tagName.toLowerCase();
		if (tag === 'strong' || tag === 'b') return [...activeMarks, { type: 'bold' }];
		if (tag === 'em' || tag === 'i') return [...activeMarks, { type: 'italic' }];
		if (tag === 'u') return [...activeMarks, { type: 'underline' }];
		if (tag === 'a') {
			const href = element.getAttribute('href') ?? '';
			const parsed = SafeUrlSchema.safeParse(href);
			return parsed.success
				? [...activeMarks, { type: 'link', attrs: { href: parsed.data } }]
				: activeMarks;
		}
		return activeMarks;
	}

	function pushText(out: RichTextInline[], text: string, marks: RichTextMark[]): void {
		const previous = out.at(-1);
		if (
			previous?.type === 'text' &&
			JSON.stringify(previous.marks ?? []) === JSON.stringify(marks)
		) {
			previous.text += text;
		} else {
			out.push({ type: 'text', text, marks: marks.length ? structuredClone(marks) : undefined });
		}
	}

	function inlineToPlain(nodes: RichTextInline[] | undefined): string {
		return (nodes ?? []).map((node) => (node.type === 'text' ? node.text : '\n')).join('');
	}

	function docToPlainText(doc: RichTextDoc): string {
		return doc.content
			.map((node) => {
				if (node.type === 'paragraph') return inlineToPlain(node.content);
				if (node.type === 'heading') return inlineToPlain(node.content);
				if (node.type === 'blockquote') {
					return node.content.map((p) => inlineToPlain(p.content)).join(' ');
				}
				return node.content
					.map((item, i) => {
						const prefix = node.type === 'orderedList' ? `${i + (node.attrs?.start ?? 1)}. ` : '• ';
						return `${prefix}${item.content.map((p) => inlineToPlain(p.content)).join(' ')}`;
					})
					.join('\n');
			})
			.join('\n\n')
			.trim();
	}

	let initialPreview = $state(untrack(() => preview || 'Start writing...'));
</script>

<div class="rich-inspector">
	<div class="rich-inspector__preview" aria-live="polite">
		<p>{preview || initialPreview}</p>
	</div>
	<button type="button" class="rich-inspector__open" bind:this={openButtonEl} onclick={openEditor}>
		Open focused editor
	</button>
</div>

{#if open}
	<div class="rich-modal" role="presentation">
		<div
			class="rich-modal__panel"
			role="dialog"
			aria-modal="true"
			aria-labelledby="rich-editor-title"
			tabindex="-1"
			bind:this={panelEl}
			onkeydown={onModalKeydown}
		>
			<header class="rich-modal__header">
				<div>
					<p>Focused writing</p>
					<h2 id="rich-editor-title">Edit text</h2>
				</div>
				<div class="rich-modal__actions">
					<button type="button" class="rich-modal__ghost" onclick={closeEditor}>Cancel</button>
					<button type="button" class="rich-modal__save" onclick={saveEditor}>Save text</button>
				</div>
			</header>

			<div class="rich-toolbar" aria-label="Text formatting">
				<button
					type="button"
					aria-label="Bold"
					title="Bold"
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => exec('bold')}
				>
					B
				</button>
				<button
					type="button"
					aria-label="Italic"
					title="Italic"
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => exec('italic')}
				>
					<i>I</i>
				</button>
				<button
					type="button"
					aria-label="Underline"
					title="Underline"
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => exec('underline')}
				>
					<u>U</u>
				</button>
				<button
					type="button"
					aria-label="Heading"
					title="Heading"
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => setBlockStyle('h2')}
				>
					Heading
				</button>
				<button
					type="button"
					aria-label="Subhead"
					title="Subhead"
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => setBlockStyle('h3')}
				>
					Subhead
				</button>
				<button
					type="button"
					aria-label="Quote"
					title="Quote"
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => setBlockStyle('blockquote')}
				>
					Quote
				</button>
				<button
					type="button"
					aria-label="Normal paragraph"
					title="Normal paragraph"
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => setBlockStyle('p')}
				>
					Plain text
				</button>
				<button
					type="button"
					aria-label="Bullet list"
					title="Bullet list"
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => exec('insertUnorderedList')}
				>
					Bullets
				</button>
				<button
					type="button"
					aria-label="Numbered list"
					title="Numbered list"
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => exec('insertOrderedList')}
				>
					Numbers
				</button>
				<button
					type="button"
					aria-label="Add link to selected text"
					title="Add link to selected text"
					onpointerdown={(e) => e.preventDefault()}
					onclick={openLinkPanel}
				>
					Add link
				</button>
				<button
					type="button"
					aria-label="Clear formatting"
					title="Clear formatting"
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => exec('removeFormat')}
				>
					Clear
				</button>
			</div>

			<div class="rich-modal__body">
				<div class="rich-editor-wrap" bind:this={editorWrapEl}>
					{#if linkBubble}
						<div
							class="rich-link-bubble"
							class:is-expanded={linkPanelOpen}
							role={linkPanelOpen ? 'dialog' : undefined}
							aria-label={linkPanelOpen ? 'Add link to selected text' : undefined}
							style={`left:${linkBubble.left}px;top:${linkBubble.top}px`}
						>
							{#if linkPanelOpen}
								<div class="rich-link-bubble__selection">
									<span>Selected text</span>
									<strong>{linkSelectionText}</strong>
								</div>
								<label>
									<span>Link URL</span>
									<input
										bind:this={linkInputEl}
										type="url"
										value={linkHref}
										placeholder="https://example.com"
										oninput={(e) => {
											linkHref = e.currentTarget.value;
											linkError = null;
										}}
										onkeydown={(e) => {
											if (e.key === 'Enter') {
												e.preventDefault();
												applyLink();
											} else if (e.key === 'Escape') {
												e.preventDefault();
												cancelLinkPanel();
											}
										}}
									/>
								</label>
								<div class="rich-link-bubble__actions">
									<button type="button" disabled={!linkSelectionText} onclick={applyLink}>
										Apply link
									</button>
									<button type="button" onclick={removeLink}>Remove link</button>
									<button type="button" onclick={cancelLinkPanel}>Cancel</button>
								</div>
								{#if linkError}<p role="alert">{linkError}</p>{/if}
							{:else}
								<button
									type="button"
									aria-label="Add link to highlighted text"
									onpointerdown={(e) => e.preventDefault()}
									onclick={openLinkPanel}
								>
									Add link
								</button>
							{/if}
						</div>
					{/if}
					<div
						class="rich-editor"
						bind:this={editorEl}
						contenteditable="true"
						role="textbox"
						aria-label="Rich text editor"
						aria-multiline="true"
						tabindex="0"
						onmouseup={refreshLinkBubble}
						onkeyup={refreshLinkBubble}
						oninput={() => {
							updateDraftFromEditor();
							refreshLinkBubble();
						}}
						onpaste={onPaste}
					></div>
				</div>

				<FocusedTextTools
					block={{ id: 'richtext_draft', type: 'richText', props: { doc: draftDoc } }}
					style={draftStyle}
					textKind={draftTextKind}
					{theme}
					onStyleChange={setDraftStyle}
					onTextKindChange={setDraftTextKind}
				/>
			</div>
		</div>
	</div>
{/if}

<style>
	.rich-inspector {
		display: grid;
		gap: 0.55rem;
	}
	.rich-inspector__preview {
		min-height: 4.5rem;
		max-height: 8rem;
		overflow: auto;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: oklch(0.985 0.015 82);
		padding: 0.6rem 0.7rem;
	}
	.rich-inspector__preview p {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 5;
		line-clamp: 5;
		overflow: hidden;
		margin: 0;
		color: hsl(var(--foreground));
		font-size: 0.84rem;
		line-height: 1.45;
		white-space: pre-wrap;
	}
	.rich-inspector__open,
	.rich-modal button {
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		box-shadow: 0.1rem 0.1rem 0 var(--pixel-ink);
		color: hsl(var(--foreground));
		font-weight: 850;
	}
	.rich-inspector__open {
		justify-self: start;
		padding: 0.48rem 0.72rem;
		font-size: 0.84rem;
	}
	.rich-modal {
		position: fixed;
		inset: 0;
		z-index: 80;
		display: grid;
		place-items: center;
		background: oklch(0.18 0.055 281 / 0.72);
		padding: 1rem;
	}
	.rich-modal__panel {
		display: grid;
		grid-template-rows: max-content max-content minmax(0, 1fr);
		width: min(72rem, calc(100vw - 2rem));
		height: min(52rem, calc(100dvh - 2rem));
		max-height: calc(100dvh - 2rem);
		overflow: hidden;
		border: 3px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background:
			linear-gradient(90deg, oklch(0.24 0.065 281 / 0.055) 1px, transparent 1px),
			oklch(0.95 0.025 82);
		background-size: 14px 14px;
		box-shadow: 0.45rem 0.45rem 0 var(--pixel-ink);
	}
	.rich-modal__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		border-bottom: 2px solid var(--pixel-ink);
		background: oklch(0.98 0.018 82);
		padding: 0.7rem 0.85rem;
	}
	.rich-modal__actions {
		display: flex;
		flex: 0 0 auto;
		align-items: center;
		gap: 0.45rem;
	}
	.rich-modal__header p {
		margin: 0;
		color: hsl(var(--muted-foreground));
		font-size: 0.68rem;
		font-weight: 900;
		letter-spacing: 0;
		text-transform: uppercase;
	}
	.rich-modal__header h2 {
		margin: 0.1rem 0 0;
		color: hsl(var(--foreground));
		font-size: 1.2rem;
		font-weight: 950;
		line-height: 1.1;
	}
	.rich-toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.38rem;
		border-bottom: 2px solid var(--pixel-ink);
		background: oklch(0.9 0.04 82);
		padding: 0.55rem 0.85rem;
	}
	.rich-toolbar button {
		min-width: 2.45rem;
		padding: 0.4rem 0.58rem;
		font-size: 0.78rem;
	}
	.rich-modal__body {
		grid-row: 3;
		display: grid;
		grid-template-columns: minmax(18rem, 0.75fr) minmax(29rem, 1.25fr);
		gap: 0;
		min-height: 0;
		overflow: hidden;
	}
	.rich-editor-wrap {
		position: relative;
		display: grid;
		min-height: 0;
		margin: 0.7rem;
	}
	.rich-link-bubble {
		position: absolute;
		z-index: 3;
		transform: translateX(-50%);
		background: var(--pixel-cyan) !important;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		box-shadow: 0.12rem 0.12rem 0 var(--pixel-ink);
		padding: 0;
		color: hsl(var(--foreground));
		font-size: 0.74rem;
		white-space: nowrap;
	}
	.rich-link-bubble.is-expanded {
		display: grid;
		width: min(21rem, calc(100% - 1rem));
		gap: 0.42rem;
		background: oklch(0.965 0.05 95) !important;
		padding: 0.48rem;
		white-space: normal;
	}
	.rich-link-bubble::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 100%;
		width: 0.55rem;
		height: 0.55rem;
		border-right: 2px solid var(--pixel-ink);
		border-bottom: 2px solid var(--pixel-ink);
		background: var(--pixel-cyan);
		transform: translate(-50%, -0.34rem) rotate(45deg);
	}
	.rich-link-bubble.is-expanded::after {
		background: oklch(0.965 0.05 95);
	}
	.rich-link-bubble > button {
		border: 0;
		box-shadow: none;
		background: transparent;
		padding: 0.34rem 0.52rem;
	}
	.rich-link-bubble label,
	.rich-link-bubble__selection {
		display: grid;
		gap: 0.2rem;
	}
	.rich-link-bubble span {
		color: hsl(var(--muted-foreground));
		font-size: 0.66rem;
		font-weight: 850;
	}
	.rich-link-bubble strong {
		overflow: hidden;
		color: hsl(var(--foreground));
		font-size: 0.78rem;
		font-weight: 900;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.rich-link-bubble input {
		width: 100%;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		padding: 0.42rem 0.5rem;
		color: hsl(var(--foreground));
		font-size: 0.82rem;
	}
	.rich-link-bubble__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.32rem;
	}
	.rich-link-bubble__actions button {
		padding: 0.34rem 0.5rem;
		font-size: 0.72rem;
	}
	.rich-link-bubble__actions button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.rich-link-bubble p {
		margin: 0;
		color: hsl(var(--destructive));
		font-size: 0.72rem;
		font-weight: 850;
	}
	.rich-editor {
		overflow: auto;
		min-height: 0;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: oklch(0.995 0.01 82);
		padding: clamp(1rem, 3vw, 1.5rem);
		color: hsl(var(--foreground));
		font-size: 1.02rem;
		line-height: 1.6;
		outline: none;
	}
	.rich-editor:focus {
		box-shadow:
			0 0 0 3px var(--pixel-cyan),
			inset 0.12rem 0.12rem 0 oklch(0.24 0.065 281 / 0.08);
	}
	.rich-editor :global(p) {
		margin: 0 0 0.95rem;
	}
	.rich-editor :global(h2),
	.rich-editor :global(h3) {
		margin: 0 0 0.85rem;
		color: hsl(var(--foreground));
		line-height: 1.18;
	}
	.rich-editor :global(h2) {
		font-size: 1.42rem;
	}
	.rich-editor :global(h3) {
		font-size: 1.16rem;
	}
	.rich-editor :global(ul),
	.rich-editor :global(ol) {
		margin: 0 0 0.95rem;
		padding-left: 1.5rem;
	}
	.rich-editor :global(blockquote) {
		margin: 0 0 0.95rem;
		border: 2px dashed var(--pixel-magenta);
		border-radius: var(--pixel-radius);
		background: oklch(0.98 0.035 340);
		padding: 0.75rem 0.9rem;
	}
	.rich-editor :global(a) {
		border-radius: 0.18rem;
		background: oklch(0.92 0.06 200 / 0.7);
		color: oklch(0.36 0.15 245);
		font-weight: 850;
		text-decoration-line: underline;
		text-decoration-thickness: 0.11em;
		text-underline-offset: 0.18em;
	}
	.rich-editor :global([data-link-selection='true']) {
		border-radius: 0.2rem;
		background: oklch(0.88 0.09 95 / 0.86);
		box-shadow: 0 0 0 2px oklch(0.74 0.16 75 / 0.48);
	}
	.rich-modal__ghost {
		padding: 0.48rem 0.7rem;
	}
	.rich-modal__save {
		background: var(--pixel-magenta) !important;
		color: hsl(var(--primary-foreground)) !important;
		padding: 0.55rem 0.85rem;
	}
	.rich-inspector__open:focus-visible,
	.rich-modal button:focus-visible,
	.rich-link-bubble input:focus-visible {
		outline: 3px solid var(--pixel-cyan);
		outline-offset: 2px;
	}
	@media (max-width: 700px) {
		.rich-modal {
			padding: 0;
		}
		.rich-modal__panel {
			min-height: 100dvh;
			max-height: 100dvh;
			height: 100dvh;
			width: 100%;
			box-shadow: none;
		}
		.rich-modal__header {
			align-items: stretch;
			flex-direction: column;
		}
		.rich-modal__body {
			grid-template-columns: 1fr;
			overflow: auto;
		}
		.rich-editor {
			min-height: 18rem;
		}
	}
</style>
