-- US 8.2 — Admin : exercices éditoriaux (brouillon/publié) + RLS d'écriture admin.
-- 🔴 checkpoint cloud : appliqué manuellement par un humain (dashboard SQL Editor),
-- puis `db:types` + redéploiement des sync rules PowerSync.
-- Réf. : docs/specs/functional/us/8.2-admin-crud-exercices.md,
--        docs/plans/8.2-admin-crud-exercices.md.
--
-- Contexte :
--   - `exercises.owner_id IS NULL` = exercice éditorial (bibliothèque). `source = 'library'`.
--   - RLS d'origine (20260706120001_socle_muscu_rls.sql) : insert/update réservés à
--     `owner_id = auth.uid()` → l'admin ne peut PAS écrire l'éditorial. On rouvre l'écriture
--     éditoriale aux **éditeurs de contenu** (super_admin + content_editor), PAS aux moderators.
--   - Postgres n'a PAS de `CREATE OR REPLACE POLICY` → DROP puis CREATE (noms exacts d'origine).

-- Éditeur de contenu = super_admin OU content_editor (le moderator n'édite pas le contenu éditorial).
-- SECURITY DEFINER (contourne la RLS de user_roles, pas de récursion) ; STABLE ; search_path figé.
create or replace function public.is_content_editor()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role in ('super_admin', 'content_editor')
      and deleted_at is null
  );
$$;

-- Colonne statut : défaut 'published' → seed + customs existants restent visibles ;
-- seuls les nouveaux brouillons éditoriaux sont masqués.
alter table public.exercises
  add column status text not null default 'published' check (status in ('draft', 'published'));

-- ── RLS exercises ──────────────────────────────────────────────────────────
-- select : un user voit ses exercices, l'éditorial PUBLIÉ, et un admin voit tout (dont brouillons).
drop policy if exists exercises_select on public.exercises;
create policy exercises_select on public.exercises for select
  using (owner_id = auth.uid() or (owner_id is null and status = 'published') or public.is_admin());

-- insert : soi-même (custom) ou éditeur de contenu (éditorial).
drop policy if exists exercises_insert on public.exercises;
create policy exercises_insert on public.exercises for insert
  with check (owner_id = auth.uid() or public.is_content_editor());

-- update : soi-même ou éditeur de contenu (couvre publish/brouillon et le soft-delete = update de deleted_at).
drop policy if exists exercises_update on public.exercises;
create policy exercises_update on public.exercises for update
  using (owner_id = auth.uid() or public.is_content_editor())
  with check (owner_id = auth.uid() or public.is_content_editor());

-- ── RLS exercise_translations ───────────────────────────────────────────────
-- select inchangée (exercise_translations_select : owner_id is null or owner_id = auth.uid()).
-- On rouvre insert/update aux éditeurs de contenu (idem exercises).
drop policy if exists exercise_translations_insert on public.exercise_translations;
create policy exercise_translations_insert on public.exercise_translations for insert
  with check (owner_id = auth.uid() or public.is_content_editor());

drop policy if exists exercise_translations_update on public.exercise_translations;
create policy exercise_translations_update on public.exercise_translations for update
  using (owner_id = auth.uid() or public.is_content_editor())
  with check (owner_id = auth.uid() or public.is_content_editor());
