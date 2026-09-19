---
id: MUSCU-UX04
titre: "L'identité d'un pilier tenue par toute la page — accent, surfaces, et la scène qui coule"
roadmap: [3.59]
catalogue: []
etape: recette
branche: dev
maj: 19/09/2026
---

# US MUSCU-UX04 — L'identité d'un pilier, tenue par toute la page

> Issue de la **recette du 19/09/2026** (Florian) : « la carte du haut est jolie, mais les cartes en
> dessous, c'est pas du tout ISO. Faut que tout soit ISO en termes de design. »
>
> ⚠️ **Travail directement sur `dev`** (décision Florian).

## 1. Le problème

Mesuré, l'onglet Musculation portait **trois identités sur un seul écran** :

| | Couleur | Source |
|---|---|---|
| La scène | bordeaux `#6b0028 → #2d0011`, accent rose `#ff9ec0` | `theme/stage.ts` |
| La barre d'onglets | rose `#e07a98` | `colors.pillarStrength` |
| **Les cartes** | brun `#30271e`, accent terracotta `#dd6e40` | palette neutre |

Les cartes étaient l'intruse : le rose était déjà la couleur de la muscu partout ailleurs. Et la
scène s'arrêtait net — bande colorée d'un côté, cartes brunes de l'autre, deux mondes empilés.

### 1.1 Pourquoi le mécanisme existant ne suffisait pas

`menu-accent-store` faisait presque ça. Mais c'est une **préférence utilisateur**, désactivée par
défaut — l'identité ne se serait donc jamais affichée. Pire : sa couleur muscu par défaut était
`#6b0028`, qui mesure **1,15:1** sur une carte sombre. Activer l'interrupteur rendait les libellés
et icônes illisibles, sans qu'aucun garde-fou ne le signale. Et comme la préférence stocke **une**
couleur servie aux **deux** thèmes, aucune valeur ne pouvait convenir : `#e07a98` fait 5,2:1 en
sombre et 2,5:1 en clair.

## 2. Les règles

- **R1.** L'identité d'un pilier est un **fait du design system**, toujours appliqué — pas une
  préférence. La préférence reste ce qu'elle est : une surcharge volontaire de l'accent.
- **R2.** Les surfaces sont teintées **à luminance constante**. Un mélange ordinaire vers une
  couleur sombre les assombrit, et la palette claire ne peut pas se le permettre : ses paires de
  texte sont à **4,53-4,55** pour un seuil de 4,5. Mesuré, un mélange à 10 % vers le bordeaux
  faisait tomber six paires sous le seuil d'un coup.
- **R3.** Le **fond** bouge moins que les cartes (facteur 0,6) : sans ça, fond et carte convergent et
  la carte cesse de se détacher.
- **R4.** Le **bandeau d'alerte n'est jamais teinté** : il doit se reconnaître d'un coup d'œil, la
  même couleur sur les cinq piliers.
- **R5.** Toute couleur posée comme accent est **ramenée au seuil** avant usage (`readableOn`), y
  compris une couleur choisie par l'utilisateur.
- **R6.** La scène ne s'arrête plus net : sa teinte du bas **coule** sur ~200 px du corps. Pas à
  pleine opacité — les coins arrondis de la scène laissent voir la page, et une continuation opaque
  juste en dessous les transformerait en deux encoches inexplicables.
- **R7.** Intensités arrêtées à l'œil sur planche comparative (0 · 0,12 · 0,2 · 0,3 · 0,45) :
  **0,30 en sombre, 0,22 en clair**. En dessous de 0,2 le sombre ne bascule pas ; au-delà de 0,3 il
  vire au bonbon. Le clair réagit plus vite — ses surfaces sont presque blanches.

## 3. Ce qui est livré

| Fichier | Changement |
|---|---|
| `packages/shared/src/contrast.ts` | **`tintPreservingLuminance`** et **`readableOn`** — deux briques pures |
| `apps/mobile/src/theme/pillar.ts` | **neuf** — la palette d'un pilier, mémoïsée (dix combinaisons) |
| `apps/mobile/src/theme/useTheme.ts` | deux couches : identité du pilier, puis préférence par-dessus |
| `apps/mobile/src/stores/menu-accent-store.ts` | défauts et palette de choix alignés sur les accents lisibles |
| `apps/mobile/src/components/stage/StageScrollView.tsx` | la coulée de la scène dans le corps |

## 4. Tests-gardes

- `packages/shared` : la luminance/le contraste conservés pour 6 bases × 5 teintes × 5 intensités ×
  6 encres ; `readableOn` atteint toujours le seuil quel que soit le fond.
- `apps/mobile/src/theme/__tests__/contrast.test.ts` : **non-régression mesurée** sur 5 piliers ×
  2 thèmes × 21 paires, plus « les surfaces changent vraiment » et « l'alerte n'est jamais teintée ».

> ⚠️ La règle est une **non-régression**, pas un seuil absolu : une paire que la palette neutre ne
> tient déjà pas (l'écart assumé `accentText`/`accent` de CONF-07 D2) n'a pas à être réparée ici.

## 5. Recette

[RECETTES.md §77](../../../../RECETTES.md).
