// OAuth (Google) redirect target. Exchanges the PKCE code for a session, sets the
// auth cookies, and lands the user in the app.
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const code = url.searchParams.get('code');
	const next = url.searchParams.get('next') ?? '/app';

	if (code && supabase) {
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error) throw redirect(303, next);
	}

	throw redirect(303, '/login?error=callback');
};
