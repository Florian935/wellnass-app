# Plan — MR-14 · Jours consécutifs sans repos

Spec : [mr14-jours-consecutifs-sans-repos.md](../specs/functional/us/mr14-jours-consecutifs-sans-repos.md) ·
branche `feature/mr14-jours-consecutifs-sans-repos` · **aucune ligne roadmap** (US d'analyse,
catalogue seul).

✅ Décision D1 arbitrée par Florian le 04/08/2026 (MR-14 masquée si TRI-12 actif) — implémentation
ci-dessous conforme.

## Étape 1 — La fonction pure, testée d'abord *(≈ 30 min)*

`packages/shared/src/training-time.ts` — juste après `computeOvertrainingGuard` (§TRI-12), même
fichier : réutilise directement `OVERTRAINING_LOAD_STREAK_DAYS` (constante de module déjà
présente), aucun nouveau seuil.

```ts
export type LoadStreakAlert = { show: boolean; streakDays: number };

/**
 * Alerte streak de charge seule (US MR-14, spec R2) — réutilise le seuil déjà établi par TRI-12
 * (`OVERTRAINING_LOAD_STREAK_DAYS`), pas un nouveau chiffre. Contrairement à
 * `computeOvertrainingGuard`, ne regarde aucune donnée nutrition (spec R4) — le streak seul
 * suffit à motiver l'alerte.
 */
export function computeLoadStreakAlert(streakDays: number): LoadStreakAlert {
  return { show: streakDays >= OVERTRAINING_LOAD_STREAK_DAYS, streakDays };
}
```

**Tests, écrits d'abord** :
- `computeLoadStreakAlert(5)` → `{ show: false, streakDays: 5 }` (sous le seuil).
- `computeLoadStreakAlert(6)` → `{ show: true, streakDays: 6 }` (borne incluse, spec R2 — même
  discipline que `>=` déjà utilisé par `computeOvertrainingGuard`).
- `computeLoadStreakAlert(10)` → `{ show: true, streakDays: 10 }` (au-dessus).
- `computeLoadStreakAlert(0)` → `{ show: false, streakDays: 0 }` (compte neuf, aucun historique).

## Étape 2 — Le hook + le widget *(≈ 1 h 15)*

`apps/mobile/src/data/repositories/dashboard-repository.ts` — `useLoadStreakAlert()`, juste après
`useOvertrainingGuardAlert` (même famille de widgets Tier 2) :

- Gating `['strength', 'running']` — retour anticipé `{ show: false, streakDays: 0 }` hors
  gating, hooks sous-jacents appelés inconditionnellement (règle des hooks React).
- **Calcul du streak dupliqué**, pas partagé (spec §3/§5 — ne pas toucher
  `useOvertrainingGuardAlert`, US TRI-12 déjà en attente de recette device) : même bloc que celui
  déjà écrit pour TRI-12 (`useWorkoutHistory()` + `useRunHistory()`, filtrées par
  `LOAD_STREAK_LOOKBACK_DAYS`, `loadByDay` via `sessionLoad`, `chargeDays` = jours à charge > 0,
  `computeStreak(chargeDays, todayKey).current`).
- **Condition D1** : si `useOvertrainingGuardAlert().show` est vrai, retourner
  `{ show: false, streakDays }` (le streak reste renseigné pour un éventuel usage futur, mais
  `show` est forcé à `false` — évite le double signal).
- Délégation à `computeLoadStreakAlert(streakDays)`, puis application de D1 par-dessus.

`apps/mobile/src/components/dashboard/LoadStreakAlertCard.tsx` (nouveau) — calque structurel de
`OvertrainingGuardCard.tsx` (`tone="warn"`, ⚠️) :
- `if (!alert.show) return null;`
- `title` interpolé : `t('home.loadStreakAlert.title', { days: alert.streakDays })`.
- 3 formes (small/wide/large), bloc `accessible` unique par forme.

`packages/shared/src/widgets.ts` :
- `'load-streak-alert'` ajouté **en fin** de `HOME_WIDGET_IDS` (20 → 21).
- `WIDGET_REGISTRY.home.pillars['load-streak-alert'] = ['strength', 'running']`.

`apps/mobile/src/components/dashboard/dashboard-widgets.tsx` : entrée `WIDGET_COMPONENTS`.

`apps/mobile/src/app/(tabs)/index.tsx` : `isWidgetActive` — ajouter
`loadStreakAlertActive = useLoadStreakAlert().show` et la branche correspondante, **dans ce même
incrément** (défaut déjà rencontré 4 fois cette session).

`apps/mobile/src/i18n/locales/{fr,en}.json` : famille `home.loadStreakAlert.*` (eyebrow, title,
message, recommend — 4 clés).

**Tests `widgets.test.ts` à mettre à jour** (même piège que toutes les US widgets précédentes) :
`HOME_WIDGET_IDS` → 21, `defaultScreenLayout('home')` → 21, scénarios `resolveScreenLayout` avec
`strength`+`running` actifs → +1.

**Smoke test du widget** (`LoadStreakAlertCard.test.tsx`, nouveau, écrit dès l'implémentation) :
`show: false` → `null` rendu ; `show: true` avec un `streakDays` donné → titre interpolé présent,
message + recommend en forme large, pas de crash.

## Étape 3 — Catalogue & solde *(≈ 20 min)*

- `docs/product/analyses-donnees.md` : MR-14 🆕 → statut réel selon l'avancement au moment du
  commit, avec la note « pas une absorption de/par TRI-12 » (§0 de la spec) pour que la
  distinction survive à une future relecture du catalogue.
- **Pas de ligne roadmap** (front-matter `roadmap: []`).
- CHANGELOG + `etat.mjs` via `/commit`.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `packages/shared/src/training-time.ts` (+ `.test.ts`) | `computeLoadStreakAlert` |
| `apps/mobile/src/data/repositories/dashboard-repository.ts` | `useLoadStreakAlert` |
| `apps/mobile/src/components/dashboard/LoadStreakAlertCard.tsx` (nouveau) | widget conditionnel Tier 2 |
| `apps/mobile/src/components/dashboard/__tests__/LoadStreakAlertCard.test.tsx` (nouveau) | smoke test |
| `apps/mobile/src/components/dashboard/dashboard-widgets.tsx` | enregistrement `WIDGET_COMPONENTS` |
| `apps/mobile/src/app/(tabs)/index.tsx` | `isWidgetActive` — nouvelle branche |
| `packages/shared/src/widgets.ts` (+ `.test.ts`) | `'load-streak-alert'` dans `HOME_WIDGET_IDS`/`WIDGET_REGISTRY` |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | famille `home.loadStreakAlert.*` (4 clés) |
| `docs/product/analyses-donnees.md` | MR-14 🆕 → statut réel |

**`useOvertrainingGuardAlert` (TRI-12) : lu, jamais modifié** — voir spec §5, décision explicite
de ne pas y toucher malgré la duplication de calcul (US déjà en attente de recette device).

## Migration / sync rules

**Aucune.** Données déjà en base (`workouts`, `runs`), calcul pur en lecture seule.

## Dépendances

Aucun paquet nouveau → **recettable sur l'APK existant**.

## Risques

- 🔴 **D1 non arbitrée change le comportement** : sans le masquage mutuel, un utilisateur 3
  piliers en déficit persistant verrait DEUX cartes sur le même symptôme — ne pas coder avant
  l'arbitrage.
- 🟠 **Duplication acceptée, pas un oubli** : le bloc de calcul du streak existe maintenant à deux
  endroits (TRI-12 et MR-14). Si le seuil ou la formule de `sessionLoad` change un jour, il faudra
  penser à mettre à jour les deux — accepté explicitement (spec §3/§5) plutôt que de risquer un
  refactor de code déjà en attente de recette device.
- 🟠 **`isWidgetActive` oublié** : risque déjà matérialisé 4 fois cette session — traité dans
  l'étape 2 elle-même, pas laissé à la revue.
- 🟢 **Aucun risque de ricochet sur TRI-12** : son code n'est touché nulle part, seule sa valeur
  `.show` est lue en lecture seule.
