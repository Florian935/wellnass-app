-- US 8.10 — log d'audit des actions admin (écritures éditoriales + rôles).
-- Table web/admin uniquement — HORS publication PowerSync (le mobile n'en a pas besoin).
-- Append-only & non supprimable : aucune policy update/delete + trigger d'immuabilité.
-- Réf. : docs/specs/functional/us/8.10-admin-log-audit.md, docs/plans/8.10-admin-log-audit.md.

-- Prérequis autosuffisant (patron 20260713100000_admin_user_roles) : garantit
-- gen_random_uuid() même si la migration fondation n'a pas été appliquée ici.
-- Les fonctions de gate public.is_admin() / public.is_super_admin() sont définies
-- dans 20260713100000_admin_user_roles.sql (réutilisées, non recréées).
create extension if not exists pgcrypto;

create table public.audit_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid,                       -- PAS de FK cascade : la trace survit à la suppression du compte
  actor_email  text,
  action       text not null,
  target_table text,
  target_id    uuid,
  target_label text,
  details      jsonb not null default '{}',
  created_at   timestamptz not null default now()
);

create index audit_log_created_at_idx on public.audit_log (created_at desc);
create index audit_log_actor_idx      on public.audit_log (actor_id);
create index audit_log_action_idx     on public.audit_log (action);

alter table public.audit_log enable row level security;

-- Lecture : super_admin uniquement.
create policy audit_log_select on public.audit_log
  for select using (public.is_super_admin());

-- Écriture : tout admin, en son propre nom (acteur honnête). AUCUNE policy
-- update/delete → append-only de fait (super_admin compris).
create policy audit_log_insert on public.audit_log
  for insert with check (public.is_admin() and actor_id = auth.uid());

-- Filet d'immuabilité : verrouille même si une policy update/delete était ajoutée
-- par erreur plus tard. La fonction lève systématiquement ; liée uniquement aux
-- opérations update/delete → le chemin insert n'est pas affecté.
create or replace function public.audit_log_immutable()
  returns trigger
  language plpgsql
as $$
begin
  raise exception 'audit_log est append-only (ni UPDATE ni DELETE)';
end;
$$;

create trigger audit_log_no_update before update on public.audit_log
  for each row execute function public.audit_log_immutable();
create trigger audit_log_no_delete before delete on public.audit_log
  for each row execute function public.audit_log_immutable();

-- NB : PAS d'ajout à la publication `powersync` (table admin/web uniquement).
