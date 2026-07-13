import { useContext } from 'react';
import { RolesContext, type RolesContextValue } from './rolesContext';

/** Accès à l'état des rôles. À utiliser sous `<RolesProvider>`. */
export function useRoles(): RolesContextValue {
  const ctx = useContext(RolesContext);
  if (ctx === undefined) {
    throw new Error('useRoles doit être utilisé à l’intérieur d’un <RolesProvider>.');
  }
  return ctx;
}
