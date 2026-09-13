# Plan d'implémentation — DASH-01

> Spec : [dash01-dashboards-immersifs.md](../specs/functional/us/dash01-dashboards-immersifs.md) ·
> Branche : `feature/dash01-dashboards-immersifs` (worktree `.claude/worktrees/dash-immersifs`) ·
> Maquettes : [design/dash-immersifs-2026-09/](../../design/dash-immersifs-2026-09/)

## Principe d'ordonnancement

**Le calcul d'abord, l'écran ensuite.** Tout ce qui décide (moment de l'accueil, écarts depuis la
dernière visite, cartes du bilan, records à portée, projection « Et si », explications, brief,
confiance) est une fonction pure de `@wellness/shared`, écrite en TDD (Vitest). Les écrans ne font que
rendre le résultat. C'est la règle R5 appliquée au code : un chiffre qui ne sort pas d'une fonction
testée n'a pas le droit d'être affiché.

```
Lot 0 shared (pur, Vitest) ─┐
Lot 1 socle mobile ─────────┼─→ Lot 2 hubs : nutrition → course → accueil → muscu (D4)
                            └─→ Lot 3 sans IA : pourquoi · brief · et si
Lot 4 IA : migration → edge function → client → photo → demande-moi
Lot 5 i18n · tests · RECETTES · roadmap · CHANGELOG · ETAT
```

Chaque lot finit sur `npm run typecheck`, `npm run lint`, `npm run test` verts, **codes de sortie lus
sans pipe**.

**Règle de test (héritée de MOTION-01).** Les composants animés sont testés sur leur **contrat** :
valeur finale rendue, état final immédiat quand le mouvement est coupé, contenu identique dans les deux
cas (R1). On ne teste pas de trajectoire d'animation.

---

## Lot 0 — Fonctions pures (`packages/shared/src`)

| Fichier | Contenu | Tests |
|---|---|---|
| `dashboard-moment.ts` | `resolveHomeMoment`, `hoursLeftToday` | bornes 11 h / 18 h / heure de rappel, retour ≥ 7 j, série 0, historique vide |
| `since-last-visit.ts` | `computeSinceLastVisit(prev, now)` | premier lancement, écarts nuls filtrés, signes |
| `weekly-story.ts` | `buildWeeklyStory(review)` | semaine vide, cartes omises sans donnée, ordre stable |
| `near-record.ts` | `nearRecords(entries)` | écart en kg et en répétitions, tri, aucun record |
| `what-if.ts` | `projectWhatIf`, `whatIfConsequences` | pente nulle, surcharge, fourchette, poids de règle, données insuffisantes |
| `explain.ts` | `explainReadiness`, `explainSbdProjection`, `explainRacePrediction`, `explainCalorieTarget` | étapes, confiance |
| `morning-brief.ts` | `buildMorningBrief(facts)` | ≤ 3 phrases, priorités, faits absents |
| `data-confidence.ts` | `weekLoggingConfidence` | semaine complète, jours manquants |
| `ai-assist.ts` | schémas Zod des réponses IA, `matchPhotoItems`, `QUOTAS` | réponse invalide rejetée, rapprochement catalogue, calories calculées côté client |

## Lot 1 — Socle mobile

- `theme/colors.ts` : jetons `pillarHome`, `pillarStrength`, `pillarRunning`, `pillarNutrition`
  (+ test de contraste R10).
- `theme/stage.ts` : dégradés et encres de scène par pilier (indépendants du thème).
- `components/stage/` : `PillarStage`, `StageScrollView` (repli D2), `StageButton`, `StageChip`,
  `DenseTile`, `SectionTitle`.
- `components/stage/matter/` : `BreathRings`, `ImpactSilhouette` (impact unique à l'arrivée, D6),
  `FlowTrace`, `FillLevel`.
- `hooks/useScreenFocus.ts` : focus d'écran sans lever hors conteneur de navigation.
- `(tabs)/_layout.tsx` : teinte de l'onglet actif = couleur du pilier (si « couleur par menu » est
  éteint).
- `jest.setup.ts` : compléter le mock Reanimated (`useAnimatedScrollHandler`, `interpolate`,
  `Extrapolation`).

## Lot 2 — Les quatre hubs

1. **Nutrition** — `components/nutrition/NutritionStage.tsx` (niveau, 7 verres, ajout rapide,
   photo, brouillard) remplace en tête `DayBalanceCard` + `WeekStrip` + navigation de jour.
2. **Course** — `components/running/RunStage.tsx`, `KmSplitsCard.tsx`, `PredictionsCard.tsx`,
   `LoadGaugeCard.tsx` ; moment arrivée.
3. **Accueil** — `components/dashboard/HomeStage.tsx` (4 moments), `SinceLastVisitCard.tsx`,
   `GoalCard.tsx`, `WeeklyStoryCard.tsx` ; `stores/last-visit-store.ts`.
4. **Muscu** — `components/strength/StrengthStage.tsx`, `WeekSessionsCard.tsx`, `NearRecordsCard.tsx`,
   `WhatIfCard.tsx` ; moment après séance. **En dernier (D4).**

## Lot 3 — Sans IA

- `components/explain/ExplainSheet.tsx` + `stores/rule-weights-store.ts`.
- `components/brief/MorningBriefCard.tsx` (`expo-speech`, transcription).
- `components/whatif/WhatIfSheet.tsx` (leviers, éventail, conséquences, « Pourquoi ? »).

## Lot 4 — IA

1. Migration `…_dash01_ai_consent_usage.sql` : `user_settings.ai_consent_at timestamptz`, table
   `ai_usage (user_id, day, kind, count)` + RLS sans policy (service role). `db:push`, `db:types`,
   registre `MIGRATIONS.md`, schéma PowerSync client.
2. `supabase/functions/ai-assist/index.ts` (Deno) : JWT, consentement, quota, appel modèle, validation
   de la sortie.
3. Client : `lib/ai/ai-client.ts`, `hooks/useAiAvailability.ts`, `stores/ai-photo-queue-store.ts`,
   section « Assistant IA » des Réglages.
4. `app/meal-photo.tsx` : capture → analyse → portions → ajout.
5. `components/ask/AskCard.tsx` : trois questions, réponse déterministe + formulation IA facultative.

## Lot 5 — Clôture

i18n FR + EN · analytics (5 événements) · `RECETTES.md` §62 · roadmap 7.29 + récapitulatif + journal
des réconciliations · `CHANGELOG.md` · `node scripts/etat.mjs` · commit(s) conventionnels · push `dev`.

## Étapes manuelles (humaines) à signaler en recette

- `supabase secrets set ANTHROPIC_API_KEY=…` puis déploiement de la fonction (si le déploiement
  depuis la session échoue).
- Vérifier dans le dashboard PowerSync que `user_settings.ai_consent_at` remonte.
- Mettre à jour la fiche Play Store « Sécurité des données » et la politique de confidentialité.
