---
id: RUN-14
titre: "Prédiction de temps de course (formule de Riegel)"
roadmap: [5.34]
catalogue: [RUN-14]
etape: validation
branche: feature/run14-prediction-riegel
maj: 02/08/2026
---

# US RUN-14 — Prédiction de temps de course (formule de Riegel)

> **Candidat du catalogue, jamais cadré.** `docs/product/analyses-donnees.md` décrit RUN-14 en une
> ligne : formule de Riegel depuis un record récent, effort de code très faible (donnée déjà là,
> formule pure). Cette spec pose les règles qui manquaient — en particulier **quel record sert de
> source**, et **comment ne pas transformer une extrapolation statistique en promesse**.

## 0. Ce qui existe déjà, et ce qui manque

`running_pace_records` est alimentée automatiquement à la fin de chaque course GPS
([running-record-repository.ts](../../../../apps/mobile/src/data/repositories/running-record-repository.ts),
`detectAndStoreRunRecords`) : meilleur temps sur les 5 distances canoniques
(`RUNNING_RECORD_DISTANCES` — 1 km, 5 km, 10 km, semi, marathon), dès qu'une trace GPS les couvre.
Ces records sont déjà affichés (`RecordsSection`,
[running-history/index.tsx](../../../../apps/mobile/src/app/running-history/index.tsx)).

**Rien ne manque côté donnée.** Cette US ajoute une fonction pure (formule de Riegel) et un bloc
d'affichage complémentaire — **aucune migration, aucune nouvelle colonne**.

## 1. La formule

```
T2 = T1 × (D2 / D1)^1,06
```

`T1` = temps sur la distance source (secondes), `D1` = sa distance (mètres), `D2` = distance cible.
L'exposant 1,06 traduit que la fatigue s'accumule plus vite que la distance — c'est ce qui rend
Riegel plus honnête qu'une simple règle de trois (allure constante).

## 2. Règles

**R1 — La source est toujours le record des 5 km, jamais un autre.** Pas « le record le plus
récent », pas « le plus rapide » : le **5 km** est déjà la distance de référence de l'app
(`ref5kPaceSPerKm` du profil coureur, mise à jour automatique à chaque record battu — roadmap 5.31,
VMA dérivée de cette même distance — `running-paces.ts`). Réutiliser cette convention évite
d'inventer une deuxième notion de "record de référence". Si aucun record 5 km n'existe encore
(aucune course n'a couvert 5 km en continu), **aucune prédiction ne s'affiche** — état vide, pas
d'erreur.

**R2 — Trois distances cibles, jamais moins, jamais plus : 10 km, semi, marathon.** Toujours plus
longues que la source (extrapoler *en dessous* de 5 km n'a pas de sens produit — ce n'est pas ce que
demande le catalogue). Le 1 km n'est pas une cible.

**R3 — Si un record réel existe déjà pour une distance cible, la prédiction de cette distance ne
s'affiche pas.** Afficher un chiffre *estimé* à côté d'un chiffre *réel* pour la même distance
serait la pire violation possible de l'honnêteté (§4) — la vraie performance a toujours priorité.
Exemple : un coureur qui a déjà un record semi ne voit **pas** de semi estimé, seulement marathon
(s'il n'a pas de record marathon).

**R4 — Le record source est toujours visible à côté de la prédiction.** Jamais un chiffre seul.
Format : allure/temps estimé + « d'après ton 5 km du JJ/MM/AAAA en MM:SS ». Une prédiction sans sa
source est un chiffre qu'on ne peut pas vérifier — même défaut que R2 de RUN-F3 (comparaison à
l'objectif), on reconduit la même exigence.

**R5 — Le marathon porte un avertissement dédié, pas un simple astérisque.** Ratio d'extrapolation
42 195 / 5 000 ≈ 8,4× — bien au-delà de la zone où Riegel reste fiable (généralement citée jusqu'à
~3×). Un coureur qui vient de commencer et n'a couru que du 5 km verrait un temps marathon qui a
l'air d'une promesse alors que rien ne le prépare à l'effort d'endurance spécifique. Texte explicite
(§5), pas un « (estimation moins fiable) » discret.

**R6 — Aucune action n'est proposée depuis ce bloc.** Ni "fixer comme objectif", ni notification, ni
lien vers un plan d'entraînement — l'US est un affichage informatif, pas un outil de fixation
d'objectif (qui existe déjà séparément via OBJ-01). Mélanger les deux inventerait un flux qui n'a pas
été demandé.

## 3. Périmètre

**Dans le périmètre** :
- Fonction pure `predictRaceTime(t1Seconds, d1Meters, d2Meters)` (packages/shared).
- Fonction d'orchestration qui, à partir des records existants, décide quelles prédictions afficher
  (R1 + R3).
- Un bloc « Objectifs estimés » sur l'écran historique de course
  ([running-history/index.tsx](../../../../apps/mobile/src/app/running-history/index.tsx)), sous la
  section Records existante — même écran, pas un nouveau.

**Hors périmètre** :
- Toute forme de suivi de progression de la prédiction dans le temps (RUN-15, catalogue — distinct).
- Fixer un objectif chrono ou une date de course (OBJ-01 existe déjà pour ça, séparément).
- Ajuster l'exposant de Riegel selon le niveau du coureur (`RUNNER_LEVELS` existe mais n'est pas
  mobilisé ici — affiner l'exposant par niveau serait un chantier de calibrage, pas cette US).

## 4. Honnêteté de la prédiction — le point dur (catalogue)

Le catalogue l'identifiait déjà : une prédiction affichée sans repère se lit comme une promesse.
Les garde-fous R1/R3/R4/R5 ci-dessus en découlent directement. Aucun texte du type « tu peux courir
un marathon en 4h12 » : toujours « **estimé** à 4h12 d'après ton 5 km ».

## 5. i18n

Nouvelle famille `running.predictions.*`, FR + EN :
- `title` — « Objectifs estimés » / « Estimated goals ».
- `sourceLabel` — « D'après ton 5 km du {{date}} en {{time}} » / « Based on your 5K on {{date}} in {{time}} ».
- `distance10k` / `distanceSemi` / `distanceMarathon` — réutilise si possible les clés existantes de
  `running.records.*` (même libellés) plutôt que de dupliquer.
- `marathonWarning` — « Estimation à prendre avec prudence : le marathon demande une préparation
  spécifique que cette projection ne mesure pas. » / « Take this estimate with caution: the marathon
  needs specific preparation this projection doesn't measure. »
- `empty` — « Cours au moins 5 km sans interruption pour voir tes objectifs estimés. » / « Run at
  least 5K non-stop to see your estimated goals. »

## 6. Comportement offline

**Total.** Calcul pur sur des données déjà locales (`running_pace_records`). Aucun réseau, aucune
dépendance externe.

## 7. Accessibilité

Chaque ligne de prédiction est un bloc `accessible` unique énonçant distance + temps estimé + source
— pas trois `Text` séparés qu'un lecteur d'écran énoncerait sans lien évident entre eux. Le texte
d'avertissement marathon (R5) fait partie du même bloc accessible, jamais une info-bulle séparée
qui serait invisible au lecteur d'écran.

## 8. Critères de recette

- [ ] 1. Un coureur avec un record 5 km et aucun autre record → 3 prédictions (10 km, semi,
      marathon), chacune avec sa source visible.
- [ ] 2. Un coureur avec un record 5 km **et** un record semi réel → la prédiction semi **ne
      s'affiche pas** ; 10 km et marathon estimés restent affichés (R3).
- [ ] 3. Un coureur sans aucun record 5 km (ex. n'a couru que du 1 km) → bloc vide explicite, pas de
      calcul, pas d'écran cassé (R1).
- [ ] 4. La prédiction marathon affiche l'avertissement dédié (R5) ; 10 km et semi n'en ont pas.
- [ ] 5. Battre son record 5 km met à jour les 3 prédictions au prochain affichage (recalcul à la
      lecture, pas de valeur mise en cache périmée).
- [ ] 6. **Mode avion** : le bloc s'affiche normalement (aucun réseau requis).
- [ ] 7. Réglage **impérial** : les temps s'affichent identiques (la formule ne dépend pas de
      l'unité), seule l'unité de distance change dans les libellés source.
- [ ] 8. En **EN** : toutes les phrases (source, avertissement, état vide) sont grammaticales.
- [ ] 9. TalkBack énonce chaque ligne comme un bloc cohérent (distance + temps + source), pas des
      fragments disjoints.
