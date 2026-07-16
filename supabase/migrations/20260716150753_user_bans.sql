-- US 8.8b — Bannissement des utilisateurs (back-office).
-- Table user_bans (append-only, historique) + RPC ban_user/unban_user (SECURITY DEFINER)
-- + colonne is_admin ajoutée à la vue admin_users (garde-fou UI anti-ban-admin).
-- Web-admin uniquement : HORS PowerSync, aucune sync rule.
-- Réf. : docs/specs/functional/us/8.8b-admin-bannissement.md §3-§4.

create extension if not exists pgcrypto;

-- Historique append-only des bannissements. Écrite UNIQUEMENT par les RPC (definer) ;
-- le client anon ne peut que lire (RLS select), jamais insert/update/delete.
create table public.user_bans (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (action in ('ban', 'unban')),
  reason text,
  acted_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  constraint user_bans_reason_required
    check (action = 'unban' or (reason is not null and length(trim(reason)) > 0))
);
create index on public.user_bans (target_user_id, created_at desc);

alter table public.user_bans enable row level security;
-- Lecture réservée aux gestionnaires d'utilisateurs. AUCUNE policy write → client anon ne peut
-- pas écrire ; les RPC SECURITY DEFINER (propriétaire = postgres) contournent la RLS.
create policy user_bans_select on public.user_bans
  for select using (public.can_manage_users());

-- RPC bannir : vérifs atomiques (habilitation, motif, anti-self, anti-admin) puis
-- banned_until = date lointaine fixe (ban permanent) + ligne d'historique.
-- NB : date lointaine '9999-12-31' plutôt que 'infinity' → évite tout risque de parsing
-- de l'infini côté GoTrue (time.Time Go) ; sémantique identique (banned_until > now()).
create or replace function public.ban_user(target_user_id uuid, reason text)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not public.can_manage_users() then
    raise exception 'non autorisé';
  end if;
  if reason is null or length(trim(reason)) = 0 then
    raise exception 'motif requis';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'auto-bannissement interdit';
  end if;
  if exists (
    select 1 from public.user_roles
    where user_id = target_user_id and deleted_at is null
  ) then
    raise exception 'impossible de bannir un compte administrateur';
  end if;

  update auth.users set banned_until = '9999-12-31T00:00:00Z' where id = target_user_id;

  insert into public.user_bans (target_user_id, action, reason, acted_by)
  values (target_user_id, 'ban', trim(reason), auth.uid());
end;
$$;

-- RPC débannir : habilitation seule (un admin n'est jamais banni ; l'anti-self est sans objet).
create or replace function public.unban_user(target_user_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not public.can_manage_users() then
    raise exception 'non autorisé';
  end if;

  update auth.users set banned_until = null where id = target_user_id;

  insert into public.user_bans (target_user_id, action, acted_by)
  values (target_user_id, 'unban', auth.uid());
end;
$$;

-- Privilèges : retirer le EXECUTE par défaut (PUBLIC) puis n'accorder qu'à authenticated
-- (la 1re instruction de chaque RPC est le contrôle can_manage_users()).
revoke execute on function public.ban_user(uuid, text) from public, anon;
revoke execute on function public.unban_user(uuid) from public, anon;
grant execute on function public.ban_user(uuid, text) to authenticated;
grant execute on function public.unban_user(uuid) to authenticated;

-- Vue admin_users : AJOUT de is_admin EN DERNIER (create or replace interdit de
-- réordonner/renommer/supprimer les colonnes existantes ; on ne peut qu'ajouter en fin).
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
    s.language,
    exists (
      select 1 from public.user_roles r
      where r.user_id = u.id and r.deleted_at is null
    ) as is_admin
  from auth.users u
  left join public.profiles p on p.user_id = u.id and p.deleted_at is null
  left join public.user_settings s on s.user_id = u.id and s.deleted_at is null
  where public.can_manage_users();
