# Le Labo, carrefour des piliers (toile Claude Design)

26/09/2026 · Exploration. **Décisions Q1 à Q8 tranchées par Florian le 30/09/2026, chantier livré
le même jour en une vague** : [LIENS-01](../../docs/specs/functional/us/liens01-registre-liens.md),
[LABO-02](../../docs/specs/functional/us/labo02-croiser.md), [LABO-03](../../docs/specs/functional/us/labo03-fiche-lien.md),
[ECHO-01](../../docs/specs/functional/us/echo01-echos-liens.md), [LABO-04](../../docs/specs/functional/us/labo04-apprendre.md)
— en recette ([RECETTES.md](../../RECETTES.md) §89). Écarts entre la toile et le code : voir le dernier § de
chaque spec (Q8 a été tranché « tout le chantier avant le Play Store », pas seulement LIENS-01).

- Toile en ligne (privée, à partager depuis son menu Partager) :
  https://claude.ai/artifact/JGyxPAdghwAxwHTyBZWwgz
- Point de départ : l'idée de Florian (26/09) d'avoir **un seul endroit** où voir toutes les
  données croisées des piliers activés, et que cet endroit soit le Labo.
- Antécédents : [LABO-01](../../docs/specs/functional/us/labo01-labo.md) (le Labo actuel, en
  recette), [analyse-labo-2026-09.md](../../docs/product/analyse-labo-2026-09.md),
  [design/labo-2026-09/](../labo-2026-09/) (direction « les disques »).

## La proposition en bref

Le Labo devient la **maison de tous les croisements**. Il passe à trois onglets, comme les hubs :
**Croiser · Composer · Apprendre**.
- Chaque croisement a une **fiche**, formulée comme une question (« Manges-tu assez pour ta
  muscu ? »).
- Chaque fiche porte un des **quatre états** : garde-fou, à régler, ça tient, à découvrir.
- Les piliers n'en gardent qu'un **écho**.
- Deux choses restent en place : les **mécaniques** (bonus de séance, dépense comptée dans la
  cible, réservoir) et les **garde-fous** (planning, séance du jour).
- Sous le capot, un **registre unique des liens** (LIENS-01). Il supprime les contradictions
  relevées : 6 seuils pour « déficit + entraînement », 2 remèdes opposés aux jambes lourdes.

## Contenu

| Rangée | Planches | Ce qu'elles montrent |
|---|---|---|
| 1 · Constat | `Constat` | Où vivent les croisements aujourd'hui (~20 écrans), cinq contradictions, trois verrous (doctrine « porte en plus », ADR-007, Insights) |
| 2 · Tour 1 | `P1Carte` … `P5Questions`, `Tour1Grille` | Cinq pistes : carte des disques, fil, tableau croisé, semaine tressée, grandes questions. Chacune notée sur sept critères |
| 3 · Tour 2 | `Tour2Archi`, `Anatomie` | Trois découpages du Labo (le V2 à trois onglets est retenu), la carte d'un lien pièce par pièce, les quatre états |
| 4 · Tour 3 | `Main` (prototype jouable), `L1` … `L12` | L'onglet Croiser, une zone touchée, quatre fiches, la feuille « ce qui change », garde-fou, 2 piliers, 1 pilier, compte neuf, Apprendre |
| 5 · Échos | `E1Muscu` … `E4Planning` | Ce qui reste dans les hubs, sur l'accueil et dans le planning |
| 6 · Doctrine | `Doctrine` | Sept règles, ce qui déménage et ce qui reste, les neuf fiches et le catalogue, l'amendement d'ADR-007, la feuille de route (5 US), les **décisions Q1 à Q8** |

Les planches `L*` importent le prototype (`<dc-import name="Main" …>`) dans une situation donnée :
il n'y a qu'une seule source. `canvas.json` décrit la disposition de la toile.

## À savoir

- **Données fictives** : jeudi 24/09/2026, 72,4 kg, un 10 km le 15/11, force à garder, cible de
  maintien. Chaque chiffre correspond à un moteur qui **existe déjà**. Aucune projection d'allure
  n'est affichée (LABO-01 R1).
- **Non couverts** : thème sombre, grandes polices, TalkBack, textes EN, rendu 3D de la carte (ici
  une vue du dessus en 2D), essai sur téléphone.
- **La toile en ligne reste la référence.** Pour l'ouvrir en local, servir le dossier en HTTP avec
  le `support.js` de Claude Design à côté des fichiers (voir [design-system.md](../design-system.md)).
