// The public zine page renders a document through ZineRenderer (Step 2 fixture).
// These run against the production preview with no backend — the route uses a
// fixture, proving the schema → renderer path and that the page is server-rendered.
import { expect, test } from '@playwright/test';

const ZINE_URL = '/z/riverwild/why-we-read-at-night';

test('a zine renders semantic content from its document', async ({ page }) => {
	await page.goto('/');
	await page.getByTestId('sample-zine-link').click();
	await expect(page).toHaveURL(ZINE_URL);

	await expect(page.getByRole('heading', { level: 1, name: 'Why We Read at Night' })).toBeVisible();
	await expect(page.getByRole('heading', { level: 2, name: 'The lamp-lit hour' })).toBeVisible();
	await expect(page.getByRole('heading', { level: 3, name: 'Why night?' })).toBeVisible();
	await expect(page.getByRole('img', { name: /lamp/i })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Keep reading' })).toBeVisible();
	await expect(page.getByText('By Riverwild')).toBeVisible();
});

test('the zine page is server-rendered (content present with JavaScript disabled)', async ({
	browser
}) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	await page.goto(ZINE_URL);
	await expect(page.getByRole('heading', { level: 1, name: 'Why We Read at Night' })).toBeVisible();
	await expect(page.getByRole('img', { name: /lamp/i })).toBeVisible();
	await context.close();
});
