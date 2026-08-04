---
id: MUSC-12
titre: "Densité d'entraînement (volume/temps)"
roadmap: []
catalogue: [MUSC-12]
etape: recette
branche: feature/musc12-densite-entrainement
maj: 04/08/2026
---

# US MUSC-12 — Densité d'entraînement (volume/temps)

> **Spec fonctionnelle — ✅ validée par Florian le 04/08/2026** (spec + plan + maquette, décision
> D1 arbitrée conformément à la recommandation — périmètre v1 limité à la stat par séance).
> **Code livré le 04/08/2026** (TDD, `computeTrainingDensity` + `Row` sur `workout-summary.tsx`) —
> reste la recette device (§10).
>
> **US d'analyse — aucune ligne roadmap.** Comme [MUSC-19](musc19-tonnage-cumule.md)/
> [MN-04](mn04-glucides-peri-seance.md), cette US vit **uniquement** dans le
> [catalogue d'analyses](../../product/analyses-donnees.md).
>
> **Pas de nouveau widget, pas d'écran nouveau.** Une ligne ajoutée au résumé de fin de séance
> existant (`workout-summary.tsx`), qui calcule déjà volume **et** durée séparément sans jamais
> afficher leur rapport.

## 0. Le trou

[workout-summary.tsx](../../../../apps/mobile/src/app/workout-summary.tsx) calcule `volume`
(`computeVolume`, kg·reps) et `durationMin` pour chaque séance terminée, et les affiche l'un sous
l'autre (`Row` « Volume », `Row` « Durée »). Leur **rapport** — la densité, kg soulevés par minute
d'effort — n'est jamais calculé ni montré, alors que c'est un signal réel : deux séances au même
volume mais l'une deux fois plus longue ne représentent pas la même capacité de travail.

## 1. Décision de cadrage — ✅ TRANCHÉE par Florian le 04/08/2026

| # | Question | Recommandation | Pourquoi |
|---|---|---|---|
| **D1** | Périmètre v1 : stat **par séance** seule, ou aussi une **tendance** historique (catalogue mentionne les deux) ? | **Par séance seulement en v1** — la tendance reste un candidat distinct, non cadré ici | La tendance demanderait une nouvelle requête groupée par séance sur tout l'historique + un nouveau graphique sur `/progress` (proche en effort de MUSC-04) — un vrai second morceau, pas un détail. La stat par séance seule est déjà la correction du trou identifié en §0, immédiatement utile, et n'empêche pas d'ajouter la tendance plus tard sans rien casser (la fonction de calcul serait réutilisée telle quelle) |

## 2. Ce qui existe déjà et qu'on réutilise

| Brique | Où | Usage ici |
|---|---|---|
| `computeVolume`, `durationMin` | `workout-summary.tsx`, fonction `buildSummary` | Les deux entrées du calcul, déjà produites — **non modifiées** |
| `units.formatWeight()` | `useUnits()`, déjà utilisé pour la ligne Volume de cet écran | Réutilisé pour la densité (kg/lb selon préférence), suffixé `/min` |
| Composant `Row` | même écran | Nouvelle ligne, même style que Volume/Durée/Exercices |

**Aucune donnée nouvelle, aucune migration.**

## 3. Les règles

**R1 — Densité = volume ÷ durée effective (minutes), arrondie à 1 décimale.** Reprend exactement
la formule du catalogue (« kg·reps/min », traité comme une grandeur « poids » au même titre que le
volume lui-même — même convention déjà appliquée à `volume` partout ailleurs dans l'app, jamais
littéralement en kg·reps mais affiché comme un poids).

**R2 — Aucune division par zéro.** `durationMin` est déjà planchée à 1 par `buildSummary`
(`Math.max(1, ...)`, comportement préexistant, non modifié) — la densité hérite donc de cette
protection sans rien ajouter.

**R3 — Toujours affichée, jamais une section conditionnelle.** Contrairement aux garde-fous
(TRI-12, META-19), la densité est un simple complément descriptif du résumé existant : elle
s'affiche pour **toute** séance terminée, y compris un volume nul (densité 0) — cohérent avec
Volume/Durée déjà toujours affichés.

**R4 — Hors périmètre : partage.** La carte de séance partageable (PARTAGE-01, `ShareCardSheet`,
déjà présente sur cet écran) **n'est pas modifiée** — ajouter la densité à ce qui est partagé est
une décision distincte, qui appartient à PARTAGE-01, pas à cette US.

## 4. Périmètre

**Dans le périmètre :**
1. `computeTrainingDensity` (packages/shared, `workout.ts`).
2. Nouvelle `Row` « Densité » dans `workout-summary.tsx`, juste après Volume.
3. i18n FR + EN.

**Hors périmètre, explicitement :**
- Tendance historique / graphique (D1).
- Densité par groupe musculaire ou par exercice — un total de **séance**, pas une ventilation.
- Carte de séance partageable (R4).

## 5. i18n (FR + EN)

Une clé sous le namespace `workout.summary.*` déjà utilisé par cet écran :
- `density` — « Densité » / « Density ».

Pas de nouvelle chaîne de valeur : affichage `${units.formatWeight(density)}/min`, réutilise le
formatage déjà en place (aucun texte à traduire pour l'unité elle-même).

## 6. Comportement offline

**Total.** Calcul pur en aval de données déjà chargées localement (mêmes séries que Volume/Durée,
déjà lues par `buildSummary`). Aucun réseau, aucune écriture.

## 7. Accessibilité

La nouvelle `Row` suit le même patron que les lignes existantes (`Row` gère déjà son propre label +
valeur comme un bloc lisible) — aucun changement de patron d'accessibilité nécessaire.

## 8. Cas limites

| Situation | Comportement attendu |
|---|---|
| Volume nul (séance sans série validée) | Densité `0`, affichée explicitement (R3) |
| Séance très courte (< 1 min) | `durationMin` déjà planché à 1 par le code existant — densité = volume tel quel, pas d'erreur (R2) |
| Séance très longue à faible volume (ex. beaucoup de repos) | Densité faible, chiffre honnête — aucun seuil d'alerte, aucun jugement (juste un nombre, R3) |
| Mode avion | Fonctionne normalement (lecture locale seule) |

## 9. Definition of Done

- [x] D1 arbitrée par Florian le 04/08/2026.
- [x] `computeTrainingDensity` testée (packages/shared) : cas nominal, volume nul, durée nulle,
      arrondi non entier (4 tests).
- [x] Nouvelle `Row` sur `workout-summary.tsx`, i18n FR + EN, zéro chaîne en dur.
- [x] `npm run lint`, `npm run typecheck`, `npm run test` verts (1479 tests shared + 655 tests
      mobile, 04/08/2026).
- [x] Aucune ligne roadmap à toucher (US d'analyse, catalogue seul).
- [ ] Recette device (Florian ou Damien) — critères §10.

## 10. Critères d'acceptation (recette device)

1. Après une séance terminée, le résumé affiche une ligne Densité cohérente avec Volume ÷ Durée
   affichés juste au-dessus.
2. Une séance sans série validée affiche une densité de 0, pas une ligne absente.
3. La densité respecte la préférence d'unité (kg/lb) comme le reste de l'écran.
4. Mode avion : fonctionne normalement.
5. En EN : libellé et formatage cohérents.
