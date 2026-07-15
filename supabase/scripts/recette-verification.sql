-- =============================================================================
-- Vérification du jeu de données de RECETTE (contrôles SELECT)
-- =============================================================================
-- À lancer APRÈS recette-dataset.sql, dans le SQL Editor de Supabase, le MÊME
-- jour que l'injection (les fenêtres « 7 j / 14 j / 30 j » sont relatives à
-- current_date). Lecture seule : n'écrit rien.
--
--   👉 Renseigne le même EMAIL que dans le script d'injection.
--
-- Le résultat est UNE grille : bloc · contrôle · attendu · obtenu · statut.
--   ✅ = conforme  ·  ⚠️ = à confronter à l'écran (dépend du découpage
--   calendaire de l'app, non déterministe côté SQL).
-- =============================================================================

with
me as (
  select id as uid
  from auth.users
  where lower(email) = lower('REMPLACE-MOI@exemple.fr')
),
obj as (  -- objectif calorique de base (profil nutrition)
  select np.manual_calories as kcal_obj
  from public.nutrition_profiles np join me on np.user_id = me.uid
),
-- ---- Nutrition : kcal par jour ----
food_days as (
  select fe.log_date, sum(fe.kcal) as kcal
  from public.food_entries fe join me on fe.user_id = me.uid
  where fe.deleted_at is null
  group by fe.log_date
),
nut as (
  select
    round(avg(kcal) filter (where log_date >  current_date - 7), 0)                                as avg7,
    round(avg(kcal) filter (where log_date <= current_date - 7  and log_date > current_date - 14), 0) as prev7,
    round(avg(kcal) filter (where log_date >  current_date - 30), 0)                               as avg30,
    round(avg(kcal) filter (where log_date <= current_date - 30 and log_date > current_date - 60), 0) as prev30,
    count(distinct log_date) filter (where log_date > current_date - 7)                            as jours7
  from food_days
),
-- ---- Muscu : tonnage par jour ----
work_days as (
  select date(w.finished_at) as d,
         sum(coalesce(ws.reps,0) * coalesce(ws.weight_kg,0)) as tonnage
  from public.workout_sets ws
  join public.workouts w on w.id = ws.workout_id
  join me on ws.user_id = me.uid
  where ws.deleted_at is null and w.deleted_at is null and w.status = 'completed'
  group by date(w.finished_at)
),
vol as (
  select
    coalesce(sum(tonnage) filter (where d >  current_date - 7), 0)                                as v7,
    coalesce(sum(tonnage) filter (where d <= current_date - 7 and d > current_date - 14), 0)      as vprev7
  from work_days
),
-- ---- Muscu : séries par groupe sur 14 j ----
grp as (
  select e.muscle_primary as g, count(*) as series
  from public.workout_sets ws
  join public.workouts w on w.id = ws.workout_id
  join public.exercises e on e.id = ws.exercise_id
  join me on ws.user_id = me.uid
  where ws.deleted_at is null and w.deleted_at is null
    and date(w.finished_at) > current_date - 14
  group by e.muscle_primary
),
-- ---- Muscu : 1RM estimé (Développé couché, charge > 0) ----
onerm as (
  select
    count(distinct w.id) filter (where ws.weight_kg > 0)                                          as dc_sessions,
    round(max(ws.weight_kg * (1 + ws.reps / 30.0)) filter (where ws.weight_kg > 0), 1)            as best_1rm
  from public.workout_sets ws
  join public.workouts w on w.id = ws.workout_id
  join me on ws.user_id = me.uid
  where ws.exercise_id = 'a1000001-0000-4000-8000-000000000001'  -- Développé couché
    and ws.deleted_at is null and w.deleted_at is null
),
bodyweight as (  -- tractions charge 0 (doivent être exclues de la courbe 1RM)
  select count(*) as sets0
  from public.workout_sets ws join me on ws.user_id = me.uid
  where ws.exercise_id = 'a1000004-0000-4000-8000-000000000004'
    and ws.deleted_at is null and coalesce(ws.weight_kg,0) = 0
),
-- ---- Course : par jour ----
run_days as (
  select date(finished_at) as d, count(*) as n, sum(distance_m) as dist
  from public.runs rn join me on rn.user_id = me.uid
  where rn.deleted_at is null and rn.status = 'completed'
  group by date(finished_at)
),
runs as (
  select
    coalesce(sum(n)    filter (where d = current_date), 0)                                         as n_today,
    coalesce(sum(dist) filter (where d = current_date), 0)                                         as dist_today,
    coalesce(sum(n)    filter (where d >  current_date - 7), 0)                                     as n7,
    coalesce(sum(dist) filter (where d >  current_date - 7), 0)                                     as dist7,
    coalesce(sum(n)    filter (where d <= current_date - 7 and d > current_date - 14), 0)          as nprev7,
    coalesce(sum(n)    filter (where d >  current_date - 30), 0)                                     as n30,
    coalesce(sum(n)    filter (where d <= current_date - 30 and d > current_date - 60), 0)         as nprev30
  from run_days
),
-- ---- Compteurs bruts ----
cnt as (
  select
    (select count(*) from public.workouts        w  join me on w.user_id  = me.uid where w.deleted_at  is null) as n_work,
    (select count(*) from public.workout_sets     ws join me on ws.user_id = me.uid where ws.deleted_at is null) as n_sets,
    (select count(*) from public.runs             rn join me on rn.user_id = me.uid where rn.deleted_at is null) as n_runs,
    (select count(*) from public.food_entries     fe join me on fe.user_id = me.uid where fe.deleted_at is null) as n_food,
    (select count(*) from public.body_weight_entries b join me on b.user_id = me.uid where b.deleted_at is null) as n_bw,
    (select round(weight_kg,1) from public.body_weight_entries b join me on b.user_id = me.uid where b.log_date = current_date) as poids_jour,
    (select count(*) from public.running_pace_records p join me on p.user_id = me.uid where p.deleted_at is null) as n_pace,
    (select training_bonus_mode from public.nutrition_profiles np join me on np.user_id = me.uid) as mode_nut,
    (select active_pillars::text from public.user_settings s join me on s.user_id = me.uid) as piliers
)
-- =============================== GRILLE ===============================
select * from (
  -- Compteurs
  select 1 as ord, 'Compteurs' as bloc, 'Séances muscu'          as controle, '16'           as attendu, n_work::text  as obtenu, case when n_work  = 16    then '✅' else '⚠️' end as statut from cnt
  union all select 2, 'Compteurs', 'Séries muscu',                '≈ 55',        n_sets::text,  case when n_sets  between 53 and 57 then '✅' else '⚠️' end from cnt
  union all select 3, 'Compteurs', 'Courses',                     '11',          n_runs::text,  case when n_runs  = 11    then '✅' else '⚠️' end from cnt
  union all select 4, 'Compteurs', 'Lignes nutrition',            '180',         n_food::text,  case when n_food  = 180   then '✅' else '⚠️' end from cnt
  union all select 5, 'Compteurs', 'Pesées',                      '9',           n_bw::text,    case when n_bw    = 9     then '✅' else '⚠️' end from cnt
  union all select 6, 'Compteurs', 'Records d''allure (5k/10k)',  '2',           n_pace::text,  case when n_pace  = 2     then '✅' else '⚠️' end from cnt
  union all select 7, 'Config',    'Mode bonus nutrition',        'auto',        mode_nut,      case when mode_nut = 'auto' then '✅' else '⚠️' end from cnt
  union all select 8, 'Config',    'Piliers actifs',              '3 piliers',   piliers,       case when piliers like '%strength%' and piliers like '%running%' and piliers like '%nutrition%' then '✅' else '⚠️' end from cnt

  -- 4.32 — alerte déficit + volume
  union all select 20, '4.32', 'Objectif kcal (profil)',          '2500',        (select kcal_obj::text from obj), case when (select kcal_obj from obj)=2500 then '✅' else '⚠️' end from cnt
  union all select 21, '4.32', 'Moyenne kcal 7 derniers jours',   '≈ 2000',      (select avg7::text from nut),     case when (select avg7 from nut) between 1950 and 2050 then '✅' else '⚠️' end from cnt
  union all select 22, '4.32', 'Déficit moyen 7 j vs objectif',   '≥ 15 %',      (select round((o.kcal_obj-n.avg7)/o.kcal_obj*100,0)::text||' %' from nut n, obj o), case when (select (o.kcal_obj-n.avg7)/o.kcal_obj from nut n, obj o) >= 0.15 then '✅' else '⚠️' end from cnt
  union all select 23, '4.32', 'Jours nutrition loggés (7 j)',    '≥ 4',         (select jours7::text from nut),   case when (select jours7 from nut) >= 4 then '✅' else '⚠️' end from cnt
  union all select 24, '4.32', 'Volume muscu 7 j (tonnage)',      '≥ 8000',      (select v7::text from vol),       case when (select v7 from vol) >= 8000 then '✅' else '⚠️' end from cnt

  -- META-06 — deltas période N vs N-1
  union all select 30, 'META-06', 'Nutrition kcal 7 j / 7 j préc.',   'baisse (2000 < 2250)',  (select avg7||' vs '||prev7 from nut), case when (select avg7<prev7 from nut) then '✅' else '⚠️' end from cnt
  union all select 31, 'META-06', 'Nutrition kcal 30 j / 30 j préc.', 'baisse (< 2500)',       (select avg30||' vs '||prev30 from nut), case when (select avg30<prev30 from nut) then '✅' else '⚠️' end from cnt
  union all select 32, 'META-06', 'Volume muscu 7 j / 7 j préc.',     'hausse (12125 vs 9850)', (select v7||' vs '||vprev7 from vol), case when (select v7>vprev7 from vol) then '✅' else '⚠️' end from cnt
  union all select 33, 'META-06', 'Course : nb 7 j / 7 j préc.',      'hausse (4 vs 2)',       (select n7||' vs '||nprev7 from runs), case when (select n7>nprev7 from runs) then '✅' else '⚠️' end from cnt
  union all select 34, 'META-06', 'Course : nb 30 j / 30 j préc.',    'hausse (8 vs 3)',       (select n30||' vs '||nprev30 from runs), case when (select n30>nprev30 from runs) then '✅' else '⚠️' end from cnt

  -- MUSC-04 — courbe 1RM
  union all select 40, 'MUSC-04', 'Séances DC avec charge (courbe 1RM)', '10',      (select dc_sessions::text from onerm), case when (select dc_sessions from onerm)=10 then '✅' else '⚠️' end from cnt
  union all select 41, 'MUSC-04', 'Meilleur 1RM estimé (DC)',            '≈ 90,7',  (select best_1rm::text from onerm),    case when (select best_1rm from onerm) between 89 and 92 then '✅' else '⚠️' end from cnt
  union all select 42, 'MUSC-04', 'Séries tractions charge 0 (exclues)', '3',       (select sets0::text from bodyweight),  case when (select sets0 from bodyweight)=3 then '✅' else '⚠️' end from cnt

  -- MUSC-05 — équilibre 14 j (séries par groupe)
  union all select 50, 'MUSC-05', 'Total séries 14 j',       '≥ 12 (≈ 45)', (select coalesce(sum(series),0)::text from grp), case when (select coalesce(sum(series),0) from grp) >= 12 then '✅' else '⚠️' end from cnt
  union all select 51, 'MUSC-05', 'Jambes (fourni)',         'élevé',       (select coalesce((select series from grp where g='legs'),0)::text),      '—' from cnt
  union all select 52, 'MUSC-05', 'Dos (fourni)',            'élevé',       (select coalesce((select series from grp where g='back'),0)::text),      '—' from cnt
  union all select 53, 'MUSC-05', 'Pectoraux (fourni)',      'moyen',       (select coalesce((select series from grp where g='chest'),0)::text),     '—' from cnt
  union all select 54, 'MUSC-05', 'Épaules (délaissé)',      'faible (≈1)', (select coalesce((select series from grp where g='shoulders'),0)::text), case when coalesce((select series from grp where g='shoulders'),0) <= 3 then '✅' else '⚠️' end from cnt
  union all select 55, 'MUSC-05', 'Bras (délaissé)',         'faible (≈1)', (select coalesce((select series from grp where g='arms'),0)::text),      case when coalesce((select series from grp where g='arms'),0) <= 3 then '✅' else '⚠️' end from cnt
  union all select 56, 'MUSC-05', 'Core (délaissé)',         'faible (≈1)', (select coalesce((select series from grp where g='core'),0)::text),      case when coalesce((select series from grp where g='core'),0) <= 3 then '✅' else '⚠️' end from cnt

  -- RN-01/02 — dépense course → objectif du jour
  union all select 60, 'RN-01/02', 'Courses aujourd''hui',        '2',       (select n_today::text from runs),    case when (select n_today from runs)=2 then '✅' else '⚠️' end from cnt
  union all select 61, 'RN-01/02', 'Distance cumulée aujourd''hui','8000 m', (select dist_today::text from runs), case when (select dist_today from runs)=8000 then '✅' else '⚠️' end from cnt
  union all select 62, 'RN-01/02', 'Pesée du jour (pour formule)', '75,0 kg',(select poids_jour::text from cnt),  case when (select poids_jour from cnt)=75.0 then '✅' else '⚠️' end from cnt
) g
order by ord;
