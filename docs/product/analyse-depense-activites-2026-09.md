# La dépense : ce que coûte une séance, et ce que ça change dans l'assiette

Date : 15/09/2026. Statut : **proposition de cadrage**, à discuter. Ce document n'est ni une
spécification validée ni une fonctionnalité livrée. Aucune ligne de code applicatif n'a été écrite.

Demande (Florian, 15/09/2026) — deux idées qui se rejoignent :

1. **Estimer la dépense calorique à la fin d'une séance**, de musculation comme de course, d'après
   son contenu et le profil (niveau, âge, taille, poids…), pour la **croiser avec la nutrition** :
   savoir où on en est sur la journée, s'il faut manger un peu plus ou un peu moins ;
2. **Saisir à la main une autre activité** (vélo, natation…) : un type, une durée, et la même
   estimation de dépense.

**Maquettes** : toile [design/depense-activites-2026-09/](../../design/depense-activites-2026-09/)
(publiée : https://claude.ai/artifact/JzRGWW3ze6NbhgMP7MiNw9) — 7 écrans, 3 façons d'afficher une
estimation et un prototype jouable qui applique les formules proposées ici. Images de conception, **données fictives**, non validées : le
[README du dossier](../../design/depense-activites-2026-09/README.md) dit ce qu'elles supposent.

**Profils fictifs utilisés dans tout le document** — pour que chaque chiffre soit vérifiable :
**A** = homme, 30 ans, 180 cm, 80 kg · **B** = femme, 45 ans, 165 cm, 60 kg.

---

## 1. En bref

- **L'idée 1 est à moitié là, et personne ne la voit.** La course a une estimation de dépense
  (RN-01) branchée sur la cible du jour (RN-02). Mais le chiffre n'apparaît **jamais à la fin d'une
  course**, il vaut **0 sur tapis**, il ignore le dénivelé, et il n'agit que si l'utilisateur a
  trouvé le réglage « Auto ». La **musculation n'a aucune estimation** : un forfait fixe, désactivé
  par défaut, identique pour 20 minutes de gainage et 1 h 30 de jambes.
- **L'idée 2 est absente.** L'application ne connaît que **deux** activités, partout : la série, la
  charge d'entraînement, le « jour d'entraînement », le temps d'entraînement et Health Connect.
  Trois heures de vélo le dimanche comptent pour un jour de repos, et cassent la série.
- **Un défaut de fond est à régler avant d'afficher le moindre chiffre : le sport est déjà compté
  une fois dans la cible.** Le « niveau d'activité » (×1,2 à ×1,9) inclut l'entraînement, et le
  bonus Auto le rajoute par-dessus. Chiffré au §3 : pour un coureur déclaré « modérément actif »,
  l'écart atteint **~95 % du déficit d'une sèche**. Brancher la muscu et les activités sur ce
  modèle-là aggraverait le défaut au lieu de le corriger.
- **Proposition : d'abord montrer, ensuite piloter.** Phase A : la dépense en fin de séance et les
  activités manuelles, **sans toucher à la cible** (sans risque, visible, utile seul). Phase B : une
  cible « **socle hors sport + dépense réelle** », qui répare le double comptage et fait vraiment
  parler l'entraînement à l'assiette.
- **Une décision presse, et elle n'a rien à voir avec le code** : la déclaration santé du Play Store
  ne se dépose **qu'une fois** (LANCE-00). Écrire ou lire des calories dans Health Connect un jour
  impose de le décider **avant** ce dépôt (§8, D7).

---

## 2. Ce que fait l'application aujourd'hui — onze constats vérifiés

### Côté course : une estimation qui existe, mais reste invisible

**C1 — La formule existe et elle est saine.**
[`estimateRunCalories`](../../packages/shared/src/running.ts#L687) : **dépense nette** ≈ poids ×
distance × 1,0 kcal/kg/km, plus un terme d'intensité borné (+1 % par km/h au-delà de 8 km/h,
plafonné à +10 %). « Nette » signifie qu'elle compte ce que la course **ajoute** au métabolisme de
repos, déjà présent dans la cible. Recette sur appareil validée le 16/07/2026.

**C2 — Le chiffre n'est jamais montré à la fin d'une course.** [run/summary.tsx](../../apps/mobile/src/app/run/summary.tsx)
ne contient aucune calorie. On ne le voit qu'**indirectement**, dans la pastille « +823 kcal ·
course » de la scène Nutrition, et seulement en mode Auto.

**C3 — Par défaut, rien ne bouge.** `trainingBonusMode` vaut `'fixed'` et `trainingDayBonus` vaut
`0` ([nutrition.ts:518-520](../../packages/shared/src/nutrition.ts#L518)). Sur un compte neuf,
séance ou pas, **la cible est la même tous les jours**.

**C4 — Sans GPS, une course vaut zéro calorie.** Le mode sans GPS (roadmap 5.21, qui « couvre aussi
le tapis ») crée une course sans distance, et la formule rend `0` dès que la distance manque. Une
heure de tapis n'ajoute rien.

**C5 — Le dénivelé est calculé, mais pas utilisé.** Le résumé l'affiche (RUN-F1b), l'estimation
l'ignore. Un trail de 15 km avec 800 m de D+ est estimé comme 15 km à plat : **1 202 kcal** pour le
profil A, contre ~1 840 avec la règle usuelle du « kilomètre-effort » (§4.3).

**C6 — Le poids utilisé est le dernier, même pour les jours passés.**
[dashboard-repository.ts:450](../../apps/mobile/src/data/repositories/dashboard-repository.ts#L450)
prend la dernière pesée, y compris pour l'adhérence rétroactive (NUTR-10, NUTR-18). Quelqu'un qui
perd 6 kg voit ses courses d'il y a deux mois **recalculées à la baisse**, et son adhérence passée
changer après coup — contre le principe déjà posé par VIE-01 (« une cible rétroactive doit refléter
ce qui était demandé ce jour-là »).

### Côté musculation : un forfait aveugle

**C7 — Aucune estimation, et un forfait qui peut disparaître.** [`dayCalorieBonus`](../../packages/shared/src/nutrition.ts#L209)
applique un forfait fixe les jours de séance, **faite ou simplement planifiée**, quel que soit son
contenu. Et en mode Auto, un jour avec course **et** muscu ne garde que la course :
`if (runCaloriesToday > 0) return runCaloriesToday` — le forfait muscu disparaît.

Pourtant, le bilan de séance calcule déjà tout ce qu'il faut : durée, séries de travail, densité,
ressenti, charge sRPE et répartition musculaire ([`SessionTotals`](../../packages/shared/src/workout-report.ts#L181)).

### Le défaut de fond

**C8 — Le sport est compté deux fois en mode Auto.** La cible part de
[`tdee()`](../../packages/shared/src/nutrition.ts#L140) = métabolisme de base (Mifflin-St Jeor) ×
**facteur d'activité**, et les paliers de ce facteur sont **définis par la fréquence
d'entraînement** : RN-03 suggère « modéré » à partir de 3 séances par semaine. Le sport est donc déjà
dans la cible, et le bonus s'y ajoute. Détail et chiffres au §3. La migration
`nutri_ux01_activity_level_nullable` montre que l'équipe a déjà rencontré une face de ce problème :
un ×1,55 appliqué en silence à un sédentaire surestimait sa cible de ~614 kcal/j.

### Côté activités : deux types, partout

**C9 — Il n'existe aucun troisième type d'activité.**

| Où | Ce qu'il connaît | Référence |
|---|---|---|
| Série (streak) | muscu · course · nutrition · pas | [streak.ts:56](../../packages/shared/src/streak.ts#L56) |
| Jour d'entraînement | séance muscu ou course | [training-day.ts:19](../../packages/shared/src/training-day.ts#L19) |
| Charge (GARDE-01, ACWR, readiness) | `workouts` ∪ `runs` | [training-time.ts:46](../../packages/shared/src/training-time.ts#L46) |
| Temps d'entraînement (MR-06) | `strengthSeconds` + `runningSeconds` | [training-time.ts:13](../../packages/shared/src/training-time.ts#L13) |
| Health Connect | `STRENGTH_TRAINING` (70) · `RUNNING` (56) | [health-connect.ts:16](../../packages/shared/src/health-connect.ts#L16) |

La bonne nouvelle : la **charge sRPE** (ressenti × minutes) ne dépend d'aucun pilier. Une activité
avec une durée et un ressenti s'y branche sans changer la formule.

**C10 — Les briques utiles existent déjà.** Le métabolisme de base personnalisé
([`basalMetabolicRate`](../../packages/shared/src/nutrition.ts#L130) : âge, taille, poids, sexe) ;
le patron « d'où vient ce chiffre » avec un niveau de confiance
([`explainCalorieTarget`](../../packages/shared/src/explain.ts#L71)) ; le report du bonus sur les
glucides (MN-04) ; l'anticipation des séances planifiées (4.7b) ; la carte « Charge muscu & apports »
(MN-03).

**C11 — Un piège attend l'import.** IMPORT-01 (spec à l'étape validation, pas codée) mappe un GPX
Strava sur `runs` **sans lire le type d'activité**. Une sortie vélo importée deviendrait une course
de 60 km à 25 km/h — et **un record**. À corriger dans la spec d'import dès qu'on la reprend,
indépendamment de ce qui suit.

---

## 3. Le piège : le sport compté deux fois

Profil **A**, métabolisme de base **1 780 kcal/j**, déclaré « modérément actif » parce qu'il court
quatre fois 10 km par semaine, en 55 minutes.

| | Calcul | Par jour (moyenne semaine) |
|---|---|---|
| Sédentaire | 1 780 × 1,2 | 2 136 |
| **Modérément actif** | 1 780 × 1,55 | **2 759** — dont **623 kcal/j** qui représentent son entraînement, soit **4 361 kcal/semaine** |
| Bonus Auto (RN-02) | 4 × 823 kcal, étalé sur 7 jours | **+470 kcal/j** — soit **3 292 kcal/semaine** |
| **Total vu par l'app en Auto** | 2 759 + 470 | **3 229 kcal/j** |

Son entraînement est compté une première fois dans le ×1,55, puis une seconde fois par le bonus.

**Avec le modèle proposé** (§4) — socle **hors sport** « debout souvent » (1 780 × 1,375 = 2 448) et
ses courses ajoutées au **bas de leur fourchette** (4 × 700 kcal) : 2 448 + 400 = **2 848 kcal/j**.

**L'écart vaut 381 kcal/j, soit 2 667 kcal/semaine — 95 % du déficit d'une sèche (−400 kcal/j,
soit −2 800 kcal/semaine).** En mode Auto, ce coureur croit être en sèche. Sur la semaine, il est
presque au maintien.

> ⚠️ **Honnêteté sur l'ampleur.** Le chiffre dépend du palier « hors sport » retenu. Avec un socle
> « assis » (×1,2), l'écart grandit ; avec un socle « physique » (×1,55), il disparaît presque. Le
> **sens** du défaut, lui, ne dépend d'aucune hypothèse : dès qu'un palier inclut l'entraînement, un
> bonus par séance le double. C'est pourquoi la phase B commence par demander le mode de vie **hors
> sport**, et que l'horizon 2 propose de **calibrer le socle sur l'évolution du poids** (§7).

**Conséquence pour la suite** : afficher une dépense en fin de séance ne crée aucun risque. En
revanche, **ajouter la dépense de la muscu et des activités au bonus actuel étendrait le double
comptage à tous les utilisateurs**, pas seulement aux coureurs en Auto. Le mode Auto actuel mérite au
minimum un avertissement, même si rien d'autre n'est entrepris.

---

## 4. Le modèle proposé

### 4.1 Une seule formule pour tout

> **dépense nette = (MET − 1) × métabolisme de repos par heure × heures actives**

- Le **MET** mesure l'intensité d'une activité : 1 MET correspond au repos. Les valeurs de
  référence viennent du **Compendium of Physical Activities** (Ainsworth 2011, mis à jour par
  Herrmann en 2024), la table de référence en recherche.
- Le « **− 1** » retire le repos, **déjà compté dans la cible**. C'est la convention nette que
  RN-01 a déjà choisie pour la course : on reste cohérent.
- Le **métabolisme de repos par heure** est celui de l'utilisateur : son métabolisme de base
  Mifflin-St Jeor divisé par 24. **C'est là qu'entrent l'âge, la taille, le poids et le sexe.** Le
  Compendium 2024 recommande justement cette correction : le MET « standard » suppose 1 kcal/kg/h et
  surestime la dépense des personnes plus âgées ou en surpoids.

| Même séance de musculation, 1 h à 6 MET | Repos / h | Dépense nette |
|---|---|---|
| MET standard (1 kcal/kg/h), 80 kg | 80 | 400 kcal |
| **Profil A** (H, 30 ans, 180 cm, 80 kg) | 74,2 | **370 kcal** (−7 %) |
| **Profil B** (F, 45 ans, 165 cm, 60 kg) | 51,9 | **260 kcal** (−13 % par rapport à son MET standard de 300) |

**Et le niveau ?** Il n'entre **pas** comme multiplicateur, et c'est voulu. Un confirmé ne dépense
pas plus *parce qu'il est* confirmé : il dépense plus parce qu'il soulève plus lourd, enchaîne plus
vite ou court plus vite. Tout cela passe déjà par les mesures (ressenti, densité, allure, dénivelé).
Un multiplicateur de niveau compterait deux fois la même chose — encore.

**Données manquantes.** Sans **poids**, aucun chiffre : il n'existe aucune valeur neutre (même règle
que MN-10), et l'écran affiche le remède (« Ajoute ton poids »). Sans âge ni taille, repli sur le MET
standard, avec une **confiance basse**.

### 4.2 Musculation

Le MET de la séance se déduit de ce que le bilan mesure déjà :

| Signal | Lecture | MET de base |
|---|---|---|
| Ressenti de séance ≤ 5 | musculation, plusieurs exercices, charges variées | **3,5** |
| Ressenti 6-7 | effort modéré à soutenu | **5,0** |
| Ressenti ≥ 8 | musculation vigoureuse | **6,0** |
| Ressenti non saisi | repli « modéré », confiance basse | 5,0 |
| **Densité** : repos moyen < 60 s | vers le circuit training | +1,5 (plafond 8,0) |
| Repos moyen 60-120 s | | +0,5 |

- **Temps actif** = durée de la séance, **plafonnée à 4 minutes par série**. Ce plafond neutralise la
  séance oubliée ouverte (clôture automatique à 3 h) sans pénaliser une vraie séance longue.
- **Séance annulée** : seules les séries validées comptent. **Échauffements** : ils coûtent de
  l'énergie, donc ils comptent dans le temps — alors que le volume les exclut, à juste titre.
- **Série à la durée sur une machine cardio** au milieu d'une séance (rameur 10 min) : son MET
  propre en horizon 2 (il faut une catégorie « cardio » sur l'exercice, absente aujourd'hui).
- **Fourchette ±30 %.** La musculation est l'activité la plus mal estimée sans fréquence cardiaque :
  il faut le dire, pas le cacher.

> ⚠️ Les MET 3,5 / 5,0 / 6,0 / 8,0 sont ceux du Compendium 2011 (codes 02054, 02052, 02050, circuit
> vigoureux) ; **à revérifier dans la table 2024 avant la spec**. Les modulations de densité et le
> plafond de 4 min par série sont des **heuristiques proposées**, pas des valeurs sourcées — à
> calibrer, et à marquer comme telles dans le code (précédent : `HIGH_VOLUME_MEDIAN_FACTOR`).

### 4.3 Course : garder RN-01, corriger trois trous

- **Dénivelé** : ajouter 1 km « effort » par tranche de 100 m de D+ (règle usuelle en trail ; la
  descente est ignorée). 10 km, D+ 120 m, profil A : 823 → **920 kcal**.
- **Sans GPS / tapis** : repli sur le MET de course selon la durée et le ressenti (≈ 8,3 MET à
  8 km/h, 9,8 à 9,7 km/h), ou mieux, **saisir la distance lue sur le tapis**. 40 min soutenues,
  profil A : **440 kcal** au lieu de 0.
- **Poids à la date** de la course (C6), pas la dernière pesée.
- **Pas de correction d'âge ni de sexe pour la course** : son coût par kilo et par kilomètre en dépend
  peu. Dire franchement « ici, ce qui compte, c'est ton poids et la distance » est plus juste que de
  faire semblant de personnaliser.
- **Fourchette ±15 %** avec GPS (distance mesurée), **±25 %** sans.

### 4.4 Activité manuelle

**MET du type × intensité déclarée × durée × métabolisme de repos personnalisé.**

- **Intensité en trois choix, par le « test de la parole »**, qu'on comprend sans montre :
  *Tranquille — tu peux chanter* · *Soutenu — tu peux parler* · *Intense — quelques mots à la fois*.
  Le choix préremplit un ressenti (3 / 5 / 8) que l'utilisateur peut corriger. **C'est lui qui
  alimente la charge sRPE.**
- **Distance facultative** pour le vélo, la natation, la marche, la randonnée et le rameur : elle
  donne une vitesse, donc une tranche de MET plus juste.
- **« Le chiffre de ma montre »** facultatif : des **calories actives**, qui remplacent l'estimation
  et sont marquées « montre ».
- **Fourchette ±25 %.**

Exemple : vélo 1 h 30, soutenu (8,0 MET). Profil A : **780 kcal** (580 à 970). Profil B :
**540 kcal** (410 à 680).

**Catalogue de départ proposé** (valeurs du Compendium 2011, tranquille / soutenu / intense — **à
revérifier dans la table 2024**, et à compléter pour le padel, absent de 2011) :

| Type | MET indicatifs | Distance utile | Health Connect |
|---|---|---|---|
| Vélo (route, vélotaf) | 4,0 / 8,0 / 10,0 | oui | type vélo |
| Vélo d'appartement | 3,5 / 6,8 / 8,8 | non | type vélo stationnaire |
| Natation | 5,3 / 5,8 / 9,8 | oui | type natation piscine |
| Marche | 3,0 / 4,3 / 5,0 | oui | type marche |
| Randonnée | 5,3 / 6,0 / 7,8 | oui | type randonnée |
| Rameur | 4,8 / 7,0 / 8,5 | oui | type aviron |
| Elliptique | 5,0 | non | type elliptique |
| Yoga · Pilates | 2,5 / 3,0 / 4,0 | non | type yoga / pilates |
| Danse | 5,0 / 7,3 | non | type danse |
| Sports collectifs (foot, basket, hand) | 6,5 / 7,0 / 10,0 | non | par sport |
| Raquettes (tennis, badminton, padel, squash) | 5,5 / 7,3 / 12,0 | non | par sport |
| Escalade | 5,8 / 7,5 | non | type escalade |
| Boxe · arts martiaux | 5,5 / 7,8 / 10,3 | non | par sport |
| HIIT · circuit | 4,3 / 8,0 | non | type HIIT |
| Ski · sports de glisse | 5,3 / 9,0 | non | par sport |
| Autre | intensité seule : 3,5 / 5,5 / 8,0 | non | autre |

**Hors catalogue, volontairement** : le ménage, le jardinage, les courses… Ces dépenses du quotidien
font partie du **socle hors sport**. Les compter en plus rouvrirait le double comptage par une autre
porte. **Course** et **musculation** redirigent vers leur pilier quand il est actif (D5).

### 4.5 La fourchette, et ce que la cible en retient

Chaque estimation rend `{ kcal, bas, haut, confiance }`, arrondis à 10 kcal.

- **On affiche** l'estimation centrale **et** la fourchette : « ≈ 370 kcal · entre 260 et 480 ».
- **La cible reçoit le bas de la fourchette** (proposition D2). Les estimations par MET surestiment
  plus souvent qu'elles ne sous-estiment, et une surestimation annule un déficit sans bruit. La règle
  s'explique en une phrase — « mieux vaut un peu moins que trop » — et **n'invente aucun
  pourcentage**.
- **La confiance** reprend le type `Confidence` d'[explain.ts](../../packages/shared/src/explain.ts) :
  *haute* = GPS + poids récent + profil complet ; *moyenne* = musculation ou activité avec ressenti ;
  *basse* = âge ou taille manquants, ressenti absent, pesée de plus de 30 jours.

**« Pourquoi ma montre dit plus ? »** Elle affiche le plus souvent des calories **totales** : repos
compris. Pour l'heure de muscu du profil A, la montre ajoute 74 kcal de repos, **déjà inclus** dans
la cible. La feuille « D'où vient ce chiffre » doit l'expliquer, sans quoi l'app passe pour fausse
dès le premier jour.

---

## 5. Dans l'assiette : où j'en suis sur la journée

### 5.1 La journée en énergie

Profil A, objectif sèche, mode « Selon ce que tu fais », hors sport « debout souvent » :

```
  Socle hors sport          2 448   (1 780 × 1,375)
  Objectif sèche             −400
  Musculation 18 h          +260    ≈ 370 estimées, bas de fourchette retenu
  ─────────────────────────────────
  Cible du jour             2 308   (au lieu de 2 048 un jour de repos)
  Mangé                     1 240
  Reste                     1 070   dont +65 g de glucides pour la séance (MN-04)
```

À titre de repère, la cible actuelle en mode Fixe « modéré » vaudrait **2 359 tous les jours** :
les **jours de séance** restent proches, les **jours de repos** baissent. C'est exactement ce que
« manger comme on s'entraîne » veut dire (APPORT-01).

- **Scène Nutrition** : la pastille « +260 kcal · jour de séance » devient « +260 kcal · muscu » ou
  « +840 · muscu, vélo », et ouvre le détail ci-dessus.
- **Fin de séance** : une carte « Ta journée » dit en une ligne ce que la séance a changé — **si le
  pilier Nutrition est actif** (décision H). Sinon, la dépense seule.
- **Prévu → réel** : une séance **planifiée** aujourd'hui peut déjà relever la cible du matin, marquée
  « prévu », puis remplacée par le réel à la fin (la règle « le passé n'est jamais anticipé » de 4.7b
  s'applique telle quelle). Une activité manuelle, elle, ne compte qu'une fois saisie.

### 5.2 « Un peu plus, un peu moins » selon le régime de guidage (GUID-01)

| Régime | Après la séance |
|---|---|
| **Autonome** | La dépense dans le bilan, la cible ajustée. Rien d'autre ne s'affiche de lui-même. |
| **Accompagné** | + « Il te reste 1 070 kcal, dont 65 g de glucides » et deux idées tirées de **ses** aliments fréquents. |
| **Guidé** | + une proposition précise : « Skyr + banane ce soir ? » — ajoutée au plan de repas d'un geste. |

### 5.3 Garde-fous

- **Le sport n'est jamais un paiement.** Aucun « tu as gagné ton dessert », aucun « = une part de
  pizza » : ces équivalences apprennent à compenser et à culpabiliser. La variante C de la toile est
  **écartée** pour cette raison.
- **Masquer les chiffres de dépense** en un réglage : la cible s'ajuste quand même. Sujet sensible
  pour les personnes qui ont un rapport compliqué à la nourriture.
- **Le déficit sévère prolongé** reste l'une des trois alertes qui passent toujours (GUID-01).

---

## 6. L'activité manuelle, en pratique

### 6.1 Où on l'ajoute

**Pas dans un pilier** : quelqu'un qui n'a activé **que la Nutrition** doit pouvoir noter son vélo pour
ajuster sa cible. Trois portes (D9) : **l'accueil**, la **scène Nutrition** (« + activité » près de la
cible) et **l'historique**.

### 6.2 La saisie (un seul écran)

**Tes habituelles** (« Vélotaf · 25 min » en un geste) → **type** → **durée** (préréglages 30 / 45 /
1 h / 1 h 30) → **intensité** (test de la parole) → *distance* et *chiffre de montre* facultatifs →
estimation en direct → **Enregistrer**. Heure de fin = maintenant, modifiable ; saisie rétroactive
possible.

### 6.3 Ce que ça change, et c'est tout l'intérêt

| Effet | Aujourd'hui | Avec une activité |
|---|---|---|
| Cible du jour | inchangée | + bas de fourchette (phase B) |
| Série | cassée | jour actif |
| Charge 7 j / 28 j (GARDE-01, ACWR, readiness) | nulle | + ressenti × minutes |
| Jour d'entraînement (MN-01, MN-04 glucides) | repos | entraînement |
| Temps d'entraînement (MR-06) | absent | nouvelle ventilation « autres » |
| Health Connect | rien | séance du bon type — **sans nouvelle permission** (`WRITE_EXERCISE` déjà demandée) |
| Collisions (COLLIS-01) | — | horizon 2 : sollicitation « jambes / haut / global » par type |

### 6.4 Modèle de données (esquisse)

Table **`activities`** : `id` UUID client · `user_id` · `activity_type` (texte validé par Zod, pour
faire grandir le catalogue sans migration) · `started_at` UTC · `duration_seconds` · `intensity`
(`light` | `moderate` | `vigorous`) · `rpe` · `distance_m` · `device_kcal` · `notes` · horodatages et
suppression douce. Publication PowerSync + **sync rules à coller à la main** dans le dashboard (étape
déjà oubliée une fois, cf. CLAUDE.md).

**La dépense n'est pas stockée** (proposition D3) : calculée à la lecture, **avec le poids à la date**.
Une formule pure, versionnée et testée, corrige C6 d'un coup. On stockerait une valeur le jour où on
écrirait des calories dans Health Connect.

---

## 7. Le plan

Chaque lot suit le workflow (spec → plan → maquette → validation) et reste une US bornée. Les
identifiants sont provisoires (`ACTIV-01` est déjà pris par le parcours 7 jours).

### Phase A — Montrer (la cible ne bouge pas)

| Lot | Contenu | Fichiers principaux | Tests | Taille |
|---|---|---|---|---|
| **DEPENSE-01 · Le moteur** | `restingKcalPerHour`, `estimateMetEnergy` → `{kcal, bas, haut, confiance}`, `estimateStrengthEnergy` (depuis `SessionTotals`), `estimateRunEnergy` v2 (dénivelé, sans GPS), `weightAtDate`, catalogue `ACTIVITY_TYPES` (MET, correspondance Health Connect, clés i18n) | `packages/shared/src/energy.ts` (nouveau), `running.ts` | Vitest 100 % ; valeurs dorées des profils A et B ; **non-régression RN-01** (même chiffre sans dénivelé) | M |
| **DEPENSE-02 · La dépense en fin de séance** | carte « Dépense estimée » dans le bilan muscu, le résumé de course et l'historique ; feuille « D'où vient ce chiffre » ; réglage « masquer » | `WorkoutReport`, `run/summary.tsx`, `explain.ts`, i18n FR/EN | Jest écrans ; poids manquant → remède ; pilier nutrition inactif → pas de ligne cible | M |
| **AUTRE-01 · Les autres activités** | migration `activities` + publication + sync rules ; repository ; écran de saisie ; historique ; modifier / supprimer ; branchement série, jour d'entraînement, charge sRPE, temps d'entraînement, Health Connect | `supabase/migrations`, `activity-repository.ts`, `app/activity/`, `streak.ts`, `training-day.ts`, `training-time.ts`, `health-connect.ts` | Vitest intégrations ; Jest saisie ; **recette** : hors ligne, 2ᵉ appareil, suppression | L |

La phase A est **sans risque produit** : elle ajoute de l'information sans modifier une seule cible.
Elle se livre et se recette seule.

### Phase B — Piloter la cible

| Lot | Contenu | Point dur | Taille |
|---|---|---|---|
| **DEPENSE-00 · Le socle sans double comptage** | mode « Selon ce que tu fais » ; question « hors sport, tu es plutôt… » ; aperçu avant / après ; avertissement aux utilisateurs Auto ; `dayCalorieBonus` somme **toutes** les dépenses (corrige C7) | **Migration douce** : ne jamais changer une cible en silence ; décider du sort du mode Auto (D1) | M |
| **DEPENSE-03 · La journée en énergie** | pastille détaillée de la scène Nutrition, détail de la journée, prévu → réel, suggestions selon le régime de guidage | Cohérence avec NUTR-10/18 (adhérence et bilan rétroactifs), MN-04, VIE-01 | M |

Ordre recommandé : **01 → 02 → AUTRE-01 → 00 → 03**. Le moteur d'abord (pur, testé) ; les deux lots
visibles ensuite ; la cible en dernier, quand le chiffre a déjà été vu et critiqué en recette.

**Couverture du catalogue d'analyses** : RN-04 (calories nettes restantes après course), TRI-06
(balance estimée, volet jour), NUTR-23 (cyclage vécu), et une base pour RN-18 et TRI-05.

### Horizon 2 — ce qui rend le système juste, pas seulement plausible

- **Calibrer le socle sur le poids** : sur 3-4 semaines, apports − (socle + activités) donne une
  variation de poids attendue (~7 700 kcal/kg, NUTR-19) ; si la balance ne suit pas, l'app propose
  un autre palier. L'app **apprend le vrai socle** de chacun : c'est la seule réponse sérieuse à
  l'incertitude du §3, et un candidat « plus » (décision D).
- **Importer les activités d'une montre** via Health Connect, avec dédoublonnage par chevauchement
  horaire et type (CONF-06 l'avait écarté pour cette raison).
- **Fréquence cardiaque** : estimation par la FC quand elle existe, beaucoup plus juste en
  musculation.
- **Planifier une activité autre** dans le calendrier ; **activités récurrentes** (vélotaf).
- **Collisions** : une sortie vélo de 3 h la veille d'une séance jambes.

---

## 8. Décisions à trancher

| # | Question | Recommandation | Pourquoi |
|---|---|---|---|
| **D1** | Garder « facteur tout compris + bonus », ou passer au « socle hors sport + dépense réelle » ? Et que deviennent les utilisateurs Auto ? | **Socle hors sport**, en **nouveau mode opt-in**. Fixe et Forfait inchangés. Auto migre vers le nouveau mode **avec aperçu et confirmation**, sinon repasse en Forfait. | Seul modèle qui ne double pas ; le changement de cible doit se voir et s'accepter. |
| **D2** | Combien de la dépense la cible retient-elle ? | **Le bas de la fourchette.** | Prudent, explicable en une phrase, aucun pourcentage inventé. |
| **D3** | Stocker la dépense ou la calculer à la lecture ? | **La calculer, avec le poids à la date.** | Corrige C6 ; la formule reste versionnée et testée. |
| **D4** | Montrer la dépense quand la Nutrition est inactive ? | **Oui, sans ligne cible**, et un réglage pour masquer les chiffres. | Utile seul (décision H) ; sujet sensible (TCA). |
| **D5** | Course et musculation dans le catalogue manuel ? | **Rediriger vers le pilier s'il est actif, noter comme activité sinon.** | Évite les doublons sans bloquer qui n'a pas le pilier. |
| **D6** | Accepter le chiffre d'une montre ? | **Oui, en calories actives**, marqué « montre ». | Les gens en ont un ; l'ignorer fait passer l'app pour fausse. |
| **D7** ⏰ | Health Connect : **calories** (écriture) et **séances tierces** (lecture) ? | **Trancher avant le dépôt de la déclaration santé (LANCE-00).** Recommandation : écrire la séance du bon type en V1, **sans calories** ; ajouter `READ_EXERCISE` à la déclaration **seulement** si l'import montre est voulu dans l'année. | La déclaration se dépose une fois ; l'enrichir ensuite coûte une re-déclaration et ~2 semaines. |
| **D8** | Qu'est-ce qui est payant ? | **Estimation et saisie gratuites** ; calibration du socle = candidat « plus ». | La dépense est un standard du marché ; la calibration est rare. Rouvre **D (monétisation)** sans la trancher. |
| **D9** | Où vit « Ajouter une activité » ? | **Accueil + scène Nutrition + historique**, dans aucun pilier. | Utile même avec la seule Nutrition activée. |

---

## 9. Risques

1. **La fausse précision.** Un « 372 kcal » ment. → arrondi à 10, fourchette, confiance, « D'où vient
   ce chiffre ».
2. **La surestimation qui efface un déficit.** → socle hors sport, bas de fourchette, calibration par
   le poids en horizon 2.
3. **La compensation.** « Je cours pour avoir le droit de manger. » → aucune équivalence alimentaire,
   aucun ton de récompense, chiffres masquables.
4. **La confiance détruite par la montre.** → expliquer net contre total dès la première séance ;
   accepter le chiffre de la montre.
5. **Les doublons.** Course GPS + course manuelle ; plus tard import montre + saisie. → redirection
   vers le pilier (D5) ; dédoublonnage par chevauchement horaire le jour de l'import.
6. **Les valeurs non sourcées.** Densité, plafond par série, paliers hors sport : ce sont des
   heuristiques. → les nommer comme telles dans le code et la spec, et les calibrer en recette sur de
   vraies séances comparées à une montre cardio.
7. **La synchro.** Nouvelle table = sync rules PowerSync à coller à la main.

---

## 10. Ce qui n'a pas été fait

- **Aucune spec, aucun plan, aucun code.** Ce document prépare les `/us` ; il ne les remplace pas.
- **Les MET n'ont pas été vérifiés dans la table 2024** du Compendium : les valeurs viennent de
  l'édition 2011 et doivent être relues ligne à ligne avant la spec DEPENSE-01. Le padel n'y figure
  pas.
- **Aucune calibration** contre une mesure réelle (montre cardio, calorimétrie) : les fourchettes
  ±15 / ±25 / ±30 % sont des ordres de grandeur tirés de la littérature, à confirmer.
- **Les paliers « hors sport »** reprennent provisoirement les multiplicateurs existants (1,2 / 1,375
  / 1,55) ; ils demandent une source propre (niveaux d'activité physique hors exercice).
- **Maquettes** : thème clair seulement, français seulement, données fictives, pas de passe
  d'accessibilité (TalkBack, grandes polices). Le prototype applique les formules de ce document,
  **pas** le code de l'app.
- **Non vérifié** : le rendu exact du bilan de séance (`WorkoutReport`) a été résumé dans les
  maquettes, pas reproduit bloc par bloc.
