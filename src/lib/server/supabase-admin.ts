// SERVER-ONLY. The service-role key bypasses Row-Level Security, so this module
// must never be imported outside src/lib/server/** — enforced by the ESLint rule
// `zine/no-service-role-outside-server` and tests/unit/no-service-role-leak.test.ts,
// and by SvelteKit's refusal to bundle $lib/server into client code.
//
// Used by privileged server flows (seeding, moderation in Step 6, the publish
// service in Step 5). Authenticated user requests must use event.locals.supabase
// (the anon-key client) so RLS still applies.
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { supabaseUrl } from '$lib/supabase/config';
import type { Database } from '$lib/supabase/types';

export function createAdminClient() {
	const key = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !key) {
		throw new Error('Admin client requires PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
	}
	return createClient<Database>(supabaseUrl, key, {
		auth: { persistSession: false, autoRefreshToken: false }
	});
}
