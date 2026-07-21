# US Refonte-D — Templates de séance libre

> **Chantier refonte Muscu**, dernière US (**A** ✅ → **B** ✅ → **C1/C2/C3** ✅ → **D**). Corrige le
> **problème 5** de l'[audit](../../../refonte-muscu/audit-flux.md) : *« La séance libre repart de zéro à
> chaque fois. Impossible de sauvegarder mon push habituel sans créer un programme complet. Il manque un cran
> intermédiaire entre libre et programme structuré. »* US **arbitrable** (non bloquante pour le reste du
> chantier), cadrée par brainstorming avec Florian le 21/07/2026. Branche : `feature/refonte-muscu-d` ·
> **Statut : à valider (pas de code avant validation).**
> **🔴 Migration cloud requise** (2 nouvelles tables `workout_templates` / `workout_template_exercises`).

## 0. Contexte

Spec produit existante ([musculation.md §4.1](../musculation.md#41-deux-modes-de-démarrage-e4)) : *« Les templates de
séances (routines réutilisables) permettent de composer une liste ordonnée d'exercices avec séries cibles, puis
de démarrer depuis ce template ou à blanc. Édition / duplication / suppression des templates disponibles. »*

Décisions de cadrage (brainstorming Florian, 21/07/2026) :
- **Création — les deux chemins** : composer un template à froid (écran dédié, comme créer un programme) **et**
  l'enregistrer après coup depuis une séance libre déjà terminée (comme les repas types nutrition,
  `meal-template-repository.ts`). Un template reste une simple liste d'exercices + cibles, quelle que soit son
  origine.
- **Modèle de données** : **tables dédiées** `workout_templates` / `workout_template_exercises`, sur le patron
  des repas types (`meal_templates`/`meal_template_items`) — **pas** de réutilisation de `programs`/`sessions`/
  `exercise_plans` (US-A/B/C). Un template n'a ni niveau/objectif/durée, ni activation, ni planning calendrier ;
  le forcer dans le modèle programme obligerait à des colonnes non pertinentes et à filtrer ces lignes hors des
  écrans « Mes programmes »/bibliothèque.
- **Emplacement UI** : liste séparée **« Mes templates »**, distincte de « Mes programmes ».
- **Templates éditoriaux de démarrage (débutant)** : **reportés**. Cette US livre uniquement le mécanisme
  (créer / enregistrer / démarrer / dupliquer / supprimer un template **personnel**). Le contenu éditorial
  curaté est un sujet séparé (contenu admin), à traiter une fois le mécanisme livré.
- **Entrée de démarrage** : le bouton **« Séance libre »** existant sur le hub muscu ouvre un choix **« À
  blanc »** (comportement actuel inchangé) ou **« Depuis un template → »** (liste des templates), plutôt que
  d'ajouter un second bouton permanent sur un hub déjà chargé (widgets US-B).

## 1. Périmètre à livrer (D)

- **Composer un template à froid** : écran de création (nom) puis de composition (ajouter/retirer/éditer des
  exercices avec cibles — séries, reps, charge, repos, type de série), sur le patron de l'édition de programme
  (`programs/edit.tsx`, `SessionEditor`, `ExercisePicker`, `ExercisePlanEditor`).
- **Enregistrer une séance libre terminée comme template** : bouton sur l'écran résumé (`workout-summary.tsx`),
  visible uniquement pour une séance **libre** (non issue d'un programme). Nomme et crée le template à partir
  des exercices de la séance.
- **Démarrer une séance depuis un template** : pré-remplit une nouvelle séance libre avec les exercices/cibles
  du template (même mécanique de seed que « démarrer depuis programme », `planned_weight_kg` alimenté).
- **Gestion des templates** : liste « Mes templates », éditer (renommer, ajouter/retirer/réordonner/modifier les
  cibles des exercices), dupliquer, supprimer (soft delete, confirmation).
- **i18n** FR/EN ; offline-first.

**Hors périmètre (déjà tranché, ne pas implémenter ici) :**
- **Templates éditoriaux pré-fournis pour débutants** — reportés (contenu à curer séparément).
- **Export / partage de template** — non demandé, pas dans la spec produit actuelle.
- **Démo/GIF par exercice** — déjà abandonné globalement (US-C2).
- **Lien template → paire de superset** : comme pour les programmes (`exercise_plans.set_type = 'superset'`,
  limitation déjà documentée en C3), un exercice de template marqué `superset` ne crée **aucune** paire
  automatique — la liaison reste un geste en direct (`workout_superset_pairs`, C3), disponible identiquement
  qu'on démarre à blanc ou depuis un template.

## 2. Comportement attendu

### 2.1 Composer un template à froid
- Depuis « Mes templates » (accessible via le choix « Depuis un template » du bouton Séance libre, §2.4), un
  bouton **« + »** ouvre l'écran de création : un champ **nom** (requis), puis **« Créer »** fait passer à
  l'écran de composition (même template, id connu).
- Écran de composition : liste des exercices du template, chacun avec ses cibles éditables — les **4 champs**
  déjà présents dans l'édition de plan de programme (séries, reps, charge, repos) **plus un 5ᵉ champ nouveau**,
  le **type de série** (les 7 valeurs de `set_type`, aucun sélecteur de ce type n'existe aujourd'hui dans
  l'édition de programme — voir §4.4) — et une action de suppression ; bouton **« + Ajouter un exercice »** qui
  ouvre le sélecteur d'exercice existant (`ExercisePicker`, réutilisé tel quel) ; le nom du template est éditable
  en tête d'écran (renommage).
- Aucune limite au nombre d'exercices ; liste vide autorisée (template « à composer plus tard »), mais un
  template **vide** ne peut pas être utilisé pour démarrer une séance (§3).

### 2.2 Enregistrer une séance libre comme template
- Sur l'écran résumé d'une séance **libre terminée** (`session_id` et `program_id` tous deux `null` sur la
  séance), un bouton **« Enregistrer comme template »** apparaît sous le récapitulatif. **Absent** si la séance
  provient d'un programme (le plan d'exercices source joue déjà ce rôle) ou si la séance n'a **aucun** exercice.
- Au tap : un champ nom apparaît en ligne (pré-rempli avec une suggestion, ex. « Séance du 21/07 »),
  **Valider** crée le template (§3) et affiche une confirmation (« Template enregistré : {nom} »), **Annuler**
  referme le champ sans rien créer.

### 2.3 Démarrer depuis un template
- Le bouton **« Séance libre »** du hub muscu ouvre un choix : **« À blanc »** (comportement actuel, inchangé)
  ou **« Depuis un template »** → liste « Mes templates » (nom + nombre d'exercices par ligne). Sélectionner un
  template démarre immédiatement une nouvelle séance libre pré-remplie (§3) et navigue vers l'écran de séance
  (même garde qu'aujourd'hui : une séance déjà active reprend telle quelle, le choix de template est ignoré).
- Un template **sans aucun exercice** n'est pas sélectionnable pour démarrer (action désactivée dans la liste,
  avec l'invite à l'éditer d'abord).
- **Cas « séance planifiée du jour »** : le hub (`strength.tsx`) n'affiche la carte « Séance libre » que quand
  **aucune** séance active **et aucune** séance planifiée du jour n'existe (`today.state === 'none'`) — les
  jours où une séance de programme est prévue, cette carte est aujourd'hui **remplacée** par la carte « Séance
  du jour », sans accès au choix à blanc/template. Pour ne pas rendre les templates inaccessibles ces jours-là,
  un lien secondaire discret **« Ou depuis un template »** est ajouté sous le CTA de la carte « Séance du jour »
  (en plus de la carte « Séance libre » classique) — ouvre la même liste de sélection. Aucun lien de ce type sur
  la carte « Reprendre » (séance déjà active : la garde anti-double-séance rend le choix sans objet).

### 2.4 Gestion des templates
- Liste « Mes templates » : nom + nombre d'exercices par ligne ; tap → écran de composition (§2.1, réutilisé
  pour l'édition) avec en plus les actions **Dupliquer** et **Supprimer** (confirmation avant suppression).
- **Dupliquer** : copie intégrale (nouveau `id`, mêmes exercices/cibles), même nom (l'utilisateur renomme
  ensuite s'il le souhaite — comportement identique à `duplicateProgram`).
- **Supprimer** : soft delete du template et de tous ses exercices ; confirmation obligatoire.

## 3. Règles métier

- **Un template appartient toujours à l'utilisateur courant** (`user_id`) — pas de bibliothèque éditoriale dans
  cette US (contrairement aux programmes) : RLS `select`/`insert`/`update` scopées `user_id = auth.uid()`,
  aucune ligne visible d'un autre utilisateur.
- **Enregistrement depuis une séance terminée** — dérivation des cibles par exercice, à partir des
  `workout_sets` **validées** de la séance (`deleted_at IS NULL AND done = 1` — une série jamais validée n'a pas
  été réellement faite, elle ne doit pas définir un template), regroupées par `exercise_id` en conservant
  l'ordre de première apparition (`order_index`) :
  - Un exercice **sans aucune série validée** dans la séance (uniquement des séries `done = 0`) est **exclu**
    du template — rien à en tirer.
  - `target_sets` = nombre de séries **validées** de l'exercice dans la séance (tous types confondus,
    échauffement inclus — reflète fidèlement ce qui a été fait).
  - `target_reps` = `reps` de la **dernière série validée** de l'exercice (converti en texte), `target_weight_kg`
    = `weight_kg` de cette même série.
  - `set_type` = celui de la **première série validée** de l'exercice (simplification acceptée : un exercice
    mixant plusieurs types dans la séance ne conserve que le type de sa première série comme valeur par défaut,
    modifiable ensuite dans l'éditeur de template).
  - `rest_seconds` = non renseigné (`null`) — le repos par défaut de l'exercice s'applique normalement au
    démarrage, comme pour toute séance libre à blanc.
- **Démarrage depuis un template** : même garde qu'aujourd'hui (`startWorkout`/`startWorkoutFromSession`) — au
  plus une séance `status='active'` à la fois ; si une séance active existe déjà, on la reprend telle quelle
  (le template choisi est ignoré). Sinon, une séance libre est créée (`session_id`/`program_id`/
  `planned_session_id` tous `null`, comme `startWorkout`) et pré-remplie : pour chaque exercice du template
  (ordonné), `max(1, target_sets ?? 1)` séries sont insérées avec `set_type`, `reps` (dérivé de `target_reps` via
  `parseTargetReps`), `weight_kg` **et** `planned_weight_kg` = `target_weight_kg` (même convention que
  `startWorkoutFromSession`, C2).
- **Suppression** : soft delete du template **et** cascade soft delete de tous ses `workout_template_exercises`
  (même patron que `removeSession`/`deleteProgram`). Un template déjà utilisé pour démarrer une séance passée
  n'a **aucun lien conservé** avec les séances qu'il a servi à créer (pas de FK `template_id` sur `workouts` —
  même principe que `applyTemplate` pour les repas types, qui ne garde aucune trace du repas type source une
  fois les entrées copiées) : supprimer ou modifier un template n'affecte jamais l'historique des séances déjà
  faites.
- **Offline-first** : toutes les écritures (création, composition, duplication, démarrage) optimistes locales,
  synchro PowerSync en arrière-plan.

## 4. Architecture

### 4.1 Migration (🔴 checkpoint cloud)

Deux tables, patron identique à `meal_templates`/`meal_template_items`
([20260707130000_recipes_bodyweight_tables.sql](../../../../supabase/migrations/20260707130000_recipes_bodyweight_tables.sql)/
[20260707130001_recipes_bodyweight_rls.sql](../../../../supabase/migrations/20260707130001_recipes_bodyweight_rls.sql)),
combinées en un seul fichier (patron C3, `exercise_notes`) — SQL complet, prêt à copier :

```sql
-- US Refonte-D : templates de séance libre (routines réutilisables). Patron identique
-- à meal_templates/meal_template_items (repas types nutrition).
-- Réf. : docs/specs/functional/us/refonte-muscu-d-templates-seance-libre.md.

create table public.workout_templates (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.workout_template_exercises (
  id uuid primary key,
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  order_index integer not null default 0,
  set_type text not null default 'normal'
    check (set_type in ('normal','warmup','superset','duration','bodyweight','dropset','failure')),
  target_sets integer check (target_sets > 0),
  target_reps text,
  target_weight_kg numeric check (target_weight_kg >= 0),
  rest_seconds integer check (rest_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Triggers updated_at (fonction définie dans 20260705150000_init_conventions.sql)
create trigger set_updated_at before update on public.workout_templates
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.workout_template_exercises
  for each row execute function public.set_updated_at();

-- Index partiel (lecture ordonnée des exercices d'un template)
create index on public.workout_template_exercises (template_id) where deleted_at is null;

-- Publication logique PowerSync (réplication vers l'instance PowerSync provisionnée)
alter publication powersync add table
  public.workout_templates, public.workout_template_exercises;

-- RLS (Row Level Security) — tables « utilisateur », pas de delete (soft delete).
alter table public.workout_templates           enable row level security;
alter table public.workout_template_exercises   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['workout_templates','workout_template_exercises']
  loop
    execute format('create policy %I_select on public.%I for select using (user_id = auth.uid());', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (user_id = auth.uid());', t, t);
    execute format('create policy %I_update on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid());', t, t);
  end loop;
end $$;
```

`npm run db:new refonte_muscu_d_workout_templates` → `db:push:dry` → **go explicite Florian** → `db:push` →
`db:types` → cocher `supabase/MIGRATIONS.md`.

### 4.2 PowerSync (`apps/mobile/src/powersync/schema.ts`)
Deux nouvelles tables `workout_templates` (`user_id`, `name: column.text`, timestamps, `deleted_at`) et
`workout_template_exercises` (`template_id`, `user_id`, `exercise_id`, `order_index`, `set_type`, `target_sets`,
`target_reps`, `target_weight_kg`, `rest_seconds`, timestamps, `deleted_at`), ajoutées au `Schema`.

### 4.3 Repository (nouveau fichier `workout-template-repository.ts`)

Nouveau fichier, sur le patron de `meal-template-repository.ts` (lecture réactive + écritures optimistes) et de
`program-repository.ts` (structure des cibles d'exercice) :

- `useWorkoutTemplates(): { templates: WorkoutTemplateListItem[]; isLoading }` — liste réactive (`id`, `name`,
  `exerciseCount`), même requête `COUNT` + `LEFT JOIN` que `useMealTemplates`.
- `useWorkoutTemplateDetail(templateId): { detail: WorkoutTemplateDetail | null; isLoading }` — entête + exercices
  ordonnés (`order_index`), noms résolus via `exercise_translations` (langue courante → fr, même patron que
  `SELECT_PLANS_FOR_PROGRAM`).
- `createWorkoutTemplate(name): Promise<string>` — insère `workout_templates`, retourne l'id.
- `renameWorkoutTemplate(templateId, name): Promise<void>` — patch `name`.
- `addTemplateExercise(templateId, input): Promise<void>` — `nextOrderIndex` sur
  `workout_template_exercises` filtré par `template_id`, insertion (mêmes champs que `addExercisePlan`).
- `updateTemplateExercise(id, patch): Promise<void>` — patch partiel (mêmes clés que `ExercisePlanPatch`).
- `removeTemplateExercise(id): Promise<void>` — soft delete.
- `deleteWorkoutTemplate(templateId): Promise<void>` — soft delete du template + cascade de ses exercices
  (patron `removeSession`).
- `duplicateWorkoutTemplate(templateId): Promise<string>` — transaction : nouveau `workout_templates` (même
  `name`) + copie de tous les `workout_template_exercises` (nouveaux `id`, `template_id` remappé), patron
  simplifié de `duplicateProgram` (pas de traductions à copier).
- `createTemplateFromWorkout(workoutId, name): Promise<string>` — lit les `workout_sets` de la séance
  (`deleted_at IS NULL`, triés par `order_index`), regroupe par `exercise_id` (ordre de première apparition),
  dérive les cibles par groupe (règles §3), insère un `workout_templates` + ses `workout_template_exercises`
  dans une transaction.
- `startWorkoutFromTemplate(templateId): Promise<string>` — même garde qu'`startWorkout` (séance active
  existante → retournée telle quelle) ; sinon transaction : crée une séance libre (`session_id`/`program_id`/
  `planned_session_id` `null`) puis insère les `workout_sets` pré-remplis à partir des
  `workout_template_exercises` ordonnés (règles §3, même boucle que `startWorkoutFromSession`).

**Modifications connexes à `workout-repository.ts`** :
- Exporter `parseTargetReps`
  ([workout-repository.ts:470](../../../../apps/mobile/src/data/repositories/workout-repository.ts)) —
  actuellement privé, réutilisé tel quel par `startWorkoutFromTemplate` (évite de dupliquer le parsing « 8-12 »
  → 8).
- **`WorkoutHistoryItem` ne porte aujourd'hui ni `sessionId` ni `programId`** (type ligne 71-78 : seulement `id`,
  `startedAt`, `finishedAt`, `durationSeconds`, `rpe`, `notes`) — nécessaires pour que `workout-summary.tsx`
  puisse masquer le bouton « Enregistrer comme template » sur une séance planifiée (§2.2/§4.4). À ajouter :
  - `program_id` à `SELECT_HISTORY` (ligne 154-159, qui sélectionne déjà `session_id` mais pas `program_id`) et
    à `WorkoutDbRow` (ligne 94-103, idem : `session_id` déjà présent, `program_id` manquant).
  - `sessionId: string | null` et `programId: string | null` à `WorkoutHistoryItem`, mappés dans
    `rowToHistoryItem` (ligne 182-191) depuis `row.session_id`/`row.program_id`.

### 4.4 UI

- **Petit refactor préalable** : extraire de `ExercisePlanEditor.tsx` un composant présentation générique pour
  les **4 champs existants** (séries, reps, charge, repos + suppression, valeurs + callbacks en props, sans
  dépendance à `program-repository`). Utilisé en wrapper fin par `ExercisePlanEditor` (programmes, inchangé pour
  l'appelant) **et** par un nouveau `TemplateExerciseEditor` (templates) — évite de dupliquer ~150 lignes quasi
  identiques.
- **Travail nouveau (pas un refactor)** : un **sélecteur de type de série** (les 7 valeurs de `set_type`)
  n'existe **nulle part** dans l'édition de programme aujourd'hui — `ExercisePlanEditor.tsx` n'a que les 4
  champs ci-dessus. `TemplateExerciseEditor` ajoute ce 5ᵉ champ en propre (ex. `Segment`/chips, patron du
  sélecteur déjà utilisé en séance — `CurrentSetCard.tsx` `TYPE_CHIPS`), non partagé avec le composant
  présentation extrait.
- **`ExercisePicker.tsx`** : déjà générique (aucune dépendance à `program-repository`), réutilisé **tel quel**
  pour l'ajout d'exercice à un template.
- **`apps/mobile/src/app/templates/index.tsx`** (nouveau) : liste « Mes templates » (nom + nombre d'exercices),
  bouton « + » → `templates/edit`, tap sur une ligne → `templates/[id]`. Patron `programs/index.tsx` simplifié
  (une seule section, pas de filtre niveau).
- **`apps/mobile/src/app/templates/edit.tsx`** (nouveau) : sans `?id=` → formulaire nom seul, `createWorkoutTemplate`
  puis redirection vers `templates/edit?id=` ; avec `?id=` → composition (nom éditable, liste d'exercices via
  `TemplateExerciseEditor`, bouton « + Ajouter un exercice » → `ExercisePicker`). Patron `programs/edit.tsx`
  simplifié (pas de niveau/objectif/durée, pas de notion de séances multiples).
- **`apps/mobile/src/app/templates/[id].tsx`** (nouveau) : détail = écran de composition (§ci-dessus, un
  template est toujours possédé par l'utilisateur courant, pas de distinction lecture seule) + actions
  **Démarrer** (désactivée si 0 exercice), **Dupliquer**, **Supprimer**.
- **`(tabs)/strength.tsx`** : le bouton « Séance libre » (`workout.startFree`,
  [strength.tsx:119](../../../../apps/mobile/src/app/(tabs)/strength.tsx), branche `today.state === 'none'`)
  ouvre un choix simple (deux options : « À blanc » appelle `onStart` inchangé, « Depuis un template » navigue
  vers `/templates` en mode sélection — passage d'un paramètre de route, ex. `?selectMode=1`, pour que
  `templates/index.tsx` appelle `startWorkoutFromTemplate` + navigation vers `/workout` au tap sur une ligne au
  lieu d'ouvrir `templates/[id]`). **Même lien secondaire « Ou depuis un template »** ajouté sous le bouton
  `home.today.cta` de la carte « Séance du jour » (branche `today.state === 'today-session'`,
  [strength.tsx:83-107](../../../../apps/mobile/src/app/(tabs)/strength.tsx)) — cf. §2.3, sinon les jours de
  séance planifiée n'offrent aucun accès aux templates. Pas d'ajout sur la carte « Reprendre »
  (branche `active`, lignes 70-82).
- **`workout-summary.tsx`** : bouton « Enregistrer comme template » sous le récapitulatif, dans le footer
  ([workout-summary.tsx:251-253](../../../../apps/mobile/src/app/workout-summary.tsx), zone du bouton
  `workout.backHome`), visible seulement si `workout.sessionId === null && workout.programId === null` (séance
  libre — champs à ajouter à `WorkoutHistoryItem`, voir « Modifications connexes » §4.3) et
  `summary.exercises > 0`. Ouvre un champ nom en ligne (pré-rempli, ex. « Séance du {date} »), Valider →
  `createTemplateFromWorkout` + confirmation (`Alert.alert`, patron `journal.templateSaved`).
- **i18n** : nouvelles clés `templates.*` (titre, création, composition, vide, confirmation suppression),
  `workout.freeStart.*` (choix à blanc/template), `workout.summary.saveAsTemplate*`. FR + EN, parité stricte.

## 5. Offline & données

- Toutes les écritures (création, composition, duplication, démarrage, enregistrement depuis une séance)
  **optimistes locales**, synchro PowerSync en arrière-plan — aucun comportement réseau bloquant.
- **Les deux tables** sont un **checkpoint cloud** (🔴, go explicite requis avant `db:push`) — pas de donnée
  existante à migrer, création pure.
- **Aucune nouvelle dépendance native.**

## 6. Definition of Done

- [ ] Spec + plan + **maquette** validés (pas de code avant).
- [ ] Migration `workout_templates`/`workout_template_exercises` créée, prévisualisée, **poussée après go**,
  types régénérés, `MIGRATIONS.md` coché.
- [ ] Composer un template à froid : créer, nommer, ajouter/éditer/retirer des exercices avec cibles.
- [ ] Enregistrer une séance libre terminée comme template (bouton résumé, masqué si séance planifiée ou vide).
- [ ] Démarrer une séance depuis un template : pré-remplissage correct (séries/reps/charge/`planned_weight_kg`).
- [ ] Gestion : liste, édition, duplication, suppression (soft delete cascade).
- [ ] Refactor `ExercisePlanEditor` → composant présentation partagé (4 champs), réutilisé par
  `TemplateExerciseEditor`, sans régression sur l'édition de programme ; nouveau sélecteur de type de série
  (5ᵉ champ, propre aux templates) fonctionnel.
- [ ] Tests `shared` (si logique extraite en fonctions pures : dérivation des cibles depuis une séance) verts ;
  typecheck/lint verts.
- [ ] i18n FR+EN (parité) ; offline-first ; PR relue par les deux devs.

## 7. Explicitement différé / hors périmètre

- **Templates éditoriaux pré-fournis pour débutants** — reportés (contenu à curer séparément, sujet admin).
- **Export / partage de template** — non spécifié actuellement.
- **Lien automatique template → paire de superset** — reste un geste en direct (C3), comme pour les programmes.
- **Exercice supprimé du catalogue référencé par un template** (nom résolu vide, démarrage insérant quand même
  des séries sur cet exercice) — risque **hérité**, déjà latent aujourd'hui côté `exercise_plans`/programmes
  (pas une régression propre à cette US) ; pas de garde spécifique ajoutée ici.
