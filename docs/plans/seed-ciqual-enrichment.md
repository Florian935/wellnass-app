# Plan d'implémentation — Enrichissement du seed CIQUAL

> **Statut** : ✅ livré (14/07/2026) — voir la révision d'approche ci-dessous (supersède le détail des tâches).
> Spec : [seed-ciqual-enrichment.md](../specs/functional/us/seed-ciqual-enrichment.md).
> Branche : `feature/seed-ciqual-enrichment`.
>
> ### ⚠️ Révision (14/07/2026) — réalisé
> - **Approche A** : bibliothèque reconstruite depuis CIQUAL 2025 (50 identités conservées, toute la
>   nutrition — macros de base incluses — depuis CIQUAL) **+ 30 aliments** ajoutés → **80** au total.
> - **Livraison = migration idempotente** `supabase/migrations/20260714120000_seed_library_foods_ciqual.sql`
>   (upsert) au lieu de seed.sql + one-shot console (nouvelle règle « jamais de SQL manuel »). Les
>   aliments **quittent `seed.sql`** (pointeur vers la migration).
> - **Tooling** `supabase/scripts/enrich-ciqual/` : `generate.py` (stdlib) + `foods-catalog.json`
>   (source unique éditable) + `mapping-columns.json`. Export brut CIQUAL hors git.
> - **Reste (Florian)** : `npm run db:push` (cloud) + cocher MIGRATIONS.md + `npm run db:reset` (local)
>   + `db:types` + recette device.

**Objectif :** compléter les ~50 aliments du seed avec les micros + sous-macros CIQUAL, via un
générateur reproductible (aucune valeur saisie à la main), sans toucher les macros de base.

**Architecture :** outillage dev sous `supabase/scripts/enrich-ciqual/` — `generate.mjs` lit l'export
CIQUAL (CSV, hors git) + `mapping-foods.json` (UUID→code) + `mapping-columns.json` (colonne→clé/unité)
→ émet des `UPDATE public.foods` dans `seed.sql` (entre marqueurs) et dans `cloud-update.sql`.

**Tech :** Node ESM (aucune dépendance runtime), Vitest pour les fonctions pures. Pas de code applicatif.

---

## Task 0 — Prérequis (BLOQUANT) : obtenir l'export CIQUAL

- [ ] Florian fournit l'export officiel ANSES CIQUAL au format **CSV** (idéalement la table complète
  ou au moins les lignes des ~50 aliments), déposé dans le scratchpad (hors git). Confirmer le
  **séparateur** (`;` vs `,`), l'**encodage** (UTF-8/Latin-1) et récupérer la **ligne d'en-tête**
  (intitulés exacts des colonnes) — indispensable pour figer `mapping-columns.json`.

## Task 1 — Fonctions pures de normalisation (TDD)

**Files:**
- Create: `supabase/scripts/enrich-ciqual/normalize.mjs`
- Test: `supabase/scripts/enrich-ciqual/normalize.test.mjs`

- [ ] **Step 1 — test d'abord** (`normalize.test.mjs`) : `parseCiqualValue` renvoie un nombre ou `null`.
```js
import { describe, it, expect } from 'vitest';
import { parseCiqualValue } from './normalize.mjs';
describe('parseCiqualValue', () => {
  it('parse les nombres FR (virgule, espaces milliers)', () => {
    expect(parseCiqualValue('12,5')).toBe(12.5);
    expect(parseCiqualValue('1 234,5')).toBe(1234.5);
  });
  it('omet traces / NC / vide / tiret / seuils < x (→ null)', () => {
    for (const t of ['traces', 'Traces', 'NC', '', '-', '< 0,5', '< 0.5']) {
      expect(parseCiqualValue(t)).toBeNull();
    }
  });
  it('omet ≤ 0 et non finis (→ null)', () => {
    expect(parseCiqualValue('0')).toBeNull();
    expect(parseCiqualValue('abc')).toBeNull();
  });
});
```
- [ ] **Step 2 — run → échec** : `npx vitest run supabase/scripts/enrich-ciqual/normalize.test.mjs` → FAIL.
- [ ] **Step 3 — implémenter** `normalize.mjs` :
```js
/** Parse une cellule CIQUAL en nombre exploitable, ou null (present-only). */
export function parseCiqualValue(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s === '-') return null;
  const low = s.toLowerCase();
  if (low === 'traces' || low === 'nc' || low.startsWith('<')) return null; // pas d'approximation
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}
```
- [ ] **Step 4 — run → vert**. 
- [ ] **Step 5 — commit** : `test(seed): fonctions pures de normalisation CIQUAL (present-only)`

## Task 2 — Correspondance colonnes CIQUAL → clés internes

**Files:** Create `supabase/scripts/enrich-ciqual/mapping-columns.json`

- [ ] D'après l'**en-tête réel** (Task 0), créer un tableau `[{ ciqualColumn, target, factor }]` où
  `target` = une clé micro (ex. `magnesium_mg`) **ou** une colonne sous-macro
  (`sugars_per_100g`/`saturated_fat_per_100g`/`fiber_per_100g`). Couvrir les 31 micros + 3 sous-macros.
  `factor` = 1 par défaut (CIQUAL déjà en mg/µg/g pour 100 g) ; tout écart d'unité explicité ici.
- [ ] Cas particuliers : **oméga** (mapper la colonne la plus directe, ex. « Oméga 3 » / « AG 18:3 n-3 » →
  `omega_3_g` si disponible, sinon omettre) ; **vitamine A** (« Vitamine A (µg/100g) » → `vitamin_a_ug`,
  sinon omettre — pas d'équivalent calculé). Toute colonne non mappée est ignorée.

## Task 3 — Correspondance aliments seed → codes CIQUAL (relue Florian)

**Files:** Create `supabase/scripts/enrich-ciqual/mapping-foods.json`

- [ ] Extraire les ~50 aliments de `seed.sql` (UUID + `name_fr`). Proposer pour chacun le
  **code aliment CIQUAL** correspondant (`[{ id, nameFr, ciqualCode }]`).
- [ ] **Checkpoint validation Florian** : relire `mapping-foods.json` (l'identité de chaque aliment
  doit être juste). Corriger les appariements douteux avant génération.

## Task 4 — Générateur + injection dans seed.sql / cloud-update.sql

**Files:**
- Create: `supabase/scripts/enrich-ciqual/generate.mjs`, `supabase/scripts/enrich-ciqual/cloud-update.sql`
- Modify: `supabase/seed.sql` (bloc entre marqueurs `-- >>> CIQUAL enrichment (généré) <<<`)

- [ ] `generate.mjs` (args : chemin du CSV CIQUAL) : parse CSV → indexe par code CIQUAL → pour chaque
  entrée de `mapping-foods` : lit la ligne, applique `mapping-columns` + `parseCiqualValue`, assemble
  le JSON `micronutrients` (clés présentes uniquement) + les 3 sous-macros, émet
  `UPDATE public.foods SET micronutrients='…'::jsonb, sugars_per_100g=…, saturated_fat_per_100g=…,
  fiber_per_100g=… WHERE id='<uuid>';`. **Ne touche pas** aux macros de base.
- [ ] **Audit** : le script loggue chaque aliment sans correspondance et chaque colonne mappée absente
  du CSV (aucune valeur inventée silencieusement). Résumé : N aliments enrichis / M champs remplis.
- [ ] Écrit le bloc entre marqueurs dans `seed.sql` (régénération = remplacement, pas d'empilement) et
  le duplique dans `cloud-update.sql` (idempotent).
- [ ] Lancer le générateur sur le fichier réel ; vérifier le log d'audit (0 anomalie inattendue).

## Task 5 — Vérification + attribution + commit

- [ ] **db:reset local** (Docker requis) → le seed enrichi s'applique sans erreur ; spot-check SQL
  (`select name, micronutrients from …` sur 2-3 aliments).
- [ ] **Attribution** : commentaire en tête du bloc `seed.sql` + note doc (source ANSES CIQUAL, licence
  Etalab). Ajouter le motif de l'export brut à `.gitignore` du dossier scripts si besoin.
- [ ] typecheck / lint / tests verts (`npx vitest run supabase/scripts/enrich-ciqual`).
- [ ] **Commit** : `feat(seed): enrichit les aliments du seed avec les micros/sous-macros CIQUAL`.
- [ ] **Checkpoint 🔴 (Florian)** : appliquer `cloud-update.sql` sur le projet cloud + recette device
  (2-3 aliments → panel étendu peuplé).

## Definition of Done

- Générateur + 2 mappings + SQL généré committés ; export brut hors git ; attribution présente.
- `mapping-foods.json` validé par Florian. Tests verts. Audit sans valeur inventée.
- `seed.sql` enrichi ; `cloud-update.sql` prêt (application cloud = checkpoint 🔴).

## Risques

- **Intitulés/unités CIQUAL** : `mapping-columns.json` dépend de l'en-tête réel → à figer en Task 2.
- **Appariement** : mauvais code CIQUAL → mauvaises valeurs → relecture Florian obligatoire (Task 3).
- **Docker** pour `db:reset` : si indisponible, valider la génération par lecture du SQL + application
  cloud directe (checkpoint) plutôt que reset local.
