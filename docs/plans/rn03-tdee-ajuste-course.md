# Plan — RN-03 · Ajustement auto du TDEE selon le volume de course

Spec : [rn03-tdee-ajuste-course.md](../specs/functional/us/rn03-tdee-ajuste-course.md) ·
branche `feature/rn03-tdee-ajuste-course` · **aucune ligne roadmap** (US d'analyse, catalogue seul).

✅ Décisions D1-D5 arbitrées par Florian le 04/08/2026 (spec §1) — implémentation ci-dessous conforme
aux recommandations (14 j, bidirectionnel, plafond `active`, texte seul, visible même en surcharge
manuelle).

## Étape 1 — La fonction de suggestion pure, testée d'abord *(≈ 1 h)*

`packages/shared/src/nutrition.ts` — juste après `activityFactor`/`ACTIVITY_LEVELS` (§2.2), même
fichier que le reste du domaine TDEE :

```ts
/** Fenêtre de mesure de la fréquence (spec D1) — 14 j, pas 7 : lisse une semaine anormale. */
const RUNNING_FREQUENCY_WINDOW_DAYS = 14;

/**
 * Palier suggéré par la fréquence de course (spec R2) — reprend telles quelles les fourchettes
 * jours/semaine de la spec §2.2. Plafonné à `active` : `very_active` n'a aucun seuil sourcé pour
 * ce palier (spec D4), l'inventer serait un chiffre non défendable.
 */
export function activityLevelFromRunningFrequency(
  runningDaysInWindow: number,
): ActivityLevel {
  const perWeek = runningDaysInWindow / (RUNNING_FREQUENCY_WINDOW_DAYS / 7);
  if (perWeek <= 0) return 'sedentary';
  if (perWeek <= 2) return 'light';
  if (perWeek <= 5) return 'moderate';
  return 'active';
}

/**
 * Suggestion RN-03 : compare le niveau déclaré au niveau qu'impliquerait la fréquence de course
 * réelle sur les 14 derniers jours. `null` si identiques (spec R3 — rien à afficher).
 */
export function suggestActivityLevel(input: {
  currentLevel: ActivityLevel;
  runningDaysInWindow: number;
}): ActivityLevel | null {
  const suggested = activityLevelFromRunningFrequency(input.runningDaysInWindow);
  return suggested === input.currentLevel ? null : suggested;
}
```

- `RUNNING_FREQUENCY_WINDOW_DAYS` n'est **pas exportée** (détail d'implémentation de la fonction
  ci-dessus) — l'appelant (hook mobile) doit fournir une liste de jours déjà bornée aux 14 derniers
  jours calendaires, même discipline que `computeAcwr`/`countDeficitDaysInWindow` : ces fonctions ne
  connaissent aucune notion de date, seulement un compte.

**Tests, écrits d'abord** :
- `activityLevelFromRunningFrequency(0)` → `'sedentary'`.
- `activityLevelFromRunningFrequency(3)` (1,5 j/sem) → `'light'`.
- `activityLevelFromRunningFrequency(4)` (2 j/sem pile) → `'light'` (borne incluse basse).
- `activityLevelFromRunningFrequency(7)` (3,5 j/sem) → `'moderate'`.
- `activityLevelFromRunningFrequency(10)` (5 j/sem pile) → `'moderate'` (borne incluse haute).
- `activityLevelFromRunningFrequency(14)` (7 j/sem, tous les jours) → `'active'`, **jamais**
  `'very_active'` (spec D4 — test explicite de plafond, le plus facile à casser par erreur).
- `suggestActivityLevel({ currentLevel: 'sedentary', runningDaysInWindow: 0 })` → `null` (identique).
- `suggestActivityLevel({ currentLevel: 'sedentary', runningDaysInWindow: 12 })` → `'active'`
  (hausse, spec R4).
- `suggestActivityLevel({ currentLevel: 'active', runningDaysInWindow: 0 })` → `'sedentary'`
  (baisse, spec D2 — bidirectionnel, le test qui aurait manqué si la règle n'allait que dans un sens).

## Étape 2 — Le hook + le widget *(≈ 1 h 30)*

`apps/mobile/src/data/repositories/dashboard-repository.ts` — `useActivityLevelSuggestion()` :

- Gating `['running', 'nutrition']` — retour anticipé `{ show: false }` hors gating, hooks
  sous-jacents appelés inconditionnellement (règle des hooks React), même patron que
  `useTrainingLoadAlert`.
- `useRunHistory()` (déjà chargée ailleurs) + `useWindowStartKey(14)`, filtrée par `finishedAt`,
  regroupée par `localDayKey` en `Set` pour le compte de jours distincts (spec R1 — même discipline
  que le "jour à charge" de TRI-12, mais sans notion de streak ici, juste une taille de `Set`).
- `useNutritionProfile()` → `nutritionProfile.activityLevel` (niveau déclaré actuel).
- `suggestActivityLevel({ currentLevel, runningDaysInWindow })` → si `null`, `{ show: false }` ;
  sinon `{ show: true, current, suggested, runningDaysInWindow }`.
- **Pas de lecture de `manualCalories`** (spec R6/D3 — la condition d'affichage ne le regarde pas).

`apps/mobile/src/components/dashboard/ActivityLevelSuggestionCard.tsx` (nouveau) — calque
structurel de `TrainingLoadAlertCard.tsx`, mais `tone="card"` (pas `"warn"` — un insight neutre,
pas une alerte de sécurité) :
- `if (!suggestion.show) return null;`
- Message interpolé : `t('home.activityLevelSuggestion.message', { days: ..., current:
  t(`nutrition.activity.options.${current}`), suggested: t(`nutrition.activity.options.${suggested}`)
  })` — réutilise les libellés de palier existants de l'écran profil nutrition (spec §6), aucune
  nouvelle chaîne pour les noms de palier.
- 3 formes (small/wide/large), bloc `accessible` unique par forme.

`packages/shared/src/widgets.ts` :
- `'activity-level-suggestion'` ajouté **en fin** de `HOME_WIDGET_IDS` (18 → 19).
- `WIDGET_REGISTRY.home.pillars['activity-level-suggestion'] = ['running', 'nutrition']`.

`apps/mobile/src/components/dashboard/dashboard-widgets.tsx` : entrée `WIDGET_COMPONENTS`.

`apps/mobile/src/i18n/locales/{fr,en}.json` : famille `home.activityLevelSuggestion.*` (eyebrow,
title, message, hint — 4 clés). **Ne pas dupliquer** `nutrition.activity.options.*`, déjà là.

**Tests `widgets.test.ts` à mettre à jour** (même piège que TRI-03/META-19/TRI-12) :
`HOME_WIDGET_IDS` → 19, `defaultScreenLayout('home')` → 19, et les scénarios `resolveScreenLayout`
avec les 3 piliers actifs (`running`+`nutrition` inclus dans `all`) → +1 partout où c'est le cas.
Contrairement à `readiness` (`'always'`), celui-ci est gardé **par pilier** — pas d'ajout au test
« nutrition seule » (`running` absent → gating non rempli, le widget n'apparaît pas dans ce cas).

## Étape 3 — Catalogue & solde *(≈ 20 min)*

- `docs/product/analyses-donnees.md` : RN-03 ⏳ → statut réel selon l'avancement au moment du commit.
- **Pas de ligne roadmap** (front-matter `roadmap: []`).
- CHANGELOG + `etat.mjs` via `/commit`.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `packages/shared/src/nutrition.ts` (+ `.test.ts`) | `activityLevelFromRunningFrequency`, `suggestActivityLevel` |
| `apps/mobile/src/data/repositories/dashboard-repository.ts` | `useActivityLevelSuggestion` |
| `apps/mobile/src/components/dashboard/ActivityLevelSuggestionCard.tsx` (nouveau) | widget conditionnel Tier 2 |
| `apps/mobile/src/components/dashboard/__tests__/ActivityLevelSuggestionCard.test.tsx` (nouveau) | smoke test — écrit dès l'implémentation cette fois (leçon de TRI-03 : pas d'ajout après-coup) |
| `apps/mobile/src/components/dashboard/dashboard-widgets.tsx` | enregistrement `WIDGET_COMPONENTS` |
| `packages/shared/src/widgets.ts` (+ `.test.ts`) | `'activity-level-suggestion'` dans `HOME_WIDGET_IDS`/`WIDGET_REGISTRY` |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | famille `home.activityLevelSuggestion.*` (4 clés) |
| `docs/product/analyses-donnees.md` | RN-03 ⏳ → statut réel |

## Migration / sync rules

**Aucune.** Données déjà en base (`runs`, `nutrition_profiles`), calcul pur en lecture seule.

## Dépendances

Aucun paquet nouveau → **recettable sur l'APK existant**.

## Risques

- 🔴 **D1-D5 non arbitrées changent le comportement** : en particulier D4 (plafond `active`) et D2
  (bidirectionnel) sont des choix de formule, pas des détails — ne pas coder avant l'arbitrage.
- 🟠 **Confusion avec RN-02** (`dayCalorieBonus`/`trainingBonusMode`) : cette US ne touche **jamais**
  ce mécanisme — à vérifier explicitement en revue, le risque étant qu'un futur lecteur du code (ou
  un modèle) fusionne les deux logiques par erreur en pensant simplifier.
- 🟠 **`RUNNING_FREQUENCY_WINDOW_DAYS` non exportée mais implicite dans le hook** : le hook mobile
  doit filtrer sur exactement 14 j calendaires avant d'appeler `activityLevelFromRunningFrequency` —
  un décalage silencieux (13 ou 15 j) fausserait la conversion en moyenne hebdomadaire sans qu'aucun
  test ne le révèle (les tests unitaires de la fonction pure ne couvrent que le calcul, pas le
  découpage de fenêtre côté hook).
- 🟢 **Aucun risque de ricochet sur `tdee`/`activityFactor`/RN-01/RN-02** : fonctions neuves,
  aucune signature existante modifiée.
