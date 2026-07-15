# Catalogue des analyses de données (intra & inter-piliers)

Ce document recense **de façon exhaustive le besoin d'analyses** de l'écosystème bien-être
(Musculation, Running, Nutrition, et leurs croisements). Il sert de **source pour de futures US** :
chaque ligne est un candidat à cadrer (spec → plan → design → validation) selon le workflow projet.

> **État : non figé.** Premier jet généré le **15/07/2026** (agrégation multi-agents, dédoublonnée).
> À **nettoyer, arbitrer et prioriser par Florian & Damien** avant toute entrée en pipeline.
> Le différenciateur produit est **l'intégration** : les analyses inter-piliers et tri-piliers sont
> le cœur de la valeur, à ne pas sous-pondérer face aux analyses intra-pilier plus classiques.

## Légende des statuts

- ✅ **existe** — implémenté (logique dans `packages/shared/src` et/ou écrans mobiles).
- 🟡 **partiel** — socle présent mais incomplet (brique existante à consolider/exposer).
- ⏳ **différé** — cadré (spec/US/IDEAS) mais non réalisé.
- 🆕 **nouveau** — proposé ici, non encore cadré.

## Règle transverse — filtrage par piliers actifs

Les analyses sont **conditionnées aux piliers que l'utilisateur a activés** (décision H,
« intégration sans imposition » : les onglets/piliers non activés sont masqués). Aucune analyse ne
doit s'afficher ni consommer des données d'un pilier inactif.

- **1 pilier activé** → uniquement les analyses **intra** de ce pilier. Aucune inter, aucune tri.
- **2 piliers activés** → intra des deux + **inter uniquement sur cette paire**. Les autres
  croisements et le tri-piliers restent masqués.
- **3 piliers activés** → tout est disponible.
- Les analyses **Méta / Dérivées** s'appliquent **dans le périmètre des piliers actifs** seulement.
- **Côté IA** : le proxy n'envoie au modèle que les données des piliers actifs ; insights et chatbot
  ne raisonnent que sur ceux-ci.

_Précédent d'implémentation : le dashboard filtre déjà ses widgets par `active_pillars` via
`WIDGET_PILLARS` + `resolveDashboardLayout` (`packages/shared/src/dashboard.ts`) ; les analyses
héritent de la même logique de gating (`user_settings.active_pillars`)._

## Source transverse — indicateurs subjectifs quotidiens (check-in)

Au-delà des données **mesurées** (séances, courses, repas, poids), l'utilisateur peut renseigner
**chaque jour** des **indicateurs subjectifs** : score de **sommeil**, **motivation**, **fatigue**,
**stress**, humeur, énergie. Ces signaux sont une **source transverse à croiser dans les analyses** —
ils expliquent souvent ce que les chiffres seuls ne disent pas (contre-perf, plateau, surmenage).

- **À croiser notamment avec** : score de forme / readiness (TRI-03), récupération, alerte
  surentraînement/sous-récup (TRI-12), déficit + charge, qualité des séances, tendance des PR.
- **Exemples d'analyses 🆕** : « corrélation sommeil ↔ performance », « stress/fatigue élevés sur N
  jours → recommander repos/deload », « motivation en baisse → nudge/rappel bienveillant »,
  « readiness = f(sommeil, fatigue, charge, RPE) ».
- **Prérequis (🆕, non cadré)** : un **check-in quotidien léger** (~10 s le matin) + une table
  historisée dédiée. Cf. idées `journal-bien-etre` et « check-in quotidien » dans
  [IDEAS.md](../../IDEAS.md). C'est une **dimension transverse** (façon 4ᵉ dimension « wellness »),
  pas un 4ᵉ pilier activable.
- **Gating** : soumis à la règle des piliers actifs ci-dessus **et** au freemium (les analyses
  croisées poussées qui exploitent ces signaux sont payantes — voir
  [ia-integration-analyse.md](ia-integration-analyse.md) §6).

---

## Intra-Musculation

| ID | Statut | Analyse | Description | Données sources | Sortie | Fenêtre | Intention | US liée |
|---|---|---|---|---|---|---|---|---|
| MUSC-01 | ✅ | Volume total par séance | Tonnage Σ(reps×charge), échauffements exclus, dans le résumé de fin de séance. | `workout_sets`, `computeVolume()` (workout.ts) | stat | par séance | Feedback immédiat de charge ; comparaison séance à séance. | 3.35 |
| MUSC-02 | ✅ | Records personnels auto-détectés | Détection par exercice de 3 candidats records (charge max, 1RM estimé, meilleur volume de série). | `workout_sets`, `personal_records`, `computeWorkoutRecords()` | badge | par séance / cumul | Motivation sans boucle de jeu (arbitrage C). | 3.22 / 6.3 |
| MUSC-03 | ✅ | 1RM estimé (Epley) | Force max théorique 1 rép : charge×(1+reps/30). Dénominateur commun inter-séries. | `workout_sets`, `estimate1RM()` (records.ts) | stat | par série/séance | Normaliser la performance pour suivre la force réelle. | 3.22 |
| MUSC-04 | ✅ | Courbe de progression charge & volume par exercice | Écran `/progress` : courbe temporelle **charge max / volume / 1RM estimé (meilleur par séance)** par exercice, 4 périodes (30 j / 90 j / 1 an / **tout**). Métrique 1RM réutilise `estimate1RM`/`sessionBestEstimated1RM` (shared). | `workout_sets` agrégés, `personal_records` | courbe | 30/90 j/1 an/tout | Tendance long terme d'un mouvement, valider la surcharge. | **3.21 / 6.2 (livrée)** |
| MUSC-05 | ⏳ | Volume par groupe musculaire / semaine | Séries effectives et tonnage par groupe (heatmap/barres), échauffements exclus ; signale les déséquilibres. Widget muscle-volume existant à éclater par groupe. | `workout_sets` × `exercises.musclePrimary` | widget | hebdo glissant | Vérifier un stimulus suffisant et équilibré par groupe. | 3.40 / 6.4 / 7.9 |
| MUSC-06 | ⏳ | Alerte de déséquilibre musculaire | Détecte un groupe très sous-sollicité sur 14 j et invite à rééquilibrer. | `workout_sets` + `exercises.musclePrimary` | alerte | glissant 14 j | Prévenir déséquilibres posturaux et risque de blessure. | 3.41 |
| MUSC-07 | ⏳ | Surcharge progressive assistée | Suggère la prochaine charge/reps depuis les dernières perfs (et RPE). Suggérée, jamais imposée. | `workout_sets` récents, `workouts.rpe` | insight | séance suivante | Guider la progression sans calcul mental (sans imposition). | 3.7 / 6.5 |
| MUSC-08 | ⏳ | Détection de stagnation & deload | Échec (<80 % reps) 2 sem. consécutives → propose −10 %. Extension : plateau du 1RM estimé sur N sem. | `workout_sets` vs cibles, historique 1RM | alerte | 2 sem. / 4-6 sem. | Sortir d'un plateau, prévenir surmenage et abandon. | 3.8 |
| MUSC-09 | ⏳ | PR par plage de reps | Meilleure charge par tranche de reps (1/3/5/8/10/12+), courbe charge↔reps. | `workout_sets` groupés par bucket de reps | tableau | cumul | Suivre la force sur tout le spectre, pas que le 1RM. | 6.3 |
| MUSC-10 | ⏳ | Notification de nouveau record | Push + célébration quand un candidat dépasse le record historique. | candidats vs `personal_records` | alerte | temps réel | Renforcement positif immédiat (arbitrage C). | 3.42 / 2.7 |
| MUSC-11 | 🆕 | Ratio pousser / tirer | Rapport de volume (ou séries) poussée/tirage sur fenêtre glissante ; ~1 = équilibre sain. | `workout_sets` × type de mouvement (à matérialiser) | stat | glissant 7/14 j | Prévenir déséquilibres épaule/posture (excès de poussée). | — |
| MUSC-12 | 🆕 | Densité d'entraînement (volume/temps) | Volume total ÷ durée effective (kg·reps/min). | `computeVolume` + `workouts.durationSeconds` | stat | par séance, tendance | Mesurer les gains de capacité de travail. | — |
| MUSC-13 | 🆕 | Répartition par type de série | Distribution normal/échauffement/superset/durée/poids de corps. | `workout_sets.setType` | stat | hebdo/mensuel | Comprendre son style et le ratio travail effectif/échauffement. | — |
| MUSC-14 | 🆕 | Analyse du temps de repos réel | Repos effectif (horodatages de validation) vs repos configuré. | timestamps `workout_sets`, repos cible | insight | par séance, tendance | Optimiser la récupération inter-séries selon l'objectif. | — |
| MUSC-15 | 🆕 | Distribution par plage de reps (force/hyper/endurance) | Part de volume en zones 1-5 / 6-12 / 13+. | `workout_sets.reps` bucketisé pondéré volume | courbe | mensuel/bloc | Cohérence objectif déclaré ↔ travail effectif. | — |
| MUSC-16 | ⏳ | Progression au % du max (%1RM) | Chaque charge en % du 1RM courant ; intensité relative moyenne. Base d'une planif en pourcentages. | `workout_sets.weightKg` / 1RM courant | courbe | par séance/bloc | Piloter l'intensité, préparer le module SBD. | IDEAS module-powerlifting |
| MUSC-17 | 🆕 | Courbe de force SBD | Évolution comparée des 1RM squat/bench/deadlift + total. | `personal_records` / 1RM des 3 lifts | courbe | 3 mois/1 an/tout | Suivre la force globale, repérer un lift à la traîne. | IDEAS module-powerlifting |
| MUSC-18 | 🟡 | Fréquence de sollicitation par groupe | Nb de fois/sem où chaque groupe est travaillé (distinct du volume). | `workouts` distincts × `exercises.musclePrimary` | stat | hebdo | Optimiser la répartition du volume dans la semaine. | 6.4 |
| MUSC-19 | 🆕 | Tonnage cumulé (lifetime/annuel) | Somme totale de kg soulevés + jalons symboliques (1 000 000 kg). | `computeVolume` cumulé | stat | lifetime/annuel | Rétention et fierté ; matière à souvenirs. | IDEAS souvenirs |
| MUSC-20 | 🆕 | Régularité & consistance d'entraînement | Séances/sem vs objectif, écart-type des intervalles, taux de séances tenues. | `workouts`, `planned_sessions`, `programs` | stat | hebdo/mensuel | Assiduité réelle, complément quantitatif du streak. | — |
| MUSC-21 | 🆕 | Exercices délaissés / négligés | Favoris/habituels non faits depuis N sem., groupes non travaillés récemment. | `exercise_favorites`, historique `workout_sets` | insight | glissant 3-4 sem | Éviter les angles morts et l'ennui. | — |
| MUSC-22 | 🆕 | Vitesse de progression (temps entre records) | Durée entre 2 PR successifs, gain moyen de 1RM/mois. | `personal_records` ordonnés | stat | historique | Objectiver le ralentissement (approche du plafond). | — |
| MUSC-23 | 🆕 | Tendance du RPE / fatigue accumulée | RPE de fin de séance dans le temps, RPE moyen rapporté au volume. | `workouts.rpe` + volume | courbe | glissant 2-4 sem | Anticiper le besoin de deload avant la blessure. | IDEAS score-readiness |
| MUSC-24 | 🆕 | Volume relatif au poids de corps | Charges/1RM en multiples de PdC (ex. squat 1,5×), volume normalisé. | `workout_sets` + `body_weight_entries` | stat | par séance/tendance | Suivre la force relative. | — |
| MUSC-25 | 🆕 | Répartition du volume par exercice au sein d'un groupe | Décompose le volume d'un groupe par exercice (sur-dépendance à un mouvement). | `workout_sets` par exercice dans un `musclePrimary` | stat | hebdo/mensuel | Diversifier les angles de travail. | — |
| MUSC-26 | 🆕 | Durée moyenne de séance & tendance | Durée moyenne, évolution, répartition échauffement/travail ; séances anormales. | `workouts.durationSeconds`, startedAt/finishedAt | stat | par séance/tendance | Optimiser le temps en salle, repérer les dérives. | — |
| MUSC-27 | ⏳ | Points de force relative (Wilks/DOTS/IPF GL) | Score normalisé au poids de corps pour comparer à travers les catégories. | `personal_records`, `body_weight_entries`, `profiles.sexe` | score | par record/tendance | Métrique reine du powerlifting (force réelle quand le poids bouge). | module-powerlifting |
| MUSC-28 | 🆕 | Standards de force relative par mouvement (×PdC) | 1RM/PdC positionné débutant→élite, révèle le mouvement en retard. | `personal_records`/1RM, `body_weight_entries`, `exercises` | insight | instantané + progression | Contextualiser la force et prioriser le point faible. | module-powerlifting |
| MUSC-29 | ⏳ | Total SBD & projection de compétition | Total des 3 lifts + projection à date via pente ; répartition d'essais. | `personal_records`/`workout_sets` SBD, régression | stat | instantané + projection | Piloter une prépa de compétition de force. | module-powerlifting |
| MUSC-30 | 🆕 | Distribution du volume par zone d'intensité (%1RM) | Séries/tonnage par bandes de %1RM (<70 / 70-85 / >85). | `workout_sets` / 1RM par exercice | tableau | par bloc/mésocycle | Vérifier l'adéquation intensité ↔ objectif de bloc. | module-powerlifting |
| MUSC-31 | 🆕 | e1RM basé sur RPE/RIR (autorégulation) | 1RM depuis charge×reps×RPE (table RPE→%1RM) ; baisse à RPE constant = fatigue. | `workout_sets` (charge, reps, RPE), table RPE→%1RM | courbe | par séance, tendance | Piloter par autorégulation, détecter la fatigue plus tôt. | module-powerlifting |
| MUSC-32 | 🆕 | Repères de volume MEV/MAV/MRV par groupe | Volume hebdo (séries dures/groupe) vs repères scientifiques ; signale sous-MEV / sur-MRV. | `workout_sets` agrégés par groupe | insight | hebdo | Cadrer le volume d'hypertrophie sur des repères actionnables. | catalogue |
| MUSC-33 | 🆕 | Prescrit vs réalisé (charge/reps/RPE) | Confronte la prescription du programme au réalisé : taux d'exécution, écarts. | `exercise_plans`/`programs`, `workout_sets`, RPE | tableau | par séance | Mesurer la conformité au plan (base du suivi coaché). | module-coach-coache |
| MUSC-34 | 🆕 | Record personnel contextualisé | Enrichit chaque PR : poids de corps, force relative, phase nutritionnelle, fraîcheur (TSB). | `personal_records`, `body_weight_entries`, `food_entries` | insight | à chaque record | Interpréter la vraie valeur d'un record (PR en sèche ≠ PR en surplus). | catalogue |
| MUSC-35 | 🆕 | Courbe dose-réponse : volume optimal personnel | Volume hebdo/groupe ↔ gains observés → zone de rendement décroissant propre. | `workout_sets`, `personal_records`, RPE | insight | glissant 12-16 sem | Individualiser le volume (vs règle générique 10-20 séries). | — |
| MUSC-36 | 🆕 | Temps jusqu'au prochain record (survie) | Distribution des délais entre PR → probabilité/échéance du prochain PR. | `personal_records`, `running_pace_records` | stat | historique par exercice | Anticipation motivante ; distinguer sécheresse et plafonnement. | — |

---

## Intra-Running

| ID | Statut | Analyse | Description | Données sources | Sortie | Fenêtre | Intention | US liée |
|---|---|---|---|---|---|---|---|---|
| RUN-01 | ✅ | Volume de distance par période | Distances cumulées semaine/mois/début (calé lundi & 1er du mois). | `runs.distanceM`, `aggregateRunStats()` | stat | sem/mois/cumul | Lecture immédiate du volume et de l'activité récente. | 5.28 |
| RUN-02 | ✅ | Temps total de course par période | Durée cumulée h-min-s ; complète la distance (séances au temps/sans GPS). | `runs.durationSeconds`, `formatDurationHms` | stat | sem/mois/cumul | Suivre la charge en temps, y compris tapis/manuel. | 5.28 |
| RUN-03 | ✅ | Records par distance (meilleur segment glissant) | Meilleur temps 1/5/10 km/semi/marathon comme meilleur segment interne à une sortie. | `gpsTrack` → `computeRunRecords`, `running_pace_records` | badge | événementiel | Célébrer les progressions sur distances de référence. | 5.30 |
| RUN-04 | ✅ | MAJ auto de l'allure de référence 5 km | L'allure de réf. du profil se recale à chaque record 5 km. | `running_pace_records` → `running_profiles.ref_5k_pace` | insight | événementiel | Garder les cibles calibrées sur la forme réelle. | 5.31 |
| RUN-05 | 🟡 | Courbe & tendance d'allure moyenne (30/90 j) | Courbe d'allure + verdict (amélioration/stable/régression) par comparaison des 2 moitiés. | `runs.avgPaceSPerKm`, `paceTrendPoints`/`paceTrend` | courbe | glissant 30/90 j | Voir la progression au-delà de la variabilité d'une séance. | 5.29 |
| RUN-06 | ✅ | Allure instantanée & moyenne en course | Allure dernière minute glissante + moyenne depuis le départ, en temps réel. | trace GPS live, `instantPace`/`averagePace` | widget | temps réel | Piloter l'effort en direct, rester dans la zone cible. | 5.15 |
| RUN-07 | ⏳ | Séances par type de course | Décompte par type (endurance/fractionné/longue/récup/libre). | `runs` + type de séance (`planned_sessions`) | stat | sem/mois/cumul | Vérifier l'équilibre du plan (endurance vs intensité). | 5.28 |
| RUN-08 | 🆕 | Répartition & polarisation de l'entraînement | Part du volume en faible vs haute intensité (idéal ~80/20). | `runs` × type/zone d'allure | insight | sem/bloc 4 sem | Éviter la zone grise et prévenir le surmenage. | — |
| RUN-09 | ⏳ | Dénivelé cumulé +/- | Dénivelé positif/négatif par sortie et période. **Altitude non capturée aujourd'hui** (à ajouter au modèle GPS). | altitude par point GPS (à ajouter) | stat | sortie + sem/mois | Contextualiser l'allure (lente en côte ≠ régression). | 5.32 |
| RUN-10 | ⏳ | Tableau des allures par km (splits) | Découpage km par km avec allure de chaque km. | `gpsTrack` + `cumulativeDistances` (segmentation à coder) | tableau | par sortie | Analyser la gestion d'effort, repérer les km trop rapides/lents. | 5.26 |
| RUN-11 | 🆕 | Negative split (gestion d'effort) | Allure 2ᵉ moitié vs 1ʳᵉ : negative/even/positive split. | `gpsTrack` → splits mi-course | insight | par sortie | Éduquer à gérer sa fin de course. | — |
| RUN-12 | 🆕 | Progression du volume hebdo & règle des 10 % | Volume vs semaine précédente, alerte si hausse >~10 %. | `aggregateRunStats(week)` sur semaines successives | alerte | sem vs sem-1 | Prévenir la surcharge (en analyse rétrospective, pas qu'en construction de plan). | 5.10 |
| RUN-13 | 🆕 | Régularité / assiduité (fréquence vs visée) | Sorties/sem vs fréquence hebdo visée, taux de respect. | `runs` vs `running_profiles.weekly_frequency` | score | glissant 4/8 sem | Renforcer la constance, moteur principal de progrès. | — |
| RUN-14 | 🆕 | Prédiction de temps de course (Riegel) | T2 = T1×(D2/D1)^1,06 depuis un record récent → 10 km/semi/marathon ; faisabilité d'un objectif chrono. | `running_pace_records` (meilleurs temps) | stat | à chaque record | Fixer un objectif chrono réaliste et une allure cible. | prolonge running-paces |
| RUN-15 | 🆕 | Courbe de progression sur distance de référence | Meilleur temps/allure sur une distance (5 km défaut), courbe des records successifs. | `running_pace_records.best_time_seconds` + achieved_at | courbe | historique/6-12 mois | Progression de fond, plus stable que l'allure moyenne bruitée. | — |
| RUN-16 | 🆕 | Estimation VMA / VO2max & évolution | Dérive la VMA de l'allure de réf. et suit son évolution ; VO2max associée. | `derivedVmaPace`/`VMA_COEFFICIENT`, historique ref 5 km | insight | à chaque MAJ réf. | Indicateur de cylindrée aérobie et sa tendance. | — |
| RUN-17 | 🆕 | Distribution du temps par zone d'allure | Histogramme du temps/distance par zone (récup/endurance/seuil/VMA). | `gpsTrack` → allure glissante, bornes `sessionTargetPace` | courbe | sortie + sem | Objectiver l'intensité réelle vs prévue. | — |
| RUN-18 | 🆕 | Charge d'entraînement & ACWR (running) | Charge hebdo (volume×RPE) et ratio 7 j/28 j, zone de risque (>1,5). | `runs.distanceM`/`durationSeconds` + rpe | score | 7 j vs 28 j | Piloter la montée en charge, signaler le risque de blessure. | — |
| RUN-19 | ⏳ | Réalisé vs objectif de séance | Distance/allure réalisées vs cibles de la séance planifiée (plage par bloc). | run terminé vs `planned_sessions`/`sessionTargetPace` | insight | par sortie | Savoir si la consigne d'allure a été tenue. | 5.25 |
| RUN-20 | 🆕 | Indice de dégradation sur sortie longue (fade) | Perte d'allure début→fin des sorties longues (dérive cardio-mécanique proxy). | `gpsTrack` → allures par quartile, filtre sortie longue | insight | sortie longue + tendance | Suivre l'endurance spécifique (prépa semi/marathon). | — |
| RUN-21 | 🆕 | Records de volume (plus longue sortie/distance) | Plus longue distance, plus longue durée, meilleur volume hebdo. | `runs.distanceM`/`durationSeconds`, agrégats hebdo | badge | événementiel + historique | Récompenser aussi les paliers de volume. | — |
| RUN-22 | 🆕 | Performance selon conditions (météo/terrain) | Croise l'allure avec météo (soleil/pluie/vent) et terrain (route/chemin/piste). | `runs.avgPaceSPerKm` + champs météo/terrain | tableau | historique | Ne pas confondre allure lente due au vent/à la boue et baisse de forme. | spec §5.3 |
| RUN-23 | 🆕 | Cadence de foulée (pas/min) | Cadence moyenne et par km, repère ~170-180. **Source cadence absente en V1** (capteur V2). | non capturée (capteur/wearable V2) | stat | sortie + tendance | Optimiser l'efficacité de foulée, réduire le risque de blessure. | — |
| RUN-24 | ⏳ | Allure vs fréquence cardiaque (découplage) | Rapport allure/FC et dérive à allure constante. **Dépend de la FC (V2 wearables).** | FC non dispo V1 | courbe | sortie + tendance | Mesurer l'efficience aérobie quand la FC sera dispo. | profil running §2 (V2) |
| RUN-25 | 🆕 | Habitudes de course (heatmap jours×heures) | Carte de chaleur des sorties par jour de semaine et créneau horaire. | `runs.startedAt`/`finishedAt` (jour+heure locale) | courbe | historique 3-6 mois | Aider à planifier là où l'on court réellement. | — |

---

## Intra-Nutrition

| ID | Statut | Analyse | Description | Données sources | Sortie | Fenêtre | Intention | US liée |
|---|---|---|---|---|---|---|---|---|
| NUTR-01 | ✅ | Calories du jour vs objectif | Consommé/cible + restant, dépassement en rouge. | `food_entries.kcal`, `nutrition_profiles`, `sumNutrients`/`targetCalories` | stat | jour, temps réel | Repère central : reste-t-il des calories à consommer ? | 4.20 / 4.6 |
| NUTR-02 | ✅ | Barres de progression macros P/G/L | Jauges g consommés vs g cibles + % d'atteinte. | `food_entries` (P/G/L), `macroGramsFromCalories()` | widget | jour | Piloter l'équilibre des macros au fil de la journée. | 4.21 |
| NUTR-03 | ✅ | Répartition macros en % (g ↔ %) | Conversion g↔% (les g priment), recalcul auto des deux vues. | `macroRatiosFromGrams`/`caloriesFromMacros` | stat | jour/profil | Comprendre la structure du régime (ex. 40/35/25). | 2.3 |
| NUTR-04 | ✅ | Calcul du besoin calorique (TDEE) & objectif | Mifflin-St Jeor × activité, + delta objectif ; surcharge manuelle. | `profiles`, `nutrition_profiles`, `tdee`/`targetCalories` | stat | profil | Fonder les objectifs sur un besoin personnalisé. | 2.2 / 4.9 |
| NUTR-05 | ✅ | Apports moyens 7/30 j (kcal + macros) | Moyenne/jour sur les jours réellement renseignés (jours vides exclus). | `food_entries` agrégés, `averageIntake()` | stat | glissant 7/30 j | Lisser le bruit quotidien, voir la tendance réelle. | 4.31 / 7.2 |
| NUTR-06 | ✅ | Poids de corps : courbe + tendance | Courbe 4 sem/3 mois/1 an + sens de tendance (seuil ±0,3 kg) ; inclut le widget tendance 7 j (`weightTrend`). | `body_weight_entries`, `weightTrend()` | courbe/widget | 4 sem/3 mois/1 an ; 7 j | Vérifier que la trajectoire de poids suit l'objectif. | 4.30 / 7.1 / 7.7 |
| NUTR-07 | ✅ | Micronutriments agrégés du jour | Somme des 31 micronutriments ; une clé n'apparaît que si renseignée (jamais forcée à 0). | `food_entries.micronutrients`, `sumMicronutrients()` | tableau | jour | Vue micronutritionnelle, socle des carences. | 4.33 |
| NUTR-08 | ✅ | Sel dérivé du sodium | Sel (g) = sodium (mg) × 2,5/1000, indicatif (non stocké). | `food_entries.micronutrients.sodium_mg`, `saltFromSodiumMg()` | stat | jour/aliment | Parler en sel (repère grand public) plutôt qu'en sodium. | 4.33 |
| NUTR-09 | ✅ | Résumé nutrition (widget dashboard) | Calories restantes + macros condensées, masqué si pilier inactif. | `dashboard.ts` (nutrition-summary) | widget | jour | Accès immédiat à l'essentiel sans ouvrir le journal. | 7.5 |
| NUTR-10 | ⏳ | Adhérence à l'objectif : jours dans la cible | Nb/taux de jours où les kcal tombent dans ±10 % de l'objectif. | `food_entries`/jour vs `targetCalories()` | score | 7/30 j | Mesurer la régularité (une moyenne juste peut cacher des jours yo-yo). | 7.2 |
| NUTR-11 | ⏳ | Progression vers l'objectif de poids (%) | % entre poids de départ et poids cible. **Champ objectif de poids à ajouter au schéma.** | `body_weight_entries` + objectif de poids (à ajouter) | stat | depuis le départ | Donner un cap chiffré et motivant. | 7.1 |
| NUTR-12 | ⏳ | Suivi hydratation | Apports eau/boissons vs objectif journalier (ml), incréments rapides. **Table dédiée à créer (V2).** | table dédiée (non présente) | widget | jour | Couvrir un pilier de base du bien-être. | spec §8 (V2) |
| NUTR-13 | 🆕 | Protéines par kg de poids de corps | g protéines/kg (ex. 1,8) + repère de fourchette selon l'objectif. | `food_entries.proteinG` + dernier `body_weight_entries` | insight | jour, moyenne 7 j | Repère le plus parlant pour le pratiquant de muscu. | — |
| NUTR-14 | 🆕 | Détection de carences vs ANC/RDA | Micronutriments (jour/7 j) vs références (ANC FR/RDA), % de couverture + alerte. **Table de références à ajouter.** | `sumMicronutrients()` + table ANC + profil | alerte | jour + glissant 7/30 j | Passer de la mesure au conseil (fer, calcium, oméga-3…). | prolonge 4.33 |
| NUTR-15 | 🆕 | Sucres / fibres / AGS vs seuils de référence | Sucres, fibres, acides gras saturés vs repères santé (fibres ≥25-30 g, seuils OMS). | `food_entries` + `foods` (données déjà stockées) | widget | jour, moyenne 7 j | Lecture qualité au-delà des macros globales. | — |
| NUTR-16 | 🆕 | Répartition calorique par repas | Part kcal/macros par repas (petit-déj/déj/dîner/collation/custom). | `food_entries` par `mealType` | courbe | jour, moyenne 7/30 j | Repérer un dîner trop lourd, le grignotage du soir. | — |
| NUTR-17 | 🆕 | Régularité du journal (taux de complétion) | Part de jours renseignés, plus longue série journalisée, trous de saisie. | distinct `food_entries.logDate` | score | 7/30/90 j | La fiabilité de toutes les stats dépend de l'assiduité. | — |
| NUTR-18 | 🆕 | Bilan calorique hebdomadaire | Cumul surplus/déficit de la semaine + décompte jours au-dessus/en dessous. | `food_entries`/jour vs `targetCalories()` sur 7 j | insight | semaine glissante | Raisonner en bilan hebdo plutôt qu'en pression quotidienne. | — |
| NUTR-19 | 🆕 | Variation de poids théorique vs réelle | Variation attendue (~7700 kcal/kg) vs variation pesée. | cumul écarts `food_entries`↔objectif + `body_weight_entries` | insight | 2-4 sem glissantes | Détecter un TDEE mal estimé ou une sous-déclaration. | — |
| NUTR-20 | 🆕 | Ratio oméga-3 / oméga-6 | Rapport oméga-6/oméga-3, repère (viser bas), alerte si déséquilibré. | `food_entries.micronutrients.omega_3_g`/`omega_6_g` | insight | moyenne 7/30 j | Indicateur qualité des lipides, données déjà présentes. | prolonge 4.33 |
| NUTR-21 | 🆕 | Constance des apports (variabilité) | Dispersion des kcal quotidiennes (écart-type/amplitude). | `food_entries` totaux/jour sur 14/30 j | stat | 14/30 j | À moyenne égale, la régularité change les résultats. | — |
| NUTR-22 | 🆕 | Score de qualité alimentaire | Note composite : densité protéique, fibres, AGS/sucres, diversité, micros couverts. | `food_entries` + `foods.category` + macros/micros | score | jour, moyenne 7 j | Résumer la qualité (pas que la quantité de calories). | — |
| NUTR-23 | 🟡 | Cyclage calorique jours entraînement vs repos | Objectif/apports jours à bonus d'entraînement vs jours de repos. | `nutrition_profiles.trainingDayBonus`, `trainingDayCalories()` | insight | semaine | Vérifier que le cyclage visé est réellement appliqué. | 2.2 / 4.7 |
| NUTR-24 | 🆕 | Densité calorique et volume alimentaire | kcal/100 g moyennes des aliments du jour (rassasiement vs densité). | `food_entries` (kcal, quantityG) | stat | jour, moyenne 7 j | Aider les sèches : privilégier le rassasiement à kcal égales. | — |
| NUTR-25 | 🆕 | Il te manque un repas (nudge doux) | Rappel bienveillant si le journal du jour semble incomplet, calé sur les habitudes. | `food_entries` (repas vs habitudes), `notifications.ts` | alerte | quotidien | Maintenir la complétude sans harceler ni culpabiliser. | 2.6/2.8 |

---

## Inter — Musculation ↔ Running

| ID | Statut | Analyse | Description | Données sources | Sortie | Fenêtre | Intention | US liée |
|---|---|---|---|---|---|---|---|---|
| MR-01 | ✅ | Coordination — deux séances le même jour | Badge discret dès ≥2 séances planned+done d'un même jour (tous piliers). | `planned_sessions` + `programs.pillar` (`useWeekPlan`) | badge | vue semaine planning | Rendre visible l'empilement de charge pour choisir d'espacer ou assumer. | 5.6 |
| MR-02 | 🟡 | Jour de repos réel affiché | Chaque jour sans séance (muscu ni course) étiqueté « Repos » en vue semaine. | `planned_sessions` (dayItems vides), `useWeekPlan` | insight | vue semaine | Voir où tombent les jours off entre les deux piliers. | 5.6 |
| MR-03 | 🟡 | Adhérence combinée — planifié vs réalisé | Taux de réalisation tous piliers (done vs planned+skipped+manquées), à consolider en ratio hebdo. | `planned_sessions`, `useMissedSessions`/`useWeekPlan` | stat | sem / 4 sem glissantes | Mesurer la régularité globale, pilier-agnostique. | 3.11 / 5.7 |
| MR-04 | 🟡 | Streak jours d'entraînement (muscu ∪ course) | Jours actifs consécutifs (muscu OU course). Variante « entraînement seul » non isolée du streak nutrition. | `computeStreak`/`activeDayKeys` (streak.ts) | score | continu | Motivation par la régularité ; base d'un découpage entraînement/nutrition. | 2.x |
| MR-05 | 🆕 | Charge d'entraînement combinée (sRPE) | Charge = RPE×durée, sommée muscu+course par jour/semaine — unité commune. | `workouts`/`runs` (rpe, durationSeconds) | courbe | jour+sem, tendance 8 sem | Mesure unique de la dose d'entraînement totale. | — |
| MR-06 | 🆕 | Volume horaire total d'entraînement | Temps total (durée muscu + course) par semaine/mois. | `workouts.durationSeconds` + `runs.durationSeconds` | stat | sem/mois/début | Objectiver l'investissement temps réel des deux piliers. | — |
| MR-07 | 🆕 | Équilibre force / cardio de la semaine | % (séances ou minutes) muscu vs course + zone cible selon l'objectif. | `workouts` + `runs`, `running_profiles`/objectif | widget | semaine glissante | Vérifier que la balance colle à l'objectif déclaré. | — |
| MR-08 | 🆕 | Interférence concurrent training | Signale un fort volume course coïncidant avec une chute du volume/charge muscu (et inversement). | `computeVolume` hebdo + `aggregateRunStats` hebdo, `personal_records` | insight | sem à sem, 4-8 sem | Éduquer sur l'arbitrage force/endurance, expliquer une stagnation. | — |
| MR-09 | ⏳ | Alerte surcharge / suggestion de jour de repos | Détecte l'accumulation de charge combinée et suggère un jour off (jamais imposé). | charge combinée sRPE + série de jours actifs | alerte | glissant 7-10 j | Prévenir blessure/épuisement = éviter l'abandon. | IDEAS garde-fou |
| MR-10 | 🆕 | Ratio charge aiguë:chronique (ACWR combiné) | Charge 7 j / moyenne 28 j des deux piliers ; zone verte ~0,8-1,3. | charge combinée sRPE quotidienne | score | 7 j / 28 j glissant | Piloter la progression globale sans à-coups. | — |
| MR-11 | 🆕 | Progression combinée trop rapide (règle des 10 %) | Alerte si le volume combiné muscu+course grimpe >~10 % d'une semaine à l'autre. | volume muscu hebdo + distance/durée course hebdo | alerte | sem vs sem-1 | Éviter les sauts de charge globale. | running.md §11 |
| MR-12 | 🆕 | Répartition hebdo des deux piliers (heatmap semaine) | Grille 7 jours colorée par pilier (muscu/course/mixte/repos). | `planned_sessions` + `programs.pillar`, `workouts`/`runs` | tableau | semaine | Visualiser la structure de la semaine (concentration vs étalement). | — |
| MR-13 | 🆕 | Densité hebdo & jours de repos réels comptés | Nb de jours d'entraînement (muscu ∪ course) sur 7 + jours off, alerte si 0 off. | `workouts.finishedAt` + `runs.finishedAt`, `isTrainingDay` | stat | semaine glissante | Garantir un minimum de récupération hebdo. | — |
| MR-14 | 🆕 | Jours consécutifs sans repos (alerte) | Plus longue série de jours d'entraînement sans off ; alerte au-delà d'un seuil (6-7 j). | jours actifs (workouts/runs), logique voisine de `computeStreak` | alerte | glissant | Repérer l'absence prolongée de récupération. | — |
| MR-15 | 🆕 | Séquençage muscu/course le même jour | Ordre effectif (startedAt) et écart, rappel du principe (force avant cardio si objectif force). | `workouts`/`runs` startedAt (même dayKey) | insight | jour à double séance | Optimiser l'enchaînement, limiter l'interférence. | 5.6 |
| MR-16 | 🆕 | Impact d'une grosse sortie sur la récup muscu (J+1) | Perf muscu (volume/RPE/records) lendemain de sortie longue vs lendemain de repos. | `runs` J ; `workouts`/volume, rpe J+1 ; `personal_records` | insight | appariement J→J+1 | Placer les grosses sorties loin des séances muscu clés. | — |
| MR-17 | 🆕 | Impact d'une séance jambes sur la course suivante | Courses dans 24-48 h après une séance jambes vs allure/RPE normal (jambes lourdes). | `workout_sets`→`exercises` (muscles) ; `runs` suivants | insight | 24-48 h post-jambes | Expliquer une allure en baisse, guider le placement. | — |
| MR-18 | 🆕 | Détection d'empilement jambes + course rapprochés | Alerte si grosse séance jambes et sortie intense planifiées à <X h. | `planned_sessions` (jambes via `exercises` + running) | alerte | jours adjacents | Prévenir la double sollicitation des jambes. | — |
| MR-19 | 🆕 | Tendance de la charge combinée (mésocycle) | Courbe charge combinée hebdo sur 8-12 sem + repère des phases (montée, deload). | charge sRPE hebdo (workouts+runs), deload muscu | courbe | 8-12 sem glissantes | Piloter la périodisation globale, rendre les décharges lisibles. | 3.8 |
| MR-20 | 🆕 | Cohérence des ressentis RPE (muscu vs course) | RPE moyen muscu et course ; hausse simultanée = fatigue globale montante. | `workouts.rpe` ; `runs.rpe` | courbe | sem / 4 sem | Capter la fatigue subjective transverse tôt. | — |
| MR-21 | 🆕 | Suggestion de placement du jour de repos | Propose le meilleur jour off (casse la plus longue série, sépare deux journées lourdes). | `planned_sessions` (répartition pilier/jour) | insight | semaine à venir | Optimiser la récupération sans raisonnement manuel. | — |
| MR-22 | ⏳ | Bilan hebdo d'entraînement combiné | Récap narratif : séances, sorties, volume, charge, records, repos, tendance vs sem-1. | `workouts`+`runs`+records agrégés | insight | hebdomadaire | Feedback périodique motivant mettant les deux piliers en perspective. | IDEAS bilan hebdo |
| MR-23 | ⏳ | Score de récupération / readiness croisé | « Prêt à performer » depuis charge combinée, RPE, jours de repos (sans wearable en V1). | charge sRPE + RPE + densité repos | score | quotidien (7 j) | Guider l'intensité du jour selon la fraîcheur globale. | IDEAS score-readiness |

---

## Inter — Musculation ↔ Nutrition

| ID | Statut | Analyse | Description | Données sources | Sortie | Fenêtre | Intention | US liée |
|---|---|---|---|---|---|---|---|---|
| MN-01 | ✅ | Bonus calorique les jours de muscu | Objectif = cible + bonus paramétré les jours de séance planifiée/réalisée. | `nutrition_profiles.trainingDayBonus`, `isTrainingDay`, `trainingDayCalories()` | stat | par jour | Manger plus les jours d'effort ; 1er pont entraînement↔nutrition. | 4.7 |
| MN-02 | ✅ | Alerte déficit calorique + fort volume muscu | **Widget dashboard conditionnel** : apports moyens ≥ 15 % sous l'objectif de base (sur **≥ 4 jours loggés**) ET volume muscu 7 j ≥ 8000. Gating **muscu + nutrition**. Migrée de l'écran Stats vers le dashboard (15/07/2026). | `computeDeficitVolumeAlert`/`shouldAlertDeficitVolume` (bodyweight.ts), `food_entries`, `workout_sets` | widget | 7 j glissants | Prévenir la fonte musculaire/contre-perf due au sous-apport. | **4.32 (livrée)** |
| MN-03 | ⏳ | Vue croisée séances muscu vs apports de la semaine | Superpose volume/nb séances muscu et kcal/macros moyennes, semaine par semaine. Seule l'alerte est codée. | `workouts`/`workout_sets`, `food_entries` | tableau | hebdo, multi-semaines | Lire si l'alimentation suit la charge d'entraînement. | 4.32 / §7.3 |
| MN-04 | ⏳ | Macros ajustées jours muscu (glucides péri-séance) | Réoriente les macros les jours de séance (glucides plus hauts) dans le planning repas. | `nutrition_profiles`, `planned_sessions` muscu, `defaultMacroRatios()` | widget | par jour | Placer les glucides là où ils servent perf/récupération. | §6.2 / 4.7 |
| MN-05 | ✅ | Moyenne d'apports vs objectif (fenêtre glissante) | Apports moyens/jour (jours vides exclus) confrontés à l'objectif et à la charge. | `averageIntake()`, `food_entries`, `nutrition_profiles` | stat | glissant 7/14/30 j | Base fiable pour les corrélations. | 4.32 (support) |
| MN-06 | 🆕 | Protéines/kg vs volume muscu (assez pour construire ?) | Apport protéique (g/kg) vs cible dépendant du volume/objectif (1,6-2,2 g/kg en bulk). | `food_entries.proteinG`, `body_weight_entries`, `workout_sets`, objectif | score | moyenne 7/30 j | Garantir le substrat de construction musculaire. | — |
| MN-07 | 🆕 | Surplus calorique vs prise de masse effective | Surplus réel vs variation de poids et progression de force : surplus stérile ou insuffisant ? | `food_entries`, `tdee`/`targetCalories`, `body_weight_entries`, `personal_records` | insight | 2-4 sem glissantes | Piloter le bulk (max muscle vs gras). | — |
| MN-08 | 🆕 | Déficit vs perte de force/performance | En sèche, corrèle le déficit à l'évolution charges/volume ; alerte si baisse de 1RM concomitante. | `food_entries` vs `targetCalories`, `personal_records`, `computeVolume` | alerte | 2-4 sem glissantes | Sécher en préservant la force. | — |
| MN-09 | 🆕 | Recomposition corporelle | Poids ~stable + force/1RM en hausse + apports proches du maintien → badge valorisant. | `weightTrend()`, `personal_records`, `targetCalories` maintien | badge | 4-8 sem glissantes | Rassurer quand le poids ne bouge pas mais la composition s'améliore. | — |
| MN-10 | 🆕 | Apport protéique fractionné sur la journée | Répartition des protéines entre repas (3-4 prises de 0,3-0,4 g/kg), surtout jours muscu. | `food_entries` par mealType, `nutrition_profiles.meals`, poids | insight | par jour | Optimiser la stimulation de la synthèse protéique. | — |
| MN-11 | 🆕 | Corrélation apports ↔ records de force | Met en regard les PR et le contexte nutritionnel des jours/semaines précédents. | `personal_records.achievedAt`, `food_entries` amont | courbe | événementiel + amont | Identifier le carburant qui favorise les pics de performance. | — |
| MN-12 | 🆕 | Prise de masse propre vs grasse | Vitesse de prise de poids × progression de force (× mensurations) → qualité du gain. | `body_weight_entries`, `personal_records`, volume ; mensurations (à ajouter) | insight | 4-8 sem glissantes | Maximiser le ratio muscle/gras en prise de masse. | — |
| MN-13 | 🆕 | Ratio g/kg protéines vs cible par objectif | Jauge protéines (g/kg) vs cible dérivée de l'objectif (bulk/cut/maintain). | `food_entries.proteinG`, `body_weight_entries`, objectif | widget | jour + moyenne 7 j | Lisible d'un coup d'œil selon le but. | — |
| MN-14 | 🆕 | Glucides péri-séance (repas Pré-/Post-workout) | Exploite les repas custom pré/post pour mesurer les glucides autour de la séance. | `nutrition_profiles.meals`, `food_entries`, `isTrainingDay` | insight | jour de séance | Assurer énergie et récupération autour de l'entraînement. | — |
| MN-15 | 🆕 | Disponibilité énergétique jours de fort volume | Jours de très fort volume muscu + apports faibles (sous BMR/cible) — plus fin que l'alerte hebdo. | `computeVolume` jour, `food_entries` jour, `basalMetabolicRate` | alerte | par jour | Éviter les journées lourdes sous-alimentées. | — |
| MN-16 | 🆕 | Adhérence macros : jours de muscu vs repos | Taux d'atteinte (±10 %) jour de séance vs repos ; révèle des dérives comportementales. | `food_entries` vs cibles, `isTrainingDay` | stat | 30 j segmentée | Aligner le comportement alimentaire au calendrier. | §7.2 |
| MN-17 | 🆕 | Corrélation surplus/déficit hebdo ↔ pente du 1RM | Régresse la balance énergétique hebdo contre la pente d'évolution du 1RM. | `food_entries` hebdo, `tdee`, `personal_records`, `exercise_favorites` | courbe | hebdo, plusieurs sem | Objectiver le lien nutrition→force. | — |
| MN-18 | 🆕 | Détection stagnation de force + apport insuffisant | Force/volume stagnant + protéines/kcal sous la cible → nutrition comme cause plausible. | `personal_records`/volume, `food_entries` vs cibles | insight | 3-4 sem glissantes | Débloquer un plateau via le levier nutritionnel. | — |
| MN-19 | 🆕 | Vitesse de prise/perte de poids vs objectif | kg/semaine réel vs fourchette saine liée à l'objectif ; alerte si trop rapide. | `body_weight_entries`/`weightTrend`, objectif | alerte | 2-4 sem glissantes | Caler le rythme de recomposition sur la préservation musculaire. | — |
| MN-20 | 🆕 | Bilan énergétique jour muscu vs repos | Kcal réelles jours de séance vs repos au regard des cibles respectives. | `food_entries`, `trainingDayCalories`/`targetCalories`, `isTrainingDay` | stat | 30 j segmentée | Contrôler que la cyclisation calorique est vécue, pas théorique. | — |
| MN-21 | 🆕 | Efficacité alimentaire par kg de volume soulevé | kcal (ou protéines) rapportées au volume muscu hebdo (kcal/1000 kg·reps). | `food_entries` hebdo, `computeVolume` hebdo | stat | hebdo | Repère de proportionnalité effort/carburant. | — |
| MN-22 | 🆕 | Score de cohérence nutrition ↔ objectif muscu | Score 0-100 : objectif cohérent, protéines g/kg, balance énergétique, tendance de poids. | `nutrition_profiles` vs objectif, `food_entries`, `body_weight_entries`, records | score | 4 sem glissantes | Verdict unique et actionnable sur la synergie muscu/nutrition. | — |
| MN-23 | 🆕 | Corrélation apports ↔ progression de performance | Solde calorique hebdo vs progression charges/1RM/volume (cas concret du moteur de corrélation). | `food_entries` + `nutrition_profiles` ; `personal_records` + `workout_sets` | insight | 6-12 sem glissantes | Preuve personnalisée du pari intégration ; candidat premium. | prolonge §7.3 |
| MN-24 | 🆕 | Simulateur what-if nutrition → poids | « Si je tiens X kcal/j pendant N sem → poids estimé » (~7700 kcal/kg) ; réciproque. | `nutrition_profiles` (TDEE), `body_weight_entries` | stat | projection 4-16 sem | Choisir un objectif calorique réaliste avant de s'engager. | — |

---

## Inter — Running ↔ Nutrition

| ID | Statut | Analyse | Description | Données sources | Sortie | Fenêtre | Intention | US liée |
|---|---|---|---|---|---|---|---|---|
| RN-01 | ✅ | Dépense calorique estimée d'une course | `estimateRunCalories` (running.ts, testée) : NET ≈ poids × distance × 1,0 kcal/kg/km + terme d'intensité borné (EPOC, +1 %/km·h > 8 km/h, plafond +10 %). Brique de base course↔nutrition. | `runs`, `body_weight_entries`, `profiles` | stat | par course | Vraie dépense d'une sortie pour piloter les apports. | **RN-01/RN-02 (livrée)** |
| RN-02 | ✅ | Objectif calorique du jour ajusté par la course | Réglage **Forfait/Auto** (`nutrition_profiles.training_bonus_mode`) : en Auto l'objectif du jour suit la dépense estimée des courses terminées (`dayCalorieBonus`, hook `useDayCalorieTarget(dayKey)`), repli forfait les jours muscu ; badge « · course ». Forfait = comportement historique inchangé. | `nutrition_profiles.training_bonus_mode`/`trainingDayBonus`, `runs`, `planned_sessions` | widget | jour | Manger plus les jours de course sans calcul manuel. | **RN-01/RN-02 (livrée)** |
| RN-03 | ⏳ | Ajustement auto du TDEE selon le volume de course | Facteur d'activité (ou +kcal) dérivé du volume réellement enregistré. `activityFactor` reste statique. | `activityFactor`/`tdee`, `runs` agrégés, `nutrition_profiles` | stat | glissant 7-14 j | Objectif calorique qui suit la charge réelle. | §2.2 |
| RN-04 | 🆕 | Calories nettes restantes après course | « objectif + dépense course − apports = restant » sur le dashboard les jours de sortie. | `food_entries`, `runs`, `targetCalories`, nutrition-summary | widget | jour | Vue immédiate de la marge alimentaire après avoir couru. | §5.2 |
| RN-05 | 🆕 | Besoin glucidique selon le volume de course | Cible glucides g/kg selon la charge (repos ~3-5, modéré ~5-7, gros ~7-10). | `runs`, `body_weight_entries`, `macroGramsFromCalories` | score | jour/semaine | Assurer le carburant glucidique de l'endurance. | §2.3 |
| RN-06 | 🆕 | Périodisation glucidique jours durs vs faciles | Glucides hauts (fractionné/VMA, longue) vs bas (endurance courte/repos, train-low). | `planned_sessions`/`programs` (type), macros | insight | jour | Aligner l'apport glucidique sur l'intensité (perf + composition). | running §4 |
| RN-07 | 🆕 | Fueling sortie longue (avant/pendant/après) | Plan carburant : pré-course, pendant (~30-60 g glucides/h au-delà de 75-90 min), recharge après. | `planned_sessions` (durée/type), `runs`, nutrition | insight | par sortie longue | Éviter le mur du glycogène ; cœur du différenciateur. | §4.3 |
| RN-08 | 🆕 | Recharge glycogène & fenêtre de récup post-course | Cible glucides ~1 g/kg + protéines ~0,3 g/kg dans les ~2 h, vérifiée sur le journal. | `runs`, `food_entries` (horodatage), poids | alerte | 2 h post-course | Optimiser la reconstitution du glycogène et la récupération. | §4.3 |
| RN-09 | 🆕 | Protéines de récupération post-course | Besoin protéique lié à la course (durée/dénivelé/intensité) vs apport du jour. | `runs`, `food_entries` (protéines), nutrition | stat | jour | Soutenir la récupération musculaire du coureur. | §2.3 |
| RN-10 | 🆕 | Alerte sous-alimentation du coureur | Déficit marqué + volume de course élevé (risque RED-S). Équivalent muscu existe, pas pour la course. | `shouldAlertDeficitVolume` (modèle), `runs` hebdo, `food_entries` | alerte | semaine | Prévenir la sous-alimentation chronique face à l'endurance. | §7.3 / 4.32 |
| RN-11 | 🆕 | Déficit calorique ↔ dégradation de l'allure | Corrèle le déficit moyen avec `paceTrend` : restriction trop forte → allure en déclin. | `paceTrend`/`paceTrendPoints`, `food_entries`, `targetCalories` | courbe | glissant 21-30 j | Montrer le prix en perf d'un déficit mal dosé. | §7.3 |
| RN-12 | 🆕 | Perte de poids vs baisse de performance | Superpose courbe de poids et courbe d'allure : perte qui aide l'économie vs perte qui casse la perf. | `weightTrend`, `paceTrend`, `runs`, `body_weight_entries` | courbe | glissant 4-12 sem | Trouver le poids où la perf progresse. | §7.1 |
| RN-13 | 🆕 | Économie de course : allure normalisée au poids | Allure ramenée au poids dans le temps (proxy puissance-poids). | `runs`, `body_weight_entries` | courbe | glissant 8-12 sem | Rendre visible le gain/la perte de rendement lié au poids. | — |
| RN-14 | ⏳ | Hydratation recommandée selon distance/durée | Besoin hydrique d'une sortie + plan de réhydratation. Reporté V2 par la spec. | `runs`, nutrition (hydratation V2) | insight | par course | Éviter la déshydratation sur les sorties longues/chaudes. | hydratation V2 |
| RN-15 | 🆕 | Sodium & électrolytes vs sudation estimée | Pertes en sodium (durée × sudation) + apport électrolytique recommandé. | `runs`, micronutriments (sodium au panel étendu) | insight | par sortie longue | Prévenir crampes/hyponatrémie sur l'endurance prolongée. | 4.33 |
| RN-16 | 🆕 | Coût glucidique estimé d'une séance de fractionné | Part glucidique dominante d'une séance VMA + disponibilité recommandée avant. | `planned_sessions`/`programs`, `runs`, macros | insight | jour de fractionné | Garantir la qualité des séances rapides. | running §4.2 |
| RN-17 | 🆕 | Cohérence objectif nutrition ↔ objectif course | Détecte les conflits (prépa marathon + sèche agressive) et propose un objectif conciliant. | `objectiveFromGoal`, `running_profiles`, `nutrition_profiles` | alerte | réglage/hebdo | Éviter de saboter une prépa par un régime incompatible. | §2.1 |
| RN-18 | 🆕 | Balance énergétique hebdo endurance | Dépense course hebdo vs surplus/déficit visé vs delta de poids observé. | `runs` hebdo, `food_entries`, `targetCalories`, `weightTrend` | tableau | semaine | Réconcilier apports, dépense et évolution de poids. | §7.2 |
| RN-19 | 🆕 | Carburant embarqué recommandé pour une sortie | Traduit le besoin glucidique en gels/barres/boisson selon la durée prévue. | `planned_sessions` (durée), `foods`/`recipes`, nutrition | insight | pré-sortie | Passer du besoin théorique à une checklist actionnable. | §4.3 |
| RN-20 | 🆕 | Charge glucidique d'affûtage avant course objectif | Montée des glucides J-2/J-1 (carb-loading) + repas pré-compétition. | `programs`/`planned_sessions` (échéance), macros | insight | J-3 à J-0 | Maximiser les réserves de glycogène le jour J. | running §3 |
| RN-21 | 🆕 | Timing du dernier repas avant la course | Alerte si le dernier repas est trop proche/lointain du départ + collation adaptée. | `planned_sessions` (heure), `food_entries`, `runs` | alerte | pré-course | Éviter troubles digestifs et fringales. | — |

---

## Tri-piliers / Transverse

| ID | Statut | Analyse | Description | Données sources | Sortie | Fenêtre | Intention | US liée |
|---|---|---|---|---|---|---|---|---|
| TRI-01 | ✅ | Streak de jours actifs (3 piliers) | Jours consécutifs où ≥1 pilier est actif ; repos neutre ; reset minuit local, DST-safe. | `streak.ts` (`computeStreak`, `activeDayKeys`), workouts/runs/food_entries | score | glissant quotidien | Motivation transverse sans imposer un pilier. | 2.9 |
| TRI-02 | ✅ | Calendrier semaine unifié (7 pastilles) | 7 pastilles colorées d'activité récente tous piliers, adossées au widget streak. | streak widget, `activeDayKeys`, activité 7 j | widget | 7 derniers jours | Visualiser d'un coup la régularité de la semaine. | 7.6 |
| TRI-03 | 🆕 | Score de forme / readiness global | Indice 0-100 « prêt à performer ? » : charge récente (muscu+running), qualité d'alimentation, tendance de poids. | `workout_sets`, `runs`, `averageIntake`, `weightTrend` | score | quotidien (7 j en entrée) | Un chiffre orientant la décision du jour ; différenciateur type Whoop/Oura. | IDEAS score-readiness |
| TRI-04 | 🆕 | Indice de régularité toutes activités | % de jours actifs sur 30 j + régularité de l'espacement, au-delà du streak binaire. | `activeDayKeys`, workouts/runs/food_entries | stat | glissant 30 j | Mesurer la constance réelle (un streak cassé n'efface pas 25/30). | — |
| TRI-05 | 🆕 | Corrélation poids ↔ apports ↔ activité | Relie l'évolution du poids au solde énergétique (apports − dépense muscu+running). | `body_weight_entries`, `food_entries`, `workout_sets`+`runs` | courbe | glissant 4-12 sem | Répondre à « pourquoi mon poids bouge ? ». | IDEAS analyses-croisées |
| TRI-06 | 🆕 | Balance énergétique estimée (apports − dépense) | Solde journalier/hebdo : apports − (base + dépense muscu + dépense running). | `food_entries`, `nutrition_profiles`, `workout_sets`, `runs`, `profiles` | stat | quotidien + hebdo | Solde réaliste tenant compte de l'activité réelle. | — |
| TRI-07 | 🆕 | Bilan hebdomadaire unifié (récap narratif) | Récap fin de semaine (volume muscu, distance, jours nutrition, poids, records, streak) en langage naturel FR/EN, poussé en digest. | tous les agrégats des 3 piliers | insight | hebdomadaire | Boucler la semaine par une vue motivante, sans effort de consultation. | IDEAS bilan-hebdo |
| TRI-08 | 🆕 | Équilibre de vie (répartition de l'effort) | % effort/temps entre les 3 piliers (radar/anneau), repère un pilier délaissé. | durées/nb séances, `runs`, jours de journal, `pillar.ts` | courbe | glissant 30 j | Encourager l'équilibre entre piliers activés. | — |
| TRI-09 | 🆕 | Tendance globale de progression | Progression normalisée de chaque pilier agrégée en une flèche de tendance globale. | records/pace-records, run-stats, `averageIntake`, `weightTrend` | score | glissant 4-8 sem | « Est-ce que je progresse globalement ? » sans détails. | — |
| TRI-10 | ⏳ | Badges / jalons transverses | Jalons croisant les piliers (« 7 jours actifs sur les 3 », « semaine parfaite »). Historique horodaté = compatible gamification future. | `streak.ts`, `personal_records`, agrégats 3 piliers | badge | événementiel | Récompenser l'usage intégré, gamification hors V1 (arbitrage C). | ADR-005 |
| TRI-11 | 🆕 | Charge globale vs apports vs poids | Superpose charge combinée, apports moyens et courbe de poids sur une échelle temporelle. | `workout_sets`, `runs`, `food_entries`, `body_weight_entries` | courbe | glissant 8-12 sem | Diagnostiquer surentraînement/sous-alimentation. | IDEAS analyses-croisées |
| TRI-12 | 🆕 | Détection de surcharge / sous-récupération globale | Enchaînement de jours à forte charge sans repos + déficit persistant → alerte. | `workout_sets`, `runs`, `activeDayKeys`, `averageIntake` | alerte | glissant 7-14 j | Protéger santé/perf en signalant le déséquilibre charge/récup/nutrition. | IDEAS garde-fou |
| TRI-13 | 🆕 | Adhérence aux objectifs (tous piliers) | % réalisé par pilier (séances, distance vs objectif, jours nutrition dans la cible) → % global. | `planning.ts`, `planned_sessions`, `runs` vs profil, `food_entries` | score | hebdomadaire | Discipline réelle vs intentions, tous piliers réunis. | metriques §3 |
| TRI-14 | 🆕 | Rapport bilan santé/perf exportable (PDF) | Document périodique agrégeant tous les piliers (livrable partageable coach/suivi). | ensemble des agrégats tri-piliers | tableau | mensuel/trimestriel | Bilan tangible partageable ; envisagé premium. | IDEAS rapport-PDF |
| TRI-15 | 🆕 | Modèle forme-fatigue (CTL·ATL·TSB / Banister) | EWMA de la charge combinée : condition (~42 j), fatigue (~7 j), forme (TSB). Performance Management Chart, distinct de l'ACWR. | sRPE quotidien (workouts+runs), EWMA | courbe | quotidien | Bâtir la forme, gérer la fatigue, placer les pics de perf. | catalogue |
| TRI-16 | 🆕 | Indice de monotonie & contrainte (Foster) | Monotonie = charge moyenne/écart-type hebdo ; strain = charge hebdo × monotonie. Complète l'ACWR (variabilité, pas que volume). | sRPE quotidien (workouts+runs) | alerte/courbe | hebdo, tendance 4-12 sem | Alerter quand la semaine manque d'alternance dur/facile. | catalogue |
| TRI-17 | 🟡 | Nouveau record de régularité (meilleure série) | Plus longue série de jours actifs jamais atteinte, célébrée à chaque dépassement. | `streak.ts` (série courante), historique jours actifs | badge | historique | Objectif de dépassement de soi durable. | — |
| TRI-18 | 🟡 | La météo de ta forme (readiness vulgarisé) | Traduit le score readiness en emoji + phrase (« pousse » / « lève le pied »). | score readiness existant | widget | quotidien | Rendre actionnable une métrique complexe pour un débutant. | — |
| TRI-19 | 🆕 | Ton prochain petit pas (next best action) | Une reco quotidienne, atteignable et non culpabilisante (« plus qu'une séance », « 20 g de protéines »). | `planned_sessions`, `runs`, `food_entries`, `streak.ts` | insight | quotidien | Réduire la charge de décision, entretenir l'élan par des micro-objectifs. | — |

---

## Méta / Dérivées

| ID | Statut | Analyse | Description | Données sources | Sortie | Fenêtre | Intention | US liée |
|---|---|---|---|---|---|---|---|---|
| META-01 | ✅ | Dashboard unifié personnalisable | Accueil agrégeant les widgets des 3 piliers, ordre/visibilité/taille configurables, filtré par piliers actifs. | `dashboard.ts`, `user_settings.dashboard_layout` | widget | temps réel | Vue d'ensemble unique remplaçant 3 apps ; cœur de l'intégration. | 7.1-7.12 |
| META-02 | ✅ | Tendance par comparaison moitié-période | Amélioration/régression/stable en comparant les 2 moitiés d'une série (seuil de bruit). `paceTrend` + `weightTrend`. | `runs.paceSPerKm`, `body_weight_entries` | insight | glissant paramétrable | Dire s'il progresse/régresse sans chiffre brut. | 5.28/5.29/4.24/7.7 |
| META-03 | ✅ | Records personnels muscu + running | Meilleures perfs jamais réalisées : charge max/1RM/volume (muscu), temps par distance (running). | `computeWorkoutRecords`, `computeRunRecords`, records | badge | à chaque séance/course | Célébrer les progrès (motivation, notification). | records muscu/running |
| META-04 | ✅ | Agrégats segmentés par période | Cumuls par fenêtre calendaire (semaine ISO/mois/début) : distance/durée, apports moyens/jour renseigné. | `aggregateRunStats`, `averageIntake` | stat | sem/mois/tout | Base de comparaison et de reporting périodique. | 5.28/5.29 / §7.2 |
| META-05 | 🟡 | Score d'intégration (nb de piliers activés) | Combien de piliers réellement utilisés (1/2/3) + taux de consultation des vues croisées. | `pillar.ts`, `user_settings`, télémétrie | stat | mensuel/cohorte | Valider le pari « plus de piliers = meilleure rétention ». | metriques §1-3 |
| META-06 | 🟡 | Comparaison période N vs N-1 (delta) | Écart période courante/précédente (« +12 % distance », « −300 kcal/j », « +2 séances »). | `aggregateRunStats`, `averageIntake`, volume muscu agrégé | stat | sem vs sem / mois vs mois | Feedback de progression concret sur l'effort récent. | s'appuie sur agrégats |
| META-07 | 🟡 | Rappels contextuels intelligents (multi-signaux) | Décision de notification selon le contexte (séance non faite, repas non loggé, streak en danger). Rappel streak codé, autres déclencheurs à ajouter. | `planned_sessions`, `food_entries`, streak + `NotificationPrefs` | alerte | quotidien (DND) | Réengager au bon moment sans spammer. | 2.6/2.8 |
| META-08 | 🆕 | Tendance générique par régression linéaire (pente + R²) | Moteur unique par moindres carrés (pente, intercept, R²) pour toute série. Généralise les 2 heuristiques moitié-période. | toute série (volume, records, pace, poids, kcal) | stat | glissant 7/30/90 j | Un composant de tendance réutilisable + fondation des projections. | généralise 5.28/5.29 |
| META-09 | 🆕 | Lissage par moyenne mobile (7/30 j) | Débruite les points (poids, kcal, allures) par moyenne glissante centrée. | `body_weight_entries`, `food_entries`, `runs`, volume/jour | courbe | glissant 7/30 j | Éviter de sur-réagir à une pesée/un repas isolé. | prolonge 5.28/4.24 |
| META-10 | 🆕 | Détection d'anomalie / valeur aberrante (z-score) | Repère une valeur >2σ de la moyenne perso (fautes de frappe poids×10, journée extrême). | workouts/runs/food_entries/poids, moyenne+σ glissants | alerte | baseline 30 j | Qualité de données + insight. | réutilise garde-fou GPS |
| META-11 | 🆕 | Détection de rupture / changement de régime | Point de bascule dans une série (progression stoppée, poids qui cesse de descendre) par comparaison des pentes avant/après. | `personal_records`, `body_weight_entries`, `runs.paceSPerKm` | insight | glissant 6-12 sem | Repérer objectivement QUAND quelque chose a changé. | detection-plateau |
| META-12 | 🆕 | Détection de plateau + suggestion de deload | Stagnation d'un exercice (1RM/charge/volume plats sur N sem. malgré l'assiduité) → deload/changement de schéma. | `personal_records`, `workout_sets`, `workouts.rpe` | insight | rétrospective 4-8 sem | Débloquer la progression, prévenir la frustration. | detection-plateau |
| META-13 | 🆕 | Alerte de plateau imminent (early warning) | Projette la pente et sa décélération pour signaler AVANT l'arrêt (plateau probable sous ~2 sem). | `personal_records`, `workout_sets`, `running_pace_records` | alerte | glissant 8-12 sem | Agir avant la stagnation plutôt qu'après. | detection-plateau |
| META-14 | 🆕 | Projection de date d'atteinte d'objectif de poids | Extrapole la pente lissée jusqu'au poids cible → date estimée + intervalle. | `body_weight_entries` (pente) + poids cible | stat | pente 4-8 sem, projection | Rendre l'objectif concret et daté. | objectifs-personnels |
| META-15 | 🆕 | Projection de 1RM futur / courbe de force | Prolonge la tendance du 1RM d'un exercice → charge atteignable à un horizon, date d'un palier. | `personal_records` (1RM), `estimate1RM`, historique | courbe | régression 8-12 sem, projection | Fixer un cap chiffré et daté sur la force. | objectifs-personnels |
| META-16 | 🆕 | Projection d'atteinte d'objectif de volume | À mi-période, projette si le rythme atteint un objectif (km/mois, tonnage) : cumul + extrapolation. | `aggregateRunStats`, `computeVolume` agrégé | widget | période courante + projection | Savoir en cours de mois s'il faut accélérer. | objectifs-personnels |
| META-17 | 🆕 | Bandes de confiance sur les projections | Intervalle de prédiction (± bande) sur les projections (poids, 1RM, temps, objectif) depuis les résidus. | séries de projection + résidus du modèle | courbe | selon projection | Honnêteté statistique : une fourchette gère les attentes. | — |
| META-18 | ⏳ | Seuils adaptatifs vs moyenne personnelle | Généralise l'alerte à seuil fixe (4.32) en seuils relatifs à la baseline perso (X % de SA moyenne). | moyennes glissantes par utilisateur | alerte | baseline 14-30 j | Alertes pertinentes pour chacun (débutant ≠ confirmé). | généralise 4.32 |
| META-19 | 🆕 | Garde-fou surentraînement (ACWR générique) | Charge 7 j ÷ moyenne 28 j ; hors zone sûre (~0,8-1,3) = risque, suggestion de jour off. | `workouts` (durée, rpe), `workout_sets`, `runs` | score | 7 j vs 28 j | Éviter blessure et burn-out = éviter l'abandon. | garde-fou-surentrainement |
| META-20 | 🆕 | Corrélation entre deux métriques (Pearson glissant) | Moteur générique de corrélation entre deux séries alignées (déficit ↔ 1RM, poids ↔ allure…). | toutes tables agrégées par jour/semaine | insight | glissant 8-12 sem | Passer des stats croisées à un moteur explicatif. | analyses-croisées |
| META-21 | 🆕 | Corrélation croisée décalée (effet retardé) | Corrélation à différents lags (0-N j) : glucides J-1 ↔ allure J, charge J-2 ↔ RPE J. Retourne le lag au pic. | séries quotidiennes croisées | insight | glissant 60-90 j, lags 0-7 j | Rendre les liens causaux plus crédibles (l'effet est décalé). | analyses-croisées |
| META-22 | 🆕 | Moteur d'analyses croisées poussées | Au-delà des stats simples : moteur causal (PR selon volume/intensité, surplus ↔ perf, récup ↔ perf). | toutes les tables des 3 piliers | insight | glissant multi-sem | Expliquer les liens perf↔nutrition↔récup — LE différenciateur, potentiellement premium. | analyses-croisées |
| META-23 | 🆕 | Percentiles personnels | Situe une perf dans SA distribution (« top 10 % de volume », « 3ᵉ meilleure sortie 10 k »). | distribution historique par utilisateur | insight | historique / 90 j | Valoriser les bonnes perfs qui ne battent pas de record absolu. | complète les records |
| META-24 | 🆕 | Percentile vs cohorte anonymisée | Positionne une métrique contre une cohorte anonymisée d'utilisateurs comparables (opt-in RGPD). | agrégats cross-user anonymisés | stat | snapshot mensuel | Repère externe motivant et garde-fou d'attentes ; social non compétitif. | — |
| META-25 | 🆕 | Clustering de journées & séances types | Regroupement non supervisé → 3-5 archétypes personnels (« grosse journée hybride », « repos actif »). | workouts, workout_sets, runs, food_entries, sessions | insight | historique, recalcul mensuel | Donner un vocabulaire à ses habitudes, relier types de journées et perfs. | — |
| META-26 | 🆕 | Règles d'association comportementales | Motifs fréquents (lift) : « quand tu logs le petit-déj, tu atteins ta cible protéines 80 % du temps ». | événements journaliers binarisés, tous piliers | insight | historique, min ~6 sem | Faire émerger des leviers comportementaux non évidents. | rappels-contextuels |
| META-27 | 🆕 | Profil hebdomadaire statistique (meilleur jour) | Saisonnalité hebdo : moyenne par jour de semaine + test de significativité. | workouts, runs, food_entries par jour de semaine | insight | historique, min ~8 sem | « Tes meilleures allures tombent le samedi » : caler séances clés et notifications. | — |
| META-28 | 🆕 | Indice composite de forme normalisé (z-scores) | Score 0-100 agrégeant les sous-scores normalisés de chaque pilier (progression, forme, qualité, régularité, poids). | agrégats de tous les moteurs | score | hebdomadaire, tendance | Une boussole unique « est-ce que je progresse ? » sans 40 métriques. | — |
| META-29 | 🆕 | Score de risque de décrochage (churn prédictif) | Baisse de fréquence, allongement des intervalles, chute de complétion, streak en déclin → proba de churn 7/14 j. | sessions, runs, food_entries, streak, télémétrie | score | glissant 30 j | Anticiper l'abandon (1ʳᵉ cause d'échec des apps fitness). | notifications-winback |
| META-30 | 🆕 | Objectifs SMART à échéance + jalons | Objectif chiffré et daté (« 50 km ce mois », « +5 kg au développé ») + anneau de progression, statut on-track (via projection). | cible utilisateur + métrique suivie + projections | widget | horizon défini | Donner un cap personnel motivant et mesurable. | objectifs-personnels |
| META-31 | 🆕 | Fraîcheur d'affûtage & fenêtre de pic (tapering) | À l'approche d'une échéance, projette la fraîcheur (TSB) le jour J et recommande l'ampleur du taper. | `planned_sessions` (date objectif), CTL/ATL/TSB | insight | 3 sem avant échéance | Arriver frais le jour de la compétition. | module-powerlifting |
| META-32 | 🆕 | Rétrospective annuelle « Wrapped » | Récap annuel imagé et partageable (km, tonnage, top exercices, records, plus longue série). | agrégats annuels runs/workout_sets/records/streak | insight | année civile | Rétention émotionnelle + acquisition virale. | retrospective-wrapped |
| META-33 | 🆕 | Équivalences parlantes | Cumuls abstraits → repères tangibles (« X tonnes = un Boeing », « Y km = Paris-Marseille »). | cumuls dérivés (Σ volume, Σ distance) | badge | cumul période/total | Gamification légère compatible V1 (pas de boucle de jeu). | gamification-equivalences |
| META-34 | 🆕 | Heatmap calendrier d'activité (façon GitHub) | Calendrier où chaque jour est coloré par intensité (nb piliers, volume, distance) sur 90 j/1 an. | `activeDayKeys`/`DayActivity` enrichis d'une intensité | tableau | grille 90 j / 1 an | Voir sa régularité d'un coup d'œil, renforcer l'habitude. | s'appuie sur streak |
| META-35 | 🆕 | Récap de fin de séance festif | Écran de clôture (volume/distance, records du jour, comparaison à la dernière séance). | workouts, workout_sets, records, runs, pace-records | insight | événementiel + comparaison | Moment « aha » immédiat qui ancre l'habitude de revenir. | — |
| META-36 | 🆕 | Première victoire (activation onboarding) | Célèbre le tout premier enregistrement dans chaque pilier. | workouts, runs, food_entries (1ʳᵉ occurrence) | badge | une fois par pilier | Passer le cap critique de la 1ʳᵉ action (meilleur prédicteur de rétention). | — |
| META-37 | 🆕 | Regarde le chemin parcouru (toi vs toi débutant) | Comparaison auto-référencée valorisante (« à tes débuts 40 kg, aujourd'hui 62 kg »). | workout_sets, records, runs, pace-records, poids | insight | 1ʳᵉ quinzaine vs 30 derniers j | Rendre visible une progression imperceptible au jour le jour. | — |
| META-38 | 🆕 | C'est quoi ce chiffre ? (vulgarisation) | Bulle pédagogique sur les métriques intimidantes (1RM, VMA, TDEE, ACWR) traduite sur ses données. | records.ts, run-stats.ts, nutrition.ts + i18n | insight | au tap de chaque métrique | Lever la barrière de compétence, créer la confiance. | — |
| META-39 | 🆕 | Plus que X avant le prochain jalon | Barre de progression vers le prochain badge/palier (« plus que 2 jours pour ta série de 30 »). | records, workout_sets, runs, streak, jalons | widget | continu, seuil le plus proche | Effet « gradient de but » sans boucle de jeu (compatible ADR-005). | ADR-005 |
| META-40 | 🆕 | Bon retour parmi nous (win-back bienveillant) | Message d'accueil doux au retour après une absence + reprise allégée, jamais de reproche. | sessions, runs, food_entries (dernière activité), streak | alerte | retour après ≥N j | La honte du décrochage est la 1ʳᵉ cause d'abandon définitif. | 2.6-2.8 |
| META-41 | 🆕 | Carte de séance partageable | Image récapitulative esthétique d'une séance/course (chiffres clés, tracé, records) à partager. | workouts, workout_sets, runs (tracé), records | insight | à la demande | Fierté partagée = engagement + acquisition organique. | 5.33-export-gpx |
| META-42 | 🆕 | Ton niveau de progression (palier auto-référencé) | Échelle de maîtrise sur SON propre historique (débutant→confirmé), sans comparaison sociale. | exercises pratiqués, workout_sets, runs, streak, ancienneté | score | cumulatif, mensuel | Trajectoire lisible qui motive sans comparaison démoralisante. | — |
| META-43 | 🆕 | Ton premier mois (bilan de démarrage) | Récap célébratoire au 30ᵉ jour (séances, km, repas, records, meilleure série). | toutes tables d'activité depuis `profiles.created_at` | insight | une fois, au 30ᵉ jour | Consolider l'habitude au moment charnière de la rétention à 30 j. | — |
| META-44 | 🆕 | Tes premières fois (jalons de découverte) | Jalons expérientiels (premier 5 km, première séance d'1 h, premier programme terminé). | runs, workouts, programs/sessions, streak, planned_sessions | badge | événementiel | Multiplier les occasions de fierté pour le débutant sans records chiffrés. | — |
| META-45 | ⏳ | Écurie multi-athlètes du coach (roster) | Vue coach agrégeant tous ses coachés (activité, charge, adhérence, TSB/ACWR, PR, poids), triable. | profils coachés (relation à créer), agrégats par athlète | tableau | instantané, quotidien | Piloter un portefeuille d'athlètes — cœur du module Coach⇄Coaché. | module-coach-coache |
| META-46 | ⏳ | Drapeaux automatiques par coaché | Moteur de règles remontant les signaux d'attention (ACWR>seuil, chute d'e1RM, journal non rempli). | ACWR, monotonie, e1RM/RPE, adhérence, poids par athlète | alerte | quotidien/hebdo | Faire gagner du temps au coach ; valeur premium. | module-coach-coache |
| META-47 | ⏳ | Adhérence & complétion du coaché (vue coach) | Par coaché : % séances réalisées, régularité du journal, jours actifs vs plan + tendance. | `planned_sessions` vs réalisées, `food_entries`, streak | stat | glissant 7/30 j | Mesurer l'engagement réel ; argument de renouvellement. | module-coach-coache |

---

## Pistes de priorisation

Sélection au meilleur **ratio valeur/effort pour démarrer**, en privilégiant ce qui s'appuie sur
des **données et des briques déjà présentes** (✅ à consolider → ⏳ cadré → 🆕 à faible coût).

1. **MUSC-04 — Courbe de progression charge & volume par exercice** (⏳). Données déjà là
   (`workout_sets`, `personal_records`) ; forte valeur perçue, US 3.21/6.2 déjà cadrées.
2. **MUSC-05 — Volume par groupe musculaire / semaine** (⏳/🟡). Widget muscle-volume existe déjà ;
   éclater par groupe + signaler le déséquilibre est un incrément à fort impact visuel.
3. **RUN-05 — Courbe & tendance d'allure (30/90 j)** (🟡). `paceTrend` existe ; il ne reste qu'à
   l'exposer proprement en courbe. Effort faible.
4. **NUTR-10 — Adhérence à l'objectif : jours dans la cible** (⏳). Toutes les données sont là
   (`food_entries` vs `targetCalories`) ; complète les moyennes 7/30 j déjà calculées.
5. **NUTR-17 — Régularité du journal (taux de complétion)** (🆕). Calcul trivial sur
   `food_entries.logDate` ; conditionne la fiabilité de toutes les autres stats nutrition.
6. **META-06 — Comparaison période N vs N-1 (delta)** (🟡). `aggregateRunStats` et `averageIntake`
   produisent déjà les agrégats ; il ne manque que le calcul d'écart. Feedback très parlant.
7. **META-08 — Tendance générique par régression linéaire (pente + R²)** (🆕). Brique socle
   réutilisable partout ; remplace deux heuristiques et débloque toutes les projections (META-14/15/16).
8. **META-09 — Lissage par moyenne mobile** (🆕). Petit utilitaire pur, immédiatement utile aux
   courbes de poids et d'allure existantes.
9. **MR-06 — Volume horaire total d'entraînement** (🆕). Simple somme de durées muscu+course ;
   première stat transverse concrète, quasi gratuite.
10. **MN-13 — Ratio g/kg protéines vs cible par objectif** (🆕). `proteinG` + `body_weight_entries`
    déjà présents ; repère à très forte valeur pour le pratiquant de muscu, en une jauge.
11. **RN-01 — Dépense calorique estimée d'une course** (✅ livrée avec RN-02). Brique de base qui
    débloque toute la famille course↔nutrition (RN-04 restante) ; ne dépend que de données déjà stockées.
12. **META-19 — Garde-fou surentraînement (ACWR)** (🆕). Standard de préparation physique,
    calculable dès qu'on dispose de la charge combinée ; base commune à RUN-18, MR-10 et TRI-12.

**Note transverse :** avant les analyses inférentielles (corrélations META-20/21/22, forme-fatigue
TRI-15), poser d'abord les **briques mathématiques socles** (META-08 régression, META-09 lissage,
puis charge sRPE MR-05) évite de recoder plusieurs fois la même logique et garantit des résultats
cohérents entre piliers. Les analyses **inter- et tri-piliers** (MR/MN/RN/TRI) sont à surpondérer
dans la priorisation produit : c'est là que se situe le différenciateur « les piliers se parlent ».
