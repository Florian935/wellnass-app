# META-09 — Lissage des courbes par moyenne mobile · Plan d'implémentation

> **Pour l'exécutant :** SOUS-SKILL REQUISE — `superpowers:subagent-driven-development`, une tâche à la
> fois, **TDD**, commits fréquents. Étapes en cases à cocher (`- [ ]`).

**Goal :** superposer une **moyenne mobile centrée** (lissé accentué) sur les courbes brutes (estompées)
de poids, apports kcal, allure et progression muscu, via une brique pure + une prop `smooth` sur le
composant de graphe.

**Spec :** [docs/specs/functional/us/meta09-lissage-courbes.md](../specs/functional/us/meta09-lissage-courbes.md).
**Maquette :** [design/meta09-lissage-courbes/meta09-lissage-courbes.html](../../design/meta09-lissage-courbes/meta09-lissage-courbes.html).

**Architecture :** `moving-average.ts` (shared, pur : `movingAverage`) → `ProgressLineChart` gagne une
prop `smooth` (fenêtre auto côté composant, overlay `data` brut + `data2` lissé via la brique) →
activation sur 4 écrans. Aucune migration, aucune donnée nouvelle, 100 % offline.

**Tech :** TypeScript, Vitest (`packages/shared`), Expo/RN, `react-native-gifted-charts`.

**Ordre & dépendances :** 1 (brique) → 2 (composant, dépend de 1) → 3 (4 écrans + smoke, dépend de 2)
→ 4 (catalogue + clôture).

---

### Task 1 : Brique `movingAverage` (shared, pur)

**Files :**
- Create : `packages/shared/src/moving-average.ts`
- Create : `packages/shared/src/moving-average.test.ts`
- Modify : `packages/shared/src/index.ts` (ajouter `export * from './moving-average';`)

- [ ] **Step 1 — Tests qui échouent** (`moving-average.test.ts`) :

```ts
import { describe, it, expect } from 'vitest';
import { movingAverage } from './moving-average';

describe('movingAverage', () => {
  it('fenêtre 3, centrée, bords rétrécis', () => {
    // [80,79,81,78,80] :
    // i0 (bord) = (80+79)/2 = 79.5 ; i1 = (80+79+81)/3 = 80 ; i2 = (79+81+78)/3 = 79.333…
    // i3 = (81+78+80)/3 = 79.666… ; i4 (bord) = (78+80)/2 = 79
    const out = movingAverage([80, 79, 81, 78, 80], 3);
    expect(out).toHaveLength(5);
    expect(out[0]).toBeCloseTo(79.5, 10);
    expect(out[1]).toBeCloseTo(80, 10);
    expect(out[2]).toBeCloseTo((79 + 81 + 78) / 3, 10);
    expect(out[3]).toBeCloseTo((81 + 78 + 80) / 3, 10);
    expect(out[4]).toBeCloseTo(79, 10);
  });

  it('fenêtre 5 (h=2), centre sur 5 points, bords rétrécis', () => {
    const v = [10, 12, 14, 16, 18];
    const out = movingAverage(v, 5);
    // i0 = moy(10,12,14)=12 ; i1 = moy(10,12,14,16)=13 ; i2 = moy(10..18)=14
    // i3 = moy(12,14,16,18)=15 ; i4 = moy(14,16,18)=16
    expect(out).toEqual([12, 13, 14, 15, 16]);
  });

  it('série constante → identique', () => {
    expect(movingAverage([5, 5, 5, 5], 3)).toEqual([5, 5, 5, 5]);
  });

  it('window ≤ 1 → copie', () => {
    expect(movingAverage([3, 1, 4], 1)).toEqual([3, 1, 4]);
    expect(movingAverage([3, 1, 4], 0)).toEqual([3, 1, 4]);
  });

  it('length < 2 → copie', () => {
    expect(movingAverage([42], 3)).toEqual([42]);
    expect(movingAverage([], 3)).toEqual([]);
  });

  it('renvoie une COPIE (pas la même référence)', () => {
    const input = [1, 2];
    expect(movingAverage(input, 1)).not.toBe(input);
  });

  it('fenêtre paire (4) → h=2, fenêtre effective 5', () => {
    // même résultat que window 5 (h = floor(4/2) = 2)
    expect(movingAverage([10, 12, 14, 16, 18], 4)).toEqual([12, 13, 14, 15, 16]);
  });
});
```

- [ ] **Step 2 — Échec.** `npm run test -w @wellness/shared` → FAIL (module introuvable).

- [ ] **Step 3 — Implémenter** `moving-average.ts` (JSDoc FR, style du repo, cf. `regression.ts`) :

```ts
/**
 * Moyenne mobile centrée (fenêtre en points). Débruite une série pour en lire la tendance
 * de fond. Brique socle (META-09) ; réutilisée par les courbes et les projections futures.
 */

/**
 * Lisse `values` par moyenne mobile **centrée** de taille `window` (en points).
 * - Centrée : chaque point = moyenne de `[i - h, i + h]`, `h = floor(window / 2)`.
 * - Bords : fenêtre **rétrécie** aux voisins disponibles (chaque point reçoit une valeur).
 * - `window <= 1` ou `values.length < 2` → **copie** de `values` (aucun lissage).
 * Sortie de **même longueur** que l'entrée.
 */
export function movingAverage(values: ReadonlyArray<number>, window: number): number[] {
  const n = values.length;
  if (window <= 1 || n < 2) return values.slice();

  const h = Math.floor(window / 2);
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - h);
    const hi = Math.min(n - 1, i + h);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += values[j]!;
    out[i] = sum / (hi - lo + 1);
  }
  return out;
}
```

- [ ] **Step 4 — Succès.** `npm run test -w @wellness/shared` → PASS. Puis `npm run typecheck`.
- [ ] **Step 5 — Commit.** `feat(shared): movingAverage (moyenne mobile centrée) — META-09`

---

### Task 2 : Overlay `smooth` dans `ProgressLineChart`

**Files :**
- Modify : `apps/mobile/src/components/charts/ProgressLineChart.tsx`
- Modify : `apps/mobile/src/components/charts/__tests__/charts-smoke.test.tsx`

**Contexte composant** : `ProgressLineChart` (présentationnel) rend un `LineChart` de
`react-native-gifted-charts` à partir d'une seule série `data: { label; value }[]`. Props actuelles :
`data, title, unit, width, formatYLabel`. L'axe Y formaté (allure) passe par `buildPaceYAxis(chartData.map(d => d.value), …)` — **calculé sur le brut**, à garder tel quel (le lissé est borné par [min,max] du brut).

- [ ] **Step 1 — Vérifier l'API gifted-charts installée.** Avant de coder, ouvrir la version installée
  de `react-native-gifted-charts` (dans `node_modules`, ou la doc de la version du `package.json`) et
  confirmer les props d'une **2ᵉ série partageant le même axe Y** : `data2`, `color1`/`color2`,
  `dataPointsColor1`/`dataPointsColor2`, et le pilotage du **remplissage par série**
  (`areaChart1`/`areaChart2` avec résolution `areaChartN ?? areaChart`, `startFillColor2`/`endFillColor2`).
  ⚠️ **Ne pas** utiliser `secondaryData` (= axe Y séparé). Adapter les noms de props ci-dessous à ce que
  la version expose réellement ; l'**intention** prime : **brut estompé sans zone + lissé accentué avec
  zone, même axe**. Si l'API diffère franchement de l'hypothèse, reporter en DONE_WITH_CONCERNS.

- [ ] **Step 2 — Étendre le smoke test** (`charts-smoke.test.tsx`) — cas `smooth` :

```tsx
it('rend avec smooth sur une série longue (≥ 4 points)', async () => {
  // ⚠️ `sampleData` du fichier n'a que 3 points → série locale ≥ 4 points ici.
  const longData = [
    { label: 'L', value: 80 }, { label: 'Ma', value: 79 }, { label: 'Me', value: 81 },
    { label: 'J', value: 78 }, { label: 'V', value: 80 }, { label: 'S', value: 79 },
  ];
  const { getByTestId } = await render(
    <ProgressLineChart data={longData} title="Poids" unit="kg" smooth />,
  );
  expect(getByTestId('line-chart')).toBeTruthy();
});

it('rend avec smooth sur une série courte (< 4 points) sans crash', async () => {
  const short = [
    { label: 'L', value: 80 },
    { label: 'M', value: 81 },
  ];
  const { getByTestId } = await render(<ProgressLineChart data={short} smooth />);
  expect(getByTestId('line-chart')).toBeTruthy();
});
```
> Le mock `LineChart` du fichier renvoie le `testID` quelles que soient les props → ces tests valident
> juste l'absence de crash au montage (série lissée ET repli brut seul).

- [ ] **Step 3 — Échec.** `npm run test -w @wellness/mobile` (ou la commande de test mobile du repo) →
  le nouveau cas `smooth` échoue tant que la prop n'existe pas (ou passe si TS l'ignore — dans ce cas le
  vrai garde-fou est le typecheck de Step 5). Lancer au moins pour référence.

- [ ] **Step 4 — Implémenter la prop `smooth`** dans `ProgressLineChart.tsx` :
  - Ajouter à `ProgressLineChartProps` : `smooth?: boolean;` (JSDoc FR : overlay brut + lissé, opt-in).
  - Après le calcul de `chartData`, ajouter :

```ts
import { movingAverage } from '@wellness/shared';

/** Fenêtre de lissage auto : impaire, bornée [3,7], selon la longueur de série. */
function autoSmoothWindow(length: number): number {
  const rounded = Math.round(length / 5);
  const odd = rounded % 2 === 1 ? rounded : rounded + 1;
  return Math.min(7, Math.max(3, odd));
}
```

  - Dans le composant :

```ts
const canSmooth = smooth === true && chartData.length >= 4;
const smoothedData = canSmooth
  ? movingAverage(chartData.map((d) => d.value), autoSmoothWindow(chartData.length)).map((value, i) => ({
      value,
      label: chartData[i]!.label,
    }))
  : null;
```

  - Rendu `LineChart` :
    - **Sans lissage** (`smoothedData === null`) → **exactement** le rendu actuel (ne rien changer).
    - **Avec lissage** → passer `data={chartData}` (brut) **et** `data2={smoothedData}` (lissé), avec :
      - **brut estompé** : `color1={colors.textMuted}`, `dataPointsColor1={colors.textMuted}`, opacité
        réduite si dispo, **pas** de remplissage (`areaChart1={false}` — ou l'équivalent de la version) ;
      - **lissé accentué** : `color2={colors.accent}`, remplissage porté par la série 2
        (`startFillColor2={colors.accent}`, `endFillColor2={colors.surface}`, `startOpacity2`/`endOpacity2`
        comme les valeurs actuelles) ;
      - ℹ️ `curved` est un réglage **global** du `LineChart` (pas de `curved1`/`curved2`) : les deux
        séries sont courbées, comme le brut l'est déjà aujourd'hui → aucune régression, ne pas chercher
        à le rendre par-série ;
      - conserver `yAxis` (imposé) inchangé, calculé sur le brut.
  - **Adapter précisément** les noms de props au résultat du Step 1. Garder le rendu **rétrocompatible**
    quand `smooth` est absent/false.
  - Factoriser proprement (éviter deux blocs `<LineChart>` quasi dupliqués : préférer un objet de props
    conditionnel étalé via `{...(smoothedData ? {…} : {})}`, comme le fait déjà `yAxis`).

- [ ] **Step 5 — Succès.** `npm run test -w @wellness/mobile` (smoke vert) + `npm run typecheck` +
  `npm run lint` verts.
- [ ] **Step 6 — Commit.** `feat(mobile): ProgressLineChart — overlay lissé (smooth) via movingAverage — META-09`

---

### Task 3 : Activer `smooth` sur les 4 courbes

**Files :**
- Modify : `apps/mobile/src/app/nutrition-stats.tsx` (l.100 poids, l.123 kcal)
- Modify : `apps/mobile/src/app/running-history/index.tsx` (l.256 allure)
- Modify : `apps/mobile/src/app/progress/index.tsx` (l.418 muscu)

- [ ] **Step 1 — Ajouter `smooth`** à chaque appel `ProgressLineChart` (aucune autre logique modifiée) :
  - `nutrition-stats.tsx:100` : `<ProgressLineChart data={weightData} unit={units.weightSymbol} smooth />`
  - `nutrition-stats.tsx:123` : `... <ProgressLineChart data={intakeData} unit={t('nutrition.kcal')} smooth /> ...`
  - `running-history/index.tsx:256` : ajouter `smooth` (conserver `formatYLabel`).
  - `progress/index.tsx:418` : ajouter `smooth`.
- [ ] **Step 2 — Vérifs.** `npm run typecheck` + `npm run lint` verts. (Rendu réel validé à la recette device.)
- [ ] **Step 3 — Commit.** `feat(mobile): active le lissé sur les courbes poids/kcal/allure/muscu — META-09`

---

### Task 4 : Catalogue + clôture

**Files :**
- Modify : `docs/product/analyses-donnees.md` (ligne META-09 + piste 8)

- [ ] **Step 1 — META-09 → ✅** dans le catalogue (statut `🆕` → `✅`, mention « brique `movingAverage`
  (shared) + prop `smooth` sur `ProgressLineChart`, overlay brut + lissé sur 4 courbes »). Barrer la
  **piste 8** dans « Pistes de priorisation » + mettre à jour la note de synthèse.
- [ ] **Step 2 — Vérifs globales.** À la racine : `npm run typecheck` + `npm run lint` + `npm run test`
  (tous workspaces) verts.
- [ ] **Step 3 — Revue finale** : sous-agent `superpowers:code-reviewer` (lecture seule) sur le diff de
  la branche vs `dev` — cibler : exactitude du lissage, rétrocompatibilité du composant, cohérence
  overlay/axe Y (allure), absence de régression sur les 4 écrans.
- [ ] **Step 4 — Clôture** via `superpowers:finishing-a-development-branch` + mise à jour CHANGELOG +
  TODO (ligne recette 🔴 META-09 : les 4 courbes, lissé cohérent + brut visible, pas de glitch d'axe).

---

## Definition of Done (rappel spec §10)

- `movingAverage` pure et testée, exportée depuis `@wellness/shared`.
- `ProgressLineChart` : prop `smooth` (overlay brut estompé + lissé accentué, fenêtre auto ≥ 4 points),
  **rétrocompatible** (off → rendu identique).
- `smooth` activé sur les **4 courbes**.
- **Aucune** migration, **pas de checkpoint 🔴** (100 % client, offline → reload Metro). i18n FR/EN
  seulement si une légende est ajoutée.
- typecheck / lint / tests verts ; catalogue **META-09 → ✅**. Reste **recette device** + relecture Damien.
