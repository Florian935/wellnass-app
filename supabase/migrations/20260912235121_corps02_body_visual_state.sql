-- US CORPS-02 — silhouette personnelle et intention visuelle.
--
-- Le départ et son objectif forment un seul document versionné afin qu'une sauvegarde locale soit
-- atomique. Les images rendues ne sont jamais persistées. La colonne reste nullable pour les
-- comptes qui n'ont pas encore ouvert l'éditeur.
--
-- Aucune nouvelle règle PowerSync : `user_settings` est déjà publiée et son bucket utilise
-- `select *`. La colonne est déjà couverte par la RLS, l'export et la suppression de cette ligne.

alter table public.user_settings
  add column if not exists body_visual_state jsonb;

alter table public.user_settings
  add constraint user_settings_body_visual_state_object_ck
  check (body_visual_state is null or jsonb_typeof(body_visual_state) = 'object');

comment on column public.user_settings.body_visual_state is
  'US CORPS-02 — document versionné de silhouette et intention visuelle ; objet JSON ou null.';
