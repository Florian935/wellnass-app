# CORPS-04 — Programme compatible Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permettre à l'utilisateur de comparer son programme actif à des programmes éditoriaux de musculation selon ses priorités corporelles et son contexte, puis de préparer une copie personnelle inactive sans modifier l'original.

**Architecture:** Un moteur pur partagé calcule durée, couverture, compatibilité et ordre. Deux repositories mobiles séparés lisent le contexte/profil et les programmes depuis SQLite ; la copie éditoriale est une transaction CAS dédiée. Un écran Expo Router compose l'éditeur de contexte et des cartes explicables, en gardant la décision d'activation dans le parcours existant.

**Tech Stack:** TypeScript, Zod, React Native 0.83, Expo Router 7 / Expo SDK 57, PowerSync SQLite, Supabase/PostgreSQL, Jest, Testing Library React Native.

---

## Task 0: Rebaser fonctionnellement le lot sur `origin/dev`

**Files:**
- Modify only files reported as conflicts by Git
- Verify: `apps/mobile/src/app/strength-profile.tsx`
- Verify: `packages/shared/src/profile.ts`
- Verify: `supabase/migrations/20260913184252_guid01_goal_guidance.sql`

**Step 1: Fetch and merge the current integration branch**

Run: `git fetch origin dev && git merge --no-edit origin/dev`

Expected: the GUID-01 profile implementation becomes available. The three migration files already copied in CORPS-03 must remain byte-identical to `origin/dev` and must not be duplicated or renamed.

**Step 2: Resolve every conflict explicitly**

Preserve all CORPS-01/02/03 files and all current `origin/dev` behavior. For generated database types, keep the union of columns. For roadmap, recipes and changelog, preserve both histories in chronological order and recompute counters rather than choosing one side wholesale.

Run: `git diff --check && git status --short`

Expected: no unmerged path and no whitespace error.

**Step 3: Run integration smoke tests**

Run:

```powershell
npm test --workspace @wellness/shared -- --runInBand profile.test.ts body-training-recommendation.test.ts
npm test --workspace @wellness/mobile -- --runInBand strength-profile body-training
npm run typecheck --workspace @wellness/shared
npm run typecheck --workspace @wellness/mobile
```

Expected: PASS. If Jest filters have different exact filenames after the merge, list them with `rg --files` and run their exact paths.

**Step 4: Commit the integration**

```powershell
git add -A
git commit -m "chore(corps): aligner le lot sur dev"
```

## Task 1: Construire le moteur pur de recommandation

**Files:**
- Create: `packages/shared/src/strength-program-recommendation.ts`
- Create: `packages/shared/src/__tests__/strength-program-recommendation.test.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Write failing domain tests**

Cover these cases with compact fixtures:

- a session with known working sets uses `sets × (45 + rest/default 90)` plus 60 seconds between exercise lines, rounded up;
- a warm-up line does not invalidate the estimate; an unknown working-set count returns `null`;
- exact fine-muscle associations cover a requested zone and sum only known sets;
- general associations are exposed but never satisfy a fine-muscle criterion;
- unavailable days, unavailable equipment and excessive known duration populate `issues` and set `compatible=false`;
- `null` context means “not constrained”; bodyweight and null equipment always pass;
- compatible candidates sort before incompatible candidates, followed by fine coverage, requested zones, level, current program, schedule proximity and id;
- only three compatible results are returned; if none is compatible, only three incompatible explanations are returned;
- the same normalized source snapshot always has the same fingerprint, while any copied field change changes it.

Run: `npm test --workspace @wellness/shared -- --runInBand strength-program-recommendation.test.ts`

Expected: FAIL because the module does not exist.

**Step 2: Define strict schemas and types**

Implement and export:

```ts
export const STRENGTH_SESSION_MINUTES = [30, 45, 60, 75, 90] as const;
export const strengthSessionMinutesSchema = z.enum(['30', '45', '60', '75', '90']).transform(Number);
export const strengthProgramContextSchema = z.object({
  level: trainingLevelSchema.nullable(),
  weeklyAvailability: z.number().int().min(1).max(7).nullable(),
  sessionMinutes: z.union(STRENGTH_SESSION_MINUTES.map((n) => z.literal(n))).nullable(),
  equipment: z.array(equipmentSchema).nonempty().nullable(),
});
```

Normalize equipment by `EQUIPMENTS` order and reject duplicates at the repository boundary. Define a complete `StrengthProgramSourceSnapshot` containing all copied program fields, translations, session fields/translations and exercise-plan prescription fields. Define candidate and recommendation contracts from the functional spec, including `issues`.

**Step 3: Implement deterministic calculations**

Implement:

```ts
estimateStrengthSessionMinutes(session)
fingerprintStrengthProgram(snapshot)
recommendStrengthPrograms(candidates, priorities, context)
```

Use a canonical JSON serializer with stable key and array ordering and a deterministic pure hash available in both Node and React Native; do not add a native dependency. Preserve `null` as unknown. Coverage contains requested fine muscles and known planned sets per zone. Use only `muscles_fine` for exact coverage.

**Step 4: Run tests and shared checks**

Run:

```powershell
npm test --workspace @wellness/shared -- --runInBand strength-program-recommendation.test.ts
npm run lint --workspace @wellness/shared
npm run typecheck --workspace @wellness/shared
```

Expected: PASS.

**Step 5: Commit**

```powershell
git add packages/shared/src/strength-program-recommendation.ts packages/shared/src/__tests__/strength-program-recommendation.test.ts packages/shared/src/index.ts
git commit -m "feat(corps): calculer les programmes compatibles"
```

## Task 2: Stocker le contexte musculation en offline-first

**Files:**
- Create: `supabase/migrations/20260915HHMMSS_corps04_strength_program_context.sql`
- Modify: `packages/shared/src/profile.ts`
- Modify: `packages/shared/src/database.types.ts`
- Modify: `apps/mobile/src/powersync/schema.ts`
- Modify: `apps/mobile/src/powersync/connector.ts`
- Create: `apps/mobile/src/data/repositories/strength-program-context-repository.ts`
- Create: `apps/mobile/src/data/repositories/__tests__/strength-program-context-sql.test.ts`
- Modify: relevant profile/shared tests discovered with `rg`

**Step 1: Write failing schema and SQLite tests**

Test parsing for valid minutes/equipment, rejection of `[]`, duplicates and unknown equipment. In an in-memory PowerSync database, test:

- `useStrengthProgramContext` mapping of GUID-01 level/availability and new nullable fields;
- JSON string decoding and canonical equipment order;
- `saveStrengthProgramContext(context, expectedUpdatedAt)` writes only the two CORPS-04 fields;
- stale timestamp, changed user and deleted profile reject without partial write;
- the connector decodes `profiles.strength_equipment` before upload.

Run the exact new tests. Expected: FAIL.

**Step 2: Add additive database columns**

Migration requirements:

```sql
strength_session_minutes integer null
  check (strength_session_minutes in (30,45,60,75,90)),
strength_equipment jsonb null
  check (jsonb_typeof(strength_equipment) = 'array' and jsonb_array_length(strength_equipment) > 0)
```

The JSON constraint applies only when non-null. Update generated-like TS types manually in this branch using the existing project convention. Add both columns to the local PowerSync `profiles` table and `strength_equipment` to `JSON_COLUMNS.profiles`.

**Step 3: Implement the dedicated repository**

Read the one current profile row reactively. Parse with shared schemas and retain `updatedAt` as the CAS token. On save, re-read auth and profile inside one write transaction, compare exact `updated_at`, serialize canonical equipment, set a single new timestamp and update only the two fields plus `updated_at`.

Do not use `upsertProfile`: it has broader semantics and cannot prove the context shown is still current.

**Step 4: Run targeted validation**

```powershell
npm test --workspace @wellness/shared -- --runInBand profile.test.ts strength-program-recommendation.test.ts
npm test --workspace @wellness/mobile -- --runInBand strength-program-context-sql connector
npm run typecheck --workspace @wellness/shared
npm run typecheck --workspace @wellness/mobile
```

Expected: PASS.

**Step 5: Commit**

```powershell
git add supabase/migrations packages/shared/src/profile.ts packages/shared/src/database.types.ts apps/mobile/src/powersync apps/mobile/src/data/repositories/strength-program-context-repository.ts apps/mobile/src/data/repositories/__tests__/strength-program-context-sql.test.ts
git commit -m "feat(corps): enregistrer le contexte du programme"
```

## Task 3: Lire des candidats complets et cohérents

**Files:**
- Create: `apps/mobile/src/data/repositories/strength-program-recommendation-repository.ts`
- Create: `apps/mobile/src/data/repositories/__tests__/strength-program-recommendation-sql.test.ts`
- Modify only if a helper is shared: `apps/mobile/src/data/repositories/body-training-program-repository.ts`

**Step 1: Write failing SQLite fixtures**

Build editorial and personal fixtures for programs, translations, sessions, session translations, plans and exercises. Assert:

- only published, non-deleted `strength` editorial programs are candidates;
- the current active personal program is added exactly once;
- another user's data and unrelated pillar never leak;
- language resolution follows current language → French → base field;
- deleted child rows never contribute;
- all fields copied by Task 4 are present in `sourceSnapshot` and its fingerprint;
- exercise equipment, fine and general muscle tags map safely; malformed JSON makes the row incomplete, not falsely compatible;
- loading, empty and read-error states remain distinct.

Run: `npm test --workspace @wellness/mobile -- --runInBand strength-program-recommendation-sql.test.ts`

Expected: FAIL.

**Step 2: Implement one coherent reactive read**

Expose:

```ts
type StrengthProgramCandidateResult = {
  candidates: StrengthProgramCandidate[];
  isLoading: boolean;
  error: Error | null;
};
function useStrengthProgramCandidates(): StrengthProgramCandidateResult;
```

Use a stable list query for eligible program ids, then one SQLite snapshot/read transaction for all headers and children. Validate ownership at program and child level. Resolve names using existing translation helpers. Compute the fingerprint only after the snapshot is normalized and fully validated.

**Step 3: Run repository tests and typecheck**

```powershell
npm test --workspace @wellness/mobile -- --runInBand strength-program-recommendation-sql.test.ts body-training-program-sql.test.ts
npm run typecheck --workspace @wellness/mobile
```

Expected: PASS.

**Step 4: Commit**

```powershell
git add apps/mobile/src/data/repositories/strength-program-recommendation-repository.ts apps/mobile/src/data/repositories/__tests__/strength-program-recommendation-sql.test.ts apps/mobile/src/data/repositories/body-training-program-repository.ts
git commit -m "feat(corps): lire les programmes a comparer"
```

## Task 4: Préparer une copie éditoriale avec contrôle de concurrence

**Files:**
- Modify: `apps/mobile/src/data/repositories/program-repository.ts`
- Modify: `apps/mobile/src/data/repositories/__tests__/program-sql.test.ts`
- Modify: `apps/mobile/src/data/repositories/strength-program-recommendation-repository.ts`

**Step 1: Write failing transactional tests**

Test `prepareCompatibleStrengthProgram(sourceProgramId, expectedFingerprint)`:

- copies a published editorial strength program into a new owned inactive published program;
- remaps all session ids and copies program/session translations and every exercise plan field;
- appends ` — adapté à mes priorités` for French translations and ` — tailored to my priorities` for English translations;
- leaves other language names unchanged or uses the English suffix according to the documented fallback;
- never changes original/current activation;
- rejects personal, draft, deleted, non-strength and missing sources;
- rejects a source whose header, translation, session, translation or plan changed after recommendation;
- rejects changed account;
- two taps with the same expected fingerprint cannot leave two copies from one in-flight UI action; the UI action lock covers rapid taps, and each DB transaction stays atomic.

Run: `npm test --workspace @wellness/mobile -- --runInBand program-sql.test.ts`

Expected: FAIL for the new behavior.

**Step 2: Extract the existing copy primitive**

Refactor `duplicateProgram` only enough to share an internal transaction helper. Preserve every existing running and strength duplication test. The helper accepts validated source rows and a name transform; it still creates new UUIDs and `is_active=0`.

**Step 3: Add the guarded strength operation**

Inside one `powerSync.writeTransaction`:

1. capture and recheck `currentUserId()`;
2. reload and normalize the entire editorial strength source;
3. assert owner null, published, not deleted;
4. recompute and compare the canonical fingerprint;
5. create one personal inactive copy with localized suffixes;
6. return its id.

Use typed domain errors so the UI can distinguish “source changed” from storage failure. Do not activate, schedule or alter exercise prescription.

**Step 4: Run regression tests**

```powershell
npm test --workspace @wellness/mobile -- --runInBand program-sql.test.ts strength-program-recommendation-sql.test.ts
npm run typecheck --workspace @wellness/mobile
```

Expected: all existing duplication tests and the new CAS tests PASS.

**Step 5: Commit**

```powershell
git add apps/mobile/src/data/repositories/program-repository.ts apps/mobile/src/data/repositories/strength-program-recommendation-repository.ts apps/mobile/src/data/repositories/__tests__
git commit -m "feat(corps): preparer une copie de programme"
```

## Task 5: Livrer le parcours mobile explicable

**Files:**
- Create: `apps/mobile/src/app/body-training-programs.tsx`
- Create: `apps/mobile/src/app/__tests__/body-training-programs-screen.test.tsx`
- Create: `apps/mobile/src/components/body/StrengthProgramContextEditor.tsx`
- Create: `apps/mobile/src/components/body/StrengthProgramRecommendationCard.tsx`
- Modify: `apps/mobile/src/app/body-training.tsx`
- Modify: `apps/mobile/src/app/_layout.tsx`
- Modify: `apps/mobile/src/i18n/locales/fr.json`
- Modify: `apps/mobile/src/i18n/locales/en.json`

**Step 1: Write failing interaction tests**

Mock only repositories and router. Cover:

- absent/unconfirmed priorities redirects or presents the explicit link back;
- prefilled level/availability are labelled “À confirmer” when null;
- draft duration/equipment survives read, empty and CAS error states;
- compare shows at most three deterministic cards, positive reasons and explicit issues without numeric score;
- unknown duration and general-only coverage are worded honestly;
- current program action opens `/programs/edit?id=...` without duplication;
- editorial action shows confirmation, invokes guarded copy once, then opens the copied id in the editor;
- source/context/priorities conflict asks for recalculation;
- loading, empty library, current-only and read failure differ;
- accessibility roles, selected states and labels exist for all controls.

Run: `npm test --workspace @wellness/mobile -- --runInBand body-training-programs-screen.test.tsx`

Expected: FAIL.

**Step 2: Implement the context editor**

Reuse the GUID-01 level/availability facts in read-only summary with a link to `/strength-profile`. Offer 30/45/60/75/90 minute choices and toggle chips for canonical equipment. “Tout le matériel” maps to `null`; never write `[]`. Save explicitly with the profile timestamp and keep the draft after conflict.

**Step 3: Implement recommendation cards**

Show localized program name, current/editorial badge, level, session count, per-session estimated durations, required equipment, exact known sets per priority, missing fine muscles and general associations. Derive wording from `reasons` and `issues`; never render a body-result score, promise or date.

**Step 4: Implement screen state and guarded actions**

The compare button snapshots:

- confirmed priority document timestamp/content;
- saved context/profile timestamp/content;
- candidate fingerprints.

Before action, verify these values still match. Use `useActionLock` and a confirmation modal. Current personal program navigates directly. Editorial program calls `prepareCompatibleStrengthProgram` and then `router.push('/programs/edit?id=' + newId)`.

Register the route and add an entry button under the confirmed CORPS-03 result. Add complete FR/EN strings with no concatenated sentences.

**Step 5: Run UI validation**

```powershell
npm test --workspace @wellness/mobile -- --runInBand body-training-programs-screen.test.tsx body-training-screen.test.tsx
npm run lint --workspace @wellness/mobile
npm run typecheck --workspace @wellness/mobile
```

Render/inspect at minimum FR/EN, light/dark, 320 px, font scale 1.6. Correct clipping, overflow, target sizes and misleading text before committing.

**Step 6: Commit**

```powershell
git add apps/mobile/src/app/body-training-programs.tsx apps/mobile/src/app/__tests__/body-training-programs-screen.test.tsx apps/mobile/src/components/body apps/mobile/src/app/body-training.tsx apps/mobile/src/app/_layout.tsx apps/mobile/src/i18n/locales
git commit -m "feat(corps): choisir un programme compatible"
```

## Task 6: Migrer, documenter et vérifier le lot complet

**Files:**
- Modify: `docs/specs/functional/us/corps04-programme-compatible.md`
- Modify: `docs/product/roadmap.md`
- Modify: `docs/RECETTES.md`
- Modify: `docs/architecture/offline-sync.md` if the profile JSON contract is documented there
- Modify: `CHANGELOG.md`

**Step 1: Apply and verify the cloud migration**

Use the repository's configured Supabase workflow. Confirm only the new CORPS-04 migration is pending, apply it, list migrations again, then regenerate or verify database types. Never reset production data.

**Step 2: Run the focused suites**

```powershell
npm test --workspace @wellness/shared -- --runInBand strength-program-recommendation.test.ts profile.test.ts
npm test --workspace @wellness/mobile -- --runInBand strength-program-context-sql.test.ts strength-program-recommendation-sql.test.ts program-sql.test.ts body-training-programs-screen.test.tsx body-training-screen.test.tsx connector
```

Expected: PASS.

**Step 3: Run required full checks once**

```powershell
npm test --workspaces --if-present -- --runInBand
npm run lint --workspaces --if-present
npm run typecheck --workspaces --if-present
git diff --check
```

Do not repeat full suites unless a later code change invalidates them.

**Step 4: Build and inspect the Android release**

```powershell
Set-Location apps/mobile/android
.\gradlew.bat assembleRelease
```

Verify exit code, final APK timestamp/size/SHA-256, APK signature v2+, expected four ABI entries, and presence of the final JS bundle strings. The output must be:
`apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.

**Step 5: Update project truth**

Move CORPS-04 to `recette`, add roadmap item 6.7 and the next recipe section after CORPS-03. Record exact tests, migration id, build evidence and limitations. The final device recipe stays grouped with the broader “Mon corps” work as requested by Florian.

**Step 6: Review before completion**

Use `superpowers:requesting-code-review`, fix material findings, then use `superpowers:verification-before-completion`. Re-run only checks affected by fixes plus any mandatory final check required by the skill.

**Step 7: Commit the verified lot**

```powershell
git add CHANGELOG.md docs
git commit -m "docs(corps): passer le programme compatible en recette"
git status --short --branch
```

Expected: clean feature branch, no push and no merge to `dev`.

