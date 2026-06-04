import type { Meta, StoryObj } from '@storybook/svelte';
import Render from './Render.svelte';

const meta = {
	title: 'Blocks/Heading',
	component: Render
} satisfies Meta<typeof Render>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Level2: Story = { args: { props: { text: 'The lamp-lit hour', level: 2 } } };
export const Level3: Story = { args: { props: { text: 'A smaller heading', level: 3 } } };
export const Level4: Story = { args: { props: { text: 'Smaller still', level: 4 } } };
