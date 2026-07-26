---
id: META-08
titre: "Tendance générique par régression linéaire (pente + R²)"
roadmap: []
catalogue: [META-08]
etape: close
branche: feature/meta08-tendance-regression-lineaire
maj: 18/07/2026
---
# US META-08 — Tendance générique par régression linéaire (pente + R²)

_Spec fonctionnelle. Statut : en validation (brainstorming Florian, 18/07/2026). Branche :
`feature/meta08-tendance-regression-lineaire` (depuis `dev`). Catalogue : **META-08** — brique socle
transverse, Phase A (déterministe, offline)._

## 1. Contexte & objectif

Le produit calcule aujourd'hui une **tendance** de deux façons distinctes, chacune codée à la main :

- **`weightTrend`** ([bodyweight.ts:18](../../../../packages/shared/src/bodyweight.ts)) — compare le
  **dernier** poids au **premier** (delta), seuil ±0,3 kg → `up` / `down` / `stable`.
- **`paceTrend`** ([run-stats.ts:51](../../../../packages/shared/src/run-stats.ts)) — compare la
  **moyenne de la 1ʳᵉ moitié** à celle de la **2ᵉ moitié** de la série, seuil ±2 % →
  `improving` / `declining` / `stable`.

Ces deux heuristiques « demi-période » ignorent l'espacement réel des dates et ne fournissent **aucune
pente exploitable** pour projeter (date d'atteinte d'un objectif, 1RM futur…). META-08 introduit **un
moteur unique de régression linéaire** (moindres carrés → pente, intercept, R²) et **rebranche les deux
heuristiques dessus**, à comportement visible inchangé.

C'est une **brique socle** : elle supprime une duplication et débloque ensuite la famille des
projections (META-14 date de poids cible, META-15 1RM futur, META-16 objectif de volume) et le lissage
(META-09). **100 % client, offline, gratuit, sans IA.**

> **Note transverse du catalogue** : poser les briques mathématiques socles (régression, lissage)
> **avant** les analyses inférentielles (corrélations META-20/21/22, forme-fatigue TRI-15) évite de
> recoder plusieurs fois la même logique. META-08 est la première de ces briques.

## 2. Périmètre

- **Inclus** :
  - moteur pur `linearRegression` (nouveau module shared `regression.ts`) + tests ;
  - helper de dates `daysBetween` (dans `date.ts`) + tests ;
  - **refacto iso-comportement** de `weightTrend` et `paceTrend` sur le moteur (verdicts inchangés à
    l'œil, seuils actuels conservés) ;
  - mise à jour des 2 appelants de `weightTrend` (passage de points datés) ;
  - test **« golden » de non-régression** ancien verdict vs nouveau, sur séries représentatives.
- **Exclu** :
  - **aucune nouvelle surface UI**, aucun nouveau widget/section (voir §7 surfaçage) ;
  - **R² non exposé** à l'utilisateur (calculé, gardé en réserve pour META-09+/projections) ;
  - les **projections** elles-mêmes (META-14/15/16) et le **lissage** (META-09) — US séparées ;
  - toute évolution des **seuils** ou de la **sémantique** des verdicts (strictement iso).
- **Axe X** : **jours écoulés depuis le 1ᵉʳ point** (pente en unité/jour), pas l'index — correct sur
  échantillonnage irrégulier (pesées/courses à dates variables) et réutilisable par les projections
  (décision Florian, Q3 brainstorming).
- **Maquette** : **sans objet** (aucun rendu nouveau ; refacto + brique pure).

## 3. Moteur pur — `linearRegression` (nouveau module `regression.ts`)

```ts
export type RegressionPoint = { x: number; y: number };
export type LinearFit = {
  slope: number;     // pente : unité de y par unité de x
  intercept: number; // ordonnée à l'origine
  r2: number;        // qualité d'ajustement, 0..1
  n: number;         // nombre de points utilisés
};

/** Régression linéaire (moindres carrés ordinaires). */
export function linearRegression(points: ReadonlyArray<RegressionPoint>): LinearFit | null;
```

Règles :
- **Moindres carrés ordinaires**, formules fermées (pas d'itératif).
- Retourne **`null`** quand le fit n'a pas de sens : **`n < 2`** OU **variance de x nulle** (tous les
  points le même jour → pente indéfinie). Les adaptateurs traduisent `null` en le verdict neutre
  (`'stable'`), ce qui reproduit le comportement actuel (`length < 2 → 'stable'`).
- **R²** = coefficient de détermination `1 − SS_res / SS_tot`, borné `[0, 1]`.
  - **Convention série constante** : si tous les `y` sont identiques (`SS_tot = 0`), retourner
    `slope: 0, r2: 1` (droite plate parfaite) — évite la division par zéro.
- **Purement numérique** : le moteur ne connaît pas les dates. La conversion `dayKey → x (jours)` est
  faite par l'adaptateur **avant** l'appel.
- Robuste à des points **non triés** en x et **irrégulièrement espacés**.

## 4. Helper de dates — `daysBetween` (dans `date.ts`)

Aucun utilitaire ne calcule aujourd'hui un nombre de jours entre deux clés. À ajouter :

```ts
/** Nombre de jours calendaires de `fromKey` à `toKey` (AAAA-MM-JJ). DST-safe. */
export function daysBetween(fromKey: string, toKey: string): number;
```

- Parser chaque clé en date **à midi UTC** (`Date.UTC(y, m-1, d, 12)`) puis
  `Math.round((toMs − fromMs) / 86_400_000)` — le midi neutralise tout décalage DST.
- `daysBetween(k, k) === 0` ; strictement croissant avec l'écart de dates ; **passage d'année** correct.
- L'axe X d'une série = `daysBetween(premièreClé, clé)` pour chaque point (le 1ᵉʳ point est donc à
  `x = 0`).

## 5. Adaptateurs (refacto iso-comportement)

Principe commun : chaque adaptateur (1) construit les points datés `{ x: daysBetween(base, dayKey), y }`,
(2) appelle `linearRegression`, (3) mappe le résultat sur l'**ampleur observée sur toute la fenêtre**
= `pente × span` (avec `span = daysBetween(premier, dernier)`), puis compare aux **seuils actuels**.
`null` (fit impossible) → verdict neutre.

### 5.1 `weightTrend` — [bodyweight.ts:18](../../../../packages/shared/src/bodyweight.ts)

Signature élargie aux points datés (les appelants ont déjà `logDate`) :

```ts
// avant : weightTrend(weights: ReadonlyArray<number>): 'up' | 'down' | 'stable'
// après :
export function weightTrend(
  entries: ReadonlyArray<{ logDate: string; weightKg: number }>,
): 'up' | 'down' | 'stable';
```

- `changementTotal = slope × span` (kg sur la fenêtre observée).
- Seuils **inchangés** : `> +0,3 → 'up'`, `< −0,3 → 'down'`, sinon `'stable'`.
- `n < 2` ou `null` → `'stable'` (comme aujourd'hui).

### 5.2 `paceTrend` — [run-stats.ts:51](../../../../packages/shared/src/run-stats.ts)

Signature **inchangée** (`PaceTrendPoint[]` porte déjà `dayKey` + `paceSPerKm`).

- `changementRelatif = (slope × span) / allureMoyenne`, où **`allureMoyenne` = moyenne de tous les
  `paceSPerKm` de la série** (ȳ).
- Seuils **inchangés** : `< −0,02 → 'improving'`, `> +0,02 → 'declining'`, sinon `'stable'`.
- `< 2` points ou `null` → `'stable'`.

> ⚠️ **Changement de diviseur assumé.** L'ancien `paceTrend` divise par `m1` = **moyenne de la 1ʳᵉ
> moitié** (`ratio = (m2 − m1) / m1`, [run-stats.ts:58](../../../../packages/shared/src/run-stats.ts)).
> On retient ici la **moyenne de toute la série** (ȳ) : diviseur stable, cohérent avec « changement
> relatif sur la fenêtre », sans dépendre d'un demi-échantillon. Conséquence : le verdict peut diverger
> de l'ancien **même sur une série monotone** calée juste au seuil ±2 % (pas seulement sur les séries
> non monotones). C'est une divergence **bornée et acceptée** (voir §6), pas un bug — l'objectif
> « iso-comportement » = même contrat de verdict + concordance en pratique, pas bit-à-bit.

### 5.3 Appelants de `weightTrend`

- [nutrition-stats.tsx:60](../../../../apps/mobile/src/app/nutrition-stats.tsx) :
  `weightTrend(weightEntries)` au lieu de `weightTrend(weightEntries.map((e) => e.weightKg))`.
- [WeightCard.tsx:78](../../../../apps/mobile/src/components/dashboard/WeightCard.tsx) :
  `weightTrend(entries)` au lieu de `weightTrend(entries.map((e) => e.weightKg))`.
- Les deux disposent déjà de `logDate` et `weightKg` ; aucune autre logique ne change.

## 6. Cas limites

- **0 ou 1 point** → verdict neutre (`stable`), aucun appel régression significatif.
- **Tous les points le même jour** (variance x nulle) → `linearRegression` renvoie `null` → `stable`.
- **Série constante** (y identiques) → pente 0, R²=1 → `stable`.
- **Points non triés / dates non ordonnées** : le moteur ne dépend pas de l'ordre ; les adaptateurs
  déterminent `base` = clé minimale et `span` sur min/max des clés (ne pas supposer trié).
- **Divergences ancien↔nouveau attendues**, de **deux origines** :
  1. **Changement de moteur** (les deux adaptateurs) : sur séries **non monotones** (pic central), le
     « premier↔dernier » (poids) ou le « ratio des moitiés » (allure) peut classer différemment de la
     pente ajustée.
  2. **Changement de diviseur** (`paceTrend` uniquement, §5.2) : `m1` → moyenne de série ; peut faire
     basculer un verdict d'allure **même sur une série monotone** proche du seuil ±2 %.
  Ces cas sont **découverts empiriquement puis figés** dans le golden test, avec un commentaire
  `// divergence attendue : …`, pas masqués (voir §8). Pour `weightTrend`, aucun changement de
  diviseur : sur toute série linéaire `slope × span = y_last − y_first`, donc la seule origine de
  divergence est le bruit/la non-monotonie (origine 1).
- **Offline** : fonctions pures, zéro I/O, zéro dépendance réseau.

## 7. Surfaçage (ADR-007 §5)

- **Tier : sans objet.** META-08 est de l'**infrastructure** : elle n'ajoute **aucune** surface.
- **Condition d'affichage : inchangée.** Les verdicts de tendance continuent d'apparaître exactement
  là où ils sont déjà : `WeightCard` (dashboard, **Tier 0**), `nutrition-stats` et `running-history`
  (**Tier 1**). Pas de nouveau widget, pas de nouvelle section, R² non exposé.
- **Conforme** au plafond dashboard et au « conditionnel par défaut » : rien n'est ajouté à l'écran.

## 8. Tests

- **Shared (Vitest) — `regression.test.ts`** :
  - droite parfaite → pente exacte, `r2 === 1`, `n` correct ;
  - série bruitée → pente ≈ attendue, `0 < r2 < 1` ;
  - série constante → `slope 0`, `r2 1` ;
  - `n < 2` → `null` ; tous x identiques → `null` ;
  - points fournis **non triés** en x → même résultat que triés ;
  - espacement x **irrégulier** pris en compte (pente en unité/x).
- **Shared — `date.test.ts` (ou bloc dédié)** : `daysBetween` (0, ordre croissant, **passage
  d'année**, mois de 28/30/31 j, robustesse DST via midi UTC).
- **Golden de non-régression** dans `bodyweight.test.ts` et `run-stats.test.ts` : inscrire
  **l'ancienne logique comme oracle**, générer un jeu de **séries représentatives** (monotone ↑/↓,
  plate bruitée, quasi-linéaire, réaliste datée) et **asserter la concordance** du verdict.
  Démarche : **lancer d'abord** pour **découvrir** les divergences réelles (§6, origines 1 et 2), puis
  les **figer** en cas explicites commentés `// divergence attendue : …` — la liste n'est **pas** connue
  a priori. Viser une concordance quasi totale sur les séries monotones ; toute divergence monotone
  d'allure doit s'expliquer par le seuil ±2 % + le diviseur (§5.2), sinon c'est un bug à corriger.
- **Mobile** : typecheck/lint verts ; non-régression visuelle vérifiée à la recette device.

## 9. Definition of Done

- `linearRegression` (pente/intercept/R²/n, `null` sur cas dégénéré) et `daysBetween` **purs et
  testés**, exportés depuis `@wellness/shared`.
- `weightTrend` et `paceTrend` **rebranchés** sur le moteur, **verdicts iso** (golden test vert,
  divergences documentées) ; les 2 appelants de `weightTrend` passent des points datés.
- **Aucune** nouvelle surface UI, **aucune** chaîne i18n nouvelle, **aucune** migration, **pas de
  checkpoint 🔴** (100 % client, offline). Reload Metro suffit.
- typecheck / lint / tests verts sur tous les workspaces.
- Catalogue **META-08 → ✅**. Reste **recette device** (Florian) : le verdict/flèche de tendance du
  **poids** (dashboard + Stats nutrition) et de l'**allure** (Stats running) reste cohérent avec avant
  sur un compte ayant de l'historique.
