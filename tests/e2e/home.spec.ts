import { expect, test } from '@playwright/test';

test('home page renders the Zine gallery shell', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1, name: 'Zine' })).toBeVisible();
	await expect(page.getByTestId('gallery-empty')).toBeVisible();
});
