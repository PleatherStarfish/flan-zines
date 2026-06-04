// Hand-written subset of the database types. Once the Supabase CLI is wired into
// CI (Step 5), replace this with `supabase gen types typescript`. For now it
// covers the tables the app queries and keeps the client strongly typed (no `any`).

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type AppRole = 'student' | 'teacher' | 'admin';
export type ZineStatus = 'draft' | 'in_review' | 'published' | 'unlisted';

export interface Database {
	public: {
		Tables: {
			users: {
				Row: {
					id: string;
					role: AppRole;
					display_name: string | null;
					school_id: string | null;
					created_at: string;
				};
				Insert: {
					id: string;
					role?: AppRole;
					display_name?: string | null;
					school_id?: string | null;
				};
				Update: {
					display_name?: string | null;
					school_id?: string | null;
				};
				Relationships: [];
			};
			zines: {
				Row: {
					id: string;
					owner_id: string;
					title: string;
					slug: string | null;
					status: ZineStatus;
					cover_asset_id: string | null;
					theme: Json;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					owner_id: string;
					title?: string;
					slug?: string | null;
					status?: ZineStatus;
					theme?: Json;
				};
				Update: {
					title?: string;
					slug?: string | null;
					status?: ZineStatus;
					theme?: Json;
				};
				Relationships: [];
			};
		};
		Views: Record<string, never>;
		Functions: Record<string, never>;
		Enums: {
			app_role: AppRole;
			zine_status: ZineStatus;
		};
		CompositeTypes: Record<string, never>;
	};
}
