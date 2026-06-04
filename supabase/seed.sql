-- Step 1 — Seed data for local development and the RLS cross-user deny tests.
--
-- Cast of characters (fixed UUIDs so tests can reference them):
--   Ms. Quill (teacher) ── teaches ──► Class "Period 3" (join code FALL01)
--     ├─ Riverwild (student, in class)  → 1 draft zine + 1 published zine + 1 asset
--     ├─ Inkwell   (student, in class)  → 1 draft zine
--     └─ Marigold  (student, NOT in class, unrelated) → files a report
--
-- These relationships exercise every RLS branch: owner, owner's-teacher,
-- unrelated-peer, and public/anon. Dev login: any seeded email + 'password123'.

-- 1) School --------------------------------------------------------------------
insert into public.schools (id, name) values
  ('00000000-0000-0000-0000-0000000005c1', 'Lakeside High');

-- 2) Auth users (the trigger creates matching public.users rows as 'student') ---
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000a001', 'quill@lakeside.test',
   crypt('password123', gen_salt('bf')), now(), '{"full_name":"Ms. Quill"}'),
  ('00000000-0000-0000-0000-00000000a101', 'river@lakeside.test',
   crypt('password123', gen_salt('bf')), now(), '{}'),
  ('00000000-0000-0000-0000-00000000a102', 'inkwell@lakeside.test',
   crypt('password123', gen_salt('bf')), now(), '{}'),
  ('00000000-0000-0000-0000-00000000a103', 'marigold@lakeside.test',
   crypt('password123', gen_salt('bf')), now(), '{}');

-- 3) Profiles: set roles, pen names, and school (auth.uid() is null here, so the
--    guard_user_role trigger permits the seed to assign the teacher role).
update public.users set role = 'teacher', display_name = 'Ms. Quill',
  school_id = '00000000-0000-0000-0000-0000000005c1'
  where id = '00000000-0000-0000-0000-00000000a001';
update public.users set display_name = 'Riverwild',
  school_id = '00000000-0000-0000-0000-0000000005c1'
  where id = '00000000-0000-0000-0000-00000000a101';
update public.users set display_name = 'Inkwell',
  school_id = '00000000-0000-0000-0000-0000000005c1'
  where id = '00000000-0000-0000-0000-00000000a102';
update public.users set display_name = 'Marigold',
  school_id = '00000000-0000-0000-0000-0000000005c1'
  where id = '00000000-0000-0000-0000-00000000a103';

-- 4) Class + roster (Riverwild and Inkwell; Marigold deliberately excluded) -----
insert into public.classes (id, teacher_id, school_id, name, join_code) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000a001',
   '00000000-0000-0000-0000-0000000005c1', 'Period 3 — Memoir', 'FALL01');

insert into public.class_members (class_id, student_id) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000a101'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000a102');

-- 5) Zines: Riverwild has a private draft and a published zine; Inkwell a draft --
insert into public.zines (id, owner_id, title, slug, status) values
  ('00000000-0000-0000-0000-000000007101', '00000000-0000-0000-0000-00000000a101',
   'Why We Read at Night', null, 'draft'),
  ('00000000-0000-0000-0000-000000007102', '00000000-0000-0000-0000-00000000a101',
   'The Quiet Hour', 'the-quiet-hour', 'published'),
  ('00000000-0000-0000-0000-000000007201', '00000000-0000-0000-0000-00000000a102',
   'Field Notes', null, 'draft');

insert into public.zine_drafts (zine_id, document) values
  ('00000000-0000-0000-0000-000000007101', '{}'::jsonb),
  ('00000000-0000-0000-0000-000000007102', '{}'::jsonb),
  ('00000000-0000-0000-0000-000000007201', '{}'::jsonb);

-- Immutable published snapshot for "The Quiet Hour".
insert into public.zine_versions (id, zine_id, document, label) values
  ('00000000-0000-0000-0000-000000009001', '00000000-0000-0000-0000-000000007102',
   '{}'::jsonb, 'published v1');

-- 6) Media: one of Riverwild's images, still pending moderation -----------------
insert into public.assets (id, owner_id, kind, storage_path, alt, moderation_status) values
  ('00000000-0000-0000-0000-000000008001', '00000000-0000-0000-0000-00000000a101',
   'image', 'river/lamp-desk.jpg', 'A lamp-lit desk at night', 'pending');

-- 7) Safety rows: a moderation item and a report by the unrelated student -------
insert into public.moderation_items (id, target_type, target_id, status) values
  ('00000000-0000-0000-0000-00000000b001', 'asset',
   '00000000-0000-0000-0000-000000008001', 'pending');

insert into public.reports (id, zine_id, reporter_id, reason) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-000000007102',
   '00000000-0000-0000-0000-00000000a103', 'Spelling looks off in the third panel.');
