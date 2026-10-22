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
