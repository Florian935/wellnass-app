# Carnet d'innovation — maquettes

13/09/2026 · Idéation, **non validée pour implémentation**.

Analyse complète et tri : [docs/product/analyse-innovation-2026-09.md](../../docs/product/analyse-innovation-2026-09.md) ·
idées consignées dans [IDEAS.md](../../IDEAS.md) (salve du 13/09/2026).

## Contenu

La planche est un canvas Claude Design : les sources sont les `.dc.html` et `canvas.json` ; la page
seedée (`carnet-innovation-fittrio.html`, ~2,5 Mo d'éditeur embarqué) est régénérée à partir d'eux et
n'est pas versionnée (voir `.gitignore`).

| Planche | Idée | Statut après le tri du 13/09/2026 |
|---|---|---|
| [Main.dc.html](Main.dc.html) | Compte rendu : constat, règles, banque de 38 idées, graphique, horizons, modèles, risques | ⚠️ **Version d'avant le tri** — elle liste encore les 38 idées |
| [Fantome.dc.html](Fantome.dc.html) | (18) Le Fantôme | retenue |
| [Reservoir.dc.html](Reservoir.dc.html) | (23) Le Réservoir | retenue, **glucides seulement** (décision du 13/09/2026, analyse §5) |
| [Meteo.dc.html](Meteo.dc.html) | (31) Météo intérieure | retenue |
| [Labo.dc.html](Labo.dc.html) | (7) Labo N=1 | retenue |
| [Leviers.dc.html](Leviers.dc.html) | (8) Carte des leviers | retenue |
| [Enquete.dc.html](Enquete.dc.html) | (5) L'Enquête | retenue |
| [Conseil.dc.html](Conseil.dc.html) | (6) Le Conseil des trois | retenue |
| [ImportPlan.dc.html](ImportPlan.dc.html) | (12) Colle ton plan | ❌ **retirée** |
| [VitesseBarre.dc.html](VitesseBarre.dc.html) | (27) Vitesse de barre à la caméra | ✅ **retenue → [BACKLOG](../../BACKLOG.md) VBT-01** ; essai technique d'abord (analyse §6.4) |
| [Survol.dc.html](Survol.dc.html) | (2) Survol 3D | retenue |

## Direction

Palette et typographies de l'app (`apps/mobile/src/theme/`) : crème `#f7eede`, surface `#fffaf2`,
cacao `#33291f`, terracotta `#b14f2b` ; thème sombre `#1c150e` / `#30271e` / accent `#dd6e40` pour les
écrans « live ». Bricolage Grotesque (titres, gros chiffres), Hanken Grotesk (corps), Space Mono
(chiffres). Couleurs de pilier reprises de `DEFAULT_MENU_COLORS`. Icônes SVG dessinées, sans emoji.

## Limites

Maquettes statiques (pas un prototype cliquable), **données fictives**. Le Survol 3D est une mise en
perspective CSS d'une carte dessinée, pas un rendu MapLibre. La vitesse de barre montre le principe,
pas un traitement vidéo réel. Thème sombre et grandes polices non déclinés pour les écrans clairs.
Vérifié par captures d'écran à la taille réelle ; ce n'est ni une recette ni une validation produit.
