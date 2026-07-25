-- CONF-02 — Suppression de compte (RGPD). Table de demandes + RPC + purge résiliente par pg_cron.
-- Réf. : docs/specs/functional/us/conf02-suppression-compte.md · plan docs/plans/conf02-suppression-compte.md

-- 1. Correctif FK bloquant : user_bans.acted_by doit se dénuller quand l'acteur est supprimé.
--    Sinon supprimer un compte admin ayant banni viole la FK et gèle la purge. On retrouve le nom
--    réel de la contrainte dynamiquement (FK inline auto-nommée) plutôt que de le deviner.
do $$
declare cname text;
begin
  select con.conname into cname
    from pg_constraint con
    where con.conrelid = 'public.user_bans'::regclass
      and con.contype = 'f'
      and con.conkey = array[
        (select attnum from pg_attribute
          where attrelid = 'public.user_bans'::regclass and attname = 'acted_by')
      ];
  if cname is not null then
    execute format('alter table public.user_bans drop constraint %I', cname);
  end if;
end $$;
alter table public.user_bans
  add constraint user_bans_acted_by_fkey foreign key (acted_by)
  references auth.users (id) on delete set null;

-- 2. Table des demandes de suppression (au plus une pending par utilisateur).
create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'cancelled')),
  requested_at timestamptz not null default now(),
  scheduled_at timestamptz not null,
  cancelled_at timestamptz
);
create unique index account_deletion_pending_uniq
  on public.account_deletion_requests (user_id) where status = 'pending';

alter table public.account_deletion_requests enable row level security;
-- L'utilisateur lit UNIQUEMENT sa demande (pour le gate). Aucune policy write → seules les RPC écrivent.
create policy adr_select_own on public.account_deletion_requests
  for select using (user_id = auth.uid());

-- 3. RPC : demander la suppression (idempotent, race-safe) → renvoie la date d'échéance.
create or replace function public.request_account_deletion()
  returns timestamptz language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); sched timestamptz;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  insert into public.account_deletion_requests (user_id, scheduled_at)
    values (uid, now() + interval '30 days')
    on conflict (user_id) where status = 'pending' do nothing;
  select scheduled_at into sched from public.account_deletion_requests
    where user_id = uid and status = 'pending';
  return sched;
end; $$;

-- 4. RPC : annuler (seulement une demande pending NON échue ; sinon le cron a priorité).
create or replace function public.cancel_account_deletion()
  returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'non authentifié'; end if;
  update public.account_deletion_requests
    set status = 'cancelled', cancelled_at = now()
    where user_id = uid and status = 'pending' and scheduled_at > now();
end; $$;

-- 5. Purge RÉSILIENTE PAR LIGNE (une suppression fautive n'empêche pas les autres).
create or replace function public.purge_expired_accounts()
  returns integer language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select user_id from public.account_deletion_requests
           where status = 'pending' and scheduled_at <= now() loop
    begin
      delete from auth.users where id = r.user_id;   -- cascade FK = purge totale des données
      n := n + 1;
    exception when others then
      raise warning 'purge compte % échouée : %', r.user_id, sqlerrm;
    end;
  end loop;
  return n;
end; $$;

-- 6. Privilèges (patron ban_user) : RPC utilisateur réservées à authenticated ; purge jamais exposée.
revoke execute on function public.request_account_deletion() from public, anon;
revoke execute on function public.cancel_account_deletion() from public, anon;
revoke execute on function public.purge_expired_accounts() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;

-- 7. Planification quotidienne (03:00 UTC). cron.schedule fait un upsert par nom de job (pas de doublon).
create extension if not exists pg_cron;
select cron.schedule('purge-deleted-accounts', '0 3 * * *',
  $$ select public.purge_expired_accounts(); $$);
