---
id: REFACTO-01
titre: "Unifier la décision d'accès par pilier"
roadmap: [9.16]
catalogue: []
etape: validation
branche: refactor/refacto01-acces-pilier
maj: 31/07/2026
---

# US REFACTO-01 — Unifier la décision d'accès par pilier

> **Dette technique, pas une fonctionnalité.** Trouvée le 30/07/2026 en cadrant SOCLE-01 (voir
> [BACKLOG.md](../../../../BACKLOG.md)). **Aucun changement de comportement visible** : cette US ne
> touche à aucun écran, aucune règle métier, aucun texte. C'est pourquoi il n'y a **pas de maquette**
> (étape 3 du workflow) — rien à concevoir visuellement pour un refactor invisible.

## 0. Le problème

La question « cette fonctionnalité est-elle accessible à cet utilisateur ? », posée sur les
**piliers actifs** (`user_settings.active_pillars`, décision H — intégration opt-in), est répondue
par une même formule recopiée en ligne dans **~10 sites** au lieu d'un point de décision unique :

```ts
const activePillars = settings?.activePillars ?? [...PILLARS];
```

Une seule version propre de ce type de garde existe déjà, mais seulement pour le **registre de
widgets** : `WidgetGuard` dans [widgets.ts](../../../../packages/shared/src/widgets.ts). Elle ne
couvre pas les ~10 sites hors registre de widgets (dashboard, records, bilan hebdo, onglets,
réglages, onboarding).

**Preuve que la duplication est un vrai risque, pas une préférence de style** :
[weekly-review-repository.ts](../../../../apps/mobile/src/data/repositories/weekly-review-repository.ts#L212)
a son propre repli **codé en dur** :

```ts
const pillars = settings?.activePillars ?? ['strength', 'running', 'nutrition'];
```

au lieu de `[...PILLARS]`. Si un 4ᵉ pilier était ajouté un jour, ce site ne le verrait **jamais**
dans son repli par défaut — aucune erreur TypeScript ne le signalerait (le littéral reste un
sous-ensemble valide de `Pillar[]`). C'est exactement la classe de bug qu'une source unique élimine
par construction.

## 1. Ce qui est dupliqué, précisément

Cartographie complète (recherche exhaustive `activePillars`/`active_pillars`/`.includes('strength'
|'running'|'nutrition')`/`PILLARS` sur `apps/mobile/src` et `packages/shared/src`) :

| Site | Ce qu'il décide |
|---|---|
| [`(tabs)/_layout.tsx`](../../../../apps/mobile/src/app/(tabs)/_layout.tsx) | Onglet Musculation/Course/Nutrition routable ou non |
| [`settings.tsx`](../../../../apps/mobile/src/app/settings.tsx) | Boutons « Profil nutrition »/« Profil course », état des 3 switches piliers |
| [`(onboarding)/pillars.tsx`](../../../../apps/mobile/src/app/(onboarding)/pillars.tsx) | État des 3 switches piliers à l'onboarding |
| [`(onboarding)/summary.tsx`](../../../../apps/mobile/src/app/(onboarding)/summary.tsx) | Libellé récapitulatif des piliers choisis |
| [`dashboard-repository.ts`](../../../../apps/mobile/src/data/repositories/dashboard-repository.ts) | 5 sites : `useDayCalorieTarget`, `useMostRecentRecord`, `useDeficitVolumeAlert`, `useTrainingTime`, `useGoalAdherenceForRange` |
| [`records-repository.ts`](../../../../apps/mobile/src/data/repositories/records-repository.ts) | `useTrainingNutritionCross` (MN-03) |
| [`weekly-review-repository.ts`](../../../../apps/mobile/src/data/repositories/weekly-review-repository.ts) | Signaux éligibles du bilan hebdomadaire — **repli codé en dur, désynchronisé de `PILLARS`** |
| [`widget-layout-repository.ts`](../../../../apps/mobile/src/data/repositories/widget-layout-repository.ts) | N'est **pas** un doublon de décision (délègue déjà à `resolveScreenLayout`) — seul le repli `?? [...PILLARS]` y est dupliqué (2 fois) |

**Explicitement hors périmètre** (à ne pas toucher) :

- **`apps/admin/src/data/users.ts` (`parseActivePillars`)** — sémantique de repli **inversée**
  (absent → **aucun** pilier, `[]`), type de retour différent (`string[]`), et c'est un rendu
  d'affichage back-office, pas une décision d'accès. Fusionner ce site avec le reste inverserait
  silencieusement un comportement voulu ailleurs.
- **Les littéraux `'strength'`/`'running'`/`'nutrition'` codés en dur dans le JSX de
  `(tabs)/_layout.tsx`** — ce n'est pas une décision *dupliquée* (3 onglets fixes, 3 piliers fixes),
  juste une expression directe. Les réécrire en boucle générique ajouterait un diff sur du code
  navigation déjà recetté sans supprimer de duplication réelle.
- **Le `&&` de conjonction** dans `useDeficitVolumeAlert` et `useTrainingNutritionCross`
  (`strengthActive && nutritionActive`) — lisible tel quel, seulement 2 sites, pas de bug constaté.
  Introduire un type de garde générique pour 2 occurrences serait une abstraction sans bénéfice
  mesurable (voir bonnes-pratiques.md).

## 2. Ce qui change

**Une seule fonction pure, nouvelle, dans `packages/shared/src/pillar.ts`** (là où vivent déjà
`Pillar`/`PILLARS`) :

```ts
/** Piliers actifs, avec repli explicite : absent/non chargé → TOUS les piliers (décision H : une
 *  fonctionnalité non filtrée reste visible tant que le réglage n'est pas encore résolu). Source
 *  UNIQUE de ce repli — remplace ~10 copies de `?? [...PILLARS]`, dont une désynchronisée. */
export function resolveActivePillars(activePillars: readonly Pillar[] | null | undefined): Pillar[] {
  return activePillars ? [...activePillars] : [...PILLARS];
}
```

**Chaque site listé en §1 (sauf les 2 exclusions ci-dessus) remplace** sa ligne
`settings?.activePillars ?? [...PILLARS]` (ou l'équivalent codé en dur de weekly-review) **par**
`resolveActivePillars(settings?.activePillars)`. Le test qui suit (`.includes(...)`, `.some(...)`,
`&&`) **ne change pas** — seul le calcul du tableau de piliers change de source.

`widgets.ts` n'est pas modifié : son `WidgetGuard` (`Pillar[] | 'always' | {setting}`) reste le
mécanisme du registre de widgets, sans rapport direct avec ce refactor (il ne fait pas le repli —
ses appelants le font déjà correctement, cf. `resolveScreenLayout`).

## 3. Pourquoi ce périmètre, pas plus large

- **Zéro nouvelle abstraction pour les cas à 1-2 occurrences.** Le seul point réellement dupliqué
  ~10 fois est le **repli**. Le `.includes()`/`&&` qui suit varie légitimement par consommateur
  (un booléen, une fonction `isActive`, un objet `{strength,running,nutrition}`) et n'a pas besoin
  d'être uniformisé pour éliminer la dette réelle.
- **Comportement strictement identique.** `resolveActivePillars(x)` renvoie exactement ce que
  `x ?? [...PILLARS]` renvoyait déjà à ces ~9 sites — sauf à `weekly-review-repository.ts`, où le
  comportement ne change **qu'en cas de 4ᵉ pilier futur** (aujourd'hui, avec 3 piliers, le résultat
  est identique). Aucune recette device n'est donc requise : c'est vérifiable par lecture + tests +
  typecheck.

## 4. i18n / offline / notifications

Sans objet — aucune chaîne, aucune donnée nouvelle, aucun écran. Le comportement offline est
inchangé (la fonction est pure, sans I/O).

## 5. Critères de recette

Pas de recette device (§3). La clôture de cette US se fait par :

- [ ] `resolveActivePillars` testée sous Vitest (cas `undefined`, `null`, tableau vide, tableau
      plein) dans `pillar.test.ts`.
- [ ] Les ~10 sites listés en §1 utilisent `resolveActivePillars` — plus aucune occurrence de
      `?? [...PILLARS]` ni de repli codé en dur hors de cette fonction (recherche `grep` de
      contrôle avant clôture).
- [ ] `weekly-review-repository.ts` n'a plus de littéral `['strength', 'running', 'nutrition']`.
- [ ] `npm run typecheck` / `npm run lint` / `npm run test` verts (lus sans pipe).
- [ ] Relecture manuelle rapide des ~10 diffs : chaque site produit exactement le même tableau de
      piliers qu'avant (aucun changement de comportement à 3 piliers).
