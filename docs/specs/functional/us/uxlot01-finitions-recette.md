---
id: UX-LOT-01
titre: "Lot de finitions remontées en recette (UX-02, UX-03, UX-04)"
roadmap: [3.53, 3.54, 7.18]
catalogue: []
etape: recette
branche: feature/uxlot01-finitions-recette
maj: 29/07/2026
---

# US UX-LOT-01 — Lot de finitions remontées en recette

> **Validé par Florian le 29/07/2026** (« go pour le lot UX-02/03/04 »), livrables d'amont et code
> couverts par le même go. Trois correctifs de recette **indépendants mais de même nature**, traités
> en un seul lot : une branche, une passe de recette. Roadmap **3.53**, **3.54**, **7.18**.
>
> ⚠️ **Ce document n'est pas un cadrage classique et c'est délibéré.** L'inventaire du code a montré
> qu'une bonne partie du lot était **déjà livrée** et qu'un des trois diagnostics était **faux**.
> Écrire trois specs pour du travail fait aurait été du théâtre : cette spec consigne donc l'**écart
> entre ce que le backlog annonçait et ce que le code contenait**, puis ce qui a réellement été livré.

## 0. Ce que l'inventaire du code a montré

| Item | Ce que le backlog annonçait | Ce que le code contenait déjà |
|---|---|---|
| **UX-02** (3.53) | « bottom-sheet au lieu de la card intercalée + segment `scrollable` + placeholder sur le nom » | ✅ **Déjà livré** par [`12bd3a1`](../../../../CHANGELOG.md) « feat(muscf11): modale bottom-sheet de création d'exercice perso ». [`CreateExerciseModal.tsx`](../../../../apps/mobile/src/components/exercises/CreateExerciseModal.tsx) est un `Modal` bottom-sheet, avec `placeholder` sur le nom et le segment `scrollable`. **Les trois points, ligne pour ligne.** Rien à faire. |
| **UX-03** (3.54) | « mêmes sections + états vides explicites ; édition des instructions et muscles secondaires d'un exo perso » | 🟡 **À moitié livré** : l'édition existe déjà ([`EditExerciseModal.tsx`](../../../../apps/mobile/src/components/exercises/EditExerciseModal.tsx) + `updateCustomExercise`, qui accepte `musclesSecondary` **et** `instructions`). Restaient **les états vides**. |
| **UX-04** (7.18) | « poignée ≥ 48 dp + `hitSlop`, **appui long sur une card**, retour visuel pendant le glissement » | 🟡 **Diagnostic faux sur 2 des 3 points** : l'appui long **existe** (`activateAfterLongPress(700)`) et le retour visuel **aussi** (échelle + ombre via `useAnimatedStyle`). Il n'y a d'ailleurs **aucune poignée** : le geste est porté par toute la carte. |

**Les vrais défauts d'UX-04**, une fois le code lu :

1. **Cibles tactiles sous la norme** : les chips « afficher/masquer » et « changer de forme » font
   24 dp de visuel avec `hitSlop={6}` → **36 dp effectifs**, sous les 48 dp exigés par CONF-07 (P0).
2. **Aucune affordance.** Le glissement marchait, mais **rien ne l'indiquait** — ni poignée, ni
   indice. Un geste qu'on ne découvre pas n'existe pas pour l'utilisateur. C'est bien le problème de
   découvrabilité remonté en recette, mais sa cause n'était pas la taille d'une poignée absente.

## 1. Ce qui a été livré

### UX-03 — états vides explicites sur la fiche exercice

Les sections **Muscles secondaires**, **Matériel** et **Instructions** de
[`exercises/[id].tsx`](../../../../apps/mobile/src/app/exercises/[id].tsx) sont désormais **toujours
rendues**. Vides, elles affichent « Non renseigné » en couleur atténuée au lieu de disparaître.

**Pourquoi c'est le bon correctif** : un exercice perso créé sur mobile n'a ni muscles secondaires ni
instructions (`addCustomExercise` ne prend que nom + groupe). Masquer les sections donnait donc **deux
fiches de structure différente** selon l'origine de l'exercice — et l'absence de section se lisait
comme un bug plutôt que comme une information.

L'écart **volontaire** est préservé : les actions **Modifier** et **Supprimer** restent réservées aux
exercices persos. On ne « corrige » que l'écart **subi**.

### UX-04 — cibles tactiles et affordance

- Les deux chips passent à `hitSlop={12}` → **48 dp** de cible effective, sans changer le visuel (la
  grille est dense, agrandir les icônes déséquilibrerait les cartes).
- Une **poignée visible** (`reorder-two-outline`) est ajoutée en bas à droite de chaque carte en mode
  édition. Elle est **`pointerEvents="none"`** : elle *signale* sans capter de tap, si bien que le
  geste reste porté par **toute la carte** — la zone de préhension reste donc maximale, ce qu'une
  poignée réellement interactive aurait au contraire réduit à 48 dp.
- Le bandeau du mode édition annonce le geste : « Appui long sur un widget pour le déplacer ».

### UX-02 — rien

Déjà livré. Roadmap 3.53 passe à ✅ par **réconciliation**, sans commit de code.

## 2. i18n (FR + EN)

Deux clés ajoutées, dans les deux langues : `exercises.detail.notSet` et `home.customize.dragHint`.
Aucune chaîne en dur.

## 3. Offline

Aucun impact : trois changements de **présentation**. Aucune écriture, aucune requête nouvelle, aucune
migration, **aucune sync rule à redéployer**.

## 4. Accessibilité

- Cibles **≥ 48 dp** sur les deux chips (l'objet même d'une partie du lot).
- L'état vide est porté par **le texte** « Non renseigné », pas seulement par une couleur atténuée.
- `maxFontSizeMultiplier` sur l'indice de glissement, qui est du texte long dans un bandeau contraint.
- La poignée est décorative et explicitement retirée de l'arbre tactile.

## 5. Critères de recette (device)

1. Fiche d'un exercice **perso sans instructions** : les 3 sections sont présentes, celles qui sont
   vides affichent « Non renseigné ».
2. Fiche d'un exercice **de bibliothèque** : même structure, valeurs réelles affichées.
3. Modifier un exercice perso permet toujours de saisir instructions et muscles secondaires.
4. Modifier / Supprimer restent **absents** sur un exercice de bibliothèque.
5. Mode édition du dashboard : la **poignée** est visible sur chaque carte et l'indice de geste
   s'affiche dans le bandeau.
6. Les chips afficher/masquer et changer-de-forme se tapent **sans viser** (cible 48 dp).
7. L'appui long déplace toujours la carte, et le glissement conserve son retour visuel.
8. Vérifier en EN que les deux nouvelles chaînes sont traduites.

## 6. Definition of Done

- [x] UX-02 constaté déjà livré → roadmap 3.53 ✅ par réconciliation.
- [x] États vides explicites (UX-03) → roadmap 3.54 ✅.
- [x] Cibles 48 dp + poignée + indice (UX-04) → roadmap 7.18 ✅.
- [x] i18n FR + EN, aucune chaîne en dur.
- [x] Test de la fiche exercice **mis au nouveau contrat** (il verrouillait l'ancien comportement).
- [x] `npm run lint`, `npm run typecheck`, `npm run test` verts.
- [ ] Recette device (8 critères ci-dessus).
