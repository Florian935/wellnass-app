# Plan — GARDE-01 · Garde-fou unifié charge & récupération (fusion TRI-12 + MR-14)

Spec : [garde01-fusion-garde-fou-charge-repos.md](../specs/functional/us/garde01-fusion-garde-fou-charge-repos.md) ·
branche `refactor/garde01-fusion-garde-fou` · **aucune ligne roadmap** (US de refactor, catalogue via
ses deux parents).

✅ Décisions D1-D4 arbitrées par Florian le 04/08/2026 (id `overtraining-guard` conservé, gating
2 piliers, 2 niveaux de sévérité, parents passés à `close`) — implémentation ci-dessous conforme.

**Nature du chantier** : c'est une **suppression nette**. On retire plus de code qu'on n'en ajoute
(3 fichiers/fonctions supprimés, 1 id de registre retiré, une duplication éliminée). L'ordre des
étapes est choisi pour que la suite de tests reste **verte en permanence** plutôt que de casser 20
tests puis de tout recoller.

## Étape 1 — Étendre la fonction pure, en gardant les tests TRI-12 verts *(≈ 1 h)*

`packages/shared/src/training-time.ts` :

```ts
/** Niveau de sévérité du garde-fou (US GARDE-01, spec R3) — deux paliers, pas un booléen. */
export type OvertrainingSeverity = 'streak' | 'streakAndDeficit';

/** Résultat du garde-fou unifié — `streakDays` sert au titre du niveau `streak` (spec §6). */
export type OvertrainingGuardResult = {
  show: boolean;
  severity: OvertrainingSeverity | null;
  streakDays: number;
};

/**
 * Garde-fou unifié charge & récupération (US GARDE-01, fusion TRI-12 + MR-14).
 *
 * `show` ne dépend **que** du streak (spec R2) — c'est l'arbitrage de la contradiction relevée au
 * §0 : R4 de TRI-12 (« un seul signal ne suffit jamais ») est remplacée par la position de MR-14.
 * Le déficit ne décide plus de l'affichage, seulement du **niveau** (spec R3/R5), ce qui rend `show`
 * monotone et supprime le swap de carte.
 *
 * `deficitDaysCount` vaut 0 quand la nutrition est inactive : le niveau `streakAndDeficit` devient
 * alors inatteignable sans garder le widget (spec R4/D2, dégradation par composante — même patron
 * que `useReadiness`, TRI-03 D2).
 */
export function computeOvertrainingGuard(input: {
  loadStreakDays: number;
  deficitDaysCount: number;
}): OvertrainingGuardResult {
  const reachedStreak = input.loadStreakDays >= OVERTRAINING_LOAD_STREAK_DAYS;
  if (!reachedStreak) {
    return { show: false, severity: null, streakDays: input.loadStreakDays };
  }
  const hasDeficit = input.deficitDaysCount >= OVERTRAINING_DEFICIT_DAYS_REQUIRED;
  return {
    show: true,
    severity: hasDeficit ? 'streakAndDeficit' : 'streak',
    streakDays: input.loadStreakDays,
  };
}
```

- **La signature d'entrée ne change pas** — seul le retour s'enrichit. Les appels existants
  continuent de compiler ; seules les assertions sur la forme du retour changent.
- `computeLoadStreakAlert` et son type `LoadStreakAlert` **supprimés** dans la même étape (leur rôle
  est entièrement absorbé), ainsi que leurs 8 tests.

**Tests, adaptés puis étendus** (`training-time.test.ts`) :
- **Les 4 tests TRI-12 existants sont conservés et adaptés**, pas supprimés — c'est la preuve de
  non-régression du comportement composite :
  - streak 6 + déficit 4 → `show: true, severity: 'streakAndDeficit'` (avant : `{show: true}`).
  - streak 6 + déficit 3 → **`show: true, severity: 'streak'`** ⚠️ **le changement de
    comportement le plus important de cette US** (avant : `{show: false}`). Ce test *doit* changer
    de valeur attendue — c'est R2 qui remplace R4, pas une régression.
  - streak 5 + déficit 4 → `show: false, severity: null`.
  - streak 8 + déficit 7 → `show: true, severity: 'streakAndDeficit'`.
- Nouveaux tests :
  - streak 6 pile, déficit 0 → `severity: 'streak'` (borne basse du streak incluse).
  - streak 9, `deficitDaysCount: 0` (cas « nutrition inactive » vu de la fonction) → `'streak'`.
  - déficit 4 pile avec streak suffisant → `'streakAndDeficit'` (borne basse du déficit incluse).
  - `streakDays` remonté fidèlement dans les trois cas (masqué, niveau streak, niveau déficit).
- Les 3 tests de la règle D1 de MR-14 (masquage mutuel) **disparaissent** : la règle qu'ils
  protégeaient n'existe plus. Leur remplaçant est le test « streak 6 + déficit 3 → severity streak ».

## Étape 2 — Le hook : fusionner et supprimer la duplication *(≈ 45 min)*

`apps/mobile/src/data/repositories/dashboard-repository.ts` :

- `useOvertrainingGuardAlert` :
  - Gating passe de 3 à **2 piliers** (`strength` && `running`) — retour anticipé
    `{ show: false, severity: null, streakDays: 0 }`.
  - `nutritionActive` n'est plus une garde : il **neutralise la composante** —
    `deficitDaysCount = nutritionActive ? countDeficitDaysInWindow(...) : 0` (spec R4/D2).
  - Le type de retour devient `OvertrainingGuardResult` (importé de shared) ; `OvertrainingGuardAlert`
    (type local, `{ show: boolean }`) est supprimé.
- **`useLoadStreakAlert` supprimée intégralement** — avec elle disparaissent : la seconde copie du
  calcul de streak (MR-14 §3), l'appel imbriqué à `useOvertrainingGuardAlert` et donc la double
  instanciation des requêtes (MR-14 §7). L'import de `computeLoadStreakAlert` et du type
  `LoadStreakAlert` est retiré.
- L'en-tête de fichier (sommaire des hooks) perd sa ligne `useLoadStreakAlert`.

## Étape 3 — La carte à message variable *(≈ 45 min)*

`apps/mobile/src/components/dashboard/OvertrainingGuardCard.tsx` — les 3 formes existantes sont
conservées telles quelles (structure, styles, ⚠️, ton `warn`), seule la **résolution des textes**
change en tête de composant :

```ts
const guard = useOvertrainingGuardAlert();
if (!guard.show || guard.severity === null) return null;

const prefix = guard.severity === 'streakAndDeficit' ? 'deficit' : 'streak';
const title = t(`home.overtrainingGuard.${prefix}.title`, { days: guard.streakDays });
const message = t(`home.overtrainingGuard.${prefix}.message`);
const recommend = t(`home.overtrainingGuard.${prefix}.recommend`);
```

- `{ days }` est passé aux deux niveaux mais n'est interpolé que par `streak.title` (i18next ignore
  une variable non utilisée) — évite un `if` sur le passage des options.
- **`LoadStreakAlertCard.tsx` supprimée**, ainsi que son smoke test.
- `OvertrainingGuardCard.test.tsx` (s'il existe) adapté ; sinon un smoke test est créé couvrant les
  **deux niveaux** + le cas masqué (le patron des autres cartes Tier 2 de la session).

## Étape 4 — Retirer l'id du registre *(≈ 30 min)*

`packages/shared/src/widgets.ts` :
- `'load-streak-alert'` retiré de `HOME_WIDGET_IDS` (**21 → 20**) et de `WIDGET_REGISTRY.home.pillars`.
- La garde de `'overtraining-guard'` passe de `['strength','running','nutrition']` à
  `['strength','running']`, avec un commentaire expliquant l'arbitrage (spec D2) — la référence à
  « le seul cas à 3 piliers » disparaît du fichier.

`apps/mobile/src/components/dashboard/dashboard-widgets.tsx` : entrée `'load-streak-alert'` et son
import supprimés.

`apps/mobile/src/app/(tabs)/index.tsx` : `useLoadStreakAlert` (import + `loadStreakAlertActive` +
branche de `isWidgetActive`) supprimé.

**Tests `widgets.test.ts`** — cette fois les compteurs baissent :
- `HOME_WIDGET_IDS` → 20 ; `defaultScreenLayout('home')` → 20 ; `resolveScreenLayout` 3 piliers → 19
  (sans `cycle`) et 20 (avec `cycle`).
- Le test « garde le garde-fou tri-pilier derrière les 3 piliers — le seul cas à 3 » est **réécrit** :
  plus aucun widget n'exige 3 piliers, la garde devient `['strength','running']`.
- Le test « garde MR-14 à 2 piliers, là où TRI-12 en exige 3 » est **supprimé** : il protégeait
  précisément la distinction que cette US abolit. _Note : ce test, ajouté le matin même, a fait
  exactement son travail — il disait « si ces deux gardes deviennent identiques, l'une des deux US
  est un doublon ». Elles le sont devenues, et la réponse est la fusion, pas la suppression d'une US._
- **Nouveau test (DoD)** : un `ScreenLayout` stocké contenant `load-streak-alert` est résolu sans
  ce widget, **sans trou ni chevauchement** (`assertNoOverlap` + `assertNoEmptyRow`) — vérifie
  concrètement la promesse « aucune migration » de D1.

## Étape 5 — i18n : déplacer, ne rien réécrire *(≈ 20 min)*

`apps/mobile/src/i18n/locales/{fr,en}.json` :
- `home.overtrainingGuard` réorganisée : `eyebrow` conservée, sous-objets `streak` et `deficit`
  (spec §6). Les **valeurs** de `deficit.*` viennent de l'actuel `overtrainingGuard.{title,message,recommend}`,
  celles de `streak.*` de `loadStreakAlert.{title,message,recommend}` — **copiées mot pour mot** (R6).
- `home.loadStreakAlert` supprimée en entier (son `eyebrow` « Repos & récupération » disparaît).
- Contrôle : un `git diff` sur les valeurs ne doit montrer que des **déplacements**, aucune
  modification de chaîne.

## Étape 6 — Solde documentaire *(≈ 30 min)*

- Spec [TRI-12](../specs/functional/us/tri12-garde-fou-global.md) : `etape: recette` → `close`,
  bandeau « comportement repris par GARDE-01 », §8 (critères de recette) remplacé par un renvoi vers
  GARDE-01 §11. **Ne pas réécrire ses règles** : elles documentent l'historique de la décision.
- Spec [MR-14](../specs/functional/us/mr14-jours-consecutifs-sans-repos.md) : idem, §11 → renvoi.
- `docs/product/analyses-donnees.md` : lignes TRI-12 et MR-14 → note de fusion + lien vers GARDE-01.
- `IDEAS.md` : l'entrée du 04/08 passe de 🔍 à ✅ **promue en US**, et descend dans « Archives » avec
  un mot sur la décision (c'est la règle du fichier).
- **Pas de ligne roadmap** ; pas d'entrée RECETTES.md (convention « US d'analyse » : les critères
  vivent dans la spec).
- CHANGELOG + `etat.mjs` via `/commit`.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `packages/shared/src/training-time.ts` (+ `.test.ts`) | `computeOvertrainingGuard` étendue ; `computeLoadStreakAlert` **supprimée** |
| `apps/mobile/src/data/repositories/dashboard-repository.ts` | `useOvertrainingGuardAlert` étendue ; `useLoadStreakAlert` **supprimée** |
| `apps/mobile/src/components/dashboard/OvertrainingGuardCard.tsx` | message variable selon le niveau |
| `apps/mobile/src/components/dashboard/__tests__/OvertrainingGuardCard.test.tsx` | smoke test des 2 niveaux (créé ou adapté) |
| `apps/mobile/src/components/dashboard/LoadStreakAlertCard.tsx` + son test | **supprimés** |
| `apps/mobile/src/components/dashboard/dashboard-widgets.tsx` | entrée `load-streak-alert` **retirée** |
| `apps/mobile/src/app/(tabs)/index.tsx` | `isWidgetActive` — branche `load-streak-alert` **retirée** |
| `packages/shared/src/widgets.ts` (+ `.test.ts`) | id retiré (21 → 20), garde de `overtraining-guard` à 2 piliers |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | familles fusionnées, textes déplacés à l'identique |
| `docs/specs/functional/us/tri12-*.md`, `mr14-*.md` | `close` + renvois (étape 6) |
| `docs/product/analyses-donnees.md`, `IDEAS.md` | notes de fusion, idée promue |

## Migration / sync rules

**Aucune.** Aucun changement de schéma. Le retrait d'un id de widget ne nécessite **aucune migration
de `user_settings.dashboard_layout`** : `resolveScreenLayout` (`widgets.ts:481`) ignore les ids
inconnus — vérifié avant rédaction, et couvert par un test dédié à l'étape 4.

## Dépendances

Aucun paquet nouveau → **recettable sur l'APK existant**.

## Risques

- 🔴 **D1-D4 non arbitrées** : D2 (gating 2 piliers) et D4 (parents à `close`) changent le
  comportement et le suivi — ne pas coder avant l'arbitrage.
- 🟠 **Le test « streak 6 + déficit 3 » change de valeur attendue** (`false` → `true`, niveau
  `streak`). C'est **le** point à ne pas confondre avec une régression en revue : R4 de TRI-12 est
  volontairement remplacée par R2 (spec §0). À signaler explicitement dans le message de commit.
- 🟠 **TRI-12 n'avait pas été recettée sur device** : son comportement composite change (gating,
  niveau) sans avoir jamais été validé en main. Atténuation : ses tests unitaires sont conservés et
  adaptés (étape 1), et la recette consolidée (spec §11) couvre les deux niveaux.
- 🟢 **Aucun risque de perte de contenu** : les deux jeux de textes validés sont conservés mot pour
  mot (R6), seules leurs clés bougent — contrôle par diff à l'étape 5.
- 🟢 **Charge Tier 0 en baisse** : 21 → 20 widgets, première baisse du compteur.
