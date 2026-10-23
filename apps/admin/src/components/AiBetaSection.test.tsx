/**
 * Back-office — le bloc « Bêta IA » de la fiche utilisateur (US ACCES-IA, spec §14 critère 16).
 *
 * Il répond à « ce compte est-il testeur ? » et propose le geste inverse. Le retrait est confirmé : il
 * éteint l'IA chez la personne au démarrage suivant de son app.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../data/ai-testers', () => ({
  getAiTester: vi.fn(),
  addAiTester: vi.fn(),
  removeAiTester: vi.fn(),
}));

const { AiBetaSection } = await import('./AiBetaSection');
const { addAiTester, getAiTester, removeAiTester } = await import('../data/ai-testers');
const { fr } = await import('../i18n/fr');

const mockGet = vi.mocked(getAiTester);
const mockAdd = vi.mocked(addAiTester);
const mockRemove = vi.mocked(removeAiTester);

const USER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const testeur = {
  id: 'tester-1',
  user_id: USER_ID,
  email: 'paul.d@exemple.fr',
  first_name: 'Paul',
  created_at: '2026-10-23T08:00:00.000Z',
  added_by_email: 'florian@exemple.fr',
  last_used_on: null,
  calls_7d: 0,
} as never;

async function afficher() {
  render(
    <MemoryRouter>
      <AiBetaSection userId={USER_ID} />
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.queryByText(fr.users.aiBeta.loading)).toBeNull());
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAdd.mockResolvedValue({ outcome: 'added', error: null });
  mockRemove.mockResolvedValue({ outcome: 'removed', error: null });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('AiBetaSection', () => {
  it('testeur : « testeur depuis », le détail, et « Retirer des testeurs »', async () => {
    mockGet.mockResolvedValue({ tester: testeur, error: null });
    await afficher();

    expect(mockGet).toHaveBeenCalledWith(USER_ID);
    expect(screen.getByText(fr.users.aiBeta.testerSince.replace('{date}', '23/10/2026'))).toBeInTheDocument();
    expect(
      screen.getByText(
        fr.users.aiBeta.details
          .replace('{addedBy}', 'florian@exemple.fr')
          .replace('{lastUse}', fr.users.never)
          .replace('{calls}', '0'),
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: fr.users.aiBeta.remove })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: fr.users.aiBeta.allTesters })).toHaveAttribute('href', '/ai-testers');
  });

  it('pas testeur : le dit, et « Ajouter aux testeurs » ajoute par l’identifiant', async () => {
    mockGet.mockResolvedValueOnce({ tester: null, error: null }).mockResolvedValue({ tester: testeur, error: null });
    const user = userEvent.setup();
    await afficher();

    expect(screen.getByText(fr.users.aiBeta.notTester)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: fr.users.aiBeta.add }));

    expect(mockAdd).toHaveBeenCalledWith(USER_ID);
    expect(await screen.findByRole('status')).toHaveTextContent(fr.users.aiBeta.added);
    expect(await screen.findByRole('button', { name: fr.users.aiBeta.remove })).toBeInTheDocument();
  });

  it('retrait confirmé : retire, puis l’état se relit', async () => {
    mockGet.mockResolvedValueOnce({ tester: testeur, error: null }).mockResolvedValue({ tester: null, error: null });
    const user = userEvent.setup();
    await afficher();

    await user.click(screen.getByRole('button', { name: fr.users.aiBeta.remove }));

    expect(window.confirm).toHaveBeenCalledWith(fr.users.aiBeta.removeConfirm);
    expect(mockRemove).toHaveBeenCalledWith(USER_ID);
    expect(await screen.findByRole('status')).toHaveTextContent(fr.users.aiBeta.removed);
    expect(await screen.findByText(fr.users.aiBeta.notTester)).toBeInTheDocument();
  });

  it('ajout sans effet (« déjà testeur ») : pas de « Ajouté »', async () => {
    mockGet.mockResolvedValueOnce({ tester: null, error: null }).mockResolvedValue({ tester: testeur, error: null });
    mockAdd.mockResolvedValue({ outcome: 'already', error: null });
    const user = userEvent.setup();
    await afficher();

    await user.click(screen.getByRole('button', { name: fr.users.aiBeta.add }));

    expect(await screen.findByRole('status')).toHaveTextContent(fr.users.aiBeta.already);
  });

  it('retrait sans effet (« déjà retiré ») : pas de « Retiré »', async () => {
    mockGet.mockResolvedValueOnce({ tester: testeur, error: null }).mockResolvedValue({ tester: null, error: null });
    mockRemove.mockResolvedValue({ outcome: 'absent', error: null });
    const user = userEvent.setup();
    await afficher();

    await user.click(screen.getByRole('button', { name: fr.users.aiBeta.remove }));

    expect(await screen.findByRole('status')).toHaveTextContent(fr.users.aiBeta.absent);
  });

  it('retrait annulé : rien n’est appelé', async () => {
    mockGet.mockResolvedValue({ tester: testeur, error: null });
    vi.mocked(window.confirm).mockReturnValue(false);
    const user = userEvent.setup();
    await afficher();

    await user.click(screen.getByRole('button', { name: fr.users.aiBeta.remove }));

    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('échec (droits, réseau) : annoncé', async () => {
    mockGet.mockResolvedValue({ tester: null, error: null });
    mockAdd.mockResolvedValue({ outcome: null, error: new Error('non autorisé') });
    const user = userEvent.setup();
    await afficher();

    await user.click(screen.getByRole('button', { name: fr.users.aiBeta.add }));

    expect(await screen.findByRole('alert')).toHaveTextContent(fr.users.aiBeta.error);
  });
});
