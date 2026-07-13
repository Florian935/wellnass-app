import { useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { fr } from '../i18n/fr';
import { theme } from '../theme';

/**
 * Écran « Accès refusé » : l'utilisateur EST authentifié mais n'a aucun rôle
 * (ou la lecture des rôles a échoué). Pas de redirection vers /login — seule
 * option proposée : se déconnecter.
 */
export function AccessDenied() {
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.icon} aria-hidden>
          🔒
        </div>
        <h1 style={styles.title}>{fr.accessDenied.title}</h1>
        <p style={styles.message}>{fr.accessDenied.message}</p>
        <button
          type="button"
          onClick={handleLogout}
          disabled={signingOut}
          style={styles.button}
        >
          {signingOut ? fr.layout.loggingOut : fr.accessDenied.logout}
        </button>
      </div>
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
    width: 360,
    maxWidth: '100%',
    background: colors.panel,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.xl,
    padding: 28,
    textAlign: 'center',
    boxShadow: '0 4px 18px rgba(0,0,0,.05)',
  },
  icon: { fontSize: 34, marginBottom: 10 },
  title: { margin: '0 0 8px', fontSize: 18, color: colors.ink },
  message: { color: colors.muted, fontSize: 13, margin: '0 0 20px', lineHeight: 1.5 },
  button: {
    border: `1px solid ${colors.border}`,
    background: '#fff',
    borderRadius: radius.md,
    padding: '9px 16px',
    fontSize: 13,
    fontWeight: 600,
    color: colors.ink,
    cursor: 'pointer',
    fontFamily: font,
  },
};
