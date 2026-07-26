---
id: MUSC-F10c2
titre: "Variantes / alternatives d'exercice"
roadmap: [3.20]
catalogue: []
etape: close
branche: feature/muscf10c2-variantes-alternatives
maj: 22/07/2026
---
# US MUSC-F10c-2 — Variantes / alternatives d'exercice

> **Second et dernier incrément** de F10c (= MUSC-F2) : F10c-1 (muscles secondaires, livré) →
> **F10c-2 (variantes / alternatives)**. Cadrage validé Florian (brainstorming, 22/07/2026 : relation
> **symétrique**, **inclut les exos perso**, **liste simple non typée**, **une seule US**, ajout perso
> **depuis n'importe quelle fiche**, **aucune contrainte** sur les liens perso). Branche :
> `feature/muscf10c2-variantes-alternatives`.
> **Statut : à valider (pas de code avant validation).** **Une migration + redéploiement des sync rules
> PowerSync (geste humain).**

## 0. Contexte

La fiche exercice ([app/exercises/[id].tsx](../../../../apps/mobile/src/app/exercises/%5Bid%5D.tsx))
affiche nom, groupe primaire, muscles secondaires (F10c-1), matériel, instructions, favori, records.
Il **n'existe aucune notion de variantes / alternatives** : impossible de dire « pour remplacer le
développé couché, essaie le développé haltères ou aux anneaux ».

Objectif (roadmap **3.20** — « Variantes / alternatives : exercices similaires pour remplacer si
besoin ») : associer à un exercice une **liste plate** d'exercices équivalents, affichée sur la fiche
et **cliquable** (navigation vers la fiche de la variante).

Deux natures de liens (décidées au cadrage) :
- **Éditoriaux** (globaux) : curés par l'admin entre exercices de la **bibliothèque**. Visibles par
  tous, **lecture seule** côté mobile. Synchro via le bucket `shared_content`.
- **Personnels** : créés par l'**utilisateur** depuis l'app, entre **n'importe quels 2 exercices qu'il
  voit** (ses exos perso + bibliothèque publiée), **sans contrainte**. Visibles de lui seul. Synchro
  via le bucket `user_data` (`owner_id`).

La relation est **symétrique** (si A est une variante de B, B l'est de A) et **non typée** (pas de
distinction progression/régression).

## 1. Périmètre à livrer

- **Migration** : table `exercise_variants` (liaison symétrique, canonique, `owner_id` null=éditorial /
  non-null=perso) + RLS + `alter publication powersync add table`.
- **Sync rules** : ajout de `exercise_variants` aux buckets `shared_content` (éditorial) et `user_data`
  (perso) — fichier repo + **redéploiement manuel dans le dashboard PowerSync** (geste humain).
- **PowerSync schema** local : table `exercise_variants`.
- **Partagé** : `exerciseVariantRowSchema` + helper pur `canonicalPair(a, b)` (testé).
- **Mobile** : lecture `useExerciseVariants(id)` ; écriture `addExerciseVariant` / `removeExerciseVariant`
  (liens perso) ; section « Variantes / alternatives » sur la fiche (liens cliquables, ✕ sur les liens
  perso, bouton « + Ajouter une variante ») ; nouveau mode `pickVariant` du sélecteur d'exercices.
- **Admin** : section « Variantes / alternatives » dans `ExerciseEditScreen` (liens éditoriaux
  biblio↔biblio, ajout via recherche + chips supprimables).
- **i18n** FR/EN ; offline-first ; **aucune chaîne en dur**.

**Hors périmètre :**
- **Remplacement d'un exercice en séance** (roadmap 3.32 — distinct : `replaceExercise` existe déjà).
- **Typage** des relations (alternative / progression / régression).
- **Suggestions automatiques** de variantes (similarité muscle/matériel).
- Filtre / recherche par variante.

## 2. Comportement attendu

### 2.1 Fiche mobile — affichage (`exercises/[id].tsx`)
- Nouvelle section **« Variantes / alternatives »** (mode lecture), sous les records.
- Contenu = **union** des liens éditoriaux (globaux) et personnels (de l'utilisateur) touchant cet
  exercice, **dédupliquée** par exercice cible, triée par nom.
- Chaque variante = une **ligne cliquable** (nom + badge « perso » si l'exo cible est un exo perso) →
  `router.push('/exercises/[otherId]')`.
- Les variantes issues d'un **lien personnel** (`owner_id = utilisateur`) portent une action **✕**
  (supprimer le lien). Les variantes issues d'un **lien éditorial** n'en portent pas.
- Un bouton **« + Ajouter une variante »** est présent sur **toute** fiche (bibliothèque ou perso).
- La section peut être **vide** : afficher le bouton « + Ajouter une variante » et un court message
  « Aucune variante pour l'instant » (pas de ligne).

### 2.2 Fiche mobile — ajout d'un lien perso
- « + Ajouter une variante » ouvre le **sélecteur d'exercices** existant ([exercises.tsx](../../../../apps/mobile/src/app/exercises.tsx))
  en nouveau mode **`pickVariant`** (paramètres : `mode=pickVariant`, `forExerciseId=<self>`).
- Le sélecteur exclut **soi-même** et les exercices **déjà liés** (éditoriaux ou perso) à `self`.
- À la sélection : `addExerciseVariant(self, picked)` crée un **lien personnel** (owner = utilisateur,
  paire canonique) puis revient à la fiche. Le lien apparaît alors sur les deux fiches (symétrie).

### 2.3 Fiche mobile — suppression d'un lien perso
- Le ✕ sur une variante perso appelle `removeExerciseVariant(linkId)` (**soft-delete**, autorisé
  seulement si `owner_id = utilisateur`). La variante disparaît des deux fiches.

### 2.4 Admin — liens éditoriaux (`ExerciseEditScreen`)
- Section **« Variantes / alternatives »** visible **en mode édition** d'un exercice **existant**
  (un exo doit exister — FK ; pour un nouvel exo, l'admin enregistre d'abord puis rouvre).
- Recherche/sélection parmi les exercices **de la bibliothèque publiés** (`owner_id is null`,
  `status='published'`, non supprimés), **excluant soi + déjà liés**.
- Ajout → crée un **lien éditorial** (owner null) ; les liens actuels s'affichent en **chips
  supprimables** (✕ → soft-delete). Écriture **immédiate** (pas au bouton « Enregistrer »).

### 2.5 États & cas limites
- **Exo supprimé / dépublié** référencé par un lien : à la lecture, la jointure au nom ne résout rien
  (l'exo n'est pas dans l'ensemble synchronisé) → la variante est **omise** (pas de ligne fantôme).
- **Doublon éditorial + perso** sur la même paire → **affiché une seule fois** (dédup par cible).
- **Chargement** → spinner discret, cohérent avec le reste de la fiche.
- **Offline** : lecture locale réactive ; l'ajout/suppression perso est une écriture locale PowerSync
  (propagée en arrière-plan). L'admin écrit en ligne (supabase-js) — hors offline (web).

## 3. Règles métier

- **Symétrie & canonicité** : une paire `{X, Y}` est stockée **une seule fois** avec
  `exercise_id_a < exercise_id_b` (ordre lexical des UUID, via `canonicalPair`). La lecture pour `self`
  cherche `a = self OR b = self` et renvoie l'**autre** id.
- **Unicité** : `(owner_id, exercise_id_a, exercise_id_b)` unique **`nulls not distinct`** (un seul lien
  éditorial par paire ; un seul lien perso par paire et par utilisateur). Un lien éditorial et un lien
  perso sur la même paire peuvent coexister (dédup à l'affichage). **L'unicité ne filtre PAS `deleted_at`** :
  une ligne soft-deletée occupe toujours le « slot » de la paire. **Conséquence obligatoire** (sinon bug de
  synchro, cf. `exercise_favorites`) : l'ajout doit être un **upsert par clé naturelle** — chercher une ligne
  existante pour `(owner_id, paire canonique)` **y compris soft-deletée**, et si trouvée **la réactiver**
  (`deleted_at = null`, `updated_at = now`) plutôt qu'un `INSERT` d'un nouvel UUID. Vaut **côté mobile et
  côté admin**.
- **Dédup à l'affichage** : si une paire porte à la fois un lien **éditorial** et un lien **perso**, on
  affiche **l'éditorial** (prioritaire, `canRemove = false`) — évite qu'une variante « revienne » après
  suppression du doublon perso.
- **Pas d'auto-lien** : `exercise_id_a <> exercise_id_b` (garanti par `a < b`).
- **Portée d'écriture** :
  - Lien **éditorial** (owner null) : écriture réservée à `is_content_editor()` (admin) — comme
    `exercises` (US 8.2).
  - Lien **personnel** (owner non-null) : écriture réservée à `owner_id = auth.uid()`. **Aucune
    contrainte** sur les extrémités (2 exos visibles quelconques ; biblio↔biblio perso autorisé).
- **Suppression** = **soft-delete** (`deleted_at`), jamais de hard delete. Un utilisateur ne supprime
  que **ses** liens perso ; l'admin ne supprime que les liens **éditoriaux**.
- **Résolution du nom** de la variante : `exercise_translations` langue courante → repli `fr`
  (`resolveExerciseName` / COALESCE, comme le reste du repo).
- **Offline-first** : lecture mobile via `useQuery` locale ; UUID client, timestamps UTC, soft-delete.
- **i18n** : libellés via `t()` ; noms d'exercices résolus par traduction ; aucune chaîne en dur.

## 4. Architecture & données

### 4.1 Migration `exercise_variants` (checkpoint cloud, via CLI)
```sql
create table public.exercise_variants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,   -- null = éditorial global
  exercise_id_a uuid not null references public.exercises(id),
  exercise_id_b uuid not null references public.exercises(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint exercise_variants_canonical check (exercise_id_a < exercise_id_b)
);
create unique index exercise_variants_unique
  on public.exercise_variants (owner_id, exercise_id_a, exercise_id_b) nulls not distinct;
-- index de lecture par extrémité
create index exercise_variants_a on public.exercise_variants (exercise_id_a);
create index exercise_variants_b on public.exercise_variants (exercise_id_b);
-- updated_at auto (cohérence socle)
create trigger set_updated_at before update on public.exercise_variants
  for each row execute function public.set_updated_at();

alter table public.exercise_variants enable row level security;
-- select : ses liens perso, les liens éditoriaux, tout pour un admin
create policy exercise_variants_select on public.exercise_variants for select
  using (owner_id is null or owner_id = auth.uid() or public.is_admin());
-- insert : soi-même (perso) ou éditeur de contenu (éditorial)
create policy exercise_variants_insert on public.exercise_variants for insert
  with check (owner_id = auth.uid() or (owner_id is null and public.is_content_editor()));
-- update (couvre le soft-delete) : idem
create policy exercise_variants_update on public.exercise_variants for update
  using (owner_id = auth.uid() or (owner_id is null and public.is_content_editor()))
  with check (owner_id = auth.uid() or (owner_id is null and public.is_content_editor()));

alter publication powersync add table public.exercise_variants;
```
> À valider au plan : disponibilité de `is_admin()` / `is_content_editor()` (définies en US 8.x) et de
> `gen_random_uuid()` (pgcrypto, déjà utilisé par le socle). `db:types` après `db:push`.

### 4.2 Sync rules ⚠️ (geste humain — dashboard PowerSync)
Ajouter dans [docs/specs/technical/powersync-sync-rules.yaml](../../technical/powersync-sync-rules.yaml) :
- bucket `user_data` : `select * from exercise_variants where owner_id = bucket.user_id and deleted_at is null`
- bucket `shared_content` : `select * from exercise_variants where owner_id is null and deleted_at is null`

Puis **coller le YAML dans le dashboard PowerSync (Settings → Sync Rules) → Deploy**. Sans ce
redéploiement, la table ne descend pas au mobile. **Étape STOP dans le plan** (à faire par Florian/Damien).

### 4.3 PowerSync schema local (`apps/mobile/src/powersync/schema.ts`)
Nouvelle `Table` `exercise_variants` : `owner_id`, `exercise_id_a`, `exercise_id_b`, `created_at`,
`updated_at`, `deleted_at` (tous `column.text`) ; ajoutée à `AppSchema`.

### 4.4 Partagé (`packages/shared`)
- `exerciseVariantRowSchema` (Zod) : `id`, `ownerId` nullable, `exerciseIdA`, `exerciseIdB`, champs sync.
- **`canonicalPair(a: string, b: string): { a: string; b: string }`** — trie les deux id (`a < b`),
  pur, testé (ordre déjà bon / inversé). **Décision figée** : la fonction **se contente de trier** ;
  l'appelant garantit `a !== b` (self exclu du picker), pas de levée d'exception (YAGNI).

### 4.5 Mobile — repository (`apps/mobile/src/data/repositories/exercise-variant-repository.ts`, nouveau)
- **`useExerciseVariants(exerciseId)`** : `useQuery` sur `exercise_variants` jointe deux fois à
  `exercises` + `exercise_translations` pour résoudre le nom **de l'autre** exo (langue courante → fr),
  `deleted_at is null`, l'autre exo non supprimé. Renvoie `VariantItem[]` :
  `{ linkId, otherId, name, source, isEditorial, canRemove }`, dédupliqué par `otherId` (**si une paire a
  un lien éditorial ET perso, garder l'éditorial** → `isEditorial = true`, `canRemove = false`), sinon
  `canRemove = (owner_id === userId)`. Trié par nom. + `isLoading`.
- **`addExerciseVariant(selfId, otherId)`** : `canonicalPair` puis **upsert par clé naturelle** — `SELECT`
  d'une ligne existante pour `(owner_id = currentUserId(), a, b)` **sans filtre `deleted_at`** ; si trouvée
  → réactiver (`UPDATE deleted_at = null, updated_at = now`) ; sinon → `insertWithSyncFields`
  (`owner_id = currentUserId()`). Empêche la violation d'unicité au ré-ajout après suppression.
- **`removeExerciseVariant(linkId)`** : garde `owner_id === currentUserId()` (fonction pure de garde
  réutilisable, cf. `assertOwnedCustomExercise`) puis `softDelete('exercise_variants', linkId)`.
- `usePickableVariants(selfId)` **ou** exclusion calculée dans le picker : fournir l'ensemble des ids
  déjà liés (+ self) pour filtrer le sélecteur (à trancher au plan).

### 4.6 Mobile — UI
- **Fiche `[id].tsx`** : section « Variantes / alternatives » (lignes cliquables, ✕ sur perso, bouton
  d'ajout). Réutilise les styles de liste/`field` existants.
- **Sélecteur `exercises.tsx`** : mode `pickVariant` — `onPick` appelle `addExerciseVariant(forExerciseId,
  item.id)` puis `router.back()`. ⚠️ **Cette branche doit être traitée AVANT le garde `if (active)`**
  (l'ajout de variante ne dépend pas d'une séance active, contrairement à `replace`/`add`). Exclusion
  self + déjà liés (via ids passés en param ou hook).

### 4.7 Admin (`apps/admin`)
- `data/exercise-variants.ts` (nouveau) : `listVariants(exerciseId)`, `listLinkableExercises(exerciseId)`
  (publiés, hors self + liés), `addEditorialVariant(a, b)` (owner null, `canonicalPair`, **même upsert par
  clé naturelle** : réactive une ligne éditoriale soft-deletée pour la paire, sinon insert),
  `removeEditorialVariant(linkId)` (soft-delete). `logAudit` best-effort (comme exercices).
- `ExerciseEditScreen.tsx` : section « Variantes / alternatives » (mode édition d'un exo existant) —
  recherche/sélection + chips supprimables, écriture immédiate.

### 4.8 i18n
- Mobile (`exercises.detail`) : `variants` (titre), `variantsEmpty`, `addVariant`, `removeVariant`
  (a11y) — FR/EN.
- Admin (`exercises`) : `variantsLabel`, `variantsAdd`, `variantsSearch`, `variantsEmpty` — FR.

## 5. Tests
- **Shared (Vitest)** : `canonicalPair` (ordre bon / inversé) ; `exerciseVariantRowSchema` (parse OK,
  `ownerId` nullable).
- **Mobile** : garde `removeExerciseVariant` (refuse un lien non possédé) — fonction pure testée jest ;
  smoke fiche : section vide (bouton + message), section avec variantes (lignes + ✕ perso / pas de ✕
  éditorial), navigation au tap (mock router).
- **Non-régression** : fiche F10a/F10b/F10c-1 inchangée ; sélecteur d'exercices modes existants
  (`browse` / `replace` / `add`) inchangés.

## 6. Definition of Done
- [ ] Spec + plan + (design validé au brainstorming) — pas de code avant validation.
- [ ] Migration `exercise_variants` (table + contraintes + RLS + publication) poussée sur le cloud
      (feu vert Florian) et cochée dans MIGRATIONS.md ; `db:types` régénérés.
- [ ] Sync rules mises à jour (fichier repo) **et redéployées dans le dashboard PowerSync** (Florian/Damien).
- [ ] `exercise_variants` dans le schéma PowerSync local ; `exerciseVariantRowSchema` + `canonicalPair` testés.
- [ ] Mobile : section « Variantes / alternatives » (affichage éditorial + perso, dédup, tri, liens
      cliquables) ; ajout depuis n'importe quelle fiche (mode `pickVariant`) ; suppression des liens perso.
- [ ] Admin : gestion des liens éditoriaux (biblio↔biblio) — ajout/suppression, chips.
- [ ] Symétrie & canonicité respectées ; soft-delete ; gardes de portée (perso vs éditorial).
- [ ] i18n FR/EN (parité) ; offline-first ; typecheck/lint/tests verts ; PR relue par les deux devs.

## 7. Explicitement différé
- **Remplacement d'un exercice en séance** (roadmap 3.32 ; `replaceExercise` existe déjà).
- **Typage** des relations (progression / régression / équivalent).
- **Suggestions automatiques** de variantes.
- Édition des liens **éditoriaux** depuis le mobile (réservés à l'admin).
