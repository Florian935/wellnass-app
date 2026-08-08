/**
 * Back-office — fiche d'un compte utilisateur (US 8.8a lecture seule, 8.8b modération).
 *
 * Deux exigences se croisent ici, et aucune ne se voit dans la couche data.
 *
 * **La sobriété RGPD.** Cet écran affiche le compte d'une personne réelle à un administrateur.
 * Il ne doit montrer que ce qui sert à l'administrer — jamais de donnée de santé. Un test qui
 * vérifie l'absence de quelque chose a mauvaise réputation ; celui-là est justifié, parce que le
 * jour où quelqu'un ajoutera « poids » ou « objectif calorique » à la fiche pour « rendre service »,
 * rien d'autre ne l'arrêtera.
 *
 * **Les garde-fous de modération sont en profondeur.** Les vrais vivent côté serveur, dans les RPC
 * `ban_user` / `unban_user` (anti-soi, anti-admin, motif obligatoire) — c'est bien là qu'ils
 * doivent être, l'UI n'est pas une frontière de sécurité. Mais l'UI doit **refuser d'émettre**
 * l'appel : proposer un bouton qui échouera systématiquement, sans dire pourquoi, est un défaut
 * d'interface même quand la sécurité tient.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useParams: () => ({ id: 'user-1' }),
}));

// `parseActivePillars` est repris **tel quel** via `importActual` : c'est une fonction pure, déjà
// testée dans `admin-users.test.ts`, et la remplacer par un double reviendrait à tester un stub.
// (Piège rencontré : la stubber en `undefined` fait planter le rendu, et TOUS les tests échouent
// sur « élément introuvable » — un symptôme à trois pas de la cause.)
vi.mock('../data/users', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/users')>();
  return {
    parseActivePillars: actual.parseActivePillars,
    getUser: vi.fn(),
    banUser: vi.fn(),
    unbanUser: vi.fn(),
    listUserBans: vi.fn(),
  };
});

const currentUser = { id: 'admin-1', email: 'admin@wellness.app' };
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: currentUser }) }));

const { UserDetailScreen } = await import('./UserDetailScreen');
const { banUser, getUser, listUserBans, unbanUser } = await import('../data/users');
const { fr } = await import('../i18n/fr');

const mockGetUser = vi.mocked(getUser);
const mockListBans = vi.mocked(listUserBans);
const mockBan = vi.mocked(banUser);
const mockUnban = vi.mocked(unbanUser);

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
    onboarding_completed_at: '2026-03-15T09:20:00.000Z',
    ...overrides,
  }) as Awaited<ReturnType<typeof getUser>>['user'];

/** Un événement de l'historique de modération. */
const evenement = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'ban-1',
    target_user_id: 'user-1',
    action: 'ban',
    reason: 'Spam répété',
    acted_by: 'admin-1',
    created_at: '2026-08-02T10:00:00.000Z',
    ...overrides,
  }) as never;

/** Rend l'écran et attend la fin du chargement. */
async function afficher(user = compte(), bans: unknown[] = []) {
  mockGetUser.mockResolvedValue({ user, error: null });
  mockListBans.mockResolvedValue({ rows: bans as never, error: null });
  render(<UserDetailScreen />);
  await waitFor(() => expect(screen.queryByText(fr.users.loading)).toBeNull());
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ user: compte(), error: null });
  mockListBans.mockResolvedValue({ rows: [], error: null });
  mockBan.mockResolvedValue({ error: null });
  mockUnban.mockResolvedValue({ error: null });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(window, 'prompt').mockReturnValue('Spam répété');
});

// ---------------------------------------------------------------------------
// États d'écran
// ---------------------------------------------------------------------------

describe('états d’écran', () => {
  it('affiche un état de chargement avant la première réponse', () => {
    mockGetUser.mockReturnValue(new Promise(() => {}) as never);
    mockListBans.mockReturnValue(new Promise(() => {}) as never);

    render(<UserDetailScreen />);

    expect(screen.getByText(fr.users.loading)).toBeInTheDocument();
  });

  it('🔴 une erreur est ANNONCÉE, jamais confondue avec un compte introuvable', async () => {
    mockGetUser.mockResolvedValue({ user: null, error: new Error('rls') });
    render(<UserDetailScreen />);

    // « Compte introuvable » sur une erreur de droits ferait conclure à une suppression.
    expect(await screen.findByRole('alert')).toHaveTextContent(fr.users.error);
    expect(screen.queryByText(fr.users.detail.notFound)).toBeNull();
  });

  it('🔴 une erreur sur le SEUL historique suffit à alerter', async () => {
    mockGetUser.mockResolvedValue({ user: compte(), error: null });
    mockListBans.mockResolvedValue({ rows: [], error: new Error('rls') });
    render(<UserDetailScreen />);

    // Un historique de modération partiellement chargé n'en est pas un : afficher la fiche avec
    // « aucun événement » laisserait croire qu'un compte banni ne l'a jamais été.
    expect(await screen.findByRole('alert')).toHaveTextContent(fr.users.error);
  });

  it('compte introuvable → mention explicite', async () => {
    await afficher(null as never);

    expect(screen.getByText(fr.users.detail.notFound)).toBeInTheDocument();
  });

  it('le retour à la liste reste offert dans TOUS les états', async () => {
    await afficher(null as never);

    await userEvent.click(screen.getByText(fr.users.detail.back));

    expect(navigate).toHaveBeenCalledWith('/users');
  });
});

// ---------------------------------------------------------------------------
// Contenu de la fiche
// ---------------------------------------------------------------------------

describe('contenu de la fiche', () => {
  it('affiche le compte, sa configuration et son profil', async () => {
    await afficher();

    expect(screen.getByText('coureur@example.com')).toBeInTheDocument();
    expect(screen.getByText('15/03/2026')).toBeInTheDocument();
    expect(screen.getByText('Camille')).toBeInTheDocument();
    expect(screen.getByText(fr.users.statusActive)).toBeInTheDocument();
  });

  it('🔴 n’affiche AUCUNE donnée de santé', async () => {
    await afficher();

    // Sobriété RGPD (spec §0) : la fiche sert à administrer un compte, pas à consulter la personne.
    // Ce test est la seule chose qui s'opposera à l'ajout « rendu service » d'un poids ou d'un
    // objectif calorique.
    const texte = document.body.textContent ?? '';
    for (const interdit of ['kg', 'kcal', 'IMC', 'poids', 'cycle', 'menstru']) {
      expect(texte.toLowerCase()).not.toContain(interdit.toLowerCase());
    }
  });

  it('joint les piliers actifs, et dit « — » quand il n’y en a aucun', async () => {
    await afficher(compte({ active_pillars: [] }));

    expect(screen.getAllByText(fr.users.none).length).toBeGreaterThan(0);
  });

  it('🔴 accepte des piliers rendus en chaîne JSON', async () => {
    // La colonne est `jsonb` : PostgREST peut rendre un tableau natif comme une chaîne selon le
    // chemin. Ne gérer qu'une forme afficherait « — » à un utilisateur qui a bien deux piliers.
    await afficher(compte({ active_pillars: '["strength"]' }));

    expect(screen.getByText(fr.users.pillars.strength)).toBeInTheDocument();
  });

  it('une connexion jamais faite est dite, pas laissée vide', async () => {
    await afficher(compte({ last_sign_in_at: null }));

    expect(screen.getByText(fr.users.never)).toBeInTheDocument();
  });

  it('un objectif inconnu retombe sur « — » plutôt que d’afficher sa clé technique', async () => {
    await afficher(compte({ main_goal: 'objectif_inexistant' }));

    expect(screen.queryByText('objectif_inexistant')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Garde-fous de modération
// ---------------------------------------------------------------------------

describe('garde-fous de modération', () => {
  it('🔴 on ne peut pas se bannir soi-même', async () => {
    await afficher(compte({ id: 'admin-1' }));

    // Le garde-fou réel est côté serveur ; l'UI doit refuser d'émettre l'appel, sinon elle offre
    // un bouton qui échouera toujours sans dire pourquoi.
    expect(screen.getByText(fr.users.ban.cannotBan)).toBeInTheDocument();
    expect(screen.queryByText(fr.users.ban.banAction)).toBeNull();
  });

  it('🔴 on ne peut pas bannir un autre administrateur', async () => {
    await afficher(compte({ is_admin: true }));

    expect(screen.getByText(fr.users.ban.cannotBan)).toBeInTheDocument();
    expect(screen.queryByText(fr.users.ban.banAction)).toBeNull();
  });

  it('🔴 `is_admin` absent est traité comme « non admin », pas comme un blocage', async () => {
    await afficher(compte({ is_admin: null }));

    // Traiter `null` comme « admin » rendrait la modération impossible sur tous les comptes dont
    // la colonne n'est pas renseignée — un garde-fou qui bloque tout ne protège rien.
    expect(screen.getByText(fr.users.ban.banAction)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Bannissement
// ---------------------------------------------------------------------------

describe('bannissement', () => {
  it('demande un motif, puis bannit', async () => {
    await afficher();

    await userEvent.click(screen.getByText(fr.users.ban.banAction));

    await waitFor(() => expect(mockBan).toHaveBeenCalledWith('user-1', 'Spam répété'));
  });

  it('🔴 annuler la saisie du motif ne bannit RIEN', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue(null);
    await afficher();

    await userEvent.click(screen.getByText(fr.users.ban.banAction));

    expect(mockBan).not.toHaveBeenCalled();
  });

  it('🔴 un motif vide ou fait d’espaces est refusé', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('   ');
    await afficher();

    await userEvent.click(screen.getByText(fr.users.ban.banAction));

    // Le motif est ce que l'utilisateur banni verra, et la trace de la décision. Un bannissement
    // sans motif est une sanction sans justification.
    expect(mockBan).not.toHaveBeenCalled();
  });

  it('le motif est débarrassé de ses espaces de bord', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('  Spam répété  ');
    await afficher();

    await userEvent.click(screen.getByText(fr.users.ban.banAction));

    await waitFor(() => expect(mockBan).toHaveBeenCalledWith('user-1', 'Spam répété'));
  });

  it('recharge la fiche après un bannissement réussi', async () => {
    await afficher();

    await userEvent.click(screen.getByText(fr.users.ban.banAction));

    // Sans rechargement, le statut afficherait « Actif » sur un compte qu'on vient de bannir.
    await waitFor(() => expect(mockGetUser).toHaveBeenCalledTimes(2));
  });

  it('🔴 un refus du serveur est annoncé et ne recharge pas', async () => {
    mockBan.mockResolvedValue({ error: new Error('anti-self') });
    await afficher();

    await userEvent.click(screen.getByText(fr.users.ban.banAction));

    // Recharger masquerait le refus derrière une fiche inchangée : l'admin croirait avoir banni.
    expect(await screen.findByRole('alert')).toHaveTextContent(fr.users.ban.error);
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Débannissement
// ---------------------------------------------------------------------------

describe('débannissement', () => {
  const banni = () => compte({ is_banned: true });

  it('affiche le motif courant', async () => {
    await afficher(banni(), [evenement()]);

    expect(screen.getByText(new RegExp(fr.users.ban.currentReasonLabel))).toHaveTextContent(
      'Spam répété',
    );
  });

  it('🔴 le motif courant est celui du DERNIER bannissement', async () => {
    await afficher(banni(), [
      evenement({ id: 'b3', reason: 'Récidive' }),
      evenement({ id: 'b2', action: 'unban', reason: null }),
      evenement({ id: 'b1', reason: 'Premier avertissement' }),
    ]);

    // L'historique est trié du plus récent au plus ancien : prendre le premier `ban` rencontré
    // donne le motif courant. Prendre le dernier afficherait une sanction levée depuis.
    const bloc = screen.getByText(new RegExp(fr.users.ban.currentReasonLabel));
    expect(bloc).toHaveTextContent('Récidive');
  });

  it('demande confirmation avant de lever la sanction', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await afficher(banni());

    await userEvent.click(screen.getByText(fr.users.ban.unbanAction));

    expect(mockUnban).not.toHaveBeenCalled();
  });

  it('confirmer débannit puis recharge', async () => {
    await afficher(banni());

    await userEvent.click(screen.getByText(fr.users.ban.unbanAction));

    await waitFor(() => expect(mockUnban).toHaveBeenCalledWith('user-1'));
    await waitFor(() => expect(mockGetUser).toHaveBeenCalledTimes(2));
  });

  it('🔴 un compte banni n’offre PAS le bouton de bannissement', async () => {
    await afficher(banni());

    // Bannir deux fois n'a pas de sens et produirait un historique incompréhensible.
    expect(screen.queryByText(fr.users.ban.banAction)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Historique
// ---------------------------------------------------------------------------

describe('historique de modération', () => {
  it('un historique vide le dit', async () => {
    await afficher();

    expect(screen.getByText(fr.users.ban.historyEmpty)).toBeInTheDocument();
  });

  it('affiche chaque événement avec sa date et son sens', async () => {
    await afficher(compte(), [
      evenement({ id: 'b2', action: 'unban', reason: null, created_at: '2026-08-05T10:00:00.000Z' }),
      evenement({ id: 'b1' }),
    ]);

    expect(screen.getByText(new RegExp(fr.users.ban.actionUnban))).toBeInTheDocument();
    expect(screen.getByText(/05\/08\/2026/)).toBeInTheDocument();
  });

  it('🔴 résout l’acteur en e-mail plutôt qu’en identifiant technique', async () => {
    mockGetUser.mockImplementation(async (id: string) =>
      id === 'admin-1'
        ? { user: { id: 'admin-1', email: 'moderateur@wellness.app' } as never, error: null }
        : { user: compte(), error: null },
    );
    mockListBans.mockResolvedValue({ rows: [evenement()] as never, error: null });
    render(<UserDetailScreen />);

    // « Décidé par 8f3a-… » n'apprend rien à personne. La responsabilité d'une sanction doit être
    // lisible, c'est la moitié de l'intérêt d'un journal de modération.
    expect(await screen.findByText('moderateur@wellness.app')).toBeInTheDocument();
  });

  it('un acteur non résolu retombe sur son identifiant, jamais sur du vide', async () => {
    mockGetUser.mockImplementation(async (id: string) =>
      id === 'acteur-inconnu'
        ? { user: null, error: null }
        : { user: compte(), error: null },
    );
    mockListBans.mockResolvedValue({
      rows: [evenement({ acted_by: 'acteur-inconnu' })] as never,
      error: null,
    });
    render(<UserDetailScreen />);

    expect(await screen.findByText('acteur-inconnu')).toBeInTheDocument();
  });

  it('🔴 ne résout chaque acteur QU’UNE fois, même sur dix événements', async () => {
    mockListBans.mockResolvedValue({
      rows: [
        evenement({ id: 'b1' }),
        evenement({ id: 'b2', action: 'unban' }),
        evenement({ id: 'b3' }),
      ] as never,
      error: null,
    });
    render(<UserDetailScreen />);

    // La résolution est un N+1 assumé (volume faible) : il ne doit au moins pas être un N+N.
    // 1 appel pour la fiche + 1 pour l'acteur unique.
    await waitFor(() => expect(mockGetUser).toHaveBeenCalledTimes(2));
  });
});
