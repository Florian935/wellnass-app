# Maquettes — Refonte de l'accueil (ACCUEIL-01 → 06)

Six planches sur un canvas Claude Design, validées par Florian le **09/09/2026**.

| Fichier | Planche |
|---|---|
| `Avant.dc.html` | L'accueil **actuel**, coté (taux de remplissage par carte) |
| `Main.dc.html` | Après — le matin, 7:15 (planche d'entrée du canvas) |
| `ApresSoir.dc.html` | Après — le soir, 22:10 |
| `ApresSeance.dc.html` | Après — séance en cours, **thème sombre** |
| `Zones.dc.html` | Les cinq zones + le budget de hauteur |
| `Formes.dc.html` | Les formes de la grille, avant / après |
| `canvas.json` | Disposition des planches, annotations, vue d'ouverture |
| `Refonte-accueil-analyse.pdf` | Le compte rendu d'analyse (10 pages, 20 défauts) |

## Ce qui n'est pas versionné

Le fichier **`accueil-fittrio.html`** (~2,5 Mo) n'est **pas** commité : c'est le canvas assemblé,
qui embarque l'éditeur Claude Design en entier. Il est **régénérable** à tout moment depuis les
`.dc.html` ci-dessus, qui sont les vraies sources.

Cohérent avec le reste de `design/` : les autres dossiers ne contiennent qu'une maquette HTML
autonome de quelques kilo-octets, jamais un payload d'éditeur.

## Cotes de référence

Toutes les mesures des planches et du compte rendu sont données sur le **cadre de référence du
projet — 392 × 812** (`design/design-system.md`), avec le `padding: 20` de `Screen` et
`GRID_GAP = 12`, donc `colW = 170` et une demi-case à **79 px**.

Sur un appareil réel plus large (Pixel 7, 412 dp), `colW` vaut 180 et les hauteurs augmentent
d'environ 6 % ; les **ratios** — qui portent tout le constat — sont inchangés.
