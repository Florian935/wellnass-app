---
id: EFFORT-01
titre: "Les meilleurs efforts d'une sortie, et les médailles posées sur la carte"
roadmap: [5.43]
catalogue: [RUN-03]
etape: code
branche: dev
maj: 20/09/2026
---

# US EFFORT-01 — Les meilleurs efforts d'une sortie

> Issue de l'**analyse Strava du 20/09/2026** — [analyse-strava-2026-09.md](../../../product/analyse-strava-2026-09.md),
> §7.4 et §7.2, observations **O14**, **O17** et **O19**. Demande de Florian le 20/09 : maquetter et
> livrer « ce qui manque dans le module cardio vis-à-vis de Strava ».
>
> ⚠️ **Travail directement sur `dev`** (décision Florian, cf. FANT-01 et CARDIO-UX02), par exception
> à la règle « une branche par US » de [CLAUDE.md](../../../../CLAUDE.md).
>
> ✅ **Étape design franchie** : toile publiée le 20/09/2026 —
> <https://claude.ai/artifact/Fp7sCrnKZ3YbVink6RBt5U>, planches **1 (la carte)**, **3 (les meilleurs
> efforts)** et **10 (prototype jouable)**. Index dans [design/effort01-meilleurs-efforts-sortie/](../../../../design/effort01-meilleurs-efforts-sortie/).

## 1. Le problème

**Une sortie qui ne bat aucun record ne raconte rien.** Aujourd'hui, la fin d'une course affiche une
célébration **si et seulement si** un record tombe (`CelebrationCard`). Sinon : rien. Or un
deuxième ou un troisième meilleur temps est une information motivante — et l'app a déjà tout le
calcul pour la produire.

**Et la carte ne dit pas où l'effort a eu lieu.**
[RouteMap.tsx](../../../../apps/mobile/src/components/running/RouteMap.tsx) dessine **un tracé nu** :
pas de départ, pas d'arrivée, pas de sens, et surtout aucune annotation. Le coureur voit *qu'*il a
bien couru, jamais *où*.

**Trois constats vérifiés dans le code**, qui décident de toute la conception :

**C1 — 🔴 L'app est structurellement incapable de dire « 2ᵉ ».**
[`running_pace_records`](../../../../supabase/migrations/20260712120000_running_pace_records.sql)
porte un **index unique sur `(user_id, distance_key)`** : une seule ligne par distance, le meilleur
temps, point. C'est un **palmarès**, pas un journal. Le code le sait déjà —
[RunRecordWall.tsx](../../../../apps/mobile/src/components/running/RunRecordWall.tsx) porte
l'avertissement : *« `running_pace_records` ne garde qu'une ligne par distance : il n'y a pas
d'historique »*. Un classement suppose l'historique des efforts. **Il n'existe pas.**

**C2 — Le calcul ne rend que le temps, jamais l'endroit.**
[`bestSegmentTimeFromSamples`](../../../../packages/shared/src/pace-records.ts) parcourt la trace en
fenêtre glissante et retourne **un nombre de secondes**. Les indices de la fenêtre gagnante sont
calculés puis jetés. Sans eux, impossible de poser quoi que ce soit sur la carte.

**C3 — Le mile et le demi-mile n'existent pas.**
`RUNNING_RECORD_DISTANCES` connaît cinq distances : 1 km, 5 km, 10 km, semi, marathon. Strava en
affiche huit, dont **400 m**, **demi-mile** et **mile** (O14) — des repères que les coureurs
utilisent, surtout sur les sorties courtes, où nos cinq distances ne matchent souvent **aucune**
fenêtre : une sortie de 2 km n'a aujourd'hui **rien** à dire d'autre que « 1 km ».

## 2. Ce que fait cette US

1. **Un journal des efforts** : chaque course terminée écrit, pour chaque distance qu'elle atteint,
   le meilleur segment glissant — son temps **et sa position sur la trace**.
2. **Un écran « Tes meilleurs efforts »** sur une sortie : la liste des distances atteintes, chacune
   avec **son rang** dans toute l'histoire du coureur et **son écart au record**.
3. **Les médailles posées sur la carte**, à l'endroit exact où l'effort a eu lieu.
4. **Trois distances de plus** : 400 m, demi-mile, mile.
5. **Les marqueurs de la carte** qui manquaient : départ, arrivée, sens de parcours.

**Hors périmètre** — traités ailleurs ou plus tard : le rejeu animé du parcours (planche 2, US
séparée), le parcours/segment personnel (planche 6, **S1** de l'analyse), la variante de partage
transparente (**PARTAGE-02**), la cadence et les pas (capteur de montre → Health Connect, permission
supplémentaire à déclarer avant LANCE-00).

## 3. Règles métier

### 3.1 Les distances

**R1** — Huit distances, dans cet ordre :

| Clé | Mètres | Statut |
|---|---|---|
| `400m` | 400 | 🆕 |
| `halfmile` | 804,672 | 🆕 |
| `1k` | 1 000 | existante |
| `mile` | 1 609,344 | 🆕 |
| `5k` | 5 000 | existante |
| `10k` | 10 000 | existante |
| `semi` | 21 097,5 | existante |
| `marathon` | 42 195 | existante |

**R2** — Une distance ne produit un effort que si **la course l'atteint** (`cum[n-1] >= meters`).
Aucune ligne sinon — jamais de zéro, jamais de valeur nulle.

**R3** — Le **mur de records** du hub Course (`RunRecordWall`) continue d'afficher **les cinq
distances canoniques**. Les trois nouvelles vivent dans la fiche d'une sortie et derrière « tout
voir ». ⚠️ Contrainte [ADR-007](../../../adr/ADR-007-surfacage-analyses.md) : CARDIO-UX02 vient de
dégonfler ce hub, cette US ne le regonfle pas.

**R4** — `PREDICTION_SOURCE` reste `5k` : les prédictions de Riegel et la mise à jour de l'allure de
référence (5.31) sont **inchangées**. Ajouter des distances ne doit rien déplacer de ce qui existe.

### 3.2 L'effort et son rang

**R5** — Un **effort** est le meilleur segment glissant d'une distance **dans une course donnée**.
Un effort porte : la course, la distance, le temps en secondes, et les **deux bornes de la fenêtre**
(indices dans la trace + coordonnées interpolées).

**R6** — Le **rang** d'un effort est sa position parmi **tous** les efforts de la même distance, tous
temps confondus, classés par temps croissant. Rang 1 = le record.
**En cas d'égalité stricte au temps, le plus ancien passe devant** — on ne déclasse pas un record
existant avec un temps identique.

**R7** — 🔴 **Le rang n'est jamais stocké.** Il est calculé à l'affichage, depuis le journal. Stocker
un rang serait faux dès la course suivante : un effort classé 2ᵉ devient 3ᵉ sans que sa propre ligne
ait bougé. Le journal est matérialisé, le classement est dérivé.

**R8** — L'**écart** affiché est `temps de l'effort − meilleur temps de la distance`. Il vaut `0`
pour un record, et se formule toujours en positif : « à 9 s de ton record ».

**R9** — Le journal **ne remplace pas** `running_pace_records`. Le palmarès reste la source des
célébrations, du mur de records et de la mise à jour de l'allure de référence. Les deux sont écrits
**dans la même transaction, depuis le même décodage de trace** — la divergence est impossible par
construction.
📌 *Dette assumée et notée* : à terme, le palmarès se dérive du journal (`MIN(time)` par distance) et
la table disparaît. Hors périmètre ici : ça toucherait la célébration, `refPaceUpdated`, le mur et la
suppression de course.

**R9 bis** — 🔴 **Le palmarès garde CINQ distances, le journal en couvre HUIT** *(amendement du
20/09/2026, en cours d'implémentation — décision **D8**)*.

La version initiale de cette spec élargissait la contrainte `check` de
`running_pace_records.distance_key` aux huit clés. **C'était une erreur**, révélée en écrivant le
code : `computeRunRecords` alimente cette table, et lui faire rendre `'400m'` aurait fait **échouer
la remontée vers Postgres** — silencieusement côté SQLite local, bruyamment à la synchro.

La bonne séparation était déjà là, il suffisait de la respecter :

| | Distances | Rôle |
|---|---|---|
| `running_pace_records` (palmarès) | **5** canoniques | Célébrations, mur, allure de référence |
| `run_efforts` (journal) | **8** | Rang, écart, médailles, fiche de sortie |

Le record d'une distance neuve se lit comme le **minimum de son journal** — exactement là où vit
déjà son classement. **Aucune contrainte de base à élargir, aucun comportement existant déplacé.**
Un test-garde interdit désormais à `computeRunRecords` de rendre une clé hors des cinq.

### 3.3 Les médailles sur la carte

**R10** — Une médaille est posée au **milieu de la fenêtre** de l'effort, pas à son arrivée : c'est
le point qui représente le segment, et ça évite que deux distances imbriquées pointent le même
endroit.

**R11** — **Au plus deux médailles** sur la carte, celles des **meilleurs rangs** (rang croissant,
puis distance décroissante à égalité). Le reste vit dans la liste. Une carte annotée de huit
pastilles serait illisible sur 390 px.

**R12** — **Aucune médaille au-delà du rang 3.** Une sortie honnête sans podium garde une carte
propre : on ne décore pas un 12ᵉ temps.

**R13** — Si les deux médailles retenues sont à **moins de 44 px** l'une de l'autre à l'écran, on
n'en garde **qu'une** (le meilleur rang). Pas de désempilement automatique : deux pastilles qui se
chevauchent sont pires qu'une seule.

**R14** — La carte gagne aussi, **indépendamment des médailles** : un **point de départ** (vert), une
**arrivée** (damier), et **une flèche de sens** au milieu du tracé.

### 3.4 Cas limites

**R15** — **Course sans trace** (mode manuel, tapis — roadmap 5.21) : aucun effort, aucune médaille,
aucune carte. L'écran affiche une ligne honnête : « Sans tracé GPS, pas de meilleurs efforts. »

**R16** — **Trace trop courte** (< 400 m) : aucun effort. Même message.

**R17** — **Trace bruitée** : `cumulativeDistances` écarte déjà les points au-delà de
`MAX_PLAUSIBLE_SPEED_MS`. Aucune règle nouvelle — mais un effort dont l'allure moyenne descend sous
**2:00 /km** n'est **pas écrit** : c'est du bruit GPS, pas une performance.

**R18** — **Suppression d'une course** : ses efforts partent avec elle (soft delete, comme
`running_pace_records` aujourd'hui, cf. `run-repository.ts` l. 1237-1264).

**R19** — 🔴 **Rattrapage de l'historique.** Les courses déjà enregistrées n'ont **aucun** effort.
Sans rattrapage, le premier effort de chaque distance s'afficherait « 1ᵉʳ » alors que le coureur a
déjà couru quarante fois. Le rattrapage rejoue le calcul sur **toutes les courses terminées avec
trace**, une fois, en tâche de fond, à la première ouverture après mise à jour.
*Précédent exact* : [IMPORT-01](import01-import-donnees-externes.md) a découvert que
`personal_records` n'est pas dérivée et qu'un historique importé sans appel explicite n'aurait aucun
record. Même piège, même remède.

**R20** — Le rattrapage est **idempotent** : une course déjà traitée n'est pas recalculée (marqueur
`runs.efforts_computed_at`).

## 4. Modèle de données

**Une table neuve, aucune table modifiée** — sauf une colonne marqueur et une contrainte élargie.

```
run_efforts
  id              uuid    pk
  user_id         uuid    not null  → auth.users
  run_id          uuid    not null  → runs (cascade)
  distance_key    text    not null  check (400m|halfmile|1k|mile|5k|10k|semi|marathon)
  time_seconds    numeric not null  check (> 0)
  start_index     integer not null  -- borne basse de la fenêtre dans la trace
  end_index       integer not null  -- borne haute
  mid_lat         numeric           -- point milieu, pour la médaille (null si hors trace)
  mid_lon         numeric
  achieved_at     timestamptz not null
  created_at / updated_at / deleted_at
  unique (run_id, distance_key) where deleted_at is null
```

Plus :
- `runs.efforts_computed_at timestamptz null` — marqueur d'idempotence du rattrapage (R20).

❌ **Ce qui a été retiré du périmètre** : l'élargissement de la contrainte `check` de
`running_pace_records.distance_key`. Voir **R9 bis / D8** — le palmarès garde ses cinq distances,
donc **aucune table existante n'est modifiée**, à l'exception de la colonne marqueur ci-dessus.

⚠️ **`run_efforts` est une table synchronisée** → après la migration, **coller
[powersync-sync-rules.yaml](../../technical/powersync-sync-rules.yaml) dans le dashboard PowerSync et
redéployer**. Étape manuelle, **déjà oubliée une fois** ([CLAUDE.md](../../../../CLAUDE.md)).

## 5. Comportement offline

Conforme à [offline-sync.md](../../technical/offline-sync.md), sans exception :
- **tout le calcul est local** — la trace est déjà en SQLite, rien ne sort de l'appareil ;
- UUID généré côté client, timestamps UTC, **soft delete**, écriture **via repository** ;
- le rattrapage (R19) tourne **hors-ligne** comme en ligne : il ne lit que le local ;
- le rang (R7) est une requête locale sur `run_efforts`, donc **juste hors-ligne** — au périmètre de
  ce que l'appareil a synchronisé, ce qui est le contrat de toute l'app.

## 6. i18n — FR + EN

Aucune chaîne en dur. Clés sous `run.efforts.*` :

| Clé | FR | EN |
|---|---|---|
| `title` | Tes meilleurs efforts | Your best efforts |
| `rank` | {{n}}ᵉ meilleur temps | {{n}}th best time |
| `rankFirst` | Record personnel | Personal record |
| `gap` | à {{gap}} de ton record | {{gap}} off your record |
| `noRecordToday` | Aucun record aujourd'hui | No record today |
| `stillSomething` | Et pourtant, ton {{dist}} est le {{n}}ᵉ de toute ton histoire. | And yet your {{dist}} is the {{n}}th best you've ever run. |
| `noTrack` | Sans tracé GPS, pas de meilleurs efforts. | No GPS track, no best efforts. |
| `distances.400m` | 400 m | 400 m |
| `distances.halfmile` | Demi-mile | Half mile |
| `distances.mile` | 1 mile | 1 mile |

⚠️ **L'ordinal n'est pas interpolable** : « 2ᵉ » en FR, « 2nd » en EN, et l'anglais change de suffixe
selon le chiffre (1st / 2nd / 3rd / 4th). Utiliser `Intl.PluralRules` avec `type: 'ordinal'` et des
clés dédiées par catégorie, **pas** une concaténation.

## 7. Critères de recette

- [ ] Une course de 8 km sans record affiche **la liste de ses efforts**, chacun avec son rang et son écart.
- [ ] Une course qui bat un record affiche **« Record personnel »**, écart à zéro, et la célébration existante fonctionne toujours.
- [ ] Les trois nouvelles distances (400 m, demi-mile, mile) apparaissent sur une sortie assez longue.
- [ ] Une sortie de **2 km** a désormais quelque chose à dire (400 m, demi-mile, 1 km, mile).
- [ ] La carte montre **départ vert**, **arrivée damier** et **flèche de sens**.
- [ ] **Au plus deux médailles** sur la carte, aucune au-delà du rang 3.
- [ ] Deux médailles proches à l'écran → **une seule** s'affiche (R13).
- [ ] Toucher une médaille ouvre le détail de l'effort.
- [ ] Une course **sur tapis / sans GPS** affiche le message d'absence, sans carte ni médaille.
- [ ] **Le rattrapage** : après mise à jour, les rangs des anciennes courses sont justes (vérifier une distance déjà courue plusieurs fois).
- [ ] Supprimer une course fait disparaître ses efforts **et** ses rangs des autres courses se recalculent.
- [ ] **Mode avion** : tout fonctionne, rangs compris.
- [ ] **EN** : les ordinaux sont corrects (1st, 2nd, 3rd, 4th, 11th, 21st).
- [ ] Le **mur de records** du hub affiche toujours **cinq** distances, pas huit.
- [ ] Aucun ralentissement perceptible à l'ouverture d'une sortie ancienne.

## 8. Décisions prises dans cette spec

| # | Décision | Pourquoi |
|---|---|---|
| **D1** | Une table `run_efforts` plutôt que d'élargir `running_pace_records` | Le palmarès a un index unique par distance : c'est sa raison d'être. Un journal est un autre objet. |
| **D2** | Le rang **dérivé**, jamais stocké (R7) | Un rang stocké devient faux à la course suivante, sans que sa ligne bouge. |
| **D3** | Les deux tables coexistent (R9) | Fusionner toucherait célébration, mur, allure de référence et suppression — hors périmètre d'un lot de finition. Écrites dans la même transaction : pas de divergence possible. |
| **D4** | Deux médailles maximum, rien au-delà du rang 3 (R11, R12) | 390 px de large. Une carte décorée de huit pastilles ne se lit pas, et un 12ᵉ temps ne mérite pas une médaille. |
| **D5** | Médaille au **milieu** de la fenêtre (R10) | Le point d'arrivée fait se superposer les distances imbriquées. |
| **D6** | Le mur de records reste à **cinq** distances (R3) | CARDIO-UX02 vient de dégonfler ce hub ; ADR-007 interdit de le regonfler. |
| **D7** | Rattrapage d'historique **obligatoire** (R19) | Sans lui, tous les rangs sont faux au lancement. C'est le piège déjà rencontré sur `personal_records`. |
| **D8** | 🔴 Le palmarès garde **5** distances, le journal en couvre **8** (R9 bis) | *Décidé en écrivant le code, le 20/09.* Élargir la contrainte `check` aurait fait échouer la synchro Postgres dès la première course. La séparation palmarès / journal rendait l'élargissement inutile : le record d'une distance neuve est le minimum de son journal. **Zéro table existante modifiée.** |

## 9. Ce que cette US ne fait pas

- Pas de **cadence** ni de **pas** : capteur de montre, donc Health Connect, donc une permission de
  plus à porter dans la déclaration Play — qui ne se dépose qu'une fois (LANCE-00).
- Pas de **rejeu animé** du parcours (planche 2 de la toile) : US séparée.
- Pas de **parcours / segment personnel** (planche 6) : c'est **S1** de l'analyse, le gros morceau.
- Pas de **classement**, pas de comparaison à d'autres coureurs. Jamais dans cette US.
