<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { SafeUrlSchema } from '../../schema/url';
	import type {
		RichTextBlockNode,
		RichTextDoc,
		RichTextInline,
		RichTextMark
	} from '../../schema/richtext';
	import type { RichTextProps } from './schema';

	let { value, onChange }: { value: RichTextProps; onChange: (next: RichTextProps) => void } =
		$props();

	let open = $state(false);
	let editorEl = $state<HTMLDivElement | null>(null);
	let panelEl = $state<HTMLDivElement | null>(null);
	let openButtonEl = $state<HTMLButtonElement | null>(null);
	let linkPanelOpen = $state(false);
	let linkHref = $state('');
	let linkError = $state<string | null>(null);
	let savedRange: Range | null = null;

	const preview = $derived(docToPlainText(value.doc));

	async function openEditor(): Promise<void> {
		open = true;
		linkPanelOpen = false;
		linkError = null;
		await tick();
		if (!editorEl) return;
		renderDocIntoEditor(value.doc, editorEl);
		editorEl.focus();
	}

	function closeEditor(): void {
		open = false;
		linkPanelOpen = false;
		linkError = null;
		savedRange = null;
		tick().then(() => openButtonEl?.focus());
	}

	function saveEditor(): void {
		if (!editorEl) return;
		onChange({ doc: editorToDoc(editorEl) });
		closeEditor();
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
		savedRange = selectionRangeInEditor();
	}

	function setBlockStyle(tag: 'p' | 'h2' | 'h3' | 'blockquote'): void {
		exec('formatBlock', tag);
	}

	function openLinkPanel(): void {
		savedRange = selectionRangeInEditor();
		linkHref = currentLinkHref();
		linkError = null;
		linkPanelOpen = true;
	}

	function applyLink(): void {
		const parsed = SafeUrlSchema.safeParse(linkHref);
		if (!parsed.success) {
			linkError = parsed.error.issues[0]?.message ?? 'Enter a safe URL.';
			return;
		}
		restoreSelection();
		const selection = window.getSelection();
		if (!selection || !editorEl) return;
		if (selection.rangeCount === 0) {
			const range = document.createRange();
			range.selectNodeContents(editorEl);
			range.collapse(false);
			selection.addRange(range);
		}
		if (selection.isCollapsed) {
			const range = selection.getRangeAt(0);
			const anchor = document.createElement('a');
			anchor.href = parsed.data;
			anchor.textContent = parsed.data;
			range.deleteContents();
			range.insertNode(anchor);
			range.setStartAfter(anchor);
			range.collapse(true);
			selection.removeAllRanges();
			selection.addRange(range);
		} else {
			document.execCommand('createLink', false, parsed.data);
		}
		linkPanelOpen = false;
		linkError = null;
		editorEl?.focus();
		savedRange = selectionRangeInEditor();
	}

	function removeLink(): void {
		exec('unlink');
		linkPanelOpen = false;
	}

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
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => exec('bold')}
				>
					B
				</button>
				<button
					type="button"
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => exec('italic')}
				>
					<i>I</i>
				</button>
				<button
					type="button"
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => exec('underline')}
				>
					<u>U</u>
				</button>
				<button
					type="button"
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => setBlockStyle('h2')}
				>
					Heading
				</button>
				<button
					type="button"
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => setBlockStyle('h3')}
				>
					Subhead
				</button>
				<button
					type="button"
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => setBlockStyle('blockquote')}
				>
					Quote
				</button>
				<button
					type="button"
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => setBlockStyle('p')}
				>
					Normal
				</button>
				<button
					type="button"
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => exec('insertUnorderedList')}
				>
					• List
				</button>
				<button
					type="button"
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => exec('insertOrderedList')}
				>
					1. List
				</button>
				<button type="button" onpointerdown={(e) => e.preventDefault()} onclick={openLinkPanel}>
					Link
				</button>
				<button
					type="button"
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => exec('removeFormat')}
				>
					Clear
				</button>
			</div>

			{#if linkPanelOpen}
				<div class="rich-link-panel">
					<label>
						<span>Link URL</span>
						<input
							type="url"
							value={linkHref}
							placeholder="https://example.com"
							oninput={(e) => {
								linkHref = e.currentTarget.value;
								linkError = null;
							}}
						/>
					</label>
					<div class="rich-link-panel__actions">
						<button type="button" onclick={applyLink}>Apply link</button>
						<button type="button" onclick={removeLink}>Remove link</button>
					</div>
					{#if linkError}<p role="alert">{linkError}</p>{/if}
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
				onmouseup={() => (savedRange = selectionRangeInEditor())}
				onkeyup={() => (savedRange = selectionRangeInEditor())}
				oninput={() => (savedRange = selectionRangeInEditor())}
				onpaste={onPaste}
			></div>
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
		grid-template-rows: max-content max-content max-content minmax(0, 1fr);
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
		letter-spacing: 0.08em;
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
		min-width: 2.2rem;
		padding: 0.4rem 0.52rem;
		font-size: 0.8rem;
	}
	.rich-link-panel {
		grid-row: 3;
		display: grid;
		grid-template-columns: minmax(0, 1fr) max-content;
		align-items: end;
		gap: 0.6rem;
		border-bottom: 2px solid var(--pixel-ink);
		background: oklch(0.96 0.03 82);
		padding: 0.7rem 1rem;
	}
	.rich-link-panel label {
		display: grid;
		gap: 0.25rem;
	}
	.rich-link-panel span {
		color: hsl(var(--muted-foreground));
		font-size: 0.72rem;
		font-weight: 850;
	}
	.rich-link-panel input {
		width: 100%;
		border: 2px solid var(--pixel-ink);
		border-radius: var(--pixel-radius);
		background: var(--pixel-paper);
		padding: 0.45rem 0.55rem;
		color: hsl(var(--foreground));
		font-size: 0.84rem;
	}
	.rich-link-panel__actions {
		display: flex;
		gap: 0.35rem;
	}
	.rich-link-panel button {
		padding: 0.43rem 0.58rem;
		font-size: 0.78rem;
	}
	.rich-link-panel p {
		grid-column: 1 / -1;
		margin: 0;
		color: hsl(var(--destructive));
		font-size: 0.78rem;
		font-weight: 800;
	}
	.rich-editor {
		grid-row: 4;
		overflow: auto;
		min-height: 0;
		margin: 0.7rem;
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
	.rich-link-panel input:focus-visible {
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
		.rich-link-panel,
		.rich-modal__header {
			align-items: stretch;
			flex-direction: column;
		}
		.rich-link-panel {
			grid-template-columns: 1fr;
		}
		.rich-link-panel__actions {
			flex-wrap: wrap;
		}
	}
</style>
