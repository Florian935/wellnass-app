# Plan d'implémentation — INSIGHTS-02

> Spec : [insights02-degonflage-tier0.md](../specs/functional/us/insights02-degonflage-tier0.md)
> (**révision 2** — 21 → **7**, **4** écrans orphelins, **2** destinations à créer)
> Branche : `feature/insights02-degonflage-tier0` · Créée depuis `origin/dev` le 05/08/2026
> Suite d'INSIGHTS-01 (7.20), livrée le 05/08/2026 (`c079055`).

## 0. Ce que ce plan garantit d'emblée

| Question | Réponse |
|---|---|
| Migration base / de données / sync rule ? | **Non** — `resolveScreenLayout` ignore les ids inconnus |
| Dépendance native neuve ? | **Non** → recettable sur l'APK existant |
| Analyse nouvelle calculée ? | **Non** |
| Fonctionnalité supprimée ? | **Aucune** — le lot 0 existe pour le prouver, pas pour l'affirmer |

⚠️ **`nvm use 24`** avant toute commande de test.
⚠️ **Bloqué sur D2** (surface de rattrapage) : le lot 2 ne peut pas démarrer sans.
⚠️ **Bloqué sur D3 et D4** pour les lots 3 et 4 bis.

## 1. Ordre de build

L'ordre n'est pas cosmétique : **on construit les destinations avant de retirer les sources.** À
aucun commit intermédiaire un signal ne doit être inatteignable.

```
Lot 0   Inventaire exécutable des destinations   shared     prouve R1 AVANT tout retrait
Lot 1   Les 2 nouveaux insights + R3             shared     ratios nullables
Lot 2   Les destinations manquantes              mobile     2 à créer + surface D2  ← bloqué D2
Lot 3   readiness                                shared+mob ← bloqué D3
Lot 4   Le dégonflage                            shared+mob 21 → 7
Lot 4b  Compaction horizontale                   shared     ← bloqué D4
Lot 5   Le plafond exécutable                    shared     2 assertions
Lot 6   Nettoyage isWidgetActive                 mobile     7 hooks dédoublonnés
Lot 7   i18n + ADR + correction INSIGHTS-01
Lot 8   Vérification
```

---

## Lot 0 — L'inventaire exécutable des destinations

**Fichier neuf** : `packages/shared/src/widget-destinations.ts` + son test.

Avant tout retrait, on écrit la table des destinations et un test qui vérifie qu'**aucun id du
registre d'avant n'est laissé sans destination permanente**.

```ts
export type WidgetDestination =
  | { kind: 'home' }
  /** Alerte : conditionnelle par nature, elle n'a jamais eu de destination permanente. */
  | { kind: 'alert-insight'; id: InsightId }
  /** Écran atteignable en 2 gestes. `path` documente le chemin, et sert la recette. */
  | { kind: 'screen'; route: string; path: string };

/** Le registre **d'avant** le dégonflage, figé — sans lui le test s'auto-viderait. */
export const HOME_WIDGET_IDS_V1 = [...] as const;
export const WIDGET_DESTINATIONS: Record<HomeWidgetIdV1, WidgetDestination>;
```

> 🔴 **`kind: 'alert-insight'` est réservé aux 5 alertes du §3.2 de la spec.** Il est **interdit**
> pour les 8 signaux du §3.3 : une carte d'insight est conditionnelle (≤ 3 affichées, quota de
> famille, porte de fraîcheur), donc elle ne garantit rien. C'est la confusion que la relecture a
> relevée, et le test doit l'empêcher de revenir.

**Tests** :
1. les **21** ids d'avant ont une destination ;
2. exactement **7** ont `kind: 'home'` ;
3. `alert-insight` n'est utilisé que par les 5 alertes, et chaque `id` existe dans `INSIGHT_ORDER` ;
4. chaque `screen` a une `route` et un `path` non vides ;
5. aucun id de `HOME_WIDGET_IDS` (registre d'après) n'est absent de `HOME_WIDGET_IDS_V1`.

---

## Lot 1 — Les deux nouveaux insights + R3

### 1a — Les ratios cessent d'être jetés (R3)

⚠️ **Pas « deux lignes ».** `computeConcurrentTrainingInterference` a **4 sites de retour**
(`training-time.ts`), dont **deux** sont atteints quand un ratio n'est pas calculable.

```diff
  export type ConcurrentTrainingInterference = {
    show: boolean; direction: ConcurrentTrainingInterferenceDirection | null;
+   runRatio: number | null;
+   strengthRatio: number | null;
  };
```

Les 4 retours renseignent les deux champs. Le widget existant n'est pas modifié. Étendre ses tests,
**dont le cas des ratios nuls**.

### 1b — Deux entrées dans `INSIGHT_ORDER` (spec §6)

```
overtraining_guard · training_load · concurrent_interference · deficit_volume · activity_level · record_recent · …
                                     ^^^^^^^^^^^^^^^^^^^^^^^                    ^^^^^^^^^^^^^^
```

### 1c — Deux adaptateurs

```ts
candidateFromInterference(r: ConcurrentTrainingInterference): InsightCandidate | null
// null si show=false OU si l'un des deux ratios est null (le type nullable de 1a le rend possible)
// metrics { runRatio, strengthRatio } arrondis à 2 déc. · variant: direction

candidateFromActivityLevel(s: ActivityLevelSuggestion): InsightCandidate | null
// metrics { runningDays } · variant: niveau suggéré · pillars ['running','nutrition']
```

Mêmes règles qu'au lot 1 d'INSIGHTS-01. `InsightSources` et `buildInsightCandidates` s'étendent —
leurs tests aussi.

---

## Lot 2 — Les destinations manquantes ⚠️ bloqué sur D2

Quatre chantiers, tous révélés par la relecture :

| À créer | Détail |
|---|---|
| **Surface de rattrapage (D2)** | Section « Suivi » sur Profil → `/goals`, `/wellbeing`, `/review` (+ `/steps` si D1 = 6). **4 écrans orphelins**, pas 3 : `/review` n'a que son widget, la notification hebdo **ne route pas** (aucun handler de réponse n'existe dans l'app). |
| **Destination de `record-recent`** | `/progress` › Records est **par exercice** ; le widget montre le dernier record tous piliers + les 4 derniers. Contenu à créer, ou widget à déplacer vers le hub muscu. |
| **Destination de `training-time`** | Aucune aujourd'hui. ⚠️ Sa garde est `['strength','running']` et la carte ventile les deux : le placer sur le **hub muscu** le rendrait invisible à un coureur seul (les onglets sont gatés par pilier). Prévoir **deux emplacements**, ou un écran transverse. |
| *(vérifications)* | `running-week` → la destination réelle est **`/running-history` › Stats** (le hub course montre la *dernière course*). `muscle-volume` occupe **deux** sections de Progression, pas une. |

---

## Lot 3 — `readiness` ⚠️ bloqué sur D3

Si **B** (proposition) : la spec §5 bis le spécifie entièrement — id `readiness`, famille `alert`,
position après `training_load`, déclenchement sur `verdict === 'rest'` seul,
`metrics { negativeCount, availableCount }`, `occurredOn: null`. `ReadinessResult` gagne les deux
comptes, dérivés des 3 composantes déjà calculées.

Si **A** : plafond du lot 5 à 8, documenté. Si **C** : au registre du hub muscu, avec la même
réserve de gating que `training-time`.

---

## Lot 4 — Le dégonflage

`HOME_WIDGET_IDS` : 21 → **7**. En cascade :
- `WIDGET_REGISTRY.home.pillars` : retirer les 14 gardes ;
- `dashboard-widgets.tsx` : retirer les 14 entrées de `WIDGET_COMPONENTS` **et leurs imports**
  (le `Record<HomeWidgetId, …>` casse la compilation tant que ce n'est pas fait — c'est un garde-fou,
  pas une gêne) ;
- `widgets.test.ts` : compteurs.

**Sort des composants `*Card.tsx`** — la relecture a relevé que la spec ne le disait pas :

| Composant | Sort |
|---|---|
| `DeficitVolumeAlertCard`, `TrainingLoadAlertCard`, `OvertrainingGuardCard`, `ActivityLevelSuggestionCard`, `ConcurrentTrainingInterferenceCard` | **Supprimés** — leur signal vit désormais en carte d'insight |
| `RecordRecentCard`, `TrainingTimeCard` | **Conservés et déplacés** vers la destination du lot 2 |
| `MuscleVolumeCard`, `RunningWeekCard`, `WeightCard`, `StepsCard`, `WellbeingCard`, `GoalsCard`, `ReviewCard` | **Conservés tels quels** — leur écran de destination existe déjà ; seul leur point d'entrée change |
| `ReadinessCard` | Selon D3 |

> On ne supprime **aucun** composant dont la destination n'est pas encore en place. Un composant
> orphelin est du code mort visible ; un composant supprimé trop tôt est une fonctionnalité perdue.

---

## Lot 4 bis — Compaction horizontale ⚠️ bloqué sur D4

`compactVertical` (`widgets.ts`) ne réajuste que `row`, **jamais `col`**. Retirer 14 widgets d'un
coup est exactement le cas où ça se voit : deux `small` sur une ligne, celui de gauche disparaît,
celui de droite **reste à droite**.

Si D4 = compaction : étendre l'algorithme au placement first-fit en (ligne, colonne), en conservant
l'ordre relatif. **Tests obligatoires** : ligne à deux `small` dont un retiré, ligne à un `wide`
retiré, alternance `small`/`wide`, et **idempotence** (compacter deux fois donne le même résultat).

---

## Lot 5 — Le plafond exécutable (R4)

```ts
it('ne dépasse pas le plafond Tier 0 d’ADR-007 §2', () => {
  // 21 le 05/08/2026, soit 3,5× le plafond, parce qu'un plafond écrit dans un ADR ne casse rien
  // quand on le franchit. Celui-ci casse la CI. Le dépasser reste possible — il faut modifier
  // cette ligne, donc en faire un arbitrage conscient. C'est ce que l'ADR demandait depuis le 16/07.
  expect(HOME_WIDGET_IDS.length).toBeLessThanOrEqual(MAX_HOME_WIDGETS);
});

it('déclare une garde pour chaque widget d’accueil', () => {
  // Un id sans garde s'affiche à tout le monde par accident — plus insidieux qu'un dépassement.
  for (const id of HOME_WIDGET_IDS) expect(WIDGET_REGISTRY.home.pillars[id]).toBeDefined();
});
```

---

## Lot 6 — Nettoyage (R6)

`isWidgetActive` ne garde que `activation-path` et `insights`. Retirer les 5 autres branches **et
leurs appels de hook** : c'est là qu'est le gain. Avec les 4 widgets lourds partis, **7 hooks**
cessent d'être montés deux fois sur l'accueil. À **constater** et à écrire au CHANGELOG.

`InsightsProvider` reste : le widget `insights` en dépend.

---

## Lot 7 — Documentation

- i18n : les 2 (ou 3) nouvelles cartes + la surface D2.
- **ADR-007 §2** : note datée — plafond appliqué par un test.
- **INSIGHTS-01 §2.4** : corriger la ligne `activity_level` (elle nie à tort l'existence de
  `runningDays`).

---

## Lot 8 — Vérification

```bash
nvm use 24
npm run typecheck && npm run lint && npm run test:coverage
```

⚠️ Codes de sortie **sans pipe**, et relancer les 3 workspaces **séparément** : le run agrégé n'a
pas toujours restitué la sortie des trois (constaté le 05/08/2026 — codes bons, log partiel).

Puis la **vérification manuelle des 14 chemins** (critère de recette 4) : c'est le seul moyen de
prouver R1 sur device.

---

## 2. Fichiers touchés

**Neufs** : `packages/shared/src/widget-destinations.ts` (+ test) · la surface D2.

**Modifiés** :
```
packages/shared/src/widgets.ts · widgets.test.ts        ← 21 → 7, plafond, gardes, compaction
packages/shared/src/training-time.ts (+ test)           ← R3, ratios nullables
packages/shared/src/insights.ts                         ← 2 (ou 3) entrées d'ordre
packages/shared/src/insight-adapters.ts (+ test)        ← 2 (ou 3) adaptateurs
packages/shared/src/readiness.ts (+ test)               ← si D3 = B
apps/mobile/src/data/repositories/insights-repository.ts
apps/mobile/src/components/dashboard/dashboard-widgets.tsx
apps/mobile/src/app/(tabs)/index.tsx                    ← isWidgetActive allégé
apps/mobile/src/app/profile.tsx (ou équivalent D2)
apps/mobile/src/i18n/locales/fr.json · en.json
docs/adr/ADR-007-surfacage-analyses.md
docs/specs/functional/us/insights01-ecran-insights.md   ← correction §2.4
```

## 3. Risques

| Risque | Parade |
|---|---|
| **Perdre une fonctionnalité en silence** — risque n°1 | Lot 0, écrit **avant** tout retrait, et qui **interdit** de compter un insight comme destination |
| Prendre une carte d'insight pour une destination | Type `alert-insight` réservé aux 5 alertes, vérifié par test |
| 4 écrans orphelins | R5 + lot 2, bloqué sur D2 |
| Demi-cellule vide après recompaction | Lot 4 bis, bloqué sur D4 |
| `training-time` invisible aux coureurs | Signalé au lot 2 : deux emplacements ou écran transverse |
| Supprimer un composant encore nécessaire | Lot 4 : tableau explicite du sort de chacun |
| Le plafond se refait dépasser | Lot 5 : test qui casse la CI |
| Conflit de merge sur `(tabs)/index.tsx` | D5 : caler le moment avec Florian |
