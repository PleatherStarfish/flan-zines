// Public Supabase config, read at runtime so the app builds without secrets and
// degrades gracefully when the backend isn't wired up (e.g. CI build, first clone).
import { env } from '$env/dynamic/public';

export const supabaseUrl = env.PUBLIC_SUPABASE_URL ?? '';
export const supabaseAnonKey = env.PUBLIC_SUPABASE_ANON_KEY ?? '';

/** True when both public Supabase values are present. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
