import { PowerSyncContext } from '@powersync/react';
import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { connector, powerSync } from './system';

/**
 * Rend la base PowerSync disponible via le contexte et gère la connexion :
 * on se connecte dès qu'une session existe, on se déconnecte à la déconnexion.
 */
export function PowerSyncProvider({ children }: { children: ReactNode }) {
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    if (session) {
      void powerSync.connect(connector);
    } else {
      void powerSync.disconnect();
    }
  }, [session]);

  return <PowerSyncContext.Provider value={powerSync}>{children}</PowerSyncContext.Provider>;
}
