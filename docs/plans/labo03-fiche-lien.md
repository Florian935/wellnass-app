# Plan d'implémentation — LABO-03 « La fiche d'un lien »

Spec : [labo03-fiche-lien.md](../specs/functional/us/labo03-fiche-lien.md) · Branche :
**`feature/labo-carrefour`** · Roadmap 7.39. Une seule vague avec les quatre autres US du chantier :
l'ordre d'ensemble est dans le [plan de LIENS-01](liens01-registre-liens.md) §1.

## 1. Étapes

1. **Route** — `app/lab-link.tsx`, écran de premier niveau (`/lab-link?id=…&from=learn`), déclaré dans
   `app/_layout.tsx`. `link-routes.ts` : `linkHref(id, from?)`.
2. **Contenu** — haut de scène (question, paire, état), verdict, deux chiffres, graphique, mesures
   croisées (`rowTexts`), détail déménagé de Stats nutrition pour `fuelStrength` (`CrossTrainingSection`,
   `TrainingNutritionCrossCard`), gestes (feuille « ce qui change » pour ce qui écrit, Conseil pour les
   objectifs), histoire figée (`crossLinkHistory`), échos, source. Lien à découvrir : ce qui manque,
   jauge, ni histoire ni graphique.
3. **Cycle** — `CycleDetail` calcule `useCycleInsights` sur cette fiche seulement ; `app/cycle/insights.tsx`
   et son smoke test retirés, `app/cycle/index.tsx` ouvre la fiche.
4. **Graphique** — `CrossLinkChart.tsx` : sept formes (`pair`, `split`, `groups`, `band`, `line`,
   `grid`, `phases`), repère de 326 unités mis à l'échelle, courbes qui sautent les trous, barres à
   base carrée, colonnes touchables qui portent leur libellé, lecture en mots au-dessus du dessin.
   Règles du skill dataviz : un seul axe par panneau, repère nommé, trou ≠ zéro, lecture au toucher.

## 2. Tests

- `app/__tests__/lab-link-screen.test.tsx` (17 tests).
- `components/lab/__tests__/cross-link-chart.test.tsx` (10 tests) : sept formes, trou ≠ zéro, lecture
  au toucher, note des deux panneaux.
- `components/lab/__tests__/link-texts-coverage.test.ts` : textes de la fiche en FR et EN.

## 3. Vérification

Suites vertes ; **sur téléphone** (RECETTES §89) : chaque forme de graphique avec de vraies données,
lecture au toucher, histoire après une semaine, thème sombre, grandes polices.
