# Le Labo — maquettes d'exploration (version 2)

14/09/2026 · Exploration, **non validée pour implémentation**.
Analyse complète : [docs/product/analyse-labo-2026-09.md](../../docs/product/analyse-labo-2026-09.md).

La v2 répond au retour de Florian sur la v1 : « labo » au **sens figuré** — l'endroit où l'on compose
et croise tous ses piliers activés — et la **DA de l'app** au lieu de l'imagerie chimie (fioles,
ballon, alambic), archivée dans [v1-chimie/](v1-chimie/).

## Contenu

| Fichier | Rôle |
|---|---|
| `Main.dc.html` | Compte rendu v2 (planche longue, 11 sections) |
| `Labo` · `Composer` · `Croisement` · `Projection` · `Levier` | Rangée 1 — composer (`Composer` est cliquable) |
| `Croiser` · `Carte` · `Experience` · `Cycle` | Rangée 2 — croiser et tester (`Croiser` est cliquable) |
| `Bilan` · `Decouvertes` · `Assistant` · `Coach` · `UnPilier` | Rangée 3 — retenir, et entrer autrement |
| `canvas.json` | Disposition de la toile |
| `labo-fittrio.html` | Toile assemblée par `/design` (générée, ne pas éditer : régénérer depuis les `.dc.html`) |
| `prototype/` | **Le Labo utile, sur les disques v2 en 3D** : `labo-paillasse-3d.html`, `donnees.js` (semaine, propositions, enquêtes, acquis du personnage), `moteur.js` (règles, projections), `scene.js` (three.js), `app.js` (interface et repli 2D), `three.min.js` (r128 embarqué) |
| `directions/` | Toile « La triade en tenue de sport » : directions visuelles, choix des disques v2 (voir son README) |
| `v2-triade-spheres/` | Prototype 3D précédent (sphères abstraites), remplacé par les disques le 15/09 |
| `v1-chimie/` | Première version (fioles), écrans et prototype, hors de la toile |

## À savoir

- **Données fictives** : un personnage hybride (objectif 10 km sous 48 min le 15/11, SBD 372 kg,
  77,6 kg). Les codes d'analyses cités (MR-08, FUEL-01…) existent ; les règles du prototype sont
  **inspirées** du catalogue, pas calculées par lui.
- **Charte** : tokens de `apps/mobile/src/theme/colors.ts` et `stage.ts`. En haut, une scène qui
  mêle les dégradés des trois piliers (bordeaux `#6b0028`, bleu `#2a64ad`, vert `#3a5622` sur
  `#1c150e`) ; dessous, le papier crème `#f7eede`. La **triade** (un cercle par pilier, variantes
  lumineuses `#e07a98` / `#6fa8ef` / `#a9ba7e`, socle `#e0b155` en anneau) est l'image du Labo ; la
  **lentille** (deux cercles qui se chevauchent) est l'icône de tout croisement.
- **Les écrans sont générés** par des scripts node (briques communes : scène, triade, lentille,
  puces de pilier), puis contrôlés un par un dans Chrome headless ; débordements corrigés. Thème
  sombre des écrans crème, grandes polices et TalkBack **non maquettés**.
- **Prototype, version « utile » (15/09/2026)** — retour de Florian : le Labo ne doit pas être un
  joujou, il faut une vraie raison d'y venir. Le prototype part donc du **réel** et s'organise en
  quatre onglets :
  - **Semaine** : la semaine en cours (fait / prévu, pilier par pilier), ce que le Labo y voit
    (collision jambes → fractionné, protéines basses, nuit courte), un geste par point, puis la
    feuille « Ce qui change dans ton plan » avant d'appliquer. Les objectifs au 15/11 bougent avec.
  - **Composer** : les leviers, chaque cran chiffré sur les trois objectifs, « le réglage le plus
    rentable » (jamais un déficit plus creusé), puis appliquer la v3 ou la simuler sur 8 semaines.
  - **Pourquoi ?** : quand une courbe cale (squat, 800 m, poids), les causes classées par force dans
    les données de tous les piliers, ce qui est écarté, et une expérience pour trancher (ou un rappel,
    jamais une restriction calorique).
  - **Acquis** : ce que le Labo a appris du personnage (vérifié, solide, probable, pas de lien),
    les expériences en cours au verdict scellé, et **à quoi sert** chaque acquis dans l'app.
  La scène suit l'onglet : en semaine, les disques prévus deviennent du caoutchouc translucide cerclé
  de pointillés, la lice garde allumés les kilomètres courus, l'anneau tourne pour amener la lampe du
  jour devant ; en enquête, la caméra s'approche des piliers en cause. Atmosphère ajoutée : lumières
  floues de salle, cône de lumière et poussière, halo lumineux et grain (coupés si le téléphone ne
  suit pas), son sourd quand un disque se pose.
- **Prototype (15/09/2026, première passe 3D)** : les disques v2 (direction retenue par Florian) en 3D réaliste. Un
  podium de salle (sol en granulés, anneau de laiton) porte trois objets qui flottent et y projettent
  leur ombre : une **pile de disques de fonte** en caoutchouc et insert acier (un disque par séance,
  « SÉANCE n » moulé sur la face), une **piste d'athlétisme** (couloirs, gazon, haies, kilomètres
  peints, lumières de pacing sur la lice, orange pour le fractionné), une **assiette compartimentée**
  (saumon grillé, riz, brocolis, tomates, citron) dont les portions suivent la balance calorique.
  Le socle : **sept lampes-lunes** serties dans l'anneau (nuits). Les croisements sont des
  **médailles** (or = synergie, bronze = tension, corail = garde-fou) dont le ruban porte les couleurs
  des deux piliers ; le garde-fou fait passer le liseré du podium au rouge. Tout est procédural
  (profils tournés, textures dessinées), sans fichier 3D externe.
- **Repli** : si WebGL ou la bibliothèque 3D manque, **les disques en 2D** (dessin de la toile
  directions, page 2) s'affichent d'eux-mêmes, avec la cause, un code (`lib`, `webgl`, `renderer`,
  `lost`, `scene`) et « Réessayer la 3D ». Son et voix démarrent au premier geste ; « Vue sobre »
  masque la scène ; en mouvement réduit, les transitions sont instantanées. Testé dans Chrome (rendu
  logiciel, cadre de 390 px et bureau ; composer, tension, garde-fou, cycle, bilan ; avec et sans
  WebGL) — **pas encore sur un vrai téléphone**. La première version n'avait pas démarré sur le
  Pixel 6a de Florian (cause non identifiée).
- **Piège de contrôle** : sous Windows, Chrome headless impose une largeur de fenêtre minimale
  d'environ 485 px ; une capture à 390 px coupe la page sans qu'elle déborde. Vérifier la largeur
  téléphone dans une `iframe` de 390 px.
