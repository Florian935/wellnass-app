import { createContext } from 'react';
import type { AdminRole } from '../data/roles';

export interface RolesContextValue {
  /** Rôles actifs de l'utilisateur courant (vide si non-admin ou erreur). */
  roles: AdminRole[];
  /** A au moins un rôle actif → accès au back-office. */
  isAdmin: boolean;
  /** A le rôle `super_admin` → gestion des rôles. */
  isSuperAdmin: boolean;
  /** Éditeur de contenu (`super_admin` ou `content_editor`) → CRUD du contenu éditorial. */
  isContentEditor: boolean;
  /** Chargement des rôles en cours (après session établie). */
  rolesLoading: boolean;
  /** Erreur de lecture des rôles (table absente, réseau…) ; traitée comme non-admin. */
  rolesError: unknown;
}

/** Contexte des rôles. Peuplé par `<RolesProvider>`, lu via `useRoles()`. */
export const RolesContext = createContext<RolesContextValue | undefined>(undefined);
