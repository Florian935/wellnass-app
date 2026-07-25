# MUSC-F13 — Niveaux d'affichage de la séance — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.
> ⚠️ **Workflow projet** : ce plan ne doit PAS être exécuté avant que les **3 livrables (spec ✅ + plan + maquette)**
> soient validés par Florian/Damien. La **Task 3** contient un **checkpoint cloud 🔴** (`db:push`).

**Goal :** adapter la densité de l'écran de séance muscu au niveau de l'utilisateur via 3 niveaux d'affichage
(Simplifiée / Normale / Détaillée) pilotant la visibilité des champs de `CurrentSetCard`.

**Architecture :** un réglage `workout_display_level` (enum, synchronisé, défaut `normal`) stocké dans
`profiles`. Deux fonctions **pures** dans `@wellness/shared` (coercition + matrice de visibilité) testées en
Vitest ; `CurrentSetCard` devient piloté par un prop `level` ; `workout.tsx` lit le profil et transmet le niveau.
Réglage éditable dans les Réglages + choisi à l'onboarding (nouvelle étape).

**Tech stack :** TypeScript, Zod (`@wellness/shared`), PowerSync (SQLite local), Supabase CLI (migration cloud),
React Native / Expo Router, i18next (FR/EN), Vitest (shared) + jest-expo (mobile).

**Spec :** [docs/specs/functional/us/muscf13-niveaux-affichage-seance.md](../specs/functional/us/muscf13-niveaux-affichage-seance.md)

---

## Structure des fichiers

**Créer :**
- `packages/shared/src/workout-display.ts` — enum `WORKOUT_DISPLAY_LEVELS`, schéma, type, `coerceWorkoutDisplayLevel`, `workoutFieldVisibility` (pures).
- `packages/shared/src/workout-display.test.ts` — tests Vitest.
- `supabase/migrations/<horodaté>_muscf13_workout_display_level.sql` — migration additive.
- `apps/mobile/src/app/(onboarding)/displayLevel.tsx` — nouvelle étape d'onboarding.
- `apps/mobile/src/components/workout/CurrentSetCard.level.test.tsx` — smoke tests de gating.

**Modifier :**
- `packages/shared/src/profile.ts` — champ `workoutDisplayLevel` dans `profileRowSchema`.
- `packages/shared/src/index.ts` — déjà `export * from './profile'` ; ajouter `export * from './workout-display'`.
- `apps/mobile/src/powersync/schema.ts:26-40` — colonne `workout_display_level` dans `profiles`.
- `apps/mobile/src/data/repositories/profile-repository.ts` — `ProfileDbRow`, `rowToProfile`, `inputToColumns`, `ProfileInput`.
- `apps/mobile/src/components/workout/CurrentSetCard.tsx` — prop `level` + gating.
- `apps/mobile/src/app/workout.tsx` — `useProfile` + passage du prop `level`.
- `apps/mobile/src/app/settings.tsx` — entrée « Niveau d'affichage de la séance ».
- `apps/mobile/src/app/(onboarding)/goal.tsx:11` — `NEXT` → `/(onboarding)/displayLevel`.
- `apps/mobile/src/components/OnboardingScaffold.tsx:12` — `TOTAL_STEPS` 3 → 4.
- `apps/mobile/src/i18n/locales/fr.json` + `en.json` — clés `workout.displayLevel.*`, `settings.workoutDisplayLevel.*`, `onboarding.displayLevel.*`.
- `supabase/MIGRATIONS.md` — cocher la migration.

---

## Task 1 : Enum, schéma & coercition partagés

**Files:**
- Create: `packages/shared/src/workout-display.ts`
- Create: `packages/shared/src/workout-display.test.ts`
- Modify: `packages/shared/src/profile.ts`, `packages/shared/src/index.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// packages/shared/src/workout-display.test.ts
import { describe, expect, it } from 'vitest';
import {
  WORKOUT_DISPLAY_LEVELS,
  coerceWorkoutDisplayLevel,
  workoutDisplayLevelSchema,
} from './workout-display';

describe('workout display level', () => {
  it('expose exactement 3 niveaux', () => {
    expect(WORKOUT_DISPLAY_LEVELS).toEqual(['simplified', 'normal', 'detailed']);
  });

  it('valide les valeurs connues', () => {
    for (const v of WORKOUT_DISPLAY_LEVELS) {
      expect(workoutDisplayLevelSchema.parse(v)).toBe(v);
    }
  });

  it('coerce null / inconnu / undefined → normal', () => {
    expect(coerceWorkoutDisplayLevel(null)).toBe('normal');
    expect(coerceWorkoutDisplayLevel(undefined)).toBe('normal');
    expect(coerceWorkoutDisplayLevel('bogus')).toBe('normal');
  });

  it('coerce une valeur connue en elle-même', () => {
    expect(coerceWorkoutDisplayLevel('simplified')).toBe('simplified');
    expect(coerceWorkoutDisplayLevel('detailed')).toBe('detailed');
  });
});
```

- [ ] **Step 2 : Lancer le test → échec** — `npm run test -w @wellness/shared` → FAIL (`workout-display` introuvable).

- [ ] **Step 3 : Implémenter le module**

```ts
// packages/shared/src/workout-display.ts
import { z } from 'zod';

/** Niveaux d'affichage de l'écran de séance muscu (MUSC-F13). */
export const WORKOUT_DISPLAY_LEVELS = ['simplified', 'normal', 'detailed'] as const;
export const workoutDisplayLevelSchema = z.enum(WORKOUT_DISPLAY_LEVELS);
export type WorkoutDisplayLevel = z.infer<typeof workoutDisplayLevelSchema>;

/** Défaut applicatif : toute valeur NULL / inconnue est traitée comme « normal ». */
export function coerceWorkoutDisplayLevel(value: string | null | undefined): WorkoutDisplayLevel {
  return value === 'simplified' || value === 'normal' || value === 'detailed' ? value : 'normal';
}
```

- [ ] **Step 4 : Exporter** (`packages/shared/src/index.ts`) — ajouter `export * from './workout-display';`.

- [ ] **Step 5 : Lancer les tests → succès** — `npm run test -w @wellness/shared` → PASS ; `npm run typecheck`
  vert. ⚠️ **Ne PAS toucher `profile.ts` ici** : ajouter le champ à `profileRowSchema` sans remplir
  `rowToProfile` casserait le typecheck mobile (TS2741). Le champ profil est ajouté en **Task 4**, avec son
  mapping, dans le même commit.

- [ ] **Step 6 : Commit**

```bash
git add packages/shared/src/workout-display.ts packages/shared/src/workout-display.test.ts packages/shared/src/index.ts
git commit -m "feat(muscf13): enum + coercition + matrice du niveau d'affichage (shared)"
```

---

## Task 2 : Matrice de visibilité (fonction pure)

**Files:**
- Modify: `packages/shared/src/workout-display.ts`, `packages/shared/src/workout-display.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue** (ajouter au fichier de test)

```ts
import { workoutFieldVisibility } from './workout-display';

describe('workoutFieldVisibility', () => {
  it('simplifiée : tout le supplémentaire est masqué', () => {
    expect(workoutFieldVisibility('simplified')).toEqual({
      delta: false, suggestion: false, warmupShortcut: false,
      typeSelector: false, rpe: false, note: false, superset: false,
    });
  });
  it('normale : delta + suggestion + échauffement ; pas de types/rpe/note/superset', () => {
    expect(workoutFieldVisibility('normal')).toEqual({
      delta: true, suggestion: true, warmupShortcut: true,
      typeSelector: false, rpe: false, note: false, superset: false,
    });
  });
  it('détaillée : tout est visible', () => {
    expect(workoutFieldVisibility('detailed')).toEqual({
      delta: true, suggestion: true, warmupShortcut: true,
      typeSelector: true, rpe: true, note: true, superset: true,
    });
  });
});
```

- [ ] **Step 2 : Lancer → échec** — `npm run test -w @wellness/shared` → FAIL.

- [ ] **Step 3 : Implémenter** (ajouter à `workout-display.ts`)

```ts
/**
 * Visibilité des éléments *supplémentaires* de la carte de séance selon le niveau.
 * Les champs cœur (nom, série, reps/durée, charge, lest, consigne du plan,
 * « dernière fois », repos, valider) sont TOUJOURS visibles → hors de cet objet.
 */
export type WorkoutFieldVisibility = {
  delta: boolean;          // écart planifié/réalisé (badge ▲/▼/=)
  suggestion: boolean;     // suggestion de progression 💡
  warmupShortcut: boolean; // raccourci échauffement 🔥
  typeSelector: boolean;   // sélecteur de types (dropset/échec/durée/poids de corps)
  rpe: boolean;            // RPE par série
  note: boolean;           // note par exercice 📝
  superset: boolean;       // liaison superset
};

export function workoutFieldVisibility(level: WorkoutDisplayLevel): WorkoutFieldVisibility {
  const normalPlus = level === 'normal' || level === 'detailed';
  const detailed = level === 'detailed';
  return {
    delta: normalPlus,
    suggestion: normalPlus,
    warmupShortcut: normalPlus,
    typeSelector: detailed,
    rpe: detailed,
    note: detailed,
    superset: detailed,
  };
}
```

- [ ] **Step 4 : Lancer → succès** — `npm run test -w @wellness/shared` → PASS.

- [ ] **Step 5 : Commit**

```bash
git add packages/shared/src/workout-display.ts packages/shared/src/workout-display.test.ts
git commit -m "feat(muscf13): matrice de visibilité des champs par niveau (shared)"
```

---

## Task 3 : Migration cloud + types + schéma PowerSync 🔴

**Files:**
- Create: `supabase/migrations/<horodaté>_muscf13_workout_display_level.sql`
- Modify: `apps/mobile/src/powersync/schema.ts:26-40`, `supabase/MIGRATIONS.md`, `packages/shared/src/database.types.ts` (généré)

- [ ] **Step 1 : Créer la migration** — `npm run db:new muscf13_workout_display_level`, puis écrire le SQL :

```sql
-- MUSC-F13 : niveau d'affichage de l'écran de séance (préférence synchronisée).
alter table public.profiles
  add column workout_display_level text default 'normal'
  check (workout_display_level in ('simplified', 'normal', 'detailed'));
```

> `check` tolérant NULL (les `check` PostgreSQL laissent passer NULL). Colonne additive → migration sûre.

- [ ] **Step 2 : Prévisualiser** — `npm run db:push:dry` → la migration apparaît, non jouée.

- [ ] **Step 3 : 🔴 CHECKPOINT — pousser sur le cloud** (écriture cloud, **go explicite Florian/Damien requis**)
  — `npm run db:push`. La table `profiles` reste répliquée par `select *` → **aucun redéploiement des sync
  rules PowerSync**.

- [ ] **Step 4 : Régénérer les types** — `npm run db:types` (met à jour `packages/shared/src/database.types.ts`).

- [ ] **Step 5 : Schéma PowerSync** — ajouter dans `apps/mobile/src/powersync/schema.ts`, table `profiles`,
  après `main_goal: column.text,` :

```ts
  workout_display_level: column.text,
```

- [ ] **Step 6 : Cocher le registre** — `supabase/MIGRATIONS.md` : ajouter la ligne cochée + date.

- [ ] **Step 7 : Vérifier** — `npm run typecheck` vert.

- [ ] **Step 8 : Commit**

```bash
git add supabase/migrations packages/shared/src/database.types.ts apps/mobile/src/powersync/schema.ts supabase/MIGRATIONS.md
git commit -m "feat(muscf13): migration workout_display_level + types + schéma PowerSync"
```

---

## Task 4 : Champ profil (shared) + mapping du repository

> Le champ `profileRowSchema` et son mapping atterrissent **dans le même commit** (sinon typecheck mobile rouge,
> cf. Task 1 Step 5).

**Files:**
- Modify: `packages/shared/src/profile.ts`, `apps/mobile/src/data/repositories/profile-repository.ts`

- [ ] **Step 0 : Ajouter le champ au profil** (`packages/shared/src/profile.ts`) — importer le schéma en tête
  (`import { workoutDisplayLevelSchema } from './workout-display';`) et, dans `profileRowSchema.extend({ … })`
  après `mainGoal` (ligne 42) :

```ts
  /** Niveau d'affichage de l'écran de séance (MUSC-F13). NULL en base → « normal » à la lecture (repo). */
  workoutDisplayLevel: workoutDisplayLevelSchema.nullable().default(null),
```

- [ ] **Step 1 : `ProfileDbRow`** (lignes 45-60) — ajouter `workout_display_level: string | null;`.

- [ ] **Step 2 : `rowToProfile`** (lignes 69-86) — importer `coerceWorkoutDisplayLevel` depuis `@wellness/shared`
  et ajouter au retour : `workoutDisplayLevel: coerceWorkoutDisplayLevel(row.workout_display_level),`.

- [ ] **Step 3 : `inputToColumns`** (lignes 89-103) — ajouter :

```ts
  if ('workoutDisplayLevel' in input) columns['workout_display_level'] = input.workoutDisplayLevel;
```

- [ ] **Step 4 : `ProfileInput`** (lignes 31-42) — ajouter `| 'workoutDisplayLevel'` à la liste `Pick<…>`.

- [ ] **Step 5 : Vérifier** — `npm run typecheck` vert (champ shared + mapping cohérents, plus aucun TS2741) ;
  `npm run test -w @wellness/shared` toujours vert.

- [ ] **Step 6 : Commit**

```bash
git add packages/shared/src/profile.ts apps/mobile/src/data/repositories/profile-repository.ts
git commit -m "feat(muscf13): champ workoutDisplayLevel (profil) + mapping repository"
```

---

## Task 5 : Gating de `CurrentSetCard`

**Files:**
- Modify: `apps/mobile/src/components/workout/CurrentSetCard.tsx`
- Create: `apps/mobile/src/components/workout/CurrentSetCard.level.test.tsx`

- [ ] **Step 1 : Écrire les smoke tests qui échouent** — rendre la carte aux 3 niveaux et vérifier la présence /
  absence des éléments discriminants (via `testID` / libellés i18n). Ex. :

```tsx
// CurrentSetCard.level.test.tsx (jest-expo)
// Rend <CurrentSetCard level="simplified" … /> avec des props minimales +
// note='' + rpe=null + supersetLink={status:'linkable'} + suggestionLabel='x' + plannedWeightKg fixé.
// Attendu simplified : PAS de RPE (t('workout.rpeAdd')), PAS de note (placeholder), PAS de chips de type,
//   PAS de 🔥, PAS de badge delta, PAS de suggestion, PAS de superset.
// Attendu normal : 🔥 présent, suggestion présente, delta présent ; RPE/note/chips/superset absents.
// Attendu detailed : tout présent (comportement actuel).
```

> S'aligner sur le patron des smoke tests existants (`edit-exercise-modal-smoke`). ⚠️ Le setup jest
> (`jest.setup.ts`) mocke **safe-area** mais **pas i18n** : reproduire le patron réel — `import '@/i18n'` en
> tête (vraies traductions FR/EN) + `colors` passé en **prop** (la carte ne fait pas `useTheme`). Matcher les
> vraies chaînes FR (libellés + emojis 🔥/💡). Requêtes tolérantes (`queryByText`/`queryByA11yRole`).

- [ ] **Step 2 : Lancer → échec** — `npm run test -w @wellness/mobile -- CurrentSetCard.level` → FAIL (prop `level` inexistant).

- [ ] **Step 3 : Ajouter le prop + la visibilité** — dans `CurrentSetCardProps` :

```ts
  /** Niveau d'affichage (MUSC-F13) — pilote la visibilité des champs supplémentaires. */
  level: WorkoutDisplayLevel;
```

  Importer `type WorkoutDisplayLevel, workoutFieldVisibility` de `@wellness/shared`, ajouter `level` à la
  déstructuration des props, et en tête du composant :

```ts
  const vis = workoutFieldVisibility(level);
```

- [ ] **Step 4 : Conditionner chaque bloc** (numéros de ligne actuels indicatifs) :
  - **Note 📝** (231-243) : envelopper la condition existante — `{vis.note && note !== undefined ? (…) : null}`.
    Mettre à jour le commentaire (228-230) : la note n'est plus « toujours visible » mais gatée Détaillée.
  - **Conteneur `typeRow`** (247-288) : ne le rendre que si `vis.typeSelector || vis.warmupShortcut`. À
    l'intérieur, rendre la `ScrollView` de chips (248-272) **seulement si** `vis.typeSelector`, et le
    `Pressable` 🔥 (273-287) **seulement si** `vis.warmupShortcut`.
  - **Superset** (292-328) : envelopper tout le bloc — `{vis.superset ? (…) : null}`.
  - **Suggestion 💡** (338-340) : `{vis.suggestion && suggestionLabel ? (…) : null}`.
  - **Badge delta** (401-413) : garder la ligne « planifié » (consigne, tous niveaux) ; ne gater QUE le badge —
    `{vis.delta && deltaRounded != null ? (…) : null}`.
  - **RPE** (438-499) : envelopper tout le `rpeBlock` — `{vis.rpe ? (…) : null}`.

  ⚠️ Ne rien changer aux champs cœur (nom, série, reps/durée, charge, lest, consigne, « dernière fois », repos,
  valider) ni à la logique de validation/repos/édition.

- [ ] **Step 5 : Lancer → succès** — tests level PASS ; `npm run typecheck` vert.

- [ ] **Step 6 : Commit**

```bash
git add apps/mobile/src/components/workout/CurrentSetCard.tsx apps/mobile/src/components/workout/CurrentSetCard.level.test.tsx
git commit -m "feat(muscf13): CurrentSetCard piloté par le niveau d'affichage"
```

---

## Task 6 : Câblage `workout.tsx`

**Files:**
- Modify: `apps/mobile/src/app/workout.tsx`

- [ ] **Step 1 : Lire le profil** — importer `useProfile` (`@/data/repositories/profile-repository`) et,
  dans le composant (près des autres hooks, avant tout retour anticipé) :

```ts
  const { profile } = useProfile();
  const displayLevel = profile?.workoutDisplayLevel ?? 'normal';
```

  (`workoutDisplayLevel` est déjà coercé non-null par `rowToProfile` ; le `?? 'normal'` couvre le profil non
  encore chargé.)

- [ ] **Step 2 : Passer le prop** — sur `<CurrentSetCard … />` (≈ ligne 498), ajouter `level={displayLevel}`.

- [ ] **Step 3 : Vérifier** — `npm run typecheck` vert ; l'app bundle (`npx expo export --platform web` en
  smoke, ou reload Metro). Reload Metro suffit (JS pur).

- [ ] **Step 4 : Commit**

```bash
git add apps/mobile/src/app/workout.tsx
git commit -m "feat(muscf13): workout.tsx lit le niveau du profil et le transmet à la carte"
```

---

## Task 7 : Entrée dans les Réglages

**Files:**
- Modify: `apps/mobile/src/app/settings.tsx`, `apps/mobile/src/i18n/locales/fr.json`, `en.json`

- [ ] **Step 1 : i18n** — ajouter (FR puis EN, parité stricte) :

```jsonc
// fr.json — dans "workout": { … }
"displayLevel": {
  "levels": {
    "simplified": { "label": "Simplifiée", "description": "L'essentiel : reps, charge, repos. Idéal pour débuter." },
    "normal": { "label": "Normale", "description": "Repères de progression : dernière fois, objectif, échauffement." },
    "detailed": { "label": "Détaillée", "description": "Tout : types de séries, RPE, notes, superset." }
  }
},
// fr.json — dans "settings": { … }
"workoutDisplayLevel": {
  "title": "Niveau d'affichage de la séance",
  "hint": "Choisis la quantité d'informations affichées pendant une séance de musculation."
}
```

```jsonc
// en.json — "workout.displayLevel.levels"
"simplified": { "label": "Simplified", "description": "The essentials: reps, weight, rest. Great to start." },
"normal": { "label": "Standard", "description": "Progress cues: last time, target, warm-up." },
"detailed": { "label": "Detailed", "description": "Everything: set types, RPE, notes, supersets." }
// en.json — "settings.workoutDisplayLevel"
"title": "Session display level",
"hint": "Choose how much information is shown during a strength session."
```

- [ ] **Step 2 : Câbler le profil dans `settings.tsx`** — importer `useProfile`, `upsertProfile`
  (`@/data/repositories/profile-repository`), `WORKOUT_DISPLAY_LEVELS` (`@wellness/shared`) ; dans le composant :

```ts
  const { profile } = useProfile();
  const displayLevel = profile?.workoutDisplayLevel ?? 'normal';
```

- [ ] **Step 3 : Ajouter la section** (sélecteur en cartes — un `Segment` ne porte pas de description) après un
  bloc existant (ex. après « Unités ») :

```tsx
      <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 28 }]}>
        {t('settings.workoutDisplayLevel.title')}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {WORKOUT_DISPLAY_LEVELS.map((lvl, i) => {
          const selected = displayLevel === lvl;
          return (
            <Pressable
              key={lvl}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => void upsertProfile({ workoutDisplayLevel: lvl })}
              style={[
                styles.menuColorRow,
                // ⚠️ menuColorRow n'a PAS flexDirection:'row' → l'ajouter inline pour poser
                // label+description à gauche et la pastille à droite (sinon empilé).
                { flexDirection: 'row', alignItems: 'center', gap: 12 },
                i < WORKOUT_DISPLAY_LEVELS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>
                  {t(`workout.displayLevel.levels.${lvl}.label`)}
                </Text>
                <Text style={[styles.hint, { color: colors.textMuted, marginTop: 0 }]}>
                  {t(`workout.displayLevel.levels.${lvl}.description`)}
                </Text>
              </View>
              <View style={[styles.menuColorDot, { backgroundColor: selected ? colors.accent : 'transparent', borderColor: colors.border, borderWidth: selected ? 0 : 1.5 }]} />
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('settings.workoutDisplayLevel.hint')}</Text>
```

  (Réutilise les styles `card` / `menuColorRow` / `menuColorDot` / `rowLabel` / `hint` déjà présents.)

- [ ] **Step 4 : Vérifier** — `npm run typecheck` + `npm run lint` verts ; reload Metro → changer le niveau
  reflète immédiatement la carte de séance (test manuel plan de recette).

- [ ] **Step 5 : Commit**

```bash
git add apps/mobile/src/app/settings.tsx apps/mobile/src/i18n/locales/fr.json apps/mobile/src/i18n/locales/en.json
git commit -m "feat(muscf13): réglage du niveau d'affichage dans les Réglages + i18n"
```

---

## Task 8 : Étape d'onboarding

**Files:**
- Create: `apps/mobile/src/app/(onboarding)/displayLevel.tsx`
- Modify: `apps/mobile/src/app/(onboarding)/goal.tsx:11`, `apps/mobile/src/components/OnboardingScaffold.tsx:12`, `fr.json`, `en.json`

- [ ] **Step 1 : i18n** — ajouter `onboarding.displayLevel` (FR/EN) ; réutiliser les labels/descriptions
  `workout.displayLevel.levels.*` de la Task 7 :

```jsonc
// fr.json — dans "onboarding": { … }
"displayLevel": {
  "title": "Niveau d'affichage",
  "subtitle": "Choisis la quantité d'infos pendant tes séances. Modifiable ensuite dans les réglages."
}
// en.json
"displayLevel": {
  "title": "Display level",
  "subtitle": "Choose how much info you see during sessions. Changeable later in settings."
}
```

- [ ] **Step 2 : Créer l'écran** (patron de `goal.tsx`, `step={4}`) :

```tsx
// apps/mobile/src/app/(onboarding)/displayLevel.tsx
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { WORKOUT_DISPLAY_LEVELS, type WorkoutDisplayLevel } from '@wellness/shared';
import { OnboardingScaffold } from '@/components/OnboardingScaffold';
import { upsertProfile } from '@/data/repositories/profile-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const NEXT = '/(onboarding)/summary';

export default function OnboardingDisplayLevel() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const [level, setLevel] = useState<WorkoutDisplayLevel | null>(null);

  const onContinue = async () => {
    if (level) await upsertProfile({ workoutDisplayLevel: level });
    router.push(NEXT);
  };

  return (
    <OnboardingScaffold
      step={4}
      title={t('onboarding.displayLevel.title')}
      subtitle={t('onboarding.displayLevel.subtitle')}
      onSkip={() => router.push(NEXT)}
      onContinue={onContinue}
    >
      <View style={styles.list}>
        {WORKOUT_DISPLAY_LEVELS.map((option) => {
          const selected = level === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setLevel(option)}
              style={[styles.option, { backgroundColor: colors.surface, borderColor: selected ? colors.accent : colors.border }]}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.optionLabel, { color: colors.text }]}>
                  {t(`workout.displayLevel.levels.${option}.label`)}
                </Text>
                <Text style={[styles.optionHint, { color: colors.textMuted }]}>
                  {t(`workout.displayLevel.levels.${option}.description`)}
                </Text>
              </View>
              <View style={[styles.dot, selected ? { backgroundColor: colors.accent } : { borderColor: colors.border, borderWidth: 1.5 }]} />
            </Pressable>
          );
        })}
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16 },
  optionLabel: { fontFamily: fontFamily.bodySemi, fontSize: 16 },
  optionHint: { fontFamily: fontFamily.body, fontSize: 13 },
  dot: { width: 20, height: 20, borderRadius: 10 },
});
```

> **Aperçu visuel** : la maquette (livrable 3) précisera si chaque option porte une **vignette** illustrant la
> carte. Si oui, l'intégrer ici (image locale légère ou mini-rendu) — à cadrer au moment du design.

- [ ] **Step 3 : Rewirer la chaîne** — `goal.tsx:11` : `const NEXT = '/(onboarding)/displayLevel';`.

- [ ] **Step 4 : Compteur** — `OnboardingScaffold.tsx:12` : `const TOTAL_STEPS = 4;`.

- [ ] **Step 5 : Vérifier** — `npm run typecheck` + `npm run lint` verts ; parcours onboarding : infos(1) →
  pillars(2) → goal(3) → **displayLevel(4)** → summary ; « Passer » / « Passer tout » laissent `normal`.

- [ ] **Step 6 : Commit**

```bash
git add "apps/mobile/src/app/(onboarding)/displayLevel.tsx" "apps/mobile/src/app/(onboarding)/goal.tsx" apps/mobile/src/components/OnboardingScaffold.tsx apps/mobile/src/i18n/locales/fr.json apps/mobile/src/i18n/locales/en.json
git commit -m "feat(muscf13): étape d'onboarding « niveau d'affichage » (compteur 3→4)"
```

---

## Task 9 : Parité i18n & clôture

**Files:** vérification transverse

- [ ] **Step 1 : Parité FR/EN** — vérifier que toutes les clés `workout.displayLevel.*`,
  `settings.workoutDisplayLevel.*`, `onboarding.displayLevel.*` existent dans les **deux** fichiers (aucune
  chaîne en dur ; si un test de parité i18n existe, le lancer).

- [ ] **Step 2 : Suite complète** — depuis la racine : `npm run typecheck` + `npm run lint` + `npm run test`
  (shared + mobile) → **tout vert**.

- [ ] **Step 3 : Revue finale** — relire le diff global (garde-fous : offline-first respecté — écritures locales
  uniquement ; aucune donnée effacée par le masquage ; aucun `console.log` oublié).

- [ ] **Step 4 : Commit de clôture éventuel** (si ajustements) puis mise à jour `TODO.md` (Task Code `[x]`) et
  push via `/commit`.

---

## Notes de test

- **Fonctions pures** (`coerceWorkoutDisplayLevel`, `workoutFieldVisibility`) : couverture exhaustive Vitest
  (3 niveaux × matrice). C'est le cœur logique — testé sans RN.
- **`CurrentSetCard`** : smoke tests jest-expo par niveau (présence/absence des éléments discriminants) — pas de
  test de logique métier (déléguée au parent).
- **Recette manuelle device** (voir spec §8) : réglage réactif en séance, persistance au redémarrage, synchro
  2ᵉ appareil, non-destructivité (note/RPE réapparaissent en repassant Détaillée), i18n EN.

## Points d'attention

- **`db:push` (Task 3) = écriture cloud** → go explicite Florian/Damien (checkpoint 🔴). Pas de base locale (pas
  de Docker) → étape `db:reset` sautée.
- **Ordre des tâches** : shared (1-2) → migration (3) → repository (4) → carte (5) → câblage (6) → réglages (7)
  → onboarding (8) → clôture (9). Les Tasks 5-8 sont 100 % JS (reload Metro), aucune migration.
- **Non-régression** : le niveau `detailed` doit reproduire **exactement** l'écran actuel (tout affiché).
