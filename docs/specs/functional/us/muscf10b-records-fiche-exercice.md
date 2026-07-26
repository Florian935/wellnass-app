---
id: MUSC-F10b
titre: "Section « records » sur la fiche exercice"
roadmap: []
catalogue: []
etape: close
branche: feature/muscf10b-records-fiche-exercice
maj: 22/07/2026
---
# US MUSC-F10b — Section « records » sur la fiche exercice

> **2ᵉ des 3 incréments** du chantier « fiche exercice » : F10a (socle, livré) → **F10b** (records sur la fiche) →
> F10c = MUSC-F2 (muscles secondaires + variantes, migration + admin). Cadrage validé Florian (brainstorming,
> maquette comparée — mise en page **tuiles** retenue). Branche : `feature/muscf10b-records-fiche-exercice`.
> **Statut : à valider (pas de code avant validation).** **Aucune migration.**

## 0. Contexte

La fiche exercice ([app/exercises/[id].tsx](../../../../apps/mobile/src/app/exercises/%5Bid%5D.tsx), livrée en
F10a) affiche aujourd'hui les infos statiques (nom, groupe, matériel, instructions, favori) mais **aucune donnée
de performance**. Les records personnels par exercice existent pourtant déjà :

- Table `personal_records` : 3 types — `max_weight` (charge max d'une série), `estimated_1rm` (1RM Epley),
  `best_volume` (meilleur volume d'une série = reps × charge). Une ligne par record battu, avec `achieved_at`.
- Hook **`useExerciseRecords(exerciseId)`** ([records-repository.ts:495](../../../../apps/mobile/src/data/repositories/records-repository.ts#L495))
  renvoie déjà, par exercice, le meilleur record **par type** (`BeatenRecord` : `value`, `type`, `achievedAt`,
  nom résolu). L'écran **Progression** (Muscu → Progression) l'utilise déjà pour afficher des tuiles records
  (via `units.formatWeight`, clés i18n `progress.records.*`), **mais sans les dates ni la notion de 1RM réel**.

Ce qui **n'existe pas** : le **« 1RM réel »** — une série réellement effectuée à **1 répétition**. Ce n'est pas
un type de `personal_records` ; il se dérive de l'historique `workout_sets` (charge max des séries à `reps = 1`).

Décisions de cadrage (brainstorming Florian, 22/07/2026) :
- Afficher sur la fiche : **1RM (réel si présent, sinon estimé)**, **charge max**, **meilleur volume**, chacun
  avec sa **date**.
- Mise en page **tuiles** (cohérente avec l'écran Progression), en **mode lecture** de la fiche.
- Ajouter un lien **« Voir la progression »** → ouvre l'écran Progression **pré-sélectionné sur cet exercice**.
- **Aucune migration** (lecture seule sur `personal_records` + `workout_sets`).

## 1. Périmètre à livrer

- **Section « Tes records »** sur la fiche (mode lecture), en tuiles : **1RM** (réel/estimé + badge quand estimé),
  **Charge max**, **Meilleur volume** — label · valeur · date par tuile.
- **Dérivation du 1RM réel** : hook/`useQuery` lisant la charge max d'une série `reps = 1` (validée, hors
  échauffement/durée) pour l'exercice, + la date de la séance correspondante.
- **Fonction pure** de sélection du 1RM affiché : réel si disponible, sinon estimé (drapeau `real`).
- **Lien « Voir la progression »** → `/progress?exerciseId=…` ; **extension de l'écran Progression** pour
  pré-sélectionner l'exercice depuis ce paramètre.
- **i18n** FR/EN ; unités métrique/impérial ; dates JJ/MM/AAAA ; offline-first (lecture seule).

**Hors périmètre :**
- Muscles secondaires + variantes/alternatives → **F10c (= MUSC-F2)**.
- Courbes de progression sur la fiche (elles restent dans l'écran Progression ; on n'y met qu'un **lien**).
- Refonte/partage d'un composant records commun entre `/progress` et la fiche → **dette notée**, différée.
- Toute écriture / recalcul de records (F10b est **lecture seule**).

## 2. Comportement attendu

### 2.1 Section records (fiche, mode lecture)
- Sous les champs infos, une section **« Tes records »** en **tuiles côte à côte** (style écran Progression).
- Jusqu'à 3 tuiles, chacune : **label** (ex. « 1RM », « Charge max », « Volume »), **valeur**, **date** (« JJ/MM »
  ou « JJ/MM/AAAA » selon la place — voir §3), sur le modèle visuel validé (maquette option A).
- La section n'apparaît **pas** en mode édition (formulaire de modification d'un exo perso, F10a).

### 2.2 Ligne 1RM (réel vs estimé)
- Si l'utilisateur a **au moins une série validée à 1 rep** (hors échauffement/durée, charge non nulle) pour cet
  exercice → afficher le **1RM réel** = la **charge max** parmi ces séries, avec la **date** de la séance qui l'a
  produite. Pas de badge (ou badge « réel »).
- Sinon → repli sur le **1RM estimé** (`estimated_1rm` de `personal_records`) + **badge « estimé »** + sa date.
- Si ni l'un ni l'autre n'existe → la tuile 1RM est **absente**.

### 2.3 Charge max & meilleur volume
- **Charge max** = record `max_weight` (valeur + date). Absente si aucun record `max_weight`.
- **Meilleur volume** = record `best_volume` (valeur + date). Absente si aucun record `best_volume`.

### 2.4 États
- **Aucun record** (exercice jamais chargé/travaillé, ou 100 % poids du corps sans lest) → **aucune tuile** → un
  message « Aucun record pour l'instant » (réutilise `progress.records.empty`).
- **Chargement** → spinner discret (ou rien, cohérent avec le reste de la fiche).
- Exercice **au poids du corps** : s'il a des séries lestées, les records de charge peuvent exister ; sinon, pas
  de tuile de charge (comportement voulu, pas de valeur factice).

### 2.5 Lien « Voir la progression »
- Sous les tuiles, un lien/bouton **« Voir la progression »** → navigue vers l'écran Progression avec l'exercice
  **pré-sélectionné**.
- Dans l'écran Progression : si le paramètre `exerciseId` est présent, pré-charger l'exercice dans
  `selectedExercise` (aujourd'hui `null` au montage, sélection manuelle via le picker). Sans paramètre →
  comportement **inchangé**.

## 3. Règles métier

- **1RM réel** = `max(weight_kg)` sur les `workout_sets` de l'exercice tels que `reps = 1` **et** `done = 1`
  **et** `weight_kg IS NOT NULL` **et** `set_type NOT IN ('warmup','duration')`, joints aux `workouts` en statut
  `completed` non supprimés (pour la date `finished_at`). `deleted_at IS NULL` sur les séries. Renvoie la valeur
  **et** la date de la séance qui détient ce max (tri `weight_kg DESC, finished_at DESC`, `LIMIT 1`).
- **Sélection 1RM affiché** : réel si la dérivation ci-dessus renvoie une valeur, **sinon** l'`estimated_1rm` de
  `useExerciseRecords`. Fonction **pure** `pickOneRepMax(real, estimated)` → `{ value, date, real } | null`.
- **Unités** : les poids (`1RM`, `charge max`) passent par `units.formatWeight` (métrique/impérial, comme
  `/progress`). Le **volume** est un nombre sans unité de charge (cohérent avec `/progress` : `value.toFixed(0)`).
- **Dates** : format **JJ/MM/AAAA** (règle projet) ; une variante courte JJ/MM est admise si la tuile manque de
  place (à trancher au design/plan — cohérence visuelle avec la maquette option A).
- **Résolution `achievedAt`** : `useExerciseRecords` associe `MAX(value)` et `MAX(achieved_at)` par type ; comme
  un record ne fait que croître, la date la plus récente correspond au meilleur record → correct en pratique
  (limite connue, non bloquante).
- **Offline-first** : lecture seule, requêtes locales PowerSync réactives ; aucune écriture, aucune dépendance
  réseau.
- **Exos supprimés (F10a)** : sans objet ici — la fiche n'est accessible que pour un exo non supprimé ; les
  records restent lisibles tant que l'exo existe.

## 4. Architecture & données

### 4.1 Aucune migration
Lecture seule sur `personal_records` (déjà répliquée) et `workout_sets` / `workouts` (déjà répliquées).

### 4.2 Partagé (`packages/shared`)
- Fonction pure **`pickOneRepMax`** (nouvelle) : entrées `real: { value; date } | null` et
  `estimated: { value; date } | null` → sortie `{ value; date; real: boolean } | null` (réel prioritaire).
  Testable Vitest (réel présent, seulement estimé, aucun des deux). *(Si le placement dans `shared` s'avère
  artificiel — dépendances de types —, la loger dans le repo mobile avec un test jest ; à trancher au plan.)*

### 4.3 Repository (`apps/mobile/src/data/repositories/records-repository.ts`)
- **`useExerciseTopSingle(exerciseId)`** (nouveau) : `useQuery` renvoyant `{ value, achievedAt } | null` pour le
  **1RM réel** (requête §3). `isLoading` = résolution locale.
- Réutiliser **`useExerciseRecords(exerciseId)`** tel quel pour `max_weight` / `estimated_1rm` / `best_volume`
  (+ `achievedAt`).
- Éventuel hook composite `useExerciseFicheRecords(exerciseId)` assemblant les deux + `pickOneRepMax` pour livrer
  à l'UI une vue prête (`{ oneRepMax, maxWeight, bestVolume }`), **ou** composition faite dans le composant — à
  trancher au plan (préférence : un composite testable/minimal).

### 4.4 UI (`apps/mobile`)
- **Fiche `[id].tsx`** : nouvelle section « Tes records » (mode lecture uniquement), tuiles réutilisant le motif
  visuel de `/progress` (`units.formatWeight`, `colors.surfaceAlt`, etc.), + lien « Voir la progression »
  (`router.push({ pathname: '/progress', params: { exerciseId: exercise.id } })`).
- **Écran Progression `app/progress/index.tsx`** : lire `useLocalSearchParams` `exerciseId` ; si présent et
  qu'aucun exercice n'est encore sélectionné, charger l'exercice (via `useExercise`) et le poser dans
  `selectedExercise` (effet idempotent). Sans paramètre → inchangé. Vérifier la route `/progress` (comment elle
  est atteinte/enregistrée) au plan.
- **Composant tuile** : réutiliser/mutualiser le style des record-chips de `/progress` si simple ; sinon composant
  local à la fiche (dette de partage notée).

### 4.5 i18n
- Réutiliser `progress.records.type.max_weight` / `best_volume` et `progress.records.empty`.
- Nouvelles clés (FR/EN parité) : titre de section « Tes records », libellés **« 1RM réel »** / **« 1RM estimé »**
  (ou label « 1RM » + badge « estimé »), format « record du {{date}} » (ou date brute), lien
  **« Voir la progression »**.

## 5. Tests
- `pickOneRepMax` : fonction pure testée (réel prioritaire ; repli estimé ; null si aucun) — Vitest (shared) ou
  jest (mobile) selon placement §4.2.
- Non-régression : la fiche lecture (F10a) et l'écran Progression **sans** `exerciseId` restent inchangés
  (smoke). Un smoke sur la fiche vérifiant l'affichage/absence de la section records selon les données mockées.

## 6. Definition of Done
- [ ] Spec + plan + **maquette** (option A validée) — pas de code avant validation.
- [ ] Section « Tes records » en tuiles sur la fiche (mode lecture) : 1RM (réel/estimé + badge), charge max,
      volume — label · valeur · date ; unités respectées.
- [ ] 1RM réel dérivé de `workout_sets` (reps=1, validé, hors warmup/durée) + date ; repli estimé ; `pickOneRepMax`
      pur testé.
- [ ] États : aucun record → message ; exos sans charge → tuiles de charge absentes ; chargement propre.
- [ ] Lien « Voir la progression » → écran Progression **pré-sélectionné** ; `/progress` sans param inchangé.
- [ ] i18n FR/EN (parité) ; dates JJ/MM/AAAA ; **aucune migration** ; offline-first.
- [ ] typecheck/lint/tests verts ; PR relue par les deux devs.

## 7. Explicitement différé
- **F10c (= MUSC-F2)** : muscles secondaires + variantes/alternatives (migration + admin).
- Courbes de progression **sur** la fiche (restent dans l'écran Progression ; F10b n'ajoute qu'un lien).
- Composant records **partagé** entre `/progress` et la fiche (dette de mutualisation).
- Correction fine de l'appariement `value`/`achieved_at` dans `useExerciseRecords` (limite connue, non bloquante).
