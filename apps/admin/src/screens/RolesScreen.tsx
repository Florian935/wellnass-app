import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  ADMIN_ROLES,
  grantRole,
  listRoles,
  revokeRole,
  type AdminRole,
  type UserRoleRow,
} from '../data/roles';
import { fr } from '../i18n/fr';
import { theme } from '../theme';

/**
 * Gestion minimale des rôles (réservée au super_admin). Liste des attributions
 * actives, formulaire d'attribution par `user_id` (UUID copié du dashboard
 * Supabase) et révocation (soft-delete) avec confirmation. Erreurs Supabase
 * surfacées en FR ; états de chargement gérés.
 */
export function RolesScreen() {
  const [rows, setRows] = useState<UserRoleRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(false);

  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<AdminRole>('content_editor');
  const [granting, setGranting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [revokingId, setRevokingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setListLoading(true);
    const { rows: fetched, error } = await listRoles();
    setRows(fetched);
    setListError(Boolean(error));
    setListLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleGrant(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const trimmed = userId.trim();
    if (!trimmed) {
      setFormError(fr.roles.userIdRequired);
      return;
    }

    setGranting(true);
    const { error } = await grantRole(trimmed, role);
    setGranting(false);

    if (error) {
      setFormError(fr.roles.error);
      return;
    }

    setUserId('');
    await reload();
  }

  async function handleRevoke(id: string) {
    if (!window.confirm(fr.roles.revokeConfirm)) {
      return;
    }
    setRevokingId(id);
    const { error } = await revokeRole(id);
    setRevokingId(null);

    if (error) {
      setListError(true);
      return;
    }
    await reload();
  }

  return (
    <div style={styles.wrap}>
      <section style={styles.panel}>
        <h2 style={styles.h2}>{fr.roles.grantTitle}</h2>
        <form onSubmit={handleGrant} style={styles.form}>
          {formError && (
            <div style={styles.error} role="alert">
              {formError}
            </div>
          )}
          <div style={styles.field}>
            <label style={styles.label} htmlFor="user_id">
              {fr.roles.userIdLabel}
            </label>
            <input
              id="user_id"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder={fr.roles.userIdPlaceholder}
              style={styles.input}
            />
            <div style={styles.hint}>{fr.roles.userIdHint}</div>
          </div>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="role">
              {fr.roles.roleLabel}
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as AdminRole)}
              style={styles.input}
            >
              {ADMIN_ROLES.map((r) => (
                <option key={r} value={r}>
                  {fr.roles.roleNames[r]}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" style={styles.button} disabled={granting}>
            {granting ? fr.roles.granting : fr.roles.grantCta}
          </button>
        </form>
      </section>

      <section style={styles.panel}>
        <h2 style={styles.h2}>{fr.roles.listTitle}</h2>
        {listError && (
          <div style={styles.error} role="alert">
            {fr.roles.error}
          </div>
        )}
        {listLoading ? (
          <p style={styles.muted}>{fr.roles.loading}</p>
        ) : rows.length === 0 ? (
          <p style={styles.muted}>{fr.roles.listEmpty}</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>{fr.roles.colUser}</th>
                  <th style={styles.th}>{fr.roles.colRole}</th>
                  <th style={styles.th}>{fr.roles.colDate}</th>
                  <th style={styles.th}>{fr.roles.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ ...styles.td, ...styles.mono }}>{r.user_id}</td>
                    <td style={styles.td}>
                      {fr.roles.roleNames[r.role as AdminRole] ?? r.role}
                    </td>
                    <td style={styles.td}>{formatDate(r.created_at)}</td>
                    <td style={styles.td}>
                      <button
                        type="button"
                        onClick={() => handleRevoke(r.id)}
                        disabled={revokingId === r.id}
                        style={styles.revoke}
                      >
                        {revokingId === r.id ? fr.roles.revoking : fr.roles.revoke}
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
  wrap: { display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 760 },
  panel: {
    background: colors.panel,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    padding: 20,
  },
  h2: { margin: '0 0 14px', fontSize: 15 },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
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
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: '9px 11px',
    fontSize: 14,
    background: colors.field,
    color: colors.ink,
    fontFamily: font,
  },
  hint: { fontSize: 11, color: colors.muted, marginTop: 4 },
  button: {
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
  mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 },
  revoke: {
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
