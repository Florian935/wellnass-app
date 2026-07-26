---
id: MN-03
titre: "Vue croisée « charge muscu & apports » (8 semaines)"
roadmap: []
catalogue: [MN-03]
etape: close
branche: feature/mn03-vue-croisee-seances-apports
maj: 16/07/2026
---
# US MN-03 — Vue croisée « charge muscu & apports » (8 semaines)

_Spec fonctionnelle. Statut : **validée (Florian, 16/07/2026) — code livré**. Branche :
`feature/mn03-vue-croisee-seances-apports` (depuis `dev`). Stat croisée inter-piliers
(muscu ↔ nutrition) — Phase A du [catalogue d'analyses](../../../product/analyses-donnees.md) (MN-03) :
**déterministe, gratuite, offline, sans IA**. Complète l'alerte 4.32 (MN-02) côté **descriptif**._

## 1. Contexte & objectif

Le différenciateur produit est **l'intégration des piliers** (décision H). L'alerte 4.32 (MN-02, livrée)
**prévient** ponctuellement d'un déséquilibre déficit + fort volume. MN-03 apporte la **lecture
descriptive** correspondante (spec [alimentation §7.3](../alimentation.md) : « Vue croisée : séances
muscu vs apports caloriques de la même semaine ») : un **tableau hebdomadaire** qui met côte à côte, sur
**8 semaines**, la **charge d'entraînement** (séances, tonnage) et les **apports** (kcal/j, protéines/j),
pour répondre d'un coup d'œil à « **est-ce que je mange en cohérence avec ma charge ?** ».

MN-03 est **purement descriptif** : aucune alerte, aucun jugement (l'alerte reste 4.32). Les briques de
calcul existent déjà (`computeVolume`/tonnage, `averageIntake`, `percentChange`, `DeltaBadge`) ; le
périmètre est surtout **agréger par semaine** (fonction pure testée), **câbler** les données locales et
**exposer** un tableau sur l'écran Stats nutrition.

## 2. Périmètre

- **Inclus** : fonction pure `computeWeeklyTrainingNutrition` dans `@wellness/shared` (testée) ; hook
  `useTrainingNutritionCross` (mobile, lecture seule, 2 requêtes locales + gating piliers) ; composant
  présentiel `TrainingNutritionCrossCard` (tableau 8 semaines + mini-tendance `DeltaBadge`) ; câblage
  dans [nutrition-stats.tsx](../../../apps/mobile/src/app/nutrition-stats.tsx) ; i18n FR/EN ; gating
  **piliers actifs** (muscu **et** nutrition) ; mise à jour du catalogue (MN-03 ⏳ → ✅).
- **Exclu (YAGNI)** : score de corrélation / causalité (→ META-20/22, post-V1) ; macros G/L (on garde
  **protéines** seule, macro clé du lien muscu↔nutrition) ; sélecteur de fenêtre (**8 semaines figé**) ;
  export ; couche IA ; toute **alerte** (reste 4.32) ; graphique double-axe (forme = **tableau**, décidé
  au brainstorming).
- **Maquette** : à produire dans **Claude Design** (`design/mn03-vue-croisee/`) avant code, OU écartée au
  profit d'un tableau simple réutilisant `Card` (précédents 4.32, 8.5). **À trancher à la validation.**

## 3. Règles métier

- **Surface** : section « Charge muscu & apports (8 sem) » sur **Nutrition → Stats**, sous les apports
  moyens 7/30 j.
- **Gating piliers** : section affichée **uniquement** si musculation **et** nutrition sont **toutes
  deux** activées (`user_settings.active_pillars`). Sinon : composant rend `null`.
- **Fenêtre** : **8 semaines calendaires** (lundi → dimanche, **jour local**), semaine **courante
  incluse**, affichées **de la plus récente (haut) à la plus ancienne (bas)**. Le début de semaine
  réutilise la logique « lundi local → ISO UTC » déjà employée (`useWeeklyVolumeComparison` /
  `startOfWeekLocalUtc`).
- **Métriques par semaine** (4) :
  1. **Séances** : nombre de `workouts` **terminés** (`status = 'completed'`) dont `finished_at` tombe
     dans la semaine — **indépendant des séries** (une séance sans série qualifiante compte quand même,
     avec tonnage 0). Sourcé via un `LEFT JOIN` (voir §5), pas via la jointure filtrée non-échauffement.
  2. **Tonnage** : Σ(reps × charge) des séries **validées non-échauffement** (`done = 1`,
     `set_type != 'warmup'`, `reps`/`weight_kg` non nuls) des séances terminées de la semaine — mêmes
     filtres que `useWeeklyVolumeComparison`.
  3. **kcal/j** : **moyenne sur les seuls jours loggés** de la semaine (sémantique `averageIntake` —
     jamais diluée par les jours vides).
  4. **Prot/j** : idem, protéines (g).
- **Mini-tendance** : sur **tonnage** et **kcal/j**, un `DeltaBadge` (± %, ton neutre) comparant la
  semaine à **la semaine précédente affichée** (ligne du dessous). La **semaine la plus ancienne** de la
  fenêtre n'a pas de comparateur → `change = null` → **aucun badge monté** (on ne rend **pas** le badge,
  ce n'est **pas** le rendu « nouveau » de `DeltaBadge`). Comparaison **intra-fenêtre** (pas de 9ᵉ
  semaine requêtée, pas de `previousPeriodTodayKey`).
- **Cellule sans donnée** : semaine **sans muscu** → Séances `0`, Tonnage `—` (et pas de delta) ;
  semaine **sans nutrition loggée** → kcal/j `—`, Prot/j `—` (et pas de delta kcal).
- **Unités** : tonnage et charges via `useUnits` (kg/lb) ; kcal/protéines inchangés.
- **Ton** : neutre, factuel (décision H) — aucune recommandation.

## 4. Logique partagée — `@wellness/shared` (pure, testée)

**Réutilise** : `percentChange` (comparison.ts) et le type `PercentChange`, le type `Nutrients`
(food.ts). ⚠️ `averageIntake` **n'est pas appelable directement** (elle opère sur des `Nutrients`
complets kcal+P+G+L ; nos entrées ne portent que `{kcal, proteinG}`) → on **reprend sa sémantique**
(somme ÷ nb de jours loggés, `Math.round`), sans l'appeler. Le calcul reste **pur** : le hook fournit
des entrées déjà lues et déjà bornées, la fonction ne fait **aucune I/O** et n'appelle **pas** `Date`.

```ts
export type WeeklyTrainingNutrition = {
  weekStart: string;          // dayKey lundi (AAAA-MM-JJ, local)
  sessions: number;           // nb de séances terminées de la semaine
  tonnage: number | null;     // Σ reps×kg des séances (null si 0 séance ; 0 possible si séance sans série qualifiante)
  avgKcal: number | null;     // moyenne/jour loggé (null si 0 jour loggé)
  avgProteinG: number | null; // idem protéines
  tonnageChange: PercentChange | null; // vs semaine précédente affichée ; null si pas de base
  kcalChange: PercentChange | null;
};

/**
 * Agrège charge muscu et apports par semaine calendaire sur une fenêtre donnée (descriptif MN-03).
 * Entrées pré-lues et pré-bornées par le hook (offline-first) ; fonction déterministe et pure.
 * @param weekStarts  dayKeys des lundis, de la plus RÉCENTE à la plus ANCIENNE (longueur = nb semaines)
 * @param workouts    UNE entrée par séance terminée : { dayKey, tonnage } (tonnage = Σ non-échauffement, 0 si aucune série)
 * @param dailyKcals  totaux des SEULS jours loggés : { dayKey, kcal, proteinG }
 */
export function computeWeeklyTrainingNutrition(input: {
  weekStarts: ReadonlyArray<string>;
  workouts: ReadonlyArray<{ dayKey: string; tonnage: number }>;
  dailyKcals: ReadonlyArray<{ dayKey: string; kcal: number; proteinG: number }>;
}): WeeklyTrainingNutrition[];
```

Règles internes :
- **Bucketing sans borne haute** (pas de `weekEnd`) : les lundis sont contigus (espacés de 7 j), donc la
  semaine d'un `dayKey` = **le plus grand `weekStart` tel que `weekStart <= dayKey`** (comparaison de
  chaînes ; dayKeys `AAAA-MM-JJ` zéro-paddés donc lexicographiquement ordonnés). Aucune arithmétique de
  date, aucun `Date`.
- **Hors fenêtre ignoré** : tout `dayKey < weekStarts[dernier]` (le lundi le plus ancien) est **écarté**
  (une requête peut renvoyer des lignes légèrement antérieures selon le fuseau).
- `sessions` = nb d'entrées `workouts` de la semaine ; `tonnage` = Σ de leurs `tonnage` (**`null`
  seulement si `sessions === 0`** ; peut valoir 0 si des séances n'ont que de l'échauffement).
- `avgKcal`/`avgProteinG` = somme ÷ **nb de jours loggés de la semaine** (`Math.round`) ; **`null` si 0
  jour loggé**.
- `tonnageChange`/`kcalChange` = `percentChange(valeur_courante, valeur_semaine_précédente_affichée)` ;
  **`null`** pour la **dernière ligne** (pas de précédente dans la fenêtre) **ou** si l'une des deux
  valeurs comparées est `null`.

## 5. Câblage — hook `useTrainingNutritionCross` (mobile)

Repository : `records-repository.ts` (déjà maison des agrégats muscu) **ou** un petit
`cross-repository.ts` dédié (à trancher au plan). Lecture seule, réactif (PowerSync).

- **Bornes (JS, local)** : calcule les **8 lundis locaux** (récent → ancien). Deux bornes de **natures
  différentes** :
  - **borne muscu = ISO UTC** du lundi le plus ancien **à minuit local** — répliquer la construction
    explicite `new Date(y, m, d, 0,0,0,0).toISOString()` de `startOfWeekLocalUtc`
    ([records-repository.ts](../../../apps/mobile/src/data/repositories/records-repository.ts) l.307-321).
    ⚠️ **Ne pas** utiliser `date.ts` `startOfWeek()` (il **préserve l'heure locale** → droppe les
    séances du lundi avant l'heure courante).
  - **borne nutrition = dayKey** (`AAAA-MM-JJ`) du lundi le plus ancien (`localDayKey`) — car
    `useDailyTotals` compare `log_date >= ?` sur des **dayKeys** (lui passer un ISO UTC casse la
    comparaison de chaînes et exclut le jour le plus ancien).
- **Requête muscu** (`finished_at >= borneMuscuISO`) via un **`LEFT JOIN`** `workouts ⟕ workout_sets`
  **groupé par séance** → **une ligne par séance terminée** avec `tonnage = SUM(reps×weight)` des séries
  `done=1 AND set_type<>'warmup' AND reps/weight_kg non nuls` (0 si aucune) → mappe en
  `{ dayKey: localDayKey(finished_at), tonnage }`. `dayKey` calculé **en JS** (règle « jamais de
  `date()` SQL sur de l'UTC »). Le `LEFT JOIN` garantit que **les séances sans série qualifiante sont
  comptées** (cf. §3.1).
- **Nutrition** : `useDailyTotals(borneNutritionDayKey)` → `DailyTotal[]` (jours loggés) →
  `{ dayKey: logDate, kcal, proteinG }`.
- **Gating (au retour, pas avant)** : tous les hooks (`useQuery`, `useDailyTotals`, lecture
  `active_pillars`) sont appelés **inconditionnellement** (règle des hooks React) ; **si** muscu **ou**
  nutrition est inactif, le hook **renvoie `[]`** au moment du retour (même patron que
  `useDeficitVolumeAlert` /
  [dashboard-repository.ts](../../../apps/mobile/src/data/repositories/dashboard-repository.ts) l.656-675).
- Compose via `computeWeeklyTrainingNutrition` et renvoie `{ weeks, isLoading }`.
- ⚠️ Ne **pas** réutiliser `useMuscleVolumeThisWeek`/`useWeeklyVolumeComparison` (semaine unique) ni
  boucler des hooks — on lit brut puis on agrège dans la fonction pure.

## 6. UI — `TrainingNutritionCrossCard` (présentiel)

- **Conditionnel** : `weeks.length === 0` **et** gating KO → `null`. Gating OK mais **aucune donnée**
  8 sem (débutant) → **empty state** doux (message i18n + éventuel CTA « démarrer une séance »/« logger
  un repas », à l'image des autres sections).
- **Tableau** : lignes = semaines (récente en haut, **mise en avant** visuelle), colonnes
  **Semaine | Séances | Tonnage | kcal/j | Prot/j**. Libellé semaine = plage `JJ/MM–JJ/MM` (semaine
  courante = libellé i18n « Cette semaine »). Tonnage/kcal accompagnés du `DeltaBadge` quand disponible.
- Valeurs `null` → « — ». Tonnage via `useUnits`. Lisibilité thème clair/sombre. Défilement vertical
  géré par l'écran (pas de scroll interne).
- S'insère dans [nutrition-stats.tsx](../../../apps/mobile/src/app/nutrition-stats.tsx) après la section
  apports moyens.

## 7. i18n (FR + EN, parité)

Namespace `stats.cross.*` (ou `stats.trainingNutrition.*`) : titre de section, en-têtes de colonnes,
« Cette semaine », libellé empty state, unités déjà gérées par `useUnits`. Aucune chaîne en dur ;
parité FR/EN vérifiée (compteur i18n vert). `DeltaBadge` réutilise ses propres libellés existants.

## 8. Cas limites

- **Un pilier inactif** (muscu ou nutrition) → section absente (rend `null`).
- **Aucune donnée sur 8 sem** (piliers actifs) → empty state (pas de tableau vide).
- **Semaine sans muscu** → Séances 0 / Tonnage — / pas de delta tonnage.
- **Semaine sans nutrition** → kcal/j — / Prot/j — / pas de delta kcal.
- **Semaine la plus ancienne** → jamais de badge (pas de base de comparaison dans la fenêtre).
- **Semaine partielle** (courante en cours, peu de jours loggés) → moyenne sur les jours réellement
  loggés (peut être bruitée : accepté, cohérent avec `averageIntake` ; pas d'avertissement).
- **Offline** : 100 % données locales → fonctionne hors-ligne, réactif à toute nouvelle saisie.
- **Changement de semaine / minuit / DST** : bornes calculées en local comme l'existant (pas de
  régression attendue ; mêmes helpers).

## 9. Tests

- **Shared (Vitest)** — `computeWeeklyTrainingNutrition` :
  - bucketing correct par semaine (une séance/jour à la frontière lundi/dimanche tombe dans la bonne
    semaine) ;
  - `sessions`/`tonnage` = comptage/somme attendus ; `tonnage = null` **seulement si 0 séance** ; une
    **séance sans série qualifiante** est **comptée** (`sessions += 1`, `tonnage` = 0 pour elle) ;
  - `dayKey` **hors fenêtre** (antérieur au lundi le plus ancien) → **ignoré** (ne pollue aucune semaine) ;
  - `avgKcal`/`avgProteinG` = moyenne **sur jours loggés** (jours vides ignorés) ; `null` si 0 jour ;
  - `tonnageChange`/`kcalChange` = `percentChange` vs semaine précédente affichée ; **`null` sur la
    dernière ligne** ; `null` si une valeur comparée est `null` ;
  - fenêtre de 8 semaines respectée (longueur & ordre récent→ancien).
- **Mobile** : `typecheck` + `lint` + `build` verts ; smoke test du composant (rendu avec données /
  vide / gating KO → `null`) si le patron de test composant est en place.

## 10. Definition of Done

- Section « Charge muscu & apports (8 sem) » sur Nutrition → Stats : tableau 8 semaines (récente en
  haut), 4 métriques + mini-tendance tonnage & kcal, cellules « — » gérées, empty state, **gating
  muscu + nutrition**.
- Logique pure testée dans `@wellness/shared` ; typecheck/lint/(build)/tests verts ; parité i18n FR/EN.
- Catalogue [analyses-donnees.md](../../../product/analyses-donnees.md) : MN-03 ⏳ → ✅.
- **100 % client, offline — aucune migration, aucun cloud, aucune dépendance native (pas de checkpoint
  🔴).** Reste : **recette device** (vérifier valeurs/tendances sur données réelles, cellules « — »,
  gating en (dés)activant un pilier, empty state) + relecture Damien.
