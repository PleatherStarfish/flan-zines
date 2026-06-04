// Gate for the whole authed area. hooks.server.ts already redirects anonymous
// requests to /app, but we re-check here (defense in depth) and load the caller's
// profile (pen name + role) for the app chrome.
import { redirect } from '@sveltejs/kit';
import { getAppUser } from '$lib/server/roles';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		throw redirect(303, '/login');
	}

	const profile = supabase ? await getAppUser(supabase, user.id) : null;
	return { profile, email: user.email ?? null };
};
