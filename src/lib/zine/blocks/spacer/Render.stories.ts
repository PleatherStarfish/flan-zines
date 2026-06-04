import type { Meta, StoryObj } from '@storybook/svelte';
import Render from './Render.svelte';

const meta = {
	title: 'Blocks/Spacer',
	component: Render
} satisfies Meta<typeof Render>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Small: Story = { args: { props: { size: 'sm' } } };
export const Medium: Story = { args: { props: { size: 'md' } } };
export const Large: Story = { args: { props: { size: 'lg' } } };
