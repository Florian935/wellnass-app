---
id: NUTR-F2
titre: "Suggestion d'aliments pour combler un macro"
roadmap: [4.37]
catalogue: []
etape: recette
branche: feature/nutrf2-substitution-aliments
maj: 12/08/2026
reste: "Recette device du 01/08/2026 : le critère 2 (« quantités réalistes ») échouait — la suggestion comblait 100 % de l'écart, d'où « Chipolatas 350 g · 952 kcal ». Contrat revu (portion de référence + plafond calorique + seuil d'utilité, la carte annonce son apport) et 50 portions manquantes renseignées en base. Reste : rejouer la recette complète, et trancher les 3 valeurs de calibrage à l'usage. Les aliments OpenFoodFacts scannés restent au repli 200 g, faute de portion déclarée."
---

# US NUTR-F2 — Suggestion d'aliments pour combler un macro

> **Validée par Florian le 29/07/2026** (« go pour NUTR-F2 »), livrables d'amont et code couverts par
> le même go, mes recommandations valant arbitrage. Roadmap **4.37** (V0.9, P1, ~4 h).
>
> **Vérifié avant d'écrire** : rien n'existe (aucune brique de suggestion, aucun écran).

## 0. Objectif

Le journal nutrition est aujourd'hui **constatif** : il dit « il te reste 20 g de protéines » et
s'arrête là. Cette US le rend **actionnable** : « ajoute 120 g de blanc de poulet ».

**Sélection déterministe, pas d'IA.** Un score calculé localement, explicable et testable. C'est un
choix de conception, pas une limitation : une suggestion d'aliment doit être **reproductible** et
fonctionner **hors ligne**, deux choses qu'un appel à un modèle ne garantit pas.

### Ce qui existe et qu'on réutilise

| Brique | Où | Usage |
|---|---|---|
| Cibles de macros | `macroGramsFromCalories(target, defaultMacroRatios(objective))` | le gramme cible par macro |
| Totaux du jour | `sumNutrients`, déjà calculés par l'onglet Nutrition | le consommé |
| Objectif calorique effectif du jour | `computeEffectiveTargetForDay` (bonus d'entraînement compris) | le budget calorique restant |
| Aliments récents | `useRecentFoods(limit)` | le vivier prioritaire |
| Base d'aliments | `useFoods` / `SELECT_FOODS` | ⚠️ vivier de repli **différé** (voir §2) |
| Ajout au journal | `addFoodEntry` (journal-repository) | l'action au tap |

## 1. Décisions de cadrage

| # | Question | Décision retenue | Pourquoi |
|---|---|---|---|
| **D1** | Quel macro suggérer ? | Le macro dont l'**écart relatif** à sa cible est le plus grand, et l'utilisateur peut basculer sur un autre | L'écart **absolu** favoriserait toujours les glucides (cible la plus élevée en grammes). Le relatif désigne le macro réellement en retard |
| **D2** | Comment scorer un aliment ? | **Densité du macro visé rapportée aux calories** : g de macro pour 100 kcal. Puis, à densité proche, on préfère l'aliment **déjà consommé récemment** | On cherche à combler un macro **sans exploser le budget calorique** — c'est toute la difficulté. Trier sur les g/100 g désignerait des aliments très caloriques ; trier sur g/100 kcal désigne l'aliment **efficace** |
| **D3** | Quelle quantité proposer ? | Celle qui comble l'écart, **arrondie à 5 g** et **bornée à 10–400 g**. Hors de ces bornes, l'aliment est **écarté** | Le garde-fou du backlog. « 12 g de riz » ou « 900 g de brocoli » sont des réponses justes en arithmétique et absurdes en cuisine — mieux vaut proposer autre chose |
| **D4** | Quel vivier ? | **Les aliments récents** (40), **puis les plus denses de la base** (15 par macro, pré-filtrés en SQL — livré le 12/08/2026, voir §2) | On mange ce qu'on a chez soi : suggérer un aliment jamais consommé est un conseil théorique, et les récents sont donc le vivier **le plus utile**, pas seulement le plus économique |
| **D5** | Où ça vit ? | Une **carte conditionnelle** en bas du journal du jour, jamais un écran de plus | Le conseil doit apparaître **là où le manque se voit**. Un écran séparé ne serait jamais ouvert |
| **D6** | Quand s'affiche-t-elle ? | Seulement si : un objectif existe · l'écart du macro ≥ **10 %** de sa cible · le **budget calorique restant est positif** | Suggérer d'ajouter des protéines à quelqu'un qui a déjà dépassé ses calories serait un mauvais conseil. Et sous 10 % d'écart, il n'y a rien à combler |
| **D7** | Combien de suggestions ? | **3 au maximum** | Au-delà, on transforme un conseil en catalogue et on annule l'intérêt d'avoir trié |

## 2. Périmètre

**Dans le périmètre** : brique de score **pure et testée**, carte conditionnelle dans le journal,
ajout au journal en un tap depuis une suggestion, i18n FR + EN.

**Hors périmètre, explicitement**

- **Remplacer** un aliment déjà journalisé par un autre (« substitution » au sens strict). Le titre de
  la roadmap dit « substitution » mais son contenu décrit bien un **ajout** pour combler un manque.
  Le remplacement suppose de choisir quelle entrée retirer : autre geste, autre US.
- Toute **IA** (D2) et tout **rappel poussé** (famille NUTR-F1).
- ✅ **Le repli sur la base d'aliments — différé le 29/07/2026, LIVRÉ le 12/08/2026.**
  La spec prévoyait « récents **puis la base** » ; l'implémentation initiale s'était arrêtée aux
  récents, pour une raison valable : scorer la base côté client aurait chargé l'intégralité de
  CIQUAL en mémoire **à chaque rendu** de l'onglet. Le repli était conditionné à un constat de
  recette (critère 8bis).
  🔴 **Ce n'est pas la recette qui l'a rouvert, c'est un raisonnement qu'elle n'aurait pas produit :
  au lancement, aucun compte n'a d'aliment récent.** Le vivier est donc vide pour **100 % des
  nouveaux utilisateurs**, et la carte ne peut rien proposer précisément au moment où le conseil a
  le plus de valeur. Attendre la recette aurait signifié constater en bêta ce qui était déductible.
  **Solution retenue** : `useDenseFoodCandidates` (`food-repository`) — **pré-filtrage SQL**, une
  requête bornée par macro (`LIMIT 15`), triée sur la densité **rapportée aux calories**
  (`macro / kcal`, même règle que D2). CIQUAL n'est jamais chargé en mémoire, ce qui était le point
  dur d'origine. Les **trois** macros sont ramenés et non le seul macro prioritaire, parce que la
  carte laisse l'utilisateur **basculer** de macro : pré-filtrer sur un seul viderait la liste au
  premier changement. Les récents restent **en tête du vivier** et gardent leur priorité à densité
  comparable (D2). 11 tests SQL sur du vrai SQLite.
- Les **restrictions alimentaires et allergènes** : `nutrition_profiles` les porte déjà
  (`restrictions`, `allergens`) mais **aucun aliment n'est étiqueté** en base pour les recouper. Les
  ignorer serait un faux service ; les traiter demande d'étiqueter la base → **post-V1**.
  ⚠️ Conséquence à assumer : la suggestion **ne tient pas compte du régime déclaré**. À dire dans la
  carte plutôt qu'à laisser croire le contraire.

## 3. Comportement

- La carte apparaît sous le journal du jour quand les conditions de D6 sont réunies.
- Elle annonce le manque (« il te manque 24 g de protéines ») puis jusqu'à 3 aliments avec leur
  **quantité** et leur **apport calorique** — le coût doit être visible, sinon le conseil est partiel.
- Un tap sur une suggestion **ajoute l'entrée au journal** du jour, au repas courant, à la quantité
  proposée. Modifiable ensuite comme n'importe quelle entrée.
- Un sélecteur permet de viser un autre macro que celui proposé par défaut (D1).
- Aucun candidat exploitable → la carte affiche pourquoi (aucun aliment ne comble l'écart dans une
  quantité raisonnable) plutôt que de disparaître sans explication.

## 4. Offline

Aucune écriture nouvelle, aucune table, **aucune migration, aucune sync rule**. Le calcul est
**100 % local** sur des données déjà répliquées : la suggestion fonctionne donc hors ligne, ce qu'une
approche IA n'aurait pas permis.

## 5. i18n (FR + EN)

Namespace `suggestion` : titre, formulation du manque, quantité et coût, libellés des 3 macros,
états vides, mention « ne tient pas compte du régime déclaré ». Aucune chaîne en dur, pluriels gérés.

## 6. Accessibilité

Chaque suggestion est un bouton avec un `accessibilityLabel` complet (« ajouter 120 grammes de blanc
de poulet, 198 kilocalories »), cible ≥ 48 dp, `maxFontSizeMultiplier` sur les libellés courts. Le
manque est porté par **le texte**, jamais par la seule couleur.

## 7. Cas limites

| Situation | Comportement |
|---|---|
| Aucun objectif nutritionnel défini | Pas de carte (rien à combler). |
| Écart < 10 % de la cible | Pas de carte (D6). |
| Budget calorique déjà dépassé | Pas de carte, même si un macro manque (D6). |
| Aucun aliment ne comble l'écart en 10–400 g | Carte affichée avec un message explicite, pas de disparition muette. |
| Aliment sans valeur pour le macro visé (`null`) | Écarté du vivier — on ne peut pas scorer une donnée absente. |
| Écart de 0 g | Aucun macro sélectionnable → pas de carte. |
| Journal vide | La carte peut apparaître (l'écart vaut la cible entière) — c'est utile en début de journée. |
| Hors-ligne | Fonctionne à l'identique. |

## 8. Definition of Done

- [ ] Brique de score **pure et testée** dans `packages/shared`, y compris les cas d'écartement.
- [ ] Carte conditionnelle dans le journal + ajout en un tap.
- [ ] i18n FR + EN, mention de la limite « régime non pris en compte ».
- [ ] `npm run lint`, `npm run typecheck`, `npm run test` verts.
- [ ] Roadmap 4.37 → ✅ (ou 🟡 si la recette device reste à faire).

## 9. Critères d'acceptation (recette device)

1. Journée avec un manque de protéines net : la carte apparaît et propose 3 aliments plausibles.
2. Les quantités sont **réalistes** (aucun « 900 g », aucun « 8 g »).
3. L'apport calorique de chaque suggestion est affiché.
4. Un tap ajoute bien l'entrée au journal, à la quantité annoncée.
5. Basculer sur un autre macro change les suggestions.
6. Journée en dépassement calorique : **aucune carte**, même avec un macro manquant.
7. Journée à l'équilibre (< 10 % d'écart) : aucune carte.
8. Un aliment récemment consommé est privilégié à densité comparable.
8bis. ✅ **Sans objet depuis le 12/08/2026** — le repli sur la base est livré, la question ne se pose
   plus. **À vérifier à sa place** : sur un **compte neuf, journal vide et aucun aliment récent**,
   la carte propose bien des aliments (elle n'en proposait aucun avant). Et après avoir basculé de
   macro (protéines → glucides → lipides), la liste **reste peuplée** dans les trois cas.
9. La limite « ne tient pas compte du régime déclaré » est visible.
10. En mode avion : la carte fonctionne à l'identique.
