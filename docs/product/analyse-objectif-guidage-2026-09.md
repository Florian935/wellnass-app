# L'objectif et le niveau de guidage — analyse et proposition

Date : 12/09/2026. Statut : **proposition de cadrage**, à discuter. Ce document n'est ni une
spécification validée ni une fonctionnalité livrée. Aucune ligne de code applicatif n'a été écrite.

Demande (Florian, 12/09/2026) : vérifier si la notion d'objectif existe à l'onboarding et si elle
reste modifiable ensuite ; puis instruire l'idée d'un **guidage modulable par objectif et par
pilier** — « je veux prendre de la masse, je veux être guidé de façon soutenue / intermédiaire /
pas du tout ».

**Maquettes** : six écrans réunis en trois planches —
[le parcours](../../design/objectif-guidage-2026-09/01-planche.png),
[une décision vue dans les trois régimes](../../design/objectif-guidage-2026-09/02-planche.png)
et [réglage et intégration](../../design/objectif-guidage-2026-09/03-planche.png).
Images de conception, non validées : le
[README du dossier](../../design/objectif-guidage-2026-09/README.md) dit ce qu'elles supposent
d'acquis et ce qui reste à maquetter (thème sombre, accessibilité, anglais).

---

## 1. Les deux réponses, tout de suite

**Oui, l'objectif est demandé à l'installation.** Étape 3 du parcours d'onboarding
([goal.tsx](../../apps/mobile/src/app/(onboarding)/goal.tsx)), stocké dans `profiles.main_goal`,
quatre valeurs : *Prise de masse · Perte de poids · Performance · Santé générale*
([profile.ts:11](../../packages/shared/src/profile.ts#L11)). L'écran est **skippable**, comme tous
les autres — c'est la décision de cadrage F.

**Oui, il reste modifiable.** Réglages → Profil → Objectif
([profile.tsx:46](../../apps/mobile/src/app/profile.tsx#L46)), et l'onboarding complet peut même
être rejoué depuis les réglages
([settings.tsx:326](../../apps/mobile/src/app/settings.tsx#L326)).

**Mais.** Le sous-titre de l'écran dit : *« Oriente les recommandations. Tu peux le changer quand tu
veux. »* La seconde phrase est vraie. **La première ne l'est pas.** C'est le vrai sujet de ce
document, et il précède ta question sur le guidage : il ne sert à rien de graduer un guidage piloté
par un objectif que l'app n'écoute pas.

---

## 2. Cinq constats vérifiés dans le code

### Constat 1 — `main_goal` est lu à huit endroits, et les huit appellent la même fonction

Recherche exhaustive sur `mainGoal` / `main_goal` dans `apps/mobile`, `apps/admin` et
`packages/shared` (hors tests et types générés). Les huit lectures fonctionnelles sont **le même
appel** :

```
nutritionProfile?.objective ?? objectiveFromGoal(profile?.mainGoal ?? null)
```

— dans [nutrition.tsx:122](../../apps/mobile/src/app/(tabs)/nutrition.tsx#L122),
[meal-plan/index.tsx:118](../../apps/mobile/src/app/meal-plan/index.tsx#L118),
[nutrition-profile.tsx:84](../../apps/mobile/src/app/nutrition-profile.tsx#L84),
[NutritionSummaryCard.tsx:127](../../apps/mobile/src/components/dashboard/NutritionSummaryCard.tsx#L127),
[dashboard-repository.ts:423 et 1476](../../apps/mobile/src/data/repositories/dashboard-repository.ts#L423),
[nutrition-repository.ts:245](../../apps/mobile/src/data/repositories/nutrition-repository.ts#L245)
et [home-widget-data.ts:257](../../apps/mobile/src/widgets/home-widget-data.ts#L257).

Les deux dernières occurrences sont de l'affichage : le récapitulatif d'onboarding et le formulaire
de profil, qui le montrent et le réécrivent.

**Conséquence** : l'objectif principal ne pilote **qu'une seule chose** dans toute l'application —
la valeur de repli de l'objectif nutritionnel, et **uniquement tant que l'utilisateur n'a pas ouvert
son profil nutritionnel**. Dès qu'il y touche, `nutrition_profiles.objective` prend la main et
`main_goal` cesse totalement d'exister.

Côté **Musculation** : zéro lecture. Côté **Course** : zéro lecture.

### Constat 2 — Deux objectifs sur quatre ne changent strictement rien

[nutrition.ts:20](../../packages/shared/src/nutrition.ts#L20) :

```ts
export function objectiveFromGoal(goal: Goal | null): NutritionObjective {
  switch (goal) {
    case 'muscle':      return 'bulk';
    case 'weightloss':  return 'weightloss';
    default:            return 'maintain';
  }
}
```

`performance` et `health` tombent tous les deux dans le `default`. Comme par ailleurs aucun autre
site de code ne lit le champ, **un utilisateur qui choisit « Performance » et un utilisateur qui
choisit « Santé générale » obtiennent exactement la même application, à l'octet près** — et la même
que celui qui a appuyé sur « Passer ».

Deux options sur quatre sont décoratives. C'est la moitié de l'écran.

### Constat 3 — Il y a quatre notions d'objectif dans la base, et aucune ne parle aux autres

| Notion | Où c'est stocké | Valeurs | Où ça se règle | Ce que ça pilote réellement |
|---|---|---|---|---|
| **Objectif principal** | `profiles.main_goal` | masse · perte de poids · performance · santé | Onboarding ét. 3, Profil | Le repli de l'objectif nutritionnel. Rien d'autre. |
| **Objectif nutritionnel** | `nutrition_profiles.objective` | bulk · cut · maintain · weightloss | Profil nutritionnel | Calories cibles, ratios de macros, et tout le pilier |
| **Profil coureur** | `runner_profiles.objective` + `.level` | 5k · 10k · semi · marathon · perte de poids · endurance ; débutant · régulier · confirmé | Profil coureur | **Rien.** Voir constat 4. |
| **Objectifs personnels** | table `goals` (OBJ-01) | distance de course · 1RM d'un exercice, max 3 actifs | Réglages → Suivi → Objectifs | Un anneau de progression, isolé |

Quatre vocabulaires, quatre écrans, aucun pont. Conséquences observables :

- On peut déclarer **« Prise de masse »** au global, **« Sèche »** en nutrition et **« Perte de
  poids »** en course. Les trois écrans l'acceptent sans un mot.
- L'objectif nutritionnel a une valeur, `cut`, qui n'est **atteignable par aucun objectif global** —
  `objectiveFromGoal` ne la produit jamais. Il faut aller la chercher à la main.
- Choisir « Performance » au global ne propose **jamais** de se fixer un objectif coureur, alors que
  c'est exactement la même intention exprimée deux écrans plus loin.

### Constat 4 — L'objectif et le niveau du coureur sont collectés et jamais utilisés

Vérification de tous les usages de `runnerProfile` hors de son propre écran d'édition :

| Champ | Lectures fonctionnelles |
|---|---|
| `ref5kPaceSPerKm` | 8 sites — zones d'allure, guidage vocal, prédiction, éditeur de séance |
| `weeklyFrequency` | 1 site — la bande de semaine du hub Course ([running.tsx:112](../../apps/mobile/src/app/(tabs)/running.tsx#L112)) |
| `voiceAnnouncements*`, `intervalGuidance*` | le tracker GPS |
| **`objective`** | **aucune** — écrit, affiché dans son propre formulaire, jamais relu |
| **`level`** | **aucune** — idem |

La bibliothèque de programmes de course possède bien un filtre par objectif
([running-programs/index.tsx:244](../../apps/mobile/src/app/running-programs/index.tsx#L244)), mais
c'est **l'utilisateur qui le pose à la main** : le profil ne le pré-remplit pas.

C'est la même maladie que le constat 1, en plus avancé : on demande, on stocke, on n'utilise pas.

### Constat 5 — Le pilier Musculation ne connaît ni ton niveau ni ta disponibilité

Et il le sait. L'en-tête de
[SuggestedPrograms.tsx:11](../../apps/mobile/src/components/strength/SuggestedPrograms.tsx#L11),
écrit pendant MUSCU-UX01, est explicite :

> ⚠️ La spec annonçait d'abord un tri « sur le niveau et la fréquence déclarés à l'onboarding ».
> Vérification faite, **le profil ne stocke ni l'un ni l'autre** [...] On utilise donc
> `workoutDisplayLevel` comme **proxy assumé** de l'expérience.

Traduction : les trois programmes proposés à un compte neuf sont triés sur **une préférence
d'affichage**. « Je veux voir peu d'informations pendant ma séance » est interprété comme « je suis
débutant ». C'est un détournement honnête et documenté, mais c'est un détournement — et il produit
des contresens évidents (un powerlifter confirmé qui veut un écran épuré se voit proposer des
programmes débutants).

**Et c'est le constat le plus important de la liste.** Ta question portait sur le *degré* de
guidage ; le code dit que le problème est en amont : **l'app n'a pas la matière pour guider**, quel
que soit le degré.

---

## 3. Ce que ta proposition vise juste — et trois endroits où je te challenge

Le diagnostic sous-jacent est exact : *l'app collecte une intention et ne s'en sert pas, et elle
traite tout le monde pareil.* Ma proposition part de là. Mais je conteste trois points de la forme
que tu as esquissée.

### Challenge 1 — Un niveau de guidage **par objectif** multiplie sans rien résoudre

« Des notions par objectif de à quel point on veut être guidé » donne 4 objectifs × 3 piliers × 3
niveaux = 36 combinaisons à définir, à traduire en FR + EN, à tester. Or **un utilisateur n'a qu'un
objectif principal à la fois**. Les 27 autres colonnes du tableau ne seront jamais vues.

Le bon axe n'est pas *objectif × guidage*, c'est :

- **un objectif** (global, qui fixe les *défauts* des trois piliers) ;
- **un curseur de guidage par pilier actif** (3 au maximum, souvent 1 ou 2) ;
- **et surtout un défaut déduit de l'objectif**, pour que l'immense majorité des gens ne touche
  jamais le curseur.

L'objectif ne *contient* pas le guidage. Il le *pré-règle*.

### Challenge 2 — « Guidage soutenu » ne doit pas vouloir dire « plus de messages »

C'est le piège classique, et il est mortel pour la rétention : le mode « soutenu » devient le mode
« l'app me harcèle », il est coupé au bout de dix jours, et on a construit un réglage dont la seule
utilisation est de revenir en arrière.

Ce qui doit varier n'est pas le **volume** d'interventions, c'est **qui décide**. Trois régimes
d'autorité :

| Régime | Qui décide | Ce que l'utilisateur fait |
|---|---|---|
| **Guidé** | L'app décide et **annonce** | Il suit. « J'ai déplacé ta séance jambes à jeudi. » |
| **Accompagné** *(défaut)* | L'app propose, l'utilisateur tranche | Il valide ou refuse. « Ta séance jambes tombe la veille du fractionné — la déplacer à jeudi ? » |
| **Autonome** | L'utilisateur décide, l'app se tait | Il va chercher l'information quand il la veut. Rien ne s'affiche spontanément. |

À volume de notifications **identique**. Le mode Guidé n'envoie pas plus de messages : il en envoie
des **différents** — des annonces de décisions prises, au lieu de questions. Le mode Autonome n'en
envoie presque aucun, non parce qu'on l'a rendu silencieux, mais parce qu'il n'a plus de question à
poser.

C'est un axe défendable, explicable en une phrase à l'utilisateur, et testable en recette.

### Challenge 3 — La question la plus rentable n'est pas l'objectif, c'est le **niveau** et la **disponibilité**

Le constat 5 le dit : la muscu ne sait ni ton expérience ni combien de jours tu peux t'entraîner.
Deux personnes avec le même objectif « Prise de masse » — un débutant qui a 2 créneaux et un
confirmé qui en a 5 — doivent recevoir des propositions **sans aucun rapport**. Aujourd'hui elles
reçoivent la même.

**Deux champs à deux valeurs près valent plus, en pertinence perçue, que tout le reste de ce
document.** Je les mets en lot prioritaire, avant le curseur de guidage.

---

## 4. Le modèle proposé

### 4.1 Trois objets, pas un

```
INTENTION              ce que je veux             → objectif principal (+ échéance optionnelle)
CONTEXTE               ce que je peux             → niveau, disponibilité hebdo, matériel
RÉGIME DE GUIDAGE      combien je délègue         → guidé / accompagné / autonome, par pilier
```

Les trois sont aujourd'hui soit absents, soit présents mais inertes. Les séparer permet de les
livrer indépendamment, et évite le piège de l'objectif fourre-tout.

### 4.2 Chaque valeur a deux états : **choisie** ou **déduite**

C'est un motif que le projet a déjà inventé, un jour de recette, et qu'il faut généraliser. Extrait
de [nutrition-profile.tsx:86](../../apps/mobile/src/app/nutrition-profile.tsx#L86), écrit pendant
NUTRI-UX01 :

> 🔴 Deux notions distinctes [...] : ce qui est **APPLIQUÉ** aux calculs (repli historique inclus)
> et ce qui a été **CHOISI**. Confondre les deux revenait à afficher « Modérément actif » comme une
> sélection de l'utilisateur alors que personne n'avait posé la question — pour un sédentaire,
> ~614 kcal/jour d'objectif en trop, en silence.

La même règle doit valoir pour tout ce qui suit. Un régime de guidage déduit d'un objectif s'affiche
**comme déduit** (« Accompagné — déduit de ton objectif ») et non comme un choix. Sinon on
reconstruit exactement le bug des 614 kcal, un cran plus haut.

### 4.3 La matrice des défauts — objectif × pilier

C'est le cœur du livrable : ce que l'objectif **devrait** décider, pilier par pilier. La colonne de
droite indique ce que l'app fait **aujourd'hui**.

#### Prise de masse

| Pilier | Défaut proposé | Aujourd'hui |
|---|---|---|
| Musculation | Programmes hypertrophie en tête ; progression en charge (MUSC-F15) ; deload proposé après 3 stagnations (MUSC-F7) | Tri sur le niveau d'affichage |
| Course | Volume **plafonné** et endurance uniquement — c'est l'interférence documentée par MR-08 | Aucun lien |
| Nutrition | `bulk`, +300 kcal, protéines ≥ 1,8 g/kg (MN-06), glucides péri-séance actifs (MN-04) | ✅ correct (le seul cas qui marche) |

#### Perte de poids

| Pilier | Défaut proposé | Aujourd'hui |
|---|---|---|
| Musculation | Full-body ou haut/bas, 3 séances ; objectif de **maintien** de charge, pas de progression forcée — le deload ne se déclenche pas sur une stagnation attendue | Tri sur le niveau d'affichage |
| Course | Fréquence > intensité ; endurance fondamentale ; alerte sur le cumul déficit + volume (RN-17, repéré au catalogue, non construit) | Aucun lien |
| Nutrition | `weightloss`, −250 kcal, protéines ≥ 2,0 g/kg | ✅ correct |

#### Performance

| Pilier | Défaut proposé | Aujourd'hui |
|---|---|---|
| Musculation | Dépend de la discipline — **voir la décision D2 ci-dessous** | Rien |
| Course | Pré-remplir l'objectif coureur ; proposer une échéance (date de course) ; séances structurées (RUN-F4) | Rien |
| Nutrition | `maintain`, socle glucidique périodisé selon la charge (FUEL-01), TDEE ajusté au volume de course (RN-03) | `maintain` sec |

#### Santé générale

| Pilier | Défaut proposé | Aujourd'hui |
|---|---|---|
| Musculation | Volume modéré, régularité avant charge ; le garde-fou (GARDE-01) devient plus conservateur | Rien |
| Course | Endurance, zéro fractionné par défaut | Rien |
| Nutrition | `maintain`, accent sur les **micronutriments** (le différenciateur ouvert par NUTRI-UX01) plutôt que sur les macros | `maintain` sec — identique à « Performance » |

**Ce tableau est la spécification manquante.** Il ne demande aucun moteur nouveau : chaque cellule
pointe une fonctionnalité **déjà livrée ou déjà cadrée**. Ce qui manque, c'est le fil qui relie
l'objectif à ces fonctionnalités.

### 4.4 Les trois régimes, traduits en comportements concrets

Le régime ne crée rien : il **arbitre** ce que les ~20 producteurs de recommandation déjà livrés ont
le droit de faire. Exemples, pilier par pilier :

| Situation (fonctionnalité existante) | Guidé | Accompagné *(défaut)* | Autonome |
|---|---|---|---|
| Stagnation détectée 3 séances (MUSC-F7) | Deload **appliqué**, annoncé au bilan | Carte « Proposer un deload ? » | Visible dans Insights si on va voir |
| Douleur déclarée sur une zone (DOUL-01) | Exercice **substitué** d'office (MUSC-F14) | Substitution proposée à l'ouverture de la séance | Rien |
| Séance muscu la veille d'un fractionné (COLLIS-01) | Séance **déplacée**, notification d'annonce | Carte « Déplacer à jeudi ? » | Rien |
| Compte neuf, pilier muscu actif | Un programme **posé** au calendrier | 3 propositions à choisir | La bibliothèque, sans tri |
| Macro incomplète en fin de journée (NUTR-F2) | 3 aliments proposés à 20 h | Suggestion accessible depuis le budget | Rien |
| Jour de séance, glucides (MN-04) | Cible **ajustée** automatiquement | Ajustement proposé | Cible fixe |
| Semaine dégradée déclarée (VIE-01) | L'app **reconstruit** la semaine minimale | Elle propose le minimum viable | Elle note et se tait |
| Niveau d'affichage de séance | `simplified` par défaut | `normal` | `detailed` |

**La clause qui ne se coupe jamais.** Trois signaux passent **quel que soit le régime**, y compris
en Autonome :

1. ACWR en zone critique — risque de blessure (META-19 / GARDE-01) ;
2. même zone douloureuse déclarée 3 fois en 14 jours (DOUL-01) ;
3. déficit calorique sévère prolongé (alerte 4.32).

C'est une position produit à assumer : on ne laisse pas quelqu'un se blesser parce qu'il a coché
« je me débrouille ». Ces trois-là s'affichent **une fois**, sobrement, sans répétition. C'est la
décision D5.

---

## 5. Où ça se règle — et pourquoi je n'ajoute aucun écran à l'onboarding

La décision de cadrage **F** dit : onboarding **minimal**, chaque étape skippable. Trois questions
de plus la violeraient. Proposition à **nombre d'écrans constant** :

| # | Aujourd'hui | Proposé |
|---|---|---|
| 1 | Infos de base | inchangé |
| 2 | Piliers actifs | inchangé |
| 3 | Objectif principal | **Objectif + échéance optionnelle** (« as-tu une date en tête ? ») |
| 4 | **Niveau d'affichage** | **« À quel point veux-tu que l'app décide pour toi ? »** — les 3 régimes. Le niveau d'affichage en est **déduit** et reste réglable ensuite. |
| 5 | Niveau d'activité *(si nutrition)* | inchangé |
| — | Récapitulatif statique | Récapitulatif **+ première action posée** |

Trois bénéfices, pour zéro écran supplémentaire :

- **L'étape 4 change de sens sans changer de place.** « Niveau d'affichage » est un réglage
  d'interface déguisé en question de profil — c'est précisément ce qui a forcé le détournement du
  constat 5. Remplacer la question par le régime de guidage donne un **vrai** signal, et le niveau
  d'affichage s'en déduit proprement (`guidé → simplifié`, `accompagné → normal`,
  `autonome → détaillé`).
- **Le récapitulatif comble un trou connu.** La roadmap 1.11 promet une « suggestion d'une première
  action » ; la cartographie d'ACTIV-01 a constaté le 03/08/2026 qu'elle n'existe pas. Avec
  l'objectif + le régime, on sait quoi proposer.
- **Le niveau et la disponibilité ne sont pas demandés à l'onboarding** — ils sont demandés **au
  moment de choisir un programme**, là où la question a un objet visible (« pour te proposer le bon
  programme : tu t'entraînes depuis combien de temps, et combien de jours par semaine ? »). Un
  formulaire de plus au premier lancement est du coût ; la même question posée devant la
  bibliothèque est du service.

Ensuite, tout reste modifiable : Réglages → Profil pour l'intention, et **un curseur par pilier**
dans chaque écran de profil de pilier (là où vivent déjà `nutrition_profiles` et `runner_profiles`).
Réglages compte déjà 11 interrupteurs et 18 sections — **le curseur de guidage ne doit pas y être
ajouté comme une 19ᵉ ligne**, sinon il disparaît. Il vit dans le pilier qu'il gouverne.

---

## 6. Les contradictions — ce que l'intégration devrait détecter

C'est le différenciateur produit (décision H : « les piliers se parlent »), et c'est aujourd'hui le
point aveugle : les quatre objectifs du constat 3 peuvent se contredire en silence. Trois règles
suffisent pour commencer, toutes appuyées sur des briques existantes :

| Conflit | Détection | Message |
|---|---|---|
| Objectif global « Prise de masse » + objectif nutrition « Sèche » | comparaison directe des deux champs | « Ton objectif dit prise de masse, ta nutrition dit sèche. Lequel garde la main ? » |
| « Perte de poids » + volume de course élevé + déficit | RN-17 (catalogue, non construit) + RN-03 (livré) | « À ce volume de course, ce déficit t'expose à perdre de la force. Réduire le déficit ou le volume ? » |
| Objectif coureur « Marathon » + objectif global « Prise de masse » | MR-08 (livré) | « Ces deux objectifs s'annulent sur 12 semaines. Lequel recule ? » |

Chaque carte suit le principe déjà noté dans [IDEAS.md](../../IDEAS.md) le 25/07/2026 —
**explicable et contestable** : elle affiche ses raisons, et « cette règle ne me correspond pas »
doit être une réponse acceptée.

> ⚠️ C'est une **version minuscule** de l'idée « objectif hybride unifié » (IDEAS, 25/07/2026).
> Je ne propose **pas** de la cadrer ici : l'objectif composite avec arbitrage de priorités est une
> brique de positionnement, pas une US. Ce que je propose, c'est de **détecter la contradiction**,
> pas de la résoudre automatiquement.

---

## 7. Découpage proposé — cinq lots, du gratuit au structurant

| Lot | Contenu | Migration | Dépendances | Taille |
|---|---|---|---|---|
| **A — L'objectif tient sa promesse** | Une fonction unique `pillarDefaults(goal)` dans `packages/shared` ; `performance` et `health` cessent d'être synonymes ; les 3 piliers la lisent ; le récap d'onboarding pose une première action | **aucune** | aucune | S |
| **B — Les deux questions manquantes** | `training_level` et `weekly_availability` sur `profiles` ; demandés devant la bibliothèque, pas à l'onboarding ; `SuggestedPrograms` cesse d'utiliser le niveau d'affichage comme proxy | 2 colonnes additives nullable sur une table déjà synchronisée | A | S |
| **C — Le régime de guidage** | 3 colonnes de régime par pilier ; une couche de politique unique dans `packages/shared` ; branchement un par un sur les producteurs existants ; clause de sécurité non désactivable ; l'étape 4 de l'onboarding change de question | 3 colonnes additives nullable | A, B | M |
| **D — Le plan guidé** | Le régime « Guidé » construit réellement la semaine (programme posé, séances datées, ajustements appliqués) | — | C **et CONTENU-01** | L |
| **E — Les contradictions** | Les 3 règles du §6, carte explicable et contestable | — | A | M |

**Ordre recommandé : A, B, E, C, D.** Le lot E passe avant C parce qu'il produit de la valeur
visible sans introduire de nouveau réglage — et parce qu'il est le seul à *démontrer* le
différenciateur produit.

**Rien de tout cela n'est P0.** Les deux seuls P0 restants sont LANCE-00 et LANCE-01 (compte
développeur et publication Play Store). Le lot A est la seule exception défendable avant le
lancement : il ne coûte presque rien et **il corrige un mensonge d'interface** — un écran qui dit
« oriente les recommandations » alors qu'il n'oriente rien.

---

## 8. Les points durs

1. **La sur-promesse.** Le régime « Guidé » promet un coach. Si la bibliothèque de programmes est
   vide, il ment plus fort que l'écran actuel. CONTENU-01 est en recette mais son contenu reste
   « du travail de coach » — c'est écrit dans [BACKLOG.md](../../BACKLOG.md). **Le lot D ne doit pas
   partir avant que le contenu existe.** Le lot C, lui, ne promet rien qu'il ne puisse tenir : il
   arbitre des fonctionnalités déjà livrées.

2. **Le risque d'ajouter une cinquième notion au bazar.** Si le curseur de guidage vient s'empiler
   à côté de `workoutDisplayLevel`, `summaryDisplayLevel`, `main_goal`, l'objectif nutrition et
   l'objectif coureur, on aggrave le constat 3. C'est pour ça que le lot C **remplace** la question
   d'affichage à l'onboarding au lieu de s'y ajouter, et que le curseur vit dans le pilier.

3. **Le ton.** Le mode Guidé annonce des décisions (« j'ai déplacé ta séance »). Mal écrit, c'est
   infantilisant ; bien écrit, c'est le produit. Wording FR **et** EN à travailler sérieusement —
   c'est déjà le point dur n°1 relevé pour VIE-01 dans IDEAS.

4. **Offline et synchro.** Aucun obstacle : tout est calculé localement à partir de colonnes du
   profil, déjà synchronisées. Les migrations des lots B et C sont **additives et nullable** — donc
   aucun rejeu, aucune donnée existante touchée, et `profiles` figure déjà dans les sync rules
   (pas de publication manuelle à ne pas oublier, contrairement à `water_entries`).

5. **La recette.** 58 US attendent déjà une recette humaine sur device. Ces lots en ajouteraient.
   À ouvrir **après** la publication, sauf le lot A.

---

## 9. Décisions demandées

| # | Question | Ma recommandation |
|---|---|---|
| **D1** | L'axe de guidage est-il bien **« qui décide »** et non « combien de messages » ? | Oui — c'est le seul axe qui ne se transforme pas en réglage anti-harcèlement |
| **D2** | « Performance » sans discipline est inutilisable avec 3 piliers. On garde 4 objectifs et on ajoute une question conditionnelle *(force ou course ?)*, ou on passe à 5 objectifs ? | **Question conditionnelle**, posée seulement si 2 piliers d'entraînement sont actifs. On ne rallonge pas la liste. |
| **D3** | Le régime de guidage est-il **par pilier** (3 curseurs) ou **global** (1 seul) ? | Par pilier — on peut vouloir être guidé en nutrition et autonome en muscu. C'est même le cas le plus fréquent. |
| **D4** | Remplace-t-on la question « Niveau d'affichage » de l'onboarding par la question de guidage ? | Oui. Elle reste réglable dans les réglages, et c'est ce qui débloque le constat 5. |
| **D5** | Accepte-t-on que **3 signaux de sécurité** ignorent le mode Autonome ? | Oui, et on l'écrit dans l'écran de choix — la transparence est la contrepartie. |
| **D6** | Le niveau et la disponibilité sont-ils demandés à l'**onboarding** ou **devant la bibliothèque** ? | Devant la bibliothèque. La décision F reste intacte, et la question a un objet visible. |
| **D7** | Ouvre-t-on le **lot A avant le lancement** ? | Oui — coût quasi nul, et il supprime une promesse non tenue en page 3 de l'onboarding. |

---

## 10. Périmètre de ce document

**Ce qu'il fait** : une cartographie vérifiée dans le code au 12/09/2026, un modèle, une matrice de
défauts, un découpage et sept décisions à trancher.

**Ce qu'il ne fait pas** : aucune spécification d'US, aucun plan d'implémentation, aucune ligne de
code, aucune migration. Les chemins cités ont été lus dans le dépôt local, **pas rejoués sur l'APK
installé**. Les maquettes jointes sont des images de conception, pas un prototype cliquable.

**Ce qu'il écarte volontairement** : l'objectif hybride unifié à arbitrage de compromis et le
simulateur « what-if » (IDEAS, 25/07/2026) — deux sujets de positionnement qui méritent leur propre
session, et qui n'ont de sens qu'une fois les lots A à C posés.
