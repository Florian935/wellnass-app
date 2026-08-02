-- US RUN-F1b (roadmap 5.32) — dénivelé cumulé.
-- Scalaires cumulés en direct par le tracker (comme distance_m/duration_seconds), jamais
-- recalculés depuis gps_track. Nullable : absent pour une course manuelle ou une course
-- enregistrée avant cette migration (donnée source absente, jamais 0).
alter table public.runs
  add column elevation_gain_m numeric,
  add column elevation_loss_m numeric;
