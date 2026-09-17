-- =================================================================================================
-- US IA-LAB-01 — VÉRIFICATION du jeu de données factices
-- =================================================================================================
--
-- À jouer dans le SQL Editor **après** `ia-purge-et-dataset.sql`.
--
-- ── Pourquoi cette requête existe ────────────────────────────────────────────────────────────────
-- Le SQL Editor de Supabase n'affiche que des **lignes** : les `raise notice` du script de
-- génération (ses comptages, la liste des signaux) ne s'y voient jamais. Sans cette requête, on
-- lance le script, on lit « Success. No rows returned », et on ne sait pas ce qui a été écrit.
--
-- Surtout : elle vérifie que **les six signaux plantés sont réellement dans les données**. Juger
-- une réponse d'IA contre un signal qu'on n'a pas confirmé, c'est tester deux choses à la fois et
-- n'en conclure aucune. On confirme d'abord la vérité de référence, on interroge le modèle ensuite.
--
-- ── 🔴 Les fenêtres : 28 derniers jours contre les 28 PRÉCÉDENTS ─────────────────────────────────
-- Et non « les 28 derniers jours contre tout le reste », comme dans la première version de cette
-- requête (16/09/2026). Comparer une période récente à l'historique entier **dilue le signal dans
-- la période saine qu'il contient** : l'allure sortait à 332 s/km des deux côtés, et S5 paraissait
-- absent alors qu'il était bien là. Ce sont exactement les deux fenêtres que le contexte envoyé au
-- modèle utilise (`AI_TREND_WINDOW_DAYS`) — vérifier autrement que ce que le modèle voit ne
-- prouverait rien sur ce qu'il peut trouver.
-- =================================================================================================

with moi as (
  select id from auth.users where lower(trim(email)) = lower(trim('florian.martin63000@gmail.com'))
),
-- Charge max par groupe musculaire, sur chacune des deux fenêtres, en un seul parcours.
charges as (
  select e.muscle_primary as muscle,
         max(case when w.finished_at >= now() - interval '28 days' then s.weight_kg end) as recent,
         max(case when w.finished_at >= now() - interval '56 days'
                   and w.finished_at <  now() - interval '28 days' then s.weight_kg end) as precedent
    from public.workout_sets s
    join public.workouts  w on w.id = s.workout_id and w.deleted_at is null and w.status = 'completed'
    join public.exercises e on e.id = s.exercise_id
    join moi on moi.id = s.user_id
   where s.deleted_at is null and s.done and s.set_type <> 'warmup'
   group by e.muscle_primary
),
-- Totaux par jour : une moyenne calorique se calcule par JOUR journalisé, pas par ligne d'aliment.
jours as (
  select f.log_date, sum(f.kcal) as kcal, sum(f.protein_g) as prot
    from public.food_entries f join moi on moi.id = f.user_id
   where f.deleted_at is null
   group by f.log_date
),
-- Allure PONDÉRÉE par la distance : la moyenne des allures donnerait autant de poids à un 5 km
-- qu'à un 20 km.
allures as (
  select round(sum(case when finished_at >= now() - interval '28 days' then duration_seconds end)
             / nullif(sum(case when finished_at >= now() - interval '28 days' then distance_m end) / 1000.0, 0)) as recent,
         round(sum(case when finished_at >= now() - interval '56 days'
                         and finished_at <  now() - interval '28 days' then duration_seconds end)
             / nullif(sum(case when finished_at >= now() - interval '56 days'
                                and finished_at <  now() - interval '28 days' then distance_m end) / 1000.0, 0)) as precedent
    from public.runs r join moi on moi.id = r.user_id
   where r.deleted_at is null and r.status = 'completed'
)

select 1 as ord, 'Volumétrie' as bloc, 'séances de muscu' as mesure,
       (select count(*)::text from public.workouts, moi where user_id = moi.id) as valeur,
       '~68' as attendu
union all
select 2, 'Volumétrie', 'séries',
       (select count(*)::text from public.workout_sets, moi where user_id = moi.id), '~690'
union all
select 3, 'Volumétrie', 'sorties de course',
       (select count(*)::text from public.runs, moi where user_id = moi.id), '~52'
union all
select 4, 'Volumétrie', 'lignes de journal alimentaire',
       (select count(*)::text from public.food_entries, moi where user_id = moi.id), '~456'
union all
select 5, 'Volumétrie', 'pesées',
       (select count(*)::text from public.body_weight_entries, moi where user_id = moi.id), '18'
union all
select 6, 'Volumétrie', 'check-ins bien-être',
       (select count(*)::text from public.daily_wellbeing, moi where user_id = moi.id), '~69'

-- ── S1 — le développé couché stagne pendant que le squat monte ──────────────────────────────────
union all
select 10, 'S1 stagnation', 'charge max PECTORAUX : 28 j / 28 précédents',
       coalesce((select recent::text || ' kg  contre  ' || precedent::text || ' kg' from charges where muscle = 'chest'), '—'),
       '82,5 contre 82,5 — IDENTIQUE = la stagnation'
union all
select 11, 'S1 stagnation', 'charge max JAMBES : 28 j / 28 précédents',
       coalesce((select recent::text || ' kg  contre  ' || precedent::text || ' kg' from charges where muscle = 'legs'), '—'),
       'le récent doit être SUPÉRIEUR — la progression continue'

-- ── S2 — la chute calorique et protéique ────────────────────────────────────────────────────────
union all
select 20, 'S2 sous-alimentation', 'kcal/jour : 28 j / 28 précédents',
       coalesce((select round(avg(case when log_date >= current_date - 28 then kcal end))::text || '  contre  '
                     || round(avg(case when log_date >= current_date - 56
                                        and log_date <  current_date - 28 then kcal end))::text
                   from jours), '—'),
       '~2150 contre ~2700 — la CHUTE (−20 %)'
union all
select 21, 'S2 sous-alimentation', 'protéines/jour : 28 j / 28 précédents',
       coalesce((select round(avg(case when log_date >= current_date - 28 then prot end))::text || ' g  contre  '
                     || round(avg(case when log_date >= current_date - 56
                                        and log_date <  current_date - 28 then prot end))::text || ' g'
                   from jours), '—'),
       '~115 g contre ~165 g'

-- ── S3 — la fatigue ─────────────────────────────────────────────────────────────────────────────
union all
select 30, 'S3 fatigue', 'énergie /5 : 28 j / 28 précédents',
       coalesce((select round(avg(case when log_date >= current_date - 28 then energy end), 1)::text || '  contre  '
                     || round(avg(case when log_date >= current_date - 56
                                        and log_date <  current_date - 28 then energy end), 1)::text
                   from public.daily_wellbeing w join moi on moi.id = w.user_id where w.deleted_at is null), '—'),
       '~2,5 contre ~3,5 — EN BAISSE'
union all
select 31, 'S3 fatigue', 'stress /5 : 28 j / 28 précédents',
       coalesce((select round(avg(case when log_date >= current_date - 28 then stress end), 1)::text || '  contre  '
                     || round(avg(case when log_date >= current_date - 56
                                        and log_date <  current_date - 28 then stress end), 1)::text
                   from public.daily_wellbeing w join moi on moi.id = w.user_id where w.deleted_at is null), '—'),
       '~3,5 contre ~2,5 — EN HAUSSE'
union all
select 32, 'S3 fatigue', 'sommeil min/nuit : 28 j / 28 précédents (si LABO-01 poussée)',
       coalesce((select round(avg(case when log_date >= current_date - 28 then sleep_minutes end))::text || '  contre  '
                     || round(avg(case when log_date >= current_date - 56
                                        and log_date <  current_date - 28 then sleep_minutes end))::text
                   from public.daily_wellbeing w join moi on moi.id = w.user_id where w.deleted_at is null),
                'colonne absente — migration LABO-01 non poussée'),
       '~360 contre ~450'

-- ── S4 — l'angle mort ───────────────────────────────────────────────────────────────────────────
union all
select 40, 'S4 angle mort', 'groupes musculaires travaillés en 120 j',
       coalesce((select string_agg(muscle, ', ' order by muscle) from charges), '—'),
       'back, chest, legs UNIQUEMENT — ni shoulders, ni arms, ni core'

-- ── S5 — l'allure qui se dégrade ────────────────────────────────────────────────────────────────
union all
select 50, 'S5 allure', 'allure s/km : 28 j / 28 précédents',
       coalesce((select recent::text || '  contre  ' || precedent::text from allures), '—'),
       'le récent doit être ~30 s PLUS ÉLEVÉ = plus lent'

-- ── S6 — le plateau de poids ────────────────────────────────────────────────────────────────────
union all
select 60, 'S6 plateau', 'poids kg : 28 j / 28 précédents',
       coalesce((select round(avg(case when log_date >= current_date - 28 then weight_kg end), 1)::text || '  contre  '
                     || round(avg(case when log_date >= current_date - 56
                                        and log_date <  current_date - 28 then weight_kg end), 1)::text
                   from public.body_weight_entries b join moi on moi.id = b.user_id where b.deleted_at is null), '—'),
       'QUASI IDENTIQUES = le plateau'
union all
select 61, 'S6 plateau', 'poids : première → dernière pesée (la perte globale)',
       coalesce((select (select weight_kg::text from public.body_weight_entries b2 join moi m2 on m2.id = b2.user_id
                          where b2.deleted_at is null order by log_date asc limit 1) || ' → '
                     || (select weight_kg::text from public.body_weight_entries b3 join moi m3 on m3.id = b3.user_id
                          where b3.deleted_at is null order by log_date desc limit 1)), '—'),
       '~82 → ~78 — la perte A EU LIEU, mais elle s''est arrêtée (ligne 60)'

-- ── 🔴 Cohérence : la base est-elle bien celle d'IA-LAB-01, et elle seule ? ─────────────────────
-- `labo-dataset.sql` (US LABO-01) efface les séances et les courses mais PAS les pas ni les
-- activités. Enchaîner les deux scripts laisse une base chimère — une semaine de séances et 90 jours
-- de pas — sur laquelle toute analyse est fausse sans qu'aucun chiffre ne soit faux. Comparer les
-- deux étendues le révèle en une ligne.
union all
select 65, 'Cohérence', 'étendue muscu / étendue pas (en jours)',
       coalesce((select (select (current_date - min(w.finished_at)::date)::text
                           from public.workouts w join moi m on m.id = w.user_id
                          where w.deleted_at is null) || ' j  /  '
                     || (select (current_date - min(d.log_date))::text
                           from public.daily_steps d join moi m2 on m2.id = d.user_id
                          where d.deleted_at is null) || ' j'), '—'),
       'les DEUX doivent valoir ~120 j. Un écart = labo-dataset.sql joué par-dessus → rejouer ia-purge-et-dataset.sql'

-- ── Le consentement, volontairement éteint ──────────────────────────────────────────────────────
union all
select 70, 'Consentement', 'ai_consent_at (doit être vide)',
       coalesce((select ai_consent_at::text from public.user_settings s join moi on moi.id = s.user_id
                  where s.deleted_at is null limit 1), 'NULL — correct, à activer dans l''app'),
       'NULL'

order by ord;
