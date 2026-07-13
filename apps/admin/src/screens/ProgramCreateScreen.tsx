import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PILLAR_BUILDER,
  PROGRAM_LEVELS,
  createEditorialProgram,
  type PillarBuilder,
  type ProgramLevel,
} from '../data/programs';
import { fr } from '../i18n/fr';
import { theme } from '../theme';

/**
 * Formulaire de création d'un programme éditorial (US 8.4). Pilier (requis,
 * musculation par défaut), nom FR + nom EN (les deux requis), niveau (optionnel),
 * objectif (optionnel), durée en semaines (optionnel). Création via
 * `createEditorialProgram` → redirection vers l'écran d'édition (/programs/:id,
 * livré plus tard). Erreurs FR.
 */
export function ProgramCreateScreen() {
  const navigate = useNavigate();

  const [pillar, setPillar] = useState<PillarBuilder>('strength');
  const [nameFr, setNameFr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [level, setLevel] = useState<ProgramLevel | ''>('');
  const [goal, setGoal] = useState('');
  const [durationWeeks, setDurationWeeks] = useState('');

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const fr2 = nameFr.trim();
    const en2 = nameEn.trim();
    if (!fr2 || !en2) {
      setFormError(fr.programs.requiredBoth);
      return;
    }

    const parsedDuration = durationWeeks.trim() ? Number.parseInt(durationWeeks.trim(), 10) : null;

    setSaving(true);
    const { id, error } = await createEditorialProgram({
      pillar,
      level: level ? level : null,
      goal: goal.trim() ? goal.trim() : null,
      durationWeeks: parsedDuration != null && !Number.isNaN(parsedDuration) ? parsedDuration : null,
      nameFr: fr2,
      nameEn: en2,
    });
    setSaving(false);

    if (error || !id) {
      setFormError(fr.programs.error);
      return;
    }
    navigate(`/programs/${id}`);
  }

  return (
    <div style={styles.wrap}>
      <section style={styles.panel}>
        <div style={styles.header}>
          <h2 style={styles.h2}>{fr.programs.createTitle}</h2>
          <button type="button" style={styles.back} onClick={() => navigate('/programs')}>
            {fr.programs.back}
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {formError && (
            <div style={styles.error} role="alert">
              {formError}
            </div>
          )}

          <div style={styles.field}>
            <label style={styles.label} htmlFor="pillar">
              {fr.programs.pillarLabel}
            </label>
            <select
              id="pillar"
              value={pillar}
              onChange={(e) => setPillar(e.target.value as PillarBuilder)}
              style={styles.input}
            >
              {PILLAR_BUILDER.map((p) => (
                <option key={p} value={p}>
                  {pillarLabel(p)}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.row}>
            <div style={{ ...styles.field, flex: 1 }}>
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
            <div style={{ ...styles.field, flex: 1 }}>
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
            <div style={{ ...styles.field, flex: 1 }}>
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
            <div style={{ ...styles.field, flex: 1 }}>
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

          <div style={styles.field}>
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
            <button type="submit" style={styles.primary} disabled={saving}>
              {saving ? fr.programs.saving : fr.programs.save}
            </button>
            <button type="button" style={styles.back} onClick={() => navigate('/programs')}>
              {fr.programs.cancel}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

/** Libellé FR d'un pilier (strength → Musculation, running → Course). */
function pillarLabel(pillar: string): string {
  if (pillar === 'strength') return fr.programs.pillarStrength;
  if (pillar === 'running') return fr.programs.pillarRunning;
  return pillar;
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
  actions: { display: 'flex', gap: 10, alignItems: 'center' },
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
