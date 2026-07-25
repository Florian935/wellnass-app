# CONF-01 — Export des données (RGPD) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans. Steps en cases `- [ ]`.
> ⚠️ **Workflow projet** : ne PAS exécuter avant validation des 3 livrables (spec ✅ + plan + maquette).
> **Aucune migration, aucun serveur, aucun checkpoint cloud** — 100 % local/hors-ligne.

**Goal :** exporter toutes les données personnelles de l'utilisateur dans un fichier JSON, depuis la base
locale PowerSync, livré via la feuille de partage OS.

**Architecture :** helper **pur** `@wellness/shared` (envelope + nom de fichier, testé Vitest) + lib mobile
`data-export.ts` (patron `gpx-export.ts` : requêtes locales `powerSync.getAll` sur 28 tables filtrées
possession + `deleted_at IS NULL` → assemblage → écriture cache → `Sharing.shareAsync`) + entrée Réglages.

**Tech stack :** TypeScript, Vitest (shared), PowerSync (`getAll`), `expo-file-system/legacy`, `expo-sharing`,
i18next, Zustand (`auth-store` pour `userId`), `@powersync/react` (`useStatus().hasSynced`).

**Spec :** [docs/specs/functional/us/conf01-export-donnees.md](../specs/functional/us/conf01-export-donnees.md)

---

## Structure des fichiers

**Créer :**
- `packages/shared/src/data-export.ts` (+ `data-export.test.ts`) — `buildExportEnvelope`, `exportFileName` (purs).
- `apps/mobile/src/lib/data-export.ts` — orchestration lecture locale + écriture + partage.

**Modifier :**
- `packages/shared/src/index.ts` — `export * from './data-export';`.
- `apps/mobile/src/app/settings.tsx` — section « Données » + bouton « Exporter mes données ».
- `apps/mobile/src/i18n/locales/fr.json` + `en.json` — clés export + maj `account.delete.exportHint`.

---

## Task 1 : Helper pur (`@wellness/shared`)

**Files:** `packages/shared/src/data-export.ts`, `packages/shared/src/data-export.test.ts`, `packages/shared/src/index.ts`

- [ ] **Step 1 : test qui échoue** (`data-export.test.ts`) :

```ts
import { describe, expect, it } from 'vitest';
import { buildExportEnvelope, exportFileName } from './data-export';

describe('data export', () => {
  it('assemble l’enveloppe (en-tête + data)', () => {
    const env = buildExportEnvelope({
      userId: 'u1', exportedAt: '2026-07-23T10:00:00.000Z', syncComplete: true,
      tables: { workouts: [{ id: 'w1' }], runs: [] },
    });
    expect(env).toEqual({
      app: 'Wellness', formatVersion: 1, exportedAt: '2026-07-23T10:00:00.000Z',
      userId: 'u1', syncComplete: true, data: { workouts: [{ id: 'w1' }], runs: [] },
    });
  });
  it('nom de fichier daté', () => {
    // Date construite en LOCAL (pas d'ISO+Z) → robuste au fuseau du runner CI.
    expect(exportFileName(new Date(2026, 6, 23))).toBe('wellness-export-2026-07-23.json');
  });
});
```

- [ ] **Step 2 : lancer → échec** `npm run test -w @wellness/shared`.
- [ ] **Step 3 : implémenter** (`data-export.ts`) :

```ts
export type ExportEnvelope = {
  app: 'Wellness';
  formatVersion: number;
  exportedAt: string;      // ISO UTC
  userId: string;
  syncComplete: boolean;
  data: Record<string, unknown[]>;
};

/** Assemble l'objet d'export final (en-tête RGPD + une section par table). Pur. */
export function buildExportEnvelope(input: {
  userId: string;
  exportedAt: string;
  syncComplete: boolean;
  tables: Record<string, unknown[]>;
}): ExportEnvelope {
  return {
    app: 'Wellness',
    formatVersion: 1,
    exportedAt: input.exportedAt,
    userId: input.userId,
    syncComplete: input.syncComplete,
    data: input.tables,
  };
}

/** Nom de fichier daté (date locale) : wellness-export-AAAA-MM-JJ.json. */
export function exportFileName(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `wellness-export-${yyyy}-${mm}-${dd}.json`;
}
```

> ✅ Le test construit la date en **local** (`new Date(2026, 6, 23)`, mois 0-indexé) → pas de dépendance au
> fuseau du runner (contrairement à un ISO `...Z` lu ensuite en local).

- [ ] **Step 4 : exporter** `packages/shared/src/index.ts` : `export * from './data-export';`.
- [ ] **Step 5 : lancer → succès** + `npm run typecheck`.
- [ ] **Step 6 : commit** `feat(conf01): helper pur d'export (envelope + nom de fichier, shared)`

---

## Task 2 : Orchestration mobile (`data-export.ts`)

**Files:** `apps/mobile/src/lib/data-export.ts`

- [ ] **Step 1 : implémenter** (patron `apps/mobile/src/lib/gpx-export.ts` — LIS-LE) :

```ts
import { buildExportEnvelope, exportFileName } from '@wellness/shared';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { TFunction } from 'i18next';
import { powerSync } from '@/powersync/system';

/** Tables exportées + colonne de possession. Toutes ont `deleted_at` (vérifié). */
const EXPORT_TABLES: { table: string; col: 'user_id' | 'owner_id' }[] = [
  // Compte
  { table: 'profiles', col: 'user_id' }, { table: 'user_settings', col: 'user_id' },
  { table: 'nutrition_profiles', col: 'user_id' }, { table: 'running_profiles', col: 'user_id' },
  // Muscu
  { table: 'workouts', col: 'user_id' }, { table: 'workout_sets', col: 'user_id' },
  { table: 'programs', col: 'owner_id' }, { table: 'sessions', col: 'owner_id' },
  { table: 'exercise_plans', col: 'owner_id' }, { table: 'personal_records', col: 'user_id' },
  { table: 'exercise_notes', col: 'user_id' }, { table: 'workout_superset_pairs', col: 'user_id' },
  { table: 'workout_templates', col: 'user_id' }, { table: 'workout_template_exercises', col: 'user_id' },
  { table: 'planned_sessions', col: 'owner_id' }, { table: 'exercise_favorites', col: 'user_id' },
  { table: 'exercises', col: 'owner_id' }, { table: 'exercise_variants', col: 'owner_id' },
  // Running
  { table: 'runs', col: 'user_id' }, { table: 'running_pace_records', col: 'user_id' },
  // Nutrition
  { table: 'food_entries', col: 'user_id' }, { table: 'recipes', col: 'user_id' },
  { table: 'recipe_ingredients', col: 'user_id' }, { table: 'meal_templates', col: 'user_id' },
  { table: 'meal_template_items', col: 'user_id' }, { table: 'foods', col: 'owner_id' },
  { table: 'food_favorites', col: 'user_id' }, { table: 'body_weight_entries', col: 'user_id' },
];

export type DataExportResult = { ok: true } | { error: 'unavailable' | 'failed' };

/**
 * Exporte toutes les données perso (base locale) en JSON et ouvre la feuille de partage.
 * 100 % local/hors-ligne. Les noms de tables sont des CONSTANTES (pas d'injection) ; `userId`
 * est paramétré.
 */
export async function exportUserData(
  userId: string,
  syncComplete: boolean,
  t: TFunction,
): Promise<DataExportResult> {
  try {
    const tables: Record<string, unknown[]> = {};
    for (const { table, col } of EXPORT_TABLES) {
      tables[table] = await powerSync.getAll(
        `SELECT * FROM ${table} WHERE ${col} = ? AND deleted_at IS NULL`,
        [userId],
      );
    }
    const envelope = buildExportEnvelope({
      userId, exportedAt: new Date().toISOString(), syncComplete, tables,
    });
    const uri = FileSystem.cacheDirectory + exportFileName(new Date());
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(envelope, null, 2));

    if (!(await Sharing.isAvailableAsync())) return { error: 'unavailable' };
    await Sharing.shareAsync(uri, {
      mimeType: 'application/json',
      dialogTitle: t('account.export.dialogTitle'),
    });
    return { ok: true };
  } catch (err) {
    console.warn('[data-export] échec:', err);
    return { error: 'failed' };
  }
}
```

- [ ] **Step 2 : vérifier** `npm run typecheck` + `npm run lint`. (Pas de test unitaire : I/O natif, comme
  `gpx-export.ts` ; la logique testable est dans le helper shared.)
- [ ] **Step 3 : commit** `feat(conf01): orchestration d'export local (lecture 28 tables + partage)`

---

## Task 3 : Entrée Réglages + i18n + maj exportHint

**Files:** `apps/mobile/src/app/settings.tsx`, `apps/mobile/src/i18n/locales/fr.json`, `en.json`

- [ ] **Step 1 : i18n** (FR + EN, parité, JSON valide) :
  - `settings.dataExport` : `{ title: "Données", subtitle: "Récupère une copie de toutes tes données au format JSON (RGPD).", button: "Exporter mes données" }`.
  - `account.export` : `{ dialogTitle, syncWarningTitle, syncWarningBody, errorUnavailable, errorFailed }`.
  - **Maj** `account.delete.exportHint` : retirer « (bientôt disponible) » → « Pense à exporter tes données (Réglages → Exporter mes données) au préalable. » (EN équivalent).

- [ ] **Step 2 : câbler dans `settings.tsx`** — importer `exportUserData` (`@/lib/data-export`). ⚠️ **Ajouter
  `Alert` à l'import `react-native`** (utilisé ci-dessous, PAS encore importé — sinon typecheck KO).
  `useState`, `useAuthStore` et `useStatus` (`@powersync/react`) sont **déjà importés** — les réutiliser
  (`useStatus()` est déjà appelé pour `connected` : **destructurer `hasSynced` du même appel**, ne pas en
  refaire un second). Dans le composant :

```ts
  // useStatus() est déjà appelé plus haut pour `connected` → ajouter hasSynced à cette destructuration :
  //   const { connected, hasSynced } = useStatus();
  const userId = useAuthStore((s) => s.session?.user.id) ?? null;
  const [exporting, setExporting] = useState(false);

  const runExport = async () => {
    if (!userId) return;
    setExporting(true);
    const res = await exportUserData(userId, !!hasSynced, t);
    setExporting(false);
    if ('error' in res) {
      Alert.alert(t(res.error === 'unavailable' ? 'account.export.errorUnavailable' : 'account.export.errorFailed'));
    }
  };

  const onExport = () => {
    if (!hasSynced) {
      Alert.alert(t('account.export.syncWarningTitle'), t('account.export.syncWarningBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('settings.dataExport.button'), onPress: () => void runExport() },
      ]);
      return;
    }
    void runExport();
  };
```

- [ ] **Step 3 : section UI** — au-dessus de la Zone de danger (après le bloc signOut, avant « Zone de
  danger ») : titre `settings.dataExport.title` + sous-titre + `<Button label={t('settings.dataExport.button')}
  onPress={onExport} loading={exporting} />`. Réutiliser `styles.sectionTitle`/`hint`. **Export fonctionne
  hors-ligne** → PAS de désactivation sur `!connected` (≠ suppression).

- [ ] **Step 4 : vérifier** `npm run typecheck` + `npm run lint` + `npm run test -w @wellness/mobile` verts ;
  JSON i18n valide + parité.
- [ ] **Step 5 : commit** `feat(conf01): entrée Réglages « Exporter mes données » + i18n + maj exportHint`

---

## Task 4 : Parité i18n + suite complète + clôture

- [ ] **Step 1 : parité FR/EN** des clés `settings.dataExport.*`, `account.export.*`, `account.delete.exportHint`.
- [ ] **Step 2 : suite complète** — `npm run typecheck` + `npm run lint` + `npm run test` (shared + mobile) verts.
- [ ] **Step 3 : revue finale** (offline-first respecté ; noms de tables = constantes, pas d'injection ;
  `deleted_at IS NULL` partout ; aucune chaîne en dur ; éditorial exclu par le filtre `owner_id`).
- [ ] **Step 4 : clôture** — `TODO.md` (Code `[x]`), push via `/commit`.

---

## Notes de test

- **Helper shared** : Vitest (structure envelope + nom de fichier).
- **`data-export.ts`** : pas de test unitaire (I/O natif) — vérifié en revue + recette. Éventuel test futur
  du map `EXPORT_TABLES` (28 entrées, colonnes cohérentes) si on veut le garde-fou.
- **Recette manuelle** (spec §9) : export nominal (JSON ouvert, en-tête + sections), complétude (données de
  l'app retrouvées), éditorial absent, hors-ligne OK, avertissement synchro, i18n.

## Points d'attention

- **Aucune migration / aucun serveur** : que du code JS → reload Metro suffit.
- **Sécurité SQL** : `${table}`/`${col}` interpolés sont des **constantes** internes (jamais d'entrée
  utilisateur) → pas d'injection ; `userId` reste paramétré (`?`).
- **Volume** : `runs.gps_track` peut être gros (traces) — seul champ à risque mémoire ; acceptable en V1
  (noté spec §5), à surveiller.
- **Ordre** : shared (1) → orchestration (2) → Réglages/i18n (3) → clôture (4). Toutes JS, aucune dépendance
  cloud.
