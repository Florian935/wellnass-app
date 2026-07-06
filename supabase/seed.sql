-- Seed de développement (données de test bilingues FR+EN : exercices, programmes, aliments).
-- Exécuté par `supabase db reset`. Vide tant qu'aucune table de contenu n'existe.
-- À enrichir avec les US de contenu (voir /seed dans bonnes-pratiques §13).

-- ============================================================
-- US1 — 16 exercices de bibliothèque (bilingues FR + EN)
-- Réf. : apps/mobile/src/data/exercises.ts, schema-donnees-muscu.md §5
--
-- Correspondance ex-slug → UUID exercise (owner_id null, source 'library') :
--   ex-bench-press      → a1000001-0000-4000-8000-000000000001
--   ex-incline-press    → a1000002-0000-4000-8000-000000000002
--   ex-push-up          → a1000003-0000-4000-8000-000000000003
--   ex-pull-up          → a1000004-0000-4000-8000-000000000004
--   ex-barbell-row      → a1000005-0000-4000-8000-000000000005
--   ex-lat-pulldown     → a1000006-0000-4000-8000-000000000006
--   ex-squat            → a1000007-0000-4000-8000-000000000007
--   ex-deadlift         → a1000008-0000-4000-8000-000000000008
--   ex-leg-press        → a1000009-0000-4000-8000-000000000009
--   ex-lunge            → a1000010-0000-4000-8000-000000000010
--   ex-overhead-press   → a1000011-0000-4000-8000-000000000011
--   ex-lateral-raise    → a1000012-0000-4000-8000-000000000012
--   ex-biceps-curl      → a1000013-0000-4000-8000-000000000013
--   ex-triceps-ext      → a1000014-0000-4000-8000-000000000014
--   ex-plank            → a1000015-0000-4000-8000-000000000015
--   ex-crunch           → a1000016-0000-4000-8000-000000000016
--
-- UUIDs des traductions : b10000<ex_seq>-<00/01>-4000-8000-<seq3>
--   FR → b1000001-0001-4000-8000-000000000001 … b1000016-0001-4000-8000-000000000016
--   EN → b1000001-0002-4000-8000-000000000001 … b1000016-0002-4000-8000-000000000016
-- ============================================================

-- -----------------------------------------------------------
-- exercises (bibliothèque — owner_id null, source 'library')
-- on conflict (id) do nothing → ré-exécution idempotente
-- -----------------------------------------------------------
insert into public.exercises (id, owner_id, source, muscle_primary, equipment, media_url, created_at, updated_at)
values
  ('a1000001-0000-4000-8000-000000000001', null, 'library', 'chest',     null, null, now(), now()),
  ('a1000002-0000-4000-8000-000000000002', null, 'library', 'chest',     null, null, now(), now()),
  ('a1000003-0000-4000-8000-000000000003', null, 'library', 'chest',     null, null, now(), now()),
  ('a1000004-0000-4000-8000-000000000004', null, 'library', 'back',      null, null, now(), now()),
  ('a1000005-0000-4000-8000-000000000005', null, 'library', 'back',      null, null, now(), now()),
  ('a1000006-0000-4000-8000-000000000006', null, 'library', 'back',      null, null, now(), now()),
  ('a1000007-0000-4000-8000-000000000007', null, 'library', 'legs',      null, null, now(), now()),
  ('a1000008-0000-4000-8000-000000000008', null, 'library', 'legs',      null, null, now(), now()),
  ('a1000009-0000-4000-8000-000000000009', null, 'library', 'legs',      null, null, now(), now()),
  ('a1000010-0000-4000-8000-000000000010', null, 'library', 'legs',      null, null, now(), now()),
  ('a1000011-0000-4000-8000-000000000011', null, 'library', 'shoulders', null, null, now(), now()),
  ('a1000012-0000-4000-8000-000000000012', null, 'library', 'shoulders', null, null, now(), now()),
  ('a1000013-0000-4000-8000-000000000013', null, 'library', 'arms',      null, null, now(), now()),
  ('a1000014-0000-4000-8000-000000000014', null, 'library', 'arms',      null, null, now(), now()),
  ('a1000015-0000-4000-8000-000000000015', null, 'library', 'core',      null, null, now(), now()),
  ('a1000016-0000-4000-8000-000000000016', null, 'library', 'core',      null, null, now(), now())
on conflict (id) do nothing;

-- -----------------------------------------------------------
-- exercise_translations FR
-- -----------------------------------------------------------
insert into public.exercise_translations (id, exercise_id, owner_id, lang, name, instructions, created_at, updated_at)
values
  ('b1000001-0001-4000-8000-000000000001', 'a1000001-0000-4000-8000-000000000001', null, 'fr', 'Développé couché',      null, now(), now()),
  ('b1000002-0001-4000-8000-000000000002', 'a1000002-0000-4000-8000-000000000002', null, 'fr', 'Développé incliné',     null, now(), now()),
  ('b1000003-0001-4000-8000-000000000003', 'a1000003-0000-4000-8000-000000000003', null, 'fr', 'Pompes',                null, now(), now()),
  ('b1000004-0001-4000-8000-000000000004', 'a1000004-0000-4000-8000-000000000004', null, 'fr', 'Traction',              null, now(), now()),
  ('b1000005-0001-4000-8000-000000000005', 'a1000005-0000-4000-8000-000000000005', null, 'fr', 'Rowing barre',          null, now(), now()),
  ('b1000006-0001-4000-8000-000000000006', 'a1000006-0000-4000-8000-000000000006', null, 'fr', 'Tirage vertical',       null, now(), now()),
  ('b1000007-0001-4000-8000-000000000007', 'a1000007-0000-4000-8000-000000000007', null, 'fr', 'Squat',                 null, now(), now()),
  ('b1000008-0001-4000-8000-000000000008', 'a1000008-0000-4000-8000-000000000008', null, 'fr', 'Soulevé de terre',      null, now(), now()),
  ('b1000009-0001-4000-8000-000000000009', 'a1000009-0000-4000-8000-000000000009', null, 'fr', 'Presse à cuisses',      null, now(), now()),
  ('b1000010-0001-4000-8000-000000000010', 'a1000010-0000-4000-8000-000000000010', null, 'fr', 'Fente',                 null, now(), now()),
  ('b1000011-0001-4000-8000-000000000011', 'a1000011-0000-4000-8000-000000000011', null, 'fr', 'Développé militaire',   null, now(), now()),
  ('b1000012-0001-4000-8000-000000000012', 'a1000012-0000-4000-8000-000000000012', null, 'fr', 'Élévations latérales',  null, now(), now()),
  ('b1000013-0001-4000-8000-000000000013', 'a1000013-0000-4000-8000-000000000013', null, 'fr', 'Curl biceps',           null, now(), now()),
  ('b1000014-0001-4000-8000-000000000014', 'a1000014-0000-4000-8000-000000000014', null, 'fr', 'Extension triceps',     null, now(), now()),
  ('b1000015-0001-4000-8000-000000000015', 'a1000015-0000-4000-8000-000000000015', null, 'fr', 'Gainage',               null, now(), now()),
  ('b1000016-0001-4000-8000-000000000016', 'a1000016-0000-4000-8000-000000000016', null, 'fr', 'Crunch',                null, now(), now())
on conflict (id) do nothing;

-- -----------------------------------------------------------
-- exercise_translations EN
-- -----------------------------------------------------------
insert into public.exercise_translations (id, exercise_id, owner_id, lang, name, instructions, created_at, updated_at)
values
  ('b1000001-0002-4000-8000-000000000001', 'a1000001-0000-4000-8000-000000000001', null, 'en', 'Bench press',           null, now(), now()),
  ('b1000002-0002-4000-8000-000000000002', 'a1000002-0000-4000-8000-000000000002', null, 'en', 'Incline press',         null, now(), now()),
  ('b1000003-0002-4000-8000-000000000003', 'a1000003-0000-4000-8000-000000000003', null, 'en', 'Push-up',               null, now(), now()),
  ('b1000004-0002-4000-8000-000000000004', 'a1000004-0000-4000-8000-000000000004', null, 'en', 'Pull-up',               null, now(), now()),
  ('b1000005-0002-4000-8000-000000000005', 'a1000005-0000-4000-8000-000000000005', null, 'en', 'Barbell row',           null, now(), now()),
  ('b1000006-0002-4000-8000-000000000006', 'a1000006-0000-4000-8000-000000000006', null, 'en', 'Lat pulldown',          null, now(), now()),
  ('b1000007-0002-4000-8000-000000000007', 'a1000007-0000-4000-8000-000000000007', null, 'en', 'Squat',                 null, now(), now()),
  ('b1000008-0002-4000-8000-000000000008', 'a1000008-0000-4000-8000-000000000008', null, 'en', 'Deadlift',              null, now(), now()),
  ('b1000009-0002-4000-8000-000000000009', 'a1000009-0000-4000-8000-000000000009', null, 'en', 'Leg press',             null, now(), now()),
  ('b1000010-0002-4000-8000-000000000010', 'a1000010-0000-4000-8000-000000000010', null, 'en', 'Lunge',                 null, now(), now()),
  ('b1000011-0002-4000-8000-000000000011', 'a1000011-0000-4000-8000-000000000011', null, 'en', 'Overhead press',        null, now(), now()),
  ('b1000012-0002-4000-8000-000000000012', 'a1000012-0000-4000-8000-000000000012', null, 'en', 'Lateral raise',         null, now(), now()),
  ('b1000013-0002-4000-8000-000000000013', 'a1000013-0000-4000-8000-000000000013', null, 'en', 'Biceps curl',           null, now(), now()),
  ('b1000014-0002-4000-8000-000000000014', 'a1000014-0000-4000-8000-000000000014', null, 'en', 'Triceps extension',     null, now(), now()),
  ('b1000015-0002-4000-8000-000000000015', 'a1000015-0000-4000-8000-000000000015', null, 'en', 'Plank',                 null, now(), now()),
  ('b1000016-0002-4000-8000-000000000016', 'a1000016-0000-4000-8000-000000000016', null, 'en', 'Crunch',                null, now(), now())
on conflict (id) do nothing;
