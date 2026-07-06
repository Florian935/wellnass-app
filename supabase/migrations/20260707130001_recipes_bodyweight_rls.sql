-- RLS — recettes, repas types, poids corporel (V0.4). Tables « utilisateur » (user_id).
-- Appliqué après 20260707130000_recipes_bodyweight_tables.sql.

alter table public.recipes             enable row level security;
alter table public.recipe_ingredients  enable row level security;
alter table public.meal_templates      enable row level security;
alter table public.meal_template_items enable row level security;
alter table public.body_weight_entries enable row level security;

do $$
declare t text;
begin
  foreach t in array array['recipes','recipe_ingredients','meal_templates','meal_template_items','body_weight_entries']
  loop
    execute format('create policy %I_select on public.%I for select using (user_id = auth.uid());', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (user_id = auth.uid());', t, t);
    execute format('create policy %I_update on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid());', t, t);
  end loop;
end $$;
