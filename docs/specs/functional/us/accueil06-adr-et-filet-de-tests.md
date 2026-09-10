---
id: ACCUEIL-06
titre: "Amendement d'ADR-007 & premier test d'écran de l'accueil"
roadmap: [7.28]
catalogue: []
etape: close
branche: feature/accueil-refonte
maj: 10/09/2026
---

# ACCUEIL-06 — Amendement d'ADR-007 & filet de tests

> Sixième et dernière des six US de la refonte de l'accueil (lot unique,
> `feature/accueil-refonte`). Elle ne livre **aucune fonctionnalité** : elle rend explicites les
> décisions que les cinq précédentes ont rendues concrètes, et pose le filet qui manquait.

## 1. Le défaut

### 1.1 Un plafond ambigu

ADR-007 §2 plafonne le Tier 0 à « 4-6 widgets ». Le dégonflage INSIGHTS-02 (21 → 8) l'a appliqué en
retirant quatorze cartes — c'était juste. Mais il n'a **pas densifié les huit qui restent**, et le
résultat net était le pire des deux mondes : moins de widgets *et* moins d'information, sur
exactement la même surface.

La refonte ajoute quatre **zones épinglées**. Rien dans l'ADR ne dit si elles comptent dans le
plafond. Sans réponse écrite, la prochaine relecture rapide tranchera dans un sens ou dans l'autre
— et le plafond deviendrait soit inopérant, soit une excuse pour laisser l'accueil sans hiérarchie.

### 1.2 Un écran sans filet

L'accueil n'avait **aucun test d'écran**, alors que c'est celui sur lequel l'app ouvre. Les hubs
Muscu et Nutrition en avaient un chacun. `(tabs)/__tests__/` contenait `nutrition-screen` et
`strength-screen` ; pas `home-screen`.

## 2. Ce qui est livré

### 2.1 Amendement à ADR-007

Ajouté au §2 de l'ADR :

> **Le plafond porte sur les widgets de la grille, pas sur le chrome de l'écran.** Une zone
> **épinglée** — non masquable, non déplaçable, conçue pour l'écran — n'est pas un widget et ne
> consomme aucune place au plafond. Ce qui la distingue n'est pas sa taille mais son **contrat** :
> l'utilisateur ne peut pas la retirer, donc elle est garantie, donc elle n'est pas négociable.
>
> Corollaire, et c'est là que la nuance a un coût : une zone épinglée **coûte plus cher** qu'un
> widget, pas moins. Elle est imposée à tout le monde, elle doit donc valoir pour tout le monde.
> Quatre zones sont livrées le 09/09/2026 ; en ajouter une cinquième demandera le même arbitrage
> explicite qu'un neuvième widget.

### 2.2 Le registre reste à 8

**R1 · `MAX_HOME_WIDGETS` n'a pas bougé**, et il faut que ce soit lisible :
`today-session` a quitté la grille pour la zone 1, `weight` y est revenu. Échange exact.

L'analyse recommandait 8 → 9 et le compte rendu remis à Florian portait cette recommandation. La
promotion de `today-session` l'a rendue inutile : **c'est une meilleure issue**, parce qu'elle ne
consomme pas le cliquet qu'INSIGHTS-02 a posé.

### 2.3 Le nouveau type de destination

`{ kind: 'home-pinned', zone }` dans `widget-destinations.ts`, plus deux tests :
`today-session` est bien épinglé, et le compte des signaux déplacés reste de 14. La règle R1
d'INSIGHTS-02 (« aucun signal ne disparaît ») ne dit pas *où* va un signal, elle dit qu'il va
quelque part — le test compte donc ce qui a quitté la grille sans présumer de la forme.

### 2.4 `home-screen.test.tsx`

Neuf tests sur le **vrai** écran monté. Il ne vérifie pas les contenus (ils ont leurs propres
tests) mais l'**assemblage**, c'est-à-dire ce que la refonte a introduit :

- les quatre zones fixes et la grille sont montées ;
- le nom de l'application **n'apparaît plus** en titre ;
- le mode édition **masque le chrome** et passe la grille en édition ;
- la forme effective de `real-life` suit l'état de la période ;
- l'accroche, la carte et la pastille dérivent de **la même décision** — elles ne peuvent pas se
  contredire, et c'est aussi pourquoi `useNowAction` n'est appelé qu'une fois dans l'écran.

## 3. Bilan de tests du lot complet

| Périmètre | Avant | Après |
|---|---|---|
| `packages/shared` (Vitest) | 3 089 | **3 121** (+32 : `day-moment`, `now-action`, migration) |
| `apps/mobile` (Jest) | 2 690 | **2 721** (+31 : `NowCard` 16, `home-screen` 9, grille 6) |
| Test d'écran de l'accueil | **0** | 9 |

## 4. Ce que cette US ne fait pas

Elle ne corrige pas les **36 tests en échec de `apps/admin/src/screens/ExerciseEditScreen.test.tsx`**.
Vérifié : ils échouent **déjà sur `dev` sans ce lot** (`git stash` + relance). C'est une régression
préexistante du back-office, hors périmètre — signalée à Florian, à traiter séparément.

## 5. Recette

- [ ] `npm run test` : lire le **code de sortie sans pipe** (un `tail` en aval masque l'échec).
- [ ] `npm run typecheck` et `npm run lint` : zéro erreur, zéro avertissement.
- [ ] Relire l'amendement d'ADR-007 §2 et le valider — c'est la décision de doctrine du lot.
- [ ] Confirmer l'arbitrage : le registre **reste à 8** (au lieu du 8 → 9 recommandé initialement).
