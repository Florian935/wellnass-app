# Plan d'implémentation — US ADMIN-01 (archivage sûr du contenu éditorial)

Spec : [admin01-archivage-sur.md](../specs/functional/us/admin01-archivage-sur.md) ·
Roadmap **8.11** · Branche `feature/admin01-archivage-sur` · Estimation roadmap ~4 h.

> ⚠️ **Ne pas démarrer** avant l'arbitrage de **D1 → D7** (spec §1). **D2 décide de la forme de tout
> le lot** : sans elle, on ne livre qu'un garde-fou et le bug d'historique reste entier.
>
> ⚠️ **L'essentiel du risque n'est pas dans l'admin, il est dans l'app** (tâche 4). Modifier la sync
> rule rend le contenu archivé visible partout où l'app ne filtre pas explicitement. C'est la seule
> tâche capable d'introduire une régression visible pour l'utilisateur.

## Maquette

[design/admin01-archivage-sur/](../../design/admin01-archivage-sur/) — confirmation d'archivage avec
décomptes, filtre « archivés », ligne archivée et sa restauration, rapport d'import.

## Fichiers touchés

**Créés**

| Fichier | Rôle |
|---|---|
| `apps/admin/src/data/usage-counts.ts` | Décompte des usages par type de contenu |
| `apps/admin/src/data/__tests__/usage-counts.test.ts` | Tests du décompte (agrégation, zéro, erreurs) |
| `apps/admin/src/components/ArchiveConfirmDialog.tsx` | Confirmation portant les décomptes |

**Modifiés**

| Fichier | Modification |
|---|---|
| `apps/admin/src/data/exercises.ts` | `restoreExercise` (cascade miroir) + audit `exercise.restore` ; lecture des archivés |
| `apps/admin/src/data/programs.ts` | `restoreProgram` (miroir de `archiveProgram` : entête → enfants) + audit |
| `apps/admin/src/data/foods.ts` | `restoreFood` + audit ; **import : réactiver un aliment archivé** (D7) et le compter |
| `apps/admin/src/screens/{Exercises,Programs,Foods}Screen.tsx` | Filtre actifs / archivés / tous + action Restaurer + dialogue de confirmation |
| `apps/admin/src/screens/FoodImportScreen.tsx` | Rapport d'import : ligne « N aliments archivés réactivés » |
| `apps/admin/src/i18n/{fr,en}.ts` | Libellés du filtre, confirmations avec décomptes (pluriels), « Archivé le … », erreurs |
| `docs/specs/technical/powersync-sync-rules.yaml` | `shared_content` : retirer `deleted_at is null` des tables éditoriales (**D2**) |
| `apps/mobile/src/data/repositories/*.ts` | Ajouter `deleted_at IS NULL` aux requêtes de **sélection** (tâche 4) |

**Volontairement non touchés** : `workout_sets` et `food_entries` (aucune dénormalisation de nom —
alternative écartée, spec §4) ; le contenu **utilisateur** (`owner_id = user`), hors périmètre.

---

### Tâche 1 — Décompte des usages (TDD)

Tests d'abord sur la partie pure (agrégation d'un jeu de décomptes en un résumé affichable) ; les
requêtes elles-mêmes sont des entrées/sorties.

1. `countExerciseUsage(id)` → `workout_sets`, `exercise_plans`, `personal_records`,
   `exercise_variants` (vivants seulement).
2. `countProgramUsage(id)` → `sessions`, `exercise_plans`, `planned_sessions`.
3. `countFoodUsage(id)` → `food_entries`, `recipe_ingredients`, `meal_template_items`.
4. `summarizeUsage(counts)` — **pure et testée** : total, détail non nul, et le cas **zéro** qui doit
   produire un message explicite (« aucun usage ») plutôt qu'une liste vide.

⚠️ Ces comptages traversent les données de **tous** les utilisateurs. Vérifier **avant de coder l'UI**
que la RLS admin les autorise : `select count(*)` sous une session admin sur `workout_sets` d'un autre
utilisateur. Si la RLS le refuse, il faut une fonction SQL `security definer` réservée aux admins →
**migration**, à instruire à ce moment-là et pas après.

### Tâche 2 — Restauration en cascade (les 3 types)

- `restoreExercise(id)` : `exercises` puis `exercise_translations` (`deleted_at → null`), audit
  `exercise.restore`.
- `restoreProgram(id)` : **miroir exact** de `archiveProgram` — entête, traductions, séances, plans.
  Justification de l'ordre inverse : à l'archivage on va du fin vers l'entête pour ne jamais laisser
  d'orphelin **visible** ; à la restauration on va de l'entête vers le fin pour la même raison.
- `restoreFood(id)` : `foods` puis `food_translations`, audit.
- **Ne jamais toucher `status`** (D5). Idempotence : filtrer sur `deleted_at is not null`.

### Tâche 3 — UI admin (3 écrans)

- Filtre à 3 valeurs (actifs par défaut, D6), sur le patron de `statusFilter` déjà présent.
- Ligne archivée : « Archivé le JJ/MM/AAAA », seule action **Restaurer**.
- `ArchiveConfirmDialog` : affiche les décomptes de la tâche 1 avant d'archiver. Rien ne s'archive
  sans que l'admin ait vu ce chiffre (D1).
- i18n FR + EN, pluriels compris.

### Tâche 4 — Sync rule + audit des requêtes de l'app ⚠️ **la tâche à risque**

1. Retirer `deleted_at is null` des tables éditoriales de `shared_content`
   ([powersync-sync-rules.yaml](../specs/technical/powersync-sync-rules.yaml)).
2. **Redéployer la sync rule à la main** dans le dashboard PowerSync.
3. **Recenser toutes** les requêtes de l'app qui lisent du contenu éditorial, et les classer :
   - **sélection** (choisir un exercice/aliment, bibliothèque de programmes) → ajouter
     `deleted_at IS NULL` ;
   - **résolution de nom** (historique, records, journal) → **ne rien ajouter**, c'est le correctif.
4. Point de départ du recensement : `grep -rn "FROM exercises\|FROM foods\|FROM programs"` dans
   `apps/mobile/src/data/repositories/`. Traiter chaque occurrence **explicitement** — ne pas se fier
   à une relecture rapide, c'est là que la régression se glisserait.
5. Vérifier le cas nominal : un exercice archivé garde son nom dans l'historique et disparaît de la
   sélection.

### Tâche 5 — Import CSV (D7)

- Avant l'upsert, repérer les `import_key` correspondant à des aliments **archivés**.
- Les réactiver (`deleted_at → null`) dans la même passe.
- Ajouter la ligne « N aliments archivés réactivés » au rapport d'import — un import qui réactive en
  silence est aussi trompeur qu'un import qui échoue en silence.

---

## Ordre de build et pourquoi

1. **Tâche 1** — le décompte conditionne le dialogue, et sa question de RLS peut imposer une migration :
   à découvrir **en premier**, pas à la fin.
2. **Tâche 2** puis **3** — restauration avant l'UI qui l'appelle.
3. **Tâche 4** — **en dernier des tâches fonctionnelles**, et d'un seul bloc : sync rule redéployée
   **et** requêtes de l'app auditées dans la même passe. Faire l'un sans l'autre laisse l'app dans un
   état incohérent (contenu archivé proposé à la sélection).
4. **Tâche 5** — indépendante, peut se faire à tout moment après la tâche 2.

## Tests prévus

| Niveau | Quoi |
|---|---|
| Vitest (`admin`) | `summarizeUsage` : total, détail, **cas zéro**, décomptes partiels |
| Vitest (`admin`) | Restauration : cascade appelée dans le bon ordre, `status` **non** modifié, idempotence |
| Manuel navigateur | Les 6 premiers critères de recette de la spec §9 |
| Manuel device (prochain build) | Critères 7 et 8 — nom conservé dans l'historique, absent de la sélection |

## Risques

| Risque | Parade |
|---|---|
| 🔴 **Contenu archivé proposé à la sélection** après le changement de sync rule | Tâche 4 traitée **d'un bloc** et requête par requête, avec recensement écrit ; critère de recette 7 |
| **Sync rule non redéployée** → le bug d'historique reste entier alors que l'US est « livrée » | Étape explicite (tâche 4.2), **en DoD**, et critère de recette 7 |
| **RLS bloque le décompte** inter-utilisateurs | Vérifié en **tâche 1**, avant toute UI ; si besoin, fonction `security definer` réservée aux admins (migration) |
| Restauration partielle laissant une coquille vide | Cascade miroir testée (tâche 2), ordre entête → enfants |
| `status` republié par accident à la restauration | D5 : `status` n'est jamais dans le payload ; test dédié |
| Import réactivant en silence | D7 : compté et affiché dans le rapport (tâche 5) |
| Régression sur l'archivage existant | L'archivage n'est pas réécrit — on **ajoute** le décompte devant, et la restauration à côté |
