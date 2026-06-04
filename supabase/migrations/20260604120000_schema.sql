-- Step 1 — Schema: identity, cohorts, content, media, safety.
-- Mirrors ARCHITECTURE.md §8. RLS policies live in the companion migration
-- 20260604120010_rls.sql; this file only defines structure + helper functions.
--
-- Assumes the Supabase platform environment (auth schema, auth.users, auth.uid(),
-- and the anon/authenticated/service_role roles). For Docker-free tests those are
-- provided by tests/db/supabase-shim.sql, which copies Supabase's definitions.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- Enumerated types
-- ─────────────────────────────────────────────────────────────────────────────
create type public.app_role as enum ('student', 'teacher', 'admin');
create type public.zine_status as enum ('draft', 'in_review', 'published', 'unlisted');
create type public.asset_kind as enum ('image', 'video', 'lottie');
create type public.moderation_status as enum ('pending', 'approved', 'rejected');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

-- ─────────────────────────────────────────────────────────────────────────────
-- Identity & cohorts
-- ─────────────────────────────────────────────────────────────────────────────

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Profile row, 1:1 with auth.users. We deliberately store MINIMAL PII: a display
-- ("pen") name and a role — never the email (that stays in auth.users). Populated
-- by the on_auth_user_created trigger so a profile always exists after sign-up.
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'student',
  display_name text,
  school_id uuid references public.schools (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.users (id) on delete cascade,
  school_id uuid references public.schools (id) on delete set null,
  name text not null,
  join_code text not null unique,
  created_at timestamptz not null default now()
);

create table public.class_members (
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, student_id)
);
create index class_members_student_idx on public.class_members (student_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Content
-- ─────────────────────────────────────────────────────────────────────────────

create table public.zines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  title text not null default 'Untitled zine',
  slug text,
  status public.zine_status not null default 'draft',
  cover_asset_id uuid,
  theme jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);
create index zines_owner_idx on public.zines (owner_id);
create index zines_status_idx on public.zines (status);

-- The live, editable document (block tree). Full Zod schema lands in Step 2.
create table public.zine_drafts (
  zine_id uuid primary key references public.zines (id) on delete cascade,
  document jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Immutable snapshots: autosave history + published versions. No UPDATE policy
-- is ever granted (see RLS migration) so a snapshot cannot be mutated after creation.
create table public.zine_versions (
  id uuid primary key default gen_random_uuid(),
  zine_id uuid not null references public.zines (id) on delete cascade,
  document jsonb not null,
  label text,
  created_at timestamptz not null default now()
);
create index zine_versions_zine_idx on public.zine_versions (zine_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Media
-- ─────────────────────────────────────────────────────────────────────────────

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  kind public.asset_kind not null,
  storage_path text not null,
  width int,
  height int,
  alt text,
  moderation_status public.moderation_status not null default 'pending',
  created_at timestamptz not null default now()
);
create index assets_owner_idx on public.assets (owner_id);

alter table public.zines
  add constraint zines_cover_asset_fk
  foreign key (cover_asset_id) references public.assets (id) on delete set null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Safety
-- ─────────────────────────────────────────────────────────────────────────────

create table public.moderation_items (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('zine', 'asset', 'version')),
  target_id uuid not null,
  status public.moderation_status not null default 'pending',
  reason text,
  reviewed_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  zine_id uuid references public.zines (id) on delete cascade,
  reporter_id uuid references public.users (id) on delete set null,
  reason text not null,
  status public.report_status not null default 'open',
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Authorization helpers (SECURITY DEFINER so policy checks never recurse through
-- RLS, and `search_path = ''` so they can't be hijacked — all names are qualified).
-- auth.uid() reflects the ORIGINAL caller even inside a definer function, because
-- it reads the request GUC rather than the executing role.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.app_role() returns public.app_role
  language sql stable security definer set search_path = ''
as $$ select u.role from public.users u where u.id = auth.uid() $$;

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin') $$;

create or replace function public.is_teacher_of(student uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.class_members cm
    join public.classes c on c.id = cm.class_id
    where cm.student_id = is_teacher_of.student
      and c.teacher_id = auth.uid()
  )
$$;

create or replace function public.is_class_teacher(class uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.classes c
    where c.id = is_class_teacher.class and c.teacher_id = auth.uid()
  )
$$;

create or replace function public.is_member_of(class uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.class_members cm
    where cm.class_id = is_member_of.class and cm.student_id = auth.uid()
  )
$$;

-- Owner / teacher / admin may edit a zine's private surfaces (draft, versions, …).
-- NB: this intentionally does NOT grant access on 'published' status — drafts stay
-- private even after a zine is published.
create or replace function public.can_edit_zine(zine uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.zines z
    where z.id = can_edit_zine.zine
      and (z.owner_id = auth.uid() or public.is_admin() or public.is_teacher_of(z.owner_id))
  )
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Triggers
-- ─────────────────────────────────────────────────────────────────────────────

-- Create the profile row when a new auth user signs up. Default pen name = the
-- email local-part (or Google full_name when present); never store the raw email.
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.users (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- A user may never escalate their own role. Only an admin (or a server/service
-- context with no JWT, e.g. seeding/rostering) may change `role`.
create or replace function public.guard_user_role() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only admins may change a user role';
  end if;
  return new;
end;
$$;

create trigger guard_user_role
  before update on public.users
  for each row execute function public.guard_user_role();

-- Students cannot self-approve their own media. Only a teacher/admin (or a
-- server/service context) may change moderation_status.
create or replace function public.guard_asset_moderation() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  if new.moderation_status is distinct from old.moderation_status
     and auth.uid() is not null
     and not (public.is_admin() or public.is_teacher_of(old.owner_id)) then
    raise exception 'Only teachers or admins may change moderation status';
  end if;
  return new;
end;
$$;

create trigger guard_asset_moderation
  before update on public.assets
  for each row execute function public.guard_asset_moderation();

-- Keep zines.updated_at fresh on edits.
create or replace function public.touch_updated_at() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger zines_touch_updated_at
  before update on public.zines
  for each row execute function public.touch_updated_at();
