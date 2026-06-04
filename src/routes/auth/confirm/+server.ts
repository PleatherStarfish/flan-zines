// Magic-link / email-OTP target (the primary dev sign-in path). Verifies the
// token hash, sets the session cookies, and continues into the app.
import { redirect } from '@sveltejs/kit';
import type { EmailOtpType } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';

function safeAppRedirect(next: string | null): string {
	if (!next) return '/app';
	if (next === '/app' || next.startsWith('/app/')) return next;
	return '/app';
}

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const tokenHash = url.searchParams.get('token_hash');
	const type = url.searchParams.get('type') as EmailOtpType | null;
	const next = safeAppRedirect(url.searchParams.get('next'));

	if (tokenHash && type && supabase) {
		const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
		if (!error) throw redirect(303, next);
	}

	throw redirect(303, '/login?error=confirm');
};
