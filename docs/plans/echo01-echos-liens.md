# Plan d'implémentation — ECHO-01 « Les échos des liens »

Spec : [echo01-echos-liens.md](../specs/functional/us/echo01-echos-liens.md) · Branche :
**`feature/labo-carrefour`** · Roadmap 7.40. Une seule vague avec les quatre autres US du chantier :
l'ordre d'ensemble est dans le [plan de LIENS-01](liens01-registre-liens.md) §1.

## 1. Étapes

1. **Composant** — `components/lab/CrossLinkEcho.tsx` (`surface`, `moved?`), lu par `useCrossLinkEcho`.
2. **Montage** — Musculation › Progrès (`strength/sections/ProgressSection.tsx`), Course › Courir
   (`running/sections/RunSection.tsx`), Nutrition › Aujourd'hui (`app/(tabs)/nutrition.tsx`), Stats
   nutrition (`app/nutrition-stats.tsx`, `moved="fuelStrength"`).
3. **Stats nutrition** — `TrainingNutritionCrossCard` et `CrossTrainingSection` quittent l'onglet
   Qualité et sont montées dans la fiche « Manges-tu assez pour ta muscu ? » (LABO-03).
4. **Planning** — `SessionConflictBanner` gagne `onSeeLink` (« Voir le lien au Labo ») ;
   `app/planning/index.tsx` le branche sur la fiche `sports`.
5. **Accueil** — `InsightsCard.tsx` : `LinksContent` (« Tes liens », trois tailles) avant les signaux
   d'Insights ; `app/(tabs)/index.tsx` : un lien pressant suffit à afficher le widget.
6. **Insights** — `insights-repository.ts` ne monte plus les six hooks croisés ; `insights.ts`
   (`LAB_OWNED_INSIGHTS`), `insight-adapters.ts`, `widget-destinations.ts` (destination `lab-link`).
7. **Cycle** — `app/cycle/index.tsx` : le bouton du croisement ouvre la fiche `cycle`.
8. **Retraits** — `DayBalanceCard.tsx`, `WhatIfCard.tsx` (+ test), bloc `DayBalanceCard` du smoke des
   cartes du journal.

## 2. Tests

- `components/lab/__tests__/cross-link-echo.test.tsx` (5 tests).
- `widget-destinations.test.ts` (Vitest) : les six alertes pointent vers `lab-link`.
- Suites existantes adaptées : `nutrition-screen`, `nutrition-stats-screen` (écho doublé : il n'y est
  pas le sujet), `journal-cards-smoke` (bloc retiré).

## 3. Vérification

Suites vertes ; **sur téléphone** (RECETTES §89) : chaque écho avec un lien à régler, absence d'écho
quand tout tient, ligne « déménagé » de Stats nutrition, widget « Tes liens », bouton du planning.
