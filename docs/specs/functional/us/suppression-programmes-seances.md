---
id: PROG-DEL-01
titre: "Suppression de programmes & de séances (muscu + course)"
roadmap: []
catalogue: []
etape: close
branche: feature/suppression-programmes-seances
maj: 13/07/2026
---
# US — Suppression de programmes & de séances (muscu + course)

> Permettre à l'utilisateur de **supprimer un programme** (muscu ou course) et une **séance** depuis l'app,
> proprement (cascade + confirmation + gestion du programme actif et des séances planifiées).
> Signalé par Florian (13/07/2026). Branche : `feature/suppression-programmes-seances`.
> **Statut : à valider (pas de code avant validation).** 100 % client, JS pur, **aucune migration**.

## 0. Contexte (exploration)

- **Repository** (`program-repository.ts`) : `deleteProgram(programId)` (cascade **programme → séances →
  exercise_plans → program_translations**, soft delete) et `removeSession(sessionId)` (séance → exercise_plans)
  **existent déjà**. Manques (voir §2).
- **UI** : la **suppression de séance** est déjà câblée (icône corbeille dans `SessionEditor` muscu +
  `RunningSessionEditor`) mais **sans confirmation** (suppression immédiate). La **suppression de programme n'a
  aucun bouton** (écrans détail `programs/[id].tsx` et `running-programs/[id].tsx`).
- **Programme actif** : colonne `programs.is_active` (au plus 1 actif par pilier/utilisateur via `activateProgram`).
  `useActiveProgram` filtre `is_active=1 AND deleted_at IS NULL`.
- **Séances planifiées** : `planned_sessions` (US 3.9) référence `program_id` + `session_id`. Les requêtes de
  planning joignent `sessions`/`programs` sur `deleted_at IS NULL` → une séance/programme supprimé **disparaît
  silencieusement** du planning, mais les lignes `planned_sessions` restent **orphelines** (pollution DB).
- **Propriété** : `programs.owner_id` — éditoriaux (`owner_id` NULL/seed) non possédés. Garde existante
  `isOwned` (via `useMyPrograms`) → pas d'édition/suppression des programmes éditoriaux.
- **Button** : variantes actuelles `'primary' | 'ghost'` → **ajouter `'destructive'`** (couleur `colors.danger`).
- **Confirmation** : pattern `Alert.alert(titre, message, [Annuler(cancel), Supprimer(destructive)])` déjà utilisé
  (ex. journal nutrition).

## 1. Périmètre à livrer

1. **Supprimer un programme** (muscu **et** course) depuis l'écran détail : bouton destructif + **confirmation**,
   puis retour à la liste. Muscu : **seulement si `isOwned`** (éditoriaux non supprimables).
2. **Supprimer une séance** : conserver l'action existante mais lui **ajouter une confirmation** (muscu + course).
3. **Durcir la couche données** : `deleteProgram` désactive le programme s'il est actif + cascade
   `planned_sessions` ; `removeSession` cascade `planned_sessions`.
4. Variante **`destructive`** du composant `Button` (réutilisable).

**Hors périmètre :**
- Suppression définitive (hard delete) — on reste en **soft delete** (offline-first, réversible côté données).
- Corbeille / restauration (undo au-delà de la confirmation) — différé.
- Suppression multi-sélection ; archivage distinct de la suppression.
- Suppression d'exercices dans une séance (`removeExercisePlan` existe déjà, hors périmètre).

## 2. Comportement attendu

### 2.1 Suppression de programme
- **Où** : écran détail (`programs/[id].tsx` muscu, `running-programs/[id].tsx` course), bouton **« Supprimer le
  programme »** (variante `destructive`), placé sous les actions existantes.
  - Muscu : affiché **uniquement si `isOwned`** (éditorial → pas de bouton).
  - Course : affiché (tous les programmes course sont possédés par construction).
- **Confirmation** : `Alert.alert(nom du programme, « Cette action supprimera le programme et toutes ses
  séances. Continuer ? », [Annuler, Supprimer(destructive)])`.
- **Effet** : `deleteProgram` durci —
  1. **[transaction]** si le programme est **actif** (`is_active=1`) → le passer `is_active=0` **puis** poser le
     soft delete du programme **dans une même `writeTransaction`** (atomicité : jamais de ligne soft-deletée
     restée `is_active=1` — cohérent avec `activateProgram` qui filtre `is_active=1 AND deleted_at IS NULL`).
     L'ordre `is_active=0` **avant** le soft-delete est impératif (sinon l'UPDATE ne matcherait plus la ligne).
  2. **cascade `planned_sessions`** : soft-delete toutes les `planned_sessions` **de l'owner** dont
     `program_id = ce programme` et `deleted_at IS NULL` — **un seul filtre `program_id` suffit** (il couvre
     toutes les séances du programme ; inutile de lister les `session_id`). Peut rester séquentielle (hors
     transaction) — volume borné.
  3. cascade existante (séances → exercise_plans → translations).
- **Après suppression** : `router.replace('/programs')` (muscu) ou `router.replace('/running-programs')` (course) ;
  état de
  chargement pendant l'opération ; en cas d'erreur, message non bloquant (`Alert`), on reste sur l'écran.
- **Programme actif supprimé** : après suppression, plus aucun programme actif pour ce pilier (l'utilisateur peut
  en activer un autre). Le dashboard/écran pilier reflète l'absence (déjà géré par `useActiveProgram → null`).

### 2.2 Suppression de séance
- **Où** : icône corbeille existante dans les éditeurs (muscu + course), en **mode édition** du programme.
- **Ajout** : **confirmation** `Alert.alert(nom de la séance, « Supprimer cette séance ? », [Annuler,
  Supprimer(destructive)])` avant l'appel à `removeSession`.
- **Effet** : `removeSession` durci — cascade `planned_sessions` (soft-delete celles **de l'owner** dont
  `session_id` = cette séance, `deleted_at IS NULL`) en plus de la cascade exercise_plans existante. (Les séances
  ne portent pas `is_active` → aucune désactivation nécessaire ici.)
- Réactif : la séance disparaît de l'éditeur (UI `useQuery`).

### 2.3 Règles / cas limites
- **Soft delete** partout (`deleted_at`) — cohérent offline-first ; la synchro propage la suppression.
- **Éditoriaux non supprimables** (garde `isOwned` muscu ; RLS empêche la suppression cross-user côté cloud).
- **Séances planifiées** d'un programme/séance supprimé : nettoyées (soft-delete) → plus d'orphelins ; le planning
  ne montrait déjà plus ces lignes (JOIN `deleted_at`), on assainit les données.
- **Idempotence** : re-supprimer une entité déjà supprimée est sans effet (les requêtes filtrent `deleted_at IS NULL`).
- **Offline** : la suppression fonctionne hors-ligne (écriture locale) et se synchronise ensuite.

## 3. Architecture

- **`program-repository.ts`** :
  - `deleteProgram(programId)` — **`writeTransaction`** pour `is_active=0` (si actif) **+** soft-delete du
    programme (atomique, dans cet ordre) ; **cascade `planned_sessions`** par `program_id` (owner courant) —
    séquentielle acceptable ; puis cascade existante séances/plans/translations.
  - `removeSession(sessionId)` — ajouter la **cascade `planned_sessions`** (soft-delete par `session_id`).
  - Réutiliser `softDelete` de `_sql`.
- **`components/Button.tsx`** : variante `'destructive'` (fond/texte dérivés de `colors.danger` ; même API).
- **`app/programs/[id].tsx`** + **`app/running-programs/[id].tsx`** : bouton destructif + `Alert` + handler
  (loading, `router.replace` liste, gestion erreur). Muscu gardé par `isOwned`.
- **`components/programs/SessionEditor.tsx`** + **`components/running/RunningSessionEditor.tsx`** : envelopper
  `removeSession` d'un `Alert` de confirmation.
- **i18n** : `programs.detail.{ delete, deleting, deleteConfirm, deleteError }` + `programs.edit.removeSessionConfirm`
  ; équivalents `running.program.{ delete, deleting, deleteConfirm, deleteError, removeSessionConfirm }` ; FR/EN parité.

## 4. Design / maquette
**Pas de maquette dédiée** : un bouton destructif (variante charte `danger`) + dialogues `Alert` natifs, sur des
écrans existants, pattern de confirmation déjà utilisé (journal nutrition). Précédents sans maquette : 1.15/4.7/5.33.
**À valider** ; maquette possible si tu veux voir le placement/rendu du bouton.

## 5. Definition of Done

- [ ] Spec + plan (+ maquette ou justification) validés.
- [ ] `deleteProgram` : désactive si actif + cascade `planned_sessions` + cascade existante. `removeSession` :
      cascade `planned_sessions`. (Test unitaire si de la logique pure est extraite ; sinon vérifié en revue + device.)
- [ ] Variante `Button` `destructive` (couleur danger, a11y).
- [ ] Bouton « Supprimer le programme » sur détail muscu (**isOwned only**) + course, avec confirmation, loading,
      retour liste, gestion erreur.
- [ ] Confirmation ajoutée à la suppression de séance (muscu + course).
- [ ] i18n FR/EN parité ; aucune chaîne en dur ; a11y des actions destructives.
- [ ] typecheck/lint/tests verts. **Aucune migration / checkpoint 🔴 cloud.** Testable USB (JS pur).
- [ ] Vérifs : suppression du programme actif → plus d'actif ; planned_sessions nettoyées (pas d'orphelin) ;
      éditorial → pas de bouton ; confirmation annulable.
- [ ] Revues (conformité + qualité) + PR relue.

## 6. Explicitement différé
Hard delete ; corbeille/restauration ; suppression multi-sélection ; suppression d'exercice hors éditeur ;
archivage distinct.
