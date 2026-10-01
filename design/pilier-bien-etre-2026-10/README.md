# Pilier Bien-être — analyse et maquettes (toile Claude Design)

Toile produite le **26/09/2026** à la demande de Florian (« est-ce que ce serait pas intéressant d'avoir
un pilier bien-être ? »), republiée le 30/09/2026 après un changement de compte. Florian a tranché les
huit décisions **le 01/10/2026** (D1 pilier activable, D2 le Labo garde son onglet, D3 la nuit lue dans
Health Connect, D4 deux moments, D5 à D8 selon la recommandation) et demandé **les six lots en une
seule vague**.

- Toile en ligne (privée, à partager depuis son menu Partager) :
  https://claude.ai/artifact/Uj3su2fdPF9reGM62MFkeN
  (l'ancien lien `RXjpVwfq…` est mort avec l'ancien compte).
- Specs : [BIEN-02](../../docs/specs/functional/us/bien02-pilier-bien-etre.md) (chapeau, décisions) ·
  [BIEN-03](../../docs/specs/functional/us/bien03-checkin-deux-temps.md) ·
  [BIEN-04](../../docs/specs/functional/us/bien04-boucle.md) ·
  [BIEN-05](../../docs/specs/functional/us/bien05-ce-qui-compte.md) ·
  [BIEN-06](../../docs/specs/functional/us/bien06-nuit-health-connect.md) ·
  [BIEN-07](../../docs/specs/functional/us/bien07-modules.md)
- Recette : [RECETTES.md](../../RECETTES.md) §90.

## Contenu

| Planche | Fichier | Ce qu'elle montre |
|---|---|---|
| 00 · Synthèse | `Main.dc.html` | La recommandation en une page : un pilier activable, deux moments, la boucle |
| 01 · Ce qu'on a déjà | `Existant.dc.html` | BIEN-01, la nuit (LABO-01), douleurs, cycle, pas, score de forme — éparpillés |
| 02 · Les indicateurs | `Indicateurs.dc.html` | 33 indicateurs passés au crible : socle, ajout, module, plus tard, non |
| 03 · Les croisements | `Croisements.dc.html` | Ce que l'état du jour change à chaque pilier, et la méthode (cas, seuils, pistes écartées) |
| 04a · Le check-in du matin | `Checkin.dc.html` | Nuit, qualité, énergie, envie, étiquettes, rattrapage de la veille |
| 04b · Aujourd'hui | `Aujourdhui.dc.html` | Forme du jour, check-ins, ce que ça change, nuits, suivis |
| 04c · Journal | `Journal.dc.html` | Le mois en couleurs, les jours et ce que les piliers ont fait |
| 04d · Ce qui compte | `Liens.dc.html` | Les croisements — devenus un lien du Labo + un écho (voir la note ci-dessous) |
| 04e · Le contexte dans une sortie | `Contexte.dc.html` | La ligne « ce jour-là » d'un bilan |
| 05 · Prototype — un matin | `Proto.dc.html` | Jouable : nuit courte, check-in, la séance qui s'allège |
| 06 · Face au marché | `Marche.dc.html` | Whoop, Oura, Garmin, Fitbit, Bearable, Daylio — tous lisent l'état du jour, aucun ne le relie à la séance réelle |
| 07 · Garde-fous | `GardeFous.dc.html` | Humeur basse, données de santé, pas de diagnostic, pas de culpabilité |
| 08a · Décisions | `Decisions.dc.html` | D1 à D8 avec leur recommandation (avant les réponses de Florian) |
| 08b · Découpage | `Decoupage.dc.html` | Six lots, du plus sûr au plus ambitieux |

## Ce qui a changé entre la toile et le code

- **D2 renversée par Florian** : la planche recommandait de plafonner la barre à cinq onglets ; le Labo
  **garde** son onglet (six destinations, libellés plus petits).
- **D1 précisée** : « PILLARS passe de 3 à 4 » (planche 08a) n'a **pas** été fait — le pilier est
  activable pour l'utilisateur mais reste un drapeau à part dans le code (spec BIEN-02 §3).
- **« Ce qui compte »** : la planche 04d montre les croisements dans l'onglet du pilier ; depuis le Labo
  carrefour (30/09/2026), ils sont **un lien du Labo** et l'onglet n'en garde que l'écho (spec BIEN-05 §1).

## Ouvrir en local

Comme les autres toiles : servir le dossier en HTTP avec le `support.js` de Claude Design à côté des
fichiers (voir [design/design-system.md](../design-system.md)). La toile en ligne reste la référence.
