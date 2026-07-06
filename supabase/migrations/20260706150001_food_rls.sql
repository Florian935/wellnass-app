-- RLS — pilier Alimentation (V0.4). Appliqué après 20260706150000_food_tables.sql.
--   foods / food_translations : contenu partageable (owner_id null = bibliothèque, ou = user).
--   food_favorites / food_entries : données utilisateur (user_id = auth.uid()).
-- Pas de delete (soft delete via deleted_at).

alter table public.foods             enable row level security;
alter table public.food_translations enable row level security;
alter table public.food_favorites    enable row level security;
alter table public.food_entries      enable row level security;

-- Tables « contenu partageable » (owner_id)
do $$
declare t text;
begin
  foreach t in array array['foods','food_translations']
  loop
    execute format('create policy %I_select on public.%I for select using (owner_id is null or owner_id = auth.uid());', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (owner_id = auth.uid());', t, t);
    execute format('create policy %I_update on public.%I for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());', t, t);
  end loop;
end $$;

-- Tables « utilisateur » (user_id)
do $$
declare t text;
begin
  foreach t in array array['food_favorites','food_entries']
  loop
    execute format('create policy %I_select on public.%I for select using (user_id = auth.uid());', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (user_id = auth.uid());', t, t);
    execute format('create policy %I_update on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid());', t, t);
  end loop;
end $$;
