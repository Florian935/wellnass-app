# Plan — ACTIV-01 · Parcours « 7 jours pour démarrer » (roadmap 1.27)

Spec : [activ01-parcours-7-jours.md](../specs/functional/us/activ01-parcours-7-jours.md) ·
branche `feature/activ01-parcours-7-jours` · roadmap **1.27**.

Idée promue depuis IDEAS.md, différée après V0.9. Widget d'accueil auto-masquant, aucune
notification, aucune nouvelle table de suivi (seulement 1 colonne additive). Découpage en 6 étapes.

## Étape 0 — Migration + schéma *(≈ 15 min)*

```sql
alter table public.profiles
  add column activation_path_dismissed_at timestamptz;
```
Additive, `profiles` déjà publiée en `select *` → **aucune sync rule à redéployer**.

`packages/shared/src/profile.ts` : `profileRowSchema` étend `activationPathDismissedAt:
utcTimestampSchema.nullable().default(null)`. `apps/mobile/src/powersync/schema.ts` : colonne
ajoutée à la `Table` `profiles`. `apps/mobile/src/data/repositories/profile-repository.ts` :
`ProfileDbRow`/`rowToProfile`/`ProfileInput`/`inputToColumns` étendus (même patron que
`onboardingCompletedAt`), + nouvelle fonction `dismissActivationPath()` → `upsertProfile({
activationPathDismissedAt: nowUtc() })`.

## Étape 1 — Fonctions pures, testées d'abord *(≈ 45 min)*

Nouveau `packages/shared/src/activation-path.ts` :

```ts
export const ACTIVATION_PATH_LENGTH_DAYS = 7;
export const PILLAR_PRIORITY: readonly Pillar[] = ['strength', 'running', 'nutrition'];

/** Jour courant (1-based), ou null si hors fenêtre (avant jour 1 impossible, après jour 7 → null). */
export function activationPathDayIndex(
  onboardingCompletedAt: string | null,
  nowIso: string,
): number | null {
  if (!onboardingCompletedAt) return null;
  const elapsedDays = Math.floor(
    (new Date(nowIso).getTime() - new Date(onboardingCompletedAt).getTime()) / 86_400_000,
  );
  const day = elapsedDays + 1;
  return day >= 1 && day <= ACTIVATION_PATH_LENGTH_DAYS ? day : null;
}

/** Piliers actifs triés par priorité fixe (spec R7) — calcul structurel, jamais comportemental (§2 ter). */
export function rankedActivePillars(activePillars: readonly Pillar[]): Pillar[] {
  return PILLAR_PRIORITY.filter((p) => activePillars.includes(p));
}

export type ActivationDayTheme =
  | { kind: 'pillar'; rank: 1 | 2 | 3; pillar: Pillar }
  | { kind: 'universal'; day: number };

/** Thème du jour N (spec §2/§2 ter) — pur, ne dépend que du jour et des piliers actifs actuels. */
export function activationDayTheme(day: number, activePillars: readonly Pillar[]): ActivationDayTheme {
  const ranked = rankedActivePillars(activePillars);
  if (day === 1) return ranked[0] ? { kind: 'pillar', rank: 1, pillar: ranked[0] } : { kind: 'universal', day };
  if (day === 3) return ranked[1] ? { kind: 'pillar', rank: 2, pillar: ranked[1] } : { kind: 'universal', day };
  if (day === 5) return ranked[2] ? { kind: 'pillar', rank: 3, pillar: ranked[2] } : { kind: 'universal', day };
  return { kind: 'universal', day };
}
```

**Tests, écrits d'abord** (`activation-path.test.ts`) :
- `activationPathDayIndex` : jour 0 (avant l'ancrage, ne devrait pas arriver) → repli sur `null`
  ou 1 selon signe ; jour 1 à J+0/J+0,9 ; jour 7 à J+6 ; `null` à J+7 (jour 8) ; `null` si
  `onboardingCompletedAt` est `null`.
- `rankedActivePillars` : `['running','nutrition']` → `['running','nutrition']` (muscu absent,
  ordre de priorité conservé sur les 2 restants) ; `['nutrition']` seul → `['nutrition']` ; vide →
  `[]`.
- `activationDayTheme` : **reproduit l'exemple concret de la spec §2 ter** (running+nutrition
  actifs, muscu désactivé) → jour 1 = `{pillar, rank:1, running}`, jour 3 = `{pillar, rank:2,
  nutrition}`, jour 5 = `{universal}` (rang 3 absent) ; 1 seul pilier actif → jour 3 et jour 5
  tous deux `universal` ; jours 2/4/6/7 toujours `universal` quel que soit le nombre de piliers.

## Étape 2 — Repository mobile *(≈ 1 h)*

Nouveau `apps/mobile/src/data/repositories/activation-path-repository.ts` :

```ts
export function useActivationPath(): {
  show: boolean;
  day: number | null;
  theme: ActivationDayTheme | null;
  completed: boolean; // coche informative (spec R5), jamais bloquante
} {
  const { profile } = useProfile();          // onboardingCompletedAt (déjà réactif)
  const { settings } = useSettings();        // activePillars (déjà réactif, spec R2 : lu en direct)
  const day = profile?.activationPathDismissedAt
    ? null
    : activationPathDayIndex(profile?.onboardingCompletedAt ?? null, nowUtc());
  const theme = day != null ? activationDayTheme(day, settings?.activePillars ?? []) : null;
  const completed = useDayCompletion(day, theme); // étape 2, requête EXISTS ciblée (voir plus bas)
  return { show: day != null, day, theme, completed };
}
```

`useDayCompletion(day, theme)` — une requête `EXISTS` **ciblée par thème**, jamais l'agrégation
générique du streak (`dashboard-repository.ts`, trop lourde et orientée historique) :
- `theme.pillar === 'strength'` → `SELECT EXISTS(SELECT 1 FROM workouts WHERE finished_at >= ? AND deleted_at IS NULL)` (paramètre = `onboardingCompletedAt`)
- `theme.pillar === 'running'` → idem sur `runs WHERE status = 'completed' AND finished_at >= ? AND deleted_at IS NULL`
- `theme.pillar === 'nutrition'` → idem sur `food_entries WHERE created_at >= ? AND deleted_at IS NULL`
- jour 3/5 de repli universel (objectif) → `personal_goals WHERE created_at >= ? AND deleted_at IS NULL`
- jour 4 (bien-être) → `daily_wellbeing WHERE created_at >= ? AND deleted_at IS NULL`
- jours 2/6/7 (informationnels, spec §2) → pas de requête, `completed` toujours `false` sans
  signification (le widget ne montre pas de coche ces jours-là).

## Étape 3 — Wiring dans `(tabs)/index.tsx` et `isWidgetActive` *(≈ 30 min, point d'attention R4)*

```ts
const activationPath = useActivationPath();
const isWidgetActive = (id: WidgetId) => {
  if (id === 'deficit-volume') return deficitActive;
  if (id === 'activation-path') return activationPath.show;
  return true;
};
```
**Sans cette ligne, le widget laisserait un trou dans la grille après le jour 7 ou après un
dismiss** (spec R4, bug déjà constaté sur `training-load`/`overtraining-guard` — voir BACKLOG.md
dette technique, non corrigé ici).

## Étape 4 — Widget (composant + registre) *(≈ 1 h 30, le plus gros morceau content-wise)*

`packages/shared/src/widgets.ts` : ajouter `'activation-path'` à `HOME_WIDGET_IDS` (**en fin de
registre**, comme tout ajout récent — zéro migration de `dashboard_layout`), `pillars:
{ 'activation-path': 'always', ... }`.

`apps/mobile/src/components/dashboard/ActivationPathCard.tsx` (nouveau, même patron que
`TrainingLoadAlertCard` — `if (!activationPath.show) return null;` en tout premier) : « Jour {{n}}
sur 7 », titre + description du thème (résolution `theme` → clé i18n, voir étape 5), coche si
`completed`, bouton d'action (deep-link vers l'écran du pilier ciblé ou l'écran pertinent du jour
universel), bouton « Passer » (`dismissActivationPath()`). Enregistré dans `WIDGET_COMPONENTS`
(`dashboard-widgets.tsx`) sous la clé `'activation-path'`.

**Résolution thème → deep-link** (par thème, pas par jour — cohérent avec la structure pure de
l'étape 1) :
- `pillar: 'strength'` → hub muscu · `'running'` → hub course · `'nutrition'` → journal du jour
- `universal, day: 2` → réglages du tableau de bord (personnalisation) · `day: 4` → check-in
  bien-être · `day: 5` (repli) → écran série · `day: 6` → résumé de la dernière séance/course
  (partage) · `day: 7` → aucun deep-link, juste le contenu de clôture.

## Étape 5 — i18n *(≈ 1 h, le vrai coût de cette US — spec R6, contenu brouillon)*

`activationPath.*` (FR+EN) : `progress`, `dismiss`, `doneBadge`, puis `day1`..`day7` × `{title,
description, cta}`. **Rédigé comme brouillon** (spec R6) — à soumettre à Florian/Damien à la
validation, avant de considérer le texte figé. Parité FR/EN vérifiée par script (comme RUN-F2c).

## Étape 6 — Quality gate + solde *(≈ 20 min)*

`npm run typecheck` / `lint` / `test` (lus sans pipe). Roadmap 1.27 ⬜→✅, BACKLOG (ligne ACTIV-01),
CHANGELOG, `etat.mjs`, front-matter `etape: recette`, `/commit`, merge `dev`.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `supabase/migrations/<horodatage>_activ01_dismiss.sql` (+ `MIGRATIONS.md`) | 1 colonne additive sur `profiles` |
| `packages/shared/src/profile.ts` | `activationPathDismissedAt` |
| `apps/mobile/src/powersync/schema.ts` | 1 colonne locale |
| `apps/mobile/src/data/repositories/profile-repository.ts` | mapping étendu + `dismissActivationPath` |
| `packages/shared/src/activation-path.ts` (+ `.test.ts`, nouveau) | `activationPathDayIndex`, `rankedActivePillars`, `activationDayTheme` |
| `apps/mobile/src/data/repositories/activation-path-repository.ts` (nouveau) | `useActivationPath`, `useDayCompletion` |
| `packages/shared/src/widgets.ts` | nouvel id `activation-path`, garde `'always'` |
| `apps/mobile/src/components/dashboard/ActivationPathCard.tsx` (nouveau) | widget auto-masquant |
| `apps/mobile/src/components/dashboard/dashboard-widgets.tsx` | enregistrement `WIDGET_COMPONENTS` |
| `apps/mobile/src/app/(tabs)/index.tsx` | `isWidgetActive` étendu (**point d'attention R4**) |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | `activationPath.*` (brouillon, R6) |

## Migration / sync rules

**1 migration** (colonne additive sur table déjà publiée). **Aucune sync rule à redéployer.**

## Dépendances

Aucun paquet nouveau → **recettable sur l'APK existant**.

## Risques

- 🔴 **`isWidgetActive` (étape 3) est le point qui décide si cette US reproduit ou évite le bug de
  grille déjà trouvé sur `training-load`/`overtraining-guard`** (spec R4, relecture du
  03/08/2026). Vérifier explicitement au quality gate qu'aucun trou n'apparaît après le jour 7 ou
  après un dismiss.
- 🟠 **Contenu (étape 5) est un brouillon** (spec R6) : les 7 thèmes proposés en spec §2 sont ma
  rédaction, pas celle d'un coach produit — à faire valider/corriger explicitement à l'étape de
  validation humaine, avant tout code si des changements structurels en découlent (ex. un thème
  qui changerait de pilier cible toucherait `activationDayTheme`).
- 🟢 **Aucun risque sur le tracker/la tâche de fond, aucune table neuve, aucune notification** —
  US délibérément bornée (spec §4).
