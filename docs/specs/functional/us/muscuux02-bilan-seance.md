---
id: MUSCU-UX02
titre: "Bilan de séance — 3 niveaux de lecture, écran unique récap/historique"
roadmap: [3.35]
catalogue: [MUSC-05, MUSC-13, MUSC-15, MUSC-16, MUSC-26, MUSC-33]
etape: recette
branche: feature/muscu-ux02-bilan-seance
maj: 12/09/2026
---

# US MUSCU-UX02 — Bilan de séance

> **Analyse + maquettes validées par Florian le 12/09/2026** — canvas 5 planches
> ([design/recap-seance-muscu/](../../../../design/recap-seance-muscu/)), traité en **un seul lot**
> sur décision de Florian, recette humaine ensuite.
>
> Suite directe de [MUSCU-UX01](muscu-refonte-ux.md), qui avait corrigé les constats 14 et 15 de
> l'[audit](../../../refonte-muscu/audit-ux-2026-09.md) (le résumé ne montrait pas la séance ; deux
> échelles d'intensité). Cette US va plus loin : elle fait du résumé un **bilan**.

## 0. Le trou

Le résumé de fin de séance affiche quatre agrégats, la liste condensée des exercices avec l'écart
depuis la dernière fois, le ressenti et les records. Cinq défauts :

1. **Les chiffres n'ont pas de référence.** « 4 108 kg » — bien ? mal ? Rien ne le dit. Le seul
   élément comparatif de l'écran (le delta par exercice) est aussi le seul qu'on regarde.
2. **La séance est racontée au plus court.** Le RPE par série, l'écart au planifié et les types de
   séries sont jetés — **alors que l'écran d'historique les affiche**. La donnée existe, elle
   manque à l'écran où l'on est le plus disponible pour la lire.
3. **Rien n'est agrégé au-dessus de l'exercice.** Aucune vue par groupe musculaire, par plage de
   reps, par intensité — soit exactement ce que l'utilisateur ne peut pas calculer de tête.
4. **Aucune perspective temporelle.** Ni « vs ta séance d'avant », ni « vs ta semaine ».
5. **L'écran ne conclut pas.** On scrolle, on tombe sur « Retour à l'accueil ».

Et surtout : **deux écrans se contredisent**. `workout-summary.tsx` (623 l) et `history/[id].tsx`
(484 l) sont deux implémentations divergentes du même objet.

| Élément | Récap fin de séance | Historique |
|---|:--:|:--:|
| Séries validées · densité · mention échauffements | ✅ | ❌ |
| Écart vs séance précédente | ✅ | ❌ |
| Détail série par série · écart au planifié · RPE par série | ❌ | ✅ |
| Célébration · partage · modèle | ✅ | ❌ |
| **Ressenti de séance** | **« Difficile »** | **« 8/10 »** |

La dernière ligne est un défaut de justesse, pas d'ergonomie : `feelingToStoredRpe` écrit un RPE
1-10 dans `workouts.rpe`, le récap le relit en échelle nommée, l'historique l'affiche brut. **Même
colonne, deux lectures contradictoires dans la même app.**

## 1. Le gisement — 8 briques déjà écrites, non branchées

Le récap est pauvre alors que **le calcul est déjà fait ailleurs dans le dépôt** :

| Brique `packages/shared` | Catalogue | Ce qu'elle donne ici |
|---|---|---|
| `sessionRelativeIntensity` · `percentOfMax` · `bestKnownOneRm` | MUSC-16 | %1RM moyen pondéré par les reps, et par exercice |
| `computeSetTypeMix` | MUSC-13 | répartition normal / échec / dropset / durée / PdC |
| `computeExecutionCompliance` | MUSC-33 | prescrit vs réalisé, si la séance vient d'un programme |
| `computeMuscleBalance` | MUSC-05 | vocabulaire des groupes musculaires |
| `sessionBestEstimated1RM` · `estimate1RM` | MUSC-03 | meilleur 1RM estimé de la séance |
| `computeSessionDuration` | MUSC-26 | la médiane comme référence « vs ton habitude » |
| `compareExercisePerformance` | — | delta par exercice (seule déjà branchée) |
| `sharesOf` | — | parts entières sommant à 100 (plages de reps) |

## 2. Décisions de cadrage — ✅ TRANCHÉES par Florian le 12/09/2026

| # | Question | Décision | Pourquoi |
|---|---|---|---|
| **D1** | Les 3 modes réutilisent-ils `profiles.workout_display_level` ? | **Non — colonne dédiée `summary_display_level`**, initialisée sur la valeur du niveau de séance | Le niveau en séance règle la densité de **saisie** sous la barre ; le récap règle la profondeur de **lecture**, assis au calme. Confondre les deux impose un choix qui n'a pas de raison d'être le même |
| **D2** | Où se pilote le niveau ? | **Sélecteur sur l'écran** (3 segments collants en haut) **+ persistance** | Un réglage enfoui dans Réglages ne serait jamais découvert ; le sélecteur sur place se bascule au moment où l'on lit |
| **D3** | Temps de repos réel (MUSC-14) ? | **Hors périmètre** | `workout_sets.updated_at` porte l'instant de dernière écriture : une correction le lendemain donnerait un repos de 14 h. Honnête seulement avec une colonne `completed_at` dédiée → reste au [BACKLOG](../../../../BACKLOG.md) |
| **D4** | Ratio pousser/tirer (MUSC-11) ? | **Hors périmètre** | Le type de mouvement n'est pas modélisé sur `exercises` |
| **D5** | Contexte nutritionnel du record (MUSC-34) ? | **Hors périmètre** | Dépend du pilier nutrition → gating, autre US |
| **D6** | Longueur du mode Avancé (~3 500 px) ? | **Blocs lourds repliés**, chiffre-clé visible sur l'en-tête replié | Un écran de 4 000 px sans repères est illisible |

## 3. Les trois niveaux

Les niveaux **ne changent pas le volume d'information, ils changent la question posée** :

| Mode (`etape` interne) | Question | Moment |
|---|---|---|
| **Simple** (`simplified`) | « C'est fait. » | 5 s après avoir reposé la barre, debout |
| **Intermédiaire** (`normal`) | « C'était comment ? » | dans les vestiaires, assis |
| **Avancé** (`detailed`) | « Qu'est-ce que ça vaut ? » | le soir, ou depuis l'historique |

Valeurs reprises telles quelles de `WorkoutDisplayLevel` (`simplified` `normal` `detailed`) : même
vocabulaire technique, libellés i18n distincts. **Aucun nouvel enum.**

### Matrice des blocs

| Bloc | Simple | Inter. | Avancé |
|---|:--:|:--:|:--:|
| Verdict + records | ✅ | ✅ | ✅ |
| Bande de stats | 3 | 3 + 3 | 3 + 6 |
| Ce que tu as fait + écart | ✅ | ✅ repliable | ✅ déplié |
| Ressenti + note | ✅ | ✅ | ✅ |
| Vs ton habitude | — | ✅ | ✅ |
| Groupes musculaires | — | ✅ | ✅ (+ séries dures) |
| Prescrit vs réalisé | — | ✅ | ✅ |
| Détail série par série | — | replié | déplié |
| Intensité relative %1RM | — | — | ✅ |
| Plages de reps | — | — | ✅ |
| Types de séries | — | — | ✅ |
| Records détaillés | — | — | ✅ |
| Ce que ça pèse (semaine / à vie) | — | — | ✅ |

## 4. Les règles

**R1 — Les blocs ne se réordonnent jamais d'un niveau à l'autre.** On ajoute dessous, on ne déplace
rien. Sinon on perd le repère en changeant de mode.

**R2 — Un bloc sans donnée disparaît ; il ne s'affiche jamais à zéro.** Première séance = pas de
« vs ton habitude ». Séance libre = pas de « prescrit vs réalisé ». Exercice sans 1RM connu =
absent de l'intensité relative, jamais à « — ». C'est la discipline déjà tenue par
`compareExercisePerformance`, qui rend `null` plutôt que `equal` au premier passage.

**R3 — Le verdict est une phrase, choisie par ordre de priorité** (première qui s'applique) :

| # | Condition | Phrase |
|---|---|---|
| 1 | ≥ 1 record battu | « Ton meilleur \<exercice\>. » (+ sous-titre : nb de records) |
| 2 | Tonnage > tous les précédents du même titre de séance | « Ton plus gros volume sur un \<titre\>. » |
| 3 | Delta de charge positif sur l'exercice au plus gros volume | « +\<x\> kg au \<exercice\> depuis la dernière fois. » |
| 4 | ≥ 3 séances cette semaine | « \<n\>ᵉ séance cette semaine. » |
| 5 | repli | « Séance bouclée en \<n\> min. » |

**Une clé i18n par cas, jamais de concaténation** — l'ordre des mots diffère en anglais.

**R4 — Échauffements exclus** du tonnage, du décompte de séries, des records, de l'intensité
relative et des plages de reps (règle métier `musculation.md` §8, déjà tenue). Ils apparaissent
dans les **types de séries** (c'est leur seul lieu) et dans la mention de pied.

**R5 — « Vs ton habitude » compare à la médiane des 5 dernières séances de même titre**, la
séance courante exclue. Médiane et non moyenne (patron `computeSessionDuration`) : une séance
oubliée ouverte 3 h fausserait une moyenne. Sous 3 séances de référence, le bloc se tait.

**R6 — Séries dures = RPE ≥ 8.** Proxy assumé des repères MEV/MAV (MUSC-32 non cadrée). Une série
sans RPE n'est pas dure : elle est inconnue, et n'entre pas au dénominateur.

**R7 — Charge de séance (sRPE) = durée en minutes × RPE de séance.** Unité arbitraire (UA),
l'unité classique de charge d'entraînement. `null` si le ressenti n'a pas été saisi — le
calcul n'a pas de sens sans lui.

**R8 — Plages de reps** : force 1-5 / hypertrophie 6-12 / endurance 13+, **pondérées par le
volume** et non par le nombre de séries (une série de 15 à 12 kg ne pèse pas une série de 8 à
82,5 kg). Parts entières via `sharesOf` → somme exacte à 100. Une plage non travaillée est
**absente**, jamais à 0 %.

**R9 — L'iso est une propriété du code, pas une discipline.** Un seul composant `<WorkoutReport>`,
monté par les deux routes. La prop `context` ne pilote que **trois** choses :

1. l'en-tête — « Séance terminée » + sous-titre, ou la date + flèche retour ;
2. l'animation de célébration, **jouée une seule fois** — elle ne doit pas rejouer à la réouverture
   d'une séance vieille de trois mois ;
3. le bouton de pied « Retour à l'accueil », absent en historique.

Tout le reste est identique par construction.

**R10 — Le ressenti se lit partout dans l'échelle nommée.** Corrige le défaut de justesse du §0 :
`history/[id].tsx` cesse d'afficher le RPE brut. La donnée stockée ne change pas.

**R11 — Une seule passe de requêtes.** L'écran actuel interroge les records **3 fois** (bandeau,
section, écran) et le détail **2 fois** (dont une via `useExerciseDeltas`). Le niveau avancé
multiplierait ça : `useWorkoutReport` fait une passe, les calculs purs sont mémoïsés.

**R12 — Offline-first.** Tout se calcule sur la base SQLite locale ; aucun appel réseau. Le
sélecteur de niveau écrit dans `profiles`, répliqué par PowerSync comme le reste.

**R13 — i18n FR + EN**, aucune chaîne en dur, y compris les phrases de verdict et les libellés de
groupe musculaire.

## 5. Données

**Une migration** : `profiles.summary_display_level text default 'normal' check (… in ('simplified','normal','detailed'))`.

Aucune autre donnée nouvelle. Tout le reste se calcule depuis `workouts`, `workout_sets`,
`exercises`, `personal_records`, `programs` / `planned_sessions`, déjà synchronisés.

⚠️ **Colonne à ajouter aussi dans [powersync/schema.ts](../../../../apps/mobile/src/powersync/schema.ts)** —
absente d'ici, l'écriture échoue en silence et le sélecteur revient à sa valeur précédente sans
message (piège déjà rencontré sur `cycle_tracking_enabled` et `session_conflicts_enabled`).

## 6. Accessibilité

Le sélecteur de niveau est un groupe de 3 boutons `accessibilityRole="button"` +
`accessibilityState={{ selected }}`, cible ≥ 44 px. Les barres (groupes musculaires, plages de
reps, intensité) portent un `accessibilityLabel` qui énonce la valeur — une barre seule n'est pas
lisible au lecteur d'écran. Les blocs repliables exposent `accessibilityState={{ expanded }}`.

## 7. Recette

Voir [RECETTES.md](../../../../RECETTES.md) — section MUSCU-UX02.
