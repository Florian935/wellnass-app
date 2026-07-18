-- US Refonte-A — lien explicite entre une séance (workouts) et l'occurrence planifiée
-- qu'elle réalise (planned_sessions.id). Nullable : séance libre / ad hoc = pas de lien.
-- Sync rule PowerSync = "select * from workouts" => la colonne descend au client sans modif.
alter table public.workouts
  add column if not exists planned_session_id text;
