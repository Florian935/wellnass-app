---
id: BIEN-02
titre: "Le pilier Bien-être — pilier activable, hub en trois onglets, garde-fou « humeur basse »"
roadmap: [1.31]
catalogue: [BW-01, BW-07]
etape: recette
branche: dev
maj: 01/10/2026
---

# US BIEN-02 — Le pilier Bien-être : la maison

> **Chapeau du chantier « pilier Bien-être »** (six US, BIEN-02 → BIEN-07, livrées ensemble le
> 01/10/2026). Ce fichier porte le contexte commun et les huit décisions ; les cinq autres specs n'en
> reprennent que ce qui les concerne.
>
> - Analyse : toile **Pilier Bien-être** (14 planches : synthèse, existant, 33 indicateurs passés au
>   crible, croisements, cinq écrans, prototype jouable, marché, garde-fous, décisions, découpage) —
>   https://claude.ai/artifact/Uj3su2fdPF9reGM62MFkeN, versée dans
>   [design/pilier-bien-etre-2026-10/](../../../../design/pilier-bien-etre-2026-10/).
> - **Décisions de Florian du 01/10/2026** (§2) : D1 pilier activable, D2 le Labo **garde** son
>   onglet, D3 la nuit lue dans Health Connect, D4 deux moments, D5 à D8 selon la recommandation.
> - ⚠️ **Lot en une vague, sur décision de Florian** (« tu implémentes TOUT d'un seul lot et je ferai le
>   recettage à la fin ») : spec, plan, maquette et code livrés ensemble, sans arrêt à l'étape de
>   validation. Les décisions D1-D8 valent validation du fond ; la recette sert de filet
>   ([RECETTES.md](../../../../RECETTES.md) §90).
> - Plan : [docs/plans/bien02-pilier-bien-etre.md](../../../plans/bien02-pilier-bien-etre.md).

## 1. Le problème

Le produit s'appelle « bien-être » et le bien-être n'avait **pas de maison**. Tout existait, éparpillé :

| Brique | Où elle vivait | Ce qui manquait |
|---|---|---|
| Humeur, énergie, stress (BIEN-01) | une feuille à l'accueil, un écran d'historique | aucun lieu où aller, aucun lien avec le reste |
| La nuit (LABO-01) | un champ de cette feuille | ni sa qualité, ni la lecture d'une montre |
| Douleurs (DOUL-01), cycle (CYCLE-01), pas (PAS-01) | trois écrans distincts | aucun ne se lisait à côté des autres |
| Score de forme (TRI-03) | l'accueil | ne connaissait ni la nuit, ni « malade » |

Et surtout, **pas de boucle** : un matin après une nuit de 5 h, rien ne changeait à la séance prévue.

## 2. Les décisions (01/10/2026)

| # | Question | Décision | Où elle s'applique |
|---|---|---|---|
| D1 | Pilier activable, ou dimension transverse ? | **Pilier activable**, masqué s'il n'est pas activé (décision H). Le check-in de BIEN-01 reste au socle pour tous. | cette US |
| D2 | Six onglets quand tout est activé ? | **Le Labo garde son onglet** (Florian : « sinon l'utilisateur ne pensera pas à y aller »). La barre monte à six destinations, libellés un cran plus petits. | cette US |
| D3 | La nuit lue par Health Connect ? | **Oui** : `READ_SLEEP`, septième type de la déclaration Play. | [BIEN-06](bien06-nuit-health-connect.md) |
| D4 | Un check-in ou deux ? | **Deux moments** : matin (nuit, qualité, énergie, envie), soir (humeur, stress, étiquettes). | [BIEN-03](bien03-checkin-deux-temps.md) |
| D5 | Quels indicateurs ajouter ? | Qualité de la nuit, envie de s'entraîner ; étiquettes malade, journée chargée, soirée, voyage. | [BIEN-03](bien03-checkin-deux-temps.md) |
| D6 | Le reste de la liste ? | **Modules éteints par défaut** : alcool, café tardif, sieste, fringales. L'eau reste NUTR-12. | [BIEN-07](bien07-modules.md) |
| D7 | Garde-fou « humeur basse » ? | **Obligatoire avant la sortie**, seuil et texte à faire relire. | cette US |
| D8 | Gratuit ou payant ? | Saisie, journal et liens simples **gratuits pour toujours** ; tout est gratuit en V1. | — |

## 3. Le choix d'architecture : activable, mais pas un `Pillar`

Pour l'utilisateur, Bien-être est un pilier comme les trois autres : il l'active, il a son onglet, sa
couleur, sa scène. **Dans le code, ce n'est pas un `Pillar`** : c'est un drapeau à part,
`user_settings.wellbeing_pillar_enabled`, comme le suivi du cycle.

Pourquoi : ~30 endroits énumèrent les piliers en supposant qu'ils sont **sportifs ou nutritionnels**
— la scène à trois disques du Labo, les paires de liens, les `activePillars.length >= 2`, le guidage,
les programmes, `resolveActivePillars` (qui rend les trois piliers à une valeur inconnue : un
`'wellbeing'` glissé dans `active_pillars` serait **lu par un client plus ancien comme une liste
illisible**). Le pilier n'a ni programme, ni disque, ni guidage : en faire un `Pillar` aurait cassé
ces endroits pour rien. Le prix : les endroits qui doivent le connaître le lisent explicitement
(barre d'onglets, réglages, onboarding, actions rapides, couleurs de menu).

## 4. Ce que fait l'US

### 4.1 L'activer — c'est consentir (RGPD, article 9)

- Trois entrées, un seul point de passage (`toggleWellbeingPillar`) : l'onboarding (écran des
  piliers), les Réglages (section piliers), les réglages du pilier.
- **Activer** ouvre une confirmation qui dit ce qui sera enregistré (nuit, humeur, stress, maladie,
  alcool si le module est allumé), où (sur le téléphone, synchronisé sur le compte) et comment le
  reprendre. **Désactiver** est immédiat et **n'efface rien** : refuser ne coûte pas un geste de plus
  qu'accepter.
- Défaut : **éteint**, y compris tant que les réglages ne sont pas chargés (l'absence ne vaut jamais
  consentement).

### 4.2 L'identité

- Couleur du pilier : **violet de nuit** — `pillarWellbeing` `#6a3fb0` (clair) / `#c2a3ff` (sombre),
  teinte de scène `#3f2178`. Ajoutée aux couleurs de menu (réglage « une couleur par menu »).
- ⚠️ Exception documentée au test de contraste : en thème clair, la surface teintée ne peut pas
  dépasser une chroma de 6 à la luminance 0,96 sans devenir rose ou grise (mesuré sur sept violets ×
  six doses) — plancher abaissé pour ce seul pilier (`LIGHT_FLOOR.wellbeing = 6`).

### 4.3 La barre d'onglets (D2)

Onglet **Bien-être** (icône lune) après Nutrition, visible seulement pilier allumé. Le Labo **reste**
quand les quatre piliers sont actifs : six destinations, libellés à 10 px au-delà de cinq onglets.
Bien-être seul (aucun des trois autres) : Accueil + Bien-être, pas de Labo (rien à croiser).

### 4.4 Le hub en trois onglets

Même patron que MUSCU-UX07, CARDIO-UX03, NUTRI-UX03 (en-tête dans la scène, onglets en bas de la scène,
paramètre de route lu une fois puis retiré, dernier onglet retenu en mémoire, jamais persisté) :

| Onglet | Ce qu'il dit | US |
|---|---|---|
| **Aujourd'hui** | la forme du jour dans la scène ; le garde-fou s'il y a lieu ; les deux check-ins, le moment de l'heure en tête ; ce que l'état change à la séance et à l'assiette ; les nuits de la semaine ; les suivis (douleurs, cycle, pas, poids, eau) | BIEN-02, BIEN-03, BIEN-04 |
| **Journal** | le mois en couleurs, un indicateur à la fois ; les 14 derniers jours avec ce que les piliers ont fait | BIEN-02 |
| **Ce qui compte** | l'écho du lien du Labo ; ce qui pèse sur les nuits ; la régularité du coucher ; les moyennes sur 30 jours | BIEN-05 |

En-tête : « Bien-être », un accès à l'historique en courbes de BIEN-01 (`/wellbeing`), un accès aux
réglages du pilier (`/wellbeing-settings`). **Ouvert par un lien alors que le pilier est éteint**,
l'écran le dit et mène aux réglages — jamais une page vide, aucune donnée affichée.

### 4.5 Le Journal

- Le mois en cases colorées (violet, 5 niveaux), **un indicateur à la fois** (humeur, énergie,
  stress, nuit, qualité, envie) — une seule mesure lisible par case.
- Un jour non renseigné est un **trou** (case en pointillé), jamais une valeur. La couleur n'est
  jamais seule : chaque case porte son numéro de jour, la légende dit le sens.
- Dessous, les 14 derniers jours, chacun avec ses valeurs **en mots** et **ce que les piliers ont
  fait** ce jour-là (séance, sortie, journée nutrition) ; toucher un jour rouvre son check-in (matin
  ou soir) dans la fenêtre de rattrapage.

### 4.6 Le garde-fou « humeur basse » (D7)

- Règle (`shouldShowLowMoodCard`) : parmi les **7 derniers jours où l'humeur a été notée**, dans les
  **14 derniers jours civils**, au moins **5 à 1 ou 2**. Et la carte n'est **pas apparue depuis 14
  jours**.
- Ce que la règle ne fait pas, volontairement : commenter un jour isolé, compter un jour sans saisie
  comme un jour bas, se déclencher sur trois mauvais jours de suite.
- La carte (onglet Aujourd'hui, en tête) : un titre, deux phrases, **« Appeler le 3114 »** (numéro
  national de prévention du suicide, gratuit, 24 h/24) et « Fermer ». Aucun mot clinique, aucun
  diagnostic. Apparue, elle reste visible **tout le jour** ; fermée, elle ne revient pas le même jour ;
  dans tous les cas, **14 jours de silence** ensuite. Mémoire **locale à l'appareil** (pas synchronisée).
- Le texte est repris dans les réglages du pilier (section « Si ça ne va pas »), avec le numéro.
- ⚠️ **Seuil et texte à faire relire par une personne compétente avant la sortie du pilier** — en tête
  de la recette. Le numéro est français : à adapter pour l'anglais hors de France (§8).

### 4.7 Les réglages du pilier (`/wellbeing-settings`)

Quatre sections, dans l'ordre où l'on se les pose : le pilier (activer / éteindre), les modules
([BIEN-07](bien07-modules.md)), la nuit lue dans Health Connect ([BIEN-06](bien06-nuit-health-connect.md)),
le garde-fou.

### 4.8 Ce qui change ailleurs

- **Accueil › action rapide « Check-in »** : ouvre le hub si le pilier est allumé, l'historique de
  BIEN-01 sinon. La feuille de BIEN-01 reste celle des comptes sans le pilier.
- **Écran `/wellbeing`** (historique BIEN-01) : affiche aussi les nouvelles échelles pilier allumé.

## 5. Cas limites

| Cas | Comportement |
|---|---|
| Réglages pas encore chargés | pilier éteint (onglet masqué, aucune donnée) |
| Écriture du réglage en échec | l'interrupteur reste éteint (`catch` → « non activé ») — jamais un rejet non capturé |
| Pilier éteint puis rallumé | tout revient : rien n'a été effacé |
| Lien entrant `/wellbeing-hub?section=journal` pilier éteint | écran « pilier éteint » |
| Paramètre de section inconnu | dernier onglet choisi, sinon Aujourd'hui |
| Moins de 5 humeurs notées sur 14 jours | pas de garde-fou (pas assez pour dire quoi que ce soit) |
| Carte apparue, humeur du soir remontée | la carte reste jusqu'au soir |

## 6. Offline

Tout est local : réglages et check-ins passent par PowerSync (`user_settings`, `daily_wellbeing`),
le garde-fou est calculé sur l'appareil, sa mémoire est locale. Aucun appel réseau.

## 7. i18n

FR + EN pour tout : `pillars.wellbeing`, `tabs.wellbeing`, `wellbeingHub.*` (hub, onglets, état éteint,
consentement, garde-fou, journal), `wellbeingSettings.*`. Fusion vérifiée par le test de parité.

## 8. Ce qui n'est pas fait

- **Relecture du seuil et du texte du garde-fou** par une personne compétente (D7) — hors code.
- **Numéro d'aide hors de France** : le 3114 est affiché aussi en anglais. À régionaliser avant une
  sortie hors de France.
- Le **contraste du violet en thème clair** est une exception au plancher de chroma (§4.2), à revoir
  si la palette de base change.
- La factorisation d'un `PillarTabsHeader` commun aux quatre hubs (notée au §11 de NUTRI-UX03).

## 9. Critères d'acceptation

Voir [RECETTES.md](../../../../RECETTES.md) §90 A (le pilier, la barre, le hub, le garde-fou).
