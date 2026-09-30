---
id: ECHO-01
titre: "Les échos des liens — ce que les piliers gardent d'un croisement"
roadmap: [7.40]
catalogue: []
etape: recette
branche: feature/labo-carrefour
maj: 30/09/2026
---
# US ECHO-01 — Les échos des liens

> **Parcours** : chantier « le Labo, carrefour des piliers », livré en une vague le 30/09/2026 sur demande
> explicite de Florian. Voir l'en-tête de [LIENS-01](liens01-registre-liens.md).
> Plan : [echo01-echos-liens.md](../../../plans/echo01-echos-liens.md). Maquettes de référence : planches
> `E1Muscu`, `E2Nutrition`, `E3Accueil`, `E4Planning`, et la table « Les lectures déménagent, les
> mécaniques restent » de la planche `Doctrine`.

## 0. Contexte

Si le Labo devient la maison des liens, les cartes croisées qui vivaient dans les piliers ont deux
destins possibles : rester (et on garde vingt versions du même croisement), ou partir (et le pilier
perd une information utile). La doctrine tranche : **les lectures déménagent, les mécaniques restent,
les garde-fous restent** — et le pilier garde un **écho**.

## 1. Ce que l'US livre

### Un seul composant d'écho

[CrossLinkEcho](../../../../apps/mobile/src/components/lab/CrossLinkEcho.tsx) : une ligne « LIEN · MUSCU ×
NUTRITION », le point et le mot de l'état, la phrase courte du lien, « Voir le lien au Labo » — qui ouvre
**la fiche de ce lien**, pas le Labo en général. Il n'affiche que le lien **le plus pressant qui concerne
l'écran** (`echoFor`), et **seulement s'il demande quelque chose** (garde-fou ou à régler). Un lien qui
tient ne fait pas d'écho : le pilier n'a rien à en dire.

### Où il est monté

| Écran | Surface | Liens qui peuvent y faire écho |
|---|---|---|
| Musculation › Progrès | `strengthProgress` | Tes deux sports se gênent-ils ? · Manges-tu assez pour ta muscu ? · Récupères-tu assez ? |
| Course › Courir | `runningToday` | Tes deux sports… · Ton carburant… · Récupères-tu assez ? |
| Nutrition › Aujourd'hui | `nutritionToday` | Manges-tu assez… · Ton carburant… · Ton poids suit-il ton assiette ? |
| Stats nutrition | `nutritionStats` | Manges-tu assez… · Ton carburant… — et, sinon, la ligne « déménagé » |

**Stats nutrition** (décision **Q3**) : les cartes croisées APPORT-01 (énergie et adhérence par type
de jour, jours à faible carburant, répartition des protéines) et MN-03 ont besoin de la muscu pour
exister ; elles **déménagent, entières**, dans la fiche « Manges-tu assez pour ta muscu ? »
(`CrossTrainingSection` et `TrainingNutritionCrossCard`, montées sous les mesures croisées — les lignes de
la fiche les résument, les cartes en gardent le détail). Quand aucun lien ne
demande rien, une ligne sobre dit où elles sont parties (« Les analyses qui croisent tes piliers ont
déménagé au Labo. Ouvrir « Manges-tu assez pour ta muscu ? » ») — sans elle, leur disparition se lirait
comme une perte.

### Ce qui reste à sa place

| Élément | Nature | Ce qui change |
|---|---|---|
| Bandeau de collision du planning | garde-fou | reste entier ; gagne « Voir le lien au Labo » (fiche « Tes deux sports… ») |
| Bandeau de douleur du planning | garde-fou | inchangé (il ne croise pas deux piliers) |
| Adaptation de la séance du jour (RUN-F4) | action du jour | reste dans Course › Courir ; la collision du jour y renvoie (LIENS-01 R4) |
| Bonus de séance, dépense comptée dans la cible, réservoir de glucides | mécaniques | restent dans Nutrition › Aujourd'hui ; les fiches les expliquent |
| Ligne glucides de « Macros par kg » (FUEL-01) | repère du jour | **reste** (écart assumé, voir §5) |
| Forme du jour, brief du matin | mécaniques | restent à l'accueil |
| Carte de conflit d'objectifs de l'accueil | garde-fou | reste ; même écriture que le Conseil ouvert depuis la fiche (`goal-conflict-resolution.ts`) |

### L'accueil : « Tes liens » (widget Insights)

Le registre de l'accueil est plafonné à 8 (ADR-007) et plein. Plutôt qu'un neuvième widget, le widget
**Insights** dit d'abord **« Tes liens »** quand un lien demande quelque chose : « Un garde-fou d'abord »
ou « 3 liens à régler cette semaine », puis « Le plus pressant : … », et « Ouvrir le Labo ». Sinon, il
montre les signaux d'Insights comme avant. Un lien à régler suffit à faire apparaître le widget.

### Insights (décision Q2)

L'écran Insights garde l'**intra-pilier** et les **célébrations**. Les six alertes croisées
(`LAB_OWNED_INSIGHTS`) n'y sont plus calculées ; leurs destinations (`widget-destinations.ts`)
deviennent `lab-link`, vers la fiche de leur lien.

### Cycle (décision Q7)

L'écran « Cycle › Croisement » (`app/cycle/insights.tsx`) est **retiré** ; l'écran Cycle ouvre la fiche
« Ton cycle et tes piliers » du Labo, qui n'existe que si le suivi est activé.

### Retraits

- `DayBalanceCard` (« Balance du jour ») et `WhatIfCard` (« Et si… ») : **codées, montées nulle part**.
  Retirées ; Composer couvre « Et si… ».
- Les six hooks croisés ne sont plus montés par `useInsights` : ils l'étaient **en double** avec le Labo.

## 2. Règles

- **R1** — Un écho ouvre **la fiche** de son lien (`/lab-link?id=…`).
- **R2** — Un écho n'existe que pour un lien **garde-fou ou à régler** qui déclare cette surface.
- **R3** — Un garde-fou n'est jamais **réduit** à un écho là où l'on agit (planning, séance du jour).
- **R4** — Décision H : un pilier désactivé ne produit pas de lien, donc pas d'écho ; la ligne
  « déménagé » ne s'affiche pas vers une fiche qui n'existe pas.

## 3. Offline, i18n, accessibilité

Calcul local (le registre partagé). `lab.echo.*`, `home.links.*`, `planning.seeLink`,
`cycle.crossLab` en FR et EN. L'écho est un lien (`accessibilityRole="link"`) qui annonce « Lien
Muscu × Nutrition : … Voir au Labo. » ; l'état se dit en mots.

## 4. Tests

`components/lab/__tests__/cross-link-echo.test.tsx` : écho d'un lien à régler (paire, état, phrase mise
en forme), ouverture de la fiche du lien, rien pour un lien qui tient, ligne « déménagé », pas de ligne
vers une fiche absente. `cross-links.test.ts` (Vitest) : `echoFor` et `pressingLink`.
`widget-destinations.test.ts` : les six alertes pointent vers `lab-link`. Les suites existantes des
hubs, de Stats nutrition, du planning, de l'accueil et du cycle passent (l'écho y est doublé là où il
n'est pas le sujet).

## 5. Écarts assumés et ce qui n'est pas fait

- **La ligne glucides de « Macros par kg » reste** dans Nutrition : c'est un repère du jour (combien
  manger aujourd'hui), pas une lecture croisée ; la fiche « Ton carburant… » en fait l'analyse.
- **Le planning n'a pas d'écho générique** : il garde ses bandeaux, et seul celui de la collision mène à
  la fiche. Un garde-fou de charge (Récupères-tu assez ?) n'y est pas répété.
- **Cycle** déclare une surface, mais son lien n'est jamais « à régler » : pas d'écho, seulement le
  bouton de l'écran Cycle vers la fiche. « Ta force suit-elle ton poids ? » n'en déclare plus aucune
  (voir §6).
- **Aucune notification** n'a été rebranchée sur le registre.

## 6. Revue de code du 30/09/2026

- « Récupères-tu assez ? » fait écho dans **Musculation › Progrès** (le garde-fou de surentraînement ne
  demande pas la course) ; il ne déclare plus le planning, où aucun écho générique n'est monté. « Ta
  force suit-elle ton poids ? » ne déclare plus d'écho (jamais à régler). La fiche ne dit donc plus « tu
  le retrouves aussi dans… » un écran où il n'apparaît pas.
- La carte de conflit d'objectifs de l'accueil applique la **décision H** (objectif d'un pilier
  désactivé ignoré) et rend visibles ses échecs d'écriture.
- **Supprimer ses données de cycle** efface aussi l'histoire du lien « cycle » (`cross_link_weeks`,
  soft delete dans la même transaction) : une semaine « cycle : ça tient » dit qu'un cycle était suivi,
  c'est la même donnée de santé.
- Clés i18n devenues orphelines (anciens onglets, ancien écran « Croisement ») retirées : 28 par langue.
- ⚠️ Assumé : quand un lien est à régler, le widget de l'accueil montre « Tes liens » **à la place** des
  signaux d'Insights (records, objectifs atteints) ; et le conflit d'objectifs peut apparaître à la fois
  sur sa carte d'accueil et dans « Tes liens ». À juger en recette.
