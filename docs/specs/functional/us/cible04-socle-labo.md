---
id: CIBLE-04
titre: "Le Labo « Et si… » et le Conseil des trois partent du socle de la cible du jour, et non plus d'une cible remontée"
roadmap: [7.30, 7.34]
catalogue: []
etape: close
branche: fix/cible04-socle-labo
maj: 23/10/2026
---

# US CIBLE-04 — Le socle du Labo « Et si… » et du Conseil des trois

> ✅ **Validée par Florian le 23/10/2026** (D1-A, D2-A, D3-A telles que proposées), **codée et clôturée le
> même jour** en un commit, poussé sur `dev`. Le test d'assemblage a d'abord été **rouge** sur S1, S2, S3
> et S5 (3 159, 2 400, 2 400, 2 848 au lieu de 2 759, 2 759, 2 759, 2 448), vert sur S0, S4 et le profil
> incomplet ; tous les chiffres du §1 sont affirmés par `lab-composer-socle.test.tsx`. Aucun fichier de
> `packages/shared` ni de `supabase/` modifié : Noryn n'a pas bougé. Pas de recette consignée (règle du
> 23/10/2026) : la vérification sur téléphone, si Florian la demande, suit la fin du §11.

> **Demande** : Florian, 23/10/2026 — `/us CIBLE-04` (BACKLOG P2, constat D10 de CIBLE-01). Lire le socle
> au lieu de le recalculer ; recenser tous les lecteurs de `tdeeKcal` ; un test qui échoue d'abord, sur
> le cas « vie réelle » et sur le cas surcharge.
> **Sources** : BACKLOG, ligne CIBLE-04 (retirée par cette US) ; spec [CIBLE-01](cible01-cible-du-jour.md)
> §1.2 (ligne K5) et D10 ; spec [NORYN-02](noryn02-cibles-forme.md) (le `socle` rendu par la composition,
> D1-A) ; specs [LABO-01](labo01-labo.md) (« Cible calorique : `objectiveCalorieDelta` + TDEE du profil »)
> et [CONS-01](cons01-conseil-des-trois.md).
> **Plan** : [docs/plans/cible04-socle-labo.md](../../../plans/cible04-socle-labo.md).
> **Maquette** : sans objet. Aucun écran ne change de forme : seuls des chiffres changent, et deux
> libellés si D3-A est retenue (§8).
> **Roadmap** : pas de ligne neuve. La correction porte sur 7.30 (Labo) et 7.34 (Conseil des trois),
> déjà livrées.
> **Vérifié dans le code** le 23/10/2026 sur `origin/dev` (`d604dec2`). Chiffres du §1 calculés par les
> fonctions pures du dépôt (`composeDayCalorieTarget`, `composeLab`, `buildCouncil`), pas à la main.
> **Noryn ne bouge pas** : `composeDayCalorieTarget` est lue, jamais modifiée ; aucun fichier de
> `packages/shared` ni de `supabase/` n'est touché (§6). Aucune migration, aucun déploiement.

## 0. Le besoin

Le Labo « Et si… » (onglet Composer) et le Conseil des trois (feuille `CouncilSheet`, ouverte depuis la
carte de contradiction GUID-01 de l'accueil, depuis le Labo et depuis la fiche d'un lien) projettent ce
que donnerait **un autre objectif** : cible calorique, poids à 8 semaines, protéines. Ils partent d'une même base, `tdeeKcal` : la dépense de référence, à laquelle le composeur
ajoute le delta de chaque objectif.

`useLabComposer` ne lit pas cette base : il la **remonte** depuis la cible de base du jour, en retirant
le delta de l'objectif choisi
([lab-repository.ts:481-484](../../../../apps/mobile/src/data/repositories/lab-repository.ts#L481)) :

```ts
tdeeKcal: target === null ? null : target - objectiveCalorieDelta(objective),
```

L'inversion ne tient que si la cible de base vaut exactement « socle + delta de l'objectif ». Deux cas
courants la cassent :

- **Pendant une période « vie réelle »**, la cible du jour est déjà ramenée au maintien (VIE-01 R4) :
  retirer encore le delta d'une sèche ajoute 400 kcal à la dépense de référence, et à **toutes** les
  projections.
- **Avec une cible saisie à la main**, la cible ne dépend plus du socle : l'inversion donne
  « surcharge − delta », un chiffre qui n'est ni la dépense ni la surcharge.

Le bon socle existe déjà : `composeDayCalorieTarget` le rend (champ `socle`), `useDayCalorieTarget` le
remonte, l'onglet Nutrition l'affiche. Cette US le **lit**.

## 1. Le défaut, chiffré

Profil A (celui des tests de NORYN-02 et CIBLE-01) : homme, 80 kg, 180 cm, né le 15/01/1996 (30 ans au
23/10/2026), but principal « muscle » ; sèche, niveau « modéré », forfait 300, socle hors sport
« debout ». Socle `tdee` **2 759** ; socle hors sport **2 448**. Aucune séance ce jour-là (pas de forfait),
pesée à 80 kg. But « muscle » + sèche = la contradiction `bulkVsCut` de GUID-01 : le Conseil s'ouvre.

| Cas | Cible d'Aujourd'hui | `tdeeKcal` avant | `tdeeKcal` après |
|---|---|---|---|
| S0 — mode Forfait, rien de particulier | 2 359 | 2 759 | 2 759 |
| S1 — pause « vie réelle » qui couvre aujourd'hui | 2 759 (maintien) | **3 159** ✗ | 2 759 |
| S2 — cible saisie à la main : 2 000 | 2 000 | **2 400** ✗ | 2 759 |
| S3 — pause **et** cible saisie à la main | 2 000 (la surcharge prime) | **2 400** ✗ | 2 759 |
| S4 — mode « Selon ce que tu fais » | 2 048 + la dépense du jour | 2 448 | 2 448 |
| S5 — mode « Selon ce que tu fais » + pause | 2 448 + la dépense du jour | **2 848** ✗ | 2 448 |

Ce qui s'affiche, avant → après (protéines et poids ne bougent pas : ils ne lisent pas `tdeeKcal`) :

| Écran | Chiffre | S0 | S1 | S2 / S3 | S4 | S5 |
|---|---|---|---|---|---|---|
| Labo › Composer, carte calories, réglages actuels (sèche) | kcal/jour | 2 359 | 2 759 → **2 359** | 2 000 → **2 359** | 2 048 | 2 448 → **2 048** |
| — levier objectif sur « perte progressive » | kcal/jour | 2 509 | 2 909 → **2 509** | 2 150 → **2 509** | 2 198 | 2 598 → **2 198** |
| — sur « maintien » | kcal/jour | 2 759 | 3 159 → **2 759** | 2 400 → **2 759** | 2 448 | 2 848 → **2 448** |
| — sur « prise de masse » | kcal/jour | 3 059 | 3 459 → **3 059** | 2 700 → **3 059** | 2 748 | 3 148 → **2 748** |
| Conseil › voix Nutrition | cible / dépense | 2 359 / 2 759 | 2 759 / 3 159 → **2 359 / 2 759** | 2 000 / 2 400 → **2 359 / 2 759** | 2 048 / 2 448 | 2 448 / 2 848 → **2 048 / 2 448** |
| Conseil › issue « garder l'objectif principal » (prise de masse) | kcal/jour | 3 059 | 3 459 → **3 059** | 2 700 → **3 059** | 2 748 | 3 148 → **2 748** |
| Conseil › issue « garder le réglage du pilier » (sèche) | kcal/jour | 2 359 | 2 759 → **2 359** | 2 000 → **2 359** | 2 048 | 2 448 → **2 048** |
| Poids à 8 semaines (sèche / prise de masse) | kg | −2,9 / +2,2 | inchangé | inchangé | inchangé | inchangé |
| Protéines (sèche, 1,8 g/kg × 80 kg) | g/jour | 144 | inchangé | inchangé | inchangé | inchangé |

**Après la correction, les projections ne dépendent plus ni de la pause ni de la surcharge** : pour un
profil et un mode donnés, S0 à S3 affichent les mêmes chiffres (S4 et S5 aussi, entre eux). C'est le
sens d'une simulation d'objectif : « que donnerait chaque objectif, calculé sur ta dépense ».

⚠️ **Ce que la correction déplace** : avant, la ligne « réglages actuels » collait à la cible
d'Aujourd'hui **par construction** (on retirait le delta puis on le rajoutait) — c'étaient les autres
objectifs et la « dépense estimée » qui étaient faux. Après, tous les chiffres sont justes **pour
l'objectif**, mais pendant une pause ou avec une surcharge, la ligne « réglages actuels » diffère de la
cible d'Aujourd'hui (S1 : 2 359 contre 2 759 ; S2 : 2 359 contre 2 000). Or la carte s'intitule
« Cible du jour » et la voix du Conseil dit « Ta cible est à… » : c'est l'objet de D3.

## 2. L'inventaire — qui produit, qui lit `tdeeKcal`

Cherché dans tout le dépôt (`apps/`, `packages/`, `supabase/functions/`) : `tdeeKcal`, `useLabComposer`,
`composeLab`, `buildCouncil`, `councilNumbers`, et toute inversion `… - objectiveCalorieDelta(…)`.

| # | Où | Rôle | Ce qui change |
|---|---|---|---|
| P1 | [lab-repository.ts:484](../../../../apps/mobile/src/data/repositories/lab-repository.ts#L484) — `useLabComposer` | **seul producteur** : remonte depuis `useNutritionSummary().target` | lit `useDayCalorieTarget(aujourd'hui).socle` |
| L1 | [lab-composer.ts:146](../../../../packages/shared/src/lab-composer.ts#L146) — `project` | `targetCalories(tdeeKcal, objectif)` + séances en plus → `kcalTarget` | rien (lu tel quel) |
| L2 | [lab-composer.ts:207](../../../../packages/shared/src/lab-composer.ts#L207) — `composeLab` | `kcalTarget` à `null` sans `tdeeKcal` | rien |
| L3 | `bestLabSteps` (même fichier) | « le réglage le plus rentable » : trie sur la force et les croisements, **jamais** sur les calories | rien — vérifié : aucun croisement ne lit `kcalTarget` |
| L4 | [council.ts:80](../../../../packages/shared/src/council.ts#L80) — `buildCouncil` | pas de Conseil sans poids ni `tdeeKcal` | rien |
| L5 | [council.ts:123](../../../../packages/shared/src/council.ts#L123) — voix Nutrition | `{ kcal, tdee }` | les valeurs (§1) |
| L6 | `councilNumbers` (même fichier) | liste de référence du garde-fou NARR-01 quand le modèle résume le Conseil | les valeurs ; mêmes champs, aucune donnée nouvelle vers le fournisseur d'IA |
| E1 | [lab.tsx:109,149-150](../../../../apps/mobile/src/app/(tabs)/lab.tsx#L109) → [LabComposerPanel.tsx:83-86](../../../../apps/mobile/src/components/lab/LabComposerPanel.tsx#L83) | carte « Cible du jour » du Composer | le chiffre ; le libellé si D3-A |
| E2 | [CouncilSheet.tsx:80-83](../../../../apps/mobile/src/components/dashboard/CouncilSheet.tsx#L80), ouverte par `GoalConflictBanner` (accueil), `lab.tsx:491` et `lab-link.tsx:454` | voix, deux issues chiffrées, résumé IA | les chiffres ; le texte de la voix si D3-A |

**Ne lisent pas `tdeeKcal`**, vérifiés : Noryn (n'importe ni `lab-composer` ni `council`) ; le Labo IA
(`ai-context-repository`, sa cible est CIBLE-06) ; la scène 3D du Labo (`scene-state.ts:116` lit le
**delta** de l'objectif, pas une cible) ; les enquêtes du Labo (`useLabHistory` lit la cible de base du
jour pour l'enquête « déficit » — fenêtre jugée sur la cible d'aujourd'hui, c'est CIBLE-05, hors
périmètre). Les tests `lab-screen`, `CouncilSheet`, `council` et `lab-composer` passent un contexte figé
(`tdeeKcal: 2600` ou `2750`) : ils ne bougent pas. Aucune autre inversion `cible − delta` dans le dépôt.

## 3. Décisions — à valider

| # | Question | Proposition | Pourquoi | Alternatives |
|---|---|---|---|---|
| **D1** | Pendant une **pause « vie réelle »**, sur quoi le Labo et le Conseil projettent-ils ? | **A — sur l'objectif tel qu'il est réglé**, à partir du socle : la sèche reste à 2 359 dans la simulation, même si Aujourd'hui affiche le maintien (2 759) le temps de la pause | La règle de VIE-01 (`effectiveNutritionObjective`) : un écran qui affiche **la cible du jour** applique la pause, un écran où l'on **règle son objectif** ne l'applique pas. Le Labo et le Conseil servent à choisir un objectif pour 8 semaines ; une pause dure quelques jours. Et le levier « objectif » écrit l'objectif réglé, pas celui de la pause | **B** — statu quo : la ligne « réglages actuels » colle à Aujourd'hui, mais chaque projection est fausse de +400 kcal en sèche (+250 en perte progressive, −300 en prise de masse) et la « dépense estimée » aussi. **C** — aucune projection calorique pendant une pause (`tdeeKcal` à `null`) : la carte disparaît du Labo et **tout** le Conseil dit « pas encore de quoi chiffrer », force comprise |
| **D2** | Avec une **cible saisie à la main** | **A — le socle aussi** : chaque objectif chiffré comme si la cible était calculée, la surcharge n'entre pas dans la simulation. Les **protéines** saisies à la main, elles, restent la référence du levier protéines (`lab-repository.ts:450-454`) — asymétrie voulue : le Labo **écrit** les protéines à la main (`manualProteinG`, `lab.tsx:283-285`), alors qu'il n'écrit jamais la surcharge calorique, seulement l'objectif | C'est ce que veut dire « Et si je passais en prise de masse » : la cible que l'objectif donnerait. « Surcharge − delta » n'est la dépense de personne | **B** — statu quo (décalage relatif à la surcharge : 2 000 → 2 700 en prise de masse). **C** — aucune projection calorique avec une surcharge (`null`) : le Conseil disparaît pour quiconque a posé une cible à la main |
| **D3** | **Le dire** : après D1-A et D2-A, la carte « Cible du jour » et la voix « Ta cible est à … » montrent la cible **de l'objectif**, qui diffère de celle d'Aujourd'hui pendant une pause ou avec une surcharge | **A — deux libellés, FR + EN, sans toucher aux composants** : la carte devient « Cible de cette formule » ; la voix devient « Ton réglage nutrition vise {{kcal}} kcal/jour, pour une dépense estimée à {{tdee}} kcal » (§8) — « réglage nutrition » et non « objectif », mot que le Conseil réserve au but principal (« Garder mon objectif »). Les deux phrases ne prétendent plus dire la cible d'Aujourd'hui. Restent inexacts, **avant comme après**, deux cas portés au §12 : en mode « Selon ce que tu fais », la cible réelle ajoute la dépense du jour ; avec une surcharge, l'issue « Garder mon objectif » chiffre une cible que l'écriture ne produira pas | Sans cela, l'US **introduit** un écart visible : pendant une pause, le Labo dirait « Cible du jour 2 359 » à côté d'un Aujourd'hui à 2 759 — ce que CIBLE-01 vient de supprimer partout ailleurs. ⚠️ **Élargit le périmètre demandé** (`lab-repository.ts` et ses tests) de deux clés de traduction ; les deux fichiers de langue sont partagés avec les sessions parallèles, mais les clés ne sont qu'à CIBLE-04 | **B** — périmètre strict, l'écart de libellé porté au BACKLOG. **C** — en plus de A, une phrase contextuelle quand une pause ou une surcharge est active (« Semaine allégée jusqu'au 25/10 : Aujourd'hui reste au maintien » / « Ta cible saisie à la main prime ») : composants, hooks et tests en plus — à cadrer à part |

**Décisions dérivées** (à relire, pas d'arbitrage attendu) :

| # | Proposition |
|---|---|
| DD1 | **On lit `useDayCalorieTarget(aujourd'hui).socle`**, pas `nutritionSocle` appelé à côté : c'est le chiffre qu'affiche l'onglet Nutrition et que Noryn compose, avec les mêmes replis (niveau « modéré », socle « debout », mode `fixed`). `useNutritionSummary` sort de `useLabComposer` (il ne servait qu'à `target`) : **une lecture SQL de moins** (les totaux du jour), aucune de plus — `useDayCalorieTarget(aujourd'hui)` était déjà monté par lui. `useLabHistory` garde `useNutritionSummary` (CIBLE-05). |
| DD2 | **Mode « Selon ce que tu fais »** : le socle est hors sport (DEPENSE-00 R1), comme aujourd'hui en dehors des pauses (S4 inchangé). La voix du Conseil appelle ce socle « dépense estimée » alors qu'il ne compte pas le sport — écart antérieur, **inchangé**, signalé au §12. |
| DD3 | `isLoading` de `useLabComposer` prend celui de `useDayCalorieTarget` à la place de celui de `useNutritionSummary` : il couvre la composition, dépense du jour comprise (déjà le cas, par ricochet). |
| DD4 | Le commentaire de `lab-repository.ts:481-483` est **faux** (« avec une cible saisie à la main, cette inversion est approximative — l'écran le dit ») : aucun écran ne le dit. Il disparaît avec l'inversion. |
| DD5 | **Aucun fichier de `packages/shared` n'est modifié** — ni `day-target.ts` (contrainte Noryn), ni `lab-composer.ts`, ni `council.ts`. Le contexte du composeur garde sa forme ; seul le nombre qu'on y met change. |

## 4. Règles métier

- **R1 — Un seul socle.** La dépense de référence du Labo et du Conseil est le `socle` de la cible du
  jour d'aujourd'hui, tel que `composeDayCalorieTarget` le rend. Plus aucune inversion « cible − delta »
  dans le dépôt.
- **R2 — Le socle ne dépend que du profil, du profil nutritionnel, du mode et de la date** (l'âge). Ni la
  pause « vie réelle », ni la surcharge, ni le bonus du jour ne le déplacent (c'est le cas par construction dans
  `composeDayCalorieTarget` ; un test l'affirme côté Labo).
- **R3 — Parité.** `useLabComposer().context.tdeeKcal` = `useDayCalorieTarget(aujourd'hui).socle`, dans
  tous les cas (S0 à S5, profil incomplet compris).
- **R4 — Pas de socle, pas de projection calorique** (inchangé) : profil incomplet (poids, taille ou
  date de naissance manquant) → `tdeeKcal` à `null` → le Labo n'affiche pas la carte calories, le Conseil
  dit « pas encore de quoi chiffrer ». Une surcharge seule ne suffit pas (elle n'en donnait déjà pas :
  sans socle, la cible de base est `null`).
- **R5 — Rien d'autre ne bouge** dans le contexte : réglages actuels (séances, sorties, protéines,
  objectif, nuits), poids, force, charge, durée des courses.

## 5. Ce qui bouge — chaque chiffre, et son test

| Cas | Avant | Après | Test (plan, étape 1) |
|---|---|---|---|
| S0, S4 | — | — | non-régression : verts avant **et** après |
| S1 — pause, Forfait | `tdeeKcal` 3 159 | 2 759 | 🔴 rouge avant la correction |
| S2 — surcharge 2 000 | 2 400 | 2 759 | 🔴 rouge avant |
| S3 — pause + surcharge | 2 400 | 2 759 | 🔴 rouge avant |
| S5 — pause, « Selon ce que tu fais » | 2 848 | 2 448 | 🔴 rouge avant |
| Profil incomplet | `null` | `null` | vert avant et après |
| Projections (Composer, quatre objectifs ; Conseil, voix et deux issues) | §1 | §1 | chiffres figés, depuis le contexte rendu par le vrai hook |

Le test qui échoue d'abord est un **test d'assemblage** : le vrai `useLabComposer` sur le vrai
`useDayCalorieTarget` et la vraie `composeDayCalorieTarget`, seules les **sources** étant simulées (le
patron `day-target-sources.ts` de NORYN-02 et CIBLE-01). Un test qui simulerait `useDayCalorieTarget`
ne prouverait que l'appel, pas le chiffre.

## 6. Noryn ne bouge pas

`noryn-context` compose sa cible avec `composeDayCalorieTarget`, `dayMacroTargets` et `trainedOnDay`
(`packages/shared/src/noryn/targets.ts:18`). Cette US **lit** le résultat de la première dans l'app et ne
modifie aucun fichier de `packages/shared` ni de `supabase/` : le bundle de la fonction est identique, aucun
redéploiement. Preuve au moment du commit : `git diff --stat origin/dev -- packages/shared supabase` vide.

## 7. Cas limites

| Cas | Comportement |
|---|---|
| Pause qui commence demain, ou finie hier | Sans effet aujourd'hui — ni avant ni après |
| Jour d'entraînement (forfait, course du mode Auto) | Sans effet : le socle n'inclut pas le bonus (la cible de base non plus, avant) |
| Pesée différente du poids du profil | Le socle prend le **poids du profil** (règle de la composition) ; les protéines du Labo, la **dernière pesée**. Écart antérieur, inchangé |
| Anniversaire, minuit | Le socle suit l'âge du jour (`useTodayKey`) : ~8 kcal de moins par année, comme Aujourd'hui |
| Surcharge sans profil complet | `null`, comme avant (R4) |
| Objectif non réglé | Repli sur le but principal (`appliedObjective`), dans la composition comme dans `useLabObjective` |
| Changement de mode de bonus pendant que le Labo est ouvert | Le socle change à la synchro locale suivante (lecture réactive), comme Aujourd'hui |
| Résumé IA du Conseil (NARR-01) | Mêmes champs, valeurs corrigées ; le garde-fou compare au même `councilNumbers` |

## 8. i18n

**Aucune chaîne nouvelle, aucune chaîne en dur.** Si **D3-A** est retenue, deux valeurs changent, en FR
et en EN, sans clé nouvelle ni retirée :

| Clé | FR avant → après | EN avant → après |
|---|---|---|
| `lab.composer.kcal` | « Cible du jour » → « Cible de cette formule » | « Daily target » → « Target for this formula » |
| `council.voice.nutritionTarget` | « Ta cible est à {{kcal}} kcal/jour, pour une dépense estimée à {{tdee}} kcal. » → « Ton réglage nutrition vise {{kcal}} kcal/jour, pour une dépense estimée à {{tdee}} kcal. » | « Your target is {{kcal}} kcal/day, for an estimated {{tdee}} kcal burned. » → « Your nutrition setting aims for {{kcal}} kcal/day, for an estimated {{tdee}} kcal burned. » |

« Formule » (« formula ») est le mot que le Composer emploie déjà, en FR et en EN (« Rien ne se gêne
dans cette formule. »). La carte inclut aussi les calories des séances ajoutées dans la formule : « cible
de cette formule » le couvre, « cible de l'objectif » ne le couvrirait pas. Dans le Conseil, « objectif »
désigne le but principal (« Tes deux objectifs se contredisent », « Garder mon objectif ») : la voix
Nutrition dit donc « réglage nutrition ». Les nombres restent formatés par l'écran comme aujourd'hui.

## 9. Comportement offline

Inchangé : tout est lu dans la base locale (profil, profil nutritionnel, périodes « vie réelle »,
pesée), aucun appel réseau. Une pause ou une surcharge posée hors ligne déplace Aujourd'hui tout de suite
et **ne déplace plus** le Labo ni le Conseil (R2).

## 10. Migration : aucune

Aucune table, aucune colonne, aucune sync rule, aucun `db:types`. Aucune action sur le cloud.

## 11. Critères d'acceptation — ce que les tests prouvent

Les chiffres attendus sont ceux du §1, **affirmés par le test d'assemblage**, sur le profil A. Depuis le
23/10/2026, la recette n'est plus consignée (plus de RECETTES.md ; une US passe de `code` à `close`) : la
section §99 réservée au cadrage est caduque.

1. S1, S2, S3 et S5 : le test d'assemblage est **rouge** sur le code actuel (3 159, 2 400, 2 400, 2 848
   au lieu de 2 759, 2 759, 2 759, 2 448), puis vert.
2. Dans les six cas, `tdeeKcal` = le `socle` d'Aujourd'hui (R3).
3. S0 à S3 donnent les mêmes projections (Composer : 2 359 / 2 509 / 2 759 / 3 059 ; Conseil :
   voix 2 359 / 2 759, issues 3 059 et 2 359) ; S4 et S5 aussi entre eux (2 048 / 2 198 / 2 448 / 2 748 ;
   voix 2 048 / 2 448 ; issues 2 748 et 2 048).
4. Poids (−2,9 / +2,2 kg) et protéines (144 g) inchangés dans tous les cas.
5. Profil incomplet : `tdeeKcal` à `null`, avec ou sans surcharge ; `buildCouncil` rend `null`.
6. Aucun fichier de `packages/shared` ni de `supabase/` modifié (§6).
7. `lab-sql.test.tsx` : le socle est lu (pas la cible), le chargement de la cible du jour est relayé, et
   ni une cible au maintien ni une surcharge ne déplacent `tdeeKcal`.
8. Si D3-A : les deux valeurs du §8 en FR et en EN ; la parité des clés FR/EN reste verte.
9. `npm run typecheck`, `npm run lint`, `npm run test` verts (code de sortie lu sans pipe).

Pour une vérification sur téléphone, à la demande : profil A (but « muscle », sèche, pesée à 80 kg),
Musculation et Nutrition actives ; lire la carte calories du Composer et le Conseil (accueil › carte de
contradiction › « Voir les chiffres », ou depuis le Labo), puis recommencer après « Alléger la semaine » (accueil), puis
après « Ajuster manuellement » à 2 000 kcal (profil nutritionnel) : les chiffres du Labo et du Conseil
restent ceux de S0, Aujourd'hui passe à 2 759 puis à 2 000.

## 12. Hors périmètre, et constats

- **Une surcharge fige la cible, quel que soit l'objectif écrit.** `keepMainGoal` (GUID-01, repris par
  le Conseil) et le levier « objectif » du Labo écrivent l'objectif, pas la surcharge
  ([goal-conflict-resolution.ts:16-19](../../../../apps/mobile/src/data/goal-conflict-resolution.ts#L16)) :
  avec une cible à 2 000, passer en prise de masse depuis le Conseil laisse Aujourd'hui à 2 000. Ni
  l'ancien calcul (2 700) ni le nouveau (3 059) ne le disent, et le commentaire de `council.ts:54`
  (« ce que l'écriture de GUID-01 produit réellement ») est faux dans ce cas. Antérieur à cette US
  (LABO-01, GUID-01) ; à porter au BACKLOG avec D3-C si Florian le souhaite.
- **Le commentaire de `council.ts:41`** (« la cible calorique actuelle et son écart au maintien ») décrit
  la voix Nutrition comme la cible actuelle ; avec D3-A, elle dit la cible du réglage nutrition. Il ne
  peut pas être corrigé ici (DD5, aucun fichier de `packages/shared`) : à reprendre à la prochaine US qui
  touche `council.ts`.
- **« Dépense estimée » en mode « Selon ce que tu fais »** : le chiffre est le socle hors sport (DD2),
  pas une dépense totale. Antérieur, inchangé.
- **CIBLE-05** : l'enquête « déficit » du Labo (`useLabHistory`) juge une fenêtre sur la cible
  d'aujourd'hui. Même fichier, autre US : non touchée ici.
- Les écrans Muscu, Nutrition, Course et Prisme ne sont pas touchés.

## 13. Relecture (23/10/2026)

Relue par un agent de revue sur le code du worktree (`d604dec2`), sans rien modifier. **Aucun point
bloquant** : références de lignes, inventaire (seul producteur, deux lecteurs de `useLabComposer`, Noryn
hors d'atteinte, aucune autre inversion), règles R1-R5 et **tous les chiffres du §1, recalculés de façon
indépendante** (métabolisme de base 1 780 ; 2 759 ; 2 448 = 2 447,5 arrondi), y compris au 08/10/2026 de
l'horloge des tests. Le test d'assemblage est faisable (`useQuery` est simulé globalement par
`jest.setup.ts`) et serait bien rouge sur S1, S2, S3 et S5, vert sur S0, S4 et le profil incomplet.

Corrigé à la suite :
- voix du Conseil : « Ton objectif vise » → « Ton réglage nutrition vise » (« objectif » y désigne le but
  principal, juste au-dessus de « Garder mon objectif ») ; EN « formula » et « aims for » (§8, D3) ;
- D3 ne prétend plus que chaque phrase devient vraie dans tous les cas (mode « Selon ce que tu fais »,
  surcharge + « Garder mon objectif ») ; constats `council.ts:41` et `:54` ajoutés au §12 ;
- D2 : l'asymétrie protéines saisies (référence du levier) / calories saisies (ignorées) est dite voulue ;
- R2 : le socle dépend aussi de la date ; §0 et E2 : les trois points d'entrée du Conseil ;
- plan : un troisième test de `lab-sql.test.tsx` à adapter (le relais du chargement), un cas « pause »
  qui pose bien une sèche (sinon vert avant la correction), les sources du Labo posées dans le test et
  non dans le harnais partagé ;
- §11 et plan, étape 4 : la règle « recette à la demande » n'est pas encore sur `origin/dev` — la
  clôture suivra la règle en vigueur au moment de livrer.
