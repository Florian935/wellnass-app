-- US 9.10 — correctif : ajouter analytics_events à la publication PowerSync.
-- Oubliée dans 20260724112210 (déjà appliquée, non rejouable). Sans cette ligne,
-- le déploiement des sync rules échoue :
--   « Table "public"."analytics_events" is not part of publication 'powersync' ».
alter publication powersync add table public.analytics_events;
