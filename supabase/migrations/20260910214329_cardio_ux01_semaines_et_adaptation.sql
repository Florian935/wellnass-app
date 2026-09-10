-- US CARDIO-UX01 — deux ajouts additifs, tous deux nullables.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────────
-- 1. `sessions.week_index` — un programme peut enfin PROGRESSER (R9 / constat F35)
-- ─────────────────────────────────────────────────────────────────────────────────────────────────
-- `sessions` ne portait aucune notion de semaine, et `planProgram` répétait le même patron
-- hebdomadaire pendant N semaines : un programme était **une semaine type répétée**, jamais un
-- plan progressif. Un « 10 km en 8 semaines » ne pouvait donc pas faire grandir sa sortie longue
-- de 8 à 14 km — alors que c'est la définition même d'un plan.
--
-- Sémantique retenue, et c'est elle qui rend la migration sans reprise :
--   • `null`  → séance de la semaine type, **répétée chaque semaine**. C'est le comportement
--               actuel, donc **tous les programmes existants restent valides tels quels**.
--   • `k`     → séance de la semaine `k` (0-based) uniquement.
--
-- On ne pose donc AUCUN défaut : mettre `default 0` ferait de chaque séance existante une séance
-- de la première semaine seulement, ce qui viderait les semaines 2 à 8 de tous les programmes
-- déjà planifiés. Le `null` est porteur de sens, pas un trou.
alter table public.sessions
  add column if not exists week_index integer;

comment on column public.sessions.week_index is
  'US CARDIO-UX01 — semaine du programme (0-based). NULL = seance de la semaine type, repetee chaque semaine (comportement anterieur). Ne jamais poser de defaut.';

-- ─────────────────────────────────────────────────────────────────────────────────────────────────
-- 2. `planned_sessions.adapted_*` — l'adaptation du jour s'APPLIQUE (R3-3 / constat F36)
-- ─────────────────────────────────────────────────────────────────────────────────────────────────
-- La carte « séance du jour » annonçait « retire 25 % des répétitions » puis précisait qu'elle
-- n'avait rien fait. L'utilisateur devait refaire le calcul à la main dans un éditeur à 14
-- contrôles par segment, un mardi matin à 6 h.
--
-- Les deux colonnes vivent sur l'**occurrence** (`planned_sessions`), jamais sur le template
-- (`sessions`) : c'est ce qui distingue « j'allège aujourd'hui parce que j'ai mal dormi » de
-- « je change mon plan ». Le programme des semaines suivantes reste intact (règle R3-3).
alter table public.planned_sessions
  add column if not exists adapted_reps_pct integer;

alter table public.planned_sessions
  add column if not exists adapted_pace_delta_s integer;

comment on column public.planned_sessions.adapted_reps_pct is
  'US CARDIO-UX01 — pourcentage de repetitions retirees pour CETTE occurrence seulement. NULL = aucune adaptation.';

comment on column public.planned_sessions.adapted_pace_delta_s is
  'US CARDIO-UX01 — ralentissement d''allure en s/km pour CETTE occurrence seulement. NULL = aucune adaptation.';

-- ─────────────────────────────────────────────────────────────────────────────────────────────────
-- RLS et sync rules
-- ─────────────────────────────────────────────────────────────────────────────────────────────────
-- Aucune politique RLS à ajouter : `sessions` et `planned_sessions` sont déjà publiées et
-- protégées par leurs politiques `owner_id` existantes ; ajouter une colonne n'y change rien.
--
-- ✅ **Aucune sync rule PowerSync à redéployer** : les deux tables sont déjà synchronisées en
-- `select *` (voir docs/specs/technical/powersync-sync-rules.yaml). C'est le piège de RUN-F2c —
-- oublié deux fois — mais il ne concerne que les tables **neuves**, pas les colonnes ajoutées.
