---
id: IMPORT-01
titre: "Import de données depuis d'autres apps — GPX (Strava), CSV (Hevy, Strong, MyFitnessPal)"
roadmap: [1.20]
catalogue: []
etape: validation
branche: feature/import01-import-donnees-externes
maj: 04/08/2026
bloque: "En attente d'un export réel de Hevy, Strong et MyFitnessPal pour figer les alias de colonnes (D4). Procédure et jeu de données attendu : docs/specs/technical/import-samples/README.md"
---

# IMPORT-01 — Import de données depuis d'autres apps

> ## ⏸️ EN PAUSE — décision du 04/08/2026 (Florian)
>
> **Les trois livrables d'amont sont terminés** (spec, plan, maquette). Le développement est
> **volontairement arrêté avant la première ligne de code**, sur une dépendance externe que je ne
> peux pas produire moi-même : il faut **un export réel de Hevy, de Strong et de MyFitnessPal**.
>
> **Pourquoi ne pas coder quand même.** Je pourrais écrire tout le moteur sur des hypothèses de
> colonnes (**D4**) : ça marcherait probablement, et le premier fichier réel dirait lesquelles sont
> fausses. Mais chaque hypothèse fausse se paie deux fois — une fois pour écrire le code, une fois
> pour le corriger avec les tests qui l'accompagnent. Sur trois formats à ~10 colonnes chacun, ça
> représente l'essentiel du travail de mapping. Coder après réception est **moins cher que coder
> avant**, et le cadrage, lui, est déjà fait et ne se perdra pas.
>
> **Ce qui est attendu**, et comment l'obtenir :
> [docs/specs/technical/import-samples/README.md](../../technical/import-samples/README.md).
>
> **Ce qui n'est PAS bloqué** et pourrait démarrer si on voulait avancer sans les fichiers : les
> lots 1 à 3 du plan (tokenizer CSV, parsing GPX, détection de source) sont **indépendants des
> alias**. Le GPX est un standard, il ne pose aucun problème. Décision prise de **ne pas** les
> commencer pour l'instant : découper l'US en deux moitiés livrées à des semaines d'écart coûte plus
> en reprise de contexte que ça ne fait gagner.
>
> **Reprise** : lire ce bloc, puis le §7 du plan, puis dérouler les lots dans l'ordre. Rien d'autre
> à retrouver.

> **Origine** : roadmap **1.20**, « clé d'adoption pour la cible multi-apps — à remonter en V0.8 si
> la bêta le réclame ». **Dernier item de dev non démarré de toute la roadmap.** Remontée de V1.1
> dans le périmètre courant le **04/08/2026 (arbitrage Florian)**.
>
> **Pourquoi cette US porte le positionnement.** La [vision](../../../product/vision.md) vise
> explicitement les gens qui utilisent déjà **Strava + MyFitnessPal + Strong/Hevy**. Or on leur
> demande aujourd'hui d'abandonner leur historique pour venir — c'est-à-dire de perdre ce qui les
> attache à leurs outils actuels. Un import est le seul moyen de rendre la bascule possible sans
> sacrifice. Cadrage d'origine : quatre lignes dans
> [compte-profil-onboarding.md §6](../compte-profil-onboarding.md).

## 0. Point de départ — ce qui existe déjà

| Brique | État | Conséquence |
|---|---|---|
| `encodeSegment` / `appendToTrack` / `decodeTrack` (`running.ts`) | ✅ livré | Écrire une trace importée = `appendToTrack('', encodeSegment(points))`. **Rien à inventer** sur le stockage GPS. |
| `buildGpx` (`gpx.ts`) | ✅ livré (**écriture** seule) | Le **parsing** GPX reste à écrire — mais le format est déjà connu du projet. |
| `parseFoodCsv` + `FoodImportScreen` (admin) | ✅ livré | **Le patron complet à copier** : parser → aperçu (N valides / M erreurs **par ligne**) → import. Éprouvé sur l'import CIQUAL. |
| `runs.source` | ✅ existe, `check in ('gps','manual')` | ⚠️ **À étendre à `'import'`** (migration). |
| `food_entries.food_id` **nullable** | ✅ | Décisif : une entrée alimentaire importée est un **quick add** (nom + macros), **aucune résolution d'aliment nécessaire**. |
| `workout_sets.exercise_id` **NOT NULL** + FK | ✅ | Décisif dans l'autre sens : **impossible d'importer une série sans résoudre l'exercice**. C'est le point dur de l'US (**D1**). |
| `exercises.source` `check in ('library','custom')` | ✅ | Un exercice inconnu peut devenir un exercice **perso** — le chemin existe déjà (MUSC-F10). |
| `foods.import_key` | ✅ livré | Le **patron de déduplication** à reprendre. |
| `evaluateWorkoutRecords` (`records-repository.ts`) | ✅ livré, appelée **uniquement** par `workout.tsx` | `personal_records` **n'est pas dérivée** : sans appel explicite, un historique importé n'aurait aucun record (**R14**, **D12**). Et comme `maybePushRecords` est ailleurs, le silence des notifications pendant un import est **gratuit** (**D9**). |
| `expo-document-picker` | ❌ **absent** | ⚠️ Dépendance native neuve → **nouveau build requis** avant recette. |

## 1. Périmètre

**Quatre sources, trois piliers.** L'utilisateur choisit un fichier depuis le stockage de son
téléphone, l'app **annonce ce qu'elle a compris**, il valide, l'app importe et rend un rapport.

| Source | Format | Cible | Contenu repris |
|---|---|---|---|
| **Strava** (et tout traceur) | `.gpx` | `runs` | Trace GPS, date, distance, durée, dénivelé si présent |
| **Hevy** | `.csv` | `workouts` + `workout_sets` | Séances, exercices, séries (reps, charge, durée), RPE |
| **Strong** | `.csv` | `workouts` + `workout_sets` | Idem |
| **MyFitnessPal** | `.csv` | `food_entries` | Entrées par jour et par repas, avec kcal et macros |

**Hors périmètre, explicitement** :

- **Aucun import par API / OAuth** (Strava Connect, etc.) : hors sujet ici, et l'app est
  offline-first — on lit un fichier, on ne parle à aucun service.
- **Aucun import de programmes / plans** (seul l'**historique réalisé** est repris).
- **Aucune fusion d'exercices** post-import (« ces deux exercices n'en font qu'un ») : c'est une US
  à part, mentionnée en §9.
- **Aucun import de poids corporel, de mensurations, de sommeil** — sources trop hétérogènes pour
  cette itération, et le poids se ressaisit en quelques secondes.
- **Aucun import de photos ni de fichiers d'un autre appareil** (pas de transfert réseau).

## 2. Modèle de données

### 2.1 Traçabilité de l'import — ce qui rend la dédup et l'annulation possibles

Trois colonnes additives sur les tables cibles, plus une table de lots :

```sql
-- Clé naturelle DÉTERMINISTE de la ligne source (voir R3). Réimporter le même fichier
-- recalcule les mêmes clés → aucun doublon, sans contrainte d'unicité en base (D2).
alter table public.runs         add column if not exists import_key text;
alter table public.workouts     add column if not exists import_key text;
alter table public.food_entries add column if not exists import_key text;

-- Lot d'import : permet d'ANNULER un import entier d'un geste (D8), et de dire à
-- l'utilisateur ce qui vient d'où.
alter table public.runs         add column if not exists import_batch_id uuid;
alter table public.workouts     add column if not exists import_batch_id uuid;
alter table public.food_entries add column if not exists import_batch_id uuid;

create table public.import_batches (
  id            uuid primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  source        text not null check (source in ('gpx','hevy','strong','myfitnesspal')),
  file_name     text,
  imported_at   timestamptz not null default now(),
  -- Compteurs figés à l'import : l'écran « annuler » doit pouvoir dire ce qu'il va retirer
  -- sans recompter (et sans dépendre de lignes que l'utilisateur aurait modifiées depuis).
  created_count integer not null default 0,
  skipped_count integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
```

Plus l'extension du `CHECK` de `runs.source` pour accueillir `'import'` : une course importée n'est
ni du GPS temps réel, ni une saisie manuelle, et l'écran doit pouvoir le dire.

⚠️ **Aucun index unique sur `import_key`**, délibérément — même raison que pour REPAS-01 (D6) : en
offline-first, deux appareils important le même fichier hors réseau produiraient une violation
d'unicité qui **fait échouer l'upload PowerSync et bloque la file d'écriture**. La déduplication se
fait **à la lecture**, avant insertion (R3).

### 2.2 Ce qui n'est pas stocké

Les données de la source qui n'ont pas de place chez nous ne sont **pas** inventées : elles sont
**comptées et annoncées** dans le rapport (R9). Exemples : les supersets de Hevy (notre modèle a
`workout_superset_pairs`, mais l'appariement exact n'est pas reconstituable de façon fiable), les
notes par série, la fréquence cardiaque.

## 3. Règles métier

- **R1 — L'import ne détruit jamais rien.** Il **ajoute**. Aucune donnée existante n'est modifiée
  ni écrasée, jamais. Un utilisateur qui importe par erreur doit retrouver son app exactement comme
  avant après annulation (**D8**).
- **R2 — Rien n'est écrit sans un aperçu validé.** Le fichier est parsé, l'app annonce ce qu'elle a
  compris (nombre de séances / courses / entrées, période couverte, exercices inconnus, lignes en
  erreur), **puis** l'utilisateur confirme. C'est la règle du module d'import CIQUAL, et c'est ce qui
  rend l'opération non effrayante.
- **R3 — Déduplication par clé déterministe.** Chaque ligne importée reçoit une `import_key`
  calculée **du contenu de la source**, pas du hasard :
  - course : `gpx:<startedAt ISO à la seconde>` ;
  - séance : `<source>:<startedAt ISO>:<nom normalisé>` ;
  - entrée alimentaire : `mfp:<date>:<repas>:<nom normalisé>:<kcal>`.

  Avant insertion, l'app vérifie l'existence de la clé pour cet utilisateur : si elle existe, la
  ligne est **sautée** et comptée. **Réimporter le même fichier deux fois ne crée donc rien** — et
  réimporter un fichier plus récent n'ajoute que les nouveautés, ce qui est le cas d'usage réel
  (« je réexporte tous les mois »).
- **R4 — Résolution d'exercice en trois passes**, jamais de perte silencieuse (**D1**).
- **R5 — Les entrées alimentaires n'ont pas besoin d'aliment.** `food_entries.food_id` est nullable :
  une ligne MFP devient un **quick add** portant son nom et ses macros. On ne cherche **pas** à faire
  correspondre « Poulet rôti » à notre base — ce serait une correspondance approximative sur des
  valeurs nutritionnelles **déjà présentes dans le fichier**, donc un risque pour zéro bénéfice.
- **R6 — Les fuseaux ne sont pas devinés.** Un GPX porte des dates **UTC** (`<time>` ISO 8601 avec
  `Z`) : elles sont converties en heure locale de l'appareil. Un CSV Hevy/Strong/MFP porte des dates
  **locales sans fuseau** : elles sont lues **telles quelles**, comme des dates locales. Se tromper
  ici décale des séances d'un jour, et l'utilisateur le voit tout de suite dans son historique.
- **R7 — Une ligne illisible n'invalide pas le fichier.** Chaque ligne est validée
  indépendamment ; les valides s'importent, les autres sont **listées avec leur numéro de ligne et
  la raison**. Refuser tout un export de 3 ans pour une cellule vide serait absurde.
- **R8 — Aucune valeur inventée.** Une donnée absente reste `null` : pas de 0 par défaut sur une
  charge, pas de durée déduite, pas d'allure recalculée quand la distance manque. Un `0 kg` affiché
  se lit comme une performance, un `null` se lit comme une absence.
- **R9 — Le rapport dit ce qui n'a pas été repris.** Nombre de lignes sautées (doublons), en erreur,
  et de champs ignorés faute de place dans notre modèle (§2.2). Un import qui annonce « 1 240 lignes
  importées » alors qu'il en a écarté 300 est un mensonge par omission.
- **R10 — Les séances importées sont des séances libres.** `session_id`, `program_id` et
  `planned_session_id` restent `null` : rattacher un historique à un programme qu'on n'a pas suivi
  fabriquerait une adhérence fausse.
- **R11 — Statut `finished`.** Une séance ou une course importée est terminée par construction : elle
  n'apparaît jamais comme active, et ne peut pas être « reprise ».
- **R12 — L'import alimente les analyses comme le reste.** Records, streak, volumes, tendances : une
  séance importée est une séance. C'est le but — sinon l'historique repris resterait décoratif.
  ⚠️ Conséquence assumée : importer 3 ans d'historique **peut faire apparaître de nouveaux records**
  (D9).
- **R13 — Plafond de volume annoncé, jamais un plantage.** Au-delà de **20 000 lignes**, le fichier
  est refusé avec un message clair (et non une app figée). Un export MFP de 10 ans reste sous ce
  plafond ; au-delà, il faut découper.
- **R14 — Les records importés portent la date de la séance, et se construisent dans l'ordre.**
  `personal_records` n'est **pas** dérivée : elle est écrite par `evaluateWorkoutRecords`, qui compare
  au meilleur existant et horodate `achieved_at` à **maintenant**. Deux conséquences, toutes deux
  obligatoires pour que R12 soit vraie :
  1. les séances importées sont traitées **dans l'ordre chronologique croissant**, sinon un record de
     2024 serait écarté parce qu'une séance de 2026 déjà en base fait mieux — et l'historique des
     records serait faux ;
  2. `achieved_at` doit valoir la **date de la séance**, pas celle de l'import. Sans ça, l'écran
     Records annoncerait « record établi le 04/08/2026 » pour une performance de 2024.

## 4. Décisions

| # | Question | Décision | Motif |
|---|---|---|---|
| **D1** | Comment résoudre « Bench Press » vers **notre** exercice ? | **Trois passes** : (1) correspondance exacte sur nom **normalisé** contre `exercise_translations` FR **et** EN (bibliothèque + exercices perso) ; (2) **dictionnaire d'alias embarqué** pour les mouvements courants (`bench press` → Développé couché, `squat`, `deadlift`, `ohp`…) ; (3) à défaut, **création d'un exercice perso** (`source='custom'`, `owner_id` = utilisateur) portant le nom du fichier. | La passe 3 seule polluerait la bibliothèque de doublons (« Bench Press » **et** « Développé couché ») ; les passes 1-2 seules **perdraient des séries** puisque `exercise_id` est NOT NULL. L'aperçu (**R2**) montre le mapping **avant** d'écrire, et le rapport compte les exercices créés. |
| **D2** | Contrainte d'unicité sur `import_key` ? | **Aucune.** Dédup à la lecture (R3). | Une violation d'unicité bloque la file d'upload PowerSync en offline multi-appareils. Leçon de REPAS-01 (D6). |
| **D3** | Faire correspondre les aliments MFP à notre base ? | **Non** (R5). Quick add avec les macros du fichier. | Le fichier **contient déjà** kcal et macros. Une correspondance approximative risquerait de substituer des valeurs nutritionnelles différentes de ce que la personne a réellement mangé — pour aucun gain. |
| **D4** | Détection des colonnes | **Par en-tête, avec alias**, jamais par position. Colonne requise absente → fichier refusé **en nommant la colonne**. | ⚠️ **Point dur externe** : les colonnes exactes de Hevy / Strong / MFP **n'ont pas pu être vérifiées** en écrivant cette spec (pas de fichier réel sous la main), et ces formats **changent** au fil des versions. Un mapping par alias absorbe les variantes, et l'échec est explicite au lieu d'être silencieux. **Il faut un export réel de chaque app pour figer les alias** — voir §5 « ce qui bloque ». |
| **D5** | Aperçu obligatoire ? | **Oui** (R2), patron `FoodImportScreen`. | Écrire 3 ans d'historique sans montrer ce qu'on a compris est le meilleur moyen de faire fuir quelqu'un à sa première utilisation. |
| **D6** | Sélecteur de fichiers | **`expo-document-picker`**. | Seule voie pour lire un fichier du stockage. ⚠️ Dépendance native → **nouveau build** (à grouper avec PARTAGE-01 / RUN-F2a / MUSC-F9 / LAUNCHER-01, qui en attendent déjà un). |
| **D7** | Import partiel autorisé ? | **Oui** (R7) : les lignes valides passent, les autres sont listées. | Le tout-ou-rien transforme une coquille en échec total. |
| **D8** | Peut-on **annuler** un import ? | **Oui** — « Annuler cet import » soft-delete toutes les lignes du `import_batch_id`. Disponible sur les **3 derniers lots**. | C'est ce qui rend l'essai possible sans peur. Sans annulation, la seule issue après un import raté est de supprimer les lignes une par une — donc personne n'essaie. Coût faible : une colonne et une requête. |
| **D9** | Un import peut-il créer des **records** ? | **Oui**, et c'est voulu (R12) — mais **aucune notification de record n'est émise pendant un import**. | Un historique repris qui ne compterait pas serait décoratif. En revanche recevoir 40 pushs « nouveau record ! » en important 3 ans serait insupportable — le backfill est silencieux, comme pour MUSC-F8 côté course. |
| **D10** | Où vit l'écran ? | **Réglages → « Importer mes données »**, à côté de l'export RGPD. | C'est là qu'on cherche ce genre d'outil, et l'export est déjà voisin. Pas de place sur un hub quotidien : on importe une fois. |
| **D11** | Un fichier de source inconnue ? | Détection automatique par les en-têtes, avec **choix manuel en repli** (« ce fichier vient de… »). | Un `.csv` ne dit pas de quelle app il sort. Devinez faux et vous écrivez des séances dans le journal alimentaire. |
| **D12** | Comment les records d'un historique importé s'enregistrent-ils ? | **Réutiliser `evaluateWorkoutRecords` par séance, dans l'ordre chronologique croissant**, en l'étendant d'un paramètre **`achievedAt` optionnel** (additif, sans effet sur l'appelant existant). | La table n'est pas dérivée (R14). Ne rien faire laisserait l'historique importé sans aucun record — R12 serait un vœu. Appeler dans le désordre, ou sans dater, produirait un historique de records **faux**, ce qui est pire que vide. Bénéfice collatéral : `maybePushRecords` n'est appelée que par `workout.tsx`, donc **le silence des notifications (D9) est gratuit** — il suffit de ne pas l'appeler. |

**Reste à trancher par Florian ou Damien** (aucune ne bloque le démarrage du code) :

- **P1 — Contenu du dictionnaire d'alias (D1, passe 2)** : je propose de partir des **16 exercices de
  la bibliothèque** actuelle, avec leurs noms EN les plus courants. Faut-il aller plus loin (100+
  alias) ? C'est du travail de coach, pas de dev, et ça peut s'enrichir après le lancement.
- **P2 — Plafond de 20 000 lignes (R13)** : chiffre proposé, à valider. Il faut qu'un export MFP de
  plusieurs années passe, sans qu'on se retrouve à insérer 200 000 lignes dans SQLite d'un coup.

## 5. Cas limites

| Situation | Comportement attendu |
|---|---|
| Fichier vide ou 0 ligne exploitable | Refus explicite (« aucune donnée reconnue »), aucune écriture, aucun lot créé. |
| Fichier qui n'est ni GPX ni CSV | Refus avant parsing, message nommant les formats acceptés. |
| Colonne requise absente | Refus **en nommant la colonne manquante** (D4) — jamais un import à moitié faux. |
| GPX sans balise `<time>` | Trace importée, mais **durée et allure `null`** (R8). La course existe avec sa distance. |
| GPX sans `<ele>` | `elevation_gain_m` / `_loss_m` restent `null` (comme une course pré-RUN-F1b). |
| GPX multi-traces (`<trk>` multiples) | **Une course par `<trk>`**, chacune avec sa propre clé d'import. |
| Séance sans aucune série valide | Séance **non créée** (une séance vide n'est pas un historique), comptée en erreur. |
| Série sans reps **et** sans durée | Ligne en erreur, le reste de la séance passe. |
| Charge en **livres** dans le fichier | Convertie en kg. Le stockage est **toujours** en SI (convention du projet). ⚠️ Si l'unité n'est pas déductible de l'en-tête, la ligne est **refusée** plutôt que supposée — se tromper d'unité fausse tous les records. |
| Exercice inconnu | Exercice perso créé (D1 passe 3), **compté et annoncé** dans le rapport. |
| Deux exercices du fichier qui mappent le même exercice chez nous | Autorisé : deux séries du même exercice dans la séance. |
| Réimport du même fichier | **0 ligne créée**, N sautées (R3). Le rapport le dit clairement. |
| Réimport d'un fichier plus récent | Seules les nouvelles lignes entrent. |
| Import pendant que l'app est hors réseau | Fonctionne (tout est local), remonte à la synchro suivante. |
| Annulation d'un import dont des lignes ont été **modifiées** depuis | Les lignes du lot sont retirées quand même (elles portent le `import_batch_id`) ; l'écran **avertit** que des modifications seront perdues. |
| Fichier de 20 001 lignes | Refus avec le compte réel et le plafond (R13). |
| Date future dans le fichier | Ligne refusée : un historique ne contient pas demain. |

> 🔴 **Ce qui bloque réellement le démarrage du code** : il faut **un export réel de Hevy, de Strong
> et de MyFitnessPal** pour figer les alias de colonnes (D4). Sans eux, je peux écrire tout le
> moteur — parsers, mapping, dédup, écrans, tests — mais les alias resteront des **hypothèses
> documentées**, et le premier fichier réel les corrigera. Le GPX, lui, est un standard : il ne pose
> pas ce problème. Deux façons de débloquer : un export depuis vos comptes, ou un fichier d'exemple
> trouvé dans la documentation publique de chaque app.

## 6. i18n (FR + EN)

Nouveau namespace **`dataImport.*`** — `import` est un mot réservé de JavaScript, on évite l'ambiguïté
jusque dans les clés.

- `dataImport.title`, `.subtitle`, `.pick` (choisir un fichier), `.sourceUnknown.*` (choix manuel, D11).
- `dataImport.preview.*` : période couverte, décomptes par type, exercices à créer, lignes en erreur,
  `.confirm`, `.cancel`.
- `dataImport.report.*` : `.created`, `.skipped` (doublons), `.errors`, `.exercisesCreated`,
  `.ignoredFields` (R9) — tous **pluralisables**.
- `dataImport.errors.*` : `.emptyFile`, `.unsupportedFormat`, `.missingColumn` (avec le nom),
  `.tooManyRows` (avec le compte et le plafond), `.futureDate`, `.unknownUnit`.
- `dataImport.batches.*` : liste des 3 derniers imports, `.undo`, `.undoConfirm` (avec le décompte),
  `.undoWarnModified` (cas limite).
- **Noms des sources non traduits** : « Strava », « Hevy », « Strong », « MyFitnessPal » sont des
  marques.

## 7. Comportement offline

- **100 % local.** Lire un fichier, le parser, écrire en base : aucun réseau à aucune étape. L'import
  fonctionne en mode avion et remonte à la synchro suivante (décision B, ADR-001).
- Écritures via repository (`insertWithSyncFields` / `txInsert` en transaction), UUID côté client,
  timestamps UTC, soft delete.
- ⚠️ **Volume et synchro** : importer 3 ans d'historique crée des milliers de lignes qui partiront
  **toutes** dans la file d'upload PowerSync. À vérifier en recette sur un gros fichier (critère 18) —
  c'est le seul risque technique que les tests ne couvriront pas.
- ⚠️ **1 table neuve (`import_batches`) + 6 colonnes ⇒ sync rules PowerSync à redéployer à la main.**
- `import_batches` entre dans l'**export RGPD** (le test de complétude l'imposera de toute façon).

## 8. Critères de recette

⚠️ **Nouveau build requis** (D6, `expo-document-picker`).

1. Réglages → « Importer mes données » est accessible, à côté de l'export.
2. Choisir un `.gpx` Strava : l'aperçu annonce la bonne date, la bonne distance, la bonne durée.
3. Confirmer : la course apparaît dans l'historique course, **avec sa trace affichée sur la carte**.
4. La course importée est marquée comme telle (source « import »), distincte d'une course GPS.
5. Choisir un CSV **Hevy** : l'aperçu annonce le nombre de séances et la période couverte.
6. L'aperçu liste les **exercices inconnus** qui seront créés, avant toute écriture.
7. Confirmer : les séances apparaissent dans l'historique muscu, avec leurs séries (reps + charge).
8. Les exercices inconnus ont bien été créés en **perso**, et sont utilisables dans une séance normale.
9. Un exercice du fichier qui existe déjà chez nous (« Squat ») **n'a pas** été dupliqué.
10. Idem 5→7 avec un CSV **Strong**.
11. Choisir un CSV **MyFitnessPal** : les entrées apparaissent aux bons jours et dans les bons repas.
12. Les totaux du journal d'un jour importé sont cohérents avec le fichier source.
13. **Réimporter exactement le même fichier** : le rapport annonce **0 créée / N sautées**, et
    l'historique n'a pas bougé.
14. Un fichier avec quelques lignes cassées : les bonnes passent, les mauvaises sont listées **avec
    leur numéro de ligne**.
15. Un fichier d'un format inconnu, et un fichier vide : refus explicite, aucune écriture.
16. **« Annuler cet import »** retire exactement les lignes du lot, et rien d'autre. L'app est
    revenue à son état d'avant.
17. **Aucune notification de record** n'est reçue pendant un import qui en crée pourtant (D9) ; les
    records sont bien visibles dans l'écran Records après coup.
18. **Gros fichier** (plusieurs milliers de lignes) : l'app ne se fige pas, la progression est
    visible, et la synchro finit par tout remonter (à vérifier sur un second appareil).
19. **Mode avion** : l'import complet fonctionne ; retour en ligne, tout remonte.
20. FR → EN : tous les libellés changent, y compris les messages d'erreur et le rapport.
21. Police 1,5× : l'aperçu et le rapport restent lisibles (écrans les plus denses).
22. TalkBack : le bouton de choix de fichier, l'aperçu et la confirmation sont annoncés.
23. Export RGPD : le fichier contient les lots d'import.

## 9. Ce que cette US ne fait pas

- Import par **API/OAuth** (Strava Connect) · import de **programmes** · import de poids /
  mensurations / sommeil · **fusion** d'exercices en doublon après import (US à part, qui devient
  utile *à cause* de celle-ci) · import depuis un autre appareil par le réseau · reprise des
  **supersets** et de la **FC** (§2.2).
- Elle **ne modifie aucune donnée existante** : elle n'ajoute que des lignes, toutes annulables (R1).
