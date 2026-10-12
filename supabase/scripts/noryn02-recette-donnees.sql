-- =============================================================================
-- US NORYN-02 — jeu de données de RECETTE des cibles et du verdict servis par `noryn-context`
-- =============================================================================
-- But : poser, autour d'aujourd'hui, des jours CONNUS D'AVANCE pour comparer `energy_target_kcal`,
-- `protein_target_g` et `readiness` à ce que l'app affiche (RECETTES §93, spec §13).
--
-- ⚠️ Les cibles dépendent de TON profil réel (poids, taille, âge, objectif, mode) : les réponses
-- attendues ne sont donc pas des chiffres en dur, mais **l'écran de l'app ce jour-là**.
-- ⚠️ Données de test DANS LE COMPTE RÉEL : elles apparaissent dans l'app (historique, planning, charge,
-- série, « vie réelle ») jusqu'au nettoyage. Nettoyer ensuite avec `noryn02-recette-nettoyage.sql`.
-- ⚠️ Dates RELATIVES à aujourd'hui à Paris : rejouable n'importe quel jour. Rejouer le même jour après
-- nettoyage seulement (identifiants fixes).
--
-- Où : dashboard Supabase › SQL Editor. Remplacer SEULEMENT le UUID de `v_user` (ne jamais le commiter).
-- Les écritures faites ici ne posent PAS de reçu de synchro (auth.uid() est nul) : c'est voulu. Ouvrir
-- l'app ensuite (les lignes descendent sur le téléphone) et ajouter un verre d'eau pour poser un reçu.
--
-- Ce qui est posé (J = aujourd'hui à Paris) :
--   J−4       une autre activité SEULE : rando 90 min, modérée, RPE 5 → jour d'entraînement
--             (forfait en `fixed`/`auto`) ; la ligne d'état de la page du jour, elle, ne le compte pas (D2)
--   J−2       une autre activité (vélo 60 min, modéré, RPE 6, 25 km) et une course terminée
--             (8 km en 45 min, RPE 5)
--   J+3       une séance planifiée (programme brouillon « Recette NORYN-02 ») → forfait anticipé
--   J+5 → J+6 une période « vie réelle » → objectif au maintien
--
-- Réponses attendues (`context/day?date=…`) :
--   J−4, J−2  energy_target_kcal = la cible de « Ta journée en énergie » sur la page de ce jour
--             (Nutrition › Historique) ; protein_target_g = protéines de l'onglet Nutrition un jour sans
--             bonus (même règle, D1-A)
--   J+3       mode `fixed`, forfait réglé : cible d'aujourd'hui SANS son bonus, PLUS le forfait
--             (lire « Dépense », « Objectif » et « Bonus » dans l'explication de la cible) ;
--             mode `activities` : socle + objectif seulement (pas d'anticipation)
--   J+5       la cible sans l'ajustement d'objectif (« Dépense » seule, ou la surcharge si elle existe)
--   J         readiness = le verdict de l'accueil et du hub Bien-être ; `?date=` de J−1 → readiness null
-- =============================================================================
do $$
declare
  v_user  uuid := '00000000-0000-0000-0000-000000000000';  -- ← TON UUID ICI (ne pas commiter)
  v_today date := (now() at time zone 'Europe/Paris')::date;
begin
  if not exists (select 1 from auth.users where id = v_user) then
    raise exception 'UUID inconnu : remplace v_user par ton UUID';
  end if;

  -- J−4 : une autre activité, seule ce jour-là
  insert into public.activities (id, user_id, activity_type, started_at, duration_seconds, intensity, rpe, distance_m, device_kcal) values
    ('ffffffff-0000-4000-8000-000000000001', v_user, 'hike',
     ((v_today - 4) + time '09:30') at time zone 'Europe/Paris', 5400, 'moderate', 5, null, null);

  -- J−2 : une autre activité et une course terminée
  insert into public.activities (id, user_id, activity_type, started_at, duration_seconds, intensity, rpe, distance_m, device_kcal) values
    ('ffffffff-0000-4000-8000-000000000002', v_user, 'bike',
     ((v_today - 2) + time '10:00') at time zone 'Europe/Paris', 3600, 'moderate', 6, 25000, null);
  insert into public.runs (id, user_id, status, source, started_at, finished_at, duration_seconds, distance_m, rpe) values
    ('ffffffff-0000-4000-8000-000000000003', v_user, 'completed', 'manual',
     ((v_today - 2) + time '07:00') at time zone 'Europe/Paris',
     ((v_today - 2) + time '07:45') at time zone 'Europe/Paris', 2700, 8000, 5);

  -- J+3 : une séance planifiée, dans un programme personnel brouillon (inactif)
  insert into public.programs (id, owner_id, pillar, status, is_active) values
    ('ffffffff-0000-4000-8000-000000000004', v_user, 'strength', 'draft', false);
  insert into public.program_translations (id, program_id, owner_id, lang, name) values
    ('ffffffff-0000-4000-8000-000000000005', 'ffffffff-0000-4000-8000-000000000004', v_user, 'fr', 'Recette NORYN-02');
  insert into public.sessions (id, program_id, owner_id, order_index, name, session_type, target_duration_seconds) values
    ('ffffffff-0000-4000-8000-000000000006', 'ffffffff-0000-4000-8000-000000000004', v_user, 0, 'Séance (recette NORYN-02)', null, null);
  insert into public.planned_sessions (id, owner_id, program_id, session_id, scheduled_date, scheduled_time, status) values
    ('ffffffff-0000-4000-8000-000000000007', v_user, 'ffffffff-0000-4000-8000-000000000004',
     'ffffffff-0000-4000-8000-000000000006', v_today + 3, null, 'planned');

  -- J+5 → J+6 : une période « vie réelle »
  insert into public.real_life_periods (id, user_id, started_on, ends_on) values
    ('ffffffff-0000-4000-8000-000000000008', v_user, v_today + 5, v_today + 6);

  raise notice 'Jeu NORYN-02 posé autour du %', v_today;
end $$;
