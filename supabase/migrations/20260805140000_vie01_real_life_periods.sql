-- US VIE-01 (roadmap 1.28) — mode « vie réelle », dégradation gracieuse des objectifs.
--
-- Une ligne = une période déclarée `[started_on, ends_on]`, **bornes incluses**. Pendant cette
-- fenêtre, l'app abaisse ce qu'elle demande (cibles de semaine, déficit calorique, série, signaux de
-- reproche) puis reprend le plan normal toute seule.
--
-- ── La table ne porte QUE son intervalle, et c'est le point (patron OBJ-01) ──────────────────────
-- Ni statut, ni compteur, ni bilan : tout est **dérivé** de la fenêtre à chaque affichage. Trois
-- bénéfices, exactement ceux qu'OBJ-01 avait listés (sa décision D5) : aucun travail de fond (pas de
-- cron, personne à réveiller pour clore les périodes échues), un état stable, et ça marche hors ligne.
--
-- ── L'historique est conservé, et il est nécessaire ───────────────────────────────────────────────
-- « Arrêter maintenant » pose `ends_on = aujourd'hui` — ce n'est **pas** un soft delete. La période a
-- existé, donc elle doit continuer d'annoter les analyses passées (décision D2 : les jours restent
-- dans les moyennes, les tendances et l'ACWR, et la période est *marquée*). Supprimer la ligne
-- effacerait l'explication d'une semaine creuse.
--
-- ── AUCUNE contrainte de cohérence de plage, et c'est délibéré ────────────────────────────────────
-- Pas de `check (ends_on >= started_on)`, pas d'`exclude using gist` contre les chevauchements.
-- C'est la leçon de REPAS-01 (sa décision D6) : **une violation de contrainte bloque la file d'upload
-- PowerSync**. Deux appareils hors réseau peuvent déclarer des périodes qui se recouvrent ; un mode
-- dont l'activation casse la synchro serait pire que le problème qu'il résout. La validation est
-- **applicative** (`validateRealLifePeriod`), et la lecture absorbe un chevauchement en prenant
-- l'**union** des jours (`realLifeDayKeys`).
--
-- ── Aucune donnée de santé ────────────────────────────────────────────────────────────────────────
-- Volontairement **pas de colonne « motif »**. Le fléchissement est identique quelle que soit la
-- cause (décision D1), donc un motif n'apporterait rien de fonctionnel — mais stocker « malade »
-- ferait entrer une donnée de santé, ce qui rouvre la politique de confidentialité ET la déclaration
-- Google Play « Health apps », déjà passée à 6 types par CYCLE-01 et sur le chemin critique du
-- lancement. On ne paie pas ce délai pour un champ décoratif.

create table public.real_life_periods (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  started_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.real_life_periods is
  'US VIE-01 — périodes « vie réelle ». Bornes incluses. Historique conservé : il annote les analyses passées (décision D2).';
comment on column public.real_life_periods.ends_on is
  'Dernier jour de la période, INCLUS. « Arrêter maintenant » pose ends_on = aujourd''hui — ce n''est pas un soft delete.';

-- Lecture dominante : « les périodes de cet utilisateur, la plus récente d'abord » (carte de période
-- active, annotation du bilan hebdo, jours en pause pour la série).
create index real_life_periods_user_start_idx
  on public.real_life_periods (user_id, started_on desc);

alter table public.real_life_periods enable row level security;

-- Pas de politique `delete` : le projet fait du soft delete (patron `streak_jokers`).
create policy real_life_periods_select on public.real_life_periods
  for select using (user_id = auth.uid());
create policy real_life_periods_insert on public.real_life_periods
  for insert with check (user_id = auth.uid());
create policy real_life_periods_update on public.real_life_periods
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
