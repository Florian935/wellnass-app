-- US STREAK-01 — jokers de série (roadmap 7.14).
--
-- Une ligne par joker consommé, `log_date` étant **le jour manqué que le joker couvre**.
--
-- ── Pourquoi une table et pas un champ JSON sur `user_settings` (décision D6) ──────────────────
-- Le décompte mensuel devient un `count` trivial, l'usage reste **auditable** (on sait quel jour a
-- été couvert et quand), et ajouter une règle plus tard ne demande pas de migrer un blob opaque.
--
-- ⚠️ Un joker protège **la série et rien d'autre** (décision D3). Il ne rend pas le jour « actif » :
-- l'adhérence, la complétion du journal et les corrélations post-V1 continuent de voir un jour vide,
-- **parce qu'il l'est**. Aucune écriture dans `workouts`, `runs` ou `food_entries` ici.

create table public.streak_jokers (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Un même jour ne peut pas consommer deux jokers. Index **partiel** : une ligne soft-deletée ne doit
-- pas empêcher d'en recréer une (patron `daily_wellbeing`, `body_measurements`).
create unique index streak_jokers_user_day_uq
  on public.streak_jokers (user_id, log_date)
  where deleted_at is null;

create index streak_jokers_user_date_idx on public.streak_jokers (user_id, log_date desc);

alter table public.streak_jokers enable row level security;

-- Pas de politique `delete` : le projet fait du soft delete. Et l'annulation d'un joker est hors
-- périmètre — un filet qu'on peut retirer après coup n'en est pas un.
create policy streak_jokers_select on public.streak_jokers
  for select using (user_id = auth.uid());
create policy streak_jokers_insert on public.streak_jokers
  for insert with check (user_id = auth.uid());
create policy streak_jokers_update on public.streak_jokers
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
