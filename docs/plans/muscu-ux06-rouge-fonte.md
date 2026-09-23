# Plan d'implémentation — MUSCU-UX06 (rouge fonte, séparation des cartes)

Spec : [docs/specs/functional/us/muscu-ux06-rouge-fonte.md](../specs/functional/us/muscu-ux06-rouge-fonte.md) ·
Maquette : [design/muscu-ux06-rouge-fonte/](../../design/muscu-ux06-rouge-fonte/) ·
Branche : `dev` (décision Florian).

**Aucune migration, aucune sync rule, aucune dépendance native, aucune chaîne i18n.** Tout est dans les
jetons de couleur ; les composants lisent déjà `colors.*` et `pillarPalette`.

## Étape 1 — Palette de base (toute l'app)

| Fichier | Changement |
|---|---|
| `apps/mobile/src/theme/colors.ts` | sombre : `background` `#0f0a06`, `border` `#4b3d30`, `accentText` `#0f0a06` ; clair : `border` `#e3d3ba` |
| `apps/mobile/src/theme/stage.ts` | `HOME_DARK` et `LAB` : l'arrêt `#1c150e` suit le nouveau fond |

## Étape 2 — Identité du pilier Musculation

| Fichier | Changement |
|---|---|
| `theme/colors.ts` | `pillarStrength` : sombre `#ff6b5e`, clair `#a8261d` |
| `theme/pillar.ts` | `TINT.strength` `#8e1b1b` |
| `theme/stage.ts` | `STRENGTH` : dégradé, `inkMuted`, `onSolid`, `accent` ; `LAB` : haut `#3b0f0c` |

## Étape 3 — Copies en dur de la couleur muscu

| Fichier | Changement |
|---|---|
| `app/planning/index.tsx` | `STRENGTH_COLOR` `#8e1b1b` ; l'heure prend `colors.pillarStrength` (`pillarInk`) |
| `components/PlanningPreview.tsx` | `STRENGTH_COLOR` `#8e1b1b` |
| `components/workout/immersive/theme.ts` | `HEAT_SCALE[1]` et `RECORD_BG` `#8e1b1b` |
| `components/lab/scene/LabScene2D.tsx` | disque muscu `#ff6b5e` |
| `components/lab/scene/engine.js` | `PILLAR_HEX.muscu` `#ff6b5e`, ruban initial lu dans `PILLAR_HEX` |
| `stores/menu-accent-store.ts` | défaut `strength` `#ff6b5e` ; `#e07a98` reste proposé |

## Étape 4 — Tests (`theme/__tests__/contrast.test.ts`)

1. Bloc « Séparation des cartes » (neutre + 5 piliers, 2 thèmes).
2. Bloc « Identité muscu — les copies en dur suivent le token » (menus, Labo 2D, Labo 3D).
3. Exception nommée `CARTE_CLAIRE_NEUTRE` ; suppression de `CLAIR_CONNU_FAIBLE`.

## Étape 5 — Suivi

RECETTES.md (nouvelle section), roadmap **3.64** (hors cadrage), BACKLOG (TEINTE-01 retiré), maquette
versée dans `design/`.

## Vérification

`npm run lint`, `npm run typecheck`, `npm run test` (code de sortie lu sans pipe).
