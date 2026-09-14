-- CORPS-03 : priorités confirmées et copie de l'objectif visuel source.
-- La table user_settings est déjà couverte par RLS, export, suppression du compte
-- et le bucket PowerSync (select *). Aucun programme n'est modifié.

alter table public.user_settings
  add column body_training_state jsonb;

alter table public.user_settings
  add constraint user_settings_body_training_state_object_ck
  check (body_training_state is null or jsonb_typeof(body_training_state) = 'object');

comment on column public.user_settings.body_training_state is
  'CORPS-03 : document versionné des priorités confirmées et objectif source ; objet JSON ou null.';
