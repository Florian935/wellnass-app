---
id: TRI-03
titre: "Score de forme / readiness global"
roadmap: []
catalogue: [TRI-03]
etape: recette
branche: feature/tri03-score-readiness
maj: 03/08/2026
---

# US TRI-03 — Score de forme / readiness global

> **Spec fonctionnelle — ✅ validée par Florian le 03/08/2026** (spec + plan + maquette, et les 7
> décisions de cadrage §1 arbitrées conformément aux recommandations). **Code livré le 03/08/2026**
> (TDD, `packages/shared/src/readiness.ts` + widget `ReadinessCard` + i18n FR/EN) — reste la
> recette device (§11).
>
> **US d'analyse — aucune ligne roadmap.** Comme [TRI-12](tri12-garde-fou-global.md) et
> [META-19](meta19-acwr-garde-fou.md), cette US vit **uniquement** dans le
> [catalogue d'analyses](../../product/analyses-donnees.md).

## 0. Pourquoi celle-ci, et pas un doublon d'ACWR / TRI-12 / MR-23

Le catalogue décrit TRI-03 comme « un chiffre orientant la décision du jour — différenciateur type
Whoop/Oura » : charge récente (muscu+course), qualité d'alimentation, tendance de poids. C'est la
seule US de la famille « récupération » qui **synthétise** plutôt que déclencher une alerte binaire
(TRI-12) ou une zone de charge seule (META-19/RUN-18) — elle répond à « comment je me sens
aujourd'hui ? », pas à « y a-t-il un problème ? ».

**Chevauchement identifié avec MR-23** (« Score de récupération / readiness croisé », catalogue,
⏳ différé) : MR-23 décrit exactement la même idée, mais limitée à muscu+course, « sans wearable ».
Ce n'est pas une coïncidence — les deux viennent de la même entrée [IDEAS.md](../../../../IDEAS.md)
du 13/07/2026 (`score-recuperation-readiness`), déclinée à deux échelles (paire vs tri-pilier) comme
le fait le reste du catalogue (MN-*/RN-*/MR-* pour les paires, TRI-* pour les trois). **Proposition
(D3) : ne pas construire les deux** — voir §1.

**Aucune donnée nouvelle** : `daily_wellbeing` (BIEN-01, livrée), `workout_sets`/`runs`
(computeAcwr, META-19/RUN-18/TRI-12), `food_entries` (averageIntake, MN-02) existent déjà. TRI-03
est une US de **composition**, pas de collecte.

## 1. Décisions de cadrage — ✅ TRANCHÉES par Florian le 03/08/2026

| # | Question | Recommandation | Pourquoi |
|---|---|---|---|
| **D1** | Sortie : indice 0-100 (libellé catalogue) ou verdict qualitatif ? | **Verdict à 3 états** (« Repos conseillé » / « Forme correcte » / « Prêt à pousser ») + détail dépliable des composantes, **pas** un indice numérique | Un 0-100 fabriqué à partir de poids arbitraires serait le **premier score composite inventé** de l'app — aucune brique existante n'en produit (vérifié). Le projet préfère systématiquement des états explicites et justifiés (zones ACWR low/safe/risk, échelle 1-5 avec libellé obligatoire, BIEN-01 D2 : « jamais un chiffre nu ») à un indice opaque. Un verdict + détail reste traçable jusqu'à sa source ; un 0-100 ne l'est pas |
| **D2** | Piliers requis pour afficher quelque chose ? | Garde **`'always'`** (transverse, comme `wellbeing`/`review`) avec **dégradation par composante** : chaque composante (charge / nutrition / bien-être) ne contribue que si sa donnée existe ; widget masqué seulement si **aucune** composante n'a de données | Même patron déjà en place pour les widgets transverses (état vide géré, jamais un calcul sur donnée absente). Permet à un utilisateur mono-pilier d'avoir un signal partiel au lieu de rien |
| **D3** | Absorber MR-23 ? | **Oui** — TRI-03 remplace MR-23 dans le catalogue, même précédent que MR-10 → TRI-12 | Avec la dégradation de D2, un utilisateur muscu+course sans nutrition obtient exactement ce que MR-23 décrivait (« sans wearable », charge + repos). Construire les deux dupliquerait la même formule de charge sous deux identifiants |
| **D4** | Rôle de `weightTrend` (listé par le catalogue) ? | **Hors périmètre v1** | Pas de mapping défendable immédiat vers « readiness du jour » — une perte de poids peut être saine ou un signal de sous-alimentation selon le contexte, déjà le terrain de MN-07/MN-08/MN-09 (non construits). L'ajouter précipiterait une règle non sourcée. Extension possible plus tard sans casser le modèle (même logique que BIEN-01 D1) |
| **D5** | Quels indicateurs de check-in, quelle fenêtre ? | **Énergie + stress**, moyenne glissante des **3 derniers jours renseignés** (pas l'humeur) | Énergie et stress sont directement liés à la capacité à s'entraîner aujourd'hui ; l'humeur est un indicateur plus général, moins spécifique à une décision d'entraînement. 3 jours lisse le bruit d'un jour isolé sans masquer un rebond récent |
| **D6** | Seuils de la composante nutrition ? | Réutiliser **`DEFICIT_ALERT_RATIO`** (15 %, MN-02) sur 7 jours calendaires, disponible seulement si **`MIN_LOGGED_DAYS`** (4, `bodyweight.ts`) jours sont loggés dans la fenêtre | Réutilise deux constantes déjà tranchées et déjà nommées pour cet usage exact (contrairement à TRI-12, qui a dû introduire une constante distincte parce que sa sémantique différait — ici l'usage de `MIN_LOGGED_DAYS` est *littéralement* son usage d'origine : fiabiliser une moyenne) |
| **D7** | Emplacement ? | Widget dashboard **transverse** (Tier 0, comme `wellbeing`/`review`), ajouté en fin de `HOME_WIDGET_IDS` | La valeur du catalogue (« oriente la décision du jour ») suppose d'être vu chaque matin sans action — pas retrouvé au fond d'un écran d'historique |

## 2. Surfaçage (ADR-007, obligatoire pour toute US d'analyse)

**Tier 0 — Dashboard, widget transverse** (D7), sur le modèle de `wellbeing`/`review`/`streak` :
**pas** un widget conditionnel Tier 2 (contrairement à `training-load`/`overtraining-guard`, qui ne
rendent quelque chose que dans un état dégradé). TRI-03 a quelque chose à dire **la plupart des
jours** dès qu'une composante a des données — c'est la distinction avec les gardes-fous, qui ne
parlent que quand ça va mal.

**Condition d'affichage** : `'always'` (D2), masqué uniquement si **aucune** des 3 composantes n'a
de données (ex. compte tout neuf, aucun check-in, aucun historique d'entraînement).

## 3. Ce qui existe déjà et qu'on réutilise

| Brique | Où | Usage ici |
|---|---|---|
| `computeAcwr` | `packages/shared/src/training-time.ts:74-90` | Composante **charge** — zone `low`/`safe`/`risk` sur les séances des piliers actifs |
| `sessionLoad` | `packages/shared/src/training-time.ts:46-52` | Utilisée en interne par `computeAcwr`, pas rappelée séparément |
| `averageIntake` | `packages/shared/src/bodyweight.ts:43-63` | Composante **nutrition** — moyenne kcal sur les jours loggés de la fenêtre |
| `DEFICIT_ALERT_RATIO`, `MIN_LOGGED_DAYS` | `packages/shared/src/bodyweight.ts` | Seuils réutilisés tels quels pour la composante nutrition (D6) |
| `wellbeingAverages` | `packages/shared/src/wellbeing.ts:138-161` | Composante **bien-être** — moyennes `energy`/`stress` sur jours renseignés + compte de jours (jamais un chiffre nu) |
| `useWorkoutHistory` / `useRunHistory` | `apps/mobile/src/data/repositories/dashboard-repository.ts` | Sessions muscu/course, déjà chargées ailleurs sur le dashboard |
| `useWindowStartKey`, `useDailyTotals`, `useNutritionSummary` | idem | Fenêtres 7j/28j, totaux journaliers, cible calorique — patron identique à `useTrainingLoadAlert`/`useOvertrainingGuardAlert` |
| `useWellbeingRows` | `apps/mobile/src/data/repositories/daily-wellbeing-repository.ts:79-85` | Lignes brutes de check-in, forme attendue par `wellbeingAverages` |
| `resolveActivePillars` + `useSettings` | `dashboard-repository.ts` | Détermine quels piliers sont actifs, pour savoir quelles composantes tenter |

**Aucune donnée nouvelle, aucune migration.**

## 4. Les règles

**R1 — Composante Charge.** Si `strength` et/ou `running` est actif : assembler les séances des
piliers actifs sur les fenêtres aiguë (7 j) / chronique (28 j) déjà définies pour l'ACWR, passer à
`computeAcwr`. Si le résultat est `null` (pas assez d'historique chronique) → composante
**indisponible**. Sinon, la zone qualifie la composante : `low` → *fraîche* (positif), `safe` →
*stable* (neutre), `risk` → *chargée* (négatif). Aucun seuil nouveau : on réutilise la même fonction
et les mêmes zones que META-19/RUN-18/TRI-12, jamais une variante.

**R2 — Composante Nutrition.** Si `nutrition` est actif : prendre les jours loggés des 7 derniers
jours calendaires. Si moins de `MIN_LOGGED_DAYS` (4) jours sont loggés → composante
**indisponible** (échantillon trop faible, même garde-fou que MN-02). Sinon, comparer
`averageIntake` des jours loggés à la cible de base (hors bonus jour d'entraînement, même convention
que MN-02/TRI-12) : écart ≥ `DEFICIT_ALERT_RATIO` (15 %) sous la cible → *sous-alimenté* (négatif) ;
sinon → neutre. **Pas de symétrie sur le surplus** : un excédent calorique n'est pas traité comme un
signal de mauvaise readiness (ce terrain appartient à MN-07, non construit).

**R3 — Composante Bien-être.** `wellbeingAverages(rows, 3, todayKey)` sur `energy` et `stress`
(D5). Si les deux ont `days === 0` → composante **indisponible**. Sinon : `energy` moyen ≤ 2 **ou**
`stress` moyen ≥ 4 → négatif ; `energy` moyen ≥ 4 **et** `stress` moyen ≤ 2 → positif ; sinon →
neutre. Échelle 1-5 identique à BIEN-01, **stress à l'envers** (5 = beaucoup de stress = mauvais,
comme documenté par BIEN-01 §6).

**R4 — Verdict global.** Combine les composantes **disponibles** (1 à 3, jamais une moyenne
lissante) :
- Au moins une composante **négative** → **« Repos conseillé »** (le signal le plus défavorable
  l'emporte toujours, jamais compensé par un bon signal ailleurs — même philosophie que les
  gardes-fous, inversée : ici un seul mauvais signal suffit à recommander la prudence).
- Sinon, au moins une composante **positive** → **« Prêt à pousser »**.
- Sinon (tout ce qui est disponible est neutre) → **« Forme correcte »**.

> ⚠️ **Corrigé le 03/08/2026, pendant l'implémentation (TDD)** : la première version de cette règle
> exigeait que *toutes* les composantes disponibles soient positives pour « Prêt à pousser ». Or la
> composante nutrition (R2) ne produit **jamais** l'état positif (seulement négatif/neutre, par
> construction — pas de symétrie sur le surplus) : avec cette règle, un utilisateur nutrition active
> n'aurait **jamais** pu voir « Prêt à pousser », quelle que soit sa forme réelle. Le test
> « un seul signal positif suffit, comme un seul signal négatif suffit côté repos » corrige ce trou —
> symétrie retrouvée avec la première puce.

**R5 — Aucune composante disponible → widget masqué.** Jamais de verdict par défaut sur une donnée
absente (D2) — retour `{ show: false }`/`null`, même mécanisme que les widgets conditionnels.

**R6 — Ton factuel, suggestion non impérative.** Même exigence que TRI-12 R6/META-19 §7 : pas de mot
alarmiste ni triomphaliste, une recommandation, jamais une affirmation de certitude sur l'état
physiologique réel de l'utilisateur (le signal reste approximatif, construit sur des proxies
déclaratifs et des séances, pas une mesure physiologique).

**R7 — Aucune action automatique.** Ni report de séance, ni notification push, ni verrouillage
d'une fonctionnalité — affichage informatif seul (même limite que TRI-12 R7/META-19/RUN-14/RUN-18).

**R8 — Détail toujours traçable.** Le verdict s'accompagne d'un détail dépliable montrant l'état de
chaque composante tentée (« Charge : stable », « Nutrition : indisponible — pas assez de jours
loggés », « Bien-être : fatigue »). Jamais un mot nu sans justification consultable — corollaire
direct de D1.

## 5. Périmètre

**Dans le périmètre :**
1. Fonction pure de composition (charge + nutrition + bien-être → verdict), packages/shared.
2. Widget dashboard transverse (Tier 0), 3 formes, avec détail dépliable (R8).
3. Absorption de MR-23 dans le catalogue (D3) — mise à jour d'`analyses-donnees.md`.
4. i18n FR + EN complète (verdicts + libellés de composantes + états indisponibles).

**Hors périmètre, explicitement :**
- `weightTrend` (D4) — reporté, terrain de MN-07/MN-08/MN-09.
- Historique/courbe du score dans le temps — le catalogue décrit un signal **du jour**, pas une
  tendance ; une courbe serait une extension distincte, non demandée ici.
- Toute action automatique découlant du verdict (R7).
- MUSC-23 (« Tendance du RPE / fatigue accumulée ») — **distincte, pas absorbée** : c'est une analyse
  intra-muscu par exercice dans le temps, pas un verdict transverse du jour. Partage `sessionLoad`
  comme brique, rien de plus.

## 6. i18n (FR + EN)

Nouvelle famille `home.readiness.*` :
- 3 libellés de verdict (« Repos conseillé » / « Forme correcte » / « Prêt à pousser »).
- 3 libellés d'état par composante × 3 valeurs (positif/neutre/négatif) + 1 état « indisponible »
  par composante, avec sa raison courte (« pas assez de jours loggés », « pas encore assez
  d'historique », « aucun check-in récent »).
- État vide (widget masqué n'a pas besoin de libellé — R5 — mais l'écran d'aide/tooltip éventuel si
  prévu à l'étape design en a besoin).
- Aucune chaîne en dur.

## 7. Comportement offline

**Total.** Lecture PowerSync locale (`workouts`/`workout_sets`/`runs`/`food_entries`/
`daily_wellbeing`, déjà synchronisées), agrégation pure. Aucun réseau, aucune écriture.

## 8. Accessibilité

Bloc `accessible` unique par forme de widget (titre + verdict + éventuellement la composante la
plus significative), même patron que `TrainingLoadAlertCard`/`OvertrainingGuardCard`. Le détail
dépliable (R8) est atteignable au clavier/TalkBack comme les sections repliables existantes
(patron ADR-007 Tier 1). Jamais la couleur seule pour distinguer les 3 verdicts.

## 9. Cas limites

| Situation | Comportement attendu |
|---|---|
| Compte neuf, aucune donnée nulle part | Widget masqué (R5) |
| Seul le check-in est renseigné (aucun pilier entraînement, pas de nutrition) | Verdict basé sur la seule composante bien-être disponible |
| `strength` et `running` actifs, historique < 28 j | Composante charge indisponible (`computeAcwr` retourne `null`) ; verdict basé sur les autres composantes disponibles |
| Nutrition active mais < 4 jours loggés sur 7 | Composante nutrition indisponible, pas neutre par défaut |
| Toutes les composantes disponibles, deux positives et une négative | « Repos conseillé » (R4 — un seul signal négatif suffit) |
| Check-in fait mais seulement l'humeur renseignée (énergie/stress nuls) | Composante bien-être indisponible (D5 ne regarde que énergie/stress) |
| Mode avion | Fonctionne normalement (lecture locale seule) |
| Un pilier désactivé après avoir contribué au verdict la veille | Recalcul au prochain rendu — la composante correspondante redevient indisponible ou change selon les données restantes |

## 10. Definition of Done

- [x] D1 → D7 arbitrés par Florian le 03/08/2026.
- [x] MR-23 marquée absorbée dans `analyses-donnees.md` (D3), TRI-03 passe de 🆕 à ⏳ (cadrée) puis
      à son statut de code réel le 03/08/2026.
- [x] Fonction de composition pure et testée dans `packages/shared` (22 tests : une combinaison par
      composante disponible/indisponible, et le cas « une seule négative »/« une seule positive »).
- [x] Widget `readiness` en `'always'`, ajouté **en fin** de `HOME_WIDGET_IDS`, 3 formes.
- [x] i18n FR + EN complètes, zéro chaîne en dur.
- [x] `npm run lint`, `npm run typecheck`, `npm run test` verts (1452 tests shared + 651 tests
      mobile, 03/08/2026 — inclut le smoke test `ReadinessCard.test.tsx` ajouté après revue).
- [x] Aucune ligne roadmap à toucher (US d'analyse, catalogue seul).
- [ ] Recette device (Florian ou Damien) — critères §11.

## 11. Critères d'acceptation (recette device)

1. Un utilisateur 3 piliers actifs + historique + check-ins récents voit un verdict cohérent avec
   ses 3 composantes.
2. Un utilisateur nutrition seule, ayant fait ses check-ins, voit un verdict basé sur le bien-être
   seul (pas de trou, pas de composante muscu/course inventée).
3. Un compte tout neuf ne voit **aucun** widget readiness tant qu'aucune composante n'a de données.
4. Une composante indisponible (ex. nutrition, faute de jours loggés) est explicitement dite
   « indisponible » dans le détail, jamais confondue avec un état neutre.
5. Un seul signal négatif suffit à afficher « Repos conseillé », même si les deux autres sont bons.
6. Mode avion : le widget s'affiche normalement s'il y a lieu.
7. TalkBack énonce le widget comme un bloc cohérent ; le détail dépliable est atteignable.
8. En EN : verdicts et libellés de composantes sont grammaticaux.
