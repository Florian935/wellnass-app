# CARDIO-UX03 — Hub Course en trois onglets (toile Claude Design)

Maquette de l'US produite le **25/09/2026**, après l'exploration **Course — partir d'abord**
(https://claude.ai/artifact/PxNU7GfyTcEZz1Ba7t9RhD), où Florian a retenu la proposition **A**
« Partir, puis se souvenir » et répondu aux questions Q1 à Q10.

- Toile en ligne (privée, à partager depuis son menu Partager) :
  https://claude.ai/artifact/JjUraxv9AYkC6vyVUsfzHW
- Spec : [docs/specs/functional/us/cardio-ux03-hub-onglets.md](../../docs/specs/functional/us/cardio-ux03-hub-onglets.md)
- Plan : [docs/plans/cardio-ux03-hub-onglets.md](../../docs/plans/cardio-ux03-hub-onglets.md)

## Contenu

| Planche | Fichier | Ce qu'elle montre |
|---|---|---|
| Prototype jouable | `Main.dc.html` | Le hub complet. Bande « Simuler » : séance prévue, repos, en cours, sortie finie, débutant |
| Séance du jour | `T1Prevue.dc.html` | La carte du jour, « la dernière fois » en pastilles de fractions, Partir, dernières sorties, Recourir |
| Sortie finie | `T2Arrivee.dc.html` | Distance, séance validée, fractions dans la plage, Voir l'analyse, Partager |
| Jour de repos | `T3Repos.dc.html` | Course libre et Planning ; les dernières sorties juste dessous |
| Course en cours | `T4EnCours.dc.html` | Reprendre, seul |
| Premiers pas | `T5Debut.dc.html` | Choisir un programme, l'allure de référence à donner |
| Écran de départ | `D1Depart.dc.html` | Titré du type de la séance, mode retenu, fantôme proposé |
| Historique | `H1Historique.dc.html` | Calendrier du mois et liste des sorties, Recourir en icône |
| Par type | `H2ParType.dc.html` | La dernière sortie de chaque type ; un appui filtre la liste |
| Détail | `H3Detail.dc.html` | L'analyse d'une sortie : chiffres, « Recourir cette sortie », fractions, km par km |
| Progrès | `G1Progres.dc.html` | Les cartes de CARDIO-UX02 et « Toutes tes stats » |

Les planches figées importent le prototype (`<dc-import name="Main" …>`) avec une situation donnée :
une seule source, pas de copie à tenir à jour.

Données fictives : programme « 10 km en 8 semaines », semaine 3 sur 8, course objectif le dimanche
08/11/2026 ; nous sommes le vendredi 25/09/2026, jour de fractionné (6 × 400 m).

## Ouvrir en local

Comme les autres toiles : servir le dossier en HTTP avec le `support.js` de Claude Design à côté des
fichiers (voir [design/design-system.md](../design-system.md)). La toile en ligne reste la référence.
