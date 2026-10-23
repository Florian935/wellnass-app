# ACCES-IA — Prisme réservé aux testeurs (toile Claude Design)

Maquette de l'US produite le **23/10/2026** : l'écran back-office qui tient la liste des testeurs, et ce
que l'app montre — ou ne montre plus — selon qu'on est testeur ou non.

- Toile en ligne (privée, à partager depuis son menu Partager) :
  https://claude.ai/artifact/28oTXd2EK8pFvm2ZKXRyUZ
- Spec : [docs/specs/functional/us/acces-ia-testeurs.md](../../docs/specs/functional/us/acces-ia-testeurs.md)
- Plan : [docs/plans/acces-ia-testeurs.md](../../docs/plans/acces-ia-testeurs.md)

## Contenu

| Planche | Fichier | Ce qu'elle montre |
|---|---|---|
| Testeurs IA (jouable) | `Main.dc.html` | Bandeau du mode en service (réglage `mode` : testers / open / inconnu), ajout par e-mail, liste, retrait confirmé |
| Fiche utilisateur | `FicheUtilisateur.dc.html` | Le bloc « Bêta IA » entre Configuration et Modération, dans ses deux états |
| Journal d'audit | `Journal.dc.html` | Les deux actions nouvelles, « Ajout » et « Retrait d'un testeur IA » ; la cible est l'identifiant du compte, jamais son e-mail |
| Prototype app (jouable) | `App.dc.html` | Bande SIMULER : testeur, non-testeur, accord restant, retiré en session ; Accueil ⇄ Réglages par le bouton Réglages |
| Accueil · testeur | `AccueilTesteur.dc.html` | « Ta journée » avec « Prisme raconte » (inchangé depuis PRISME-01) |
| Accueil · non-testeur | `AccueilNonTesteur.dc.html` | Les faits seuls : rien de Prisme |
| Accueil · retiré en session | `AccueilRetire.dc.html` | Le geste dit « bêta fermée » ; tout disparaît au démarrage suivant |
| Réglages · testeur | `ReglagesTesteur.dc.html` | Section Prisme avec la ligne « Bêta fermée — tu fais partie des testeurs », Labo IA |
| Réglages · non-testeur | `ReglagesNonTesteur.dc.html` | Ni Prisme ni Labo IA : on passe du cycle au séquençage |
| Réglages · accord restant | `ReglagesOrphelin.dc.html` | La carte réduite au retrait de l'accord |

Les planches figées de l'app importent le prototype (`<dc-import name="App" …>`) avec une situation
donnée : une seule source.

Données fictives (comptes `@exemple.fr`, jeudi 23/10/2026, 19 h 12). Les couleurs du back-office sont
celles du thème existant (`apps/admin/src/theme.ts`) ; celles de l'app, la palette claire de
`apps/mobile/src/theme/colors.ts`.

## Ouvrir en local

Comme les autres toiles : servir le dossier en HTTP avec le `support.js` de Claude Design à côté des
fichiers (voir [design/design-system.md](../design-system.md)). La toile en ligne reste la référence.
