# US MUSC-F3 — Recherche d'exercices multi-critères (groupe musculaire + matériel)

> Roadmap [3.14](../../../roadmap/roadmap.md) — *« Recherche d'exercices : par nom, groupe musculaire ou
> matériel »*, aujourd'hui **par nom uniquement**. Item du backlog [P1 finitions muscu](../../../../TODO.md#-p1--finitions-muscu-v02--v03)
> (§🗺️ Reste-à-faire MVP1). Branche prévue : `feature/muscf3-recherche-multicriteres`.
> **Statut : à valider (pas de code avant validation).**
> **🔴 Migration cloud requise** (contrainte `CHECK` sur `exercises.equipment`, aucune colonne ajoutée).

## 0. Contexte

Aujourd'hui, le picker d'exercices ([ExercisePicker.tsx](../../../../apps/mobile/src/components/programs/ExercisePicker.tsx))
et l'écran bibliothèque ([exercises.tsx](../../../../apps/mobile/src/app/exercises.tsx)) ne filtrent que par
**nom** (`useExercises(search)`). Retrouver "tout ce qui touche le dos" ou "tout ce qui se fait à la maison sans
matériel" oblige à connaître le nom exact de chaque exercice.

Deux colonnes existent déjà sur `exercises` pour supporter ça :
- `muscle_primary` — **enum contraint en base** (`chest`/`back`/`legs`/`shoulders`/`arms`/`core`), déjà traduit
  (clés i18n `muscle.*`). Rien à faire côté données.
- `equipment` — colonne **texte libre, non contrainte en base**, actuellement `null` sur les 16 exercices du
  seed. Un type `Equipment`/`EQUIPMENTS` (8 valeurs) **existe déjà côté domaine**
  ([exercise.ts](../../../../packages/shared/src/exercise.ts), posé dès US1) mais n'est **branché nulle part** :
  pas de contrainte en base, l'admin ([ExerciseEditScreen.tsx](../../../../apps/admin/src/screens/ExerciseEditScreen.tsx))
  le saisit en texte libre non typé, et aucune clé i18n mobile n'existe pour l'afficher.

Décisions de cadrage (brainstorming Florian, 22/07/2026, maquettes visuelles à l'appui) :
- **Matériel = liste contrôlée** (pas de texte libre) pour permettre un filtre fiable et respecter la contrainte
  i18n FR+EN du projet. On **réutilise** `EQUIPMENTS`/`Equipment` déjà présents dans `packages/shared`, on ne les
  recrée pas.
- **UI = bouton « Filtres » + tiroir** (pas de chips permanentes ni de dropdowns) : la recherche par nom reste
  l'action principale et doit rester la plus visible ; le filtre est optionnel et ne doit pas alourdir l'écran
  par défaut. Cf. maquettes comparées (`.superpowers/brainstorm/`).
- **Périmètre = les deux surfaces de recherche** : `ExercisePicker` (composant partagé : programme, template,
  ajout en séance) **et** `exercises.tsx` (écran bibliothèque autonome). Logique factorisée dans `useExercises`.

## 1. Périmètre à livrer

- **Migration** : contrainte `CHECK` sur `exercises.equipment` alignée sur `EQUIPMENTS` (colonne déjà nullable,
  aucune donnée à migrer — tout est `null` aujourd'hui).
- **Admin** : le champ texte libre "Matériel" de `ExerciseEditScreen` devient un `<select>` sur `EQUIPMENTS`.
- **Mobile i18n** : clés `equipment.*` (FR + EN), miroir de `muscle.*`.
- **`useExercises`** : nouveaux paramètres optionnels `muscles?: MuscleGroup[]` et `equipment?: Equipment[]`,
  combinés à la recherche texte existante.
- **UI** : bouton **« Filtres »** (avec badge de compte) à côté du champ de recherche, ouvrant un tiroir à deux
  sections (Groupe musculaire, Matériel) en chips à cocher + bouton Réinitialiser — sur `ExercisePicker` **et**
  `exercises.tsx` (composant de tiroir partagé pour éviter la duplication).
- **Affichage** : la ligne d'un exercice dans la liste (aujourd'hui `{muscle}`) affiche aussi le matériel quand
  il est renseigné (ex. « Dos · Barre »), pour confirmer visuellement ce sur quoi on vient de filtrer.
- **Seed dev** ([seed.sql](../../../../supabase/seed.sql)) : renseigner un `equipment` plausible sur les 16
  exercices existants, pour que le filtre soit testable en recette (aujourd'hui tous `null`).
- **i18n** FR/EN ; offline-first (aucune écriture, lecture seule).

**Hors périmètre :**
- Muscles **secondaires**, variantes/alternatives, fiche exercice détaillée → **MUSC-F2** (US distincte, nécessite
  ses propres colonnes/migration).
- Rétro-remplissage du **matériel réel** de la bibliothèque de production (au-delà du seed dev) : tâche de
  contenu admin (Florian/Damien), pas du code.

## 2. Comportement attendu

### 2.1 Bouton Filtres & tiroir
- Bouton **« Filtres »** à droite du champ de recherche. Aucun filtre actif → libellé simple. Au moins un filtre
  actif → badge de compte (« Filtres · 2 »).
- Tap → tiroir (bottom sheet, cohérent avec les modales existantes de l'app) avec deux sections :
  **Groupe musculaire** (6 chips) puis **Matériel** (8 chips). Chip tapée = sélectionnée (état visuel doré,
  cohérent avec le reste de l'app) ; retap = désélectionnée.
- Fermer le tiroir (croix, tap en dehors, ou geste natif) applique **immédiatement** la sélection courante — pas
  de bouton « Appliquer » séparé.
- **Réinitialiser** : bouton visible dans le tiroir dès qu'au moins un filtre est actif ; vide les deux facettes.
- Les filtres **ne persistent pas** au-delà de l'instance du picker/écran (fermer puis rouvrir la modale/écran =
  filtres réinitialisés). Pas de sauvegarde en base ni en storage local — cohérent avec le côté "outil de
  recherche ponctuel", évite la complexité d'un état persistant à synchroniser.

### 2.2 Sémantique du filtre
- Au sein d'une facette : **OU** — cocher "Dos" et "Épaules" montre les exercices touchant l'un **ou** l'autre.
- Entre facettes : **ET** — cocher "Dos" (muscle) et "Poulie/câble" (matériel) ne montre que les exercices qui
  matchent **les deux**.
- Combiné avec la recherche texte existante : également en **ET** (chercher "tirage" + filtrer "Dos" ne montre
  que les tirages classés Dos).
- Aucun filtre actif = comportement **inchangé** (recherche par nom seule, comme aujourd'hui).

### 2.3 États
- **Résultat vide dû aux filtres** (recherche/filtres ne matchent rien) : message dédié « Aucun résultat pour ces
  filtres » + raccourci **Réinitialiser**, distinct du vide "aucun exercice du tout" existant.
- **Exercice sans matériel renseigné** (`equipment IS NULL`, cas actuel de tous les exercices en prod) :
  n'apparaît dans **aucun** résultat filtré par matériel (cohérent — on ne peut pas prétendre matcher un critère
  absent). Reste visible sans filtre matériel actif, ou si seul le filtre muscle est actif.
- **Mode remplacement** (`exercises.tsx?replaceExerciseId=...`) : les filtres s'appliquent **en plus** de
  l'exclusion existante des exercices déjà présents dans la séance active (comportement additif, aucune
  interaction spéciale à coder).
- **Favoris** (`exercises.tsx`, tri favoris-en-tête) : le tri est **inchangé**, les filtres réduisent juste
  l'ensemble sur lequel il s'applique.

## 3. Règles métier

- `MUSCLE_GROUPS`/`EQUIPMENTS` restent la **seule** source de vérité des valeurs possibles (aucune valeur libre
  ajoutée par cette US).
- Le filtre est un **ET** entre facettes non vides, **OU** au sein d'une facette — voir §2.2. Une facette vide
  (aucune chip cochée) ne contraint pas le résultat sur cette facette.
- Un exercice dont `equipment IS NULL` est **exclu** dès qu'un filtre matériel est actif (pas de "matériel
  inconnu" traité comme un joker).
- Aucune écriture : cette US est **lecture seule** sur les données exercices (hormis la migration de contrainte
  et la correction du seed dev). Aucun impact sur `workouts`/`workout_sets`/programmes.

## 4. Architecture & données

### 4.1 Migration (🔴 checkpoint cloud — contrainte seule, aucune colonne)
Un seul fichier (`npm run db:new muscf3_equipment_check`) :
```sql
alter table public.exercises
  add constraint exercises_equipment_check
  check (equipment is null or equipment in
    ('barbell','dumbbell','machine','cable','bodyweight','kettlebell','band','other'));
```
Puis `npm run db:push:dry` → **go explicite de Florian** → `npm run db:push` → cocher
[supabase/MIGRATIONS.md](../../../../supabase/MIGRATIONS.md). **Pas de `db:types`** nécessaire (aucune colonne
ajoutée/renommée, seulement une contrainte — le type généré de la colonne `equipment` ne change pas).

> ⚠️ Si un exercice de la base de **production** a déjà une valeur `equipment` hors de cette liste (saisie libre
> historique via l'admin), la migration **échouera** à l'application. Vérifier au préalable avec
> `select distinct equipment from exercises where equipment is not null;` sur le cloud avant de pousser — si des
> valeurs hors-liste existent, les nettoyer via l'admin (ou élargir la liste) avant `db:push`.

### 4.2 Partagé (`packages/shared`)
- **Rien à ajouter** : `EQUIPMENTS`, `equipmentSchema`, `Equipment` existent déjà
  ([exercise.ts:18-29](../../../../packages/shared/src/exercise.ts#L18-L29)), posés dès US1 mais jamais branchés.
  Cette US est la première à les consommer réellement.
- Nouvelle fonction pure `buildExerciseFilterClause(muscles?: MuscleGroup[], equipment?: Equipment[])` →
  `{ clause: string; params: unknown[] }`, testable Vitest sans dépendance PowerSync (génère `AND e.muscle_primary
  IN (?,?)` / `AND e.equipment IN (?,?)` paramétrés, `''`/`[]` si aucune facette active).

### 4.3 Admin (`apps/admin`)
- [ExerciseEditScreen.tsx](../../../../apps/admin/src/screens/ExerciseEditScreen.tsx) : remplacer le
  `<input type="text">` matériel par un `<select>` sur `EQUIPMENTS` (import `Equipment`/`EQUIPMENTS` depuis
  `@wellness/shared`), avec une option vide ("Non renseigné") pour garder `equipment: null` possible. Libellés FR
  uniquement (admin non bilingue).

### 4.4 Mobile (`apps/mobile`)
- **i18n** : clés `equipment.barbell|dumbbell|machine|cable|bodyweight|kettlebell|band|other` en
  [fr.json](../../../../apps/mobile/src/i18n/locales/fr.json) et
  [en.json](../../../../apps/mobile/src/i18n/locales/en.json), miroir exact de `muscle.*`.
- **`exercise-repository.ts`** : `useExercises(search?, muscles?, equipment?)` — étend `SELECT_EXERCISES` avec la
  clause de `buildExerciseFilterClause`, params concaténés à ceux de la recherche texte.
- **Nouveau composant partagé** `ExerciseFilterDrawer` (ou équivalent) : tiroir à 2 sections de chips + bouton
  Réinitialiser, consommé par `ExercisePicker.tsx` et `exercises.tsx`.
- **`ExercisePicker.tsx`** : bouton Filtres à côté de `TextField` recherche, état `muscles`/`equipment` local,
  ligne exercice affiche `{muscle} · {equipment}` quand `equipment` non nul.
- **`exercises.tsx`** : même bouton Filtres, même état local, même affichage enrichi ; aucune interaction avec le
  mode création d'exercice personnalisé (`addCustomExercise` reste sans matériel, hors périmètre).
- **Seed** : [seed.sql](../../../../supabase/seed.sql) — renseigner `equipment` sur les 16 lignes existantes
  (ex. développé couché → `barbell`, pompes → `bodyweight`, tirage vertical → `cable`, presse à cuisses →
  `machine`, etc.), cohérent avec le nom de chaque exercice.

## 5. Offline & données

- **Lecture seule** : aucune écriture nouvelle, PowerSync inchangé (pas de nouvelle colonne côté schéma local —
  `equipment` est déjà répliqué). Fonctionne offline comme la recherche par nom actuelle.
- **🔴 Migration = checkpoint cloud** (contrainte uniquement) : `db:push` sur `nsxzflxsgovriwwvflxe` **après go
  explicite**, vérification préalable des valeurs existantes (§4.1).
- Aucune nouvelle dépendance native.

## 6. Definition of Done

- [ ] Spec + plan + **maquette** validés (pas de code avant).
- [ ] Vérification des valeurs `equipment` existantes sur le cloud (§4.1) avant migration.
- [ ] Migration (contrainte `CHECK`) créée, prévisualisée, **poussée après go**, cochée dans MIGRATIONS.md.
- [ ] Admin : sélecteur matériel remplace le texte libre, valeurs conformes à `EQUIPMENTS`.
- [ ] i18n mobile `equipment.*` FR+EN (parité stricte avec `muscle.*`).
- [ ] `buildExerciseFilterClause` (shared, pur, testé Vitest) + `useExercises` étendu.
- [ ] Bouton Filtres + tiroir 2 sections, badge de compte, Réinitialiser — sur `ExercisePicker` **et**
      `exercises.tsx`, composant de tiroir factorisé (pas de duplication).
- [ ] Sémantique OU intra-facette / ET inter-facette / ET avec la recherche texte, vérifiée par les tests.
- [ ] Ligne exercice affiche le matériel quand renseigné (« Dos · Barre »).
- [ ] État vide dédié "aucun résultat pour ces filtres" + Réinitialiser.
- [ ] Seed dev enrichi (16 exercices avec `equipment` plausible) pour permettre la recette.
- [ ] typecheck/lint/tests verts (shared + mobile + admin) ; PR relue par les deux devs.

## 7. Explicitement différé

- **MUSC-F2** (fiche exercice complète, muscles secondaires, variantes) — colonnes et migration distinctes.
- Rétro-remplissage du matériel sur la bibliothèque de **production** (tâche de contenu admin, pas de code).
- Persistance du filtre entre ouvertures / across sessions (YAGNI — pas de besoin exprimé).
