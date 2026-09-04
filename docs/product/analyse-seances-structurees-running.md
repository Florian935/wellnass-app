# Analyse — ce qu'un plan de course réel demande, et ce que notre pilier running sait en faire

> **Statut** : analyse exploratoire, **aucune US cadrée**, **aucun engagement de périmètre**.
> **Date** : 04/09/2026 · **Déclencheur** : Florian, en suivant sur le terrain un plan « 5 km en
> moins de 20 minutes » généré par ChatGPT, constate que l'app ne sait pas porter ses séances.
> **Source analysée** : `Objectif 5 km en 20 min — Planification & suivi Garmin` (PDF, 12 semaines,
> 24 séances, 5 onglets de suivi).
> **Rien de ce qui suit n'est bloquant pour le lancement** : les 2 P0 restants sont ailleurs.

---

## 0. La conclusion, en un paragraphe

Le pilier running sait **mesurer** une course remarquablement bien — GPS, splits/km, records,
dénivelé, zones d'allure, polarisation, ACWR, prédiction Riegel. Ce qu'il ne sait pas, c'est
**prescrire** : il n'existe **nulle part dans le modèle de données une allure cible saisie par un
humain**. Toutes les allures de l'app sont **calculées** à partir d'un seul nombre — l'allure de
référence 5 km du profil — par une fonction à cinq branches figées
([`sessionTargetPace()`](../../packages/shared/src/running-paces.ts)). Or un plan réel ne
fonctionne pas ainsi : sur les 24 séances du PDF, on dénombre **quatorze plages d'allure cible
distinctes**, toutes écrites en clair par le coach — de 5:30–6:15/km pour le footing à 3:56–4:00/km
pour les fractions les plus rapides, en passant par 4:20–4:25 au seuil, 4:00 pile en affûtage et
une progression 4:35→4:25 — et **aucune** n'est dérivable des cinq bandes de l'app. Résultat mesuré
séance par séance (§3) : **0 des 24 séances est intégralement représentable**, 13 le sont dans leur
*structure* mais perdent leur *consigne d'allure*, et 11 ne sont pas représentables du tout. C'est
une asymétrie nette avec la musculation, où une séance porte déjà ses cibles explicites (séries,
répétitions, charge, repos) — et c'est un écart au persona principal, « l'assidu », dont la fiche
dit noir sur blanc qu'il « connaît son training (volume, RPE, surcharge progressive, **allures**) »
et craint « un outil trop simpliste qui ne suit pas son niveau » ([personas.md](personas.md)).

**Le point important pour le cadrage** : la brique la plus coûteuse — le moteur qui linéarise une
séance structurée en phases, la suit en direct, l'annonce à la voix et rattrape sa position après
un remontage d'écran — **existe déjà et est testée** (RUN-F2c/RUN-F2d, `session_intervals` +
[`running-intervals.ts`](../../packages/shared/src/running-intervals.ts)). L'essentiel du travail
n'est pas de construire un moteur, c'est de **desserrer trois contraintes** posées dans son modèle
de données et de **rendre l'allure saisissable**.

---

## 1. La source, et pourquoi elle est un bon banc d'essai

Le document n'est pas un plan « de magazine ». C'est un **classeur de travail** en cinq onglets,
déjà utilisé sur le terrain (6 séances sur 24 réalisées à la date du PDF) :

| Onglet | Contenu | Ce qu'il nous apprend |
|---|---|---|
| **Paramètres du bloc** | Date de début, date de course, objectif chrono (20:00), allure cible (4:00/km), vitesse (15 km/h), 2 séances/semaine, espacement minimal 48 h, réduction muscu −40 à 50 % la semaine de course | Un plan est **ancré sur une date d'objectif** et **négocie avec la musculation** |
| **Repères d'allure** | Table 200 m → 5 000 m, temps cible à 4:00/km (0:46, 1:36, 2:24, 3:12, 4:00, 4:48, 8:00, 12:00, 20:00) | L'unité mentale du coureur est le **chrono par fraction**, pas seulement l'allure |
| **Planification** | 24 lignes × 13 colonnes : type, objectif, corps de séance, allure/consigne, **RPE cible**, volume estimé, durée estimée | La séance est **une consigne rédigée**, pas seulement une distance |
| **Fiches détaillées** | Par séance : échauffement exact, corps + allure, récupérations, retour au calme, **à programmer sur la montre**, données à relever, **critère d'adaptation** | L'échauffement et le retour au calme sont **prescrits**, jamais implicites |
| **Journal réalisé + tours** | 40 colonnes de métriques globales, puis **une ligne par tour/répétition** (distance, temps, allure, récup, FC, cadence, foulée, contact sol, RPE du tour) | Le réalisé se lit **à la répétition**, pas seulement à la sortie |
| **Tableau de bord + règles** | Taux de réalisation, meilleures références, et une table « situation → décision » (douleur, jambes lourdes post squat/deadlift, sommeil < 6 h ou HRV dégradée, 2 premières reps trop dures, chaleur) | Un plan **se modifie** en fonction de l'état du jour |

C'est exactement le profil de notre persona principal. Et le PDF finit par une consigne qui résume
le problème : *« Ouvrir Fiches séances, filtrer sur l'ID de la séance et **programmer les étapes
dans Garmin** »*. Aujourd'hui, cette phrase ne peut pas dire « dans l'app ».

---

## 2. Anatomie d'un plan : cinq niveaux, dont trois nous manquent

| Niveau | Ce que c'est | Chez nous |
|---|---|---|
| **1. Le bloc** | 12 semaines ancrées sur une date de course et un objectif chrono | 🟡 `programs` a `duration_weeks` et `goal` (texte libre) — **ni date cible ni chrono cible** |
| **2. La semaine** | 2 séances, espacement ≥ 48 h, arbitrage avec la muscu | ✅ `planned_sessions` (date, `week_index`, report/saut) + COLLIS-01 pour le conflit muscu↔course |
| **3. La séance** | Un type, une intention, une consigne rédigée, un RPE cible, un volume estimé | 🔴 `sessions` porte **`name` + type + une cible distance XOR durée**. Pas de consigne, pas de RPE cible, pas de description, pas même de traduction du nom |
| **4. La structure interne** | Échauffement → corps (blocs, allures, récups) → retour au calme | 🟡 `session_intervals` existe (RUN-F2c) mais **plat, réservé au fractionné, sans échauffement ni retour au calme, sans allure absolue** |
| **5. Le réalisé** | 40 métriques globales **+ une ligne par répétition** | 🔴 `runs` = 12 champs globaux + trace GPS. **Aucune trace du réalisé par répétition** |

---

## 3. Les 24 séances passées au tamis du modèle actuel

Verdict par séance. « Structure » = la forme (blocs, répétitions, récupérations) ; « Intensité » =
la consigne d'allure/chrono. Rappel du modèle testé : `session_type` ∈
{`endurance`, `fractionne`, `sortie_longue`, `recuperation`}, **une** cible par séance (distance
**ou** durée), et des blocs `session_intervals` **uniquement si le type est `fractionne`**, chaque
bloc = `reps` × (rapide : distance **ou** durée, + un `%VMA` entier) + (récup : distance **ou** durée).

| ID | Ce que le plan demande | Structure | Intensité | Ce qui se perd |
|---|---|:--:|:--:|---|
| S01 | 35 min faciles + 6×20 s rapides / 60 s très lentes, 5:30–6:15/km | ❌ | ❌ | Les lignes droites dans un footing : blocs interdits hors `fractionne` |
| S02 | Test 3 km chrono, km1 contrôlé / km2 soutenu / km3 à fond | ❌ | ❌ | Pas de type « test », pas de plan de gestion par km |
| S03 | 8×400 m **en 1:38–1:40** (4:05–4:10/km) / récup 1:15 | ✅ | ❌ | Le chrono par fraction ; la plage ; « trot très lent ou marche » |
| S04 | 2×8 min **à 4:30–4:35/km** / récup 3 min | ✅ | ❌ | L'allure de seuil, convertie de force en un `%VMA` entier |
| S05 | 6×600 m en 2:24–2:27 (4:00–4:05) / récup 1:30 | ✅ | ❌ | Idem S03 |
| S06 | 45–50 min faciles + 6×15 s d'accélération / 60 s | ❌ | ❌ | Idem S01 |
| S07 | 5×800 m en 3:14–3:17 (4:03–4:06) / récup 2 min | ✅ | ❌ | Idem S03 |
| S08 | 3×8 min à 4:20–4:25/km / récup 2:30 | ✅ | ❌ | Idem S04 |
| S09 | 4×1 000 m en 4:02–4:05 / récup 2:30 | ✅ | ❌ | Idem S03 + « le dernier aussi propre que le premier » |
| S10 | **20 min continues à 4:20–4:25/km au milieu** d'une sortie de 45–50 min | ❌ | ❌ | Un bloc inséré dans une sortie : inexprimable |
| S11 | 3×1 200 m en 4:50–4:54 (4:02–4:05) / récup 2:30 | ✅ | ❌ | Idem S03 |
| S12 | 45 min faciles + 8×20 s rapides / 60 s lentes | ❌ | ❌ | Idem S01 |
| S13 | 3×1 000 m en 3:56–4:00 / récup 3 min **puis** 4×200 m en 44–46 s / 60 s | ✅ | ❌ | Rien sur la forme (2 lignes de blocs) — tout sur l'allure |
| S14 | 2×2 000 m en 8:08–8:12 (4:04–4:06) / récup 3 min | ✅ | ❌ | Idem S03 |
| S15 | 10×400 m en 1:36–1:38 / récup 1:10 | ✅ | ❌ | Idem S03 |
| S16 | 50 min faciles **dont les 10 dernières de 4:35 vers 4:25** + 6×15 s | ❌ | ❌ | Progression d'allure continue : aucun modèle |
| S17 | 5×1 000 m en 3:58–4:02 / récup 2:30 | ✅ | ❌ | Idem S03 |
| S18 | Test 3 km, repère visé 11:45–12:00, départ ~4:00/km | ❌ | ❌ | Idem S02 |
| S19 | **3×(800 m en 3:10–3:12 + 400 m en 1:34–1:36)**, récup 1:30 intra / 3 min inter | ❌ | ❌ | Groupe imbriqué : un bloc = **une seule** paire rapide/récup |
| S20 | 50–55 min faciles + 8×20 s / 60 s | ❌ | ❌ | Idem S01 |
| S21 | 2×2 000 m en 8:00–8:04 / récup 3 min **puis** 1×1 000 m en 3:58–4:00 | ✅ | ❌ | Idem S13 |
| S22 | 40 min faciles **incluant** 2×6 min à 4:20–4:25/km / récup 3 min | ❌ | ❌ | Idem S10 |
| S23 | 25–30 min faciles + 4×400 m **en 1:36 exactement** / récup 2 min | ✅ | ❌ | Le footing d'enrobage disparaît ; le chrono exact aussi |
| S24 | Course : 5 km en **4:02 / 4:00 / 4:00 / 3:58–4:00 + accélération**, passages 2 km ≈ 8:02, 3 km ≈ 12:02 | ❌ | ❌ | Pas de type « course », pas d'objectif chrono, pas de plan par km |

**Bilan chiffré** — structure représentable : **13 / 24**. Intensité représentable : **0 / 24**.
Séances intégralement représentables : **0 / 24**.
Et sur un axe qui traverse tout le plan : **24 séances sur 24 prescrivent un échauffement précis**
(de « 8–10 min très faciles + 2 min de mobilité » à « 12–15 min + mobilité 3–4 min + gammes 2×20 m
+ 3 accélérations de 15–20 s »), et **24 sur 24 un retour au calme** (celui de S16 conditionnel) —
**0 sur 24 est représentable**.

---

## 4. Les murs, un par un, avec la preuve dans le code

### M1 — L'allure cible n'est pas une donnée, c'est une fonction
`sessionTargetPace(type, ref5kPaceSPerKm)` retourne une plage **calculée** : endurance = réf +60/+90,
sortie longue = réf +30/+60, récupération = réf +90/+120, fractionné = VMA→réf. Cinq bandes, en
dur. Aucune colonne `target_pace_*` n'existe ni sur `sessions`, ni sur `session_intervals`.
Conséquence : le nombre le plus important de la séance — celui que le coureur a en tête pendant
qu'il court — **ne peut pas entrer dans l'app**.
→ [running-paces.ts](../../packages/shared/src/running-paces.ts) · [20260712100000_running_session_content.sql](../../supabase/migrations/20260712100000_running_session_content.sql)

### M2 — L'intensité d'un bloc s'exprime en `%VMA` entier, dérivé d'une dérivée
`session_intervals.fast_pace_pct_vma integer`. Or la VMA elle-même est dérivée : `derivedVmaPace =
ref5kPace × 0,95`, coefficient figé. Écrire « 4:30/km » demande donc deux conversions puis un
arrondi à l'entier, et le résultat (« 84 % VMA ») ne veut plus rien dire dans le vocabulaire du
plan, qui parle de **seuil**. Et la récupération, elle, n'a **aucune** cible d'intensité : le plan
distingue pourtant systématiquement « trot très lent » et « marche active ».

### M3 — Une cible par phase : distance **ou** durée, jamais les deux
La règle est explicite dans le code : *« Exactement une des deux cibles est renseignée (RUN-F2c
R2/R3) »*. Mais « 8 × 400 m **en 1:38** » est précisément **une distance ET un temps** : la distance
est l'étendue, le temps est la cible. C'est la forme canonique de toute séance de VMA — **12 des 24
séances** du plan l'emploient. Le modèle ne peut pas l'écrire.
→ [running-intervals.ts](../../packages/shared/src/running-intervals.ts)

### M4 — Aucune notion de plage
Le plan écrit systématiquement des fourchettes : 1:38–1:40, 4:05–4:10, 11:45–12:00, 45–50 min.
Le modèle ne stocke que des scalaires. Ironie : `sessionTargetPace` **retourne** une plage — mais
uniquement celle qu'il a calculée lui-même, jamais celle qu'un humain a voulue.

### M5 — Ni échauffement, ni retour au calme
`session_intervals` n'a pas de colonne de nature : pas de `kind`, pas de libellé. Un bloc est un
bloc. On ne peut donc ni marquer « échauffement », ni « gammes », ni « retour au calme ».
**Le précédent existe pourtant à côté** : `exercise_plans.set_type` accepte déjà `'warmup'` côté
musculation. Le running n'a pas hérité du patron.

### M6 — Les blocs sont interdits hors du type `fractionne`
Restriction posée par RUN-F2c (R5), appliquée côté app
([RunningSessionEditor.tsx](../../apps/mobile/src/components/running/RunningSessionEditor.tsx)) et
documentée dans la migration. Elle paraît anodine ; c'est en réalité **le mur qui bloque le plus de
séances** : 6 des 24 (S01, S06, S12, S16, S20, S22) sont des footings **contenant** une structure —
lignes droites, rappels de vitesse, tempo inséré — et deux autres (S10, S23) y perdent leur footing
d'enrobage. Les typer `fractionne` pour leur donner des blocs détruirait leur nature (et fausserait
toutes les analyses par type).

### M7 — Pas de groupe imbriqué
Un bloc = `reps` × (**une** phase rapide + **une** récup). « 3×(800 m + 400 m) » avec récup 1:30 à
l'intérieur et 3 min entre les groupes demande **un niveau d'imbrication**. Au-delà de S19, c'est
toute la famille des pyramides et des échelles (400-800-1200-800-400) qui reste hors d'atteinte.

### M8 — Pas de séance à allure variable continue
Trois formes présentes dans le plan, aucune modélisable : le **tempo inséré** (S10, S22 : un bloc au
milieu d'un footing), la **progression** (S16 : les 10 dernières minutes de 4:35 vers 4:25), et le
**negative split prescrit** (S24 : chaque km a son allure). L'app sait *constater* un negative split
après coup (ALLURE-01, RUN-11) — elle ne sait pas le *demander*.

### M9 — Ni séance « test », ni séance « course »
Le plan en contient trois (S02, S18, S24) et ce sont les plus importantes : ce sont elles qui
calibrent tout le reste. Aucun type ne les porte, aucun champ ne porte un objectif chrono.
**Le paradoxe est net** : RUN-14 sait *prédire* un temps de course par Riegel, et la roadmap 5.31
sait *recaler* l'allure de référence sur un record 5 km — mais nulle part on ne peut écrire
« ma course est le 25/10/2026 et je vise 20:00 ».

### M10 — Le réalisé ne descend jamais au niveau de la répétition
`runs` stocke 12 champs globaux + la trace GPS. Les trois colonnes `interval_phase_*` ajoutées par
RUN-F2d sont un **curseur de position en direct** pour le guidage vocal — pas un résultat : elles
sont écrasées à chaque transition. Il n'existe donc **aucune table du réalisé par répétition**, et
`compareToTarget` ne compare que la distance et la durée **globales**. Tout l'onglet « Détail des
tours » du PDF — 13 colonnes par répétition, avec les commentaires du coureur sur la fraction 6 et
la fraction 7 — n'a aucun équivalent. C'est pourtant là que se lit une séance de fractionné :
non pas « j'ai couru 8 km » mais « mes reps 1 à 5 étaient à 4:01, la 7ᵉ a lâché à 4:40 ».

### M11 — Pas de consigne textuelle, et pas d'i18n sur les séances
`sessions.name` est une **colonne texte simple** — il n'existe pas de `session_translations` (noté
explicitement dans le seed CONTENU-01). Donc : ni objectif rédigé, ni consigne, ni critère
d'adaptation, ni traduction EN pour la bibliothèque. Le PDF consacre **trois colonnes entières** à
ce texte, et c'est lui qui fait la différence entre « 5×1 000 m » et « 5×1 000 m — **ne pas
accélérer le premier** ».

### M12 — Pas de bloc de préparation daté
`programs` : `duration_weeks`, `goal` (texte libre), niveau. Pas de date d'objectif, pas de chrono
visé, pas d'événement. Le calendrier existe pourtant déjà (`planned_sessions.scheduled_date` +
`week_index`, et l'heure arrive avec HORAIRE-01) : il manque **l'ancre**, pas le calendrier.
Conséquence : aucun « J-42 », aucune logique d'affûtage, aucun taux de réalisation de bloc.

### M13 — Le pilotage en direct ne dit pas si on est à l'allure
[run/active.tsx](../../apps/mobile/src/app/run/active.tsx) affiche l'allure instantanée et l'allure
moyenne, et depuis RUN-F2b la cible **de distance/durée**. Il n'affiche **pas** d'allure cible, ne
signale pas la sortie de plage, et n'alerte pas à la voix (« tu es 6 s/km trop lent »). Le PDF
demande pourtant, pour S10, *« programmer un bloc de 20 min avec **alerte d'allure** 4:20–4:25/km »*.
RUN-F2d annonce le **changement de phase** ; personne n'annonce **l'écart à l'allure**.

### M14 — Les métriques physiologiques absentes (connu, documenté)
FC, cadence, longueur de foulée, temps de contact au sol, oscillation verticale, Training Effect,
charge, HRV, sommeil, Body Battery, température, chaussures. Le journal du PDF en compte **plus de
40**. C'est un écart **déjà tranché** (V2 = wearables ; RUN-23 et RUN-24 du
[catalogue](analyses-donnees.md) portent la dette). À ne pas confondre avec les murs M1→M13, qui
eux ne demandent **aucun capteur** : ils sont purement de modélisation.

### M15 — Aucune règle d'adaptation
Le PDF se termine par une table « situation → décision » : douleur mécanique → arrêter ; jambes
lourdes après squat/deadlift → décaler 24 h ou transformer en footing ; sommeil < 6 h ou HRV
dégradée → **garder l'échauffement, réduire de 20–30 % les répétitions** ; deux premières reps trop
dures → ralentir de 3–5 s/km ; chaleur → courir à l'effort, pas au chrono.
Nous avons **toutes les entrées** de cette table — DOUL-01 (douleur), BIEN-01 (check-in, sommeil),
RUN-18 et META-19 / GARDE-01 (charge, ACWR), COLLIS-01 (collision jambes/course) — et **aucune
sortie** : rien ne modifie jamais la séance du jour. C'est la marche qui sépare un carnet
d'entraînement d'un coach.

---

## 5. Ce qui existe déjà — à ne surtout pas reconstruire

Le diagnostic est sévère sur la modélisation ; il ne l'est pas sur le moteur. Ce qui est **déjà
livré, testé, et directement réutilisable** :

- **Le linéariseur de séance structurée.** `expandIntervalPhases` transforme des blocs en liste
  ordonnée de phases ; `resyncIntervalPhase` rattrape plusieurs phases franchies d'un coup après un
  remontage d'écran, en reportant le surplus au lieu de l'écraser. C'est la partie subtile, et elle
  est faite.
- **La chaîne d'annonce.** RUN-F2a (annonces audio périodiques, `expo-speech`), RUN-F2d (voix +
  vibration à chaque changement de phase). Ajouter une alerte d'allure, c'est étendre une chaîne
  existante, pas en créer une.
- **La carte objectif en direct.** RUN-F2b affiche déjà une cible pendant la course, en réutilisant
  `compareToTarget`/`useRunTarget` et les libellés `running.target.*`.
- **Le calendrier.** `planned_sessions` (date, semaine, `planned`/`done`/`skipped`, report, saut),
  plus l'heure de séance en cours de livraison (HORAIRE-01, branche courante).
- **Le patron musculation.** `exercise_plans` porte déjà `set_type` (dont `'warmup'`), `target_sets`,
  `target_reps`, `target_weight_kg`, `rest_seconds`. RUN-F2c a explicitement copié ce patron pour
  les blocs ; il suffit de continuer à le copier pour la nature du segment et les cibles.
- **Tout l'aval analytique.** `computeKmSplits`, records, ALLURE-01 (negative split, zones d'allure,
  fade, polarisation), RUN-18 (ACWR), RUN-14 (Riegel). Dès qu'un réalisé par répétition existera,
  ces briques auront de la matière neuve sans être touchées.

Autrement dit : **l'essentiel du travail est du modèle de données et de l'éditeur, pas du moteur.**

---

## 6. Découpage proposé — dix lots, du socle au coach

Ordre de dépendance, pas de priorité. Les efforts sont des ordres de grandeur, à instruire.

| Lot | Ce que ça débloque | Murs traités | Effort | Dépend de |
|---|---|---|---|---|
| **A — L'allure cible devient une donnée** | Deux colonnes de plage (`target_pace_min/max_s_per_km`) sur la séance **et** sur la phase rapide, plus une intensité de récupération (trot/marche/libre). Vides = comportement actuel inchangé, donc **rétrocompatible**. | M1, M2, M4 | S/M | — |
| **B — La séance devient une suite de segments typés** | Une colonne de nature sur les blocs (`warmup` / `drills` / `work` / `recovery` / `cooldown`), **et la levée de la restriction « blocs réservés au fractionné »**. À lui seul, ce lot débloque 6 séances du plan + les 24 échauffements. | M5, M6 | M | — |
| **C — Distance ET temps sur une phase** | « 400 m en 1:38 ». Demande de revoir la règle de fin de phase (aujourd'hui la distance l'emporte) : la distance devient l'étendue, le temps la cible. | M3 | S/M | A |
| **D — Un niveau d'imbrication** | `3×(800 + 400)`, pyramides, échelles. Touche le linéariseur et les deux éditeurs (mobile + admin). **Le lot le plus cher pour le gain le plus étroit** — à arbitrer, peut-être à repousser. | M7 | M/L | B |
| **E — Piloter à l'allure en direct** | Allure cible du segment courant à l'écran, signal dans/hors plage, alerte vocale d'écart. Extension de RUN-F2a/F2b/F2d. | M13 | M | A |
| **F — Le réalisé par répétition** | Nouvelle table `run_intervals` (une ligne par phase : prévu, réalisé, allure moyenne), alimentée à chaque transition — **le curseur qui la nourrit existe déjà**. Puis le tableau « rep par rep » au résumé, et le prévu/réalisé au niveau de la fraction. | M10 | M/L | B |
| **G — Séance test et séance course** | Types `test` et `course`, objectif chrono, plan de passage par km. Se rebranche sur la MAJ auto de l'allure de référence (5.31) et sur Riegel (RUN-14), déjà livrés. | M9 | M | A |
| **H — Le bloc de préparation daté** | Date d'objectif + chrono visé sur le programme. Débloque « J-42 », le taux de réalisation du bloc, la logique d'affûtage. **Petit lot, valeur perçue forte.** | M12 | S | — |
| **I — Consignes rédigées + i18n des séances** | Description/objectif/critère d'adaptation sur la séance, et la table de traduction qui manque à la bibliothèque. | M11 | S/M | — |
| **J — Les règles d'adaptation (le coach)** | Croise DOUL-01, BIEN-01, RUN-18/META-19/GARDE-01, COLLIS-01 pour **proposer une séance modifiée du jour**. Sujet produit à part entière, à cadrer seul. | M15 | L | B, F |

**Séquence recommandée** : **A → B → C**, puis **E** et **I** (visibles vite, peu coûteux), puis
**H** et **G**, puis **F**. **D** à arbitrer. **J** dans une réflexion séparée.

Un raccourci à considérer : **A + B + C forment un ensemble cohérent d'une seule US** (« une séance
de course porte enfin sa consigne »). Les trois touchent le même modèle, le même éditeur et la même
migration ; les livrer séparément multiplierait les migrations et les allers-retours d'éditeur pour
un bénéfice de découpage discutable.

---

## 7. Ce que cette analyse ne dit pas — les arbitrages à trancher

1. **Coexistence ou remplacement du `%VMA` ?** `fast_pace_pct_vma` est livré et en recette. Deux
   voies : le garder à côté de l'allure absolue (dérivé vs explicite, l'un remplit l'autre), ou le
   migrer. La première est rétrocompatible, la seconde est plus propre. **À trancher au cadrage.**
2. **Qui saisit ces séances ?** Trois réponses très différentes : (a) l'utilisateur à la main dans
   l'éditeur mobile — il faut alors un éditeur bien plus riche ; (b) le back-office, pour enrichir
   la bibliothèque de programmes ; (c) un **import** (le PDF vient de ChatGPT, et l'idée « import IA
   de fichiers Excel/Sheets » existe déjà dans [IDEAS.md](../../IDEAS.md) pour le SaaS coach).
   La réponse change l'ergonomie, pas le modèle — mais elle change beaucoup l'effort.
3. **Jusqu'où aller sans capteur ?** M1→M13 ne demandent aucune FC. M14 en demande. Ne pas laisser
   le second contaminer le cadrage du premier : **on peut prescrire et vérifier une allure avec le
   seul GPS**, c'est ce que fait le plan du PDF pour 22 séances sur 24.
4. **Est-ce le bon persona au bon moment ?** L'assidu « connaît les allures », mais le débutant
   motivé craint d'être « noyé ». Une séance qui affiche une plage d'allure, un échauffement et
   quatre segments est plus intimidante qu'un bouton « Démarrer ». Le principe « intégration sans
   imposition » (décision H) suggère la réponse : **une séance sans consigne reste une séance sans
   consigne** — les champs vides ne s'affichent pas.
5. **La séance libre reste la porte d'entrée.** Rien ici ne doit alourdir le chemin « j'ouvre, je
   tape Démarrer, je cours ». C'est le cas d'usage majoritaire et il fonctionne.

---

## 8. Rattachements

- **Roadmap** : V0.5 Running (5.1→5.34) est ✅ sur toute la ligne — ce qui est cohérent, car
  **aucune ligne de la roadmap ne demandait une allure cible saisie**. La 5.9 disait « ex. 6×400 m
  à 95 % VMA » et c'est exactement ce qui a été livré. L'écart n'est pas une régression : c'est un
  **périmètre qui n'a jamais été cadré**. Ces lots créeraient de nouvelles lignes.
- **Spec running** : ⚠️ [running.md §4.6](../specs/functional/running.md) annonce déjà, dans le
  tableau « Détail d'une séance », trois champs **qui n'existent pas** : *Allure cible*,
  *Structure : liste de blocs ordonnés (échauffement / blocs principaux / retour au calme)* et
  *Description : consignes textuelles*. La spec fonctionnelle avait donc **prévu juste** ; c'est
  l'implémentation qui s'est arrêtée avant. À corriger dans la spec ou à livrer — mais pas à
  laisser tel quel, un lecteur croirait le périmètre couvert.
- **Catalogue d'analyses** : le lot F (réalisé par répétition) est un **débloqueur** pour
  RUN-07 (⏳, faute de `session_type` sur `runs`), et donne de la matière neuve à RUN-19 (prévu vs
  réalisé, aujourd'hui global) et RUN-13 (régularité).
- **Idées existantes recoupées** : l'entrée du 16/07/2026 sur l'import GPX/FIT (le PDF est un cas
  d'école : ces séances viennent d'une montre Garmin) et l'entrée du 15/07/2026 sur le SaaS coach
  (l'import IA de plans structurés y est déjà le *wedge*).
