# Plan d'implémentation — IMPORT-01

> Spec : [import01-import-donnees-externes.md](../specs/functional/us/import01-import-donnees-externes.md)
> Branche : `feature/import01-import-donnees-externes`, créée depuis `origin/dev` le 04/08/2026.

## 0. Principes de ce découpage

- **Le gros du travail est du pur, donc testable à 100 %.** Tokenizer CSV, parsing GPX, détection de
  source, mapping par alias, résolution d'exercice, calcul des clés de dédup : tout ça vit dans
  `packages/shared` et se teste sans device, sans base, sans fichier réel. C'est délibéré — c'est
  aussi ce qui permet d'avancer alors que les formats exacts de Hevy/Strong/MFP ne sont pas encore
  confirmés (spec **D4**).
- **Le risque se concentre sur deux points seulement** : la fidélité des alias de colonnes (données
  externes, §7) et le volume de synchro (recette, critère 18).
- **TDD**, et tests d'abord sur les lots 1 à 6. `packages/shared` est à **100 %** d'instructions,
  fonctions et lignes depuis le 04/08/2026 : ces seuils sont **verrouillés par la CI**, tout nouveau
  fichier doit s'y conformer.
- Chaque lot est commitable seul. Les lots 1 → 6 n'ajoutent **aucune** surface visible.

⚠️ **`nvm use 24`** avant de lancer les tests (`.nvmrc`, `node:sqlite`).

## 1. Lot 0 — Migration, sync rules, types

**Fichiers**
- `supabase/migrations/<ts>_import01_traceability.sql` :
  - `import_key text` + `import_batch_id uuid` sur **`runs`**, **`workouts`**, **`food_entries`** ;
  - table **`import_batches`** (+ RLS patron `personal_goals`, trigger `updated_at`, index partiel) ;
  - **extension du `CHECK` de `runs.source`** : `('gps','manual')` → `('gps','manual','import')`.
    ⚠️ Un `check` ne s'étend pas, il se **remplace** : `drop constraint` puis `add constraint`, dans
    la même transaction.
  - `alter publication powersync add table public.import_batches`.
- `docs/specs/technical/powersync-sync-rules.yaml` — `import_batches` dans le bucket `user_data`.
- `apps/mobile/src/powersync/schema.ts` — table neuve **+ les 6 colonnes** sur 3 tables existantes.
  ⚠️ **Relire colonne par colonne** : une colonne absente d'ici fait échouer l'écriture **en
  silence** (panne CYCLE-01 du 31/07).
- `npm run db:types`, puis cocher [supabase/MIGRATIONS.md](../../supabase/MIGRATIONS.md).

**Pas d'index unique sur `import_key`** (spec **D2**) — la dédup est applicative.

## 2. Lot 1 — Tokenizer CSV (`packages/shared/src/csv.ts`)

**N'existe pas dans le dépôt** : `parseFoodCsv` reçoit déjà des `Record<string, string>[]`, la
tokenisation vit dans l'écran admin. On la sort et on la durcit, parce qu'un export réel n'est pas
un CSV d'école.

| Fonction | Contrat |
|---|---|
| `tokenizeCsv(text)` | → `string[][]`. Gère : **guillemets** (`"Poulet, rôti"`), **guillemets échappés** (`""`), séparateurs `,` **et** `;`, fins de ligne `\n` / `\r\n`, **BOM UTF-8**, lignes vides ignorées, dernière ligne sans retour. |
| `rowsToRecords(rows)` | Première ligne = en-têtes normalisés (minuscules, espaces compactés) → `Record<string,string>[]`. |

**Tests** — c'est ici que se cachent les corruptions silencieuses : une virgule dans un nom
d'aliment décale **toutes** les colonnes suivantes, et l'import écrit des calories dans le champ
protéines sans que rien ne le signale.

## 3. Lot 2 — Parsing GPX (`packages/shared/src/gpx-parse.ts`)

`parseGpx(xml)` → `{ tracks: { points: GpsPoint[]; startedAt: string; hasTime: boolean; elevationGainM: number|null; elevationLossM: number|null }[] }`.

- Extraction par **expressions régulières bornées**, pas de parseur XML : on cherche `<trk>`,
  `<trkpt lat=… lon=…>`, `<ele>`, `<time>`. Ajouter une dépendance XML pour lire trois balises serait
  disproportionné, et un GPX de traceur est très régulier.
- `<time>` absent → `hasTime: false`, et **durée/allure `null`** en aval (spec R8).
- Dénivelé cumulé depuis les `<ele>`, avec le **même seuil de bruit que RUN-F1b** pour rester
  cohérent avec les courses natives.
- Dates `<time>` en **UTC** → conversion locale (spec R6).
- Plusieurs `<trk>` → plusieurs courses (spec, cas limites).

**Tests** : GPX nominal, sans `<time>`, sans `<ele>`, multi-`<trk>`, attributs dans l'ordre inverse
(`lon` avant `lat`), XML avec sauts de ligne et indentation variables, fichier tronqué → aucune trace
plutôt qu'une trace corrompue.

## 4. Lot 3 — Détection de source + mapping déclaratif (`packages/shared/src/import-sources.ts`)

Le cœur de la tolérance aux formats (spec **D4**).

```ts
type ColumnSpec = { field: string; aliases: string[]; required: boolean };
type SourceSpec = { source: 'hevy'|'strong'|'myfitnesspal'; columns: ColumnSpec[] };

detectSource(headers): 'hevy'|'strong'|'myfitnesspal'|null   // par recouvrement d'en-têtes
resolveColumns(headers, spec): { map: Record<string,string>; missing: string[] }
```

- **Aucune position figée** : tout passe par des alias d'en-têtes.
- Colonne requise absente → `missing`, et l'écran **nomme la colonne** (spec, cas limites).
- Les alias sont regroupés **dans un seul fichier**, documentés comme **hypothèses à confirmer sur un
  export réel** (§7). Corriger un format = éditer une liste, pas du code.

**Tests** : détection des 3 sources, ambiguïté (en-têtes communs) → `null` plutôt qu'un mauvais
choix, colonne requise manquante, alias en casse et accents différents, colonne surnuméraire ignorée.

## 5. Lot 4 — Mapping muscu (`packages/shared/src/import-strength.ts`)

`mapStrengthRows(records, columnMap, source)` → `{ workouts: ImportedWorkout[]; errors: RowError[] }`,
avec regroupement des lignes en séances (Hevy et Strong sont **une ligne par série**).

- Groupement par `(startedAt, nom de séance)`.
- **Unités** : `weight_kg` explicite → kg ; en-tête en livres → conversion ; **unité indéterminable →
  ligne refusée** (spec, cas limites — se tromper d'unité fausse tous les records).
- `set_type` : mapping vers notre énumération (`normal` / `warmup` / `duration` / `bodyweight`),
  défaut `normal`.
- Ni reps ni durée → ligne en erreur ; séance sans aucune série valide → **non créée**.
- Date future → refusée.

**Tests** : une séance / plusieurs séances, séries d'un même exercice, charge à 0 vs absente
(**0 est une donnée, `null` une absence**), conversion lb→kg, unité inconnue, séance vide,
lignes désordonnées dans le fichier.

## 6. Lot 5 — Mapping nutrition (`packages/shared/src/import-nutrition.ts`)

`mapNutritionRows(...)` → `{ entries: ImportedFoodEntry[]; errors: RowError[] }`.

- Chaque ligne devient un **quick add** : `food_id = null`, nom + kcal + macros du fichier
  (spec **D3/R5**) — aucune correspondance d'aliment tentée.
- `meal_type` : mapping des libellés MFP (`Breakfast`/`Lunch`/`Dinner`/`Snacks`) vers nos clés.
  ⚠️ Un repas inconnu tombe dans **`OTHER_MEAL_KEY`** (déjà utilisé par NUTR-16 et REPAS-01), jamais
  ignoré.
- Dates **locales** (spec R6).

**Tests** : les 4 repas + un repas exotique → `other`, macros absentes → `null`, kcal manquant →
erreur, date invalide, ligne sans nom.

## 7. Lot 6 — Résolution d'exercice (`packages/shared/src/import-exercise-match.ts`)

Les trois passes de **D1**, en pur :

```ts
matchExercise(name, catalog, aliases): { exerciseId: string } | { createAs: string }
```

- passe 1 : nom **normalisé** contre les traductions FR **et** EN (bibliothèque + perso) ;
- passe 2 : **dictionnaire d'alias embarqué** (`EXERCISE_ALIASES`) — point **P1** de la spec, à partir
  des 16 exercices de la bibliothèque ;
- passe 3 : `createAs` → exercice perso à créer.

**Tests** : correspondance exacte, casse/accents, alias EN (`bench press`), deux noms du fichier vers
le même exercice, nom inconnu → `createAs`, nom vide → erreur. Le dictionnaire est **une donnée** :
un test vérifie qu'aucun alias ne pointe vers un exercice absent de la bibliothèque.

## 8. Lot 7 — Repository d'import (`apps/mobile/src/data/repositories/import-repository.ts`)

```
previewImport(fileText, fileName)        → ImportPreview   // aucun écrit en base
runImport(preview)                       → ImportReport
useRecentImportBatches(limit)            → 3 derniers lots
undoImport(batchId)                      → nombre de lignes retirées
```

- **Dédup (R3)** : les clés du fichier sont confrontées en **une seule requête** (`WHERE import_key IN (…)`)
  avant d'écrire — pas une requête par ligne, sinon un fichier de 5 000 lignes fait 5 000 allers-retours.
- Écriture **par lots dans des transactions** (`txInsert`), progression remontée à l'écran.
- **Ordre chronologique croissant** imposé sur les séances (**R14**), puis `evaluateWorkoutRecords`
  par séance avec le nouveau paramètre `achievedAt` (**D12**).
- `undoImport` = soft delete de toutes les lignes du `import_batch_id` **et** du lot.
  ⚠️ Retirer aussi les `personal_records` créés par ces séances (`workout_id` pointe dessus), sinon
  annuler laisserait des records fantômes plus hauts que tout l'historique restant.

**Fichier à étendre** : `records-repository.ts` — `evaluateWorkoutRecords(workoutId, achievedAt?)`,
additif, valeur par défaut = comportement actuel.

**Tests** (harness SQLite) : réimport → 0 créée / N sautées · import partiel · annulation qui retire
exactement le lot (et rien d'autre) · annulation qui retire les records créés · ordre chronologique
respecté (un record de 2024 est bien enregistré après un import contenant 2026) · `achieved_at` = date
de la séance · aucune écriture pendant `previewImport`.

## 9. Lot 8 — Écrans

- `apps/mobile/src/app/data-import/_layout.tsx` + `index.tsx` (choix du fichier + liste des lots
  récents avec « Annuler ») + `preview.tsx` (aperçu et confirmation).
- ⚠️ **Déclarer la route dans `app/_layout.tsx`** (`<Stack.Screen name="data-import" …>`) — l'oubli
  ne casse ni typecheck ni tests, seul l'œil voit l'en-tête manquant (précédent PAS-01).
- Entrée depuis **Réglages**, à côté de l'export RGPD (**D10**).
- `expo-document-picker` : `npx expo install expo-document-picker` (**⚠️ lire la doc Expo v57 avant**,
  cf. `apps/mobile/AGENTS.md`).

**Tests de rendu** : aperçu nominal, fichier refusé (chaque motif), aucune donnée reconnue, liste de
lots vide, confirmation d'annulation. Rendre **dans un `await act`** (idiome §3.6).

## 10. Lot 9 — Transverse

- **i18n** `dataImport.*` FR **et** EN, longueurs identiques, pluriels sur tous les décomptes.
- **Export RGPD** : `import_batches` dans `EXPORT_TABLES` (le test de complétude l'exigera).
- **a11y** : bouton de choix de fichier, aperçu, confirmation ; contrôle à 1,5×.
- **Suivi** : front-matter, roadmap **1.20** (⬜ → ✅/🟡), CHANGELOG, `RECETTES.md`, `scripts/etat.mjs`
  — via `/commit`.
- **Doc** : corriger [compte-profil-onboarding.md §6](../specs/functional/compte-profil-onboarding.md)
  (4 lignes, à remplacer par un renvoi à cette spec).

## 11. Ordre de build et jalons

| Jalon | Lots | Ce qui devient vrai |
|---|---|---|
| **J1** | 0 → 1 | Le CSV se tokenise correctement. Rien de visible. |
| **J2** | 2 → 3 | GPX lu, source détectée, colonnes résolues. |
| **J3** | 4 → 6 | Les 3 formats se mappent vers nos modèles, exercices résolus. |
| **J4** | 7 | Import réel possible, dédup et annulation testées. |
| **J5** | 8 → 9 | **1.20 livrée**, US en recette. |

## 12. Risques

| Risque | Parade |
|---|---|
| 🔴 **Alias de colonnes faux** (formats non vérifiés, D4) | Tout le moteur est **indépendant** des alias : un fichier réel corrige **une liste**, pas du code. Et un fichier non reconnu échoue **en nommant la colonne**, jamais en écrivant de travers. **Il faut un export réel de Hevy, Strong et MFP** — seule dépendance externe de cette US. |
| **Volume de synchro** (des milliers de lignes dans la file PowerSync) | Écriture par lots, progression visible ; **vérifié en recette** (critère 18) sur un gros fichier et un second appareil. Aucun test ne peut le simuler. |
| **Records faux ou datés du jour de l'import** | R14/D12 : ordre chronologique **imposé** et `achievedAt` explicite, tous deux testés au harness. |
| **Annulation laissant des records fantômes** | Test dédié au lot 7 : après annulation, aucun `personal_record` du lot ne subsiste. |
| **Virgule dans un champ** décalant les colonnes | Lot 1 : tokenizer testé sur guillemets, guillemets échappés, séparateurs mixtes. C'est la corruption la plus silencieuse de l'US. |
| Unité de charge ambiguë | Ligne **refusée** plutôt que supposée (lot 4). Une charge en livres prise pour des kg fausse tous les records. |
| Route non déclarée dans `_layout.tsx` | Rappelé au lot 8. Invisible aux tests. |
