import type { Meta, StoryObj } from '@storybook/svelte';
import Render from './Render.svelte';
import type { RichTextProps } from './schema';

const meta = {
	title: 'Blocks/RichText',
	component: Render
} satisfies Meta<typeof Render>;
export default meta;

type Story = StoryObj<typeof meta>;

const doc: RichTextProps['doc'] = {
	type: 'doc',
	content: [
		{
			type: 'paragraph',
			content: [
				{ type: 'text', text: 'Some books only make sense ' },
				{ type: 'text', text: 'after dark', marks: [{ type: 'italic' }] },
				{ type: 'text', text: '. The ' },
				{ type: 'text', text: 'page glows', marks: [{ type: 'bold' }] },
				{ type: 'text', text: ', linking out to ' },
				{
					type: 'text',
					text: 'The Pudding',
					marks: [{ type: 'link', attrs: { href: 'https://pudding.cool' } }]
				},
				{ type: 'text', text: '.' }
			]
		},
		{
			type: 'bulletList',
			content: [
				{
					type: 'listItem',
					content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A single lamp' }] }]
				},
				{
					type: 'listItem',
					content: [{ type: 'paragraph', content: [{ type: 'text', text: 'One more chapter' }] }]
				}
			]
		}
	]
};

export const Formatted: Story = { args: { props: { doc } } };
