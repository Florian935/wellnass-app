# Plan — MUSC-12 · Densité d'entraînement (volume/temps)

Spec : [musc12-densite-entrainement.md](../specs/functional/us/musc12-densite-entrainement.md) ·
branche `feature/musc12-densite-entrainement` · **aucune ligne roadmap** (US d'analyse, catalogue
seul).

✅ Décision D1 arbitrée par Florian le 04/08/2026 (spec §1) — périmètre v1 limité à la stat par
séance, implémentation ci-dessous conforme.

**Le plus petit périmètre de la série** : une fonction pure + une ligne ajoutée à un écran existant.
Pas de hook nouveau, pas de requête SQL nouvelle (les données sont déjà chargées par
`buildSummary`).

## Étape 1 — La fonction pure, testée d'abord *(≈ 20 min)*

`packages/shared/src/workout.ts` — juste après `hasReachedTonnageMilestone` (même fichier,
domaine séance) :

```ts
/** Densité d'entraînement (spec R1) : volume ÷ durée effective, arrondie à 1 décimale. */
export function computeTrainingDensity(volumeKg: number, durationMinutes: number): number {
  if (durationMinutes <= 0) return 0;
  return Math.round((volumeKg / durationMinutes) * 10) / 10;
}
```

**Tests, écrits d'abord** :
- `computeTrainingDensity(1200, 60)` → `20`.
- `computeTrainingDensity(0, 45)` → `0` (volume nul, spec R3 — pas une erreur).
- `computeTrainingDensity(500, 0)` → `0` (garde défensive, même si `buildSummary` plancherait déjà
  la durée à 1 en amont — la fonction reste sûre isolément).
- `computeTrainingDensity(133, 7)` → arrondi correct à 1 décimale (19,0 ou proche, à vérifier au
  calcul exact plutôt que supposé).

## Étape 2 — La ligne dans le résumé de séance *(≈ 20 min)*

`apps/mobile/src/app/workout-summary.tsx` :
- `Summary` (type) : ajoute `density: number`.
- `buildSummary` : `density: computeTrainingDensity(volume, durationMin)`, calculée après les deux
  autres (aucune donnée nouvelle chargée).
- Rendu : nouvelle `<Row label={t('workout.summary.density')} value={`${units.formatWeight(summary.density)}/min`} />`,
  juste après la `Row` Volume existante (ligne ~317).

`apps/mobile/src/i18n/locales/{fr,en}.json` : une clé `workout.summary.density` (« Densité » /
« Density »).

**Pas de test de composant nouveau** : logique entièrement dans la fonction pure de l'étape 1,
même discipline que MN-04 (l'écran ne fait qu'assembler un résultat déjà correct).

## Étape 3 — Catalogue & solde *(≈ 15 min)*

- `docs/product/analyses-donnees.md` : MUSC-12 🆕 → statut réel selon l'avancement au moment du
  commit.
- **Pas de ligne roadmap** (front-matter `roadmap: []`).
- CHANGELOG + `etat.mjs` via `/commit`.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `packages/shared/src/workout.ts` (+ `.test.ts`) | `computeTrainingDensity` |
| `apps/mobile/src/app/workout-summary.tsx` | nouvelle `Row` Densité |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | clé `workout.summary.density` |
| `docs/product/analyses-donnees.md` | MUSC-12 🆕 → statut réel |

## Migration / sync rules

**Aucune.** Calcul pur en aval de données déjà chargées par `buildSummary`.

## Dépendances

Aucun paquet nouveau → **recettable sur l'APK existant**.

## Risques

- 🟢 **Risque minimal** : aucune requête nouvelle, aucun hook nouveau, une seule fonction pure et
  un seul point d'affichage. Le plus petit changement de la série de cette session.
- 🟢 **Aucun risque de ricochet** : `computeVolume`/`buildSummary` ne sont pas modifiées au-delà de
  l'ajout du champ `density`.
