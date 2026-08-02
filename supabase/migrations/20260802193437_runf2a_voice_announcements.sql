-- US RUN-F2a (roadmap 5.19) — réglage des annonces vocales périodiques pendant une course.
-- Premier réglage de comportement de course exposé à l'utilisateur (autoPause est câblé en dur).
-- Désactivé par défaut (spec R1) : une annonce vocale peut interrompre une musique en cours.
alter table public.running_profiles
  add column voice_announcements_enabled boolean not null default false,
  add column voice_announcement_interval_m integer not null default 1000;
