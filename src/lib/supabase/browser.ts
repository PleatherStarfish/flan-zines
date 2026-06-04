// Lazily-created browser Supabase client (singleton). Used only for client-side
// auth interactions that must originate in the browser — currently the Google
// OAuth handshake. Server-side reads use `event.locals.supabase` from hooks.
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from './config';
import type { Database } from './types';

let client: SupabaseClient<Database> | null = null;

export function getBrowserClient(): SupabaseClient<Database> | null {
	if (!isSupabaseConfigured) return null;
	if (!client) client = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
	return client;
}
