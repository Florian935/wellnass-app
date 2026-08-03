-- US ACTIV-01 (roadmap 1.27) : parcours "7 jours pour démarrer".
-- Colonne additive sur une table déjà publiée en `select *` : aucune sync rule à redéployer.

alter table public.profiles
  add column activation_path_dismissed_at timestamptz;
