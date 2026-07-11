-- Running R3b-i : contenu de séance de course (type + cible) sur la table sessions partagée.
-- Additif et rétrocompatible : les séances muscu (session_type NULL) ne sont pas affectées.
-- Appliqué APRÈS 20260712090000_running_profiles.sql (ordre des timestamps).
-- Appliqué manuellement par un humain sur le cloud Supabase ou en local (Docker).

alter table public.sessions
  add column session_type text
    check (session_type in ('endurance','fractionne','sortie_longue','recuperation')),
  add column target_distance_m integer,
  add column target_duration_seconds integer;

-- Cible obligatoire uniquement pour les séances running (session_type non nul).
-- Les séances muscu (session_type NULL) passent toujours (les deux cibles restent NULL).
alter table public.sessions
  add constraint sessions_running_target_chk
  check (session_type is null or target_distance_m is not null or target_duration_seconds is not null);
