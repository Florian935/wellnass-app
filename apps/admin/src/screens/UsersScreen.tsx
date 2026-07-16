import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listUsers, USERS_PAGE_SIZE, type AdminUserRow } from '../data/users';
import { fr } from '../i18n/fr';
import { theme } from '../theme';

/**
 * Liste des comptes utilisateurs (US 8.8a, lecture seule). Tableau (e-mail, inscription,
 * dernière connexion, piliers actifs, statut), recherche par e-mail débouncée, pagination.
 * Ligne cliquable vers la fiche détail. Aucune donnée de santé, aucune action.
 * Réservé aux gestionnaires d'utilisateurs (gate en amont ; la vue protégée est la frontière).
 */
export function UsersScreen() {
  const navigate = useNavigate();

  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  // Débounce ~300 ms sur la recherche + reset de page quand le terme change.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listUsers({ search: debouncedSearch, page }).then(({ rows: fetched, count: total, error: err }) => {
      if (cancelled) return;
      setRows(fetched);
      setCount(total);
      setError(Boolean(err));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, page]);

  const totalPages = Math.max(1, Math.ceil(count / USERS_PAGE_SIZE));
  const pageInfo = fr.users.pageInfo
    .replace('{page}', String(page + 1))
    .replace('{total}', String(totalPages));

  return (
    <div style={styles.wrap}>
      <section style={styles.panel}>
        <div style={styles.header}>
          <h2 style={styles.h2}>{fr.users.title}</h2>
        </div>

        <div style={styles.filters}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={fr.users.search}
            style={{ ...styles.input, flex: 1, minWidth: 180 }}
          />
        </div>

        {error && (
          <div style={styles.error} role="alert">
            {fr.users.error}
          </div>
        )}

        {loading ? (
          <p style={styles.muted}>{fr.users.loading}</p>
        ) : rows.length === 0 ? (
          <p style={styles.muted}>{search.trim() ? fr.users.emptySearch : fr.users.empty}</p>
        ) : (
          <>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>{fr.users.colEmail}</th>
                    <th style={styles.th}>{fr.users.colRegistered}</th>
                    <th style={styles.th}>{fr.users.colLastSignIn}</th>
                    <th style={styles.th}>{fr.users.colPillars}</th>
                    <th style={styles.th}>{fr.users.colStatus}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id ?? ''}
                      style={styles.row}
                      onClick={() => navigate('/users/' + (row.id ?? ''))}
                    >
                      <td style={styles.td}>{row.email ?? fr.users.none}</td>
                      <td style={styles.td}>
                        {row.created_at ? formatDate(row.created_at) : fr.users.none}
                      </td>
                      <td style={styles.td}>
                        {row.last_sign_in_at ? formatDate(row.last_sign_in_at) : fr.users.never}
                      </td>
                      <td style={styles.td}>{renderPillars(row.active_pillars)}</td>
                      <td style={styles.td}>
                        <span style={row.is_banned ? styles.badgeDanger : styles.badgeNeutral}>
                          {row.is_banned ? fr.users.statusBanned : fr.users.statusActive}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={styles.pagination}>
              <button
                type="button"
                style={styles.secondary}
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                {fr.users.prev}
              </button>
              <span style={styles.muted}>{pageInfo}</span>
              <button
                type="button"
                style={styles.secondary}
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                {fr.users.next}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/** Libellés des piliers actifs (Json | null → texte joint), fallback « — ». */
function renderPillars(value: AdminUserRow['active_pillars']): string {
  if (!Array.isArray(value)) return fr.users.none;
  const labels = value
    .map((k) => fr.users.pillars[k as keyof typeof fr.users.pillars])
    .filter(Boolean);
  return labels.length ? labels.join(' · ') : fr.users.none;
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
  row: { cursor: 'pointer' },
  badgeNeutral: {
    display: 'inline-block',
    padding: '2px 9px',
    borderRadius: 99,
    fontSize: 11.5,
    fontWeight: 600,
    background: colors.field,
    border: `1px solid ${colors.border}`,
    color: colors.muted,
  },
  badgeDanger: {
    display: 'inline-block',
    padding: '2px 9px',
    borderRadius: 99,
    fontSize: 11.5,
    fontWeight: 600,
    background: colors.dangerBg,
    border: `1px solid ${colors.dangerBorder}`,
    color: colors.danger,
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 14,
  },
  secondary: {
    border: `1px solid ${colors.border}`,
    background: '#fff',
    borderRadius: radius.md,
    padding: '7px 13px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    color: colors.ink,
    fontFamily: font,
  },
};
