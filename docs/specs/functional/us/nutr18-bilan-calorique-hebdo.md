---
id: NUTR-18
titre: "Bilan calorique hebdomadaire"
roadmap: []
catalogue: [NUTR-18]
etape: recette
branche: feature/nutr18-bilan-calorique-hebdo
maj: 04/08/2026
---

# US NUTR-18 — Bilan calorique hebdomadaire

> **Spec fonctionnelle — ✅ validée par Florian le 04/08/2026** (spec + plan + maquette, décision
> D1 arbitrée conformément à la recommandation — suit le sélecteur 7j/30j existant). **Code livré
> (TDD) le 04/08/2026** — reste la recette device (§11).
>
> **US d'analyse — aucune ligne roadmap.** Comme [MUSC-20](musc20-regularite-entrainement.md)/
> [MUSC-19](musc19-tonnage-cumule.md), cette US vit **uniquement** dans le
> [catalogue d'analyses](../../product/analyses-donnees.md).
>
> **Pas de nouvelle carte sur l'écran Stats nutrition.** [ADR-007](../../adr/ADR-007-surfacage-analyses.md)
> avait explicitement anticipé ce moment : « Nutrition → Stats porte déjà poids + apports moyens +
> MN-03 + MN-06 → prévoir le regroupement/repli **à la prochaine analyse qui s'y ajoute**. »
> `nutrition-stats.tsx` compte aujourd'hui **8 blocs** (poids, objectif de poids, apports moyens,
> répartition par repas, adhérence NUTR-10, régularité NUTR-17, protéines/kg, croisement muscu),
> largement au-delà du seuil de repli (~4-5). Cette US applique le **regroupement** plutôt que le
> repli : NUTR-18 est ajoutée à la carte **Adhérence (NUTR-10)** déjà existante, qui répond déjà à
> « suis-je dans ma cible ? » — pas une 9ᵉ carte.

## 0. Ce que ça ajoute à la carte Adhérence existante

La carte Adhérence (NUTR-10) affiche déjà un **pourcentage** de jours dans la cible (± marge). Ce
qu'elle ne dit pas : **de combien** au total, dans quel sens. NUTR-18 ajoute deux chiffres à la même
carte, sur la même fenêtre (7/30 j, même sélecteur déjà en place) :
- Le **bilan cumulé** (Σ apports − Σ objectifs effectifs des jours loggés), signé.
- Le **décompte** jours au-dessus / en dessous de l'objectif effectif (distinct de « dans la
  marge » — un compte binaire, pas une bande de tolérance).

## 1. Décision de cadrage — ✅ TRANCHÉE par Florian le 04/08/2026

| # | Question | Recommandation | Pourquoi |
|---|---|---|---|
| **D1** | Fenêtre fixe 7 j (catalogue : « semaine glissante ») ou suit le sélecteur 7/30 j déjà en place sur la carte ? | **Suit le sélecteur existant** | Une carte affichant deux fenêtres différentes en même temps (7 j pour le bilan, 7/30 j pour le reste) serait confuse. Réutilise le contrôle déjà là (brique réutilisable, ADR-007 §3) plutôt que d'ajouter un 2ᵉ sélecteur pour une seule ligne |

## 2. Surfaçage (ADR-007)

**Regroupement dans une carte Tier 1 existante** (NUTR-10, écran Stats nutrition) — pas de nouvelle
carte, pas de nouveau tier. Répond directement au point de vigilance immédiat déjà noté dans
ADR-007 pour cet écran précis (§0).

## 3. Ce qui existe déjà et qu'on réutilise

| Brique | Où | Usage ici |
|---|---|---|
| `computeGoalAdherence`, `perDay` (kcal + objectif effectif) | `useGoalAdherenceForRange` (`dashboard-repository.ts`) | Le même tableau `perDay`, déjà construit, alimente aussi le nouveau calcul — **aucune requête supplémentaire** |
| Carte Adhérence (NUTR-10) | `nutrition-stats.tsx` | Étendue avec 2 lignes, pas remplacée |
| Sélecteur 7 j/30 j (`intakeRange`) | même écran | Réutilisé tel quel (D1) |

**Aucune donnée nouvelle, aucune migration.**

## 4. Les règles

**R1 — Bilan cumulé = Σ(kcal − objectif effectif) sur les jours loggés avec un objectif valide.**
Même filtre que `computeGoalAdherence` (jours dont `effectiveTarget` est non nul et positif) — pas
de double convention. Signé : positif = surplus cumulé, négatif = déficit cumulé.

**R2 — Jours au-dessus / en dessous = comptage binaire, pas une bande de tolérance.** `kcal >
effectiveTarget` → au-dessus ; `kcal < effectiveTarget` → en dessous ; égalité exacte → ni l'un ni
l'autre (cas limite rare, sans conséquence pratique). Distinct de « dans la cible » (NUTR-10, qui
utilise la marge `adherenceMarginPct`) — les deux chiffres peuvent coexister sans se contredire
(ex. 5 jours « dans la marge » et malgré tout un bilan légèrement négatif).

**R3 — Suit le sélecteur de fenêtre existant (D1).** Recalculé à chaque changement 7 j ↔ 30 j,
aucun état ni sélecteur propre.

**R4 — Indisponible dans les mêmes conditions que NUTR-10.** Pas d'objectif configuré ou aucun
jour loggé → aucune ligne affichée (cohérent avec l'état déjà géré par la carte existante,
`hasTarget`/`loggedDays === 0`).

**R5 — Ton factuel.** Un chiffre signé, jamais un jugement — cohérent avec le reste des US
d'analyse (TRI-12, RN-03, MUSC-20).

## 5. Périmètre

**Dans le périmètre :**
1. `computeCaloricBalance` (packages/shared, `nutrition.ts`).
2. `useGoalAdherenceForRange`/`useGoalAdherence` étendus avec `balanceKcal`, `daysAbove`,
   `daysBelow` (type `GoalAdherence` élargi, purement additif).
3. Carte Adhérence (`nutrition-stats.tsx`) affiche les 2 nouvelles lignes.
4. i18n FR + EN.

**Hors périmètre, explicitement :**
- Toute nouvelle carte ou section sur l'écran Stats nutrition (§0).
- Refactor plus large (sections repliables) de l'écran — signalé, pas traité, même prudence que
  MUSC-20 D4 pour `/progress`.
- Vérification que `useGoalAdherenceForRange` reste correct pour son 2ᵉ consommateur (BILAN-01,
  `weekly-review-repository.ts`) : champs additifs uniquement, aucun champ existant modifié — à
  confirmer par le typecheck, pas de changement de comportement attendu pour ce consommateur.

## 6. i18n (FR + EN)

Deux nouvelles clés sous le namespace `stats.adherence.*` déjà utilisé par cette carte :
- `balance` — « Bilan : {{value}} kcal » / « Balance: {{value}} kcal » (signe déjà inclus dans
  `{{value}}`, ex. « +850 » ou « −1 200 »).
- `aboveBelow` — « {{above}} j au-dessus, {{below}} j en dessous » / « {{above}} d above, {{below}}
  d below ».

## 7. Comportement offline

**Total.** Calcul pur sur `perDay`, déjà construit localement par `useGoalAdherenceForRange`.
Aucun réseau, aucune écriture.

## 8. Accessibilité

Les 2 nouvelles lignes rejoignent le bloc déjà accessible de la carte Adhérence — aucun nouveau
patron nécessaire.

## 9. Cas limites

| Situation | Comportement attendu |
|---|---|
| Bilan exactement nul | Affiché explicitement (« Bilan : 0 kcal »), pas masqué |
| Aucun jour loggé dans la fenêtre | Ligne absente, même état que NUTR-10 aujourd'hui (R4) |
| Objectif non configuré | Ligne absente (R4) |
| Changement de fenêtre 7 j ↔ 30 j | Recalcul immédiat, pas de flash sur l'ancienne valeur |
| Jour à kcal exactement égal à l'objectif | Ne compte ni dans « au-dessus » ni « en dessous » (R2) |
| Mode avion | Fonctionne normalement (lecture locale seule) |

## 10. Definition of Done

- [x] D1 arbitrée par Florian le 04/08/2026.
- [x] `computeCaloricBalance` testée (packages/shared, 5 tests) : surplus, déficit, égalité
      exacte (ni au-dessus ni en dessous), aucun jour avec objectif valide, cas mixte.
- [x] `GoalAdherence` étendu, carte Adhérence affiche les 2 nouvelles lignes, i18n FR + EN.
- [x] `npm run lint`, `npm run typecheck`, `npm run test` verts (658 tests mobile + 1488 shared
      + admin, tous workspaces).
- [x] Aucune ligne roadmap à toucher (US d'analyse, catalogue seul).

## 11. Critères d'acceptation (recette device)

1. La carte Adhérence affiche un bilan cumulé cohérent avec les apports et l'objectif effectif des
   jours loggés de la fenêtre sélectionnée.
2. Le décompte jours au-dessus/en dessous est cohérent avec les jours effectivement au-dessus ou
   en dessous de l'objectif (pas la marge de NUTR-10).
3. Changer 7 j ↔ 30 j recalcule les deux nouvelles lignes sans latence perceptible.
4. Sans objectif configuré : aucune des 2 lignes n'apparaît.
5. Mode avion : fonctionne normalement.
6. En EN : signe et libellés cohérents.
