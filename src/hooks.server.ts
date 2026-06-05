// Server hooks: bind a request-scoped Supabase client to cookies, expose a
// validated `safeGetSession`, and guard the authed `/app` area. When Supabase is
// not configured (fresh clone / CI build with no env) everything degrades to
// "logged out" so public pages still render and `/app` simply redirects to login.
import { createServerClient } from '@supabase/ssr';
import type { RealtimeClientOptions } from '@supabase/supabase-js';
import { type Handle, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import WebSocket from 'ws';
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from '$lib/supabase/config';
import type { Database } from '$lib/supabase/types';

const websocketTransport = WebSocket as unknown as NonNullable<RealtimeClientOptions['transport']>;

const supabase: Handle = async ({ event, resolve }) => {
	if (!isSupabaseConfigured) {
		event.locals.supabase = null;
		event.locals.safeGetSession = async () => ({ session: null, user: null });
		return resolve(event);
	}

	event.locals.supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
		realtime: {
			transport: websocketTransport
		},
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet) => {
				for (const { name, value, options } of cookiesToSet) {
					event.cookies.set(name, value, { ...options, path: '/' });
				}
			}
		}
	});

	// getSession() alone trusts the cookie; getUser() re-validates it against the
	// auth server. We only trust a session that passes getUser().
	event.locals.safeGetSession = async () => {
		const client = event.locals.supabase;
		if (!client) return { session: null, user: null };
		const {
			data: { session }
		} = await client.auth.getSession();
		if (!session) return { session: null, user: null };
		const {
			data: { user },
			error
		} = await client.auth.getUser();
		if (error) return { session: null, user: null };
		return { session, user };
	};

	return resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});
};

const authGuard: Handle = async ({ event, resolve }) => {
	const { session, user } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.user = user;

	if (!session && event.url.pathname.startsWith('/app')) {
		throw redirect(303, '/login');
	}
	if (session && event.url.pathname === '/login') {
		throw redirect(303, '/app');
	}

	return resolve(event);
};

export const handle = sequence(supabase, authGuard);
