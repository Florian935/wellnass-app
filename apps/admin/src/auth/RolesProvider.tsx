import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './useAuth';
import { fetchMyRoles, type AdminRole } from '../data/roles';
import { RolesContext, type RolesContextValue } from './rolesContext';

/**
 * Charge les rôles de l'utilisateur courant après établissement de la session
 * (F1). Recharge quand l'utilisateur change. Toute erreur de lecture (table
 * absente avant l'apply cloud, réseau…) est traitée comme « non-admin » — pas
 * de crash. À placer sous `<AuthProvider>`.
 */
export function RolesProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState<unknown>(null);

  useEffect(() => {
    // Tant que la session n'est pas restaurée, on attend (état loading).
    if (authLoading) {
      return;
    }

    // Déconnecté : aucun rôle, chargement terminé.
    if (!userId) {
      setRoles([]);
      setRolesError(null);
      setRolesLoading(false);
      return;
    }

    let cancelled = false;
    setRolesLoading(true);
    setRolesError(null);

    fetchMyRoles(userId).then(({ roles: fetched, error }) => {
      if (cancelled) return;
      setRoles(fetched);
      setRolesError(error);
      setRolesLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [userId, authLoading]);

  const value = useMemo<RolesContextValue>(
    () => ({
      roles,
      isAdmin: roles.length > 0,
      isSuperAdmin: roles.includes('super_admin'),
      isContentEditor:
        roles.includes('super_admin') || roles.includes('content_editor'),
      canManageUsers:
        roles.includes('super_admin') || roles.includes('moderator'),
      rolesLoading,
      rolesError,
    }),
    [roles, rolesLoading, rolesError],
  );

  return <RolesContext.Provider value={value}>{children}</RolesContext.Provider>;
}
