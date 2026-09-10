# Plan d'implémentation — Refonte de l'accueil (ACCUEIL-01 → 06)

> Specs : [ACCUEIL-01](../specs/functional/us/accueil01-carte-maintenant.md) ·
> [02](../specs/functional/us/accueil02-entete-utile.md) ·
> [03](../specs/functional/us/accueil03-actions-rapides.md) ·
> [04](../specs/functional/us/accueil04-densification-grille.md) ·
> [05](../specs/functional/us/accueil05-pied-et-rafraichissement.md) ·
> [06](../specs/functional/us/accueil06-adr-et-filet-de-tests.md)
> Branche : `feature/accueil-refonte` · Créée depuis `dev` (`8db76eb`) le 09/09/2026
> Analyse : `design/accueil-refonte/Refonte-accueil-analyse.pdf` · Maquettes : canvas « Accueil FitTrio »

## 0. Pourquoi UN plan pour SIX US

Écart assumé à la convention du dépôt (« 1 plan par US ») : Florian a validé maquettes et compte
rendu puis demandé explicitement « **TOUT faire d'un seul gros lot d'implémentation, je ferai le
recettage à la toute fin** » (09/09/2026). Les six US partagent une branche, un commit et une
recette. Les découper en six plans aurait produit six fois le même préambule pour un seul chemin
de build.

Chaque US garde en revanche **sa spec et son front-matter** : c'est ce que lit `scripts/etat.mjs`,
et c'est ce qui permet de clôturer une US sans les autres si la recette en recale une.

## 1. Ce que ce plan garantit d'emblée

| Question | Réponse |
|---|---|
| Migration base de données ? | **Non** |
| Sync rule PowerSync à redéployer ? | **Non** — aucune table nouvelle ni synchronisée |
| Dépendance native neuve ? | **Non** → **recettable sur l'APK existant** |
| Migration du layout stocké ? | **Non** — automatique, et **prouvée par test** (voir lot 1) |
| Analyse nouvelle calculée ? | **Non** — que des signaux déjà livrés, enfin affichés |
| Fonctionnalité supprimée ? | **Aucune** — `today-session` est promu, pas retiré |
| Plafond ADR-007 déplacé ? | **Non** — registre à 8 par échange exact |

## 2. Ordre de build

L'ordre n'est pas cosmétique : **la logique pure d'abord, le rendu ensuite**. Chaque lot est
typecheck-vert et test-vert avant le suivant, ce qui évite de déboguer une décision métier à travers
un arbre React.

```
Lot 1  Géométrie & registre          shared        le plus risqué : fait en premier, sous test
Lot 2  Les deux modules purs         shared        day-moment + now-action (aucune dépendance)
Lot 3  La géométrie de rendu         mobile        source unique + deux pas de drag
Lot 4  Les primitives                mobile        WidgetSkeleton + RowLine
Lot 5  Les quatre zones              mobile        NowCard, HomeHeader, QuickActions, UpNext
Lot 6  Densification des cartes      mobile        nutrition, streak, steps, real-life, cycle…
Lot 7  L'assemblage                  mobile        (tabs)/index.tsx + useSyncRefresh
Lot 8  i18n FR + EN                  mobile        parité vérifiée par script
Lot 9  Tests d'écran + ADR + suivi   doc           ACCUEIL-06
```

## 3. Détail par lot

### Lot 1 — Géométrie et registre (`packages/shared`)

**Le lot le plus risqué du plan** : il touche `sizeSpan`, partagée par les trois hubs.

- `WidgetSize` += `'row'` ; `sizeSpan` en **demi-cases** ; `coerceSize` accepte `'row'`.
- `HOME_WIDGET_IDS` : −`today-session`, +`weight` → toujours 8.
- `defaultSize.home` : fin de `uniformSize`, huit formes déclarées explicitement.
- `firstFreeCell` : garde-fou `maxRow` relevé ×4 → ×8 (les hauteurs ont doublé).
- `widget-destinations.ts` : nouveau `kind: 'home-pinned'` ; `weight` repasse en `home`.

**Tests à écrire AVANT de toucher au rendu** — c'est ce lot qui décide si la migration silencieuse
tient :
- empreintes en demi-cases, et l'invariant « deux `row` = un `wide` » ;
- **quatre tests de migration implicite** : ordre préservé, lignes recalculées en valeurs paires,
  deux `small` qui restent côte à côte, `coerceSize('row')` ;
- registre : 8 entrées, `today-session` absent du registre **et** de ses gardes, formes
  différenciées (≥ 3 valeurs distinctes — interdit le retour de `uniformSize`).

⚠️ **13 tests existants cassent** et c'est attendu : ils codaient des numéros de ligne en dur.
Les recalculer un par un, **pas au sed** : deux fixtures partaient d'un chevauchement et leur
résultat n'illustrait plus le déplacement mais la résolution de cette collision.

### Lot 2 — `day-moment.ts` et `now-action.ts` (`packages/shared`)

Aucune dépendance, aucune horloge, aucun React. 32 tests. Le second importe le premier — pas
l'inverse, donc pas de cycle.

### Lot 3 — Géométrie de rendu (`apps/mobile`)

- **`grid-geometry.ts`** : `rowHeight`, `stepX`, `stepY`, `cellRect`, `gridHeight`. Source unique.
- `WidgetGrid` : consomme le module, expose `sizeFor`, applique la forme effective **avant**
  `compactLayout`.
- `SortableWidgetGrid` : supprime son `rectOf` local, **deux pas distincts** pour la conversion
  pixel → case. C'est le défaut le plus fourbe du lot : un pas unique poserait le widget une
  demi-cellule trop bas.

### Lot 4 — Primitives

`WidgetSkeleton` (réserve la cellule, aucun chiffre) et `RowLine` (la déclinaison `row`, écrite une
fois au lieu de huit).

### Lot 5 — Les quatre zones

`NowCard` (reprend la machine à états de `TodaySessionCard`, étendue aux huit `kind`), `HomeHeader`,
`QuickActions`, `UpNext`, plus `useNowAction` qui assemble les faits.

⚠️ Deux extensions de repository sont nécessaires ici, et elles sont le cœur de deux défauts :
- `useTodaySession` : remonter `scheduled_time` (l'heure existait, aucun hook ne la lisait) ;
- `useTodayRunSession` : remonter `scheduled_time` **et** le nom de séance.

### Lot 6 — Densification

Nutrition (macros dans la cellule + `mealForHour`), Régularité (bandeau remonté en `wide` +
tappable), Pas (`small` + `row`), Vie réelle (`row`), Cycle / Insights / Parcours (`row` +
squelettes). Suppression de `TodaySessionCard` et de son test.

⚠️ **28 tests cassent**, tous sur le même point : ils vérifiaient `if (isLoading) return null`.
Les réécrire en conservant leur **intention** — « aucun chiffre provisoire » — et non leur
assertion littérale : le squelette est un changement voulu, l'absence de faux zéro ne l'est pas.

### Lot 7 — Assemblage

`(tabs)/index.tsx` : les cinq zones, `useNowAction` appelé **une seule fois** et diffusé (trois
appels monteraient trois fois l'union d'une douzaine de hooks sur l'écran le plus ouvert), le mode
édition qui masque le chrome, et `useSyncRefresh` pour le `RefreshControl`.

### Lot 8 — i18n

Fusion des clés dans `fr.json` et `en.json`, puis **script de contrôle de parité** (240 clés de part
et d'autre sous `home`). La décision G n'est pas négociable : aucune chaîne sans son équivalent.

### Lot 9 — Doc et suivi

Amendement d'ADR-007 §2, `home-screen.test.tsx` (9 tests), roadmap, CHANGELOG, RECETTES.md, ETAT.md.

## 4. Vérifications de sortie

```bash
npm run typecheck     # 0 erreur
npm run lint          # 0 erreur, 0 avertissement
npm run test          # ⚠️ lire le code de sortie SANS pipe
```

Attendu : **3 121** tests Vitest, **2 721** Jest, et les 36 échecs préexistants de
`ExerciseEditScreen.test.tsx` (vérifiés hors de ce lot par `git stash` — voir ACCUEIL-06 §4).

## 5. Ce qui reste hors de ce plan

- La ligne « objectif personnel » du pied de page (ACCUEIL-05 §3) : demande d'extraire d'abord le
  libellé d'objectif en brique réutilisable.
- Les 36 tests du back-office en échec sur `dev`.
