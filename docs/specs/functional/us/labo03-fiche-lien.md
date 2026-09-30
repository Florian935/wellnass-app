---
id: LABO-03
titre: "La fiche d'un lien — tout ce que le Labo sait d'une question"
roadmap: [7.39]
catalogue: []
etape: recette
branche: feature/labo-carrefour
maj: 30/09/2026
---
# US LABO-03 — La fiche d'un lien

> **Parcours** : chantier « le Labo, carrefour des piliers », livré en une vague le 30/09/2026 sur demande
> explicite de Florian. Voir l'en-tête de [LIENS-01](liens01-registre-liens.md).
> Plan : [labo03-fiche-lien.md](../../../plans/labo03-fiche-lien.md). Maquettes de référence : planches
> `Anatomie` (la carte d'un lien pièce par pièce), `L3FicheMN`, `L4FicheMC`, `L5FicheRec`, `L12FicheReg`.

## 0. Contexte

Un lien du registre se résume en une ligne dans Croiser. Pour **comprendre** — pourquoi « à régler »,
depuis quand, sur quelles données, et que faire —, il faut un endroit qui dise tout, **une seule fois**.
Avant, le même croisement pouvait être raconté par trois cartes différentes, avec trois seuils.

## 1. Ce que l'US livre

Un écran **`/lab-link?id=<lien>`** ([app/lab-link.tsx](../../../../apps/mobile/src/app/lab-link.tsx)), ouvert
depuis une carte de Croiser, un écho d'un pilier, le widget « Tes liens » de l'accueil, un suspect
d'Apprendre ou le bandeau de collision du planning. Écran de premier niveau (et non `lab/[id]`) : l'onglet
du Labo répond déjà à `/lab`, et une route imbriquée sous le même segment rendrait la résolution ambiguë.

### Ce que la fiche dit, dans cet ordre

1. **La question**, la paire croisée (« MUSCU × NUTRITION ») et l'**état** (point + mot), sur le haut de
   scène du Labo.
2. **Le verdict** — deux phrases au plus, descriptives, sans « tu devrais » — et **deux chiffres**, un par
   côté du lien.
3. **Le graphique sur huit semaines**, dans la forme qui convient au lien
   ([CrossLinkChart](../../../../apps/mobile/src/components/lab/CrossLinkChart.tsx)) :

   | Forme | Lien | Ce qu'elle montre |
   |---|---|---|
   | `pair` | Manges-tu assez pour ta muscu ? | protéines/kg (avec **ta fourchette**) et charge du mouvement principal, **deux panneaux alignés** |
   | `split` | Tes deux sports se gênent-ils ? | allure des sorties qualité après jambes lourdes vs les autres |
   | `groups` | Ton carburant suit-il tes kilomètres ? | glucides/kg jours durs vs jours faciles, avec la fourchette |
   | `band` | Récupères-tu assez ? | ratio de charge (ACWR) avec la **zone saine** nommée |
   | `line` | Ton poids suit-il ton assiette ? / Ta force suit-elle ton poids ? | poids, ou total SBD |
   | `grid` | Tiens-tu le rythme partout ? | jours actifs par pilier et par semaine |
   | `phases` | Ton cycle et tes piliers | moyenne par phase de chaque mesure (CYCLE-01) |

4. **Ce que tes données croisent** : une ligne par analyse du catalogue qui entre dans la fiche — un
   libellé, une valeur, une note, et son propre état (ou aucun). La fiche « Manges-tu assez pour ta
   muscu ? » y ajoute **le détail déménagé de Stats nutrition** (APPORT-01, MN-03 — décision Q3,
   [ECHO-01](echo01-echos-liens.md)), comme la fiche du cycle porte le détail par phase (R5).
5. **Ce que tu peux faire** : les gestes du lien. Le premier est mis en avant. Chaque geste dit s'il
   **écrit** dans ton plan ou s'il **ouvre** un écran.
6. **L'histoire du lien** : huit pastilles, une par semaine, **figées** (LIENS-01 R9). Une semaine sans
   trace est un **trou**, pas un « ça tient ».
7. **Où le lien fait aussi écho** dans l'app, et **sur quoi il repose** (« Calculé sur 5 jours de repas
   saisis cette semaine et tes séances des 8 dernières semaines. Des associations, pas des preuves. »).

Un lien **à découvrir** dit ce qui lui manque (« Il faut 4 jours de repas notés sur 7 pour juger tes
protéines. Tu en as 2. ») avec une jauge (« 2 sur 4 jours »), et
n'affiche **ni histoire ni graphique** : huit trous alignés ne diraient rien de plus.

## 2. Règles

### R1 — Un geste qui écrit passe par la feuille (LABO-01 R4)

Toucher un geste qui écrit ouvre la feuille « ce qui change » ; seule sa confirmation écrit (même
écriture que Croiser). Un échec se voit, la feuille reste ouverte, le geste n'est pas marqué fait. Un
geste qui ouvre part tout de suite. Le Conseil des trois s'ouvre depuis la fiche des objectifs.

### R2 — Dataviz

- **Jamais de double axe** : deux mesures d'échelles différentes = deux panneaux alignés.
- **Le repère est nommé**, pas prescrit : « ta fourchette », « zone saine » — jamais « objectif ».
- **Un point absent est un trou** : pas de barre, pas de segment ; la lecture dit « pas de donnée ».
- **Toucher une semaine la lit** : la ligne au-dessus du dessin dit la semaine choisie, en mots ; c'est
  elle que TalkBack lit (le dessin est caché aux lecteurs d'écran, les colonnes portent leur libellé).

### R3 — Un identifiant inconnu ne casse rien

Un lien absent (pilier désactivé, identifiant d'une ancienne version) affiche « Ce lien n'est pas
disponible avec tes piliers actuels ». Le retour ramène à l'écran précédent, ou au Labo s'il n'y en a pas.

### R4 — D'où l'on vient

Venue d'Apprendre (`&from=learn`), le bouton retour dit « Apprendre » ; sinon « Croiser ».

### R5 — La fiche du cycle ne lit l'historique que sur elle

Le détail par phase (`useCycleInsights`) lit tout l'historique : il n'est calculé **que sur la fiche du
cycle**, jamais dans le registre partagé par toute l'app. Il remplace l'ancien écran « Cycle ›
Croisement » (`app/cycle/insights.tsx`, retiré) — décision **Q7** : une fiche au Labo, seulement si le
suivi est activé.

## 3. Offline

Tout vient du registre calculé sur l'appareil et de la table locale `cross_link_weeks`.

## 4. i18n et accessibilité

`lab.fiche.*` et `lab.links.*`, FR et EN. Le titre est un en-tête ; chaque pastille d'histoire porte
« Semaine du 07/09 : garde-fou » (ou « pas de trace ») ; l'état d'une mesure croisée est dit en mots.

## 5. Tests

`app/__tests__/lab-link-screen.test.tsx` (17 tests) : contenu, mesures croisées, détail APPORT-01/MN-03, identifiant inconnu,
retour, `from=learn`, R1 (feuille avant écriture, déplacement, allègement, échec visible, geste qui
ouvre, Conseil), histoire figée (trou ≠ état, trace d'un autre lien ignorée), lien à découvrir.
`components/lab/__tests__/cross-link-chart.test.tsx` : les sept formes, trou ≠ zéro, lecture au
toucher, note des deux panneaux. `link-texts-coverage.test.ts` : chaque texte que la fiche peut demander
existe en FR et EN.

## 6. Écarts assumés et ce qui n'est pas fait

- Le graphique `split` (jambes → allure) compare **des sorties**, pas des semaines : il n'a pas de
  lecture par semaine.
- L'histoire commence **le jour de la mise à jour** : les semaines d'avant le 30/09/2026 sont des trous
  (on ne réécrit pas le passé — c'est la règle même de Q5).
- Rendu en thème sombre, grandes polices et TalkBack : à recetter (RECETTES §89).

## 7. Revue de code du 30/09/2026

- **Accessibilité** : les pastilles d'état (histoire, mesures croisées) portent un **signe** — « ! »
  garde-fou, « ~ » à régler, « ✓ » ça tient, pointillé à découvrir — et plus seulement une couleur ; la
  légende nomme les signes.
- **Fiche du cycle** : une mesure pas encore lisible dit ce qui lui manque (« Encore 3 jours à
  enregistrer en phase lutéale »), comme l'ancien écran « Croisement » ; l'allure suit le **système
  d'unités** de l'utilisateur et les calories disent « kcal ». Le verdict ne prétend plus montrer des
  moyennes quand aucune n'est prête.
- « Dans ton plan » mémorisé par proposition (voir [LABO-02 §7](labo02-croiser.md)).
