# EFFORT-01 — maquettes du module Course face à Strava

20/09/2026 · Produites par `/design` (invoqué par Florian), **en attente de validation**.

**La toile : <https://claude.ai/artifact/Fp7sCrnKZ3YbVink6RBt5U>** — 10 planches, dont un prototype
jouable. Elle est **privée** : seul son propriétaire peut l'ouvrir tant qu'elle n'est pas partagée
depuis le menu *Share* de la page.

> ⚠️ **Nouveau format.** Depuis le 19/09/2026, `/design` publie la toile comme **Artifact du type
> « Design »** (fichiers `project/*.dc.html` + `project/canvas.json` hébergés sur l'Artifact) au lieu
> d'un dossier de `.dc.html` sur disque, comme [labo-2026-09/](../labo-2026-09/) ou
> [innovation-2026-09/](../innovation-2026-09/). **Il n'y a donc rien à versionner ici** : ce README
> est le pointeur.

## Ce que couvre la toile

| # | Planche | Sert à |
|---|---|---|
| 1 | La carte d'une sortie | **EFFORT-01** — médailles posées à l'endroit de l'effort, départ / arrivée / sens, vignette photo |
| 2 | Rejouer le parcours | *hors EFFORT-01* — US à cadrer |
| 3 | Les meilleurs efforts | **EFFORT-01** — la liste, les rangs, les écarts, « aucun record aujourd'hui et pourtant… » |
| 4 | L'allure au doigt | *hors EFFORT-01* — le scrub sur la courbe |
| 5 | Le partage | **PARTAGE-02** — le carrousel et la variante transparente |
| 6 | Le parcours | *hors EFFORT-01* — le segment personnel (**S1** de l'analyse) |
| 7 | Mes chaussures | *hors EFFORT-01* — **S2**, croisé avec DOUL-01 |
| 8 | Ma carte de chaleur | *hors EFFORT-01* — **S3**, avec les zones de confidentialité |
| 9 | Les photos d'une sortie | *hors EFFORT-01* — **S4**, dont le cas du tapis |
| 10 | **Prototype jouable** | **EFFORT-01** — médailles au tap, rejeu vocal, scrub réel, formats de partage |

## Ce que les maquettes supposent

- **Chiffres fictifs, profil fictif** : sortie de 8,42 km en 43:51, sans aucun record — choisi
  exprès, c'est le cas que l'app ne sait pas raconter aujourd'hui.
- **Couleurs et polices réelles**, pas approximées : `#f7eede`, `#2a64ad` (pilier Course), `#6fa8ef`
  sur fond sombre, Bricolage Grotesque + Hanken Grotesk + Space Mono — lues dans
  [theme/colors.ts](../../apps/mobile/src/theme/colors.ts) et
  [theme/fonts.ts](../../apps/mobile/src/theme/fonts.ts).
- **Aucun orange Strava**, aucun emprunt à leur interface : on reprend les idées, pas les écrans.
- Le prototype **parle** (`speechSynthesis`) et **sonne** (WebAudio) : le son démarre au premier
  appui, contrainte des navigateurs, et retombe en silence sans rien casser s'il est refusé.

## Liens

- Analyse : [docs/product/analyse-strava-2026-09.md](../../docs/product/analyse-strava-2026-09.md) §7
- Spec : [effort01-meilleurs-efforts-sortie.md](../../docs/specs/functional/us/effort01-meilleurs-efforts-sortie.md)
- Plan : [effort01-meilleurs-efforts-sortie.md](../../docs/plans/effort01-meilleurs-efforts-sortie.md)
