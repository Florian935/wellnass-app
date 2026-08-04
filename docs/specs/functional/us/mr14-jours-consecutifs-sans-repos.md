---
id: MR-14
titre: "Jours consécutifs sans repos"
roadmap: []
catalogue: [MR-14]
etape: close
branche: feature/mr14-jours-consecutifs-sans-repos
maj: 04/08/2026
---

# US MR-14 — Jours consécutifs sans repos

> ## 🔀 Comportement repris par [GARDE-01](garde01-fusion-garde-fou-charge-repos.md) le 04/08/2026
>
> **Livrée puis fusionnée le même jour, sans recette device propre.** La revue de code a montré que
> son D1 (masquage mutuel) introduisait précisément le mécanisme que
> [TRI-12 §1](tri12-garde-fou-global.md) avait écarté par principe, et que l'union des deux widgets
> valait simplement « muscu+course actifs ∧ streak ≥ 6 j ». Voir
> [GARDE-01 §0](garde01-fusion-garde-fou-charge-repos.md) pour l'algèbre complète.
>
> **Ce qui survit** : sa thèse (« le streak seul mérite une alerte ») **l'emporte** sur R4 de TRI-12
> et devient le **niveau de sévérité `streak`** du garde-fou unifié. Ses trois textes sont conservés
> **mot pour mot**, et son gating à 2 piliers devient celui du widget fusionné.
>
> **Ce qui disparaît** : D1/R3 (masquage mutuel — sans objet, il n'y a plus qu'un widget), son id de
> widget `load-streak-alert`, sa carte et son eyebrow propre.
>
> **Les règles ci-dessous sont conservées comme trace de la décision d'origine.** Critères de
> recette : voir [GARDE-01 §11](garde01-fusion-garde-fou-charge-repos.md) (liste consolidée).
>
> **US d'analyse — aucune ligne roadmap.** Comme [MR-08](mr08-interference-concurrent-training.md)/
> [NUTR-18](nutr18-bilan-calorique-hebdo.md), cette US vit **uniquement** dans le
> [catalogue d'analyses](../../product/analyses-donnees.md).

## 0. Pourquoi ce n'est pas un doublon de TRI-12 (vérifié avant d'écrire une ligne)

**Découverte en préparant cette US** : [TRI-12](tri12-garde-fou-global.md) (déjà livrée, `recette`)
calcule **déjà exactement** ce streak — `useOvertrainingGuardAlert` (`dashboard-repository.ts`)
construit un `Set` de jours à charge sRPE > 0 (muscu ∪ course) et lui applique `computeStreak`,
avec le seuil **6 jours** (`OVERTRAINING_LOAD_STREAK_DAYS`, `training-time.ts`) — déjà commenté
dans le code comme « aligné sur la fourchette catalogue de MR-14 ». Deux vigilances déjà appliquées
cette semaine (MR-10 → absorbée par META-19, MR-23 → absorbée par TRI-03) imposent de trancher
clairement : **absorption ou US distincte ?**

**Verdict : US distincte, pas une absorption** — contrairement à MR-10 (formulation identique) et
MR-23 (même échelle), MR-14 change de **portée**, exactement comme RUN-18 le fait pour l'ACWR
(running seul) face à META-19 (combiné) :
- **TRI-12 exige les 3 piliers** (`strength`+`running`+`nutrition`) et n'alerte que si **les deux
  signaux sont réunis** (streak de charge **ET** déficit calorique persistant, R4 « un seul des
  deux ne suffit jamais »). Un utilisateur muscu+course qui n'a **jamais activé la nutrition**
  ne voit **jamais** ce garde-fou, quel que soit son streak.
- **MR-14 ne regarde que le streak**, gardé par **2 piliers seulement** (`strength`+`running`) —
  elle protège justement la population que TRI-12 ne peut structurellement pas voir, et couvre
  aussi le cas d'un utilisateur aux 3 piliers actifs mais **pas en déficit** (charge sans repos
  sans souci calorique — un vrai risque de blessure/surmenage, indépendant de l'alimentation).

**Conséquence de cadrage (D1 ci-dessous)** : pour éviter un double signal sur le même symptôme
quand les deux widgets pourraient s'afficher en même temps, MR-14 doit-elle se masquer quand
TRI-12 est déjà visible ?

## 1. Décision de cadrage — ✅ TRANCHÉE par Florian le 04/08/2026

| # | Question | Recommandation | Pourquoi |
|---|---|---|---|
| **D1** | MR-14 doit-elle se masquer quand TRI-12 est déjà affiché (les deux peuvent être vrais en même temps chez un utilisateur 3 piliers en déficit) ? | **Oui — MR-14 masquée si TRI-12 est actif** | TRI-12 est le signal le plus complet (streak + déficit combinés) ; afficher les deux en même temps sur le même symptôme (l'absence de repos) serait redondant, pas informatif. MR-14 ne doit combler que le **résidu** : streak seul, sans déficit ou sans nutrition active |

## 2. Surfaçage (ADR-007, obligatoire pour toute US d'analyse)

**Tier 2 — Alerte douce, conditionnelle.** Widget dashboard, rendu `null` hors streak ≥ seuil —
même patron que `OvertrainingGuardCard`/`TrainingLoadAlertCard` (ton `"warn"`, pas `"card"` : un
streak de charge sans repos est un signal de sécurité, pas un simple constat d'arbitrage comme
MR-08). **Pas** de nouvelle section sur un écran déjà stats — Tier 2 dashboard uniquement.

**Condition d'affichage** : `strength` **et** `running` actifs **et** streak de charge ≥ 6 jours
**et** le garde-fou tri-pilier (TRI-12) n'est **pas** déjà affiché (D1).

## 3. Ce qui existe déjà et qu'on réutilise

| Brique | Où | Usage ici |
|---|---|---|
| `OVERTRAINING_LOAD_STREAK_DAYS` (6), `LOAD_STREAK_LOOKBACK_DAYS` (30) | `training-time.ts`/`dashboard-repository.ts` (constantes de module) | Réutilisées **telles quelles** (déjà établies par TRI-12) — pas de nouveau chiffre |
| Calcul du streak de charge (sessions muscu+course → `loadByDay` → `chargeDays` → `computeStreak`) | `useOvertrainingGuardAlert` | **Dupliqué**, pas extrait — même convention que ce fichier applique déjà à chaque hook Tier 2 (`useTrainingLoadAlert`, `useConcurrentTrainingInterference` MR-08 dupliquent chacun leur propre filtrage par fenêtre plutôt que de partager un helper générique). Éviter de toucher `useOvertrainingGuardAlert` (US TRI-12, déjà à `etape: recette`, en attente de test device) pour une US sans rapport — voir §5 |
| `computeStreak`, `sessionLoad` | `streak.ts`/`training-time.ts` | Non modifiées |
| `useOvertrainingGuardAlert().show` | `dashboard-repository.ts` | Lu par MR-14 pour la condition D1 (masquage mutuel) |
| Patron widget conditionnel Tier 2, ton `"warn"` | `OvertrainingGuardCard.tsx` | Structure et style de carte repris à l'identique |

**Aucune donnée nouvelle, aucune migration.**

## 4. Les règles

**R1 — Streak = plus longue série de jours consécutifs (jusqu'à aujourd'hui) avec charge sRPE
combinée (muscu ∪ course) strictement positive.** Même définition que le composant streak de
TRI-12 (R2 de cette US-là) — pas une nouvelle convention.

**R2 — Alerte si le streak ≥ 6 jours** (`OVERTRAINING_LOAD_STREAK_DAYS`, seuil déjà établi par
TRI-12, catalogue MR-14 lui-même proposait « 6-7 j » — pas de nouveau chiffre à trancher).

**R3 — Masquée si TRI-12 (`useOvertrainingGuardAlert`) est déjà actif (D1).** Évite le double
signal — voir §0.

**R4 — Indépendante de la nutrition.** Aucune lecture de `food_entries`/objectif calorique — le
streak seul suffit, contrairement à TRI-12.

**R5 — Ton d'alerte douce, jamais culpabilisant.** Un constat + une suggestion de repos, même
registre que `TrainingLoadAlertCard`/`OvertrainingGuardCard` — jamais un jugement sur l'intensité
choisie par l'utilisateur.

## 5. Périmètre

**Dans le périmètre :**
1. `computeLoadStreakAlert` (packages/shared, `training-time.ts`, aux côtés de
   `computeOvertrainingGuard`).
2. Hook `useLoadStreakAlert` (`dashboard-repository.ts`), gating `['strength', 'running']` +
   condition D1 (TRI-12 non actif) — calcul du streak **dupliqué** depuis
   `useOvertrainingGuardAlert`, pas partagé (§3).
3. Widget `LoadStreakAlertCard`, 3 formes, ton `"warn"`, enregistré dans `WIDGET_REGISTRY.home`
   et `dashboard-widgets.tsx`.
4. `isWidgetActive` (`(tabs)/index.tsx`) mis à jour dans ce même incrément.
5. i18n FR + EN.

**Hors périmètre, explicitement :**
- **Toute modification de `useOvertrainingGuardAlert`/TRI-12** — lu (son `.show`) pour la
  condition D1, jamais modifié. US déjà à `etape: recette`, en attente de recette device : aucune
  raison d'en changer le code pour cette US-ci.
- Suggestion d'un jour de repos précis (calendrier) — un constat + recommandation générique
  seulement, même patron que les autres alertes Tier 2.
- Historique/courbe du streak dans le temps — un instantané du jour, pas une tendance.

## 6. i18n (FR + EN)

Nouvelle famille `home.loadStreakAlert.*` :
- `eyebrow` — « Repos & récupération » / « Rest & recovery » (distinct de l'eyebrow de TRI-12,
  « Charge & récupération », pour ne pas confondre les deux cartes si un utilisateur voit les
  deux à des moments différents).
- `title` (interpolée) — « {{days}} jours sans repos » / « {{days}} days without rest ».
- `message` — « Tu t'entraînes (muscu et course confondues) depuis plusieurs jours sans jour de
  repos. » / « You've been training (strength and running combined) for several days without a
  rest day. ».
- `recommend` — « Un jour de repos peut aider ta récupération. » / « A rest day can help your
  recovery. ».

## 7. Comportement offline

**Total.** Lecture PowerSync locale (`workouts`, `runs`, déjà synchronisées), calcul pur. Aucun
réseau, aucune écriture, aucune nouvelle requête SQL.

⚠️ **Nuance relevée en revue de code** : la condition D1 fait appeler `useOvertrainingGuardAlert()`
depuis `useLoadStreakAlert()`, ce qui **instancie une seconde fois** les requêtes surveillées de
TRI-12 (`useDailyTotals`, `useNutritionSummary`…). Aucune requête *nouvelle* n'est écrite, mais le
nombre d'abonnements PowerSync actifs sur l'onglet Accueil augmente. Accepté : les mêmes requêtes
sont déjà surveillées par le widget TRI-12 lui-même, PowerSync déduplique au niveau du cache de
requête, et le coût reste marginal face au bénéfice (D1 testable et centralisée).

## 8. Accessibilité

Bloc `accessible` unique par forme de widget (titre + message + recommandation), même patron que
`OvertrainingGuardCard`/`TrainingLoadAlertCard`.

## 9. Cas limites

| Situation | Comportement attendu |
|---|---|
| Streak < 6 jours | Widget masqué (R2) |
| Streak ≥ 6 jours, TRI-12 déjà actif (3 piliers, en déficit) | Widget masqué (R3/D1) — TRI-12 seul s'affiche |
| Streak ≥ 6 jours, `nutrition` inactive (donc TRI-12 structurellement invisible) | Widget **visible** — la population que TRI-12 ne peut pas voir |
| Streak ≥ 6 jours, 3 piliers actifs mais pas en déficit calorique | Widget **visible** — TRI-12 ne s'affiche pas dans ce cas (R4 de TRI-12) |
| `strength` ou `running` inactif | Widget masqué (gating, §2) |
| Compte neuf, aucun historique | Widget masqué (streak = 0) |
| **Jour de repos en cours** (rien fait aujourd'hui, streak ≥ 6 jusqu'à hier) | ⚠️ **Widget encore visible toute la journée** — `computeStreak` tolère « hier » comme point de départ (`streak.ts`, comportement partagé avec TRI-01/TRI-12). L'alerte recommande donc un repos pendant que l'utilisateur se repose. **Assumé, pas corrigé** : exiger `activeToday` changerait la sémantique du streak pour tout le monde ; et le message reste factuellement vrai (le streak *a bien eu* 6+ jours). Trouvé en revue de code |
| Mode avion | Fonctionne normalement (lecture locale seule) |

## 10. Definition of Done

- [x] D1 arbitrée par Florian le 04/08/2026.
- [x] `computeLoadStreakAlert` testée (packages/shared, 8 tests) : sous le seuil, au seuil exact
      (6, borne incluse), au-dessus, contraste explicite avec TRI-12 sans déficit, **et les 3 cas
      de la règle D1** (masquage, `streakDays` préservé, double raison cumulée).
- [x] **D1 portée par la fonction pure, pas par un post-traitement dans le hook** — corrigé après
      la revue de code : la règle n'avait **aucun test**, inverser la condition laissait les 2169
      tests verts. Validité des nouveaux tests prouvée par mutation (condition inversée → 2 tests
      rouges, restaurée → 38 verts).
- [x] `useOvertrainingGuardAlert`/TRI-12 non modifiée (diff vérifié en revue — lecture de `.show`
      uniquement).
- [x] Hook + widget conditionnel Tier 2, gating `['strength', 'running']` + condition D1, 3
      formes, i18n FR + EN.
- [x] `isWidgetActive` mis à jour dans le même incrément (pas en revue) — vérifié en revue,
      correctement fait, y compris en mode édition (`WidgetGrid` applique `isActive` aux deux).
- [x] `npm run lint`, `npm run typecheck`, `npm run test` verts (667 tests mobile + 1505 shared +
      admin, tous workspaces).
- [x] Aucune ligne roadmap à toucher (US d'analyse, catalogue seul).
- [x] Conséquence de conception relevée en revue (l'union TRI-12 ∪ MR-14 vaut `P∧S`, donc une
      carte s'affiche toujours dès muscu+course actifs et streak ≥ 6 ; swap de carte possible si
      le déficit franchit son seuil) tracée dans IDEAS.md, **puis traitée le jour même** par
      [GARDE-01](garde01-fusion-garde-fou-charge-repos.md) — Florian a demandé de reprendre le
      sujet immédiatement plutôt que d'attendre la recette de TRI-12.

## 11. Critères d'acceptation (recette device) — ⚠️ REMPLACÉS

**Ne pas recetter depuis cette liste** : son critère 2 (masquage mutuel) décrit une règle supprimée,
et les critères 1/3/5 parlent d'un widget qui n'existe plus sous cet id.

👉 **Liste consolidée : [GARDE-01 §11](garde01-fusion-garde-fou-charge-repos.md)** — le critère 6 de
cette nouvelle liste (« le déficit passe sous son seuil → la carte ne bouge pas ») est précisément
celui qui vérifie la correction du défaut introduit ici.
