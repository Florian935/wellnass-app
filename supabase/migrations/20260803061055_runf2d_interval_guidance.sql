-- US RUN-F2d (roadmap 5.18) : guidage fractionné vocal + vibration.
-- Colonnes additives sur des tables déjà publiées en `select *` (powersync-sync-rules.yaml) :
-- aucune sync rule à redéployer, contrairement à RUN-F2c (nouvelle table).

alter table public.runs
  add column interval_phase_index integer,
  add column interval_phase_start_distance_m integer,
  add column interval_phase_start_duration_s integer;

alter table public.running_profiles
  add column interval_guidance_enabled boolean not null default false;
