---
id: NUTR-17
titre: "Régularité du journal (taux de complétion)"
roadmap: []
catalogue: [NUTR-17]
etape: close
branche: feature/nutr17-regularite-journal
maj: 16/07/2026
---
# US NUTR-17 — Régularité du journal (taux de complétion)

_Spec fonctionnelle. Statut : en validation (brainstorming Florian, 16/07/2026). Branche :
`feature/nutr17-regularite-journal` (depuis `dev`). Analyse **NUTR-17** du
[catalogue](../../product/analyses-donnees.md), Phase A._

## 1. Contexte & objectif

Les stats nutrition (apports moyens NUTR-05, adhérence NUTR-10) ne sont fiables que si l'utilisateur
**renseigne son journal régulièrement**. NUTR-17 ajoute une carte **« Régularité du journal »** : la
**part de jours renseignés** sur la fenêtre (7 j / 30 j). C'est le **contexte de fiabilité** des autres
stats (« ton adhérence de 80 % porte sur combien de jours réellement suivis ? ») et un petit levier de
motivation à la constance de saisie.

## 2. Décisions de cadrage (Florian, 16/07/2026)
- **Dénominateur borné à l'ancienneté** : `jours renseignés / min(fenêtre, jours écoulés depuis la
  1ʳᵉ entrée)`. Un compte récent n'affiche pas un taux artificiellement bas (pas de 3/30).
- **Jour en cours exclu** : la fenêtre s'arrête à **hier** (aujourd'hui, jour non terminé, n'est pas
  compté) → le taux ne chute pas le matin avant d'avoir loggé.

## 3. Périmètre

- **Inclus** :
  - Logique pure `computeJournalCompletion(...)` (`@wellness/shared`, testée).
  - Hook `useJournalCompletion(windowDays)` (jours renseignés via `useDailyTotals` + `MIN(log_date)`).
  - Carte **« Régularité du journal »** dans [nutrition-stats.tsx](../../../apps/mobile/src/app/nutrition-stats.tsx)
    (section apports, réutilise le sélecteur 7 j / 30 j existant, à côté de la carte Adhérence NUTR-10).
  - i18n FR + EN (parité).
- **Exclu (YAGNI)** :
  - « Jour renseigné » = ≥ 1 entrée de journal (`food_entries`) — **pas** de seuil de complétude
    (ex. « journée complète » = 3 repas). Une entrée suffit.
  - Streak de saisie / historique du taux dans le temps — une valeur par fenêtre.
  - Poids / autres piliers — régularité du **journal alimentaire** uniquement.
- **Aucune migration, aucune donnée nouvelle** (lecture de `food_entries` existant). 100 % client.
- **Maquette** : écartée (carte + libellés alignés sur la carte Adhérence NUTR-10 ; UI mineure).

## 4. Calcul (logique)

### 4.1 Définitions
- **Jour renseigné** : jour (clé locale `AAAA-MM-JJ`) ayant ≥ 1 entrée `food_entries` non supprimée
  (exactement ce que renvoie `useDailyTotals`, qui `GROUP BY log_date`).
- **Fenêtre** : les `windowDays` jours **écoulés** précédant aujourd'hui, soit `[J-windowDays … J-1]`
  (hier inclus, aujourd'hui **exclu**).
- **1ʳᵉ entrée** : `MIN(log_date)` sur `food_entries` non supprimées (`null` si aucune entrée).

### 4.2 `computeJournalCompletion` (fonction pure, testée)
Entrée : `{ loggedDayKeys: string[]; firstEntryDayKey: string | null; windowDays: number; today: Date }`.
⚠️ **Reçoit un `Date` `today`, PAS une clé** (éviter `new Date("AAAA-MM-JJ")` qui parse en **UTC** et
décale d'un jour en fuseau négatif). Toutes les **comparaisons** se font ensuite en **clés string**
`AAAA-MM-JJ` (zéro-paddées → lexicographique = chronologique).

1. `yesterdayKey = localDayKey(addDays(today, -1))` ; `windowStartKey = localDayKey(addDays(today, -windowDays))`.
   _(Fenêtre `[J-windowDays … J-1]` = `windowDays` jours.)_
2. Si `firstEntryDayKey == null` → `{ loggedDays: 0, effectiveWindow: 0, pct: 0 }`.
3. **Borne ancienneté (clés)** : `effectiveStartKey = firstEntryDayKey > windowStartKey ?
   firstEntryDayKey : windowStartKey`.
4. **Garde anti-négatif** : si `effectiveStartKey > yesterdayKey` (1ʳᵉ entrée = aujourd'hui/futur, aucun
   jour écoulé loggable) → `{ 0, 0, 0 }`.
5. **Fenêtre effective (compte EXACT, sans DST)** : reparser les deux clés bornes en **UTC** et compter
   les jours inclus : `effectiveWindow = Math.round((Date.parse(yesterdayKey + 'T00:00:00Z') −
   Date.parse(effectiveStartKey + 'T00:00:00Z')) / 86_400_000) + 1`. (L'écart entre deux minuits **UTC**
   est un multiple exact de 24 h → pas de dérive heure d'été. `Math.max(0, …)` en ceinture-bretelles.)
6. **Jours renseignés** : nombre de `loggedDayKeys` **distincts** vérifiant `key >= effectiveStartKey &&
   key <= yesterdayKey` (aujourd'hui exclu même s'il est loggé).
7. **Sortie** : `{ loggedDays, effectiveWindow, pct }`, `pct = Math.round(loggedDays / effectiveWindow × 100)`.

### 4.3 Hook `useJournalCompletion(windowDays)`
- `useDailyTotals(daysAgo(windowDays))` → `loggedDayKeys = totals.map(t => t.logDate)` (jours renseignés
  de la fenêtre ; aujourd'hui éventuellement inclus mais exclu par la fonction pure via `yesterdayKey`).
- `MIN(log_date)` : `useQuery` dédiée `SELECT MIN(log_date) AS first FROM food_entries WHERE deleted_at
  IS NULL` → `firstEntryDayKey = data[0]?.first ?? null` (l'agrégat renvoie **toujours une ligne**,
  `first = null` si table vide).
- Passe `today: new Date()` à `computeJournalCompletion`. Renvoie `{ loggedDays, effectiveWindow, pct, isLoading }`.
- **Emplacement** : `journal-repository.ts` (où vit `useDailyTotals` ; NUTR-17 ne dépend que de
  `food_entries`). ⚠️ `daysAgo` n'y existe pas → **définir un `daysAgo` local** (miroir de
  `nutrition-stats.tsx`/`dashboard-repository.ts`, via `localDayKey`), non exporté.

## 5. UI — carte « Régularité du journal » (Stats nutrition)
- Section apports, **sous** la carte Adhérence, **même** `intakeRange` (7 j / 30 j).
- Affiche : **`pct %`** en valeur forte + « **N / M jours renseignés** » (M = fenêtre effective).
- **État vide** : `effectiveWindow === 0` (aucune entrée passée) → « Commence à remplir ton journal »
  (pas de division par zéro, pas de « 0/0 »).
- Pas de graphique.

## 6. i18n (FR + EN, parité)
Namespace `stats.completion.*` : `title` (« Régularité du journal » / « Logging consistency »),
`logged_one` / `logged_other` (patron pluriel i18next : « {{count}} / {{total}} jour(s) renseigné(s) »,
`count` pilote le pluriel, `total` = paramètre), `empty` (« Commence à remplir ton journal » / « Start
logging your journal »). Parité FR/EN vérifiée (0 clé orpheline, double accolade `{{ }}`).

## 7. Cas limites
- **Aucune entrée** → `effectiveWindow = 0` → état vide.
- **1ʳᵉ entrée = aujourd'hui seulement** → `effectiveWindow = 0` (aucun jour écoulé loggable) → état vide.
- **Compte récent** (1ʳᵉ entrée il y a 3 j, fenêtre 30 j) → dénominateur = 3, pas 30.
- **Aujourd'hui loggé** → non compté (ni au numérateur ni au dénominateur) — cohérent avec « jours écoulés ».
- **Jour renseigné puis toutes ses entrées supprimées** → n'apparaît plus dans `useDailyTotals`
  (`deleted_at`) ni dans `MIN(log_date)` → cohérent.
- **7 j ↔ 30 j** → recalcul immédiat (même `intakeRange` partagé).
- **Offline** : lectures locales (`useQuery`), réactif.

## 8. Tests
- **Shared (Vitest)** : `computeJournalCompletion` — fenêtre pleine (loggés/window), borne ancienneté
  (compte récent), aujourd'hui exclu (jour loggé aujourd'hui non compté), aucune entrée → 0,
  1ʳᵉ entrée = aujourd'hui → effectiveWindow 0, arrondi.
- **Mobile** : `typecheck` + `lint` verts ; rendu vérifié en recette.

## 9. Definition of Done
- `computeJournalCompletion` (testée) + `useJournalCompletion` ; carte « Régularité du journal » dans
  Stats nutrition (7 j/30 j) ; i18n FR/EN.
- typecheck/lint/tests verts. **100 % client, aucune migration.**
- Catalogue NUTR-17 → ✅. Reste : recette device + relecture Damien.
