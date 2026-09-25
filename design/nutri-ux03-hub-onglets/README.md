# NUTRI-UX03 — Hub Nutrition en trois onglets (toile Claude Design)

Toile produite le **25/09/2026** : l'analyse du hub Nutrition (les questions de quelqu'un qui note ce
qu'il mange, et ce que le hub y répondait), puis trois variantes en onglets sur les mêmes données.
Florian a retenu **B — Aujourd'hui · Historique · Progrès** le jour même, avec ses réponses aux
questions Q1 à Q8 ; les planches B ont été mises à jour avec ces décisions.

- Toile en ligne (privée, à partager depuis son menu Partager) :
  https://claude.ai/artifact/2nD3MciUjRVAxQX6ud5D3i
- Spec : [docs/specs/functional/us/nutri-ux03-hub-onglets.md](../../docs/specs/functional/us/nutri-ux03-hub-onglets.md)
- Plan : [docs/plans/nutri-ux03-hub-onglets.md](../../docs/plans/nutri-ux03-hub-onglets.md)

## Contenu

| Planche | Fichier | Ce qu'elle montre |
|---|---|---|
| Prototype jouable | `Main.dc.html` | Bande « Simuler » : variante (Actuel, A, B, C), heure (8 h, 12 h 40, 20 h), compte neuf |
| Le hub aujourd'hui | `NowMidi`, `NowMenu`, `NowHier`, `NowSemaine` | L'existant, avec quatre repères numérotés (menu ⋯, bascule sur un jour passé, planning en bas, onglets sous la scène) |
| B · Aujourd'hui | `BMidi` (tout l'onglet), `BMatin` (journée vide), `BSoir` (dîner prévu) | Reprendre un repas, Comme hier, J'ai mangé ça |
| B · Historique | `BHistJours`, `BHistRepas` | Le calendrier en verres remplis selon la cible (Q2), les jours, les repas habituels (Q4) |
| B · Un jour | `BJour`, `BJourVide` | La page d'un jour passé : reprendre un repas ou la journée, compléter un oubli |
| B · Progrès | `BProgres` | La semaine renommée |
| B · Bibliothèque | `BBiblio` | Recettes, repas types, favoris, repas de la journée |
| B · Compte neuf | `BNeuf` | Le premier jour |
| B · Repas type | `BNomType` | Le nom saisi, obligatoire (Q6) |
| A | `AMidi`, `AHier`, `AProgres` | Deux onglets, la navigation par jour conservée |
| C | `CJournal`, `CRepas` | Journal · Mes repas · Progrès |

Le compte rendu (questions, diagnostic, variantes, recommandation, questions Q1–Q8, décisions) est
porté par les notes de la toile.

Les planches figées importent le prototype (`<dc-import name="Main" …>`) dans une situation donnée :
une seule source, pas de copie à tenir à jour.

Données fictives : vendredi 25/09/2026, cible 2 400 kcal, jour de séance.

## Ouvrir en local

Comme les autres toiles : servir le dossier en HTTP avec le `support.js` de Claude Design à côté des
fichiers (voir [design/design-system.md](../design-system.md)). La toile en ligne reste la référence.
