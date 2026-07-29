-- US ADMIN-01 — décompte des usages d'un contenu éditorial, réservé aux admins (roadmap 8.11).
--
-- ── Pourquoi une fonction, et pas de simples `count(*)` côté client ────────────────────────────
-- Le back-office est un client Supabase **authentifié comme un utilisateur normal** : il subit la
-- RLS. Or les tables d'usage sont scopées à leur propriétaire — `workout_sets_select` vaut
-- `user_id = auth.uid()`, sans aucun bypass admin (cf. 20260706120001_socle_muscu_rls.sql).
-- Un admin qui compterait « combien de séries utilisent cet exercice ? » ne verrait donc que **les
-- siennes**, et l'écran afficherait un décompte faux — pire que pas de décompte du tout, puisqu'il
-- donnerait confiance.
--
-- D'où cette fonction `security definer` : elle voit tout, mais **refuse de répondre à quiconque
-- n'est pas admin**. Même patron que `is_admin()` / `is_super_admin()` : search_path figé
-- (anti-injection), et le garde-fou en première ligne du corps.
--
-- ── Ce qu'elle compte ─────────────────────────────────────────────────────────────────────────
-- Uniquement les références **vivantes** (`deleted_at is null`) : un usage déjà supprimé n'est pas
-- un usage. Le résultat est un `jsonb` clé → nombre, ce qui laisse l'UI décider de l'ordre et des
-- libellés (i18n) sans figer de format ici, et permet d'ajouter une clé sans changer la signature.
--
-- ⚠️ Ces décomptes traversent les données de **tous** les utilisateurs. Ils ne servent qu'à décider
-- d'un archivage : aucune donnée personnelle n'est renvoyée, seulement des **nombres agrégés**.

create or replace function public.editorial_usage_counts(p_kind text, p_id uuid)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = public
as $$
declare
  result jsonb;
begin
  -- Garde-fou en première ligne : sans admin, on ne compte rien.
  if not public.is_admin() then
    raise exception 'forbidden: admin role required';
  end if;

  if p_kind = 'exercise' then
    select jsonb_build_object(
      'workout_sets',      (select count(*) from workout_sets      where exercise_id = p_id and deleted_at is null),
      'exercise_plans',    (select count(*) from exercise_plans    where exercise_id = p_id and deleted_at is null),
      'personal_records',  (select count(*) from personal_records  where exercise_id = p_id and deleted_at is null),
      'exercise_variants', (select count(*) from exercise_variants
                             where (exercise_id_a = p_id or exercise_id_b = p_id) and deleted_at is null)
    ) into result;

  elsif p_kind = 'program' then
    select jsonb_build_object(
      -- Contenu propre du programme.
      'sessions',         (select count(*) from sessions where program_id = p_id and deleted_at is null),
      'exercise_plans',   (select count(*) from exercise_plans ep
                            join sessions s on s.id = ep.session_id
                            where s.program_id = p_id and ep.deleted_at is null and s.deleted_at is null),
      -- Usage par les utilisateurs : séances planifiées qui pointent ce programme.
      'planned_sessions', (select count(*) from planned_sessions where program_id = p_id and deleted_at is null)
    ) into result;

  elsif p_kind = 'food' then
    select jsonb_build_object(
      'food_entries',        (select count(*) from food_entries        where food_id = p_id and deleted_at is null),
      'recipe_ingredients',  (select count(*) from recipe_ingredients  where food_id = p_id and deleted_at is null),
      'meal_template_items', (select count(*) from meal_template_items where food_id = p_id and deleted_at is null)
    ) into result;

  else
    -- Type inconnu : on refuse plutôt que de renvoyer `{}`, qui se lirait « aucun usage » et
    -- ferait archiver en confiance sur une faute de frappe.
    raise exception 'unknown kind: %', p_kind;
  end if;

  return result;
end;
$$;

comment on function public.editorial_usage_counts(text, uuid) is
  'US ADMIN-01 — nombre de références vivantes à un contenu éditorial (exercise|program|food). Admins uniquement.';

-- `authenticated` seulement : la fonction se protège elle-même par `is_admin()`, mais autant ne pas
-- l''exposer aux appels anonymes.
revoke all on function public.editorial_usage_counts(text, uuid) from public, anon;
grant execute on function public.editorial_usage_counts(text, uuid) to authenticated;
