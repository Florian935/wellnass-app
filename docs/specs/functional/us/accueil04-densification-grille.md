---
id: ACCUEIL-04
titre: "Densification de la grille — la forme « row », le retour du poids et les squelettes"
roadmap: [7.26]
catalogue: []
etape: close
branche: feature/accueil-refonte
maj: 10/09/2026
---

# ACCUEIL-04 — Densification de la grille

> Quatrième des six US de la refonte de l'accueil (lot unique, `feature/accueil-refonte`).
> C'est la plus risquée du lot : elle touche la **géométrie de la grille**, partagée par les trois
> hubs.

## 1. Le défaut

### 1.1 Une seule forme par défaut

```ts
defaultSize: uniformSize(HOME_WIDGET_IDS, 'wide')   // widgets.ts, avant
```

Tous les widgets de l'accueil avaient la même taille : cinq à six rectangles **strictement
identiques** empilés. Aucune hiérarchie — le point d'entrée « vie réelle » avait exactement le même
poids visuel que la nutrition du jour.

### 1.2 La grille imposait la hauteur

La case unité était **carrée** (`cellH = colW`). Sur le cadre de référence (392 × 812,
`colW` = 170), une cellule `wide` mesurait donc toujours 352 × 170, quel que soit son contenu :

| Widget `wide` | Contenu réel | Remplissage |
|---|---|---|
| Nutrition | ~86 px | 51 % |
| Régularité | ~85 px | 50 % |
| Pas | ~110 px | 65 % |
| Insights | ~80 px | 47 % |
| **Vie réelle, hors période** | ~44 px | **26 %** |
| *Moyenne* | | **47 %** |

Le contenu étant centré, chaque carte avait une bande de vide au-dessus **et** en dessous.

### 1.3 Trois autres défauts de même famille

- **Le poids avait quitté l'accueil** (déporté par INSIGHTS-02 vers `/measurements`), alors qu'il
  figure parmi les quatre blocs de `navigation-ux.md` §3.1 **et** dans la maquette validée.
- **Aucun état de chargement** : les huit widgets faisaient `if (isLoading) return null`. À
  l'ouverture, écran vide, puis les cartes arrivaient une à une — et `compactLayout` recompactant à
  chaque changement, la grille se réagençait **sous le doigt**. C'est le premier contact, chaque
  matin.
- **La carte Régularité était un cul-de-sac** : aucun `onPress`. La carte la plus motivationnelle
  de l'écran ne menait nulle part.

## 2. Ce qui est livré

### 2.1 La forme `row` et la double résolution verticale

`sizeSpan` compte désormais les hauteurs **en demi-cases** :

| Forme | Avant | Après |
|---|---|---|
| `row` | *n'existait pas* | **2 × 1** |
| `small` | 1 × 1 | 1 × 2 |
| `wide` | 2 × 1 | 2 × 2 |
| `large` | 2 × 2 | 2 × 4 |

Les **rapports** entre `small`, `wide` et `large` sont inchangés : c'est l'unité qui change, pas la
mise en page. Côté rendu, `cellH = (colW - gap) / 2`.

**R1 · La soustraction de la gouttière n'est pas négociable.** C'est elle qui fait que **deux `row`
empilées pavent exactement un `wide`** (79 + 12 + 79 = 170). Avec `colW / 2`, chaque paire de lignes
dériverait d'une demi-gouttière et la grille cesserait d'être alignée en bas de page.

**R2 · Deux pas de déplacement distincts.** Les cellules n'étant plus carrées, la conversion
pixel → case a un pas horizontal et un pas vertical différents. L'ancien `step = colW + gap` unique
viserait une ligne sur deux pendant un glisser-déposer — le widget se poserait systématiquement une
demi-cellule trop bas. Garde-fou : un test dédié dans `SortableWidgetGrid.test.tsx`.

**R3 · La géométrie a une source unique.** Elle vivait **en double** (`cellRect` dans `WidgetGrid`,
`rectOf` dans `SortableWidgetGrid`) : deux formules identiques, donc deux à corriger. Extraite dans
`grid-geometry.ts`.

**R4 · Aucune migration de données.** Les dispositions enregistrées se migrent **seules** :
`resolveScreenLayout` conserve l'ordre des lignes stockées puis `compactVertical` les **recalcule**
dans la nouvelle unité. Un layout `[0, 1, 2, 3]` de `wide` ressort en `[0, 2, 4, 6]`, même ordre,
sans trou. **Vérifié par quatre tests** (`widgets.test.ts`, « migration implicite ») — sans eux, la
garantie ne serait qu'une intention de docstring, et le symptôme serait des widgets superposés chez
tous ceux qui avaient personnalisé leur accueil.

### 2.2 Formes par défaut différenciées

| Widget | Avant | Après | Motif |
|---|---|---|---|
| `nutrition-summary` | wide | **wide** + macros | la carte la plus dense de l'accueil |
| `streak` | wide | **wide** + bandeau | 50 % → 90 % de remplissage |
| `steps` | wide | **small** | un anneau et un total suffisent |
| `weight` | *absent* | **small** | de retour, partage sa ligne avec les pas |
| `insights` | wide | wide | inchangé |
| `activation-path` | wide | wide | a besoin de la place (titre + action) |
| `real-life` | wide | **row** | une ligne hors période, l'état le plus fréquent |
| `cycle` | wide | wide | inchangé |

**R5 · `large` ne devient la valeur par défaut d'aucun widget** : à 7 h du matin, un grand carré
nutrition serait vide. C'est un choix de l'utilisateur, pas un défaut.

**R6 · Densifier n'est pas agrandir.** La cellule `wide` de la nutrition ne change pas de taille :
elle passe de trois lignes « libellé ⋯ valeur » (qui redisaient ce que l'anneau montrait déjà) aux
**trois macros et leur progression**. Repli propre : sans cibles de macros calculables, on retombe
sur consommé / objectif — mieux vaut deux lignes justes qu'une grille de barres sans référence.

### 2.3 La forme effective

`WidgetGrid` accepte `sizeFor(id, stored)`. Le cas qui l'a rendue nécessaire : `real-life` vaut
`row` hors période, mais **en période** la carte porte une échéance, des objectifs et deux boutons —
qui n'entrent pas dans 79 px. L'accueil la remonte donc à `wide` tant que la période court.

**R7 · La disposition de l'utilisateur n'est jamais réécrite.** C'est un besoin d'affichage, pas une
préférence : le widget retrouve sa bande de lui-même à la fin de la période.
**R8 · Ne s'applique pas en édition** : l'utilisateur y manipule sa préférence, voir la forme changer
sous son doigt serait incompréhensible.
**R9 · Appliquée avant la compaction** : agrandir une cellule peut créer un chevauchement, que
`compactLayout` résout — dans l'autre ordre, la carte agrandie recouvrirait sa voisine.

### 2.4 Squelettes de chargement

`WidgetSkeleton` réserve la cellule pendant le chargement. **R10 · Aucun chiffre n'est affiché** :
un « 0 » provisoire se lit comme une donnée réelle (« 0 jour d'affilée » à quelqu'un qui tient une
série de 40 jours est le pire message possible de l'écran). Seul le sur-titre paraît. Pas
d'animation de pulsation : les données sont locales, l'attente se compte en dizaines de
millisecondes, une pulsation se lirait comme un scintillement.

### 2.5 Régularité tappable

La carte mène à `/review`. Bénéfice secondaire : INSIGHTS-02 avait relevé que le bilan hebdomadaire
n'avait **qu'un seul** point d'entrée, enfoui dans Réglages › Suivi, la notification n'y menant pas.

## 3. Ce qui **n'a pas** changé

`MAX_HOME_WIDGETS` reste à **8**. Le retour de `weight` est compensé par la promotion de
`today-session` en zone épinglée (ACCUEIL-01) : le registre est à 8 par un échange exact.
L'analyse recommandait 8 → 9 ; la promotion l'a rendu inutile.

## 4. i18n

`home.nutrition.bonusShort` ajouté (FR + EN). Les autres chaînes existaient.

## 5. Offline

Aucune migration SQL, aucune sync rule, aucune dépendance native. **Recettable sur l'APK existant.**

## 6. Cas limites

| Cas | Comportement |
|---|---|
| Layout enregistré avant cette US | migré automatiquement, ordre préservé (R4) |
| Deux `small` côte à côte dans l'ancien layout | restent côte à côte |
| `row` lu par un client antérieur | `coerceSize` reconnaît la valeur |
| Widget en `row` sans rendu dédié | tous les huit ont désormais un rendu `row` |
| Période « vie réelle » active | forme remontée à `wide` (R7) |
| Aucune pesée enregistrée | la carte poids affiche son état vide, pas un zéro |

## 7. Recette

- [ ] **Le plus important** : ouvrir l'app avec un accueil déjà personnalisé (widgets déplacés,
      tailles changées) → **aucun widget superposé, aucun trou, ordre préservé**.
- [ ] Les pas et le poids sont **côte à côte** sur une seule ligne.
- [ ] La carte « vie réelle » hors période est une **bande fine**, pas un grand rectangle vide.
- [ ] Déclarer une période « vie réelle » → la carte **grandit** ; la période finie, elle redevient
      une bande, **sans** que la disposition ait été modifiée.
- [ ] La carte nutrition affiche les **trois macros** avec leur progression.
- [ ] Un appui sur **Régularité** ouvre le bilan de la semaine.
- [ ] À l'ouverture de l'app, l'écran **ne saute pas** : les cellules sont en place, seul le contenu
      se remplit.
- [ ] Aucun « 0 » ne clignote pendant le chargement.
- [ ] Mode édition : déplacer un widget le pose **exactement** là où le doigt le lâche (pas une
      demi-cellule plus bas) — à vérifier sur les quatre formes.
- [ ] Passer un widget en `row` via le sélecteur de forme : le rendu tient sur une ligne.
