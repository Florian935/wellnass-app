# MUSC-F3 — Recherche d'exercices multi-critères (groupe musculaire + matériel) · Plan

> **Pour l'exécutant :** subagent-driven-development, une tâche à la fois, TDD, commits fréquents.

**Goal :** filtrer la liste d'exercices par **groupe musculaire** et **matériel** (en plus de la
recherche par nom existante), via un bouton « Filtres » + tiroir, sur `ExercisePicker` **et**
`exercises.tsx`.

**Spec :** [docs/specs/functional/us/muscf3-recherche-multicriteres.md](../specs/functional/us/muscf3-recherche-multicriteres.md).

**Architecture :** logique pure `buildExerciseFilterClause` (shared, testée) → `useExercises`
étendu (2 nouveaux paramètres optionnels) → composant partagé `ExerciseFilterDrawer` (tiroir 2
sections) → intégré dans `ExercisePicker.tsx` et `exercises.tsx`. Côté admin : le champ matériel
texte libre devient un `<select>` sur la liste contrôlée `EQUIPMENTS` (déjà définie dans
`packages/shared`, jamais branchée jusqu'ici). Migration = une contrainte `CHECK` sur une colonne
déjà existante, aucune colonne ajoutée.

**Tech :** TypeScript, Vitest (shared), Expo/RN (`Modal` transparent, pas de nouvelle dépendance),
PowerSync (`useQuery`), React (admin, `<select>`).

**Ordre :** 1 (shared) → 2 (admin) → 3 (i18n mobile) → 4 (repository) → 5 (drawer) → 6
(ExercisePicker) → 7 (exercises.tsx) → 8 (seed dev) → 9 (migration, checkpoint cloud) → 10 (clôture).

---

### Task 1 : Logique pure `buildExerciseFilterClause` (shared)

**Files :**
- Create : `packages/shared/src/exercise-filter.ts`
- Create : `packages/shared/src/exercise-filter.test.ts`
- Modify : `packages/shared/src/index.ts` (`export * from './exercise-filter';`)

- [ ] **Step 1 — Tests qui échouent.** Couvrir : aucun filtre → clause vide/params vides ; muscles
  seuls (1 puis 2 valeurs, vérifie `IN (?)`/`IN (?,?)` et que les valeurs sont bien dans `params`,
  pas dans la clause — pas d'injection SQL) ; équipement seul ; les deux ensemble → les deux `IN`
  reliés par `AND` (ET inter-facettes) ; tableaux vides (`[]`) traités comme absents.

```ts
import { describe, it, expect } from 'vitest';
import { buildExerciseFilterClause } from './exercise-filter';

describe('buildExerciseFilterClause', () => {
  it('aucun filtre → clause vide, aucun paramètre', () => {
    expect(buildExerciseFilterClause()).toEqual({ clause: '', params: [] });
    expect(buildExerciseFilterClause([], [])).toEqual({ clause: '', params: [] });
  });

  it('un seul groupe musculaire → IN (?) paramétré', () => {
    const { clause, params } = buildExerciseFilterClause(['back']);
    expect(clause).toBe('AND e.muscle_primary IN (?)');
    expect(params).toEqual(['back']);
  });

  it('plusieurs groupes → IN (?,?) — OU au sein de la facette', () => {
    const { clause, params } = buildExerciseFilterClause(['back', 'shoulders']);
    expect(clause).toBe('AND e.muscle_primary IN (?,?)');
    expect(params).toEqual(['back', 'shoulders']);
  });

  it('matériel seul → clause sur e.equipment', () => {
    const { clause, params } = buildExerciseFilterClause(undefined, ['barbell', 'dumbbell']);
    expect(clause).toBe('AND e.equipment IN (?,?)');
    expect(params).toEqual(['barbell', 'dumbbell']);
  });

  it('muscle + matériel → les deux IN reliés par AND — ET inter-facettes', () => {
    const { clause, params } = buildExerciseFilterClause(['back'], ['cable']);
    expect(clause).toBe('AND e.muscle_primary IN (?) AND e.equipment IN (?)');
    expect(params).toEqual(['back', 'cable']);
  });
});
```

- [ ] **Step 2 — Échec.** `npm run test -w @wellness/shared` → FAIL (module introuvable).
- [ ] **Step 3 — Implémenter** `exercise-filter.ts` :

```ts
import type { Equipment, MuscleGroup } from './exercise';

/**
 * Construit la clause SQL (paramétrée) et les params correspondants pour filtrer
 * `exercises` par groupe musculaire et/ou matériel. OU au sein d'une facette
 * (IN), ET entre facettes (clauses concaténées). Tableau vide ou absent =
 * facette non contraignante.
 */
export function buildExerciseFilterClause(
  muscles?: readonly MuscleGroup[],
  equipment?: readonly Equipment[],
): { clause: string; params: string[] } {
  const parts: string[] = [];
  const params: string[] = [];

  if (muscles && muscles.length > 0) {
    parts.push(`e.muscle_primary IN (${muscles.map(() => '?').join(',')})`);
    params.push(...muscles);
  }
  if (equipment && equipment.length > 0) {
    parts.push(`e.equipment IN (${equipment.map(() => '?').join(',')})`);
    params.push(...equipment);
  }

  if (parts.length === 0) return { clause: '', params: [] };
  return { clause: `AND ${parts.join(' AND ')}`, params };
}
```

- [ ] **Step 4 — Succès.** tests PASS + `npm run typecheck`.
- [ ] **Step 5 — Commit.** `feat(shared): buildExerciseFilterClause — filtre muscle/matériel (MUSC-F3)`

---

### Task 2 : Admin — matériel en liste contrôlée

**Files :**
- Modify : `apps/admin/src/data/exercises.ts`
- Modify : `apps/admin/src/i18n/fr.ts`
- Modify : `apps/admin/src/screens/ExerciseEditScreen.tsx`

- [ ] **Step 1 — Réexport + types.** Dans `exercises.ts` :
  - `import { MUSCLE_GROUPS, EQUIPMENTS, type Database, type MuscleGroup, type Equipment } from '@wellness/shared';`
  - Ajouter `export { EQUIPMENTS };` et `export type { Equipment };` (miroir des lignes 18-20
    existantes pour `MUSCLE_GROUPS`/`MuscleGroup`).
  - `AdminExerciseRow.equipment`, `ExerciseDetail.equipment`, `ExerciseInput.equipment` :
    `string | null` → `Equipment | null`.
  - `getExercise` : `equipment: data.equipment as Equipment | null,` (au lieu de `data.equipment`).
- [ ] **Step 2 — Libellés FR.** Dans `fr.ts`, section `exercises` (à côté de `groupNames`, ligne
  ~223) :

```ts
    equipmentNames: {
      barbell: 'Barre',
      dumbbell: 'Haltères',
      machine: 'Machine guidée',
      cable: 'Poulie / câble',
      bodyweight: 'Poids du corps',
      kettlebell: 'Kettlebell',
      band: 'Élastique / bande',
      other: 'Autre',
    },
```
  Ajouter aussi `equipmentEmpty: 'Non renseigné',` (option vide du select).
- [ ] **Step 3 — Formulaire.** Dans `ExerciseEditScreen.tsx` :
  - `import { MUSCLE_GROUPS, EQUIPMENTS, ... , type Equipment } from '../data/exercises';`
  - `const [equipment, setEquipment] = useState<Equipment | ''>('');`
  - `setEquipment(exercise.equipment ?? '');` (inchangé, `''` reste la valeur "non renseigné").
  - `equipment: equipment === '' ? null : equipment,` au lieu de `equipment.trim() ? equipment.trim() : null,`.
  - Remplacer le `<input type="text" id="equipment" .../>` par :

```tsx
                <select
                  id="equipment"
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value as Equipment | '')}
                  style={styles.input}
                >
                  <option value="">{fr.exercises.equipmentEmpty}</option>
                  {EQUIPMENTS.map((eq) => (
                    <option key={eq} value={eq}>
                      {fr.exercises.equipmentNames[eq]}
                    </option>
                  ))}
                </select>
```
- [ ] **Step 4 — Vérifs.** `npm run typecheck -w @wellness/admin` + `npm run build -w @wellness/admin`
  (le build web sert de smoke-test, pas de runner de tests admin).
- [ ] **Step 5 — Commit.** `feat(admin): matériel en liste contrôlée (select EQUIPMENTS) (MUSC-F3)`

---

### Task 3 : i18n mobile (`equipment.*` + clés du tiroir de filtres)

**Files :**
- Modify : `apps/mobile/src/i18n/locales/fr.json`
- Modify : `apps/mobile/src/i18n/locales/en.json`

- [ ] **Step 1 — FR.** Ajouter un objet `"equipment"` (miroir de `"muscle"`, ligne 22) :

```json
  "equipment": {
    "barbell": "Barre",
    "dumbbell": "Haltères",
    "machine": "Machine guidée",
    "cable": "Poulie / câble",
    "bodyweight": "Poids du corps",
    "kettlebell": "Kettlebell",
    "band": "Élastique / bande",
    "other": "Autre"
  },
```
  Dans `"exercises"` (ligne 30), ajouter :
```json
    "filters": "Filtres",
    "emptyFiltered": "Aucun résultat pour ces filtres.",
    "filterDrawer": {
      "muscleSection": "Groupe musculaire",
      "equipmentSection": "Matériel",
      "reset": "Réinitialiser"
    }
```
- [ ] **Step 2 — EN.** Même structure, traduite :
```json
  "equipment": {
    "barbell": "Barbell",
    "dumbbell": "Dumbbell",
    "machine": "Machine",
    "cable": "Cable / pulley",
    "bodyweight": "Bodyweight",
    "kettlebell": "Kettlebell",
    "band": "Resistance band",
    "other": "Other"
  },
```
```json
    "filters": "Filters",
    "emptyFiltered": "No results for these filters.",
    "filterDrawer": {
      "muscleSection": "Muscle group",
      "equipmentSection": "Equipment",
      "reset": "Reset"
    }
```
- [ ] **Step 3 — Parité.** Vérifier à l'œil que chaque clé FR a son miroir EN (même structure
  d'objet, pas de clé orpheline).
- [ ] **Step 4 — Commit.** `feat(i18n): clés equipment.* + tiroir de filtres exercices FR/EN (MUSC-F3)`

---

### Task 4 : `useExercises` — filtres muscle/matériel

**Files :**
- Modify : `apps/mobile/src/data/repositories/exercise-repository.ts`

- [ ] **Step 1 — Signature étendue.**
```ts
export function useExercises(
  search?: string,
  muscles?: MuscleGroup[],
  equipment?: Equipment[],
): {
  exercises: ExerciseListItem[];
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';

  const term = search?.trim() ?? '';
  const hasSearch = term.length > 0;
  const { clause: filterClause, params: filterParams } = buildExerciseFilterClause(muscles, equipment);

  const sql = hasSearch
    ? `${SELECT_EXERCISES} ${SEARCH_CLAUSE} ${filterClause} ${ORDER_BY_NAME}`
    : `${SELECT_EXERCISES} ${filterClause} ${ORDER_BY_NAME}`;
  const params = hasSearch
    ? [lang, `%${term}%`, ...filterParams]
    : [lang, ...filterParams];

  const { data, isLoading: queryLoading } = useQuery<ExerciseListDbRow>(sql, params);

  const isLoading = queryLoading;
  const exercises = data.map(rowToListItem);

  return { exercises, isLoading };
}
```
  Import `buildExerciseFilterClause` et le type `Equipment` depuis `@wellness/shared` (en haut du
  fichier, à côté de `import type { MuscleGroup, Source } from '@wellness/shared';`).
- [ ] **Step 2 — Non-régression.** `useFavorites()` reste inchangé (pas de filtres — hors
  périmètre, cf. spec §2.3).
- [ ] **Step 3 — Vérifs.** `npm run typecheck -w @wellness/mobile`.
- [ ] **Step 4 — Commit.** `feat(muscu): useExercises — filtres muscle/matériel optionnels (MUSC-F3)`

---

### Task 5 : Composant partagé `ExerciseFilterDrawer`

**Files :**
- Create : `apps/mobile/src/components/programs/ExerciseFilterDrawer.tsx`

- [ ] **Step 1 — Composant.** Tiroir bas d'écran (`Modal transparent animationType="slide"`, pas de
  nouvelle dépendance — cohérent avec les `Modal`/`presentationStyle="pageSheet"` déjà utilisés par
  `ExercisePicker`/`SupersetPickerModal`, empilable par-dessus une modale existante) :

```tsx
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MUSCLE_GROUPS, EQUIPMENTS, type MuscleGroup, type Equipment } from '@wellness/shared';
import { Button } from '@/components/Button';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type ExerciseFilterDrawerProps = {
  visible: boolean;
  onClose: () => void;
  muscles: MuscleGroup[];
  onMusclesChange: (m: MuscleGroup[]) => void;
  equipment: Equipment[];
  onEquipmentChange: (e: Equipment[]) => void;
};

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * Tiroir de filtres (groupe musculaire + matériel) partagé par `ExercisePicker`
 * et l'écran bibliothèque `exercises.tsx`. OU au sein d'une facette, ET entre
 * facettes (cohérent avec `buildExerciseFilterClause`, shared). Pas de bouton
 * « Appliquer » : fermer le tiroir applique la sélection courante.
 */
export function ExerciseFilterDrawer({
  visible,
  onClose,
  muscles,
  onMusclesChange,
  equipment,
  onEquipmentChange,
}: ExerciseFilterDrawerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const hasFilters = muscles.length > 0 || equipment.length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.section, { color: colors.textMuted }]}>
            {t('exercises.filterDrawer.muscleSection')}
          </Text>
          <View style={styles.chips}>
            {MUSCLE_GROUPS.map((m) => (
              <Pressable
                key={m}
                onPress={() => onMusclesChange(toggle(muscles, m))}
                style={[
                  styles.chip,
                  {
                    backgroundColor: muscles.includes(m) ? colors.accent : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={{ color: muscles.includes(m) ? colors.accentText : colors.text, fontSize: 13 }}>
                  {t(`muscle.${m}`)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.section, { color: colors.textMuted }]}>
            {t('exercises.filterDrawer.equipmentSection')}
          </Text>
          <View style={styles.chips}>
            {EQUIPMENTS.map((eq) => (
              <Pressable
                key={eq}
                onPress={() => onEquipmentChange(toggle(equipment, eq))}
                style={[
                  styles.chip,
                  {
                    backgroundColor: equipment.includes(eq) ? colors.accent : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={{ color: equipment.includes(eq) ? colors.accentText : colors.text, fontSize: 13 }}>
                  {t(`equipment.${eq}`)}
                </Text>
              </Pressable>
            ))}
          </View>

          {hasFilters && (
            <Button
              label={t('exercises.filterDrawer.reset')}
              variant="ghost"
              onPress={() => {
                onMusclesChange([]);
                onEquipmentChange([]);
              }}
            />
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    maxHeight: '70%',
  },
  content: { padding: 20, gap: 10 },
  section: { fontFamily: fontFamily.bodySemi, fontSize: 13, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
});
```

  > ⚠️ Vérifier le nom exact du composant `Button` et sa prop `variant="ghost"` dans
  > `apps/mobile/src/components/Button.tsx` avant d'écrire ce fichier (déjà utilisé ainsi dans
  > `ExercisePicker`/`exercises.tsx` voisins — confirmer la signature au moment de l'implémentation,
  > les noms de props peuvent avoir évolué).

- [ ] **Step 2 — Vérifs.** `npm run typecheck -w @wellness/mobile` + `npm run lint -w @wellness/mobile`.
- [ ] **Step 3 — Commit.** `feat(muscu): composant ExerciseFilterDrawer (MUSC-F3)`

---

### Task 6 : Intégration dans `ExercisePicker.tsx`

**Files :**
- Modify : `apps/mobile/src/components/programs/ExercisePicker.tsx`

- [ ] **Step 1 — État + bouton Filtres.**
  - `import { ExerciseFilterDrawer } from './ExerciseFilterDrawer';` + `import type { MuscleGroup, Equipment } from '@wellness/shared';`
  - États : `const [muscles, setMuscles] = useState<MuscleGroup[]>([]);` et
    `const [equipment, setEquipment] = useState<Equipment[]>([]);` + `const [filtersOpen, setFiltersOpen] = useState(false);`
  - `const { exercises, isLoading } = useExercises(query, muscles, equipment);`
  - `const filterCount = muscles.length + equipment.length;`
  - `styles.searchRow` ne définit aujourd'hui pas `flexDirection: 'row'` (un seul enfant, le
    `TextField`) — l'ajouter (`flexDirection: 'row', alignItems: 'flex-end', gap: 10` par exemple)
    pour aligner le bouton Filtres à côté du champ de recherche plutôt qu'en dessous.
  - Dans `styles.searchRow`, ajouter à côté du `TextField` un `Pressable`/`Button` :
    ```tsx
    <Pressable onPress={() => setFiltersOpen(true)} accessibilityRole="button">
      <Text style={{ color: colors.text }}>
        {t('exercises.filters')}{filterCount > 0 ? ` · ${filterCount}` : ''}
      </Text>
    </Pressable>
    ```
  - Après le `FlatList` (ou en fin de rendu du `SafeAreaView`), monter le tiroir :
    ```tsx
    <ExerciseFilterDrawer
      visible={filtersOpen}
      onClose={() => setFiltersOpen(false)}
      muscles={muscles}
      onMusclesChange={setMuscles}
      equipment={equipment}
      onEquipmentChange={setEquipment}
    />
    ```
- [ ] **Step 2 — Affichage matériel + vide filtré.**
  - Ligne exercice : `{t(\`muscle.${item.muscle}\`)}{item.equipment ? \` · ${t(\`equipment.${item.equipment}\`)}\` : ''}{item.source === 'custom' ? \` · ${t('exercises.customBadge')}\` : ''}`
  - `ListEmptyComponent` : si `filterCount > 0`, afficher `t('exercises.emptyFiltered')` au lieu de
    `t('programs.edit.picker.empty')`.
- [ ] **Step 3 — Vérifs.** `npm run typecheck -w @wellness/mobile` + `npm run lint -w @wellness/mobile`.
- [ ] **Step 4 — Commit.** `feat(muscu): bouton Filtres + tiroir dans ExercisePicker (MUSC-F3)`

---

### Task 7 : Intégration dans `exercises.tsx`

**Files :**
- Modify : `apps/mobile/src/app/exercises.tsx`

- [ ] **Step 1 — Même intégration que Task 6** (état `muscles`/`equipment`/`filtersOpen`, bouton
  Filtres à côté du `TextField` dans `styles.searchRow` — ajouter `flexDirection: 'row'` comme dans
  Task 6, ce `searchRow`-ci a le même souci —, `ExerciseFilterDrawer` monté en fin de rendu,
  `useExercises(query, muscles, equipment)`).
- [ ] **Step 2 — Affichage matériel.** Ligne `styles.muscle` : même complément
  `{item.equipment ? \` · ${t(\`equipment.${item.equipment}\`)}\` : ''}` avant le badge perso.
- [ ] **Step 3 — Vide filtré ET mode remplacement.** `filteredItems` (exclusion des exercices déjà
  présents en mode remplacement, ligne 48) reste **en aval** du filtre facettes — aucune
  interaction spéciale à coder (le filtre s'applique sur `items`, `filteredItems` en dérive comme
  aujourd'hui). Si la liste résultante est vide **et** `filterCount > 0`, afficher
  `t('exercises.emptyFiltered')` (actuellement l'écran n'a pas de `ListEmptyComponent` explicite —
  en ajouter un sur le `FlatList`).
- [ ] **Step 4 — Vérifs.** `npm run typecheck -w @wellness/mobile` + `npm run lint -w @wellness/mobile`.
- [ ] **Step 5 — Commit.** `feat(muscu): bouton Filtres + tiroir dans exercises.tsx (MUSC-F3)`

---

### Task 8 : Seed dev — matériel plausible sur les 16 exercices

**Files :**
- Modify : `supabase/seed.sql`

- [ ] **Step 1 — Renseigner `equipment`** sur les 16 lignes `insert into public.exercises` (ligne
  36-54), en cohérence avec chaque exercice (ex. développé couché/incliné → `barbell`, pompes →
  `bodyweight`, traction → `bodyweight`, rowing barre → `barbell`, tirage vertical → `cable`,
  squat/soulevé de terre → `barbell`, presse à cuisses → `machine`, fente → `dumbbell`, développé
  militaire → `barbell`, élévations latérales → `dumbbell`, curl biceps/extension triceps →
  `dumbbell`, planche/crunch → `bodyweight`). Remplacer chaque `null,` de la colonne `equipment`
  par la valeur choisie (colonne 5 du tuple, entre `muscle_primary` et `media_url`).
- [ ] **Step 2 — Non-régression.** Le seed reste idempotent (`on conflict (id) do nothing` déjà en
  place) — pas de changement de structure, uniquement des valeurs.
- [ ] **Step 3 — Commit.** `chore(seed): matériel plausible sur les 16 exercices de bibliothèque (MUSC-F3)`

> Note : ce commit ne modifie que le fichier `seed.sql` (dev local / futur `db:reset`) — il ne
> touche **pas** le cloud partagé. Les 16 exercices déjà présents sur `nsxzflxsgovriwwvflxe` restent
> `equipment = null` tant qu'ils ne sont pas réédités via l'admin (tâche de contenu, hors code).

---

### Task 9 : Migration — contrainte `CHECK` sur `exercises.equipment` (🔴 checkpoint cloud)

**Files :**
- Create : `supabase/migrations/<timestamp>_muscf3_equipment_check.sql` (via `npm run db:new muscf3_equipment_check`)
- Modify : `supabase/MIGRATIONS.md`

- [ ] **Step 1 — Vérification préalable (arrêt, action humaine).** Avant tout, demander à Florian
  d'exécuter sur le **SQL Editor cloud** (`nsxzflxsgovriwwvflxe`) :
  ```sql
  select distinct equipment from exercises where equipment is not null;
  ```
  Si une valeur hors liste (`barbell,dumbbell,machine,cable,bodyweight,kettlebell,band,other`)
  apparaît, la nettoyer via l'admin (Task 2) **avant** de continuer — sinon la migration échouera à
  l'application. **Ne pas passer à l'étape 2 sans confirmation de Florian.**
- [ ] **Step 2 — Créer la migration.** `npm run db:new muscf3_equipment_check`, puis contenu :
  ```sql
  alter table public.exercises
    add constraint exercises_equipment_check
    check (equipment is null or equipment in
      ('barbell','dumbbell','machine','cable','bodyweight','kettlebell','band','other'));
  ```
- [ ] **Step 3 — Prévisualiser.** `npm run db:push:dry` — vérifier que seule cette migration
  apparaît comme manquante.
- [ ] **Step 4 — Go explicite de Florian, puis pousser.** `npm run db:push`. **Pas de `db:types`**
  (aucune colonne ajoutée — seule une contrainte, le type généré ne change pas).
- [ ] **Step 5 — Registre.** Cocher la migration dans
  [supabase/MIGRATIONS.md](../../../../supabase/MIGRATIONS.md) (case + date).
- [ ] **Step 6 — Commit.** `chore(db): contrainte CHECK sur exercises.equipment (MUSC-F3)`

---

### Task 10 : Revue finale + clôture

- [ ] **Step 1 — Revue finale** (subagent `superpowers:code-reviewer` sur le diff complet de la
  branche `feature/muscf3-recherche-multicriteres`, comparé à la spec).
- [ ] **Step 2 — Vérifs globales.** `npm run typecheck` + `npm run lint` + `npm run test` (racine,
  tous workspaces) verts.
- [ ] **Step 3 — Clôture** via `finishing-a-development-branch` puis `/commit` (CHANGELOG + TODO :
  passer MUSC-F3 en **code livré**, roadmap item **3.14** → 🟡 ou ✅ selon relecture, marquer
  « reste recette device + relecture Damien »).

---

## Definition of Done (rappel spec §6)

Bouton Filtres + tiroir (groupe musculaire + matériel) sur `ExercisePicker` et `exercises.tsx` ;
sémantique OU intra-facette / ET inter-facette / ET avec la recherche texte ; matériel en liste
contrôlée (`EQUIPMENTS`, déjà présent dans `packages/shared`, désormais branché : contrainte DB +
admin + i18n mobile) ; ligne exercice affiche le matériel quand renseigné ; état vide dédié
« aucun résultat pour ces filtres » ; seed dev enrichi pour la recette ; `buildExerciseFilterClause`
pur testé Vitest ; typecheck/lint/tests verts (shared + mobile + admin) ; migration (contrainte
seule) poussée après vérification + go explicite ; PR relue par les deux devs.
