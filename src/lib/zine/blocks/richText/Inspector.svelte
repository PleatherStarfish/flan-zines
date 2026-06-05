<script lang="ts">
	import { untrack } from 'svelte';
	import type { RichTextProps } from './schema';
	import type { RichTextDoc } from '../../schema/richtext';

	// Interim editor: edits paragraphs as plain text (blank line = new paragraph).
	// TipTap (bold / italic / links, paste sanitation) replaces this in Step 3d; the
	// contract is unchanged — the Inspector edits `props.doc`, host-validated.
	let { value, onChange }: { value: RichTextProps; onChange: (next: RichTextProps) => void } =
		$props();

	function docToText(doc: RichTextDoc): string {
		return doc.content
			.map((node) => {
				if (node.type === 'paragraph') {
					return (node.content ?? []).map((n) => (n.type === 'text' ? n.text : '\n')).join('');
				}
				if (node.type === 'bulletList' || node.type === 'orderedList') {
					return node.content
						.map(
							(li) =>
								'• ' +
								li.content
									.map((p) =>
										(p.content ?? []).map((n) => (n.type === 'text' ? n.text : '')).join('')
									)
									.join(' ')
						)
						.join('\n');
				}
				return '';
			})
			.join('\n\n');
	}

	function textToDoc(text: string): RichTextDoc {
		const paragraphs = text.split(/\n{2,}/).map((p) => p.trim());
		const content = (paragraphs.length ? paragraphs : ['']).map((p) => ({
			type: 'paragraph' as const,
			content: p ? [{ type: 'text' as const, text: p }] : []
		}));
		return { type: 'doc', content };
	}

	// Initialise once; the inspector host re-mounts (keyed by block id) when the
	// selection changes, so this stays in sync with selection without fighting typing.
	// untrack signals the deliberate read-initial-value-only intent.
	let text = $state(untrack(() => docToText(value.doc)));
</script>

<div class="space-y-2">
	<label class="block">
		<span class="text-sm font-medium text-foreground">Text</span>
		<textarea
			rows="8"
			value={text}
			oninput={(e) => {
				text = e.currentTarget.value;
				onChange({ doc: textToDoc(text) });
			}}
			class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
		></textarea>
	</label>
	<p class="text-xs text-muted-foreground">
		Leave a blank line to start a new paragraph. Bold, italics, and links are coming soon.
	</p>
</div>
