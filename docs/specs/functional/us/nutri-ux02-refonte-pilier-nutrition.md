---
id: NUTRI-UX02
titre: "Refonte du pilier Nutrition — la bibliothèque qui arrive, deux moments, le vert qui existe"
roadmap: [4.46]
catalogue: [NUTR-07, NUTR-10, NUTR-16, NUTR-17, NUTR-18, MN-06, MN-03]
etape: recette
branche: dev
maj: 20/09/2026
---

# US NUTRI-UX02 — Refonte du pilier Nutrition

> Demande de Florian le 20/09/2026, captures d'écran à l'appui : « de la même façon qu'on a fait
> une analyse sur le dashboard et les piliers muscu et cardio, on va faire une analyse sur le
> pilier nutrition ». Troisième passe de la série, après MUSCU-UX05 (18/09) et CARDIO-UX02 (19/09).
>
> ⚠️ **Travail directement sur `dev`** (décision Florian, reconduite depuis MUSCU-UX05).
> ⚠️ **Maquettes produites** — canvas Design du 20/09/2026, six planches dont deux jouables,
> validées par Florian avant l'implémentation. Voir §9.

## 0 — Les constats, et comment ils ont été établis

Sept blocs sur l'écran du pilier ; **un seul** (le Réservoir) disait quelque chose que l'utilisateur
ne savait pas déjà. Le reste re-présentait sa saisie. Pendant ce temps, **onze analyses livrées et
testées** dormaient derrière une icône, sur `Nutrition › Stats`.

| # | Constat | Comment il a été établi |
|---|---|---|
| 0 | La bibliothèque d'aliments n'arrive pas sur le téléphone | Comptage REST sur le cloud le 20/09 |
| 1 | Les deux écrans de recherche ne se comportent pas pareil | Lecture croisée des deux repositories |
| 2 | Onze analyses livrées, aucune sur l'écran du pilier | Catalogue `analyses-donnees.md` × code |
| 3 | Cinq cartes de repas pour quatre lignes d'information | Captures 3 et 4 |
| 4 | Deux nombres différents pour la même dépense | Capture 1 |
| 5 | Le vert est le moins coloré des cinq piliers | Mesure de chroma, cinq piliers × deux thèmes |
| 6 | Le contenu passe sous la barre compacte, tranché net | Capture 2 |
| 7 | Six pastilles de micronutriments à « 0,0 mg » | Capture 4 |

### 0.1 — Constat 0, le seul bloquant

Vérifié le 20/09/2026 par comptage REST sur le projet cloud :

- `foods` où `owner_id is null and deleted_at is null` → **3 246**
- `food_translations` où `lang = 'fr'` → **3 246**
- `name ilike '%saumon%'` → « Saumon » présent

Et côté dépôt : `foods` est dans la publication logique depuis `20260706150000_food_tables.sql`, les
deux tables sont dans le bucket `shared_content` du YAML de sync rules, et `powersync/schema.ts`
déclare les trois tables, `preparation_state` compris.

**Le code et le cloud sont donc corrects ; ce qui manque est entre les deux.** Le suspect est
l'étape manuelle que CLAUDE.md signale lui-même : *« les sync rules ne sont pas versionnées côté
outil […] étape manuelle, déjà oubliée une fois »*. Le YAML du dépôt n'est pas ce qui tourne tant
qu'on ne l'a pas collé dans le dashboard PowerSync et déployé.

🔴 **Cette vérification est hors-code et n'a pas pu être faite par l'agent** — elle reste au
premier point de la recette (§8).

**La conséquence en cascade est ce qui rend le constat prioritaire sur tout le reste** : sans base,
l'utilisateur saisit en texte libre ; une entrée libre ne porte aucun micronutriment ; d'où les six
pastilles à zéro du constat 7, le Réservoir réduit à une estimation, et la qualité alimentaire
muette. **La moitié de l'écran était vide à cause d'un bug de synchro, pas d'un défaut de
conception.**

## 1 — Règles

### R1 — La bibliothèque absente se dit, et se dit *précisément*

R1.1 — L'app distingue **trois causes**, à partir de l'état réel de PowerSync :
- `!hasSynced` → la première synchro n'est pas finie (cas normal d'une installation neuve) ;
- `hasSynced && !connected` → hors ligne, la base n'est jamais arrivée ;
- `hasSynced && connected` → **la bibliothèque n'est pas publiée vers cet appareil**. C'est le cas
  qui accuse la configuration et non l'utilisateur.

R1.2 — Le message affiche le **compte local exact**, pour qu'un signalement porte un chiffre.

R1.3 — 🔴 **Aucun bouton de relance.** Les API qui forceraient un re-téléchargement complet
(`disconnectAndClear`) jettent aussi la file d'écritures en attente : un utilisateur hors réseau
depuis le matin y perdrait sa journée de repas pour régler un problème qui n'est pas le sien.

R1.4 — L'état s'affiche sur **les deux** portes d'entrée : la feuille d'ajout (la plus fréquente)
et l'écran plein.

### R2 — Une recherche, un seul comportement

R2.1 — L'écran plein passe du chargement intégral + filtre JavaScript à une requête **bornée en
SQL** puis classée par pertinence, comme la feuille d'ajout depuis NUTRI-UX01.

R2.2 — Les correspondances par **début de nom** passent devant **dans le SQL**, donc avant la coupe
à `LIMIT`. Sans cette clause, la limite tranche dans l'ordre alphabétique et une liste peut
rétrécir quand on précise sa recherche.

R2.3 — Le filtre `LIKE` reste **grossier et assumé** : SQLite ignore la casse mais pas les accents.
C'est `rankFoodMatches` (diacritiques repliés) qui rattrape « creme » → « Crème », sur un ensemble
déjà borné.

### R3 — Deux moments, pas un écran de plus

R3.1 — L'écran du pilier porte deux onglets : **Aujourd'hui** (saisir — vingt fois par jour, cinq
secondes) et **La semaine** (comprendre — deux fois par semaine, trois minutes).

R3.2 — L'onglet **n'est pas persisté** : l'app s'ouvre sur « saisir ».

R3.3 — L'onglet « La semaine » **remonte les cartes existantes**, sans les réécrire ni les
dupliquer : `ProteinPerKgCard`, `TrainingNutritionCrossCard`, `WeightGoalCard`, `RegularityCard`.

R3.4 — Il ouvre sur un **verdict en une phrase**, et les cartes deviennent sa justification.

R3.5 — 🔴 Le verdict **ne conclut pas sous 4 jours loggés**. Un « 100 % dans la cible » calculé sur
un jour est faux au point d'être nuisible. Seuil réutilisé de `bodyweight.ts`, pas redéfini.

R3.6 — Conformité ADR-007 : le plafond de 4-6 widgets porte sur le **Tier 0** (l'accueil). L'écran
d'un pilier est du **Tier 1** (« à la demande »), et un onglet est à la demande. Chaque carte garde
la règle du **Tier 2** : elle ne s'affiche que lorsqu'elle a quelque chose à dire.

### R4 — Une carte « Ta journée », pas cinq cartes de repas

R4.1 — Les repas deviennent des **sections** d'une carte unique : un cadre, un filet entre les
repas, un bouton d'ajout principal au pied.

R4.2 — Chaque repas porte la **part du jour** qu'il pèse, en barre fine. C'est NUTR-16 rendue là où
la décision se prend, sans ouvrir d'écran.

R4.3 — 🔴 Le `+` **par repas est conservé**, en icône dans l'en-tête. Le supprimer aurait forcé à
passer par la feuille, qui déduit le repas de l'heure courante (R2.6 de NUTRI-UX01) : noter son
petit-déjeuner à 20 h serait redevenu un parcours à corriger. On supprime la répétition, pas le
raccourci.

R4.4 — La section « Autres » (entrées orphelines) entre dans la carte, **toujours sans ajout** : on
ne crée rien dans un repas qui n'existe plus.

### R5 — Un zéro faux coûte plus cher qu'une absence

R5.1 — Quand **aucun** des micronutriments suivis n'est renseigné, l'écran affiche l'explication au
lieu de la grille.

R5.2 — 🔴 Le seuil est **aucun**, pas « peu ». Si trois micros sur six sont connus, les trois autres
à zéro sont une information juste (« tu n'as pas eu de vitamine D aujourd'hui ») et la grille reste.

### R6 — Le bandeau d'énergie cesse d'être un nag

R6.1 — Il se tait les jours **sans dépense** : dire que la cible ne suit pas les dépenses réelles un
jour sans dépense n'apporte rien.

R6.2 — Il porte **les deux nombres** — dépense réelle et bonus forfaitaire — pour que l'écart soit
visible et la décision évidente. C'est la réponse au constat 4.

### R7 — Le vert du pilier

R7.1 — Quatre valeurs changent : la teinte du pilier, son gain, et les deux accents.

R7.2 — Les cinq valeurs de la **scène** suivent, sinon les cartes du corps deviendraient plus vertes
que la scène qui les annonce — le défaut exact signalé sur le cardio, à l'envers.

R7.3 — 🔴 Aucune régression de contraste : toutes les valeurs proposées **améliorent** le ratio.

### R8 — Le bord sous la barre compacte

R8.1 — Un dégradé de 20 px est posé **sous** la barre, solidaire de sa visibilité.

R8.2 — 🔴 Ce n'est pas un fondu **sur** la barre : R1 de DASH-01 impose qu'elle apparaisse d'un coup,
et elle le fait toujours. Ce qui est interdit, c'est que l'en-tête se fonde en arrivant, pas que son
bord inférieur soit adouci.

## 2 — La couleur, mesurée

Chroma = écart max−min des canaux RVB, le proxy de saturation déjà utilisé pour diagnostiquer le
bleu du cardio. La fonction est désormais **nommée et testée** (`chroma()` dans `packages/shared`).

### 2.1 — Le diagnostic

Chroma des **teintes source** de chaque pilier :

| pilier | teinte | chroma |
|---|---|---|
| accueil | `#b14f2b` | 134 |
| labo | `#8a6419` | 113 |
| course | `#1d4586` | 105 |
| musculation | `#7c2734` | 85 |
| **nutrition (avant)** | `#2e4419` | **43** |

Le cardio partait d'un bleu franc et le perdait dans la mécanique de luminance (un gain de 1,5 a
suffi). La nutrition partait d'un **olive**, deux fois moins coloré que la plus terne des quatre
autres teintes. Mesuré : `#2e4419` plafonne à **chroma 22 même à gain 2**, loin de la bande 29-32.

### 2.2 — Les quatre valeurs

| | avant | après | effet |
|---|---|---|---|
| teinte | `#2e4419` · chroma 43 | `#2f6b12` · chroma 89 | surface sombre `#1f2d10`, **chroma 29** |
| gain | 1 | 1,5 | même patron que `running` |
| accent sombre | `#a9ba7e` · 6,98:1 · chroma 60 | `#9ed16a` · **8,21:1** · chroma 103 | — |
| accent clair | `#52703a` · 5,22:1 · chroma 54 | `#3f6b1c` · **5,86:1** · chroma 79 | — |

Résultat mesuré après correction — sombre (neutre 18) : accueil 36, labo 32, musculation 29,
course 29, **nutrition 29**. Clair (neutre 13) : nutrition **34**, la meilleure des cinq.

⚠️ `success` et `chartGreen` gardent `#a9ba7e` : ce sont des rôles sémantiques distincts, qui ne
suivent pas l'identité d'un pilier.

### 2.3 — La scène

| rôle | avant | chroma | après | chroma | `inkMuted` après |
|---|---|---|---|---|---|
| fond | `#22301a` | 22 | `#1f3110` | 33 | 11,29 |
| niveau haut | `#4a6c2e` | 62 | `#456f22` | 77 | 4,78 |
| niveau bas | `#3a5622` | 52 | `#365f19` | 70 | 6,05 |
| onde | `#a9ba7e` | 60 | `#9ed16a` | 103 | — |
| `onSolid` | `#2e4419` | 43 | `#2f6b12` | 89 | 6,50 sur blanc |

⚠️ **Écarté** : `#4a7c22` (chroma 90) pour le haut du niveau. Il passait le seuil pour `ink` mais
faisait tomber `inkMuted` à **4,05**, sous les 4,5. C'est la borne réelle de ce dégradé — le texte
secondaire est posé *sur* le niveau qui monte, et c'est lui qui plafonne la saturation.

### 2.4 — Le garde-fou, et ce qu'il a trouvé

Le test de contraste ne pouvait **pas** attraper ce défaut : `tintPreservingLuminance` conserve la
luminance, donc les ratios passent quoi qu'il arrive — y compris quand la teinte a disparu. Deux
fois, un pilier a produit une surface moins colorée que la surface neutre qu'elle remplace, sans
qu'aucun test ne bronche.

Un test-garde est ajouté, **sans seuil arbitraire** : il compare chaque pilier à la palette neutre.

🔴 **Ce que le garde-fou a trouvé immédiatement, et qui n'est PAS corrigé ici** : en thème clair, la
**musculation** sort à chroma **9**, soit sous le neutre (13) — le même défaut, sur un troisième
pilier, jamais repéré. La course est juste au-dessus (15). Le lot validé porte sur la nutrition, et
retoucher le bordeaux en douce défairait l'arbitrage du 19/09. Le constat est porté au **BACKLOG
(P1)** ; une exception nommée et datée dans le test le rend visible au lieu de le taire, et le test
échouera si la situation empire.

## 3 — Ce qui a été livré

| Règle | Où |
|---|---|
| R1 | `components/nutrition/LibraryNotice.tsx` · `useLibraryPresence` |
| R2 | `selectFoodSearch` · `useFoodSearch` · `app/food-picker.tsx` |
| R3 | `app/(tabs)/nutrition.tsx` (onglets) · `components/nutrition/WeekVerdictCard.tsx` · `packages/shared/src/week-verdict.ts` |
| R4 | `MealSection` (prop `dense`) · carte « Ta journée » |
| R5 | `countReportedMicros` (shared) · `TrackedMicrosRecap` |
| R6 | `components/energy/DayEnergyCard.tsx` |
| R7 | `theme/pillar.ts` · `theme/colors.ts` · `theme/stage.ts` · `stores/menu-accent-store.ts` · `LabScene2D.tsx` |
| R8 | `components/stage/StageScrollView.tsx` |

## 4 — Tests

| Fichier | Tests | Ce qu'ils verrouillent |
|---|---|---|
| `packages/shared/src/contrast.test.ts` | +4 | `chroma`, et les valeurs des deux défauts historiques |
| `apps/mobile/src/theme/__tests__/contrast.test.ts` | +3 séries | teinter ajoute de la couleur ; aucun accent sous la moitié du plus coloré |
| `packages/shared/src/food.test.ts` | +5 | `countReportedMicros` — le zéro réel compte, l'absence non |
| `packages/shared/src/week-verdict.test.ts` | 14 | le garde-fou des 4 jours, les bornes incluses, l'ordre des remarques |
| `apps/mobile/src/data/repositories/__tests__/food-search-sql.test.ts` | 11 | « saumon », le bornage, les débuts de nom, le comptage de bibliothèque |
| `apps/mobile/src/components/nutrition/__tests__/LibraryNotice.test.tsx` | 9 | les trois causes, et l'absence de bouton de relance |
| `apps/mobile/src/app/(tabs)/__tests__/nutrition-screen.test.tsx` | +6 | onglets, carte unique, bouton unique, part du jour, micros honnêtes |

Suite complète au 20/09/2026 : **3 791 tests Jest (226 suites) + 185 fichiers Vitest, tous verts**,
`typecheck` et `lint` à zéro.

🔴 **Un test existant a été corrigé, et c'est un constat en soi** : `nutrition-screen.test.tsx`
vérifiait la grille de micronutriments avec un fixture à `micronutrients: {}`. Il validait donc,
sans le dire, l'affichage de six pastilles à « 0,0 mg ». Le test documentait le défaut.

## 5 — i18n

FR + EN pour : `journal.library.*`, `journal.dayCard.*`, `journal.mealShareA11y`,
`nutrition.week.*`, `nutrition.micros.unknownFreeText` / `unknownEmptyDay`,
`energy.day.notFollowingNumbers`.

## 6 — Offline

Aucune écriture nouvelle, aucune table nouvelle, **aucune migration**. `useLibraryPresence` est une
lecture locale (`COUNT` sur `foods`), et le verdict lit des hooks déjà offline-first.

## 7 — Ce qui n'a pas été fait, et pourquoi

1. **Vérifier et redéployer les sync rules PowerSync** — hors-code, accès dashboard requis. C'est le
   point n° 1 de la recette, et tout le constat 0 en dépend.
2. **Le bordeaux en thème clair** (chroma 9) — hors périmètre validé, porté au BACKLOG en P1.
3. **Le repli de la carte énergie en une ligne** — la maquette la montrait repliée ; le livré traite
   la cause (le bandeau devient utile et conditionnel) plutôt que le symptôme. Replier la carte
   entière aurait ajouté un état et un risque sur DEPENSE-03 pour un gain de place déjà obtenu par
   la fusion des cartes de repas.

## 8 — Recette

Voir [RECETTES.md](../../../../RECETTES.md), section NUTRI-UX02.

## 9 — Maquettes

Canvas Design du 20/09/2026 — six planches : l'écran actuel reconstitué, le dashboard refondu
(jouable, deux onglets), le bug de recherche (jouable, deux états), la fusion des repas, la planche
couleur mesurée, et le compte rendu. Validé par Florian le 20/09/2026 (« je valide tout »).
