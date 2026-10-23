import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { AiAccessMode } from '@wellness/shared';
import {
  addAiTesterByEmail,
  listAiTesters,
  readAiAccessMode,
  removeAiTester,
  type AiTesterRow,
} from '../data/ai-testers';
import { fr } from '../i18n/fr';
import { theme } from '../theme';

/**
 * US ACCES-IA — la liste des testeurs de l'IA (gestionnaires d'utilisateurs : super_admin et
 * modérateur). Réf. : docs/specs/functional/us/acces-ia-testeurs.md §4.4 ; maquette
 * design/acces-ia-testeurs/Main.dc.html.
 *
 * - **Le mode en service** est lu dans la réponse de `status` de la fonction `ai-assist` : c'est le
 *   réglage réellement appliqué (`AI_ACCESS`), pas une valeur recopiée ici.
 * - **L'ajout** se fait par e-mail, comparé par égalité côté serveur ; rien n'est envoyé à la personne.
 * - **Le retrait** est confirmé ; il ne touche pas à l'accord de la personne.
 * - L'app relit l'accès au **démarrage suivant** (spec D13) : l'écran le dit.
 */
export function AiTestersScreen() {
  const [rows, setRows] = useState<AiTesterRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(false);

  const [mode, setMode] = useState<AiAccessMode | null | 'loading'>('loading');

  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);

  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState(false);

  const reload = useCallback(async () => {
    setListLoading(true);
    const { rows: fetched, error } = await listAiTesters();
    setRows(fetched);
    setListError(Boolean(error));
    setListLoading(false);
  }, []);

  useEffect(() => {
    void reload();
    let cancelled = false;
    void readAiAccessMode().then((read) => {
      if (!cancelled) setMode(read);
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormNotice(null);

    const wanted = email.trim();
    if (!wanted) {
      setFormError(fr.aiTesters.emailRequired);
      return;
    }

    setAdding(true);
    const { outcome, error } = await addAiTesterByEmail(wanted);
    setAdding(false);

    if (error || outcome === null) {
      setFormError(fr.aiTesters.error);
      return;
    }
    if (outcome === 'not_found') {
      setFormError(fr.aiTesters.notFound);
      return;
    }
    if (outcome === 'already') {
      setFormNotice(fr.aiTesters.already);
      return;
    }
    setFormNotice(fr.aiTesters.added.replace('{email}', wanted));
    setEmail('');
    await reload();
  }

  async function handleRemove(row: AiTesterRow) {
    if (!row.user_id) return;
    const who = row.email ?? row.user_id;
    if (!window.confirm(fr.aiTesters.removeConfirm.replace('{email}', who))) return;

    setRemoveError(false);
    setRemovingId(row.user_id);
    const { error } = await removeAiTester(row.user_id);
    setRemovingId(null);

    // Un retrait refusé n'est pas une liste qui ne charge pas : message à part.
    if (error) {
      setRemoveError(true);
      return;
    }
    await reload();
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.head}>
        <h1 style={styles.h1}>{fr.aiTesters.title}</h1>
        <p style={styles.intro}>{fr.aiTesters.intro}</p>
      </div>

      <ModeBanner mode={mode} />

      <section style={styles.panel}>
        <h2 style={styles.h2}>{fr.aiTesters.addTitle}</h2>
        <form onSubmit={handleAdd} style={styles.form}>
          {formError && (
            <div style={styles.error} role="alert">
              {formError}
            </div>
          )}
          {formNotice && (
            <div style={styles.notice} role="status">
              {formNotice}
            </div>
          )}
          <label style={styles.label} htmlFor="tester-email">
            {fr.aiTesters.emailLabel}
          </label>
          <div style={styles.formRow}>
            <input
              id="tester-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={fr.aiTesters.emailPlaceholder}
              style={styles.input}
            />
            <button type="submit" style={styles.button} disabled={adding}>
              {adding ? fr.aiTesters.adding : fr.aiTesters.addCta}
            </button>
          </div>
          <div style={styles.hint}>{fr.aiTesters.emailHint}</div>
        </form>
      </section>

      <section style={styles.panel}>
        <h2 style={styles.h2}>{fr.aiTesters.listTitle.replace('{count}', String(rows.length))}</h2>
        {listError && (
          <div style={styles.error} role="alert">
            {fr.aiTesters.listError}
          </div>
        )}
        {removeError && (
          <div style={styles.error} role="alert">
            {fr.aiTesters.removeError}
          </div>
        )}
        {listLoading ? (
          <p style={styles.muted}>{fr.aiTesters.loading}</p>
        ) : rows.length === 0 ? (
          <p style={styles.muted}>{fr.aiTesters.empty}</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>{fr.aiTesters.colEmail}</th>
                  <th style={styles.th}>{fr.aiTesters.colFirstName}</th>
                  <th style={styles.th}>{fr.aiTesters.colSince}</th>
                  <th style={styles.th}>{fr.aiTesters.colAddedBy}</th>
                  <th style={styles.th}>{fr.aiTesters.colLastUse}</th>
                  <th style={styles.th}>{fr.aiTesters.colCalls}</th>
                  <th style={styles.th}>
                    <span style={styles.srOnly}>{fr.aiTesters.colActions}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id ?? r.user_id}>
                    <td style={{ ...styles.td, ...styles.mono }}>{r.email ?? fr.aiTesters.none}</td>
                    <td style={styles.td}>{r.first_name ?? fr.aiTesters.none}</td>
                    <td style={styles.td}>{r.created_at ? formatDate(r.created_at) : fr.aiTesters.none}</td>
                    <td style={{ ...styles.td, ...styles.small }}>{r.added_by_email ?? fr.aiTesters.none}</td>
                    <td style={styles.td}>{r.last_used_on ? formatDay(r.last_used_on) : fr.aiTesters.never}</td>
                    <td style={styles.td}>{r.calls_7d ?? 0}</td>
                    <td style={styles.td}>
                      <button
                        type="button"
                        onClick={() => handleRemove(r)}
                        disabled={removingId === r.user_id}
                        aria-label={fr.aiTesters.removeLabel.replace('{email}', r.email ?? r.user_id ?? '')}
                        style={styles.remove}
                      >
                        {removingId === r.user_id ? fr.aiTesters.removing : fr.aiTesters.remove}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={styles.footnote}>{fr.aiTesters.footnote}</p>
      </section>
    </div>
  );
}

/** Le mode réellement en service, ou « inconnu » si la fonction n'a pas répondu (spec D5). */
function ModeBanner({ mode }: { mode: AiAccessMode | null | 'loading' }) {
  if (mode === 'loading') {
    return <p style={styles.muted}>{fr.aiTesters.modeLoading}</p>;
  }
  const [title, body, tone] =
    mode === 'testers'
      ? [fr.aiTesters.modeTestersTitle, fr.aiTesters.modeTestersBody, styles.bannerOk]
      : mode === 'open'
        ? [fr.aiTesters.modeOpenTitle, fr.aiTesters.modeOpenBody, styles.bannerOpen]
        : [fr.aiTesters.modeUnknownTitle, fr.aiTesters.modeUnknownBody, styles.bannerUnknown];
  return (
    <section aria-label={title} data-testid={`ai-access-mode-${mode ?? 'unknown'}`} style={{ ...styles.banner, ...tone }}>
      <b style={styles.bannerTitle}>{title}</b>
      <span style={styles.bannerBody}>{body}</span>
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
  wrap: { display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 980 },
  head: { display: 'flex', flexDirection: 'column', gap: 6 },
  h1: { margin: 0, fontSize: 22 },
  intro: { margin: 0, fontSize: 13.5, color: colors.ink, lineHeight: 1.45 },
  panel: {
    background: colors.panel,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    padding: 20,
  },
  h2: { margin: '0 0 14px', fontSize: 15 },
  banner: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    borderRadius: radius.lg,
    padding: '14px 16px',
  },
  bannerOk: { background: colors.panel, border: `1px solid ${colors.border}` },
  bannerOpen: { background: colors.dangerBg, border: `1px solid ${colors.dangerBorder}`, color: colors.danger },
  bannerUnknown: { background: colors.panel, border: `1px dashed ${colors.sidebarMuted}` },
  bannerTitle: { fontSize: 14 },
  bannerBody: { fontSize: 13, lineHeight: 1.45 },
  form: { display: 'flex', flexDirection: 'column', gap: 10 },
  formRow: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  label: { display: 'block', fontSize: 12, color: colors.muted, fontWeight: 600 },
  input: {
    flex: '1 1 260px',
    minWidth: 0,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: '9px 11px',
    fontSize: 14,
    background: colors.field,
    color: colors.ink,
    fontFamily: font,
  },
  hint: { fontSize: 11.5, color: colors.muted },
  button: {
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
  },
  notice: {
    background: colors.field,
    border: `1px solid ${colors.border}`,
    color: colors.ink,
    fontSize: 12.5,
    borderRadius: radius.sm,
    padding: '8px 10px',
  },
  muted: { color: colors.muted, fontSize: 13, margin: 0 },
  footnote: { color: colors.muted, fontSize: 11.5, margin: '12px 0 0', lineHeight: 1.45 },
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
  small: { fontSize: 12 },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    whiteSpace: 'nowrap',
  },
  remove: {
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
