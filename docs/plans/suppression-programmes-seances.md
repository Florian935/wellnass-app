# Plan d'implémentation — Suppression de programmes & de séances

> Exécuter avec `superpowers:subagent-driven-development`. Spec validée :
> [docs/specs/functional/us/suppression-programmes-seances.md](../specs/functional/us/suppression-programmes-seances.md).
> Branche : `feature/suppression-programmes-seances`. **100 % client, soft delete, aucune migration.**

**Objectif :** supprimer un programme (muscu+course) et une séance depuis l'app, proprement (cascade
`planned_sessions`, désactivation si actif, confirmations).

## Maquette
**Aucune** (validé) : bouton destructif + `Alert` de confirmation sur écrans existants.

## Fichiers touchés
- Modifier : `apps/mobile/src/data/repositories/program-repository.ts` (`deleteProgram`, `removeSession`).
- Modifier : `apps/mobile/src/components/Button.tsx` (variante `destructive`).
- Modifier : `apps/mobile/src/app/programs/[id].tsx` + `running-programs/[id].tsx` (bouton + confirmation + nav).
- Modifier : `apps/mobile/src/components/programs/SessionEditor.tsx` + `running/RunningSessionEditor.tsx` (confirmation).
- Modifier : `fr.json` + `en.json` (clés delete/confirm).

---

### Tâche 1 — Durcir la couche données (`program-repository.ts`)

- [ ] **`deleteProgram(programId)`** : envelopper dans une **`writeTransaction`** (API PowerSync ; s'inspirer de
  `txInsert`/`activateProgram` pour le pattern transactionnel) :
  1. lire `is_active` du programme ; si actif → `UPDATE programs SET is_active=0, updated_at=? WHERE id=?`
     **puis** soft-delete du programme — **dans la même transaction** (ordre impératif) ;
  2. **hors transaction (séquentiel OK)** : cascade `planned_sessions` —
     `UPDATE planned_sessions SET deleted_at=?, updated_at=? WHERE program_id=? AND owner_id=? AND deleted_at IS NULL`
     (owner via `currentUserId()`), **filtre `program_id` seul** ;
  3. cascade existante conservée (séances → exercise_plans → program_translations). Réutiliser `softDelete`.
  - **Attention** : ne pas régresser la cascade actuelle ; garder l'idempotence (`deleted_at IS NULL`).
- [ ] **`removeSession(sessionId)`** : ajouter, en plus de la cascade exercise_plans existante, la cascade
  `planned_sessions` : `UPDATE planned_sessions SET deleted_at=?, updated_at=? WHERE session_id=? AND owner_id=? AND deleted_at IS NULL`.
- [ ] typecheck/lint/tests verts (aucune régression des tests repo existants).
- [ ] **Commit** : `feat(mobile): durcit deleteProgram (tx + désactivation + cascade planning) et removeSession`.

### Tâche 2 — Variante `Button` `destructive`

- [ ] Ajouter `'destructive'` à `variant?: 'primary' | 'ghost' | 'destructive'` ; style dérivé de `colors.danger`
  (fond plein danger + texte lisible, ou contour danger — cohérent avec la charte). API/label/loading inchangés,
  a11y conservée.
- [ ] typecheck/lint verts.
- [ ] **Commit** : `feat(mobile): variante Button destructive (couleur danger)`.

### Tâche 3 — Suppression de programme (UI, muscu + course)

**Fichiers :** `app/programs/[id].tsx`, `app/running-programs/[id].tsx` ; i18n.

- [ ] **i18n** `programs.detail.{ delete, deleting, deleteConfirm, deleteError, deleteErrorMessage }` + équivalents
  `running.program.{ delete, deleting, deleteConfirm, deleteError, deleteErrorMessage }`, FR + EN (parité).
- [ ] **Muscu** (`programs/[id].tsx`) : sous les actions, **si `isOwned`**, bouton `Button variant="destructive"`
  « Supprimer le programme ». `onPress` → `Alert.alert(nom, deleteConfirm, [Annuler(cancel),
  Supprimer(destructive) → handleDelete])`. `handleDelete` : garde anti-double-tap + état `deleting` (loading) →
  `await deleteProgram(programId)` → `router.replace('/programs')` ; sur erreur → `Alert` deleteError, reste sur l'écran.
- [ ] **Course** (`running-programs/[id].tsx`) : idem **sans** garde `isOwned` (tous possédés) ;
  `router.replace('/running-programs')`.
- [ ] typecheck/lint/tests verts ; parité i18n.
- [ ] **Commit** : `feat(mobile): bouton Supprimer le programme (détail muscu + course)`.

### Tâche 4 — Confirmation de suppression de séance (muscu + course)

**Fichiers :** `components/programs/SessionEditor.tsx`, `components/running/RunningSessionEditor.tsx` ; i18n.

- [ ] **i18n** `programs.edit.removeSessionConfirm` + `running.program.removeSessionConfirm` (FR + EN).
- [ ] **SessionEditor** (muscu) : envelopper l'appel `removeSession(session.id)` d'un
  `Alert.alert(nom séance, removeSessionConfirm, [Annuler(cancel), Supprimer(destructive) → removeSession])`.
- [ ] **RunningSessionEditor** (course) : idem.
- [ ] typecheck/lint/tests verts ; parité i18n.
- [ ] **Commit** : `feat(mobile): confirmation avant suppression d'une séance (muscu + course)`.

## Definition of Done (rappel spec §5)
- [ ] `deleteProgram` : tx (is_active=0 + soft-delete) + cascade planned_sessions (program_id) + cascade existante.
      `removeSession` : cascade planned_sessions (session_id). Owner-scopé. Idempotent.
- [ ] Variante `Button` destructive.
- [ ] Bouton Supprimer sur détail muscu (**isOwned**) + course : confirmation, loading, retour liste, erreur gérée.
- [ ] Confirmation ajoutée à la suppression de séance (muscu + course).
- [ ] i18n FR/EN parité ; a11y ; aucune chaîne en dur.
- [ ] typecheck/lint/tests verts. Aucune migration. Testable USB (JS pur). Revues (conformité + qualité) + PR relue.

## Notes
- **Transaction** : utiliser l'API `writeTransaction` de PowerSync (voir usage existant dans `activateProgram`/`_sql`).
- **Owner** : `currentUserId()` déjà disponible dans `program-repository`.
- **Réutilisation** : `softDelete` (`_sql`), pattern `Alert` destructif (journal nutrition), garde `isOwned`.
- **Non-régression** : ne pas casser la cascade actuelle de `deleteProgram`/`removeSession` ni les tests repo.
