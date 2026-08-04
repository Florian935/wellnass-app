---
id: MUSC-20
titre: "Régularité & consistance d'entraînement"
roadmap: []
catalogue: [MUSC-20]
etape: recette
branche: feature/musc20-regularite-entrainement
maj: 04/08/2026
---

# US MUSC-20 — Régularité & consistance d'entraînement

> **Spec fonctionnelle — ✅ validée par Florian le 04/08/2026** (spec + plan + maquette, et les 4
> décisions de cadrage §1 arbitrées conformément aux recommandations). **Code livré le 04/08/2026**
> (TDD, `computeIntervalRegularity` + section `/progress` + tests SQL) — reste la recette device
> (§11).
>
> **US d'analyse — aucune ligne roadmap.** Comme [MUSC-19](musc19-tonnage-cumule.md)/
> [MUSC-12](musc12-densite-entrainement.md), cette US vit **uniquement** dans le
> [catalogue d'analyses](../../product/analyses-donnees.md).

## 0. Ce que c'est, et d'où vient « l'objectif »

Une 5ᵉ section sur l'écran Progression (`/progress`) : complément **quantitatif** du streak
(TRI-01, qui ne dit que « combien de jours d'affilée »). Trois signaux :
1. **Séances/semaine réel vs objectif.**
2. **Écart-type des intervalles** entre séances (régularité de l'espacement).
3. **Taux de séances tenues** (adhérence au planning).

**Il n'existe aucun champ « objectif de fréquence » séparé dans l'app** (ni sur `programs`, ni dans
OBJ-01, qui ne couvre que 2 types d'objectif : distance de course et 1RM). Plutôt qu'en inventer un,
**l'« objectif » de cette US est le planning réel de l'utilisateur** : quand un programme est
planifié (`planned_sessions`, générées par `generatePlannedSessions`), le nombre de créneaux
assignés par semaine **est** l'objectif implicite — exactement la même lecture que RUN-19
(« Réalisé vs objectif de séance », où l'objectif est déjà la séance planifiée, pas un système de
buts séparé).

## 1. Décisions de cadrage — ✅ TRANCHÉES par Florian le 04/08/2026

| # | Question | Recommandation | Pourquoi |
|---|---|---|---|
| **D1** | Fenêtre de mesure ? | **4 semaines glissantes (28 j)** | Le catalogue propose « hebdo/mensuel » — 4 semaines lisse une semaine isolée tout en restant assez court pour rester pertinent, et donne assez de points pour l'écart-type (D3) |
| **D2** | Comportement sans planning actif (aucun `planned_sessions` dans la fenêtre) ? | **Dégradation par composante** : « séances/sem vs objectif » et « taux tenues » indisponibles ; « écart-type des intervalles » reste calculable (basé sur les séances **terminées**, pas sur le planning) | Un utilisateur « séance libre » sans programme planifié n'a pas d'objectif à comparer, mais sa régularité réelle reste mesurable — même logique de dégradation que TRI-03 |
| **D3** | Minimum de données pour l'écart-type ? | **≥ 3 séances terminées** dans la fenêtre (2 intervalles) | Même seuil et même formule que CYCLE-01 (`stdDev`, écart-type de population, « insuffisant » sous 3 points) — seuil déjà arbitré et justifié ailleurs, pas un nouveau chiffre inventé |
| **D4** | `/progress` atteint 5 sections avec celle-ci — ADR-007 recommande un repli dès ~4-5 | **Accepté tel quel pour cette US**, pas de mécanisme de repli construit ici | Un vrai refactor (sections repliables) toucherait les 4 sections existantes, pas seulement celle-ci — hors périmètre d'une US d'analyse. Signalé explicitement pour suivi (§4) plutôt que traité en silence |

## 2. Surfaçage (ADR-007)

**Tier 1 — Écran Stats/Progression du pilier**, 5ᵉ section sur `/progress`. ⚠️ **Point de
vigilance explicite (D4)** : ADR-007 recommande de passer en sections repliables dès ~4-5 sections
— ce seuil est atteint avec cette US. Non traité ici ; à reprendre dans une US de refactor dédiée
si la densité de l'écran s'avère gênante en usage réel (même prudence que TRI-12 §1 pour la
coexistence de widgets : signalé, pas résolu par anticipation).

## 3. Ce qui existe déjà et qu'on réutilise

| Brique | Où | Usage ici |
|---|---|---|
| `computeWeekCompletionRate` | `packages/shared/src/workout.ts` (posée par MUSC-F15) | **Réutilisée telle quelle** pour R4 — aucune nouvelle fonction d'adhérence |
| `PlannedStatus` (`'planned' \| 'done' \| 'skipped'`) | `packages/shared/src/planning.ts` | Type déjà en place, filtre des lignes fournies à `computeWeekCompletionRate` |
| Formule d'écart-type (population, seuil 3 points) | `menstrual-cycle.ts` (`stdDev`, privée, CYCLE-01) | Même formule reprise (fonction propre, la fonction source n'est pas exportée) |
| Patron de requête groupée par séance | `useMuscleBalance`/`useLifetimeTonnage` (`records-repository.ts`) | Même discipline SQL (filtres, bornes ISO UTC locales) |
| Écran `/progress`, composant `Card` | `app/progress/index.tsx` | Nouvelle section, même style que les 4 existantes |

**Aucune donnée nouvelle, aucune migration.**

## 4. Les règles

**R1 — Séances/semaine réel = nb de séances muscu terminées dans la fenêtre ÷ (jours fenêtre / 7).**
Toute séance `status = 'completed'` du pilier muscu, planifiée ou libre — la régularité compte
l'activité réelle, pas seulement le planning suivi.

**R2 — Objectif = nb de `planned_sessions` (muscu, tous statuts) dans la fenêtre ÷ (jours fenêtre /
7).** Dérivé du planning déjà généré par l'utilisateur (§0) — indisponible si aucune ligne
`planned_sessions` dans la fenêtre (D2).

**R3 — Écart-type des intervalles = écart-type de population des écarts en jours entre dates de
séances terminées consécutives, sur la fenêtre.** Indisponible sous 3 séances terminées (2
intervalles, D3/formule CYCLE-01).

**R4 — Taux de séances tenues : réutilise `computeWeekCompletionRate` telle quelle** (posée par
MUSC-F15, `packages/shared/src/workout.ts`) sur les `planned_sessions` (muscu) de la fenêtre.
**Constaté pendant le cadrage** : cette fonction compte `done ÷ (done + skipped + planned encore
non traités)` — les séances futures de la fenêtre comptent comme non tenues tant qu'elles n'ont pas
eu lieu (convention déjà actée, alignée sur MR-03 du catalogue). Pas de nouvelle fonction, pas de
nouvelle convention : la même lecture que MUSC-F15 s'applique, seule la fenêtre de sessions
fournies change (28 j glissants tous programmes confondus, au lieu d'une semaine de programme
unique). Indisponible si aucune `planned_sessions` dans la fenêtre (`null`, D2).

**R5 — Dégradation par composante (D2).** Chaque métrique est indépendamment disponible ou
indisponible ; jamais un calcul sur donnée absente, jamais un 0/100 % par défaut qui laisserait
croire à une vraie mesure.

**R6 — Toujours affichée si au moins une métrique est disponible.** Un état vide explicite
(« pas encore assez de données ») seulement si les **trois** métriques sont indisponibles — même
logique que TRI-03 R5, adaptée à un Tier 1 (jamais masquée en silence sur un écran que
l'utilisateur a ouvert délibérément).

**R7 — Ton factuel, aucun jugement.** Un chiffre, jamais une alerte ni une culpabilisation sur un
taux de séances tenues bas — cohérent avec R6/R7 des autres US d'analyse (TRI-12, RN-03).

## 5. Périmètre

**Dans le périmètre :**
1. Fonction pure d'écart-type des intervalles (packages/shared, `workout.ts`).
2. Hook agrégeant les 3 métriques (mobile, `planned-session-repository.ts` — même fichier que
   `usePriorWeekAdherence`, qui consomme déjà `computeWeekCompletionRate`).
3. Nouvelle section sur `/progress`.
4. i18n FR + EN.

**Aucune nouvelle fonction d'adhérence** : R4 réutilise `computeWeekCompletionRate` (MUSC-F15),
déjà testée.

**Hors périmètre, explicitement :**
- Nouveau système d'objectif de fréquence (§0) — réutilise le planning existant.
- Mécanisme de repli/sections repliables sur `/progress` (D4).
- Toute action automatique (rappel, notification) déclenchée par un taux bas (R7).

## 6. i18n (FR + EN)

Nouvelle famille `progress.regularity.*` :
- `title` — « Régularité » / « Consistency ».
- `perWeek` — « Séances/semaine » / « Sessions/week ».
- `target` — « Objectif : {{value}}/sem » / « Target: {{value}}/wk ».
- `intervalStdDev` — « Régularité des intervalles » / « Interval regularity » (+ sous-libellé
  « ± {{value}} j » / « ± {{value}} d »).
- `adherenceRate` — « Séances tenues » / « Sessions kept » (affiché en %).
- `unavailable` — « Pas assez de données » / « Not enough data », réutilisable par métrique.
- `emptyTitle`/`emptyMessage` — état vide si les 3 métriques sont indisponibles (R6).

## 7. Comportement offline

**Total.** Lecture PowerSync locale (`workouts`, `planned_sessions`, déjà synchronisées),
agrégation pure. Aucun réseau, aucune écriture.

## 8. Accessibilité

Bloc `accessible` unique pour la section (les 3 métriques + leurs états d'indisponibilité), même
patron que les autres sections de l'écran Progression (MUSC-19, MUSC-05).

## 9. Cas limites

| Situation | Comportement attendu |
|---|---|
| Aucun planning actif, séances libres régulières | Écart-type calculable ; séances/sem-objectif et taux tenues indisponibles (D2) |
| Compte neuf, aucune séance | Les 3 métriques indisponibles → état vide explicite (R6) |
| 2 séances terminées seulement dans la fenêtre | Écart-type indisponible (D3, < 3 séances) ; séances/sem reste calculable si au moins 1 |
| Toutes les séances planifiées de la fenêtre sont encore à venir | Taux de séances tenues indisponible (dénominateur nul, aucune séance encore due) — pas 0 % |
| Séance supprimée après avoir compté | Recalcul au prochain rendu (soft delete déjà filtré, comme partout) |
| Mode avion | Fonctionne normalement (lecture locale seule) |

## 10. Definition of Done

- [x] D1 → D4 arbitrés par Florian le 04/08/2026.
- [x] Fonction d'écart-type testée (packages/shared, 4 tests) : < 3 séances → indisponible, cas
      nominal, séances parfaitement régulières → écart-type 0.
- [x] `computeWeekCompletionRate` (déjà testée par MUSC-F15) appliquée correctement à la fenêtre
      28 j — pas de nouvelle fonction. **Bug trouvé en revue de code** : la requête
      `planned_sessions` n'avait pas de borne haute sur `scheduled_date` (perdue entre le plan et
      le code), remontant tout le futur généré du programme au lieu des 28 j — corrigé, et couvert
      par un test SQL direct (`planned-session-sql.test.ts`) qui aurait attrapé le bug.
- [x] Nouvelle section sur `/progress`, i18n FR + EN, zéro chaîne en dur.
- [x] `npm run lint`, `npm run typecheck`, `npm run test` verts (1483 tests shared + 658 tests
      mobile, 04/08/2026).
- [x] Aucune ligne roadmap à toucher (US d'analyse, catalogue seul).
- [ ] Recette device (Florian ou Damien) — critères §11.

## 11. Critères d'acceptation (recette device)

1. Un utilisateur avec un programme planifié voit ses 3 métriques cohérentes avec son historique
   réel des 4 dernières semaines.
2. Un utilisateur « séance libre » sans planning voit uniquement l'écart-type des intervalles,
   les deux autres métriques marquées indisponibles — jamais un chiffre inventé.
3. Compte neuf : état vide explicite, pas une section absente ni un calcul sur zéro donnée.
4. Un taux de séances tenues bas ne déclenche aucune alerte, aucun ton négatif.
5. Mode avion : fonctionne normalement.
6. En EN : libellés et pourcentages cohérents.
7. TalkBack énonce la section comme un bloc cohérent.
