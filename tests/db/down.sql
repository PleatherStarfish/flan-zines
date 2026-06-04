-- Faithful inverse of the Step 1 migrations (schema + RLS). Used by the
-- reversibility test (tests/migrations/migrate.test.ts): apply migrations → run
-- this → assert a clean slate → re-apply. It reverses only what the MIGRATIONS
-- create; it deliberately leaves the Supabase platform/shim objects (auth schema,
-- auth.users, roles) untouched.

drop trigger if exists on_auth_user_created on auth.users;

drop table if exists
  public.reports,
  public.moderation_items,
  public.assets,
  public.zine_versions,
  public.zine_drafts,
  public.zines,
  public.class_members,
  public.classes,
  public.users,
  public.schools
  cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.guard_user_role() cascade;
drop function if exists public.guard_asset_moderation() cascade;
drop function if exists public.touch_updated_at() cascade;
drop function if exists public.app_role() cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.is_teacher_of(uuid) cascade;
drop function if exists public.is_class_teacher(uuid) cascade;
drop function if exists public.is_member_of(uuid) cascade;
drop function if exists public.can_edit_zine(uuid) cascade;

drop type if exists public.report_status;
drop type if exists public.moderation_status;
drop type if exists public.asset_kind;
drop type if exists public.zine_status;
drop type if exists public.app_role;
