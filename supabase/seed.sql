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
-- Keep these rows shaped like GoTrue-created email/password users so local Auth
-- accepts seeded logins after `supabase db reset`.
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  email_change_token_current,
  reauthentication_token,
  phone_change,
  phone_change_token,
  email_change_confirm_status,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-00000000a001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'quill@lakeside.test',
    crypt('password123', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    0,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Ms. Quill","sub":"00000000-0000-0000-0000-00000000a001","email":"quill@lakeside.test","email_verified":true,"phone_verified":false}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-00000000a101',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'river@lakeside.test',
    crypt('password123', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    0,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"sub":"00000000-0000-0000-0000-00000000a101","email":"river@lakeside.test","email_verified":true,"phone_verified":false}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-00000000a102',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'inkwell@lakeside.test',
    crypt('password123', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    0,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"sub":"00000000-0000-0000-0000-00000000a102","email":"inkwell@lakeside.test","email_verified":true,"phone_verified":false}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-00000000a103',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'marigold@lakeside.test',
    crypt('password123', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    0,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"sub":"00000000-0000-0000-0000-00000000a103","email":"marigold@lakeside.test","email_verified":true,"phone_verified":false}'::jsonb,
    now(),
    now()
  );

insert into auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  id::text,
  id,
  jsonb_build_object(
    'sub',
    id::text,
    'email',
    email,
    'email_verified',
    true,
    'phone_verified',
    false
  ),
  'email',
  now(),
  now(),
  now()
from auth.users
where email like '%@lakeside.test';

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
  ('00000000-0000-0000-0000-000000007101', $river_draft$
    {
      "schemaVersion": 3,
      "theme": {},
      "acts": [
        {
          "id": "act_seed_river",
          "scenes": [
            {
              "id": "scn_seed_night",
              "type": "page",
              "length": "auto",
              "beats": [{ "id": "beat_seed_night", "at": 0 }],
              "elements": [
                {
                  "id": "el_seed_heading_night",
                  "track": "content",
                  "range": { "start": 0, "end": 1 },
                  "block": {
                    "id": "blk_seed_heading_night",
                    "type": "heading",
                    "props": { "text": "Why We Read at Night", "level": 2 }
                  }
                },
                {
                  "id": "el_seed_text_night",
                  "track": "content",
                  "range": { "start": 0, "end": 1 },
                  "block": {
                    "id": "blk_seed_text_night",
                    "type": "richText",
                    "props": {
                      "doc": {
                        "type": "doc",
                        "content": [
                          {
                            "type": "paragraph",
                            "content": [
                              {
                                "type": "text",
                                "text": "Start with the moment the room gets quiet."
                              }
                            ]
                          }
                        ]
                      }
                    }
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  $river_draft$::jsonb),
  ('00000000-0000-0000-0000-000000007102', $river_published_draft$
    {
      "schemaVersion": 3,
      "theme": {},
      "acts": [
        {
          "id": "act_seed_quiet",
          "scenes": [
            {
              "id": "scn_seed_quiet",
              "type": "page",
              "length": "auto",
              "beats": [{ "id": "beat_seed_quiet", "at": 0 }],
              "elements": [
                {
                  "id": "el_seed_heading_quiet",
                  "track": "content",
                  "range": { "start": 0, "end": 1 },
                  "block": {
                    "id": "blk_seed_heading_quiet",
                    "type": "heading",
                    "props": { "text": "The Quiet Hour", "level": 2 }
                  }
                },
                {
                  "id": "el_seed_text_quiet",
                  "track": "content",
                  "range": { "start": 0, "end": 1 },
                  "block": {
                    "id": "blk_seed_text_quiet",
                    "type": "richText",
                    "props": {
                      "doc": {
                        "type": "doc",
                        "content": [
                          {
                            "type": "paragraph",
                            "content": [
                              {
                                "type": "text",
                                "text": "The best reading light is the one that makes the rest of the house disappear."
                              }
                            ]
                          }
                        ]
                      }
                    }
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  $river_published_draft$::jsonb),
  ('00000000-0000-0000-0000-000000007201', $inkwell_draft$
    {
      "schemaVersion": 3,
      "theme": {},
      "acts": [
        {
          "id": "act_seed_field_notes",
          "scenes": [
            {
              "id": "scn_seed_field_notes",
              "type": "page",
              "length": "auto",
              "beats": [{ "id": "beat_seed_field_notes", "at": 0 }],
              "elements": [
                {
                  "id": "el_seed_heading_field_notes",
                  "track": "content",
                  "range": { "start": 0, "end": 1 },
                  "block": {
                    "id": "blk_seed_heading_field_notes",
                    "type": "heading",
                    "props": { "text": "Field Notes", "level": 2 }
                  }
                },
                {
                  "id": "el_seed_text_field_notes",
                  "track": "content",
                  "range": { "start": 0, "end": 1 },
                  "block": {
                    "id": "blk_seed_text_field_notes",
                    "type": "richText",
                    "props": {
                      "doc": {
                        "type": "doc",
                        "content": [
                          {
                            "type": "paragraph",
                            "content": [
                              {
                                "type": "text",
                                "text": "Notice one small thing, then follow it."
                              }
                            ]
                          }
                        ]
                      }
                    }
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  $inkwell_draft$::jsonb);

-- Immutable published snapshot for "The Quiet Hour".
insert into public.zine_versions (id, zine_id, document, label) values
  ('00000000-0000-0000-0000-000000009001', '00000000-0000-0000-0000-000000007102',
   $quiet_hour_version$
    {
      "schemaVersion": 3,
      "theme": {},
      "acts": [
        {
          "id": "act_seed_version_quiet",
          "scenes": [
            {
              "id": "scn_seed_version_quiet",
              "type": "page",
              "length": "auto",
              "beats": [{ "id": "beat_seed_version_quiet", "at": 0 }],
              "elements": [
                {
                  "id": "el_seed_version_heading_quiet",
                  "track": "content",
                  "range": { "start": 0, "end": 1 },
                  "block": {
                    "id": "blk_seed_version_heading_quiet",
                    "type": "heading",
                    "props": { "text": "The Quiet Hour", "level": 2 }
                  }
                },
                {
                  "id": "el_seed_version_text_quiet",
                  "track": "content",
                  "range": { "start": 0, "end": 1 },
                  "block": {
                    "id": "blk_seed_version_text_quiet",
                    "type": "richText",
                    "props": {
                      "doc": {
                        "type": "doc",
                        "content": [
                          {
                            "type": "paragraph",
                            "content": [
                              {
                                "type": "text",
                                "text": "At nine, the house turns into a library."
                              }
                            ]
                          }
                        ]
                      }
                    }
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  $quiet_hour_version$::jsonb, 'published v1');

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
