/**
 * Back-office — le menu latéral (US ACCES-IA, spec §14 critère 15).
 *
 * Aucun test ne couvrait le menu jusqu'ici. Celui-ci vérifie l'entrée « Testeurs IA » : elle suit le
 * même droit que « Utilisateurs » (`canManageUsers` : super_admin et modérateur), et n'apparaît à
 * personne d'autre. La route, elle, est gardée de la même façon dans `App.tsx`.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const roles = { isSuperAdmin: false, isContentEditor: false, canManageUsers: false };

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 'admin-1', email: 'admin@exemple.fr' }, signOut: vi.fn() }),
}));
vi.mock('../auth/useRoles', () => ({ useRoles: () => roles }));

const { AdminLayout } = await import('./AdminLayout');
const { fr } = await import('../i18n/fr');

function afficher(overrides: Partial<typeof roles>) {
  Object.assign(roles, { isSuperAdmin: false, isContentEditor: false, canManageUsers: false }, overrides);
  render(
    <MemoryRouter>
      <AdminLayout />
    </MemoryRouter>,
  );
}

describe('menu « Testeurs IA » (US ACCES-IA)', () => {
  it('présent pour un gestionnaire d’utilisateurs, et mène à /ai-testers', () => {
    afficher({ canManageUsers: true });
    const lien = screen.getByRole('link', { name: new RegExp(fr.aiTesters.nav) });
    expect(lien).toHaveAttribute('href', '/ai-testers');
  });

  it('absent pour un éditeur de contenu', () => {
    afficher({ isContentEditor: true });
    expect(screen.queryByRole('link', { name: new RegExp(fr.aiTesters.nav) })).toBeNull();
  });
});
