# Schéma de données — Socle & pilier Musculation (PowerSync / Supabase)

> **Spec technique** (étape 1 du workflow — voir [CLAUDE.md](../../../CLAUDE.md)). Fige le **schéma
> physique** du socle transverse et du pilier musculation, la couche d'accès aux données
> (repository + lectures réactives PowerSync) et la **bascule** des écrans existants (aujourd'hui
> en Zustand-persist) vers PowerSync.
> Traduit en tables concrètes le [modèle logique](./modele-donnees.md) ; applique les conventions de
> [offline-sync.md](./offline-sync.md) et l'[i18n.md](./i18n.md).
> **Statut : à valider (Damien / Florian) avant tout code.**
> Date : 06/07/2026.

---

## 1. Contexte & problème

L'app avance vite côté fonctionnel (onboarding 1.7-1.11, profil 1.12, séance libre muscu
3.13-3.35) mais **toutes les données métier sont persistées en Zustand + SecureStore (JSON)** :
[profile-store](../../../apps/mobile/src/stores/profile-store.ts),
[workout-store](../../../apps/mobile/src/stores/workout-store.ts),
[exercise-store](../../../apps/mobile/src/stores/exercise-store.ts),
[settings-store](../../../apps/mobile/src/stores/settings-store.ts). Les exercices sont un
**fichier statique** ([data/exercises.ts](../../../apps/mobile/src/data/exercises.ts)).

Or [offline-sync.md §6](./offline-sync.md) impose : *« toute écriture passe par un repository qui
écrit dans le SQLite local géré par PowerSync »*, avec UUID client, timestamps UTC et soft delete
**dès le jour 1** car « impossible à rétrofitter ». Le schéma PowerSync réel
([schema.ts](../../../apps/mobile/src/powersync/schema.ts)) ne contient encore que la table jouet
`todos` du spike, et Supabase n'a **aucune table métier ni RLS** (seule la migration de conventions
`set_updated_at`).

Chaque US muscu supplémentaire empile donc de la dette de migration. Cette spec pose la vraie
couche de données maintenant, tant que le volume à migrer est faible (4 stores).

**Bonne nouvelle** : le connecteur d'upload PowerSync est déjà écrit et **générique**
([connector.ts](../../../apps/mobile/src/powersync/connector.ts)) ; l'infra Supabase cloud **et**
l'instance PowerSync sont **déjà provisionnées** (le « Synchronisé » vert du spike passait par une
vraie instance). Il ne manque donc que : le schéma local, les tables Supabase + RLS + sync rules,
et la couche repository.

## 2. Objectif & périmètre

**Objectif** : figer le modèle physique du **socle transverse + pilier musculation complet**
(V0.2 **et** V0.3) et basculer l'app sur PowerSync comme **source de vérité unique**.

**Dans le périmètre**
- Socle : `profiles`, `user_settings`.
- Contenu partagé (lecture seule) : `exercises`, `exercise_translations`, `programs`,
  `program_translations`.
- Muscu utilisateur : exercices `custom` + `exercise_favorites`, `programs` custom + `sessions` +
  `exercise_plans`, `workouts` + `workout_sets`, `personal_records`.
- Conventions transverses (champs de synchro, buckets, RLS, repository).
- Bascule (cutover **propre, sans migration de données**) des écrans/stores existants.
- Seed des 16 exercices de démarrage dans Supabase.

**Hors périmètre** (US ultérieures) — nutrition (4.x), running (5.x), dashboard/streak (7.x/2.9),
GIF d'exercices (6.1 — colonne prévue, remplie plus tard), historique poids (1.13), synchro fine
des conflits multi-appareils au-delà du comportement PowerSync par défaut.

**Décisions de cadrage actées** (05-06/07/2026) : périmètre = muscu complet · bascule propre sans
migration · infra déjà provisionnée · approche = **PowerSync réactif + repository, Zustand réduit à
l'UI éphémère** · réglages **synchronisés** (`user_settings`) · nom d'exercice **toujours** en table
de traduction (custom inclus, 1 ligne dans sa langue de saisie).

## 3. Conventions transverses (imposées par offline-sync)

### 3.1 Colonnes de synchro (toutes les tables)
| Colonne | Local (SQLite) | Postgres | Rôle |
|---|---|---|---|
| `id` | `text` PK | `uuid` PK | **UUID généré côté client** (pas d'attente serveur en offline). |
| `created_at` | `text` | `timestamptz` | ISO 8601 **UTC**. Conversion locale à l'affichage uniquement. |
| `updated_at` | `text` | `timestamptz` | Maj par trigger `set_updated_at` (Postgres) + à chaque écriture locale. |
| `deleted_at` | `text` null | `timestamptz` null | **Soft delete**. Lignes non nulles exclues des sync rules et des lectures applicatives. |

- Tables **utilisateur** : colonne d'appartenance `user_id` (base de la RLS + du bucket PowerSync).
- Tables de **contenu partageable** (`exercises`, `exercise_translations`, `programs`,
  `program_translations`) : colonne `owner_id` **nullable** — `null` = contenu de bibliothèque
  (bucket `shared_content`, lecture seule) ; renseignée = contenu **custom** de l'utilisateur
  (bucket `user_data`). Cela permet à une même table de servir les deux buckets sans jointure.
- Enums (`muscle_primary`, `set_type`, `main_goal`, …) : stockés en `text`, **jamais traduits en
  base** — libellés via le dictionnaire i18n côté UI ([i18n.md §…](./i18n.md)).
- Booléens : `integer` 0/1 en SQLite local, `boolean` en Postgres.

### 3.2 Buckets & sync rules (PowerSync)
```yaml
bucket_definitions:
  user_data:
    parameters: select request.user_id() as user_id
    data:
      - select * from profiles            where user_id = bucket.user_id and deleted_at is null
      - select * from user_settings       where user_id = bucket.user_id and deleted_at is null
      - select * from exercises           where owner_id = bucket.user_id and deleted_at is null
      - select * from exercise_translations where owner_id = bucket.user_id and deleted_at is null
      - select * from exercise_favorites  where user_id = bucket.user_id and deleted_at is null
      - select * from programs            where owner_id = bucket.user_id and deleted_at is null
      - select * from program_translations where owner_id = bucket.user_id and deleted_at is null
      - select * from sessions            where owner_id = bucket.user_id and deleted_at is null
      - select * from exercise_plans      where owner_id = bucket.user_id and deleted_at is null
      - select * from workouts            where user_id = bucket.user_id and deleted_at is null
      - select * from workout_sets        where user_id = bucket.user_id and deleted_at is null
      - select * from personal_records    where user_id = bucket.user_id and deleted_at is null

  shared_content:                      # lecture seule côté app
    data:
      - select * from exercises            where owner_id is null and deleted_at is null
      - select * from exercise_translations where owner_id is null and deleted_at is null
      - select * from programs             where owner_id is null and status = 'published' and deleted_at is null
      - select * from program_translations where owner_id is null and deleted_at is null
```

### 3.3 RLS Supabase (item 9.6)
- Tables **utilisateur** (`user_id`) : policies `select/insert/update` sous
  `user_id = auth.uid()`. Pas de `delete` (soft delete via `update deleted_at`).
- Tables **partageables** (`owner_id`) : `select` autorisé si `owner_id = auth.uid()` **ou**
  `owner_id is null` (bibliothèque) ; `insert/update` uniquement si `owner_id = auth.uid()`
  (le contenu de bibliothèque n'est écrit que par le service/back-office, jamais depuis l'app).
- Publication logique `powersync` **étendue** à toutes les tables ci-dessus (réplication vers
  PowerSync).

### 3.4 Couche d'accès (approche actée : réactif + repository)
- Répertoire `apps/mobile/src/data/repositories/` — **un module par agrégat** :
  `profile-repository`, `settings-repository`, `exercise-repository`, `program-repository`,
  `workout-repository`, `records-repository`.
- **Écritures** : fonctions pures → `powerSync.execute(sql, params)`. Chaque écriture génère l'UUID
  client ([lib/id.ts](../../../apps/mobile/src/lib/id.ts)), pose `created_at`/`updated_at` UTC, et
  **supprime en soft** (`update … set deleted_at = ?`). **Aucun SQL dans les écrans ni les hooks
  d'écran.**
- **Lectures** : hooks `useQuery` de `@powersync/react-native` (watched queries **réactives** —
  se rafraîchissent automatiquement à chaque écriture locale ou synchro descendante). Exposés par
  chaque repository sous forme de hooks typés (ex. `useActiveWorkout()`, `useExerciseLibrary()`).
- **Zustand** : conservé **uniquement pour l'UI éphémère** (valeurs d'un champ en cours de frappe,
  filtres/recherche d'un écran, drapeaux `hasHydrated`). Plus aucune donnée métier persistée en
  Zustand.
- **Soft delete & connecteur** : le repository ne supprime **jamais** une ligne locale — il pose
  `deleted_at`, ce qui émet une opération **PATCH** (traitée en `UPDATE` par le
  [connecteur](../../../apps/mobile/src/powersync/connector.ts)). La branche `DELETE` (hard delete)
  du connecteur n'est donc **jamais** empruntée par le code applicatif ; ne pas la « corriger ».
- **Types & validation** : schémas **Zod** + types dans `packages/shared` (réutilisés par le
  repository et les écrans) ; `packages/shared/src/database.types.ts` régénéré depuis Supabase
  (`npm run db:types`).

## 4. Schéma physique détaillé

> Types indiqués en **SQLite local** (PowerSync) ; l'équivalent Postgres suit la table §3.1
> (`uuid`, `timestamptz`, `boolean`, `real`→`numeric`). Toutes les tables portent les colonnes de
> synchro du §3.1 (non répétées ci-dessous, sauf `user_id`/`owner_id`).

### 4.1 Socle transverse

**`profiles`** — 1 ligne par utilisateur.
| Colonne | Type | Notes |
|---|---|---|
| `user_id` | text | **unique**, = `auth.users.id`. |
| `first_name` | text null | |
| `birth_date` | text null | date ISO ; sert au contrôle 16+ (déjà en `packages/shared/age`). |
| `sex` | text null | Enum `SEXES` (`packages/shared`) : `female` / `male` / `unspecified`. |
| `height_cm` | real null | |
| `weight_kg` | real null | Poids initial/courant ; l'historique de pesées viendra en V0.4 (1.13). |
| `main_goal` | text null | Enum `GOALS` (`packages/shared`) : `muscle` / `weightloss` / `performance` / `health`. |
| `onboarding_completed_at` | text null | Null = onboarding non terminé (remplace le drapeau local). |

> Enums réutilisés **tels quels** depuis `packages/shared` (`SEXES`, `GOALS`) — ne pas réinventer
> de jeu de valeurs. Les **piliers actifs** relèvent des réglages (activables/désactivables depuis
> les paramètres, 2.2) → colonne `active_pillars` sur `user_settings`, **pas** sur `profiles`.

**`user_settings`** — 1 ligne par utilisateur.
| Colonne | Type | Notes |
|---|---|---|
| `user_id` | text | **unique**. |
| `theme` | text | `light` / `dark` / `system`. |
| `units` | text | `metric` / `imperial`. |
| `language` | text | Enum `LOCALES` : `fr` / `en` — **synchronisé** (notifs serveur, cohérence multi-device). |
| `active_pillars` | text | JSON, enum `PILLARS` (ex. `["strength","running","nutrition"]`). Migré depuis `settings-store.activePillars`. |
| `notifications` | text | JSON (préférences par type). **Défaut au cutover** (aucune donnée héritée). |
| `dashboard_layout` | text null | JSON (disposition des widgets, V0.6). Null au cutover. |

### 4.2 Contenu partageable (bibliothèque + custom)

**`exercises`**
| Colonne | Type | Notes |
|---|---|---|
| `owner_id` | text null | `null` = bibliothèque (shared) ; renseigné = exercice custom. |
| `source` | text | `library` / `custom` (redondant avec `owner_id`, pratique pour les filtres). |
| `muscle_primary` | text | enum groupe musculaire (`chest`/`back`/`legs`/`shoulders`/`arms`/`core`). |
| `equipment` | text null | enum matériel (nullable). |
| `media_url` | text null | GIF de démonstration — **rempli plus tard** (décision 6.1 non bloquante). |

**`exercise_translations`** — nom (et instructions) par langue. **Le nom de tout exercice** (biblio
*et* custom) vit ici ; un exercice custom a **une seule ligne**, dans sa langue de saisie.
| Colonne | Type | Notes |
|---|---|---|
| `exercise_id` | text | FK → `exercises.id`. |
| `owner_id` | text null | Miroir du parent (aiguille le bucket : `null`=shared, sinon user_data). |
| `lang` | text | `fr` / `en` (ou la langue de saisie pour un custom). |
| `name` | text | |
| `instructions` | text null | |

> Fallback FR si une traduction manque (voir [i18n.md §4](./i18n.md)).

**`exercise_favorites`** — épinglage (biblio ou custom).
| Colonne | Type | Notes |
|---|---|---|
| `user_id` | text | |
| `exercise_id` | text | FK → `exercises.id`. |

### 4.3 Programmes (le *plan*, V0.3)

**`programs`**
| Colonne | Type | Notes |
|---|---|---|
| `owner_id` | text null | `null` = éditorial ; renseigné = programme custom. |
| `pillar` | text | `strength` (colonne prête pour `running`). |
| `status` | text | `draft` / `published` (éditorial). Custom : `published`. |
| `is_active` | integer | 0/1 — **un seul actif par pilier par utilisateur** (contrôlé côté app, 3.12). |
| `level` | text null | filtre biblio (débutant/intermédiaire/avancé). |
| `goal` | text null | filtre biblio. |
| `duration_weeks` | integer null | filtre biblio. |

**`program_translations`** — nom/résumé/description par langue (même logique que les exercices).
| Colonne | Type | Notes |
|---|---|---|
| `program_id` | text | FK → `programs.id`. |
| `owner_id` | text null | Miroir du parent (bucket). |
| `lang` | text | `fr` / `en`. |
| `name` | text | |
| `summary` | text null | |
| `description` | text null | |

**`sessions`** — séance type dans un programme.
| Colonne | Type | Notes |
|---|---|---|
| `program_id` | text | FK → `programs.id`. |
| `owner_id` | text null | Miroir du parent (bucket). |
| `order_index` | integer | Position dans le programme. |
| `name` | text null | Libellé libre (ex. « Push A ») — non traduit en V0.3 (à réévaluer). |

**`exercise_plans`** — exercice prévu dans une séance type (séries/reps/repos **prévus**).
| Colonne | Type | Notes |
|---|---|---|
| `session_id` | text | FK → `sessions.id`. |
| `owner_id` | text null | Miroir du parent (bucket). |
| `exercise_id` | text | FK → `exercises.id`. |
| `order_index` | integer | |
| `set_type` | text | défaut `normal`. |
| `target_sets` | integer null | |
| `target_reps` | text null | ex. `"8-12"`. |
| `target_weight_kg` | real null | |
| `rest_seconds` | integer null | |

### 4.4 Séances réalisées & records (le *réalisé*)

**`workouts`** — séance **réalisée** (planifiée ou libre). La **séance en cours** est une ligne
`status='active'` (survit au kill *et* synchronise ; remplace la persistance Zustand).
| Colonne | Type | Notes |
|---|---|---|
| `user_id` | text | |
| `session_id` | text null | Null = séance **libre** (3.23). |
| `program_id` | text null | Renseigné si issue d'un programme. |
| `status` | text | `active` / `completed` / `cancelled`. |
| `started_at` | text | UTC. |
| `finished_at` | text null | Null tant que la séance est active. |
| `duration_seconds` | integer null | Calculé à la clôture (3.35). |
| `rpe` | integer null | Ressenti 1-10 (3.34). |
| `notes` | text null | Note de séance (3.33). |

> Reprise / clôture auto (3.36 / 3.37) : gérées via `started_at` + `status` (règle applicative, pas
> de colonne dédiée).

**`workout_sets`** — série réalisée.
| Colonne | Type | Notes |
|---|---|---|
| `workout_id` | text | FK → `workouts.id`. |
| `user_id` | text | Dénormalisé (RLS + bucket sans jointure). |
| `exercise_id` | text | FK → `exercises.id`. |
| `order_index` | integer | |
| `set_type` | text | `normal`/`warmup`/`superset`/`duration`/`bodyweight` (3.27). |
| `reps` | integer null | |
| `weight_kg` | real null | |
| `duration_seconds` | integer null | Pour les séries en durée (gainage). |
| `done` | integer | 0/1 — série validée (3.25). |

**`personal_records`** — records calculés automatiquement.
| Colonne | Type | Notes |
|---|---|---|
| `user_id` | text | |
| `exercise_id` | text | FK → `exercises.id`. |
| `type` | text | `max_weight` / `estimated_1rm` / `best_volume`. |
| `value` | real | Valeur du record (kg, 1RM estimé, ou volume). |
| `reps` | integer null | Contexte. |
| `weight_kg` | real null | Contexte. |
| `workout_id` | text null | Séance où le record a été battu. |
| `achieved_at` | text | UTC. |

> **1RM estimé (Epley)** : `charge × (1 + reps/30)` — fonction pure dans `packages/shared`, testée
> (voir §7). Les séries d'échauffement (`set_type='warmup'`) sont **exclues** des records, du volume
> et de la progression (§3.3 modele-donnees).

## 5. Contenu de démarrage (seed)

- Les 16 exercices de [data/exercises.ts](../../../apps/mobile/src/data/exercises.ts) sont insérés
  dans `supabase/seed.sql` : une ligne `exercises` (`owner_id null`, `source='library'`) + deux
  lignes `exercise_translations` (`fr`, `en`) chacun.
- L'app les lit depuis la **copie SQLite répliquée** (bucket `shared_content`). Le fichier statique
  `data/exercises.ts` est **supprimé** (cutover propre).
- Ids stables réutilisés (`ex-bench-press`, …) pour ne pas casser les favoris de test.

## 6. Bascule des écrans existants (cutover propre)

Pas de migration de données (décision : seules des données de test existent). Au premier lancement
de la nouvelle version, les données Zustand-persist héritées sont ignorées (et le stockage
correspondant purgé).

Remplacement store → repository :
| Store actuel | Devient | Écrans impactés |
|---|---|---|
| `profile-store` | `profile-repository` (table `profiles` : prénom, naissance, sexe, taille, poids, objectif, onboarding) | onboarding (infos/goal/summary), `profile`, accueil |
| `settings-store` | `settings-repository` (`user_settings` : thème, unités, langue, **`active_pillars`**, notifs, dashboard) + Zustand éphémère pour l'UI | `settings`, onboarding (pillars), masquage onglets (2.2), thème/unités partout |
| `exercise-store` | `exercise-repository` (`exercises` custom + `exercise_favorites`) | `exercises` |
| `workout-store` | `workout-repository` (`workouts` + `workout_sets`) | `strength`, `workout`, `workout-summary` |
| `data/exercises.ts` | table `exercises` (seed, lecture via repository) | `exercises`, `workout` |

Contraintes maintenues pendant la bascule : **offline-first** (toute action possible en mode avion),
**i18n FR/EN** (aucune chaîne en dur), optimistic UI (aucun spinner sur une écriture locale).

## 7. Tests & Definition of Done

- **`packages/shared` (Vitest)** — étendre la couverture existante : schémas Zod des entités,
  logique pure (1RM Epley, calcul de volume, détection de record, mapping DB↔domaine).
- **Repository** — logique pure testée en unitaire ; l'intégration SQLite/sync est validée **sur
  device** (jest-expo sera câblé avec cette US, item TODO « tests mobile »).
- **Definition of Done** (par US) : typecheck + lint + tests verts (CI) · écriture/lecture **en mode
  avion** OK · **RLS vérifiée sur 2 appareils** (montante + descendante) · i18n FR/EN complète ·
  aucun secret en dur · CHANGELOG + TODO tenus via `/commit`.

## 8. Découpage en US (implémentation)

Cette spec **gèle le modèle** ; l'implémentation se fait en 3 branches successives depuis `dev` :

1. **`feature/data-socle-muscu`** — conventions transverses + `profiles` + `user_settings` +
   `exercises`/`exercise_translations`/`exercise_favorites` + `workouts`/`workout_sets` + seed +
   **bascule séance libre & profil & réglages**. *(le gros morceau — débloque tout et supprime la
   dette Zustand)*
2. **`feature/programmes-muscu`** — `programs`/`program_translations`/`sessions`/`exercise_plans`
   (V0.3 : création/biblio/planning).
3. **`feature/historique-records-muscu`** — `personal_records` + courbes/historique (V0.3).

Chaque US aura son **plan d'implémentation** (étape 2 du workflow) avant code. Pas de maquette
dédiée (spec purement technique/données) : la maquette FitTrio existante couvre les écrans concernés.

## 9. Points ouverts / à confirmer en validation
- Nom des `sessions` non traduit en V0.3 (libellé libre) — à réévaluer si les programmes éditoriaux
  doivent être bilingues au niveau séance.
- Comportement de conflit PowerSync au-delà du défaut : conforme à [offline-sync.md §4](./offline-sync.md)
  (rare, un seul utilisateur) — pas de logique de merge maison.
- Volume : les tables muscu restent petites ; le point « données volumineuses » (traces GPS) ne
  concerne que le running (V0.5).
