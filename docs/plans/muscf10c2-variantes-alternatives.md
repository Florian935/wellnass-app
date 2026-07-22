# Plan d'implémentation — MUSC-F10c-2 (variantes / alternatives)

> **Pour les workers agentiques :** SOUS-SKILL REQUISE — `superpowers:subagent-driven-development`
> pour exécuter ce plan tâche par tâche. Étapes en cases (`- [ ]`).

**But :** associer à un exercice une liste plate de variantes/alternatives cliquables, en deux natures
(éditoriale globale via l'admin, personnelle via le mobile), sur une table de liaison symétrique.

**Architecture :** table `exercise_variants` symétrique (stockage canonique `a<b`), `owner_id` null =
lien éditorial global (RLS `is_content_editor`) / non-null = lien perso (RLS `owner_id = auth.uid()`).
Sync PowerSync : `shared_content` (éditorial) + `user_data` (perso). Ajout = **upsert par clé naturelle**
(réactive une ligne soft-deletée) pour éviter la violation d'unicité au ré-ajout. Affichage fiche
mobile + gestion admin.

**Stack :** Postgres (Supabase CLI), PowerSync, Zod + Vitest, React Native/Expo, React (admin), i18next.

**Spec :** [docs/specs/functional/us/muscf10c2-variantes-alternatives.md](../specs/functional/us/muscf10c2-variantes-alternatives.md)

---

## Structure des fichiers

- `supabase/migrations/<horodaté>_muscf10c2_exercise_variants.sql` — **créer**.
- `docs/specs/technical/powersync-sync-rules.yaml` — **modifier** (2 lignes) + **redéploiement dashboard**.
- `supabase/MIGRATIONS.md` — **modifier**.
- `packages/shared/src/database.types.ts` — **régénéré**.
- `apps/mobile/src/powersync/schema.ts` — **modifier** (table `exercise_variants`).
- `packages/shared/src/exercise-variant.ts` — **créer** (schéma + `canonicalPair`).
- `packages/shared/src/exercise-variant.test.ts` — **créer**.
- `packages/shared/src/index.ts` — barrel `export *` (vérifier qu'il réexporte le nouveau fichier).
- `apps/mobile/src/data/repositories/exercise-variant-repository.ts` — **créer**.
- `apps/mobile/src/data/repositories/exercise-variant-repository.test.ts` — **créer** (garde suppression).
- `apps/mobile/src/app/exercises/[id].tsx` — **modifier** (section variantes).
- `apps/mobile/src/app/exercises.tsx` — **modifier** (mode `pickVariant`).
- `apps/mobile/src/i18n/locales/fr.json` + `en.json` — **modifier**.
- `apps/admin/src/data/exercise-variants.ts` — **créer**.
- `apps/admin/src/screens/ExerciseEditScreen.tsx` — **modifier** (section variantes).
- `apps/admin/src/i18n/fr.ts` — **modifier**.

---

## Task 1 : Migration + schéma PowerSync + sync rules

**Files:**
- Create: `supabase/migrations/<horodaté>_muscf10c2_exercise_variants.sql`
- Modify: `apps/mobile/src/powersync/schema.ts`, `docs/specs/technical/powersync-sync-rules.yaml`, `supabase/MIGRATIONS.md`
- Regen: `packages/shared/src/database.types.ts`

- [ ] **Étape 1 : créer la migration** — `npm run db:new muscf10c2_exercise_variants` — contenu :

```sql
-- MUSC-F10c-2 : variantes / alternatives d'exercice (table de liaison symétrique).
-- owner_id NULL = lien éditorial global (admin) ; non-null = lien personnel (utilisateur).
-- Stockage canonique (a < b) → une paire = une ligne quel que soit le sens.
create table public.exercise_variants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  exercise_id_a uuid not null references public.exercises(id),
  exercise_id_b uuid not null references public.exercises(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint exercise_variants_canonical check (exercise_id_a < exercise_id_b)
);

create unique index exercise_variants_unique
  on public.exercise_variants (owner_id, exercise_id_a, exercise_id_b) nulls not distinct;
create index exercise_variants_a on public.exercise_variants (exercise_id_a) where deleted_at is null;
create index exercise_variants_b on public.exercise_variants (exercise_id_b) where deleted_at is null;

create trigger set_updated_at before update on public.exercise_variants
  for each row execute function public.set_updated_at();

alter table public.exercise_variants enable row level security;

create policy exercise_variants_select on public.exercise_variants for select
  using (owner_id is null or owner_id = auth.uid() or public.is_admin());

create policy exercise_variants_insert on public.exercise_variants for insert
  with check (owner_id = auth.uid() or (owner_id is null and public.is_content_editor()));

create policy exercise_variants_update on public.exercise_variants for update
  using (owner_id = auth.uid() or (owner_id is null and public.is_content_editor()))
  with check (owner_id = auth.uid() or (owner_id is null and public.is_content_editor()));

alter publication powersync add table public.exercise_variants;
```

- [ ] **Étape 2 : prévisualiser** — `npm run db:push:dry` (seule cette migration).
- [ ] **Étape 3 : STOP — feu vert Florian donné d'avance pour F10c-2 ? Sinon demander.** Puis
      `npm run db:push`.
- [ ] **Étape 4 : régénérer les types** — `npm run db:types`.
- [ ] **Étape 5 : cocher** dans `supabase/MIGRATIONS.md` (ligne + date, méthode CLI).
- [ ] **Étape 6 : sync rules (fichier repo)** — dans `docs/specs/technical/powersync-sync-rules.yaml` :
  - bucket `user_data`, section Musculation, ajouter :
    `- select * from exercise_variants where owner_id = bucket.user_id and deleted_at is null`
  - bucket `shared_content`, ajouter :
    `- select * from exercise_variants where owner_id is null and deleted_at is null`

- [ ] **Étape 7 : ⚠️ STOP — redéploiement manuel des sync rules** : coller le YAML mis à jour dans le
      dashboard PowerSync (Settings → Sync Rules) → **Deploy**. **Geste humain (Florian/Damien).** Sans
      lui, la table ne descend pas au mobile. **Ne pas cocher cette étape à la place de l'humain.**

- [ ] **Étape 8 : schéma PowerSync local** — dans `apps/mobile/src/powersync/schema.ts`, après la table
      `exercise_notes` (ou près des tables exercices), déclarer :

```ts
// ── MUSC-F10c-2 : variantes / alternatives (liaison symétrique) ───────────
// Migration : supabase/migrations/<horodaté>_muscf10c2_exercise_variants.sql
const exercise_variants = new Table({
  owner_id: column.text,
  exercise_id_a: column.text,
  exercise_id_b: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});
```
  puis l'ajouter à `new Schema({ ..., exercise_variants })`.

- [ ] **Étape 9 : vérifier** — `npm run typecheck` (vert).
- [ ] **Étape 10 : commit**

```bash
git add supabase/migrations supabase/MIGRATIONS.md packages/shared/src/database.types.ts apps/mobile/src/powersync/schema.ts docs/specs/technical/powersync-sync-rules.yaml
git commit -m "feat(muscf10c2): table exercise_variants + sync rules + schema powersync

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2 : Partagé — `canonicalPair` + schéma (TDD)

**Files:**
- Create: `packages/shared/src/exercise-variant.ts`, `packages/shared/src/exercise-variant.test.ts`
- Verify: `packages/shared/src/index.ts` réexporte bien via `export *`

- [ ] **Étape 1 : tests d'abord** (`exercise-variant.test.ts`) :

```ts
import { describe, it, expect } from 'vitest';
import { canonicalPair, exerciseVariantRowSchema } from './exercise-variant';

describe('canonicalPair', () => {
  it('trie deux id (déjà ordonnés)', () => {
    expect(canonicalPair('aaa', 'bbb')).toEqual({ a: 'aaa', b: 'bbb' });
  });
  it('trie deux id (inversés)', () => {
    expect(canonicalPair('zzz', 'aaa')).toEqual({ a: 'aaa', b: 'zzz' });
  });
});

describe('exerciseVariantRowSchema', () => {
  const base = {
    id: '11111111-1111-1111-1111-111111111111',
    ownerId: null,
    exerciseIdA: '22222222-2222-2222-2222-222222222222',
    exerciseIdB: '33333333-3333-3333-3333-333333333333',
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:00.000Z',
    deletedAt: null,
  };
  it('parse un lien éditorial (ownerId null)', () => {
    expect(exerciseVariantRowSchema.parse(base).ownerId).toBeNull();
  });
  it('parse un lien perso (ownerId uuid)', () => {
    const uid = '44444444-4444-4444-4444-444444444444';
    expect(exerciseVariantRowSchema.parse({ ...base, ownerId: uid }).ownerId).toBe(uid);
  });
});
```

- [ ] **Étape 2 : lancer, vérifier l'échec** — `npm run test -w packages/shared`.
- [ ] **Étape 3 : implémenter** (`exercise-variant.ts`) :

```ts
import { z } from 'zod';
import { uuidSchema } from './sync';

/**
 * Ordonne canoniquement une paire d'exercices (a < b) pour un stockage symétrique
 * sans doublon. L'appelant garantit `a !== b` (self exclu du sélecteur).
 */
export function canonicalPair(a: string, b: string): { a: string; b: string } {
  return a < b ? { a, b } : { a: b, b: a };
}

/** Schéma d'une ligne de liaison variante (symétrique, canonique). */
export const exerciseVariantRowSchema = z.object({
  id: uuidSchema,
  ownerId: uuidSchema.nullable(),
  exerciseIdA: uuidSchema,
  exerciseIdB: uuidSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});
export type ExerciseVariantRow = z.infer<typeof exerciseVariantRowSchema>;
```
> Vérifier le nom réel du schéma UUID dans `packages/shared/src/sync.ts` (`uuidSchema`) ; s'aligner sur
> les champs sync des autres schémas (au besoin réutiliser `contentOwnerSyncFieldsSchema` si sa forme
> correspond — sinon garder l'objet explicite ci-dessus).

- [ ] **Étape 4 : lancer, vérifier le succès** — `npm run test -w packages/shared`.
- [ ] **Étape 5 : typecheck** — `npm run typecheck`. Si `index.ts` n'a pas `export * from './exercise-variant'`,
      l'ajouter (suivre le style du barrel).
- [ ] **Étape 6 : commit**

```bash
git add packages/shared/src/exercise-variant.ts packages/shared/src/exercise-variant.test.ts packages/shared/src/index.ts
git commit -m "feat(muscf10c2): canonicalPair + exerciseVariantRowSchema (shared)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3 : Mobile — repository variantes

**Files:**
- Create: `apps/mobile/src/data/repositories/exercise-variant-repository.ts`
- Test: `apps/mobile/src/data/repositories/__tests__/exercise-variant-guard.test.ts`

- [ ] **Étape 1 : test d'abord** — garde de suppression (fonction pure). Dans le repo, extraire une
      garde testable `assertOwnsVariant(ownerId, userId)` (miroir de `assertOwnedCustomExercise`).
      ⚠️ Le workspace mobile tourne sous **jest-expo** : `describe/it/expect` sont des **globals**,
      **pas d'import de framework** (calquer `__tests__/exercise-guard.test.ts`) :

```ts
import { assertOwnsVariant } from '../exercise-variant-repository';

describe('assertOwnsVariant', () => {
  it('accepte le propriétaire', () => {
    expect(() => assertOwnsVariant('u1', 'u1')).not.toThrow();
  });
  it('refuse un lien non possédé (éditorial ou autre user)', () => {
    expect(() => assertOwnsVariant(null, 'u1')).toThrow();
    expect(() => assertOwnsVariant('u2', 'u1')).toThrow();
  });
});
```
> Note env jest : importer ce repo tire `@/powersync/system` + auth-store → `jest.setup.ts` fournit déjà
> les variables d'env (fait en F10a). Vérifier que le test tourne ; sinon mocker `@/powersync/system`.

- [ ] **Étape 2 : lancer, vérifier l'échec** — `npm run test --workspace=@wellness/mobile -- exercise-variant-repository`.
- [ ] **Étape 3 : implémenter** (`exercise-variant-repository.ts`) :

```ts
import { useQuery } from '@powersync/react';
import { canonicalPair } from '@wellness/shared';
import { useTranslation } from 'react-i18next';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields, nowUtc, softDelete } from './_sql';

/** Une variante telle qu'affichée sur la fiche (l'« autre » exercice de la paire). */
export type VariantItem = {
  linkId: string;
  otherId: string;
  name: string;
  source: 'library' | 'custom';
  isEditorial: boolean;
  canRemove: boolean;
};

type VariantDbRow = {
  link_id: string;
  owner_id: string | null;
  other_id: string;
  source: string;
  name: string | null;
};

function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) throw new Error("Aucune session active : impossible d'écrire une variante.");
  return userId;
}

/** Garde pure : lève si l'utilisateur ne possède pas le lien (perso only). */
export function assertOwnsVariant(ownerId: string | null, userId: string): void {
  if (ownerId === null || ownerId !== userId) {
    throw new Error('Suppression interdite : lien non possédé.');
  }
}

// L'« autre » exo = celui de la paire différent de self. Params (ordre) :
//   1 self (SELECT CASE) · 2 self (JOIN CASE) · 3 lang · 4 self · 5 self (WHERE)
const SELECT_VARIANTS = `
  SELECT v.id AS link_id,
         v.owner_id AS owner_id,
         CASE WHEN v.exercise_id_a = ? THEN v.exercise_id_b ELSE v.exercise_id_a END AS other_id,
         oe.source AS source,
         COALESCE(tl.name, tfr.name) AS name
  FROM exercise_variants v
  JOIN exercises oe
    ON oe.id = (CASE WHEN v.exercise_id_a = ? THEN v.exercise_id_b ELSE v.exercise_id_a END)
   AND oe.deleted_at IS NULL
  LEFT JOIN exercise_translations tl  ON tl.exercise_id = oe.id AND tl.lang = ?      AND tl.deleted_at IS NULL
  LEFT JOIN exercise_translations tfr ON tfr.exercise_id = oe.id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  WHERE v.deleted_at IS NULL
    AND (v.exercise_id_a = ? OR v.exercise_id_b = ?)
  ORDER BY name COLLATE NOCASE
`;

/**
 * Variantes d'un exercice (éditoriales + personnelles), réactives. Dédup par exercice
 * cible : si une paire porte un lien éditorial ET un lien perso, garde l'éditorial
 * (pas de suppression possible). `canRemove` = lien perso de l'utilisateur courant.
 */
export function useExerciseVariants(exerciseId: string): {
  variants: VariantItem[];
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';
  const userId = useAuthStore.getState().session?.user.id ?? null;

  const { data, isLoading } = useQuery<VariantDbRow>(SELECT_VARIANTS, [
    exerciseId, exerciseId, lang, exerciseId, exerciseId,
  ]);

  const byOther = new Map<string, VariantItem>();
  for (const row of data) {
    const isEditorial = row.owner_id === null;
    const existing = byOther.get(row.other_id);
    // Priorité éditoriale : ne pas écraser un lien éditorial déjà retenu.
    if (existing && existing.isEditorial) continue;
    byOther.set(row.other_id, {
      linkId: row.link_id,
      otherId: row.other_id,
      name: row.name ?? '',
      source: (row.source as 'library' | 'custom') ?? 'library',
      isEditorial,
      canRemove: !isEditorial && row.owner_id === userId,
    });
  }
  return { variants: [...byOther.values()], isLoading };
}

/** Ids déjà liés à `exerciseId` (pour exclure du sélecteur). Réactif. */
export function useLinkedExerciseIds(exerciseId: string): { ids: Set<string>; isLoading: boolean } {
  const { variants, isLoading } = useExerciseVariants(exerciseId);
  return { ids: new Set(variants.map((v) => v.otherId)), isLoading };
}

/**
 * Crée un lien personnel entre `selfId` et `otherId` (upsert par clé naturelle :
 * réactive une ligne perso soft-deletée pour la paire canonique, sinon insert).
 */
export async function addExerciseVariant(selfId: string, otherId: string): Promise<void> {
  const userId = currentUserId();
  const { a, b } = canonicalPair(selfId, otherId);
  const existing = await powerSync.getOptional<{ id: string }>(
    `SELECT id FROM exercise_variants
     WHERE owner_id = ? AND exercise_id_a = ? AND exercise_id_b = ? LIMIT 1`,
    [userId, a, b],
  );
  if (existing) {
    await powerSync.execute(
      `UPDATE exercise_variants SET deleted_at = NULL, updated_at = ? WHERE id = ?`,
      [nowUtc(), existing.id],
    );
    return;
  }
  await insertWithSyncFields('exercise_variants', {
    owner_id: userId,
    exercise_id_a: a,
    exercise_id_b: b,
  });
}

/** Supprime (soft) un lien perso possédé par l'utilisateur courant. */
export async function removeExerciseVariant(linkId: string): Promise<void> {
  const userId = currentUserId();
  const row = await powerSync.getOptional<{ owner_id: string | null }>(
    `SELECT owner_id FROM exercise_variants WHERE id = ? LIMIT 1`,
    [linkId],
  );
  assertOwnsVariant(row?.owner_id ?? null, userId);
  await softDelete('exercise_variants', linkId);
}
```

- [ ] **Étape 4 : lancer, vérifier le succès** — test garde vert.
- [ ] **Étape 5 : typecheck + lint** — verts.
- [ ] **Étape 6 : commit**

```bash
git add apps/mobile/src/data/repositories/exercise-variant-repository.ts apps/mobile/src/data/repositories/exercise-variant-repository.test.ts
git commit -m "feat(muscf10c2): repository variantes (lecture + upsert perso)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4 : Mobile — UI fiche + sélecteur

**Files:**
- Modify: `apps/mobile/src/app/exercises/[id].tsx`, `apps/mobile/src/app/exercises.tsx`,
  `apps/mobile/src/i18n/locales/fr.json` + `en.json`

- [ ] **Étape 1 : i18n** — dans `exercises.detail` (fr.json) ajouter après `secondaryMuscles` :

```json
      "variants": "Variantes / alternatives",
      "variantsEmpty": "Aucune variante pour l'instant",
      "addVariant": "Ajouter une variante",
      "removeVariant": "Retirer cette variante",
```
  et les miroirs EN dans `en.json` (`Variants / alternatives`, `No variant yet`, `Add a variant`,
  `Remove this variant`). Vérifier parité + JSON valide.

- [ ] **Étape 2 : sélecteur `exercises.tsx`** — gérer le mode `pickVariant` :
  - lire les params : `const { replaceExerciseId, mode, forExerciseId } = useLocalSearchParams<{ replaceExerciseId?: string; mode?: string; forExerciseId?: string }>();`
  - `const pickVariant = mode === 'pickVariant';`
  - importer `addExerciseVariant, useLinkedExerciseIds` depuis le repo variantes.
  - `const { ids: linkedIds } = useLinkedExerciseIds(pickVariant && forExerciseId ? forExerciseId : '');`
  - exclusion : dans `filteredItems`, si `pickVariant`, retirer `forExerciseId` (self) et tout `linkedIds.has(item.id)`.
  - dans `onPick`, **AVANT le garde `if (active)`** :

```tsx
if (pickVariant && forExerciseId) {
  await addExerciseVariant(forExerciseId, item.id);
  router.back();
  return;
}
```

- [ ] **Étape 3 : fiche `[id].tsx`** — section variantes (mode lecture), après la section records :
  - `import { useExerciseVariants, removeExerciseVariant } from '@/data/repositories/exercise-variant-repository';`
  - ⚠️ **Règle des hooks** : appeler `const { variants, isLoading: variantsLoading } = useExerciseVariants(exerciseId);`
    au **niveau racine du composant**, à côté de `useExerciseFicheRecords(exerciseId)` (~ligne 68),
    **avant** les retours anticipés (`if (isLoading) return`, `if (!exercise) return`). Ne pas le placer
    dans le corps de rendu.
  - Rendu (après le bloc `records`, avant les actions custom) :

```tsx
<View style={styles.field}>
  <Text style={[styles.recordsTitle, { color: colors.text }]}>
    {t('exercises.detail.variants')}
  </Text>
  {variantsLoading ? (
    <ActivityIndicator color={colors.accent} />
  ) : variants.length === 0 ? (
    <Text style={[styles.recordsEmpty, { color: colors.textMuted }]}>
      {t('exercises.detail.variantsEmpty')}
    </Text>
  ) : (
    variants.map((v) => (
      <View key={v.otherId} style={styles.variantRow}>
        <Pressable
          style={styles.variantName}
          onPress={() => router.push(`/exercises/${v.otherId}`)}
          accessibilityRole="button"
        >
          <Text style={[styles.value, { color: colors.text }]}>
            {v.name}
            {v.source === 'custom' ? ` · ${t('exercises.customBadge')}` : ''}
          </Text>
        </Pressable>
        {v.canRemove ? (
          <Pressable
            onPress={() => void removeExerciseVariant(v.linkId)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('exercises.detail.removeVariant')}
          >
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    ))
  )}
  <Pressable
    onPress={() =>
      router.push({ pathname: '/exercises', params: { mode: 'pickVariant', forExerciseId: exercise.id } })
    }
    accessibilityRole="button"
    hitSlop={8}
  >
    <Text style={[styles.seeProgression, { color: colors.accent }]}>
      {t('exercises.detail.addVariant')}
    </Text>
  </Pressable>
</View>
```
  - ajouter les styles `variantRow` (`flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12`) et `variantName` (`flex: 1`). Réutiliser `recordsTitle`/`recordsEmpty`/`value`/`seeProgression` existants.

- [ ] **Étape 4 : vérifier** — `npm run typecheck` + `npm run lint` (verts).
- [ ] **Étape 5 : commit**

```bash
git add "apps/mobile/src/app/exercises/[id].tsx" apps/mobile/src/app/exercises.tsx apps/mobile/src/i18n/locales/fr.json apps/mobile/src/i18n/locales/en.json
git commit -m "feat(muscf10c2): section variantes sur la fiche + mode pickVariant (mobile)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5 : Admin — gestion des liens éditoriaux

**Files:**
- Create: `apps/admin/src/data/exercise-variants.ts`
- Modify: `apps/admin/src/screens/ExerciseEditScreen.tsx`, `apps/admin/src/i18n/fr.ts`

- [ ] **Étape 1 : i18n admin** — dans `fr.ts`, objet `exercises`, ajouter :

```ts
    variantsLabel: 'Variantes / alternatives',
    variantsAdd: 'Ajouter',
    variantsSearch: 'Rechercher un exercice à lier…',
    variantsEmpty: 'Aucune variante liée.',
    variantsSaveFirst: 'Enregistre l’exercice avant d’ajouter des variantes.',
```

- [ ] **Étape 2 : data (`data/exercise-variants.ts`)** — sur le modèle de `data/exercises.ts`
      (supabase-js + `logAudit`), implémenter :
  - `listVariants(exerciseId)` → liens éditoriaux (`owner_id is null`, `deleted_at is null`) touchant
    `exerciseId` (`exercise_id_a = id or exercise_id_b = id`), avec nom FR résolu de l'autre exo.
    Renvoie `{ linkId, otherId, nameFr }[]`.
  - `listLinkableExercises(exerciseId, excludeIds)` → exercices publiés (`owner_id is null`,
    `status='published'`, `deleted_at is null`), hors `exerciseId` et hors `excludeIds`, nom FR (pour
    la recherche/sélection).
  - `addEditorialVariant(aId, bId)` → `canonicalPair` puis **upsert par clé naturelle** : chercher une
    ligne éditoriale (`owner_id is null`, a, b) même soft-deletée ; si trouvée → `update deleted_at=null` ;
    sinon → insert (`owner_id: null`). `logAudit({ action: 'exercise_variant.link', ... })` best-effort.
  - `removeEditorialVariant(linkId)` → `update deleted_at = now` (soft-delete) + `logAudit` best-effort.
  > `canonicalPair` importé de `@wellness/shared`. Réutiliser le pattern d'erreurs `{ error }` de
  > `data/exercises.ts`.

- [ ] **Étape 3 : écran** — dans `ExerciseEditScreen.tsx`, en **mode édition** (`isEdit === true`),
      sous la section instructions/statut, ajouter un bloc « Variantes / alternatives » :
  - état : liste des variantes liées (chargée via `listVariants(id)` dans `load()` ou un effet dédié) +
    champ de recherche + résultats `listLinkableExercises`.
  - ajout : au clic sur un résultat → `addEditorialVariant(id, otherId)` → recharger la liste.
  - suppression : ✕ sur chaque chip → `removeEditorialVariant(linkId)` → recharger.
  - si `!isEdit` (création) : afficher `fr.exercises.variantsSaveFirst` (pas de gestion tant que l'exo
    n'existe pas — FK).
  - styles : réutiliser `checkboxGroup`/`checkboxItem` (F10c-1) ou ajouter des styles de chips légers.

- [ ] **Étape 4 : vérifier** — `npm run typecheck` + `npm run lint` + `npm run build -w apps/admin` (verts).
- [ ] **Étape 5 : commit**

```bash
git add apps/admin/src/data/exercise-variants.ts apps/admin/src/screens/ExerciseEditScreen.tsx apps/admin/src/i18n/fr.ts
git commit -m "feat(muscf10c2): gestion des variantes éditoriales (admin)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Clôture (après les 5 tâches)
- Revue de code finale (subagent) sur l'ensemble du diff.
- CHANGELOG + TODO + roadmap (**3.20 Variantes/alternatives → ✅ Livré** ; ajuster compteurs) ; merge
  ff-only sur `dev`, push `origin dev`, retour sur la branche.
- **Rappels recette** : le redéploiement des sync rules (Task 1 étape 7) doit être fait avant de tester
  sur device ; recette admin (liens éditoriaux) + mobile (ajout/suppression perso, navigation, symétrie).
