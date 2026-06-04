import type { Meta, StoryObj } from '@storybook/svelte';
import Render from './Render.svelte';

const meta = {
	title: 'Blocks/Divider',
	component: Render
} satisfies Meta<typeof Render>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { props: {} } };
