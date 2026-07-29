-- US CONTENU-01 — bibliothèque de programmes muscu (roadmap 3.1) + nettoyage du bruit éditorial.
--
-- Méthode tranchée le 28/07/2026 (Florian) : **migration SQL idempotente**, patron du seed CIQUAL.
-- UUID déterministes + `on conflict (id) do nothing` → rejouable sans doublon.
--
-- ── Ce que l'inventaire du cloud a montré le 29/07/2026 ────────────────────────────────────────
-- La spec de CONTENU-01 (25/07) supposait les deux bibliothèques vides. C'est faux :
--   • course  : 3 programmes seedés et **complets** (10 km/8 sem, prépa semi, reprise en douceur),
--               séances typées avec distances cibles → rien à faire ici ;
--   • muscu   : 1 seul programme complet (« Full Body Débutant », c1000001) ;
--   • et 4 programmes de **test** traînent dans la bibliothèque, dont **2 publiés** donc visibles
--     dans l'app : « Test admin programme » (muscu) et « Run run » (course).
-- Cette migration corrige les deux derniers points : elle dépublie le bruit et complète la muscu.
--
-- ── Pourquoi dépublier et non archiver (partie A) ──────────────────────────────────────────────
-- Les sync rules ne répliquent que `status = 'published'` : passer ces lignes en `'draft'` les
-- retire de l'app **sans rien perdre** — elles restent pleinement utilisables dans le back-office
-- pour la recette. Archiver (`deleted_at`) serait plus destructeur, et surtout irréversible depuis
-- l'admin tant qu'ADMIN-01 (8.11) n'est pas livrée. Réversible d'une ligne si besoin :
--   update public.programs set status = 'published' where id = '<uuid>';
--
-- ── Limite assumée : les noms de séance ne sont pas bilingues ──────────────────────────────────
-- `sessions.name` est une colonne texte simple — il n'existe **pas** de `session_translations`.
-- Les noms de programme, eux, sont bien FR+EN (`program_translations`). On choisit donc des noms de
-- séance **lisibles dans les deux langues** (« Push », « Pull », « Legs », « Upper », « Lower »),
-- plutôt que du français qu'un anglophone ne comprendrait pas. Le seed existant, lui, avait posé
-- « Séance A/B/C » (français seul). Une vraie i18n des séances demanderait une table dédiée :
-- hors périmètre de cette US, à ouvrir si le besoin se confirme.

-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- A. Dépublier le bruit éditorial (2 programmes de test publiés)
-- ══════════════════════════════════════════════════════════════════════════════════════════════

update public.programs
set status = 'draft', updated_at = now()
where id in (
  '07f98f5f-579e-46b7-af32-c08bc84af4bb',  -- « Test admin programme » (strength)
  '5ce415ae-4438-4b67-8753-26fdf43062ab'   -- « Run run » (running)
)
  and owner_id is null
  and status = 'published';                -- idempotent : un rejeu ne touche plus rien

-- Les deux autres (« Test », « Run ») sont déjà en `draft` : rien à faire, l'app ne les voit pas.

-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- B. Programme muscu n°2 — Push / Pull / Legs (intermédiaire, 8 semaines)
-- ══════════════════════════════════════════════════════════════════════════════════════════════

insert into public.programs (id, owner_id, pillar, status, is_active, level, goal, duration_weeks, created_at, updated_at)
values ('c1000002-0000-4000-8000-000000000002', null, 'strength', 'published', false, 'intermediate', 'muscle', 8, now(), now())
on conflict (id) do nothing;

insert into public.program_translations (id, program_id, owner_id, lang, name, summary, description, created_at, updated_at)
values
  ('c2000003-0000-4000-8000-000000000003', 'c1000002-0000-4000-8000-000000000002', null, 'fr',
   'Push / Pull / Legs — Intermédiaire',
   '3 séances qui découpent le corps par mouvement : poussée, tirage, jambes.',
   'Le découpage le plus courant chez les pratiquants intermédiaires. Chaque séance regroupe les muscles qui travaillent ensemble, ce qui laisse à chaque groupe le temps de récupérer. À faire sur 3 jours (une fois chaque séance) ou 6 jours (deux fois) selon le temps disponible. Progresse en charge dès que tu tiens le haut de la fourchette de répétitions sur toutes les séries.',
   now(), now()),
  ('c2000004-0000-4000-8000-000000000004', 'c1000002-0000-4000-8000-000000000002', null, 'en',
   'Push / Pull / Legs — Intermediate',
   '3 sessions splitting the body by movement: push, pull, legs.',
   'The most common split for intermediate lifters. Each session groups muscles that work together, giving every group time to recover. Run it over 3 days (each session once) or 6 days (twice) depending on your schedule. Add weight as soon as you hit the top of the rep range on every set.',
   now(), now())
on conflict (id) do nothing;

insert into public.sessions (id, program_id, owner_id, order_index, name, created_at, updated_at)
values
  ('c3000004-0000-4000-8000-000000000004', 'c1000002-0000-4000-8000-000000000002', null, 0, 'Push', now(), now()),
  ('c3000005-0000-4000-8000-000000000005', 'c1000002-0000-4000-8000-000000000002', null, 1, 'Pull', now(), now()),
  ('c3000006-0000-4000-8000-000000000006', 'c1000002-0000-4000-8000-000000000002', null, 2, 'Legs', now(), now())
on conflict (id) do nothing;

-- `target_reps` est du **texte** pour autoriser les fourchettes (« 6-8 »), comme le seed existant.
-- Les `exercise_id` sont les UUID déterministes de la bibliothèque, vérifiés présents en base le
-- 29/07/2026 (les 16 exercices du seed, de a1000001 à a1000016).
insert into public.exercise_plans (id, session_id, owner_id, order_index, exercise_id, set_type, target_sets, target_reps, rest_seconds, created_at, updated_at)
values
  -- Push : développé couché, incliné, militaire, élévations latérales, extension triceps
  ('c4000010-0000-4000-8000-000000000010', 'c3000004-0000-4000-8000-000000000004', null, 0, 'a1000001-0000-4000-8000-000000000001', 'normal', 4, '6-8',   150, now(), now()),
  ('c4000011-0000-4000-8000-000000000011', 'c3000004-0000-4000-8000-000000000004', null, 1, 'a1000002-0000-4000-8000-000000000002', 'normal', 3, '8-10',  120, now(), now()),
  ('c4000012-0000-4000-8000-000000000012', 'c3000004-0000-4000-8000-000000000004', null, 2, 'a1000011-0000-4000-8000-000000000011', 'normal', 3, '8-10',  120, now(), now()),
  ('c4000013-0000-4000-8000-000000000013', 'c3000004-0000-4000-8000-000000000004', null, 3, 'a1000012-0000-4000-8000-000000000012', 'normal', 3, '12-15',  75, now(), now()),
  ('c4000014-0000-4000-8000-000000000014', 'c3000004-0000-4000-8000-000000000004', null, 4, 'a1000014-0000-4000-8000-000000000014', 'normal', 3, '10-12',  75, now(), now()),
  -- Pull : traction, rowing barre, tirage vertical, curl biceps
  ('c4000015-0000-4000-8000-000000000015', 'c3000005-0000-4000-8000-000000000005', null, 0, 'a1000004-0000-4000-8000-000000000004', 'normal', 4, '6-8',   150, now(), now()),
  ('c4000016-0000-4000-8000-000000000016', 'c3000005-0000-4000-8000-000000000005', null, 1, 'a1000005-0000-4000-8000-000000000005', 'normal', 4, '8-10',  120, now(), now()),
  ('c4000017-0000-4000-8000-000000000017', 'c3000005-0000-4000-8000-000000000005', null, 2, 'a1000006-0000-4000-8000-000000000006', 'normal', 3, '10-12',  90, now(), now()),
  ('c4000018-0000-4000-8000-000000000018', 'c3000005-0000-4000-8000-000000000005', null, 3, 'a1000013-0000-4000-8000-000000000013', 'normal', 3, '10-12',  75, now(), now()),
  -- Legs : squat, soulevé de terre, presse à cuisses, fente, gainage
  ('c4000019-0000-4000-8000-000000000019', 'c3000006-0000-4000-8000-000000000006', null, 0, 'a1000007-0000-4000-8000-000000000007', 'normal', 4, '6-8',   180, now(), now()),
  ('c4000020-0000-4000-8000-000000000020', 'c3000006-0000-4000-8000-000000000006', null, 1, 'a1000008-0000-4000-8000-000000000008', 'normal', 3, '5',     180, now(), now()),
  ('c4000021-0000-4000-8000-000000000021', 'c3000006-0000-4000-8000-000000000006', null, 2, 'a1000009-0000-4000-8000-000000000009', 'normal', 3, '10-12', 120, now(), now()),
  ('c4000022-0000-4000-8000-000000000022', 'c3000006-0000-4000-8000-000000000006', null, 3, 'a1000010-0000-4000-8000-000000000010', 'normal', 3, '10-12',  90, now(), now()),
  ('c4000023-0000-4000-8000-000000000023', 'c3000006-0000-4000-8000-000000000006', null, 4, 'a1000015-0000-4000-8000-000000000015', 'duration', 3, '45 s',  60, now(), now())
on conflict (id) do nothing;

-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- C. Programme muscu n°3 — Half Body haut / bas (intermédiaire, 8 semaines, 4 séances/sem)
-- ══════════════════════════════════════════════════════════════════════════════════════════════

insert into public.programs (id, owner_id, pillar, status, is_active, level, goal, duration_weeks, created_at, updated_at)
values ('c1000003-0000-4000-8000-000000000003', null, 'strength', 'published', false, 'intermediate', 'muscle', 8, now(), now())
on conflict (id) do nothing;

insert into public.program_translations (id, program_id, owner_id, lang, name, summary, description, created_at, updated_at)
values
  ('c2000005-0000-4000-8000-000000000005', 'c1000003-0000-4000-8000-000000000003', null, 'fr',
   'Half Body — Haut / Bas',
   '2 séances alternées, 4 fois par semaine : chaque moitié du corps travaillée deux fois.',
   'Un bon compromis entre le full body et le découpage fin : en alternant haut et bas quatre fois par semaine, chaque groupe est sollicité deux fois, ce qui est le rythme le plus souvent associé à la prise de muscle. Plus simple à caler qu''un PPL sur 6 jours, et plus tolérant si tu sautes une séance.',
   now(), now()),
  ('c2000006-0000-4000-8000-000000000006', 'c1000003-0000-4000-8000-000000000003', null, 'en',
   'Half Body — Upper / Lower',
   '2 alternating sessions, 4 times a week: each half of the body trained twice.',
   'A good middle ground between full body and a finer split: alternating upper and lower four times a week hits every group twice, the frequency most often linked to muscle gain. Easier to fit in than a 6-day PPL, and more forgiving if you miss a session.',
   now(), now())
on conflict (id) do nothing;

insert into public.sessions (id, program_id, owner_id, order_index, name, created_at, updated_at)
values
  ('c3000007-0000-4000-8000-000000000007', 'c1000003-0000-4000-8000-000000000003', null, 0, 'Upper', now(), now()),
  ('c3000008-0000-4000-8000-000000000008', 'c1000003-0000-4000-8000-000000000003', null, 1, 'Lower', now(), now())
on conflict (id) do nothing;

insert into public.exercise_plans (id, session_id, owner_id, order_index, exercise_id, set_type, target_sets, target_reps, rest_seconds, created_at, updated_at)
values
  -- Upper : développé couché, rowing barre, développé militaire, tirage vertical, curl, triceps
  ('c4000024-0000-4000-8000-000000000024', 'c3000007-0000-4000-8000-000000000007', null, 0, 'a1000001-0000-4000-8000-000000000001', 'normal', 4, '8-10',  120, now(), now()),
  ('c4000025-0000-4000-8000-000000000025', 'c3000007-0000-4000-8000-000000000007', null, 1, 'a1000005-0000-4000-8000-000000000005', 'normal', 4, '8-10',  120, now(), now()),
  ('c4000026-0000-4000-8000-000000000026', 'c3000007-0000-4000-8000-000000000007', null, 2, 'a1000011-0000-4000-8000-000000000011', 'normal', 3, '10-12',  90, now(), now()),
  ('c4000027-0000-4000-8000-000000000027', 'c3000007-0000-4000-8000-000000000007', null, 3, 'a1000006-0000-4000-8000-000000000006', 'normal', 3, '10-12',  90, now(), now()),
  ('c4000028-0000-4000-8000-000000000028', 'c3000007-0000-4000-8000-000000000007', null, 4, 'a1000013-0000-4000-8000-000000000013', 'normal', 3, '12',     60, now(), now()),
  ('c4000029-0000-4000-8000-000000000029', 'c3000007-0000-4000-8000-000000000007', null, 5, 'a1000014-0000-4000-8000-000000000014', 'normal', 3, '12',     60, now(), now()),
  -- Lower : squat, soulevé de terre, fente, presse à cuisses, gainage, crunch
  ('c4000030-0000-4000-8000-000000000030', 'c3000008-0000-4000-8000-000000000008', null, 0, 'a1000007-0000-4000-8000-000000000007', 'normal', 4, '8-10',  150, now(), now()),
  ('c4000031-0000-4000-8000-000000000031', 'c3000008-0000-4000-8000-000000000008', null, 1, 'a1000008-0000-4000-8000-000000000008', 'normal', 3, '6',     180, now(), now()),
  ('c4000032-0000-4000-8000-000000000032', 'c3000008-0000-4000-8000-000000000008', null, 2, 'a1000010-0000-4000-8000-000000000010', 'normal', 3, '10-12',  90, now(), now()),
  ('c4000033-0000-4000-8000-000000000033', 'c3000008-0000-4000-8000-000000000008', null, 3, 'a1000009-0000-4000-8000-000000000009', 'normal', 3, '12-15',  90, now(), now()),
  ('c4000034-0000-4000-8000-000000000034', 'c3000008-0000-4000-8000-000000000008', null, 4, 'a1000015-0000-4000-8000-000000000015', 'duration', 3, '45 s',  60, now(), now()),
  ('c4000035-0000-4000-8000-000000000035', 'c3000008-0000-4000-8000-000000000008', null, 5, 'a1000016-0000-4000-8000-000000000016', 'normal', 3, '15',     60, now(), now())
on conflict (id) do nothing;
