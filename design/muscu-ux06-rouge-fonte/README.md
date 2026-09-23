# MUSCU-UX06 — Couleurs du pilier Musculation (toile Claude Design)

Toile de comparaison produite le **23/09/2026** avec Claude Design, à la suite du retour de Florian :
« le pilier muscu est un peu trop rose », « le bordeaux n'est pas très adapté », « on ne voit pas assez
les contrastes en termes de cartes » (hub muscu et accueil).

- Toile en ligne (privée, à partager depuis son menu Partager) :
  https://claude.ai/artifact/UaQCWBJudfrG2sPXoba5co
- Spec : [docs/specs/functional/us/muscu-ux06-rouge-fonte.md](../../docs/specs/functional/us/muscu-ux06-rouge-fonte.md)

## Contenu

| Planche | Fichier | Ce qu'elle montre |
|---|---|---|
| Recommandation | `Main.dc.html` | La direction recommandée par l'agent (B, graphite + rouge) et ses valeurs à reporter |
| Séparation des cartes | `Separation.dc.html` | 5 paliers (L0 actuel → L4) sur le hub muscu et l'accueil, avec les rapports mesurés |
| État actuel | `DirActuel.dc.html` | Bordeaux + rose, la référence |
| **A · Rouge fonte** | `DirA.dc.html` | **Direction retenue par Florian le 23/09/2026** |
| B · Graphite + rouge | `DirB.dc.html` | Recommandation initiale de l'agent, écartée |
| C · Prune profonde | `DirC.dc.html` | Écartée |
| D · Acier bleuté + corail | `DirD.dc.html` | Écartée (accent clair ≈ celui de l'accueil) |
| Gabarits | `Hub`, `Classique`, `Immersif`, `Repos`, `Accueil` `.dc.html` | Les écrans réutilisés par les planches, paramétrés par une palette |

Chaque planche de direction montre six écrans : hub sombre, séance classique sombre, séance immersive,
repos immersif, hub clair, séance classique claire.

## Décision

**Florian a retenu A « Rouge fonte »** (23/09/2026), avec le palier de séparation montré sur la planche.
Écart assumé à l'implémentation : la carte sombre reste `#30271e` au lieu de `#342a20` (séparation
1,35:1 au lieu de 1,38:1), pour ne pas faire passer `borderStrong` sous 3:1 sur les cartes — détail
dans la spec, §3.

## Lire les fichiers

Les `.dc.html` sont des composants Claude Design : ils ne se rendent que dans la toile (le moteur
`support.js` est fourni par le type d'Artifact). `canvas.json` en donne la disposition.
