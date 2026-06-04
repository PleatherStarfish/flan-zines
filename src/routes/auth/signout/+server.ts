// Sign out via POST (state-changing, so never a GET link). Clears the session and
// returns to the public homepage.
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals: { supabase } }) => {
	if (supabase) await supabase.auth.signOut();
	throw redirect(303, '/');
};
