# Plan d'implémentation — LABO-02 « Le Labo › Croiser »

Spec : [labo02-croiser.md](../specs/functional/us/labo02-croiser.md) · Branche :
**`feature/labo-carrefour`** · Roadmap 7.38. Une seule vague avec les quatre autres US du chantier :
l'ordre d'ensemble est dans le [plan de LIENS-01](liens01-registre-liens.md) §1.

## 1. Étapes

1. **Scène** — `scene-state.ts` : `SceneView` (`orbit` / `top`), `SceneZone`, médailles de zone,
   `labSceneWithZones(base, zones, selected)` (le pire état d'une zone l'emporte), `sceneZonePair`.
   `engine.js` : `setView` (caméra du dessus, transition), `setZones` (médailles à clé `z:`), sélection
   par **projection écran** (34 px), mise en avant de la zone choisie. `LabScene3D.dom.tsx` et
   `LabScene2D.tsx` : même geste de sélection en 3D et en repli 2D. `LabStage.tsx` : `header`, `footer`,
   `height`, `onPickZone`.
2. **Écran** — `app/(tabs)/lab.tsx` réécrit : `LAB_TABS = ['cross', 'composer', 'learn']`,
   `?section=` résolu pendant le rendu (pas dans un effet), scène qui suit l'onglet, gestes des liens
   (`onAction` : Conseil, ouverture, proposition qui écrit → « prêt »), feuille « ce qui change »
   partagée avec Composer, échecs visibles.
3. **Panneau** — `LabCrossPanel.tsx` (phrase, pastilles, filtre de zone, sections par état,
   associations en apprentissage, ligne des autres piliers, semaine, honnêteté), `CrossLinkCard.tsx`
   (trois formes ; `actionLabel`, `actionWrites`), `LinkLens.tsx`, `LabWeekOverview.tsx` (ex-contenu de
   l'onglet Semaine ; `LabWeekPanel.tsx` retiré).
4. **Ligne des autres piliers** — `stores/lab-other-pillars-store.ts` (stockage local, masquée pour de
   bon, patron `dismissed-rules-store`).
5. **Conseil** — `data/goal-conflict-resolution.ts` : les deux écritures du Conseil sorties de
   `GoalConflictBanner` pour être partagées avec le Labo et la fiche.
6. **Racine** — `app/_layout.tsx` : `CrossLinksProvider` autour de la pile, écran `lab-link` déclaré.

## 2. Tests

- `app/(tabs)/__tests__/lab-screen.test.tsx` réécrit (34 tests) : onglets et `?section=`, rangement par
  état, carte → fiche, filtre de zone, Conseil, ligne des autres piliers, R4 complet, Composer, Apprendre.
- `components/lab/__tests__/scene-state.test.ts`, `lab-stage.test.tsx` : vue du dessus, médailles,
  sélection.
- `app/__tests__/root-layout-gate.test.tsx` : `CrossLinksProvider` doublé (le test porte sur la garde).

## 3. Vérification

Suites vertes ; **sur téléphone** (RECETTES §89) : vue du dessus, toucher des médailles en 3D et en 2D,
transition vers Composer, thème sombre, TalkBack.
