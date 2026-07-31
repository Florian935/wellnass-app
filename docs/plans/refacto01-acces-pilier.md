# US REFACTO-01 — Unifier la décision d'accès par pilier — Plan d'implémentation

> ⚠️ **Workflow projet** : ne PAS exécuter avant validation des livrables (spec + plan — **pas de
> maquette**, refactor invisible, cf. spec §0).
> ✅ **Aucune migration, aucun module natif, aucun changement de comportement à 3 piliers** — pas de
> recette device. Clôture par lecture + tests + typecheck (spec §5).

**Goal :** remplacer les ~10 copies en ligne de `settings?.activePillars ?? [...PILLARS]` (dont une
désynchronisée de `PILLARS`, dans `weekly-review-repository.ts`) par un seul appel à une fonction
pure `resolveActivePillars`, sans changer un seul comportement observable.

**Spec :** [docs/specs/functional/us/refacto01-acces-pilier.md](../specs/functional/us/refacto01-acces-pilier.md)

**Ordre :** la fonction pure d'abord (testée seule, isolément), puis les sites un par un — chacun est
un remplacement d'une ligne, vérifiable indépendamment des autres (aucune dépendance entre eux).

---

## Structure des fichiers

**Modifier :**
- `packages/shared/src/pillar.ts` — ajoute `resolveActivePillars`.
- `packages/shared/src/pillar.test.ts` — tests de la nouvelle fonction.
- `apps/mobile/src/app/(tabs)/_layout.tsx`
- `apps/mobile/src/app/settings.tsx`
- `apps/mobile/src/app/(onboarding)/pillars.tsx`
- `apps/mobile/src/app/(onboarding)/summary.tsx`
- `apps/mobile/src/data/repositories/dashboard-repository.ts` (5 sites : `useDayCalorieTarget`,
  `useMostRecentRecord`, `useDeficitVolumeAlert`, `useTrainingTime`, `useGoalAdherenceForRange`)
- `apps/mobile/src/data/repositories/records-repository.ts` (`useTrainingNutritionCross`)
- `apps/mobile/src/data/repositories/weekly-review-repository.ts` (corrige le repli codé en dur)
- `apps/mobile/src/data/repositories/widget-layout-repository.ts` (**un seul** des deux appels —
  voir Task 9, ne pas toucher au `[...PILLARS]` littéral qui sert à obtenir un layout non filtré)

**Ne pas toucher** (spec §1, exclusions explicites) :
- `apps/admin/src/data/users.ts` (`parseActivePillars`) — sémantique de repli inversée, hors sujet.
- `packages/shared/src/widgets.ts` — `WidgetGuard` ne fait pas le repli, aucun rapport direct.

---

## Tasks

- [ ] 1. **`resolveActivePillars` (pur, testé)**
  - Dans `packages/shared/src/pillar.ts`, ajouter :
    ```ts
    export function resolveActivePillars(activePillars: readonly Pillar[] | null | undefined): Pillar[] {
      return activePillars ? [...activePillars] : [...PILLARS];
    }
    ```
  - Dans `pillar.test.ts`, ajouter un `describe('resolveActivePillars', ...)` : `undefined` → 3
    piliers, `null` → 3 piliers, `[]` → `[]` (un tableau vide **saisi** n'est pas une absence de
    donnée — ne doit pas retomber sur le repli), `['strength']` → `['strength']` (copie défensive,
    pas la même référence).
  - Vérifier : `npx vitest run src/pillar.test.ts` (packages/shared).

- [ ] 2. **`(tabs)/_layout.tsx`**
  - Remplacer `const activePillars = settings?.activePillars ?? [...PILLARS];` par
    `const activePillars = resolveActivePillars(settings?.activePillars);` (+ import).
  - Ne pas toucher aux 3 littéraux `'strength'`/`'running'`/`'nutrition'` du JSX (spec §1).

- [ ] 3. **`settings.tsx`**
  - Même remplacement (une seule ligne, consommée par les 2 boutons profil + la boucle des 3 switches).

- [ ] 4. **`(onboarding)/pillars.tsx`**
  - Même remplacement.

- [ ] 5. **`(onboarding)/summary.tsx`**
  - Même remplacement (utilisé par le seul `.map/.join`, pas de `.includes` ici).

- [ ] 6. **`dashboard-repository.ts` — 5 sites**
  - `useDayCalorieTarget`, `useMostRecentRecord`, `useDeficitVolumeAlert`, `useTrainingTime` : même
    remplacement de la ligne `const activePillars = settings?.activePillars ?? [...PILLARS];`.
  - `useGoalAdherenceForRange` : la ligne est enchaînée sans variable intermédiaire
    (`(settings?.activePillars ?? [...PILLARS]).includes('running')`) → devient
    `resolveActivePillars(settings?.activePillars).includes('running')`.
  - Un seul import `resolveActivePillars` ajouté en tête de fichier, réutilisé par les 5 sites.

- [ ] 7. **`records-repository.ts` — `useTrainingNutritionCross`**
  - Remplacer `const pillars = settings?.activePillars ?? [...PILLARS];` par
    `const activePillars = resolveActivePillars(settings?.activePillars);` (renomme `pillars` →
    `activePillars` au passage, pour la cohérence avec tous les autres sites — usage local à la
    fonction, aucun risque).
  - Adapter les deux `.includes(...)` qui suivent au nouveau nom de variable.

- [ ] 8. **`weekly-review-repository.ts` — corrige le repli codé en dur**
  - Remplacer
    ```ts
    const pillars = settings?.activePillars ?? ['strength', 'running', 'nutrition'];
    ```
    par
    ```ts
    const pillars = resolveActivePillars(settings?.activePillars);
    ```
    (le nom de variable local `pillars` reste, seule sa provenance change — pas d'obligation de
    renommer ici, la fonction retourne le même type). C'est le seul site qui **corrige un bug latent**
    (repli désynchronisé de `PILLARS`), à mentionner dans le commit.

- [ ] 9. **`widget-layout-repository.ts` — un seul des deux appels**
  - Ligne ~92 (`activePillars` réactif, utilisé pour filtrer l'affichage) : remplacer
    `settings?.activePillars ?? [...PILLARS]` par `resolveActivePillars(settings?.activePillars)`.
  - Ligne ~52 (`[...PILLARS]` passé littéralement à `fullScreenFrom` pour obtenir un layout **non
    filtré**, utilisé par l'écran de réorganisation) : **ne pas toucher** — ce n'est pas un repli sur
    donnée absente, c'est une valeur volontairement différente (tous les piliers, indépendamment des
    réglages réels).

- [ ] 10. **Contrôle final + clôture**
  - `grep -rn "?? \[\.\.\.PILLARS\]" apps/mobile/src packages/shared/src` → doit ne plus rien
    trouver hors de `resolveActivePillars` elle-même.
  - `grep -rn "\['strength', 'running', 'nutrition'\]" apps/mobile/src` → doit ne plus rien trouver.
  - `npm run typecheck` / `npm run lint` / `npm run test` (racine, lus sans pipe).
  - Relecture des ~10 diffs : chaque site produit exactement le même résultat qu'avant à 3 piliers
    (spec §5).
  - `/commit` : front-matter `etape: code` → `close` directement (pas de recette device, spec §3),
    roadmap 9.16 → ✅, `ETAT.md` régénéré, entrée BACKLOG.md retirée, fusion sur `dev`.
