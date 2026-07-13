import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { fr } from '../i18n/fr';
import { theme } from '../theme';

/**
 * Écran de connexion (public). Formulaire e-mail + mot de passe contrôlés,
 * état de chargement, message d'erreur FR. Succès → redirection `/`.
 * Déjà connecté → redirection immédiate vers `/`.
 */
export function LoginScreen() {
  const { session, loading, signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await signIn(email, password);
    setSubmitting(false);
    if (signInError) {
      setError(fr.errors.invalidCredentials);
      return;
    }
    navigate('/', { replace: true });
  }

  return (
    <div style={styles.page}>
      <form style={styles.card} onSubmit={handleSubmit}>
        <div style={styles.brand}>
          <span style={styles.logo}>W</span>
          <b style={{ fontSize: 16 }}>{fr.login.title}</b>
        </div>

        {error && (
          <div style={styles.error} role="alert">
            {error}
          </div>
        )}

        <div style={styles.field}>
          <label style={styles.label} htmlFor="email">
            {fr.login.emailLabel}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label} htmlFor="password">
            {fr.login.passwordLabel}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />
        </div>

        <button type="submit" style={styles.button} disabled={submitting}>
          {submitting ? fr.login.submitting : fr.login.submit}
        </button>

        <div style={styles.hint}>{fr.login.hint}</div>
      </form>
    </div>
  );
}

const { colors, radius, font } = theme;

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: colors.bgPage,
    fontFamily: font,
    padding: 24,
  },
  card: {
    width: 320,
    maxWidth: '100%',
    background: colors.panel,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.xl,
    padding: 26,
    boxShadow: '0 4px 18px rgba(0,0,0,.05)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    justifyContent: 'center',
    marginBottom: 18,
  },
  logo: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    background: colors.accent,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.accentInk,
    fontWeight: 800,
    fontSize: 16,
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
  field: { marginBottom: 12 },
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
  button: {
    width: '100%',
    border: 'none',
    borderRadius: radius.md,
    padding: 10,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    background: colors.accent,
    color: colors.accentInk,
    marginTop: 6,
  },
  hint: {
    fontSize: 11,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 14,
  },
};
