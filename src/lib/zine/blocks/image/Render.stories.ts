import type { Meta, StoryObj } from '@storybook/svelte';
import Render from './Render.svelte';

const meta = {
	title: 'Blocks/Image',
	component: Render
} satisfies Meta<typeof Render>;
export default meta;

type Story = StoryObj<typeof meta>;

export const WithCaption: Story = {
	args: {
		props: {
			src: '/zine-sample.svg',
			alt: 'A desk lit by a single lamp against a dark window at night',
			caption: 'Reading after the house goes quiet.'
		}
	}
};

export const NoCaption: Story = {
	args: { props: { src: '/zine-sample.svg', alt: 'A lamp-lit desk at night' } }
};
