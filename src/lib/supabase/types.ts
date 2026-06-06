// Hand-written subset of the database types. Once the Supabase CLI is wired into
// CI (Step 5), replace this with `supabase gen types typescript`. For now it
// covers the tables the app queries and keeps the client strongly typed (no `any`).

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type AppRole = 'student' | 'teacher' | 'admin';
export type ZineStatus = 'draft' | 'in_review' | 'published' | 'unlisted';
export type AssetKind = 'image' | 'video' | 'lottie';
export type ModerationStatus = 'pending' | 'approved' | 'rejected';
export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';

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
					// `role` is admin-only (enforced by RLS + the guard_user_role trigger); typed
					// here so the admin dashboard can set it.
					role?: AppRole;
					display_name?: string | null;
					school_id?: string | null;
				};
				Relationships: [];
			};
			schools: {
				Row: { id: string; name: string; created_at: string };
				Insert: { name: string };
				Update: { name?: string };
				Relationships: [];
			};
			classes: {
				Row: {
					id: string;
					teacher_id: string;
					school_id: string | null;
					name: string;
					join_code: string;
					created_at: string;
				};
				Insert: { teacher_id: string; name: string; join_code: string; school_id?: string | null };
				Update: { name?: string; school_id?: string | null };
				Relationships: [];
			};
			class_members: {
				Row: { class_id: string; student_id: string; created_at: string };
				Insert: { class_id: string; student_id: string };
				Update: Record<string, never>;
				Relationships: [];
			};
			assets: {
				Row: {
					id: string;
					owner_id: string;
					kind: AssetKind;
					storage_path: string;
					width: number | null;
					height: number | null;
					alt: string | null;
					moderation_status: ModerationStatus;
					created_at: string;
				};
				Insert: { owner_id: string; kind: AssetKind; storage_path: string; alt?: string | null };
				Update: { moderation_status?: ModerationStatus; alt?: string | null };
				Relationships: [];
			};
			moderation_items: {
				Row: {
					id: string;
					target_type: string;
					target_id: string;
					status: ModerationStatus;
					reason: string | null;
					reviewed_by: string | null;
					created_at: string;
				};
				Insert: { target_type: string; target_id: string; reason?: string | null };
				Update: { status?: ModerationStatus; reviewed_by?: string | null };
				Relationships: [];
			};
			reports: {
				Row: {
					id: string;
					zine_id: string | null;
					reporter_id: string | null;
					reason: string;
					status: ReportStatus;
					created_at: string;
				};
				Insert: { zine_id?: string | null; reporter_id?: string | null; reason: string };
				Update: { status?: ReportStatus };
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
			zine_drafts: {
				Row: { zine_id: string; document: Json; updated_at: string };
				Insert: { zine_id: string; document: Json; updated_at?: string };
				Update: { document?: Json; updated_at?: string };
				Relationships: [];
			};
		};
		Views: Record<string, never>;
		Functions: Record<string, never>;
		Enums: {
			app_role: AppRole;
			zine_status: ZineStatus;
			asset_kind: AssetKind;
			moderation_status: ModerationStatus;
			report_status: ReportStatus;
		};
		CompositeTypes: Record<string, never>;
	};
}
