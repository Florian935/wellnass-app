---
id: CIBLE-01
titre: "Une seule « cible du jour » dans tout le pilier Nutrition — l'historique, le planning repas et le widget passent par la composition de NORYN-02"
roadmap: [4.7, 4.27, 4.40, 4.44, 7.19]
catalogue: [NUTR-10, NUTR-18, MN-20, MN-16]
etape: recette
branche: feature/cible01-cible-du-jour
maj: 22/10/2026
---

# US CIBLE-01 — Une seule « cible du jour » dans tout le pilier Nutrition

> **Demande** : Florian, 21/10/2026 — la cible calorique d'un jour est calculée à plusieurs endroits qui
> ne disent pas la même chose ; les faire passer par les compositions pures extraites par NORYN-02.
> **Sources** : BACKLOG, ligne CIBLE-01 (P2) ; spec [NORYN-02](noryn02-cibles-forme.md) §1.4, §1.5, D2,
> D3, §12 ; écart vu en recette NORYN-02 (critère 3 : un jour passé avec une seule autre activité reçoit
> le forfait dans « Ta journée en énergie », pas dans la ligne d'état de la même page).
> **Prédécesseur** : NORYN-02 (clôturée le 21/10/2026, `9a3ca226`). **Plan** :
> [docs/plans/cible01-cible-du-jour.md](../../../plans/cible01-cible-du-jour.md).
> **Maquette** : sans objet. Aucun écran ne change de forme : le planning repas garde sa carte de jour
> et sa pastille de bonus, dont seuls le libellé et l'icône suivent l'origine du bonus (§11) ; les autres
> écrans ne changent que des chiffres.
> **Roadmap** : pas de ligne neuve — une mise en cohérence de fonctionnalités livrées (4.7, 4.27, 4.40,
> 4.44, 7.19), comme les corrections cadrées en US (bas de la section « Hors périmètre de cadrage »).
> **Vérifié dans le code** le 21/10/2026 sur `origin/dev` (`9a3ca226`) ; **relue** le 22/10/2026 par un
> agent de revue (§15), chiffres du §14 recalculés de façon indépendante. Aucune migration, aucun appel
> au projet, aucun déploiement (§9).
> ✅ **Validée par Florian le 22/10/2026** : D1 à D12 **telles que proposées** (dont D7-B, D8-A, D9-A).
> 🛠️ **Codée le 22/10/2026**, en huit commits (filet, brique, historique, planning, widget, régularité,
> ménage et preuve Noryn, recette), poussés sur `dev`. Le filet a tenu : seuls les tests étiquetés C1 à
> C19 ont changé d'attendu, chacun à l'étape qui le touche ; les filets de NORYN-02 et
> `goal-adherence-assembly` sont restés verts sans une ligne modifiée. Tous les chiffres du §14.2 sont
> affirmés par `cible01-recette.test.tsx`. Écarts au plan — des moyens, pas des règles — en fin de plan.
> En recette : [RECETTES.md](../../../../RECETTES.md) §94. Aucune migration, aucun appel au projet, aucun
> déploiement.

## 0. Le besoin

« Combien dois-je manger aujourd'hui ? » doit avoir **une** réponse, quel que soit l'écran qui la pose.
NORYN-02 a sorti cette réponse des hooks vers des fonctions pures (`composeDayCalorieTarget`,
`trainedOnDay`, `nutritionSocle`, `dayMacroTargets`), que l'onglet Aujourd'hui et Noryn appellent.
D'autres écrans recalculent encore la cible à leur façon, avec des règles qui ont dérivé : ils doivent
appeler les mêmes compositions, **sans formule recopiée**, et chaque chiffre qui bouge doit être annoncé
ici et affirmé par un test.

## 1. L'inventaire

Cherché dans tout le dépôt (`apps/`, `packages/`, `supabase/functions/`) : appelants de
`useDailyCalorieTargets`, `useGoalAdherence(ForRange)`, `useTrainingNutritionCross`, `useDayCalorieTarget`,
`useIsTrainingDay`, `useNutritionSummary` ; tout appel direct de `tdee`, `sportFreeTdee`, `targetCalories`,
`trainingDayCalories`, `dayCalorieBonus`, `computeEffectiveTargetForDay`, `dayTargetKcal`,
`estimateRunCalories` ; toute cible d'un jour appliquée à d'autres jours ; toute cible transmise à l'IA.

### 1.1 Les calculs (là où une cible est fabriquée, ou réutilisée pour d'autres jours)

| # | Où | Règle d'aujourd'hui |
|---|---|---|
| **K1** | `useDayCalorieTarget` ([dashboard-repository.ts:438](../../../../apps/mobile/src/data/repositories/dashboard-repository.ts#L438)) + `useIsTrainingDay` (`:312`) | **La référence.** `composeDayCalorieTarget` + `trainedOnDay` (NORYN-02). |
| **K2** | `useDailyCalorieTargets` (`:1652`) | Formule **recopiée** (`:1671-1691`, `:1710-1757`) : socle selon le mode, objectif du jour, surcharge, `computeEffectiveTargetForDay`. Jour d'entraînement = séances et courses terminées **seulement**. |
| **K3** | Planning repas ([meal-plan/index.tsx:117-151](../../../../apps/mobile/src/app/meal-plan/index.tsx#L117), `:283` → `dayTargetKcal`, [meal-plan.ts:119](../../../../packages/shared/src/meal-plan.ts#L119)) | Formule recopiée : socle **`tdee` quel que soit le mode**, forfait seul, jour d'entraînement = toute séance planifiée de la semaine **quel que soit son statut** (jointure aux séances et programmes), bonus coupé si ni muscu ni course n'est actif (`settings?.activePillars ?? []`, `:147`). |
| **K4** | Widget d'écran d'accueil ([home-widget-data.ts:208](../../../../apps/mobile/src/widgets/home-widget-data.ts#L208)) | Formule recopiée : socle **`tdee` quel que soit le mode**, au poids de la **dernière pesée** (`:240` ; le socle de l'app prend le poids du profil), objectif du jour, surcharge, **sans bonus**. |
| **K5** | Labo « Et si… » et Conseil des trois ([lab-repository.ts:484](../../../../apps/mobile/src/data/repositories/lab-repository.ts#L484), lu par `CouncilSheet`) | Ne calcule pas une cible du jour : **remonte au socle** par `cible de base − delta de l'objectif`. Faux en période « vie réelle » (la cible est déjà au maintien : +400 kcal en sèche) ; approché avec une surcharge (l'écran le dit). |
| **K6** | Réglages › Nutrition ([nutrition-profile.tsx:127](../../../../apps/mobile/src/app/nutrition-profile.tsx#L127)) | `nutritionSocle` (D1-A de NORYN-02) + objectif, **sans** vie réelle ni bonus — à dessein : on y règle l'objectif, pas la cible d'un jour. |
| **K7** | Noryn ([noryn/targets.ts](../../../../packages/shared/src/noryn/targets.ts)) | Les compositions de K1, à l'heure de Paris (`context/day` seulement ; `context/week` ne porte pas de cible). |
| **K8** | Alerte « déficit + gros volume » `useDeficitVolumeAlert` (`:1174`, cible `:1189`) | Les apports de J−7 à J jugés contre la cible **de base d'aujourd'hui**, appliquée à toute la fenêtre. |
| **K9** | Garde-fou charge & repos `useOvertrainingGuardAlert` (`:1418`, `:1432`, `:1458-1463`) | Les jours en déficit de J−6 à J comptés contre la cible **de base d'aujourd'hui**. |
| **K10** | Score de forme `useReadiness` (`:1488`, `:1496` → `composeReadiness`, [readiness.ts](../../../../packages/shared/src/readiness.ts)) | La moyenne des apports sur 7 jours contre la cible **de base d'aujourd'hui**. Composition **partagée avec Noryn**. |
| **K11** | Labo, enquête « déficit » ([lab-repository.ts:244](../../../../apps/mobile/src/data/repositories/lab-repository.ts#L244), `:338` → [lab-investigations.ts:205-211](../../../../packages/shared/src/lab-investigations.ts#L205)) | La moyenne de la fenêtre contre la cible **d'aujourd'hui**. |
| **K12** | Contexte que le Labo IA envoie au modèle ([ai-context-repository.ts:406](../../../../apps/mobile/src/data/repositories/ai-context-repository.ts#L406), lu par `ai-lab.tsx`) | `targetKcal` = la **surcharge manuelle seule**, `null` sinon : une règle qu'aucun écran n'applique. |

### 1.2 Les écrans, et ce qui changera

| Écran | Ce qu'il affiche | Source | Ce qui change |
|---|---|---|---|
| **Nutrition › Historique** — calendrier du mois ([HistorySection.tsx:85](../../../../apps/mobile/src/components/nutrition/sections/HistorySection.tsx#L85)) | un verre par jour **passé** noté, rempli face à la cible du jour, « + » / « − » hors marge ; la case d'aujourd'hui, remplie sans statut ; les jours futurs, vides ; résumé du mois | K2 | C1, C2 |
| **Historique › Jours** (même composant) | la liste des jours notés jusqu'à aujourd'hui, et leur statut | K2 | C1 |
| **Page d'un jour passé** ([nutrition-day.tsx:74](../../../../apps/mobile/src/app/nutrition-day.tsx#L74)) — ligne d'état | « 2 650 kcal · 291 kcal au-dessus de ta cible » | K2 | C1 : la ligne retombe sur la cible de « Ta journée en énergie » (K1), sur la même page |
| Page d'un jour passé — qualité (`DayQualitySection`) | plafonds proportionnels à la cible du jour | K2 | C1 |
| Page d'un jour passé — « Ta journée en énergie » ([DayEnergyCard.tsx:46](../../../../apps/mobile/src/components/energy/DayEnergyCard.tsx#L46)) | socle, dépenses, cible, reste | K1 | rien (c'est la référence) |
| **Statistiques › Régularité** ([nutrition-stats.tsx:131-132](../../../../apps/mobile/src/app/nutrition-stats.tsx#L131)) | « X jours dans la cible sur Y », bilan calorique signé (NUTR-18), jours au-dessus / en dessous, graphe des écarts | K2 (`useGoalAdherence`, `useDailyCalorieTargets`) | C1, C2, C3 |
| Statistiques › Régularité — carte de régularité (`RegularityCard`, `:161`) | cases « complète / partielle / vide » (seuil : un tiers de la cible) | **aucune cible** (repli 600 kcal) | C6 (D9) |
| **Statistiques › Qualité** (`:395`) | plafonds sucres / AGS sur la cible moyenne de la fenêtre | K2 | C1, C2, C3 (la moyenne) |
| **Nutrition › Progrès** — verdict de la semaine ([WeekVerdictCard.tsx:54](../../../../apps/mobile/src/components/nutrition/WeekVerdictCard.tsx#L54)) | phrase et chiffres d'adhérence sur 7 jours | K2 | C1, C2, C3 |
| Progrès — carte de régularité ([ProgressSection.tsx:63](../../../../apps/mobile/src/components/nutrition/sections/ProgressSection.tsx#L63)) | cases des 7 derniers jours | **la cible effective d'aujourd'hui, appliquée aux 7 jours** (`(tabs)/nutrition.tsx:367`) | C6 (D9) |
| **Bilan hebdo** (BILAN-01, [weekly-review-repository.ts:297](../../../../apps/mobile/src/data/repositories/weekly-review-repository.ts#L297)) | jours dans la cible de la semaine close ; signal nutrition du bilan | K2 | C1 (jamais C2 ni C3 : la semaine est close) |
| **Labo › « Manges-tu assez pour ta muscu ? »** (APPORT-01 ; [lab-link.tsx:123](../../../../apps/mobile/src/app/lab-link.tsx#L123), [dashboard-repository.ts:1890](../../../../apps/mobile/src/data/repositories/dashboard-repository.ts#L1890)) | jours de séance contre jours de repos : apports moyens, adhérence par groupe, jours à faible carburant | K2, et son drapeau « jour d'entraînement » | C1, C2, C3, **C4** (les groupes) |
| Labo › Croiser — lignes résumées des liens ([cross-links-repository.tsx:164](../../../../apps/mobile/src/data/repositories/cross-links-repository.tsx#L164)) | les chiffres d'APPORT-01 et du bilan hebdo | K2 | idem, par ricochet |
| **Planning repas** ([meal-plan/index.tsx](../../../../apps/mobile/src/app/meal-plan/index.tsx) → `MealPlanDayCard`) | par jour : « prévu / cible kcal », pastille « Séance prévue — objectif +300 kcal » | K3 | C7 à C14 |
| **Widget d'écran d'accueil** (LAUNCHER-01) | « Restant 1 240 kcal » | K4 | C16 à C19 (D8) |
| Labo « Et si… », Conseil des trois | projections d'un autre objectif | K5 | rien — signalé (D10) |
| Alerte « déficit + gros volume », garde-fou charge & repos, enquête « déficit » du Labo | une fenêtre jugée sur la cible d'aujourd'hui | K8, K9, K11 | rien — signalé (D12) |
| Score de forme (accueil, hub Bien-être, Labo, « Que manger ? ») | la composante nutrition | K10 | rien — signalé (D12 ; Noryn) |
| Labo IA (contexte envoyé au modèle) | « cible X kcal/jour » si une surcharge est posée | K12 | rien — signalé (D12) |
| Réglages › Nutrition | objectif réglé, macros de base | K6 | rien |
| Aujourd'hui (cible, reste, macros, explication), accueil (carte Nutrition, trois tailles), sections énergie des bilans de séance et de course, `activity.tsx`, relais nutrition du mode immersif, brief du matin, « Que manger ? », bilan du soir de Prisme, objectif minimal de semaine (VIE-01) | — | K1 (`useDayCalorieTarget`, `useNutritionSummary`, `useProteinTarget`, `useDayNutritionTargets`) | **rien** (DD1) |
| **Noryn** (`context/day`) | `energy_target_kcal`, `protein_target_g` | K7 | **rien** — prouvé au §7 |

Hors inventaire, vérifiés : `MealPlanWeekGrid` n'affiche aucune cible ; `WeekStrip.tsx` n'a plus aucun
appelant (composant mort, porté en dette) ; `TrainingNutritionCrossCard` (MN-03) ne lit aucune cible ;
`supabase/functions/ai-assist` ne calcule aucune cible.

### 1.3 D1-A s'applique-t-il déjà à `useDailyCalorieTargets` ?

**Oui pour le socle, par une copie.** `useDailyCalorieTargets` prend le socle **hors sport** en mode
`activities` depuis DEPENSE-00 (`:1673-1690`), mais en réécrivant `sportFreeTdee` / `tdee` à côté de
`nutritionSocle` : même résultat aujourd'hui, deux endroits demain. L'autre moitié de D1-A (une seule
règle de macros) ne le concerne pas : il ne rend pas de macros. **Le planning repas (K3) et le widget (K4)
n'appliquent pas D1-A** : ils prennent `tdee` en mode `activities` — l'écart E4 de NORYN-02.

## 2. Les règles, côte à côte

| Règle | K1 — référence | K2 — historique | K3 — planning repas | K4 — widget |
|---|---|---|---|---|
| Socle | `nutritionSocle` : `tdee` ; hors sport en `activities` | idem, **recopié** | **`tdee` toujours** | **`tdee` toujours** |
| Poids du socle | profil | profil | profil | **dernière pesée**, sinon profil |
| Objectif | du jour (vie réelle → maintien) ; surcharge prioritaire | idem | idem | idem |
| Jour d'entraînement — passé | séance ou course **terminée**, ou **autre activité** | séance ou course terminée | **séance planifiée, tout statut** | — |
| — aujourd'hui et après | + séance planifiée `planned`/`done`, sans jointure | **rien de plus** | séance planifiée, tout statut | — |
| Ni muscu ni course actif | sans effet | sans effet | **aucun bonus** (aussi sans ligne de réglages) | — |
| Bonus `fixed` | forfait si jour d'entraînement | idem | forfait si séance | **aucun** |
| Bonus `auto` | dépense des courses du jour (pilier course actif), sinon forfait | idem | **forfait seul** | **aucun** |
| Bonus `activities` | dépense réelle retenue (bas des fourchettes) | idem | **forfait** | **aucun** |
| Drapeau « jour d'entraînement » rendu | entraîné **et** bonus > 0 (`activities` : bonus > 0), et cible calculable | entraîné (séances, courses) | — | — |

Conséquences visibles, cas par cas, au §6.

## 3. Décisions — à valider

| # | Question | Proposition | Pourquoi | Alternative |
|---|---|---|---|---|
| **D1** | La séance planifiée **pas encore faite aujourd'hui** compte-t-elle dans le calendrier, l'adhérence, le bilan et APPORT-01 ? | **Oui**, comme dans l'onglet Aujourd'hui : la case d'aujourd'hui du calendrier se remplit face à la cible qu'affiche Aujourd'hui, et l'adhérence (qui inclut aujourd'hui, NUTR-10) juge la journée sur cette même cible. Une fois le jour passé, si la séance n'a pas été faite, l'anticipation disparaît **partout à la fois** (4.7b : « le passé n'est jamais anticipé ») | C'est l'écart que l'US supprime : la case d'aujourd'hui ne dit plus autre chose que l'écran d'à côté | B — ne pas anticiper dans les écrans du passé : la case d'aujourd'hui et l'adhérence du jour gardent une cible sans forfait, différente d'Aujourd'hui |
| **D2** | La séance **sautée** (`skipped`) | **Ne compte nulle part** : la règle de `trainedOnDay` (`planned`/`done`, `SELECT_HAS_PLANNED`). Une séance faite malgré tout le même jour compte, par le réalisé | Sauter une séance, c'est dire qu'elle n'aura pas lieu ; le planning repas était le seul écran à lui donner encore le forfait | Compter les séances sautées (le planning seul, aujourd'hui) |
| **D3** | Le **jour futur** du planning repas en mode `activities` | **Socle hors sport + objectif, sans dépense** — D3 de NORYN-02 : la cible qu'Aujourd'hui affichera ce matin-là si rien ne change, un plancher que la journée relèvera (DEPENSE-00 §6 : pas d'anticipation, le réalisé seul compte). Les jours où une séance est prévue, la pastille le dit : « Séance prévue — sa dépense s'ajoutera » (§11) | Une seule cible par jour ; en mode `activities`, le forfait n'existe plus nulle part ailleurs | Le forfait en anticipation (planning seul : contredit Aujourd'hui et Noryn) ; une estimation de la séance prévue (formule neuve, hors périmètre) |
| **D4** | La **règle des séances** du planning repas | **Celle de `trainedOnDay`** : jours passés = le réalisé (séances, courses, autres activités) ; aujourd'hui et après = le réalisé, plus une séance `planned`/`done`, **sans jointure** au programme (`SELECT_HAS_PLANNED`) | Le planning devient un écran de plus sur la même cible ; ses jours passés disent ce qui a été fait, pas ce qui était prévu | Tout statut, jointure au programme (aujourd'hui) |
| **D5** | Les **groupes d'APPORT-01** (jour de séance / de repos) | **La même définition du jour d'entraînement** que la cible : `trainedOnDay` — autres activités comprises, séance prévue d'aujourd'hui (ou d'un jour futur noté) comprise (D1). Le drapeau `isTrainingDay` des jours de `useDailyCalorieTargets` devient ce résultat (DD2). ⚠️ En mode `activities`, la cible ne dépend pas de `trainedOnDay` (le bonus est la dépense) : la promesse d'APPORT-01 « le groupement colle à la cible » n'y tient qu'à peu près — aujourd'hui classé « séance » avec la cible de base ; une course non terminée mais finie (`active`/`cancelled`) ajoute sa dépense à un jour classé « repos » | APPORT-01 promet que le groupement colle à la cible qui a jugé chaque jour : en `fixed`/`auto`, il ne la tient plus dès qu'une autre activité donne le forfait | B — le drapeau « bonus appliqué » de K1 : sans forfait réglé (défaut 0) en mode `fixed`, aucun jour ne serait un jour de séance et l'analyse se tairait ; C — statu quo (séances et courses seules) |
| **D6** | La **performance** sur de longues plages (Statistiques 30 j, calendrier d'un mois, APPORT-01 28 j, planning 7 j) | **Une lecture par plage, jamais une requête par jour** : les séances planifiées en **une** requête bornée (`[max(début, aujourd'hui), fin]` — seuls ces jours peuvent être anticipés) ; séances, courses, activités et dépenses lues une fois, comme aujourd'hui ; une composition pure qui **range** les lignes par jour une seule fois puis compose chaque jour (O(lignes + jours)) | `trainedOnDay` appelée telle quelle pour chaque jour parcourrait tout l'historique à chaque jour, et rattacherait chaque instant à son jour (`new Date`) autant de fois ; un `useHasPlannedSession` par jour est impossible (règle des hooks) et coûterait une requête surveillée par jour | Une requête par jour ; ou composer jour par jour sur les tableaux entiers (O(jours × lignes)) |
| **D7** | Le planning repas quand **ni muscu ni course n'est actif** (règle R5 de REPAS-01, décision H) | **B — garder la règle du planning** : ni muscu ni course actif → le planning montre la cible **de base** du jour (`target` de la composition) et **aucune** pastille. C'est la seule exception à R2, assumée et testée : `togglePillar` ne touche pas aux séances planifiées ([settings-repository.ts:436-448](../../../../apps/mobile/src/data/repositories/settings-repository.ts#L436)), donc quiconque éteint muscu et course avec un programme en cours garde ses séances — suivre la composition ferait réapparaître « Séance prévue +300 » sur un pilier masqué (critère 6 de REPAS-01, décision H). Aujourd'hui leur donne pourtant le forfait : c'est le défaut, porté au BACKLOG (CIBLE-02) pour être tranché **partout à la fois** | Ne pas faire régresser une décision validée ; ne pas changer Aujourd'hui ni Noryn dans cette US | A — suivre la composition (le planning montre le forfait d'un pilier masqué) ; C — trancher dans `trainedOnDay` maintenant (change Aujourd'hui et Noryn) |
| **D8** | Le **widget** d'écran d'accueil (K4) | **A — la cible effective d'Aujourd'hui** : le widget appelle les mêmes compositions, pour aujourd'hui seulement, sur les **mêmes requêtes SQL** que les hooks, sorties dans un module feuille sans effet de bord (§4). C'est ce que LAUNCHER-01 avait spécifié (D3 et §3 : « `effectiveTarget − kcal consommées` ») avant de le simplifier à l'implémentation faute de composition réutilisable — elle existe désormais. LAUNCHER-01 est encore en recette | Le widget promettait « jamais un sur-estimé » ; en mode `activities` (socle `tdee`) ou avec une pesée au-dessus du poids du profil, il sur-estime. Et il annonce un autre « Restant » qu'Aujourd'hui les jours de séance | **B** — la cible **de base** par la composition (`target` : socle selon le mode, poids du profil), sans bonus, comme LAUNCHER-01 §8 l'a assumé : corrige E4 et le poids, garde l'écart des jours de séance, sans module SQL à sortir ; C — BACKLOG |
| **D9** | La **carte de régularité** (Progrès et Statistiques) | **La cible de chaque jour** (`useDailyCalorieTargets`) pour le seuil « complète » : aujourd'hui Progrès juge les 7 jours sur la cible **d'aujourd'hui** (bonus du jour compris) et Statistiques sur **aucune** cible (repli 600 kcal) — la même journée peut être « complète » d'un côté et « partielle » de l'autre | Une cible par jour, y compris pour ce seuil | B — signaler, BACKLOG |
| **D10** | Le socle **remonté** par le Labo « Et si… » et le Conseil (K5) | **Signaler, BACKLOG** (CIBLE-04) : ce n'est pas une cible du jour mais la base d'une simulation ; le remède est simple (lire le `socle` que la composition rend), mais il change les projections du Labo en période « vie réelle » et demande leur recette | US bornée au pilier Nutrition | B — le corriger ici |
| **D11** | Le **jeu de recette** | **Un compte de test vierge**, dont le script pose le profil (profil A de DEPENSE-00) et le profil nutritionnel : tous les chiffres attendus sont **connus d'avance**, calculés par les fonctions pures et figés par un test (§14) | Les écrans d'historique (calendrier, adhérence, APPORT-01) ne montrent que des jours notés : sur le compte réel, les repas de Florian se mêleraient au jeu et aucun chiffre ne serait prévisible | B — le compte réel, avec des critères d'égalité entre écrans seulement (le patron de NORYN-02) |
| **D12** | Les **fenêtres jugées sur la cible d'aujourd'hui** (K8 alerte déficit + volume, K9 garde-fou, K10 score de forme, K11 enquête « déficit ») et la **cible du contexte du Labo IA** (K12) | **Signaler, BACKLOG** (CIBLE-05, CIBLE-06) : ce sont des moyennes ou des comptes sur une fenêtre, comparés à **une** cible, hors du pilier Nutrition ; passer à la cible de chaque jour change des alertes, un score et des enquêtes, chacun avec sa recette. **K10 change Noryn** (`composeReadiness`) : il ne peut pas être traité ici | Le périmètre demandé est le pilier Nutrition ; ces écarts sont réels mais d'une autre nature (une fenêtre, pas un jour) | B — les traiter ici, hors K10 (K8, K9, K11 lisent alors `useDailyCalorieTargets`) |

**Décisions dérivées** (à relire, pas d'arbitrage attendu) :

| # | Proposition |
|---|---|
| DD1 | **`useDayCalorieTarget` et `useIsTrainingDay` ne changent pas** : ce sont la référence, et le filet de NORYN-02 (`day-calorie-target-assembly`) doit rester vert sans une ligne modifiée. Ils lisent un jour ; la composition par plage lit une plage — un test de parité fige leur égalité jour par jour (R3). |
| DD2 | **Un même nom, deux sens, documentés** : `DayCalorieTarget.isTrainingDay` (K1) = « jour d'entraînement **et** bonus appliqué » ; `DailyCalorieTarget.isTrainingDay` (les jours de `useDailyCalorieTargets`, et `CrossDay` d'APPORT-01) = **jour d'entraînement** (`trainedOnDay`), ce qu'APPORT-01 groupe (D5) et ce que le champ voulait déjà dire. Les deux types le disent ; pas de renommage (le champ est partagé avec `training-nutrition-cross.ts`). |
| DD3 | `hasTarget` ne se recalcule plus : il vient de `nutritionSocle(…).socle != null` (l'objectif a toujours un repli). |
| DD4 | `isLoading` de `useDailyCalorieTargets` couvre enfin **toutes** ses lectures : la dépense (mode `activities`), les activités, les séances planifiées. Aujourd'hui, la dépense peut arriver après le premier rendu (cible sans bonus un instant). |
| DD5 | Deux briques perdent leur dernier appelant et sont **retirées, avec leurs tests unitaires** : `computeEffectiveTargetForDay` (`nutrition.ts`) et `dayTargetKcal` (`meal-plan.ts`). Leur comportement est couvert par les tests de la composition et par le filet. Le §7 prouve que ce retrait ne change rien pour Noryn. |
| DD6 | Les **jours passés** de la semaine affichée par le planning prennent leur cible réelle (le réalisé, la dépense en mode `activities`) — celle de l'Historique ; aujourd'hui, le réalisé plus l'anticipation. |
| DD7 | Le **libellé de la pastille** du planning suit l'**origine** du bonus (`bonusSource`) et la façon dont le jour est devenu un jour d'entraînement (fait ou seulement prévu) ; l'icône aussi (§11). La composition par plage rend ce « comment » sans recopier la règle : `trainedOnDay` appelée une seconde fois sans les séances planifiées. |
| DD8 | « Aujourd'hui » du planning et de la carte de régularité vient de `useTodayKey` (mis à jour au retour au premier plan, comme le reste de l'app), au lieu de `new Date()` lu au rendu — que React Compiler peut figer (`meal-plan/index.tsx:96`, `:174` ; `RegularityCard.tsx:49-54`). Un écran resté ouvert au premier plan à minuit garde la veille jusqu'au prochain retour, comme partout ailleurs. |
| DD9 | **Les trois poids de NORYN-02 (D5) ne bougent pas** : socle au poids du profil, course du mode `auto` à la dernière pesée, dépense réelle au poids de la date. Seul le widget change de poids pour son socle (C18, C19). |
| DD10 | L'**âge** se prend à la date du jour (`useTodayDate`), partout — comme K1. |
| DD11 | Les libellés d'APPORT-01 (« Jours de séance ») ne changent pas : une sortie vélo y compte désormais, comme elle compte pour la cible. |
| DD12 | Sans ligne de réglages, les piliers actifs sont ceux de `resolveActivePillars` (tous), comme dans K1 — le planning lisait `?? []` et coupait alors le bonus. |

## 4. Le principe : composer, sans recopier

- **Une brique neuve**, dans un fichier neuf de `packages/shared` (`day-target-range.ts`) :
  `composeCalorieTargetsForDays({ dayKeys, todayKey, profile, nutritionProfile, latestWeightKg,
  activePillars, realLifePeriods, workouts, completedRuns, activities, plannedDayKeys, energyKcalByDay,
  dayKeyOf, at })` → pour chaque jour demandé : le résultat de `composeDayCalorieTarget`, plus
  `trainedThatDay` (le résultat de `trainedOnDay`) et `trainedBy` (`'done'` | `'planned'` | `null`).
  Elle range une fois séances, courses et activités par jour (`dayKeyOf`), puis **appelle
  `trainedOnDay` et `composeDayCalorieTarget` pour chaque jour**, avec les seules lignes de ce jour. Elle
  n'écrit ni socle, ni bonus, ni règle de jour d'entraînement ; **le seul point repris** est le
  rattachement d'une ligne à son jour pour le rangement (fin pour une séance ou une course, début pour une
  activité — `day-target.ts:118-121`) : le test d'équivalence (R3) attrape toute divergence.
- **Un hook de lecture**, dans un module à part (`data/repositories/day-targets-repository.ts`) :
  `useCalorieTargetsForDays(dayKeys)` — les lectures, puis la brique. Hors de `dashboard-repository.ts`
  (1 944 lignes, qui charge `@/i18n`) : le planning et la carte de régularité l'importent sans tirer le
  reste.
- **Les écrans gardent leurs lectures** et appellent ce hook : `useDailyCalorieTargets` (et par lui
  l'adhérence, le bilan, le bilan hebdo, APPORT-01, le calendrier, la page d'un jour), le planning repas,
  la carte de régularité (D9).
- **Le widget** (D8-A), sans hook : les constantes SQL et les lecteurs de lignes dont il a besoin sortent
  de leurs repositories vers un **module feuille sans import de bord** (`day-target-sql.ts`), réexportés
  par les repositories ; le widget les importe sans charger `workout-repository` ni `run-repository`
  (qui tirent Health Connect, l'analytique, `react-i18next`, et referment un cycle
  `home-widget-data` → `workout-repository` → `refresh-home-widget` → `render-home-widget`). Le widget
  est enregistré avant expo-router (`index.js`) : son graphe d'imports doit rester léger.
- **`day-target.ts`, `day-energy.ts`, `readiness.ts` ne sont pas modifiés**, ni rien de `noryn/`.

## 5. Règles métier

- **R1 — Aucune formule hors des compositions.** Après l'US, `tdee`, `sportFreeTdee`, `basalMetabolicRate`,
  `activityFactor`, `targetCalories`, `effectiveNutritionObjective`, `objectiveFromGoal`, `isRealLifeDay`,
  `isTrainingDay`, `trainingDayCalories`, `dayCalorieBonus`, `estimateRunCalories`, `computeAge` et
  `DEFAULT_SPORT_FREE_LEVEL` ne sont plus importés par `dashboard-repository.ts`, `meal-plan/index.tsx`
  ni `home-widget-data.ts` (vérifié : dans `dashboard-repository.ts`, `useDailyCalorieTargets` en est le
  seul utilisateur). Un test-garde le fige.
- **R2 — Une cible par jour.** Pour tout jour D, tout mode, tout jeu de données : la cible effective
  de D est la même dans `useDayCalorieTarget(D)`, dans `useDailyCalorieTargets` (jour D noté), dans le
  planning repas (semaine contenant D) et, si D est aujourd'hui, dans le widget. **Seule exception** :
  le planning quand ni muscu ni course n'est actif (D7-B), qui montre la cible de base.
- **R3 — La preuve de R2** : un test monte `useDayCalorieTarget` et `useDailyCalorieTargets` (puis le
  planning) sur les **mêmes sources** et compare jour par jour, dans les trois modes, sur un jeu qui
  contient chaque cas du §6. La composition par plage a, en plus, son test d'équivalence pur : pour
  chaque jour, le même résultat que `trainedOnDay` + `composeDayCalorieTarget` appelés sur les tableaux
  entiers.
- **R4 — Le jour d'entraînement** est celui de `trainedOnDay`, partout : séance ou course terminée ce
  jour-là (jour de la fin), autre activité (jour du début), et, aujourd'hui ou après, séance planifiée
  `planned`/`done` non supprimée, sans jointure (D1, D2, D4).
- **R5 — Une lecture par plage** (D6). La requête des séances planifiées reprend **mot pour mot** le
  filtre de `SELECT_HAS_PLANNED` (propriétaire, `status IN ('planned','done')`, `deleted_at IS NULL`) sur
  une plage de dates ; un test SQLite prouve l'équivalence avec `SELECT_HAS_PLANNED` jour par jour. Une
  liste de jours vide ne lance aucune requête utile (plage vide).
- **R6 — Pour sa cible, le widget lit comme l'app** (D8-A) : séances, courses, activités, séances
  planifiées, pesées et périodes par les constantes SQL et les lecteurs de lignes partagés, jamais
  réécrits. Restent propres au widget, comme aujourd'hui : ses requêtes de série et de séance du jour, et
  la lecture du profil, du profil nutritionnel et des repas du jour (avec son décodage des énumérations).
  Un test-garde le fige pour `computeKcalRemainingMetric`.

## 6. Ce qui bouge — chaque cas, et son test

« Forfait » = `trainingDayBonus` > 0. Rien d'autre ne bouge : un test du filet par écran fige chaque
chiffre qui ne change pas. Chaque cas Cn est un test étiqueté `CIBLE-01 Cn`, écrit à l'étape 1 avec la
valeur d'aujourd'hui, et dont seul l'attendu change à l'étape qui le touche.

**Historique, adhérence, bilans, APPORT-01** (`useDailyCalorieTargets`) :

| # | Situation | Avant | Après | Où ça se voit |
|---|---|---|---|---|
| **C1** | Jour passé avec une **autre activité seule**, mode `fixed` ou `auto` | cible sans forfait | **+ forfait** | calendrier, liste des jours, ligne d'état et qualité de la page du jour, adhérence et bilan (Statistiques, Progrès, bilan hebdo), cible moyenne de Qualité, APPORT-01 |
| **C2** | **Aujourd'hui**, séance planifiée `planned`/`done` pas encore faite, mode `fixed`/`auto` | cible sans forfait | **+ forfait** (D1) | case d'aujourd'hui du calendrier, adhérence et bilan des fenêtres glissantes, Qualité, APPORT-01 |
| **C3** | Jour **futur** noté (« J'ai mangé ça » depuis le planning écrit le repas à sa date, [meal-plan-repository.ts:545-551](../../../../apps/mobile/src/data/repositories/meal-plan-repository.ts#L545)) avec une séance planifiée, `fixed`/`auto` | sans forfait | **+ forfait** | adhérence et bilan des fenêtres glissantes (sans borne haute), Qualité, APPORT-01 — pas le calendrier ni la liste, qui ignorent les jours futurs |
| **C4** | Groupes d'APPORT-01 : jour à **autre activité seule** ; **aujourd'hui** ou jour futur noté avec séance prévue (tous modes) | jour de repos | **jour de séance** (D5) | Labo › « Manges-tu assez pour ta muscu ? » : comptes des deux groupes, moyennes, adhérences ; la carte peut **apparaître** (seuil de 3 jours par groupe franchi) ou disparaître |
| — | Mode `activities`, toute cible de l'historique | — | **inchangée** (même dépense, même socle) | seul C4 joue |
| **C5** | Repas d'un jour à une séance planifiée **`done`** sans séance enregistrée (marquée faite depuis le planning), le jour même | sans forfait | + forfait (C2) ; le lendemain, plus rien (passé : le réalisé seul) | signalé au §13 (CIBLE-03) |
| **C6** | Carte de régularité (D9) : seuil « complète » | Progrès : un tiers de la cible **d'aujourd'hui** ; Statistiques : 600 kcal | un tiers de la cible **de chaque jour** | cases complète / partielle |

**Planning repas** :

| # | Situation | Avant | Après |
|---|---|---|---|
| **C7** | Mode `activities`, **tout jour** | socle `tdee` | **socle hors sport** (−311 kcal sur le profil A) |
| **C8** | Mode `activities`, jour avec séance planifiée | + forfait | **jour futur : rien** (D3), pastille « Séance prévue — sa dépense s'ajoutera » ; **jour passé ou aujourd'hui** : + dépense réelle retenue |
| **C9** | Séance **sautée** (tout jour) | + forfait | **rien** (D2) |
| **C10** | Jour **passé** avec une séance planifiée **non faite** (restée `planned`, ou `done` sans séance enregistrée) | + forfait | **rien** (D4) |
| **C11** | Jour **passé ou aujourd'hui** avec séance, course ou autre activité **faite sans séance planifiée** | rien | **+ forfait** (`fixed`), dépense de la course (`auto`), dépense réelle (`activities`) |
| **C12** | Mode `auto`, jour passé ou aujourd'hui avec une **course terminée** (pilier course actif) | forfait si séance planifiée | **dépense de la course** (RN-02) |
| **C13** | Aucune ligne de réglages | aucun bonus | piliers par défaut (tous) : le bonus du jour (DD12). Ni muscu ni course actif : **inchangé** (D7-B) |
| **C14** | Pastille : libellé selon l'origine (DD7, §11) | « Séance prévue — objectif +X kcal » partout | « Séance prévue… » (prévue), « Jour d'entraînement… » (fait), « Course faite… », « Dépense du jour… » |
| — | Séance planifiée dont la **séance-modèle** a été supprimée hors de l'app (dans l'app, `removeSession` supprime aussi ses occurrences, [program-repository.ts:1075](../../../../apps/mobile/src/data/repositories/program-repository.ts#L1075)) | exclue (jointure) | comptée (sans jointure, comme `SELECT_HAS_PLANNED`) |
| — | Jours futurs en `fixed`/`auto` (séance `planned`/`done`, vie réelle, surcharge) | — | **inchangés** |

**Widget** (D8-A) :

| # | Situation | Avant | Après |
|---|---|---|---|
| **C16** | Jour d'entraînement aujourd'hui (tous modes) | restant sur la cible **de base** | restant sur la cible **effective** (bonus compris) — celui d'Aujourd'hui |
| **C17** | Mode `activities` | socle `tdee` | socle hors sport |
| **C18** | Dernière pesée ≠ poids du profil | socle au poids de la pesée | socle au poids du profil (DD9) |
| **C19** | Profil **sans poids**, avec une pesée (l'inscription n'impose pas le poids) | un « Restant » | **plus de « Restant »** — comme Aujourd'hui, qui n'affiche pas de cible dans ce cas |

Avec D8-B, C16 disparaît (C17 à C19 restent) ; avec D9-B, C6 disparaît ; avec D1-B, C2 et C3
disparaissent et C4 ne garde que l'autre activité ; avec D7-A, C13 donne le bonus d'un pilier éteint.

## 7. Noryn ne bouge pas — la preuve

1. **Rien de ce que Noryn appelle ne change de comportement.** `noryn/targets.ts` importe
   `composeDayCalorieTarget`, `trainedOnDay`, `dayMacroTargets` (`day-target.ts`), `energyItemsByDay`,
   `dayEnergyTotals` (`day-energy.ts`) et `composeReadiness` (`readiness.ts`) ; aucun de ces fichiers ni
   de `noryn/` n'est touché. Un seul fichier de sa fermeture change : `nutrition.ts`, qui perd
   `computeEffectiveTargetForDay` — une fonction qu'aucun module de Noryn n'importe (ni `day-target.ts`,
   ni `noryn/snapshot.ts`). La brique neuve vit dans un fichier à part, que Noryn n'importe pas (Noryn
   n'importe pas `index.ts` ; le test-garde des imports de `targets.ts`, NORYN-02 R1, fige le reste).
2. **Le bundle qui part en production est identique, octet pour octet.** `buildNorynBundle()`
   (`scripts/noryn-context-bundle.mjs`, le build de `npm run noryn:deploy`) est lancé **dans ce
   worktree**, avant la première modification de code (texte gardé dans le scratchpad, jamais commité ni
   affiché), puis à la fin de la branche ; les deux textes sont comparés, et seul le verdict s'affiche. Même
   emplacement, donc mêmes commentaires de chemin. La relecture l'a déjà vérifié sur deux copies : après le
   retrait de `computeEffectiveTargetForDay` et de `dayTargetKcal` et l'ajout d'un module exporté par
   `index.ts`, le bundle est identique — esbuild n'embarque aucune des trois fonctions.
3. **Les tests de NORYN-02 restent verts sans une ligne modifiée** : `targets.test.ts`, `snapshot.test.ts`,
   `source.test.ts`, `source-noryn02.test.ts`, `bundle.test.ts`, la parité SQL (`noryn02-parity-sql.test.ts`,
   `parity.fixture.json`) et les filets `day-calorie-target-assembly`, `day-nutrition-targets-assembly`,
   `readiness-assembly`. Les requêtes déplacées vers le module feuille (§4) restent réexportées sous leurs
   noms actuels, `SELECT_HISTORY_FOR_TEST` compris.
4. **Conséquence** : aucun redéploiement. Et puisque R2 aligne l'historique sur K1, Noryn — qui suit déjà
   K1 — dit désormais aussi ce que dit la ligne d'état d'un jour passé.

✅ **Fait le 22/10/2026 (étape 7)** : bundle reconstruit dans ce worktree et comparé à la référence prise
avant la première ligne de code — **identique**, octet pour octet ; `git diff 9a3ca226` vide sur `noryn/`,
`day-target.ts`, `day-energy.ts`, `readiness.ts`, `supabase/functions/`, le script du bundle et tous les
tests de NORYN-02 ; seule `nutrition.ts` change dans la fermeture de Noryn (retrait de
`computeEffectiveTargetForDay`, qu'aucun de ses modules n'importe).

## 8. Performance

Lectures par instance de `useDailyCalorieTargets` : celles d'aujourd'hui (profil, profil nutritionnel,
dernière pesée, réglages, totaux, historiques de séances et de courses, dépenses, périodes) **plus deux** :
les activités (déjà lues par la dépense ; une requête surveillée de plus) et les séances planifiées de la
plage, en une requête bornée qui ne renvoie que les jours à partir d'aujourd'hui (vide pour une plage
passée). Le calcul est O(lignes + jours). D9-A ajoute **deux** instances (la carte de régularité de
Progrès et celle de Statistiques). Le planning repas lit une plage de 7 jours ; le widget un jour, mais
l'historique entier des séances et des courses, comme les hooks (quelques centaines de lignes). Un test
vérifie qu'une plage de 366 jours ne déclenche qu'**une** requête de séances planifiées.

## 9. Migration : aucune

Tout est calculé en local, sur des tables déjà synchronisées (`planned_sessions`, `activities`,
`workouts`, `workout_sets`, `runs`, `body_weight_entries`, `real_life_periods`, `food_entries`,
`profiles`, `nutrition_profiles`, `user_settings`). Aucune colonne neuve, aucune sync rule, pas de
`db:types`. La requête neuve s'appuie sur les colonnes déjà filtrées par `SELECT_HAS_PLANNED`.

## 10. Cas limites

| Cas | Comportement |
|---|---|
| Profil incomplet (pas de poids, de taille ou de date de naissance) | aucune cible nulle part : verres sans remplissage, adhérence « sans objectif », planning « X kcal prévues », widget sans « Restant » — comme Aujourd'hui |
| Profil sans poids mais avec une pesée | le socle prend le poids du profil : pas de cible, widget compris (C19) |
| Aucun profil nutritionnel | replis de la composition : objectif du but principal, mode `fixed`, forfait 0 |
| Forfait à 0 en `fixed` | aucun chiffre ne bouge ; les groupes d'APPORT-01 bougent quand même (C4) |
| Surcharge manuelle | base = surcharge, même en vie réelle ; bonus ajouté — partout |
| Séance sautée **et** séance libre faite le même jour | jour d'entraînement (le réalisé) |
| Deux séances planifiées le même jour, l'une sautée | jour d'entraînement si l'autre est `planned`/`done` (aujourd'hui ou après) |
| Séance planifiée d'un programme supprimé | occurrences supprimées en cascade (`deleteProgram`, [program-repository.ts:1682](../../../../apps/mobile/src/data/repositories/program-repository.ts#L1682)) : ne compte pas |
| Course `active` ou `cancelled` non supprimée avec `finished_at` | dans la dépense, pas dans le jour d'entraînement (comme K1) |
| Séance finie à 23 h 50 | jour de la fin, heure du téléphone |
| Écran ouvert au passage de minuit | « aujourd'hui » change au retour au premier plan (DD8) ; alors la veille perd son anticipation et le nouveau jour prend la sienne |
| Semaine entièrement passée dans le planning | plage de séances planifiées vide ; le réalisé seul |
| Pilier course éteint, mode `auto` | forfait les jours d'entraînement, jamais la dépense d'une course (comme K1) |
| Ni muscu ni course actif | planning : cible de base, sans pastille (D7-B) ; partout ailleurs : la composition |
| Nutrition éteinte | le widget n'affiche pas « Restant » (LAUNCHER-01 D6) ; les écrans Nutrition sont masqués |
| Téléphone hors du fuseau de Paris | le jour d'un instant est celui du téléphone, partout dans l'app ; Noryn compte à Paris (NORYN-02 D7, inchangé) |

## 11. i18n

Quatre clés neuves, FR + EN, dans `mealPlan.day` (la clé existante `trainingBonus`, « Séance prévue —
objectif +{{kcal}} kcal », reste celle du forfait d'une séance seulement prévue) :

| Clé | FR | EN | Quand |
|---|---|---|---|
| `trainingDone` | « Jour d'entraînement — objectif +{{kcal}} kcal » | « Training day — target +{{kcal}} kcal » | forfait, jour d'entraînement par le réalisé |
| `runBonus` | « Course faite — objectif +{{kcal}} kcal » | « Run done — target +{{kcal}} kcal » | mode `auto`, dépense d'une course |
| `energyBonus` | « Dépense du jour — objectif +{{kcal}} kcal » | « Energy used — target +{{kcal}} kcal » | mode `activities`, dépense réelle |
| `energyLater` | « Séance prévue — sa dépense s'ajoutera » | « Workout planned — its energy use will be added » | mode `activities`, séance prévue aujourd'hui ou après, rien de dépensé |

L'anglais suit le vocabulaire de « Your day in energy » (« energy use », « burned »). Icône de la
pastille : haltère (forfait), marche (course, comme « Ta journée en énergie »), flamme (dépense). La
pastille garde sa place, sa forme et ses couleurs ; le chiffre de la cible garde sa couleur d'alerte
quand un bonus s'ajoute (`MealPlanDayCard.tsx:84`), pas pour `energyLater` (aucun bonus). TalkBack lit le
libellé. Aucune autre chaîne : les autres écrans ne changent que des nombres.

## 12. Comportement offline

Tout se calcule sur la base locale, hors ligne comme en ligne : les compositions ne lisent rien, les
hooks et le widget lisent SQLite (PowerSync). Une activité saisie hors ligne change aussitôt la case du
calendrier, le planning et le widget (à son prochain rafraîchissement). Rien ne part vers le serveur de
plus qu'aujourd'hui.

## 13. Hors périmètre, et écarts signalés (BACKLOG)

- **CIBLE-02 — Le pilier éteint** (D7) : une séance planifiée d'un pilier désactivé donne le forfait dans
  Aujourd'hui et Noryn (pas dans le planning, D7-B). Faut-il l'ignorer partout ? Change `trainedOnDay`,
  donc Noryn.
- **CIBLE-03 — La séance marquée faite sans séance enregistrée** (C5) : elle compte le jour même
  (anticipation), plus le lendemain (le passé ne lit que le réalisé). Change `trainedOnDay`, donc Noryn.
- **CIBLE-04 — Le socle remonté du Labo et du Conseil** (D10) : lire le `socle` rendu par la composition.
- **CIBLE-05 — Les fenêtres jugées sur la cible d'aujourd'hui** (D12 : K8 alerte déficit + volume, K9
  garde-fou, K10 score de forme — qui change Noryn —, K11 enquête « déficit »).
- **CIBLE-06 — La cible du contexte du Labo IA** (D12, K12) : la surcharge seule, `null` sinon.
- `WeekStrip.tsx`, composant sans appelant : à supprimer (dette).
- Unifier les trois poids de la cible (NORYN-02 D5) ; l'âge à l'ouest de Greenwich (NORYN-02 D7).
- Une estimation de la dépense d'une séance **prévue** (D3, alternative).
- Toute évolution du contrat Noryn ; tout redéploiement.

## 14. Recette

### 14.1 Le jeu de données (D11)

Script `supabase/scripts/cible01-recette-donnees.sql` (SQL Editor, rôle du SQL Editor) et
`cible01-recette-nettoyage.sql`, écrits à l'implémentation (plan, étape 8). **Compte de test vierge**
(nouveau compte, ou compte de test purgé), **import Health Connect des pesées coupé**. Le script refuse
de jouer s'il trouve sur ce compte, non supprimés, des repas, séances, courses, activités, séances
planifiées ou périodes « vie réelle » entre J−30 et J+10, ou une pesée quelle qu'elle soit. Seul l'UUID du
compte est à renseigner (jamais commité). Identifiants fixes `c1b1e001-0000-4000-8000-…` ; le nettoyage
ne supprime que ces lignes. Dates **relatives à aujourd'hui à Paris**
(`(now() at time zone 'Europe/Paris')::date`), heures locales de Paris : un jour de recette = un jeu ; le
lendemain, nettoyer et rejouer.

Le script pose le **profil A** (homme, 80 kg, 180 cm, né le 15/01/1996 — 30 ans jusqu'au 14/01/2027,
but « muscle ») et le profil nutritionnel (sèche, « modéré », forfait 300, mode `fixed`, socle « debout »,
marge 10 %, aucune surcharge ni macro manuelle). Il ne les rétablit pas au nettoyage (compte de test).
Préalable : les trois piliers actifs. Socle `tdee` 2 759, hors sport 2 448 ; base 2 359 (`fixed`/`auto`),
2 048 (`activities`).

| Jour | Posé | Mangé (une entrée « Recette CIBLE-01 ») |
|---|---|---|
| J−10 | rien | 700 kcal |
| J−6 | séance de muscu `completed`, 18 h → 19 h (`duration_seconds` 3 600), RPE 7, 12 séries `done` (8 × 60 kg) | 2 650 |
| J−5 | **autre activité seule** : `bike`, 10 h, 3 600 s, `moderate`, RPE 6, 25 000 m, `device_kcal` nul | 2 650 |
| J−4 | rien | 2 300 |
| J−3 | séance planifiée **`skipped`** | 2 300 |
| J−2 | séance planifiée **restée `planned`** (manquée) | 2 300 |
| J−1 | course `completed`, 7 h → 7 h 45 (2 700 s), 8 000 m, `elevation_gain_m` nul, RPE 5 | 2 650 |
| J | séance planifiée **`planned`**, pas faite | 2 620 |
| J+1 | séance planifiée `planned` | — |
| J+2 | séance planifiée **`skipped`** | — |
| J+3 | rien | — |
| J+4 → J+5 | période « vie réelle » ; J+4 : séance planifiée `planned` | — |

Séances planifiées dans un programme brouillon, inactif (« Recette CIBLE-01 »).

### 14.2 Ce qu'on doit lire — écran par écran, dans les trois modes

Valeurs calculées par les fonctions pures le 21/10/2026 et recalculées par la relecture, figées par un
test (plan, étape 8) — le tableau de RECETTES sera copié de ce test. « avant → après » : l'APK d'avant et
celui de l'US ; la recette porte sur « après », « avant » sert à voir ce qui a bougé. Mode changé dans
Réglages › Nutrition entre deux passes ; ✓ dans la cible, + au-dessus, − en dessous (marge 10 %).

**Historique — calendrier, liste des jours, page d'un jour passé** (cible effective) :

| Jour | Forfait | Auto | « Selon ce que tu fais » |
|---|---|---|---|
| J−10 | 2 359 − | 2 359 − | 2 048 − |
| J−6 | 2 659 ✓ | 2 659 ✓ | 2 218 + |
| J−5 | 2 359 + → **2 659 ✓** | 2 359 + → **2 659 ✓** | 2 548 ✓ |
| J−4, J−3, J−2 | 2 359 ✓ | 2 359 ✓ | 2 048 + |
| J−1 | 2 659 ✓ | 3 016 − | 2 608 ✓ |
| J (case remplie, sans statut) | 2 359 → **2 659** | 2 359 → **2 659** | 2 048 |

Sur la page de J−5 : la ligne d'état dit « 2 650 kcal · dans ta cible » en Forfait et en Auto (avant :
« 291 kcal au-dessus de ta cible ») et la cible de « Ta journée en énergie » vaut la même chose, dans les
trois modes.

**Statistiques › Régularité** (« jours dans la cible », bilan calorique ; fenêtres J−7 → J et J−30 → J) :

| Fenêtre | Forfait | Auto | « Selon ce que tu fais » |
|---|---|---|---|
| 7 j | 5/7 (71 %), +357 → **7/7 (100 %), −243** | 4/7 (57 %), 0 → **6/7 (86 %), −600** | 2/7 (29 %), +1 904 — inchangé |
| 30 j | 5/8 (63 %), −1 302 → **7/8 (88 %), −1 902** | 4/8 (50 %), −1 659 → **6/8 (75 %), −2 259** | 2/8 (25 %), +556 — inchangé |

Carte de régularité (D9), Statistiques 30 j, case de J−10 : « complète » → **« partielle »** en Forfait
et en Auto (seuil 786) ; « complète » inchangée en « Selon ce que tu fais » (seuil 683). Progrès (7 j) et
Statistiques (7 j) montrent les mêmes cases.

**Progrès** : le verdict de la semaine porte les chiffres de Statistiques 7 j.

**Bilan hebdo** : ses jours dans la cible = les jours du jeu tombés dans la semaine close, comptés avec
le tableau de l'Historique (jamais J, qui n'est pas dans une semaine close).

**Labo › « Manges-tu assez pour ta muscu ? »** (APPORT-01, J−27 → J) — avant : pas de carte « Jours de
séance vs repos » ni d'adhérence par groupe, dans aucun mode (2 jours de séance, il en faut 3). Après :

| | Forfait | Auto | « Selon ce que tu fais » |
|---|---|---|---|
| Jours de séance / de repos | 4 / 4 | 4 / 4 | 4 / 4 |
| Apports moyens | 2 643 / 1 900, **+743 kcal** les jours de séance | idem | idem |
| Adhérence séance / repos | 100 % / 75 % | 75 % / 75 % | 50 % / 0 % |

**Planning repas** (cible du jour, et pastille) — avant, les trois modes donnaient la même colonne :

| Jour | Avant | Forfait | Auto | « Selon ce que tu fais » |
|---|---|---|---|---|
| J−6 | 2 359 | **2 659** « Jour d'entraînement +300 » | **2 659** idem | **2 218** « Dépense du jour +170 » |
| J−5 | 2 359 | **2 659** « Jour d'entraînement +300 » | **2 659** idem | **2 548** « Dépense du jour +500 » |
| J−4 | 2 359 | 2 359 | 2 359 | **2 048** |
| J−3 (sautée) | 2 659 « Séance prévue +300 » | **2 359** | **2 359** | **2 048** |
| J−2 (manquée) | 2 659 « Séance prévue +300 » | **2 359** | **2 359** | **2 048** |
| J−1 | 2 359 | **2 659** « Jour d'entraînement +300 » | **3 016** « Course faite +657 » | **2 608** « Dépense du jour +560 » |
| J | 2 659 « Séance prévue +300 » | 2 659 « Séance prévue +300 » | idem | **2 048** « Séance prévue — sa dépense s'ajoutera » |
| J+1 | 2 659 « Séance prévue +300 » | 2 659 idem | idem | **2 048** « … sa dépense s'ajoutera » |
| J+2 (sautée) | 2 659 « Séance prévue +300 » | **2 359** | **2 359** | **2 048** |
| J+3 | 2 359 | 2 359 | 2 359 | **2 048** |
| J+4 (vie réelle, séance) | 3 059 « Séance prévue +300 » | 3 059 idem | idem | **2 448** « … sa dépense s'ajoutera » |
| J+5 (vie réelle) | 2 759 | 2 759 | 2 759 | **2 448** |

Chaque cible du planning = celle de l'Historique pour les jours notés, et celle d'Aujourd'hui pour J.
J−6 → J+5 couvre **deux ou trois semaines** du planning selon le jour de la recette (trois un jeudi).

**Widget d'écran d'accueil** (« Restant », mangé 2 620) — avec D8-A :

| | Forfait | Auto | « Selon ce que tu fais » |
|---|---|---|---|
| Restant | −261 → **39 kcal** | −261 → **39 kcal** | −261 → **−572 kcal** |

**Témoins (ne bougent pas)** : Aujourd'hui — cible 2 659 (Forfait, Auto), 2 048 (« Selon ce que tu
fais ») ; « Ta journée en énergie » de chaque jour ; carte Nutrition de l'accueil ; Réglages › Nutrition.

### 14.3 Critères (à porter dans RECETTES, §94)

1. **Calendrier** : les verres et statuts du §14.2, dans les trois modes ; la case d'aujourd'hui remplie
   face à la cible d'Aujourd'hui.
2. **Page de J−5** : ligne d'état et « Ta journée en énergie » sur la même cible, trois modes ; J−6 et J−1
   inchangés.
3. **Statistiques** : jours dans la cible et bilan (7 j, 30 j) du §14.2 ; case de J−10 de la carte de
   régularité.
4. **Progrès** : le verdict reprend les chiffres de Statistiques 7 j ; la carte de régularité montre les
   mêmes cases que Statistiques 7 j.
5. **Bilan hebdo** : jours dans la cible conformes au tableau de l'Historique.
6. **APPORT-01** (Labo) : la carte « Jours de séance vs repos » apparaît, 4 / 4, +743 kcal ; adhérences du
   §14.2 dans les trois modes.
7. **Planning repas** : les cibles et pastilles du §14.2, sur **toutes** les semaines qui couvrent J−6 →
   J+5, trois modes, en FR puis en EN (libellés du §11) ; TalkBack lit la pastille.
8. **Widget** : « Restant » du §14.2, trois modes, après rafraîchissement.
9. **Témoins** : Aujourd'hui, « Ta journée en énergie », carte Nutrition de l'accueil, Réglages : mêmes
   chiffres qu'avant.
10. **Piliers éteints** (D7-B) : Musculation et Course éteintes, le planning ne montre plus aucune
    pastille et prend la cible de base (2 359 en Forfait) ; Aujourd'hui garde le forfait de la séance
    prévue (2 659 — l'écart connu, CIBLE-02). Piliers rallumés ensuite.
11. **Hors ligne — en dernier** : en mode avion, saisir une autre activité sur J−4 (Forfait) : la case de
    J−4, la page de J−4 et le planning prennent le forfait aussitôt. Puis **supprimer cette activité**
    (le nettoyage ne la connaît pas, et la garde refuserait de rejouer le jeu).
12. **Noryn** : le §7 est fait (bundle identique, tests NORYN-02 verts) — vérifié par l'agent, aucun
    geste attendu de Florian.

## 15. Relecture (22/10/2026)

Relecture par un agent de revue, avec vérification dans le code (lecture seule) et recalcul indépendant
de **tous** les chiffres du §14.2 par les fonctions pures (socles, dépenses, adhérences et bilans 7 j /
30 j, groupes d'APPORT-01, seuils de régularité, planning, widget) : confirmés. Confirmés aussi : les
numéros de ligne, le tableau du §2, D1-A (§1.3), l'équivalence de la requête neuve avec
`SELECT_HAS_PLANNED`, la faisabilité de la brique sans formule, le fait que
`goal-adherence-assembly.test.tsx` passera sans modification, le *tree shaking* d'esbuild (bundle Noryn
identique après les retraits de DD5). Ce qu'elle a changé :

- 🔴 **L'inventaire n'était pas exhaustif** : quatre fenêtres jugées sur la cible d'aujourd'hui (K8 à
  K11, dont le score de forme, partagé avec Noryn) et une cible à part dans le contexte du Labo IA (K12). Ajoutées au
  §1, tranchées par D12 (BACKLOG CIBLE-05, CIBLE-06).
- 🟠 La preuve Noryn ne pouvait pas aboutir telle qu'écrite (un worktree hors du dépôt ne résout pas
  `zod`, et les commentaires de chemin changent avec l'emplacement) : le bundle de départ se construit
  désormais **dans ce worktree**, avant tout code (§7).
- 🟠 Le widget ne peut pas importer `workout-repository` ni `run-repository` (graphe d'imports chargé
  avant expo-router, cycle avec `refresh-home-widget`, constantes et lecteurs non exportés) : module
  feuille `day-target-sql.ts` (§4) ; R6 borné à la cible.
- 🟠 Le harnais de tests et le test du planning auraient cassé (mocks absents des filets de NORYN-02,
  `react-i18next` sans `initReactI18next`) : hook dans un module dédié (§4), harnais tolérant (plan).
- 🟠 **D7 n'était pas un cas étroit** (éteindre un pilier ne touche pas aux séances planifiées) :
  recommandation passée de A à **B**, exception à R2 assumée, critère de recette 10.
- 🟡 C3 (seuls l'adhérence, le bilan, Qualité et APPORT-01 voient les jours futurs ; « J'ai mangé ça »
  les rend courants), C4 (jours futurs notés), C19 (widget sans poids de profil), DD8 (`useTodayKey` ne
  bouge qu'au retour au premier plan), DD12 (sans ligne de réglages), références de suppression (§6, §10),
  D5 en mode `activities`, DD2 (deux sens d'un même nom), liste de R1, §8 (deux instances de plus), le
  rattachement au jour repris par la brique (§4), l'anglais de `energyBonus`, la couleur du chiffre (§11),
  le front-matter (4.40, 7.19), et la recette (détail des lignes, garde sur les périodes, Health Connect,
  critère hors ligne en dernier, planning sur deux ou trois semaines).
