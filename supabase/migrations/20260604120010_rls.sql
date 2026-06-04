-- Step 1 — Row-Level Security. Deny-by-default: every table has RLS enabled and
-- access is granted ONLY through the explicit policies below. The companion
-- cross-user deny tests (tests/rls/**) prove these hold against real Postgres.
--
-- Role model:
--   anon          unauthenticated visitors — may read only PUBLIC zine metadata
--   authenticated signed-in users — gated row-by-row by the policies here
--   service_role  server-side admin (BYPASSRLS) — never reaches client code
-- Application roles (student/teacher/admin) live in public.users.role.

-- ─────────────────────────────────────────────────────────────────────────────
-- Schema usage + table privileges. RLS only filters rows the role already has
-- table privileges for, so we grant broadly here and let the policies do the real
-- authorization. anon gets the narrowest surface possible.
-- ─────────────────────────────────────────────────────────────────────────────
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on
  public.schools, public.users, public.classes, public.class_members,
  public.zines, public.zine_drafts, public.zine_versions, public.assets,
  public.moderation_items, public.reports
  to authenticated, service_role;

-- anon may only ever SELECT published zine metadata (the public gallery, Step 5).
grant select on public.zines to anon;

grant execute on function
  public.app_role(), public.is_admin(), public.is_teacher_of(uuid),
  public.is_class_teacher(uuid), public.is_member_of(uuid), public.can_edit_zine(uuid)
  to anon, authenticated;

alter table public.schools enable row level security;
alter table public.users enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.zines enable row level security;
alter table public.zine_drafts enable row level security;
alter table public.zine_versions enable row level security;
alter table public.assets enable row level security;
alter table public.moderation_items enable row level security;
alter table public.reports enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- schools — reference data: any signed-in user reads; only admins write.
-- ─────────────────────────────────────────────────────────────────────────────
create policy schools_select on public.schools
  for select to authenticated using (true);
create policy schools_admin_write on public.schools
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- users — self, the student's teacher, or admin. No INSERT policy: rows are
-- created only by the SECURITY DEFINER on_auth_user_created trigger. Role changes
-- are further constrained by the guard_user_role trigger.
-- ─────────────────────────────────────────────────────────────────────────────
create policy users_select on public.users
  for select to authenticated
  using (id = auth.uid() or public.is_admin() or public.is_teacher_of(id));
create policy users_update_self on public.users
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy users_delete_admin on public.users
  for delete to authenticated using (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- classes — teacher owns; members read; admin all.
-- ─────────────────────────────────────────────────────────────────────────────
create policy classes_select on public.classes
  for select to authenticated
  using (teacher_id = auth.uid() or public.is_admin() or public.is_member_of(id));
create policy classes_insert on public.classes
  for insert to authenticated
  with check (teacher_id = auth.uid() and public.app_role() in ('teacher', 'admin'));
create policy classes_update on public.classes
  for update to authenticated
  using (teacher_id = auth.uid() or public.is_admin())
  with check (teacher_id = auth.uid() or public.is_admin());
create policy classes_delete on public.classes
  for delete to authenticated
  using (teacher_id = auth.uid() or public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- class_members — a student reads only their OWN membership. The roster is
-- managed by the class teacher (or admin). Self-enrolment via a validated join
-- code is a SECURITY DEFINER RPC in Step 6 — students cannot self-insert here,
-- so a guessed class id can't leak its join code or pollute the roster.
-- ─────────────────────────────────────────────────────────────────────────────
create policy class_members_select on public.class_members
  for select to authenticated
  using (student_id = auth.uid() or public.is_class_teacher(class_id) or public.is_admin());
create policy class_members_insert on public.class_members
  for insert to authenticated
  with check (public.is_class_teacher(class_id) or public.is_admin());
create policy class_members_delete on public.class_members
  for delete to authenticated
  using (public.is_class_teacher(class_id) or public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- zines — published is world-public (the gallery). Owners/teachers/admins also
-- see their own drafts/in_review/unlisted. draft & in_review are NEVER publicly
-- reachable. NOTE: 'unlisted' (link-only) is intentionally NOT exposed to anon
-- here — anon could otherwise enumerate it via the REST API. Link-only access is
-- defined by the publish pipeline in Step 5; until then unlisted == owner-private.
-- ─────────────────────────────────────────────────────────────────────────────
create policy zines_public_read on public.zines
  for select to anon, authenticated
  using (status = 'published');
create policy zines_owner_read on public.zines
  for select to authenticated
  using (owner_id = auth.uid() or public.is_admin() or public.is_teacher_of(owner_id));
create policy zines_insert on public.zines
  for insert to authenticated
  with check (owner_id = auth.uid());
create policy zines_update on public.zines
  for update to authenticated
  using (owner_id = auth.uid() or public.is_admin() or public.is_teacher_of(owner_id))
  with check (owner_id = auth.uid() or public.is_admin() or public.is_teacher_of(owner_id));
create policy zines_delete on public.zines
  for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- zine_drafts — the private working document. Owner/teacher/admin only; NEVER
-- public, even once the zine is published. This is the core cross-user boundary.
-- ─────────────────────────────────────────────────────────────────────────────
create policy zine_drafts_select on public.zine_drafts
  for select to authenticated using (public.can_edit_zine(zine_id));
create policy zine_drafts_insert on public.zine_drafts
  for insert to authenticated with check (public.can_edit_zine(zine_id));
create policy zine_drafts_update on public.zine_drafts
  for update to authenticated
  using (public.can_edit_zine(zine_id)) with check (public.can_edit_zine(zine_id));
create policy zine_drafts_delete on public.zine_drafts
  for delete to authenticated using (public.can_edit_zine(zine_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- zine_versions — immutable snapshots. No UPDATE policy exists, so a snapshot can
-- never be mutated. Public read of the *published* snapshot arrives in Step 5
-- (gated by zine_publications); for now versions are owner/teacher/admin only.
-- ─────────────────────────────────────────────────────────────────────────────
create policy zine_versions_select on public.zine_versions
  for select to authenticated using (public.can_edit_zine(zine_id));
create policy zine_versions_insert on public.zine_versions
  for insert to authenticated with check (public.can_edit_zine(zine_id));
create policy zine_versions_delete on public.zine_versions
  for delete to authenticated
  using (public.can_edit_zine(zine_id) or public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- assets — owner/teacher/admin. moderation_status changes are further constrained
-- by the guard_asset_moderation trigger (students cannot self-approve).
-- ─────────────────────────────────────────────────────────────────────────────
create policy assets_select on public.assets
  for select to authenticated
  using (owner_id = auth.uid() or public.is_admin() or public.is_teacher_of(owner_id));
create policy assets_insert on public.assets
  for insert to authenticated with check (owner_id = auth.uid());
create policy assets_update on public.assets
  for update to authenticated
  using (owner_id = auth.uid() or public.is_admin() or public.is_teacher_of(owner_id))
  with check (owner_id = auth.uid() or public.is_admin() or public.is_teacher_of(owner_id));
create policy assets_delete on public.assets
  for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- moderation_items — staff only. Students have NO access (deny-by-default).
-- (Server-side moderation in Step 6 runs as service_role and bypasses RLS.)
-- ─────────────────────────────────────────────────────────────────────────────
create policy moderation_staff_all on public.moderation_items
  for all to authenticated
  using (public.is_admin() or public.app_role() = 'teacher')
  with check (public.is_admin() or public.app_role() = 'teacher');

-- ─────────────────────────────────────────────────────────────────────────────
-- reports — anyone signed in may file a report about a zine; the reporter sees
-- their own; teachers/admins triage.
-- ─────────────────────────────────────────────────────────────────────────────
create policy reports_insert on public.reports
  for insert to authenticated with check (reporter_id = auth.uid());
create policy reports_select on public.reports
  for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin() or public.app_role() = 'teacher');
create policy reports_update on public.reports
  for update to authenticated
  using (public.is_admin() or public.app_role() = 'teacher')
  with check (public.is_admin() or public.app_role() = 'teacher');
create policy reports_delete on public.reports
  for delete to authenticated using (public.is_admin());
