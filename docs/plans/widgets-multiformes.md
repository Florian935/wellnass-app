# US Widgets — Grille multi-formes — Plan d'implémentation

**Goal:** Généraliser le système de widgets du dashboard en un **moteur multi-formes** (3 formes
`small`/`wide`/`large`, grille 2 colonnes) **partagé par 3 hubs** (accueil, muscu, course), avec
personnalisation par hub (drag, forme, visibilité) et **migration douce sans SQL**.

**Architecture:** Toute la logique non-React vit dans `packages/shared` (module `widgets.ts`
généralisant `dashboard.ts`) : type `WidgetSize = 'small' | 'wide' | 'large'`, **registres par hub**
(`home`/`strength`/`running`), **layout multi-écrans** `{ screens: { … } }` avec parseur
rétro-compatible (ancien `{ widgets:[…] }` → `screens.home`), migration `full→wide`/`compact→small`,
et **packing pur** (ordre + forme → lignes de grille). Le mobile ajoute : un repository `useScreenLayout(screen)`,
un composant `WidgetGrid` (rendu 2 colonnes en affichage, 1 colonne triable en édition), un sélecteur de
forme à 3 états, et 3 registres de rendu (map `id → composant`). Les cartes d'action muscu/course
restent épinglées hors grille.

**Tech Stack:** `packages/shared` (Vitest, logique pure). `apps/mobile` (Expo Router, PowerSync `useQuery`,
`react-native-gesture-handler`/`reanimated`, i18next FR/EN). **Aucune migration SQL** (Option A spec §6).

**Spec :** [widgets-multiformes.md](../specs/functional/us/widgets-multiformes.md) (décisions §9 verrouillées 19/07/2026).

**Branche :** `feature/widgets-multiformes`.

> **Invariants :**
> - **Offline-first** : lecture locale réactive (`useQuery`), écriture immédiate au drop/changement (pas de débounce).
> - **i18n** : parité FR/EN ; aucune chaîne en dur.
> - **Rétro-compat** : un layout stocké ancien (`full|compact`, format `{ widgets:[…] }`) s'ouvre **sans perte**.
> - **Non-régression accueil** : l'accueil reste fonctionnel à chaque étape (le module `dashboard.ts` peut être
>   conservé en ré-export le temps de la bascule).
> - À chaque commit : `npm run typecheck` + `npm run lint -w @wellness/mobile` + `npm run test` **verts**.
>   Ne jamais stager `apps/mobile/eas.json`. Tests mobile jest-expo non câblés → vérif par typecheck/lint/grep.

---

## Task 1 : modèle de tailles + registres par hub (shared)

**Files:** Créer `packages/shared/src/widgets.ts` ; mettre à jour `packages/shared/src/index.ts`.
**Lis d'abord** `packages/shared/src/dashboard.ts` (source de la logique à généraliser).

- [ ] `export type WidgetSize = 'small' | 'wide' | 'large';` + `export type WidgetScreen = 'home' | 'strength' | 'running';`
- [ ] `export type WidgetId = string;` scopé par hub (les IDs muscu/course sont préfixés, cf. spec §3).
- [ ] Registre par hub : `WIDGET_REGISTRY: Record<WidgetScreen, { ids: readonly WidgetId[]; pillars: Record<WidgetId, Pillar[] | 'always'>; defaultSize: Record<WidgetId, WidgetSize> }>`.
  - `home` : reprend les 9 IDs + `WIDGET_PILLARS` actuels ; `defaultSize` = `wide`.
  - `strength` : `strength-programs`, `strength-planning`, `strength-history`, `strength-progress` (piliers `['strength']`).
  - `running` : `running-programs`, `running-planning`, `running-history` (piliers `['running']`).
- [ ] `defaultScreenLayout(screen)` : entrées ordonnées, `visible:true`, `size = defaultSize[id]`.

## Task 2 : layout multi-écrans + migration (shared, pur + Vitest)

**Files:** `packages/shared/src/widgets.ts` ; `packages/shared/src/widgets.test.ts`.

- [ ] Types : `WidgetLayoutEntry { id; visible; order; size }`, `ScreenLayout { widgets: WidgetLayoutEntry[] }`,
  `MultiScreenLayout { screens: Record<WidgetScreen, ScreenLayout> }`.
- [ ] `migrateSize(old)` : `'full'→'wide'`, `'compact'→'small'`, sinon repli défaut.
- [ ] `parseMultiScreenLayout(raw)` **rétro-compatible** :
  - `{ screens: {…} }` → parse par hub ;
  - **ancien** `{ widgets:[…] }` (ou string JSON) → interprété comme `screens.home`, tailles migrées ;
  - tolérant : entrées inconnues/invalides ignorées, jamais d'exception.
- [ ] `resolveScreenLayout(stored, screen, activePillars)` : ordre + forward-compat (widgets connus manquants
  ajoutés en fin) + filtrage piliers + recompactage `order` (comme `resolveDashboardLayout`).
- [ ] `moveWidget(layout, id, toIndex)` porté au nouveau type.
- [ ] **Tests** : migration `full/compact`, lecture ancien format → `home`, forward-compat, filtrage piliers,
  IDs inconnus, formes invalides, indépendance des 3 hubs.

## Task 3 : packing de la grille (shared, pur + Vitest)

**Files:** `packages/shared/src/widgets.ts` ; `packages/shared/src/widgets.test.ts`.

- [ ] `packWidgets(entries): WidgetRow[]` où `WidgetRow = { cells: WidgetLayoutEntry[] }` :
  - `small` → cellule ½, appariée avec le `small` **consécutif** suivant (2 max/ligne) ;
  - `wide`/`large` → cellule pleine largeur, **nouvelle ligne** ;
  - `small` isolé → ligne à 1 cellule (colonne gauche).
- [ ] **Tests** : `[small, small]` → 1 ligne 2 cellules ; `[small, wide, small]` → 3 lignes ;
  `[small, small, small]` → lignes (2)+(1) ; liste vide → `[]`.

## Task 4 : repository multi-hub (mobile)

**Files:** Généraliser `apps/mobile/src/data/repositories/dashboard-layout-repository.ts` en
`useScreenLayout(screen)` (ou nouveau `widget-layout-repository.ts` + ré-export de compat pour l'accueil).
**Lis d'abord** le repository actuel.

- [ ] `useScreenLayout(screen)` retourne `{ layout, isLoading, toggleVisible, setSize, reorder }` pour le hub demandé.
- [ ] Persistance : lit/écrit `user_settings.dashboard_layout` au **nouveau format** `{ screens: {…} }` ;
  fusionne le hub muté dans le multi-layout complet (les 2 autres hubs préservés) ; écriture immédiate.
- [ ] `setSize` accepte la forme cible (le sélecteur 3 états calcule le cycle côté UI, ou expose `cycleSize`).

## Task 5 : composant grille de rendu (mobile)

**Files:** Créer `apps/mobile/src/components/widgets/WidgetGrid.tsx`. Réutilise `SPACING=14`.

- [ ] **Affichage** : consomme `packWidgets`, rend des lignes `flexDirection:'row'` ; `small` = `flex:1`
  (½ largeur avec gouttière), `wide`/`large` = pleine largeur ; ratio carré pour `small`/`large` via `aspectRatio`.
- [ ] **Édition** : rend en **1 colonne** via `SortableDashboard` (drag linéaire existant) — pas de packing.
- [ ] Message vide (`empty`) si aucun widget visible.

## Task 6 : sélecteur de forme à 3 états (mobile)

**Files:** `apps/mobile/src/components/dashboard/DashboardEditControls.tsx`,
`apps/mobile/src/components/dashboard/DashboardWidgetRow.tsx`. **Lis-les d'abord.**

- [ ] Remplacer la bascule binaire par un bouton qui **cycle** `small → wide → large → small`, 3 icônes
  distinctes (ex. `square-outline` / `tablet-landscape-outline` / `grid-outline`) + `accessibilityLabel` i18n.
- [ ] Propager `WidgetSize` (nouveau type) partout (props, `pointerEvents`, cadre pointillé conservés).

## Task 7 : widgets muscu (mobile)

**Files:** Créer `apps/mobile/src/components/widgets/strength/*` (extraits des `ModulePreviewCard` de
`(tabs)/strength.tsx`) + registre de rendu `strength-widgets.tsx`. **Lis `strength.tsx` d'abord.**

- [ ] `StrengthProgramsWidget`, `StrengthPlanningWidget`, `StrengthHistoryWidget`, `StrengthProgressWidget`,
  chacun acceptant `size` et adaptant son contenu (`small` condensé / `wide` actuel / `large` développé).
- [ ] Map `id → composant` pour le hub muscu (comme `dashboard-widgets.tsx`).

## Task 8 : widgets course (mobile)

**Files:** `apps/mobile/src/components/widgets/running/*` + `running-widgets.tsx`. **Lis `running.tsx` d'abord.**

- [ ] `RunningProgramsWidget`, `RunningPlanningWidget`, `RunningHistoryWidget` (variantes `small`/`wide`/`large`).
- [ ] Map `id → composant` pour le hub course.

## Task 9 : bascule de l'accueil sur le nouveau moteur (mobile)

**Files:** `apps/mobile/src/app/(tabs)/index.tsx`, `apps/mobile/src/components/dashboard/dashboard-widgets.tsx`.

- [ ] Remplacer `useDashboardLayout()` par `useScreenLayout('home')` et le rendu par `WidgetGrid`.
- [ ] Adapter les 9 widgets d'accueil aux 3 formes (au minimum `small`/`wide` ; `large` si contenu pertinent).
- [ ] **Vérifier la non-régression** : un ancien layout `full|compact` s'ouvre migré, sans perte.

## Task 10 : câblage des hubs muscu & course (mobile)

**Files:** `apps/mobile/src/app/(tabs)/strength.tsx`, `apps/mobile/src/app/(tabs)/running.tsx`.

- [ ] Conserver la **carte d'action épinglée** en tête (hors grille, spec §2.4).
- [ ] Ajouter le bouton **Personnaliser** + `WidgetGrid` alimenté par `useScreenLayout('strength'|'running')`.
- [ ] Course : filtrage pilier running (masquage si non activé) conservé.

## Task 11 : i18n FR/EN

**Files:** `apps/mobile/src/i18n/locales/fr.json`, `apps/mobile/src/i18n/locales/en.json`.

- [ ] Généraliser/ajouter `widgets.customize.*` (formes : `shapeSmall`/`shapeWide`/`shapeLarge`/`shapeCycle`) ;
  rendre les libellés d'édition accessibles aux 3 hubs. Parité FR/EN, zéro chaîne en dur.

## Task 12 : vérification finale

- [ ] `npm run typecheck` + `npm run lint -w @wellness/mobile` + `npm run test` verts.
- [ ] Revue manuelle des 3 hubs (affichage grille + édition + migration) — au besoin `/verify`.
- [ ] `/commit` : CHANGELOG + TODO + roadmap (statut de la ligne widgets) mis à jour.

---

### Ordre de build conseillé
Tasks **1→3** (socle pur testé) → **4→6** (repository + grille + sélecteur) → **9** (accueil, non-régression
prouvée avant d'élargir) → **7,8,10** (muscu/course) → **11,12**. Chaque task = un incrément commité,
CI verte.
