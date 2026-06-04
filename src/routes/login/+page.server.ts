// Magic-link sign-in (the dev path; works out of the box on the local Supabase
// stack, where the email is captured by Inbucket). Google OAuth is handled
// client-side in +page.svelte.
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const actions: Actions = {
	magiclink: async ({ request, url, locals: { supabase } }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();

		if (!EMAIL_RE.test(email)) {
			return fail(400, { email, message: 'Enter a valid school email address.' });
		}
		if (!supabase) {
			return fail(503, { email, message: 'Sign-in is not configured in this environment.' });
		}

		const { error } = await supabase.auth.signInWithOtp({
			email,
			options: { emailRedirectTo: `${url.origin}/auth/confirm` }
		});

		if (error) {
			return fail(400, { email, message: error.message });
		}
		return { success: true, email };
	}
};
