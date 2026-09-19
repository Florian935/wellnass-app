---
id: MUSCU-UX05
titre: "Refonte du hub Musculation — un écran qui a quelque chose à dire"
roadmap: [3.63]
catalogue: [MUSC-05, MUSC-19, MUSC-21]
etape: recette
branche: dev
maj: 19/09/2026
---

# US MUSCU-UX05 — Refonte du hub Musculation

> Audit et maquettes validés par Florian le 19/09/2026, code livré le même jour.
> Canvas de design : **Hub Musculation** (7 planches, dont l'audit, les deux états du nouveau hub
> et les trois visages de la carte dominante).
>
> ⚠️ **Travail directement sur `dev`** (décision Florian).

## 1. Le problème

Demande initiale : « le dashboard est un peu monotone, on sent que les infos importantes manquent
peut-être, il faut que ce dash donne plus envie d'y regarder et de rester un peu de temps ».

L'audit a trouvé **cinq défauts et une cause**.

| # | Constat | Mesure |
|---|---|---|
| 1 | Le haut change cinq fois, le bas jamais | La scène a 5 états ; le corps rendait les mêmes 6 blocs dans les 5 cas |
| 2 | La moitié des blocs parlent de ce qui manque | 3 surfaces sur 9 s'excusent, sur un compte à 17 t/semaine |
| 3 | Une seule forme, répétée neuf fois | « À une série d'un record » = même poids visuel que « rien de prévu » |
| 4 | Le plus gros chiffre est rangé en bas | 17 470 kg après 5 blocs, sous un « ▼ 49 % » sans référence |
| 5 | Le bas de l'écran est un cul-de-sac | Une date, un volume, un planning vide |

**La cause, sous les cinq** : sur **36 analyses muscu** au catalogue, **20 sont livrées et testées**
— le hub en montrait **une** (les records à portée). Et `selectInsights` (INSIGHTS-01), qui sait
choisir les 1 à 3 analyses les plus pertinentes de l'instant **par pilier**, n'était appelé ni ici
ni nulle part côté muscu : ses consommateurs étaient l'accueil, `/insights` et une carte du
dashboard. **La pièce manquante n'était pas une donnée, c'était ce branchement.**

## 2. La contrainte qui tient la refonte

MUSCU-UX01 avait **ramené** ce hub de 9 blocs à 6 le 10/09, et un test plafonnait le registre à
3 widgets. « Plus sympa » ne pouvait donc pas vouloir dire « plus de blocs » — sinon on refaisait
l'inflation qui a justifié la coupe, onze jours plus tôt.

**Le budget ne bouge pas : neuf surfaces d'administration deviennent six cartes et deux lignes.**

## 3. Les règles

- **R1.** Une carte **se tait** quand elle n'a rien à dire. Aucune ne s'excuse (défaut 2).
- **R2.** Un seul bloc change tous les jours — le fil — et il porte **un** insight, jamais trois.
- **R3.** La carte dominante mesure **les exercices que la personne pratique**, quels qu'ils soient.
- **R4.** Aucune carte n'invente de donnée : chacune est branchée sur un module déjà livré.
- **R5.** Le rythme vertical est **cassé une fois** (la bande horizontale du mur), pas en variant
  les rayons de bordure.
- **R6.** Le hub n'a plus de grille de widgets. Voir §6.

## 4. Ce qui est livré

### Sortant

| Bloc | Pourquoi |
|---|---|
| « Et si… » | Ne dit ce qu'elle vaut qu'après 3 mesures de plus. Reste dans `/progress`. |
| Widget Volume total | Le volume monte quand on s'entraîne plus longtemps, pas quand on devient plus fort. |
| Widget Dernière | Une date et une durée — déjà dans la semaine. |
| Widget Planning | Vide les trois quarts du temps. Fusionné dans « Cette semaine ». |
| La zone « Suivre » et sa grille | Elle ne portait plus que les trois tuiles ci-dessus. |

### Entrant

| Bloc | Alimenté par | État |
|---|---|---|
| **Le fil du jour** | `selectInsights(pillar:'strength')` + `insight-adapters` | livré, jamais appelé côté muscu |
| **Tes charges** | `personal_records` (`estimated_1rm`) + `records.estimate1RM` | stocké et daté depuis MUSC-09 |
| **Ton corps** | `muscle-balance.ts` + `neglected-exercises.ts` | MUSC-05 + EXEC-01 |
| **Le mur** | `personal_records` (`max_weight`) | MUSC-09 |
| **Ton total** | `useLifetimeTonnage` | MUSC-19 |

### Briques neuves

- `packages/shared/src/load-progress.ts` (+ 24 tests) — les trois visages de la carte dominante.
- `packages/shared/src/insight-adapters.ts` — `candidateFromNeglectedExercise`, et l'identifiant
  `exercise_neglected` ajouté à `INSIGHT_ORDER`.
- `apps/mobile/src/data/repositories/strength-cards-repository.ts` — les trois lectures manquantes.
- `apps/mobile/src/components/stage/matter/silhouette-paths.ts` — les chemins de la silhouette,
  **extraits** pour être partagés par la scène et la carte « Ton corps ».

## 5. La carte dominante — trois visages, une seule carte

Première rédaction : **total SBD + DOTS**. Retour de Florian : « ça parle à un powerlifter, mais un
pratiquant de muscu ou un débutant qui ne fait pas les trois mouvements s'en fiche complètement ».

Le défaut était de nature : **le total SBD est une métrique de pratique déguisée en métrique de
progrès.** La carte mesure donc les exercices réellement pratiqués :

1. **`onboarding`** (< 8 semaines d'historique) — les gains bruts depuis la première séance, en
   kilos. Un débutant n'a pas de tendance exploitable mais des gains énormes, et c'est le moment où
   l'app risque le plus d'être désinstallée.
2. **`established`** (défaut) — **médiane** des écarts de 1RM estimé, plus le détail par exercice.
3. **`strength`** — le total SBD, **mérité** : proposé seulement quand les trois mouvements sont
   *désignés* (`sbdLifts`, MUSCPWR-01) **et** pratiqués ≥ 3 fois. Décision H appliquée à une carte.

Un powerlifter retrouve ses trois mouvements dans l'état ② **sans rien régler** — ce sont les siens.

### Les deux règles qui évitent le bruit

- **Médiane, jamais moyenne** : un exercice aberrant (+300 % après blessure) ne déplace pas le titre.
- **Séries de 3 à 10 reps uniquement** : Epley se dégrade vite en hautes répétitions. Le filtre vit
  dans la brique, pas dans l'appelant, pour qu'il soit impossible de l'oublier.

## 6. Écart assumé — la grille de widgets du hub muscu disparaît

Le hub perd sa personnalisation. C'est la conséquence directe de la maquette validée, et elle est
assumée : les trois tuiles restantes étaient de l'administration, et leur contenu reste atteignable
dans `/progress`.

Conséquences techniques, toutes sans migration :
- `strength-widgets.tsx` et son fichier de tests sont supprimés ;
- `STRENGTH_WIDGET_IDS`, `MAX_STRENGTH_WIDGETS` et l'entrée de registre disparaissent ;
- `'strength'` sort de `WIDGET_SCREENS` — une disposition enregistrée pour cet écran devient
  simplement illisible, la boucle de `widget-layout-repository` ne la parcourt plus.

🟠 **À confirmer par Florian en recette** : c'est le seul point de la refonte qui retire une
capacité à l'utilisateur plutôt que d'en ajouter une.

## 7. Recette

[RECETTES.md §78](../../../../RECETTES.md).
