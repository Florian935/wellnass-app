---
id: CONF-01
titre: "Export des données (RGPD, portabilité)"
roadmap: [1.18]
catalogue: []
etape: close
branche: feature/conf01-export-donnees
maj: 23/07/2026
---
# US CONF-01 — Export des données (RGPD, portabilité)

> Permettre à l'utilisateur d'**exporter toutes ses données personnelles** dans un fichier **JSON**
> machine-readable, depuis l'app, **hors-ligne** (données de la base locale PowerSync), livré via la
> **feuille de partage OS**. Obligation **RGPD** (droit à la portabilité, art. 20). Roadmap
> [1.18](../../../roadmap/roadmap.md). Complément de CONF-02 (suppression) — souvent proposé **avant** la
> suppression. Réutilise le patron [gpx-export.ts](../../../../apps/mobile/src/lib/gpx-export.ts).
> Branche : `feature/conf01-export-donnees` · Date : 23/07/2026 ·
> **Statut : à valider (pas de code avant validation Florian/Damien).**
> **Aucune migration, aucun serveur** (lecture de la base locale uniquement).

## 0. Contexte

Les Réglages n'offrent aucun export ; le RGPD (art. 20) impose de fournir les données personnelles dans un
**format structuré, couramment utilisé et lisible par machine**. Contexte technique (vérifié) :
- **Toutes les données utilisateur sont dans la base locale PowerSync** (SQLite, ~31 tables, répliquées par
  utilisateur via le bucket JWT). L'export se construit donc **entièrement en local**, **hors-ligne**, sans
  round-trip serveur ni migration — contrairement à la suppression (CONF-02).
- **Livraison** : patron `gpx-export.ts` déjà en place (écrire un fichier dans `cacheDirectory` via
  `expo-file-system/legacy` → `Sharing.shareAsync`). `expo-file-system` + `expo-sharing` présents.
- Le contenu **éditorial** (`exercises`/`foods` avec `owner_id` NULL et leurs `*_translations`) **n'est pas
  une donnée personnelle** → exclu.

Décisions de cadrage (brainstorming Florian, 23/07/2026) :
- **Format = JSON brut par table** (un objet, une section par table, lignes possédées par l'utilisateur).
  Machine-readable = exactement l'exigence RGPD. Enrichissable plus tard (lisible par pilier, CSV…).
- **Périmètre = lignes possédées** (`user_id`/`owner_id` = utilisateur courant) ; éditorial exclu.
- **Garde-fou `hasSynced`** : **autoriser l'export avec un avertissement** si la synchro initiale n'est pas
  terminée (moins bloquant ; l'envelope portera un drapeau `syncComplete`) — plutôt que désactiver.
- **Lien avec CONF-02** : brancher le `exportHint` (« bientôt disponible ») de l'écran de suppression sur
  l'export.

## 1. Périmètre à livrer

- **Assemblage JSON** depuis la base locale : en-tête + une section par table (lignes possédées).
- **Livraison** : écriture `wellness-export-AAAA-MM-JJ.json` dans le cache → feuille de partage OS.
- **Déclenchement** : entrée « Exporter mes données » dans les Réglages (section Compte / Données, au-dessus
  de la Zone de danger), avec indicateur de chargement + gestion d'erreur.
- **Avertissement `syncComplete`** si synchro initiale non terminée.
- **Branchement CONF-02** : `account.delete.exportHint` pointe vers l'export.
- **i18n** FR/EN ; **helper pur testable** dans `@wellness/shared` (envelope + nom de fichier).

**Hors périmètre (à ne pas implémenter ici) :**
- Export **CSV** / **lisible par pilier** (dénormalisé, noms résolus) — évolutions futures.
- **Import** de données (US 1.20, V1.1).
- Résolution des références éditoriales (un `food_entry` référence un `food_id` éditorial → exporté en id,
  pas dénormalisé) — cohérent avec « JSON brut ».
- **Identité de compte** (e-mail, dates d'auth) : vit dans **Supabase Auth**, non répliquée dans la base
  locale → **hors périmètre** de cet export (limite connue, cohérente avec « aucun serveur »). L'`userId` est
  exporté dans l'en-tête ; l'e-mail est déjà connu de l'utilisateur.

## 2. Comportement attendu

### 2.1 Déclenchement
- Réglages → section **« Données »** (ou « Compte »), entrée **« Exporter mes données »** avec sous-titre
  RGPD (« récupère une copie de toutes tes données au format JSON »), placée **au-dessus de la Zone de danger**.
- Tap → état **chargement** (lecture des ~31 tables + sérialisation) → écriture fichier → **feuille de
  partage OS** (`Sharing.shareAsync`, mimeType `application/json`). Annulation par l'utilisateur = sans effet.
- **Contrairement à la suppression, l'export fonctionne hors-ligne** (données locales) → **pas** de
  désactivation hors-ligne.

### 2.2 Contenu du fichier
- **En-tête** :
  ```json
  { "app": "Wellness", "formatVersion": 1, "exportedAt": "<ISO UTC>", "userId": "<uuid>", "syncComplete": true }
  ```
- **Une clé par table** (nom snake_case de la table), valeur = tableau des lignes possédées (colonnes brutes
  telles qu'en base locale). Tables incluses :
  - **Compte** : `profiles`, `user_settings`, `nutrition_profiles`, `running_profiles`.
  - **Muscu** : `workouts`, `workout_sets`, `programs`, `sessions`, `exercise_plans`, `personal_records`,
    `exercise_notes`, `workout_superset_pairs`, `workout_templates`, `workout_template_exercises`,
    `planned_sessions`, `exercise_favorites`, `exercises` (perso), `exercise_variants` (perso).
  - **Running** : `runs`, `running_pace_records`.
  - **Nutrition** : `food_entries`, `recipes`, `recipe_ingredients`, `meal_templates`,
    `meal_template_items`, `foods` (perso), `food_favorites`, `body_weight_entries`.
- **Filtre par table — possession DIRECTE partout** (vérifié : les 28 tables exportées portent une colonne
  de possession directe, aucun JOIN nécessaire). La requête est un simple
  `SELECT * FROM <table> WHERE <col> = ? AND deleted_at IS NULL` :
  - **`user_id = <me>`** : `profiles`, `user_settings`, `nutrition_profiles`, `running_profiles`, `workouts`,
    `workout_sets`, `personal_records`, `exercise_notes`, `workout_superset_pairs`, `workout_templates`,
    `workout_template_exercises`, `exercise_favorites`, `runs`, `running_pace_records`, `food_entries`,
    `recipes`, `recipe_ingredients`, `meal_templates`, `meal_template_items`, `food_favorites`,
    `body_weight_entries`.
  - **`owner_id = <me>`** : `programs`, `sessions`, `exercise_plans`, `planned_sessions`, `exercises` (perso),
    `exercise_variants` (perso), `foods` (perso), **`exercise_translations` / `food_translations` /
    `program_translations`** (perso — voir ci-dessous).
- **`deleted_at IS NULL`** : ne **pas** exporter les lignes soft-deleted (données que l'utilisateur a
  supprimées) — cohérent avec ce qu'il voit dans l'app.
- **Traductions (nom/instructions)** : les tables `*_translations` portent un `owner_id` et contiennent à la
  fois l'éditorial (`owner_id NULL`) **et** les libellés des contenus **perso** de l'utilisateur (nom d'un
  exercice/aliment/programme créé sur mobile). On les exporte **filtrées `owner_id = <me>`** : sinon un
  contenu perso ressortirait **sans son nom** (complétude RGPD — 31 tables exportées, corrigé après revue).
- **Exclus** : contenu éditorial (toute ligne `owner_id IS NULL`, réellement présent dans la base locale) —
  non personnel.

### 2.3 Nom de fichier
- `wellness-export-AAAA-MM-JJ.json` (date locale). Un ré-export le même jour écrase le fichier de cache
  (texte léger, purgé par l'OS avec le cache).

### 2.4 Avertissement synchro
- Si `!hasSynced` (synchro initiale non terminée) : afficher un **avertissement non bloquant** avant l'export
  (« Synchro en cours — l'export pourrait être incomplet. Réessaie une fois la synchro terminée. ») et poser
  `syncComplete: false` dans l'en-tête. L'utilisateur peut poursuivre.

## 3. Architecture

- **`@wellness/shared`** : helper pur `buildExportEnvelope({ userId, exportedAt, syncComplete, tables })` qui
  assemble l'objet final (en-tête + sections) et `exportFileName(date)` → `wellness-export-AAAA-MM-JJ.json`.
  Testés Vitest (structure de l'en-tête, nom de fichier). La **lecture des tables** (I/O SQLite) reste côté
  mobile (non pure).
- **`apps/mobile/src/lib/data-export.ts`** : orchestration (patron `gpx-export.ts`) — requêtes locales de
  toutes les tables (via `powerSync.getAll<T>(sql, params): Promise<T[]>` avec les filtres directs §2.2),
  assemblage via le helper shared,
  écriture cache (`expo-file-system/legacy`), `Sharing.shareAsync`. Renvoie un résultat typé
  (`{ ok: true } | { error: 'unavailable' | 'failed' }`).
- **Réglages** : entrée qui appelle `data-export.ts` + gère chargement/erreur/`hasSynced` (`useStatus`).

## 4. i18n (FR + EN)

Clés (namespaces indicatifs) : `settings.dataExport.{title, subtitle, button}` ;
`account.export.{dialogTitle, syncWarning, errorUnavailable, errorFailed, success}`. Aucune chaîne en dur ;
parité stricte. **`account.delete.exportHint` (CONF-02)** : simple **changement de texte** (retirer « bientôt
disponible » ; formuler « exporte tes données depuis Réglages → Exporter mes données avant de continuer ») —
**pas** de navigation depuis la modale de suppression (`<Text>` statique conservé, pas de lien pressable).

Exemples FR→EN : « Exporter mes données » → « Export my data » ; « Synchro en cours — l'export pourrait être
incomplet » → « Sync in progress — the export may be incomplete ».

## 5. Offline & performance

- 100 % local/hors-ligne (aucun réseau).
- Volume : ~31 requêtes locales + sérialisation JSON en mémoire ; acceptable pour un historique normal (texte).
  Pas de streaming en V1 (à réévaluer si un utilisateur a un très gros historique).

## 6. Sécurité & RGPD

- Le fichier contient les **données personnelles** de l'utilisateur → livré uniquement via la feuille de
  partage qu'il déclenche (il choisit la destination). Aucun envoi automatique, aucun cloud.
- N'exporte **que** les lignes possédées (`user_id`/`owner_id` = lui) — jamais celles d'un autre utilisateur
  (de toute façon la base locale ne contient que les siennes + l'éditorial exclu).
- Format machine-readable = conforme à l'art. 20 (portabilité).

## 7. Cas limites

- **Partage indisponible** (`Sharing.isAvailableAsync()` false) → message `errorUnavailable`.
- **Échec écriture/partage** → `errorFailed` (log `console.warn`, pas de crash).
- **Compte quasi vide** (nouvel utilisateur) → export valide avec sections vides (tableaux `[]`).
- **Synchro non terminée** → avertissement + `syncComplete: false` (§2.4).
- **Ré-export le même jour** → écrase le fichier de cache (idempotent).

## 8. Definition of Done

- Helper shared (`buildExportEnvelope`, `exportFileName`) + tests Vitest.
- `data-export.ts` (lecture des tables possédées + assemblage + écriture + partage).
- Entrée Réglages fonctionnelle (chargement, erreurs, avertissement `hasSynced`).
- `account.delete.exportHint` branché sur l'export.
- i18n FR/EN complète ; `typecheck` + `lint` + tests (shared + smoke mobile) verts.
- Maquette (design/) validée Florian/Damien avant code.

## 9. Critères d'acceptation (recette)

1. **Export nominal** : Réglages → « Exporter mes données » → feuille de partage → enregistrer le `.json` →
   l'ouvrir : en-tête correct (`exportedAt`, `userId`, `syncComplete: true`) + sections par table.
2. **Complétude** : les données visibles dans l'app (une séance, une course, des repas loggés, le profil, un
   exercice perso, un record) se **retrouvent** dans les sections correspondantes.
3. **Pas d'éditorial** : les exercices/aliments **de la bibliothèque** (non créés par l'utilisateur)
   **n'apparaissent pas** ; seuls les **perso** (`owner_id` = lui) sont présents.
4. **Hors-ligne** : en mode avion, l'export **fonctionne** (données locales).
5. **Avertissement synchro** : sur un compte fraîchement réinstallé (synchro en cours), un avertissement
   s'affiche et `syncComplete` = false.
6. **Mention suppression** : dans l'écran de suppression (CONF-02), la mention d'export n'affiche plus
   « bientôt disponible » et invite à exporter depuis les Réglages.
7. **i18n** : tout le parcours traduit en anglais.
