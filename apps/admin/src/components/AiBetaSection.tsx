import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { addAiTester, getAiTester, removeAiTester, type AiTesterRow } from '../data/ai-testers';
import { fr } from '../i18n/fr';
import { theme } from '../theme';

/**
 * US ACCES-IA — le bloc « Bêta IA » de la fiche utilisateur : ce compte est-il testeur de l'IA, et le
 * geste inverse. Répond à « est-ce que Paul est testeur ? » là où on le cherche déjà (spec D11).
 *
 * Le retrait est confirmé et ne touche pas à l'accord de la personne. Être testeur ne donne aucun accès
 * au back-office : la table est dédiée, hors de `user_roles` (spec R6).
 */
export function AiBetaSection({ userId }: { userId: string }) {
  const [tester, setTester] = useState<AiTesterRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { tester: fetched, error: err } = await getAiTester(userId);
    setTester(fetched);
    setError(Boolean(err));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  const doAdd = async () => {
    setError(false);
    setNotice(null);
    setBusy(true);
    const { outcome, error: err } = await addAiTester(userId);
    setBusy(false);
    if (err || outcome === null) {
      setError(true);
      return;
    }
    // Un ajout sans effet (déjà testeur, par un autre onglet par exemple) n'est pas un « Ajouté ».
    setNotice(outcome === 'added' ? fr.users.aiBeta.added : fr.users.aiBeta.already);
    await reload();
  };

  const doRemove = async () => {
    if (!window.confirm(fr.users.aiBeta.removeConfirm)) return;
    setError(false);
    setNotice(null);
    setBusy(true);
    const { outcome, error: err } = await removeAiTester(userId);
    setBusy(false);
    if (err || outcome === null) {
      setError(true);
      return;
    }
    setNotice(outcome === 'removed' ? fr.users.aiBeta.removed : fr.users.aiBeta.absent);
    await reload();
  };

  return (
    <section style={styles.panel} aria-labelledby="ai-beta-title">
      <div style={styles.head}>
        <h2 id="ai-beta-title" style={styles.h2}>
          {fr.users.aiBeta.section}
        </h2>
        <Link to="/ai-testers" style={styles.link}>
          {fr.users.aiBeta.allTesters}
        </Link>
      </div>

      {loading ? (
        <p style={styles.muted}>{fr.users.aiBeta.loading}</p>
      ) : tester ? (
        <div style={styles.row}>
          <div style={styles.text}>
            <b style={styles.title}>
              {fr.users.aiBeta.testerSince.replace('{date}', tester.created_at ? formatDate(tester.created_at) : fr.users.none)}
            </b>
            <span style={styles.muted}>
              {fr.users.aiBeta.details
                .replace('{addedBy}', tester.added_by_email ?? fr.users.none)
                .replace('{lastUse}', tester.last_used_on ? formatDay(tester.last_used_on) : fr.users.never)
                .replace('{calls}', String(tester.calls_7d ?? 0))}
            </span>
          </div>
          <button type="button" style={styles.removeBtn} onClick={doRemove} disabled={busy}>
            {fr.users.aiBeta.remove}
          </button>
        </div>
      ) : (
        <div style={styles.row}>
          <div style={styles.text}>
            <b style={styles.title}>{fr.users.aiBeta.notTester}</b>
            <span style={styles.muted}>{fr.users.aiBeta.notTesterHint}</span>
          </div>
          <button type="button" style={styles.addBtn} onClick={doAdd} disabled={busy}>
            {fr.users.aiBeta.add}
          </button>
        </div>
      )}

      {error && (
        <div style={styles.error} role="alert">
          {fr.users.aiBeta.error}
        </div>
      )}
      {notice && (
        <div style={styles.notice} role="status">
          {notice}
        </div>
      )}
      <p style={styles.footnote}>{fr.users.aiBeta.footnote}</p>
    </section>
  );
}

/** Date JJ/MM/AAAA (convention projet) d'un horodatage. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

/** Date JJ/MM/AAAA d'un jour `AAAA-MM-JJ` — lu tel quel, sans passer par un fuseau. */
function formatDay(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : day;
}

const { colors, radius, font } = theme;

const styles: Record<string, React.CSSProperties> = {
  panel: {
    background: colors.panel,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  head: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline', justifyContent: 'space-between' },
  h2: { margin: 0, fontSize: 15 },
  link: { fontSize: 12.5, color: colors.accent, fontWeight: 600 },
  row: { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' },
  text: { display: 'flex', flexDirection: 'column', gap: 3 },
  title: { fontSize: 14, color: colors.ink },
  muted: { color: colors.muted, fontSize: 12.5, margin: 0 },
  footnote: { color: colors.muted, fontSize: 11.5, margin: 0 },
  addBtn: {
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
  removeBtn: {
    border: `1px solid ${colors.dangerBorder}`,
    background: '#fff',
    borderRadius: radius.md,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 600,
    color: colors.danger,
    cursor: 'pointer',
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
  notice: {
    background: colors.field,
    border: `1px solid ${colors.border}`,
    color: colors.ink,
    fontSize: 12.5,
    borderRadius: radius.sm,
    padding: '8px 10px',
  },
};
