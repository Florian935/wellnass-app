---
id: NORYN-02
titre: "Noryn reçoit les cibles et le verdict de forme — la composition sortie des hooks, sans formule recopiée"
roadmap: [9.18]
catalogue: []
etape: recette
branche: feature/noryn02-cibles-forme
maj: 12/10/2026
---

# US NORYN-02 — Noryn reçoit les cibles et le verdict de forme

> **Demande** : Florian, 12/10/2026 — servir à Noryn `energy_target_kcal`, `protein_target_g` et
> `readiness`, qui valent `null` depuis NORYN-01 (sa décision D1-A).
> **Contrat qui fait foi** : Noryn, `docs/08-WELLNESS-CONTRACT.md`, branche `agent/claude/TASK-013`, lu
> le 12/10/2026 — **inchangé**. Aucun champ neuf : `energy_target_kcal` (1–20 000) et `protein_target_g`
> (1–2 000) « as Wellness computes them, or `null` when Wellness cannot compute them » ; `readiness`
> (`rest` / `ok` / `push`) « or `null` when it does not show one ».
> **Prédécesseur** : [NORYN-01](noryn01-noryn-context.md) (clôturée le 12/10/2026), §1 E2 à E5, §2 D1,
> §4, §5 R8-R9. **Plan** : [docs/plans/noryn02-cibles-forme.md](../../../plans/noryn02-cibles-forme.md).
> **Maquette** : sans objet — aucune interface (à un libellé près si D1 retient l'option A, §10).
> **Relue** le 12/10/2026 par un agent de revue : 1 bloquant et 9 constats importants, intégrés (§14).
> ✅ **Validée par Florian le 12/10/2026** : D1-A (une seule règle de protéines) et D2 à D9 **telles que
> proposées** (« D1 : ta reco ; D2 à D9 : tes reco aussi »).
> 🛠️ **Codée le 12/10/2026**, en cinq commits (filets, extraction, D1-A, Noryn, recette) ; écarts au plan —
> des moyens, pas des règles — en fin de plan. En recette : [RECETTES.md](../../../../RECETTES.md) §93,
> après le redéploiement par Florian (`npm run noryn:deploy`). Aucune migration, aucun appel au projet.

## 0. Le besoin

Noryn affiche la journée de Florian à côté de son agenda. Il a déjà ce qui a été mangé ; il lui manque
**la cible**, et l'avis de Wellness sur **la forme du jour**. La règle de NORYN-01 ne bouge pas :
**Wellness calcule, Noryn ne recalcule rien, et aucune formule n'est recopiée côté serveur.** Le calcul
de ces trois valeurs est aujourd'hui **assemblé dans des hooks React** du mobile ; il faut l'en sortir,
sans le changer, pour que la fonction `noryn-context` appelle exactement le même code que l'app.

## 1. À trancher d'abord — l'écart E4

### 1.1 Un défaut, pas un choix

En mode `activities` (DEPENSE-00), deux hooks calculent la cible de base du **même jour** sur deux socles :

| Hook | Socle (`activities`) | Sert à |
|---|---|---|
| `useDayCalorieTarget` ([dashboard-repository.ts:451](../../../../apps/mobile/src/data/repositories/dashboard-repository.ts#L451)) | `sportFreeTdee` — socle **hors sport** | la cible en kcal affichée partout |
| `useDayNutritionTargets` ([useDayNutritionTargets.ts:37](../../../../apps/mobile/src/hooks/useDayNutritionTargets.ts#L37)) | `tdee` — facteur d'activité **sport compris** | les macros de l'onglet Nutrition, et l'explication de la cible |

Trois preuves que c'est un oubli :

- **DEPENSE-00 R1** : « le mode `activities` change AUSSI le socle […] `sportFreeTdee` remplace `tdee` ;
  sans ça, on aggraverait le double comptage ». Sa liste de fichiers (§4) touche `dashboard-repository.ts`,
  pas l'écran Nutrition, qui calculait alors son propre `tdee` (code d'origine du 06/07/2026, `a680d20c`).
  NUTRI-UX03 l'a ensuite sorti dans `useDayNutritionTargets` « sans changement de calcul » (`20a4055a`) :
  le défaut a déménagé avec lui.
- **MN-04 D1** (validée le 04/08/2026) : le bonus du jour va **à 100 % aux glucides** ; « protéines et
  lipides restent ceux du calcul de base ». Le calcul de base, en mode `activities`, c'est le socle hors
  sport.
- **Le résultat ne tient pas debout** : un jour sans dépense, la somme des macros dépasse la cible
  affichée (tableau ci-dessous), et l'explication de la cible n'additionne plus.

### 1.2 Ce que l'app affiche réellement — quatre écrans, trois règles

En cherchant E4, d'autres calculs de la cible de protéines sont apparus. Pour **aujourd'hui**, l'app en
affiche quatre, selon trois règles :

| | Où | Règle |
|---|---|---|
| **(a)** | Onglet Nutrition › Aujourd'hui (barres de macros, carte « protéines restantes ») | manuelle, sinon `trainingDayMacroGrams` sur la base **`tdee`** de `useDayNutritionTargets` |
| **(b)** | Carte Nutrition de l'accueil (tailles large et moyenne) — [NutritionSummaryCard.tsx:132](../../../../apps/mobile/src/components/dashboard/NutritionSummaryCard.tsx#L132) | manuelle, sinon `trainingDayMacroGrams` sur la base de **`useDayCalorieTarget`** |
| **(c)** | Brief du matin (« il te manque X g »), réponse « Que manger ? », faits du bilan du soir de Prisme, objectif minimal de semaine (VIE-01) — `useProteinTarget` ([dashboard-repository.ts:914](../../../../apps/mobile/src/data/repositories/dashboard-repository.ts#L914)) | `manualProteinG` seule, sinon `macroGramsFromCalories` sur la cible **effective** (bonus compris) ; `null` si l'objectif nutritionnel n'a jamais été posé |
| **(d)** | Réglages › Nutrition, les macros de l'objectif — [nutrition-profile.tsx:121](../../../../apps/mobile/src/app/nutrition-profile.tsx#L121) | manuelles, sinon `macroGramsFromCalories` sur une base **`tdee`** quel que soit le mode, sans bonus ni vie réelle (l'écran de réglage en est exclu à dessein, VIE-01) |

Le relais nutrition du mode immersif (`useNutritionRelay.ts:48-59`) recopie la règle (b) : même base,
aucun écart, mais une copie de plus.

Chiffré sur le profil A de DEPENSE-00 (homme, 80 kg, 180 cm, 30 ans, sèche, « modérément actif »,
socle « debout ») : `tdee` = 2 759, socle hors sport = 2 448.

| Jour | Cible kcal affichée | (a) onglet Nutrition | (b) carte d'accueil | (c) brief, Prisme | (d) Réglages |
|---|---|---|---|---|---|
| `activities`, repos | 2 048 | **236 g** — P/G/L = 2 362 kcal | 205 g — 2 049 kcal | 205 g | **236 g** |
| `activities`, 600 kcal dépensées | 2 648 | **236 g** | 205 g | **265 g** | **236 g** |
| `fixed`, séance, forfait 300 | 2 659 | 236 g | 236 g | **266 g** | 236 g |
| `fixed`, repos | 2 359 | 236 g | 236 g | 236 g | 236 g |

Et l'explication de la cible (onglet Nutrition), en mode `activities` un jour de repos : « dépense
2 759, objectif −400, cible 2 048 » — 311 kcal manquent à l'addition, l'écart entre les deux socles.

- **(a)** et **(d)** contredisent DEPENSE-00 R1 en mode `activities` (tous les jours).
- **(c)** contredit MN-04 D1 dès qu'il y a un bonus, **dans tous les modes** : le bonus gonfle les
  protéines. Sa règle « manuelle » diffère aussi (une seule macro manuelle posée donne 0 g en (a)/(b),
  le calcul en (c)).
- **(b)** est la seule qui respecte les deux règles écrites (et (d), hors mode `activities`, n'en est
  que la version « sans bonus », ce qui est son rôle).

### 1.3 D1 — Quelle cible de protéines sert-on, et que fait-on de l'app ?

| Option | Ce qui change | Pour | Contre |
|---|---|---|---|
| **A — Une seule règle, (b), partout** *(recommandée)* | Une fonction pure unique, « manuelles si une macro manuelle est posée, sinon `trainingDayMacroGrams` sur la base de `useDayCalorieTarget` », appelée par l'onglet Nutrition, la carte d'accueil, `useProteinTarget`, le relais du mode immersif et Noryn. Les Réglages montrent la même base **sans bonus** (socle selon le mode, toujours sans vie réelle). L'explication de la cible prend le socle hors sport en mode `activities`. `useProteinTarget` garde son garde « objectif jamais posé → `null` » et rend `null` au lieu de 0 g (une seule macro manuelle posée, sans les protéines). | Le défaut est réparé là où il se voit ; Noryn dit ce que dit l'app, sur tous les écrans ; la règle MN-04 + DEPENSE-00 n'a plus qu'un seul endroit. | Des chiffres **changent** : macros de l'onglet Nutrition et des Réglages en mode `activities` ; protéines du brief, de « Que manger ? » et de Prisme les jours à bonus. Recette de ces écrans. |
| **B — Noryn reçoit (b), l'app ne bouge pas** | Noryn appelle la même fonction que la carte d'accueil ; (a), (c) et (d) passent au BACKLOG. | US plus petite ; aucun chiffre ne change dans l'app. | Noryn contredit l'onglet Nutrition et les Réglages en mode `activities`, et le brief les jours à bonus — des défauts connus laissés en place. |
| **C — Noryn reçoit (a), défaut compris** | Noryn suit l'onglet Nutrition tel qu'il est. | Égal à l'écran le plus regardé. | Noryn reproduit le défaut — ce que le BACKLOG demandait d'éviter. |

**Recommandation : A**, en une étape à part, **après** l'extraction (§4) : l'extraction se prouve
« sans changement » sur le comportement actuel, défaut compris ; la réparation vient ensuite, avec la
liste exacte des chiffres qui bougent (plan, étape 4).

### 1.4 L'écart voisin — `useDailyCalorieTargets` (D2)

`useDailyCalorieTargets` ([dashboard-repository.ts:1769](../../../../apps/mobile/src/data/repositories/dashboard-repository.ts#L1769))
calcule la cible des jours **passés et d'aujourd'hui** (`toKey` nul) pour le calendrier d'Historique, la page d'un jour passé (ligne
d'état), l'adhérence (NUTR-10), le bilan calorique (NUTR-18), le bilan hebdo (BILAN-01) et le lot
APPORT-01. Ses jours d'entraînement sont les séances et courses terminées **seulement** ; ceux de
`useDayCalorieTarget` comptent aussi les **autres activités** (AUTRE-01) et, aujourd'hui et après, une
séance planifiée. Noté au §D9 de NUTRI-UX03, jamais porté au BACKLOG (c'est fait : CIBLE-01, P2).

Effet réel : en mode `fixed` ou `auto`, un jour passé où il n'y a eu **qu'une** autre activité (vélo,
rando…) reçoit le forfait dans « Ta journée en énergie » et pas dans la ligne d'état de la même page,
ni dans l'adhérence. Aujourd'hui, une séance planifiée pas encore faite donne le forfait à l'onglet
Nutrition et pas au calendrier. En mode `activities`, aucun écart (les deux lisent la même dépense).

| Option | |
|---|---|
| **A — Signaler, ne pas toucher** *(recommandée)* | Noryn suit `useDayCalorieTarget` pour toute date (la cible de « Aujourd'hui » et de « Ta journée en énergie »). L'écart entre au BACKLOG (P2), avec le planning repas (§1.5). L'extraction le rend bon marché : il suffira de donner à `useDailyCalorieTargets` le même calcul de jour d'entraînement. |
| B — Aligner dans NORYN-02 | `useDailyCalorieTargets` compose chaque jour avec la même fonction pure. Change l'adhérence, le bilan, le calendrier et les groupes « jour de séance / de repos » d'APPORT-01 sur ces jours-là : recette de cinq écrans de plus. |

### 1.5 Un troisième calcul de la cible du jour — le planning repas (signalé, hors périmètre)

Le planning repas (REPAS-01, [meal-plan/index.tsx:117](../../../../apps/mobile/src/app/meal-plan/index.tsx#L117))
est **le seul écran qui affiche une cible pour un jour futur**, et il la calcule à sa façon : socle
`tdee` **quel que soit le mode** (le défaut E4, en mode `activities`), forfait seul, jour d'entraînement
= séance de la semaine (tout statut) si un pilier d'entraînement est actif. Il diffère donc de
`useDayCalorieTarget` en mode `activities` et sur la règle des séances. Ne touche ni les hooks de cette
US, ni Noryn (D3) : porté au BACKLOG avec D2.

## 2. Le code contre la spec NORYN-01 (vérifié le 12/10/2026 sur `dev`, `749e50ef`)

Aucune affirmation de NORYN-01 n'est fausse ; plusieurs sont incomplètes, et ce qui manque compte
pour NORYN-02.

| # | NORYN-01 dit | Le code dit |
|---|---|---|
| F1 | E2 : la cible affichée est composée dans `useDayCalorieTarget` (`:424`) | ✅ Il manque une entrée : le **jour d'entraînement**, qui déclenche le forfait (`fixed`, `auto`). C'est `useIsTrainingDay` : séance de muscu ou course **terminée** ce jour (jour local de `finished_at`), **ou** une autre activité (jour local de `started_at`), **ou** une séance planifiée `planned`/`done` — **sans** jointure au programme, contrairement au planning — si le jour est aujourd'hui ou futur |
| F2 | E2 : « dépense des courses (poids) » | ✅ Mais il y a **trois poids** dans la même cible : le socle prend `profiles.weight_kg` **seul** (une pesée ne le change pas) ; la dépense des courses du mode `auto`, la **dernière pesée** à défaut du profil ; la dépense réelle du mode `activities`, la **pesée à la date** (`weightAtDate` : la plus récente avant ou ce jour-là, sinon la plus ancienne) à défaut du profil |
| F3 | E3 : la cible de protéines vient de `useDayNutritionTargets` | ✅ pour l'onglet Nutrition, mais quatre écrans en affichent une, selon **trois** règles (§1.2) |
| F4 | E4 | ✅ Confirmé ligne pour ligne (`:37` contre `:451`) — et c'est un défaut (§1.1) |
| F5 | E5 : « énergie et stress des 3 derniers check-ins » | ⚠️ Inexact : ce sont les check-ins des **3 derniers jours du calendrier** (J−2 à J), moyennés sur les jours renseignés — pas les 3 derniers check-ins. Précisions : la nutrition compare la moyenne des jours notés depuis J−6 (**sans borne haute**) à la cible **de base** d'aujourd'hui (`useNutritionSummary().target` : vie réelle et surcharge comprises, socle hors sport en mode `activities`, **sans** la dépense du jour) ; les fenêtres de charge partent de J−6 et de J−27, **sans borne haute** ; une autre activité entre dans la charge avec une fin reconstruite (`started_at` + durée), quels que soient les piliers ; « nuit » = `isPoorNight` (moins de 6 h ou qualité ≤ 2) ; aucune composante évaluable → `show = false` |
| F6 | `useDayEnergy` (cité par E2) | ✅ Précisions : la dépense **n'est gardée par aucun pilier** ; ses courses sont `deleted_at` nul et `finished_at` renseigné, **sans filtre de statut** (contrairement à l'historique, `completed`) — sans effet aujourd'hui, une course annulée étant aussi supprimée ; ses séances comptent les séries **validées**, échauffements compris ; l'âge est celui d'aujourd'hui, pas celui de la date |
| F7 | — | `useRestingMetabolismAt` **recopie** le `restingFor` interne de `useEnergyItemsByDay` (même poids à la date, même âge) : deux copies d'une même règle, sans écart aujourd'hui |
| F8 | D1 : `useDayCalorieTarget` est appelé par sept écrans et hooks | Huit appelants : `activity.tsx`, `DayEnergyCard`, `RunEnergySection`, `WorkoutEnergySection`, `useNutritionRelay`, `useNutritionSummary`, `useProteinTarget`, `useDayNutritionTargets` |
| F9 | R12 : jours civils à Paris côté serveur | Les hooks rattachent un instant au **jour local du téléphone** (`localDayKey(new Date(...))`) et prennent l'âge à `new Date()` : le serveur tourne en UTC. La fonction pure doit recevoir ces deux choses en paramètre (D7) |
| F10 | §6 : le reçu de synchro couvre les tables de NORYN-02 | ✅ sauf **`workout_sets`**, dont le mode `activities` lit le nombre de séries validées. Aucune migration pour autant (§8) |
| F11 | R8 : « NORYN-02 élargira la liste » | Le test-garde exclut **globalement** `stress`, `weight_kg` et `distance_m` ([source.test.ts](../../../../packages/shared/src/noryn/source.test.ts)) : il faut le changer volontairement, table par table (§7) |

## 3. Décisions — validées par Florian le 12/10/2026

| # | Question | Proposition | Pourquoi | Alternative |
|---|---|---|---|---|
| **D1** | La cible de protéines | **Option A** du §1.3 | §1.1 et §1.2 | B, C |
| **D2** | L'écart `useDailyCalorieTargets` | **Option A** du §1.4 : signalé, BACKLOG | US bornée ; Noryn suit la cible de « Aujourd'hui » | B : aligner maintenant |
| **D3** | La cible d'une date **future** (J+1 … J+15, marge de la fenêtre servie comprise), dont la dépense est inconnue | **La même composition**, telle quelle : c'est la cible que l'onglet Nutrition affichera ce matin-là si rien ne change d'ici là. `fixed` et `auto` : socle + objectif (vie réelle de **ce** jour) + forfait si une séance `planned`/`done` y est planifiée ; `activities` : socle + objectif, **sans dépense** (DEPENSE-00 §6 : pas d'anticipation, le réalisé seul compte) | C'est ce que fait déjà `useDayCalorieTarget` pour une date future ; Noryn y lit « ce que Wellness prévoit », un plancher en mode `activities` que la journée relèvera | `null` pour toute date future ; ou `null` en mode `activities` seulement ; ou la valeur du planning repas (§1.5, qui garde le défaut E4) |
| **D4** | `readiness` | **Aujourd'hui à Paris seulement**, et seulement si l'app le montrerait : `show` vrai → le verdict ; `show` faux (aucune composante évaluable) → `null`. Toute autre date → `null`. Jamais synchronisé → `null` (contrat). Une demande partie de Noryn juste avant minuit et reçue après vise « hier » : `null`, ce qui est juste (Wellness ne montre plus ce verdict) | L'app ne calcule le verdict que pour aujourd'hui (`useReadiness` n'a pas de paramètre de date) et l'affiche à la condition `show` (accueil, hub Bien-être, « Que manger ? ») ; un verdict d'hier recalculé aujourd'hui serait une valeur que Wellness n'a jamais montrée | Recalculer pour toute date de la fenêtre passée |
| **D5** | Le poids retenu | **Les trois règles de l'app, chacune à sa place** (F2), par les fonctions extraites : profil pour le socle ; pour la course du mode `auto`, la **dernière pesée** (`ORDER BY log_date DESC LIMIT 1`, sans borne de date — pas la pesée à la date) ; pour la dépense réelle, la **pesée à la date** (`weightAtDate`) ; le profil à défaut des deux | « Comme l'app », au chiffre près. Unifier ces trois poids serait un changement de calcul — à cadrer à part s'il le faut | Un seul poids côté Noryn (divergerait de l'app) |
| **D6** | Vie réelle et surcharge manuelle | **Comme l'app, par la fonction extraite** : période « vie réelle » couvrant **la date demandée** → objectif ramené au maintien (VIE-01 R4) ; `manual_calories` → la cible de base, qui prime sur l'objectif et la vie réelle, bonus ajouté ensuite ; macros manuelles → D1. Aucun motif ne sort (NORYN-01 D4 inchangée) | Ce sont des entrées du calcul, pas des règles de Noryn | — |
| **D7** | Fuseau et fenêtres 7 / 28 j | **Paris côté serveur** (NORYN-01 R12) : « aujourd'hui », les fenêtres (J−6, J−27, J−2) et le jour d'un instant se calculent à Paris. La fonction pure **reçoit** le rattachement d'un instant à un jour (`dayKeyOf`) et l'instant de l'âge (`at`) : l'app lui passe l'heure du téléphone ; le serveur passe le jour de Paris, et pour l'âge **midi UTC d'aujourd'hui à Paris, quelle que soit la date demandée** (l'app prend l'âge d'aujourd'hui pour toute date, DD6) — `at` est obligatoire côté serveur | Identique tant que le téléphone est à l'heure de Paris (contrat : le fuseau de Florian est Europe/Paris) ; en voyage, une séance finie près de minuit peut changer de jour d'un côté seulement. Il n'existe aucune colonne qui dise le fuseau du téléphone. `computeAge` lit des accesseurs locaux : juste sur un serveur en UTC et un téléphone en Europe, faux dans un fuseau à l'ouest de Greenwich (limite existante de l'app, non traitée ici) | Lire le fuseau du téléphone (aucune donnée pour cela) |
| **D8** | Des lignes Postgres aux types du domaine, sans dupliquer les mappers | Les fonctions pures prennent des **entrées étroites**, des `Pick<>` des types du domaine déjà partagés (`ProfileRow`, `NutritionProfileRow`, `Omit<Activity, 'notes'>`, `Pick<RealLifePeriod, 'startedOn' \| 'endsOn'>`…) : le mobile leur passe ses objets **tels quels**. Les **replis** que les hooks et les mappers répètent (`trainingBonusMode ?? 'fixed'`, `trainingDayBonus ?? 0`, `activityLevel ?? 'moderate'`, `sportFreeLevel ?? 'standing'`, objectif repli sur `objectiveFromGoal`) entrent **dans** la fonction pure, une seule fois. Côté serveur, `noryn/snapshot.ts` ne fait que le **décodage de représentation** de Postgres : renommer, booléens natifs, `jsonb` par `parseJsonColumn` (comme NORYN-01), énumérations **à `CHECK`** validées par les schémas zod partagés, `null` admis là où la colonne l'admet ; `activity_type`, sans `CHECK` à dessein, passe tel quel (l'estimation retombe sur « Autre », comme dans l'app) | Les mappers du mobile décodent la représentation **SQLite** (0/1, JSON en texte, doubles encodages) : ce n'est pas la même que celle de Postgres, il n'y a rien à partager là. Ce qui se partage, c'est le type du domaine et les replis — ils vivront dans la fonction pure | Sortir les mappers du mobile vers `shared` avec un paramètre « dialecte » : plus de code, pour décoder deux formats qui n'ont rien en commun |
| **D9** | Ce qui est lu, et quand | **Chaque lecture ne sert qu'à ce qu'elle sert**, en deux temps. **D'abord** ce que NORYN-01 lit pour décider (reçu, réglages, `profiles.user_id` et `daily_step_goal`). **Ensuite**, seulement si le téléphone a déjà synchronisé : les entrées des cibles **si le pilier Nutrition est actif** ; celles du verdict **si la date demandée est aujourd'hui** ; pesées seulement en mode `auto` (la dernière) ou `activities` (la plus récente au plus tard le jour dit, la plus ancienne) — le socle prend le poids du profil —, par lectures ciblées ; séries seulement en mode `activities`, pour les séances du jour ; périodes « vie réelle » couvrant la date. La semaine ne lit **rien de neuf** | Minimisation (NORYN-01 R8) : ni pesées, ni stress, ni profil ne sont lus pour rien. Et PostgREST plafonne une lecture à 1 000 lignes (`max_rows`), sans ordre garanti : lire « toutes les pesées » se couperait en silence | Tout lire à chaque appel du jour (un aller-retour de moins) |

**Décisions dérivées** (à relire, pas d'arbitrage attendu) :

| # | Proposition |
|---|---|
| DD1 | **Bornes** : une cible hors 1–20 000 kcal ou 1–2 000 g part à `null`, jamais rognée (NORYN-01 DD6). Cas réels : profil incomplet (pas de poids, de taille ou de date de naissance → l'app n'affiche pas de cible calorique), une seule macro manuelle posée sans les protéines (0 g → `null`). |
| DD2 | **Jamais synchronisé** : cibles et verdict à `null`. Le contrat permet de donner les cibles, mais en mode `activities` la cible porte des séances **saisies** : on ne distinguerait pas « rien fait » de « rien reçu ». |
| DD3 | **Pilier Nutrition éteint** : `nutrition` reste `null` (NORYN-01 D5) ; le verdict est servi quand même (l'app le calcule : la composante nutrition y est simplement indisponible). |
| DD4 | **Une valeur impossible** dans une colonne à `CHECK` (énumération hors domaine) rend les cibles `null` : on ne calcule jamais un `NaN`, on n'invente jamais un repli que l'app n'aurait pas. `activity_type` n'a pas de `CHECK` (DEPENSE-01, à dessein) : il passe tel quel. |
| DD5 | `show_energy_estimates` (DEPENSE-02) **n'entre pas** dans le calcul : masquer les chiffres n'éteint pas la cible (DEPENSE-00 §3). |
| DD6 | Un jour **passé** se calcule avec le profil, l'objectif et le mode **d'aujourd'hui** — exactement comme l'app recalcule « Ta journée en énergie » d'un jour passé. |
| DD7 | **Protéines sans cible calorique** : si une macro manuelle est posée, l'app affiche les macros manuelles même quand le profil ne permet pas de cible calorique. Noryn fait de même : `protein_target_g` peut être servi avec `energy_target_kcal` à `null` (le contrat ne les lie pas). **Objectif nutritionnel jamais posé** : Noryn suit l'onglet Nutrition (objectif tiré du but principal), comme pour la cible calorique — pas le garde de la carte d'accueil ni de `useProteinTarget`. |
| DD8 | **Une erreur de calcul** (exception dans une composition) met **ce seul champ** à `null` et journalise un code fixe (`target_error`, `readiness_error`) : le contrat dit « `null` when Wellness cannot compute them ». Une erreur de **lecture** reste un 503, une réponse hors contrat un 500 (NORYN-01). |
| DD9 | **Deux pesées le même jour** (aucune contrainte d'unicité sur `body_weight_entries`) : l'app n'en fixe pas l'ordre (SQLite). Le serveur les départage par `id` pour rester déterministe ; l'écart possible avec le téléphone est assumé et testé. |

## 4. Le principe : extraire sans changer

Quatre compositions quittent les hooks pour des fonctions pures de `packages/shared`, exportées par le
paquet et appelées par **l'app et la fonction**. Les hooks ne gardent que leurs **lectures** (requêtes
PowerSync, « aujourd'hui » réactif) et l'appel.

| Hook (reste dans l'app) | Ce qui sort vers `shared` |
|---|---|
| `useEnergyItemsByDay`, `useDayEnergy`, `useRestingMetabolismAt` | le rattachement des séances, courses et activités à leur jour, le métabolisme de repos au poids de la date (avec ce poids), les estimations et la somme des bas de fourchette ; une seule copie de la règle du repos (F7) |
| `useIsTrainingDay` | le jour d'entraînement (rétroactif, autres activités, anticipation) |
| `useDayCalorieTarget` | socle selon le mode (**rendu avec sa nature**, `tdee` ou hors sport, pour l'explication de la cible), objectif (vie réelle du jour), surcharge, dépense des courses (`auto`, pilier course actif), dépense réelle (`activities`), bonus, cible effective, origine du bonus |
| `useDayNutritionTargets` | la cible de base, les macros cibles, `profileComplete` — puis D1 |
| `useReadiness` | fenêtres, charge (piliers actifs + autres activités), nutrition sur 7 j contre la cible de base, bien-être sur 3 j (nuit et « malade » si le pilier Bien-être est allumé), combinaison |

Ce qui reste **en SQL** dans l'app (filtres, `SUM`, `COUNT`, `ORDER BY … LIMIT 1`) n'est pas une
formule, mais le serveur doit le refaire **à l'identique** : c'est R4.

**La preuve « sans changement »** tient en quatre maillons (plan, étapes 1 à 7) :

1. **la parité des lectures** : les requêtes SQL de l'app concernées sont exportées, puis jouées sur un
   **jeu de données unique** — dans le harnais SQLite du mobile d'un côté, dans la fausse base de
   Noryn de l'autre. Les deux côtés doivent retenir les mêmes lignes : mêmes identifiants, même nombre
   de séries, même dernière pesée, mêmes totaux par jour, même `hasPlanned` ;
2. un **filet** de tests d'assemblage des hooks, écrit et vert **avant** l'extraction, qui reste vert
   **sans une ligne modifiée** après — le patron de `goal-adherence-assembly.test.tsx` ;
3. des tests Vitest des fonctions pures (fichiers neufs à 100 % de couverture) ;
4. côté Noryn, des tests qui décodent des lignes Postgres en ces mêmes entrées et vérifient que la
   réponse porte **ce que rend la fonction pure** — même entrée, même sortie, des deux côtés.

La réparation D1 vient **après**, dans son propre commit : les seuls tests du filet qui changent sont
ceux du tableau du §1.2.

## 5. Correspondance, champ par champ

| Champ | Quand | Valeur |
|---|---|---|
| `nutrition.energy_target_kcal` | pilier Nutrition actif (sinon `nutrition` est `null`) **et** synchronisé | `effectiveTarget` de la composition de `useDayCalorieTarget` pour la date demandée (D3, D5, D6) ; `null` si le profil ne permet pas de cible ; DD1, DD8 |
| `nutrition.protein_target_g` | idem | la cible de protéines retenue par D1, pour la date demandée — y compris sans cible calorique si une macro manuelle est posée (DD7) ; DD1, DD8 |
| `readiness` | date = aujourd'hui à Paris **et** synchronisé | `show ? verdict : null` de la composition de `useReadiness` (D4) ; `null` sinon ; DD8 |

Rien d'autre ne change dans les réponses : `context/week` est **identique** à NORYN-01.

## 6. Règles métier

- **R1 — Une seule source de calcul.** Le serveur n'écrit aucune formule : il décode, il appelle les
  fonctions de §4, il borne (DD1). Un test-garde fixe la **liste des imports permis** au module serveur
  des cibles et du verdict : les compositions de §4, le décodage, les dates de Paris — rien d'autre
  (ni `tdee`, ni `computeAge`, ni `weightAtDate`, ni `computeAcwr`, ni aucune brique de calcul).
- **R2 — Les entrées de la cible d'une date D** (pilier Nutrition actif seulement) : profil
  (`birth_date`, `sex`, `height_cm`, `weight_kg`, `main_goal`) ; profil nutritionnel (`objective`,
  `activity_level`, `manual_calories`, `manual_protein_g`, `manual_carbs_g`, `manual_fat_g`,
  `training_day_bonus`, `training_bonus_mode`, `sport_free_level`) ; périodes « vie réelle » couvrant D ;
  pesées (D9) ; séances de muscu, courses et autres activités dont le jour à Paris est D (et le nombre de
  séries validées des séances, en mode `activities`) ; séances planifiées de D ; piliers actifs.
- **R3 — Les entrées du verdict** (date demandée = aujourd'hui seulement) : séances, courses et autres
  activités depuis J−27 (sans borne haute, comme l'app) avec `rpe` et durée ; totaux de kcal par jour
  depuis J−6, si le pilier Nutrition est actif ; check-ins depuis J−2 (`energy`, `stress`,
  `sleep_minutes`, `sleep_quality`, `sick`) ; la cible **de base** d'aujourd'hui (R2) ; piliers actifs et
  pilier Bien-être.
- **R4 — Ce que le serveur refait du SQL de l'app**, requête par requête (patron NORYN-01 E11), chacun
  par un décodeur testé :

  | Requête de l'app | Ce que le serveur reproduit |
  |---|---|
  | `SELECT_HISTORY` (séances) | `status = 'completed'`, non supprimées |
  | `SELECT_WORKOUTS` (dépense) | idem, `finished_at` renseigné ; séries : `COUNT` des lignes `done`, non supprimées, **échauffements compris** |
  | `SELECT_HISTORY` (courses) | `status = 'completed'`, non supprimées → l'ensemble **`completedRuns`** (jour d'entraînement, bonus `auto`, charge) |
  | `SELECT_RUNS` (dépense) | non supprimées, `finished_at` renseigné, **tout statut** → l'ensemble **`finishedRuns`** |
  | `SELECT_ACTIVITIES` | non supprimées ; jour = jour de `started_at` ; fin reconstruite pour la charge |
  | `SELECT_HAS_PLANNED` | `planned`/`done`, non supprimées, **sans jointure**, tout pilier |
  | dernière pesée | `ORDER BY log_date DESC LIMIT 1`, non supprimées, sans borne de date (DD9 pour les égalités) |
  | `useWeightEntries` + `weightAtDate` | la plus récente au plus tard D, sinon la plus ancienne (lectures ciblées, D9) |
  | `SELECT_DAILY_TOTALS` | regroupement par `log_date`, `SUM(kcal)` puis **arrondi jour par jour** ; un jour à 0 kcal compte ; les jours futurs aussi |
  | `useWellbeingEntries` | non supprimés ; le filtre de fenêtre reste celui de la brique |
  | `SELECT_PERIODS` | non supprimées |
- **R5 — Isolation** : chaque table neuve (`real_life_periods`, `body_weight_entries`, `activities`,
  `workout_sets`) est filtrée sur `user_id` = propriétaire et passe par la double barrière (NORYN-01
  R7) : une ligne étrangère fait échouer la réponse (503).
- **R6 — Jamais envoyé** : le stress, l'énergie (hors `recovery.energy` déjà servie), le poids, la
  taille, l'âge, le sexe, l'objectif, le mode, les dépenses, les séances lues, les pesées, les périodes
  et leurs dates **ne sortent jamais** ; seuls les trois champs du §5 portent le résultat. Le schéma
  strict de `contract.ts` reste le garde-fou (NORYN-01 R9).

## 7. Minimisation — la liste blanche s'élargit, volontairement, par usage

La liste blanche n'est plus **une** liste par table mais une liste par **(table, usage)**, sur le modèle
de `WEEK_WELLBEING_COLUMNS` : élargir la journée ne doit pas élargir la semaine.

| Table | Semaine | Journée (NORYN-01) | + cibles (pilier Nutrition actif) | + verdict (aujourd'hui) |
|---|---|---|---|---|
| `profiles` | `user_id`, `daily_step_goal` | idem | `birth_date`, `sex`, `height_cm`, `weight_kg`, `main_goal` | (via la cible de base) |
| `nutrition_profiles` | — | `water_target_ml` **si pilier Nutrition actif** ¹ | `objective`, `activity_level`, `manual_calories`, `manual_protein_g`, `manual_carbs_g`, `manual_fat_g`, `training_day_bonus`, `training_bonus_mode`, `sport_free_level` | — |
| `real_life_periods` *(neuve)* | — | — | `user_id`, `started_on`, `ends_on` | — |
| `body_weight_entries` *(neuve)* | — | — | `user_id`, `log_date`, `weight_kg` (modes `auto` et `activities`) | — |
| `activities` *(neuve)* | — | — | `user_id`, `id`, `activity_type`, `started_at`, `duration_seconds`, `intensity`, `rpe`, `distance_m`, `device_kcal` | `user_id`, `started_at`, `duration_seconds`, `rpe` |
| `workout_sets` *(neuve)* | — | — | `user_id`, `workout_id` (mode `activities`) | — |
| `workouts` | `user_id`, `finished_at` | — | + `id`, `started_at`, `duration_seconds`, `rpe` | `user_id`, `finished_at`, `duration_seconds`, `rpe` |
| `runs` | `user_id`, `finished_at` | — | + `id`, `status`, `duration_seconds`, `distance_m`, `elevation_gain_m`, `rpe` | `user_id`, `finished_at`, `duration_seconds`, `rpe` |
| `daily_wellbeing` | `sleep_minutes` | `sleep_minutes`, `sleep_quality`, `energy`, `motivation`, `sick` | — | + `stress` (J−2 … J) |
| `food_entries` | — | `kcal`, `protein_g` **si pilier Nutrition actif** ¹ | — | `log_date`, `kcal` depuis J−6 |

¹ Changement de NORYN-01, sans effet sur ses réponses : pilier Nutrition éteint, `nutrition` et
`hydration` valent déjà `null` ; on cesse simplement de lire pour rien.

Toujours **jamais lus** : `mood`, toutes les étiquettes sauf `sick`, les modules (`alcohol_drinks`,
`late_caffeine`, `nap_minutes`, `cravings`), les heures de coucher et de lever, tout `name`, `notes`,
`description`, `meal_type`, `food_id`, `micronutrients`, `gps_track`, `avg_pace_s_per_km`, et de
`workout_sets` les charges et répétitions. Le test-garde fige chaque liste en clair, par (table,
usage) : `weight_kg` permis dans `profiles` et `body_weight_entries` seulement, `distance_m` dans `runs`
et `activities`, `stress` dans `daily_wellbeing` pour le verdict seulement. La semaine garde
**exactement** ses lectures de NORYN-01.

## 8. Migration : aucune

Toutes les tables lues existent ; aucune colonne neuve, aucune sync rule. Le reçu de synchro couvre
déjà `activities`, `body_weight_entries`, `real_life_periods` (prévu par NORYN-01) et toutes les autres
tables lues — **sauf `workout_sets`** (F10). Pas de migration pour autant : une série s'écrit pendant la
séance, dont la clôture (`workouts`) pose le reçu ; seule la retouche d'une série d'une séance déjà
close ne l'avancerait pas. `synced_at` serait alors **plus ancien** que la réalité — le sens que le
contrat déclare sans danger (« too old only makes Noryn more cautious »). `db:types` n'a pas à être
relancé (aucun schéma ne change).

## 9. Cas limites

| Cas | Comportement |
|---|---|
| Profil sans poids, taille ou date de naissance | cible calorique `null` (l'app n'en affiche pas) ; protéines `null` sauf macros manuelles (DD7) ; verdict sans composante nutrition |
| Aucun profil nutritionnel | objectif tiré du but principal, mode `fixed`, forfait 0 (replis de l'app) |
| Objectif nutritionnel jamais posé, but principal posé | cibles calculées comme l'onglet Nutrition (DD7) |
| `manual_calories` posé | cible de base = surcharge, même en période « vie réelle » ; bonus ajouté |
| Une seule macro manuelle (glucides), pas de protéines | `protein_target_g` `null` (0 g dans l'app, DD1) |
| Période « vie réelle » le jour demandé seulement | ce jour au maintien, les autres non |
| Date future, séance planifiée, mode `fixed`, forfait réglé | socle + objectif + forfait (D3) |
| Date future, mode `activities` | socle + objectif, sans dépense (D3) |
| Jour passé avec une seule autre activité, mode `fixed` | forfait compris (`useDayCalorieTarget`) — la ligne d'état de la page du jour, elle, ne le compte pas (D2) |
| Course `active` ou `cancelled` non supprimée avec `finished_at` | comptée dans la dépense, pas dans le jour d'entraînement ni la charge (R4, comme l'app) |
| Deux pesées le même jour | départagées par `id` (DD9) |
| Course finie le lundi 26/10/2026 à 00 h 30 à Paris | compte pour le 26/10 (Paris), pas pour le 25/10 (UTC) — dépense, jour d'entraînement et fenêtres |
| Requête à 00 h 30 le jour de l'anniversaire de Florian | âge à Paris (déjà un an de plus), pas en UTC |
| Activité de plus de 48 h | hors de la lecture de charge (bornée à J−29 sur `started_at`) ; aucun cas réel attendu |
| Date demandée ≠ aujourd'hui | `readiness` `null` (D4) |
| Aucune composante évaluable (pas de charge sur 28 j, moins de 4 jours notés, aucun check-in) | `readiness` `null` |
| « Malade » coché ce matin, pilier Bien-être allumé | composante bien-être négative → `rest` (comme l'app) ; `intensity_on_hold` vrai (NORYN-01) |
| Pilier Nutrition éteint | `nutrition` `null`, entrées des cibles non lues, verdict servi (DD3) |
| Jamais synchronisé | cibles et verdict `null`, entrées non lues (DD2) |
| Valeur d'énumération impossible | cibles `null` (DD4) |
| Exception dans une composition | ce seul champ `null`, code de journal fixe (DD8) |

## 10. i18n

**Sans objet pour la fonction** (identifiants de contrat, aucun texte). **Dans l'app**, si D1 retient
l'option A : l'explication de la cible (onglet Nutrition) nomme le socle hors sport en mode
`activities`, au lieu de « Ta dépense estimée sur la journée ». Une clé neuve, FR + EN :
`explain.kcal.sportFree` — « Ta dépense hors sport » / « Your expenditure outside training ». Aucune
autre chaîne.

## 11. Comportement offline

L'app reste hors ligne d'abord : les hooks lisent la base locale comme avant, les fonctions pures ne
lisent rien. Côté Noryn, rien ne change à NORYN-01 §10 : la fonction calcule sur ce que le serveur a
reçu, `synced_at` dit quand ; une cible ou un verdict calculés sur un téléphone vu il y a six heures
sont annoncés comme tels (Noryn tient la source pour ancienne au-delà de 24 h).

## 12. Hors périmètre

- L'écart `useDailyCalorieTargets` (D2-A) et le calcul propre du planning repas (§1.5) : BACKLOG
  (CIBLE-01).
- Deux libellés de plus que le §10 n'en annonçait, côté Réglages (plan, écart 4).
- Unifier les trois poids de la cible (D5) ; l'âge dans un fuseau à l'ouest de Greenwich (D7).
- Un verdict pour un autre jour qu'aujourd'hui (D4).
- Toute évolution du contrat, tout champ neuf, toute écriture depuis Noryn.
- Le déploiement : **Florian**, par `npm run noryn:deploy`, après recette des tests.

## 13. Critères de recette

Préparation : fonction redéployée par Florian (`npm run noryn:deploy`), jeu de données
`supabase/scripts/noryn02-recette-donnees.sql` joué (plan, étape 8), téléphone synchronisé, objectif
nutritionnel posé (sans lui, la carte d'accueil n'affiche pas de macros).

1. **Aujourd'hui** : `energy_target_kcal` = « Ta cible du jour » de l'onglet Nutrition ;
   `protein_target_g` = la cible de la barre Protéines du même onglet **et** de la carte Nutrition de
   l'accueil (taille large).
2. Les mêmes égalités après passage du mode en `auto`, puis en `activities` (Réglages › Nutrition),
   synchronisation entre chaque ; mode remis ensuite.
3. **Jours passés** : J−2 du jeu (une autre activité et une course) et J−4 (une autre activité
   **seule**) : `energy_target_kcal` = la cible de « Ta journée en énergie » sur la page de ce jour. En
   mode `fixed` avec un forfait réglé, J−4 montre l'écart D2 attendu avec la ligne d'état de la page.
4. **Jour futur** (J+3, séance planifiée) : en `fixed`, avec un forfait réglé, cible = celle
   d'aujourd'hui sans le bonus du jour, plus le forfait (chiffres de l'explication de la cible) ; en
   `activities`, socle + objectif. **J+5**, dans la période « vie réelle » du jeu : cible sans
   l'ajustement d'objectif.
5. **Surcharges** : calories manuelles posées → cible = surcharge (+ bonus) ; protéines manuelles →
   `protein_target_g` = la saisie ; retirées ensuite.
6. **Forme** : `readiness` = le verdict affiché à l'accueil et dans le hub Bien-être ; « malade » coché
   (pilier Bien-être allumé) → `rest` des deux côtés ; `?date=` d'hier → `null`.
7. Pilier Nutrition éteint → `nutrition` `null`, `readiness` toujours servi.
8. Les réponses passent `WellnessDayWireSchema` et `WellnessWeekWireSchema` de Noryn ; la semaine est
   identique à avant ; aucune trace du stress, du poids, de l'âge, de l'objectif ou des dépenses ; les
   journaux de la fonction ne portent que des codes fixes.
9. **Non-régression de l'app** (mêmes chiffres qu'avant, sauf ceux que D1 change — §1.2) : onglet
   Nutrition (cible, reste, macros, explication), Réglages › Nutrition, carte Nutrition de l'accueil
   (trois tailles), page d'un jour passé, Statistiques (adhérence, bilan), « Ta journée en énergie »,
   sections énergie des bilans de séance et de course, relais nutrition du mode immersif, score de forme
   (accueil, hub Bien-être, Labo), brief du matin et « Que manger ? ».
10. **Si D1 = A** : en mode `activities`, la somme des macros de l'onglet Nutrition retombe sur la
    cible, l'explication de la cible additionne, et les Réglages montrent les mêmes protéines de base ;
    les jours à bonus, le brief du matin annonce les mêmes protéines que l'onglet Nutrition.

## 14. Relecture (12/10/2026)

Relecture par un agent de revue, avec vérification dans le code (lecture seule). Les chiffres du §1.2,
les lignes citées, F1 à F11, R2-R3 et l'absence de migration sont **confirmés**. Ce qu'elle a changé :

- 🔴 **Rien ne prouvait que le serveur filtre comme le SQL de l'app** : le filet simule les requêtes,
  la parité comparait à des entrées écrites à la main. Ajout d'un maillon « parité des lectures » (§4) :
  requêtes de l'app exportées, jeu de données unique joué des deux côtés.
- 🟠 `at` (âge) précisé : aujourd'hui à Paris pour toute date, obligatoire côté serveur (D7).
- 🟠 Lecture en deux temps recadrée : le premier temps ne lit plus le profil étendu ; pilier Nutrition
  éteint, plus de lecture des repas ni du profil nutritionnel (D9, §7).
- 🟠 Listes blanches **par usage** : élargir la journée n'élargit plus la semaine ; `stress` lu pour le
  verdict seulement (§7).
- 🟠 Ce que le serveur refait du SQL écrit requête par requête, avec deux ensembles de courses (R4).
- 🟠 Pesées lues de façon ciblée : PostgREST plafonne à 1 000 lignes sans ordre garanti (D9).
- 🟠 Le socle est rendu par la composition (pour l'explication de la cible) : ne plus le recalculer à
  part, la cause même d'E4 (§4).
- 🟠 Une quatrième cible de protéines (Réglages › Nutrition) et une copie de la règle (relais du mode
  immersif) (§1.2, D1).
- 🟠 Protéines sans cible calorique et objectif jamais posé tranchés (DD7) ; `activity_type` sans
  validation (DD4) ; une erreur de calcul ne fait plus tomber toute la journée (DD8) ; deux pesées le
  même jour (DD9).
- 🟡 F5 (pas de borne haute), §1.4 (aujourd'hui aussi), noms de types (D8), recette (forfait réglé,
  jour à activité seule, objectif posé), D3 (J+15), D4 (minuit).
