-- US BIEN-01 — check-in quotidien de bien-être (roadmap 1.24).
--
-- Une ligne par (utilisateur, jour civil local) portant trois indicateurs **subjectifs** sur une
-- échelle 1-5 : humeur, énergie, stress.
--
-- Les trois colonnes sont **nullables** et indépendantes (spec, décision D3) : forcer les trois
-- ferait abandonner le rituel en trois jours, et une ligne à un seul indicateur reste exploitable.
-- Aucune contrainte n'interdit une ligne dont les trois seraient nulles : le contrôle est fait côté
-- application (`isEmptyCheckin`), pour ne pas compliquer l'édition — retirer un indicateur d'une
-- ligne existante doit rester possible.
--
-- ⚠️ `stress` se lit **à l'envers** des deux autres (5 = beaucoup de stress = mauvais). Aucun calcul
-- SQL ne suppose ici qu'une valeur haute est « bonne ».
--
-- ⚠️ **Pas de colonne poids** : la pesée vit dans `body_weight_entries` (roadmap 4.30). Le check-in
-- met à jour la ligne du jour existante au lieu d'en créer une seconde — la dupliquer ici
-- fabriquerait deux vérités pour la même mesure.
--
-- ⚠️ Donnée de santé **synchronisée** : comme les pas de PAS-01, ces lignes remontent sur nos
-- serveurs. La fiche Play déclare déjà « donnée de santé transmise hors de l'appareil » ; la
-- politique de confidentialité doit en revanche mentionner humeur / énergie / stress.
-- Aucun rapport avec Health Connect : rien n'est lu ni écrit de ce côté.

create table public.daily_wellbeing (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  mood smallint check (mood is null or mood between 1 and 5),
  energy smallint check (energy is null or energy between 1 and 5),
  stress smallint check (stress is null or stress between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Une seule ligne vivante par jour. Index **partiel** : une ligne soft-deleted ne doit pas empêcher
-- d'en recréer une pour le même jour (même patron que `daily_steps` et `body_weight_entries`).
create unique index daily_wellbeing_user_day_uq
  on public.daily_wellbeing (user_id, log_date)
  where deleted_at is null;

-- Lecture dominante : l'historique récent d'un utilisateur, du plus récent au plus ancien.
create index daily_wellbeing_user_date_idx on public.daily_wellbeing (user_id, log_date desc);

alter table public.daily_wellbeing enable row level security;

-- Calque de `daily_steps` : pas de politique `delete`, le projet fait du soft delete.
create policy daily_wellbeing_select on public.daily_wellbeing
  for select using (user_id = auth.uid());
create policy daily_wellbeing_insert on public.daily_wellbeing
  for insert with check (user_id = auth.uid());
create policy daily_wellbeing_update on public.daily_wellbeing
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- La suppression de compte (CONF-02) passe par `delete from auth.users` : la cascade FK ci-dessus
-- purge donc cette table sans modifier `purge_expired_accounts()`.
