import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getUser, type AdminUserRow } from '../data/users';
import { fr } from '../i18n/fr';
import { theme } from '../theme';

/**
 * Fiche d'un compte utilisateur (US 8.8a, lecture seule). Trois sections : Compte,
 * Configuration, Profil. Sobriété RGPD : aucune donnée de santé, aucun bouton d'action.
 */
export function UserDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<AdminUserRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getUser(id ?? '').then(({ user: fetched, error: err }) => {
      if (cancelled) return;
      setUser(fetched);
      setError(Boolean(err));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const backLink = (
    <button type="button" style={styles.back} onClick={() => navigate('/users')}>
      {fr.users.detail.back}
    </button>
  );

  if (loading) {
    return (
      <div style={styles.wrap}>
        {backLink}
        <p style={styles.muted}>{fr.users.loading}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.wrap}>
        {backLink}
        <div style={styles.error} role="alert">
          {fr.users.error}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={styles.wrap}>
        {backLink}
        <p style={styles.muted}>{fr.users.detail.notFound}</p>
      </div>
    );
  }

  const goal = user.main_goal
    ? (fr.users.goals[user.main_goal as keyof typeof fr.users.goals] ?? fr.users.none)
    : fr.users.none;

  return (
    <div style={styles.wrap}>
      {backLink}

      <section style={styles.panel}>
        <h2 style={styles.h2}>{fr.users.detail.accountSection}</h2>
        <dl style={styles.dl}>
          <Row label={fr.users.detail.email} value={user.email ?? fr.users.none} />
          <Row
            label={fr.users.detail.registered}
            value={user.created_at ? formatDate(user.created_at) : fr.users.none}
          />
          <Row
            label={fr.users.detail.lastSignIn}
            value={user.last_sign_in_at ? formatDate(user.last_sign_in_at) : fr.users.never}
          />
          <div style={styles.field}>
            <dt style={styles.dt}>{fr.users.detail.status}</dt>
            <dd style={styles.dd}>
              <span style={user.is_banned ? styles.badgeDanger : styles.badgeNeutral}>
                {user.is_banned ? fr.users.statusBanned : fr.users.statusActive}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      <section style={styles.panel}>
        <h2 style={styles.h2}>{fr.users.detail.configSection}</h2>
        <dl style={styles.dl}>
          <Row label={fr.users.detail.pillars} value={renderPillars(user.active_pillars)} />
          <Row label={fr.users.detail.language} value={user.language ?? fr.users.none} />
        </dl>
      </section>

      <section style={styles.panel}>
        <h2 style={styles.h2}>{fr.users.detail.profileSection}</h2>
        <dl style={styles.dl}>
          <Row label={fr.users.detail.firstName} value={user.first_name ?? fr.users.none} />
          <Row label={fr.users.detail.goal} value={goal} />
          <Row
            label={fr.users.detail.onboarding}
            value={user.onboarding_completed_at ? fr.users.detail.yes : fr.users.detail.no}
          />
        </dl>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.field}>
      <dt style={styles.dt}>{label}</dt>
      <dd style={styles.dd}>{value}</dd>
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
  wrap: { display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 },
  panel: {
    background: colors.panel,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    padding: 20,
  },
  h2: { margin: '0 0 14px', fontSize: 15 },
  back: {
    alignSelf: 'flex-start',
    border: 'none',
    background: 'none',
    padding: 0,
    fontSize: 13,
    fontWeight: 600,
    color: colors.accent,
    cursor: 'pointer',
    fontFamily: font,
  },
  muted: { color: colors.muted, fontSize: 13, margin: 0 },
  error: {
    background: colors.dangerBg,
    border: `1px solid ${colors.dangerBorder}`,
    color: colors.danger,
    fontSize: 12.5,
    borderRadius: radius.sm,
    padding: '8px 10px',
  },
  dl: { margin: 0, display: 'flex', flexDirection: 'column', gap: 10 },
  field: { display: 'flex', gap: 12, alignItems: 'baseline' },
  dt: {
    margin: 0,
    flex: '0 0 160px',
    color: colors.muted,
    fontSize: 12.5,
    fontWeight: 600,
  },
  dd: { margin: 0, color: colors.ink, fontSize: 13.5 },
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
};
