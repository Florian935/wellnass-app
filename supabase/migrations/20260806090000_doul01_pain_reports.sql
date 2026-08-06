-- US DOUL-01 (roadmap 1.29) — journal des zones douloureuses.
--
-- Une ligne = une zone déclarée un jour donné, avec son niveau. **Une ligne par (jour, zone)**
-- (décision D5) : patron `daily_wellbeing` / `body_measurements`, déjà éprouvé.
--
-- ── Pourquoi pas une période avec date de résolution (D5) ────────────────────────────────────────
-- Une douleur ne se « clôt » pas à une date précise : l'utilisateur cesse simplement de la déclarer.
-- Une **fraîcheur glissante** de 7 jours, calculée à la lecture, exprime cela mieux qu'un drapeau
-- « résolu » que personne ne pense à cocher — et elle ne demande aucune écriture.
--
-- ── `zone` SANS contrainte CHECK, contrairement à `level` ────────────────────────────────────────
-- La liste des 18 zones est **applicative** et vouée à bouger : D1 l'a déjà étendue une fois, des
-- 10 muscles de `FINE_MUSCLES` aux muscles **et** articulations. Un `CHECK` imposerait une migration
-- à chaque ajout, et surtout **une violation bloquerait la file d'upload PowerSync** si un client
-- d'une version plus récente écrivait une zone que le serveur ne connaît pas encore. Même
-- raisonnement que `meal_key` sans CHECK (REPAS-01) et `food_entries.meal_type` depuis 4.15.
--
-- `level` **garde** son CHECK : 3 valeurs fermées par D3, et une valeur inconnue y serait un bug,
-- pas une évolution.
--
-- ── Donnée de santé ──────────────────────────────────────────────────────────────────────────────
-- Opt-in strict (`user_settings.pain_journal_enabled`, migration voisine) : rien ne s'écrit tant que
-- l'utilisateur n'a pas activé le journal. Et **rien n'est envoyé à Health Connect** — c'est ce qui
-- garde la déclaration Play « Health apps » à 6 types, sans nouveau délai d'instruction.

create table public.pain_reports (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  zone text not null,
  level text not null check (level in ('discomfort', 'pain', 'blocking')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.pain_reports is
  'US DOUL-01 — zones sensibles déclarées. Une ligne par (jour, zone). Donnée de santé, opt-in strict.';
comment on column public.pain_reports.zone is
  'Zone parmi PAIN_ZONES (18 : 10 muscles + 8 articulations). Volontairement sans CHECK — liste applicative, évolutive.';

-- R2 : redéclarer la même zone le même jour met à jour le niveau, sans créer de doublon.
-- Index **partiel** : une ligne soft-deletée ne doit pas empêcher d'en recréer une
-- (patron `daily_wellbeing`, `body_measurements`, `streak_jokers`).
create unique index pain_reports_user_day_zone_uq
  on public.pain_reports (user_id, log_date, zone)
  where deleted_at is null;

-- Lecture dominante : « mes déclarations récentes », pour la fraîcheur et l'historique.
create index pain_reports_user_date_idx on public.pain_reports (user_id, log_date desc);

alter table public.pain_reports enable row level security;

-- Pas de politique `delete` : soft delete, comme partout dans ce schéma.
create policy pain_reports_select on public.pain_reports
  for select using (user_id = auth.uid());
create policy pain_reports_insert on public.pain_reports
  for insert with check (user_id = auth.uid());
create policy pain_reports_update on public.pain_reports
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
