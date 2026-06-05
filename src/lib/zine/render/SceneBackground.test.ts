// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import SceneBackground from './SceneBackground.svelte';

describe('SceneBackground', () => {
	it('renders an image fill as a decorative, non-interactive layer', () => {
		const { container } = render(SceneBackground, {
			props: {
				background: { fill: { kind: 'image', src: '/x.svg', fit: 'cover' } },
				progress: 0,
				pinned: true
			}
		});
		const layer = container.querySelector('.zine-bg');
		expect(layer?.getAttribute('aria-hidden')).toBe('true');
		expect(layer?.classList.contains('is-pinned')).toBe(true);
		const img = container.querySelector('img.zine-bg__media');
		expect(img?.getAttribute('src')).toBe('/x.svg');
		expect(img?.getAttribute('alt')).toBe(''); // decorative
	});

	it('renders a scrim for the overlay', () => {
		const { container } = render(SceneBackground, {
			props: {
				background: {
					fill: { kind: 'image', src: '/x.svg', fit: 'cover' },
					overlay: { color: '#000000', opacity: 0.4 }
				}
			}
		});
		expect(container.querySelector('.zine-bg__scrim')).toBeTruthy();
	});

	it('renders a canvas host for a canvas fill', () => {
		const { container } = render(SceneBackground, {
			props: {
				background: {
					fill: {
						kind: 'canvas',
						preset: 'drift-field',
						params: { density: 'medium', speed: 'slow', tint: 'ink' }
					}
				}
			}
		});
		expect(container.querySelector('canvas.zine-bg__canvas')).toBeTruthy();
	});

	it('renders nothing when there is no fill or overlay', () => {
		const { container } = render(SceneBackground, { props: { background: { color: '#ffffff' } } });
		expect(container.querySelector('.zine-bg')).toBeNull();
	});
});
