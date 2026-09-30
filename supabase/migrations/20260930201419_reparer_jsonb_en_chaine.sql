-- Revue du chantier « le Labo, carrefour des piliers » (30/09/2026) — réparation de données.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────────
-- Le défaut
-- ─────────────────────────────────────────────────────────────────────────────────────────────────
-- PowerSync stocke les colonnes `jsonb` en TEXT côté SQLite. Le connecteur (`connector.ts`) ne les
-- déballe avant l'upload que si elles sont déclarées dans `JSON_COLUMNS` ; sinon Postgres reçoit une
-- **chaîne JSON** et stocke un jsonb de type `string` (`"[\"test\",…]"`) au lieu d'un tableau ou d'un
-- objet. Cinq colonnes manquaient à cette table :
--   - `lab_experiments.schedule`      (depuis LABO-01, 15/09/2026)
--   - `lab_experiments.verdict`       (neuve, LABO-04 — le verdict figé)
--   - `sessions.pacing_plan`          (plan d'allure d'une séance)
--   - `user_settings.sbd_lifts`       (mouvements du total SBD)
--   - `meal_plan_entries.consumed_entry_ids`
-- La lecture survivait (`parseJsonColumn` déballe jusqu'à trois fois), donc rien ne se voyait ; mais la
-- donnée en base était fausse, et le premier `check (jsonb_typeof(...) = 'object')` ajouté un jour
-- aurait fait **rejeter** l'upload et bloqué toute la file de synchronisation (le cas vécu le
-- 01/08/2026 sur `menstrual_daily_logs.symptoms`).
--
-- Le connecteur est corrigé dans le même commit. Cette migration répare les lignes **déjà écrites**.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────────
-- Ce qu'elle fait, et ce qu'elle ne fait pas
-- ─────────────────────────────────────────────────────────────────────────────────────────────────
-- - Elle ne touche **que** les valeurs de type `string` : un tableau ou un objet est laissé tel quel.
-- - Elle déballe jusqu'à trois fois (une valeur a pu être emballée deux fois par un aller-retour).
-- - Une chaîne **illisible** est laissée telle quelle plutôt que de faire échouer la migration : la
--   lecture sait l'ignorer, et la faire échouer rejouerait tout le lot au prochain `db push`.
-- - Rejouable sans effet (idempotente) : une seconde passe ne trouve plus aucune chaîne.
-- - `updated_at` n'est pas modifié : la réplication logique de PowerSync propage l'UPDATE de toute
--   façon, et la date de dernière modification par l'utilisateur reste vraie.

do $$
declare
  target record;
  r record;
  v jsonb;
  i int;
  fixed int;
begin
  for target in
    select * from (values
      ('lab_experiments', 'schedule'),
      ('lab_experiments', 'verdict'),
      ('sessions', 'pacing_plan'),
      ('user_settings', 'sbd_lifts'),
      ('meal_plan_entries', 'consumed_entry_ids')
    ) as t(tbl, col)
  loop
    fixed := 0;
    for r in execute format(
      'select id, %I as val from public.%I where jsonb_typeof(%I) = ''string''',
      target.col, target.tbl, target.col
    )
    loop
      v := r.val;
      i := 0;
      while v is not null and jsonb_typeof(v) = 'string' and i < 3 loop
        begin
          v := (v #>> '{}')::jsonb;
        exception when others then
          -- Chaîne illisible : on s'arrête là, la valeur d'origine est conservée plus bas.
          exit;
        end;
        i := i + 1;
      end loop;
      if v is not null and jsonb_typeof(v) <> 'string' then
        execute format('update public.%I set %I = $1 where id = $2', target.tbl, target.col)
          using v, r.id;
        fixed := fixed + 1;
      end if;
    end loop;
    raise notice '%.% : % ligne(s) réparée(s)', target.tbl, target.col, fixed;
  end loop;
end $$;
