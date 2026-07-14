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

-- ============================================================
-- US2 — Programme éditorial placeholder "Full Body Débutant"
-- Réf. : docs/specs/technical/schema-donnees-muscu.md §4.3
--
-- Contenu placeholder — industrialisé dans le back-office V0.7.
-- Inserts exécutés sous service role (bypass RLS) car owner_id is null.
--
-- UUIDs déterministes :
--   program              → c1000001-0000-4000-8000-000000000001
--   program_translations → c2000001-0001-4000-8000-000000000001 (fr)
--                          c2000001-0002-4000-8000-000000000001 (en)
--   sessions             → c3000001-0000-4000-8000-000000000001 (Séance A)
--                          c3000002-0000-4000-8000-000000000002 (Séance B)
--                          c3000003-0000-4000-8000-000000000003 (Séance C)
--   exercise_plans       → c4000001-… à c4000009-… (3 plans par séance)
-- ============================================================

-- -----------------------------------------------------------
-- programs (éditorial — owner_id null, status 'published')
-- -----------------------------------------------------------
insert into public.programs (id, owner_id, pillar, status, is_active, level, goal, duration_weeks, created_at, updated_at)
values (
  'c1000001-0000-4000-8000-000000000001',
  null,
  'strength',
  'published',
  false,
  'beginner',
  'muscle',
  8,
  now(), now()
)
on conflict (id) do nothing;

-- -----------------------------------------------------------
-- program_translations FR + EN
-- -----------------------------------------------------------
insert into public.program_translations (id, program_id, owner_id, lang, name, summary, description, created_at, updated_at)
values
  (
    'c2000001-0001-4000-8000-000000000001',
    'c1000001-0000-4000-8000-000000000001',
    null, 'fr',
    'Full Body Débutant — 3 séances/sem',
    'Programme complet pour débuter la musculation sur 8 semaines.',
    'Ce programme full body 3 fois par semaine cible tous les groupes musculaires à chaque séance. Idéal pour acquérir les bases techniques et progresser rapidement en force et en volume. Repos recommandé entre les séances : 48 h minimum.',
    now(), now()
  ),
  (
    'c2000001-0002-4000-8000-000000000001',
    'c1000001-0000-4000-8000-000000000001',
    null, 'en',
    'Full Body Beginner — 3 sessions/week',
    '8-week full body program to start strength training.',
    'This 3-day-per-week full body program targets all muscle groups every session. Perfect for building a solid technical foundation and making rapid strength and size gains. Recommended rest between sessions: at least 48 h.',
    now(), now()
  )
on conflict (id) do nothing;

-- -----------------------------------------------------------
-- sessions (3 séances : A, B, C)
-- -----------------------------------------------------------
insert into public.sessions (id, program_id, owner_id, order_index, name, created_at, updated_at)
values
  ('c3000001-0000-4000-8000-000000000001', 'c1000001-0000-4000-8000-000000000001', null, 0, 'Séance A', now(), now()),
  ('c3000002-0000-4000-8000-000000000002', 'c1000001-0000-4000-8000-000000000001', null, 1, 'Séance B', now(), now()),
  ('c3000003-0000-4000-8000-000000000003', 'c1000001-0000-4000-8000-000000000001', null, 2, 'Séance C', now(), now())
on conflict (id) do nothing;

-- -----------------------------------------------------------
-- exercise_plans
-- Séance A : Squat · Développé couché · Rowing barre
-- Séance B : Soulevé de terre · Développé incliné · Traction
-- Séance C : Fente · Développé militaire · Gainage
-- target_reps en texte pour autoriser les fourchettes (ex. "8-12")
-- -----------------------------------------------------------
insert into public.exercise_plans (id, session_id, owner_id, exercise_id, order_index, set_type, target_sets, target_reps, target_weight_kg, rest_seconds, created_at, updated_at)
values
  -- Séance A
  ('c4000001-0000-4000-8000-000000000001', 'c3000001-0000-4000-8000-000000000001', null, 'a1000007-0000-4000-8000-000000000007', 0, 'normal', 3, '8-12',  null, 120, now(), now()),
  ('c4000002-0000-4000-8000-000000000002', 'c3000001-0000-4000-8000-000000000001', null, 'a1000001-0000-4000-8000-000000000001', 1, 'normal', 3, '8-12',  null, 90,  now(), now()),
  ('c4000003-0000-4000-8000-000000000003', 'c3000001-0000-4000-8000-000000000001', null, 'a1000005-0000-4000-8000-000000000005', 2, 'normal', 3, '8-12',  null, 90,  now(), now()),
  -- Séance B
  ('c4000004-0000-4000-8000-000000000004', 'c3000002-0000-4000-8000-000000000002', null, 'a1000008-0000-4000-8000-000000000008', 0, 'normal', 3, '5-8',   null, 120, now(), now()),
  ('c4000005-0000-4000-8000-000000000005', 'c3000002-0000-4000-8000-000000000002', null, 'a1000002-0000-4000-8000-000000000002', 1, 'normal', 3, '8-12',  null, 90,  now(), now()),
  ('c4000006-0000-4000-8000-000000000006', 'c3000002-0000-4000-8000-000000000002', null, 'a1000004-0000-4000-8000-000000000004', 2, 'normal', 3, '6-10',  null, 90,  now(), now()),
  -- Séance C
  ('c4000007-0000-4000-8000-000000000007', 'c3000003-0000-4000-8000-000000000003', null, 'a1000010-0000-4000-8000-000000000010', 0, 'normal',   3, '10-12', null, 90,  now(), now()),
  ('c4000008-0000-4000-8000-000000000008', 'c3000003-0000-4000-8000-000000000003', null, 'a1000011-0000-4000-8000-000000000011', 1, 'normal',   3, '8-12',  null, 90,  now(), now()),
  ('c4000009-0000-4000-8000-000000000009', 'c3000003-0000-4000-8000-000000000003', null, 'a1000015-0000-4000-8000-000000000015', 2, 'duration', 3, null,    null, 60,  now(), now())
on conflict (id) do nothing;

-- ============================================================
-- Bibliothèque d'aliments (bilingue FR/EN) — données CIQUAL 2025 (ANSES / Licence Etalab)
-- Déplacée dans une MIGRATION versionnée (donnée de référence poussée au cloud via db:push) :
--   supabase/migrations/20260714120000_seed_library_foods_ciqual.sql
-- Générée par supabase/scripts/enrich-ciqual/ — ne pas éditer à la main (régénérer).
-- ============================================================
