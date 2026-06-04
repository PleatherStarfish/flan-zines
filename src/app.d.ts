// See https://svelte.dev/docs/kit/types#app.d.ts
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/types';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Request-scoped, RLS-enforced client. Null when Supabase is unconfigured. */
			supabase: SupabaseClient<Database> | null;
			/** Returns a session only after re-validating it with the auth server. */
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
			session: Session | null;
			user: User | null;
		}
		interface PageData {
			session?: Session | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
