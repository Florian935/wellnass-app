---
id: RUN-F2d
titre: "Guidage fractionné vocal"
roadmap: [5.18]
catalogue: []
etape: recette
branche: feature/runf2d-guidage-fractionne-vocal
maj: 03/08/2026
---

# US RUN-F2d — Guidage fractionné vocal

> **4ᵉ et dernier des candidats issus du découpage de RUN-F2** (BACKLOG.md), après RUN-F2a
> (annonces audio périodiques, livrée), RUN-F2b (cible en direct, livrée) et RUN-F2c (blocs
> fractionné/intervalles, livrée). Roadmap 5.18 : « Guidage fractionné vocal — Annonce vocale +
> vibration à chaque changement de bloc. » Dépendait entièrement des deux briques désormais
> disponibles : `expo-speech` (RUN-F2a) et la structure `session_intervals` (RUN-F2c).

## 0. Le principe : dire « GO » et « récup » sans regarder l'écran

Une séance fractionné structurée (US RUN-F2c) enchaîne des **phases** : rapide, puis récupération
(si présente), répétées `reps` fois par bloc, blocs eux-mêmes enchaînés dans l'ordre. Aujourd'hui,
rien n'informe le coureur d'un changement de phase pendant la course — il doit regarder l'écran (ou
deviner). Cette US ajoute une **annonce vocale + une vibration** à **chaque changement de phase**
(pas seulement à chaque changement de *bloc* au sens strict de la table — voir §3 R1 pour la
justification de cette lecture).

Exemple : « 6×400 m à 95 % VMA, récup 200 m » (un bloc, `reps=6`) produit, au fil de la course,
12 transitions annoncées : rapide → récup → rapide → récup … 6 fois — c'est ce qui rend le
guidage réellement utile pendant l'effort, pas seulement au changement de bloc.

## 1. Le modèle de progression

Une séance planifiée en `fractionne` avec des blocs (US RUN-F2c) se **linéarise** en une liste
ordonnée de *phases* : pour chaque bloc, dans l'ordre, `reps` fois la paire (phase rapide, phase
récup si présente). Une phase porte soit une cible de **distance** (m), soit une cible de **durée**
(s) — jamais les deux, jamais aucune (héritage direct de RUN-F2c R2/R3).

Pendant la course, le guidage compare la progression **depuis le début de la phase courante**
(pas depuis le début de la course) à la cible de cette phase :
- phase à cible distance : `distance course actuelle − distance au début de la phase ≥ cible` ;
- phase à cible durée : `durée nette actuelle − durée nette au début de la phase ≥ cible`.

Au franchissement, la phase suivante démarre : annonce + vibration, et le point de départ
(distance/durée) de la nouvelle phase courante devient la distance/durée courante à cet instant.

**Le tout premier déclenchement** a lieu dès le démarrage de la course (phase 0, avant même toute
distance parcourue) : annonce immédiate du contenu de la première phase, comme le ferait une
montre de fractionné au moment où l'entraînement structuré démarre.

## 2. Ce qui existe déjà, réutilisé tel quel

- **`expo-speech`** (RUN-F2a) : déjà dépendance du projet, `Speech.speak(...)`, aucun nouveau build
  natif nécessaire pour *cette brique*.
- **`Vibration.vibrate()`** (`react-native`, déjà utilisé en foreground par `workout.tsx` pour le
  décompte de repos muscu) : aucune dépendance neuve (pas de `expo-haptics`, contrairement à
  MUSC-F9) — cohérent avec la remarque du BACKLOG (« aucun précédent de vibration périodique en
  tâche de fond… le seul cas existant est en foreground actif », précédent que cette US reproduit
  à l'identique, toujours en foreground).
- **`session_intervals`/`IntervalBlockItem`** (RUN-F2c) : structure de blocs déjà lue et éditée —
  mais **pas encore accessible par occurrence planifiée** : `useRunTarget` (RUN-F2b/F3) ne
  résout que `target_distance_m`/`target_duration_seconds` depuis `plannedSessionId`, jamais
  `session_type` ni les blocs, et l'unique requête existante sur `session_intervals`
  (`SELECT_INTERVALS_FOR_PROGRAM`) est scopée par `program_id`, pas par séance. **Nouveau** :
  un hook réactif résolvant `plannedSessionId → session_type + blocs ordonnés` (même patron de
  jointure `planned_sessions → sessions` que `useRunTarget`, étendu à `session_intervals`) — ce
  n'est pas de la réutilisation telle quelle, à compter comme travail neuf de la couche données.
- **`ActiveRun.plannedSessionId`** (RUN-F2b/F3) : déjà le lien course → séance planifiée.
- **`run/active.tsx`** : déjà le point d'intégration des deux guidages précédents (RUN-F2a
  distance périodique, RUN-F2b cible en direct) — troisième guidage ajouté au même écran, foreground
  uniquement, même décision de conception que RUN-F2a (voir §3 R5).
- **Convention i18n « jamais un nombre décimal parlé »** (RUN-F2a R3 bis) : reconduite pour les
  distances et durées de phase annoncées (§3 R6/R7).

**Fonctions pures neuves** (`packages/shared`) :
- `expandIntervalPhases(blocks)` — linéarise les blocs en liste de phases (§1).
- `isIntervalPhaseComplete(phase, distanceSincePhaseStartM, durationSincePhaseStartS)` — franchi
  ou non.

## 3. Les règles

**R1 — Granularité de l'annonce : chaque changement de *phase*, pas seulement de *bloc*.** Le
libellé roadmap (« à chaque changement de bloc ») est lu au sens large : un bloc `reps=6` contient
12 phases, et c'est à *chaque* transition rapide↔récup que l'information est utile — se limiter aux
2-3 changements de *ligne* de la table `session_intervals` rendrait le guidage quasi inutile sur
l'usage réel (un fractionné typique). Décision assumée, pas une ambiguïté laissée ouverte.

**R2 — GPS uniquement**, comme RUN-F2a (R4) : en mode manuel, `distanceM` n'est connu qu'à la fin
de la course (`finishRun`), jamais en direct — impossible de détecter le franchissement d'une phase
à cible distance pendant l'effort. Le guidage est donc **entièrement désactivé** hors GPS, y
compris pour les phases à cible durée (cohérence d'un seul comportement pour toute la séance,
plutôt qu'un guidage à moitié actif selon le type de phase courante).

**R3 — Réglage opt-in dédié, séparé de RUN-F2a.** Nouveau réglage `running_profiles
.interval_guidance_enabled` (défaut `false`) — pas de réutilisation de
`voice_announcements_enabled` : les deux usages sont différents (repères kilométriques périodiques
vs guidage structuré d'une séance fractionné), un coureur peut vouloir l'un sans l'autre. Un seul
interrupteur active à la fois la voix **et** la vibration (le roadmap les traite comme un seul
geste : « annonce vocale + vibration »), pas deux réglages séparés.

**R4 — Actif seulement si la séance planifiée est `fractionne` ET a au moins un bloc.** Une séance
fractionné sans bloc défini (cas déjà valide avant RUN-F2c) ne déclenche rien — comportement
identique à aujourd'hui, aucune régression. Une course libre (`plannedSessionId` absent) ne
déclenche jamais rien non plus (même garde que RUN-F2b R1).

**R5 — Déclenché depuis `run/active.tsx` (foreground), jamais depuis `tracker-task.ts`.** Même
décision qu'RUN-F2a (spec §1) : ne pas ajouter une inconnue (lecture audio + vibration hors
contexte React) dans le fichier le plus sensible du projet. Conséquence assumée et **documentée** :
si l'écran de suivi n'est pas monté (changement d'onglet, verrouillage), aucune annonce ni
vibration ne part pendant cette période — la progression continue d'être trackée (voir R8,
persistance), mais silencieusement.

**R6 — Distance de phase : même règle que RUN-F2a (R3 bis), pas une simplification à part.** Km
entier si la distance de la phase est un multiple exact de 1000 m, mètres sinon — **jamais un
nombre décimal lu**. Corrigé après relecture : une première version de cette règle imposait
« toujours en mètres », en argumentant que les distances de bloc sont de l'ordre du sprint — mais
RUN-F2c (spec §0) donne explicitement l'échauffement « 1 km facile » comme bloc valide
(`fast_distance_m=1000`), qui se lirait alors « 1000 mètres » au lieu du naturel « 1 kilomètre » :
exactement la lecture non naturelle que la règle prétendait éviter. La règle de RUN-F2a couvre
déjà les deux cas correctement, aucune raison d'en inventer une autre pour les phases.

**R7 — Durées de phase exprimées en secondes en dessous de 90 s, sinon en minutes arrondies** —
jamais un nombre décimal lu (même esprit que RUN-F2a R3 bis, seuil différent car les phases de
récupération sont réellement de l'ordre de la dizaine de secondes à quelques minutes, contrairement
aux temps de course entiers de RUN-F2a qui sont toujours arrondis à la minute).

**R8 — Progression persistée pour survivre à un remontage de l'écran, avec rattrapage silencieux
des phases sautées.** Contrairement à RUN-F2a (qui accepte de perdre le compteur d'annonces au
démontage, cf. R2/R5 de sa spec), une reprise mal gérée ici serait trompeuse et pas seulement
silencieuse : sans persistance, rouvrir l'écran (carte « Reprendre ») réinitialiserait la phase
courante à 0 et pourrait annoncer « rapide » alors que le coureur est en réalité en pleine
récupération — pire qu'une simple absence d'annonce. Trois colonnes additives sur `runs`
(`interval_phase_index`, `interval_phase_start_distance_m`, `interval_phase_start_duration_s`,
toutes nullables, `null` = guidage non démarré/non applicable) sont mises à jour à chaque
transition, permettant de reconstruire la phase courante et son point de départ au remontage —
même logique offline-first que les autres champs de `runs` (écriture SQLite locale immédiate,
PowerSync synchronise ensuite). **Aucune sync rule à redéployer** : `runs` est déjà publiée en
`select *`, comme les colonnes ajoutées par RUN-F1b/F2a/F2b.

**R8 bis — Le franchissement n'avance jamais d'une seule phase à la fois par hypothèse : c'est une
boucle.** Le tracker continue d'accumuler distance/durée pendant que l'écran n'est pas monté (R5) ;
au remontage — ou plus généralement à chaque tick pendant que l'écran est monté — la distance/durée
courante peut avoir franchi **plusieurs** seuils de phase d'un coup (ex. écran éteint pendant tout
un bloc rapide + sa récup). L'algorithme doit donc **boucler** « la phase courante est-elle
franchie ? » tant que c'est vrai, en avançant l'index à chaque itération, avant de s'arrêter sur la
phase réellement en cours. **Seule la dernière transition de cette rafale de rattrapage est
annoncée/vibrée** (celle qui correspond à l'instant présent) ; les transitions traversées
silencieusement pendant que l'écran n'était pas monté ne sont **pas** rejouées a posteriori — ce
serait une bourrasque d'annonces obsolètes, pas une aide. Seule la persistance (R8) avance en
silence ; l'annonce/vibration ne se produit que pour une transition détectée alors que l'écran est
effectivement monté. Cas particulier : au tout premier montage d'une course neuve (aucune phase
encore démarrée, R1), l'alignement initial **est** annoncé — ce n'est pas un rattrapage, c'est le
véritable premier déclenchement (§1). La distinction est donc : rattrapage silencieux **au premier
calcul suivant un remontage d'une séquence déjà démarrée**, annonce normale pour toute transition
détectée ensuite pendant que l'écran reste monté.

**R9 — Aucun indicateur visuel de la phase courante en V1.** Le roadmap ne demande que « annonce
vocale + vibration » ; ajouter un affichage temps réel de la phase (façon carte objectif de
RUN-F2b) serait une surface neuve non demandée. Explicitement hors périmètre (voir §4) — à
proposer comme US séparée si le besoin se confirme à l'usage.

## 4. Ce qui est explicitement hors périmètre

- **Indicateur visuel de la phase courante** sur `run/active.tsx` (R9).
- **Réglages fins** (choix du son, intensité de la vibration, décompte des dernières secondes
  avant transition façon « 3, 2, 1 ») — pas demandés par le roadmap, pas de précédent dans le
  projet.
- **Guidage en mode manuel** (R2).
- **Coordination explicite** entre cette annonce et celle de RUN-F2a si les deux tombent au même
  instant : les deux `Speech.speak(...)` sont indépendants, lus l'un après l'autre par le moteur
  TTS (comportement par défaut, pas de file d'attente gérée explicitement) — coïncidence rare,
  acceptée sans traitement spécial en V1.
- **Persistance au-delà de la reprise d'écran** : si l'app est tuée puis relancée en tâche de fond
  par le système pendant une course, le comportement de reprise du guidage suit celui, déjà
  existant, du tracker lui-même (hors périmètre de cette US).

## 5. Surfaçage

- **Réglages** (`running-profile.tsx`, à côté du réglage RUN-F2a) : un nouvel interrupteur
  « Guidage fractionné (voix + vibration) », désactivé par défaut, avec un texte d'aide expliquant
  qu'il ne s'active que pendant une séance fractionné structurée planifiée.
- **Pendant la course** (`run/active.tsx`) : aucun élément visuel neuf (R9) — uniquement l'annonce
  vocale et la vibration au moment de chaque transition de phase.

## 6. i18n

Nouvelle famille `running.guidance.*`, FR + EN :
- `fastStart` / `recoveryStart` — gabarits d'annonce du début de chaque type de phase, avec la
  distance ou la durée de la phase composée séparément (comme RUN-F2a : jamais de concaténation
  manuelle, pluriels `_one`/`_other` sur les comptages).
- `pacePart` — fragment optionnel ajouté à `fastStart` quand `fastPacePctVma` est renseigné
  (« à {{pct}} % VMA »).
- `sessionComplete` — annoncée après la dernière phase de la séquence (petit plus, coût nul : un
  fractionné qui se termine sans un dernier signal serait une expérience bancale comparée aux deux
  annonces de transition qui l'ont précédé).
- `distanceM_one`/`distanceM_other`, `durationSeconds_one`/`_other`, `durationMinutes_one`/
  `_other` — fragments de quantité, dédiés à la voix (distincts des libellés visuels de RUN-F2c
  `running.intervals.distanceLabel`/`durationLabel`, pour la même raison que RUN-F2a a séparé son
  vocabulaire parlé de l'affichage : « m »/« min » se lisent mal à voix haute).
- `running.profile.intervalGuidance*` (toggle + aide), à côté des clés `announcements*` de RUN-F2a.

## 7. Comportement offline

**Total.** Détection des transitions, annonce vocale (moteur TTS local) et vibration : aucun réseau
requis. Écriture des 3 colonnes de progression (`runs`) : SQLite local immédiat, synchro PowerSync
en arrière-plan comme le reste de `runs`.

## 8. Accessibilité

Aucun nouvel élément visuel (R9) — pas de nouvelle surface à faire annoncer par TalkBack. La
vibration constitue elle-même un repère non-visuel utile en complément de la voix (utile en
particulier si le volume est coupé).

## 9. Critères de recette

- [ ] 1. Séance fractionné avec un bloc « 6×400 m à 95 % VMA, récup 200 m », guidage activé,
      course GPS : une annonce + une vibration à **chaque** passage rapide↔récup (12 transitions
      pour ce bloc), pas seulement 2 fois.
- [ ] 2. La toute première annonce (phase 0) part **au démarrage de la course**, avant tout mètre
      parcouru.
- [ ] 3. Un bloc échauffement sans récup (reps=1, distance seule) : une seule transition vers la
      phase suivante, sans annonce de récupération fantôme.
- [ ] 4. **Changer d'onglet puis revenir** (carte « Reprendre ») en cours de séance ne redémarre
      pas la séquence de phases à 0 — la phase courante annoncée à la reprise (ou silencieusement
      trackée) correspond à la progression réelle, pas à une réinitialisation (R8).
- [ ] 4 bis. **Changer d'onglet pendant une durée qui couvre plusieurs phases** (ex. tout un
      rapide + sa récup), puis revenir : aucune rafale d'annonces des phases sautées, seule la
      phase réellement en cours au retour est annoncée une fois (R8 bis).
- [ ] 4 ter. Une séance avec **au moins 2 blocs** (ex. échauffement puis série principale) :
      la transition du dernier rep du 1er bloc vers le 1er rep du 2ᵉ bloc est annoncée
      normalement, sans saut ni doublon à la frontière des deux blocs.
- [ ] 5. Séance **fractionné sans bloc défini** : aucune annonce ni vibration liée à cette US
      (comportement inchangé).
- [ ] 6. **Course libre** (sans séance planifiée) : aucune annonce ni vibration liée à cette US.
- [ ] 7. **Mode manuel (sans GPS)** : aucune annonce ni vibration liée à cette US, même sur une
      séance fractionné structurée (R2).
- [ ] 8. Le réglage est **désactivé par défaut** et indépendant de celui de RUN-F2a (activer l'un
      sans l'autre fonctionne).
- [ ] 9. La dernière phase franchie déclenche une annonce de fin de séance distincte.
- [ ] 10. **Mode avion** : guidage complet (annonce + vibration) fonctionne normalement.
- [ ] 11. En **EN** : les gabarits de phase rapide/récup/fin sont tous grammaticaux, y compris au
      pluriel des comptages.
- [ ] 12. Une durée de récupération courte (ex. 30 s) est annoncée **en secondes**, pas arrondie à
      « 0 minute » ou « 1 minute ».

