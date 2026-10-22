/**
 * US CIBLE-01 — les requêtes de la **cible du jour**, partagées par les hooks et par le widget d'écran
 * d'accueil.
 *
 * ⚠️ **Module feuille** : il n'importe rien d'autre que des types et `@wellness/shared`. Le widget est
 * enregistré avant expo-router (`index.js`) et tourne en Headless JS : importer un repository complet
 * (Health Connect, analytique, `react-i18next`…) alourdirait son démarrage à froid, et
 * `workout-repository` referme un cycle d'imports avec `refresh-home-widget`. Les repositories
 * d'origine **réexportent** sous leurs noms ce qui a déménagé ici.
 */

/**
 * Les jours d'une plage `[début, fin]` (bornes incluses) qui portent une séance planifiée `planned` ou
 * `done`, non supprimée, **sans jointure** — le filtre de `SELECT_HAS_PLANNED`
 * (`planned-session-repository.ts`), mot pour mot, sur une plage au lieu d'un jour : une requête par
 * plage, jamais une par jour (spec CIBLE-01 D6, R5). Paramètres : `[ownerId, fromKey, toKey]`.
 */
export const SELECT_PLANNED_DAYS_BETWEEN = `
  SELECT DISTINCT scheduled_date FROM planned_sessions
  WHERE owner_id = ? AND scheduled_date >= ? AND scheduled_date <= ?
    AND status IN ('planned','done') AND deleted_at IS NULL`;

/**
 * Historique des courses terminées, plus récentes d'abord (`useRunHistory`, `run-repository.ts`) — les
 * courses qui font un jour d'entraînement et la dépense des courses du mode `auto`.
 *
 * ── Les deux jointures (US CARDIO-UX01, R7 / constat F24) ────────────────────────────────────────
 * Une ligne d'historique affichait date · distance · durée · allure : impossible de distinguer
 * d'un coup d'œil un footing de récupération d'un 10 × 400. Le type de séance ne vit pas sur
 * `runs` (verrou d'ALLURE-01) mais sur `sessions`, atteignable par le lien
 * `runs.planned_session_id`. On le **joint** plutôt que de le dupliquer.
 *
 * `LEFT JOIN` des deux côtés : une course libre n'a pas de séance, et c'est le cas majoritaire.
 * Une séance supprimée depuis la course laisse aussi un lien qui ne résout à rien — la course
 * reste valide et s'affiche comme libre.
 *
 * ⚠️ **`gps_track` reste hors de cette requête**, et ce n'est pas un oubli : elle n'a aucune borne
 * de date et alimente les statistiques, la tendance d'allure et l'accueil. Y ajouter la trace
 * ferait charger en mémoire les traces GPS de **toutes** les courses, pour tous ces consommateurs
 * (note d'origine d'ALLURE-01, conservée).
 */
export const SELECT_RUN_HISTORY = `
  SELECT r.id, r.source, r.started_at, r.finished_at, r.duration_seconds, r.distance_m,
         r.avg_pace_s_per_km, r.rpe, r.notes, r.elevation_gain_m, r.elevation_loss_m,
         r.terrain, r.planned_session_id, s.id AS session_id, s.session_type
  FROM runs r
  LEFT JOIN planned_sessions ps
         ON ps.id = r.planned_session_id AND ps.deleted_at IS NULL
  LEFT JOIN sessions s
         ON s.id = ps.session_id AND s.deleted_at IS NULL
  WHERE r.status = 'completed' AND r.deleted_at IS NULL
  ORDER BY r.finished_at DESC
`;
