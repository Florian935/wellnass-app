---
id: MUSC-09
titre: "Record personnel par plage de répétitions"
roadmap: [3.56]
catalogue: [MUSC-09]
etape: recette
branche: feature/musc09-record-plage-reps
maj: 02/08/2026
---

# US MUSC-09 — Record personnel par plage de répétitions

> **Candidat du catalogue, jamais cadré — et sans ligne roadmap.** Le lien qu'il portait vers 6.3
> était erroné (6.3 = accès à une démo vidéo pendant la séance, ❌ abandonné avec les GIF
> d'exercices, sans rapport). Cette spec attribue un numéro neuf (3.56) et pose les règles qui
> manquaient — en particulier les bornes exactes des plages, jamais précisées par le catalogue.

## 0. Ce qui existe déjà

La fiche exercice affiche déjà 3 records **cumulatifs, tous temps** (roadmap 3.48/MUSC-F10b,
[id].tsx](../../../../apps/mobile/src/app/exercises/[id].tsx)) : 1RM (réel ou estimé), charge max,
meilleur volume — chacun est **une seule valeur, la meilleure jamais atteinte**, indépendamment du
nombre de répétitions de la série qui l'a produite.

**Ce que MUSC-09 ajoute** : au lieu d'une charge max unique, une **charge max par plage de
répétitions** — la question change de « quel est ton record absolu ? » à « à combien de reps
soulèves-tu le plus, et comment ta charge varie-t-elle avec le nombre de reps ? ». Utile pour
quelqu'un qui travaille aussi bien la force pure (1-3 reps) que l'hypertrophie (8-12 reps) : le 1RM
seul ne dit rien de sa charge à 10 reps.

**Aucune donnée nouvelle.** `workout_sets` (`reps`, `weight_kg`, `done`, `set_type`) porte déjà tout
le nécessaire — même source que les 3 records existants.

## 1. Les 6 plages — bornes fixes, reprises des ancres du catalogue

Le catalogue liste « 1/3/5/8/10/12+ » sans donner les bornes. Ce sont des **ancres de test de force
classiques** (1RM, 3RM, 5RM, 8RM, 10RM, 12RM+) : une série n'atterrit presque jamais exactement sur
l'une d'elles (un « 8-12 reps » d'hypertrophie donnera souvent 9, 10 ou 11). Des plages **couvrant
tout le spectre**, pas des valeurs exactes, sont donc nécessaires pour que les données réelles
tombent quelque part :

| Plage | Reps couverts | Libellé |
|---|---|---|
| `1` | 1 | 1 rep |
| `3` | 2 à 4 | 2-4 reps |
| `5` | 5 à 7 | 5-7 reps |
| `8` | 8 à 9 | 8-9 reps |
| `10` | 10 à 11 | 10-11 reps |
| `12plus` | 12 et plus | 12+ reps |

**R1 — Ces 6 plages sont fixes, non paramétrables.** Un système configurable ajouterait de la
complexité (UI de configuration, migration) pour un besoin qui n'a jamais été demandé — les ancres
du catalogue suffisent.

## 2. Règles

**R2 — Cumul, tous temps, comme les 3 records existants.** Pas de fenêtre glissante (catalogue :
« période = cumul ») — cohérent avec `max_weight`/`estimated_1rm`/`best_volume`, qui sont eux aussi
all-time.

**R3 — Éligibilité des séries identique au reste du système de records.** `done = true`,
`set_type` ni `warmup` ni `duration`, `weight_kg` et `reps` non nuls — les **mêmes** conditions que
`computeWorkoutRecords`
([records.ts](../../../../packages/shared/src/records.ts)), pas une variante inventée pour cette US.

**R4 — Une plage jamais travaillée est absente, pas une ligne à 0.** Même convention que NUTR-16 :
une ligne à 0 kg se lirait comme un échec, alors que c'est simplement une plage jamais testée pour
cet exercice.

**R5 — À charge égale dans une même plage, la série la plus récente gagne.** Cohérent avec l'ordre
déjà utilisé pour le 1RM réel (`ORDER BY weight_kg DESC, finished_at DESC`,
[records-repository.ts](../../../../apps/mobile/src/data/repositories/records-repository.ts)).

**R6 — Ordre d'affichage = ordre des plages (1 → 12+), jamais un tri par charge décroissante.** Un
tableau qui se réordonne à chaque séance serait illisible pour comparer visuellement la charge à
travers le spectre — c'est tout l'intérêt de la fonctionnalité (« courbe charge↔reps »).

## 3. Périmètre

**Dans le périmètre** :
- Fonction pure de bucketing (packages/shared, même fichier que `computeWorkoutRecords`).
- Nouvelle requête (même patron que `SELECT_EXERCISE_TOP_SINGLE`) : toutes les séries éligibles
  d'un exercice, reps + poids + date de séance.
- Nouvelle section sur la fiche exercice, **sous** les 3 tuiles de records existantes (même écran,
  pas de nouvelle route).

**Hors périmètre** :
- Toute vue agrégée **tous exercices confondus** — cette US est **par exercice**, comme les 3
  records existants qu'elle complète. Une vue transverse serait un candidat distinct.
- Un graphique courbe (le catalogue le mentionne en description, « courbe charge↔reps ») — un
  **tableau** (le type déclaré au catalogue) suffit pour ce premier jet ; une courbe ferait doublon
  avec `useExerciseProgression` déjà présent sur la fiche pour d'autres métriques.

## 4. i18n

Nouvelle famille `exercises.detail.records.repRanges.*`, FR + EN :
- `title` — « Force par plage de reps » / « Strength by rep range ».
- `range1` / `range3` / `range5` / `range8` / `range10` / `range12plus` — libellés du tableau §1.
- `empty` — « Pas encore de série à charge et reps renseignés pour cet exercice. » / « No sets with
  both weight and reps logged for this exercise yet. »

## 5. Comportement offline

**Total.** Lecture PowerSync locale, agrégation pure. Aucun réseau.

## 6. Accessibilité

Chaque ligne (plage + charge + date) est un bloc `accessible` unique — pas des `Text` disjoints
qu'un lecteur d'écran énoncerait sans lien évident entre eux.

## 7. Critères de recette

- [ ] 1. Un exercice avec des séries loggées à 1, 5 et 10 reps (charges différentes) → 3 lignes,
      dans l'ordre 1 → 5 → 10, chacune avec sa charge et sa date.
- [ ] 2. Une plage jamais travaillée pour cet exercice → **absente** du tableau, pas une ligne à
      0 kg (R4).
- [ ] 3. Aucune série éligible pour cet exercice → état vide explicite, pas de tableau cassé.
- [ ] 4. Une série d'échauffement (`warmup`) à charge élevée n'apparaît **dans aucune** plage (R3).
- [ ] 5. Deux séries à charge égale dans la même plage → la plus récente est celle affichée (R5).
- [ ] 6. **Mode avion** : le tableau s'affiche normalement (aucun réseau requis).
- [ ] 7. En **EN** : les 6 libellés de plage et l'état vide sont grammaticaux.
- [ ] 8. TalkBack énonce chaque ligne comme un bloc cohérent, pas des fragments disjoints.
