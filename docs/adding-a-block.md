# Playbook: add a block

**Audience: AI (and humans) extending the content model.** A block is the unit of zine content
(heading, image, …). The **registry is the only extension point**: adding a block touches _only_ new
files plus one registration line. If you find yourself editing `render/ZineRenderer.svelte`,
`schema/document.ts`, or any other core file to special-case a type, stop — that is a design smell and a
review blocker (IMPLEMENTATION_PLAN.md §6).

## The contract

Every block is a [`BlockDef<P>`](../src/lib/zine/schema/block.ts):

```ts
interface BlockDef<P> {
	type: string; // unique discriminator stored in the document
	label: string; // human-facing editor palette / outline label
	category: 'text' | 'media' | 'structure' | 'interactive';
	schema: ZodType<P>; // validates props at save / publish / render
	defaults: P; // must pass `schema` (registry test enforces it)
	allowedAnimations: AnimationType[]; // presets this block may use (Step 4)
	Render: Component<{ props: P }>; // the published component (also the editor preview)
	Inspector: Component<{ value: P; onChange: (next: P) => void }>; // schema-validated by host
	requiredForPublish?: (props: P) => string[]; // a11y/quality gate, e.g. ["Add alt text"]
}
```

Two rules that keep blocks simple:

- **`Render` receives only `props`.** Alignment and animation are applied by the shared
  [`BlockFrame`](../src/lib/zine/render/BlockFrame.svelte), so a block never knows about motion. Adding
  an animation preset (Step 4) never edits a block.
- **Never `{@html}` author content.** Render structured data into elements (see the rich-text block for
  the recursive pattern). This is the safety boundary for a tool used by minors.

## The recipe (5 files + 1 line)

Create `src/lib/zine/blocks/<type>/`:

**1. `schema.ts`** — the props contract.

```ts
import { z } from 'zod';

export const PullQuotePropsSchema = z.object({
	text: z.string().min(1),
	attribution: z.string().optional()
});
export type PullQuoteProps = z.infer<typeof PullQuotePropsSchema>;
```

**2. `Render.svelte`** — semantic, accessible output. Use a class like `zine-<type>` and add reading
styles to `ZineRenderer`'s `:global(...)` block.

```svelte
<script lang="ts">
	import type { PullQuoteProps } from './schema';
	let { props }: { props: PullQuoteProps } = $props();
</script>

<blockquote class="zine-pullquote">
	<p>{props.text}</p>
	{#if props.attribution}<cite>{props.attribution}</cite>{/if}
</blockquote>
```

**3. `index.ts`** — the `BlockDef`.

```ts
import type { BlockDef } from '../../schema/block';
import { PullQuotePropsSchema, type PullQuoteProps } from './schema';
import Render from './Render.svelte';
import Inspector from './Inspector.svelte';

export const pullQuoteBlock: BlockDef<PullQuoteProps> = {
	type: 'pullQuote',
	label: 'Pull quote',
	category: 'text',
	schema: PullQuotePropsSchema,
	defaults: { text: 'A line worth pausing on.' },
	allowedAnimations: ['fade'], // registered effect ids — see docs/adding-an-effect.md
	Render,
	Inspector
};
```

**4. `Inspector.svelte`** — the editor controls. The host validates every `onChange` against `schema`
before committing.

```svelte
<script lang="ts">
	import type { PullQuoteProps } from './schema';
	let { value, onChange }: { value: PullQuoteProps; onChange: (next: PullQuoteProps) => void } =
		$props();
</script>

<label class="block">
	<span>Quote text</span>
	<textarea value={value.text} oninput={(e) => onChange({ ...value, text: e.currentTarget.value })}
	></textarea>
</label>
```

**5. `Render.stories.ts`** — a story per meaningful state (the block-development surface).

```ts
import type { Meta, StoryObj } from '@storybook/svelte';
import Render from './Render.svelte';

const meta = { title: 'Blocks/PullQuote', component: Render } satisfies Meta<typeof Render>;
export default meta;
export const Default: StoryObj<typeof meta> = {
	args: { props: { text: 'A line worth pausing on.', attribution: 'Riverwild' } }
};
```

**Register it** — the one line in [`registry.ts`](../src/lib/zine/registry.ts):

```ts
registerBlock(pullQuoteBlock);
```

That is the whole change. The document schema now validates `pullQuote` props, and `ZineRenderer`
renders it — no core edits.

## Tests to add

- The shared [registry test](../src/lib/zine/registry.test.ts) already covers your block's
  `defaults`-pass-`schema`, non-empty `label`, and category once it's registered.
- Add a render + axe assertion in [blocks.test.ts](../src/lib/zine/blocks/blocks.test.ts) if the block
  has notable semantics (the registry-default axe sweep already includes it).
- If `requiredForPublish` is set, assert it in a `publishBlockers` test.

## Checklist

- [ ] New folder under `blocks/`; **no edits** to `ZineRenderer` / `document.ts` / other core.
- [ ] `label` is human-facing; `defaults` pass `schema`; URLs use `SafeUrlSchema`; no `{@html}` of author content.
- [ ] Semantic, keyboard-accessible markup; `requiredForPublish` set for any a11y gate (e.g. alt text).
- [ ] Storybook story + tests; `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build-storybook` green.

See also: [best-practices/data-viz-and-charts.md](best-practices/data-viz-and-charts.md) (when a block
draws data) and [best-practices/scrollytelling.md](best-practices/scrollytelling.md) (animation presets,
Step 4).
