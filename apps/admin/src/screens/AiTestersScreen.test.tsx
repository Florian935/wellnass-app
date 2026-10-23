/**
 * Back-office — l'écran « Testeurs IA » (US ACCES-IA, spec §14 critère 15).
 *
 * L'écran tient la liste de ceux qui ont l'IA pendant la bêta fermée. Trois choses ne se rattrapent pas
 * côté serveur :
 *
 *  1. **Le mode affiché est celui que la fonction applique**, pas une valeur supposée : « ouvert à
 *     tous » doit se voir, et une fonction muette se dit « mode inconnu », jamais « bêta fermée ».
 *  2. **Un ajout sans effet n'est pas une erreur** (« déjà testeur »), et un e-mail inconnu ne vide pas
 *     le champ : l'administrateur doit pouvoir corriger sa saisie.
 *  3. **Le retrait demande confirmation** — il éteint l'IA chez quelqu'un au démarrage suivant.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../data/ai-testers', () => ({
  listAiTesters: vi.fn(),
  addAiTesterByEmail: vi.fn(),
  removeAiTester: vi.fn(),
  readAiAccessMode: vi.fn(),
}));

const { AiTestersScreen } = await import('./AiTestersScreen');
const { addAiTesterByEmail, listAiTesters, readAiAccessMode, removeAiTester } = await import('../data/ai-testers');
const { fr } = await import('../i18n/fr');

const mockList = vi.mocked(listAiTesters);
const mockAdd = vi.mocked(addAiTesterByEmail);
const mockRemove = vi.mocked(removeAiTester);
const mockMode = vi.mocked(readAiAccessMode);

const USER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

/** Un testeur tel que la vue `admin_ai_testers` le rend. */
const testeur = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'tester-1',
    user_id: USER_ID,
    email: 'paul.d@exemple.fr',
    first_name: 'Paul',
    created_at: '2026-10-23T08:00:00.000Z',
    added_by_email: 'florian@exemple.fr',
    last_used_on: '2026-10-22',
    calls_7d: 9,
    ...overrides,
  }) as never;

async function afficher() {
  render(<AiTestersScreen />);
  await waitFor(() => expect(screen.queryByText(fr.aiTesters.loading)).toBeNull());
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue({ rows: [testeur()], error: null });
  mockAdd.mockResolvedValue({ outcome: 'added', error: null });
  mockRemove.mockResolvedValue({ outcome: 'removed', error: null });
  mockMode.mockResolvedValue('testers');
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('le mode en service (spec D5)', () => {
  it('« bêta fermée » quand la fonction le dit', async () => {
    await afficher();
    expect(await screen.findByText(fr.aiTesters.modeTestersTitle)).toBeInTheDocument();
  });

  it('« ouvert à tous » se voit, avec la façon de refermer', async () => {
    mockMode.mockResolvedValue('open');
    await afficher();
    expect(await screen.findByText(fr.aiTesters.modeOpenTitle)).toBeInTheDocument();
    expect(screen.getByText(fr.aiTesters.modeOpenBody)).toBeInTheDocument();
  });

  it('🔴 une fonction muette dit « mode inconnu », jamais « bêta fermée »', async () => {
    mockMode.mockResolvedValue(null);
    await afficher();
    expect(await screen.findByText(fr.aiTesters.modeUnknownTitle)).toBeInTheDocument();
    expect(screen.queryByText(fr.aiTesters.modeTestersTitle)).toBeNull();
  });
});

describe('la liste', () => {
  it('affiche chaque testeur : e-mail, prénom, depuis, ajouté par, dernière utilisation, appels', async () => {
    await afficher();
    const row = screen.getByText('paul.d@exemple.fr').closest('tr')!;
    expect(within(row).getByText('Paul')).toBeInTheDocument();
    expect(within(row).getByText('23/10/2026')).toBeInTheDocument();
    expect(within(row).getByText('florian@exemple.fr')).toBeInTheDocument();
    expect(within(row).getByText('22/10/2026')).toBeInTheDocument();
    expect(within(row).getByText('9')).toBeInTheDocument();
    expect(screen.getByText(fr.aiTesters.listTitle.replace('{count}', '1'))).toBeInTheDocument();
  });

  it('jamais utilisé, ajouteur supprimé : « Jamais » et « — »', async () => {
    mockList.mockResolvedValue({ rows: [testeur({ last_used_on: null, added_by_email: null, calls_7d: 0 })], error: null });
    await afficher();
    const row = screen.getByText('paul.d@exemple.fr').closest('tr')!;
    expect(within(row).getByText(fr.aiTesters.never)).toBeInTheDocument();
    expect(within(row).getByText(fr.aiTesters.none)).toBeInTheDocument();
  });

  it('liste vide : le dit, avec sa conséquence', async () => {
    mockList.mockResolvedValue({ rows: [], error: null });
    await afficher();
    expect(screen.getByText(fr.aiTesters.empty)).toBeInTheDocument();
  });

  it('erreur de chargement : annoncée', async () => {
    mockList.mockResolvedValue({ rows: [], error: new Error('rls') });
    await afficher();
    expect(screen.getByRole('alert')).toHaveTextContent(fr.aiTesters.listError);
  });
});

describe('l’ajout par e-mail', () => {
  it('ajouté : message, champ vidé, liste rechargée', async () => {
    const user = userEvent.setup();
    await afficher();

    await user.type(screen.getByLabelText(fr.aiTesters.emailLabel), 'jeanne.martin@exemple.fr');
    await user.click(screen.getByRole('button', { name: fr.aiTesters.addCta }));

    expect(mockAdd).toHaveBeenCalledWith('jeanne.martin@exemple.fr');
    expect(await screen.findByRole('status')).toHaveTextContent(
      fr.aiTesters.added.replace('{email}', 'jeanne.martin@exemple.fr'),
    );
    expect(screen.getByLabelText(fr.aiTesters.emailLabel)).toHaveValue('');
    expect(mockList).toHaveBeenCalledTimes(2);
  });

  it('déjà testeur : une information, pas une erreur', async () => {
    mockAdd.mockResolvedValue({ outcome: 'already', error: null });
    const user = userEvent.setup();
    await afficher();

    await user.type(screen.getByLabelText(fr.aiTesters.emailLabel), 'paul.d@exemple.fr');
    await user.click(screen.getByRole('button', { name: fr.aiTesters.addCta }));

    expect(await screen.findByRole('status')).toHaveTextContent(fr.aiTesters.already);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('e-mail inconnu : erreur, et le champ garde la saisie pour la corriger', async () => {
    mockAdd.mockResolvedValue({ outcome: 'not_found', error: null });
    const user = userEvent.setup();
    await afficher();

    await user.type(screen.getByLabelText(fr.aiTesters.emailLabel), 'inconnu@exemple.fr');
    await user.click(screen.getByRole('button', { name: fr.aiTesters.addCta }));

    expect(await screen.findByRole('alert')).toHaveTextContent(fr.aiTesters.notFound);
    expect(screen.getByLabelText(fr.aiTesters.emailLabel)).toHaveValue('inconnu@exemple.fr');
  });

  it('saisie vide : rien n’est appelé', async () => {
    const user = userEvent.setup();
    await afficher();
    await user.click(screen.getByRole('button', { name: fr.aiTesters.addCta }));
    expect(await screen.findByRole('alert')).toHaveTextContent(fr.aiTesters.emailRequired);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('refus du serveur : erreur générique', async () => {
    mockAdd.mockResolvedValue({ outcome: null, error: new Error('non autorisé') });
    const user = userEvent.setup();
    await afficher();
    await user.type(screen.getByLabelText(fr.aiTesters.emailLabel), 'x@exemple.fr');
    await user.click(screen.getByRole('button', { name: fr.aiTesters.addCta }));
    expect(await screen.findByRole('alert')).toHaveTextContent(fr.aiTesters.error);
  });
});

describe('le retrait', () => {
  const retirer = () =>
    screen.getByRole('button', { name: fr.aiTesters.removeLabel.replace('{email}', 'paul.d@exemple.fr') });

  it('confirmé : retire par l’identifiant, puis recharge', async () => {
    const user = userEvent.setup();
    await afficher();

    await user.click(retirer());

    expect(window.confirm).toHaveBeenCalledWith(fr.aiTesters.removeConfirm.replace('{email}', 'paul.d@exemple.fr'));
    expect(mockRemove).toHaveBeenCalledWith(USER_ID);
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
  });

  it('annulé : rien n’est appelé', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    const user = userEvent.setup();
    await afficher();

    await user.click(retirer());

    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('échec : un message de retrait, pas « erreur de chargement »', async () => {
    mockRemove.mockResolvedValue({ outcome: null, error: new Error('non autorisé') });
    const user = userEvent.setup();
    await afficher();

    await user.click(retirer());

    expect(await screen.findByRole('alert')).toHaveTextContent(fr.aiTesters.removeError);
    expect(screen.queryByText(fr.aiTesters.listError)).toBeNull();
  });
});
