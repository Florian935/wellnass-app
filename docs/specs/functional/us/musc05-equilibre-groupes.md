# US MUSC-05 — Équilibre musculaire par groupe (14 j)

_Spec fonctionnelle. Statut : validée (brainstorming Florian, 15/07/2026). Branche :
`feature/musc05-equilibre-groupes` (depuis `dev`). Catalogue : **MUSC-05** — pilier Musculation,
Phase A (déterministe, offline). US liées : 3.40 / 6.4 / 7.9._

## 1. Contexte & objectif

L'écran Progression affiche déjà le **volume hebdo par groupe** (tonnage, histogramme). MUSC-05 ajoute
une lecture de l'**équilibre** de l'entraînement sur **14 jours glissants** : barres par groupe
**colorées selon l'écart à une répartition cible** + **alerte douce** listant les groupes **délaissés**.

**100 % client, offline, gratuit, sans IA, sans migration.**

## 2. Décisions de cadrage (Florian, 15/07/2026)

- **Métrique d'équilibre = nombre de séries effectives** (pas le tonnage) : le tonnage fausse la
  comparaison entre groupes (un squat pèse ×N un curl). Le compte de **séries validées non-échauffement**
  est comparable → base juste pour juger la répartition. Le tonnage reste sur la section « volume
  hebdo » existante (**inchangée**).
- **Fenêtre = 14 jours glissants** (robuste pour une routine en split ; évite les faux positifs d'une
  vue hebdo).
- **Cible de référence = répartition uniforme** (1/6 ≈ 16,7 % des séries par groupe). Neutre,
  défendable, sans cibles arbitraires par groupe.
- **Affichage = les deux** : barres colorées selon le classement **+** liste des groupes délaissés.

## 3. Périmètre

- **Inclus** : logique pure d'équilibre (parts, classement par groupe, liste des délaissés) +
  constantes de seuils (shared, testées) ; hook `useMuscleBalance()` (14 j, séries + tonnage par
  groupe) ; nouvelle section « Équilibre musculaire (14 j) » dans `/progress` (barres par séries
  colorées + alerte douce) ; extension de `MuscleVolumeBarChart` pour une couleur par barre ; i18n
  FR/EN.
- **Exclu** : ratio **pousser/tirer** (MUSC-11 — nécessite le « type de mouvement », absent du schéma →
  migration + re-seed) ; **muscles secondaires** (colonne absente) ; toute migration ; modification de
  la section « volume hebdo » existante.
- **Maquette** : **écartée** (barres existantes + carte d'alerte réutilisées).

## 4. Taxonomie

`MUSCLE_GROUPS` (shared) = `['chest', 'back', 'legs', 'shoulders', 'arms', 'core']` (6, plat). Libellés
i18n `muscle.*` déjà présents FR/EN. Cible uniforme = **1/6 par groupe**.

## 5. Logique pure — `muscleBalance` (shared, testée)

Dans `packages/shared/src/muscle-balance.ts` :

```ts
import type { MuscleGroup } from './exercise';

export type MuscleBalanceStatus = 'neglected' | 'balanced' | 'over';
export type MuscleGroupBalance = {
  muscle: MuscleGroup;
  sets: number;
  share: number;              // part des series du groupe sur le total (0..1), 0 si total 0
  status: MuscleBalanceStatus;
};
export type MuscleBalance = {
  groups: MuscleGroupBalance[];      // les 6 groupes, meme si 0 serie
  neglected: MuscleGroup[];          // groupes 'neglected'
  totalSets: number;
  hasEnoughData: boolean;            // totalSets >= MIN_SETS_FOR_BALANCE
};

/** Constantes de seuils (heuristiques ajustables). */
export const EVEN_SHARE = 1 / 6;                 // cible uniforme
export const NEGLECTED_SHARE_RATIO = 0.5;        // < 50 % de la cible => delaisse (~8,3 %)
export const OVER_SHARE_RATIO = 2;               // > 2x la cible => sur-represente (~33 %)
export const MIN_SETS_FOR_BALANCE = 12;          // en dessous : pas de verdict (historique maigre)

export function computeMuscleBalance(
  setsByGroup: ReadonlyArray<{ muscle: MuscleGroup; sets: number }>,
): MuscleBalance;
```

Règles :
- Normaliser sur **les 6 groupes** (un groupe absent de l'entrée = `sets: 0`).
- `totalSets = Σ sets`. `hasEnoughData = totalSets >= MIN_SETS_FOR_BALANCE`.
- `share = totalSets > 0 ? sets / totalSets : 0`.
- **Classement** (si `hasEnoughData`, sinon tous `'balanced'` et `neglected = []`) :
  - `share < EVEN_SHARE * NEGLECTED_SHARE_RATIO` (ou `sets === 0`) → `'neglected'` ;
  - `share > EVEN_SHARE * OVER_SHARE_RATIO` → `'over'` ;
  - sinon `'balanced'`.
- `neglected` = liste des groupes `'neglected'` (ordre de `MUSCLE_GROUPS`).
- Aucune division par zéro (garde `totalSets > 0`).

## 6. Hook `useMuscleBalance()` (mobile, 14 j)

`apps/mobile/src/data/repositories/records-repository.ts` :
- Fenêtre : borne basse = **aujourd'hui − 14 j** (motif `periodLowerBound` : `Date` → ISO UTC ;
  ne pas passer par `startOfWeekLocalUtc`, ce n'est pas une semaine calendaire).
- SQL : `SELECT e.muscle_primary AS muscle, COUNT(*) AS sets, SUM(s.reps * s.weight_kg) AS tonnage`
  avec les **mêmes filtres** que `useMuscleVolumeThisWeek` (JOIN `workouts` completed + `exercises`
  `deleted_at IS NULL`, `s.done = 1`, `s.set_type <> 'warmup'`, `reps`/`weight_kg` non nuls,
  `finished_at >= borne`), `GROUP BY e.muscle_primary`.
- Retour : `{ balance: MuscleBalance; volumes: { muscle, sets, tonnage }[]; isLoading }` où `balance =
  computeMuscleBalance(rows.map(r => ({ muscle, sets })))`.

## 7. UI — nouvelle section `/progress`

Nouvelle section « Équilibre musculaire (14 j) » (sous la section volume hebdo, qui reste inchangée) :
- **Barres par séries** par groupe (`MuscleVolumeBarChart` étendu pour accepter une **couleur par
  barre**) : `neglected` → couleur d'attention (doré `#c9a96e` / `colors.warning` si dispo) ;
  `balanced` → `colors.accent` ; `over` → nuance distincte neutre (ex. `colors.accentMuted`/opacité).
  Libellés `t('muscle.*')`, valeur = nb de séries.
- **Alerte douce** (style `DeficitVolumeAlertCard`, sans dismiss) affichée **seulement** si
  `balance.hasEnoughData && balance.neglected.length > 0` : message listant les groupes délaissés
  (ex. « Groupes peu travaillés sur 14 j : Dos, Épaules »).
- `hasEnoughData === false` (historique < 12 séries / 14 j) → **pas d'alerte** ; barres affichées si
  données présentes, sinon `EmptyState` (CTA « démarrer une séance »).
- `isLoading` géré (pas d'affichage transitoire faux).

## 8. Extension `MuscleVolumeBarChart`

Ajouter un prop optionnel pour **colorer chaque barre** (ex. `colors?: string[]` aligné sur `data`, ou
`data: { label, value, color? }[]`). **Rétrocompatible** : sans couleur fournie → comportement actuel
(`colors.accent` pour toutes). Les usages existants (dashboard, volume hebdo) restent inchangés.

## 9. Cas limites

- Aucune séance sur 14 j → `totalSets = 0` → `EmptyState`, pas d'alerte.
- Historique maigre (< 12 séries) → barres possibles mais **pas de verdict** de déséquilibre.
- Un seul groupe travaillé → les 5 autres `neglected` (si `hasEnoughData`) → alerte les listant.
- Groupe à 0 série → barre à 0 (ou absente du chart) mais présent dans le classement (`neglected`).
- **Offline** : tout local (SQLite) ; réactif.

## 10. i18n (FR + EN, parité)

Namespace `progress.balance` (ou équivalent) :
- titre de section, sous-titre « sur 14 jours », message d'alerte paramétré (liste de groupes),
  éventuel libellé de légende (délaissé / équilibré / sur-représenté), a11y. Aucune chaîne en dur.
Réutiliser les libellés `muscle.*` existants pour les noms de groupes.

## 11. Tests

- **Shared (Vitest)** : `computeMuscleBalance` — normalisation des 6 groupes, `share`, classement
  (neglected/balanced/over) avec seuils, `hasEnoughData` (< 12 → tous balanced, neglected vide),
  total 0 (pas de division par zéro), un seul groupe travaillé, ordre de `neglected`.
- **Mobile** : typecheck/lint verts ; rendu barres colorées + alerte vérifié à la recette device.

## 12. Definition of Done

- Section « Équilibre musculaire (14 j) » : barres par séries colorées (délaissé/équilibré/
  sur-représenté) + alerte douce listant les groupes délaissés quand l'historique est suffisant ;
  section volume hebdo **inchangée**.
- `computeMuscleBalance` pure et testée ; `MuscleVolumeBarChart` étendu **rétrocompatible** ; i18n
  FR/EN ; typecheck/lint/tests verts. **Pas de migration, pas de checkpoint 🔴** (100 % client).
- Catalogue **MUSC-05 → ✅**. Reste **recette device** (Florian) : provoquer/lever un déséquilibre,
  historique maigre (pas d'alerte), coloration des barres, non-régression de la section volume hebdo.
