import type { Meta, StoryObj } from '@storybook/svelte';
import Render from './Render.svelte';

const meta = {
	title: 'Blocks/LinkButton',
	component: Render
} satisfies Meta<typeof Render>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Link: Story = {
	args: {
		props: { href: 'https://pudding.cool', label: 'Read more', variant: 'link', newTab: false }
	}
};

export const Button: Story = {
	args: {
		props: { href: 'https://pudding.cool', label: 'Keep reading', variant: 'button', newTab: true }
	}
};
