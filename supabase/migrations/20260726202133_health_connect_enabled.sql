-- US CONF-06 — consentement Health Connect.
-- Opt-in strict : la donnée de santé exige un consentement explicite, donc `default false`
-- (contrairement à `analytics_enabled`, opt-out à `true`). Aucune écriture vers Health Connect
-- ni lecture du poids tant que ce drapeau est faux.
alter table public.user_settings
  add column health_connect_enabled boolean not null default false;
