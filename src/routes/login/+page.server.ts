// Magic-link sign-in (the dev path; works out of the box on the local Supabase
// stack, where the email is captured by Inbucket). Google OAuth is handled
// client-side in +page.svelte.
import { dev } from '$app/environment';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DEV_LOGIN_PASSWORD = 'password123';
const DEV_PERSONAS = {
	student: {
		email: 'river@lakeside.test',
		redirectTo: '/app'
	},
	teacher: {
		email: 'quill@lakeside.test',
		redirectTo: '/app/teacher'
	}
} as const;

export const actions: Actions = {
	devlogin: async ({ request, locals: { supabase } }) => {
		if (!dev) return fail(404, { message: 'The development login is available only in dev.' });
		if (!supabase) {
			return fail(503, {
				message:
					'Start the local Supabase stack, copy PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY into .env, then restart pnpm dev.'
			});
		}

		const form = await request.formData();
		const personaId = String(form.get('persona') ?? 'student');
		const persona =
			personaId in DEV_PERSONAS ? DEV_PERSONAS[personaId as keyof typeof DEV_PERSONAS] : null;
		if (!persona) return fail(400, { message: 'Pick a valid development login.' });

		const { error } = await supabase.auth.signInWithPassword({
			email: persona.email,
			password: DEV_LOGIN_PASSWORD
		});
		if (error) return fail(400, { message: `Dev login failed: ${error.message}` });

		throw redirect(303, persona.redirectTo);
	},
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
