-- US NORYN-01 (9.17) — le reçu de synchro : « quand le serveur a-t-il reçu, pour la dernière fois, des
-- données du téléphone de cet utilisateur ? ».
--
-- Pourquoi une table, et pas `max(updated_at)` : sur ce projet, `updated_at` est écrit par l'HORLOGE DU
-- TÉLÉPHONE (`_sql.ts`, `nowUtc()` à chaque écriture locale) et remonte tel quel par PowerSync ;
-- `set_updated_at` ne le réécrit qu'à l'UPDATE, et n'existe pas sur `daily_steps`, `daily_wellbeing`,
-- `real_life_periods` ni `activities`. Le contrat Noryn interdit l'horloge du téléphone, `now()` au
-- moment de la réponse et les écritures du serveur lui-même (`ai-assist`, éditeur SQL). Le reçu tient
-- les trois règles : il prend `now()` du SERVEUR, au moment où l'écriture arrive, et seulement si
-- l'auteur de l'écriture (`auth.uid()`) est le propriétaire de la ligne.
--
-- Décision D9 (validée le 08/10/2026) : le reçu est posé pour CHAQUE compte qui écrit ses lignes. La
-- fonction `noryn-context` ne lit que celui du compte fixé par son secret.
--
-- 🔴 Le déclencheur ne peut JAMAIS faire échouer l'écriture qui le déclenche : tout est rattrapé.
-- Un déclencheur en erreur bloquerait toute la file d'envoi PowerSync du téléphone.
--
-- Pas de sync rule, pas d'ajout à la publication `powersync`, pas de schéma PowerSync local : la table
-- ne descend jamais sur un téléphone.

create table public.sync_receipts (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  received_at timestamptz not null
);

comment on table public.sync_receipts is
  'US NORYN-01 — heure serveur de la dernière écriture reçue de chaque utilisateur sur ses propres lignes. Lue par la seule service_role (noryn-context).';

-- RLS sans aucune politique : invisible pour anon et authenticated.
alter table public.sync_receipts enable row level security;
revoke all on public.sync_receipts from anon, authenticated;
-- 🔴 Explicite : une table neuve de `public` n'est plus exposée d'office aux rôles de l'API
-- (config.toml, `auto_expose_new_tables`, définitif le 30/10/2026). Sans ce droit : 503 permanent.
grant select on public.sync_receipts to service_role;

-- Corps commun : poser le reçu de l'auteur s'il écrit SA ligne. Ne lève jamais.
create or replace function public.note_sync_receipt_for(row_owner uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
  set lock_timeout = '200ms'
as $$
declare
  writer uuid;
begin
  -- Dans le bloc protégé : un `sub` qui ne serait pas un UUID ne casse rien.
  writer := auth.uid();
  if writer is not null and row_owner = writer then
    insert into public.sync_receipts as r (user_id, received_at)
    values (writer, now())
    on conflict (user_id) do update
      set received_at = greatest(r.received_at, excluded.received_at);
  end if;
exception when others then
  -- `lock_timeout` change une attente de verrou en erreur 55P03, rattrapée ici.
  null;
end;
$$;

comment on function public.note_sync_receipt_for(uuid) is
  'US NORYN-01 — pose le reçu de synchro de auth.uid() si la ligne lui appartient. Ne lève jamais. Interne aux déclencheurs.';

revoke all on function public.note_sync_receipt_for(uuid) from public, anon, authenticated;

-- Deux fonctions de déclencheur : chacune lit SA colonne propriétaire, sans sérialiser la ligne
-- (une trace GPS ou des micronutriments n'ont rien à faire là).
create or replace function public.note_sync_receipt_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  -- `note_sync_receipt_for` rattrape tout : un seul point de sauvegarde par écriture.
  if tg_op = 'DELETE' then
    perform public.note_sync_receipt_for(old.user_id);
  else
    perform public.note_sync_receipt_for(new.user_id);
  end if;
  return null;
end;
$$;

create or replace function public.note_sync_receipt_owner()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  -- `note_sync_receipt_for` rattrape tout : un seul point de sauvegarde par écriture.
  if tg_op = 'DELETE' then
    perform public.note_sync_receipt_for(old.owner_id);
  else
    perform public.note_sync_receipt_for(new.owner_id);
  end if;
  return null;
end;
$$;

revoke all on function public.note_sync_receipt_user() from public, anon, authenticated;
revoke all on function public.note_sync_receipt_owner() from public, anon, authenticated;

-- Tables à `user_id` qui alimentent les synthèses de Noryn (NORYN-01) ou leurs cibles (NORYN-02).
create trigger noryn_sync_receipt after insert or update or delete on public.daily_steps
  for each row execute function public.note_sync_receipt_user();
create trigger noryn_sync_receipt after insert or update or delete on public.food_entries
  for each row execute function public.note_sync_receipt_user();
create trigger noryn_sync_receipt after insert or update or delete on public.water_entries
  for each row execute function public.note_sync_receipt_user();
create trigger noryn_sync_receipt after insert or update or delete on public.daily_wellbeing
  for each row execute function public.note_sync_receipt_user();
create trigger noryn_sync_receipt after insert or update or delete on public.workouts
  for each row execute function public.note_sync_receipt_user();
create trigger noryn_sync_receipt after insert or update or delete on public.runs
  for each row execute function public.note_sync_receipt_user();
create trigger noryn_sync_receipt after insert or update or delete on public.profiles
  for each row execute function public.note_sync_receipt_user();
create trigger noryn_sync_receipt after insert or update or delete on public.nutrition_profiles
  for each row execute function public.note_sync_receipt_user();
create trigger noryn_sync_receipt after insert or update or delete on public.user_settings
  for each row execute function public.note_sync_receipt_user();
create trigger noryn_sync_receipt after insert or update or delete on public.running_profiles
  for each row execute function public.note_sync_receipt_user();
create trigger noryn_sync_receipt after insert or update or delete on public.activities
  for each row execute function public.note_sync_receipt_user();
create trigger noryn_sync_receipt after insert or update or delete on public.body_weight_entries
  for each row execute function public.note_sync_receipt_user();
create trigger noryn_sync_receipt after insert or update or delete on public.real_life_periods
  for each row execute function public.note_sync_receipt_user();

-- Tables à `owner_id` : le planning et le contenu personnel (programmes, séances, exercices).
-- Le contenu de bibliothèque (`owner_id` nul) ne pose jamais de reçu.
create trigger noryn_sync_receipt after insert or update or delete on public.planned_sessions
  for each row execute function public.note_sync_receipt_owner();
create trigger noryn_sync_receipt after insert or update or delete on public.programs
  for each row execute function public.note_sync_receipt_owner();
create trigger noryn_sync_receipt after insert or update or delete on public.sessions
  for each row execute function public.note_sync_receipt_owner();
create trigger noryn_sync_receipt after insert or update or delete on public.exercise_plans
  for each row execute function public.note_sync_receipt_owner();
create trigger noryn_sync_receipt after insert or update or delete on public.session_intervals
  for each row execute function public.note_sync_receipt_owner();
create trigger noryn_sync_receipt after insert or update or delete on public.exercises
  for each row execute function public.note_sync_receipt_owner();
