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
-- V0.4 — 50 aliments de bibliothèque (bilingues FR + EN)
-- Sous-ensemble curé (base fournie 4.8) ; industrialisé en back-office V0.7.
-- Réf. : docs/specs/functional/alimentation.md §3
-- ============================================================

insert into public.foods (id, owner_id, source, category, barcode, kcal_per_100g, protein_per_100g, carbs_per_100g, sugars_per_100g, fat_per_100g, saturated_fat_per_100g, fiber_per_100g, portions, created_at, updated_at)
values
  ('d1000001-0000-4000-8000-000000000000', null, 'library', 'meat', null, 165, 31, 0, 0, 3.6, 1, 0, '[]', now(), now()),
  ('d1000002-0000-4000-8000-000000000000', null, 'library', 'meat', null, 137, 20, 0, 0, 5, 2.3, 0, '[]', now(), now()),
  ('d1000003-0000-4000-8000-000000000000', null, 'library', 'meat', null, 107, 18, 1, 1, 3, 1, 0, '[{"labelFr":"1 tranche","labelEn":"1 slice","grams":40}]', now(), now()),
  ('d1000004-0000-4000-8000-000000000000', null, 'library', 'meat', null, 217, 26, 0, 0, 12, 5, 0, '[{"labelFr":"1 steak","labelEn":"1 steak","grams":150}]', now(), now()),
  ('d1000005-0000-4000-8000-000000000000', null, 'library', 'meat', null, 111, 24, 0, 0, 1, 0.3, 0, '[]', now(), now()),
  ('d1000006-0000-4000-8000-000000000000', null, 'library', 'fish', null, 208, 20, 0, 0, 13, 3, 0, '[{"labelFr":"1 pavé","labelEn":"1 fillet","grams":130}]', now(), now()),
  ('d1000007-0000-4000-8000-000000000000', null, 'library', 'fish', null, 116, 26, 0, 0, 1, 0.3, 0, '[{"labelFr":"1 boîte","labelEn":"1 can","grams":112}]', now(), now()),
  ('d1000008-0000-4000-8000-000000000000', null, 'library', 'fish', null, 82, 18, 0, 0, 0.7, 0.1, 0, '[]', now(), now()),
  ('d1000009-0000-4000-8000-000000000000', null, 'library', 'fish', null, 99, 24, 0.2, 0, 0.3, 0.1, 0, '[]', now(), now()),
  ('d1000010-0000-4000-8000-000000000000', null, 'library', 'starchy', null, 130, 2.7, 28, 0.1, 0.3, 0.1, 0.4, '[{"labelFr":"1 bol","labelEn":"1 bowl","grams":150}]', now(), now()),
  ('d1000011-0000-4000-8000-000000000000', null, 'library', 'starchy', null, 158, 6, 31, 0.6, 0.9, 0.2, 1.8, '[{"labelFr":"1 assiette","labelEn":"1 plate","grams":200}]', now(), now()),
  ('d1000012-0000-4000-8000-000000000000', null, 'library', 'starchy', null, 247, 13, 41, 6, 3.4, 0.7, 7, '[{"labelFr":"1 tranche","labelEn":"1 slice","grams":30}]', now(), now()),
  ('d1000013-0000-4000-8000-000000000000', null, 'library', 'starchy', null, 265, 9, 49, 5, 3.3, 0.7, 2.7, '[{"labelFr":"1 tranche","labelEn":"1 slice","grams":25}]', now(), now()),
  ('d1000014-0000-4000-8000-000000000000', null, 'library', 'starchy', null, 274, 9, 55, 2, 1.3, 0.3, 3, '[{"labelFr":"1 baguette","labelEn":"1 baguette","grams":250}]', now(), now()),
  ('d1000015-0000-4000-8000-000000000000', null, 'library', 'starchy', null, 87, 1.9, 20, 0.9, 0.1, 0, 1.8, '[]', now(), now()),
  ('d1000016-0000-4000-8000-000000000000', null, 'library', 'starchy', null, 389, 17, 66, 1, 7, 1.2, 10, '[{"labelFr":"1 bol","labelEn":"1 bowl","grams":40}]', now(), now()),
  ('d1000017-0000-4000-8000-000000000000', null, 'library', 'starchy', null, 120, 4.4, 21, 0.9, 1.9, 0.2, 2.8, '[]', now(), now()),
  ('d1000018-0000-4000-8000-000000000000', null, 'library', 'starchy', null, 112, 3.8, 23, 0, 0.2, 0, 1.4, '[]', now(), now()),
  ('d1000019-0000-4000-8000-000000000000', null, 'library', 'starchy', null, 116, 9, 20, 1.8, 0.4, 0.1, 8, '[]', now(), now()),
  ('d1000020-0000-4000-8000-000000000000', null, 'library', 'vegetables', null, 34, 2.8, 7, 1.7, 0.4, 0, 2.6, '[]', now(), now()),
  ('d1000021-0000-4000-8000-000000000000', null, 'library', 'vegetables', null, 41, 0.9, 10, 4.7, 0.2, 0, 2.8, '[{"labelFr":"1 carotte","labelEn":"1 carrot","grams":80}]', now(), now()),
  ('d1000022-0000-4000-8000-000000000000', null, 'library', 'vegetables', null, 18, 0.9, 3.9, 2.6, 0.2, 0, 1.2, '[{"labelFr":"1 tomate","labelEn":"1 tomato","grams":120}]', now(), now()),
  ('d1000023-0000-4000-8000-000000000000', null, 'library', 'vegetables', null, 17, 1.2, 3.1, 2.5, 0.3, 0.1, 1, '[]', now(), now()),
  ('d1000024-0000-4000-8000-000000000000', null, 'library', 'vegetables', null, 23, 2.9, 3.6, 0.4, 0.4, 0.1, 2.2, '[]', now(), now()),
  ('d1000025-0000-4000-8000-000000000000', null, 'library', 'vegetables', null, 31, 1.8, 7, 3.3, 0.1, 0, 2.7, '[]', now(), now()),
  ('d1000026-0000-4000-8000-000000000000', null, 'library', 'vegetables', null, 31, 1, 6, 4.2, 0.3, 0, 2.1, '[{"labelFr":"1 poivron","labelEn":"1 pepper","grams":150}]', now(), now()),
  ('d1000027-0000-4000-8000-000000000000', null, 'library', 'vegetables', null, 15, 1.4, 2.9, 0.8, 0.2, 0, 1.3, '[]', now(), now()),
  ('d1000028-0000-4000-8000-000000000000', null, 'library', 'fruits', null, 89, 1.1, 23, 12, 0.3, 0.1, 2.6, '[{"labelFr":"1 banane","labelEn":"1 banana","grams":120}]', now(), now()),
  ('d1000029-0000-4000-8000-000000000000', null, 'library', 'fruits', null, 52, 0.3, 14, 10, 0.2, 0, 2.4, '[{"labelFr":"1 pomme","labelEn":"1 apple","grams":150}]', now(), now()),
  ('d1000030-0000-4000-8000-000000000000', null, 'library', 'fruits', null, 47, 0.9, 12, 9, 0.1, 0, 2.4, '[{"labelFr":"1 orange","labelEn":"1 orange","grams":130}]', now(), now()),
  ('d1000031-0000-4000-8000-000000000000', null, 'library', 'fruits', null, 32, 0.7, 7.7, 4.9, 0.3, 0, 2, '[]', now(), now()),
  ('d1000032-0000-4000-8000-000000000000', null, 'library', 'fruits', null, 57, 0.7, 14, 10, 0.3, 0, 2.4, '[]', now(), now()),
  ('d1000033-0000-4000-8000-000000000000', null, 'library', 'fruits', null, 61, 1.1, 15, 9, 0.5, 0, 3, '[{"labelFr":"1 kiwi","labelEn":"1 kiwi","grams":75}]', now(), now()),
  ('d1000034-0000-4000-8000-000000000000', null, 'library', 'fruits', null, 69, 0.7, 18, 15, 0.2, 0, 0.9, '[]', now(), now()),
  ('d1000035-0000-4000-8000-000000000000', null, 'library', 'fruits', null, 50, 0.5, 13, 10, 0.1, 0, 1.4, '[]', now(), now()),
  ('d1000036-0000-4000-8000-000000000000', null, 'library', 'dairy', null, 143, 13, 1.1, 0.4, 10, 3.1, 0, '[{"labelFr":"1 œuf","labelEn":"1 egg","grams":60}]', now(), now()),
  ('d1000037-0000-4000-8000-000000000000', null, 'library', 'dairy', null, 47, 3.3, 4.8, 4.8, 1.6, 1, 0, '[{"labelFr":"1 verre","labelEn":"1 glass","grams":200}]', now(), now()),
  ('d1000038-0000-4000-8000-000000000000', null, 'library', 'dairy', null, 61, 3.5, 4.7, 4.7, 3.3, 2, 0, '[{"labelFr":"1 pot","labelEn":"1 pot","grams":125}]', now(), now()),
  ('d1000039-0000-4000-8000-000000000000', null, 'library', 'dairy', null, 47, 8, 4, 4, 0.2, 0.1, 0, '[{"labelFr":"1 pot","labelEn":"1 pot","grams":100}]', now(), now()),
  ('d1000040-0000-4000-8000-000000000000', null, 'library', 'dairy', null, 380, 27, 0, 0, 30, 19, 0, '[{"labelFr":"1 portion","labelEn":"1 portion","grams":30}]', now(), now()),
  ('d1000041-0000-4000-8000-000000000000', null, 'library', 'dairy', null, 280, 22, 2, 1, 21, 13, 0, '[]', now(), now()),
  ('d1000042-0000-4000-8000-000000000000', null, 'library', 'nuts', null, 579, 21, 22, 4, 50, 3.8, 12, '[{"labelFr":"1 poignée","labelEn":"1 handful","grams":30}]', now(), now()),
  ('d1000043-0000-4000-8000-000000000000', null, 'library', 'nuts', null, 588, 25, 20, 9, 50, 10, 6, '[{"labelFr":"1 c. à soupe","labelEn":"1 tbsp","grams":15}]', now(), now()),
  ('d1000044-0000-4000-8000-000000000000', null, 'library', 'nuts', null, 654, 15, 14, 2.6, 65, 6, 6.7, '[]', now(), now()),
  ('d1000045-0000-4000-8000-000000000000', null, 'library', 'drinks', null, 45, 0.7, 10, 8, 0.2, 0, 0.2, '[{"labelFr":"1 verre","labelEn":"1 glass","grams":200}]', now(), now()),
  ('d1000046-0000-4000-8000-000000000000', null, 'library', 'drinks', null, 2, 0.1, 0, 0, 0, 0, 0, '[{"labelFr":"1 tasse","labelEn":"1 cup","grams":100}]', now(), now()),
  ('d1000047-0000-4000-8000-000000000000', null, 'library', 'drinks', null, 42, 0, 10.6, 10.6, 0, 0, 0, '[{"labelFr":"1 canette","labelEn":"1 can","grams":330}]', now(), now()),
  ('d1000048-0000-4000-8000-000000000000', null, 'library', 'other', null, 884, 0, 0, 0, 100, 14, 0, '[{"labelFr":"1 c. à soupe","labelEn":"1 tbsp","grams":10}]', now(), now()),
  ('d1000049-0000-4000-8000-000000000000', null, 'library', 'other', null, 546, 5, 61, 48, 31, 19, 7, '[{"labelFr":"1 carré","labelEn":"1 square","grams":10}]', now(), now()),
  ('d1000050-0000-4000-8000-000000000000', null, 'library', 'other', null, 400, 0, 100, 100, 0, 0, 0, '[{"labelFr":"1 c. à café","labelEn":"1 tsp","grams":5}]', now(), now())
on conflict (id) do nothing;

insert into public.food_translations (id, food_id, owner_id, lang, name, created_at, updated_at)
values
  ('d2000001-0001-4000-8000-000000000000', 'd1000001-0000-4000-8000-000000000000', null, 'fr', 'Poulet (blanc, cuit)', now(), now()),
  ('d3000001-0002-4000-8000-000000000000', 'd1000001-0000-4000-8000-000000000000', null, 'en', 'Chicken breast (cooked)', now(), now()),
  ('d2000002-0001-4000-8000-000000000000', 'd1000002-0000-4000-8000-000000000000', null, 'fr', 'Bœuf haché 5%', now(), now()),
  ('d3000002-0002-4000-8000-000000000000', 'd1000002-0000-4000-8000-000000000000', null, 'en', 'Lean ground beef 5%', now(), now()),
  ('d2000003-0001-4000-8000-000000000000', 'd1000003-0000-4000-8000-000000000000', null, 'fr', 'Jambon blanc', now(), now()),
  ('d3000003-0002-4000-8000-000000000000', 'd1000003-0000-4000-8000-000000000000', null, 'en', 'Cooked ham', now(), now()),
  ('d2000004-0001-4000-8000-000000000000', 'd1000004-0000-4000-8000-000000000000', null, 'fr', 'Steak de bœuf', now(), now()),
  ('d3000004-0002-4000-8000-000000000000', 'd1000004-0000-4000-8000-000000000000', null, 'en', 'Beef steak', now(), now()),
  ('d2000005-0001-4000-8000-000000000000', 'd1000005-0000-4000-8000-000000000000', null, 'fr', 'Escalope de dinde', now(), now()),
  ('d3000005-0002-4000-8000-000000000000', 'd1000005-0000-4000-8000-000000000000', null, 'en', 'Turkey breast', now(), now()),
  ('d2000006-0001-4000-8000-000000000000', 'd1000006-0000-4000-8000-000000000000', null, 'fr', 'Saumon', now(), now()),
  ('d3000006-0002-4000-8000-000000000000', 'd1000006-0000-4000-8000-000000000000', null, 'en', 'Salmon', now(), now()),
  ('d2000007-0001-4000-8000-000000000000', 'd1000007-0000-4000-8000-000000000000', null, 'fr', 'Thon au naturel', now(), now()),
  ('d3000007-0002-4000-8000-000000000000', 'd1000007-0000-4000-8000-000000000000', null, 'en', 'Canned tuna', now(), now()),
  ('d2000008-0001-4000-8000-000000000000', 'd1000008-0000-4000-8000-000000000000', null, 'fr', 'Cabillaud', now(), now()),
  ('d3000008-0002-4000-8000-000000000000', 'd1000008-0000-4000-8000-000000000000', null, 'en', 'Cod', now(), now()),
  ('d2000009-0001-4000-8000-000000000000', 'd1000009-0000-4000-8000-000000000000', null, 'fr', 'Crevettes', now(), now()),
  ('d3000009-0002-4000-8000-000000000000', 'd1000009-0000-4000-8000-000000000000', null, 'en', 'Shrimp', now(), now()),
  ('d2000010-0001-4000-8000-000000000000', 'd1000010-0000-4000-8000-000000000000', null, 'fr', 'Riz blanc cuit', now(), now()),
  ('d3000010-0002-4000-8000-000000000000', 'd1000010-0000-4000-8000-000000000000', null, 'en', 'White rice (cooked)', now(), now()),
  ('d2000011-0001-4000-8000-000000000000', 'd1000011-0000-4000-8000-000000000000', null, 'fr', 'Pâtes cuites', now(), now()),
  ('d3000011-0002-4000-8000-000000000000', 'd1000011-0000-4000-8000-000000000000', null, 'en', 'Pasta (cooked)', now(), now()),
  ('d2000012-0001-4000-8000-000000000000', 'd1000012-0000-4000-8000-000000000000', null, 'fr', 'Pain complet', now(), now()),
  ('d3000012-0002-4000-8000-000000000000', 'd1000012-0000-4000-8000-000000000000', null, 'en', 'Whole wheat bread', now(), now()),
  ('d2000013-0001-4000-8000-000000000000', 'd1000013-0000-4000-8000-000000000000', null, 'fr', 'Pain de mie', now(), now()),
  ('d3000013-0002-4000-8000-000000000000', 'd1000013-0000-4000-8000-000000000000', null, 'en', 'Sandwich bread', now(), now()),
  ('d2000014-0001-4000-8000-000000000000', 'd1000014-0000-4000-8000-000000000000', null, 'fr', 'Baguette', now(), now()),
  ('d3000014-0002-4000-8000-000000000000', 'd1000014-0000-4000-8000-000000000000', null, 'en', 'Baguette', now(), now()),
  ('d2000015-0001-4000-8000-000000000000', 'd1000015-0000-4000-8000-000000000000', null, 'fr', 'Pomme de terre cuite', now(), now()),
  ('d3000015-0002-4000-8000-000000000000', 'd1000015-0000-4000-8000-000000000000', null, 'en', 'Boiled potato', now(), now()),
  ('d2000016-0001-4000-8000-000000000000', 'd1000016-0000-4000-8000-000000000000', null, 'fr', 'Flocons d''avoine', now(), now()),
  ('d3000016-0002-4000-8000-000000000000', 'd1000016-0000-4000-8000-000000000000', null, 'en', 'Oats', now(), now()),
  ('d2000017-0001-4000-8000-000000000000', 'd1000017-0000-4000-8000-000000000000', null, 'fr', 'Quinoa cuit', now(), now()),
  ('d3000017-0002-4000-8000-000000000000', 'd1000017-0000-4000-8000-000000000000', null, 'en', 'Cooked quinoa', now(), now()),
  ('d2000018-0001-4000-8000-000000000000', 'd1000018-0000-4000-8000-000000000000', null, 'fr', 'Semoule cuite', now(), now()),
  ('d3000018-0002-4000-8000-000000000000', 'd1000018-0000-4000-8000-000000000000', null, 'en', 'Cooked couscous', now(), now()),
  ('d2000019-0001-4000-8000-000000000000', 'd1000019-0000-4000-8000-000000000000', null, 'fr', 'Lentilles cuites', now(), now()),
  ('d3000019-0002-4000-8000-000000000000', 'd1000019-0000-4000-8000-000000000000', null, 'en', 'Cooked lentils', now(), now()),
  ('d2000020-0001-4000-8000-000000000000', 'd1000020-0000-4000-8000-000000000000', null, 'fr', 'Brocoli', now(), now()),
  ('d3000020-0002-4000-8000-000000000000', 'd1000020-0000-4000-8000-000000000000', null, 'en', 'Broccoli', now(), now()),
  ('d2000021-0001-4000-8000-000000000000', 'd1000021-0000-4000-8000-000000000000', null, 'fr', 'Carotte', now(), now()),
  ('d3000021-0002-4000-8000-000000000000', 'd1000021-0000-4000-8000-000000000000', null, 'en', 'Carrot', now(), now()),
  ('d2000022-0001-4000-8000-000000000000', 'd1000022-0000-4000-8000-000000000000', null, 'fr', 'Tomate', now(), now()),
  ('d3000022-0002-4000-8000-000000000000', 'd1000022-0000-4000-8000-000000000000', null, 'en', 'Tomato', now(), now()),
  ('d2000023-0001-4000-8000-000000000000', 'd1000023-0000-4000-8000-000000000000', null, 'fr', 'Courgette', now(), now()),
  ('d3000023-0002-4000-8000-000000000000', 'd1000023-0000-4000-8000-000000000000', null, 'en', 'Zucchini', now(), now()),
  ('d2000024-0001-4000-8000-000000000000', 'd1000024-0000-4000-8000-000000000000', null, 'fr', 'Épinards', now(), now()),
  ('d3000024-0002-4000-8000-000000000000', 'd1000024-0000-4000-8000-000000000000', null, 'en', 'Spinach', now(), now()),
  ('d2000025-0001-4000-8000-000000000000', 'd1000025-0000-4000-8000-000000000000', null, 'fr', 'Haricots verts', now(), now()),
  ('d3000025-0002-4000-8000-000000000000', 'd1000025-0000-4000-8000-000000000000', null, 'en', 'Green beans', now(), now()),
  ('d2000026-0001-4000-8000-000000000000', 'd1000026-0000-4000-8000-000000000000', null, 'fr', 'Poivron', now(), now()),
  ('d3000026-0002-4000-8000-000000000000', 'd1000026-0000-4000-8000-000000000000', null, 'en', 'Bell pepper', now(), now()),
  ('d2000027-0001-4000-8000-000000000000', 'd1000027-0000-4000-8000-000000000000', null, 'fr', 'Salade verte', now(), now()),
  ('d3000027-0002-4000-8000-000000000000', 'd1000027-0000-4000-8000-000000000000', null, 'en', 'Lettuce', now(), now()),
  ('d2000028-0001-4000-8000-000000000000', 'd1000028-0000-4000-8000-000000000000', null, 'fr', 'Banane', now(), now()),
  ('d3000028-0002-4000-8000-000000000000', 'd1000028-0000-4000-8000-000000000000', null, 'en', 'Banana', now(), now()),
  ('d2000029-0001-4000-8000-000000000000', 'd1000029-0000-4000-8000-000000000000', null, 'fr', 'Pomme', now(), now()),
  ('d3000029-0002-4000-8000-000000000000', 'd1000029-0000-4000-8000-000000000000', null, 'en', 'Apple', now(), now()),
  ('d2000030-0001-4000-8000-000000000000', 'd1000030-0000-4000-8000-000000000000', null, 'fr', 'Orange', now(), now()),
  ('d3000030-0002-4000-8000-000000000000', 'd1000030-0000-4000-8000-000000000000', null, 'en', 'Orange', now(), now()),
  ('d2000031-0001-4000-8000-000000000000', 'd1000031-0000-4000-8000-000000000000', null, 'fr', 'Fraises', now(), now()),
  ('d3000031-0002-4000-8000-000000000000', 'd1000031-0000-4000-8000-000000000000', null, 'en', 'Strawberries', now(), now()),
  ('d2000032-0001-4000-8000-000000000000', 'd1000032-0000-4000-8000-000000000000', null, 'fr', 'Myrtilles', now(), now()),
  ('d3000032-0002-4000-8000-000000000000', 'd1000032-0000-4000-8000-000000000000', null, 'en', 'Blueberries', now(), now()),
  ('d2000033-0001-4000-8000-000000000000', 'd1000033-0000-4000-8000-000000000000', null, 'fr', 'Kiwi', now(), now()),
  ('d3000033-0002-4000-8000-000000000000', 'd1000033-0000-4000-8000-000000000000', null, 'en', 'Kiwi', now(), now()),
  ('d2000034-0001-4000-8000-000000000000', 'd1000034-0000-4000-8000-000000000000', null, 'fr', 'Raisin', now(), now()),
  ('d3000034-0002-4000-8000-000000000000', 'd1000034-0000-4000-8000-000000000000', null, 'en', 'Grapes', now(), now()),
  ('d2000035-0001-4000-8000-000000000000', 'd1000035-0000-4000-8000-000000000000', null, 'fr', 'Ananas', now(), now()),
  ('d3000035-0002-4000-8000-000000000000', 'd1000035-0000-4000-8000-000000000000', null, 'en', 'Pineapple', now(), now()),
  ('d2000036-0001-4000-8000-000000000000', 'd1000036-0000-4000-8000-000000000000', null, 'fr', 'Œuf', now(), now()),
  ('d3000036-0002-4000-8000-000000000000', 'd1000036-0000-4000-8000-000000000000', null, 'en', 'Egg', now(), now()),
  ('d2000037-0001-4000-8000-000000000000', 'd1000037-0000-4000-8000-000000000000', null, 'fr', 'Lait demi-écrémé', now(), now()),
  ('d3000037-0002-4000-8000-000000000000', 'd1000037-0000-4000-8000-000000000000', null, 'en', 'Semi-skimmed milk', now(), now()),
  ('d2000038-0001-4000-8000-000000000000', 'd1000038-0000-4000-8000-000000000000', null, 'fr', 'Yaourt nature', now(), now()),
  ('d3000038-0002-4000-8000-000000000000', 'd1000038-0000-4000-8000-000000000000', null, 'en', 'Plain yogurt', now(), now()),
  ('d2000039-0001-4000-8000-000000000000', 'd1000039-0000-4000-8000-000000000000', null, 'fr', 'Fromage blanc 0%', now(), now()),
  ('d3000039-0002-4000-8000-000000000000', 'd1000039-0000-4000-8000-000000000000', null, 'en', 'Fat-free fromage blanc', now(), now()),
  ('d2000040-0001-4000-8000-000000000000', 'd1000040-0000-4000-8000-000000000000', null, 'fr', 'Emmental', now(), now()),
  ('d3000040-0002-4000-8000-000000000000', 'd1000040-0000-4000-8000-000000000000', null, 'en', 'Emmental', now(), now()),
  ('d2000041-0001-4000-8000-000000000000', 'd1000041-0000-4000-8000-000000000000', null, 'fr', 'Mozzarella', now(), now()),
  ('d3000041-0002-4000-8000-000000000000', 'd1000041-0000-4000-8000-000000000000', null, 'en', 'Mozzarella', now(), now()),
  ('d2000042-0001-4000-8000-000000000000', 'd1000042-0000-4000-8000-000000000000', null, 'fr', 'Amandes', now(), now()),
  ('d3000042-0002-4000-8000-000000000000', 'd1000042-0000-4000-8000-000000000000', null, 'en', 'Almonds', now(), now()),
  ('d2000043-0001-4000-8000-000000000000', 'd1000043-0000-4000-8000-000000000000', null, 'fr', 'Beurre de cacahuète', now(), now()),
  ('d3000043-0002-4000-8000-000000000000', 'd1000043-0000-4000-8000-000000000000', null, 'en', 'Peanut butter', now(), now()),
  ('d2000044-0001-4000-8000-000000000000', 'd1000044-0000-4000-8000-000000000000', null, 'fr', 'Noix', now(), now()),
  ('d3000044-0002-4000-8000-000000000000', 'd1000044-0000-4000-8000-000000000000', null, 'en', 'Walnuts', now(), now()),
  ('d2000045-0001-4000-8000-000000000000', 'd1000045-0000-4000-8000-000000000000', null, 'fr', 'Jus d''orange', now(), now()),
  ('d3000045-0002-4000-8000-000000000000', 'd1000045-0000-4000-8000-000000000000', null, 'en', 'Orange juice', now(), now()),
  ('d2000046-0001-4000-8000-000000000000', 'd1000046-0000-4000-8000-000000000000', null, 'fr', 'Café noir', now(), now()),
  ('d3000046-0002-4000-8000-000000000000', 'd1000046-0000-4000-8000-000000000000', null, 'en', 'Black coffee', now(), now()),
  ('d2000047-0001-4000-8000-000000000000', 'd1000047-0000-4000-8000-000000000000', null, 'fr', 'Coca-Cola', now(), now()),
  ('d3000047-0002-4000-8000-000000000000', 'd1000047-0000-4000-8000-000000000000', null, 'en', 'Coca-Cola', now(), now()),
  ('d2000048-0001-4000-8000-000000000000', 'd1000048-0000-4000-8000-000000000000', null, 'fr', 'Huile d''olive', now(), now()),
  ('d3000048-0002-4000-8000-000000000000', 'd1000048-0000-4000-8000-000000000000', null, 'en', 'Olive oil', now(), now()),
  ('d2000049-0001-4000-8000-000000000000', 'd1000049-0000-4000-8000-000000000000', null, 'fr', 'Chocolat noir', now(), now()),
  ('d3000049-0002-4000-8000-000000000000', 'd1000049-0000-4000-8000-000000000000', null, 'en', 'Dark chocolate', now(), now()),
  ('d2000050-0001-4000-8000-000000000000', 'd1000050-0000-4000-8000-000000000000', null, 'fr', 'Sucre', now(), now()),
  ('d3000050-0002-4000-8000-000000000000', 'd1000050-0000-4000-8000-000000000000', null, 'en', 'Sugar', now(), now())
on conflict (id) do nothing;

-- ============================================================
-- R3b-ii — Programmes de course (bibliothèque) — contenu STARTER à curer/enrichir en back-office V0.7.
-- Réf. : docs/specs/functional/running.md, schema sessions R3b-i (session_type + cibles).
--
-- UUIDs déterministes (préfixe e — distinct de muscu c1…/c2…/c3… et aliments d1…/d2…/d3…) :
--   programs             → e1000001-… / e1000002-… / e1000003-…
--   program_translations → e2000001-0001-… (fr) / e2000001-0002-… (en) …idem 0002, 0003
--   sessions             → e3000001-… à e3000010-…
--
-- Toutes les séances running ont session_type + target_distance_m (contrainte sessions_running_target_chk).
-- ============================================================

-- -----------------------------------------------------------
-- programs running (éditorial — owner_id null, status 'published')
-- -----------------------------------------------------------
insert into public.programs (id, owner_id, pillar, status, is_active, level, goal, duration_weeks, created_at, updated_at)
values
  (
    'e1000001-0000-4000-8000-000000000001',
    null,
    'running',
    'published',
    false,
    'beginner',
    '10k',
    8,
    now(), now()
  ),
  (
    'e1000002-0000-4000-8000-000000000002',
    null,
    'running',
    'published',
    false,
    'intermediate',
    'semi',
    10,
    now(), now()
  ),
  (
    'e1000003-0000-4000-8000-000000000003',
    null,
    'running',
    'published',
    false,
    'beginner',
    'endurance',
    6,
    now(), now()
  )
on conflict (id) do nothing;

-- -----------------------------------------------------------
-- program_translations running FR + EN
-- -----------------------------------------------------------
insert into public.program_translations (id, program_id, owner_id, lang, name, summary, description, created_at, updated_at)
values
  -- Programme 1 — 10k / débutant / 8 semaines
  (
    'e2000001-0001-4000-8000-000000000001',
    'e1000001-0000-4000-8000-000000000001',
    null, 'fr',
    '10 km en 8 semaines',
    'Prépare un premier 10 km avec 3 séances par semaine.',
    'Prépare un premier 10 km avec 3 séances par semaine.',
    now(), now()
  ),
  (
    'e2000001-0002-4000-8000-000000000001',
    'e1000001-0000-4000-8000-000000000001',
    null, 'en',
    '10K in 8 weeks',
    'Prepare for your first 10K with 3 sessions per week.',
    'Prepare for your first 10K with 3 sessions per week.',
    now(), now()
  ),
  -- Programme 2 — semi / intermédiaire / 10 semaines
  (
    'e2000002-0001-4000-8000-000000000002',
    'e1000002-0000-4000-8000-000000000002',
    null, 'fr',
    'Prépa semi-marathon',
    'Monte en volume vers le semi avec 4 séances par semaine.',
    'Monte en volume vers le semi avec 4 séances par semaine.',
    now(), now()
  ),
  (
    'e2000002-0002-4000-8000-000000000002',
    'e1000002-0000-4000-8000-000000000002',
    null, 'en',
    'Half-marathon prep',
    'Build up to the half with 4 sessions per week.',
    'Build up to the half with 4 sessions per week.',
    now(), now()
  ),
  -- Programme 3 — endurance / débutant / 6 semaines
  (
    'e2000003-0001-4000-8000-000000000003',
    'e1000003-0000-4000-8000-000000000003',
    null, 'fr',
    'Reprise en douceur',
    'Reviens à la course progressivement, sans pression.',
    'Reviens à la course progressivement, sans pression.',
    now(), now()
  ),
  (
    'e2000003-0002-4000-8000-000000000003',
    'e1000003-0000-4000-8000-000000000003',
    null, 'en',
    'Easy return to running',
    'Ease back into running, no pressure.',
    'Ease back into running, no pressure.',
    now(), now()
  )
on conflict (id) do nothing;

-- -----------------------------------------------------------
-- sessions running (owner_id null, session_type + target_distance_m obligatoires)
-- Programme 1 — 10k/débutant : endurance 5k · fractionne 5k · sortie_longue 8k
-- Programme 2 — semi/intermédiaire : endurance 8k · fractionne 6k · sortie_longue 16k · recuperation 5k
-- Programme 3 — endurance/débutant : endurance 4k · recuperation 3k · sortie_longue 6k
-- -----------------------------------------------------------
insert into public.sessions (id, program_id, owner_id, order_index, name, session_type, target_distance_m, target_duration_seconds, created_at, updated_at)
values
  -- Programme 1 (e1000001)
  ('e3000001-0000-4000-8000-000000000001', 'e1000001-0000-4000-8000-000000000001', null, 0, null, 'endurance',     5000, null, now(), now()),
  ('e3000002-0000-4000-8000-000000000002', 'e1000001-0000-4000-8000-000000000001', null, 1, null, 'fractionne',    5000, null, now(), now()),
  ('e3000003-0000-4000-8000-000000000003', 'e1000001-0000-4000-8000-000000000001', null, 2, null, 'sortie_longue', 8000, null, now(), now()),
  -- Programme 2 (e1000002)
  ('e3000004-0000-4000-8000-000000000004', 'e1000002-0000-4000-8000-000000000002', null, 0, null, 'endurance',     8000,  null, now(), now()),
  ('e3000005-0000-4000-8000-000000000005', 'e1000002-0000-4000-8000-000000000002', null, 1, null, 'fractionne',    6000,  null, now(), now()),
  ('e3000006-0000-4000-8000-000000000006', 'e1000002-0000-4000-8000-000000000002', null, 2, null, 'sortie_longue', 16000, null, now(), now()),
  ('e3000007-0000-4000-8000-000000000007', 'e1000002-0000-4000-8000-000000000002', null, 3, null, 'recuperation',  5000,  null, now(), now()),
  -- Programme 3 (e1000003)
  ('e3000008-0000-4000-8000-000000000008', 'e1000003-0000-4000-8000-000000000003', null, 0, null, 'endurance',     4000, null, now(), now()),
  ('e3000009-0000-4000-8000-000000000009', 'e1000003-0000-4000-8000-000000000003', null, 1, null, 'recuperation',  3000, null, now(), now()),
  ('e3000010-0000-4000-8000-000000000010', 'e1000003-0000-4000-8000-000000000003', null, 2, null, 'sortie_longue', 6000, null, now(), now())
on conflict (id) do nothing;

-- ─── US 4.33 : micronutriments (socle), valeurs pour 100 g d'après CIQUAL (ANSES) ───────────
-- Enrichissement d'un sous-ensemble d'aliments bruts bien caractérisés. Les autres aliments
-- conservent le défaut '{}' (donnée non renseignée — jamais de valeur inventée, cf. spec 4.33).
-- Clés : cholesterol_mg, sodium_mg, magnesium_mg, potassium_mg, calcium_mg, iron_mg,
--        vitamin_c_mg, vitamin_d_ug, vitamin_b9_ug, vitamin_b12_ug. À relire/compléter (checkpoint 🔴).
update public.foods set micronutrients = '{"cholesterol_mg":55,"sodium_mg":59,"magnesium_mg":29,"potassium_mg":363,"calcium_mg":12,"iron_mg":0.5,"vitamin_d_ug":10,"vitamin_b9_ug":26,"vitamin_b12_ug":3}'
  where id = 'd1000006-0000-4000-8000-000000000000'; -- Saumon
update public.foods set micronutrients = '{"cholesterol_mg":0,"sodium_mg":2,"magnesium_mg":36,"potassium_mg":370,"calcium_mg":19,"iron_mg":3.3,"vitamin_c_mg":1.5,"vitamin_b9_ug":181}'
  where id = 'd1000019-0000-4000-8000-000000000000'; -- Lentilles cuites
update public.foods set micronutrients = '{"cholesterol_mg":0,"sodium_mg":33,"magnesium_mg":21,"potassium_mg":316,"calcium_mg":47,"iron_mg":0.73,"vitamin_c_mg":89,"vitamin_b9_ug":63}'
  where id = 'd1000020-0000-4000-8000-000000000000'; -- Brocoli
update public.foods set micronutrients = '{"cholesterol_mg":0,"sodium_mg":79,"magnesium_mg":79,"potassium_mg":558,"calcium_mg":99,"iron_mg":2.7,"vitamin_c_mg":28,"vitamin_d_ug":0,"vitamin_b9_ug":194,"vitamin_b12_ug":0}'
  where id = 'd1000024-0000-4000-8000-000000000000'; -- Épinards
update public.foods set micronutrients = '{"cholesterol_mg":0,"sodium_mg":1,"magnesium_mg":27,"potassium_mg":358,"calcium_mg":5,"iron_mg":0.26,"vitamin_c_mg":8.7,"vitamin_b9_ug":20}'
  where id = 'd1000028-0000-4000-8000-000000000000'; -- Banane
update public.foods set micronutrients = '{"cholesterol_mg":0,"sodium_mg":0,"magnesium_mg":10,"potassium_mg":181,"calcium_mg":40,"iron_mg":0.1,"vitamin_c_mg":53,"vitamin_b9_ug":30}'
  where id = 'd1000030-0000-4000-8000-000000000000'; -- Orange
update public.foods set micronutrients = '{"cholesterol_mg":0,"sodium_mg":1,"magnesium_mg":270,"potassium_mg":733,"calcium_mg":269,"iron_mg":3.7,"vitamin_b9_ug":44}'
  where id = 'd1000042-0000-4000-8000-000000000000'; -- Amandes
