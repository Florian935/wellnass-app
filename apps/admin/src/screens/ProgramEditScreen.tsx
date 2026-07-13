import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  PROGRAM_LEVELS,
  PROGRAM_SESSION_TYPES,
  SET_TYPES,
  addExercisePlan,
  addSession,
  getProgram,
  removeExercisePlan,
  removeSession,
  reorderExercisePlans,
  reorderSessions,
  setStatus,
  updateExercisePlan,
  updateProgramMeta,
  updateSession,
  type AdminExercisePlan,
  type AdminSession,
  type ProgramDetail,
  type ProgramLevel,
  type SessionType,
  type SetType,
} from '../data/programs';
import { ExercisePicker } from '../components/ExercisePicker';
import { SortableList } from '../components/SortableList';
import { fr } from '../i18n/fr';
import { theme } from '../theme';

/**
 * Écran de composition d'un programme éditorial (US 8.4). L'éditeur y règle les
 * métadonnées bilingues, publie / repasse en brouillon, et compose les séances :
 * ajout / nommage libre (+ auto A/B/C) / réordonnancement (glisser-déposer) /
 * retrait. Le corps de chaque séance est **pillar-aware** :
 *  - `strength` → exercices planifiés (picker inline, cibles séries/reps/charge/
 *    repos, réordonnancement) ;
 *  - `running` → cibles de séance (type, distance, durée), sans exercices.
 *
 * Modèle d'état volontairement simple et robuste : une seule source de vérité
 * (`program`), re-fetch (`getProgram`) après chaque écriture. Les réordonnancements
 * sont **optimistes** (mise à jour immédiate de l'état local), puis persistés ;
 * en cas d'échec on re-fetch pour revenir à la vérité serveur + message d'erreur.
 * Les écritures concurrentes sont bornées par un drapeau `busy`. Les champs texte
 * (nom de séance, cibles running, cibles d'exercice) sont **persistés au blur**.
 */
export function ProgramEditScreen() {
  const navigate = useNavigate();
  const { id = '' } = useParams<{ id: string }>();

  const [program, setProgram] = useState<ProgramDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Écriture en cours : borne les actions concurrentes + surface d'erreur.
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(false);

  const reload = useCallback(async () => {
    const { program: fetched, error } = await getProgram(id);
    if (error) {
      setLoadError(true);
      return;
    }
    setLoadError(false);
    if (!fetched) {
      setNotFound(true);
      setProgram(null);
      return;
    }
    setNotFound(false);
    setProgram(fetched);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const { program: fetched, error } = await getProgram(id);
      if (cancelled) return;
      if (error) {
        setLoadError(true);
      } else if (!fetched) {
        setNotFound(true);
      } else {
        setProgram(fetched);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  /**
   * Exécute une écriture bornée par `busy`, puis re-fetch pour resynchroniser.
   * `run` renvoie `{ error }` (convention de la couche data). En cas d'erreur, ne
   * re-fetch pas et lève le drapeau d'erreur.
   */
  const runWrite = useCallback(
    async (run: () => Promise<{ error: unknown }>) => {
      if (busy) return;
      setBusy(true);
      setActionError(false);
      const { error } = await run();
      if (error) {
        setActionError(true);
        setBusy(false);
        return;
      }
      await reload();
      setBusy(false);
    },
    [busy, reload],
  );

  /**
   * Réordonnancement optimiste : applique `nextSessions` immédiatement, persiste,
   * et re-fetch (rollback) si la persistance échoue.
   */
  const runReorder = useCallback(
    async (optimistic: ProgramDetail, run: () => Promise<{ error: unknown }>) => {
      if (busy) return;
      setProgram(optimistic);
      setBusy(true);
      setActionError(false);
      const { error } = await run();
      if (error) {
        setActionError(true);
        await reload(); // rollback vers la vérité serveur
      }
      setBusy(false);
    },
    [busy, reload],
  );

  if (loading) {
    return (
      <div style={styles.wrap}>
        <p style={styles.muted}>{fr.programs.loading}</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={styles.wrap}>
        <section style={styles.panel}>
          <div style={styles.error} role="alert">
            {fr.programs.error}
          </div>
          <button type="button" style={styles.back} onClick={() => navigate('/programs')}>
            {fr.programs.back}
          </button>
        </section>
      </div>
    );
  }

  if (notFound || !program) {
    return (
      <div style={styles.wrap}>
        <section style={styles.panel}>
          <p style={styles.muted}>{fr.programs.notFound}</p>
          <button type="button" style={styles.back} onClick={() => navigate('/programs')}>
            {fr.programs.back}
          </button>
        </section>
      </div>
    );
  }

  const isRunning = program.pillar === 'running';

  async function handleAddSession() {
    await runWrite(async () => {
      const { error } = await addSession(id);
      return { error };
    });
  }

  async function handleRemoveSession(sessionId: string) {
    if (!window.confirm(fr.programs.removeSessionConfirm)) return;
    await runWrite(() => removeSession(sessionId));
  }

  function handleReorderSessions(orderedIds: string[]) {
    if (!program) return;
    const byId = new Map(program.sessions.map((s) => [s.id, s]));
    const reordered = orderedIds
      .map((sid, index) => {
        const s = byId.get(sid);
        return s ? { ...s, orderIndex: index } : null;
      })
      .filter((s): s is AdminSession => s !== null);
    void runReorder({ ...program, sessions: reordered }, () =>
      reorderSessions(id, orderedIds),
    );
  }

  return (
    <div style={styles.wrap}>
      {actionError && (
        <div style={styles.error} role="alert">
          {fr.programs.error}
        </div>
      )}

      <MetadataPanel
        program={program}
        busy={busy}
        onSaveMeta={(input) => runWrite(() => updateProgramMeta(id, input))}
        onSetStatus={(status) => runWrite(() => setStatus(id, status))}
        onBack={() => navigate('/programs')}
      />

      <section style={styles.panel}>
        <div style={styles.header}>
          <h2 style={styles.h2}>{fr.programs.sessions}</h2>
          <button
            type="button"
            style={styles.primary}
            disabled={busy}
            onClick={handleAddSession}
          >
            {fr.programs.addSession}
          </button>
        </div>

        {program.sessions.length === 0 ? (
          <p style={styles.muted}>{fr.programs.noSessions}</p>
        ) : (
          <>
            <p style={styles.hint}>{fr.programs.reorderHint}</p>
            <div style={styles.sessionList}>
              <SortableList
                items={program.sessions}
                getId={(s) => s.id}
                onReorder={handleReorderSessions}
                renderItem={(session, dragHandle) => (
                  <SessionCard
                    session={session}
                    index={program.sessions.findIndex((s) => s.id === session.id)}
                    isRunning={isRunning}
                    busy={busy}
                    dragHandle={dragHandle}
                    onUpdateSession={(input) => runWrite(() => updateSession(session.id, input))}
                    onRemoveSession={() => handleRemoveSession(session.id)}
                    onAddPlan={(exerciseId) =>
                      runWrite(async () => {
                        const { error } = await addExercisePlan(session.id, {
                          exerciseId,
                          setType: 'normal',
                          targetSets: null,
                          targetReps: null,
                          targetWeightKg: null,
                          restSeconds: null,
                        });
                        return { error };
                      })
                    }
                    onUpdatePlan={(planId, input) =>
                      runWrite(() =>
                        updateExercisePlan(planId, {
                          exerciseId: input.exerciseId,
                          setType: input.setType,
                          targetSets: input.targetSets,
                          targetReps: input.targetReps,
                          targetWeightKg: input.targetWeightKg,
                          restSeconds: input.restSeconds,
                        }),
                      )
                    }
                    onRemovePlan={(planId) => {
                      if (!window.confirm(fr.programs.removeExerciseConfirm)) return;
                      void runWrite(() => removeExercisePlan(planId));
                    }}
                    onReorderPlans={(orderedIds) => {
                      if (!program) return;
                      const byId = new Map(session.plans.map((p) => [p.id, p]));
                      const reordered = orderedIds
                        .map((pid, index) => {
                          const p = byId.get(pid);
                          return p ? { ...p, orderIndex: index } : null;
                        })
                        .filter((p): p is AdminExercisePlan => p !== null);
                      const nextSessions = program.sessions.map((s) =>
                        s.id === session.id ? { ...s, plans: reordered } : s,
                      );
                      void runReorder({ ...program, sessions: nextSessions }, () =>
                        reorderExercisePlans(session.id, orderedIds),
                      );
                    }}
                  />
                )}
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panneau métadonnées (entête éditable + statut)
// ---------------------------------------------------------------------------

type MetadataPanelProps = {
  program: ProgramDetail;
  busy: boolean;
  onSaveMeta: (input: {
    level: ProgramLevel | null;
    goal: string | null;
    durationWeeks: number | null;
    nameFr: string;
    nameEn: string;
    summaryFr: string | null;
    summaryEn: string | null;
    descriptionFr: string | null;
    descriptionEn: string | null;
  }) => Promise<void>;
  onSetStatus: (status: 'draft' | 'published') => Promise<void>;
  onBack: () => void;
};

function MetadataPanel({ program, busy, onSaveMeta, onSetStatus, onBack }: MetadataPanelProps) {
  const [nameFr, setNameFr] = useState(program.nameFr ?? '');
  const [nameEn, setNameEn] = useState(program.nameEn ?? '');
  const [summaryFr, setSummaryFr] = useState(program.summaryFr ?? '');
  const [summaryEn, setSummaryEn] = useState(program.summaryEn ?? '');
  const [descriptionFr, setDescriptionFr] = useState(program.descriptionFr ?? '');
  const [descriptionEn, setDescriptionEn] = useState(program.descriptionEn ?? '');
  const [level, setLevel] = useState<ProgramLevel | ''>((program.level as ProgramLevel | null) ?? '');
  const [goal, setGoal] = useState(program.goal ?? '');
  const [durationWeeks, setDurationWeeks] = useState(
    program.durationWeeks != null ? String(program.durationWeeks) : '',
  );

  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const nameFrTrimmed = nameFr.trim();
  const nameEnTrimmed = nameEn.trim();
  const namesComplete = Boolean(nameFrTrimmed) && Boolean(nameEnTrimmed);

  async function handleSave() {
    setFormError(null);
    if (!namesComplete) {
      setFormError(fr.programs.requiredBoth);
      return;
    }
    const parsedDuration = durationWeeks.trim()
      ? Number.parseInt(durationWeeks.trim(), 10)
      : null;
    setSaving(true);
    await onSaveMeta({
      level: level ? level : null,
      goal: goal.trim() ? goal.trim() : null,
      durationWeeks:
        parsedDuration != null && !Number.isNaN(parsedDuration) ? parsedDuration : null,
      nameFr: nameFrTrimmed,
      nameEn: nameEnTrimmed,
      summaryFr: summaryFr.trim() ? summaryFr.trim() : null,
      summaryEn: summaryEn.trim() ? summaryEn.trim() : null,
      descriptionFr: descriptionFr.trim() ? descriptionFr.trim() : null,
      descriptionEn: descriptionEn.trim() ? descriptionEn.trim() : null,
    });
    setSaving(false);
  }

  const pillarText =
    program.pillar === 'strength'
      ? fr.programs.pillarStrength
      : program.pillar === 'running'
        ? fr.programs.pillarRunning
        : program.pillar;

  const published = program.status === 'published';

  return (
    <section style={styles.panel}>
      <div style={styles.header}>
        <h2 style={styles.h2}>{fr.programs.createTitle}</h2>
        <button type="button" style={styles.back} onClick={onBack}>
          {fr.programs.back}
        </button>
      </div>

      <div style={styles.metaTopRow}>
        <div style={styles.pillarBox}>
          <span style={styles.label}>{fr.programs.pillarLabel}</span>
          <span style={styles.pillarValue}>{pillarText}</span>
        </div>
        <div style={styles.statusBox}>
          <span
            style={{
              ...styles.badge,
              ...(published ? styles.badgePublished : styles.badgeDraft),
            }}
          >
            {published ? fr.programs.statusPublished : fr.programs.statusDraft}
          </span>
          {published ? (
            <button
              type="button"
              style={styles.action}
              disabled={busy}
              onClick={() => void onSetStatus('draft')}
            >
              {fr.programs.unpublish}
            </button>
          ) : (
            <button
              type="button"
              style={styles.action}
              disabled={busy || !namesComplete}
              title={!namesComplete ? fr.programs.publishBlocked : undefined}
              onClick={() => void onSetStatus('published')}
            >
              {fr.programs.publish}
            </button>
          )}
        </div>
      </div>
      {!published && !namesComplete && (
        <p style={styles.hint}>{fr.programs.publishBlocked}</p>
      )}

      <div style={styles.form}>
        {formError && (
          <div style={styles.error} role="alert">
            {formError}
          </div>
        )}

        <div style={styles.row}>
          <div style={{ flex: 1 }}>
            <label style={styles.label} htmlFor="nameFr">
              {fr.programs.nameFr}
            </label>
            <input
              id="nameFr"
              type="text"
              value={nameFr}
              onChange={(e) => setNameFr(e.target.value)}
              style={styles.input}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label} htmlFor="nameEn">
              {fr.programs.nameEn}
            </label>
            <input
              id="nameEn"
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.row}>
          <div style={{ flex: 1 }}>
            <label style={styles.label} htmlFor="summaryFr">
              {fr.programs.summaryFr}
            </label>
            <input
              id="summaryFr"
              type="text"
              value={summaryFr}
              onChange={(e) => setSummaryFr(e.target.value)}
              style={styles.input}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label} htmlFor="summaryEn">
              {fr.programs.summaryEn}
            </label>
            <input
              id="summaryEn"
              type="text"
              value={summaryEn}
              onChange={(e) => setSummaryEn(e.target.value)}
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.row}>
          <div style={{ flex: 1 }}>
            <label style={styles.label} htmlFor="descriptionFr">
              {fr.programs.descriptionFr}
            </label>
            <textarea
              id="descriptionFr"
              value={descriptionFr}
              onChange={(e) => setDescriptionFr(e.target.value)}
              style={{ ...styles.input, minHeight: 64, resize: 'vertical' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label} htmlFor="descriptionEn">
              {fr.programs.descriptionEn}
            </label>
            <textarea
              id="descriptionEn"
              value={descriptionEn}
              onChange={(e) => setDescriptionEn(e.target.value)}
              style={{ ...styles.input, minHeight: 64, resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={styles.row}>
          <div style={{ flex: 1 }}>
            <label style={styles.label} htmlFor="level">
              {fr.programs.level}
            </label>
            <select
              id="level"
              value={level}
              onChange={(e) => setLevel(e.target.value as ProgramLevel | '')}
              style={styles.input}
            >
              <option value="">—</option>
              {PROGRAM_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {fr.programs.levelNames[l]}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label} htmlFor="durationWeeks">
              {fr.programs.durationWeeks}
            </label>
            <input
              id="durationWeeks"
              type="number"
              min={1}
              value={durationWeeks}
              onChange={(e) => setDurationWeeks(e.target.value)}
              style={styles.input}
            />
          </div>
        </div>

        <div>
          <label style={styles.label} htmlFor="goal">
            {fr.programs.goal}
          </label>
          <input
            id="goal"
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            style={styles.input}
          />
        </div>

        <div style={styles.actions}>
          <button
            type="button"
            style={styles.primary}
            disabled={saving || busy}
            onClick={handleSave}
          >
            {saving ? fr.programs.saving : fr.programs.save}
          </button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Carte séance
// ---------------------------------------------------------------------------

type SessionCardProps = {
  session: AdminSession;
  index: number;
  isRunning: boolean;
  busy: boolean;
  dragHandle: React.HTMLAttributes<HTMLElement>;
  onUpdateSession: (input: {
    name: string | null;
    sessionType: SessionType | null;
    targetDistanceM: number | null;
    targetDurationSeconds: number | null;
  }) => Promise<void>;
  onRemoveSession: () => void;
  onAddPlan: (exerciseId: string) => Promise<void>;
  onUpdatePlan: (planId: string, input: PlanInput) => Promise<void>;
  onRemovePlan: (planId: string) => void;
  onReorderPlans: (orderedIds: string[]) => void;
};

type PlanInput = {
  exerciseId: string;
  setType: SetType;
  targetSets: number | null;
  targetReps: string | null;
  targetWeightKg: number | null;
  restSeconds: number | null;
};

function SessionCard({
  session,
  index,
  isRunning,
  busy,
  dragHandle,
  onUpdateSession,
  onRemoveSession,
  onAddPlan,
  onUpdatePlan,
  onRemovePlan,
  onReorderPlans,
}: SessionCardProps) {
  const [name, setName] = useState(session.name ?? '');
  const [sessionType, setSessionType] = useState<SessionType | ''>(
    (session.sessionType as SessionType | null) ?? '',
  );
  const [distance, setDistance] = useState(
    session.targetDistanceM != null ? String(session.targetDistanceM) : '',
  );
  const [duration, setDuration] = useState(
    session.targetDurationSeconds != null ? String(session.targetDurationSeconds) : '',
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  // Resynchronise l'état local si le parent re-fetch (après une autre écriture).
  useEffect(() => {
    setName(session.name ?? '');
    setSessionType((session.sessionType as SessionType | null) ?? '');
    setDistance(session.targetDistanceM != null ? String(session.targetDistanceM) : '');
    setDuration(
      session.targetDurationSeconds != null ? String(session.targetDurationSeconds) : '',
    );
  }, [session.name, session.sessionType, session.targetDistanceM, session.targetDurationSeconds]);

  /** Persiste la séance avec l'état courant (nom + cibles running). */
  function persistSession(overrides?: {
    name?: string | null;
    sessionType?: SessionType | null;
  }) {
    const parsedDistance = distance.trim() ? Number.parseInt(distance.trim(), 10) : null;
    const parsedDuration = duration.trim() ? Number.parseInt(duration.trim(), 10) : null;
    const nextName =
      overrides && 'name' in overrides ? overrides.name : name.trim() ? name.trim() : null;
    const nextType =
      overrides && 'sessionType' in overrides
        ? overrides.sessionType
        : sessionType
          ? sessionType
          : null;
    void onUpdateSession({
      name: nextName ?? null,
      sessionType: isRunning ? (nextType ?? null) : null,
      targetDistanceM:
        isRunning && parsedDistance != null && !Number.isNaN(parsedDistance)
          ? parsedDistance
          : null,
      targetDurationSeconds:
        isRunning && parsedDuration != null && !Number.isNaN(parsedDuration)
          ? parsedDuration
          : null,
    });
  }

  function handleAutoName() {
    const letter = String.fromCharCode(65 + index);
    const autoName = `${fr.programs.sessionLabelPrefix} ${letter}`;
    setName(autoName);
    persistSession({ name: autoName });
  }

  return (
    <div style={styles.sessionCard}>
      <div style={styles.sessionHead}>
        <button
          type="button"
          aria-label={fr.programs.reorderHint}
          style={styles.handle}
          {...dragHandle}
        >
          ⠿
        </button>
        <input
          type="text"
          value={name}
          placeholder={fr.programs.sessionName}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => persistSession()}
          style={{ ...styles.input, flex: 1 }}
        />
        <button type="button" style={styles.action} disabled={busy} onClick={handleAutoName}>
          {fr.programs.autoLabel}
        </button>
        <button type="button" style={styles.danger} disabled={busy} onClick={onRemoveSession}>
          {fr.programs.removeSession}
        </button>
      </div>

      {isRunning ? (
        <div style={styles.runningRow}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={styles.label}>{fr.programs.sessionType}</label>
            <select
              value={sessionType}
              onChange={(e) => {
                const next = e.target.value as SessionType | '';
                setSessionType(next);
                persistSession({ sessionType: next ? next : null });
              }}
              style={styles.input}
            >
              <option value="">—</option>
              {PROGRAM_SESSION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {fr.programs.sessionTypeNames[t]}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label style={styles.label}>{fr.programs.targetDistanceM}</label>
            <input
              type="number"
              min={0}
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              onBlur={() => persistSession()}
              style={styles.input}
            />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label style={styles.label}>{fr.programs.targetDurationSec}</label>
            <input
              type="number"
              min={0}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              onBlur={() => persistSession()}
              style={styles.input}
            />
          </div>
        </div>
      ) : (
        <div style={styles.exercisesBlock}>
          <div style={styles.exercisesHead}>
            <h3 style={styles.h3}>{fr.programs.exercises}</h3>
            {!pickerOpen && (
              <button
                type="button"
                style={styles.action}
                disabled={busy}
                onClick={() => setPickerOpen(true)}
              >
                {fr.programs.addExercise}
              </button>
            )}
          </div>

          {pickerOpen && (
            <ExercisePicker
              onPick={(exerciseId) => {
                setPickerOpen(false);
                void onAddPlan(exerciseId);
              }}
              onCancel={() => setPickerOpen(false)}
            />
          )}

          {session.plans.length === 0 ? (
            <p style={styles.muted}>{fr.programs.noExercises}</p>
          ) : (
            <div style={styles.planList}>
              <SortableList
                items={session.plans}
                getId={(p) => p.id}
                onReorder={onReorderPlans}
                renderItem={(plan, planHandle) => (
                  <ExercisePlanRow
                    plan={plan}
                    busy={busy}
                    dragHandle={planHandle}
                    onUpdate={(input) => onUpdatePlan(plan.id, input)}
                    onRemove={() => onRemovePlan(plan.id)}
                  />
                )}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ligne exercice planifié (muscu)
// ---------------------------------------------------------------------------

type ExercisePlanRowProps = {
  plan: AdminExercisePlan;
  busy: boolean;
  dragHandle: React.HTMLAttributes<HTMLElement>;
  onUpdate: (input: PlanInput) => Promise<void>;
  onRemove: () => void;
};

function ExercisePlanRow({ plan, busy, dragHandle, onUpdate, onRemove }: ExercisePlanRowProps) {
  const [setType, setSetType] = useState<SetType>((plan.setType as SetType) ?? 'normal');
  const [targetSets, setTargetSets] = useState(
    plan.targetSets != null ? String(plan.targetSets) : '',
  );
  const [targetReps, setTargetReps] = useState(plan.targetReps ?? '');
  const [targetWeightKg, setTargetWeightKg] = useState(
    plan.targetWeightKg != null ? String(plan.targetWeightKg) : '',
  );
  const [restSeconds, setRestSeconds] = useState(
    plan.restSeconds != null ? String(plan.restSeconds) : '',
  );

  // Resynchronise si le parent re-fetch.
  useEffect(() => {
    setSetType((plan.setType as SetType) ?? 'normal');
    setTargetSets(plan.targetSets != null ? String(plan.targetSets) : '');
    setTargetReps(plan.targetReps ?? '');
    setTargetWeightKg(plan.targetWeightKg != null ? String(plan.targetWeightKg) : '');
    setRestSeconds(plan.restSeconds != null ? String(plan.restSeconds) : '');
  }, [plan.setType, plan.targetSets, plan.targetReps, plan.targetWeightKg, plan.restSeconds]);

  function persistPlan(overrides?: { setType?: SetType }) {
    const parsedSets = targetSets.trim() ? Number.parseInt(targetSets.trim(), 10) : null;
    const parsedWeight = targetWeightKg.trim() ? Number.parseFloat(targetWeightKg.trim()) : null;
    const parsedRest = restSeconds.trim() ? Number.parseInt(restSeconds.trim(), 10) : null;
    void onUpdate({
      exerciseId: plan.exerciseId,
      setType: overrides?.setType ?? setType,
      targetSets: parsedSets != null && !Number.isNaN(parsedSets) ? parsedSets : null,
      targetReps: targetReps.trim() ? targetReps.trim() : null,
      targetWeightKg: parsedWeight != null && !Number.isNaN(parsedWeight) ? parsedWeight : null,
      restSeconds: parsedRest != null && !Number.isNaN(parsedRest) ? parsedRest : null,
    });
  }

  return (
    <div style={styles.planRow}>
      <div style={styles.planHead}>
        <button
          type="button"
          aria-label={fr.programs.reorderHint}
          style={styles.handle}
          {...dragHandle}
        >
          ⠿
        </button>
        <span style={styles.planName}>{plan.exerciseNameFr ?? fr.programs.noName}</span>
        <button type="button" style={styles.danger} disabled={busy} onClick={onRemove}>
          {fr.programs.removeExercise}
        </button>
      </div>

      <div style={styles.planFields}>
        <div style={styles.planField}>
          <label style={styles.label}>{fr.programs.setType}</label>
          <select
            value={setType}
            onChange={(e) => {
              const next = e.target.value as SetType;
              setSetType(next);
              persistPlan({ setType: next });
            }}
            style={styles.input}
          >
            {SET_TYPES.map((t) => (
              <option key={t} value={t}>
                {fr.programs.setTypeNames[t]}
              </option>
            ))}
          </select>
        </div>
        <div style={styles.planFieldSmall}>
          <label style={styles.label}>{fr.programs.targetSets}</label>
          <input
            type="number"
            min={0}
            value={targetSets}
            onChange={(e) => setTargetSets(e.target.value)}
            onBlur={() => persistPlan()}
            style={styles.input}
          />
        </div>
        <div style={styles.planFieldSmall}>
          <label style={styles.label}>{fr.programs.targetReps}</label>
          <input
            type="text"
            value={targetReps}
            onChange={(e) => setTargetReps(e.target.value)}
            onBlur={() => persistPlan()}
            style={styles.input}
          />
        </div>
        <div style={styles.planFieldSmall}>
          <label style={styles.label}>{fr.programs.targetWeightKg}</label>
          <input
            type="number"
            min={0}
            step="any"
            value={targetWeightKg}
            onChange={(e) => setTargetWeightKg(e.target.value)}
            onBlur={() => persistPlan()}
            style={styles.input}
          />
        </div>
        <div style={styles.planFieldSmall}>
          <label style={styles.label}>{fr.programs.restSeconds}</label>
          <input
            type="number"
            min={0}
            value={restSeconds}
            onChange={(e) => setRestSeconds(e.target.value)}
            onBlur={() => persistPlan()}
            style={styles.input}
          />
        </div>
      </div>
    </div>
  );
}

const { colors, radius, font } = theme;

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 860 },
  panel: {
    background: colors.panel,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    padding: 20,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },
  h2: { margin: 0, fontSize: 15 },
  h3: { margin: 0, fontSize: 13 },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  row: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  label: {
    display: 'block',
    fontSize: 12,
    color: colors.muted,
    marginBottom: 4,
    fontWeight: 600,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: '9px 11px',
    fontSize: 14,
    background: colors.field,
    color: colors.ink,
    fontFamily: font,
  },
  error: {
    background: colors.dangerBg,
    border: `1px solid ${colors.dangerBorder}`,
    color: colors.danger,
    fontSize: 12.5,
    borderRadius: radius.sm,
    padding: '8px 10px',
  },
  muted: { color: colors.muted, fontSize: 13, margin: 0 },
  hint: { color: colors.muted, fontSize: 12, margin: '0 0 10px' },
  actions: { display: 'flex', gap: 10, alignItems: 'center' },
  primary: {
    border: 'none',
    borderRadius: radius.md,
    padding: '9px 16px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    background: colors.accent,
    color: colors.accentInk,
    fontFamily: font,
  },
  back: {
    border: `1px solid ${colors.border}`,
    background: '#fff',
    borderRadius: radius.sm,
    padding: '6px 11px',
    fontSize: 12,
    fontWeight: 600,
    color: colors.ink,
    cursor: 'pointer',
    fontFamily: font,
  },
  action: {
    border: `1px solid ${colors.border}`,
    background: '#fff',
    borderRadius: radius.sm,
    padding: '5px 10px',
    fontSize: 12,
    fontWeight: 600,
    color: colors.ink,
    cursor: 'pointer',
    fontFamily: font,
    whiteSpace: 'nowrap',
  },
  danger: {
    border: `1px solid ${colors.dangerBorder}`,
    background: '#fff',
    borderRadius: radius.sm,
    padding: '5px 10px',
    fontSize: 12,
    fontWeight: 600,
    color: colors.danger,
    cursor: 'pointer',
    fontFamily: font,
    whiteSpace: 'nowrap',
  },
  metaTopRow: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  pillarBox: { display: 'flex', flexDirection: 'column', gap: 2 },
  pillarValue: { fontSize: 14, fontWeight: 700, color: colors.ink },
  statusBox: { display: 'flex', alignItems: 'center', gap: 10 },
  badge: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 99,
  },
  badgePublished: { background: '#e4f0e4', color: '#2f7a3f' },
  badgeDraft: {
    background: colors.field,
    color: colors.muted,
    border: `1px solid ${colors.border}`,
  },
  sessionList: { display: 'flex', flexDirection: 'column', gap: 12 },
  sessionCard: {
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    padding: 14,
    background: colors.bg,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 12,
  },
  sessionHead: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  handle: {
    border: `1px solid ${colors.border}`,
    background: '#fff',
    borderRadius: radius.sm,
    padding: '5px 9px',
    fontSize: 14,
    cursor: 'grab',
    color: colors.muted,
    fontFamily: font,
    touchAction: 'none',
  },
  runningRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  exercisesBlock: { display: 'flex', flexDirection: 'column', gap: 10 },
  exercisesHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  planList: { display: 'flex', flexDirection: 'column', gap: 8 },
  planRow: {
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: 10,
    background: colors.panel,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginBottom: 8,
  },
  planHead: { display: 'flex', alignItems: 'center', gap: 8 },
  planName: { flex: 1, fontSize: 13, fontWeight: 600, color: colors.ink },
  planFields: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  planField: { flex: '1 1 140px', minWidth: 120 },
  planFieldSmall: { flex: '1 1 90px', minWidth: 80 },
};
