---
id: MUSCU-UX06
titre: "Rouge fonte — la couleur du pilier Musculation, et des cartes qui se détachent du fond"
roadmap: [3.64]
catalogue: []
etape: recette
branche: dev
maj: 23/09/2026
---

# US MUSCU-UX06 — Rouge fonte, et des cartes qui se détachent

> Issue du retour de **Florian le 23/09/2026**, juste après la clôture de MUSCU-FIX02 : « les couleurs
> au niveau du pilier muscu, c'est un peu trop rose », « le bordeaux, il est pas très adapté », « on
> voit pas assez les contrastes en termes de cartes » — sur le hub muscu **et** sur l'accueil.
>
> ⚠️ **Travail directement sur `dev`** (décision Florian, chantier en cours).
> Maquette : [design/muscu-ux06-rouge-fonte/](../../../../design/muscu-ux06-rouge-fonte/) ·
> Plan : [docs/plans/muscu-ux06-rouge-fonte.md](../../../plans/muscu-ux06-rouge-fonte.md)

## 1. Le problème, mesuré

### 1.1 « Trop rose »

| Élément | Valeur | Teinte |
|---|---|---|
| Accent sombre (`pillarStrength`) | `#e07a98` | 342° — un rose |
| Scène | `#7c2734 → #58182b → #330f22` | 351° → 329° : glisse vers la prune |
| Matière de scène (halo) | `#f2a6c2` | rose |

Le bordeaux adouci le 19/09/2026 (MUSCU-UX04) avait retiré l'arête néon, mais la teinte continuait de
dériver vers le magenta — c'est cette dérive qui se lit « rose ».

### 1.2 « Les cartes ne se détachent pas »

Carte / fond = **1,23:1** en sombre, **dans tous les piliers**. Ce n'est pas un défaut de teinte :
`tintPreservingLuminance` conserve la luminance, donc chaque pilier recopie l'écart de la palette de
base (`#30271e` sur `#1c150e`). **Changer la couleur du pilier ne pouvait pas le corriger** — il faut
toucher la palette de base, pour toute l'app. En clair : 1,11:1, filet à 1,13:1.

## 2. La décision

Une toile Claude Design a posé **quatre directions** côte à côte sur les vrais écrans (hub, séance
classique, immersif, repos, en sombre et en clair) : A rouge fonte, B graphite + rouge, C prune
profonde, D acier bleuté + corail — plus une planche de **cinq paliers de séparation** sur le hub muscu
et l'accueil.

**Florian a retenu A « Rouge fonte »** (23/09/2026), avec le palier de séparation qui y était montré
(fond plus sombre + filet visible).

## 3. Les règles

- **R1. Teinte du pilier : `#8e1b1b`** (rouge franc, 0°). Surface sombre teintée `#421f19`
  (chroma 41, contre 29 pour le bordeaux).
- **R2. Accents** : sombre `#ff6b5e` (5,21:1 sur carte, 7,06:1 sur fond), clair `#a8261d` (6,83:1 sur
  carte, 6,18:1 sur fond, blanc dessus 7,09:1). Teinte 4-5°, contre 16-18° pour l'accueil : les deux
  onglets ne se confondent pas.
- **R3. Scène** : `#8e1b1b → #5f1512 → #2b0d0b`, texte atténué `#f6c5bf` (5,88:1 au pire), bouton plein
  blanc à texte `#8e1b1b`, matière `#ff9a8f`.
- **R4. Séparation — palette de base sombre, toute l'app** : fond `#1c150e` → **`#0f0a06`** (carte /
  fond 1,23 → **1,35:1**), filet `#3a2e22` → **`#4b3d30`** (1,88:1 sur le fond, 1,40:1 sur la carte).
  Le composant `Card` dessinait déjà un filet de 1 px en `colors.border` : aucun composant n'est modifié.
- **R5. Séparation — thème clair** : filet `#ece0cd` → **`#e3d3ba`** (1,28:1 sur le fond). La carte
  presque blanche ne peut guère s'écarter du fond : c'est le filet qui sépare.
- **R6. La carte sombre reste `#30271e`** — écart assumé avec la planche, qui montrait `#342a20`
  (1,38:1). Éclaircir la carte fait passer `borderStrong` sous 3:1 sur les cartes (3,05 → 2,92, WCAG 1.4.11) et
  creuse l'écart D2 de l'accent terracotta (4,45 → 4,26). La différence de séparation (1,35 contre
  1,38) est imperceptible ; le filet fait le reste.
- **R7. Ce qui suit le fond abaissé** : l'encre des boutons pleins (`accentText` = le fond, 5,48 →
  5,98:1), le bas de la scène sombre de l'accueil (qui coule dans la page) et le milieu de la scène du
  Labo.
- **R8. Les copies en dur de la couleur muscu suivent** : planning (pastilles, étiquettes), aperçu du
  planning, fond des cartes de record et échelle de chaleur de l'immersif, disques du Labo en 2D et en
  3D, haut de la scène du Labo, couleur par défaut de la préférence « Couleurs des menus ».
- **R9. Correctif au passage — l'heure d'une séance muscu au planning** était peinte avec la teinte
  profonde, illisible en sombre (1,9:1). Elle prend l'accent lisible du pilier (`pillarStrength`).

## 4. Cas limites

- **Carte claire de la musculation = carte neutre `#fffaf2`.** Le rouge fonte est sombre : en clair,
  `tintPreservingLuminance` finit le chemin vers le blanc et retombe exactement sur la carte neutre,
  quel que soit le gain (mesuré de 1 à 2). La teinte y passe par le fond (`#ffecdc`) et le filet
  (`#f9ccb4`). C'est le rendu de la planche validée. Le test-garde « la surface change vraiment » porte
  une **exception nommée** pour ce cas et exige à la place que le filet change.
- **TEINTE-01 levé** (BACKLOG) : la carte claire muscu sortait à chroma 9, sous le neutre (13). Elle
  est maintenant à 13 : l'exception datée du test de chroma est supprimée.
- **Préférence « Couleurs des menus »** : désactivée par défaut, donc sans effet pour la plupart. Une
  couleur déjà **personnalisée** est un choix de l'utilisateur, respecté — le rose y reste jusqu'à
  « Réinitialiser ». Le rose `#e07a98` reste proposé dans la palette de choix. Aucune migration.
- **Carte de partage** : son fond `#1c130c` est fixe et indépendant du thème (image exportée) — non
  touché.
- **Les autres piliers** changent aussi, par la palette de base : fond plus sombre et filet plus
  visible partout. Leurs couleurs (accent, teinte, scène) ne bougent pas.

## 5. i18n et offline

- **i18n** : aucune chaîne ajoutée ni modifiée.
- **Offline** : sans objet — aucune donnée, aucune migration, aucune sync rule, aucune dépendance
  native. Recettable sur un build de `dev`.

## 6. Hors périmètre

- Le **vert nutrition du Labo 3D** (`engine.js`) est resté `#a9ba7e` alors que le 2D a pris
  `#9ed16a` avec NUTRI-UX02. Même nature de défaut que R8, sur un autre pilier : non corrigé ici.
- L'écart **D2** (accent terracotta sombre à 4,45:1 sur carte) reste tel quel.

## 7. Tests

- `theme/__tests__/contrast.test.ts` :
  - nouveau bloc **« Séparation des cartes »** : carte / fond ≥ 1,33 et filet / fond ≥ 1,8 en sombre,
    ≥ 1,1 et ≥ 1,25 en clair, pour la palette neutre et chacun des cinq piliers ; filet / carte ≥ 1,35 ;
  - nouveau bloc **« Identité muscu — les copies en dur suivent le token »** : couleurs par défaut des
    menus = accents sombres des piliers ; disques muscu du Labo (2D et 3D) = `pillarStrength` sombre ;
  - exception `CARTE_CLAIRE_NEUTRE` (muscu en clair) nommée ; exception de chroma `CLAIR_CONNU_FAIBLE`
    supprimée.
- Les contrats existants tiennent sans modification : contrastes WCAG de la palette, non-régression
  par pilier, encres de scène (`stage.test.ts`), chroma des accents.
