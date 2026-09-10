# Audit UX — Pilier Musculation (septembre 2026)

> **Second audit du pilier**, deux mois après [audit-flux.md](./audit-flux.md).
> Diagnostic figé — il ne bouge plus. Date : 09-10/09/2026 · **Constats et maquettes validés par
> Florian le 10/09/2026**, traités en un seul lot par l'US
> [MUSCU-UX01](../specs/functional/us/muscu-ux01-refonte-pilier-musculation.md).
> Méthode : lecture du code réel de 18 écrans (~7 500 lignes), puis parcours simulés selon trois
> profils. Chaque constat renvoie à une ligne de source.
>
> **Livrables** : compte rendu PDF et maquettes (19 planches, avant/après) dans
> [design/refonte-muscu-2026-09/](../../design/refonte-muscu-2026-09/).

## 1. Ce qui distingue cet audit du précédent

L'audit de juillet portait sur des **trous de conception** : le planning et le logging ne se
parlaient pas, il n'y avait pas de flux guidé en séance. Ils ont été bouchés (US Refonte-A à D).

Ce qui reste tient à **l'accumulation** : deux mois de fonctionnalités livrées correctement,
ajoutées une à une sur des écrans qui n'ont jamais été rehiérarchisés. Le défaut n'est plus
l'absence, c'est la densité et l'ordre. Le mécanisme est le même partout : **ce qui compte le plus
a été poussé vers le bas par ce qui compte moins.**

## 2. Les 17 constats

### Hub et entrée dans un programme

| # | Constat | Source |
|---|---|---|
| 1 | La grille du hub ne reçoit pas de prédicat `isActive`, contrairement à l'accueil : les 7 widgets sont rendus même vides. Environ 2,4 écrans de scroll sur un compte neuf. | `(tabs)/strength.tsx` |
| 2 | Le hub n'a **aucun plafond**, alors que l'accueil a `MAX_HOME_WIDGETS` appliqué par un test. Avec la carte d'action et la ligne bibliothèque : 9 blocs sans hiérarchie. | `packages/shared/src/widgets.ts` |
| 3 | Sans programme actif, l'action mise en avant est « Séance libre » — la moins structurée. Le problème 3 de juillet n'a été traité que pour le cas « programme déjà actif ». | `(tabs)/strength.tsx`, branche `today.state === 'none'` |
| 4 | Un programme **ne peut jamais commencer aujourd'hui** : la date de début est initialisée au lundi suivant. | `planning/plan.tsx:72` |
| 5 | `dayAssignments` démarre vide et `canPlan` reste faux tant que chaque séance n'a pas son jour, sans aucune suggestion d'espacement. | `planning/plan.tsx` |
| 6 | « Dupliquer » est une contrainte de modèle exposée à l'utilisateur : un programme éditorial ne peut pas être suivi directement. | `programs/[id].tsx` |
| 7 | La progression dans le programme est **calculée et jamais affichée** : `usePriorWeekAdherence` (MUSC-F15) n'a qu'un appelant, et c'est le moteur de suggestion de charge. | `workout.tsx` |

### Séance en cours

| # | Constat | Source |
|---|---|---|
| 8 | Onze blocs empilés, ≈ 560 px au niveau détaillé. « Valider la série » — répété 30 à 40 fois par séance — est le dernier de la pile. | `components/workout/CurrentSetCard.tsx` |
| 9 | Le clavier recouvre la validation : `adjustResize` et aucun `KeyboardAvoidingView`. | `AndroidManifest.xml:39`, `workout.tsx` |
| 10 | **Aucun retour à la validation** — ni haptique, ni son, ni animation. La spec navigation-ux §4.2 l'exige ; le planning et le running en ont, la muscu non. | `workout.tsx:258` (vibration = fin de repos seulement) |
| 11 | Le réglage de repos occupe une ligne permanente sur chaque série, à tous les niveaux d'affichage. C'est un réglage d'exercice. | `CurrentSetCard.tsx` |
| 12 | Un tap, deux effets : l'en-tête d'exercice appelle `onSelect` **et** `toggleExpanded`. Taper l'exercice courant le replie. | `components/workout/ExerciseList.tsx` |
| 13 | « Séance terminée ? » est une question **sans bouton** ; l'action est en petit en haut à droite. Et « Mettre en pause » nomme un état qui n'existe pas (MUSC-F6). | `workout.tsx` |

### Après la séance

| # | Constat | Source |
|---|---|---|
| 14 | Le résumé ne montre pas la séance : cinq agrégats, aucun détail par exercice, aucune comparaison. | `workout-summary.tsx` |
| 15 | Deux échelles d'intensité pour la même notion : RPE/RIR 1-10 en séance (UX-05), cinq étoiles muettes au résumé. | `workout-summary.tsx` |
| 16 | L'historique ne permet pas de reconnaître une séance (date + durée + RPE), alors que `volumeKg` est déjà chargé. Filtres programme/muscle et suppression promis par la spec §6.1, absents du repository. | `history/index.tsx`, `workout-repository.ts` |
| 17 | Huit sections empilées sur Progression, et les quatre états vides pointent vers `/workout` — un cul-de-sac affichant « Aucune séance en cours ». Le code admet le dépassement d'ADR-007. | `progress/index.tsx:146` et lignes 135, 153, 165, 254 |

## 3. Ce que vivent trois pratiquants

- **Léa, débutante.** Installe l'app un mardi, répond à l'onboarding, et trouve « Séance libre » plus
  sept tuiles vides. Ses réponses n'ont rien changé. Si elle trouve les programmes : dupliquer,
  affecter trois jours à la main, commencer **lundi prochain**. Neuf écrans et six jours.
- **Marc, intermédiaire.** Son entrée en séance est bonne (2 taps). C'est pendant que ça coince :
  il valide sans rien sentir, tape ses reps et perd le bouton sous le clavier, quinze fois. Après,
  le résumé lui donne des agrégats sans ses charges, l'historique des dates sans nom, et il suit un
  cycle de huit semaines sans savoir où il en est. **C'est le profil qui perd le plus de valeur
  déjà livrée.**
- **Sofiane, avancé.** Tout ce qu'il lui faut existe (RIR, dropsets, supersets, deload, %1RM, DOTS).
  Il paie cette richesse au format : 560 px de carte, et ses analyses en 6ᵉ et 7ᵉ position d'un
  écran de huit sections. **Servi, mais lentement.**

## 4. Arbitrages tranchés (Florian, 09/09/2026)

| Question | Retenu |
|---|---|
| Ampleur | Tout le pilier, Progression et Historique compris |
| Carte de série | Barre d'action **collante** en bas |
| Niveaux d'affichage | Les trois conservés, exposés depuis la séance |
| Widgets du hub | Plafond testé + masquage des tuiles vides |

Principe qui traverse la refonte : **l'écran s'organise autour du geste, pas autour des données
disponibles.**

Découpage : l'audit proposait six lots. **Florian a tranché pour un lot unique** le 10/09/2026 →
US [MUSCU-UX01](../specs/functional/us/muscu-ux01-refonte-pilier-musculation.md).

## 5. Réserves

- Rien n'a été observé sur un device : les hauteurs sont calculées depuis les styles source.
- Les trois profils sont des parcours simulés à partir du code, pas des entretiens.
- Le back-office est hors périmètre ; `/planning` est pilier-agnostique, donc la non-régression
  course doit être vérifiée.
- CONF-07 a soldé WCAG AA le 01/08 : une barre d'action collante crée de nouvelles zones à
  vérifier au lecteur d'écran.
