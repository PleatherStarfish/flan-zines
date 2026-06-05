// Auth-guard and sign-in UI e2e. These run against the production preview with NO
// backend configured, which exercises the real hooks.server.ts guard: anonymous
// requests to /app must redirect to /login, and the login page must render both
// sign-in paths.
//
// The end-to-end magic-link happy path (sign in → see only your zines) and
// app-level cross-user checks require the live Supabase stack; the authoritative
// ownership proof is the database-level RLS suite in tests/rls/** (run in CI
// against Postgres). See README "Testing".

import { expect, test } from '@playwright/test';

test('homepage links to the sign-in page', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('link', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/login$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
});

test('login page offers Google and magic-link sign-in', async ({ page }) => {
	await page.goto('/login');
	await expect(page.getByRole('button', { name: /Continue with Google/ })).toBeVisible();
	await expect(page.getByLabel('School email')).toBeVisible();
	await expect(page.getByRole('button', { name: /magic link/i })).toBeVisible();
	await expect(page.getByRole('button', { name: /Continue as Riverwild/i })).toHaveCount(0);
});

test('unauthenticated users are redirected away from /app', async ({ page }) => {
	await page.goto('/app');
	await expect(page).toHaveURL(/\/login$/);
});
