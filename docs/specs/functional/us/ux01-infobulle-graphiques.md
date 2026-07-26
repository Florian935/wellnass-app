---
id: UX-01
titre: "Infobulle de valeur au tap sur les graphiques (transverse)"
roadmap: [6.4]
catalogue: []
etape: close
branche: feature/ux01-infobulle-graphiques
maj: 25/07/2026
---
# US UX-01 — Infobulle de valeur au tap sur les graphiques (transverse)

> Pouvoir **taper un point ou une barre** d'un graphique pour lire sa **valeur exacte** et **sa date**,
> au lieu de l'estimer « à la louche » sur l'axe. Transverse : **un seul chantier améliore les 6 surfaces
> graphiques** de l'app (muscu, poids, apports, allure, volume, équilibre musculaire), parce que tout passe
> par deux composants mutualisés.
> Promue depuis [IDEAS.md](../../../../IDEAS.md) (idée du 16/07/2026, remontée par Florian en recette
> MUSC-04). Hors roadmap chiffrée — finition produit d'avant-lancement.
> Branche : `feature/ux01-infobulle-graphiques` · Date : 25/07/2026 ·
> **Statut : à valider (pas de code avant validation Florian/Damien).**
> **Aucune migration. Aucun module natif. 100 % client, lecture seule.**

> ℹ️ **Préfixe `UX-` nouveau** : cette US est une finition d'interface **transverse aux 3 piliers**, elle ne
> correspond à aucune ligne de roadmap ni au catalogue d'analyses (`META-`, `MUSC-`, `RN-`…). À renommer si
> vous préférez la rattacher à une famille existante.

## 0. Contexte

Les graphiques sont rendus par **deux composants présentationnels mutualisés** :

- [`ProgressLineChart`](../../../../apps/mobile/src/components/charts/ProgressLineChart.tsx) — courbes
  (wrap `LineChart` de `react-native-gifted-charts`) ;
- [`MuscleVolumeBarChart`](../../../../apps/mobile/src/components/charts/MuscleVolumeBarChart.tsx) —
  histogrammes (wrap `BarChart`).

**Aucun des deux n'est interactif** aujourd'hui : on lit la valeur en projetant mentalement le point sur
l'axe Y, ce qui est approximatif — et impossible dès que les gridlines sont espacées (4 sections) ou que
l'axe est formaté (allure en `M:SS`).

### Les 6 surfaces concernées (inventaire vérifié le 25/07/2026)

| # | Écran | Composant | Donnée | Unité | Libellé d'axe | Lissage |
|---|---|---|---|---|---|---|
| 1 | `progress/index.tsx` | Barres | Volume hebdo par groupe | kg/lb | nom du groupe | — |
| 2 | `progress/index.tsx` | Barres | Équilibre musculaire (nb de séries) | *(aucune)* | nom du groupe | — |
| 3 | `progress/index.tsx` | Courbe | Métrique muscu (charge max / 1RM / volume) | kg/lb | date courte | ✅ |
| 4 | `nutrition-stats.tsx` | Courbe | Poids de corps | kg/lb | date courte | ✅ |
| 5 | `nutrition-stats.tsx` | Courbe | Apports | kcal | date courte | ✅ |
| 6 | `running-history/index.tsx` | Courbe | Allure | /km ou /mi | date courte | ✅ |

→ **Toute évolution des deux composants profite d'un coup aux 6.** C'est ce qui fait le rapport
valeur/coût de cette US.

### Contraintes issues du code existant (à ne pas casser)

- **Largeur mesurée** : les deux composants calculent `width = largeur mesurée − axe Y − marge` pour ne
  **jamais déborder** de leur carte (travail fait en recette du 16/07). L'infobulle **ne doit pas
  réintroduire de débordement** — c'est le premier risque de cette US.
- **Axe Y formaté (opt-in)** : `formatYLabel` transforme la valeur brute en texte (allure : secondes →
  `M:SS`, via `buildPaceYAxis`). **L'infobulle doit réutiliser ce même formateur**, sinon l'allure
  s'afficherait « 412 » là où l'axe affiche « 6:52 ».
- **Lissage META-09 (opt-in `smooth`)** : quand il est actif, **deux séries** sont tracées — la brute
  (estompée, sans zone) et la lissée (accentuée, avec zone) via `movingAverage`. Repli automatique sur la
  brute seule sous 4 points.
- **`DataPoint` ne porte que `{ label, value }`** (+ `color` pour les barres). Le `label` est le libellé
  d'axe **abrégé** (« 12/07 », un nom de groupe musculaire) : **la date complète n'existe pas dans le
  composant**. Seul l'appelant la connaît (`p.date`, `e.logDate`, `d.logDate`, `p.dayKey`).
- **Composants strictement présentationnels** : aucune récupération de données, aucun accès au store. À
  préserver.

### Décisions de cadrage (arbitrage Florian, 25/07/2026)

- **Interaction = tap qui fixe l'infobulle**, et elle **reste** jusqu'au tap suivant (pas d'appui maintenu
  avec glissement). Motifs : découvrable, lisible sans tenir le doigt (qui masque le graphe), **identique
  sur courbes et histogrammes**, et plus accessible.
- **Valeur affichée = la valeur brute seule**, jamais la valeur lissée. La courbe lissée est une **aide à la
  lecture de tendance** : afficher sa valeur laisserait croire à une pesée ou un apport qui n'a jamais
  existé. (Option « les deux » écartée : infobulle plus grosse, risque de confusion, i18n doublé.)
- **API : nouveau champ optionnel** sur `DataPoint` pour la date complète, fourni par l'appelant. Champ
  **optionnel** ⇒ les appels existants continuent de compiler et de fonctionner (repli sur `label`).

## 1. Périmètre à livrer

- **Un composant d'infobulle unique et partagé**, utilisé par les deux graphiques → **un seul rendu
  visuel**, pas deux styles à maintenir.
- **Courbes** : tap sur un point → infobulle + mise en avant du point, persistante.
- **Histogrammes** : tap sur une barre → même infobulle + barre mise en avant.
- **Contenu** : ligne 1 = **date complète** (JJ/MM/AAAA) ou, à défaut, le libellé d'axe (cas des groupes
  musculaires) ; ligne 2 = **valeur formatée + unité**.
- **Fermeture** : tap sur un autre point/barre déplace l'infobulle ; tap ailleurs **dans la carte** la ferme.
- **Extension `DataPoint`** : champ optionnel de détail, renseigné sur les **4 surfaces datées** (3, 4, 5, 6).
- **Thème clair/sombre**, lisibilité, et **maintien dans les bornes** de la carte.
- **i18n FR + EN** (le peu de texte : aucun libellé en dur).

**Hors périmètre (à ne pas implémenter ici) :**

- **Zoom / défilement / sélection de plage** sur les graphiques — autre sujet, autre coût.
- **Appui maintenu avec glissement (scrub)** — arbitré contre (§0).
- **Affichage de la valeur lissée** — arbitré contre (§0).
- **Nouveaux graphiques** ou nouvelles métriques : on rend interactif l'existant, on n'ajoute rien.
- **Refonte des libellés d'axe** : inchangés.
- **Comparaison de deux points** (delta entre deux taps) : séduisant, mais c'est une autre US.

## 2. Comportement attendu

### 2.1 Tap sur un point (courbes)

- Tap sur ou **près** d'un point → l'infobulle apparaît **immédiatement** (pas de délai d'appui long),
  ancrée au-dessus du point, avec le point **mis en avant** et un **repère vertical** discret jusqu'à l'axe.
- Elle **reste affichée** : on peut lire, faire défiler l'écran, revenir.
- Tap sur un **autre** point → l'infobulle se déplace sur ce point. C'est **le** geste de fermeture
  effectif (voir §2.4).
- **Points rapprochés** (séries 90 j) : la sélection prend le point **le plus proche** du doigt ; il n'est
  pas nécessaire de toucher le point au pixel.

### 2.2 Tap sur une barre (histogrammes)

- Même infobulle, même contenu, même persistance.
- **Pas de surcharge de couleur sur la barre tapée** (arbitré à l'implémentation, 25/07). Les couleurs de
  l'équilibre musculaire portent du **sens** (délaissé = doré, équilibré = bordeaux, sur-représenté =
  grisé) et `FocusedBarConfig` de la bibliothèque n'offre qu'un **aplat** (`color`, `opacity`,
  `gradientColor`) — aucun contour. Repeindre la barre focalisée écraserait donc la sémantique. Le
  **retour visuel est l'infobulle elle-même**, ancrée au-dessus de la barre tapée, ce qui identifie déjà
  sans ambiguïté la barre sélectionnée.

### 2.3 Contenu de l'infobulle

Deux lignes, dans cet ordre :

1. **Date complète** au format **JJ/MM/AAAA** quand le point est daté (surfaces 3 à 6). Si le point n'est
   pas daté (groupes musculaires, surfaces 1 et 2) → **le libellé d'axe** (« Pectoraux »).
2. **Valeur + unité** : `82,5 kg`, `2 340 kcal`, `6:52 /km`, `18 séries`.

Règles de formatage :

- Si l'appelant fournit `formatYLabel`, **l'infobulle l'utilise** (garantit la cohérence avec l'axe :
  allure `M:SS`).
- Sinon : arrondi à **1 décimale maximum**, séparateur décimal selon la locale, pas de zéro inutile
  (`82 kg` et non `82,0 kg`).
- L'unité est celle déjà passée au composant (`unit`), donc déjà convertie kg/lb ou /km / /mi par
  `useUnits()` en amont. **Aucune conversion dans l'infobulle.**

### 2.4 Fermeture

- **Tap ailleurs dans la carte → fermeture : NON implémenté, repli assumé** (constaté à
  l'implémentation, 25/07). `react-native-gifted-charts` garde l'index du pointeur en interne et
  n'expose aucune API pour le réinitialiser ; le seul contournement serait de remonter le graphe via une
  `key`, ce qui **relancerait l'animation à chaque tap**. → **L'infobulle reste jusqu'au tap suivant.**
  Acceptable : elle est petite, bornée en largeur, et ne masque pas la lecture. À rouvrir si la
  bibliothèque expose la remise à zéro dans une version ultérieure.
- **Sortie de l'écran** → l'état est perdu (aucune persistance attendue).
- **Changement de période ou de métrique** (filtres 7 j / 30 j / tout, sélecteur d'exercice) → l'infobulle
  se ferme, sinon elle pointerait une donnée qui n'existe plus.

### 2.5 Règles / garde-fous

- **Ne jamais déborder** : l'infobulle d'un point en bord de graphe se **recale** vers l'intérieur.
  C'est explicitement à vérifier en recette sur le **premier** et le **dernier** point.
- **Aucun changement de rendu quand on ne tape pas** : au premier rendu, les 6 graphiques doivent être
  **pixel pour pixel identiques** à aujourd'hui. L'interactivité est purement additive.
- **Ne pas régresser** l'animation existante (`isAnimated`) ni les échelles imposées (`maxValue`,
  `yAxisOffset`, `stepValue`, `yAxisLabelTexts`) du cas allure.

## 3. Modèle de données & migration

**Aucune migration, aucun changement de schéma, aucune requête.** Lecture seule sur des données déjà
chargées et déjà affichées. Fonctionne donc **intégralement hors-ligne**, sans condition.

## 4. Client mobile

| Fichier | Nature | Rôle |
|---|---|---|
| `apps/mobile/src/components/charts/ChartTooltip.tsx` | **nouveau** | Composant d'infobulle **partagé** (présentationnel pur) : 2 lignes, thémé, ombre discrète, largeur contrainte. |
| `packages/shared/src/chart-tooltip.ts` (+ test) | **nouveau, pur** | `formatTooltipValue(value, { formatYLabel?, unit? })` → texte final. **Pur et testé** : c'est là que vivent les règles d'arrondi/locale/unité, pas dans le composant. |
| `ProgressLineChart.tsx` | modifié | `DataPoint` gagne `detail?: string` ; `pointerConfig` (activation instantanée au toucher, persistance, `pointerLabelComponent` → `ChartTooltip`, recalage auto) ; fermeture au tap hors point. |
| `MuscleVolumeBarChart.tsx` | modifié | `DataPoint` gagne `detail?: string` ; `focusBarOnPress` + `renderTooltip` → **le même** `ChartTooltip`. |
| `progress/index.tsx` · `nutrition-stats.tsx` · `running-history/index.tsx` | modifiés | Renseignent `detail` (date complète JJ/MM/AAAA) sur les 4 surfaces datées ; ferment l'infobulle au changement de période/métrique. |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | modifiés | Le strict nécessaire (ex. libellé d'unité « séries » si on décide de l'afficher sur l'équilibre musculaire). |

**Faisabilité vérifiée dans la version installée** (`react-native-gifted-charts` ^1.4.77,
`gifted-charts-core`) : `LineChart` expose `pointerConfig` avec `activatePointersInstantlyOnTouch`,
`persistPointer`, `pointerLabelComponent`, `autoAdjustPointerLabelPosition`, `pointerVanishDelay` ;
`BarChart` expose `focusBarOnPress`, `focusedBarConfig` et `renderTooltip`. **Rien à ajouter comme
dépendance.**

⚠️ **Expo SDK 57** : aucun module natif, donc **pas de rebuild** — reload Metro suffit. Vérifier les API
React Native utilisées contre <https://docs.expo.dev/versions/v57.0.0/> au moment du plan (consigne
[AGENTS.md](../../../../apps/mobile/AGENTS.md)).

## 5. i18n (FR + EN)

Presque rien à traduire : l'infobulle affiche une **date** (format JJ/MM/AAAA, convention projet) et une
**valeur + unité** déjà localisées en amont. Seul point d'attention : le **séparateur décimal** (virgule en
FR, point en EN) — traité par `formatTooltipValue` selon la locale active, **testé**. Aucune chaîne en dur.

## 6. Accessibilité

- L'infobulle est du **texte réel** (pas une image) → lisible par les lecteurs d'écran.
- Contraste du texte sur le fond de l'infobulle conforme **AA** dans les deux thèmes (prépare 9.12).
- Cible de tap : la tolérance de proximité (§2.1) sert aussi l'accessibilité motrice — on ne demande pas
  de viser un point de 4 px.
- Taille de police **non figée en dur** au point de casser avec le Dynamic Type (prépare 9.11) : prévoir
  que l'infobulle grandisse ou tronque proprement plutôt qu'elle déborde.

## 7. Cas limites

| Cas | Comportement attendu |
|---|---|
| **Un seul point** dans la série | Tap → infobulle normale (aucun cas particulier). |
| Série **vide** | Les composants rendent déjà `null` : rien à taper, rien à changer. |
| **Premier / dernier** point | Infobulle **recalée** dans les bornes, jamais coupée (recette obligatoire). |
| **Points rapprochés** (90 j) | Le plus proche du doigt est sélectionné. |
| **Lissage actif** | Valeur **brute** affichée (§0). Le point mis en avant est celui de la série brute. |
| **Allure** (axe formaté) | `6:52 /km` via `formatYLabel`, jamais la valeur en secondes. |
| **Valeur nulle ou 0** | Affichée telle quelle (`0 kg`), pas de masquage. |
| **Équilibre musculaire** (sans `unit`) | Valeur seule (`18`) ou « 18 séries » si on passe `unit` — à trancher au design, pas bloquant. |
| Changement de **période / métrique** | Infobulle fermée (§2.4). |
| **Rotation / redimensionnement** | La largeur est déjà remesurée (`onLayout`) ; l'infobulle suit ou se ferme, jamais décalée. |

## 8. Definition of Done

- [ ] Les **6 surfaces** répondent au tap (2 histogrammes + 4 courbes), avec **la même** infobulle.
- [ ] Date complète JJ/MM/AAAA sur les 4 surfaces datées ; libellé d'axe sur les 2 autres.
- [ ] Allure affichée en `M:SS` (cohérence avec l'axe) ; poids/kcal/volume correctement arrondis.
- [ ] **Valeur brute** affichée sur les courbes lissées, jamais la lissée.
- [ ] Infobulle **jamais coupée** en bord de graphe, **aucun débordement** de la carte.
- [ ] Rendu **inchangé** tant qu'on ne tape pas (comparaison avant/après sur les 6 écrans).
- [ ] `formatTooltipValue` **pur et testé** (formateur fourni, arrondi, locale, unité, valeur 0).
- [ ] Lisible en thème **clair et sombre**.
- [ ] `npm run typecheck` + `npm run lint` + tests **verts, exit code vérifié sans pipe**.
- [ ] Aucune migration ; aucun module natif ; aucune nouvelle dépendance.
- [ ] PR relue par les deux devs.

## 9. Critères d'acceptation (recette device)

1. **Muscu → Progression, courbe** : tap sur un point → date complète + valeur en kg cohérente avec l'axe.
   Tap sur un autre point → l'infobulle suit. Tap ailleurs → fermeture.
2. **Bords** : tap sur le **premier** puis le **dernier** point → infobulle **entièrement visible**, carte
   non débordée. Idem en thème sombre.
3. **Lissage** : sur une courbe où brut et lissé s'écartent visiblement, la valeur affichée est bien la
   **brute** (croiser avec l'historique).
4. **Allure** (Course → Historique) : `6:52 /km`, pas `412`.
5. **Histogrammes** (volume hebdo **et** équilibre musculaire) : tap sur une barre → même infobulle ; les
   couleurs sémantiques restent distinguables.
6. **Changement de période / de métrique** → l'infobulle se ferme.
7. **Nutrition** : courbes poids **et** apports, valeurs cohérentes avec le journal.
8. **Non-régression** : au chargement des 6 écrans, les graphiques s'affichent comme avant (échelles,
   libellés, animation, aucun débordement).
