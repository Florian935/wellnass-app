import { Outlet } from 'react-router-dom';
import { useRoles } from './useRoles';
import { AccessDenied } from '../screens/AccessDenied';
import { fr } from '../i18n/fr';
import { theme } from '../theme';

/**
 * Gate par rôle, à l'intérieur de `RequireAuth` (l'utilisateur est donc déjà
 * authentifié). Chargement des rôles → spinner ; ≥ 1 rôle → shell (`<Outlet/>`) ;
 * sinon (aucun rôle, ou erreur de lecture) → écran « Accès refusé ». Aucune
 * redirection vers /login : l'utilisateur EST connecté.
 */
export function RequireAdmin() {
  const { isAdmin, rolesLoading } = useRoles();

  if (rolesLoading) {
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

  if (!isAdmin) {
    return <AccessDenied />;
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
