/**
 * Back-office — attribution et révocation des rôles d'administration (US 8.7).
 *
 * C'est l'écran qui décide **qui peut administrer**. Il est réservé au `super_admin`, la RLS le
 * garantit — mais tout ce qui se passe entre le clic et la requête est ici, et rien n'y est
 * rattrapable côté serveur :
 *
 *  1. **Une attribution déjà active n'est pas une erreur.** `grantRole` renvoie `alreadyActive`
 *     plutôt qu'un échec : afficher « erreur » sur une action sans effet ferait croire à un
 *     problème de droits, et l'admin chercherait un problème qui n'existe pas.
 *  2. **Le champ n'est vidé qu'en cas de vraie attribution.** Le vider sur `alreadyActive`
 *     effacerait l'identifiant que l'admin vient de coller, sans qu'il puisse vérifier lequel.
 *  3. **La révocation demande confirmation.** Retirer un rôle peut verrouiller le back-office —
 *     c'est la seule action de l'app qui puisse en priver son dernier administrateur.
 *  4. **Deux surfaces d'erreur distinctes** : le formulaire et la liste. Les confondre afficherait
 *     l'échec d'une révocation au-dessus du champ de saisie.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../data/roles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/roles')>();
  return {
    ADMIN_ROLES: actual.ADMIN_ROLES,
    listRoles: vi.fn(),
    grantRole: vi.fn(),
    revokeRole: vi.fn(),
  };
});

const { RolesScreen } = await import('./RolesScreen');
const { grantRole, listRoles, revokeRole } = await import('../data/roles');
const { fr } = await import('../i18n/fr');

const mockList = vi.mocked(listRoles);
const mockGrant = vi.mocked(grantRole);
const mockRevoke = vi.mocked(revokeRole);

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/** Une attribution active. */
const attribution = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'role-1',
    user_id: USER_ID,
    role: 'content_editor',
    created_at: '2026-06-01T09:00:00.000Z',
    ...overrides,
  }) as never;

/** Rend l'écran et attend la fin du chargement de la liste. */
async function afficher(rows: unknown[] = []) {
  mockList.mockResolvedValue({ rows: rows as never, error: null });
  render(<RolesScreen />);
  await waitFor(() => expect(screen.queryByText(fr.roles.loading)).toBeNull());
}

/** Saisit un identifiant puis valide le formulaire. */
async function attribuer(id = USER_ID) {
  await userEvent.type(screen.getByLabelText(fr.roles.userIdLabel), id);
  await userEvent.click(screen.getByText(fr.roles.grantCta));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue({ rows: [], error: null });
  mockGrant.mockResolvedValue({ error: null, alreadyActive: false });
  mockRevoke.mockResolvedValue({ error: null });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

// ---------------------------------------------------------------------------
// Liste
// ---------------------------------------------------------------------------

describe('liste des attributions', () => {
  it('affiche un état de chargement avant la première réponse', () => {
    mockList.mockReturnValue(new Promise(() => {}) as never);

    render(<RolesScreen />);

    expect(screen.getByText(fr.roles.loading)).toBeInTheDocument();
  });

  it('sans attribution, le dit', async () => {
    await afficher();

    expect(screen.getByText(fr.roles.listEmpty)).toBeInTheDocument();
  });

  it('🔴 une erreur de lecture est ANNONCÉE, pas confondue avec « aucun rôle »', async () => {
    mockList.mockResolvedValue({ rows: [], error: new Error('rls') });

    render(<RolesScreen />);

    // « Aucune attribution » sur un écran de droits est une affirmation lourde : elle laisse
    // croire que personne n'administre plus rien.
    expect(await screen.findByRole('alert')).toHaveTextContent(fr.roles.error);
  });

  it('affiche l’identifiant, le rôle traduit et la date', async () => {
    await afficher([attribution()]);

    // Recherche bornée au tableau : les libellés de rôle existent aussi dans les `<option>` du
    // formulaire d'attribution, et une requête globale y trouverait deux nœuds.
    const tableau = within(screen.getByRole('table'));
    expect(tableau.getByText(USER_ID)).toBeInTheDocument();
    expect(tableau.getByText(fr.roles.roleNames.content_editor)).toBeInTheDocument();
    expect(tableau.getByText('01/06/2026')).toBeInTheDocument();
  });

  it('🔴 un rôle inconnu s’affiche tel quel plutôt que de disparaître', async () => {
    await afficher([attribution({ id: 'role-2', role: 'role_inedit' })]);

    // Un rôle ajouté en base et pas encore dans l'UI doit rester **visible et révocable** : le
    // masquer laisserait une habilitation active que personne ne peut retirer depuis l'écran.
    expect(screen.getByText('role_inedit')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Attribution
// ---------------------------------------------------------------------------

describe('attribution', () => {
  it('🔴 un identifiant vide n’émet AUCUNE requête', async () => {
    await afficher();

    await userEvent.click(screen.getByText(fr.roles.grantCta));

    expect(mockGrant).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(fr.roles.userIdRequired);
  });

  it('🔴 un identifiant fait d’espaces est refusé comme un vide', async () => {
    await afficher();

    await userEvent.type(screen.getByLabelText(fr.roles.userIdLabel), '    ');
    await userEvent.click(screen.getByText(fr.roles.grantCta));

    expect(mockGrant).not.toHaveBeenCalled();
  });

  it('🔴 l’identifiant est débarrassé de ses espaces avant l’envoi', async () => {
    await afficher();

    await attribuer(`  ${USER_ID}  `);

    // Les UUID sont copiés-collés depuis le dashboard Supabase, espace de fin compris. Sans le
    // `trim`, l'attribution partirait sur un identifiant qui ne correspond à personne.
    await waitFor(() => expect(mockGrant).toHaveBeenCalledWith(USER_ID, 'content_editor'));
  });

  it('attribue le rôle choisi', async () => {
    await afficher();

    await userEvent.selectOptions(
      screen.getByLabelText(fr.roles.roleLabel),
      'super_admin',
    );
    await attribuer();

    await waitFor(() => expect(mockGrant).toHaveBeenCalledWith(USER_ID, 'super_admin'));
  });

  it('recharge la liste après une attribution', async () => {
    await afficher();

    await attribuer();

    // Sans rechargement, la nouvelle habilitation n'apparaît pas et l'admin la ressaisit.
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
  });

  it('🔴 vide le champ APRÈS une vraie attribution', async () => {
    await afficher();

    await attribuer();

    await waitFor(() => expect(screen.getByLabelText(fr.roles.userIdLabel)).toHaveValue(''));
  });

  it('🔴 une attribution déjà active est un AVIS, pas une erreur', async () => {
    mockGrant.mockResolvedValue({ error: null, alreadyActive: true });
    await afficher();

    await attribuer();

    // Afficher « erreur » sur une action sans effet ferait chercher un problème de droits qui
    // n'existe pas — l'habilitation est déjà là, c'est le résultat voulu.
    expect(await screen.findByRole('status')).toHaveTextContent(fr.roles.alreadyAssigned);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('🔴 une attribution déjà active NE vide PAS le champ et ne recharge pas', async () => {
    mockGrant.mockResolvedValue({ error: null, alreadyActive: true });
    await afficher();

    await attribuer();

    // Vider le champ effacerait l'identifiant que l'admin vient de coller, sans qu'il puisse
    // vérifier lequel il avait saisi.
    expect(screen.getByLabelText(fr.roles.userIdLabel)).toHaveValue(USER_ID);
    expect(mockList).toHaveBeenCalledTimes(1);
  });

  it('🔴 un échec est annoncé DANS le formulaire, et ne vide pas le champ', async () => {
    mockGrant.mockResolvedValue({ error: new Error('rls'), alreadyActive: false });
    await afficher();

    await attribuer();

    expect(await screen.findByRole('alert')).toHaveTextContent(fr.roles.error);
    expect(screen.getByLabelText(fr.roles.userIdLabel)).toHaveValue(USER_ID);
    expect(mockList).toHaveBeenCalledTimes(1);
  });

  it('🔴 l’avis précédent est effacé à la tentative suivante', async () => {
    mockGrant.mockResolvedValueOnce({ error: null, alreadyActive: true });
    await afficher();

    await attribuer();
    expect(await screen.findByRole('status')).toBeInTheDocument();

    mockGrant.mockResolvedValue({ error: null, alreadyActive: false });
    await userEvent.click(screen.getByText(fr.roles.grantCta));

    // Un avis qui persiste après une attribution réussie ferait douter de ce qui vient d'être fait.
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });
});

// ---------------------------------------------------------------------------
// Révocation
// ---------------------------------------------------------------------------

describe('révocation', () => {
  it('🔴 demande confirmation avant de retirer un rôle', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await afficher([attribution()]);

    await userEvent.click(screen.getByText(fr.roles.revoke));

    // C'est la seule action de l'app qui puisse priver le back-office de son dernier
    // administrateur — et personne ne peut la rattraper depuis l'app.
    expect(mockRevoke).not.toHaveBeenCalled();
  });

  it('🔴 transmet le rôle ET l’utilisateur, pas seulement la ligne', async () => {
    await afficher([attribution()]);

    await userEvent.click(screen.getByText(fr.roles.revoke));

    // Le journal d'audit a besoin des deux : « attribution role-1 révoquée » n'apprend rien à
    // qui relit l'historique six mois plus tard.
    await waitFor(() =>
      expect(mockRevoke).toHaveBeenCalledWith('role-1', {
        role: 'content_editor',
        userId: USER_ID,
      }),
    );
  });

  it('recharge la liste après une révocation', async () => {
    await afficher([attribution()]);

    await userEvent.click(screen.getByText(fr.roles.revoke));

    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
  });

  it('🔴 un échec de révocation s’affiche sur la LISTE, pas dans le formulaire', async () => {
    mockRevoke.mockResolvedValue({ error: new Error('rls') });
    await afficher([attribution()]);

    await userEvent.click(screen.getByText(fr.roles.revoke));

    // Les deux surfaces sont distinctes : afficher l'échec d'une révocation au-dessus du champ de
    // saisie ferait croire que c'est l'attribution qui a échoué.
    expect(await screen.findByRole('alert')).toHaveTextContent(fr.roles.error);
    expect(mockList).toHaveBeenCalledTimes(1);
  });
});
