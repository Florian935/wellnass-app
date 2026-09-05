---
id: RUN-F4
titre: "La séance de course porte enfin sa consigne"
roadmap: [5.36, 5.37, 5.38, 5.39]
catalogue: [RUN-07, RUN-13, RUN-19]
etape: recette
branche: feature/run-seances-structurees
maj: 05/09/2026
---

# US RUN-F4 — La séance de course porte enfin sa consigne

> **Origine** : [analyse du 04/09/2026](../../../product/analyse-seances-structurees-running.md),
> déclenchée par Florian après avoir suivi sur le terrain un plan « 5 km en moins de 20 min »
> (12 semaines, 24 séances) que l'app ne savait pas porter.
>
> **Décision de cadrage, explicite** : Florian a demandé le 05/09/2026 l'implémentation des
> **10 lots en une passe**, sans validation intermédiaire, retours reportés à la recette. Le
> parcours normal (spec → plan → design → validation → code) a donc été **volontairement
> raccourci** : cette spec est écrite **avec** le code, pas avant. Elle documente ce qui a été
> livré, pour que la recette ait un référentiel.

## 0. Le mur, en un paragraphe

Il n'existait **nulle part** dans le modèle une allure cible **saisie par un humain**. Toutes les
allures de l'app étaient **calculées** depuis l'unique `running_profiles.ref_5k_pace`, par
`sessionTargetPace()` — cinq bandes figées. Mesure sur les 24 séances du plan analysé : **0
intégralement représentable**, 13 représentables en structure mais **vidées de leur consigne
d'allure**, 11 pas représentables du tout, et **0 des 24 échauffements** exprimable.

## 1. Ce qui est livré, lot par lot

| Lot | Contenu | Où |
|---|---|---|
| **A** | Plage d'allure cible **saisie** sur la séance et sur la phase rapide ; intensité de récupération (trot/marche/arrêt/libre) ; RPE cible. Le `%VMA` de RUN-F2c **n'est pas supprimé** : il devient le repli. | `sessions.target_pace_*`, `session_intervals.fast_pace_*`, `resolveSessionPace`, `resolvePhasePace` |
| **B** | Nature du segment (`warmup`/`drills`/`work`/`recovery`/`cooldown`) **et levée du verrou « blocs réservés au fractionné »**. | `session_intervals.kind`, `RunningSessionEditor` |
| **C** | Distance **et** chrono cible sur la même fraction (« 400 m en 1:38 »). | `fast_target_time_*` |
| **D** | Un niveau d'imbrication : segments consécutifs de même `group_key`, répétés `group_reps` fois. | `expandIntervalPhases` |
| **E** | Allure cible affichée en course + alerte vocale d'écart. | `run-pace-guidance.ts`, `usePaceGuidance`, `run/active.tsx` |
| **F** | Réalisé **par répétition** : table `run_intervals`, écrite à chaque transition, lue au résumé. | `recordIntervalResult`, `useRunIntervals`, `run/summary.tsx` |
| **G** | Types `test` et `course`, objectif chrono, plan de passage par km. | `SESSION_TYPES`, `race-plan.ts` |
| **H** | Échéance datée sur le programme : date de course, chrono visé, événement, compte à rebours, affûtage. | `programs.target_date`, `raceCountdown`, `blockProgress` |
| **I** | Consignes rédigées (`description`, `instructions`, `adaptation_criterion`) + table `session_translations`. | migration `…090005` |
| **J** | Règles d'adaptation de la séance du jour, **strictement consultatives**. | `session-adaptation.ts` |

## 2. Les règles qui comptent

- **R1 — Rétrocompatibilité stricte.** Toutes les colonnes sont nullables ; une séance existante,
  cibles vides, garde **exactement** le comportement dérivé d'avant. Les 15 tests RUN-F2c/F2d
  passent **inchangés** : c'est la preuve que le moteur n'a pas bougé de sens.
- **R2 — L'allure a une provenance, et on l'affiche.** `explicit` > `target-time` > `derived`.
  L'utilisateur doit savoir si le nombre vient de lui ou d'un calcul.
- **R3 — Aucune allure inventée.** Sans consigne **et** sans allure de référence, `resolveSessionPace`
  rend `null` et l'écran se tait (patron ALLURE-01). Il n'existe pas de valeur neutre pour une allure.
- **R4 — La distance borne, le chrono cible.** `fast_distance_m` termine la phase ;
  `fast_target_time_*` est la cible à tenir dedans. `isIntervalPhaseComplete` était **déjà** juste :
  la distance l'emportait déjà sur la durée.
- **R5 — Un rattrapage ne sait pas tout, et le dit.** Quand plusieurs phases sont franchies en une
  évaluation (écran non monté), l'axe non borné par la phase **n'est pas attribuable** : on écrit
  `null`, jamais une répartition inventée. Une allure fausse serait pire qu'une case vide.
- **R6 — Le prévu est recopié, jamais joint.** Modifier une séance planifiée ne doit pas réécrire
  l'histoire d'une course déjà courue (`run_intervals.block_id` sans FK).
- **R7 — L'adaptation informe, elle ne modifie rien.** Aucune fonction du lot J n'écrit. Réduire
  d'office le volume de quelqu'un sur la foi d'un questionnaire à 5 niveaux serait de la
  prescription. Même parti pris que COLLIS-01.
- **R8 — Un seul signal grave suffit.** Règle R4 de `readiness.ts`, reprise telle quelle : une
  douleur bloquante ne se compense pas par une bonne nuit de sommeil.
- **R9 — Ton.** Hors plage se signale en **accent**, jamais en rouge d'erreur : courir 3 s/km trop
  vite n'est pas une faute (RUN-F2b R4).

## 3. Les nombres inventés (et il y en a peu)

| Constante | Valeur | Pourquoi, et pourquoi elle est discutable |
|---|---|---|
| `PACE_TOLERANCE_S_PER_KM` | 5 s/km | **Seul nombre vraiment inventé.** Sans zone morte, le verdict clignote à chaque rafraîchissement GPS et l'alerte vocale devient inutilisable. **À recalibrer après la 1ʳᵉ recette terrain.** |
| `PACE_ANNOUNCE_MIN_INTERVAL_S` | 30 s | Empêche l'alternance permanente autour d'une borne. |
| `REPS_REDUCTION_PCT` | 25 % | Milieu de la fourchette 20–30 % du plan analysé — repris, pas inventé. |
| `PACE_SLOWDOWN_S_PER_KM` | 4 s/km | Milieu de la fourchette 3–5 s/km du plan analysé. |
| `HEAT_THRESHOLD_C` | 28 °C | Repère communément admis. ⚠️ **Aucune source ne l'alimente** : la météo est RUN-F3b, bloquée. |

## 4. Ce qui n'est PAS livré

- **Écrans de surface des lots H et J** : le calcul, les données et l'i18n sont là et testés, mais
  la carte « J-42 / taux de réalisation » et la carte « séance du jour adaptée » **ne sont posées
  sur aucun écran**. Rien ne les affiche aujourd'hui.
- **Back-office** : seuls les deux nouveaux types de séance sont exposés. Les champs de consigne
  (allure, chrono, instructions) et l'éditeur de segments enrichi **ne sont pas dans l'admin**.
- **Édition du plan de passage par km** : lu, validé, stocké et testé (`parsePacingPlan`,
  `evenPacingPlan`, `cumulativePacingSplits`), mais aucun écran ne permet de le saisir.
- **`session_translations`** : la table, la RLS, la résolution SQL et la duplication sont en place ;
  **aucune UI n'écrit dedans**. `sessions.name` reste le repli et rien ne régresse.
- **Météo** (règle chaleur du lot J) : dépend de RUN-F3b, bloquée sur un arbitrage de confidentialité.

## 5. Étapes manuelles obligatoires avant recette

1. 🔴 **`npm run db:push`** — les 7 migrations sont écrites et validées par `db:push:dry`, mais
   **pas appliquées sur le cloud** (l'action a été refusée en session). Puis `npm run db:types`.
2. 🔴 **Déployer 2 sync rules à la main** dans le dashboard PowerSync (`run_intervals`,
   `session_translations`) depuis
   [powersync-sync-rules.yaml](../../technical/powersync-sync-rules.yaml). **Étape oubliée trois
   fois au registre** (BIEN-01, RUN-F2c, VIE-01) : sans elle, le réalisé par répétition reste
   local et ne remonte jamais, **sans aucune erreur visible**.
3. **Nouveau build** non requis : aucune dépendance native neuve.
