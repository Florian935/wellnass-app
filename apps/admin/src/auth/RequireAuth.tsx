import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth';
import { fr } from '../i18n/fr';
import { theme } from '../theme';

/**
 * Garde de route : bloque l'accès aux routes privées tant que la session n'est
 * pas restaurée, redirige vers `/login` si non connecté, sinon rend l'`Outlet`.
 * F1 = authentification seule (le gate par rôle arrive en F2).
 */
export function RequireAuth() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.muted,
          fontFamily: theme.font,
        }}
      >
        <Spinner />
        <span style={{ marginLeft: 10 }}>{fr.layout.loading}</span>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function Spinner() {
  return (
    <span
      aria-hidden
      style={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        border: `2px solid ${theme.colors.border}`,
        borderTopColor: theme.colors.accent,
        display: 'inline-block',
        animation: 'admin-spin 0.7s linear infinite',
      }}
    />
  );
}
