# US MN-03 — Vue croisée « charge muscu & apports » — Plan d'implémentation

> **Pour l'exécutant :** tâche par tâche (cases `- [ ]`), TDD, commits fréquents.
> Spec : [mn03-vue-croisee-seances-apports.md](../specs/functional/us/mn03-vue-croisee-seances-apports.md).
> Sous-skill : `superpowers:subagent-driven-development`.

**Goal :** afficher sur **Nutrition → Stats** un tableau descriptif de **8 semaines** croisant la charge
muscu (séances, tonnage) et les apports (kcal/j, protéines/j), avec une mini-tendance vs semaine
précédente.

**Architecture :** fonction pure `computeWeeklyTrainingNutrition` dans `@wellness/shared` (testée Vitest,
réutilise `percentChange`) ; hook `useTrainingNutritionCross` (mobile, 2 requêtes locales + gating au
retour) ; composant présentiel `TrainingNutritionCrossCard` (tableau + `DeltaBadge`, rend `null` si
gating KO, empty state si pas de données) ; câblé dans `nutrition-stats.tsx`. **100 % client, offline —
aucune migration, aucun cloud, aucune dépendance native, pas de checkpoint 🔴.**

**Tech Stack :** TypeScript, React Native/Expo, PowerSync (`useQuery`), Vitest, i18next.

---

## Structure des fichiers

- **Créer** `packages/shared/src/training-nutrition.ts` — type `WeeklyTrainingNutrition` + fonction pure `computeWeeklyTrainingNutrition`.
- **Créer** `packages/shared/src/training-nutrition.test.ts` — tests Vitest.
- **Modifier** `packages/shared/src/index.ts` — `export * from './training-nutrition';`.
- **Modifier** `apps/mobile/src/data/repositories/records-repository.ts` — hook `useTrainingNutritionCross` (+ helper local `last8MondaysLocal`).
- **Créer** `apps/mobile/src/components/TrainingNutritionCrossCard.tsx` — tableau présentiel (rend `null` / empty state / table).
- **Modifier** `apps/mobile/src/app/nutrition-stats.tsx` — insérer `<TrainingNutritionCrossCard />` après la carte « apports moyens ».
- **Modifier** `apps/mobile/src/i18n/locales/fr.json` + `en.json` — namespace `stats.cross.*`.
- **Modifier** `docs/product/analyses-donnees.md` — MN-03 ⏳ → ✅ (à la clôture).

---

## Task 1 : logique pure `computeWeeklyTrainingNutrition` (TDD)

**Files:** Create `packages/shared/src/training-nutrition.ts` + `training-nutrition.test.ts` ; Modify `index.ts`.

Implémentation cible :
```ts
// training-nutrition.ts
import { percentChange, type PercentChange } from './comparison';

export type WeeklyTrainingNutrition = {
  weekStart: string;                    // dayKey lundi (AAAA-MM-JJ, local)
  sessions: number;                     // nb séances terminées de la semaine
  tonnage: number | null;               // Σ reps×kg ; null si 0 séance (0 possible si séances sans série)
  avgKcal: number | null;               // moyenne/jour loggé ; null si 0 jour loggé
  avgProteinG: number | null;           // idem protéines
  tonnageChange: PercentChange | null;  // vs semaine précédente affichée ; null si pas de base
  kcalChange: PercentChange | null;
};

type WorkoutInput = { dayKey: string; tonnage: number };     // UNE entrée par séance terminée
type DailyKcalInput = { dayKey: string; kcal: number; proteinG: number }; // jours loggés

/**
 * Agrège charge muscu et apports par semaine calendaire (MN-03, descriptif). Pure, déterministe,
 * sans I/O ni `Date`. `weekStarts` = lundis récent → ancien ; bucketing sans borne haute
 * (semaine d'un dayKey = le plus grand `weekStart <= dayKey`). Deltas = vs semaine précédente
 * AFFICHÉE (ligne du dessous) ; `null` sur la dernière ligne ou si une valeur comparée est `null`.
 */
export function computeWeeklyTrainingNutrition(input: {
  weekStarts: ReadonlyArray<string>;
  workouts: ReadonlyArray<WorkoutInput>;
  dailyKcals: ReadonlyArray<DailyKcalInput>;
}): WeeklyTrainingNutrition[] {
  const { weekStarts, workouts, dailyKcals } = input;
  const oldest = weekStarts[weekStarts.length - 1];

  // weekStarts triés récent → ancien : le 1er `ws <= dayKey` est le plus grand ≤ dayKey.
  const bucketOf = (dayKey: string): string | null => {
    if (oldest == null || dayKey < oldest) return null; // hors fenêtre
    for (const ws of weekStarts) if (ws <= dayKey) return ws;
    return null;
  };

  const sessions = new Map<string, number>();
  const tonnage = new Map<string, number>();
  const kcalSum = new Map<string, number>();
  const protSum = new Map<string, number>();
  const loggedDays = new Map<string, number>();

  for (const w of workouts) {
    const ws = bucketOf(w.dayKey);
    if (ws == null) continue;
    sessions.set(ws, (sessions.get(ws) ?? 0) + 1);
    tonnage.set(ws, (tonnage.get(ws) ?? 0) + w.tonnage);
  }
  for (const d of dailyKcals) {
    const ws = bucketOf(d.dayKey);
    if (ws == null) continue;
    kcalSum.set(ws, (kcalSum.get(ws) ?? 0) + d.kcal);
    protSum.set(ws, (protSum.get(ws) ?? 0) + d.proteinG);
    loggedDays.set(ws, (loggedDays.get(ws) ?? 0) + 1);
  }

  const rows: WeeklyTrainingNutrition[] = weekStarts.map((weekStart) => {
    const s = sessions.get(weekStart) ?? 0;
    const ld = loggedDays.get(weekStart) ?? 0;
    return {
      weekStart,
      sessions: s,
      tonnage: s > 0 ? (tonnage.get(weekStart) ?? 0) : null,
      avgKcal: ld > 0 ? Math.round((kcalSum.get(weekStart) ?? 0) / ld) : null,
      avgProteinG: ld > 0 ? Math.round((protSum.get(weekStart) ?? 0) / ld) : null,
      tonnageChange: null,
      kcalChange: null,
    };
  });

  for (let i = 0; i < rows.length; i++) {
    const cur = rows[i]!;
    const prev = rows[i + 1]; // semaine plus ancienne = base de comparaison
    if (!prev) continue;
    if (cur.tonnage != null && prev.tonnage != null) cur.tonnageChange = percentChange(cur.tonnage, prev.tonnage);
    if (cur.avgKcal != null && prev.avgKcal != null) cur.kcalChange = percentChange(cur.avgKcal, prev.avgKcal);
  }

  return rows;
}
```

- [ ] **Step 1 — Test qui échoue** (`training-nutrition.test.ts`) :

```ts
import { describe, it, expect } from 'vitest';
import { computeWeeklyTrainingNutrition } from './training-nutrition';

// 3 semaines pour lisibilité : lundis récent → ancien
const weekStarts = ['2026-07-13', '2026-07-06', '2026-06-29'];

describe('computeWeeklyTrainingNutrition', () => {
  it('renvoie une ligne par semaine, dans l\'ordre reçu', () => {
    const r = computeWeeklyTrainingNutrition({ weekStarts, workouts: [], dailyKcals: [] });
    expect(r.map((x) => x.weekStart)).toEqual(weekStarts);
  });

  it('bucketing frontière lundi/dimanche', () => {
    const r = computeWeeklyTrainingNutrition({
      weekStarts,
      workouts: [
        { dayKey: '2026-07-13', tonnage: 100 }, // lundi → semaine courante
        { dayKey: '2026-07-12', tonnage: 200 }, // dimanche → semaine précédente
      ],
      dailyKcals: [],
    });
    expect(r[0]!.sessions).toBe(1);
    expect(r[0]!.tonnage).toBe(100);
    expect(r[1]!.sessions).toBe(1);
    expect(r[1]!.tonnage).toBe(200);
  });

  it('séance sans série qualifiante : comptée, tonnage 0 (pas null)', () => {
    const r = computeWeeklyTrainingNutrition({
      weekStarts, workouts: [{ dayKey: '2026-07-13', tonnage: 0 }], dailyKcals: [],
    });
    expect(r[0]!.sessions).toBe(1);
    expect(r[0]!.tonnage).toBe(0);
  });

  it('tonnage null si 0 séance ; avg null si 0 jour loggé', () => {
    const r = computeWeeklyTrainingNutrition({ weekStarts, workouts: [], dailyKcals: [] });
    expect(r[0]!.tonnage).toBeNull();
    expect(r[0]!.avgKcal).toBeNull();
    expect(r[0]!.avgProteinG).toBeNull();
  });

  it('moyenne kcal/prot sur jours loggés uniquement', () => {
    const r = computeWeeklyTrainingNutrition({
      weekStarts,
      workouts: [],
      dailyKcals: [
        { dayKey: '2026-07-13', kcal: 2000, proteinG: 150 },
        { dayKey: '2026-07-14', kcal: 2200, proteinG: 170 },
      ],
    });
    expect(r[0]!.avgKcal).toBe(2100);
    expect(r[0]!.avgProteinG).toBe(160);
  });

  it('dayKey hors fenêtre (antérieur au plus ancien lundi) ignoré', () => {
    const r = computeWeeklyTrainingNutrition({
      weekStarts, workouts: [{ dayKey: '2026-06-01', tonnage: 999 }], dailyKcals: [],
    });
    expect(r.every((x) => x.sessions === 0)).toBe(true);
  });

  it('delta vs semaine précédente affichée ; null sur la dernière ligne', () => {
    const r = computeWeeklyTrainingNutrition({
      weekStarts,
      workouts: [
        { dayKey: '2026-07-13', tonnage: 120 }, // courante
        { dayKey: '2026-07-06', tonnage: 100 }, // précédente
      ],
      dailyKcals: [],
    });
    expect(r[0]!.tonnageChange?.pct).toBe(20); // 120 vs 100
    expect(r[1]!.tonnageChange).toBeNull();    // pas de base (semaine du milieu vs plus ancienne vide → tonnage null côté ancienne)
    expect(r[2]!.tonnageChange).toBeNull();    // dernière ligne
  });

  it('delta kcal null si une des deux semaines n\'a pas d\'apports', () => {
    const r = computeWeeklyTrainingNutrition({
      weekStarts,
      workouts: [],
      dailyKcals: [{ dayKey: '2026-07-13', kcal: 2000, proteinG: 150 }], // seulement semaine courante
    });
    expect(r[0]!.kcalChange).toBeNull(); // semaine précédente sans apports
  });
});
```

- [ ] **Step 2 — Lancer, échec** : `npx vitest run packages/shared/src/training-nutrition.test.ts` → FAIL (module absent).
- [ ] **Step 3 — Implémenter** `training-nutrition.ts` (code ci-dessus) + ajouter `export * from './training-nutrition';` dans `index.ts`.
- [ ] **Step 4 — Lancer, succès** : même commande → PASS ; puis `npm run test --workspace @wellness/shared` (pas de régression).
- [ ] **Step 5 — Commit** : `git commit -m "feat(shared): computeWeeklyTrainingNutrition — agrégat hebdo muscu/nutrition (TDD)"`.

---

## Task 2 : hook `useTrainingNutritionCross` (mobile)

**Files:** Modify `apps/mobile/src/data/repositories/records-repository.ts`.

Réutiliser : `useDailyTotals` (`journal-repository`), `useSettings` (`settings-repository`) →
`settings?.activePillars` (**patron exact** : `useDeficitVolumeAlert` /
[dashboard-repository.ts](../../apps/mobile/src/data/repositories/dashboard-repository.ts) l.567-570 &
l.660-675 — ⚠️ pas `records-repository.ts:443`, référence erronée), `localDayKey` +
`computeWeeklyTrainingNutrition` + `PILLARS` (`@wellness/shared`). S'inspirer de `startOfWeekLocalUtc`
(déjà dans le fichier) pour la construction **minuit local → ISO UTC**.

**Imports à ajouter** dans `records-repository.ts` (aucun n'y est présent aujourd'hui ; aucun cycle
d'import — journal/settings n'importent pas records) :
```ts
import { computeWeeklyTrainingNutrition, localDayKey, PILLARS, type WeeklyTrainingNutrition } from '@wellness/shared';
import { useDailyTotals } from './journal-repository';
import { useSettings } from './settings-repository';
```

- [ ] **Step 1 — Helper bornes** (file-private) :

```ts
const CROSS_WEEKS = 8;

/** 8 lundis locaux (récent → ancien) + bornes basses (ISO UTC minuit local, et dayKey). */
function last8MondaysLocal(): { weekStarts: string[]; oldestIsoUtc: string; oldestDayKey: string } {
  const now = new Date();
  const daysSinceMonday = (now.getDay() + 6) % 7;
  const weekStarts: string[] = [];
  let oldest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday, 0, 0, 0, 0);
  for (let i = 0; i < CROSS_WEEKS; i++) {
    const m = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday - i * 7, 0, 0, 0, 0);
    weekStarts.push(localDayKey(m)); // récent → ancien
    oldest = m;
  }
  return { weekStarts, oldestIsoUtc: oldest.toISOString(), oldestDayKey: localDayKey(oldest) };
}
```

- [ ] **Step 2 — Hook** (tous les hooks appelés inconditionnellement ; gating au retour) :

```ts
export function useTrainingNutritionCross(): {
  weeks: WeeklyTrainingNutrition[];
  isLoading: boolean;
} {
  const { weekStarts, oldestIsoUtc, oldestDayKey } = last8MondaysLocal();
  const { settings } = useSettings();
  // Repli `[...PILLARS]` (pas `[]`) pendant le chargement des réglages — même patron que
  // useDeficitVolumeAlert/useMostRecentRecord (évite un scintillement masqué→affiché).
  const pillars = settings?.activePillars ?? [...PILLARS];
  const active = pillars.includes('strength') && pillars.includes('nutrition');

  // Muscu : une ligne par séance terminée (LEFT JOIN → séances sans série comptées, tonnage 0).
  const sql = `
    SELECT w.id AS workout_id, w.finished_at AS finished_at,
           COALESCE(SUM(CASE WHEN s.done = 1 AND s.set_type <> 'warmup'
                              AND s.reps IS NOT NULL AND s.weight_kg IS NOT NULL
                         THEN s.reps * s.weight_kg ELSE 0 END), 0) AS tonnage
    FROM workouts w
    LEFT JOIN workout_sets s ON s.workout_id = w.id AND s.deleted_at IS NULL
    WHERE w.status = 'completed' AND w.deleted_at IS NULL AND w.finished_at >= ?
    GROUP BY w.id, w.finished_at
  `;
  const { data: workoutRows, isLoading: wLoading } = useQuery<{
    workout_id: string; finished_at: string; tonnage: number | null;
  }>(sql, [oldestIsoUtc]);

  const { totals, isLoading: nLoading } = useDailyTotals(oldestDayKey);

  const isLoading = wLoading || nLoading;

  const weeks = active
    ? computeWeeklyTrainingNutrition({
        weekStarts,
        workouts: workoutRows.map((r) => ({
          dayKey: localDayKey(new Date(r.finished_at)),
          tonnage: r.tonnage ?? 0,
        })),
        dailyKcals: totals.map((d) => ({ dayKey: d.logDate, kcal: d.kcal, proteinG: d.proteinG })),
      })
    : [];

  return { weeks, isLoading };
}
```

> Vérifier le nom exact du hook/valeur pour lire `activePillars` dans ce repo (aligner sur l'existant :
> `useMostRecentRecord` lit `settings?.activePillars`). Ne PAS `return` avant les `useQuery`/`useDailyTotals`.

- [ ] **Step 3 — Vérifier** : `npm run typecheck --workspace @wellness/mobile` → vert.
- [ ] **Step 4 — Commit** : `git commit -m "feat(mobile): hook useTrainingNutritionCross (agrégat 8 sem + gating)"`.

---

## Task 3 : composant `TrainingNutritionCrossCard`

**Files:** Create `apps/mobile/src/components/TrainingNutritionCrossCard.tsx`.

Comportement :
- `isLoading` → `ActivityIndicator` (patron des autres sections `/progress`, `nutrition-stats`).
- `weeks.length === 0` → **`return null`** (gating KO : un pilier inactif).
- `weeks.every((w) => w.sessions === 0 && w.avgKcal == null)` → **empty state en texte simple** (piliers
  actifs mais aucune donnée sur 8 sem) : un `Text` avec `t('stats.cross.empty')` (⚠️ **ne pas** utiliser
  le composant `EmptyState` : il exige `icon` + `title` obligatoires → clés/icône en plus, inutile ici).
- sinon → `Card` avec titre `t('stats.cross.title')` + tableau.

Détails tableau :
- En-têtes : `t('stats.cross.col.week')` | `.sessions` | `.tonnage` | `.kcal` | `.protein`.
- Une ligne par semaine (récente en haut, **mise en avant** : fond `surfaceAlt` ou libellé « Cette
  semaine » = `t('stats.cross.thisWeek')` sur la 1ʳᵉ ligne ; sinon plage `JJ/MM–JJ/MM` calculée depuis
  `weekStart`).
- **Tonnage** via `useUnits` (`toWeightValue` + `weightSymbol`) ; `null` → « — ».
- **kcal/j**, **Prot/j** : nombre ou « — » si `null`.
- **Mini-tendance** : monter `<DeltaBadge change={w.tonnageChange} />` **uniquement si** `w.tonnageChange
  != null` ; idem `w.kcalChange`. (DeltaBadge est purement présentiel — le parent décide de le monter.)
- Lisibilité thème clair/sombre (couleurs via `useTheme`) ; pas de scroll horizontal (colonnes
  compactes, valeurs courtes) ; défilement vertical = celui de l'écran.

Le composant lit lui-même le hook : `const { weeks, isLoading } = useTrainingNutritionCross();` (aucune
prop de données) — cohérent avec les autres cartes auto-portantes.

- [ ] **Step 1** — Écrire le composant (helper local `weekRangeLabel(weekStart)` → `JJ/MM–JJ/MM` en
  ajoutant 6 jours via `new Date`, purement pour l'affichage).
- [ ] **Step 2 — Vérifier** : `npm run typecheck --workspace @wellness/mobile` → vert.
- [ ] **Step 3 — Commit** : `git commit -m "feat(mobile): TrainingNutritionCrossCard — tableau croisé 8 sem"`.

---

## Task 4 : câblage dans `nutrition-stats.tsx`

**Files:** Modify `apps/mobile/src/app/nutrition-stats.tsx`.

- [ ] **Step 1** — Importer `TrainingNutritionCrossCard` et l'insérer **après la carte « Apports moyens »**
  (fin du `ScrollView`, avant la fermeture). Aucune donnée à passer (auto-portant). Ne rien changer
  d'autre.
- [ ] **Step 2 — Vérifier** : `npm run typecheck --workspace @wellness/mobile` + `npm run lint` → vert.
- [ ] **Step 3 — Commit** : `git commit -m "feat(mobile): section vue croisée sur Nutrition -> Stats (MN-03)"`.

---

## Task 5 : i18n (FR + EN, parité)

**Files:** Modify `apps/mobile/src/i18n/locales/fr.json` + `en.json`.

- [ ] **Step 1** — Ajouter le namespace `stats.cross` (mêmes sous-clés des deux côtés) :
  - FR : `title` = « Charge muscu & apports (8 sem) » ; `thisWeek` = « Cette semaine » ;
    `empty` = « Enregistre des séances et des repas pour voir le croisement charge / apports. » ;
    `col`: `week` = « Semaine », `sessions` = « Séances », `tonnage` = « Tonnage », `kcal` = « kcal/j »,
    `protein` = « Prot/j ».
  - EN (miroir) : `title` = « Training load & intake (8 wk) » ; `thisWeek` = « This week » ;
    `empty` = « Log workouts and meals to see the load vs intake cross-view. » ;
    `col`: `week` = « Week », `sessions` = « Sessions », `tonnage` = « Tonnage », `kcal` = « kcal/day »,
    `protein` = « Prot/day ».
- [ ] **Step 2 — Vérifier parité** (⚠️ pas de test automatique de parité dans le repo) : diff manuel des
  deux fichiers sur `stats.cross.*` — mêmes clés des deux côtés, aucune orpheline.
- [ ] **Step 3 — Commit** : `git commit -m "i18n: stats.cross (FR/EN) — vue croisée MN-03"`.

---

## Task 6 : clôture (catalogue + vérification d'ensemble)

**Files:** Modify `docs/product/analyses-donnees.md`.

- [ ] **Step 1** — MN-03 : statut ⏳ → ✅ ; description « (livrée) » ; retirer MN-03 de la note « à démarrer »
  si présente.
- [ ] **Step 2 — Vérifs globales** : `npm run test --workspace @wellness/shared` (dont
  `training-nutrition` — ⚠️ **pas** `npm run test` racine : le workspace mobile lance `jest` non câblé →
  faux échec sans lien MN-03) ; `npm run typecheck` ; `npm run lint` — tous verts.
- [ ] **Step 3 — Relire le diff** : gating « les deux piliers » (hook renvoie `[]` → composant `null`) ;
  `DeltaBadge` monté seulement si `change != null` ; cellules « — » ; empty state ; unités `useUnits` ;
  aucune chaîne en dur ; parité FR/EN.
- [ ] **Step 4 — Commit** : `git commit -m "docs(mn03): catalogue MN-03 livrée + clôture"`.

---

## Notes

- **Gate CLAUDE.md** : spec validée ; plan à valider. **Maquette écartée** (tableau simple réutilisant
  `Card`, précédents 4.32/8.5) — à confirmer à la validation. Code autorisé après validation.
- **Décision hook** : placé dans `records-repository.ts` (réutilise `startOfWeekLocalUtc`/patrons hebdo)
  plutôt qu'un nouveau `cross-repository.ts` — évite d'exporter/dupliquer le helper de bornes.
- **Pièges (issus de la revue de spec)** : borne muscu = **ISO UTC minuit local** (pas `date.ts`
  `startOfWeek`) ; borne nutrition = **dayKey** (pas ISO) pour `useDailyTotals` ; bucketing **sans
  `weekEnd`** ; **gating au retour** (règle des hooks) ; séances via **LEFT JOIN**.
- **Reste checkpoint recette (Florian)** : valeurs/tendances sur données réelles, cellules « — »,
  empty state, gating en (dés)activant un pilier. **Pas de checkpoint 🔴** (100 % client/offline).
- **YAGNI** : pas de score de corrélation, pas de macros G/L, pas de sélecteur de fenêtre, pas d'export,
  pas d'IA, pas d'alerte (reste 4.32).
