# US MUSC-F7 — Progression assistée — Plan d'implémentation

> ⚠️ **Workflow projet** : ne PAS exécuter avant validation des livrables (spec + plan — **pas de
> maquette**, aucune UI nouvelle : la restitution existe déjà, cf. spec §1).
> ✅ **Aucune migration, aucun module natif → pas de rebuild.** Périmètre = Volet B (3.8) uniquement ;
> le Volet A (3.7, progression au niveau programme) est explicitement hors périmètre (spec §0).

**Goal :** activer la suggestion de deload déjà écrite et testée — un signal manquant, zéro nouvelle UI.

**Spec :** [docs/specs/functional/us/muscf7-progression-assistee.md](../specs/functional/us/muscf7-progression-assistee.md)

**Ordre :** exporter la règle pure d'abord (déjà couverte par les tests existants de
`computeProgressionSuggestion`), puis la requête, puis le branchement — chaque étape vérifiable seule.

---

## Structure des fichiers

**Modifier :**
- `packages/shared/src/workout.ts` — exporte `sessionStruggled`.
- `packages/shared/src/workout.test.ts` — tests directs de `sessionStruggled` (jusqu'ici couverte
  seulement indirectement via les tests de `computeProgressionSuggestion`).
- `apps/mobile/src/data/repositories/workout-repository.ts` — nouvelle requête + hook
  `usePreviousStruggled(exerciseId)`.
- `apps/mobile/src/app/workout.tsx` — branche le hook dans l'appel à `computeProgressionSuggestion`.

---

## Tasks

- [ ] 1. **Exporter `sessionStruggled`** (`packages/shared/src/workout.ts`, ligne ~200) — ajouter
      `export`, aucun changement de signature. Ajouter 3-4 tests directs dans `workout.test.ts`
      (série en échec → vrai ; RPE 8+ → vrai ; RPE 7 sans échec → faux ; aucune série qualifiante →
      faux) — elle devient une API publique du package, elle doit être testée comme telle.

- [ ] 2. **Requête symétrique** (`workout-repository.ts`, à côté de `SELECT_LAST_PERFORMANCE`) —
      même structure que la sous-requête existante, avec `OFFSET 1` au lieu de `LIMIT 1` seul :
      ```sql
      -- SELECT_SECOND_LAST_PERFORMANCE : même forme que SELECT_LAST_PERFORMANCE, sous-requête
      -- ORDER BY w2.finished_at DESC LIMIT 1 OFFSET 1 (l'avant-dernière séance qualifiante).
      ```

- [ ] 3. **`usePreviousStruggled(exerciseId: string): boolean`** (`workout-repository.ts`, à côté de
      `useLastPerformance`) — exécute la requête de la task 2, applique `sessionStruggled` sur les
      séries qualifiantes renvoyées (`done: true` implicite, même filtre que `useLastPerformance`).
      Renvoie `false` s'il n'y a pas d'avant-dernière séance (moins de 2 séances qualifiantes en
      historique) — pas de deload sans donnée suffisante. Pas de test dédié à la requête elle-même
      (même convention que `useLastPerformance`, non testée en tant que requête SQL — la **règle**
      qu'elle alimente est, elle, entièrement couverte côté `packages/shared`).

- [ ] 4. **Branchement** (`apps/mobile/src/app/workout.tsx`, ligne ~271) — ajouter
      `const previousStruggled = usePreviousStruggled(currentExerciseId);` et le passer dans
      `opts` de l'appel à `computeProgressionSuggestion`. Aucune autre ligne de ce fichier ne change
      (l'affichage de `suggestion.kind === 'deload'` existe déjà, ligne ~287).

- [ ] 5. **Vérification** — `npm run typecheck` / `npm run lint` / `npm run test` (lus sans pipe).
      Pas de critère de recette device bloquant la clôture (spec §5 se vérifie en usage normal,
      mais rien n'empêche de clôturer sur la seule base des tests + relecture — la règle et
      l'affichage sont tous deux déjà éprouvés séparément).

- [ ] 6. **Clôture** : `/commit` — front-matter `etape: code` → `recette` (spec §5 a des critères
      observables, contrairement à MUSC-F6) ; roadmap 3.8 → ✅, 3.7 reste 🟡 avec une remarque
      honnête (Volet A non entamé, cadrage séparé nécessaire) ; entrée BACKLOG mise à jour pour
      refléter la scission ; `ETAT.md` régénéré.
