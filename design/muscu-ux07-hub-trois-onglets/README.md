# MUSCU-UX07 — Hub Musculation en trois onglets (toile Claude Design)

Maquette de l'US produite le **24/09/2026**, après un test utilisateur (le frère de Florian) et
l'exploration **Muscu — l'essentiel d'abord** (https://claude.ai/artifact/5sSWjgmMMoqJBAsExRLTtg),
où Florian a retenu la proposition B « trois portes » et demandé d'y reprendre des éléments de A si
nécessaire.

- Toile en ligne (privée, à partager depuis son menu Partager) :
  https://claude.ai/artifact/1i8j8mqA3SipkuKzTUYSAU
- Spec : [docs/specs/functional/us/muscu-ux07-hub-trois-onglets.md](../../docs/specs/functional/us/muscu-ux07-hub-trois-onglets.md)
- Plan : [docs/plans/muscu-ux07-hub-trois-onglets.md](../../docs/plans/muscu-ux07-hub-trois-onglets.md)

## Contenu

| Planche | Fichier | Ce qu'elle montre |
|---|---|---|
| Prototype jouable | `Main.dc.html` | Le hub complet. Bande « Simuler » : séance prévue, repos, en cours, faite, débutant |
| Séance du jour | `T1Prevue.dc.html` | La carte du jour avec « la dernière fois », Refaire, Autre chose, Ton programme |
| Jour de repos | `T2Repos.dc.html` | Carte de repos ; Refaire passe au premier plan |
| Séance en cours | `T3EnCours.dc.html` | « Reprendre » seul : Refaire et Autre chose sont masqués (R8) |
| Séance faite | `T4Faite.dc.html` | Tonnage, record battu, bilan et partage |
| Premiers pas | `T5Debut.dc.html` | Compte neuf : programmes suggérés |
| Aperçu | `P1Apercu.dc.html` | « Voir les 6 exercices » : objectifs, dernière fois, suggestions, « Première fois » |
| Historique | `H1Calendrier.dc.html` | Calendrier du mois et liste des séances avec Refaire |
| Par exercice | `H2ParExercice.dc.html` | La dernière fois de chaque exercice, avec recherche |
| Détail | `H3Detail.dc.html` | Détail d'une séance passée et « Refaire cette séance » |
| Alerte | `H4Alerte.dc.html` | Refaire pendant une séance en cours (R4) |
| Progrès | `G1Progres.dc.html` | Les cartes d'analyse et « Toute ta progression » |
| Mode | `M1Mode.dc.html` | « Mode classique · Changer » ouvre le choix, mode courant présélectionné (D4) |

L'accueil n'a pas de planche : il ne change pas (D5). Une première version de la toile proposait une
action rapide « Séance » ; elle a été retirée après la relecture de la spec, parce que la rangée est
plafonnée à quatre pastilles et que la carte du moment propose déjà Démarrer et Reprendre.

Pendant une séance, Historique et Progrès portent une ligne « Séance en cours · Reprendre » (D3) :
visible sur la planche `H4Alerte`, derrière l'alerte.

Les planches figées importent le prototype (`<dc-import name="Main" …>`) avec une situation donnée :
une seule source, pas de copie à tenir à jour.

Données fictives : programme Push Pull Legs, semaine 3 sur 8, jeudi 24/09/2026, jour de Push.

## Ouvrir en local

Comme les autres toiles : servir le dossier en HTTP avec le `support.js` de Claude Design à côté des
fichiers (voir [design/design-system.md](../design-system.md)). La toile en ligne reste la référence.
