import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  MUSCLE_GROUPS,
  EQUIPMENTS,
  getExercise,
  saveExercise,
  type ExerciseStatus,
  type MuscleGroup,
  type Equipment,
} from '../data/exercises';
import { fr } from '../i18n/fr';
import { theme } from '../theme';

/**
 * Formulaire de création / édition d'un exercice éditorial (US 8.2). Groupe
 * musculaire (requis), équipement (optionnel), nom FR + nom EN (les deux requis),
 * instructions FR/EN (optionnelles), statut (brouillon par défaut à la création).
 * Enregistrement séquentiel via `saveExercise` → retour à la liste. Erreurs FR.
 */
export function ExerciseEditScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [musclePrimary, setMusclePrimary] = useState<MuscleGroup>(MUSCLE_GROUPS[0]);
  const [musclesSecondary, setMusclesSecondary] = useState<MuscleGroup[]>([]);
  const [equipment, setEquipment] = useState<Equipment | ''>('');
  const [status, setStatus] = useState<ExerciseStatus>('draft');
  const [nameFr, setNameFr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [instructionsFr, setInstructionsFr] = useState('');
  const [instructionsEn, setInstructionsEn] = useState('');

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { exercise, error } = await getExercise(id);
    if (error || !exercise) {
      setFormError(fr.exercises.loadError);
      setLoading(false);
      return;
    }
    setMusclePrimary(exercise.musclePrimary);
    setMusclesSecondary(exercise.musclesSecondary);
    setEquipment(exercise.equipment ?? '');
    setStatus(exercise.status);
    setNameFr(exercise.nameFr);
    setNameEn(exercise.nameEn);
    setInstructionsFr(exercise.instructionsFr ?? '');
    setInstructionsEn(exercise.instructionsEn ?? '');
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const fr2 = nameFr.trim();
    const en2 = nameEn.trim();
    if (!fr2 || !en2) {
      setFormError(fr.exercises.requiredBoth);
      return;
    }

    setSaving(true);
    const { error } = await saveExercise({
      id,
      musclePrimary,
      musclesSecondary,
      equipment: equipment === '' ? null : equipment,
      status,
      nameFr: fr2,
      nameEn: en2,
      instructionsFr: instructionsFr.trim() ? instructionsFr.trim() : null,
      instructionsEn: instructionsEn.trim() ? instructionsEn.trim() : null,
    });
    setSaving(false);

    if (error) {
      setFormError(fr.exercises.error);
      return;
    }
    navigate('/exercises');
  }

  return (
    <div style={styles.wrap}>
      <section style={styles.panel}>
        <div style={styles.header}>
          <h2 style={styles.h2}>{isEdit ? fr.exercises.formTitleEdit : fr.exercises.formTitleNew}</h2>
          <button type="button" style={styles.back} onClick={() => navigate('/exercises')}>
            {fr.exercises.back}
          </button>
        </div>

        {loading ? (
          <p style={styles.muted}>{fr.exercises.loading}</p>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            {formError && (
              <div style={styles.error} role="alert">
                {formError}
              </div>
            )}

            <div style={styles.row}>
              <div style={{ ...styles.field, flex: 1 }}>
                <label style={styles.label} htmlFor="group">
                  {fr.exercises.groupLabel}
                </label>
                <select
                  id="group"
                  value={musclePrimary}
                  onChange={(e) => {
                    const next = e.target.value as MuscleGroup;
                    setMusclePrimary(next);
                    setMusclesSecondary((prev) => prev.filter((m) => m !== next));
                  }}
                  style={styles.input}
                >
                  {MUSCLE_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {fr.exercises.groupNames[g]}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ ...styles.field, flex: 1 }}>
                <label style={styles.label} htmlFor="equipment">
                  {fr.exercises.equipmentLabel}
                </label>
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
              </div>
            </div>

            <div style={styles.field}>
              <span style={styles.label}>{fr.exercises.secondaryMusclesLabel}</span>
              <div style={styles.checkboxGroup}>
                {MUSCLE_GROUPS.filter((g) => g !== musclePrimary).map((g) => (
                  <div key={g} style={styles.checkboxItem}>
                    <input
                      id={`secondary-${g}`}
                      type="checkbox"
                      checked={musclesSecondary.includes(g)}
                      onChange={(e) =>
                        setMusclesSecondary((prev) =>
                          e.target.checked ? [...prev, g] : prev.filter((m) => m !== g),
                        )
                      }
                    />
                    <label htmlFor={`secondary-${g}`} style={styles.checkboxLabel}>
                      {fr.exercises.groupNames[g]}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.row}>
              <div style={{ ...styles.field, flex: 1 }}>
                <label style={styles.label} htmlFor="nameFr">
                  {fr.exercises.nameFr}
                </label>
                <input
                  id="nameFr"
                  type="text"
                  value={nameFr}
                  onChange={(e) => setNameFr(e.target.value)}
                  style={styles.input}
                />
              </div>
              <div style={{ ...styles.field, flex: 1 }}>
                <label style={styles.label} htmlFor="nameEn">
                  {fr.exercises.nameEn}
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

            <div style={styles.field}>
              <label style={styles.label} htmlFor="instrFr">
                {fr.exercises.instructionsFr}
              </label>
              <textarea
                id="instrFr"
                value={instructionsFr}
                onChange={(e) => setInstructionsFr(e.target.value)}
                rows={3}
                style={{ ...styles.input, resize: 'vertical' }}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label} htmlFor="instrEn">
                {fr.exercises.instructionsEn}
              </label>
              <textarea
                id="instrEn"
                value={instructionsEn}
                onChange={(e) => setInstructionsEn(e.target.value)}
                rows={3}
                style={{ ...styles.input, resize: 'vertical' }}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label} htmlFor="status">
                {fr.exercises.statusLabel}
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ExerciseStatus)}
                style={styles.input}
              >
                <option value="draft">{fr.exercises.statusDraft}</option>
                <option value="published">{fr.exercises.statusPublished}</option>
              </select>
            </div>

            <button type="submit" style={styles.primary} disabled={saving}>
              {saving ? fr.exercises.saving : fr.exercises.save}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

const { colors, radius, font } = theme;

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 },
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
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  row: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  field: {},
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
  checkboxGroup: { display: 'flex', flexWrap: 'wrap', gap: 12 },
  checkboxItem: { display: 'flex', alignItems: 'center', gap: 6 },
  checkboxLabel: { fontSize: 13, color: colors.ink, fontFamily: font, cursor: 'pointer' },
  primary: {
    alignSelf: 'flex-start',
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
};
