import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getUser,
  banUser,
  unbanUser,
  listUserBans,
  parseActivePillars,
  type AdminUserRow,
  type UserBanRow,
} from '../data/users';
import { useAuth } from '../auth/useAuth';
import { fr } from '../i18n/fr';
import { theme } from '../theme';

/**
 * Fiche d'un compte utilisateur (US 8.8a lecture seule + US 8.8b modération). Sections :
 * Compte, Configuration, Profil, puis Modération (bannir/débannir + historique) réservée aux
 * comptes modérables. Sobriété RGPD : aucune donnée de santé.
 */
export function UserDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [user, setUser] = useState<AdminUserRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [bans, setBans] = useState<UserBanRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [actorEmails, setActorEmails] = useState<Map<string, string>>(new Map());

  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([getUser(id ?? ''), listUserBans(id ?? '')]).then(
      ([{ user: fetched, error: err }, { rows, error: bansErr }]) => {
        if (cancelled) return;
        setUser(fetched);
        setBans(rows);
        setError(Boolean(err) || Boolean(bansErr));
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  // Résolution des acteurs (acted_by uuid → e-mail). N+1 assumé (volume faible, MVP) : les
  // acteurs sont des admins donc visibles dans `admin_users` pour l'appelant.
  useEffect(() => {
    let cancelled = false;
    const distinctIds = [
      ...new Set(bans.map((b) => b.acted_by).filter((v): v is string => Boolean(v))),
    ];
    if (distinctIds.length === 0) {
      setActorEmails(new Map());
      return;
    }
    void Promise.all(
      distinctIds.map(async (actedBy) => {
        const { user: fetched } = await getUser(actedBy);
        return [actedBy, fetched?.email ?? null] as const;
      }),
    ).then((pairs) => {
      if (cancelled) return;
      const map = new Map<string, string>();
      for (const [actedBy, email] of pairs) {
        if (email) map.set(actedBy, email);
      }
      setActorEmails(map);
    });
    return () => {
      cancelled = true;
    };
  }, [bans]);

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

  const isSelf = !!currentUser && currentUser.id === user.id;
  const canModerate = !user.is_admin && !isSelf; // is_admin null → traité comme false (non-admin)

  // Motif courant : le plus récent événement `ban` (bans triés du plus récent au plus ancien).
  const currentReason = bans.find((b) => b.action === 'ban')?.reason ?? null;

  const doBan = async () => {
    const input = window.prompt(fr.users.ban.reasonPrompt);
    const reason = input?.trim();
    if (!reason) return; // annulé ou vide
    setActionError(false);
    setBusy(true);
    const { error: banErr } = await banUser(user.id!, reason);
    setBusy(false);
    if (banErr) {
      setActionError(true);
      return;
    }
    reload();
  };

  const doUnban = async () => {
    if (!window.confirm(fr.users.ban.confirmUnban)) return;
    setActionError(false);
    setBusy(true);
    const { error: unbanErr } = await unbanUser(user.id!);
    setBusy(false);
    if (unbanErr) {
      setActionError(true);
      return;
    }
    reload();
  };

  const actorLabel = (actedBy: string | null): string =>
    actedBy ? (actorEmails.get(actedBy) ?? actedBy) : fr.users.none;

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

      <section style={styles.panel}>
        <h2 style={styles.h2}>{fr.users.ban.section}</h2>

        {!canModerate ? (
          <p style={styles.muted}>{fr.users.ban.cannotBan}</p>
        ) : (
          <>
            <div style={styles.actions}>
              {user.is_banned ? (
                <>
                  <p style={styles.reason}>
                    {fr.users.ban.currentReasonLabel} : {currentReason ?? fr.users.none}
                  </p>
                  <button
                    type="button"
                    style={styles.dangerBtn}
                    onClick={doUnban}
                    disabled={busy}
                  >
                    {fr.users.ban.unbanAction}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  style={styles.dangerBtn}
                  onClick={doBan}
                  disabled={busy}
                >
                  {fr.users.ban.banAction}
                </button>
              )}
            </div>

            {actionError && (
              <div style={styles.error} role="alert">
                {fr.users.ban.error}
              </div>
            )}

            <h3 style={styles.h3}>{fr.users.ban.historyTitle}</h3>
            {bans.length === 0 ? (
              <p style={styles.muted}>{fr.users.ban.historyEmpty}</p>
            ) : (
              <ul style={styles.history}>
                {bans.map((b) => (
                  <li key={b.id} style={styles.historyItem}>
                    <span style={styles.historyMeta}>
                      {formatDate(b.created_at)} ·{' '}
                      {b.action === 'ban' ? fr.users.ban.actionBan : fr.users.ban.actionUnban}
                    </span>
                    {b.reason ? <span style={styles.historyReason}>{b.reason}</span> : null}
                    <span style={styles.historyActor}>{actorLabel(b.acted_by)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
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

/** Libellés des piliers actifs (tableau natif OU chaîne JSON → texte joint), fallback « — ». */
function renderPillars(value: AdminUserRow['active_pillars']): string {
  const labels = parseActivePillars(value)
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
  h3: { margin: '18px 0 10px', fontSize: 13, color: colors.ink },
  actions: { display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' },
  reason: { margin: 0, color: colors.ink, fontSize: 13.5 },
  dangerBtn: {
    border: `1px solid ${colors.danger}`,
    background: colors.danger,
    color: colors.accentInk,
    fontSize: 13,
    fontWeight: 600,
    borderRadius: radius.sm,
    padding: '8px 16px',
    cursor: 'pointer',
    fontFamily: font,
  },
  history: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  historyItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '8px 0',
    borderTop: `1px solid ${colors.border}`,
  },
  historyMeta: { color: colors.ink, fontSize: 12.5, fontWeight: 600 },
  historyReason: { color: colors.ink, fontSize: 13 },
  historyActor: { color: colors.muted, fontSize: 12 },
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
