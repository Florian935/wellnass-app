# Plan d'implémentation — INSIGHTS-01

> Spec : [insights01-ecran-insights.md](../specs/functional/us/insights01-ecran-insights.md)
> (**révision 2** — le moteur est une table ordonnée, pas un score ; 9 sources, pas 13)
> Branche : `feature/insights01-ecran-insights` · Créée depuis `origin/dev` le 04/08/2026

## 0. Ce que ce plan garantit d'emblée

| Question | Réponse | Conséquence |
|---|---|---|
| Migration base ? | **Non** | Rien à pousser, `supabase/MIGRATIONS.md` inchangé |
| Sync rule PowerSync ? | **Non** | Pas d'étape manuelle sur le dashboard (celle qu'on a déjà oubliée une fois) |
| Dépendance native neuve ? | **Non** | **Recettable sur l'APK existant** — rare, à signaler à Florian |
| Réseau ? | **Non** | Offline intégral, mode avion identique |
| Nouvelle analyse calculée ? | **Non** | Uniquement de la sélection au-dessus de briques livrées |
| Modification de code livré ? | **Une seule**, bornée | `useTrainingLoadAlert` cesse de jeter son ratio (spec §2.5) |

⚠️ **Prérequis machine** : `nvm use 24` avant toute commande de test. `.nvmrc` est passé à Node 24
(`node:sqlite`) ; sur Node 20 la suite mobile échoue à l'import du harness sans dire pourquoi.

## 1. Ordre de build

Strictement du pur vers l'impur — c'est ce qui permet de tout tester avant qu'un pixel existe.

```
Lot 0  Moteur pur              packages/shared          TDD strict, 100 % de couverture
Lot 1  Adaptateurs purs        packages/shared          TDD strict — 9 fonctions
Lot 2  Le ratio ACWR           apps/mobile/data         modif bornée d'un hook livré
Lot 3  Agrégateur mobile       apps/mobile/data         tests avec harness SQLite
Lot 4  Écran + cartes          apps/mobile/app          tests d'écran (await act)
Lot 5  Porte d'entrée          apps/mobile              dépend de D3
Lot 6  i18n FR + EN            apps/mobile/i18n         test de symétrie des clés
Lot 7  Amendement ADR-007      docs/adr                 dépend de D1
Lot 8  Vérification finale     racine                   typecheck + lint + coverage
```

Chaque lot se termine vert. Aucun lot ne démarre sur un précédent rouge.

---

## Lot 0 — Le moteur pur

**Fichier neuf** : `packages/shared/src/insights.ts` · **Test** : `insights.test.ts` (Vitest)
**Export** : ajouter la ligne dans `packages/shared/src/index.ts`

```ts
export const INSIGHT_FAMILIES = ['alert', 'change', 'celebration'] as const;
export type InsightFamily = (typeof INSIGHT_FAMILIES)[number];

/** L'ordre de ce tableau EST la priorité (spec R2). Seul endroit où elle est encodée. */
export const INSIGHT_ORDER = [
  'overtraining_guard', 'training_load', 'deficit_volume',
  'record_recent', 'goal_achieved',
  'weekly_decision', 'muscle_neglected', 'tonnage_change', 'distance_change',
] as const;
export type InsightId = (typeof INSIGHT_ORDER)[number];

export const MAX_INSIGHTS = 3;
export const MAX_PER_FAMILY = 2;
export const STALE_AFTER_DAYS = 14;
export const NOTABLE_CHANGE_PCT = 15;

export type InsightCandidate = { /* cf. spec §3 R1 */ };
export type SelectedInsight = InsightCandidate & { rank: number };

export function isStale(occurredOn: string | null, todayKey: string): boolean;
export function selectInsights(input: {
  candidates: ReadonlyArray<InsightCandidate>;
  activePillars: ReadonlyArray<Pillar>;
  todayKey: string;              // R8 — JAMAIS lu depuis l'horloge ici
}): SelectedInsight[];
```

### Tests à écrire d'abord

| # | Cas | Attendu |
|---|---|---|
| 1 | Aucun candidat | `[]` — R4 |
| 2 | 1 candidat | 1 sélectionné, `rank: 0` |
| 3 | 5 candidats de familles variées | exactement 3 |
| 4 | 4 alertes, rien d'autre | **2** cartes, pas 3 — R3 |
| 5 | 3 alertes + 1 célébration | 2 alertes + 1 célébration |
| 6 | Ordre respecté | la sortie suit `INSIGHT_ORDER`, pas l'ordre d'entrée |
| 7 | Candidat daté à 15 j | écarté — R2 bis |
| 8 | Candidat daté à 14 j pile | **conservé** (borne inclusive, à figer) |
| 9 | Candidat non daté | jamais écarté par l'âge, quel que soit `todayKey` |
| 10 | `occurredOn` dans le futur | conservé, jamais traité comme périmé |
| 11 | Même entrée jouée 2× | sortie **strictement identique** |
| 12 | Candidat d'un pilier inactif | filtré avant classement — R5 |
| 13 | Tous les candidats de piliers inactifs | `[]` |
| 14 | `metrics: {}` (vide) | candidat **écarté** — R1 exige non vide |
| 15 | `metrics` contenant `NaN` / `Infinity` | candidat **écarté** |
| 16 | Un id absent d'`INSIGHT_ORDER` | écarté, sans jeter |

⚠️ **Cliquet de couverture** : `packages/shared` est à **100 %** instructions/fonctions/lignes et
**97 %** branches, appliqués par la CI. Un `if` défensif non testé fait rougir tout le workspace.
Le TDD n'est pas ici une préférence : c'est ce qui rend le seuil tenable.

---

## Lot 1 — Les adaptateurs purs

**Fichier neuf** : `packages/shared/src/insight-adapters.ts` + son test.

Neuf fonctions pures, une par source. Chacune prend la sortie **déjà calculée** du signal et renvoie
`InsightCandidate | null` (`null` = rien à dire maintenant).

```ts
candidateFromOvertrainingGuard(r: OvertrainingGuardResult): InsightCandidate | null
candidateFromTrainingLoad(r: TrainingLoadAlert): InsightCandidate | null      // exige le lot 2
candidateFromDeficitVolume(r: DeficitVolumeAlert): InsightCandidate | null
candidateFromRecentRecord(records: ReadonlyArray<RecentStrengthRecord>): InsightCandidate | null
candidateFromGoalAchieved(progress: ReadonlyArray<GoalProgress>): InsightCandidate | null
candidateFromWeeklyDecision(review: WeeklyReview): InsightCandidate | null
candidateFromMuscleBalance(b: MuscleBalance): InsightCandidate | null
candidatesFromWeeklyChanges(review: WeeklyReview): InsightCandidate[]         // tonnage + distance
```

**Pourquoi dans `shared` et pas dans le repository** : ce sont des transformations pures, donc
testables sans React ni base — et c'est là que vivent les règles (quels `metrics`, quelle date). Le
repository ne contient que du câblage.

**Règles à figer dans les tests** :
- `occurredOn` = la date réelle du fait quand elle existe (`achievedAt` du record, `period.end` du
  bilan), `null` sinon. **Ne jamais mettre `todayKey` par défaut** — ce serait affirmer une
  fraîcheur fausse.
- `candidatesFromWeeklyChanges` applique le seuil **±15 %** (`NOTABLE_CHANGE_PCT`) et rend `[]` sur
  `pct === null` (spec R9).
- `candidateFromMuscleBalance` renvoie **un seul** candidat : le groupe à la plus faible part, même
  si `neglected` en contient plusieurs (spec §7).
- `candidateFromGoalAchieved` filtre sur `GoalStatus === 'achieved'`. **Pas de jalon** — un jalon
  n'est pas une récompense (OBJ-01 D4, spec §2.4).
- Tout `NaN`/`Infinity` en entrée ⇒ `null` en sortie.

Un test par fonction, plus : chaque adaptateur rend `null` sur son entrée « rien à dire », et des
`metrics` **non vides** sur son entrée nominale — R1 rendu exécutable.

---

## Lot 2 — Le ratio ACWR cesse d'être jeté

**Fichier modifié** : `apps/mobile/src/data/repositories/dashboard-repository.ts`

```diff
- export type TrainingLoadAlert = { show: boolean };
+ export type TrainingLoadAlert = { show: boolean; ratio: number | null };

- return { show: result?.showAlert ?? false };
+ return { show: result?.showAlert ?? false, ratio: result?.ratio ?? null };
```

Plus les deux `return { show: false }` de la garde pilier, à compléter en `ratio: null`.

**Test** : étendre le test existant du hook au nouveau champ — ratio présent quand l'alerte se
déclenche, `null` quand la garde pilier coupe.

**Non touché** : le widget `training-load`, qui continue de ne lire que `show`. Aucune régression
possible sur l'accueil. C'est la **seule** modification de code livré de toute l'US ; toute autre
envie d'en modifier un doit remonter en revue, pas être décidée en codant.

---

## Lot 3 — L'agrégateur mobile

**Fichier neuf** : `apps/mobile/src/data/repositories/insights-repository.ts`
**Test** : `apps/mobile/src/data/repositories/__tests__/insights-repository.test.ts`

```ts
export function useInsights(): { insights: SelectedInsight[]; isLoading: boolean };
/** Point de gating unique (spec D1). Retourne `true` en V1. */
export function canAccessInsights(): boolean;
```

Contraintes, toutes non négociables :
- **Tous les hooks appelés inconditionnellement** (règle des hooks + React Compiler). Le filtrage
  n'intervient qu'au retour — patron de `useOvertrainingGuardAlert`.
- 🔴 **`todayKey` vient de `useTodayDate()`**, jamais d'une lecture d'horloge dans le corps du hook.
  Piège documenté : React Compiler gèle la valeur dans un slot mount-only, et la sélection resterait
  figée jusqu'au redémarrage de l'app. C'est la raison d'être du critère de recette 14.
- 🔴 **Aucune requête SQL neuve.** Les hooks réutilisés portent déjà les leurs. GARDE-01 a dû
  défaire un appel imbriqué qui instanciait une seconde fois les mêmes requêtes
  (`dashboard-repository.ts:1129-1132`) : ne pas rejouer ça. Si une duplication apparaît, la
  mutualiser.
- `isLoading` vrai tant qu'une source l'est — sinon l'écran affiche « rien à signaler » puis
  3 cartes, en flash.

Tests via le harness SQLite en mémoire (`src/test-utils/sqlite-harness.ts`), patron
`useAuthDeepLink.test.tsx` : **rendre dans un `await act`**, sinon les effets ne tournent pas et le
test est un faux vert (§3.6 de la stratégie de tests).

---

## Lot 4 — L'écran

**Fichiers neufs** :
- `apps/mobile/src/app/insights.tsx`
- `apps/mobile/src/components/insights/InsightCard.tsx`
- `apps/mobile/src/app/__tests__/insights-smoke.test.tsx`

**Fichier modifié** : `apps/mobile/src/app/_layout.tsx` — ajouter le `Stack.Screen name="insights"`.

> ⚠️ **Leçon PAS-01.** Un écran ajouté sans sa déclaration de route n'échoue **ni au typecheck ni
> aux tests** : le titre se dessine sous la barre d'état, et seul un œil sur l'écran le voit.
> Critère de recette 2.

Structure : `ScreenHeader` + lead + 0 à 3 `InsightCard` + état vide. Patron repris de
[cycle/insights.tsx](../../apps/mobile/src/app/cycle/insights.tsx) — même problème déjà résolu
(blocs conditionnels, formulations en i18n). Ajouter dans les **deux** fichiers un commentaire
d'en-tête pointant vers l'autre (spec D4 : deux écrans homonymes cohabitent délibérément).

`InsightCard` : chip de famille, titre, corps interpolé, chiffres en gras. Accessibilité dès
l'écriture — CONF-07 vient de solder le chantier WCAG AA, le rouvrir serait du travail perdu :
- label = titre puis corps, ordre de lecture = ordre visuel (critère 13) ;
- contrastes AA en clair **et** en sombre ;
- hauteurs libres, jamais de `height` fixe (police 1,5×, critère 11) ;
- la couleur de famille est **doublée** par le chip textuel — jamais l'information par la couleur
  seule.

---

## Lot 5 — La porte d'entrée

**Dépend de l'arbitrage D3.** Ne pas coder avant la réponse de Florian.

### Si D3-A (proposition) — widget `insights` sur l'accueil

| Fichier | Modification |
|---|---|
| `packages/shared/src/widgets.ts` | `'insights'` **en fin** de `HOME_WIDGET_IDS` (comme les 8 précédents : `resolveScreenLayout` complète les layouts stockés, **aucune migration de `dashboard_layout`**) |
| `packages/shared/src/widgets.test.ts` | Étendre les cas existants au nouvel id |
| `apps/mobile/src/components/DashboardWidget.tsx` | Rendu compact = la carte de tête seule |
| `apps/mobile/src/app/(tabs)/index.tsx` | **`isWidgetActive`** : `if (id === 'insights') return insightsActive;` |

> 🔴 **La ligne `isWidgetActive` est le point critique du lot.** L'oublier laisse un trou dans la
> grille — le défaut qui s'est produit **quatre fois** (`training-load`, `overtraining-guard`,
> `readiness`, `activity-level-suggestion`). Elle part **dans le même commit** que le widget, et le
> critère de recette 15 la vérifie.

### Si D3-B — ligne d'entrée sur Progression

`apps/mobile/src/app/progress/index.tsx` : un `Pressable` vers `/insights`, patron exact de l'entrée
`/measurements`. Plus simple, zéro modification de l'accueil, et n'ajoute pas le coût de montage de
l'agrégateur à l'écran le plus fréquenté (spec §6).

---

## Lot 6 — i18n

**Fichiers** : `apps/mobile/src/i18n/locales/fr.json` et `en.json` (2 526 lignes chacun, à garder
symétriques). Nouvelle section racine `insights` (arborescence en spec §5) — **9 cartes × 2 clés**,
plus l'écran et le widget.

⚠️ **Formater les nombres avant `t()`.** `t('cle', { valeur: 41.2 })` interpole `"41.2"` : i18next
n'a aucun formatage par défaut. Piège n° 3 de `bonnes-pratiques.md`, à l'origine de trois défauts en
recette le 31/07.

Test : symétrie des clés FR/EN sur la nouvelle section.

---

## Lot 7 — Amendement d'ADR-007

**Dépend de D1.** Si « gratuit » est retenu : ajouter à
[ADR-007](../adr/ADR-007-surfacage-analyses.md) §2 une note datée disant que le Tier 3 est livré
**gratuit** en V1, pourquoi (SOCLE-01 différée, aucun entitlement, aucun paywall), et où se trouve
le point de gating (`canAccessInsights()`).

Écrit **dans cette US**, pas promis : sans ça, le prochain lecteur de l'ADR reconstruira un gating
qui n'existe pas.

---

## Lot 8 — Vérification finale

```bash
nvm use 24
npm run typecheck
npm run lint
npm run test:coverage     # ce que lance la CI — seuils appliqués
```

⚠️ **Lire le code de sortie sans pipe.** Un `| tail` en aval renvoie 0 même quand un test échoue.

Puis : entrée CHANGELOG, `etape: recette`, section dans RECETTES.md (16 critères), roadmap **7.20**
à ✅, `node scripts/etat.mjs`. Le tout via `/commit`.

---

## 2. Fichiers touchés — récapitulatif

**Neufs (9)**
```
packages/shared/src/insights.ts                                      + .test.ts
packages/shared/src/insight-adapters.ts                              + .test.ts
apps/mobile/src/data/repositories/insights-repository.ts
apps/mobile/src/data/repositories/insights-context.tsx        ← non prévu, voir ci-dessous
apps/mobile/src/app/insights.tsx
apps/mobile/src/components/insights/InsightCard.tsx
apps/mobile/src/app/__tests__/insights-smoke.test.tsx
```

**Modifiés (6 à 9 selon D3)**
```
packages/shared/src/index.ts
apps/mobile/src/data/repositories/dashboard-repository.ts   ← lot 2, seule modif de code livré
apps/mobile/src/app/_layout.tsx
apps/mobile/src/app/cycle/insights.tsx                      ← commentaire d'en-tête seul (D4)
apps/mobile/src/i18n/locales/fr.json · en.json
docs/adr/ADR-007-surfacage-analyses.md                      ← lot 7, si D1 = gratuit
— si D3-A : widgets.ts, widgets.test.ts, DashboardWidget.tsx, (tabs)/index.tsx
— si D3-B : progress/index.tsx
```

**Non touchés, délibérément** : `weekly-review.ts` (§2.6), les hooks de signal autres que celui du
lot 2, toute migration, toute sync rule.

## 2 bis. Écarts au plan, constatés à la livraison (05/08/2026)

| Écart | Décision |
|---|---|
| **`__tests__/insights-repository.test.ts` n'a pas été écrit** | Assumé. La convention du dépôt teste le **SQL** des repositories, pas les hooks (`*-sql.test.ts`), et toute la règle a été remontée dans `buildInsightCandidates` (`shared`), testée à 100 %. Le repository ne contient plus que du câblage. |
| **`insights-context.tsx` ajouté**, non prévu | La duplication de montage annoncée au §6 de la spec est apparue : sans lui, l'accueil montait deux fois l'union de 8 hooks. |
| **`resolveInsightSubject` extraite** de `InsightCard` | Correctif d'un défaut bloquant trouvé en revue — le widget affichait la clé `back` là où l'écran affichait « Dos ». Les deux surfaces partagent désormais la résolution. |
| **5 tests de plus** que prévu sur la résolution du sujet | Verrouillent le correctif ci-dessus. |

## 3. Risques

| Risque | Parade |
|---|---|
| Réintroduire un score et des `severity` inventées | Interdit par R2, qui documente les 3 défauts constatés |
| Rajouter une des 4 sources retirées | Spec §2.4 donne le motif de chacune |
| Sélection gelée par React Compiler | `useTodayDate()` injecté (R8) + critère de recette 14 |
| Requêtes SQL dupliquées au montage | Contrainte du lot 3, précédent GARDE-01 cité |
| Redoubler le moteur de BILAN-01 | Interdit §2.6, `decide` n'est même pas exportée |
| Le cliquet 100 % de `packages/shared` rougit | TDD strict aux lots 0-1 |
| Trou dans la grille de l'accueil (D3-A) | `isWidgetActive` dans le même commit + critère 15 |
| En-tête cassé (leçon PAS-01) | Route déclarée au lot 4 + critère 2 |
| Faux vert sur les tests d'écran | Rendre **dans** `await act` |
| Nombres bruts à l'écran (`41.2000001`) | Formatage avant `t()` (lot 6) + critère 5 |
| Dérive vers du conseil de santé | R6 : le moteur ne renvoie que des id et des nombres |
