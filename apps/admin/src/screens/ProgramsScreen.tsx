import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PILLAR_BUILDER,
  PROGRAM_STATUSES,
  archiveProgram,
  listEditorialPrograms,
  setStatus,
  type AdminProgramRow,
  type PillarBuilder,
  type ProgramStatus,
} from '../data/programs';
import { fr } from '../i18n/fr';
import { theme } from '../theme';

type PillarFilter = 'all' | PillarBuilder;
type StatusFilter = 'all' | ProgramStatus;

/**
 * Liste des programmes éditoriaux (US 8.4). Tableau (nom FR, pilier traduit,
 * niveau traduit, badge statut, date), recherche par nom, filtres pilier +
 * statut, bouton « Nouveau programme », actions éditer / publier-brouillon /
 * archiver (avec confirmation). États loading / vide / erreur. Réservé aux
 * éditeurs de contenu (gate en amont). L'écran d'édition (/programs/:id) suit.
 */
export function ProgramsScreen() {
  const navigate = useNavigate();

  const [rows, setRows] = useState<AdminProgramRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [search, setSearch] = useState('');
  const [pillarFilter, setPillarFilter] = useState<PillarFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { rows: fetched, error: err } = await listEditorialPrograms();
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
      if (pillarFilter !== 'all' && r.pillar !== pillarFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (term) {
        const haystack = `${r.nameFr ?? ''} ${r.nameEn ?? ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [rows, search, pillarFilter, statusFilter]);

  async function handleToggleStatus(row: AdminProgramRow) {
    const next: ProgramStatus = row.status === 'published' ? 'draft' : 'published';
    setBusyId(row.id);
    const { error: err } = await setStatus(row.id, next);
    setBusyId(null);
    if (err) {
      setError(true);
      return;
    }
    await reload();
  }

  async function handleArchive(row: AdminProgramRow) {
    if (!window.confirm(fr.programs.archiveConfirm)) return;
    setBusyId(row.id);
    const { error: err } = await archiveProgram(row.id);
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
          <h2 style={styles.h2}>{fr.programs.listTitle}</h2>
          <button type="button" style={styles.primary} onClick={() => navigate('/programs/new')}>
            {fr.programs.new}
          </button>
        </div>

        <div style={styles.filters}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={fr.programs.search}
            style={{ ...styles.input, flex: 1, minWidth: 180 }}
          />
          <select
            value={pillarFilter}
            onChange={(e) => setPillarFilter(e.target.value as PillarFilter)}
            style={styles.input}
          >
            <option value="all">{fr.programs.allPillars}</option>
            {PILLAR_BUILDER.map((p) => (
              <option key={p} value={p}>
                {pillarLabel(p)}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            style={styles.input}
          >
            <option value="all">{fr.programs.allStatuses}</option>
            {PROGRAM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'published' ? fr.programs.statusPublished : fr.programs.statusDraft}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div style={styles.error} role="alert">
            {fr.programs.error}
          </div>
        )}

        {loading ? (
          <p style={styles.muted}>{fr.programs.loading}</p>
        ) : filtered.length === 0 ? (
          <p style={styles.muted}>{fr.programs.empty}</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>{fr.programs.colName}</th>
                  <th style={styles.th}>{fr.programs.colPillar}</th>
                  <th style={styles.th}>{fr.programs.colLevel}</th>
                  <th style={styles.th}>{fr.programs.colStatus}</th>
                  <th style={styles.th}>{fr.programs.colDate}</th>
                  <th style={styles.th}>{fr.programs.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td style={styles.td}>{r.nameFr ?? fr.programs.noName}</td>
                    <td style={styles.td}>{pillarLabel(r.pillar)}</td>
                    <td style={styles.td}>{levelLabel(r.level)}</td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.badge,
                          ...(r.status === 'published' ? styles.badgePublished : styles.badgeDraft),
                        }}
                      >
                        {r.status === 'published'
                          ? fr.programs.statusPublished
                          : fr.programs.statusDraft}
                      </span>
                    </td>
                    <td style={styles.td}>{formatDate(r.createdAt)}</td>
                    <td style={{ ...styles.td, ...styles.actionsCell }}>
                      <button
                        type="button"
                        style={styles.action}
                        onClick={() => navigate(`/programs/${r.id}`)}
                      >
                        {fr.programs.edit}
                      </button>
                      <button
                        type="button"
                        style={styles.action}
                        disabled={busyId === r.id}
                        onClick={() => handleToggleStatus(r)}
                      >
                        {r.status === 'published' ? fr.programs.unpublish : fr.programs.publish}
                      </button>
                      <button
                        type="button"
                        style={styles.danger}
                        disabled={busyId === r.id}
                        onClick={() => handleArchive(r)}
                      >
                        {fr.programs.archive}
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

/** Libellé FR d'un pilier (strength → Musculation, running → Course). */
function pillarLabel(pillar: string): string {
  if (pillar === 'strength') return fr.programs.pillarStrength;
  if (pillar === 'running') return fr.programs.pillarRunning;
  return pillar;
}

/** Libellé FR d'un niveau (repli sur '—' si null / inconnu). */
function levelLabel(level: string | null): string {
  if (!level) return '—';
  const names = fr.programs.levelNames as Record<string, string>;
  return names[level] ?? level;
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
