# US NUTR-17 — Régularité du journal — Plan d'implémentation

> **Pour l'exécutant :** tâche par tâche, étapes cochables. TDD sur `packages/shared` (Vitest).
> Mobile : `typecheck` + `lint` + `test` verts ; rendu vérifié en recette. Commits FR.

**Objectif :** carte « Régularité du journal » (pct + N/M jours renseignés) sur Stats nutrition,
dénominateur borné à l'ancienneté, aujourd'hui exclu.

**Architecture :** logique pure `@wellness/shared` (`computeJournalCompletion`) ; hook
`useJournalCompletion` (journal-repository, compose `useDailyTotals` + `MIN(log_date)`) ; carte dans
Stats nutrition (même fenêtre 7 j/30 j que Adhérence/Apports). **Aucune migration.**

**Spec :** [docs/specs/functional/us/nutr17-regularite-journal.md](../specs/functional/us/nutr17-regularite-journal.md)

**Fichiers touchés :**
- Modifier : `packages/shared/src/nutrition.ts` (+ `nutrition.test.ts`)
- Modifier : `apps/mobile/src/data/repositories/journal-repository.ts` (hook)
- Modifier : `apps/mobile/src/app/nutrition-stats.tsx`, i18n `fr.json`+`en.json`

**100 % client, aucune migration, aucun checkpoint 🔴.**

---

## Task 1 : Logique pure `computeJournalCompletion` (TDD)

**Files :** Modify `packages/shared/src/nutrition.ts`, `packages/shared/src/nutrition.test.ts`

- [ ] **Step 1 : Tests d'abord** (dans `nutrition.test.ts`, compléter l'import avec
  `computeJournalCompletion`). Utiliser des dates **fixes** (pas `new Date()`), un fuseau-agnostique via
  `new Date(2026, 6, 16)` (16/07/2026 local) :

```ts
describe('computeJournalCompletion', () => {
  const today = new Date(2026, 6, 16); // 16/07 local ; fenêtre 7j = [09/07 … 15/07]
  it('fenêtre pleine : loggés / window', () => {
    const r = computeJournalCompletion({
      loggedDayKeys: ['2026-07-10', '2026-07-12', '2026-07-15'],
      firstEntryDayKey: '2026-07-01', windowDays: 7, today,
    });
    expect(r).toEqual({ loggedDays: 3, effectiveWindow: 7, pct: 43 });
  });
  it('borne ancienneté : dénominateur = jours depuis la 1ère entrée', () => {
    const r = computeJournalCompletion({
      loggedDayKeys: ['2026-07-14', '2026-07-15'],
      firstEntryDayKey: '2026-07-14', windowDays: 30, today, // [14/07 … 15/07] = 2 jours
    });
    expect(r).toEqual({ loggedDays: 2, effectiveWindow: 2, pct: 100 });
  });
  it("aujourd'hui exclu : un jour loggé aujourd'hui ne compte pas", () => {
    const r = computeJournalCompletion({
      loggedDayKeys: ['2026-07-16'], // aujourd'hui
      firstEntryDayKey: '2026-07-16', windowDays: 7, today,
    });
    expect(r).toEqual({ loggedDays: 0, effectiveWindow: 0, pct: 0 }); // 1ère entrée = aujourd'hui
  });
  it('aucune entrée → tout à 0', () => {
    expect(computeJournalCompletion({ loggedDayKeys: [], firstEntryDayKey: null, windowDays: 7, today }))
      .toEqual({ loggedDays: 0, effectiveWindow: 0, pct: 0 });
  });
});
```

- [ ] **Step 2 : Vérifier l'échec** — `npm run test` → FAIL.

- [ ] **Step 3 : Implémenter** (dans `nutrition.ts` ; ajouter `import { addDays, localDayKey } from
  './date';` si absent — vérifier les imports existants du fichier)

```ts
/**
 * Régularité du journal (item NUTR-17) : part des jours renseignés sur la fenêtre des `windowDays`
 * jours ÉCOULÉS (`[J-windowDays … J-1]`, aujourd'hui exclu), dénominateur borné à l'ancienneté du
 * compte (`min(fenêtre, jours depuis la 1ʳᵉ entrée)`). Pur. Reçoit un `Date` `today` (jamais une clé —
 * `new Date("AAAA-MM-JJ")` parse en UTC et décale). Comparaisons en clés `AAAA-MM-JJ`.
 */
export function computeJournalCompletion(params: {
  loggedDayKeys: string[];
  firstEntryDayKey: string | null;
  windowDays: number;
  today: Date;
}): { loggedDays: number; effectiveWindow: number; pct: number } {
  const { loggedDayKeys, firstEntryDayKey, windowDays, today } = params;
  const empty = { loggedDays: 0, effectiveWindow: 0, pct: 0 };

  const yesterdayKey = localDayKey(addDays(today, -1));
  const windowStartKey = localDayKey(addDays(today, -windowDays));
  if (firstEntryDayKey == null) return empty;

  const effectiveStartKey = firstEntryDayKey > windowStartKey ? firstEntryDayKey : windowStartKey;
  if (effectiveStartKey > yesterdayKey) return empty; // 1ère entrée = aujourd'hui / futur

  // Écart EXACT en jours (reparse UTC → pas de dérive heure d'été).
  const effectiveWindow = Math.max(
    0,
    Math.round(
      (Date.parse(yesterdayKey + 'T00:00:00Z') - Date.parse(effectiveStartKey + 'T00:00:00Z')) /
        86_400_000,
    ) + 1,
  );
  if (effectiveWindow === 0) return empty;

  const loggedDays = new Set(
    loggedDayKeys.filter((k) => k >= effectiveStartKey && k <= yesterdayKey),
  ).size;
  return { loggedDays, effectiveWindow, pct: Math.round((loggedDays / effectiveWindow) * 100) };
}
```

- [ ] **Step 4 : Vérifier** — `npm run test` → PASS ; `npm run typecheck` → PASS. Commit :

```bash
git add packages/shared/src/nutrition.ts packages/shared/src/nutrition.test.ts
git commit -m "feat(shared): computeJournalCompletion (NUTR-17)"
```

---

## Task 2 : Hook `useJournalCompletion(windowDays)`

**Files :** Modify `apps/mobile/src/data/repositories/journal-repository.ts`

- [ ] **Step 1 : Imports** — ajouter `computeJournalCompletion` et `localDayKey` à la ligne d'import
  **valeur** `@wellness/shared` (⚠️ pas la ligne `import type`) ; `useQuery` est déjà importé (`@powersync/react`).
- [ ] **Step 2 : Écrire le hook**

```ts
/** Clé AAAA-MM-JJ locale du jour `n` jours avant aujourd'hui (miroir nutrition-stats/dashboard). */
const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDayKey(d);
};

const SELECT_FIRST_LOG_DATE =
  'SELECT MIN(log_date) AS first FROM food_entries WHERE deleted_at IS NULL';

/** Régularité du journal (NUTR-17) sur les `windowDays` jours écoulés. */
export function useJournalCompletion(windowDays: number): {
  loggedDays: number;
  effectiveWindow: number;
  pct: number;
  isLoading: boolean;
} {
  const { totals, isLoading: totalsLoading } = useDailyTotals(daysAgo(windowDays));
  const { data, isLoading: firstLoading } = useQuery<{ first: string | null }>(SELECT_FIRST_LOG_DATE);
  const firstEntryDayKey = data[0]?.first ?? null;

  const { loggedDays, effectiveWindow, pct } = computeJournalCompletion({
    loggedDayKeys: totals.map((t) => t.logDate),
    firstEntryDayKey,
    windowDays,
    today: new Date(),
  });
  return { loggedDays, effectiveWindow, pct, isLoading: totalsLoading || firstLoading };
}
```

> `useDailyTotals` et `DailyTotal.logDate` (AAAA-MM-JJ) existent déjà dans ce fichier. Si un `daysAgo`
> local existe déjà, réutiliser ; sinon l'ajouter comme ci-dessus (near `SELECT_DAILY_TOTALS`).

- [ ] **Step 3 : Vérifier** — `npm run typecheck` → PASS. Commit :

```bash
git add apps/mobile/src/data/repositories/journal-repository.ts
git commit -m "feat(nutrition): hook useJournalCompletion (régularité du journal)"
```

---

## Task 3 : Carte « Régularité du journal » (Stats) + i18n

**Files :** Modify `apps/mobile/src/app/nutrition-stats.tsx`, `apps/mobile/src/i18n/locales/fr.json`+`en.json`

- [ ] **Step 1 : i18n** — `stats.completion` (FR/EN parité, patron pluriel comme `stats.adherence.inTarget`) :
  - FR : `title`: « Régularité du journal », `logged_one`: « {{count}} / {{total}} jour renseigné »,
    `logged_other`: « {{count}} / {{total}} jours renseignés », `empty`: « Commence à remplir ton journal ».
  - EN : `title`: « Logging consistency », `logged_one`: « {{count}} / {{total}} day logged »,
    `logged_other`: « {{count}} / {{total}} days logged », `empty`: « Start logging your journal ».
- [ ] **Step 2 : Carte** dans `nutrition-stats.tsx`, **après la carte Adhérence** (NUTR-10), même section.
  Importer `useJournalCompletion` (depuis `@/data/repositories/journal-repository`), appeler
  `useJournalCompletion(intakeWindowDays)`. Rendu (calqué sur la carte Adhérence) :
  - `completion.isLoading` → `<Text hint>…</Text>` ;
  - `completion.effectiveWindow === 0` → `t('stats.completion.empty')` ;
  - sinon : `pct %` en valeur forte dans un `<View style={styles.avgRow}>` (comme la carte Adhérence,
    `<Text style={styles.avgKcal}>{completion.pct} %</Text>`) + `t('stats.completion.logged', { count:
    completion.loggedDays, total: completion.effectiveWindow })` (`styles.macroLine`).
  - Titre de section `<Text style={styles.section}>{t('stats.completion.title')}</Text>` + `<Card>`.
- [ ] **Step 3 : Vérifier** — `npm run typecheck && npm run lint && npm run test` verts ; parité i18n
  (diff fr/en des clés `stats.completion.*`). Commit :

```bash
git add apps/mobile/src/app/nutrition-stats.tsx apps/mobile/src/i18n/locales/fr.json apps/mobile/src/i18n/locales/en.json
git commit -m "feat(nutrition): carte Régularité du journal (Stats) + i18n"
```

---

## Task 4 : Vérification finale & recette

- [ ] **Step 1 : Suite verte** — `npm run typecheck && npm run lint && npm run test`.
- [ ] **Step 2 : Suivi & commit final** — CHANGELOG + TODO (NUTR-17 livrée, reste recette + relecture ; catalogue NUTR-17 → ✅), push `dev` via `/commit`.
- [ ] **Step 3 : Recette device (Florian)** :
  - Logguer certains jours passés, en sauter d'autres → carte : `pct %` + « N/M jours renseignés » cohérents.
  - **Aujourd'hui** loggé → non compté (le taux ne bouge pas en loggant le jour même).
  - **Compte récent** (1ʳᵉ entrée il y a peu, fenêtre 30 j) → dénominateur = ancienneté, pas 30.
  - **7 j ↔ 30 j** : le sélecteur recalcule apports + adhérence + régularité.
  - Aucune entrée → « Commence à remplir ton journal ».
  - i18n FR/EN.

---

## Notes
- **Aucune migration, 100 % client, offline.** Lecture de `food_entries` existant.
- Fonction pure : compte des jours en **UTC** (exact, sans DST) ; comparaisons en clés string ; `today`
  passé en `Date` (jamais reparsé depuis une clé).
- 3 cartes désormais dans la section apports (Apports moyens · Adhérence · Régularité), même sélecteur 7 j/30 j.