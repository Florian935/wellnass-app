# Plan — MN-04 · Macros ajustées jours muscu (glucides péri-séance)

Spec : [mn04-glucides-peri-seance.md](../specs/functional/us/mn04-glucides-peri-seance.md) ·
branche `feature/mn04-glucides-peri-seance` · **aucune ligne roadmap** (US d'analyse, catalogue seul).

✅ Décision D1 arbitrée par Florian le 04/08/2026 (spec §1) — 100 % du bonus vers les glucides,
implémentation ci-dessous conforme.

**Pas de widget, pas de registre, pas de gating** : cette US corrige un calcul déjà consommé par
deux écrans existants. Beaucoup plus petit périmètre que TRI-03/RN-03.

## Étape 1 — La fonction pure, testée d'abord *(≈ 45 min)*

`packages/shared/src/nutrition.ts` — juste après `macroRatiosFromGrams` (même voisinage que le
reste du domaine macros/§2.3) :

```ts
/**
 * Cibles macro d'un jour, bonus calorique (MN-01/RN-02) redirigé vers les glucides plutôt
 * qu'invisible (spec R1, décision D1 — 100 % glucides, aucune répartition avec les protéines).
 * `targetBase === effectiveTarget` (jour sans bonus) → résultat identique à
 * `macroGramsFromCalories(targetBase, defaultMacroRatios(objective))` (spec R4).
 */
export function trainingDayMacroGrams(params: {
  targetBase: number;
  effectiveTarget: number;
  objective: NutritionObjective;
}): MacroGrams {
  const base = macroGramsFromCalories(params.targetBase, defaultMacroRatios(params.objective));
  const bonusKcal = Math.max(0, params.effectiveTarget - params.targetBase);
  const bonusCarbs = Math.round(bonusKcal / CARBS_KCAL_PER_G);
  return { protein: base.protein, carbs: base.carbs + bonusCarbs, fat: base.fat };
}
```

**Tests, écrits d'abord** :
- `effectiveTarget === targetBase` → résultat strictement égal à `macroGramsFromCalories(targetBase,
  defaultMacroRatios(objective))` (R4, non-régression jour de repos).
- `effectiveTarget = targetBase + 400` (bonus forfait typique) → `carbs` augmente exactement de
  `round(400/4)` = 100 g de plus que la base ; `protein`/`fat` identiques à la base (R1).
- `effectiveTarget = targetBase + 137` (bonus impair, dépense de course réelle) → arrondi correct,
  pas de `NaN`.
- `effectiveTarget < targetBase` (ne devrait jamais arriver, `dayCalorieBonus` ne renvoie jamais de
  négatif) → `Math.max(0, …)` protège quand même, résultat = base pure, pas de glucides négatifs.
- Les 3 objectifs (`bulk`/`cut`/`maintain`) avec un même bonus → chacun part de ses propres ratios
  de base, seul l'incrément glucides est identique en valeur absolue.

## Étape 2 — Les deux écrans *(≈ 30 min)*

`apps/mobile/src/components/dashboard/NutritionSummaryCard.tsx` (lignes ~103-111) :

```diff
- : target != null && objective != null
-   ? macroGramsFromCalories(target, defaultMacroRatios(objective))
+ : target != null && effectiveTarget != null && objective != null
+   ? trainingDayMacroGrams({ targetBase: target, effectiveTarget, objective })
    : null;
```

`apps/mobile/src/app/(tabs)/nutrition.tsx` (lignes ~140-148), même remplacement — **et mise à jour
du commentaire lignes 123-127** qui documente aujourd'hui explicitement la limitation que cette US
corrige (« bonus non ventilé ») : le retirer ou le remplacer par une note pointant vers MN-04,
sans quoi le commentaire devient trompeur (dette documentaire, même piège que les commentaires
obsolètes déjà rencontrés sur d'autres US).

Import à ajouter dans les deux fichiers : `trainingDayMacroGrams` depuis `'@wellness/shared'`
(`macroGramsFromCalories`/`defaultMacroRatios` restent importés si encore utilisés ailleurs dans le
fichier — à vérifier, sinon les retirer).

**Aucun test de composant nouveau requis** : la logique testable vit entièrement dans la fonction
pure de l'étape 1 ; les deux écrans ne font qu'appeler une fonction déjà couverte, même discipline
que le reste du projet (« briques pures et testées », DoD standard).

## Étape 3 — Catalogue & solde *(≈ 15 min)*

- `docs/product/analyses-donnees.md` : MN-04 ⏳ → statut réel selon l'avancement au moment du commit.
- **Pas de ligne roadmap** (front-matter `roadmap: []`).
- CHANGELOG + `etat.mjs` via `/commit`.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `packages/shared/src/nutrition.ts` (+ `.test.ts`) | `trainingDayMacroGrams` |
| `apps/mobile/src/components/dashboard/NutritionSummaryCard.tsx` | appelle la nouvelle fonction |
| `apps/mobile/src/app/(tabs)/nutrition.tsx` | idem + commentaire lignes 123-127 mis à jour |
| `docs/product/analyses-donnees.md` | MN-04 ⏳ → statut réel |

## Migration / sync rules

**Aucune.** Aucune donnée nouvelle, calcul pur en aval de valeurs déjà chargées.

## Dépendances

Aucun paquet nouveau → **recettable sur l'APK existant**.

## Risques

- 🟠 **D1 non arbitrée change le corps de la fonction** : ne pas coder avant l'arbitrage (comme
  TRI-03/RN-03).
- 🟢 **Périmètre volontairement restreint à 2 call sites connus** — si un 3ᵉ endroit de l'app
  calcule des cibles macro par ses propres moyens (à vérifier par un grep `macroGramsFromCalories`
  avant de clore l'étape 2 : seuls `NutritionSummaryCard.tsx` et `nutrition.tsx` sont apparus dans
  la recherche initiale), il resterait sur l'ancien calcul — signalé ici plutôt que supposé couvert.
- 🟢 **Aucun risque de ricochet sur MN-01/MN-02/MN-03/MN-06/RN-01/RN-02/RN-03** : aucune de leurs
  fonctions n'est modifiée, seule leur sortie (`effectiveTarget`) est consommée en lecture.
