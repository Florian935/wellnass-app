# Spec — Enrichissement du seed avec les données CIQUAL (micros + sous-macros)

> **Statut** : ✅ livré (14/07/2026). Prérequis produit du **panel nutritionnel étendu** (US livrée).
>
> ### ⚠️ Révision d'approche (14/07/2026, actée avec Florian) — supersède les §2-6 ci-dessous
> Après réception de l'export réel (CIQUAL 2025) et discussion, l'approche a évolué :
> - **Approche A** : on ne « patche » plus les 50 aliments ; on **reconstruit la bibliothèque
>   entièrement depuis CIQUAL**. Les 50 aliments **gardent leur identité** (UUID, noms FR/EN,
>   catégorie, portions) mais **toute** leur nutrition vient de CIQUAL — **y compris les macros de
>   base** (la décision « macros intactes » est **annulée**). **+30 aliments** ajoutés (fruits,
>   légumes, viandes/poissons, légumineuses, oléagineux).
> - **Livraison = MIGRATION versionnée** (et **non** seed.sql + one-shot console) : nouvelle règle
>   CLAUDE.md « jamais de SQL manuel ». La bibliothèque **quitte `seed.sql`** et vit dans
>   `supabase/migrations/20260714120000_seed_library_foods_ciqual.sql` (upsert **idempotent** :
>   réconcilie les 50 existants du cloud + insère les 30, rejouable au `db:reset`).
> - **Oméga** = somme des AG mesurés CIQUAL (ALA+EPA+DHA / LA+AA / oléique). **Absents de CIQUAL** :
>   `trans_fat_g`, `vitamin_b7_ug` (biotine) → jamais renseignés. **Café noir** : pas de café-boisson
>   dans CIQUAL → non mappé, valeurs conservées.
> - **Tooling** : `supabase/scripts/enrich-ciqual/` (générateur Python + `foods-catalog.json` +
>   `mapping-columns.json`). Export brut hors git.

## 1. Problème / valeur

Le panel affiche désormais 31 micronutriments, mais la donnée détaillée **n'existe pas** sur les
produits scannés OpenFoodFacts (étiquette UE limitée). Elle existe en revanche pour les **aliments
bruts** dans la table **CIQUAL** (ANSES). Le seed actuel (~50 aliments) n'enrichit qu'**~7** aliments,
avec les anciens 10 micros. Objectif : **compléter les ~50 aliments du seed** avec les micros + sous-
macros issus de CIQUAL, pour que le panel étendu ait enfin de la matière sur la base par défaut.

**Contrainte dure : « ne rien inventer ».** Chaque valeur doit provenir d'une cellule de l'export
CIQUAL officiel. Aucune estimation, aucun calcul d'équivalent non fourni.

## 2. Décisions (brainstorming, actées)

- **Source** : export officiel **ANSES CIQUAL** (ciqual.anses.fr, licence Etalab), **fourni par
  Florian** (fichier CSV/XLSX → CSV). Fichier brut **hors git**.
- **Périmètre** : les **~50 aliments déjà présents** dans `supabase/seed.sql` (pas de nouveaux aliments).
- **Livraison** : `seed.sql` (source de vérité, tout env neuf) **+** un **SQL one-shot** appliqué une
  fois sur le cloud existant (checkpoint 🔴 joué par Florian). Pas une migration (migrations = schéma).
- **Champs** : on complète **uniquement** `micronutrients` (les 31) **et** les colonnes sous-macros
  `sugars_per_100g` / `saturated_fat_per_100g` / `fiber_per_100g`. **Macros de base intactes**
  (`kcal_per_100g` / `protein_per_100g` / `carbs_per_100g` / `fat_per_100g`).
- **Approche** : **générateur reproductible** (pas de SQL écrit à la main) — cf. §4.

## 3. Périmètre

### Dans le périmètre
1. Table de correspondance **aliment seed (UUID) → code aliment CIQUAL** (~50), relue par Florian.
2. Table de correspondance **colonne CIQUAL → { clé interne, unité, facteur }** (31 micros + 3 sous-macros).
3. Script générateur : export CIQUAL + correspondances → SQL (`UPDATE public.foods`).
4. Patch de `seed.sql` (bloc régénéré) + fichier SQL one-shot cloud.
5. Attribution Etalab/ANSES (doc + commentaire seed).

### Hors périmètre
- Macros de base (non modifiées). Nouveaux aliments. RDA/objectifs. Route via l'importeur 8.6.
- Traduction : les noms FR/EN des aliments seed existent déjà ; on n'y touche pas.

## 4. Architecture (outillage dev, aucun code applicatif runtime)

Pipeline **rejouable** sous `supabase/scripts/enrich-ciqual/` :

```
export CIQUAL (CSV, hors git)  ┐
mapping-foods.json  (UUID→code)├─▶  generate.mjs  ─▶  bloc UPDATE dans seed.sql
mapping-columns.json (col→clé) ┘                   └▶  cloud-update.sql (one-shot)
```

- **`mapping-foods.json`** — `[{ id: "<uuid seed>", nameFr: "...", ciqualCode: "<alim_code>" }]`. ~50
  entrées. **Proposé par l'implémentation, validé par Florian** (l'identité de chaque aliment doit être
  correcte — sinon on affecte de mauvaises valeurs).
- **`mapping-columns.json`** — `[{ ciqualColumn: "Magnésium (mg/100g)", key: "magnesium_mg", factor: 1 }, …]`
  pour les 31 micros + `sugars_per_100g`/`saturated_fat_per_100g`/`fiber_per_100g`. Unités CIQUAL déjà
  en mg/µg/g pour 100 g → `factor` = 1 dans la plupart des cas ; tout écart d'unité est explicite ici.
- **`generate.mjs`** — Node (pas de dépendance runtime) : parse le CSV, pour chaque aliment mappé lit
  sa ligne CIQUAL, pour chaque colonne mappée normalise la valeur, assemble le JSON `micronutrients`
  (present-only) + les 3 sous-macros, émet `UPDATE public.foods SET … WHERE id = '<uuid>';`. Écrit le
  bloc dans `seed.sql` (entre marqueurs `-- >>> CIQUAL … <<<`) et le duplique dans `cloud-update.sql`.

## 5. Règles de normalisation (fonctions pures, testées)

- **Tokens CIQUAL non numériques** → valeur **omise** : `traces`, `-`, `NC` (non communiqué), vide.
- **Seuils `< x`** (ex. `< 0,5`) → **omis** (present-only ; pas d'approximation).
- **Virgule décimale** FR → point ; espaces (séparateurs de milliers) supprimés.
- **≤ 0 / non fini** → omis (règle 4.33 conservée).
- **Vitamine A** : mappée depuis la colonne « Vitamine A (µg/100g) » de CIQUAL si présente ; sinon
  **omise** (pas de calcul d'équivalent rétinol/β-carotène inventé).
- Micros → JSON `micronutrients` (seules les clés présentes). Sous-macros → colonnes (valeur si
  présente ; sinon la colonne est laissée à sa valeur seed existante — pas de passage à NULL).

## 6. Sorties & idempotence

- **`seed.sql`** : bloc `UPDATE` régénéré entre marqueurs (rejouer le générateur remplace le bloc, pas
  d'empilement). Chaque aliment ciblé par son **UUID fixe** (déjà dans le seed).
- **`cloud-update.sql`** : mêmes `UPDATE` idempotents (rejouables sans effet de bord ; ils écrasent
  `micronutrients`/sous-macros par la valeur CIQUAL). Appliqué par Florian sur le projet cloud.

## 7. Tests / vérification

- **Unitaires (Vitest)** sur les fonctions pures du script : parsing token (`traces`/`NC`/`< x`/vide →
  omis), virgule→point, application `factor`, assemblage present-only.
- **Audit d'exécution** : le script **loggue** tout aliment sans correspondance CIQUAL et toute colonne
  mappée absente du CSV → zéro valeur silencieusement inventée.
- **db:reset local** (Docker) : le seed enrichi s'applique sans erreur.
- **Recette device** : 2-3 aliments (banane, poulet, épinards…) → panel étendu peuplé, mise à l'échelle
  correcte, aliments non mappés inchangés.

## 8. Definition of Done

- Générateur + 2 mappings + SQL généré committés ; export brut hors git.
- typecheck / lint / tests verts (fonctions pures couvertes).
- `mapping-foods.json` **relu et validé par Florian**.
- `seed.sql` enrichi ; `cloud-update.sql` prêt (application cloud = checkpoint 🔴).
- Attribution Etalab/ANSES présente.

## 9. Dépendances / risques

- **Bloquant** : l'export CIQUAL de Florian est requis avant toute génération (1ʳᵉ étape du plan).
- **Appariement** : risque de mauvais code CIQUAL pour un aliment → **relecture Florian** obligatoire
  sur `mapping-foods.json`.
- **Colonnes CIQUAL** : intitulés/unités exacts à confirmer sur le fichier réel (le `mapping-columns`
  sera ajusté d'après l'en-tête réel). Variantes possibles (« AG 18:3 n-3 » vs « Oméga 3 »…) : on
  mappe la colonne la plus directe disponible, sinon on omet.
- **Licence** : redistribution Etalab autorisée avec **attribution** — à mentionner.
