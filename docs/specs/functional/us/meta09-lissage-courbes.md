# US META-09 — Lissage des courbes par moyenne mobile

_Spec fonctionnelle. Statut : en validation (brainstorming Florian, 18/07/2026). Branche :
`feature/meta09-lissage-courbes` (depuis `dev`). Catalogue : **META-09** — brique socle transverse,
Phase A (déterministe, offline). Prolonge 5.28/4.24._

## 1. Contexte & objectif

Les courbes de fond de l'app (poids, apports kcal, allure, progression muscu) affichent les **points
bruts**, souvent **bruités** : une pesée isolée, une journée yo-yo ou une sortie contre le vent font
« sauter » la courbe et masquent la **tendance réelle**. META-09 ajoute une **moyenne mobile centrée**
superposée à la courbe brute, pour lire la tendance sans sur-réagir à un point isolé.

C'est une **brique socle** (seconde après META-08) : une fonction pure de lissage réutilisable, appliquée
ici aux 4 courbes existantes et disponible ensuite pour les projections (META-14/15/16, qui lissent avant
d'extrapoler). **100 % client, offline, gratuit, sans IA.**

> **Note transverse du catalogue** : poser les briques mathématiques socles (régression META-08, lissage
> META-09) **avant** les analyses inférentielles. META-09 est la seconde de ces briques.

**Maquette (légère)** : [design/meta09-lissage-courbes/meta09-lissage-courbes.html](../../../../design/meta09-lissage-courbes/meta09-lissage-courbes.html)
— overlay brut estompé + lissé accentué, courbe dense (poids) + éparse (allure), thèmes clair/sombre.

## 2. Périmètre

- **Inclus** :
  - brique pure `movingAverage(values, window)` (nouveau module shared `moving-average.ts`) + tests ;
  - prop `smooth` sur `ProgressLineChart` : overlay **brut estompé + lissé accentué**, fenêtre
    **auto-adaptée**, calculée via la brique ;
  - activation de `smooth` sur les **4 courbes** : poids + apports kcal (Nutrition → Stats), allure
    (Course → Stats), progression charge/volume/1RM (Muscu → Progression) ;
  - smoke test composant étendu (`smooth`).
- **Exclu** :
  - fenêtre **réglable** par l'utilisateur (aucun contrôle ajouté — décision Florian) ;
  - lissage **en jours** (on retient le **point-based**, décision Florian) ;
  - lissage du **dashboard** (widgets non concernés) et de toute courbe hors des 4 ci-dessus ;
  - les **projections** (META-14/15/16), consommateurs futurs de la brique — US séparées ;
  - toute migration, toute donnée nouvelle.
- **Affichage** : **superposition** (brut conservé, estompé) + lissé accentué — décision Florian ;
  jamais « lissé seul » (on ne masque pas la donnée réelle).
- **Fenêtre** : **en nombre de points, centrée** ; **taille fixe auto-adaptée** à la longueur de la
  série (décisions Florian).
- **Maquette** : **légère**, validée Florian (18/07/2026) — voir §1.

## 3. Brique pure — `movingAverage` (nouveau module `moving-average.ts`)

```ts
/** Moyenne mobile centrée (fenêtre en points). Débruite une série pour en lire la tendance. */
export function movingAverage(values: ReadonlyArray<number>, window: number): number[];
```

Règles :
- **Centrée** : pour chaque indice `i`, moyenne des valeurs sur `[i − h, i + h]` avec
  `h = Math.floor(window / 2)` (fenêtre effective symétrique `2h + 1`).
- **Bords en fenêtre rétrécie** : aux extrémités, moyenne des voisins **disponibles** (fenêtre
  partielle) → **chaque point reçoit une valeur**, les extrémités restent **ancrées près de la donnée
  réelle** (pas de bord qui invente une tendance).
- **Garde-fou** : `window ≤ 1` **ou** `values.length < 2` → renvoie une **copie** de `values` (aucun
  lissage). `values` vide → `[]`.
- **Pure, sans dates** : point-based, aucune I/O ; sortie de **même longueur** que l'entrée.
- Exemple : `movingAverage([80, 79, 81, 78, 80], 3)` → `[79.5, 80, 79.33…, 79.67…, 79]`.

## 4. Composant — `ProgressLineChart` (overlay)

[apps/mobile/src/components/charts/ProgressLineChart.tsx](../../../../apps/mobile/src/components/charts/ProgressLineChart.tsx).
Nouvelle prop **opt-in** :

```ts
smooth?: boolean; // défaut false — active la superposition brut + lissé
```

Comportement quand `smooth === true` :
- **Fenêtre auto-adaptée** (calculée par le composant, pas la brique) :
  `window = clamp(prochain impair de round(length / 5), 3, 7)`. **Si `length < 4`** → pas de lissage
  (rendu brut seul, strictement comme aujourd'hui).
- **Deux séries** (gifted-charts) :
  - **Brut** = `data` **estompé** : couleur discrète (`textMuted` ou accent faible opacité), points
    légers, **sans** remplissage de zone.
  - **Lissé** = `data2` **accentué** (`colors.accent`, `curved`), **porteur** du remplissage de zone
    (`areaChart`).
- **Axe Y inchangé** : le lissé est **borné par [min, max] du brut** (propriété de la moyenne), donc
  l'échelle existante — y compris `buildPaceYAxis` (allure), calculée sur le brut — **reste valide**.
- **Rétrocompatibilité** : `smooth` absent/false → rendu **strictement identique** à l'actuel.
- **Cohérence thème** : couleurs tirées de `useTheme()` (clair/sombre) ; conforme à la maquette.

## 5. Surfaces (activation de `smooth`)

1. **Nutrition → Stats — courbe de poids** ([nutrition-stats.tsx](../../../../apps/mobile/src/app/nutrition-stats.tsx)).
2. **Nutrition → Stats — courbe d'apports kcal** (même écran).
3. **Course → Stats — courbe d'allure** ([running-history/index.tsx](../../../../apps/mobile/src/app/running-history/index.tsx))
   — avec `formatYLabel` (allure), compatibilité axe Y vérifiée (§4).
4. **Muscu → Progression — courbe charge/volume/1RM** ([progress/index.tsx](../../../../apps/mobile/src/app/progress/index.tsx))
   — lissage sur la métrique affichée ; la logique de bascule des 3 métriques ne change pas.

Aucune autre logique de ces écrans ne change (mêmes données, mêmes sélecteurs de période).

## 6. Cas limites

- **Série < 4 points** → brut seul (pas de faux lissage sur un compte récent).
- **Série vide** → `ProgressLineChart` rend déjà `null` (inchangé).
- **Série constante** → lissé = identique au brut (les deux traits se superposent — attendu).
- **`window` pair** (ne devrait pas arriver via l'auto-fenêtre impaire) → géré par la brique
  (`h = floor(window/2)`), fenêtre `2h+1`.
- **Offline** : brique pure + rendu client, zéro I/O, zéro migration.

## 7. Surfaçage (ADR-007 §5)

- **Tier 1** — écrans Stats/Progression des piliers. **Amélioration de graphes existants** : pas de
  nouvelle section, pas de nouveau widget, **aucun contrôle ajouté** (fenêtre fixe auto).
- **Condition d'affichage** : le trait lissé apparaît dès **≥ 4 points** ; sinon brut seul. Le dashboard
  n'est pas touché (plafond respecté). Conforme au « conditionnel par défaut / ne pas empiler ».

## 8. i18n (FR + EN)

- A priori **aucune chaîne nouvelle** (overlay sans libellé, sans contrôle). Si une **légende**
  « brut / lissé » est retenue à l'implémentation (cf. maquette), l'ajouter à parité FR/EN
  (ex. `charts.raw` / `charts.smoothed`). Aucune chaîne en dur.

## 9. Tests

- **Shared (Vitest) — `moving-average.test.ts`** : fenêtre 3 et 5 ; **bords rétrécis** (valeurs exactes
  calculées à la main) ; série paire et impaire ; `window ≤ 1` → copie ; `values.length < 2` → copie ;
  série **constante** → identique ; série **vide** → `[]` ; sortie de même longueur.
- **Mobile** : `charts-smoke.test.tsx` étendu — `ProgressLineChart` avec `smooth` (série longue ET série
  < 4 points) **rend sans crash** ; typecheck/lint verts. Rendu visuel validé à la recette device.

## 10. Definition of Done

- `movingAverage` **pure et testée**, exportée depuis `@wellness/shared`.
- `ProgressLineChart` : prop `smooth` (overlay brut estompé + lissé accentué, fenêtre auto, seuil ≥ 4
  points), **rétrocompatible** (`smooth` off → rendu identique).
- `smooth` activé sur les **4 courbes** (poids, kcal, allure, muscu).
- **Aucune** migration, **aucune** donnée nouvelle, **pas de checkpoint 🔴** (100 % client, offline →
  reload Metro). i18n FR/EN à parité **si** une légende est ajoutée.
- typecheck / lint / tests verts sur tous les workspaces ; catalogue **META-09 → ✅**. Reste **recette
  device** (les 4 courbes : lissé cohérent, brut visible, pas de débordement ni glitch d'axe — surtout
  allure) + relecture Damien.
