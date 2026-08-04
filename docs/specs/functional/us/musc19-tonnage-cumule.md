---
id: MUSC-19
titre: "Tonnage cumulé (lifetime/annuel)"
roadmap: []
catalogue: [MUSC-19]
etape: recette
branche: feature/musc19-tonnage-cumule
maj: 04/08/2026
---

# US MUSC-19 — Tonnage cumulé (lifetime/annuel)

> **Spec fonctionnelle — ✅ validée par Florian le 04/08/2026** (spec + plan + maquette, et les 4
> décisions de cadrage §1 arbitrées conformément aux recommandations). **Code livré le 04/08/2026**
> (TDD, `localStartOfYear` + `hasReachedTonnageMilestone` + section `/progress`) — reste la recette
> device (§11).
>
> **US d'analyse — aucune ligne roadmap.** Comme [TRI-12](tri12-garde-fou-global.md)/
> [RN-03](rn03-tdee-ajuste-course.md)/[MN-04](mn04-glucides-peri-seance.md), cette US vit
> **uniquement** dans le [catalogue d'analyses](../../product/analyses-donnees.md).

## 0. Ce que c'est, et ce que ce n'est pas

Une nouvelle section sur l'écran **Progression** (`/progress`, muscu) : le total de kilos soulevés
**à vie** et **cette année**, plus un jalon symbolique au franchissement de **1 000 000 kg**. Pur
calcul rétrospectif sur des données déjà en base (`workout_sets`) — aucune collecte nouvelle.

**Distincte de l'idée « Il y a 1 an » / souvenirs** (différée le 13/07/2026, `IDEAS.md`) : cette
dernière a besoin d'**un an d'historique** pour avoir quelque chose à raconter — aucun utilisateur
n'en aura au lancement, d'où son report. Le tonnage cumulé n'a **aucune** dépendance temporelle de
ce type : un utilisateur qui soulève lourd peut franchir 1 000 000 kg en quelques mois. Les deux
partagent la même famille catalogue (« souvenirs », rétention) mais pas la même contrainte.

## 1. Décisions de cadrage — ✅ TRANCHÉES par Florian le 04/08/2026

| # | Question | Recommandation | Pourquoi |
|---|---|---|---|
| **D1** | « Cette année » = année civile ou 365 j glissants ? | **Année civile** (1er janvier local → aujourd'hui) | Plus simple à expliquer (« cette année » se lit naturellement comme l'année civile, comme un récap annuel) ; aucune fenêtre glissante n'est mentionnée par le catalogue pour ce volet, contrairement aux analyses « 7/14/30 j » habituelles |
| **D2** | Emplacement ? | **Tier 1 — nouvelle section sur `/progress`**, pas un widget dashboard (Tier 0) | Ce n'est pas un signal actionnable du jour (contrairement à TRI-03/RN-03) : une stat de fond, consultée occasionnellement. Le dashboard est plafonné (ADR-007, ~4-6 widgets) — y ajouter un 4ᵉ nombre statique ne serait pas justifié face à ce plafond. `/progress` porte déjà 3 sections (volume 7j, équilibre 14j, par exercice) ; une 4ᵉ reste sous le seuil de repli ADR-007 (~4-5) |
| **D3** | Un seul jalon (1 000 000 kg) ou une échelle de paliers (100k/500k/1M/5M…) ? | **Un seul jalon**, celui du catalogue | Une échelle progressive s'approche d'une mécanique de progression/récompense (arbitrage C, gamification hors V1) ; le catalogue ne sourcé qu'un seul chiffre — en inventer d'autres serait une extension non demandée |
| **D4** | Notification/célébration au franchissement, ou badge silencieux ? | **Badge silencieux**, visible seulement sur l'écran Progression | Une notification exigerait de détecter et mémoriser le *premier* franchissement (nouvel état à stocker, risque de doublon/rejeu) — hors périmètre pour un simple badge de statut. Cohérent avec le reste des US d'analyse (affichage informatif seul, R3) |

## 2. Surfaçage (ADR-007)

**Tier 1 — Écran Stats/Progression du pilier**, section supplémentaire sur `/progress` (D2).
Toujours visible (pas de condition d'affichage — même si le total est 0, un état vide explicite
s'affiche, jamais une section absente qui laisserait croire à un bug).

## 3. Ce qui existe déjà et qu'on réutilise

| Brique | Où | Usage ici |
|---|---|---|
| Patron `SUM(s.reps * s.weight_kg)` en SQL | `useMuscleBalance` (`records-repository.ts`), même filtre séries validées non-échauffement | Repris à l'identique, sans le `GROUP BY muscle_primary` ni la fenêtre 14 j |
| `localMidnightDaysAgo` | `date.ts` | Patron de référence pour la nouvelle fonction de borne (§4) |
| Écran `/progress`, composant `Card` | `app/progress/index.tsx` | Nouvelle section, même style que les 3 existantes |
| `units.formatWeight()` | `useUnits()` (déjà utilisé par `WeeklyVolumeSection`, même écran) | Conversion kg/lb + locale + décimales en un seul appel — pas de `toLocaleString()` manuel |

**Aucune donnée nouvelle, aucune migration.**

## 4. Les règles

**R1 — Même filtre que MUSC-05/MUSC-01.** Séries `done = 1`, `set_type <> 'warmup'`, `reps` et
`weight_kg` non nuls, séances `status = 'completed'`. Aucun nouveau critère inventé — le tonnage
« à vie » est la somme de tout ce que ces filtres retiennent, sans borne de date basse.

**R2 — « Cette année » = année civile locale (D1).** Borne basse : minuit local du 1er janvier de
l'année en cours, convertie en ISO UTC pour le paramètre SQL (même discipline que
`localMidnightDaysAgo` — jamais de comparaison `date()` SQL sur de l'UTC).

**R3 — Jalon = `lifetimeKg >= 1 000 000` (D3), badge silencieux (D4).** Aucune notification, aucune
animation, aucun état « déjà vu / pas encore vu » à mémoriser — le badge est simplement présent ou
absent selon le total courant, recalculé à chaque affichage.

**R4 — Aucun jour sans donnée n'affiche un total inventé.** Zéro séance jamais terminée → `0 kg`
affiché explicitement (pas de section masquée, pas de tiret) — cohérent avec le principe « jamais
un trou visuel » déjà appliqué ailleurs (dashboard, streak).

## 5. Périmètre

**Dans le périmètre :**
1. `localStartOfYear` (packages/shared, `date.ts`) — borne basse de l'année civile.
2. `TONNAGE_MILESTONE_KG`, `hasReachedTonnageMilestone` (packages/shared, `workout.ts`).
3. Hook `useLifetimeTonnage()` (mobile, `records-repository.ts`) — requête SQL agrégée.
4. Nouvelle section sur `/progress` : 2 nombres (à vie, cette année) + badge conditionnel.
5. i18n FR + EN.

**Hors périmètre, explicitement :**
- Échelle de jalons multiples (D3).
- Notification/célébration (D4).
- Tonnage par groupe musculaire ou par exercice (déjà couvert par MUSC-05/écran par exercice,
  fenêtres différentes) — cette US est un total **global**, toutes séances confondues.
- L'idée « Il y a 1 an » / souvenirs (§0) — différée, dépendance différente, pas cette US.

## 6. i18n (FR + EN)

Nouvelle famille `progress.lifetimeTonnage.*` :
- `title` — « Tonnage cumulé » / « Total tonnage ».
- `lifetime` — « À vie » / « Lifetime ».
- `thisYear` — « Cette année » / « This year ».
- `milestone` — « 🏆 Plus de {{weight}} soulevés au total ! » / « 🏆 Over {{weight}} lifted in
  total! » — **un seul placeholder pré-formaté**, jamais « kg » codé en dur ni un nombre brut : `{{weight}}`
  reçoit `units.formatWeight(TONNAGE_MILESTONE_KG)` (le **seuil fixe**, pas le total courant qui
  grandit — corrigé en revue : afficher le total live aurait contredit la maquette validée, qui montre
  le seuil rond). `units.formatWeight()` (déjà utilisé par `WeeklyVolumeSection`, découvert pendant
  l'implémentation) gère la conversion kg/lb, la locale et le nombre de décimales en un seul appel —
  pas de `toLocaleString()` manuel séparé. Le **seuil de comparaison**
  (`hasReachedTonnageMilestone`) reste en kg canonique ; seul l'**affichage** passe par les unités.
- Les totaux à vie / cette année utilisent aussi `units.formatWeight()`, pas un calcul manuel.

## 7. Comportement offline

**Total.** Lecture PowerSync locale (`workout_sets`/`workouts`, déjà synchronisées), agrégation SQL
locale. Aucun réseau, aucune écriture.

## 8. Accessibilité

Bloc `accessible` unique pour la section (titre + les deux nombres + badge si présent), même
patron que les autres sections de l'écran Progression.

## 9. Cas limites

| Situation | Comportement attendu |
|---|---|
| Aucune séance jamais terminée | `0 kg` affiché explicitement à vie et cette année (R4) |
| Tonnage à vie ≥ 1 000 000 kg | Badge affiché (R3) |
| Tonnage à vie < 1 000 000 kg | Pas de badge, aucune indication de « distance au jalon » (D3 — pas de barre de progression vers le jalon, qui serait une mécanique de progression) |
| Changement d'année (1er janvier) | Le total « cette année » repart de 0 au prochain rendu ; le total à vie n'est jamais affecté |
| Séance supprimée après avoir compté dans le total | Le tonnage à vie diminue au prochain rendu (soft delete déjà filtré par `deleted_at IS NULL`, comme partout) |
| Mode avion | Fonctionne normalement (lecture locale seule) |

## 10. Definition of Done

- [x] D1 → D4 arbitrés par Florian le 04/08/2026.
- [x] `localStartOfYear` testée (packages/shared) : 1er janvier local, heure zérotée, années
      bissextiles.
- [x] `hasReachedTonnageMilestone` testée : sous le seuil, au seuil pile, au-dessus.
- [x] Nouvelle section sur `/progress`, i18n FR + EN, zéro chaîne en dur, `units.formatWeight()`
      réutilisé (pas de `toLocaleString()` manuel, corrigé en revue de code).
- [x] `npm run lint`, `npm run typecheck`, `npm run test` verts (1475 tests shared + 655 tests
      mobile, 04/08/2026).
- [x] Aucune ligne roadmap à toucher (US d'analyse, catalogue seul).
- [ ] Recette device (Florian ou Damien) — critères §11.

## 11. Critères d'acceptation (recette device)

1. L'écran Progression affiche un total à vie et un total « cette année » cohérents avec l'historique
   réel des séances terminées.
2. Un compte neuf sans séance affiche `0 kg` aux deux endroits, pas une section absente.
3. Un compte ayant dépassé 1 000 000 kg cumulés affiche le badge ; un compte en dessous ne l'affiche
   pas.
4. Mode avion : la section s'affiche normalement.
5. En EN : libellés et séparateurs de milliers cohérents avec la langue.
6. TalkBack énonce la section comme un bloc cohérent.
