---
id: RN-03
titre: "Ajustement auto du TDEE selon le volume de course"
roadmap: []
catalogue: [RN-03]
etape: recette
branche: feature/rn03-tdee-ajuste-course
maj: 04/08/2026
---

# US RN-03 — Ajustement auto du TDEE selon le volume de course

> **Spec fonctionnelle — ✅ validée par Florian le 04/08/2026** (spec + plan + maquette, et les 5
> décisions de cadrage §1 arbitrées conformément aux recommandations). **Code livré le 04/08/2026**
> (TDD, `packages/shared/src/nutrition.ts` + widget `ActivityLevelSuggestionCard` + i18n FR/EN) —
> reste la recette device (§11).
>
> **US d'analyse — aucune ligne roadmap.** Comme [RN-01/RN-02](../../product/analyses-donnees.md)
> (déjà livrées), cette US vit **uniquement** dans le
> [catalogue d'analyses](../../product/analyses-donnees.md).

## 0. Pourquoi celle-ci, et pas un doublon de RN-02

[alimentation.md §2.2](../alimentation.md) prévoyait dès l'origine un
« ajustement automatique [du TDEE] selon le planning d'entraînement » — jamais construit. Ce qui
existe aujourd'hui (**RN-02**, livrée) est un **bonus du jour** : les jours de séance/course,
`dayCalorieBonus` ajoute une compensation ponctuelle par-dessus l'objectif de base. Il ne touche
**jamais** le calcul de ce socle — `nutrition_profiles.activity_level`, choisi une fois à
l'onboarding (`tdee()` = BMR × facteur d'activité, [nutrition.ts](../../../../packages/shared/src/nutrition.ts))
et **figé pour toujours**, même si le volume réel de course change durablement.

**RN-03 comble ce trou précis** : un coureur qui est passé de 1 sortie/semaine à 5 depuis deux mois
garde un objectif de **repos** basé sur « sédentaire » choisi à l'inscription — sous-estimé tous les
jours, y compris ceux sans course. **Ce n'est pas un doublon de RN-02** : l'un ajuste le *jour*,
l'autre le *socle*. Les deux peuvent coexister sans se chevaucher (§4).

## 1. Décisions de cadrage — ✅ TRANCHÉES par Florian le 04/08/2026

| # | Question | Recommandation | Pourquoi |
|---|---|---|---|
| **D1** | Fenêtre de mesure de la fréquence ? | **14 jours glissants** (catalogue propose 7-14 j) | Une semaine isolée (taper, blessure, vacances) ne doit pas déclencher une suggestion de changement de socle — 14 j lisse un creux/pic ponctuel sans attendre des mois |
| **D2** | Suggestion dans les deux sens (hausse **et** baisse) ? | **Oui** | Un niveau déclaré trop haut surestime autant le TDEE qu'un niveau trop bas le sous-estime (ex. « très actif » choisi il y a 1 an, plus aucune course depuis un mois) — symétrique, comme les autres analyses de la famille (MUSC-08 alerte dans les deux sens) |
| **D3** | Visible même si `manualCalories` (surcharge manuelle) est actif ? | **Oui, sans condition** | La suggestion porte sur le **profil déclaré** (`activity_level`), pas sur l'objectif effectif du jour — reste une information valide même si l'utilisateur pilote ses calories manuellement pour l'instant. Il peut vouloir le savoir avant de repasser en automatique |
| **D4** | Peut-on suggérer *Extrêmement actif* ? | **Non — plafond à *Très actif*** | [alimentation.md §2.2](../alimentation.md) ne donne **aucun seuil en jours** pour ce palier (contrairement aux 4 autres) — l'inventer serait un chiffre non sourcé. 6-7 j de course/semaine plafonne la suggestion, quel que soit le volume au-delà |
| **D5** | Action directe (bouton « Appliquer ») ou texte seul ? | **Texte seul**, renvoi vers l'écran profil nutrition existant | Même patron que toutes les suggestions déjà livrées (MUSC-F7 § « la suggestion reste une proposition : rien ne pré-remplit ») — aucune US du projet n'auto-applique une suggestion, RN-03 ne serait pas la première |

## 2. Surfaçage (ADR-007, obligatoire pour toute US d'analyse)

**Tier 2 — Insight contextuel, conditionnel.** Widget dashboard, rendu `null` hors mismatch — même
patron que `TrainingLoadAlertCard`/`DeficitVolumeAlertCard`. **Pas** Tier 1 (section dans
Nutrition → Stats) : cet écran porte déjà l'avertissement ADR-007 sur la saturation (MN-02/MN-03/
MN-06) — y ajouter une section **permanente** de plus contredirait la mise en garde déjà actée.
Un insight qui ne parle que lorsqu'il y a un vrai écart reste dans le budget Tier 2.

**Condition d'affichage** : `running` **et** `nutrition` actifs (les deux nécessaires — la
fréquence vient de l'un, le niveau déclaré de l'autre) **et** niveau suggéré ≠ niveau déclaré.

## 3. Ce qui existe déjà et qu'on réutilise

| Brique | Où | Usage ici |
|---|---|---|
| `ACTIVITY_LEVELS`, `activityFactor`, `tdee` | `packages/shared/src/nutrition.ts` (§2.2) | Le niveau déclaré à comparer ; **non modifiées** |
| `nutrition_profiles.activity_level` | table existante | Lu seul, jamais écrit par cette US (D5) |
| `useRunHistory()` | `dashboard-repository.ts` | Séances de course, déjà chargées ailleurs sur le dashboard |
| `useNutritionProfile()` | `nutrition-repository.ts` | Niveau d'activité déclaré actuel |
| `localDayKey` | `date.ts` | Regroupement des courses par jour civil local |
| `nutrition.activity.options.*` (i18n) | `fr.json`/`en.json`, écran `nutrition-profile.tsx` | Libellés des 5 niveaux — **réutilisés tels quels**, pas de nouvelle traduction pour les noms de palier |
| Patron « suggestion, jamais imposée » | MUSC-F7 (deload), MUSC-08 (stagnation) | Aucune action automatique, aucun bouton d'application (D5) |

**Aucune donnée nouvelle, aucune migration.**

## 4. Les règles

**R1 — Fréquence de course = nombre de jours civils distincts avec ≥ 1 course terminée sur les
14 derniers jours calendaires (D1).** Une course sans `finishedAt` ne compte pas. Deux courses le
même jour comptent pour un seul jour (même discipline que TRI-12 R1 : jour à charge, pas nombre de
séances).

**R2 — Le compte de jours est converti en moyenne hebdomadaire** (`joursDistincts / 2`, fenêtre de
14 j = 2 semaines), puis mappé au palier `ACTIVITY_LEVELS` dont la borne correspond, en reprenant
**telles quelles** les fourchettes de [alimentation.md §2.2](../alimentation.md) :

| Moyenne j/sem | Palier suggéré |
|---|---|
| 0 | `sedentary` |
| ]0 ; 2] | `light` |
| ]2 ; 5] | `moderate` |
| ]5 ; 7] | `active` |
| — | jamais `very_active` (D4) |

**R3 — Suggestion émise seulement si le palier obtenu (R2) diffère du palier déclaré
(`nutrition_profiles.activity_level`).** Identiques → rien à afficher (widget masqué, pas un état
neutre affiché).

**R4 — Bidirectionnelle (D2).** Aucune distinction de traitement entre une suggestion à la hausse
et à la baisse — seul le libellé du message change (§6).

**R5 — Aucune écriture.** Cette US ne modifie jamais `nutrition_profiles.activity_level` ; elle
affiche un texte renvoyant vers l'écran existant de modification du profil nutritionnel (D5).

**R6 — Indépendante de `manualCalories` (D3).** La condition d'affichage ne regarde jamais
`nutrition_profiles.manual_calories` : la suggestion reste visible même en surcharge manuelle.

**R7 — Ton factuel, aucune alarme.** Même exigence que TRI-12/META-19 : un simple constat chiffré
(« tu as couru X j/2 sem, plus proche de Y que de Z »), jamais un jugement de valeur sur les
habitudes de l'utilisateur.

## 5. Périmètre

**Dans le périmètre :**
1. Fonction pure de suggestion (packages/shared, §7 du plan).
2. Widget dashboard conditionnel (Tier 2), 3 formes, gating `['running', 'nutrition']`.
3. i18n FR + EN (réutilise les libellés de palier existants, nouveau texte de suggestion).

**Hors périmètre, explicitement :**
- Bouton d'application directe (D5) — texte + renvoi vers l'écran existant seulement.
- Prise en compte du volume **muscu** dans la fréquence (catalogue scope RN-03 à la course seule,
  distinct d'une éventuelle US tri-pilier future qui pondérerait aussi la muscu).
- Suggestion du palier `very_active` (D4).
- Historique/courbe de la fréquence dans le temps — un insight du jour, pas une analyse de
  tendance (ce serait un candidat distinct du catalogue).
- Toute modification de `dayCalorieBonus`/`trainingBonusMode` (RN-02) — **aucun changement** à ce
  mécanisme, les deux US restent indépendantes (§0).

## 6. i18n (FR + EN)

Nouvelle famille `home.activityLevelSuggestion.*` :
- `eyebrow` — « Suggestion nutrition » / « Nutrition suggestion ».
- `title` — « Niveau d'activité à réviser ? » / « Activity level worth revisiting? ».
- `message` (interpolée) — « Tu as couru {{days}} j sur les 2 dernières semaines — plus proche de
  « {{suggested}} » que de ton niveau actuel « {{current}} ». » / équivalent EN. `{{suggested}}` et
  `{{current}}` interpolent les libellés **existants** `nutrition.activity.options.*` (aucune
  nouvelle chaîne pour les noms de palier).
- `hint` — « Modifiable dans ton profil nutrition. » / « Editable in your nutrition profile. ».

## 7. Comportement offline

**Total.** Lecture PowerSync locale (`runs`, `nutrition_profiles`, déjà synchronisées), calcul pur.
Aucun réseau, aucune écriture.

## 8. Accessibilité

Bloc `accessible` unique par forme de widget (titre + message + indication du renvoi vers le
profil), même patron que les autres cartes Tier 2 du dashboard.

## 9. Cas limites

| Situation | Comportement attendu |
|---|---|
| Palier suggéré = palier déclaré | Widget masqué (R3), pas un état "à jour" affiché |
| `running` ou `nutrition` inactif | Widget masqué (gating, §2) |
| Aucune course sur 14 j, niveau déclaré déjà `sedentary` | Rien à suggérer (R3) — pas de fausse alerte sur un simple repos |
| Aucune course sur 14 j, niveau déclaré `active` | Suggestion à la baisse vers `sedentary` (R4/D2) |
| 7 courses/2 semaines mais niveau déjà `active` | Rien à suggérer — plafond `active` atteint, pas de saut vers `very_active` (D4) |
| `manualCalories` actif | Suggestion visible quand même (R6/D3) |
| Compte neuf, aucun historique de course | Widget masqué (0 jour = `sedentary` ; si le profil est déjà à `sedentary` par défaut, R3 le masque) |
| Mode avion | Fonctionne normalement (lecture locale seule) |

## 10. Definition of Done

- [x] D1 → D5 arbitrés par Florian le 04/08/2026.
- [x] Fonction de suggestion pure et testée dans `packages/shared` (10 tests : les 5 bandes R2, le
      plafond `very_active` D4, le cas "suggestion = déclaré → null" R3, bidirectionnel D2).
- [x] Widget conditionnel Tier 2, gating `['running', 'nutrition']`, 3 formes + smoke test.
- [x] i18n FR + EN, réutilisation des libellés de palier existants, zéro chaîne en dur nouvelle
      pour les noms de palier.
- [x] `npm run lint`, `npm run typecheck`, `npm run test` verts (1463 tests shared + 655 tests
      mobile, 04/08/2026).
- [x] Aucune ligne roadmap à toucher (US d'analyse, catalogue seul).
- [x] `isWidgetActive` (`apps/mobile/src/app/(tabs)/index.tsx`) mis à jour — trouvé en revue de
      code : sans cette déclaration, `WidgetGrid` réserve une cellule vide dès que le widget rend
      `null` (même défaut déjà corrigé pour `training-load`/`overtraining-guard`). A aussi révélé
      et corrigé le même trou, oublié, pour `readiness` (US TRI-03).
- [ ] Recette device (Florian ou Damien) — critères §11.

## 11. Critères d'acceptation (recette device)

1. Profil `sedentary`, ≥ 6 courses distinctes sur 14 j → suggestion vers un palier supérieur,
   message cohérent avec le nombre de jours réellement couru.
2. Profil `active`, 0 course sur 14 j → suggestion à la baisse.
3. Fréquence de course correspondant déjà au palier déclaré → aucun widget.
4. Nutrition désactivée → aucun widget, quelle que soit la fréquence de course.
5. `manualCalories` actif → le widget reste visible si l'écart existe (D3/R6).
6. Aucune suggestion vers `very_active`, même à 7+ courses/semaine sur toute la fenêtre.
7. Mode avion : fonctionne normalement.
8. En EN : message grammatical, libellés de palier cohérents avec l'écran profil nutrition.
9. TalkBack énonce le widget comme un bloc cohérent.
