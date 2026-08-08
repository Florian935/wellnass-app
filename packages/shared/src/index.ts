/**
 * @wellness/shared — types et schémas Zod partagés entre le mobile, le
 * back-office et le back. Point d'entrée unique du package.
 */
export * from './sync';
export * from './pillar';
export * from './json-column';
export * from './search';
export * from './units';
export * from './age';
export * from './chart-tooltip';
export * from './password';
export * from './profile';
export * from './settings';
export * from './activation-path';
export * from './health-connect';
export * from './steps';
export * from './wellbeing';
export * from './editorial-usage';
export * from './measurements';
export * from './macro-suggestion';
export * from './streak-joker';
export * from './goals';
export * from './weekly-review';
export * from './share-card';
export * from './intensity';
export * from './exercise-substitution';
export * from './notifications';
export * from './learned-hour';
export * from './record-notification';
export * from './widgets';
export * from './exercise';
export * from './exercise-filter';
export * from './exercise-variant';
export * from './workout';
export * from './workout-display';
export * from './program';
export * from './nutrition';
export * from './meal-plan';
export * from './shopping-list';
export * from './strength-intensity';
export * from './strength-dots';
export * from './strength-sbd';
export * from './protein-target';
export * from './carb-target';
export * from './records';
export * from './food';
export * from './micronutrient-reference';
export * from './food-csv';
export * from './food-form';
export * from './meal-parser';
export * from './recipe';
export * from './bodyweight';
export * from './weight-goal';
export * from './muscle-balance';
export * from './running';
export * from './run-target';
export * from './gpx';
export * from './running-paces';
export * from './running-intervals';
export * from './pace-records';
export * from './geo';
export * from './date';
export * from './drop-target';
export * from './menstrual-cycle';
export * from './planning';
export * from './run-stats';
export * from './comparison';
export * from './contrast';
export * from './root-route';
export * from './streak';
export * from './training-day';
export * from './audit';
export * from './training-nutrition';
export * from './training-time';
export * from './readiness';
export * from './regression';
export * from './moving-average';
export * from './data-export';
// US INSIGHTS-01 (roadmap 7.20) — moteur de sélection Tier 3 (ADR-007) et ses adaptateurs.
export * from './insights';
export * from './insight-adapters';
// US COLLIS-01 (roadmap 3.57) — détecteur de collisions entre séances planifiées.
export * from './session-conflicts';
// US EXEC-01 (roadmap 3.58) — lot « prévu vs réalisé » : les 4 moteurs d'analyse d'exécution.
export * from './execution-compliance';
export * from './session-duration';
export * from './set-type-mix';
export * from './neglected-exercises';

// US ALLURE-01 (roadmap 5.35) — lot « courbe d'allure » : zones, split, fade, polarisation.
export * from './shares';
export * from './pace-zones';
export * from './split-balance';
export * from './pace-fade';
export * from './pace-zone-mix';

// US APPORT-01 (roadmap 4.40) — lot croise muscu x nutrition.
export * from './training-nutrition-cross';
// US VIE-01 (roadmap 1.28) — mode « vie réelle », dégradation gracieuse des objectifs.
export * from './real-life';
// US DOUL-01 (roadmap 1.29) — journal des zones douloureuses.
export * from './pain-zones';
export type { Database, Json } from './database.types';
