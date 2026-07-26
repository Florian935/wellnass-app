---
id: META-06
titre: "Comparaison période N vs N-1 (delta)"
roadmap: []
catalogue: [META-06]
etape: close
branche: feature/meta06-comparaison-periode
maj: 15/07/2026
---
# US META-06 — Comparaison période N vs N-1 (delta)

_Spec fonctionnelle. Statut : validée (brainstorming Florian, 15/07/2026). Branche :
`feature/meta06-comparaison-periode` (depuis `dev`). Catalogue : **META-06** — brique transverse,
Phase A (déterministe, offline)._

## 1. Contexte & objectif

Les écrans de stats affichent des agrégats de la **période courante** (distance/temps/nb de sorties,
apports moyens, volume muscu) mais **sans point de comparaison**. META-06 ajoute, à côté de chaque
agrégat, un **écart vs la période précédente** (« +12 % », flèche ↑/↓/→), pour rendre la tendance
lisible d'un coup d'œil.

Les agrégats existent déjà, **purs et testés** (`aggregateRunStats`, `averageIntake`, volume muscu) :
META-06 les rappelle une 2ᵉ fois sur la fenêtre précédente et calcule l'écart. Livré sur **les 3
piliers**. **100 % client, offline, gratuit, sans IA.**

## 2. Périmètre

- **Inclus** : brique pure `percentChange` + helper `previousPeriodTodayKey` (shared, testés) ;
  composant d'affichage `DeltaBadge` (mobile) ; branchement sur **3 surfaces** (running historique,
  nutrition apports moyens, muscu volume hebdo) ; i18n FR/EN.
- **Exclu** : delta par **macro** (nutrition : **kcal uniquement** en v1) ; delta sur le dénivelé
  (absent du modèle) ; delta d'allure moyenne (l'allure a déjà sa propre tendance `paceTrend`) ;
  comparaison multi-périodes / graphique de tendance (META-08+, séparés) ; toute migration.
- **Ton** : **neutre / directionnel** — flèche + %, couleur **accent**, **sans jugement** bon/mauvais
  (une semaine de décharge n'est pas « mauvaise »). Décision Florian.
- **Maquette** : **écartée** (une ligne de delta ajoutée à des blocs existants + 1 petit composant).

## 3. Brique de comparaison — `percentChange` (pure, testée)

Dans un nouveau module shared `comparison.ts` :

```ts
export type DeltaDirection = 'up' | 'down' | 'flat';
export type PercentChange = { pct: number | null; direction: DeltaDirection };

/** Ecart relatif de `current` vs `previous`. */
export function percentChange(current: number, previous: number): PercentChange;
```

Règles :
- `direction` : `current > previous` → `'up'` ; `current < previous` → `'down'` ; égalité → `'flat'`.
- `pct` : `previous === 0` → **`null`** (cas « nouveau » / pas de base de comparaison, jamais +∞ ni
  division par zéro) ; sinon `Math.round(((current - previous) / previous) * 100)`.
- `previous === 0 && current === 0` → `{ pct: null, direction: 'flat' }`.

## 4. Fenêtre précédente — `previousPeriodTodayKey` (pure, testée)

Pour réutiliser `aggregateRunStats(runs, period, todayKey)` (période `'week' | 'month' | 'all'`)
sur la fenêtre précédente, dériver la **clé de jour** représentant la période N-1 :

```ts
import type { StatPeriod } from './run-stats';
/** Clé de jour representant la periode precedente ; null si non comparable ('all'). */
export function previousPeriodTodayKey(todayKey: string, period: StatPeriod): string | null;
```

- `'week'` → clé du jour à **−7 j**.
- `'month'` → une date **du mois précédent** (veille du 1ᵉʳ du mois courant).
- `'all'` → **`null`** (pas de période précédente → pas de delta).

⚠️ **`addDays(d: Date, n)` de `date.ts` opère sur un `Date`, pas sur une clé string.** Donc :
parser `todayKey` en `Date` (motif de `periodStartKey`, `run-stats.ts:16-17`), appliquer `addDays`,
re-sérialiser via `localDayKey`. Pour `month` : ramener au 1ᵉʳ du mois (`Date` avec `setDate(1)` ou
équivalent) puis `addDays(-1)` → clé du dernier jour du mois précédent. Tests : semaine −7 j, mois
précédent, **passage d'année**, `all` → null.

## 5. Composant `DeltaBadge` (mobile)

`apps/mobile/src/components/DeltaBadge.tsx` — réutilisable sur les 3 écrans.

- Props : `{ change: PercentChange }` (ou `current`/`previous` + calcul interne — au choix de l'impl,
  mais la logique de calcul reste dans `percentChange`).
- Rendu : flèche (`↑` up / `↓` down / `→` flat, via Ionicons `arrow-up/down/forward` ou caractères) +
  libellé. `pct != null` → « {signe}{|pct|} % » ; `pct === null` → i18n « nouveau » (ou « — »).
- Couleur **accent** (pas de vert/rouge). Accessibilité : `accessibilityLabel` explicite.
- Rendu `null` (rien) si non pertinent (ex. période `all` → le parent ne monte pas le badge).

## 6. Surfaces

### 6.1 Running — `running-history/index.tsx` (`StatsSection`)
- Sélecteur `week/month/all` **déjà présent**. Sous chaque chip (distance, temps, nb sorties), afficher
  un `DeltaBadge` « vs période précédente ».
- ⚠️ **`StatsSection` n'a pas de props** : il tient son `period` en état local et appelle
  `useRunStats(period)` en interne ; `useRunStats` **n'expose ni les runs ni un `todayKey`
  paramétrable**, et le mapping `toStatRun` est **privé**. → Ajouter dans `run-repository.ts` un hook
  **`useRunStatsAt(period, todayKey)`** (réutilise `useRunHistory` + `toStatRun` + `aggregateRunStats`)
  et l'appeler dans `StatsSection` avec `todayKey` courant et `prevKey`.
- Période courante : `useRunStatsAt(period, todayKey)`. Précédente :
  `prevKey = previousPeriodTodayKey(todayKey, period)` ; `prevKey === null` (`all`) → **pas de badge** ;
  sinon `useRunStatsAt(period, prevKey)`. (Le hook courant peut rester `useRunStats(period)` existant ;
  seul le précédent nécessite le hook paramétré — ou basculer les deux sur `useRunStatsAt` pour
  cohérence.)
- Delta par métrique : distance (`totalDistanceM`), temps (`totalDurationS`), nb (`count`).

### 6.2 Nutrition — `nutrition-stats.tsx` (carte « apports moyens »)
- Sélecteur `7d/30d` déjà présent (`INTAKE_RANGES`). Delta **kcal** vs fenêtre précédente.
- Récupérer **2N jours** (`useDailyTotals(daysAgo(2N))`), couper en deux par `dayKey` :
  courant = N derniers jours, précédent = N jours d'avant. `averageIntake` sur chaque moitié →
  `percentChange(kcalCourant, kcalPrécédent)`. `DeltaBadge` sous le gros chiffre kcal.
- Fenêtre précédente vide (0 jour loggé) → `previous = 0` → badge « nouveau ».
- ⚠️ `useDailyTotals` renvoie des totaux **épars** (jours loggés seulement) ; `averageIntake` moyenne
  sur les **jours loggés** de chaque moitié (pas sur N). C'est cohérent avec la sémantique existante
  (« apports moyens »). `daysAgo`/`isoDay` sont **locaux** à `nutrition-stats.tsx` (pas partagés) —
  utilisables sur place. Le découpage courant/précédent se fait par comparaison de `logDate`.

### 6.3 Muscu — `progress/index.tsx` (section volume hebdo)
- ⚠️ Aujourd'hui `WeeklyVolumeSection` affiche le volume **par muscle** (histogramme) ; **aucun total
  agrégé n'existe**. Il faut donc créer **le total courant ET le total précédent**.
- Nouveau hook (records-repository), ex. `useWeeklyVolumeComparison()` → `{ current, previous, isLoading }` :
  deux `SELECT SUM(s.reps * s.weight_kg)` (sans `GROUP BY`), l'un borné `finished_at >= débutSemaine`,
  l'autre borné `[débutSemaine−7j, débutSemaine)` — **ajouter la borne haute** (la requête volume
  actuelle n'a que la borne basse). `startOfWeekLocalUtc()` est **privé** à ce fichier et renvoie une
  **string ISO** de la semaine courante : le hook vit donc **dans `records-repository.ts`** ; dériver
  la borne −7 j via un `Date` (pas d'`addDays` sur la string). `DeltaBadge` « vs semaine précédente »
  sous le total, dans `WeeklyVolumeSection`.

## 7. Cas limites

- Période précédente sans données → `previous = 0` → badge « nouveau » (pas de %). 
- `all` (running) → pas de badge.
- Données courante et précédente nulles → « — » / flat.
- **Offline** : tout local (SQLite) ; `isLoading` géré (ne pas afficher un delta faux pendant le
  chargement de la fenêtre précédente).
- Arrondi : `pct` entier. Pas de NaN (garde `previous === 0`).

## 8. i18n (FR + EN, parité)

Namespace commun (ex. `common.delta` ou `stats.delta`) :
- libellé « nouveau » (FR « nouveau » / EN « new »), format « vs période précédente » /
  « vs semaine précédente » selon la surface, `accessibilityLabel` de tendance (hausse/baisse/stable).
Aucune chaîne en dur.

## 9. Tests

- **Shared (Vitest)** : `percentChange` (up/down/flat, `previous=0` → null, 0/0 → flat, arrondi) ;
  `previousPeriodTodayKey` (week -7 j, mois précédent, passage d'année, `all` → null).
- **Mobile** : typecheck/lint verts ; rendu des badges vérifié à la recette device (3 surfaces).

## 10. Definition of Done

- Sur les **3 surfaces**, un delta « vs période précédente » (neutre, flèche + %) s'affiche à côté des
  agrégats ; « nouveau » quand pas de base ; pas de badge sur `all` (running).
- Brique `percentChange` + `previousPeriodTodayKey` pures et testées ; `DeltaBadge` mutualisé ; i18n
  FR/EN à parité ; typecheck/lint/tests verts. **Pas de migration, pas de checkpoint 🔴** (100 % client).
- Catalogue **META-06 → ✅**. Reste **recette device** (Florian) : 3 surfaces × périodes, cas « nouveau »,
  non-régression des agrégats affichés.
