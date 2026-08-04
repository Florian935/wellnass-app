# Plan d'implémentation — MUSCPWR-01

> Spec : [muscpwr01-module-force.md](../specs/functional/us/muscpwr01-module-force.md)
> Branche : `feature/muscpwr01-module-force`, créée depuis `origin/dev` le 04/08/2026.

## 0. Principes de ce découpage

- **Tout le métier est pur.** Les trois analyses sont dérivées : aucune n'écrit en base (hors la
  désignation des mouvements). Le cœur vit donc dans `packages/shared`, où les seuils de couverture
  sont **verrouillés à 100 %** (instructions / fonctions / lignes) depuis le 04/08/2026.
- **Le socle est déjà là** : `estimate1RM`, `sessionBestEstimated1RM`, `linearRegression`. On compose,
  on ne réécrit pas.
- **Une seule migration**, additive, sur une table déjà publiée → **aucune sync rule à redéployer**.
- **TDD**, tests d'abord sur les lots 1 à 3.

⚠️ **`nvm use 24`** avant de lancer les tests.

## 1. Lot 0 — Migration `sbd_lifts`

- `supabase/migrations/<ts>_muscpwr01_sbd_lifts.sql` : `alter table public.user_settings add column
  if not exists sbd_lifts jsonb;`
- `apps/mobile/src/powersync/schema.ts` — **ajouter `sbd_lifts: column.text`** (JSON sérialisé, comme
  `dashboard_layout` et `notifications`). ⚠️ **L'oublier fait échouer l'écriture en silence** : deux
  précédents (CYCLE-01 le 31/07, `daily_step_goal` le 03/08).
- `apps/mobile/src/data/repositories/settings-repository.ts` — lecture/écriture typée du champ, via
  `parseJsonColumn` (patron `active_pillars` / `dashboard_layout`).
- `npm run db:push` → `db:types` → cocher [MIGRATIONS.md](../../supabase/MIGRATIONS.md).
- ✅ **Aucune sync rule** : `user_settings` est déjà publiée et lue en `select *`.

**Tests** : un test d'écriture au harness (`sbd_lifts` relu après écriture) — c'est exactement le
scénario que les deux pannes précédentes rendaient invisible.

## 2. Lot 1 — Intensité relative (`packages/shared/src/strength-intensity.ts`)

| Fonction | Contrat |
|---|---|
| `percentOfMax(weightKg, oneRmKg)` | `null` si `oneRmKg` absent ou ≤ 0 (**R2**) ; **non borné à 100** (**R3**). |
| `bestKnownOneRm(records, exerciseId)` | Le `estimated_1rm` **le plus élevé** (**R1**), pas le plus récent. |
| `sessionRelativeIntensity(sets, oneRmKg)` | Moyenne **pondérée par les répétitions** (**R4**), `warmup` **exclus** (**R5**), `null` si aucune série qualifiante. |

**Tests** : pas de 1RM → `null` · série au-dessus du max → > 100 % · pondération (1×95 % + 10×60 %
≠ moyenne simple) · séance 100 % échauffement → `null` · reps nulles ou absentes ignorées · 1RM à 0
ou négatif → `null` (pas d'`Infinity`).

## 3. Lot 2 — DOTS (`packages/shared/src/strength-dots.ts`)

```ts
dotsScore(totalKg, bodyweightKg, sex): number | null
bodyweightNearest(entries, dateIso): { weightKg: number; logDate: string } | null
```

- 🔴 **Coefficients inscrits en clair, commentés, et ancrés par des tests à valeurs de référence**
  (spec §4, point de vigilance). Un coefficient faux produit un score **plausible mais faux** :
  invisible en recette, d'où l'ancrage sur des totaux connus plutôt que des cas inventés.
- `sex === 'unspecified'` → `null` (**R6**), jamais une valeur par défaut.
- `bodyweightKg` ≤ 0 ou absent → `null`.
- Poids retenu = le **plus proche de la date du record** (**R7**), et la fonction **rend aussi sa
  date** pour que l'écran l'affiche (sinon le score paraît sorti de nulle part).

**Tests** : les deux sexes · `unspecified` → `null` · poids absent → `null` · poids avant/après le
record (le plus proche gagne, y compris postérieur) · égalité de distance → le plus ancien, de façon
déterministe · calcul **en kg** quelles que soient les préférences d'unité (**D9**).

## 4. Lot 3 — Total SBD et projection (`packages/shared/src/strength-sbd.ts`)

```ts
sbdTotal(oneRmByLift): { totalKg: number | null; missing: SbdLift[] }
sbdHistory(records, sbdLifts): { date: string; totalKg: number }[]
projectSbd(history, weeks): { projectedKg: number; slopePerWeek: number } | { reason: 'not-enough-points' | 'window-too-short' }
```

- `sbdTotal` → `null` + `missing` non vide dès qu'un mouvement manque (**R11**) : jamais un total
  partiel présenté comme un total.
- `projectSbd` : **≥ 3 points ET ≥ 8 semaines** (**R8**), plafond **12 semaines** (**R9**), pente
  négative rendue telle quelle (**R10**). Le retour dit **pourquoi** il n'y a pas de projection —
  l'écran doit pouvoir écrire « encore 1 mesure », pas juste masquer.
- Réutilise `linearRegression` (déjà éprouvée par `weightTrend` / `paceTrend`).

**Tests** : total complet · 1 puis 2 mouvements manquants · 2 points → `not-enough-points` · 3 points
sur 3 semaines → `window-too-short` · 3 points sur 10 semaines → projection · pente négative ·
plafond à 12 semaines · deux records le même jour (le plus élevé prime, **R1**).

## 5. Lot 4 — Repository (`apps/mobile/src/data/repositories/strength-repository.ts`)

```
useSbdLifts()                → { squat, bench, deadlift } + libellés résolus + drapeau « archivé »
setSbdLift(lift, exerciseId) → écriture dans user_settings.sbd_lifts
useStrengthSection()         → tout ce dont la section a besoin, en une passe
```

- `useStrengthSection` agrège **en un seul hook** : meilleurs 1RM, poids de corps le plus proche,
  sexe, historique des totaux. Un hook par analyse multiplierait les requêtes PowerSync sur un écran
  déjà chargé.
- ⚠️ **Un exercice désigné puis archivé** doit ressortir avec un drapeau, pas disparaître (**R12**) —
  requête **sans** filtre `deleted_at` sur la résolution du libellé, comme le fait déjà l'historique
  muscu depuis ADMIN-01.

**Tests** (harness) : désignation lue/écrite · exercice archivé → drapeau et libellé conservés ·
aucun mouvement désigné → structure vide sans erreur · deux appareils (JSON écrasé proprement).

## 6. Lot 5 — UI (`apps/mobile/src/components/strength/`)

- `StrengthSection.tsx` — **une** section repliable sur `/progress` (**D4**), qui rend `null` si
  aucune sous-analyse n'est disponible (ADR-007 : conditionnel par défaut).
- `RelativeIntensityCard.tsx`, `DotsCard.tsx` (avec poids et date, **R7**), `SbdTotalCard.tsx`
  (+ mouvements manquants), `SbdProjectionCard.tsx` (+ mention « estimation », **R9**).
- `app/strength-lifts.tsx` — écran de désignation des 3 mouvements (sélection dans la bibliothèque et
  les exercices perso). ⚠️ **Déclarer la route dans `app/_layout.tsx`** (précédent PAS-01).
- Réutiliser `DeltaBadge` et la courbe générique existants (ADR-007 règle 3 : des briques, pas des
  variantes).

**Tests de rendu** : section absente sans données · DOTS masqué sans sexe (avec le renvoi profil) ·
total partiel · exercice archivé · projection absente avec sa raison · repliable. Rendre **dans un
`await act`**.

## 7. Lot 6 — Transverse

- **i18n** `strength.*` FR **et** EN, longueurs identiques, pluriel sur `missingLifts`.
- **a11y** : section repliable annoncée avec son état, scores lisibles à 1,5×.
- **Suivi** : front-matter, **catalogue** MUSC-16 / MUSC-27 / MUSC-29 → ✅ (c'est là que vit la vérité
  de ces items, pas dans la roadmap), CHANGELOG, `RECETTES.md`, `scripts/etat.mjs` — via `/commit`.
- **Roadmap** : aucune ligne à créer — les US de catalogue n'y figurent pas (CLAUDE.md : « source de
  vérité des US META/MN/MR/NUTR/RN — ne pas les dupliquer dans la roadmap »).

## 8. Ordre de build et jalons

| Jalon | Lots | Ce qui devient vrai |
|---|---|---|
| **J1** | 0 → 1 | Le %1RM se calcule. Rien à l'écran. |
| **J2** | 2 → 3 | DOTS et total SBD calculés, projection bornée. |
| **J3** | 4 | Les données arrivent jusqu'à l'app. |
| **J4** | 5 → 6 | **MUSC-16/27/29 livrés**, US en recette. |

## 9. Risques

| Risque | Parade |
|---|---|
| 🔴 **Coefficients DOTS faux** | Inscrits en clair, ancrés par des tests à valeurs de référence, **relecture par un pratiquant** avant clôture (critère 21). Un score faux est plausible, donc invisible autrement. |
| **Projection prise pour une promesse** | R8/R9 : seuils d'entrée, plafond 12 semaines, libellé « au rythme actuel », mention d'estimation. Le produit ne promet pas ce que le corps ne fait pas. |
| **`sbd_lifts` absente du schéma local** | Test d'écriture au lot 0. Deux précédents de panne silencieuse. |
| **`/progress` qui devient un mur** | Une **seule** section repliable (D4), qui disparaît entièrement faute de données. |
| **1RM aberrant** (série mal saisie) | Assumé : tout est dérivé, corriger la série corrige l'analyse (R13). Un filtre de plausibilité écarterait de vrais records. |
| Module invisible pour qui n'en a pas besoin | C'est le but : conditions d'affichage strictes, et la désignation SBD fait office d'opt-in. |
