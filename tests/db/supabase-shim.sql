-- Supabase-compatible shim for Docker-free RLS testing.
--
-- In production these objects are provided and managed by Supabase (GoTrue + the
-- platform bootstrap): the `auth` schema, `auth.users`, the `auth.uid()/role()/jwt()`
-- helpers, and the `anon` / `authenticated` / `service_role` Postgres roles.
--
-- Our migrations under supabase/migrations/** assume that environment. To prove the
-- Row-Level Security policies on plain Postgres (CI service container or a local
-- cluster) — i.e. WITHOUT Docker or the Supabase CLI — we recreate just enough of
-- that contract here. The function bodies are copied from Supabase's own definitions
-- so a policy that passes here behaves identically against real Supabase.
--
-- This file is TEST INFRASTRUCTURE ONLY. It is never shipped and never applied by
-- the Supabase CLI (which manages these objects itself).

create extension if not exists pgcrypto;

-- Platform roles. `service_role` carries BYPASSRLS exactly as Supabase configures it.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

create schema if not exists auth;

-- Minimal mirror of auth.users (only the columns our schema/seed touch). The
-- instance_id/aud/role columns exist so supabase/seed.sql is identical whether it
-- runs here or against real Supabase (where these columns already exist).
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid default '00000000-0000-0000-0000-000000000000',
  aud text default 'authenticated',
  role text default 'authenticated',
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Supabase's auth.* claim helpers, verbatim: they read the per-request GUC
-- `request.jwt.claims` that PostgREST/GoTrue set. Tests set the same GUC.
create or replace function auth.uid() returns uuid
  language sql stable
as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid $$;

create or replace function auth.role() returns text
  language sql stable
as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '')::text $$;

create or replace function auth.email() returns text
  language sql stable
as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'email', '')::text $$;

create or replace function auth.jwt() returns jsonb
  language sql stable
as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;
grant execute on function auth.uid(), auth.role(), auth.email(), auth.jwt()
  to anon, authenticated, service_role;
