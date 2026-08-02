---
id: RUN-F1b
titre: "Dénivelé cumulé"
roadmap: [5.32]
catalogue: []
etape: recette
branche: feature/runf1b-denivele-cumule
maj: 02/08/2026
---

# US RUN-F1b — Dénivelé cumulé

> **Candidat marqué ⛔ bloqué dans BACKLOG.md** : « la trace GPS ne capte pas l'altitude
> (`GpsPoint = {lat,lng,t}`). Nécessite de modifier le tracker R1, étendre le codec, et les courses
> déjà enregistrées resteront sans dénivelé. » Cette spec lève le blocage en **évitant** la partie la
> plus risquée de ce diagnostic — étendre le codec — voir §0.

## 0. La décision qui désamorce le risque : ne pas toucher au codec de trace

Le blocage supposait qu'il fallait étendre `packages/shared/src/running.ts` (`GpsPoint`, `encodeSegment`/
`decodeTrack`, versionnage de segment `#1#...`) pour faire voyager l'altitude jusqu'au stockage. **Ce
n'est pas nécessaire.** Le tracker calcule déjà `distance_m`/`duration_seconds` comme des **scalaires
cumulés en direct** (`TrackerState.cumulativeDistanceM`, mis à jour dans `handleLocationBatch`,
`apps/mobile/src/running/tracker-task.ts`) — ces valeurs ne sont **jamais** recalculées depuis la
trace stockée (`run-repository.ts` : « le tracker fournit les scalaires cumulés, source de vérité »).
Le dénivelé suit **exactement le même patron** : deux nouveaux scalaires cumulés
(`cumulativeElevationGainM`/`LossM`), calculés en direct à partir de `Location.LocationObject.coords.altitude`
(déjà fourni par `expo-location`, aucune dépendance ni permission nouvelle), stockés dans deux
nouvelles colonnes `runs.elevation_gain_m`/`elevation_loss_m`. **Aucun octet d'altitude ne transite
par `gps_track`.**

**Conséquences directes** :
- Le codec de trace (`GpsPoint`, `encodeSegment`, `decodeTrack`) reste **entièrement inchangé** —
  zéro risque de régression sur les fonctions qui en dépendent (records d'allure, splits, export GPX,
  partage).
- **Hors périmètre assumé** : pas de profil d'altitude (courbe), pas de balise `<ele>` dans l'export
  GPX (`gpx.ts`) — seulement les deux totaux cumulés par course. Un futur candidat distinct pourrait
  ajouter le profil s'il justifie le risque d'étendre le codec ; ce n'est pas cette US.
- Les courses déjà enregistrées restent à `elevation_gain_m`/`elevation_loss_m` **`null`** (jamais
  `0`) — comme le disait déjà le diagnostic du blocage, mais ce n'est plus une limite technique du
  format, seulement l'absence de la donnée source pour des courses passées (même convention que
  `terrain`, déjà nullable pour les mêmes raisons).

## 1. Ce qui existe déjà

- `Location.LocationObjectCoords` (expo-location, déjà une dépendance du projet) expose déjà
  `altitude: number | null` et `altitudeAccuracy: number | null` — **aucune intégration native
  nouvelle**, juste deux champs jamais lus aujourd'hui dans `toGpsPoints`.
- `TrackerState`/`handleLocationBatch` (`tracker-task.ts`) : la boucle qui accumule
  `cumulativeDistanceM`/`netDurationS` par segment valide (`dt > 0` et vitesse ≤
  `MAX_PLAUSIBLE_SPEED_MS`) est le point d'insertion naturel — le dénivelé s'accumule **sur les mêmes
  segments déjà jugés fiables**, pas une seconde logique de validité indépendante.
- `isValidFix`/`ACCURACY_MAX_M` (`packages/shared/src/running.ts`) : le patron de garde-fou sur la
  précision horizontale à reproduire pour la précision verticale (`altitudeAccuracy`).
- `flushTrack`/`FlushInput` (`run-repository.ts`) : déjà le point unique d'écriture des scalaires
  cumulés vers `runs` — les deux nouveaux champs s'y ajoutent sans changer sa forme générale.
- `aggregateRunStats`/`RunStats` (`packages/shared/src/run-stats.ts`) : déjà la fonction
  d'agrégation par période (semaine/mois/depuis le début) pour distance/durée — le patron à étendre
  pour le dénivelé « par période ».

**Aucune migration de données rétroactive** (les anciennes courses n'ont simplement pas la donnée).
**Une migration de schéma** (2 colonnes nouvelles, nullable).

## 2. Les règles

**R1 — L'altitude est lue depuis `coords.altitude`, filtrée par `coords.altitudeAccuracy`.** Une
lecture avec `altitudeAccuracy` présent et `> ALTITUDE_ACCURACY_MAX_M` (valeur proposée : **30 m** —
choix conservateur non re-sourcé, cf. R7) est traitée comme **absente** (comme un GPS sans capteur
barométrique) : elle ne casse pas le cumul en cours, elle est simplement ignorée pour cette lecture.
Une `altitude`/`altitudeAccuracy` absente (`null`) n'entraîne **pas** de rejet du point pour la
distance/durée (inchangé) — seul le volet dénivelé est affecté.

**R2 — Le dénivelé ne s'accumule que sur un segment déjà jugé valide pour la distance, mais la
base d'altitude (`lastAltitudeM`) suit le même sort que `lastPoint`/`lastPointT`.** Un segment
rejeté par le filtre glitch existant (`dt <= 0` ou vitesse `> MAX_PLAUSIBLE_SPEED_MS`) ne contribue à
aucun des deux calculs cumulés — mais **le code actuel met déjà à jour `lastPoint`/`lastPointT` même
après un segment rejeté** (le point sert de nouvelle base pour le suivant, qu'il ait compté ou non).
`lastAltitudeM` reproduit exactement ce même comportement, pour ne pas introduire une deuxième règle
de mise à jour d'état divergente de celle déjà en place — une seule notion de « dernier point connu »,
partagée par position et altitude.

**R1 bis — implémentation : l'altitude doit être appariée point par point dans la même itération que
le filtre de validité horizontale, jamais par un second passage indépendant sur le lot brut.**
`toGpsPoints` filtre déjà les fix invalides (`isValidFix`) avant de construire `GpsPoint[]` — un fix
rejeté disparaît sans laisser de trace d'index. Lire l'altitude séparément (ex. une boucle distincte
sur `locations`) désynchroniserait silencieusement point et altitude dès qu'un fix est filtré (pas de
crash, juste un mauvais appariement — un bug difficile à repérer). L'altitude doit donc être portée
par une structure interne construite **dans la même boucle** que `toGpsPoints` (un type élargi propre
à ce fichier, jamais `GpsPoint` lui-même qui reste `{lat,lng,t}` pour ne pas toucher le codec, §0).

**R3 — Filtre de bruit vertical : seuil de 3 m avant de compter un gain/une perte.** Le bruit
altimétrique GPS est nettement plus fort que le bruit horizontal (déjà géré par le filtre de
vitesse) ; sans seuil, une trace plate sur sol accidenté produirait un dénivelé cumulé fortement
surestimé (des allers-retours de bruit comptés comme du vrai relief). Algorithme (état interne du
tracker, pas une fonction pure séparée — même choix d'architecture que le cumul distance/durée déjà
inline dans `handleLocationBatch`) :
- Delta d'altitude accumulé dans un solde en attente (`pendingElevationDeltaM`) à chaque segment
  valide avec altitude disponible des deux côtés.
- Dès que `|solde| ≥ 3 m`, le solde est validé dans le cumul correspondant (gain si positif, perte si
  négatif) puis remis à zéro.
- **Simplification assumée, pas un modèle barométrique physique** — même esprit pragmatique que
  `MAX_PLAUSIBLE_SPEED_MS` pour la distance (un seuil empirique documenté, pas une vérité physique).
  Seuil aligné sur une convention courante des montres GPS grand public (Garmin et assimilés).

**R4 — La pause ne doit pas produire un faux relief à la reprise.** Même traitement que
`lastPoint`/`lastPointT` pendant une pause : la dernière altitude connue (`lastAltitudeM`) continue
d'être mise à jour pendant la pause (sans accumuler de gain/perte), pour que la reprise reparte d'une
base fraîche plutôt que de compter le dénivelé du trajet fait pendant l'arrêt (ex. un ravitaillement
en contrebas d'un chemin).

**R5 — Une course manuelle (`source='manual'`, sans trace GPS) n'a jamais de dénivelé.**
`elevation_gain_m`/`elevation_loss_m` restent `null` — il n'existe aucune source d'altitude pour ce
type de course, ce n'est pas un oubli de saisie à combler.

**R6 — Agrégation par période : somme simple, `null` traité comme `0` uniquement dans la somme.**
Même convention déjà en place dans `aggregateRunStats` pour `distanceM`/`durationS` (`?? 0`) — une
course sans dénivelé connu ne doit pas empêcher de sommer les autres courses de la période ; elle ne
doit pas non plus se voir attribuer un dénivelé inventé.

**R7 — Le seuil `ALTITUDE_ACCURACY_MAX_M` (30 m) et le seuil de bruit (3 m) sont des points
d'attention explicites pour la recette terrain.** Contrairement aux seuils horizontaux déjà validés
sur le terrain (R1, `docs/running-r1-test-terrain.md`), ces deux valeurs n'ont **aucune validation
terrain préalable** dans ce projet — elles sont posées par analogie avec des pratiques connues
(montres GPS grand public), pas mesurées sur cette stack précise. **Ne pas les considérer comme
définitives avant une sortie réelle en recette device**, idéalement sur un terrain vallonné connu
(comparaison avec une carte IGN ou un tracé Strava/Garmin de référence).

## 3. Périmètre

**Dans le périmètre** :
- `TrackerState` étendu (`cumulativeElevationGainM`, `cumulativeElevationLossM`,
  `pendingElevationDeltaM`, `lastAltitudeM` — internes, seuls les deux premiers sont flushés).
- `handleLocationBatch`/`toGpsPoints` : lecture de l'altitude en parallèle des points GPS (sans
  toucher à `GpsPoint`), application de R1-R4.
- `FlushInput`/`flushTrack` : deux champs supplémentaires, persistés comme `distanceM`/`durationSeconds`.
- Migration Supabase : `runs.elevation_gain_m numeric`, `runs.elevation_loss_m numeric`, nullable.
- `apps/mobile/src/powersync/schema.ts` : les deux colonnes ajoutées à la table `runs` locale.
- `RunHistoryItem`/`RunDetail`/`StatRun`/`RunStats` (`run-repository.ts`, `run-stats.ts`) étendus.
  ⚠️ Les 4 tests existants de `aggregateRunStats` (`run-stats.test.ts`) comparent le retour par
  `toEqual({...})` **littéral** — ajouter des champs à `RunStats` les casse mécaniquement. Ils sont
  à mettre à jour dans le même incrément, pas une régression à découvrir après coup (relevé en
  relecture de spec).
- Affichage « par sortie » : `run/summary.tsx`, à côté de distance/durée, **absent si `null`** (pas
  une ligne à 0 m, convention « absent, jamais zéro » déjà établie ailleurs dans le projet).
- Affichage « par période » : `running-history/index.tsx` (`StatsSection`), extension du même bloc
  semaine/mois/depuis le début qui affiche déjà distance/durée/nombre de sorties.

**Hors périmètre** :
- Profil d'altitude / courbe de dénivelé (nécessiterait d'étendre le codec, §0 — hors périmètre
  délibéré de cette US).
- Export GPX avec balise `<ele>` (même raison).
- Réglage utilisateur des seuils R1/R3 — valeurs fixes en V1 (R7 les identifie comme à ajuster après
  recette terrain, pas comme configurables par l'utilisateur).
- Rattrapage rétroactif des courses déjà enregistrées (R5, donnée source absente, pas récupérable).

## 4. i18n

Nouvelle famille `running.elevation.*`, FR + EN :
- `gainLabel` — « Dénivelé + » / « Elevation gain ».
- `lossLabel` — « Dénivelé − » / « Elevation loss ».
- `statLabel` — « Dénivelé » / « Elevation » (libellé court pour le bloc stats par période, un seul
  chiffre = D+ ; D− affiché en complément si non nul).

## 5. Comportement offline

**Total pour la lecture/l'affichage.** Le calcul du dénivelé, lui, dépend de la **disponibilité de
l'altitude GPS**, indépendante du réseau (aucun appel externe, aucune dépendance à une carte
d'élévation tierce — contrairement à RUN-F3b/météo, qui elle exige un réseau et a été mise de côté
pour cette raison). Une course entièrement suivie en mode avion produit un dénivelé normalement,
comme la distance.

## 6. Accessibilité

Les deux valeurs (dénivelé + course, dénivelé par période) sont des `Text` au même niveau que les
statistiques existantes (distance, durée) — pas de traitement spécial, cohérent avec le reste de
l'écran.

## 7. Critères de recette

- [ ] 1. Une sortie sur terrain vallonné affiche un dénivelé positif et négatif plausibles (à
      comparer visuellement avec un tracé de référence Strava/Garmin/IGN sur le même parcours —
      R7, pas un chiffre exact attendu mais un ordre de grandeur cohérent).
- [ ] 2. Une sortie sur terrain plat n'affiche pas un dénivelé cumulé qui grimpe anormalement au fil
      des minutes (vérifie que le filtre de bruit R3 fonctionne réellement, pas seulement en théorie).
- [ ] 3. Une pause manuelle suivie d'une reprise ne produit pas un saut de dénivelé au moment de la
      reprise (R4).
- [ ] 4. Une course manuelle (sans GPS) n'affiche aucune ligne de dénivelé (R5, absent pas zéro).
- [ ] 5. Une course enregistrée avant cette US n'affiche aucune ligne de dénivelé sur son résumé
      (R5/§0, donnée absente) mais n'empêche pas les stats de période de sommer les autres courses.
- [ ] 6. Le bloc stats par période (semaine/mois/depuis le début) affiche un dénivelé cumulé cohérent
      avec la somme des sorties individuelles de la période.
- [ ] 7. **Mode avion** : le dénivelé se calcule normalement pendant toute la course.
- [ ] 8. En **EN** : les libellés `running.elevation.*` sont grammaticaux.
- [ ] 9. TalkBack énonce les valeurs de dénivelé normalement (pas de régression sur l'écran résumé
      ni sur l'écran historique).
