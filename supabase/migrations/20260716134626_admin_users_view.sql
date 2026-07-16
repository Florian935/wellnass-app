-- US 8.8a — Consultation des utilisateurs (back-office).
-- Fonction de gate can_manage_users() (super_admin OU moderator) + vue admin_users
-- (lecture seule, sobre RGPD) joignant auth.users + profiles + user_settings.
-- Table/vue web-admin uniquement : HORS publication PowerSync, aucune sync rule.
-- Réf. : docs/specs/functional/us/8.8a-admin-consultation-utilisateurs.md §3.

-- Gate : a le rôle super_admin OU moderator (actif). Même style que is_admin/is_super_admin
-- (SECURITY DEFINER pour contourner la RLS de user_roles ; STABLE ; search_path figé).
create or replace function public.can_manage_users()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role in ('super_admin', 'moderator')
      and deleted_at is null
  );
$$;

-- Vue de consultation. security_invoker reste false (défaut) → exécutée avec les droits
-- du propriétaire (rôle de migration) : lit auth.users et contourne la RLS de
-- profiles/user_settings. La SEULE barrière serveur est le WHERE can_manage_users().
-- Colonnes sobres : aucune donnée de santé, aucun secret (pas de hash).
create or replace view public.admin_users
  with (security_barrier = true)
as
  select
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    (u.banned_until is not null and u.banned_until > now()) as is_banned,
    p.first_name,
    p.main_goal,
    p.onboarding_completed_at,
    s.active_pillars,
    s.language
  from auth.users u
  left join public.profiles p on p.user_id = u.id and p.deleted_at is null
  left join public.user_settings s on s.user_id = u.id and s.deleted_at is null
  where public.can_manage_users();

-- Privilèges explicites (défense en profondeur : la protection tient déjà via le WHERE).
revoke all on public.admin_users from anon;
grant select on public.admin_users to authenticated;
