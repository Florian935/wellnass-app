-- US ACCES-IA (7.43) — Prisme réservé aux testeurs : la liste des comptes qui ont accès à l'IA.
-- Réf. : docs/specs/functional/us/acces-ia-testeurs.md §7 · docs/plans/acces-ia-testeurs.md, étape 3.
--
-- ── Pourquoi une table dédiée, et pas un rôle de `user_roles` ─────────────────────────────────────
-- `is_admin()` vaut vrai pour **n'importe quelle** ligne active de `user_roles` (20260713100000) : un
-- « rôle testeur » y rendrait administrateur du back-office. Une table à part ne peut pas, par
-- construction, entrer dans `is_admin()`, `is_super_admin()` ni `can_manage_users()` (spec R6).
--
-- ── Qui lit, qui écrit ────────────────────────────────────────────────────────────────────────────
-- - **La fonction Edge `ai-assist`** lit la table (clé `service_role`), selon le secret `AI_ACCESS`.
-- - **Le back-office** lit par la vue `admin_ai_testers` et écrit par trois fonctions `security definer`
--   (patron `ban_user`, 8.8b) : `added_by` est posé ici, jamais fourni par le client, et l'e-mail se
--   compare **par égalité**, côté serveur — PostgREST lit `*` comme un joker dans `ilike`.
-- - **Personne d'autre** : RLS activée sans aucune politique (patron `ai_usage`, `sync_receipts`).
--
-- ── Ce qui n'est PAS fait, volontairement ─────────────────────────────────────────────────────────
-- - **Aucune publication PowerSync, aucune sync rule** (spec D9) : la table ne descend sur aucun
--   téléphone ; l'app apprend l'accès par l'appel `status` de `ai-assist`.
-- - **Hors de l'export RGPD de l'app** (spec D10, QA2, validée le 23/10/2026) : être testeur est une
--   décision de l'éditeur, pas une donnée fournie par l'utilisateur ; le droit d'accès se sert sur demande.
--
-- Retrait = *soft delete* ; ré-ajout = **nouvelle ligne** (la date « testeur depuis » reste juste,
-- l'historique vit dans `audit_log`). Le compte supprimé emporte sa ligne (`cascade`) ; l'administrateur
-- supprimé ne bloque pas la purge (`set null` — leçon de `user_bans.acted_by`, CONF-02).

create extension if not exists pgcrypto;

create table public.ai_testers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  added_by   uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.ai_testers is
  'US ACCES-IA — comptes testeurs de l''IA (Prisme, Labo IA) quand AI_ACCESS=testers. Lue par la fonction Edge ai-assist (service_role), écrite par grant_ai_tester / grant_ai_tester_by_email / revoke_ai_tester. Hors PowerSync, hors export de l''app.';
comment on column public.ai_testers.added_by is
  'US ACCES-IA — l''administrateur qui a ajouté le compte (auth.uid() de l''appelant). NULL si ce compte a depuis été supprimé.';

-- Une seule ligne **active** par compte : deux ajouts simultanés n'en créent qu'une.
create unique index ai_testers_active_user_uidx
  on public.ai_testers (user_id)
  where deleted_at is null;

create trigger set_updated_at before update on public.ai_testers
  for each row execute function public.set_updated_at();

-- RLS sans politique : invisible pour anon et authenticated.
alter table public.ai_testers enable row level security;
revoke all on public.ai_testers from anon, authenticated;
-- 🔴 Explicite : une table neuve de `public` n'est plus exposée d'office aux rôles de l'API
-- (config.toml, `auto_expose_new_tables`, définitif le 30/10/2026). Sans ce droit, la fonction Edge ne
-- lit plus la liste : elle répond « indisponible » à tous (spec D16).
grant select on public.ai_testers to service_role;

-- ── Ajouter un testeur, par son identifiant (fiche utilisateur) ───────────────────────────────────
-- Paramètre nommé `target_user_id`, pas `user_id` : ce serait ambigu avec la colonne en PL/pgSQL.
create or replace function public.grant_ai_tester(target_user_id uuid)
  returns text
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not public.can_manage_users() then
    raise exception 'non autorisé';
  end if;
  if target_user_id is null or not exists (select 1 from auth.users u where u.id = target_user_id) then
    raise exception 'compte introuvable';
  end if;

  -- L'index unique partiel arbitre : un compte déjà testeur ne change rien. Deux appels simultanés :
  -- le second attend la fin du premier, puis ne fait rien.
  insert into public.ai_testers (user_id, added_by)
  values (target_user_id, auth.uid())
  on conflict (user_id) where deleted_at is null do nothing;

  if found then
    return 'added';
  end if;
  return 'already';
end;
$$;

comment on function public.grant_ai_tester(uuid) is
  'US ACCES-IA — ajoute un compte aux testeurs de l''IA. Renvoie added ou already. Réservée aux gestionnaires d''utilisateurs (can_manage_users).';

-- ── Ajouter un testeur, par son e-mail (écran « Testeurs IA ») ────────────────────────────────────
-- Égalité stricte, casse et espaces ignorés : un e-mail ne désigne jamais un autre compte. Les comptes
-- SSO sont écartés, ce qui garantit l'unicité (index partiel de GoTrue sur l'e-mail des non-SSO).
create or replace function public.grant_ai_tester_by_email(target_email text)
  returns table (outcome text, target_user_id uuid)
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.can_manage_users() then
    raise exception 'non autorisé';
  end if;

  -- `strict` : zéro compte → « introuvable » ; deux comptes (possible seulement par une écriture directe
  -- dans `auth.users`, GoTrue met les e-mails en minuscules) → refus, plutôt qu'un compte pris au hasard.
  begin
    select u.id into strict v_id
      from auth.users u
     where lower(u.email) = lower(btrim(coalesce(target_email, '')))
       and u.is_sso_user = false
       and u.deleted_at is null;
  exception
    when no_data_found then
      return query select 'not_found'::text, null::uuid;
      return;
    when too_many_rows then
      raise exception 'e-mail ambigu : plusieurs comptes';
  end;

  return query select public.grant_ai_tester(v_id), v_id;
end;
$$;

comment on function public.grant_ai_tester_by_email(text) is
  'US ACCES-IA — ajoute aux testeurs le compte dont l''e-mail est égal (casse et espaces ignorés). Renvoie (added | already | not_found, identifiant). Réservée aux gestionnaires d''utilisateurs.';

-- ── Retirer un testeur ────────────────────────────────────────────────────────────────────────────
create or replace function public.revoke_ai_tester(target_user_id uuid)
  returns text
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not public.can_manage_users() then
    raise exception 'non autorisé';
  end if;

  update public.ai_testers
     set deleted_at = now()
   where user_id = target_user_id
     and deleted_at is null;

  if found then
    return 'removed';
  end if;
  return 'absent';
end;
$$;

comment on function public.revoke_ai_tester(uuid) is
  'US ACCES-IA — retire un compte des testeurs de l''IA (soft delete). Renvoie removed ou absent. Réservée aux gestionnaires d''utilisateurs.';

-- Droits : retirer le EXECUTE par défaut (PUBLIC) puis n'accorder qu'à authenticated ; la première
-- instruction de chaque fonction est le contrôle can_manage_users().
revoke execute on function public.grant_ai_tester(uuid) from public, anon;
revoke execute on function public.grant_ai_tester_by_email(text) from public, anon;
revoke execute on function public.revoke_ai_tester(uuid) from public, anon;
grant execute on function public.grant_ai_tester(uuid) to authenticated;
grant execute on function public.grant_ai_tester_by_email(text) to authenticated;
grant execute on function public.revoke_ai_tester(uuid) to authenticated;

-- ── La vue du back-office ─────────────────────────────────────────────────────────────────────────
-- Patron `admin_users` (8.8a) : exécutée aux droits de son propriétaire, elle lit `auth.users`,
-- `profiles` et `ai_usage` sans droit à leur donner ; la SEULE barrière est le `where can_manage_users()`.
-- ⚠️ Le Security Advisor de Supabase la signalera, comme `admin_users` : connu et accepté.
-- « Appels sur 7 jours » : toutes les demandes à l'IA (Prisme et Labo IA), aujourd'hui compris, jour UTC
-- comme le quota.
create or replace view public.admin_ai_testers
  with (security_barrier = true)
as
  select
    t.id,
    t.user_id,
    u.email,
    p.first_name,
    t.created_at,
    a.email as added_by_email,
    (select max(g.usage_date)
       from public.ai_usage g
      where g.user_id = t.user_id and g.count > 0) as last_used_on,
    (select coalesce(sum(g.count), 0)::integer
       from public.ai_usage g
      where g.user_id = t.user_id
        and g.usage_date > (now() at time zone 'utc')::date - 7) as calls_7d
  from public.ai_testers t
  join auth.users u on u.id = t.user_id
  left join public.profiles p on p.user_id = t.user_id and p.deleted_at is null
  left join auth.users a on a.id = t.added_by
  where t.deleted_at is null
    and public.can_manage_users();

comment on view public.admin_ai_testers is
  'US ACCES-IA — testeurs actifs de l''IA pour le back-office (e-mail, prénom, ajouteur, dernière utilisation, appels sur 7 jours). Barrière : can_manage_users().';

revoke all on public.admin_ai_testers from anon;
grant select on public.admin_ai_testers to authenticated;

-- NB : PAS d'ajout à la publication `powersync`, PAS de sync rule (spec D9).
