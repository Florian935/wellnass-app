# Plan — META-19 · Garde-fou surentraînement (ACWR combiné)

Spec : [meta19-acwr-garde-fou.md](../specs/functional/us/meta19-acwr-garde-fou.md) ·
branche `feature/meta19-acwr-garde-fou` · **catalogue seul, aucun numéro roadmap** (spec §0).

## Étape 1 — Le calcul, pur et testé *(≈ 1 h)*

`packages/shared/src/training-time.ts` (même fichier que `computeTrainingTime`, même famille —
charge combinée muscu+course) :

```ts
const ACUTE_WINDOW_DAYS = 7;
const CHRONIC_WINDOW_DAYS = 28;
const ACWR_SAFE_MAX = 1.3; // spec R4

/** Charge d'une séance (méthode session-RPE, Foster) : RPE × durée en minutes. 0 si l'un manque. */
sessionLoad(session: { rpe: number | null; durationSeconds: number | null }): number

computeAcwr(input: {
  acuteSessions: { rpe: number | null; durationSeconds: number | null }[];   // fenêtre 7 j déjà filtrée par l'appelant
  chronicSessions: { rpe: number | null; durationSeconds: number | null }[]; // fenêtre 28 j déjà filtrée par l'appelant
}): { ratio: number; showAlert: boolean } | null
```

- `null` si la charge chronique totale est nulle (spec R6 — pas de division par une base vide).
- Sinon `ratio = (Σ acuteSessions / 7) / (Σ chronicSessions / 28)`, `showAlert = ratio > 1.3` (R4 —
  la zone basse, R5, ne déclenche jamais l'alerte, mais le `ratio` reste renvoyé pour un futur
  usage éventuel type TRI-18 « météo de la forme »).
- Les fenêtres (quelles séances sont « acute » vs « chronic ») sont découpées **par l'appelant** —
  cette fonction ne connaît pas de notion de date, seulement deux listes déjà filtrées (cohérent
  avec `computeTrainingTime`, qui ne connaît pas non plus de fenêtre).

**Tests, écrits d'abord** :
- Séance manquant `rpe` → contribue 0, ne fait pas planter le calcul (R1).
- Charge chronique nulle → `null`, jamais de `NaN`/`Infinity` (R6 — le test qui compte).
- Ratio calculé à la main (ex. acute=700, chronic 28j=2800 → aiguë/j=100, chronique/j=100 → ratio 1,
  pas d'alerte) pour vérifier la formule, pas juste son signe.
- Ratio > 1,3 → `showAlert: true` ; ratio entre 0,8 et 1,3 → `showAlert: false` ; ratio < 0,8 →
  `showAlert: false` **aussi** (R5 — le test qui distingue ce garde-fou d'un ACWR générique naïf).

## Étape 2 — Le hook et le widget *(≈ 1 h 30)*

`apps/mobile/src/data/repositories/dashboard-repository.ts` — `useTrainingLoadAlert()`, même
patron que `useDeficitVolumeAlert` (gating dans le hook, hooks sous-jacents appelés
inconditionnellement) :
- Réutilise `useWorkoutHistory()` / `useRunHistory()` (déjà chargés ailleurs sur le dashboard —
  pas de nouvelle requête réseau/PowerSync distincte).
- Filtre en JS par `finishedAt` dans les fenêtres 7 j / 28 j (`useWindowStartKey`, comme
  `useTrainingTime`).
- Gating `['strength', 'running']` — `{ show: false }` sinon, sans calculer.

`apps/mobile/src/components/dashboard/TrainingLoadAlertCard.tsx` — **copie structurelle** de
`DeficitVolumeAlertCard.tsx` (ton `warn`, 3 formes small/wide/large, `if (!alert.show) return null`
en tête).

Enregistrement : `HOME_WIDGET_IDS` (widgets.ts) gagne `'training-load'` **en fin de registre**
(même raison que tous les ajouts depuis PAS-01 : `resolveScreenLayout` complète les layouts déjà
stockés, aucune migration de `dashboard_layout`). Gating `['strength', 'running']` dans
`WIDGET_REGISTRY.home.pillars`. Map `WIDGET_COMPONENTS` (dashboard-widgets.tsx) gagne l'entrée.

## Étape 3 — Solde *(≈ 20 min)*

**Aucune ligne roadmap** (spec §0). Mettre à jour `analyses-donnees.md` : META-19 🆕 → ✅ avec note
de ce qui est livré, et retirer l'item 12 de « Pistes de priorisation » (barré, comme les 11
autres). CHANGELOG + `etat.mjs` via `/commit`.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `packages/shared/src/training-time.ts` (+ `.test.ts`) | `sessionLoad`, `computeAcwr` |
| `packages/shared/src/widgets.ts` | `HOME_WIDGET_IDS` + `WIDGET_REGISTRY.home` |
| `apps/mobile/src/data/repositories/dashboard-repository.ts` | `useTrainingLoadAlert` |
| `apps/mobile/src/components/dashboard/TrainingLoadAlertCard.tsx` | **nouveau** |
| `apps/mobile/src/components/dashboard/dashboard-widgets.tsx` | entrée `WIDGET_COMPONENTS` |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | famille `home.trainingLoad.*` (4 clés) |
| `docs/product/analyses-donnees.md` | statut META-19, section priorisation |

## Migration / sync rules

**Aucune.** Données déjà en base et synchronisées.

## Dépendances

Aucun paquet nouveau → **recettable sur l'APK existant**.

## Risques

- 🟠 **Ajout au registre de widgets Tier 0** — même conditionnel, ADR-007 demande un arbitrage
  explicite pour tout ajout au dashboard, pas un empilement automatique. Signalé en validation
  (spec §1) : c'est un widget **conditionnel** (Tier 2 en pratique, hébergé sur l'écran Tier 0
  faute d'écran « Insights » Tier 3 construit), pas un 15ᵉ widget permanent.
- 🟢 **Aucun risque de ricochet** : lecture pure, réutilise des hooks déjà chargés ailleurs sur le
  dashboard, aucune écriture, aucune nouvelle table.
- 🟢 Brique commune à RUN-18/MR-10/TRI-12 (spec §0) : les construire plus tard sera moins cher une
  fois `computeAcwr`/`sessionLoad` en place.
