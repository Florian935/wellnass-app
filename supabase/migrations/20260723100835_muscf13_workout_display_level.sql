-- MUSC-F13 : niveau d'affichage de l'écran de séance (préférence synchronisée).
-- Colonne additive sur profiles. Le CHECK laisse passer NULL (comptes antérieurs) ;
-- la coercition NULL -> 'normal' est faite côté application (rowToProfile).
alter table public.profiles
  add column workout_display_level text default 'normal'
  check (workout_display_level in ('simplified', 'normal', 'detailed'));
