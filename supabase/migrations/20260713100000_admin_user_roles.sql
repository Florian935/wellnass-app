-- Admin Fondation-2 (US 8.9) : rôles d'administration + RLS + fonctions de gate.
-- Table admin/web uniquement (interrogée via supabase-js par apps/admin) —
-- **hors** publication PowerSync (le mobile n'en a pas besoin).
-- Appliqué manuellement sur le cloud (dashboard SQL Editor), puis `db:types`.
-- Réf. : docs/specs/functional/us/8.9-admin-fondation-2-roles-gate.md,
--        docs/plans/8.9-admin-fondation-2-roles-gate.md.

-- Table des attributions de rôles. Convention projet : role = text + check
-- (pas d'enum / CREATE TYPE). Soft delete via deleted_at.
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('super_admin', 'content_editor', 'moderator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Unicité (user_id, role) sur les lignes actives seulement : autorise la
-- ré-attribution d'un rôle révoqué (soft-deleted). Précédent : running_pace_records.
create unique index user_roles_user_role_uidx
  on public.user_roles (user_id, role)
  where deleted_at is null;

-- Trigger updated_at (fonction définie dans 20260705150000_init_conventions.sql).
create trigger set_updated_at before update on public.user_roles
  for each row execute function public.set_updated_at();

-- Fonctions de gate. SECURITY DEFINER pour contourner la RLS de user_roles
-- (évite la récursion des policies) ; STABLE ; search_path figé (anti-injection).
create or replace function public.is_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and deleted_at is null
  );
$$;

create or replace function public.is_super_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'super_admin' and deleted_at is null
  );
$$;

-- RLS : chacun voit ses rôles, le super_admin voit tout ; écriture super_admin only.
alter table public.user_roles enable row level security;

create policy user_roles_select on public.user_roles
  for select using (user_id = auth.uid() or public.is_super_admin());
create policy user_roles_insert on public.user_roles
  for insert with check (public.is_super_admin());
create policy user_roles_update on public.user_roles
  for update using (public.is_super_admin()) with check (public.is_super_admin());
create policy user_roles_delete on public.user_roles
  for delete using (public.is_super_admin());

-- NB : PAS d'ajout à la publication `powersync` (table admin/web uniquement).
