import { useCallback, useEffect, useMemo, useState } from 'react';
import { AUDIT_ACTIONS, type AuditAction } from '@wellness/shared';
import { listAudit, type AuditLogRow } from '../data/audit';
import { fr } from '../i18n/fr';
import { theme } from '../theme';

const PAGE_SIZE = 50;

/**
 * Journal d'audit (US 8.10, réservé au super_admin). Liste paginée (curseur
 * `created_at`), filtres (acteur, action, période), rendu en tableau
 * (date JJ/MM/AAAA HH:MM, acteur, action traduite, cible). États loading /
 * vide / erreur. Mirroir du pattern `RolesScreen`.
 */
export function AuditScreen() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError(false);
    const { rows: fetched, error: err } = await listAudit({
      actorId: actorId || undefined,
      action: action || undefined,
      from: from || undefined,
      to: to ? `${to}T23:59:59.999` : undefined,
      limit: PAGE_SIZE,
    });
    setRows(fetched);
    setError(Boolean(err));
    setHasMore(fetched.length === PAGE_SIZE);
    setLoading(false);
  }, [actorId, action, from, to]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleLoadMore() {
    const last = rows[rows.length - 1];
    if (!last) return;
    setLoadingMore(true);
    const { rows: fetched, error: err } = await listAudit({
      actorId: actorId || undefined,
      action: action || undefined,
      from: from || undefined,
      to: to ? `${to}T23:59:59.999` : undefined,
      limit: PAGE_SIZE,
      before: last.created_at,
    });
    setLoadingMore(false);
    if (err) {
      setError(true);
      return;
    }
    setRows((prev) => [...prev, ...fetched]);
    setHasMore(fetched.length === PAGE_SIZE);
  }

  function handleReset() {
    setActorId('');
    setAction('');
    setFrom('');
    setTo('');
  }

  const actorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      const id = r.actor_id ?? '';
      if (!id || seen.has(id)) continue;
      seen.set(id, r.actor_email ?? r.actor_id ?? id);
    }
    return Array.from(seen.entries());
  }, [rows]);

  return (
    <div style={styles.wrap}>
      <section style={styles.panel}>
        <h2 style={styles.h2}>{fr.audit.title}</h2>

        <div style={styles.filters}>
          <select
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
            style={styles.input}
          >
            <option value="">{fr.audit.allActors}</option>
            {actorOptions.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            style={styles.input}
          >
            <option value="">{fr.audit.allActions}</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {fr.audit.action[a]}
              </option>
            ))}
          </select>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="audit_from">
              {fr.audit.filterFrom}
            </label>
            <input
              id="audit_from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={styles.input}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="audit_to">
              {fr.audit.filterTo}
            </label>
            <input
              id="audit_to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={styles.input}
            />
          </div>
          <button type="button" style={styles.secondary} onClick={handleReset}>
            {fr.audit.reset}
          </button>
        </div>

        {error && (
          <div style={styles.error} role="alert">
            {fr.audit.error}
          </div>
        )}

        {loading ? (
          <p style={styles.muted}>{fr.audit.loading}</p>
        ) : rows.length === 0 ? (
          <p style={styles.muted}>{fr.audit.empty}</p>
        ) : (
          <>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>{fr.audit.colDate}</th>
                    <th style={styles.th}>{fr.audit.colActor}</th>
                    <th style={styles.th}>{fr.audit.colAction}</th>
                    <th style={styles.th}>{fr.audit.colTarget}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td style={styles.td}>{formatDateTime(r.created_at)}</td>
                      <td style={styles.td}>{r.actor_email ?? r.actor_id ?? '—'}</td>
                      <td style={styles.td}>
                        {fr.audit.action[r.action as AuditAction] ?? r.action}
                      </td>
                      <td style={styles.td}>
                        {r.target_label ?? `${r.target_table ?? '—'} ${r.target_id ?? ''}`.trim()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasMore && (
              <button
                type="button"
                style={styles.secondary}
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? fr.audit.loading : fr.audit.loadMore}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/** Date + heure JJ/MM/AAAA HH:MM (convention projet). */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()} ${hours}:${minutes}`;
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
  h2: { margin: '0 0 14px', fontSize: 15 },
  filters: { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10, marginBottom: 14 },
  field: {},
  label: {
    display: 'block',
    fontSize: 12,
    color: colors.muted,
    marginBottom: 4,
    fontWeight: 600,
  },
  input: {
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: '9px 11px',
    fontSize: 14,
    background: colors.field,
    color: colors.ink,
    fontFamily: font,
  },
  secondary: {
    border: `1px solid ${colors.border}`,
    background: '#fff',
    borderRadius: radius.md,
    padding: '9px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
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
  tableWrap: { overflowX: 'auto', marginBottom: 12 },
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
};
