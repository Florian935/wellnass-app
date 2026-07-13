import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MUSCLE_GROUPS,
  EXERCISE_STATUSES,
  archiveExercise,
  listEditorialExercises,
  setStatus,
  type AdminExerciseRow,
  type ExerciseStatus,
} from '../data/exercises';
import { fr } from '../i18n/fr';
import { theme } from '../theme';

type GroupFilter = 'all' | (typeof MUSCLE_GROUPS)[number];
type StatusFilter = 'all' | ExerciseStatus;

/**
 * Liste des exercices éditoriaux (US 8.2). Tableau (nom FR, groupe traduit, badge
 * statut, date), recherche par nom, filtres groupe + statut, bouton « Nouvel
 * exercice », actions éditer / publier-brouillon / archiver (avec confirmation).
 * États loading / vide / erreur. Réservé aux rôles admin (gate en amont).
 */
export function ExercisesScreen() {
  const navigate = useNavigate();

  const [rows, setRows] = useState<AdminExerciseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { rows: fetched, error: err } = await listEditorialExercises();
    setRows(fetched);
    setError(Boolean(err));
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (groupFilter !== 'all' && r.musclePrimary !== groupFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (term) {
        const haystack = `${r.nameFr ?? ''} ${r.nameEn ?? ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [rows, search, groupFilter, statusFilter]);

  async function handleToggleStatus(row: AdminExerciseRow) {
    const next: ExerciseStatus = row.status === 'published' ? 'draft' : 'published';
    setBusyId(row.id);
    const { error: err } = await setStatus(row.id, next);
    setBusyId(null);
    if (err) {
      setError(true);
      return;
    }
    await reload();
  }

  async function handleArchive(row: AdminExerciseRow) {
    if (!window.confirm(fr.exercises.archiveConfirm)) return;
    setBusyId(row.id);
    const { error: err } = await archiveExercise(row.id);
    setBusyId(null);
    if (err) {
      setError(true);
      return;
    }
    await reload();
  }

  return (
    <div style={styles.wrap}>
      <section style={styles.panel}>
        <div style={styles.header}>
          <h2 style={styles.h2}>{fr.exercises.listTitle}</h2>
          <button type="button" style={styles.primary} onClick={() => navigate('/exercises/new')}>
            {fr.exercises.new}
          </button>
        </div>

        <div style={styles.filters}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={fr.exercises.search}
            style={{ ...styles.input, flex: 1, minWidth: 180 }}
          />
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value as GroupFilter)}
            style={styles.input}
          >
            <option value="all">{fr.exercises.filterGroup}</option>
            {MUSCLE_GROUPS.map((g) => (
              <option key={g} value={g}>
                {fr.exercises.groupNames[g]}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            style={styles.input}
          >
            <option value="all">{fr.exercises.filterStatus}</option>
            {EXERCISE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'published' ? fr.exercises.statusPublished : fr.exercises.statusDraft}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div style={styles.error} role="alert">
            {fr.exercises.error}
          </div>
        )}

        {loading ? (
          <p style={styles.muted}>{fr.exercises.loading}</p>
        ) : filtered.length === 0 ? (
          <p style={styles.muted}>{fr.exercises.empty}</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>{fr.exercises.colName}</th>
                  <th style={styles.th}>{fr.exercises.colGroup}</th>
                  <th style={styles.th}>{fr.exercises.colStatus}</th>
                  <th style={styles.th}>{fr.exercises.colDate}</th>
                  <th style={styles.th}>{fr.exercises.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td style={styles.td}>{r.nameFr ?? fr.exercises.noName}</td>
                    <td style={styles.td}>{groupLabel(r.musclePrimary)}</td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.badge,
                          ...(r.status === 'published' ? styles.badgePublished : styles.badgeDraft),
                        }}
                      >
                        {r.status === 'published'
                          ? fr.exercises.statusPublished
                          : fr.exercises.statusDraft}
                      </span>
                    </td>
                    <td style={styles.td}>{formatDate(r.createdAt)}</td>
                    <td style={{ ...styles.td, ...styles.actionsCell }}>
                      <button
                        type="button"
                        style={styles.action}
                        onClick={() => navigate(`/exercises/${r.id}`)}
                      >
                        {fr.exercises.edit}
                      </button>
                      <button
                        type="button"
                        style={styles.action}
                        disabled={busyId === r.id}
                        onClick={() => handleToggleStatus(r)}
                      >
                        {r.status === 'published' ? fr.exercises.unpublish : fr.exercises.publish}
                      </button>
                      <button
                        type="button"
                        style={styles.danger}
                        disabled={busyId === r.id}
                        onClick={() => handleArchive(r)}
                      >
                        {fr.exercises.archive}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** Libellé FR d'un groupe musculaire (repli sur la clé si inconnue). */
function groupLabel(group: string): string {
  const names = fr.exercises.groupNames as Record<string, string>;
  return names[group] ?? group;
}

/** Date JJ/MM/AAAA (convention projet). */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

const { colors, radius, font } = theme;

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 960 },
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
  filters: { display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  input: {
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
    marginBottom: 12,
  },
  muted: { color: colors.muted, fontSize: 13, margin: 0 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left',
    padding: '8px 10px',
    borderBottom: `1px solid ${colors.border}`,
    color: colors.muted,
    fontWeight: 600,
    fontSize: 11.5,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '8px 10px',
    borderBottom: `1px solid ${colors.border}`,
    color: colors.ink,
    verticalAlign: 'middle',
  },
  actionsCell: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  badge: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 99,
  },
  badgePublished: { background: '#e4f0e4', color: '#2f7a3f' },
  badgeDraft: { background: colors.field, color: colors.muted, border: `1px solid ${colors.border}` },
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
  },
};
