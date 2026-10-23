---
id: CARDIO-08
titre: "« X sur Y dans la plage » sans l'échauffement — l'analyse d'une sortie et le hub Course disent le même chiffre"
roadmap: [5.44]
catalogue: []
etape: code
branche: fix/cardio08-fractions-analyse
maj: 23/10/2026
---

# US CARDIO-08 — « X sur Y dans la plage » sans l'échauffement, dans l'analyse

> **Demande** : Florian, 23/10/2026 — reprendre la ligne CARDIO-08 du BACKLOG (P2, constat de la relecture
> de CARDIO-UX03). Cadrer où filtrer, recenser d'abord les appelants, un test qui échoue d'abord et un test
> qui compare les deux chiffres sur la même sortie.
> **Sources** : BACKLOG, ligne CARDIO-08 ; spec [CARDIO-UX03](cardio-ux03-hub-onglets.md) (lignes 247 et
> 475, l'écart « connu, non corrigé ») ; [run-interval-results.ts](../../../../packages/shared/src/run-interval-results.ts) ;
> [run-last-time.ts](../../../../packages/shared/src/run-last-time.ts) (lecture seule) ;
> [run/analysis.tsx](../../../../apps/mobile/src/app/run/analysis.tsx).
> **Plan** : [docs/plans/cardio08-fractions-analyse.md](../../../plans/cardio08-fractions-analyse.md).
> **Maquette** : **sans objet** (Florian) — aucun écran ne change de forme. Le §5 donne l'écran avant/après,
> ligne à ligne, sur la sortie de référence.
> **Roadmap** : 5.44 (hub Course en trois onglets), **pas de nouvelle ligne** : c'est la correction d'un
> écart entre deux écrans livrés.
> **Vérifié dans le code** le 23/10/2026 sur `origin/dev` (`d604dec2`) ; **relue** le même jour par un agent de
> revue (§10), dont les corrections sont intégrées.
> ✅ **Validée par Florian le 23/10/2026** : D1 à D4 **telles que proposées** (filtre dans la fonction partagée,
> libellés D2 inclus, seul le commentaire de `run-last-time.ts` retouché, test de comparaison) ; le régime de
> recette est celui du 23/10/2026 : **recette à la demande**, l'US passe à `close` dans le commit du code.

## 0. Le besoin

Après un fractionné, deux écrans disent combien de fractions ont été tenues dans la plage prévue :

- le **hub Course** — la carte d'arrivée (« Fractions : 5 sur 6 dans la plage ») et « La dernière fois »
  dans la carte de la séance du jour ;
- l'**analyse de la sortie** (`run/analysis.tsx`), en tête du tableau « Fraction par fraction ».

Pour une sortie avec échauffement, gammes et retour au calme, ils ne donnent pas le même chiffre : le hub dit
« 5 sur 6 », l'analyse « 6 sur 8 ». L'analyse compte l'échauffement et le retour au calme comme des fractions,
et son allure moyenne et sa régularité mélangent 6:00/km d'échauffement et 3:55/km de fractions. Le coureur ne
sait plus lequel croire, et l'analyse, qui devrait être la lecture la plus fine, est la plus fausse.

## 1. Ce que dit le code

### 1.1 Les appelants de `summarizeIntervalSeries` — un seul

Recensés dans tout le dépôt (`apps/`, `packages/`, `supabase/functions/`) le 23/10/2026 :

| Appelant | Ce qu'il en fait |
|---|---|
| [run/analysis.tsx:143](../../../../apps/mobile/src/app/run/analysis.tsx#L143) | `summarizeIntervalSeries(intervalRows)`, **sans tolérance** (0 par défaut). Affiche `inRangeCount`/`ratedCount` (l. 291-298), `avgFastPaceSPerKm` et `paceStdDevSPerKm` (l. 361-371). |
| `run-interval-results.test.ts` | 7 tests, tous sur des lignes `segmentKind: 'work'`. |

Personne d'autre : ni le hub, ni « Toutes tes stats », ni le back-office, ni `noryn-context`. `fastCount`,
`slowestRep` et `fastestRep` ne sont affichés nulle part (les clés `running.realise.slowest/fastest` existent,
sans lecteur).

### 1.2 Pourquoi l'échauffement passe pour une fraction

`summarizeIntervalSeries` ne garde que `phaseKind === 'fast'`
([run-interval-results.ts:129](../../../../packages/shared/src/run-interval-results.ts#L129)). Or depuis
RUN-F4 (lot B), `expandIntervalPhases` développe **chaque** segment en phase `fast`, quelle que soit sa
nature ([running-intervals.ts:166-189](../../../../packages/shared/src/running-intervals.ts#L166-L189)) :
l'échauffement, les gammes, le retour au calme **et un segment de nature « récupération »** (un bloc
« Récupération 3 min » entre deux séries) sortent tous en `phaseKind: 'fast'`, avec leur `segmentKind`.
Quatre natures fuient donc dans le résumé, pas trois.

Le guidage vocal, lui, fait déjà la différence : un segment autre que `work` y est annoncé par sa nature, pas
comme une fraction ([interval-guidance.ts:99-100](../../../../apps/mobile/src/running/interval-guidance.ts#L99-L100)).

### 1.3 Ce que fait le hub

`lastTimeReps` garde `phaseKind === 'fast' && segmentKind === 'work'`
([run-last-time.ts:86](../../../../packages/shared/src/run-last-time.ts#L86)), puis `repsInRange` compte les
pastilles jugeables. Deux lecteurs : la carte d'arrivée
([(tabs)/running.tsx:293](../../../../apps/mobile/src/app/(tabs)/running.tsx#L293)) et « La dernière fois »
([RunLastTime.tsx:48-49](../../../../apps/mobile/src/components/running/RunLastTime.tsx#L48-L49)).

### 1.4 À population égale, les deux jugements sont les mêmes

Vérifié ligne à ligne : même plage (`normalizePaceRange` des deux côtés), **aucune tolérance** des deux côtés,
bornes incluses des deux côtés, même condition de « jugeable » (une plage prévue et une allure réalisée
mesurable). La seule différence est la population. Une ligne relue sans nature (`segment_kind` nul, séances
RUN-F2c) est lue `'work'` par le dépôt
([run-repository.ts:842](../../../../apps/mobile/src/data/repositories/run-repository.ts#L842)) : elle reste une
fraction pour les deux.

Un écart subsiste, hors du chemin du tracker : pour une fraction bornée en distance, le hub exige une
**durée** réalisée positive ([run-last-time.ts:90-92](../../../../packages/shared/src/run-last-time.ts#L90-L92)),
l'analyse une **allure** réalisée positive. C'est la même condition pour toute ligne écrite par
`buildIntervalDraft` (allure = durée × 1000 / distance, distance positive) ; elles divergeraient sur une ligne
écrite à la main avec une allure et sans durée — `actual_pace_s_per_km` est une colonne à part. Le tracker ne
produit pas ce cas ; on ne le traite pas, et le jeu de vérification écrit des triplets distance / durée /
allure cohérents.

### 1.5 Ce qui fuit à l'écran, aujourd'hui

1. L'en-tête « **X sur Y dans la plage** » compte l'échauffement, les gammes et le retour au calme **quand ils
   ont une plage d'allure** résolue (allure explicite, chrono cible ou %VMA, via `resolvePhasePace`). Les 24
   séances du plan analysé prescrivent un échauffement, mais en durée et « très facile » : sans plage, il
   n'entre pas dans l'en-tête.
2. « **Allure moyenne des fractions** » et « **Régularité** » mêlent toutes les phases rapides **dont l'allure
   est mesurée** — avec ou sans plage, donc dès qu'il y a un échauffement : sur la sortie du §5, 4:21/km et
   ± 61 s/km au lieu de 3:58/km et ± 6 s/km. La régularité, « le vrai sujet d'une séance de VMA »
   (commentaire du code), est la plus abîmée, et c'est la fuite la plus fréquente.
3. Les lignes du tableau appellent l'échauffement « **Fraction 1** », chaque gamme « Fraction 1, 2, 3 », le
   retour au calme « Fraction 1 » (l. 342-344) : sous « 5 sur 6 », on compterait onze « Fraction ».

## 2. Décisions

### D1 — Filtrer **dans** `summarizeIntervalSeries` (validé)

Le résumé ne porte plus que sur les répétitions rapides **du corps de séance** : `phaseKind === 'fast'` **et**
`segmentKind === 'work'` — le même filtre, mot pour mot, que `lastTimeReps`.

Pourquoi là plutôt que chez l'appelant :

- **un seul appelant** (§1.1) : changer le sens de la fonction ne déplace aucun autre chiffre ;
- son contrat est déjà « résumé d'une série de **fractions** », et son commentaire écarte les récupérations
  pour la même raison (deux populations mêlées rendent moyenne et écart-type illisibles). La règle « rapide =
  fraction » est devenue fausse avec RUN-F4 lot B, sans que la fonction le sache : c'est elle qui a le défaut ;
- filtrer chez l'appelant laisserait le piège au prochain lecteur, et à sa discipline la moyenne et la
  régularité autant que le compte.

Alternative écartée : `summarizeIntervalSeries(intervalRows.filter(…))` dans `analysis.tsx` — même résultat à
l'écran, mais une fonction partagée qui continue de compter l'échauffement si on l'appelle sans précaution.

### D2 — Les lignes hors corps de séance portent leur nom (validé)

Le tableau garde **toutes** ses lignes — l'allure de l'échauffement est une information — mais une ligne qui
n'est pas une fraction cesse de s'appeler « Fraction » :

| Ligne | Aujourd'hui | Après |
|---|---|---|
| Échauffement | Fraction 1 | **Échauf.** |
| Gammes (3 répétitions) | Fraction 1, 2, 3 | **Gammes 1, 2, 3** |
| Segment de nature « récupération » | Fraction 1 | **Récup** (le libellé des récupérations) |
| Retour au calme | Fraction 1 | **Ret. calme** |
| Fraction du corps de séance | Fraction n | Fraction n (inchangé) |
| Récupération entre fractions | Récup | Récup (inchangé) |

Règle : libellé de la nature, suivi du rang **si le segment a plus d'une répétition** (« Gammes 2 »). Libellés
courts parce que la colonne fait 84 px (`numberOfLines={1}`) : « Échauffement » et « Retour au calme » y
seraient tronqués. Le lecteur d'écran entend le nom complet (`running.segmentKind.*`, déjà traduit), **y
compris pour les lignes « Récup »** entre fractions, abrégées elles aussi. Une nature inconnue (`segment_kind`
n'a aucune contrainte en base) est écartée du compte comme au hub, et s'affiche « Fraction n » plutôt qu'une
clé brute.

La couleur « hors plage » reste sur **toutes** les lignes : c'est la lecture ligne à ligne (un retour au calme
couru trop vite reste une information). Le compte de l'en-tête, lui, ne porte que sur les fractions.

**Pourquoi c'était une proposition à confirmer** : D2 sort du strict « une ligne de filtre » du BACKLOG et touche
`fr.json`/`en.json`, que d'autres chantiers du jour peuvent toucher (conflit de fusion possible, résolu en
gardant les deux côtés). Sans D2, le compte est juste mais le tableau affiche toujours onze lignes
« Fraction » sous « 5 sur 6 » — l'écran se contredit encore, autrement. **Recommandation : D2 incluse.**

### D3 — `run-last-time.ts` ne bouge pas ; son commentaire deviendra faux

Le code du hub est en lecture seule (périmètre donné par Florian) et n'a pas à changer : c'est lui qui a
raison. Mais son commentaire ([run-last-time.ts:75-79](../../../../packages/shared/src/run-last-time.ts#L75-L79))
dit que `summarizeIntervalSeries` « ne filtre que le type de phase » : ce sera faux après D1.
**Validé : retoucher ce seul commentaire** (aucune ligne de code).

### D4 — Pas de prédicat partagé ; un test de comparaison à la place

Exporter un `isWorkRep` commun aux deux fonctions supposerait de modifier `lastTimeReps` (gelé, D3). La
cohérence est tenue par un **test qui compare les deux chiffres** sur les mêmes lignes (R2) : si l'un des deux
filtres ou jugements change un jour sans l'autre, ce test casse. Factoriser le prédicat reste possible plus
tard, quand `run-last-time.ts` sera ouvert.

## 3. Règles

- **R1** — `summarizeIntervalSeries` ne résume que les lignes `phaseKind === 'fast'` **et**
  `segmentKind === 'work'` : compte dans la plage, dénominateur, allure moyenne, régularité, plus lente et plus
  rapide, `fastCount`.
- **R2** — Pour toute liste de fractions écrite par le tracker (`buildIntervalDraft`) :
  `ratedCount === 0 ? null : { done: inRangeCount, total: ratedCount }` est **égal** à
  `repsInRange(lastTimeReps(rows))`, la tolérance de l'analyse étant 0.
- **R3** — Une sortie sans nature de segment (RUN-F2c, `segment_kind` nul lu `'work'`) garde **exactement** ses
  chiffres d'aujourd'hui.
- **R4** — Le tableau garde toutes ses lignes, dans l'ordre des phases ; seuls les libellés des lignes hors
  corps de séance changent (D2).
- **R5** — Inchangé : la section est absente sans aucune ligne ; l'en-tête « X sur Y » est absent quand aucune
  fraction n'est jugeable ; la ligne « Allure moyenne » est absente quand aucune fraction n'a d'allure mesurable.

## 4. Cas limites

| Cas | Hub | Analyse après CARDIO-08 |
|---|---|---|
| Sortie arrêtée **après l'échauffement** (aucune fraction) | pas de « X sur Y » | tableau d'une ligne « Échauf. », **sans** « X sur Y » ni allure moyenne (aujourd'hui : « 1 sur 1 », ou « 0 sur 1 » si l'échauffement est sorti de sa plage) |
| Fractions **sans plage prévue** (séance sans allure de référence) | pas de « X sur Y » | pas de « X sur Y » ; allure moyenne et régularité des seules fractions |
| Fraction franchie en **rattrapage silencieux** (réalisé nul, RUN-F2d R8 bis) | « — », non jugée | « — », non jugée, hors moyenne |
| **Deux blocs** de corps de séance (séries groupées, lot D) | toutes les fractions des deux blocs | idem — le compte porte sur tout le corps de séance |
| Segment de nature **« récupération »** en phase rapide | écarté | **écarté** (aujourd'hui : compté) |
| Sortie **RUN-F2c** sans nature de segment | toutes ses fractions | inchangée (R3) |
| Allure réalisée **sur une borne** de la plage | dans la plage | dans la plage (bornes incluses des deux côtés) |
| Échauffement **hors plage** | non montré | ligne « Échauf. » en couleur « hors plage », **sans effet** sur l'en-tête |

## 5. La sortie de référence, avant et après

Un fractionné « 6 × 400 m » complet, terminé aujourd'hui, réalisé pour une séance de type « Fractionné »
(le tracker n'écrit de fractions que pour une séance à blocs). Les gammes n'ont **pas** de récupération ; le
corps de séance en a une après **chaque** fraction, la dernière comprise (`expandIntervalPhases`) : 17 phases,
indices 0 à 16. Le même jeu sert au test A2
(plan, étape 1) et au jeu de données de vérification sur device (plan, étape 4) ; les chiffres sont figés par
le test.

| # | Phase | Prévu (allure) | Réalisé | Allure | Libellé après D2 |
|---|---|---|---|---|---|
| 0 | Échauffement 15 min | 5:40 – 6:10 | 2 500 m en 15:00 | 6:00 | Échauf. — **dans** la plage |
| 1-3 | Gammes 3 × 80 m | — | 0:18 · 0:17 · 0:19 | 3:45 · 3:33 · 3:58 | Gammes 1, 2, 3 |
| 4, 6, 8, 10, 12, 14 | Fractions 6 × 400 m | 3:50 – 4:00 | 1:34 · 1:33 · 1:35 · 1:34 · 1:35 · **1:40** | 3:55 · 3:53 · 3:58 · 3:55 · 3:58 · **4:10** | Fraction 1 → 6 ; la 6ᵉ **hors** plage |
| 5, 7, …, 15 | Récupérations 200 m trot | — | 200 m en 1:15 | 6:15 | Récup |
| 16 | Retour au calme 10 min | 6:00 – 6:30 | 1 450 m en 10:00 | 6:54 | Ret. calme — **hors** plage |

Sortie entière : 7,79 km en 42:55, soit 5:31/km — la méta de la carte d'arrivée.

| Chiffre | Hub (carte d'arrivée) | Analyse aujourd'hui | **Analyse après** |
|---|---|---|---|
| En-tête | Fractions : **5 sur 6** dans la plage | 6 sur 8 dans la plage | **5 sur 6 dans la plage** |
| Allure moyenne des fractions | — | 4:21 | **3:58** |
| Régularité | — | ± 61 s/km | **± 6 s/km** |

« 6 sur 8 » : l'échauffement (dans la plage) et le retour au calme (hors plage) s'ajoutent aux six fractions.

## 6. i18n (FR + EN)

- **D1** : aucune chaîne.
- **D2** : trois clés neuves, `running.realise.segmentRow.{warmup,drills,cooldown}` — FR « Échauf. »,
  « Gammes », « Ret. calme » ; EN « Warm-up », « Drills », « Cool-down ». Le segment « récupération » reprend
  `running.realise.recoveryRow` (« Récup » / « Rec. »). Nom complet pour le lecteur d'écran :
  `running.segmentKind.*`, existant dans les deux langues.
- Le rang (« Gammes 2 ») est un nombre, sans pluriel à gérer.
- Constaté, hors périmètre : l'en-tête anglais de l'analyse dit « 5 of 6 **on target** », le hub « 5 of 6
  **in range** ». Même chiffre, deux tournures ; le français dit « dans la plage » partout.

## 7. Hors ligne

Rien ne change : le résumé est un calcul pur sur les lignes `run_intervals` déjà présentes dans la base locale
(`useRunIntervals`). Aucune écriture, **aucune migration, aucune sync rule, aucune dépendance native**, aucun
effet sur Noryn (qui ne lit pas ce résumé). Le chiffre est le même en mode avion.

## 8. Hors périmètre

- Le hub Course, son accueil et l'allure de référence (CARDIO-02) ; les écrans Muscu et Nutrition.
- Le code de `run-last-time.ts` (D3).
- **La numérotation des fractions sur deux blocs** : l'analyse repart à « Fraction 1 » à chaque bloc
  (`row.rep`), le hub numérote en continu (1 → 10). Le compte est le même ; seuls les numéros diffèrent.
  Constaté ici, à porter au BACKLOG si Florian le souhaite.
- La tournure anglaise de l'en-tête (§6).

## 9. Critères d'acceptation et vérification

### 9.1 Ce que les tests prouvent

- **A1** — 🔴 d'abord : sur des lignes d'échauffement, de gammes, de retour au calme et de segment
  « récupération » mêlées à des fractions, le résumé ne compte que les fractions (R1). Échoue sur le code
  d'aujourd'hui.
- **A2** — 🔴 d'abord : la sortie du §5, construite par le même chemin que le tracker
  (`expandIntervalPhases` → `buildIntervalDraft`), donne **5 sur 6**, allure moyenne arrondie **238 s/km**
  (3:58), régularité arrondie **6 s/km**, `fastCount` 6. Aujourd'hui : 6 sur 8, 4:21, 61.
- **A3** — 🔴 d'abord : **les deux chiffres sont égaux** (R2) — `summarizeIntervalSeries` et
  `repsInRange(lastTimeReps(…))` sur les mêmes lignes, pour la sortie du §5 et pour chaque cas du §4.
- **A4** — R3 : une sortie sans nature de segment garde ses chiffres (les tests existants, tous en `'work'`,
  restent verts sans retouche).
- **A5** — Écran : sur la sortie du §5, l'en-tête de l'analyse affiche 5 sur 6, et la ligne sous le tableau
  l'allure moyenne 3:58 et la régularité ± 6 (aujourd'hui 4:21 et ± 61).
- **A6** — *(D2)* Écran : les libellés du §5, et le nom complet pour le lecteur d'écran.

### 9.2 Vérification sur device

À la demande seulement (CLAUDE.md, « Recette à la demande », depuis le 23/10/2026) : rien n'est consigné
dans le dépôt. Si Florian ou Damien la demande, l'agent donne dans la conversation le jeu de données (plan,
étape 4) et le parcours ; les chiffres attendus à l'écran sont ceux du §5 — carte d'arrivée « Fractions :
5 sur 6 dans la plage », analyse « 5 sur 6 », « 3:58 », « ± 6 s/km », libellés de la colonne de droite.
Le prompt de cadrage réservait RECETTES §100 : caduc avec la suppression de RECETTES.md.

## 10. Relecture

Relue le 23/10/2026 par un agent de revue, sur le code de `d604dec2`, chiffres recalculés par une copie fidèle
des cinq fonctions en jeu. **Confirmé** : un seul appelant ; aucun lecteur de `fastCount`, `slowestRep`,
`fastestRep` ; à population égale, même jugement des deux côtés ; 17 phases et toutes les allures du §5 ;
6 sur 8 / 4:21 / ± 61 avant, 5 sur 6 / 3:58 / ± 6 après ; clés i18n existantes ; les tests existants restent
verts. **Corrigé** à la suite :

- §1.4 : l'écart résiduel n'est pas l'arrondi du hub (un temps de 0,3 s s'arrondit à 0, il est jugé) mais
  durée positive (hub) contre allure positive (analyse), équivalentes pour toute ligne du tracker ;
- §1.5 et D2 : onze lignes « Fraction », pas dix ; la fuite dans l'en-tête suppose une plage résolue sur
  l'échauffement, celle dans la moyenne et la régularité non — c'est la plus fréquente ;
- D2 : nom complet pour le lecteur d'écran sur les lignes « Récup » aussi ; repli « Fraction n » pour une
  nature inconnue ;
- §5 : la sortie de vérification est rattachée à une séance « Fractionné » (le tracker n'écrit de
  fractions que pour une séance à blocs), gammes sans récupération, méta de la carte ;
- plan : fixtures d'A1 et d'A3 qui rendent le compte vraiment rouge, A5 ciblé sur la ligne de l'allure
  moyenne (trois lignes du tableau affichent aussi 3:58) et sur la régularité, A6 compté par une regex ancrée,
  garde complète du jeu SQL (course active, course du jour, séance du jour selon la requête de l'app, rejeu),
  convention de nommage des scripts, porte de validation et sortie du BACKLOG.
