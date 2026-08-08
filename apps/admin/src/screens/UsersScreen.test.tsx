/**
 * Back-office — liste des comptes utilisateurs (US 8.8a, lecture seule).
 *
 * Un écran sans aucune action destructive, et pourtant trois mécanismes y déterminent s'il est
 * utilisable :
 *
 *  1. **La recherche est débouncée à 300 ms, et remet la page à zéro.** Sans le débounce, taper
 *     « martin » émet six requêtes réseau ; sans le reset de page, chercher depuis la page 4
 *     interroge la page 4 d'un résultat qui n'en a qu'une, et l'écran annonce « aucun compte » à
 *     quelqu'un dont la recherche a bien des résultats.
 *  2. **« Aucun résultat » et « aucun compte » sont deux messages différents.** Le second se lit
 *     comme « la base est vide » — sur un écran d'administration, c'est alarmant à tort.
 *  3. **La sobriété RGPD**, comme sur la fiche détail : aucune donnée de santé, et aucune action.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

// `parseActivePillars` et `USERS_PAGE_SIZE` sont repris tels quels : une fonction pure et une
// constante, déjà testées ailleurs. Les stubber ne testerait que le stub (voir §8).
vi.mock('../data/users', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/users')>();
  return {
    parseActivePillars: actual.parseActivePillars,
    USERS_PAGE_SIZE: actual.USERS_PAGE_SIZE,
    listUsers: vi.fn(),
  };
});

const { UsersScreen } = await import('./UsersScreen');
const { listUsers, USERS_PAGE_SIZE } = await import('../data/users');
const { fr } = await import('../i18n/fr');

const mockList = vi.mocked(listUsers);

/** Un compte tel que la vue `admin_users` le rend. */
const compte = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'user-1',
    email: 'coureur@example.com',
    created_at: '2026-03-15T09:00:00.000Z',
    last_sign_in_at: '2026-08-01T18:30:00.000Z',
    is_banned: false,
    is_admin: false,
    active_pillars: ['strength', 'running'],
    language: 'fr',
    first_name: 'Camille',
    main_goal: 'muscle_gain',
    onboarding_completed_at: null,
    ...overrides,
  }) as never;

/** Rend l'écran et attend la fin du chargement. */
async function afficher(rows: unknown[] = [compte()], count = rows.length) {
  mockList.mockResolvedValue({ rows: rows as never, count, error: null });
  render(<UsersScreen />);
  await waitFor(() => expect(screen.queryByText(fr.users.loading)).toBeNull());
}

/** Les options passées au dernier appel. */
const dernierAppel = () => mockList.mock.calls.at(-1)?.[0] ?? {};

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue({ rows: [], count: 0, error: null });
});

// ---------------------------------------------------------------------------
// États d'écran
// ---------------------------------------------------------------------------

describe('états d’écran', () => {
  it('affiche un état de chargement avant la première réponse', () => {
    mockList.mockReturnValue(new Promise(() => {}) as never);

    render(<UsersScreen />);

    expect(screen.getByText(fr.users.loading)).toBeInTheDocument();
  });

  it('🔴 une erreur est ANNONCÉE, pas confondue avec une base vide', async () => {
    mockList.mockResolvedValue({ rows: [] as never, count: 0, error: new Error('rls') });

    render(<UsersScreen />);

    expect(await screen.findByRole('alert')).toHaveTextContent(fr.users.error);
  });

  it('affiche e-mail, dates, piliers et statut', async () => {
    await afficher();

    const tableau = within(screen.getByRole('table'));
    expect(tableau.getByText('coureur@example.com')).toBeInTheDocument();
    expect(tableau.getByText('15/03/2026')).toBeInTheDocument();
    expect(tableau.getByText(fr.users.statusActive)).toBeInTheDocument();
  });

  it('🔴 n’affiche AUCUNE donnée de santé', async () => {
    await afficher();

    // Même exigence que sur la fiche détail : l'écran sert à administrer des comptes, pas à
    // consulter des personnes. Ce test est ce qui s'opposera à l'ajout « pratique » d'un poids.
    const texte = (document.body.textContent ?? '').toLowerCase();
    for (const interdit of ['kg', 'kcal', 'imc', 'poids', 'cycle', 'menstru']) {
      expect(texte).not.toContain(interdit);
    }
  });

  it('🔴 l’écran ne propose AUCUNE action', async () => {
    await afficher();

    // Bannir se fait depuis la fiche détail, après confirmation. Offrir l'action depuis une liste
    // de vingt-cinq lignes, c'est un clic mal placé qui sanctionne la mauvaise personne.
    const boutons = screen.getAllByRole('button').map((b) => b.textContent);
    expect(boutons).toEqual([fr.users.prev, fr.users.next]);
  });

  it('une connexion jamais faite est dite, pas laissée vide', async () => {
    await afficher([compte({ last_sign_in_at: null })]);

    expect(within(screen.getByRole('table')).getByText(fr.users.never)).toBeInTheDocument();
  });

  it('🔴 accepte des piliers rendus en chaîne JSON', async () => {
    // La colonne est `jsonb` : PostgREST peut rendre un tableau natif comme une chaîne selon le
    // chemin. Ne gérer qu'une forme afficherait « — » à quelqu'un qui a bien deux piliers.
    await afficher([compte({ active_pillars: '["strength"]' })]);

    expect(within(screen.getByRole('table')).getByText(fr.users.pillars.strength)).toBeInTheDocument();
  });

  it('ouvre la fiche au clic sur la ligne', async () => {
    await afficher([compte({ id: 'user-42' })]);

    await userEvent.click(screen.getByText('coureur@example.com'));

    expect(navigate).toHaveBeenCalledWith('/users/user-42');
  });
});

// ---------------------------------------------------------------------------
// Recherche
// ---------------------------------------------------------------------------

describe('recherche', () => {
  it('🔴 est débouncée — taper n’émet pas une requête par touche', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await afficher();
    const appelsInitiaux = mockList.mock.calls.length;

    await userEvent.type(screen.getByPlaceholderText(fr.users.search), 'martin');

    // Six touches, zéro requête tant que la frappe n'est pas retombée.
    expect(mockList.mock.calls.length).toBe(appelsInitiaux);

    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(dernierAppel()).toMatchObject({ search: 'martin' }));
    vi.useRealTimers();
  });

  it('🔴 revient à la page 1 quand le terme change', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Deux pages de résultats, pour pouvoir avancer.
    await afficher([compte()], USERS_PAGE_SIZE * 2);

    await userEvent.click(screen.getByText(fr.users.next));
    await waitFor(() => expect(dernierAppel()).toMatchObject({ page: 1 }));

    await userEvent.type(screen.getByPlaceholderText(fr.users.search), 'martin');
    await vi.advanceTimersByTimeAsync(400);

    // Sans ce reset, chercher depuis la page 4 interroge la page 4 d'un résultat qui n'en a
    // qu'une : l'écran annonce « aucun compte » alors que la recherche a des résultats.
    await waitFor(() => expect(dernierAppel()).toMatchObject({ search: 'martin', page: 0 }));
    vi.useRealTimers();
  });

  it('🔴 « aucun résultat » et « aucun compte » sont deux messages distincts', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await afficher([], 0);

    // Sans recherche : la base est vide.
    expect(screen.getByText(fr.users.empty)).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText(fr.users.search), 'introuvable');
    await vi.advanceTimersByTimeAsync(400);

    // Avec recherche : c'est la recherche qui ne rend rien. Réutiliser « aucun compte » se lirait
    // comme « la base est vide » — alarmant à tort sur un écran d'administration.
    await waitFor(() => expect(screen.getByText(fr.users.emptySearch)).toBeInTheDocument());
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

describe('pagination', () => {
  it('🔴 sur une page unique, les deux boutons sont désactivés', async () => {
    await afficher([compte()], 1);

    // Un bouton actif qui ne fait rien se lit comme un écran cassé.
    expect(screen.getByText(fr.users.prev)).toBeDisabled();
    expect(screen.getByText(fr.users.next)).toBeDisabled();
  });

  it('🔴 le nombre de pages est calculé sur le décompte TOTAL, pas sur la page reçue', async () => {
    await afficher([compte()], USERS_PAGE_SIZE * 3);

    // La page ne contient qu'une ligne (mock), mais le total en annonce trois pages : c'est le
    // `count` qui fait foi, sinon la pagination s'arrêterait à la première page.
    expect(
      screen.getByText(fr.users.pageInfo.replace('{page}', '1').replace('{total}', '3')),
    ).toBeInTheDocument();
    expect(screen.getByText(fr.users.next)).not.toBeDisabled();
  });

  it('avance et recule d’une page', async () => {
    await afficher([compte()], USERS_PAGE_SIZE * 2);

    await userEvent.click(screen.getByText(fr.users.next));
    await waitFor(() => expect(dernierAppel()).toMatchObject({ page: 1 }));

    await userEvent.click(screen.getByText(fr.users.prev));
    await waitFor(() => expect(dernierAppel()).toMatchObject({ page: 0 }));
  });

  it('🔴 ne dépasse pas la dernière page', async () => {
    await afficher([compte()], USERS_PAGE_SIZE * 2);

    await userEvent.click(screen.getByText(fr.users.next));

    // Page 2 sur 2 : le bouton doit se désactiver, sinon on interroge une page vide et l'écran
    // bascule sur « aucun compte » sans que rien n'ait changé.
    await waitFor(() => expect(screen.getByText(fr.users.next)).toBeDisabled());
  });
});
