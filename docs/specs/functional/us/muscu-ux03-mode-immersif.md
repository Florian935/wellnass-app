---
id: MUSCU-UX03
titre: "Mode immersif de la séance de musculation — la séance vivante, en plus du mode classique"
roadmap: [3.61]
catalogue: []
etape: recette
branche: feature/muscu-ux03-mode-immersif
maj: 13/09/2026
---
# US MUSCU-UX03 — Mode immersif de la séance de musculation

> **Maquettes accueillies par Florian le 13/09/2026** (« c'est incroyable, j'adore ») :
> [design/muscu-ux03-mode-immersif/](../../../../design/muscu-ux03-mode-immersif/) — deux toiles,
> dont un **prototype jouable** (voix, sons, vibrations). Plan : [docs/plans/muscu-ux03-mode-immersif.md](../../../plans/muscu-ux03-mode-immersif.md).
>
> Développée dans un **worktree isolé** (`.claude/worktrees/muscu-immersif`) : d'autres sessions
> travaillent en parallèle sur le hub (`dash01`), la nutrition (`nutri-refonte`) et le corps (`corps02`).

## 0. Contexte et décisions acquises

### 0.1 Le constat

L'écran de séance est **juste** depuis MUSCU-UX01 (geste sous le pouce, barre d'action fixe, trois
niveaux) et **animé** depuis MOTION-01 (anneau de repos, enfoncement, pop de record au résumé). Il
reste **muet** : une série moyenne et un record reçoivent la même réponse (30 ms de vibration), les
records ne sont connus qu'à la clôture, l'effort lui-même est un temps mort pour l'app, et le repos
— la moitié de la séance — est le moment où l'on part sur une autre app et où l'on décroche.

Demande de Florian (12/09/2026) : une séance **plus immersive**, qui retient, « qui envoie du peps »,
qui sorte du lot face aux apps du marché — **sans en faire trop**.

### 0.2 Décisions acquises

| # | Décision | Source |
|---|---|---|
| D1 | **L'immersif est un mode en plus, le classique reste.** Certains utilisateurs veulent « leur série, point barre ». | Florian, 13/09/2026 |
| D2 | La **seconde toile** (`2-seance-vivante`) prime sur la première là où elles divergent (la première dessinait un remplacement). | Conséquence de D1 |
| D3 | **Mode classique** : aucun ajout pendant l'effort ni au repos ; **seule une pastille discrète quand un record tombe**. | Délégué par Florian (« fais selon ce qui te semble le plus cohérent »), tranché ici |
| D4 | **Tout le périmètre maquetté est implémenté**, sauf ce que le §11 exclut pour une raison de fond. Retours reportés à la recette. | Florian, 13/09/2026 (« on verra au recettage quand tu auras implémenté tout ça ») |
| D5 | **Aucune migration, aucune sync rule, aucune dépendance native nouvelle.** Préférences locales à l'appareil (`secureStorage`), comme `motion-store`. | Choix de conception, recettable sur un build de la branche |

### 0.3 À acter (ne bloque pas le code)

- **A1 — Le fantôme, le défi de dernière série et la cérémonie de fin, face à la décision C**
  (gamification hors V1). Ce sont des **comparaisons avec soi-même**, sans points, niveaux ni badges :
  compatibles avec la lettre de C. Les trois sont implémentés, le fantôme et le défi sont coupables
  dans les réglages, et l'ensemble est **à acter** par Florian ou Damien dans
  [SYNTHESE-CADRAGE.md](../../../../SYNTHESE-CADRAGE.md).
- **A2 — L'abonnement.** Trois options maquettées ; **recommandation A** : immersif gratuit, coach
  IA payant (palier IA). **Sans effet sur cette US** : la V1 est 100 % gratuite (décision D) et le
  coach IA est hors périmètre (§11). Aucun verrou RevenueCat n'est posé ici.

## 1. Périmètre

Identifiants de mécanique utilisés dans tout le document et dans le plan :

| Id | Mécanique | Mode |
|---|---|---|
| **MO** | Choix du mode (accueil, premier lancement, réglages, bascule en séance) | les deux |
| **RC** | Pastille de record en direct | classique |
| **SC** | Écran de séance immersif : fond sombre, scène + pont, plan de séance en tiroir | immersif |
| **BR** | Entrée en séance (brief) | immersif |
| **BC** | Barre chargée (disques à mettre de chaque côté) | immersif |
| **EF** | Série en direct : tempo, compteur de reps, temps sous tension | immersif |
| **CA** | Cadran de reps et ressenti en un mot | immersif |
| **VE** | Verdict comparé à la dernière fois | immersif |
| **RL** | Records en direct : pastille ambre, plein écran de record | immersif (+ RC en classique) |
| **AJ** | Ajustement proposé de la série suivante | immersif |
| **RP** | Repos qui respire : guide, 3-2-1, « Prépare-toi », veille | immersif |
| **FA** | Le fantôme de la dernière séance | immersif |
| **CO** | Le corps qui chauffe | immersif |
| **EB** | Exercice bouclé | immersif |
| **DS** | Dernière série : défi chiffré | immersif |
| **FI** | Fin de séance : cérémonie, relais nutrition | immersif |
| **PA** | Carte à partager, variante « Corps » | immersif |
| **VO** | Coach vocal à gabarits (synthèse vocale du téléphone, hors ligne) | immersif |
| **NO** | Le fil : notification de repos et rappel de fin de repos | les deux (défauts différents) |

## 2. Le choix du mode (MO)

**R-MO-1 — Deux modes, une préférence.** `classic` | `immersive`, stockée localement
(`secureStorage`, clé `workout_display_mode`), **défaut `classic`**. Elle ne touche ni les données
de la séance ni le niveau d'affichage (`profile.workoutDisplayLevel`, inchangé, qui vaut pour les deux).

**R-MO-2 — Sur l'accueil du pilier.** La carte « Séance du jour » (`StrengthNowCard`, état `today`)
porte un sélecteur **Classique · Immersif** au-dessus du bouton principal. Le changer met à jour la
préférence. Les états `resume`, `rest` et `onboarding` ne portent pas de sélecteur (on n'y démarre
pas une séance de programme ; la séance libre suit la préférence).

**R-MO-3 — Au tout premier démarrage.** Tant qu'aucun choix n'a été fait (`workout_mode_chosen`
absent) **et** que l'utilisateur n'a **aucune séance terminée**, « Commencer » ouvre d'abord une
feuille « Comment veux-tu t'entraîner ? » : les deux modes avec leur aperçu, rien de coché, case
« Retenir mon choix » cochée par défaut. Un utilisateur **qui a déjà un historique** ne voit jamais
cette feuille : il garde le classique et découvre l'immersif par le sélecteur (pas de surprise).

**R-MO-4 — En pleine séance.** Le menu ⋮ des deux écrans porte une ligne **Mode d'affichage**.
Basculer **remplace l'écran sans rien perdre** : même séance, séries validées, série courante, repos
en cours (l'échéance est conservée), dérogation de focus. Aucune écriture en base.

**R-MO-5 — Réglages › Séance.** Nouvel écran regroupant : mode par défaut, niveau d'affichage
(repris), et les interrupteurs du mode immersif (§6). Accessible depuis les Réglages.

## 3. Le mode classique

**R-CL-1 — Inchangé.** Tout ce que l'écran de séance fait aujourd'hui reste à l'identique (inventaire
exhaustif : toile 1, page « Rien ne se perd » › Inventaire).

**R-CL-2 — Pastille de record (RC).** Quand une série validée bat la **charge maximale** ou le
**1RM estimé** enregistrés pour l'exercice (règles §5.4), une pastille ambre « Record · charge max »
ou « Record · 1RM estimé X kg » apparaît **en tête de l'écran de repos** — et dans sa barre réduite —
pendant **4 s**, accompagnée de la vibration `hapticMilestone`. ⚠️ **Pas sur la carte de série** : la
validation lance le repos, et `RestOverlay` est un plein écran (`StyleSheet.absoluteFill`) ; une
pastille posée sur la carte serait recouverte pendant toute sa durée. Pas de plein écran de record, pas de voix, pas de verdict.

**R-CL-3 — Notification de repos (NO)** disponible mais **désactivée par défaut** en classique.

## 4. Le mode immersif — l'écran

### 4.1 Structure (SC)

- **Fond sombre de séance quel que soit le thème de l'app** : palette `dark` du thème, appliquée à
  l'écran de séance seul. Les composants de séance reçoivent déjà leurs couleurs en **prop**
  (`colors`), il n'y a donc rien à détourner dans `useTheme` — l'écran immersif passe `palettes.dark`.
  **Conséquence assumée** : la surcharge « Couleurs des menus » ne s'applique pas au mode immersif.
- **En-tête** : sortie, chrono, menu ⋮ ; **ruban segmenté** (un segment par exercice, proportionnel à
  son nombre de séries ; vert = bouclé, terracotta = en cours) ; ligne « X/N séries » et **pastille
  du fantôme** (§5.9) quand elle existe.
- **Scène** (zone haute) : surtitre, nom de l'exercice, pastilles de séries (+ Série), repères selon le
  niveau (§4.4), **barre chargée** (§5.5), **cible** « 82,5 kg × 7 », **enjeu** quand la charge
  saisie dépasse le record (§5.4, **dès le niveau Normale**), puces Échauffement / Options de la série.
- **Pont** (zone basse, fixe, **règle R4-1 de MUSCU-UX01 conservée**) : aperçu « Ensuite » qui ouvre le
  plan de séance, les deux champs avec − / + (unités selon le type de série), bouton principal
  **Lancer la série**, lien **Déjà faite ? Valider directement**. Le pont suit le clavier
  (`useKeyboardHeight`).

### 4.2 Plan de séance en tiroir (SC)

La liste des exercices quitte l'écran et passe dans une feuille ouverte depuis « Ensuite ». Elle reprend
**toutes** les fonctions d'`ExerciseList` : aller à un exercice (toucher son nom), déplier ses séries,
dé-valider (sans relancer le repos), supprimer, + Série, badges de type, RPE/RIR, note d'exercice,
lien superset ; menu « ⋯ » par ligne : Monter, Descendre, Plus tard, Remplacer ; « Ajouter un exercice ».

### 4.3 Les moments

| Moment | Écran | Règles |
|---|---|---|
| **Entrée (BR)** | Brief plein écran | §5.1 |
| **Prêt** | Scène + pont | §4.1 |
| **Effort (EF)** | Plein écran qui bat au tempo | §5.6 |
| **Cadran (CA)** | Feuille sur l'effort assombri | §5.7 |
| **Repos (RP)** | Anneau, verdict, légende du coach, carte Fantôme / Corps | §5.3, §5.8 à §5.10 |
| **Record (RL)** | Prise d'écran pendant le repos | §5.4 |
| **Exercice bouclé (EB)** | Carte en tête du repos, entrée du suivant | §5.11 |
| **Dernière série (DS)** | Scène « chauffée », défi | §5.12 |
| **Tout validé** | Pont « Terminer la séance » + « Série » | inchangé sur le fond (MUSCU-UX01) |
| **Fin (FI)** | Cérémonie puis bilan (MUSCU-UX02) | §5.13 |

**Superset** : « Valider — puis enchaîner » bascule sur le partenaire **sans repos** ; le verdict flotte
1,2 s au-dessus du pont. Partenaire retiré : « Superset sans partenaire — repos normal », comme aujourd'hui.

### 4.4 Niveaux d'affichage dans la scène

| Élément | Simplifiée | Normale | Détaillée |
|---|---|---|---|
| Dernière fois, prévu, pastilles, + Série | ✔ | ✔ | ✔ |
| Écart au prévu, suggestion (et allègement MUSC-F7) | — | ✔ | ✔ |
| Raccourci échauffement | — | ✔ | ✔ |
| Options de la série (type, RPE/RIR, note, superset), un seul repli | — | — | ✔ |
| Brief, verdict, records en direct, fin de séance | ✔ | ✔ | ✔ |
| Enjeu « ce serait un record » | — | ✔ | ✔ |
| Bilan d'exercice | séries, tonnage | + écart | + écart |

## 5. Règles métier des mécaniques

### 5.1 Entrée en séance — brief (BR)

- Affiché quand la séance démarrée **contient au moins un exercice** : séance de programme (accueil du
  pilier, **accueil général** via `NowCard`, planning, fiche programme) ou séance créée depuis un
  **modèle** (`startWorkoutFromTemplate`). **Jamais** pour une séance libre vide — il n'y aurait rien à
  annoncer — **jamais** à la reprise d'une séance en cours.
- Contenu : nom de la séance, nombre d'exercices et de séries, durée estimée (même calcul que l'aperçu
  existant), muscles sollicités, **l'enjeu du jour** (§5.4 : première charge prévue qui dépasse un
  record, s'il y en a une), la liste des exercices, et **le mot du coach** (§5.14).
- « C'est parti » crée la séance (le chrono part à cet instant) ; « Modifier avant de commencer » garde
  le chemin actuel.

### 5.2 Mode immersif et chemins existants

Les démarrages existants (`startWorkout`, `startWorkoutFromSession`, `startWorkoutFromTemplate`) ne
changent pas : seul l'écran affiché dépend du mode. `/workout` choisit l'écran classique ou immersif.

### 5.3 Verdict (VE)

Base : la **même série (même rang, hors échauffement)** de la **dernière séance terminée** où
l'exercice a été fait (`useLastPerformance`, déjà lue par l'écran). Jour nommé (« mardi ») si la séance
de référence a moins de 7 jours, sinon la date (« vs 02/08 »).

⚠️ **La date manque aujourd'hui** : `SELECT_LAST_PERFORMANCE` ne sélectionne pas `workouts.finished_at`.
Elle est ajoutée à la lecture (lot 4, `useSessionReferences`) et portée par la signature du calcul —
sans elle, pas de jour nommé.

⚠️ **Quatre écarts « depuis la dernière fois » cohabitent** et ne mesurent pas la même chose : la
**meilleure série** (`compareExercisePerformance`, R5-1 de MUSCU-UX01, au bilan), la **même série**
(ici), le **% de tonnage de l'exercice** (§5.12) et le **cumul du fantôme** (§5.10). Chacun garde son
libellé propre (« ta meilleure série », « vs mardi », « % vs mardi », « d'avance sur mardi ») et le
verdict de série n'utilise **jamais** `compareExercisePerformance`.

| Situation | Libellé | Ton |
|---|---|---|
| Charge supérieure | « +2,5 kg vs mardi » | vert |
| Même charge, plus de reps | « +1 rép vs mardi » | vert |
| Identique | « Comme mardi » | neutre |
| En dessous | « 6 reps · mardi 8 » (ou « 75 kg · mardi 77,5 kg ») | neutre, **jamais rouge** |
| Série à la durée | « +10 s vs mardi » / « Comme mardi » / « 1:10 · mardi 1:20 » | vert / neutre |
| Pas de série de référence à ce rang, ou jamais fait | « Première référence posée » | neutre |
| Échauffement | aucun verdict | — |
| Record battu | remplacé par la pastille de record (§5.4) | ambre |

La vibration reste `hapticConfirm` (30 ms), inchangée.

### 5.4 Records en direct (RL, RC)

- **Au lancement de la séance**, pour chaque exercice : meilleure valeur enregistrée par type dans
  `personal_records` (lecture locale). **À chaque validation**, comparaison en mémoire avec **les
  règles d'éligibilité de `computeWorkoutRecords`** (série faite, hors échauffement et durée, valeurs
  non nulles), en tenant compte des meilleures valeurs **déjà battues pendant la séance**.
- **Types annoncés** : `max_weight` (priorité) puis `estimated_1rm`. `best_volume` n'est **pas
  annoncé** en direct (il reste compté à la clôture).
- **Pas de record sans passé** : si l'exercice n'a **aucun** record enregistré, rien n'est célébré
  (sinon une première séance vaut quinze records).
- **Immersif** : `max_weight` → **plein écran de record** pendant le repos (ressort, deux ondes, ancien record,
  2,6 s, un toucher la ferme, le repos continue dessous) — **au plus une par séance** ; les suivantes
  et `estimated_1rm` → **pastille ambre** en tête du repos. Vibration `hapticMilestone`, double pour la
  plein écran de record.
- **Classique** : pastille seule (R-CL-2).
- **Enjeu** : **à partir du niveau Normale**, dès que la charge saisie **dépasse** la charge max
  enregistrée, la scène affiche
  « 82,5 kg : plus lourd que ton record (80 kg) » et l'unité du champ passe en ambre.
- **Dé-valider** une série qui avait produit un record retire sa pastille, sans message.
- **L'écriture ne change pas** : `evaluateWorkoutRecords` à la clôture reste la seule source des lignes
  `personal_records` et des notifications de record (MUSC-F8).
- ⚠️ **Écart assumé** : à la clôture, un exercice **sans record antérieur** crée quand même sa première
  ligne. Il n'aura donc rien été célébré pendant la séance mais apparaîtra dans les records du bilan.
  C'est voulu : on ne fête pas une première fois, on l'enregistre.

### 5.5 Barre chargée (BC)

- **Uniquement** pour un exercice dont l'équipement est `barbell`.
- Charge par côté = (charge − barre) ÷ 2. Barre par défaut **20 kg** (réglage). Disques gourmands :
  **25, 20, 15, 10, 5, 2,5, 1,25 kg** ; en livres : **45, 35, 25, 10, 5, 2,5 lb** et barre 45 lb.
- Couleurs de disques de compétition, atténuées pour le fond sombre. Libellé « Par côté : 25 + 5 + 1,25
  · barre 20 kg ». Reste non représentable → libellé suivi de « + 0,5 kg non chargeable ».
- Charge inférieure ou égale à la barre → « Barre seule ». Charge nulle ou absente → barre non affichée.
- Changer la charge (− / +, clavier, suggestion acceptée) rejoue l'impact de la barre (ressort MOTION-01)
  et une vibration `hapticSelect`.

### 5.6 Série en direct (EF)

- « Lancer la série » ouvre l'effort plein écran. Le **temps sous tension** part à cet instant.
- **Tempo** : cycle de 3 s (descente 2 s, poussée 1 s), le fond et le cercle se contractent puis
  s'embrasent ; libellés « Descends · 2 » / « Pousse ». Coupable (réglage « Guide de tempo ») : le fond
  reste fixe.
- **Compteur facultatif** : toucher le cercle compte une rép (vibration `hapticSelect`) ; au-delà de
  l'objectif, les points et le chiffre passent en or.
  ⚠️ **Retiré le 23/09/2026** (MUSCU-FIX02, passe 2) : « on ne s'arrête pas à chaque répétition pour
  taper » (Florian). L'effort devient un écran à **regarder** — objectif en grand, disques par côté,
  chrono de la série, la dernière fois, consigne — et « Série terminée » ouvre le cadran sur
  l'objectif. Voir [muscu-fix02 §9](muscu-fix02-seance-en-direct.md).
  ⚠️ **Puis retiré tout court pour les séries en reps** (passe 3, même jour) : l'écran restait
  inutile. « Série faite » ouvre directement le cadran ; l'effort ne sert plus qu'aux séries
  chronométrées. Voir [muscu-fix02 §10](muscu-fix02-seance-en-direct.md).
- **Consigne** : une ligne tirée des instructions de la fiche exercice (première phrase), si elle existe.
- « Terminé » ouvre le cadran. Aucun autre moyen de sortir de l'effort que « Terminé » ou le menu ⋮
  (la sortie de séance reste possible).
- Séries à la durée : l'effort affiche un **compte à rebours** de la durée cible à la place du tempo et
  du compteur ; à zéro, le cadran s'ouvre avec la durée atteinte.
- Le temps sous tension est **affiché** (effort, cadran), **pas stocké** (§11).

### 5.7 Cadran et ressenti (CA)

- Le cadran est pré-réglé sur les **reps comptées**, sinon sur l'**objectif** (valeur du champ).
  Glissé vertical, un cran par 26 dp, `hapticSelect` à chaque cran ; boutons − / + de part et d'autre.
- Rappel de la charge (modifiable par le pont avant de lancer, pas depuis le cadran).
- **Ressenti facultatif** : Facile · Solide · Dur · Limite, stocké dans la colonne `rpe` existante
  (**6 · 7 · 9 · 10**). Retaper le mot choisi l'efface. En préférence RIR, mêmes mots.
- ⚠️ **Solide vaut 7, jamais 8.** `sessionStruggled` (`packages/shared/src/workout.ts`) classe une
  séance comme difficile **dès un RPE ≥ 8** : la suggestion de progression est alors coupée sur cet
  exercice, puis le deload de MUSC-F7 se déclenche si ça se répète. Mapper « Solide » — la réponse
  attendue d'une bonne série — sur 8 éteindrait donc **silencieusement** la progression assistée.
- « Valider la série » = validation actuelle (`updateSet` done + reps + charge + rpe éventuel), puis
  verdict, records, repos ou enchaînement superset.
- **« Valider directement »** (pont) saute effort et cadran : validation immédiate avec les valeurs des
  champs, comme aujourd'hui.

### 5.8 Ajustement proposé (AJ)

- Après un ressenti **Limite** : proposer **−2,5 kg** (−5 lb) sur la série suivante **du même exercice**.
- Après **Facile** : proposer **+2,5 kg** (+5 lb).
- Jamais sur une série d'échauffement, jamais si la charge suivante tomberait sous la barre (§5.5) ou
  sous zéro, jamais si aucune série suivante n'existe pour cet exercice.
- **Proposition, jamais décision** : carte « Coach : alléger la suivante ? » avec « 80 kg » et « Garder ».
  Accepter modifie la valeur pré-remplie de la série suivante (état d'édition), rien d'autre.

### 5.9 Repos qui respire (RP)

- Anneau existant (`RestRing`, MOTION-01) + **disque de respiration** (2 s inspire, 3 s expire,
  libellés « Inspire » / « Expire longtemps »), coupable.
- En tête : « Série N validée · 82,5 kg × 7 » et le verdict ou la pastille de record.
- **T−5 s** : « Prépare-toi » (le virage au vert existe déjà). **T−3, T−2, T−1** : `hapticSelect`.
  Fin : `hapticMilestone` (existant).
- **Veille** : repos en cours, aucun toucher depuis **20 s** → surcouche noire, chiffres braise à faible
  luminance, « Touche pour réveiller ». Réveil au toucher et **automatiquement à T−5 s**. Coupable.
- « +15 s », « Passer », réglage durable du repos, réduction en barre : inchangés ; la barre réduite
  se pose **au-dessus du pont** au lieu de le recouvrir.
- Sous l'anneau, une carte à deux onglets : **Le fantôme de mardi** · **Le corps qui chauffe**.

### 5.10 Le fantôme (FA)

- Pour chaque exercice de la séance : séries de la dernière séance où il a été fait
  (`useLastPerformance`). Fantôme **cumulé** = Σ (reps × charge) des séries de référence **aux mêmes
  rangs** que les séries validées aujourd'hui ; **toi** = Σ (reps × charge) des séries validées.
  Hors échauffement et hors durée ; charge nulle = 0.
- **Écart** = toi − fantôme, en kg, à la même série. Pastille d'en-tête « Mardi +75 kg » (vert si ≥ 0,
  neutre sinon). Carte : écart en grand, courbe toi (plein) contre fantôme (pointillé) sur la séance
  entière.
- **Pas de fantôme** si aucun exercice de la séance n'a d'historique : pastille et onglet masqués.
- « mardi » = jour de la séance de référence la plus récente parmi les exercices (§5.3 pour le libellé).
- Coupable (réglage « Fantôme de la dernière séance »).

### 5.11 Le corps qui chauffe (CO)

- Schéma `BodyMap` (face + dos, MUSC-F1b). ⚠️ **Il évolue** : il n'accepte aujourd'hui que `full` /
  `reduced` (deux niveaux) et lit ses couleurs par `useTheme` en interne, ce qui ne permet ni dégradé ni
  fond sombre imposé. Il reçoit une prop `heat` (0 → 1 par muscle) et ses couleurs en prop ; ses
  **trois** points de montage actuels (fiche exercice, aperçu de séance, bilan hebdo) continuent de
  passer `full` / `reduced` et rendent exactement comme avant.
- Chaleur d'un muscle fin = Σ sur les séries validées hors
  échauffement de **0,2** si le muscle est sollicité en plein (`resolveFineMuscles().full`), **0,1** s'il
  l'est en réduit ; plafonnée à **1**.
- Couleur interpolée sur **cinq valeurs** — éteint #30271e, braise #6b0028, chaud #b14f2b,
  terracotta #dd6e40, or #e0b155 —
  halo au-delà de 0,45. Le dernier muscle réchauffé pulse une fois.
- **Légende textuelle obligatoire** (la couleur ne porte jamais seule l'information) : les deux muscles
  les plus chauds et leur nombre de séries.

### 5.12 Exercice bouclé et dernière série (EB, DS)

- **Exercice bouclé** (dernière série d'un exercice validée) : carte en tête du repos — séries, tonnage,
  écart en % avec la dernière fois (Normale et Détaillée), nombre de records de l'exercice ; la carte
  « Ensuite » présente l'exercice suivant (nom, muscles, cible, dernière fois, suggestion).
- **Dernière série de la séance** : surtitre « Dernière série de la séance » en accent. **Défi** si le
  fantôme existe et si l'on est derrière son **total** : « N reps à X kg et mardi est battu », avec
  N = ⌈(total fantôme − toi) ÷ charge⌉, **affiché seulement si N ≤ reps prévues + 2** et si le ressenti
  précédent n'était pas « Limite ». Déjà devant : « Mardi est déjà battu de X kg ».

### 5.13 Fin de séance (FI, PA)

- « Terminer la séance » (inchangé, confirmation si aucune série) → **cérémonie** jouée **pendant** la
  clôture et l'évaluation des records : titre « Séance bouclée. », corps qui chauffe, durée, tonnage,
  séries, records, verdict du fantôme (« Mardi battu : +4 % de tonnage » / « Mardi garde 3 % d'avance »),
  réplique de fin du coach, puis **« Voir le bilan »** → écran de résumé actuel (MUSCU-UX02).
- **Relais nutrition** : si le pilier Nutrition est **actif** (décision H) et que les cibles du jour
  appliquent un bonus glucides d'entraînement (MN-04), ligne « Nutrition prend le relais : +X g de
  glucides aujourd'hui ». Sinon rien.
- **Carte à partager (PA)** : la variante `workout` de `ShareCardData` gagne une déclinaison à schéma corporel
  (chaleur de la séance), tonnage, séries, record. Aucune donnée de santé (ni poids du corps, ni
  nutrition). Jamais de partage automatique.

### 5.14 Coach vocal à gabarits (VO)

- **Pas d'IA dans cette US** (§11) : des **phrases gabarits FR/EN** avec trous (charge, reps, jour,
  écart, exercice), dites par la **synthèse vocale du téléphone** (`expo-speech`, déjà utilisée par la
  course, hors ligne). **Chaque réplique est aussi écrite** à l'écran (légende).
- **Répliques** : brief ; consigne au lancement d'une série ; verdict ; ajustement proposé ;
  **T−7 s** « On y retourne : X kilos, N répétitions » ; record ; exercice bouclé ; défi de dernière
  série ; fin de séance.
- **Caractère** : **Motivant** (phrases complètes), **Sobre** (chiffres seuls), **Muet** (voix coupée,
  légendes gardées). **Défaut : Motivant, voix activée.** Coupable depuis le brief et le menu ⋮.
- **Une seule réplique à la fois** : une nouvelle interrompt la précédente. **Jamais de parole pendant
  l'effort**, sauf la consigne au lancement.
- **Garde-fou** : aucune réplique ne parle de douleur, de blessure ou de santé.

### 5.15 Le fil (NO)

- **Rappel de fin de repos** : au lancement d'un repos, une notification locale est planifiée à
  l'échéance (`scheduleDatedReminder`, canal **« Séance »**, importance haute) : « C'est reparti ·
  Développé couché · 82,5 kg × 7 ». **Annulée** si le repos est passé, prolongé (re-planifiée), terminé
  dans l'app au premier plan, ou si la séance est close / abandonnée.
- **Jamais affichée si l'app est au premier plan.** ⚠️ Le gestionnaire actuel
  (`setNotificationHandler`, `lib/notifications.ts`) affiche **toutes** les notifications sans
  condition : il doit devenir conditionnel, sur un marqueur posé dans `content.data`.
- **Notification continue** pendant le repos, app en arrière-plan : « Repos jusqu'à 18:42 · Ensuite :
  82,5 kg × 7 », non sonore, retirée à la fin du repos. **Pas de décompte à la seconde** (§11). Elle
  demande `sticky` et `dismissNotificationAsync` — présents dans l'`expo-notifications` du SDK 57 mais
  **non exposés** par notre module — et un **canal « Séance »** distinct de « Rappels », alors que le
  module code aujourd'hui son canal en dur. Ce sont des évolutions de `lib/notifications.ts`, pas un
  usage existant.
- **Hors quota.** Le plafond de 3 notifications immédiates par jour (`notification-quota-store`,
  décisions D14/D3) protège des rappels **non sollicités** ; un repos est lancé par l'utilisateur
  lui-même. Les notifications de séance en sont **explicitement exemptes** — à écrire dans le code.
- Réglage « Notification de repos » : **activé par défaut en immersif, désactivé en classique**.
- Permission refusée : aucun message bloquant, le réglage l'indique.

## 6. Réglages › Séance

| Réglage | Portée | Défaut |
|---|---|---|
| Mode par défaut | les deux | Classique |
| Niveau d'affichage (existant, profil) | les deux | inchangé |
| Coach vocal : Motivant · Sobre · Muet | immersif | Motivant |
| Guide de tempo | immersif | activé |
| Respiration au repos | immersif | activée |
| Fantôme de la dernière séance | immersif | activé |
| Veille pendant le repos | immersif | activée |
| Poids de la barre (20 kg / 15 kg / 10 kg, ou 45 / 35 lb) | immersif | 20 kg |
| Notification de repos | les deux | immersif activée, classique désactivée |
| Animations (existant, MOTION-01) | les deux | inchangé |

Toutes locales à l'appareil (`secureStorage`), hydratées au lancement, valeur illisible → défaut.

## 7. Cas limites

- **Séance libre sans exercice** : immersif possible, pas de brief ; scène vide « Ajoute un exercice ».
- **Exercice ajouté en cours** : records de référence et fantôme lus à l'ajout ; pas de fantôme pour lui
  s'il n'a pas d'historique.
- **Exercice remplacé** : ses séries non validées changent d'exercice ; records et fantôme relus.
- **Unités en livres** : barre et disques en lb, verdicts et défis dans l'unité affichée.
- **Charge non multiple du pas** (saisie clavier 83,7 kg) : barre avec reste non chargeable (§5.5).
- **Poids du corps lesté** : pas de barre ; records éligibles si lest non nul (règle existante).
- **Retour depuis l'arrière-plan pendant l'effort** : le temps sous tension continue ; pendant le repos,
  l'échéance est un horodatage, donc juste.
- **Bascule de mode pendant l'effort ou le cadran** : on revient à l'état « prêt » de la même série, rien
  n'est validé.
- **Reprise d'une séance** (clôture auto à 3 h, MUSC-F6) : mode = préférence courante, pas de brief.
- **Réglage « Animations » coupé ou système « réduire les animations »** : états finaux sans transition,
  tempo fixe, respiration fixe, plein écran de record sans ressort ; vibrations et voix conservées.
- **Synthèse vocale indisponible** (pas de voix installée) : légendes seules, sans erreur.
- **Séries `dropset` et `failure`** : tempo, compteur et cadran identiques à une série normale — aucune
  donnée de tempo n'existe en base, il n'y a donc pas de règle propre à ces types.
- **Deux validations rapprochées** : la réplique suivante coupe la précédente ; au plus un plein écran de record.

## 8. i18n (FR + EN)

Aucune chaîne en dur. Nouveaux espaces de clés : `workoutMode.*` (choix, feuille, réglages),
`immersive.*` (scène, effort, cadran, ressenti, repos, veille, fantôme, corps, fin, ajustement),
`coach.*` (gabarits : un jeu **motivant** et un jeu **sobre** par réplique, pluriels `_one` / `_other`),
`restNotification.*`. Jours nommés via `Intl` côté JS (pas sur le thread UI). Parité contrôlée par
`scripts/check-i18n-parity.mjs`. La voix utilise `lang` = langue applicative (`fr-FR` / `en-US`).

## 9. Offline, données, dépendances

- **Tout est local** : lectures SQLite (records, dernière performance, exercices), préférences
  `secureStorage`, synthèse vocale et notifications du téléphone. **Aucun appel réseau.**
- **Aucune migration, aucune sync rule.** Seule écriture nouvelle : `rpe` via le ressenti, colonne
  existante et déjà synchronisée.
- **Aucune dépendance native nouvelle** : `expo-speech`, `expo-notifications`, `react-native-svg`,
  `react-native-reanimated`, `react-native-view-shot` sont déjà au projet → recettable sur un build de
  la branche.

## 10. Accessibilité

- Chaque effet visuel a son équivalent texte ; la voix a sa légende ; la couleur de chaleur a sa légende.
- Cibles ≥ 44 dp (cadran, ressenti, pont, onglets). Contrastes de la palette sombre (CONF-07).
- Le compteur de reps tactile n'est **jamais** requis ; « Valider directement » est toujours présent.
- Libellés d'accessibilité : cadran (« Répétitions, 7, ajuster »), barre (« Par côté : 25, 5 et 1,25 kg »),
  fantôme (« 75 kilos d'avance sur mardi »).

## 11. Hors périmètre, et pourquoi

- **Coach IA (Claude via proxy serveur)** : demande l'Edge Function, le consentement IA, la
  minimisation des données et le palier IA (analyse IA §5 à §7) — **post-V1**. Les gabarits de §5.14
  en sont le socle : l'IA ne fera qu'enrichir le texte. → candidat **COACH-IA-01** au [BACKLOG](../../../../BACKLOG.md).
- **Sons** : demandent une dépendance native audio (`expo-audio`) et donc un nouveau build ; le
  prototype les montre, l'US les reporte. → candidat **SON-01**.
- **Décompte à la seconde dans la notification** : `expo-notifications` ne l'expose pas ; demande un
  module natif. La notification affiche l'**heure** de fin.
- **Stockage du temps sous tension** : demanderait une colonne et une sync rule (contre D5).
- **Fantôme contre la meilleure séance**, cartes à partager personnalisées : options d'abonnement (A2).
- **Verrou RevenueCat** : V1 gratuite (décision D).

## 12. Critères de recette

> Recopiés dans [RECETTES.md](../../../../RECETTES.md) à l'étape `recette`.

**Choix du mode**
1. Nouveau compte, premier « Commencer » : la feuille « Comment veux-tu t'entraîner ? » s'ouvre, rien n'est coché.
2. Compte avec historique : la feuille ne s'ouvre jamais, le mode est Classique.
3. Le sélecteur de la carte « Séance du jour » change le mode et le retient après redémarrage de l'app.
4. Menu ⋮ en séance, « Mode d'affichage » : la bascule garde séries validées, série courante et repos en cours.
5. Réglages › Séance : chaque interrupteur agit et survit au redémarrage.

**Classique**
6. L'écran classique est identique à avant (inventaire, toile 1), en Simplifiée, Normale et Détaillée.
7. Battre la charge max d'un exercice qui a un historique affiche la pastille 4 s **en tête du repos** (et dans la barre réduite) et vibre ; aucune voix.
8. Un premier passage sur un exercice jamais fait n'affiche aucune pastille.

**Immersif — séance**
9. Fond sombre en thème clair comme en thème sombre.
10. Le ruban segmenté reflète les exercices et l'avancement.
11. Le plan de séance permet : aller à un exercice, dé-valider sans repos, supprimer, + Série, monter, descendre, plus tard, remplacer, ajouter un exercice.
12. Les trois niveaux montrent exactement le tableau §4.4.
13. Le brief s'affiche pour une séance de programme (accueil du pilier, accueil général, planning, fiche programme) et pour une séance issue d'un modèle ; jamais pour une séance libre vide ni à la reprise.

**Effort, cadran, barre**
14. Développé couché à 82,5 kg : « Par côté : 25 + 5 + 1,25 · barre 20 kg » ; « + » fait claquer la barre et vibrer.
15. Barre à 15 kg dans les réglages : le calcul change.
16. Exercice à haltères : pas de barre.
17. « Lancer la série » : le fond bat au tempo ; toucher le cercle compte ; la 8ᵉ rép d'un objectif de 7 passe en or.
18. « Terminé » : le cadran est sur les reps comptées ; sans comptage, sur l'objectif ; le glissé cran par cran vibre.
19. Choisir « Limite » stocke RPE 10 (visible en Détaillée) et propose −2,5 kg sur la suivante ; « Garder » ne change rien.
19b. Choisir « Solide » stocke **RPE 7** : la séance suivante propose toujours une progression sur cet exercice (MUSC-F7 non déclenché).
20. « Valider directement » valide sans effort ni cadran.
21. Série à la durée : compte à rebours à la place du tempo.

**Retours**
22. Verdicts du tableau §5.3, dont « Première référence posée » et l'absence de rouge.
23. Charge max battue : plein écran de record pendant le repos, un toucher la ferme, le repos continue ; une deuxième charge max dans la séance → pastille.
24. 1RM estimé battu sans charge max : pastille ambre.
25. Dé-valider la série record retire la pastille ; la clôture n'enregistre pas ce record.
26. Les records enregistrés à la clôture sont les mêmes qu'en mode classique pour la même séance.

**Repos**
27. Disque de respiration, « Prépare-toi » à T−5, trois vibrations T−3 à T−1.
28. Veille après 20 s sans toucher ; réveil au toucher et à T−5 s.
29. La barre de repos réduite ne recouvre pas le pont.
30. Onglet fantôme : écart et courbe cohérents avec les séries (vérifier à la main sur 2 séries).
31. Onglet corps : les pectoraux chauffent sur un développé couché, légende textuelle présente.
32. Exercice bouclé : carte séries / tonnage / écart, puis entrée de l'exercice suivant.
33. Dernière série derrière le fantôme : défi « N reps à X kg » avec N correct ; devant : « déjà battu ».

**Coach vocal**
34. Voix audible en Motivant ; Sobre ne dit que des chiffres ; Muet coupe la voix mais garde les légendes.
35. Aucune parole pendant l'effort après la consigne ; une nouvelle réplique coupe la précédente.
36. En anglais, les répliques et la voix sont en anglais.

**Fin**
37. Cérémonie pendant la clôture, puis « Voir le bilan » ouvre le bilan MUSCU-UX02.
38. Relais nutrition présent seulement si le pilier Nutrition est actif et le bonus du jour non nul.
39. Carte à partager « Corps » : schéma chauffé, tonnage, séries, record ; aucune donnée de santé.

**Le fil**
40. Immersif, app en arrière-plan pendant le repos : notification continue avec l'heure de fin, puis rappel « C'est reparti » à l'échéance.
41. « Passer » dans l'app : le rappel ne sonne pas.
42. Classique : aucune notification tant que le réglage est désactivé.
42b. Une séance de 18 séries ne consomme pas le quota de 3 notifications immédiates par jour (un rappel du soir arrive quand même).

**Transverse**
43. Mode avion toute la séance : tout fonctionne (voix comprise si une voix est installée).
44. Animations coupées : mêmes informations, sans transition.
45. Unités en livres : barre en lb, verdicts en lb.
46. Parité i18n FR/EN verte ; aucune clé brute affichée.
