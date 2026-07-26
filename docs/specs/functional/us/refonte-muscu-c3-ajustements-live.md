---
id: REFONTE-C3
titre: "Écran de séance : ajustements en direct"
roadmap: [3.32, 3.17, 3.28]
catalogue: []
etape: close
branche: feature/refonte-muscu-c3
maj: 20/07/2026
---
# US Refonte-C3 — Écran de séance : ajustements en direct

> **Chantier refonte Muscu**, US-C **découpée en 3 sous-US** (C1 ✅ → C2 ✅ → **C3**). **C3 = les ajustements
> en direct** de la séance : réorganiser les exercices restants, « machine prise » (renvoyer un exercice à plus
> tard), superset (enchaîner 2 exercices, repos après la paire), remplacer un exercice, note persistante par
> exercice, suggestion de progression discrète. Corrige le **problème 4** de l'[audit](../../../refonte-muscu/audit-flux.md)
> (points **10, 19, 20, 22** de l'[analyse](../../../refonte-muscu/analyse-seance-en-cours.md)).
> Dépend de C1 (livré) et C2 (livré : types de séries dont `superset`, RPE/série). Absorbe le reste de
> **MUSC-F4** (sans le point démo, abandonné) du backlog. Branche : `feature/refonte-muscu-c3` ·
> Date : 20/07/2026 · **Statut : à valider (pas de code avant validation).**
> **🔴 Migration cloud requise** (nouvelle table `exercise_notes` — note par exercice, seule brique du
> périmètre C3 qui touche le cloud).
> **Hors périmètre** : accès démo pendant la séance (**abandonné**, décision Florian/Damien 20/07/2026 — voir
> [musculation.md §3.3](../musculation.md#33-démonstrations-visuelles-gifvidéo--abandonné)).

## 0. Contexte

Après C1 (flux guidé + garde-fous) et C2 (types de séries, RPE/série, charge planifiée/réalisée), l'écran de
séance reste **figé dans son déroulé** : l'ordre des exercices est celui décidé au démarrage (programme ou
ajout manuel), sans possibilité de le changer en cours de séance ; impossible de remplacer un exercice sans
l'abandonner ; aucune note ne survit d'une séance à l'autre (ex. réglage de siège d'une machine) ; le type
`superset` existe (C2, sélectionnable) mais **ne fait rien de spécial** — il se comporte comme un type normal,
sans logique d'enchaînement ni de repos différé ; aucune suggestion n'aide à progresser d'une séance à l'autre.

Décisions de cadrage (brainstorming Florian, 20/07/2026) :
- **Remplacer un exercice** : réutilise le **picker existant** (`exercises.tsx`, déjà utilisé pour « + Ajouter
  un exercice ») — l'utilisateur choisit n'importe quel exercice de la bibliothèque. **Pas** de système de
  « variantes suggérées » (roadmap 3.20, toujours absent du modèle) : hors périmètre C3, sujet séparé.
- **Réorganiser** + **« machine prise »** sont **un seul mécanisme** : flèches **↑ / ↓** sur chaque exercice
  restant (même patron que le réordonnancement des repas nutrition, `moveEntry`) + un raccourci **« Plus
  tard »** qui envoie l'exercice en fin de liste des exercices restants en 1 tap. Aucune dépendance nouvelle
  (pas de drag-and-drop).
- **Superset** : **liaison positionnelle**, sans nouvelle colonne. Deux exercices **adjacents** dans la liste,
  dont les séries **du même rang** sont toutes deux `set_type = 'superset'`, sont traités comme un couple : le
  repos ne se déclenche **qu'après la 2ᵉ** série du couple. Fonctionne pour une séance planifiée (l'admin marque
  déjà `superset` sur les `exercise_plans` concernés) comme pour une séance libre (marquage en direct via le
  sélecteur de type, déjà livré en C2).
- **Suggestion de progression** : règle **RPE-aware**. Si la dernière fois qu'un exercice a été fait, ses séries
  n'ont **pas** été marquées `failure` et le **RPE** enregistré (si présent) est **≤ 7**, on suggère
  discrètement une progression (+incrément de charge ou +1 rep). Si une série a échoué (`failure`) ou le RPE
  était **≥ 8**, aucune suggestion n'est affichée (on reste stable). **Aucune logique de deload** (roadmap 3.8,
  stagnation sur plusieurs semaines) — hors périmètre C3, sujet séparé (nécessiterait une tendance
  multi-séances, pas juste la dernière fois).

## 1. Périmètre à livrer (C3)

- **Réorganiser les exercices restants** : flèches ↑/↓ dans la liste dépliée/repliée (exercices **non
  entièrement validés** uniquement).
- **« Plus tard »** : raccourci qui envoie l'exercice courant en fin des exercices restants (garde le focus
  cohérent — bascule sur le nouvel exercice en tête).
- **Superset** : réactivation du chip `superset` dans le sélecteur de type (C2 l'avait exclu, réservé à C3) +
  logique de couple (repos différé après la 2ᵉ série du couple, focus qui bascule directement vers le
  partenaire sans repos entre les deux).
- **Remplacer un exercice en direct** : action qui rouvre le picker `exercises.tsx` ; les séries **non encore
  validées** de l'exercice basculent vers le nouvel exercice choisi ; les séries **déjà validées** gardent
  l'exercice d'origine (historique/volume/records non réécrits).
- **Note par exercice persistante** : champ texte libre par (utilisateur, exercice), affiché sous le nom de
  l'exercice en séance, survit d'une séance à l'autre. **Migration** (`exercise_notes`).
- **Suggestion de progression discrète** : indication informative (non tappable, non appliquée
  automatiquement) sur la carte focus, basée sur la dernière fois + RPE.
- **i18n** FR/EN ; offline-first.

**Hors périmètre (déjà tranché, ne pas implémenter ici) :**
- **Accès démo pendant la séance** — **abandonné** (décision produit, pas seulement différé).
- **Variantes suggérées** (roadmap 3.20) — remplacé par le picker existant.
- **Progression automatique du plan** (roadmap 3.7) et **deload/stagnation** (roadmap 3.8) — sujets séparés,
  nécessitent une tendance multi-séances.
- **Circuits à 3+ exercices** (au-delà du superset en paire) — le point 20 validé ne couvre qu'une paire.
- **Pause/reprise sous 4h formalisée** et **clôture automatique à 3h** — restent différées (notées en C1).

## 2. Comportement attendu

### 2.1 Réorganiser + « Plus tard »
- Dans la **liste des exercices** (repliée ou dépliée), chaque exercice **non entièrement validé** affiche deux
  flèches **↑ / ↓** (à côté du chevron déplier/replier) et une action **« Plus tard »**.
- **↑ / ↓** : échange la position de cet exercice avec le **voisin non entièrement validé** au-dessus/en-dessous
  (les exercices déjà 100% validés restent à leur place, ne participent pas au réordonnancement — cf. §4.3
  « exercices restants »).
- **« Plus tard »** : déplace l'exercice en **dernière position** parmi les exercices restants (non
  entièrement validés). Si l'exercice déplacé était l'exercice courant (focus), le **focus bascule** sur le
  nouvel exercice en tête des restants.
- Un exercice **100% validé** n'affiche ni flèches ni « Plus tard » (il ne bouge plus).

### 2.2 Superset
- Le sélecteur de type (C2) réaffiche le chip **« Superset »** (masqué depuis C2 en attendant C3).
- Une série marquée `superset` reste **adjacente** (même rang) à celle d'un **autre exercice voisin** dans la
  liste, elle aussi `superset` → les deux forment un **couple** pour ce rang.
- **Validation de la 1ʳᵉ série du couple** : enregistre, **bascule directement** le focus sur la série jumelle
  de l'exercice partenaire (**sans repos**), sans passer par l'exercice suivant dans l'ordre normal.
- **Validation de la 2ᵉ série du couple** : enregistre, **puis déclenche le repos** (durée = celle de
  l'exercice de la 2ᵉ série), avance ensuite normalement.
- Si le rang suivant de l'un des deux exercices n'a **pas** de partenaire `superset` adjacent au même rang (ex.
  nombre de séries différent, ou le voisin a été déplacé par un réordonnancement) : la série se comporte en
  série `superset` **isolée** — repos normal après validation, aucune erreur, dégradation silencieuse.
- Compte dans le volume/les records comme un type normal (seul `warmup` — et `duration` pour les records — sont
  exclus, règle C2 inchangée).

### 2.3 Remplacer un exercice
- Action « Remplacer » sur l'exercice (liste dépliée) → ouvre le **picker existant** (`exercises.tsx`), en mode
  **remplacement**. Dans ce mode, le picker **exclut les exercices déjà présents** dans la séance en cours
  (comparaison avec les `exerciseId` des `entries` actuelles) — **impossible de remplacer par un exercice déjà
  en cours de séance** (évite la fusion de deux groupes sous le même exercice, voir §3).
- Après choix d'un nouvel exercice : les séries **non validées** de l'exercice remplacé changent d'`exercise_id`
  (deviennent des séries du nouvel exercice, gardent leur `order_index`/position). Les séries **déjà
  validées** ne sont **pas** touchées (restent attribuées à l'exercice d'origine : volume, records et
  historique de cette séance ne sont pas réécrits a posteriori). Concrètement, un même exercice « source » peut
  donc apparaître deux fois d'affilée dans `entries` juste après un remplacement partiel (ses séries validées
  d'un côté, le nouvel exercice avec les séries restantes de l'autre) — c'est attendu, pas une anomalie.
- Si l'exercice n'a **aucune** série validée, le remplacement change simplement l'exercice de bout en bout (cas
  le plus fréquent : remplacer avant d'avoir commencé).
- La **note persistante** (§2.5) suit l'exercice, pas la série : après remplacement, la note affichée est celle
  du **nouvel** exercice (peut être vide si jamais notée).

### 2.4 Suggestion de progression
- Sur la carte focus, sous la ligne « La dernière fois : … » (C1), une ligne discrète optionnelle, **adaptée au
  type** des séries qualifiantes de la dernière fois (voir règle §3) :
  - Séries **normales/dropset/échec/poids de corps lesté** (charge renseignée) : « Essaie {charge + incrément}
    {unité} ou {reps + 1} reps ».
  - Séries **poids de corps sans lest** (`weightKg` nul) : uniquement « Essaie {reps + 1} reps » (pas de volet
    charge, rien à incrémenter).
  - Séries **durée** (`duration`) : « Essaie {durée + 10 s} » (pas de volet reps).
- **Non tappable, non appliquée automatiquement** : purement informative, l'utilisateur ajuste lui-même via les
  steppers existants s'il le souhaite. Absente si aucune donnée exploitable (1ʳᵉ fois sur l'exercice, dernière
  fois en échec/RPE élevé).

### 2.5 Note par exercice
- Champ texte libre, affiché sous le nom de l'exercice sur la **carte focus** (édition directe) et visible
  (lecture) dans la **liste dépliée**.
- Persiste par **(utilisateur, exercice)** — indépendant de la séance : modifiée pendant une séance, elle est
  déjà présente lors de la **prochaine** séance impliquant cet exercice (même via un programme différent ou en
  séance libre).
- Sauvegarde **à la perte de focus** (blur), comme la note de séance (C1).

## 3. Règles métier

- **Réordonnancement** : ne concerne que les exercices **non entièrement validés** (`doneCount < total`). Les
  exercices déjà terminés gardent leur **position absolue** dans la séance (ils n'échangent jamais de place
  avec un autre exercice, fait ou non) ; seul l'**ordre relatif des exercices restants entre eux** change,
  répartis sur les positions qu'ils occupaient déjà collectivement. **Renumérotation complète** (pas d'échange
  partiel) : voir algorithme §4.3 — nécessaire car `order_index` n'est **pas** garanti contigu par exercice dès
  qu'`addSet` a été utilisé (il attribue un `order_index` **global**, pas relatif à l'exercice, `nextOrderIndex`
  dans [workout-repository.ts:377-385](../../../../apps/mobile/src/data/repositories/workout-repository.ts)).
- **Superset** : couple déterminé **par adjacence + rang**, pas par un identifiant stocké. Aucune garde ne
  bloque un réordonnancement qui casserait une paire existante (dégradation silencieuse, §2.2).
- **Remplacement** : ne réécrit **jamais** les séries déjà validées (`done = true`) — les records/volume déjà
  calculés pour cette séance restent corrects et immuables. Le picker de remplacement **exclut les exercices
  déjà présents** dans la séance (§2.3) : on ne fusionne jamais deux groupes d'`entries` sous le même
  `exerciseId` (éviterait un décompte `doneCount/total` incohérent avec un bloc non contigu, et un rang de
  superset qui se décale silencieusement).
- **Suggestion de progression** : calculée à partir de la **dernière séance terminée** contenant l'exercice
  (même logique que `useLastPerformance`, C1), étendue avec `set_type` et `rpe`. Ne considère que les séries
  **qualifiantes** de cette dernière fois : `normal`/`dropset`/`failure`/`bodyweight`/`duration` (les `warmup`
  restent hors calcul, comme pour la dernière perf C1) :
  - Aucune série qualifiante marquée `failure`, **et**
  - RPE **maximum** (le plus exigeant des séries de la dernière fois — critère volontairement **conservateur** :
    une seule série difficile suffit à ne pas pousser plus loin) enregistré parmi ces séries **≤ 7** (ou
    **absent** sur toutes → traité comme éligible, la suggestion reste utile même sans RPE renseigné — cohérent
    avec RPE optionnel/masqué en C2)
  - → suggestion affichée, **adaptée au type** des séries qualifiantes (voir §2.4 : charge, reps, ou durée selon
    le cas ; poids de corps sans lest → reps seules). Sinon (au moins une `failure`, ou RPE **≥ 8** sur au moins
    une série) → aucune suggestion (pas de recul de charge proposé : ce n'est **pas** du deload, juste
    l'absence de suggestion).
  - Incrément de charge identique à celui des steppers (2,5 kg par défaut, converti selon l'unité active) ;
    incrément de durée = 10 s ; alternative « +1 rep » proposée en parallèle quand les reps sont pertinentes.
- **Note par exercice** : un seul enregistrement par (utilisateur, exercice) — pas d'historique de versions, la
  note est **remplacée** à chaque modification (comme la note de séance). Champ **nullable** en base (aligné
  sur `workouts.notes`, pas de contrainte `NOT NULL`) : `note = null` signifie « pas de note », la ligne
  `exercise_notes` peut exister avec `note = null` (pas besoin de soft-delete pour « vider » une note).
- **Offline-first** : toutes les écritures optimistes locales, y compris le réordonnancement (renumérotation
  d'`order_index` en local, synchro en arrière-plan).

## 4. Architecture

### 4.1 Migration (🔴 checkpoint cloud)
Nouvelle table **`exercise_notes`**, patron identique à
[20260712120000_running_pace_records.sql](../../../../supabase/migrations/20260712120000_running_pace_records.sql)
(table isolée « utilisateur », select/insert/update sans delete, soft delete via `deleted_at`) — SQL complet,
prêt à copier dans le fichier de migration :
```sql
-- US Refonte-C3 : note persistante par (utilisateur, exercice), affichée en séance.
-- Réf. : docs/specs/functional/us/refonte-muscu-c3-ajustements-live.md.

create table public.exercise_notes (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index exercise_notes_user_exercise_uidx
  on public.exercise_notes (user_id, exercise_id)
  where deleted_at is null;

-- Trigger updated_at (fonction définie dans 20260705150000_init_conventions.sql)
create trigger set_updated_at before update on public.exercise_notes
  for each row execute function public.set_updated_at();

-- Publication logique PowerSync (réplication vers l'instance PowerSync provisionnée)
alter publication powersync add table public.exercise_notes;

-- RLS (Row Level Security) — table « utilisateur », pas de delete (soft delete).
alter table public.exercise_notes enable row level security;

create policy exercise_notes_select on public.exercise_notes
  for select using (user_id = auth.uid());
create policy exercise_notes_insert on public.exercise_notes
  for insert with check (user_id = auth.uid());
create policy exercise_notes_update on public.exercise_notes
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
```
> ⚠️ `note` est **nullable** (pas de `NOT NULL`), aligné sur `workouts.notes` — cohérent avec
> `setExerciseNote(exerciseId, note: string | null)` (§4.4) qui doit pouvoir écrire `null`.

`npm run db:new refonte_muscu_c3_note_exercice` → `db:push:dry` → **go explicite Florian** → `db:push` →
`db:types` → cocher `supabase/MIGRATIONS.md`.

### 4.2 PowerSync (`apps/mobile/src/powersync/schema.ts`)
Nouvelle table `exercise_notes` (`user_id`, `exercise_id`, `note: column.text`, timestamps, `deleted_at`),
ajoutée au `Schema`.

### 4.3 Repository — réorganisation (`workout-repository.ts`)

⚠️ **`order_index` n'est pas garanti contigu par exercice** : `nextOrderIndex` calcule un **max global sur
toute la séance** ([workout-repository.ts:370-378](../../../../apps/mobile/src/data/repositories/workout-repository.ts)),
utilisé aussi bien par `addExerciseToWorkout` que par `addSet`. Concrètement, une séance `[A(0,1,2), B(3,4,5),
C(6,7,8)]` où l'on fait `addSet` sur **A** en cours de séance donne à A un 4ᵉ `order_index = 9` : A occupe
désormais `{0,1,2,9}`, un ensemble **non contigu** qui chevauche B et C. Un simple **échange de plages** entre
deux blocs ne fonctionne donc plus dans ce cas, pourtant courant. La réorganisation doit procéder par
**renumérotation complète**, pas par échange partiel :

1. Prendre les `entries` dans leur ordre actuel (première apparition, comme aujourd'hui).
2. Séparer les positions **absolues** occupées par les exercices **terminés** (`doneCount === total`, restent
   figées) de celles occupées par les exercices **restants** (`doneCount < total`).
3. Appliquer l'opération demandée (échange ↑/↓ avec le voisin restant, ou déplacement en fin) **uniquement sur
   la sous-liste ordonnée des exercices restants** — les exercices terminés ne bougent jamais entre eux ni par
   rapport aux restants : leurs positions absolues sont un ensemble fixe, seul l'exercice restant qui occupe
   chaque position « restante » change.
4. Reconstruire la séquence complète des `entries` (terminés à leurs positions absolues inchangées, restants
   réassignés selon le nouvel ordre).
5. **Renumérote intégralement** : parcourt cette séquence reconstruite et réattribue un `order_index`
   strictement séquentiel (0, 1, 2, …) à **toutes** les séries de la séance, exercice par exercice, en
   conservant l'ordre interne des séries de chaque exercice (leur rang ne change pas). Exécuté en **une seule
   transaction** (`powerSync.writeTransaction`) qui met à jour `order_index` de chaque ligne `workout_sets`
   concernée — coût négligeable (quelques dizaines de lignes par séance au plus).
- `reorderExercise(workoutId, exerciseId, direction: 'up' | 'down'): Promise<void>` : échange l'exercice donné
  avec son voisin restant dans la direction demandée (sous-liste des restants), puis renumérote (étape 5).
- `sendExerciseToEnd(workoutId, exerciseId): Promise<void>` (« Plus tard ») : place l'exercice en dernière
  position de la sous-liste des restants, puis renumérote.
- `replaceExercise(workoutId, exerciseId, newExerciseId): Promise<void>` : `UPDATE workout_sets SET exercise_id
  = newExerciseId WHERE workout_id = ? AND exercise_id = ? AND done = 0 AND deleted_at IS NULL` (transaction, ne
  touche que les séries non validées ; **aucune renumérotation nécessaire**, l'`order_index` des séries
  déplacées ne change pas). Le picker appelant doit avoir **exclu** au préalable les exercices déjà présents
  dans la séance (§2.3/§4.6) — cette fonction ne le revérifie pas (l'appelant est responsable du filtrage).

### 4.4 Repository — note par exercice (nouveau fichier ou section dédiée)
- `useExerciseNote(exerciseId): { note: string | null; isLoading: boolean }` (lecture réactive,
  `user_id` implicite via RLS/bucket PowerSync).
- `setExerciseNote(exerciseId, note: string | null): Promise<void>` : upsert dans `exercise_notes` (insert si
  absent, patch si déjà présent — clé `(user_id, exercise_id)`). `note = null` ou chaîne vide **trimée** →
  enregistre `null` (colonne nullable, §4.1) ; la ligne **reste** en base (pas de soft delete), simplement avec
  `note = null` — cohérent avec `setWorkoutFeedback`/notes de séance (C1) qui suit le même principe.

### 4.5 Logique superset (`workout.tsx`)
- Étendre `resolveCurrentSet`/le calcul de focus **et** `onValidate`
  ([workout.tsx:246-265](../../../../apps/mobile/src/app/workout.tsx) — qui aujourd'hui déclenche
  inconditionnellement `restEndsAt` et vide `focusOverride` après chaque `updateSet`) : quand la série courante
  est `superset`, chercher le **partenaire** (exercice adjacent dans `entries`, même rang, `setType ===
  'superset'`, non validé).
  - Partenaire trouvé et **pas encore validé** → après validation de la série courante, focus **directement**
    sur la série partenaire (`setFocusOverride` sur l'exercice partenaire), **sans appeler la mise en route du
    repos** (ne pas poser `restEndsAt`).
  - Partenaire trouvé et **déjà validé** (on vient de faire la 2ᵉ du couple) → déclenche le repos normalement
    (comportement `onValidate` actuel inchangé), avance ensuite selon la logique standard.
  - Pas de partenaire → comportement standard (repos après chaque série).

### 4.6 UI
- **`CurrentSetCard.tsx`** : réintégrer `'superset'` dans `TYPE_CHIPS`
  ([CurrentSetCard.tsx:14](../../../../apps/mobile/src/components/workout/CurrentSetCard.tsx), qui l'exclut
  aujourd'hui — commentaire à jour) ; ligne de suggestion de progression (sous « dernière fois ») ; champ note
  éditable (sous le nom de l'exercice).
- **`ExerciseList.tsx`** : flèches ↑/↓ + « Plus tard » (exercices restants seulement) ; action « Remplacer »
  (ouvre le picker en mode remplacement, §4.7) ; affichage de la note (lecture) ; ajouter `'superset'` à
  `BADGE_TYPES` ([ExerciseList.tsx:12](../../../../apps/mobile/src/components/workout/ExerciseList.tsx), qui
  l'exclut aujourd'hui) pour que le badge « Superset » apparaisse sur les séries du couple — visibilité du
  couple demandée en §2.2.
- **`workout.tsx`** : câblage des nouvelles actions repository.
- **i18n** : nouvelles clés (`workout.reorder.*`, `workout.later`, `workout.replace`, `workout.exerciseNote.*`,
  `workout.suggestion.*`), **plus** `workout.setType.superset` (label du chip, absent des locales aujourd'hui
  car jamais exposé jusqu'ici) et `workout.setTypeBadge.superset` (badge court, ex. « Super »). FR + EN, parité
  stricte.

### 4.7 Navigation — mode remplacement (`exercises.tsx`)
- `exercises.tsx` (picker) reçoit un **paramètre de route optionnel** `replaceExerciseId` (id de l'exercice à
  remplacer dans la séance active).
- **`onPick`** ([exercises.tsx:44-49](../../../../apps/mobile/src/app/exercises.tsx), qui appelle aujourd'hui
  **inconditionnellement** `addExerciseToWorkout` puis `router.back()`) doit **brancher** selon la présence de
  ce paramètre : si `replaceExerciseId` est fourni, appelle `replaceExercise(active.id, replaceExerciseId,
  item.id)` au lieu d'`addExerciseToWorkout`, puis `router.back()` (l'écran de séance reflète le changement par
  réactivité de `useActiveWorkout()`, sans canal de retour de valeur explicite — pas de mécanisme de ce type
  dans le routing actuel).
- La **liste affichée** (`items`, [exercises.tsx:38-42](../../../../apps/mobile/src/app/exercises.tsx)) doit, en
  mode remplacement, **exclure** les exercices déjà présents dans la séance active (comparaison avec les
  `exerciseId` d'`entries`) — filtrage appliqué avant le tri favoris/alphabétique existant.
- `workout.tsx` navigue vers `exercises.tsx` avec `router.push({ pathname: '/exercises', params: {
  replaceExerciseId: entry.exerciseId } })` depuis l'action « Remplacer » de `ExerciseList`.

## 5. Offline & données

- Réorganisation, « Plus tard », remplacement, note : écritures **locales optimistes**, synchro PowerSync en
  arrière-plan — aucun comportement réseau bloquant.
- **Seule** la migration `exercise_notes` est un **checkpoint cloud** (🔴, go explicite requis avant `db:push`).
- **Aucune nouvelle dépendance native** (pas de drag-and-drop, pas de module tiers).

## 6. Definition of Done

- [ ] Spec + plan + **maquette** validés (pas de code avant).
- [ ] Migration `exercise_notes` créée, prévisualisée, **poussée après go**, types régénérés, MIGRATIONS.md coché.
- [ ] Réorganiser (↑/↓) + « Plus tard » fonctionnels, limités aux exercices non entièrement validés.
- [ ] Superset : couple positionnel détecté, repos différé après la 2ᵉ série, dégradation silencieuse si
  partenaire absent ; chip réactivé dans le sélecteur de type.
- [ ] Remplacer un exercice : picker réutilisé (mode remplacement, **exclut les exercices déjà présents** dans
  la séance), séries non validées basculées, séries validées intactes.
- [ ] Note par exercice : persistée par (utilisateur, exercice), visible carte + liste, survit aux séances.
- [ ] Suggestion de progression : règle RPE-aware correcte (pas de suggestion si `failure` ou RPE ≥ 8),
  purement informative.
- [ ] Tests `shared` (si logique extraite en fonctions pures : règle de suggestion, détection de couple) verts ;
  typecheck/lint verts ; non-régression C1/C2 (flux guidé, types de séries, RPE, charge planifiée).
- [ ] i18n FR+EN (parité) ; offline-first ; PR relue par les deux devs.

## 7. Explicitement différé / abandonné

- **Accès démo pendant la séance** — **abandonné** (décision produit, pas un report).
- **Variantes suggérées** (3.20), **progression automatique du plan** (3.7), **deload/stagnation** (3.8),
  **circuits à 3+ exercices**, **pause/reprise 4h formalisée**, **clôture automatique 3h**.
