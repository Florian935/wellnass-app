---
id: RUN-18
titre: "Charge d'entraînement & ACWR (running seul)"
roadmap: []
catalogue: [RUN-18]
etape: validation
branche: feature/run18-acwr-running
maj: 02/08/2026
---

# US RUN-18 — Charge d'entraînement & ACWR (running seul)

> **US d'analyse — aucune ligne roadmap.** Comme [META-19](meta19-acwr-garde-fou.md), cette US vit
> **uniquement** dans le [catalogue d'analyses](../../product/analyses-donnees.md) : pas de ligne
> dans `docs/roadmap/roadmap.md` (RUN-14/NUTR-16/MUSC-09 avaient reçu une ligne par erreur avant que
> cette règle ne soit retrouvée et corrigée — non reproduit ici).

## 0. Ce qui existe déjà — la brique commune posée par META-19

META-19 vient de construire `sessionLoad` et `computeAcwr` (`packages/shared/src/training-time.ts`,
méthode session-RPE de Foster, charge aiguë 7 j ÷ charge chronique 28 j) pour le garde-fou **combiné**
(muscu + course), affiché en widget dashboard conditionnel. Le catalogue identifiait déjà RUN-18
comme l'un des trois candidats qui réutiliseraient cette brique (avec MR-10, TRI-12) : c'est fait
plus tôt que prévu, dès la première déclinaison.

**Différence avec META-19** : RUN-18 est **intra-pilier** (course seule, jamais de muscu dans le
calcul) — utile en particulier pour un coureur qui n'a pas activé le pilier muscu, pour qui META-19
ne s'affichera **jamais** (gating `['strength', 'running']`, les deux requis).

## 1. Surfaçage (ADR-007, obligatoire pour toute US d'analyse)

**Tier 1 — Écran Stats/Progression du pilier, à la demande.** Section dans
[running-history/index.tsx](../../../../apps/mobile/src/app/running-history/index.tsx), sous la
section « Objectifs estimés » (RUN-14) — même écran que RUN-01 à RUN-14, pas un nouveau.

**Pas un widget dashboard.** Deux raisons, pas une seule :
- ADR-007 : Tier 0 plafonné, Tier 2 réservé à un signal qui **doit interrompre** l'utilisateur. Une
  analyse intra-pilier de fond a sa place naturelle dans l'écran du pilier (même choix que RUN-05
  courbe d'allure, RUN-14 prédictions), pas sur l'accueil.
- **Éviter la redite avec META-19** : si les deux piliers sont actifs, l'accueil affiche déjà l'alerte
  combinée (Tier 2, conditionnelle) quand elle est haute. Ajouter un **second** widget d'accueil pour
  la même famille de risque, avec un chiffre potentiellement différent (portée différente), créerait
  la confusion que l'US se propose justement d'éviter.

**Condition d'affichage** : contrairement à META-19 (qui se replie `null` hors de la zone de risque),
cette section est un **écran de stats consulté volontairement** — elle affiche le ratio et sa zone
**dans les trois cas** (basse/saine/risque), pas seulement en cas de risque (R4). Elle ne disparaît
que faute de base de comparaison (R5).

## 2. Ce qui existe déjà côté données

- `runs.rpe` / `runs.durationSeconds` / `runs.finishedAt` : déjà en base, déjà exposés par
  `useRunHistory()` (aucune nouvelle requête).
- `sessionLoad` / `computeAcwr` (`@wellness/shared`, posés par META-19) : réutilisés **tels quels**,
  avec en entrée uniquement les séances `runs` (jamais `workouts`).

**Aucune donnée nouvelle, aucune migration.**

## 3. Les règles

**R1 — Même méthode que META-19, portée réduite aux courses.** `sessionLoad` (RPE × durée en
minutes) et fenêtres calendaires fixes (7 j / 28 j, spec R3 de META-19) sont **identiques** — seule la
liste de séances change (`runs` au lieu de `runs` + `workouts`). Pas de nouvelle formule.

**R2 — Seuil de risque aligné sur META-19 (> 1,3), pas le 1,5 du catalogue.** Le catalogue cite deux
seuils différents pour la même méthode selon la ligne (RUN-18 : « >1,5 » ; META-19 : « hors zone sûre
~0,8-1,3 », qui est le seuil standard de la littérature sport-science, déjà justifié et implémenté).
Deux seuils différents pour le même ratio, sans justification distincte pour le cas « course seule »,
casserait la promesse de « brique commune » que le catalogue lui-même met en avant pour ces trois
candidats — et forcerait à dupliquer `computeAcwr` avec un seuil paramétrable pour un écart non
sourcé. **Décision : on aligne sur 1,3.** Le « 1,5 » du catalogue est traité comme une approximation
de rédaction, pas une exigence produit distincte (même type de correction que le R5 de META-19 sur la
formulation trop large du catalogue).

**R3 — Trois zones affichées, pas une alerte binaire.** Contrairement à META-19 (`showAlert`
booléen, un seul seuil), cet écran affiche la zone qualitative complète. Bornes **identiques à
l'implémentation existante** de `computeAcwr` (comparaisons strictes, aucune ambiguïté sur les
valeurs pile 0,8 ou 1,3) :
- **ratio < 0,8** — « zone basse » : sous-entraînement/reprise, pas un risque de surcharge (même
  lecture que le R5 de META-19, mais ici **affichée** au lieu d'être hors périmètre — un écran de
  stats informatif n'a pas de raison de cacher une donnée réelle sous prétexte qu'elle n'est pas
  actionnable de la même façon qu'un garde-fou).
- **0,8 ≤ ratio ≤ 1,3** — « zone saine ».
- **ratio > 1,3** — « zone de risque » : même seuil et même intention que META-19 (suggestion de
  repos), reformulée pour un contexte course seule (allure/volume plutôt que « séance »).

**R4 — Aucune des trois zones n'a de ton alarmiste.** Même exigence que META-19 §7 et RUN-F3 R4 : pas
de rouge, pas de mot comme « échec » ou « danger », y compris pour la zone de risque — un ton factuel
constant sur les trois zones, cohérent avec le fait qu'elles sont juxtaposées sur le même écran (pas
une alerte isolée qui justifierait une teinte distincte).

**R5 — Pas de charge chronique (aucune course sur 28 j) → section absente, pas un ratio à 0.** Même
principe que R6 de META-19 et la convention « absent, jamais zéro » déjà établie (NUTR-16, MUSC-09) :
un compte neuf ou une reprise après une longue pause n'a pas de base de comparaison.

**R6 — Aucune action proposée depuis cette section.** Même limite que RUN-14 R6 : affichage
informatif seulement, pas de notification, pas de lien vers un plan d'entraînement.

## 4. Périmètre

**Dans le périmètre** :
- Extension pure `computeAcwr` (`packages/shared`) : ajoute un champ `zone: 'low' | 'safe' | 'risk'`
  au résultat (calculé à partir du même `ratio` déjà produit) — additif, ne change ni la signature
  existante ni le comportement de `showAlert` consommé par META-19.
- Section « Charge d'entraînement » sur `running-history/index.tsx`, sous « Objectifs estimés »
  (RUN-14), calcul inline à partir de `useRunHistory()` (même patron que `PredictionsSection`, pas
  de nouveau hook de repository).

**Hors périmètre** :
- ACWR combiné (déjà livré, META-19) — cette US ne le duplique pas, elle le complète pour le cas
  running-seul.
- MR-10 et TRI-12 (autres déclinaisons de la même brique, candidats distincts non cadrés).
- Historique/courbe du ratio dans le temps (RUN-15 est la courbe de progression sur une distance de
  référence, pas sur l'ACWR — un futur candidat distinct, pas celui-ci).

## 5. i18n

Nouvelle famille `running.trainingLoad.*`, FR + EN :
- `title` — « Charge d'entraînement » / « Training load ».
- `ratioLabel` — « Ratio 7 j / 28 j » / « 7-day / 28-day ratio ».
- `zoneLow` — « Zone basse — reprise en douceur » / « Low zone — easing back in ».
- `zoneSafe` — « Zone saine » / « Healthy zone ».
- `zoneRisk` — « Zone de risque — pense à un jour de repos » / « Risk zone — consider a rest day ».
- `empty` — « Pas encore assez d'historique (28 jours de course) pour calculer ta charge. » / « Not
  enough history yet (28 days of running) to calculate your load. »

**Format du ratio** : 2 décimales (`ratio.toFixed(2)`), sans formatage localisé — même convention
que les autres valeurs numériques brutes déjà affichées dans l'app (point décimal identique en FR et
en EN ; seuls les libellés autour changent de langue).

## 6. Comportement offline

**Total.** Lecture PowerSync locale (`runs`, déjà synchronisée), agrégation pure. Aucun réseau.

## 7. Accessibilité

Chaque ligne (zone + ratio) est lue comme un ensemble cohérent (libellé + valeur + zone). ⚠️
**`RecordsSection` n'est pas le bon précédent ici** : ses lignes se regroupent pour TalkBack parce que
ce sont des `Pressable` (accessibles par défaut en React Native, navigation vers le détail d'un
record). Cette section est purement informative (R6, aucune navigation) — ses lignes seront de
simples `View`/`Text`, qui **ne se regroupent pas automatiquement**. Chaque ligne doit donc porter
explicitement `accessible` + `accessibilityLabel` combinant libellé, zone et valeur — même exigence
que META-19 §7, appliquée ligne par ligne plutôt qu'au bloc entier (une seule ligne ici, contre
titre+message+recommandation pour l'alerte dashboard).

## 8. Critères de recette

- [ ] 1. Un coureur avec ≥ 28 jours d'historique de course et un ratio dans la zone saine → la
      section affiche le ratio et « zone saine ».
- [ ] 2. Ratio > 1,3 → « zone de risque » affichée, ton factuel (pas de rouge alarmiste).
- [ ] 3. Ratio < 0,8 → « zone basse » affichée (contrairement à META-19, elle n'est pas masquée ici).
- [ ] 4. Aucune course sur les 28 derniers jours (compte neuf) → section absente, pas de ratio à 0,
      pas d'erreur (R5).
- [ ] 5. Sur un même compte, ajouter une course sans RPE renseigné à côté de courses avec RPE ne fait
      pas baisser le ratio affiché de façon disproportionnée — la séance sans RPE contribue zéro,
      elle n'est pas retirée du calcul (même règle que META-19 R1).
- [ ] 6. Le pilier muscu actif ou non ne change rien à cette section (elle ne regarde que `runs`) —
      contrairement à META-19 qui exige les deux piliers.
- [ ] 7. **Mode avion** : la section s'affiche normalement (aucun réseau requis).
- [ ] 8. En **EN** : les trois libellés de zone et l'état vide sont grammaticaux.
- [ ] 9. TalkBack énonce chaque ligne comme un ensemble cohérent (libellé + zone + ratio), pas des
      fragments disjoints.

> Le seuil 1,3 (aligné META-19, R2) est une invariante de code, pas un critère de recette humaine —
> couvert par les tests unitaires de `computeAcwr` (voir le plan).
