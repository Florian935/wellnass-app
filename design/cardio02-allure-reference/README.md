# CARDIO-02 — Les quatre portes vers l'allure de référence (toile Claude Design)

Maquette de l'US produite le **23/10/2026**, avec la spec et le plan, **à valider** par Florian ou
Damien.

- Toile en ligne (privée, à partager depuis son menu Partager) :
  https://claude.ai/artifact/JR2N3eLrm1HJsJzn3DXWGm
- Spec : [docs/specs/functional/us/cardio02-allure-reference.md](../../docs/specs/functional/us/cardio02-allure-reference.md)
- Plan : [docs/plans/cardio02-allure-reference.md](../../docs/plans/cardio02-allure-reference.md)

## Contenu

| Planche | Fichier | Ce qu'elle montre |
|---|---|---|
| Prototype jouable | `Main.dc.html` | Tout le parcours. Bande « Simuler » : Neuf (l'accueil), Premiers pas, Séance, Profil, Test ; pendant le test, le chrono (7:42, 9:40, 11:20, 12:40) |
| Accueil 1/3 | `A1Objectif.dc.html` | Ce que tu vises : objectif et sorties par semaine |
| Accueil 2/3 | `A2Allure.dc.html` | Les portes, sans « Le faire maintenant » ; aperçu d'un 10 km en 52:30 |
| Accueil 3/3 | `A3Voix.dc.html` | Trois choix de voix, « Terminer » |
| Premiers pas | `H1PremiersPas.dc.html` | La carte du hub sans programme : « La donner » ouvre les portes |
| Séance du jour | `H2Seance.dc.html` | La séance sans allure cible gagne la même ligne « La donner » |
| Chrono | `P1Chrono.dc.html` | Distance en pastilles, temps, aperçu des quatre allures |
| Test | `P2Test.dc.html` | « Le faire maintenant » : le protocole et « Lancer le test » |
| Allure connue | `P3Connue.dc.html` | Changer une allure existante : « Avant : 5:20 » |
| Je ne sais pas | `P4NeSaisPas.dc.html` | Rien à saisir, ce qui se passera ensuite |
| Hors bornes | `P5HorsBornes.dc.html` | Un 5 km en 1:20:00 : plus lent que 12:00 /km, bouton inactif |
| Meilleurs temps | `P6Records.dc.html` | Les pastilles de meilleurs temps remplissent la porte |
| Profil coureur | `R1Profil.dc.html` | La carte en tête : valeur, provenance, quatre allures, « Changer » ; plus de « Retour » |
| Départ du test | `T1Depart.dc.html` | Titré « Test de 12 minutes », GPS imposé, protocole |
| En course | `T2EnCours.dc.html` | Le bandeau « reste 4:18 » |
| 12:00 passées | `T3Termine.dc.html` | « Test terminé · Tu peux ralentir » |
| Arrivée | `T4Resultat.dc.html` | 2 400 m → 5:14 /km, aperçu, « Retenir cette allure » |
| Incomplet | `T5Incomplet.dc.html` | Arrêté à 9:40 : pas d'allure |

Les planches figées importent le prototype (`<dc-import name="Main" …>`) avec une situation donnée :
une seule source, pas de copie à tenir à jour. Les chiffres sont ceux du code (Riegel 1,06, bandes
de `sessionTargetPace`), recalculés par le prototype à chaque saisie.
