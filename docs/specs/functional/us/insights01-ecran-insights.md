---
id: INSIGHTS-01
titre: "Écran « Insights » — moteur de sélection des analyses pertinentes (Tier 3)"
roadmap: [7.20]
catalogue: []
etape: recette
branche: feature/insights01-ecran-insights
maj: 05/08/2026
---

# INSIGHTS-01 — Écran « Insights » (Tier 3, ADR-007)

> **Révision 2 — 04/08/2026.** La première rédaction a été relue contre le code et **six
> affirmations étaient fausses**. Les corrections ont changé la conception, pas seulement le texte :
> le moteur passe d'un **score** à une **table ordonnée**, et la liste des sources tombe de 13 à 9.
> Le détail des corrections est en [§11](#11-ce-que-la-relecture-a-corrigé) — il vaut d'être lu, car
> plusieurs des idées écartées reviendront naturellement à l'esprit en codant.

## 0. Pourquoi maintenant, et d'où ça sort

[ADR-007](../../../adr/ADR-007-surfacage-analyses.md) §Conséquences nomme explicitement cet écran
comme **« US à cadrer »**. Ce n'est pas une idée neuve : c'est le dernier morceau non construit de la
doctrine de surfaçage acceptée le 16/07/2026.

Deux constats mesurés le **04/08/2026** motivent de le faire maintenant plutôt que « post-V1 » :

1. **Le plafond Tier 0 est dépassé d'un facteur 3.** ADR-007 §2 fixe le dashboard à **4-6 widgets
   max**. `HOME_WIDGET_IDS` en compte **20**
   ([widgets.ts](../../../../packages/shared/src/widgets.ts)). Sept sont conditionnels et rendent
   `null` hors condition, ce qui masque le problème sans le résoudre : la place reste réservée dans
   le registre, et l'arbitrage exigé par §2 (« ajouter un widget *coûte* un arbitrage ») n'a jamais
   eu lieu.
2. **L'absence d'endroit prévu pour les signaux conditionnels produit une classe de bug récurrente.**
   Un widget qui rend `null` doit être déclaré dans `isWidgetActive`, sinon `WidgetGrid` réserve sa
   cellule et laisse **un trou dans la grille**. L'oubli s'est produit sur **quatre** widgets —
   `training-load`, `overtraining-guard`, `readiness`, `activity-level-suggestion` — chacun corrigé
   après coup ([index.tsx:43-56](../../../../apps/mobile/src/app/(tabs)/index.tsx#L43-L56)).
   `deficit-volume` est le patron d'origine et `activation-path` a été déclaré en connaissance de
   cause : ni l'un ni l'autre n'a été oublié. Le cinquième cas, `MR-08`, n'a échappé à l'oubli que
   parce que la revue précédente avait rendu le motif visible. **Quatre fois le même défaut n'est
   pas une inattention : c'est un manque structurel.**

**Ce que cette US ne fait pas** : elle ne dégonfle **pas** le dashboard. Le passage de 20 widgets à
4-6 est le prolongement logique et fera l'objet d'une **US de suite**, après la recette du week-end
du 08-09/08/2026 — refactorer maintenant les écrans que Florian s'apprête à recetter changerait la
cible sous ses pieds. Voir §9.

## 1. Périmètre

**Un écran « Insights », atteignable à la demande, qui affiche les 1 à 3 analyses les plus
pertinentes de l'instant**, choisies par un moteur de sélection déterministe.

Trois familles, reprises telles quelles d'ADR-007 §2 (« celle qui a changé / alerte / célèbre ») :

| Famille | Ce que c'est | Exemple |
|---|---|---|
| `alert` | Quelque chose demande de l'attention **maintenant** | Charge d'entraînement en zone de risque |
| `change` | Quelque chose a **bougé** de façon notable | Tonnage en baisse de 22 % vs la semaine passée |
| `celebration` | Quelque chose a été **accompli** | Record battu au développé couché |

### 1.1 Dans le périmètre

- Un moteur **pur** (`packages/shared/src/insights.ts`) : filtrage, classement, sélection.
  Aucun React, aucun accès base — convention du dépôt.
- Des **adaptateurs purs**, un par source, qui convertissent un signal en candidat.
- Un **agrégateur** côté mobile (`insights-repository.ts`) qui appelle les hooks **déjà livrés**.
- Un **écran** `/insights` + sa route déclarée dans `_layout.tsx`.
- Une **porte d'entrée** (§4 D3).
- **Une seule modification d'un hook livré**, bornée et justifiée : §2.5.
- i18n **FR + EN** complet.
- L'**amendement d'ADR-007 §2** (§4 D1) — écrit dans cette US, pas promis pour plus tard.

### 1.2 Hors périmètre, explicitement

- **Aucune analyse nouvelle n'est calculée.** L'US ne construit que de la sélection au-dessus de
  briques existantes et testées. Application directe d'ADR-007 §3 (« des briques, pas 180
  variantes »). C'est cette règle qui a fait tomber trois sources en revue — voir §2.4.
- **Aucun dégonflage du dashboard** (US de suite, §9).
- **Aucun paywall** (§4 D1).
- **Aucune notification.** L'écran est consulté, jamais poussé.
- **Aucune corrélation ni moteur causal.** ADR-007 §2 les range en Tier 3 « analyses poussées » ;
  elles supposent un historique long et une modélisation qui n'existent pas. Reste au catalogue.

## 2. Les sources — inventaire vérifié contre le code

**Neuf sources.** Chacune est livrée, testée, et **peut réellement fournir un nombre** — condition
non négociable de R1. La première rédaction en annonçait 13 ; quatre ont été retirées après
vérification (§2.4).

### 2.1 Famille `alert` (3)

| Id | Source | Nombres disponibles |
|---|---|---|
| `overtraining_guard` | `useOvertrainingGuardAlert()` | `streakDays`, `severity` (`'streak'` \| `'streakAndDeficit'`) |
| `training_load` | `useTrainingLoadAlert()` | `ratio` — **après la modification du §2.5** |
| `deficit_volume` | `useDeficitVolumeAlert()` | `deficitPct`, `loggedDays` |

### 2.2 Famille `change` (4)

| Id | Source | Nombres disponibles |
|---|---|---|
| `weekly_decision` | `buildWeeklyReview().decision` | `metrics` (déjà typé non optionnel) |
| `tonnage_change` | `buildWeeklyReview().changes.tonnage` | `pct` |
| `distance_change` | `buildWeeklyReview().changes.distance` | `pct` |
| `muscle_neglected` | `computeMuscleBalance()` | `share`, `sets` du groupe le plus négligé |

### 2.3 Famille `celebration` (2)

| Id | Source | Nombres disponibles |
|---|---|---|
| `record_recent` | `useRecentStrengthRecords()` | valeur du record, `achievedAt` |
| `goal_achieved` | `computeGoalProgress()`, statut `achieved` | valeur atteinte, cible |

### 2.4 Les quatre sources retirées, et pourquoi

À ne pas rajouter en codant « puisqu'elles sont là » — chacune a été écartée pour une raison
vérifiée dans le code :

| Source | Motif du retrait |
|---|---|
| `readiness_rest` | `ReadinessResult` ne porte **aucun nombre** — trois composantes `{ state, reason? }` qualitatives. Satisfaire R1 exigerait d'inventer une métrique. |
| `concurrent_interference` | `ConcurrentTrainingInterference = { show, direction }` — `direction` est une chaîne, zéro nombre. Même motif. |
| `activity_level` | ~~« chaînes, aucune quantité »~~ → ❌ **AFFIRMATION FAUSSE, corrigée le 05/08/2026** par le cadrage d'INSIGHTS-02. `ActivityLevelSuggestion` porte bien **`runningDays: number`** — et c'est exactement le chiffre qui justifie la suggestion (« 4 jours de course sur 14 »). Ce signal **pouvait** devenir un insight dès cette US ; il l'est devenu avec la 7.21. La relecture de l'époque avait reproduit l'erreur. |
| `streak_milestone` | `computeStreak()` renvoie `{ current, activeToday }` et **aucune constante de jalon de série n'existe** dans le dépôt. Décider « à partir de combien de jours on célèbre, et une seule fois » serait une **analyse neuve** — interdit par §1.2. |

⚠️ **`goal_milestone` a été remplacé par `goal_achieved`, et ce n'est pas un détail.**
`GOAL_MILESTONES` existe bien, mais [goals.ts:28](../../../../packages/shared/src/goals.ts#L28) le
documente comme « **des repères, pas des récompenses** » (OBJ-01, décision D4). En faire une
célébration inverserait une décision produit datée. Un objectif **atteint** (`GoalStatus`
`'achieved'`) est autre chose qu'un jalon : c'est un accomplissement, et le célébrer ne contredit
rien.

### 2.5 La seule modification d'un hook livré

`useTrainingLoadAlert()` calcule le ratio ACWR via `computeAcwr` — qui renvoie
`{ ratio, zone, showAlert }` — puis **jette le ratio** :

```ts
// dashboard-repository.ts:950 et :994 — état actuel
export type TrainingLoadAlert = { show: boolean };
return { show: result?.showAlert ?? false };
```

Le type est élargi à `{ show: boolean; ratio: number | null }` et le `return` cesse de jeter la
valeur. **Ce n'est pas une analyse nouvelle** : le nombre est déjà calculé, on arrête de le perdre.
Sans lui, `training_load` ne peut pas satisfaire R1 et l'exemple même de l'alerte de charge
(« ratio 1,42 au-dessus de 1,30 ») serait inaffichable.

Le widget existant n'est pas modifié : il continue de ne lire que `show`. Aucune régression possible
sur l'accueil — mais le test du hook doit être étendu au nouveau champ.

### 2.6 Le rapport à BILAN-01 — ne pas redoubler le moteur existant

⚠️ **Point de vigilance majeur.** [weekly-review.ts](../../../../packages/shared/src/weekly-review.ts)
contient **déjà** un moteur de règles ordonnées (`SIGNAL_ORDER`, fonction `decide`) qui choisit
**une** décision hebdomadaire. Réécrire un second moteur de décision serait exactement le doublon
que ce projet évite.

| | BILAN-01 | INSIGHTS-01 |
|---|---|---|
| Cadence | Semaine ISO **close** | **Instant**, recalculé à chaque ouverture |
| Sortie | **1** décision | **1 à 3**, classées |
| Périmètre | Le bilan hebdomadaire seul | Tous les signaux, dont le bilan |

**Conséquence normative** : la fonction `decide` **n'est pas réimplémentée**, ni appelée
directement — elle est **privée au module** et n'est pas exportée. Le branchement se fait sur
`useWeeklyReview()`
([weekly-review-repository.ts](../../../../apps/mobile/src/data/repositories/weekly-review-repository.ts)),
qui expose déjà `decision` et `changes` résolus. Si la priorité hebdomadaire change un jour, elle
change à un seul endroit.

## 3. Le moteur — règles

### R1 — Un candidat transporte toujours ses chiffres

```ts
type InsightCandidate = {
  id: InsightId;
  family: InsightFamily;             // 'alert' | 'change' | 'celebration'
  metrics: Record<string, number>;   // NON optionnel, et NON vide
  subject?: string;                  // nom d'exercice, de muscle, d'objectif
  variant?: string;                  // sous-cas du signal — voir ci-dessous
  occurredOn: string | null;         // dayKey du fait, quand il en a un
  pillars: Pillar[];
};
```

**`variant` — ajouté à l'implémentation** (05/08/2026), après un constat que le cadrage avait
manqué : trois sources recouvrent **plusieurs messages** sous un même identifiant, et sans ce champ
il aurait fallu soit inventer trois identifiants de plus, soit écrire une phrase qui convienne aux
deux cas (donc à aucun). `overtraining_guard` a deux niveaux de gravité, `record_recent` trois types
de record qui **ne se formatent pas pareil** (`best_volume` est en kg cumulés, `max_weight` suit les
unités de l'utilisateur), et `weekly_decision` six natures de décision.

Bénéfice inattendu, et c'est le meilleur argument pour ce champ : il permet à la carte du bilan
hebdo de rendre **`review.decisions.<variant>`, la clé même de l'écran de BILAN-01**. Aucune
retraduction, donc aucune divergence possible entre les deux écrans.

`metrics` est **non optionnel et non vide**, et c'est le point du type — repris de `ReviewDecision`
(BILAN-01). Une carte sans chiffre serait une affirmation nue : « ta charge est élevée » ne vaut
rien sans « ratio 1,42 ». C'est cette règle, appliquée sérieusement, qui a éliminé quatre sources en
revue plutôt que de leur inventer des nombres.

### R2 — Le classement est une table ordonnée, pas un score

```ts
/** L'ordre de ce tableau EST la priorité. C'est le seul endroit où elle est encodée. */
export const INSIGHT_ORDER = [
  'overtraining_guard',   // risque de blessure : rien ne passe devant
  'training_load',
  'deficit_volume',
  'record_recent',        // une célébration fraîche vaut mieux qu'une variation tiède
  'goal_achieved',
  'weekly_decision',      // déjà le fruit d'un arbitrage (BILAN-01)
  'muscle_neglected',
  'tonnage_change',
  'distance_change',
] as const;
```

Sélection : parcourir `INSIGHT_ORDER`, retenir un candidat présent si sa famille n'a pas atteint son
quota (R3), s'arrêter à 3.

**Pourquoi pas un score.** La première rédaction proposait
`poidsFamille × severity × décoteFraîcheur`. Trois défauts rédhibitoires, tous constatés en revue :

1. **`severity` n'existe nulle part.** Aucune des sources ne fournit de sévérité numérique. Il
   aurait fallu en inventer une par source — soit neuf constantes arbitraires au cœur du moteur,
   exactement le genre de nombre non justifiable que ce dépôt refuse.
2. **La décote de fraîcheur était décorative.** Seules 4 sources sur 13 portaient une date ; les
   autres retombaient sur une constante.
3. **Et elle s'inversait.** Une alerte non datée plafonnait à `1,0 × 0,6 = 0,6`, donc passait
   **systématiquement derrière** une célébration du jour à `0,75 × 1,0 = 0,75`. La formule
   contredisait sa propre justification.

BILAN-01 obtient un ordre total avec `SIGNAL_ORDER` et zéro arithmétique. On fait pareil : c'est
lisible en revue, testable exhaustivement, et il n'y a aucun nombre à défendre.

### R2 bis — La fraîcheur est une porte, pas un coefficient

Un candidat **daté** (`occurredOn` non nul) de plus de **14 jours** est **écarté**. Un candidat non
daté n'est jamais écarté par l'âge.

C'est tout ce que la fraîcheur fait. Elle empêche « record battu » de traîner un mois ; elle ne
réordonne rien.

Sources **datées** (donc soumises à la porte des 14 jours) : `record_recent` (`achievedAt`),
`goal_achieved` (l'échéance — un objectif ne bascule en `achieved` qu'à sa date de clôture, la
fenêtre étant plafonnée par `goalWindowEnd`), `weekly_decision`, `tonnage_change` et
`distance_change` (fin de la semaine ISO close). **Cinq sur neuf.**

⚠️ **Conséquence assumée, à ne pas découvrir en recette** : les quatre alertes et
`muscle_neglected` n'ont **pas** de date d'événement — ce sont des états, pas des faits. Ils
peuvent donc se réafficher tant que la condition tient. C'est exactement ce qu'on veut d'une alerte
de surcharge ou d'un déséquilibre musculaire : insister tant que le problème persiste. Un
mécanisme de rejet (« ne plus me montrer ça ») exigerait une table et une sync rule — voir R7.

### R3 — Au plus 3, au plus 2 par famille

Trois alertes empilées transforment l'écran en réquisitoire ; trois célébrations en flatterie. Le
quota **2 par famille** garantit qu'un troisième emplacement, s'il est occupé, apporte un autre
point de vue. Il ne force rien : si une seule famille a quelque chose à dire, on affiche 1 ou 2
cartes, jamais du remplissage.

### R4 — Zéro peut être la bonne réponse

Aucun candidat ⇒ **état vide honnête**. L'écran n'invente pas un insight pour remplir. Même règle
que `isEmptyWeek` (BILAN-01 D4) : *« rien à signaler »* est une information.

### R5 — Un pilier inactif ne produit aucun candidat

Décision H (intégration sans imposition). Filtrage sur `candidate.pillars ⊆ activePillars`, appliqué
**avant** le classement.

### R6 — Des observations, jamais un conseil de santé

Repris de CYCLE-01 et de MUSC-F14 (motif « zone douloureuse » retiré). Le moteur ne renvoie que des
`id`, des nombres et des `subject` ; **toutes** les formulations vivent en i18n. Les signaux qui
suggèrent du repos (`overtraining_guard`) réutilisent **les libellés déjà validés** de leur widget
d'origine — on n'écrit aucune nouvelle formulation de conseil à cette occasion.

### R7 — Aucune persistance

Pas de table, pas de colonne, **pas de sync rule**. Un mécanisme de rejet explicite supposerait une
table `insight_dismissals` **et** un déploiement manuel de sync rule sur le dashboard PowerSync —
étape déjà oubliée une fois sur ce projet. Aligné sur OBJ-01 (« ni statut ni progression stockés »)
et BILAN-01 (« aucune migration, aucune sync rule »).

### R8 — La date entre par paramètre, jamais lue dans le moteur

`selectInsights({ candidates, activePillars, todayKey })`. Le moteur ne lit **jamais** l'horloge.

⚠️ **Piège documenté du dépôt, et il mord précisément ici.** Lire l'heure dans un hook fait geler la
valeur par React Compiler dans un slot mount-only — c'est pour cette raison que
`useDeficitVolumeAlert` reçoit `useTodayDate()` en entrée
([dashboard-repository.ts:831-837](../../../../apps/mobile/src/data/repositories/dashboard-repository.ts#L831-L837)).
Un écran qui se veut « recalculé à chaque ouverture » y est directement exposé : une sélection gelée
au premier montage passerait toutes les vérifications naïves.

### R9 — Le seuil de « notable » pour une variation

`tonnage_change` et `distance_change` ne deviennent candidats qu'au-delà de **±15 %**. Sans seuil,
toute variation non nulle remonterait et l'écran dirait « ton tonnage a bougé de 0,4 % ».
`PercentChange.pct` vaut `null` quand la semaine précédente est à zéro (pas de « +100 % » depuis
rien) : **`null` ⇒ aucun candidat**.

## 4. Décisions à trancher

### D1 — Gratuit ou premium ? → **proposition : gratuit**

ADR-007 §2 range le Tier 3 « derrière le paywall » et
[ADR-003](../../../adr/ADR-003-monetisation.md) fait de l'intelligence de croisement la frontière
payante. **Le construire gaté reviendrait à le construire invisible** : SOCLE-01 (câblage
RevenueCat) est **différée** depuis le 30/07/2026, il n'existe aucun entitlement, aucun produit
configurable (LANCE-00 non fait) et aucun paywall.

Proposition : **gratuit en V1**, avec **le point de gating isolé** — un unique
`canAccessInsights(): boolean` retournant `true` en dur, documenté comme *le* point d'accroche de la
première US IA/premium. Basculer plus tard = changer une ligne.

⚠️ Cette proposition **contredit un ADR accepté**. Si elle est retenue, **l'amendement daté
d'ADR-007 §2 est écrit dans cette US** (§1.1) — pas promis pour plus tard, sinon le prochain lecteur
de l'ADR reconstruira un gating.

### D2 — Combien de cartes ? → **proposition : 3**

Le chiffre d'ADR-007 §2 (« les 1-3 analyses les plus pertinentes »). Aucune raison d'en dévier.

### D3 — Par où on y entre ? → **arbitrage demandé**

| Option | Pour | Contre |
|---|---|---|
| **A. Widget `insights` conditionnel sur l'accueil** *(proposition)* | Le seul endroit où « ce qui compte maintenant » se lit ; mécanisme rodé (ajout en fin de registre, **aucune migration**) | +1 sur un registre déjà à 20 ; **doit être déclaré dans `isWidgetActive`** ; ajoute le coût de montage de l'agrégateur à l'accueil (§6) |
| **B. Ligne d'entrée sur Progression** | Zéro modification de l'accueil, patron `/measurements` déjà en place, aucun coût ajouté à l'accueil | Progression est **orienté musculation** ; y loger une porte transverse est incohérent et peu découvrable |

Proposition : **A**, rendant la carte de tête, `null` s'il n'y a aucun insight, et **déclaré dans
`isWidgetActive` dès l'implémentation**. Conséquence assumée : quand il n'y a rien à dire, la porte
disparaît.

### D4 — Le nom « Insights » est déjà pris → **proposition : garder, en distinguant**

`apps/mobile/src/app/cycle/insights.tsx` existe (CYCLE-01, écran « Croisement »), avec les clés
`cycle.insights.*`. Aucune collision technique — la route est `/cycle/insights` et les clés sont
imbriquées — mais **deux écrans homonymes dans le même dépôt**, dont un livré.

Proposition : garder `/insights` et la racine i18n `insights`, **ne pas renommer l'existant** (il
s'affiche sous le titre « Croisement », pas « Insights »), et ajouter un commentaire d'en-tête dans
chacun des deux fichiers pointant vers l'autre. Renommer un écran en recette pour une question de
vocabulaire serait disproportionné.

### D5 — Le dégonflage du dashboard est-il dans cette US ? → **non** (§9)

## 5. i18n — FR + EN

Nouvelle section racine `insights` dans
[fr.json](../../../../apps/mobile/src/i18n/locales/fr.json) et
[en.json](../../../../apps/mobile/src/i18n/locales/en.json) :

```
insights.title / .subtitle / .lead
insights.empty.title / .empty.body
insights.families.alert / .change / .celebration
insights.cards.<insightId>.title      // 9 ids
insights.cards.<insightId>.body       // interpole metrics + subject
insights.widget.title / .widget.seeAll
```

- **Clés neuves pour les 9 cartes**, sans exception. La règle « réutiliser les clés existantes »
  de la première rédaction était impraticable : les libellés des widgets sont écrits pour un
  contexte de dashboard (souvent sans sujet, avec des tournures courtes) et ne se transposent pas
  tels quels sur une carte d'insight. **Ce qui est réutilisé, ce sont les formulations de conseil**
  (R6) — on ne réécrit pas ce qu'un signal recommande, on en reprend le sens validé.
- **Aucune chaîne en dur**, y compris les libellés de famille.
- ⚠️ **Formater les nombres AVANT de les passer à `t()`.** `t('cle', { valeur: 41.2 })` interpole
  `"41.2"` : i18next n'a **aucun** formatage par défaut — piège n° 3 de
  [bonnes-pratiques.md](../../technical/bonnes-pratiques.md), à l'origine de trois défauts en
  recette le 31/07. Unités via `useUnits` (métrique/impérial).

## 6. Comportement offline et coût de montage

**Intégralement hors ligne.** Chaque source lit le SQLite local via PowerSync ; le moteur est pur.
Aucun appel réseau, aucune dépendance native neuve, aucune clé d'API.

Conséquence utile : **cette US est recettable sur l'APK existant**, contrairement à
PARTAGE-01 / RUN-F2a / MUSC-F9 / RUN-F2c / LAUNCHER-01 qui attendent tous un nouveau build.

⚠️ **Coût de montage — contrainte, pas remarque.** L'agrégateur monte l'union de 8 hooks qui
partagent leurs dépendances (`useWorkoutHistory`, `useRunHistory`, `useDailyTotals`,
`useNutritionSummary`). Le dépôt a **déjà payé ce prix** : GARDE-01 a dû défaire un appel imbriqué
qui instanciait une seconde fois les mêmes requêtes
([dashboard-repository.ts:1129-1132](../../../../apps/mobile/src/data/repositories/dashboard-repository.ts#L1129-L1132)).

✅ **La duplication annoncée est apparue, et elle a été mutualisée** (05/08/2026). Avec D3-A,
l'accueil a besoin de la sélection **à deux endroits** — `isWidgetActive` (pour exclure le widget de
la grille) et `InsightsCard` (pour l'afficher). Deux appels à `useInsights()` auraient monté deux
fois l'union des 8 hooks, dont `useWeeklyReview`, `useMuscleBalance` et `useGoals` qui ne sont **pas
déjà** sur l'accueil, sur l'écran le plus ouvert de l'app.

Solution retenue : l'accueil calcule **une fois** en haut et diffuse via
[insights-context.tsx](../../../../apps/mobile/src/data/repositories/insights-context.tsx). Le
contexte n'a **aucun repli calculant** — hors provider, `useSharedInsights()` rend `null` et le
widget ne s'affiche pas. Un repli silencieux rétablirait le double montage sans que personne ne le
voie, ce qui est exactement le défaut qu'on évite.

Note : les widgets conditionnels antérieurs (`deficit-volume`, `training-load`…) appellent bel et
bien leur hook deux fois, dans `isWidgetActive` **et** dans leur carte. C'est supportable pour un
hook simple ; ça ne l'était pas pour l'agrégateur. Cette asymétrie est assumée, pas subie.

## 7. Cas limites

| Cas | Comportement attendu |
|---|---|
| Compte neuf, aucune donnée | État vide (R4). Jamais de carte inventée. |
| Un seul pilier actif | Seuls ses candidats concourent (R5). |
| Tous les signaux muets | État vide, et le widget disparaît (D3-A). |
| Plus de 3 candidats | Les 3 premiers de `INSIGHT_ORDER`, max 2 par famille. |
| Candidat daté de plus de 14 j | Écarté (R2 bis). |
| Candidat non daté | Jamais écarté par l'âge. |
| `changes.tonnage.pct === null` | Aucun candidat (R9) — pas de « +100 % » depuis zéro. |
| Variation à ±3 % | Sous le seuil de ±15 % : aucun candidat (R9). |
| `MuscleBalance.neglected` en contient 4 | **Un seul** candidat : le groupe à la plus faible part. |
| Objectif atteint | `goal_achieved`. **Un jalon franchi n'est pas un événement** (§2.4). |
| Données incohérentes (`NaN`, `Infinity`, négatif) | Candidat **écarté** avant classement, jamais affiché à 0. Précédent : `bestSegmentTimeFromSamples` renvoyait `NaN`, corrigé le 04/08. |
| Police système 1,5× | Cartes en hauteur libre, aucun texte tronqué. |

## 8. Critères de recette

Device requis sauf mention contraire. **À ne pas jouer avant le lot de recettes du week-end en
cours** — cette US n'y participe pas.

1. L'écran s'ouvre depuis la porte d'entrée retenue en D3.
2. L'en-tête s'affiche correctement (⚠️ **leçon PAS-01** : route déclarée dans `_layout.tsx`, sinon
   le titre se dessine sous la barre d'état — invisible au typecheck comme aux tests).
3. Chaque carte affiche au moins un chiffre (R1).
4. Aucune carte n'énonce une causalité ni un conseil de santé non déjà validé ailleurs (R6).
5. Les nombres sont formatés (pas de `41.2000000001`, pas de séparateur anglais en FR).
6. Compte sans donnée → état vide lisible, aucune carte.
7. Désactiver un pilier → ses insights disparaissent ; réactiver → ils reviennent.
8. Mode avion → écran identique, aucun indicateur d'erreur réseau.
9. Bascule FR ⇄ EN → aucune chaîne non traduite, aucun `insights.` brut à l'écran.
10. Unités impériales → distances et allures converties.
11. Police système 1,5× → aucun texte tronqué ni chevauché.
12. Thème sombre → contrastes WCAG AA (CONF-07 vient de solder ce chantier, ne pas le rouvrir).
13. TalkBack → chaque carte est annoncée, titre puis corps ; ordre de lecture = ordre visuel.
14. **La sélection n'est pas gelée** : après avoir terminé une séance, rouvrir l'écran doit refléter
    le nouvel état sans redémarrer l'app. *(Remplace le critère « même sélection en rouvrant dans la
    minute » de la première rédaction, qui passait aussi — et surtout — si la sélection était gelée
    à vie par React Compiler, c'est-à-dire précisément le bug de R8.)*
15. Si D3-A retenu : aucun trou dans la grille de l'accueil quand le widget est muet — le défaut qui
    s'est répété quatre fois.
16. Si D3-A retenu : l'accueil ne devient pas sensiblement plus lent à l'ouverture (§6).

> Les plafonds « au plus 3 cartes » et « au plus 2 par famille » **ne sont pas des critères de
> recette** : ils sont difficiles à provoquer à la main et exhaustivement prouvés par les tests
> unitaires du lot 0. Les mettre ici donnerait l'illusion d'une vérification qui n'aurait pas lieu.

## 9. La suite, hors de cette US

**INSIGHTS-02 — dégonflage du Tier 0.** Une fois l'écran en place et recetté, les widgets
conditionnels de l'accueil ont un ailleurs où vivre : le registre peut redescendre de 20 vers les
4-6 d'ADR-007 §2, et `isWidgetActive` cesse d'être le point de passage obligé d'une classe de bug.
Suppose la recette d'INSIGHTS-01 faite, et touche des écrans aujourd'hui en recette.

**Candidats pour plus tard**, écartés ici faute de brique existante : jalons de série
(`streak_milestone`), tendance d'allure (`pace_trend`, qualitative), et les trois signaux
qualitatifs du §2.4 — s'ils gagnent un jour une mesure chiffrée, ils rejoindront `INSIGHT_ORDER`
sans rien changer au moteur. C'est le bénéfice de la table ordonnée.

## 10. Definition of Done

- [ ] `npm run typecheck` vert sur les 3 workspaces.
- [ ] `npm run lint` vert.
- [ ] `npm run test:coverage` vert — **cliquets respectés** : 100 % instructions/fonctions/lignes et
      ≥ 97 % branches sur `packages/shared` ; aucun seuil mobile en régression.
- [ ] Le moteur est **pur** : zéro import React, zéro accès base, **zéro lecture d'horloge** (R8).
- [ ] La fonction `decide` de BILAN-01 n'est ni exportée ni réimplémentée (§2.6).
- [ ] La seule modification d'un hook livré est celle du §2.5, et son test est étendu.
- [ ] Aucune migration, aucune sync rule (R7).
- [ ] FR et EN complets et symétriques, **nombres formatés avant interpolation** (§5).
- [ ] Route déclarée dans `_layout.tsx`.
- [ ] Si D3-A : widget déclaré dans `isWidgetActive`, dans le même commit.
- [ ] **Amendement d'ADR-007 §2 écrit et daté** (D1).
- [ ] Entrée CHANGELOG, front-matter à jour, roadmap 7.20 renseignée.

## 11. Ce que la relecture a corrigé

Traçé ici parce que plusieurs de ces idées **reviendront naturellement à l'esprit en codant**, et
qu'il faut pouvoir répondre « non, et voici pourquoi ».

| # | Affirmation de la 1ʳᵉ rédaction | Réalité du code | Effet |
|---|---|---|---|
| 1 | « Les 6 sources d'alerte exposent leur charge utile chiffrée » | 3 sur 6 n'ont **aucun nombre** | 3 sources retirées (§2.4) |
| 2 | Formule de score avec `severity` 0..1 | **Aucune source ne fournit de sévérité** | Score remplacé par table ordonnée (R2) |
| 3 | Décote de fraîcheur sur 13 sources | 9 sur 13 **sans date** ; la formule faisait passer les alertes **derrière** les célébrations | Fraîcheur devenue une porte (R2 bis) |
| 4 | « Un record d'il y a 12 jours sort de lui-même » | Vrai pour `record_recent` seul | Limite désormais explicite (R2 bis) |
| 5 | `streak_milestone` comme source | `computeStreak` renvoie 2 champs, **aucune constante de jalon** | Retiré : aurait été une analyse neuve |
| 6 | `goal_milestone` comme célébration | `GOAL_MILESTONES` = « des repères, **pas des récompenses** » (OBJ-01 D4) | Remplacé par `goal_achieved` |
| 7 | « Brancher sur `decide()` » | `decide` est **privée**, non exportée | Branchement sur `useWeeklyReview()` |
| 8 | « Le bug s'est produit 5 fois » (et 6 ailleurs) | Le code en documente **4** | Corrigé partout |

Trois trous ont aussi été comblés : le seuil de variation « notable » (R9), le choix d'un seul
groupe musculaire quand plusieurs sont négligés (§7), et le coût de montage de l'agrégateur (§6).
