---
id: INSIGHTS-02
titre: "Dégonflage du Tier 0 — ramener l'accueil au plafond d'ADR-007"
roadmap: [7.21]
catalogue: []
etape: recette
branche: feature/insights02-degonflage-tier0
maj: 05/08/2026
---

# INSIGHTS-02 — Dégonflage du Tier 0

> Suite directe d'**INSIGHTS-01** (roadmap 7.20, livrée le 05/08/2026), qui a créé l'endroit où
> faire vivre les signaux conditionnels **sans** dégonfler l'accueil — délibérément, pour ne pas
> refactorer des écrans en cours de recette. C'est cette US qui solde la promesse.
>
> **Révision 2 — 05/08/2026.** La première rédaction a été relue contre le code : **7 affirmations
> étaient fausses**, dont deux qui auraient fait perdre une fonctionnalité en silence. Le détail est
> en [§11](#11-ce-que-la-relecture-a-corrigé), et il vaut d'être lu avant de coder.

## 0. Le problème, chiffré

[ADR-007](../../../adr/ADR-007-surfacage-analyses.md) §2 fixe le Tier 0 à **4-6 widgets** et pose que
« ajouter un widget **coûte** un arbitrage, pas un simple `+1` ». L'arbitrage n'a jamais eu lieu :
`HOME_WIDGET_IDS` en compte **21** ([widgets.ts](../../../../packages/shared/src/widgets.ts)),
soit **3,5 × le plafond**. INSIGHTS-01 a même ajouté le 21ᵉ, en le consignant comme dette.

Deux conséquences concrètes, pas théoriques :

1. **Une classe de bug récurrente.** Un widget conditionnel doit être déclaré dans `isWidgetActive`,
   sinon `WidgetGrid` réserve sa cellule et laisse **un trou dans la grille**. L'oubli s'est produit
   **quatre fois** ([index.tsx:43-56](../../../../apps/mobile/src/app/(tabs)/index.tsx#L43-L56)).
   Il y a aujourd'hui **8 widgets conditionnels** sur 21 : la surface d'exposition grandit.
2. **Un coût de montage réel.** `useWeeklyReview` monte à lui seul **≥ 13 requêtes** (2 ×
   `useWeekMetrics` à 6 `useQuery`, plus records, objectifs, objectif de pas, adhérence), et il est
   monté **deux fois** sur l'accueil — une fois par son widget, une fois par l'agrégateur
   d'INSIGHTS-01. Idem pour `useMuscleBalance`, `useGoals`, `useRecentStrengthRecords`, et pour les
   trois alertes (`deficit-volume`, `training-load`, `overtraining-guard`) appelées à la fois dans
   `isWidgetActive` et dans `useInsights` : **7 hooks dédoublonnables**. `useQuery` de
   `@powersync/react` ouvre une souscription **par instance**, sans déduplication.

## 1. Ce que l'audit a corrigé dans le cadrage initial

Le sujet de cette US annonçait que **trois** widgets conditionnels n'avaient nulle part où aller,
faute de porter le moindre chiffre. **Vérification faite, c'est faux pour deux d'entre eux** — et
l'un des deux révèle une erreur factuelle dans la spec d'INSIGHTS-01.

| Widget | Ce qu'annonçait INSIGHTS-01 §2.4 | Réalité vérifiée le 05/08/2026 |
|---|---|---|
| `activity-level-suggestion` | « chaînes, aucune quantité » | ❌ **Faux.** `ActivityLevelSuggestion` porte **`runningDays: number`** — exactement le chiffre qui justifie la suggestion. Il **pouvait** devenir un insight. |
| `concurrent-training-interference` | « `direction` est une chaîne, zéro nombre » | ⚠️ **Vrai en sortie, faux en amont.** `computeConcurrentTrainingInterference` calcule `runRatio` et `strengthRatio` puis **les jette** — le défaut de `useTrainingLoadAlert`, corrigé au §2.5 d'INSIGHTS-01. |
| `readiness` | « trois composantes qualitatives » | ✅ **Exact.** Aucun nombre exposé. |

> 📌 **Correction à porter dans INSIGHTS-01.** Son §2.4 affirme à tort qu'`activity_level` n'a aucune
> quantité. Une spec est une source de vérité : la ligne est corrigée dans cette US (§10), sans
> toucher au code d'INSIGHTS-01.

## 2. Périmètre

**Ramener `HOME_WIDGET_IDS` de 21 à 7**, en donnant à chaque widget retiré une **destination
permanente vérifiée**. Aucun signal ne disparaît, et aucun n'est relégué derrière une condition.

### 2.1 Dans le périmètre

- Le nouveau registre d'accueil et la **recompaction** des layouts stockés (R2 — plus délicate que
  prévu, voir la révision).
- La destination de chacun des 14 widgets retirés, y compris **la création de celles qui manquent**.
- Deux adaptateurs d'insight supplémentaires + la modification bornée de R3.
- La résolution de la double instanciation des **7** hooks (§0.2).
- i18n FR + EN, correction du §2.4 d'INSIGHTS-01, note datée dans ADR-007.

### 2.2 Hors périmètre

- **Aucune analyse nouvelle**, **aucune suppression de fonctionnalité**, **aucun changement du
  moteur de sélection** (`insights.ts` ne reçoit que des entrées d'ordre), **aucune refonte
  visuelle** des cartes.

## 3. La destination de chacun des 21

### 3.0 ⚠️ Un insight n'est PAS une destination permanente

Distinction que la première rédaction confondait, et c'est la plus importante de cette spec.

`INSIGHT_ORDER` contient **déjà** 6 des signaux qu'on retire : `record_recent`, `goal_achieved`,
`weekly_decision`, `muscle_neglected`, `tonnage_change`, `distance_change`. Il serait tentant d'en
conclure qu'ils « ont déjà une destination ». **Non** : une carte d'insight est **conditionnelle**
(au plus 3 affichées, quota par famille, porte de fraîcheur à 14 jours). Un utilisateur peut
parfaitement ne jamais voir sa carte « record » pendant des semaines.

**Règle** : un insight compte comme *surfaçage*, jamais comme *destination*. Chaque widget retiré
doit avoir une destination **permanente**, atteignable quoi qu'il arrive (R1).

### 3.1 Les 7 qui restent

| Widget | Nature | Pourquoi il reste |
|---|---|---|
| `today-session` | permanent | L'action du jour, la raison d'ouvrir l'app. |
| `nutrition-summary` | permanent | Le seul chiffre consulté plusieurs fois par jour. |
| `streak` | permanent | Le moteur de rétention, lisible d'un coup d'œil. |
| `steps` | permanent | Du live du jour par nature — **et son widget est le seul point d'entrée de `/steps`** (R5). |
| `insights` | conditionnel | La porte vers tout ce qui est retiré. |
| `activation-path` | conditionnel, 7 j | Ne pèse que pour les nouveaux comptes, à qui les autres ne parlent pas encore. |
| `cycle` | gardé par réglage | Opt-in strict sur une donnée de santé, invisible par défaut. Le retirer enterrerait une fonctionnalité que l'utilisateur a explicitement activée. |

**Visible en pratique** : **4** pour un utilisateur installé tri-pilier (les 4 permanents), **5-6**
avec un insight du jour et/ou le cycle. C'est la fourchette d'ADR-007.

> **Pourquoi 7 au registre et non 6.** Les 3 derniers ne s'affichent **jamais tous ensemble par
> défaut** : `cycle` exige un opt-in, `activation-path` s'auto-détruit à J+7. Le plafond d'ADR-007
> porte sur ce que l'utilisateur **voit**, et le compte visible respecte 4-6. Le registre est plafonné
> à 7 pour rester testable simplement (R4). Si tu préfères 6 stricts, le candidat à retirer est
> `steps` — mais il redevient alors un écran orphelin (D1).

### 3.2 Les 5 qui deviennent des insights

Leur widget disparaît, leur signal devient une carte. Ce sont des **alertes** : conditionnelles par
nature, elles n'ont jamais eu de destination permanente et n'en demandent pas.

| Widget retiré | Insight | Coût |
|---|---|---|
| `deficit-volume` | `deficit_volume` | ✅ déjà fait |
| `training-load` | `training_load` | ✅ déjà fait |
| `overtraining-guard` | `overtraining_guard` | ✅ déjà fait |
| `activity-level-suggestion` | `activity_level` **(neuf)** | Adaptateur seul |
| `concurrent-training-interference` | `concurrent_interference` **(neuf)** | Adaptateur + R3 |

### 3.3 Les 8 qui descendent en Tier 1 — chemin explicite

Un « oui/non » ne suffit pas : la première rédaction en a classé deux « déjà atteignable » à tort.
Chaque ligne donne le **chemin réel**, et R1 exige **2 gestes au plus** depuis l'accueil.

| Widget retiré | Chemin réel aujourd'hui | Verdict |
|---|---|---|
| `muscle-volume` | Muscu → Progression › « Volume hebdomadaire » (tonnage 7 j + variation) **et** › « Équilibre » (ventilation par groupe) — **deux sections, pas une** | ✅ 2 gestes |
| `running-week` | Course → `/running-history` › Stats, sélecteur par défaut sur `week`. **Pas le hub course**, qui montre la dernière course | ✅ 2 gestes |
| `weight` | Nutrition → Stats, **et** `/measurements` depuis Progression | ✅ 2 gestes |
| `record-recent` | ❌ **Non équivalent.** `/progress` › Records est **par exercice sélectionné** ; le widget montre le dernier record tous piliers + la liste des 4 derniers. Coût réel : **4 gestes**, pour un contenu différent | 🔴 **à créer** |
| `training-time` | ❌ Aucune destination | 🔴 **à créer** |
| `goals` | ❌ `/goals` n'a **que** son widget comme point d'entrée | 🔴 **orphelin** |
| `wellbeing` | ❌ `/wellbeing` idem | 🔴 **orphelin** |
| `review` | ❌ `/review` idem. **La notification hebdo n'y mène pas** : aucun handler de réponse n'existe dans l'app, et la notification ne transporte aucune donnée de routage — l'ouvrir affiche l'accueil | 🔴 **orphelin** |

**Quatre écrans orphelins, pas trois** (`goals`, `wellbeing`, `review`, plus `steps` si D1 le
retire). Et **deux destinations à créer**. C'est le vrai travail de cette US ; le dégonflage
lui-même est trivial.

### 3.4 Le cas isolé — `readiness`

Voir la décision **D3**.

## 4. Règles

### R1 — Aucun signal ne disparaît, et « atteignable » se mesure

Tout widget retiré doit avoir une **destination permanente à 2 gestes au plus** de l'accueil. Une
carte d'insight ne compte pas (§3.0). C'est la règle qui rend ce dégonflage acceptable ; sans elle,
c'est une suppression déguisée. **Le lot 0 du plan la transforme en test.**

### R2 — La recompaction des layouts : ce qui est garanti, et ce qui ne l'est pas

✅ **Garanti** : `resolveScreenLayout` ignore les ids inconnus (filtre `known.has`, appliqué **avant**
le branchement, donc sur les deux chemins de code, plus un second filtrage au parsing). **Aucune
migration de données, aucune migration SQL, aucune sync rule.**

🔴 **Non garanti, contrairement à la première rédaction** : `compactVertical` ne réajuste que
`row`, **jamais `col`**. Un utilisateur ayant passé des widgets en `small` peut donc se retrouver
avec une **demi-cellule vide** : si le `small` de la colonne 0 disparaît et que celui de la colonne 1
reste, ce dernier ne glisse pas à gauche. Le précédent GARDE-01 ne prouve rien — un id retiré contre
quatorze.

Deux issues, à trancher en **D4** :
- **compaction horizontale** dans `compactVertical` (ou repositionnement first-fit complet dès qu'un
  id a disparu du registre) ;
- **assumer** la demi-cellule, et la retirer du critère de recette.

### R3 — `computeConcurrentTrainingInterference` cesse de jeter ses ratios

`ConcurrentTrainingInterference` gagne `runRatio` et `strengthRatio`, **`number | null`**. Le `null`
n'est pas décoratif : la fonction a **4 sites de retour** et deux sont atteints précisément quand un
ratio n'est pas calculable (base chronique nulle). Contrairement à `useTrainingLoadAlert`, ce n'est
donc pas « deux lignes » — c'est 4 retours à compléter et un type nullable à propager jusqu'à
l'adaptateur, qui rendra `null` si l'un des deux manque.

Le widget existant n'est pas modifié : il ne lit que `show` et `direction`.

### R4 — Le plafond devient exécutable

Deux assertions dans `widgets.test.ts` :
1. `HOME_WIDGET_IDS.length <= MAX_HOME_WIDGETS` (= 7) ;
2. **tout id du registre a une entrée dans `WIDGET_REGISTRY.home.pillars`** — plus utile encore que
   le plafond, puisqu'un id sans garde est un widget qui s'affiche à tout le monde par accident.

Le test porte sur le **registre brut**, pas sur « ce qui s'affiche » : compter le visible
supposerait de simuler piliers × réglages × fenêtre temporelle — cher, fragile, et ça n'empêcherait
pas l'empilement du registre, qui est justement l'arbitrage qu'ADR-007 veut rendre coûteux.

### R5 — Quatre écrans ne doivent pas devenir orphelins

`goals`, `wellbeing`, `review` — et `steps` si D1 le retire — perdent leur unique point d'entrée.
**Ils doivent en retrouver un avant que leur widget soit supprimé** (ordre imposé par le plan).
Voir **D2**.

### R6 — Un seul montage des hooks lourds

Après dégonflage, `review`, `muscle-volume`, `goals`, `record-recent` et les 3 alertes ne sont plus
sur l'accueil : l'agrégateur d'INSIGHTS-01 devient leur **seul** point de montage — **7 hooks
dédoublonnés**. À **constater** en fin de chantier, pas à supposer.

### R7 — Le gating par pilier est inchangé

Aucun travail, mentionné pour lever l'ambiguïté : le dégonflage ne touche pas aux gardes.

## 5. Décisions à trancher

### D1 — Le registre à 7, ou 6 stricts ? → **proposition : 7**

Voir l'encadré du §3.1. À 6, le candidat sortant est `steps`, qui redevient orphelin et doit être
rattrapé par D2.

### D2 — Où rattraper les écrans orphelins ? → **arbitrage demandé**

Proposition : **une section « Suivi » sur l'écran Profil**, regroupant `/goals`, `/wellbeing`,
`/review` (+ `/steps` si D1 = 6). Profil est le **seul écran non gaté par pilier**, ce qui convient
à des journaux transverses. `/measurements` n'y est pas nécessaire — il est déjà sur Progression.

⚠️ **C'est le blocage n° 1 du chantier** : sans cette décision, le lot 2 ne peut pas être codé.

### D3 — Que fait-on de `readiness` ? → **arbitrage demandé**

| Option | Pour | Contre |
|---|---|---|
| **A. Il reste** (8ᵉ au registre) | Zéro travail | Affaiblit le plafond le jour où on le pose |
| **B. Insight portant le compte de ses composantes** *(proposition)* | « 2 des 3 signaux au rouge » est un nombre dérivé de données déjà calculées | Chiffre plus faible qu'un ratio ; à spécifier entièrement (§5 bis) |
| **C. Tier 1 sur le hub muscu** | Cohérent avec les autres | Un score de forme est du live du jour : le ranger dans une page de fond le rend inutile |

### D4 — Compaction horizontale ou demi-cellule assumée ? → **arbitrage demandé** (R2)

Proposition : **compaction horizontale**. Retirer 14 widgets d'un coup est exactement le cas où le
défaut se voit, et « une demi-cellule vide » est le genre de détail qui fait douter de tout le reste.

### D5 — Calendrier → **question pour Florian**

⚠️ **Requalifiée après relecture.** Le risque n'est **pas** la recette : cette US n'introduit ni
migration, ni sync rule, ni dépendance native — elle est recettable sur l'APK existant, et les US en
recette ne changent pas de comportement. Le vrai risque est un **conflit de merge** sur
`(tabs)/index.tsx` et `dashboard-widgets.tsx` si un correctif de recette les touche pendant le
week-end. Question simple : préfères-tu que je livre avant, ou après ta recette ?

## 5 bis. Si D3 = B — spécification de la carte `readiness`

À ne coder que si l'option B est retenue.

- **Id** : `readiness`. **Famille** : `alert` — un verdict `rest` signale quelque chose à surveiller.
- **Position** dans `INSIGHT_ORDER` : **après `training_load`, avant `concurrent_interference`**.
  Il agrège trois signaux dont la charge, il passe donc après le signal de charge pur mais avant les
  divergences plus fines.
- **Déclenchement** : seulement quand `verdict === 'rest'`. Un `ok` n'a rien à dire, un `push` est
  une célébration qui n'en est pas une.
- **`metrics`** : `{ negativeCount, availableCount }` — « 2 des 3 signaux sont au rouge ». Les deux
  se dérivent des trois `ReadinessComponent` déjà calculés, sans rien recalculer.
- **`occurredOn`** : `null` (c'est un état).

## 6. Position et famille des deux nouveaux insights

| Id | Famille | Position dans `INSIGHT_ORDER` | `metrics` | `variant` |
|---|---|---|---|---|
| `concurrent_interference` | `alert` | après `training_load` | `{ runRatio, strengthRatio }` arrondis à 2 déc. | `direction` |
| `activity_level` | `alert` | **en fin de bloc `alert`**, avant `record_recent` | `{ runningDays }` | le niveau suggéré |

`activity_level` ferme le bloc parce que c'est une **suggestion de réglage**, pas un risque : elle ne
doit jamais passer devant une alerte de charge.

## 7. i18n — FR + EN

- 2 nouvelles cartes (+ 1 si D3 = B) : titre, corps, variantes de direction pour
  `concurrent_interference`.
- Les libellés de la surface retenue en D2.
- **Rien d'autre** : les widgets déplacés gardent leurs clés.

## 8. Comportement offline

**Aucun changement.** Tout est local. **Aucune migration, aucune sync rule, aucune dépendance
native** → recettable sur l'APK existant, comme INSIGHTS-01.

## 9. Cas limites

| Cas | Comportement attendu |
|---|---|
| Layout stocké portant les 21 anciens ids | Les 14 inconnus ignorés ; la grille se recompacte en lignes. Colonnes → voir R2/D4. |
| Widget conservé mais masqué par l'utilisateur | Reste masqué. |
| Compte neuf | 4 permanents + `activation-path` pendant 7 jours. |
| Mono-pilier nutrition | `today-session` disparaît par gating ; `nutrition-summary`, `streak`, `steps` restent. |
| Cycle activé | 5 permanents. Assumé : opt-in explicite. |
| Aucun insight du jour | Le widget `insights` disparaît. |
| Deux `small` côte à côte dont un retiré | 🔴 Demi-cellule vide sans D4 = compaction horizontale. |

## 10. Critères de recette

1. L'accueil d'un compte installé tri-pilier affiche **4 à 6 widgets**.
2. Un compte ayant personnalisé son accueil ne voit **aucune cellule vide** — *si D4 = compaction
   horizontale*. Sinon, retirer ce critère et assumer.
3. Aucun widget conservé n'a perdu son comportement (taille, réordonnancement, masquage).
4. 🔴 **Les 14 widgets retirés sont tous atteignables en 2 gestes au plus.** Le vrai critère de cette
   US — à vérifier **un par un**, liste fournie dans le plan.
5. `goals`, `wellbeing`, `review` (et `steps` si D1 = 6) s'ouvrent depuis la surface de D2.
6. Les 2 nouvelles cartes d'insight s'affichent avec leurs chiffres quand leur condition est réunie.
7. Mode avion → identique. FR ⇄ EN → aucune chaîne brute. Police 1,5× et thème sombre → sans
   régression.
8. TalkBack → l'accueil reste navigable, ordre de lecture = ordre visuel.
9. Désactiver un pilier → l'accueil se réduit sans trou.

> Le critère « l'accueil s'ouvre plus vite » de la première rédaction est **retiré** : sans repère
> ni protocole, il n'était pas vérifiable. Le gain de montage (R6) est réel mais se constate en
> lisant le code, pas en recette.

## 11. Ce que la relecture a corrigé

| # | 1ʳᵉ rédaction | Réalité du code |
|---|---|---|
| 1 | « la notification hebdo mène à `/review` » | **Aucun handler de réponse n'existe** ; la notification ne transporte aucun routage. `review` est un **4ᵉ orphelin**. |
| 2 | `record-recent` « déjà sur Progression › Records » | Cette section est **par exercice sélectionné** ; contenu différent, **4 gestes**. Destination **à créer**. |
| 3 | « 3 à 4 widgets, au cœur de la fourchette » | ADR-007 dit **4-6** : 3 est **sous le plancher**. D'où `steps` conservé et le registre à 7. |
| 4 | R2 « aucune cellule vide » | `compactVertical` ne réajuste que `row`, **jamais `col`** → demi-cellule possible. Devenu D4. |
| 5 | R6 « 4 hooks, trois d'entre eux » | **7 hooks** dédoublonnés, et le compte interne était incohérent. |
| 6 | « `useWeeklyReview` (9 requêtes) » | **≥ 13**. |
| 7 | R3 « deux lignes » | **4 sites de retour**, et le type doit devenir **nullable**. |

Trous comblés au passage : le sort des composants de carte (plan, lot 4), `running-week` dont la
destination annoncée était fausse, `muscle-volume` qui occupe **deux** sections, la position et la
famille des nouveaux insights (§6), la spécification complète de l'option D3-B (§5 bis), et le
critère de recette non vérifiable (§10).

## 12. Definition of Done

- [ ] `typecheck`, `lint`, `test:coverage` verts, cliquets tenus.
- [ ] `HOME_WIDGET_IDS` ≤ 7 **et** tout id a une garde, vérifiés par test (R4).
- [ ] Les **14** widgets retirés ont une destination permanente vérifiée par le test du lot 0 (R1).
- [ ] Les 4 écrans orphelins ont un point d'entrée (R5).
- [ ] Aucune migration, aucune sync rule, aucun signal supprimé.
- [ ] §2.4 d'INSIGHTS-01 corrigé sur `activity_level`.
- [ ] ADR-007 §2 : note datée — le plafond est désormais appliqué par un test.
- [ ] CHANGELOG, front-matter, roadmap 7.21, RECETTES.md, ETAT.
