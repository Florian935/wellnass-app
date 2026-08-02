---
id: MUSC-F15
titre: "Progression au niveau du programme"
roadmap: [3.7]
catalogue: []
etape: recette
branche: feature/muscf15-progression-programme
maj: 02/08/2026
---

# US MUSC-F15 — Progression au niveau du programme

> **Chantier scindé de MUSC-F7 le 01/08/2026** (roadmap 3.7, statut 🟡). Constat de l'audit qui a
> motivé le split : `exercise_plans.target_weight_kg` est une valeur **unique et figée** par plan
> (aucune notion de semaine), aucun taux de complétion hebdomadaire n'est calculé nulle part, et
> `planned_sessions.week_index` n'est posé qu'**une fois**, à la génération du planning — jamais
> recalculé. Cette spec pose le cadrage produit qui manquait avant tout code (voir §1).

## 0. Ce qui existe déjà — le patron à réutiliser, pas à réinventer

`computeProgressionSuggestion` (`packages/shared/src/workout.ts`, Refonte-C3 + MUSC-F7) suggère
**déjà**, à chaque série, une progression de charge/reps basée sur la dernière séance de
l'exercice — non contraignante, jamais appliquée automatiquement, affichée en 💡 dans
`CurrentSetCard`. MUSC-F7 lui a ajouté un **gate** : `opts.previousStruggled` (2 séances difficiles
d'affilée → suggestion de *baisse* au lieu de hausse).

**MUSC-F15 est un gate sur la fonction existante, pas une nouvelle mécanique de suggestion.** Au
lieu d'inventer un canal de suggestion séparé ou une cible de charge qui évolue en base, cette US
ajoute un **second gate** à `computeProgressionSuggestion` : si l'adhérence au programme de la
semaine précédente est insuffisante, la branche de hausse (`weightOrReps`) se **dégrade** en une
nouvelle branche dédiée (`weightHold`, §3 R4) — la charge reste stable tant que le programme n'est
pas suivi, avec une explication propre (§5), **pas** un recyclage du texte « poids de corps » déjà
utilisé pour un tout autre cas (relu, voir §1).

**Ce choix résout les 3 questions ouvertes du cadrage (BACKLOG.md)** :
- *Où stocker une cible qui évolue ?* Nulle part — aucune cible évolutive n'est stockée.
  `exercise_plans.target_weight_kg` reste figé, exactement comme aujourd'hui. La suggestion reste
  **calculée à la volée** à partir de la dernière série réalisée (comme le fait déjà
  `computeProgressionSuggestion`), jamais une valeur écrite en base.
- *Quelle fenêtre « semaine » ?* Le `week_index` **déjà posé sur `planned_sessions`** à la
  génération du programme (index relatif au plan, pas une semaine calendaire ISO) — cohérent avec
  le fait qu'une séance déplacée en glisser-déposer (MUSC-F9) garde son `week_index` d'origine.
- *Quand déclencher le recalcul ?* Il n'y a **aucun recalcul, aucune tâche de fond, aucune
  notification.* Le taux de complétion de la semaine `N-1` est évalué **à la volée**, au moment où
  l'utilisateur démarre une séance de la semaine `N` — exactement comme `previousStruggled` est
  évalué à la volée au démarrage d'une série, pas par un job planifié.

## 1. Surfaçage

**Aucun nouvel écran, aucun nouveau composant visuel.** Le gate s'intègre dans le mécanisme déjà
visible de `CurrentSetCard` (bulle 💡 non contraignante). Quand le gate est actif, l'utilisateur voit
une suggestion « reps seules » **avec une explication dédiée** (§5) — **pas** la clé
`workout.suggestion.reps` déjà utilisée pour les exercices au poids du corps (relu : réutiliser ce
texte confondrait deux situations différentes — « pas de notion de poids ici » vs « poids gelé cette
semaine, et voici pourquoi » —, avec un vrai risque qu'un utilisateur qui progressait régulièrement
lise un « bug » plutôt qu'un signal d'adhérence).

## 2. Ce qui existe déjà côté données

- `planned_sessions.week_index` (entier, posé une fois à la génération, `programId`-relatif — pas
  une semaine calendaire) et `planned_sessions.status` (`planned`/`done`/`skipped`) : déjà en base,
  déjà exposés par `PlannedSessionItem`.
- `workouts.program_id` et `workouts.planned_session_id` : déjà en base (colonnes existantes,
  confirmées en lisant `startWorkout`), mais **pas encore exposées** par `ActiveWorkout` (le type
  TS retourné par `useActiveWorkout()`) — seule extension de surface nécessaire, pas une migration.
- `computeProgressionSuggestion` : déjà là, à étendre d'une option (§3, R4).

**Aucune donnée nouvelle, aucune migration.**

## 3. Les règles

**R1 — Le taux d'adhérence porte sur la semaine `week_index - 1` du même programme.** Calculé comme
`nb séances `done` ÷ nb total de séances planifiées` de cette semaine (dénominateur = `done` +
`skipped` + `planned` encore non traitées — même lecture que MR-03 du catalogue : « done vs
planned+skipped+manquées »). Seuil : **≥ 80 %** (roadmap 3.7, chiffre donné, pas à re-trancher).

**R2 — Pas de semaine précédente connue → aucun gate, comportement inchangé.** Première semaine
d'un programme (`week_index = 0`) ou programme sans aucune séance en semaine `N-1` (dénominateur
nul) → `priorWeekAdherenceOk` vaut `true` par défaut (même convention que `previousStruggled` :
signal absent = comportement d'avant cette US, jamais un blocage par défaut).

**R3 — Le gate ne s'applique qu'aux séances dont le `week_index` est connu, c'est-à-dire démarrées
depuis une occurrence planifiée (`workouts.planned_session_id` non nul).** Deux cas distincts
donnent le même résultat (pas de gate, R2), à ne pas confondre en implémentation :
- **Séance vraiment libre** (`program_id` **et** `planned_session_id` tous deux nuls) — aucun
  programme, aucune notion de semaine possible.
- **Séance démarrée depuis un programme sans passer par le planning** (`program_id` non nul,
  `planned_session_id` nul — ex. `startWorkoutFromSession` appelée directement depuis la fiche
  programme, sans `plannedSessionId`) : rattachée à un programme, mais sans `week_index` résolu
  puisqu'il ne vit que sur la ligne `planned_sessions`, pas sur `workouts`/`sessions`.

Dans les deux cas, `priorWeekAdherenceOk` reste à sa valeur par défaut (`true`, R2) — le gate a
seulement besoin de `planned_session_id` pour résoudre le `week_index` du programme, peu importe
que `program_id` soit renseigné ou non.

**R4 — `computeProgressionSuggestion` gagne `opts.priorWeekAdherenceOk?: boolean` (défaut
`true`) et `ProgressionSuggestion` gagne une variante `{ kind: 'weightHold'; weightKg: number; reps:
number }`.** Seule la branche `weightOrReps` est concernée : si `priorWeekAdherenceOk === false`,
elle renvoie `{ kind: 'weightHold', weightKg: referenceSet.weightKg, reps: referenceSet.reps + 1 }`
(poids **inchangé**, reps toujours proposées à la hausse) au lieu de
`{ kind: 'weightOrReps', weightKg: referenceSet.weightKg + increment, reps: … }`. Variante dédiée
plutôt que réutiliser `kind: 'reps'` (§1) : le poids existe et reste affiché (contrairement au cas
poids de corps, où il n'y a structurellement pas de poids), seule la hausse est suspendue. Aucune
autre branche (deload, duration, reps déjà sans poids) n'est modifiée — la baisse de charge
(MUSC-F7) reste prioritaire et indépendante de ce gate : un exercice en difficulté n'a pas besoin
d'un deuxième signal pour ne pas monter en charge.

**R5 — Jamais une action imposée.** Même principe que MUSC-F7 / META-19 / RUN-14 : une suggestion
affichée, jamais une valeur pré-remplie modifiée à la baisse de ce fait — le champ poids au démarrage
reste `exercise_plans.target_weight_kg` (inchangé), le gate influence seulement le **texte suggéré**
à côté, que l'utilisateur peut suivre ou ignorer.

**R6 — Portée musculation uniquement.** `computeProgressionSuggestion` n'existe que pour les séances
de musculation (`workout_sets`). Le running n'a pas de mécanique de suggestion de charge par série —
étendre ce gate à un objectif de course serait une US distincte, non cadrée ici.

## 4. Périmètre

**Dans le périmètre** :
- `computeWeekCompletionRate` (fonction pure, packages/shared) : reçoit une liste de statuts déjà
  filtrée par `programId`+`week_index` par l'appelant (même discipline que `computeAcwr`, aucune
  notion de date ou d'ID ici), retourne le taux ou `null` si la liste est vide.
- Extension de `ProgressionSuggestion`/`computeProgressionSuggestion` (R4).
- `ActiveWorkout` gagne `programId`/`plannedSessionId`/`weekIndex` (résolu par jointure sur
  `planned_sessions` si `plannedSessionId` non nul).
- Nouveau hook `usePriorWeekAdherence(programId, weekIndex)` (repository mobile), requête sur
  `planned_sessions` filtrée `program_id` + `week_index = weekIndex - 1`.
- Câblage dans `workout.tsx` : le résultat du hook devient `opts.priorWeekAdherenceOk` de l'appel
  existant à `computeProgressionSuggestion`.

**Hors périmètre** :
- Toute notion de cible de charge **stockée** et évolutive dans `exercise_plans` — délibérément
  évité (§0).
- Notification ou récapitulatif de fin de semaine sur l'adhérence — déjà couvert par ailleurs
  (BILAN-01) si pertinent, pas dupliqué ici.
- Progression au niveau programme pour la course (R6).
- Réglage du seuil (80 %) par l'utilisateur — seuil fixe (R1), pas de préférence en V1.

## 5. i18n

Une seule clé neuve, `workout.suggestion.weightHold` (namespace existant `workout.suggestion.*`,
mêmes paramètres `{{weight}}`/`{{reps}}` que `weightOrReps`) :
- FR — « Reste à {{weight}}, essaie {{reps}} reps — la charge remonte en enchaînant mieux les
  séances du programme. »
- EN — « Stay at {{weight}}, try {{reps}} reps — weight goes back up once you're keeping up with
  the program. »

Ton factuel, explique la cause (adhérence) plutôt que de laisser deviner — même exigence que
META-19/RUN-18 (jamais un chiffre ou un changement de comportement sans repère).

## 6. Comportement offline

**Total.** Lecture PowerSync locale (`planned_sessions`, `workouts`, déjà synchronisées),
agrégation pure. Aucun réseau.

## 7. Accessibilité

Aucun changement : la bulle de suggestion (`CurrentSetCard`) est déjà un `Text` unique, énoncé tel
quel par un lecteur d'écran — cette US ne change que **quelle** clé i18n est choisie, jamais la
structure d'affichage.

## 8. Critères de recette

- [ ] 1. Semaine `N-1` du programme complétée à 100 % → la séance de la semaine `N` propose une
      hausse de charge (comme aujourd'hui, comportement inchangé).
- [ ] 2. Semaine `N-1` complétée à moins de 80 % (ex. 2 séances sur 4 marquées `done`) → la séance
      de la semaine `N` affiche la suggestion « Reste à P kg, essaie N reps… » (`weightHold`),
      jamais une hausse de poids, et le message explique la cause (adhérence).
- [ ] 3. Première semaine d'un programme (`week_index = 0`) → suggestion de hausse pleine
      (comportement inchangé, R2).
- [ ] 4. Séance libre (non planifiée) → suggestion de hausse pleine (comportement inchangé, R3).
- [ ] 5. Un exercice en deload (2 séances difficiles d'affilée, MUSC-F7) reste en deload même si
      l'adhérence de la semaine précédente est bonne — R4 ne s'applique qu'à la branche de hausse.
- [ ] 6. **Mode avion** : le comportement est identique (aucun réseau requis).
- [ ] 7. En **EN** : la nouvelle clé `workout.suggestion.weightHold` est grammaticale et distincte
      de `workout.suggestion.reps` (pas de confusion avec le cas poids de corps).
