# Plan — RUN-F2d · Guidage fractionné vocal (roadmap 5.18)

Spec : [runf2d-guidage-fractionne-vocal.md](../specs/functional/us/runf2d-guidage-fractionne-vocal.md) ·
branche `feature/runf2d-guidage-fractionne-vocal` · roadmap **5.18**.

4ᵉ et dernier candidat de la famille RUN-F2. Dépend de RUN-F2a (`expo-speech`, déjà là) et RUN-F2c
(`session_intervals`, déjà là). Aucune nouvelle dépendance native → **recettable sur l'APK
existant**. Découpage en 7 étapes.

## Étape 0 — Migration + schéma *(≈ 25 min)*

```sql
alter table public.runs
  add column interval_phase_index integer,
  add column interval_phase_start_distance_m integer,
  add column interval_phase_start_duration_s integer;

alter table public.running_profiles
  add column interval_guidance_enabled boolean not null default false;
```

Toutes additives, `runs` et `running_profiles` déjà publiées en `select *`
([powersync-sync-rules.yaml](../specs/technical/powersync-sync-rules.yaml)) → **aucune sync rule à
redéployer**, contrairement à RUN-F2c.

`apps/mobile/src/powersync/schema.ts` : ajouter les 3 colonnes à la `Table` `runs` existante et la
colonne à `running_profiles` (mêmes conventions que RUN-F1b/RUN-F2a : colonne absente localement →
repli défensif côté mapping, cf. étape 2).

## Étape 1 — Fonctions pures, testées d'abord *(≈ 1 h)*

Nouveau fichier `packages/shared/src/running-intervals.ts` :

```ts
export type IntervalPhaseBlockInput = {
  reps: number;
  fastDistanceM: number | null;
  fastDurationSeconds: number | null;
  fastPacePctVma: number | null;
  recoveryDistanceM: number | null;
  recoveryDurationSeconds: number | null;
};

export type ExpandedIntervalPhase = {
  kind: 'fast' | 'recovery';
  blockIndex: number;
  rep: number;        // 1-based
  totalReps: number;
  distanceM: number | null;
  durationSeconds: number | null;
  fastPacePctVma: number | null; // uniquement pour kind='fast'
};

/** Linéarise les blocs en liste de phases (spec §1, R1). */
export function expandIntervalPhases(
  blocks: readonly IntervalPhaseBlockInput[],
): ExpandedIntervalPhase[] {
  const phases: ExpandedIntervalPhase[] = [];
  blocks.forEach((block, blockIndex) => {
    for (let rep = 1; rep <= block.reps; rep += 1) {
      phases.push({
        kind: 'fast', blockIndex, rep, totalReps: block.reps,
        distanceM: block.fastDistanceM, durationSeconds: block.fastDurationSeconds,
        fastPacePctVma: block.fastPacePctVma,
      });
      const hasRecovery = block.recoveryDistanceM != null || block.recoveryDurationSeconds != null;
      if (hasRecovery) {
        phases.push({
          kind: 'recovery', blockIndex, rep, totalReps: block.reps,
          distanceM: block.recoveryDistanceM, durationSeconds: block.recoveryDurationSeconds,
          fastPacePctVma: null,
        });
      }
    }
  });
  return phases;
}

/** Une phase est-elle franchie, vue depuis son propre point de départ ? */
export function isIntervalPhaseComplete(
  phase: ExpandedIntervalPhase,
  distanceSincePhaseStartM: number,
  durationSincePhaseStartS: number,
): boolean {
  if (phase.distanceM != null) return distanceSincePhaseStartM >= phase.distanceM;
  if (phase.durationSeconds != null) return durationSincePhaseStartS >= phase.durationSeconds;
  return false; // Ne devrait pas arriver (RUN-F2c R2/R3) — defensive, jamais un crash.
}

export type IntervalResyncResult = {
  index: number;
  phaseStartDistanceM: number;
  phaseStartDurationS: number;
  advanced: boolean; // au moins une phase franchie pendant ce resync
};

/**
 * Avance l'index de phase autant de fois que nécessaire (R8 bis) — boucle, pas un
 * simple pas unique : la distance/durée courante peut avoir franchi plusieurs seuils
 * d'un coup (écran non monté pendant un moment, spec R5/R8). `advanced` indique si au
 * moins une transition a eu lieu ; à l'appelant de décider s'il l'annonce (spec R8 bis :
 * pas d'annonce pour un rattrapage consécutif à une reprise d'écran).
 */
export function resyncIntervalPhase(
  phases: readonly ExpandedIntervalPhase[],
  fromIndex: number,
  distanceM: number,
  durationS: number,
  phaseStartDistanceM: number,
  phaseStartDurationS: number,
): IntervalResyncResult {
  let index = fromIndex;
  let startD = phaseStartDistanceM;
  let startT = phaseStartDurationS;
  let advanced = false;
  while (
    index < phases.length &&
    isIntervalPhaseComplete(phases[index]!, distanceM - startD, durationS - startT)
  ) {
    startD = distanceM;
    startT = durationS;
    index += 1;
    advanced = true;
  }
  return { index, phaseStartDistanceM: startD, phaseStartDurationS: startT, advanced };
}
```

**Tests, écrits d'abord** (`running-intervals.test.ts`) :
- `expandIntervalPhases` : bloc unique `reps=1` sans récup (échauffement) → 1 phase. Bloc
  `reps=6` avec récup → 12 phases alternées, `blockIndex=0` partout, `rep` 1..6 chacun deux fois.
  **Deux blocs** (échauffement `reps=1` puis `reps=3` avec récup) → 1 + 6 = 7 phases, la
  frontière `blockIndex` 0→1 tombe exactement après la phase d'échauffement (comble la lacune
  relevée en relecture : aucun critère ne couvrait plusieurs blocs).
- `isIntervalPhaseComplete` : phase distance sous/à/au-dessus du seuil ; phase durée idem ; phase
  sans aucune cible (defensive) → `false`, jamais d'exception.
- `resyncIntervalPhase` : distance qui ne franchit aucun seuil → `advanced=false`, index inchangé.
  Distance qui franchit **une** phase → avance de 1. Distance qui franchit **plusieurs phases
  d'un coup** (simulateur direct du scénario « écran resté fermé pendant tout un rapide + sa
  récup », relecture point 1) → l'index atterrit sur la bonne phase, `advanced=true`, en un seul
  appel (pas de boucle côté appelant).

## Étape 2 — Repository mobile *(≈ 1 h)*

`apps/mobile/src/data/repositories/run-repository.ts` :
- **`ActiveRun`** étendu : `intervalPhaseIndex: number | null`, `intervalPhaseStartDistanceM:
  number | null`, `intervalPhaseStartDurationS: number | null` — mêmes mapping/colonnes que
  `plannedSessionId`/`terrain` (`rowToActiveRun`, `SELECT_ACTIVE_RUN`).
- **Nouveau** `advanceIntervalPhase(runId, input: { phaseIndex: number; phaseStartDistanceM:
  number; phaseStartDurationS: number })` — `patch('runs', runId, { interval_phase_index: ...,
  interval_phase_start_distance_m: ..., interval_phase_start_duration_s: ... })`, miroir de
  `setRunTerrain`.
- **Nouveau** `useIntervalBlocksForRun(plannedSessionId: string | null): { sessionType:
  ProgramSessionType | null; blocks: IntervalBlockItem[] }` — comble la lacune relevée en
  relecture (`useRunTarget` ne résout ni `session_type` ni les blocs). Deux requêtes réactives
  chaînées, même patron de jointure que `useRunTarget` :
  1. `SELECT s.id, s.session_type FROM planned_sessions ps JOIN sessions s ON s.id = ps.session_id
     AND s.deleted_at IS NULL WHERE ps.id = ? AND ps.deleted_at IS NULL` → résout `sessionId`.
  2. Si `sessionId` résolu : `SELECT ... FROM session_intervals WHERE session_id = ? AND
     deleted_at IS NULL ORDER BY order_index` (même colonnes que `SELECT_INTERVALS_FOR_PROGRAM`,
     scopée séance au lieu de programme) → mappée vers `IntervalBlockItem` (réexporté ou dupliqué
     depuis `program-repository.ts` — `rowToIntervalItem`/`IntervalDbRow` sont privés aujourd'hui,
     à exporter, aucun risque : fichier stable, déjà livré).

## Étape 3 — Hook de guidage *(≈ 1 h 30, la pièce la plus délicate)*

Nouveau `apps/mobile/src/running/interval-guidance.ts` :

```ts
export function useIntervalGuidance(input: {
  enabled: boolean;               // isGps && interval_guidance_enabled && sessionType==='fractionne' && blocks.length>0
  runId: string | null;
  blocks: IntervalBlockItem[];
  distanceM: number;
  durationSeconds: number;
  persistedPhaseIndex: number | null;
  persistedPhaseStartDistanceM: number | null;
  persistedPhaseStartDurationS: number | null;
}): void {
  const { t } = useTranslation();
  const phases = useMemo(() => expandIntervalPhases(toPhaseInput(input.blocks)), [input.blocks]);
  const hasResyncedRef = useRef(false); // premier calcul suivant le montage = silencieux (R8 bis)

  useEffect(() => {
    if (!input.enabled || !input.runId || phases.length === 0) return;

    // Cas neuf (spec §1, R1) : aucune phase encore démarrée → initialise + ANNONCE immédiatement.
    if (input.persistedPhaseIndex == null) {
      void advanceIntervalPhase(input.runId, {
        phaseIndex: 0, phaseStartDistanceM: input.distanceM, phaseStartDurationS: input.durationSeconds,
      });
      announcePhase(t, phases[0]!, false);
      Vibration.vibrate();
      hasResyncedRef.current = true;
      return;
    }

    const result = resyncIntervalPhase(
      phases, input.persistedPhaseIndex, input.distanceM, input.durationSeconds,
      input.persistedPhaseStartDistanceM ?? 0, input.persistedPhaseStartDurationS ?? 0,
    );
    if (result.index === input.persistedPhaseIndex && !result.advanced) return; // rien de neuf

    void advanceIntervalPhase(input.runId, {
      phaseIndex: result.index,
      phaseStartDistanceM: result.phaseStartDistanceM,
      phaseStartDurationS: result.phaseStartDurationS,
    });

    // R8 bis : silencieux au tout premier calcul après un remontage (reprise), normal ensuite.
    if (result.advanced && hasResyncedRef.current && result.index < phases.length) {
      announcePhase(t, phases[result.index]!, false);
      Vibration.vibrate();
    }
    if (result.index >= phases.length && hasResyncedRef.current) {
      Speech.speak(t('running.guidance.sessionComplete'));
    }
    hasResyncedRef.current = true;
  }, [input.enabled, input.runId, phases, input.distanceM, input.durationSeconds /* ... */]);
}
```

`announcePhase(t, phase, isFirst)` compose la phrase (§6) : fragment quantité (`distanceLabel`
km/m via la règle RUN-F2a R3 bis corrigée en relecture, ou `durationSeconds`/`durationMinutes`
selon le seuil de 90 s, spec R7) + fragment `pacePart` si `fastPacePctVma` non nul (phase rapide
uniquement) + gabarit `fastStart`/`recoveryStart`.

⚠️ **Point d'attention** : `hasResyncedRef` doit être remis à `false` si l'écran est démonté puis
remonté (donc un `ref` de composant, pas un état persistant globalement) — c'est précisément le
comportement voulu : chaque remontage retraverse une fois en silencieux avant de reprendre les
annonces normales.

## Étape 4 — Intégration dans `run/active.tsx` *(≈ 30 min)*

Wiring identique à RUN-F2a/RUN-F2b : `useRunnerProfile()` (déjà là) fournit
`intervalGuidanceEnabled` ; `useIntervalBlocksForRun(active?.plannedSessionId ?? null)` fournit
`sessionType`/`blocks` ; `useIntervalGuidance({ enabled: isGps && runnerProfile
?.intervalGuidanceEnabled === true && sessionType === 'fractionne' && blocks.length > 0, ... })`.
Aucun élément visuel neuf (spec R9) — hook silencieux, mêmes garanties de « règle des hooks »
(appelé inconditionnellement) que les deux guidages précédents.

## Étape 5 — Réglage (`running-profile.tsx` + repository) *(≈ 30 min)*

`running-profile-repository.ts` : `RunnerProfile`/`RunnerProfileInput` étendus avec
`intervalGuidanceEnabled: boolean`, mapping défensif `row.interval_guidance_enabled === 1` (comme
`voice_announcements_enabled`). `running-profile.tsx` : nouveau `Switch`, juste sous celui de
RUN-F2a, avec son propre texte d'aide (spec §5, R3 : réglage bien séparé, pas un sous-réglage de
l'existant).

## Étape 6 — i18n *(≈ 30 min)*

`running.guidance.*` (fastStart, recoveryStart, pacePart, sessionComplete, distanceKm/distanceM,
durationSeconds, durationMinutes — pluriels `_one`/`_other`) + `running.profile
.intervalGuidance*` (toggle + aide), FR + EN, parité vérifiée par script (comme RUN-F2c).

## Étape 7 — Quality gate + solde *(≈ 20 min)*

`npm run typecheck` / `lint` / `test` (lus sans pipe). Roadmap 5.18 ⬜→✅, BACKLOG (ligne
RUN-F2d), CHANGELOG, `etat.mjs`, front-matter `etape: recette`, `/commit`, merge `dev`.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `supabase/migrations/<horodatage>_runf2d_interval_guidance.sql` (+ `MIGRATIONS.md`) | 3 colonnes `runs` + 1 colonne `running_profiles`, additives |
| `apps/mobile/src/powersync/schema.ts` | 4 colonnes locales |
| `packages/shared/src/running-intervals.ts` (+ `.test.ts`, nouveau) | `expandIntervalPhases`, `isIntervalPhaseComplete`, `resyncIntervalPhase` |
| `apps/mobile/src/data/repositories/run-repository.ts` | `ActiveRun` étendu, `advanceIntervalPhase`, `useIntervalBlocksForRun` |
| `apps/mobile/src/data/repositories/program-repository.ts` | export de `rowToIntervalItem`/`IntervalDbRow` (actuellement privés) |
| `apps/mobile/src/running/interval-guidance.ts` (nouveau) | `useIntervalGuidance`, `announcePhase` |
| `apps/mobile/src/app/run/active.tsx` | wiring (3ᵉ guidage sur cet écran) |
| `apps/mobile/src/data/repositories/running-profile-repository.ts` | `intervalGuidanceEnabled` |
| `apps/mobile/src/app/running-profile.tsx` | nouveau `Switch` |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | `running.guidance.*`, `running.profile.intervalGuidance*` |

## Migration / sync rules

**1 migration** (colonnes additives sur 2 tables déjà publiées en `select *`). **Aucune sync rule
à redéployer** — contrairement à RUN-F2c, cette US ne crée aucune table.

## Dépendances

Aucun paquet nouveau (`expo-speech` et `Vibration` déjà disponibles) → **recettable sur l'APK
existant**.

## Risques

- 🔴 **La logique de rattrapage (étape 3, R8 bis) est le point le plus délicat de cette US** —
  c'est exactement ce qu'une relecture de spec a signalé comme absent de la première version
  (aucun algorithme de rattrapage multi-phases, aucun critère ne le testait). `resyncIntervalPhase`
  est conçue et testée en pur avant toute UI (étape 1) précisément pour isoler ce risque du hook
  React qui l'utilise.
- 🟡 **Coexistence avec RUN-F2a/RUN-F2b sur le même écran** : 3 hooks de guidage désormais montés
  sur `run/active.tsx`. Aucun ne modifie l'état des autres (tous lisent `active`/`distanceM`
  /`elapsedSeconds` en entrée, aucun n'écrit sur les colonnes des autres) — risque d'interférence
  jugé nul, mais à vérifier au typecheck/tests après l'étape 4 spécifiquement.
- 🟢 **Aucun risque sur le tracker/la tâche de fond** : toujours zéro modification de
  `tracker-task.ts`, troisième US consécutive de la famille à tenir cette discipline (RUN-F2a,
  RUN-F2b implicitement, RUN-F2d explicitement R5).
- 🟢 **Aucune sync rule** : seule US de la famille RUN-F2 dans ce cas (RUN-F2c en avait besoin).
