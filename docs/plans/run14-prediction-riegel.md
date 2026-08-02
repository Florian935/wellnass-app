# Plan — RUN-14 · Prédiction de temps de course (Riegel)

Spec : [run14-prediction-riegel.md](../specs/functional/us/run14-prediction-riegel.md) ·
branche `feature/run14-prediction-riegel` · roadmap **5.34**.

## Étape 1 — La formule, pure et testée *(≈ 45 min)*

`packages/shared/src/pace-records.ts` (même fichier que `computeRunRecords` — même famille de
calcul, pas un nouveau module) :

```ts
predictRaceTime(t1Seconds: number, d1Meters: number, d2Meters: number): number
  // T2 = T1 × (D2/D1)^1,06
```

**Tests, écrits d'abord** :
- Référence connue : 5 km en 25 min (1500 s) → 10 km ≈ 52 min (calcul à la main pour vérifier
  l'exposant, pas une valeur inventée).
- `d2Meters === d1Meters` → renvoie `t1Seconds` inchangé (cas limite trivial, garde contre une
  régression sur l'exposant).
- Croissance monotone : plus `d2Meters` est grand, plus le temps prédit croît plus vite que
  linéairement (vérifie que l'exposant 1,06 est bien appliqué, pas une règle de trois déguisée).

Puis une fonction d'orchestration, dans le même fichier :

```ts
resolveRacePredictions(
  records: { distanceKey: RecordDistanceKey; bestTimeSeconds: number; achievedAt: string }[],
): { distanceKey: '10k' | 'semi' | 'marathon'; predictedSeconds: number; sourceTimeSeconds: number; sourceAchievedAt: string }[]
```

- Cherche le record `5k` dans la liste → absent : renvoie `[]` (R1, spec §2).
- Présent : calcule les 3 prédictions, **puis retire** celles dont la distance a déjà un record réel
  dans `records` (R3) — la fonction reçoit la liste complète des records existants pour appliquer ce
  filtre elle-même, l'appelant n'a pas à le refaire.

**Tests, écrits d'abord** :
- Aucun record 5 km → `[]`.
- Record 5 km seul → 3 entrées (10 km, semi, marathon).
- Record 5 km + record semi réel → 2 entrées seulement (10 km, marathon) — **le test qui vérifie R3**,
  le plus important de cette étape.
- Record 5 km + record marathon réel → 2 entrées (10 km, semi).

## Étape 2 — L'affichage *(≈ 1 h 30)*

- Nouvelle section dans
  [running-history/index.tsx](../../apps/mobile/src/app/running-history/index.tsx), **sous**
  `RecordsSection` existante (même écran, pas de nouvelle route) : `PredictionsSection`, montée
  seulement si `resolveRacePredictions(...)` renvoie un tableau non vide — sinon le texte d'état
  vide (spec §5 `empty`), jamais un titre de section sans contenu.
- Chaque ligne : distance cible (réutilise les libellés `running.records.distance10k` /
  `distanceSemi` / `distanceMarathon` existants) + temps formaté (`units.formatDuration` ou
  équivalent déjà utilisé ailleurs pour un temps, pas une allure) + phrase source
  (`running.predictions.sourceLabel`, avec date + temps du record 5 km).
- La ligne marathon porte en plus `running.predictions.marathonWarning` (R5) — même bloc
  accessible que le reste de la ligne (spec §7), pas une info-bulle séparée.
- **Recalcul à chaque affichage** (pas de valeur stockée) : `useRunningRecords()` est déjà réactif,
  `resolveRacePredictions` est pure → un nouveau record 5 km met à jour les 3 prédictions sans code
  supplémentaire.

## Étape 3 — Solde *(≈ 20 min)*

Roadmap **5.34 → ✅**. CHANGELOG + `etat.mjs` via `/commit`. BACKLOG : rien à retirer (RUN-14 n'y
était pas listée, seulement au catalogue — noter `catalogue: [RUN-14]` déjà posé dans le
front-matter de la spec comme seule trace).

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `packages/shared/src/pace-records.ts` (+ `.test.ts`) | `predictRaceTime`, `resolveRacePredictions` |
| `apps/mobile/src/app/running-history/index.tsx` | nouvelle section `PredictionsSection` |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | famille `running.predictions.*` (5 clés) |

## Migration / sync rules

**Aucune.** Donnée déjà en base (`running_pace_records`), calcul pur en lecture seule.

## Dépendances

Aucun paquet nouveau → **recettable sur l'APK existant**.

## Risques

- 🟢 **Aucun risque de ricochet** : lecture pure de données déjà exposées (`useRunningRecords`),
  aucune écriture, aucune migration.
- 🟠 **R3 est la règle la plus facile à casser par erreur** (afficher une prédiction alors qu'un
  record réel existe pour la même distance) — d'où le test dédié à l'étape 1, à ne pas retirer même
  si la couverture globale paraît suffisante sans lui.
- 🟢 Le point dur de la spec (honnêteté, §4) est **entièrement dans les règles**, pas dans le code :
  une fois R1/R3/R4/R5 respectées, l'implémentation est directe.
