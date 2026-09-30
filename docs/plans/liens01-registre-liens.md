# Plan d'implémentation — LIENS-01 « Le registre des liens »

Spec : [liens01-registre-liens.md](../specs/functional/us/liens01-registre-liens.md) · Branche :
**`feature/labo-carrefour`** · Roadmap 7.37.

> **Une seule vague** pour les cinq US du chantier (LIENS-01, LABO-02, LABO-03, ECHO-01, LABO-04), sur
> demande explicite de Florian le 30/09/2026 (« GO tu fais TOUT d'une seule vague d'implémentation »),
> après la toile [design/labo-carrefour-2026-09/](../../design/labo-carrefour-2026-09/) et ses décisions
> Q1 à Q8. Le plan est écrit **avec** le code et sert d'ordre de relecture.

## 1. Ordre de construction (tout le chantier)

| # | Étape | US | Pourquoi dans cet ordre |
|---|---|---|---|
| 1 | Registre pur `cross-links.ts` + tests | LIENS-01 | Il ne dépend que des moteurs existants ; tout le reste le lit. |
| 2 | Retouches `lab-week.ts` (collision du jour, `adapted`, seuil unique) | LIENS-01 | Un seul remède par situation, avant que les écrans ne l'affichent. |
| 3 | Migration `cross_link_weeks` + `lab_experiments.verdict`, push, types | LIENS-01 / LABO-04 | La couche data ne peut pas précéder le schéma. |
| 4 | Schéma PowerSync, sync rule, export RGPD | LIENS-01 | Sans la table locale, chaque requête échouerait en silence. |
| 5 | `useLabCore` + `cross-links-repository.tsx` (`CrossLinksProvider`) | LIENS-01 / LABO-02 | Un seul calcul pour toute l'app. |
| 6 | Mise en mots (`link-format.ts`, `link-routes.ts`) | LIENS-01 | La même phrase partout. |
| 7 | Scène : vue du dessus, médailles, sélection | LABO-02 | Isolée derrière `scene-state.ts`. |
| 8 | Écran du Labo (Croiser / Composer / Apprendre) | LABO-02 / LABO-04 | |
| 9 | Fiche `lab-link.tsx` + `CrossLinkChart` | LABO-03 | |
| 10 | Échos, widget, Insights, Stats nutrition, planning, cycle, retraits | ECHO-01 | En dernier : ils lisent tout le reste. |
| 11 | i18n FR+EN, tests d'écrans, docs | tous | |

## 2. Fichiers de LIENS-01

| Fichier | Contenu |
|---|---|
| `packages/shared/src/cross-links.ts` | `CROSS_LINK_IDS` (9), `CROSS_LINK_STATES` + rang, `CROSS_LINKS` (présence, zone, échos, analyses), seuils, types (`CrossLink`, `CrossLinkText`, `CrossLinkRow`, `CrossLinkAction`, `CrossLinkChart`, `CrossLinksInput`, `CrossLinkSeries`), un constructeur par lien, `buildCrossLinks`, `summarizeCrossLinks`, `zoneState`, `echoFor`, `pressingLink`, histoire figée (`crossLinkWeekKey`, `crossLinkHistory`, `crossLinkWeekWrites`, `stableUuid`), séries (`crossLinkWindows`, `buildCrossLinkSeries`), `SUSPECT_LINK`, `learningAssociations`. |
| `packages/shared/src/cross-links.test.ts` | voir §3. |
| `packages/shared/src/lab-week.ts` (+ test) | `LAB_MIN_PROTEIN_DAYS = MIN_LOGGED_DAYS` ; `LabSessionInput.adapted` ; collision du jour → `runningToday` ; séance adaptée non ré-allégée ; glucides → `nutritionToday`. |
| `packages/shared/src/index.ts` | exports. |
| `supabase/migrations/20260930135304_labo_carrefour_liens.sql` | table + colonne, RLS, publication. |
| `packages/shared/src/database.types.ts` | régénéré (`npm run db:types`). |
| `apps/mobile/src/powersync/schema.ts` | `cross_link_weeks`, `lab_experiments.verdict`. |
| `docs/specs/technical/powersync-sync-rules.yaml` | ligne `cross_link_weeks` — **à déployer à la main**. |
| `apps/mobile/src/lib/data-export.ts` | `cross_link_weeks` dans l'export RGPD. |
| `apps/mobile/src/data/repositories/planned-session-repository.ts` | `adapted` lu des colonnes d'adaptation. |
| `apps/mobile/src/data/repositories/lab-repository.ts` | `LabWeekSignals`, `useLabHistory` exporté, `useLabCore`. |
| `apps/mobile/src/data/repositories/cross-links-repository.tsx` | lecture/écriture de l'histoire, calcul, écritures de fond, `CrossLinksProvider`, `useCrossLinks`, `useCrossLinkEcho`, `usePressingLink`. |
| `apps/mobile/src/components/lab/link-format.ts`, `link-routes.ts` | mise en mots, routes des gestes. |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | `lab.links.*`. |

## 3. Tests

- **Vitest** `cross-links.test.ts` : registre, décision H, états (semaine chargée, garde-fou de charge,
  déficit muet en vie réelle, niveau d'activité, Conseil, plateau → journal), à découvrir, graphiques,
  zones / échos / accueil, histoire et écritures, `stableUuid`, séries, `SUSPECT_LINK`.
- **Vitest** `lab-week.test.ts` : collision du jour, séance adaptée, glucides.
- **Jest** `link-texts-coverage.test.ts` : 🔴 le registre tourne sur ~40 situations qui couvrent chaque
  état de chaque lien ; **chaque clé** demandée par la carte, la fiche, les gestes et les feuilles doit
  exister en FR et en EN (une clé absente s'afficherait telle quelle, sans planter).
- **Jest** `lab-sql.test.tsx` : `useLabCore` (chargement, fenêtre de 56 jours, verdict figé).

## 4. Vérification

`npm run typecheck`, `npm run lint`, `npm run test` à 0 ; migration poussée (`db:push:dry` puis
`db:push`), types régénérés, registre des migrations coché. **Reste manuel** : déployer la sync rule
de `cross_link_weeks` dans le dashboard PowerSync (RECETTES §89, prérequis).

## 5. Revue de code (30/09/2026) — ce qu'elle a ajouté au plan

Détail et justification au §8 de la [spec](../specs/functional/us/liens01-registre-liens.md).

| Correction | Fichiers | Test qui la fige |
|---|---|---|
| 5 colonnes jsonb déclarées au connecteur + migration de réparation `20260930201419` | `powersync/connector.ts`, `supabase/migrations/` | `connector-json-columns.test.ts` |
| Gardes d'écriture (`hasSynced`, `writeReady`), écriture par front, ligne existante mise à jour quel que soit son id | `cross-links-repository.tsx`, `cross-links.ts` (`crossLinkWeekWrites(…, previous)`) | `cross-links-writes.test.tsx` (11), `cross-links.test.ts` |
| Propositions entières pour le registre (`LabWeek.allProposals`) | `lab-week.ts`, `cross-links.ts` | `cross-links.test.ts` |
| Forme du jour « repos », DOTS sans écart inventé (`dotsEightWeekDelta`), trous ≠ « ça tient », échos réels | `cross-links.ts`, `cross-links-repository.tsx`, i18n | `cross-links.test.ts`, `link-texts-coverage.test.ts` |
| Décision H sur les objectifs | `cross-links-repository.tsx`, `GoalConflictBanner.tsx` | — (lecture ; recette §89) |
| « Prêt » / « Dans ton plan » par proposition ; échecs du Conseil visibles | `lab.tsx`, `lab-link.tsx`, `LabCrossPanel.tsx`, `GoalConflictBanner.tsx` | `lab-screen.test.tsx` |
| Fiche cycle : ce qui manque, unités ; signes d'état ; histoire du cycle effacée avec le cycle | `lab-link.tsx`, `CrossLinkChart.tsx`, `link-format.ts`, `menstrual-cycle-repository.ts` | `lab-link-screen.test.tsx`, `cross-link-chart.test.tsx`, `menstrual-cycle-sql.test.ts` |
| 28 clés i18n orphelines retirées par langue | `fr.json`, `en.json` | `locale-parity.test.ts` |
