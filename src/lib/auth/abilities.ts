// App-layer permissions (CASL). ISOMORPHIC + framework-free — the SAME ability runs on the
// server (route guards) and the client (shaping nav/buttons). It MIRRORS the Postgres RLS
// (supabase/migrations/20260604120010_rls.sql); the database is still the real enforcement —
// this layer is defense-in-depth + UX, never the sole check.
//
// NB: this file must stay out of `$lib/server` so the client can import it; it therefore
// defines its own minimal `AbilityUser` shape (id + role) rather than importing the
// server-only `AppUser`.
import { AbilityBuilder, createMongoAbility, type MongoAbility } from '@casl/ability';
import type { AppRole } from '$lib/supabase/types';

export type Action = 'manage' | 'read' | 'create' | 'update' | 'delete' | 'moderate';
export type Subject =
	| 'User'
	| 'School'
	| 'Class'
	| 'ClassMember'
	| 'Zine'
	| 'Asset'
	| 'Report'
	| 'ModerationItem'
	| 'all';
// Subjects are matched by string type-name, so per-record conditions ({ owner_id }) are
// checked at runtime via `subject('Zine', row)`. We use CASL's default (loose) ability type
// so those conditions type-check; the `Action`/`Subject` literals above keep the API boundary
// (the builder + `requireAbility`) honest, and the matrix tests pin the runtime behaviour.
export type AppAbility = MongoAbility;

/** The minimal identity an ability needs. The server `AppUser` and the client `profile` both
 *  satisfy it (both carry `id` + `role`). */
export interface AbilityUser {
	id: string;
	role: AppRole;
}

/**
 * The ability for a signed-in user (or `null` = signed out, can do nothing). Record
 * conditions (`{ owner_id }`, `{ teacher_id }`) mirror the RLS row predicates so a per-record
 * `can(action, subject(Type, row))` check matches what the database would allow.
 */
export function defineAbilityFor(user: AbilityUser | null): AppAbility {
	const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

	if (user) {
		// Every signed-in user owns their own content + may file reports + read their own row.
		const own = { owner_id: user.id };
		can(['read', 'create', 'update', 'delete'], ['Zine', 'Asset'], own);
		can('create', 'Report');
		can('read', 'Report', { reporter_id: user.id });
		can('read', 'User', { id: user.id });

		// Teacher: moderate students' content + run their own classes (row-scoping to *their*
		// students/classes is enforced by RLS + scoped queries; this is the coarse capability).
		if (user.role === 'teacher') {
			can('read', ['User', 'Zine', 'Asset']);
			can('moderate', ['Zine', 'Asset']);
			can('manage', 'Class', { teacher_id: user.id });
			can(['read', 'create', 'delete'], 'ClassMember');
			can('manage', 'ModerationItem');
			can(['read', 'update'], 'Report');
		}

		// Admin sees and does everything.
		if (user.role === 'admin') {
			can('manage', 'all');
		}
	}

	return build();
}
