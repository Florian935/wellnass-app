---
id: MUSC-F14
titre: "Suggestion de substitution d'exercice"
roadmap: [3.52]
catalogue: []
etape: recette
branche: feature/muscf14-substitution-exercice
maj: 29/07/2026
---

# US MUSC-F14 — Suggestion de substitution d'exercice

> **3 décisions produit arbitrées par Florian le 29/07/2026**, dont **une non réalisable en l'état** —
> voir §0.2. Roadmap **3.52** (P2, ~4 h).
>
> **Vérifié avant d'écrire** : le **remplacement en direct existe déjà** (3.32, `replaceExercise` +
> écran `/exercises?replaceExerciseId=`), et surtout **`exercise_variants` existe** (MUSC-F10c-2) avec
> `useExerciseVariants` déjà écrit. Ce qui manquait, c'est uniquement la **suggestion**.

## 0. Deux limites à énoncer avant tout

### 0.1 « Zone douloureuse » n'est pas traitable — et c'est structurel

Le backlog évoquait deux motifs : « matériel pris » **ou** « zone douloureuse ». Seul le premier est
traitable.

Nous n'avons en base **ni information articulaire, ni schéma de mouvement** (poussée / tirage,
dominance hanche ou genou). `exercises` porte un groupe musculaire principal, des muscles secondaires
et un matériel — rien qui permette d'affirmer qu'un exercice « ménage l'épaule ».

Prétendre y répondre produirait un **conseil de santé sans fondement**, présenté comme fiable. C'est
la première fois qu'une fonctionnalité de l'app affirmerait quelque chose qu'elle ne sait pas, et sur
un sujet où l'erreur blesse. **Décision D1 : les suggestions sont neutres**, sans motif demandé et
sans promesse. Un test vérifie qu'aucun vocabulaire de douleur n'apparaît dans le rendu.

### 0.2 L'éditeur de programme n'a pas de « remplacer » — la décision D3 est sans objet pour lui

Florian a demandé les suggestions **en séance et dans l'éditeur de programme**. Après vérification,
`SessionEditor` **n'expose que « ajouter » et « retirer »** : il n'existe aucun parcours de
remplacement, donc **aucun exercice source** à partir duquel suggérer.

Ce qui a été livré : **la séance uniquement**, là où le remplacement existe.

Deux suites possibles, au choix :

1. **Ajouter le remplacement dans l'éditeur de programme** (US distincte : c'est une fonctionnalité
   en soi, pas une suggestion) — les suggestions s'y brancheraient alors sans code supplémentaire,
   le composant et le hook étant déjà génériques.
2. **En rester là** : l'éditeur permet déjà de retirer puis d'ajouter, et l'utilisateur n'y est pas
   sous contrainte de temps — contrairement à la séance, où la machine est occupée maintenant.

## 1. Décisions

| # | Question | Décision | Pourquoi |
|---|---|---|---|
| **D1** | Motif de substitution | **Aucun motif demandé, suggestions neutres** | Voir §0.1. « Matériel pris » est traitable, « zone douloureuse » ne l'est pas avec nos données. On ne prétend pas |
| **D2** | Surface | **Section « Suggestions » en tête** de l'écran de remplacement existant | L'écran fonctionne déjà ; on l'enrichit sans créer un second parcours. La liste complète reste accessible en dessous — la suggestion **propose**, elle n'impose pas |
| **D3** | Étendue | **Séance uniquement** (l'éditeur de programme demandé n'a pas de remplacement — §0.2) | Livrer une suggestion sans exercice source n'aurait aucun sens |
| **D4** | Priorité | *Dérivée.* **Variante déclarée > suggestion calculée**, toujours | Une variante déclarée est une donnée saisie par un **humain** (éditeur ou utilisateur) : elle prime sur n'importe quel score. Le calcul ne fait que compléter quand les variantes manquent |
| **D5** | Exercices archivés | *Dérivée.* **Jamais suggérés** | Nuance avec ADMIN-01 : afficher le **nom** d'un exercice archivé dans un historique est nécessaire ; le **proposer** ne l'est pas |

## 2. Périmètre

**Dans le périmètre** : brique de classement **pure et testée**, requête de candidats, section
« Suggestions » en tête de l'écran de remplacement, i18n FR + EN.

**Hors périmètre, explicitement**

- **Tout motif médical** (D1) et toute promesse articulaire.
- **L'éditeur de programme** (§0.2), faute de parcours de remplacement.
- **L'apprentissage des préférences** (« tu choisis souvent celui-là ») → post-V1, demanderait un
  historique de substitutions qui n'existe pas.
- **Le matériel réellement disponible** en salle : l'app ne sait pas ce qui est libre. Le bonus
  « matériel différent » est une heuristique, pas une connaissance.

## 3. Comportement

- Depuis une séance active → « Remplacer » sur un exercice → l'écran de remplacement affiche une
  section **Suggestions** au-dessus de la liste complète.
- **Au plus 4 suggestions.** Au-delà, la liste complète prend le relais — une suggestion de 12 lignes
  n'est plus une suggestion.
- Chaque ligne porte une **justification factuelle** : « Variante » (déclarée) ou le **matériel**
  (« Machine guidée »). Jamais d'interprétation.
- Un tap remplace l'exercice, exactement comme depuis la liste complète.
- **Aucune suggestion pertinente → aucune section.** Pas de bloc vide, pas de suggestion forcée.
- Une note rappelle la portée réelle : *« Même groupe musculaire. À toi de juger ce qui convient
  aujourd'hui. »*

## 4. Modèle de données

**Aucune migration, aucune table, aucune sync rule.** Tout est calculé à partir de `exercises`
(groupe musculaire, matériel, muscles secondaires) et de `exercise_variants`, qui existent déjà.

## 5. Règles de calcul

Dans une brique **pure et testée** (`exercise-substitution.ts`) :

- **Exclusions** : l'exercice lui-même, et tout ce qui est **déjà dans la séance** (le proposer
  n'aurait aucun sens : il est déjà là).
- **Retenu si** : variante déclarée **ou** même groupe musculaire principal. Un exercice d'un autre
  groupe n'est pas une substitution, c'est un autre exercice.
- **Score** : variante déclarée (1000, domine tout) > même groupe (100) > matériel différent (20) >
  muscles secondaires communs (5 chacun).
- **Tri déterministe** : à score égal, l'ordre **alphabétique** tranche. Sans cela l'ordre dépendrait
  de celui des candidats en entrée, et un même résultat pourrait s'afficher différemment d'une fois à
  l'autre — ce qui se lit comme un bug.

## 6. i18n (FR + EN)

Namespace `substitution` : titre, mention « Variante », note de portée. Les noms de matériel
réutilisent les clés `equipment.*` existantes.

## 7. Accessibilité

Chaque suggestion porte un `accessibilityLabel` qui **inclut sa justification** (« Développé machine,
Machine guidée ») : le nom seul ne dirait pas pourquoi il est proposé. Cibles ≥ 52 dp.

## 8. Offline

**Tout est local** : les candidats viennent de la base SQLite, le classement est pur. Aucun appel
externe — conformément à la roadmap (« sélection déterministe, aucun appel externe »).

## 9. Cas limites

| Situation | Comportement |
|---|---|
| Aucun exercice du même groupe | **Aucune section** — on ne bricole pas une suggestion hors sujet. |
| Tous les candidats déjà dans la séance | Aucune section. |
| Variante déclarée d'un **autre** groupe musculaire | **Retenue quand même** : si un humain a lié les deux, on ne remet pas cette information en cause. |
| Exercice archivé (ADMIN-01) | **Jamais suggéré** (D5). |
| Exercice sans traduction | Écarté — on ne propose pas une ligne vide. |
| Plus de 4 candidats | Bornés à 4, les meilleurs d'abord. |
| Muscles secondaires non renseignés | Ignorés dans le score, aucun plantage. |
| Hors-ligne | Fonctionne à l'identique. |

## 10. Definition of Done

- [x] Brique `exercise-substitution.ts` **pure et testée** — **13 tests**, dont le déterminisme.
- [x] Requête de candidats bornée au groupe musculaire + variantes déclarées.
- [x] Section « Suggestions » en tête de l'écran de remplacement (**6 tests** de composant).
- [x] i18n FR + EN.
- [x] **Aucune migration, aucune sync rule** — vérifié.
- [x] `npm run lint` (0 erreur), `npm run typecheck` (0 erreur), `npm run test` (**1305**) verts.
- [x] Roadmap 3.52 → 🟡 (recette device à faire).
- [ ] Recette device (8 critères ci-dessous).
- [ ] **Décision attendue de Florian** sur la suite pour l'éditeur de programme (§0.2).

## 11. Critères d'acceptation (recette device)

1. En séance, « Remplacer » sur un exercice : une section **Suggestions** apparaît au-dessus de la
   liste, avec au plus 4 propositions.
2. Toutes les suggestions travaillent le **même groupe musculaire** (sauf variante déclarée).
3. Une **variante déclarée** de l'exercice apparaît **en premier**, marquée « Variante ».
4. Les autres portent leur **matériel** en justification.
5. Taper une suggestion **remplace** l'exercice, comme depuis la liste complète.
6. Un exercice **déjà dans la séance** n'est jamais suggéré.
7. Sur un exercice sans alternative du même groupe : **aucune section** (et non une section vide).
8. **Aucune mention de douleur, de blessure ou d'articulation** nulle part — c'est volontaire (D1).
