/**
 * Back-office — liste des programmes éditoriaux (US 8.4, ADMIN-01).
 *
 * **Dernier écran du back-office à 0 %.** Il ferme le volet admin du lot 5.
 *
 * `programs.test.ts` couvre les requêtes ; `archive-confirm.test.ts` couvre la composition du
 * message. Ce que seul l'écran monté peut dire :
 *
 *  1. **L'ordre « compter, puis demander confirmation »** (US ADMIN-01). L'US existe parce qu'on
 *     archivait en aveugle : le programme disparaissait de la base locale des utilisateurs qui le
 *     suivaient. Le décompte doit être lu **avant** `window.confirm`, et figurer dans le message.
 *  2. **Annuler n'écrit rien.** La moitié du travail d'une confirmation, et celle qu'on oublie.
 *  3. **La bannière de création ne se rejoue pas.** Elle est lue **une seule fois au montage**
 *     (initialiseur d'état) et l'entrée d'historique est aussitôt nettoyée. Sans ce nettoyage, un
 *     F5 réafficherait « programme créé » pour une création qui date d'il y a dix minutes.
 *  4. **Une ligne archivée n'a qu'une action.** Proposer « publier » sur un programme invisible
 *     envoie l'admin dans une impasse silencieuse.
 *  5. **La recherche porte sur les deux langues.** Un programme dont seul le nom EN correspond
 *     doit sortir — sinon la recherche ment selon la langue de saisie.
 */

import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { AdminProgramRow } from '../data/programs';

// ── Mocks : navigation, couche data, décompte d'usage ─────────────────────────

const navigate = vi.fn();
const location = { pathname: '/programs', state: null as unknown };
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useLocation: () => location,
}));

vi.mock('../data/programs', async () => {
  const shared = await import('@wellness/shared');
  return {
    PILLAR_BUILDER: ['strength', 'running'],
    PROGRAM_STATUSES: ['draft', 'published'],
    PROGRAM_LEVELS: shared.PROGRAM_LEVELS,
    listEditorialPrograms: vi.fn(async () => ({ rows: [], error: null })),
    archiveProgram: vi.fn(async () => ({ error: null })),
    restoreProgram: vi.fn(async () => ({ error: null })),
    setStatus: vi.fn(async () => ({ error: null })),
  };
});

vi.mock('../data/usage-counts', () => ({ fetchUsageSummary: vi.fn() }));

const { ProgramsScreen } = await import('./ProgramsScreen');
const { listEditorialPrograms, archiveProgram, restoreProgram, setStatus } = await import(
  '../data/programs'
);
const { fetchUsageSummary } = await import('../data/usage-counts');
const { fr } = await import('../i18n/fr');

const mockList = vi.mocked(listEditorialPrograms);
const mockArchive = vi.mocked(archiveProgram);
const mockRestore = vi.mocked(restoreProgram);
const mockSetStatus = vi.mocked(setStatus);
const mockUsage = vi.mocked(fetchUsageSummary);

/**
 * Résumé d'usage — trois états, et le troisième est celui qu'on oublie : `unavailable` n'est ni
 * « des usages » ni « aucun usage », c'est **« le décompte a échoué »**.
 */
const usage = (lines: { key: string; count: number }[] = [], unavailable = false) => ({
  total: lines.reduce((s, l) => s + l.count, 0),
  lines,
  isUnused: lines.length === 0 && !unavailable,
  unavailable,
});

/** Ligne de la liste — le type réel de la couche data, pour que le typecheck garde son mordant. */
type Ligne = AdminProgramRow;

const ligne = (over: Partial<Ligne> = {}): Ligne => ({
  id: 'prog-1',
  nameFr: 'Full body débutant',
  nameEn: 'Beginner full body',
  pillar: 'strength',
  level: 'beginner',
  status: 'draft',
  goal: null,
  durationWeeks: null,
  createdAt: '2026-07-15T10:00:00.000Z',
  deletedAt: null,
  ...over,
});

let confirmer: MockInstance<(message?: string) => boolean>;

beforeEach(() => {
  vi.clearAllMocks();
  location.state = null;
  mockList.mockResolvedValue({ rows: [], error: null });
  mockArchive.mockResolvedValue({ error: null });
  mockRestore.mockResolvedValue({ error: null });
  mockSetStatus.mockResolvedValue({ error: null });
  mockUsage.mockResolvedValue(usage());
  confirmer = vi.spyOn(window, 'confirm').mockReturnValue(true);
});

/** Monte l'écran avec les lignes fournies et attend la fin du chargement. */
async function afficher(rows: Ligne[] = [ligne()]) {
  mockList.mockResolvedValue({ rows, error: null });
  render(<ProgramsScreen />);
  await waitFor(() => expect(screen.queryByText(fr.programs.loading)).not.toBeInTheDocument());
  return userEvent.setup();
}

/** La ligne du tableau portant ce nom. */
const rangee = (nom: string) => screen.getByText(nom).closest('tr')!;

// ---------------------------------------------------------------------------
// Chargement et états
// ---------------------------------------------------------------------------

describe('chargement', () => {
  it('affiche l’indicateur puis le tableau', async () => {
    let debloquer!: (v: { rows: Ligne[]; error: null }) => void;
    mockList.mockReturnValue(new Promise((resolve) => (debloquer = resolve)));

    render(<ProgramsScreen />);
    expect(screen.getByText(fr.programs.loading)).toBeInTheDocument();

    debloquer({ rows: [ligne()], error: null });
    expect(await screen.findByText('Full body débutant')).toBeInTheDocument();
  });

  it('affiche l’état vide quand aucun programme ne remonte', async () => {
    await afficher([]);

    expect(screen.getByText(fr.programs.empty)).toBeInTheDocument();
  });

  it('signale une erreur de chargement', async () => {
    mockList.mockResolvedValue({ rows: [], error: new Error('réseau') });

    render(<ProgramsScreen />);

    expect(await screen.findByRole('alert')).toHaveTextContent(fr.programs.error);
  });

  it('traduit pilier, niveau et statut, et formate la date en JJ/MM/AAAA', async () => {
    await afficher([ligne({ status: 'published', createdAt: '2026-07-15T10:00:00.000Z' })]);

    const tr = rangee('Full body débutant');
    expect(within(tr).getByText(fr.programs.pillarStrength)).toBeInTheDocument();
    expect(within(tr).getByText(fr.programs.levelNames.beginner)).toBeInTheDocument();
    expect(within(tr).getByText(fr.programs.statusPublished)).toBeInTheDocument();
    // Convention projet : jamais l'ISO brut, jamais le format US.
    expect(within(tr).getByText('15/07/2026')).toBeInTheDocument();
  });

  it('retombe sur un libellé de repli pour un programme sans nom FR et sans niveau', async () => {
    await afficher([ligne({ nameFr: null, level: null })]);

    expect(screen.getByText(fr.programs.noName)).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Bannière de création — l'état posé par ProgramCreateScreen
// ---------------------------------------------------------------------------

describe('bannière de création', () => {
  it('🔴 s’affiche quand on arrive depuis la création, et nettoie l’historique', async () => {
    location.state = { created: true };

    await afficher();

    expect(screen.getByRole('status')).toHaveTextContent(fr.programs.createdOk);
    // Le nettoyage est ce qui empêche un F5 de rejouer la bannière : sans lui, « programme créé »
    // réapparaît sur une création vieille de dix minutes.
    expect(navigate).toHaveBeenCalledWith('/programs', { replace: true, state: {} });
  });

  it('ne s’affiche pas lors d’une visite directe', async () => {
    await afficher();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    // Aucun nettoyage inutile : naviguer sans raison ajouterait une entrée d'historique.
    expect(navigate).not.toHaveBeenCalled();
  });

  it('se ferme à la demande et ne revient pas', async () => {
    location.state = { created: true };
    const user = await afficher();

    await user.click(screen.getByRole('button', { name: fr.programs.dismiss }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Filtres et recherche
// ---------------------------------------------------------------------------

describe('filtres', () => {
  const DEUX = [
    ligne({ id: 'p1', nameFr: 'Full body', nameEn: 'Full body', pillar: 'strength' }),
    ligne({ id: 'p2', nameFr: 'Prépa 10 km', nameEn: '10k prep', pillar: 'running', status: 'published' }),
  ];

  it('filtre par pilier', async () => {
    const user = await afficher(DEUX);

    await user.selectOptions(screen.getByDisplayValue(fr.programs.allPillars), 'running');

    expect(screen.getByText('Prépa 10 km')).toBeInTheDocument();
    expect(screen.queryByText('Full body')).not.toBeInTheDocument();
  });

  it('filtre par statut', async () => {
    const user = await afficher(DEUX);

    await user.selectOptions(screen.getByDisplayValue(fr.programs.allStatuses), 'published');

    expect(screen.getByText('Prépa 10 km')).toBeInTheDocument();
    expect(screen.queryByText('Full body')).not.toBeInTheDocument();
  });

  it('🔴 cherche dans le nom FR **et** dans le nom EN', async () => {
    const user = await afficher(DEUX);

    // « 10k » n'existe que côté EN : une recherche limitée au FR ne le trouverait pas, et la
    // liste mentirait selon la langue dans laquelle l'admin pense.
    await user.type(screen.getByPlaceholderText(fr.programs.search), '10k');

    expect(screen.getByText('Prépa 10 km')).toBeInTheDocument();
    expect(screen.queryByText('Full body')).not.toBeInTheDocument();
  });

  it('ignore la casse et les espaces autour du terme', async () => {
    const user = await afficher(DEUX);

    await user.type(screen.getByPlaceholderText(fr.programs.search), '  FULL  ');

    expect(screen.getByText('Full body')).toBeInTheDocument();
  });

  it('affiche l’état vide quand aucun résultat ne correspond', async () => {
    const user = await afficher(DEUX);

    await user.type(screen.getByPlaceholderText(fr.programs.search), 'natation');

    // État vide, et non tableau vide : un tableau à en-têtes seuls laisse croire à un bug.
    expect(screen.getByText(fr.programs.empty)).toBeInTheDocument();
  });

  it('combine les filtres entre eux', async () => {
    const user = await afficher(DEUX);

    await user.selectOptions(screen.getByDisplayValue(fr.programs.allPillars), 'strength');
    await user.type(screen.getByPlaceholderText(fr.programs.search), '10k');

    expect(screen.getByText(fr.programs.empty)).toBeInTheDocument();
  });

  it('🔴 recharge depuis la base quand le périmètre d’archives change', async () => {
    const user = await afficher();
    expect(mockList).toHaveBeenCalledWith('active');

    await user.selectOptions(screen.getByLabelText(fr.archive.scopeArchived), 'archived');

    // Le périmètre n'est PAS un filtre local : les archives ne sont pas en mémoire, il faut
    // refaire la requête. Un filtrage côté client afficherait une liste vide à tort.
    await waitFor(() => expect(mockList).toHaveBeenCalledWith('archived'));
  });
});

// ---------------------------------------------------------------------------
// Archivage — US ADMIN-01
// ---------------------------------------------------------------------------

describe('archivage', () => {
  it('🔴 compte les usages AVANT de demander confirmation', async () => {
    mockUsage.mockResolvedValue(usage([{ key: 'users', count: 3 }]));
    const user = await afficher();

    await user.click(screen.getByRole('button', { name: fr.programs.archive }));

    await waitFor(() => expect(confirmer).toHaveBeenCalled());
    // L'ordre est la raison d'être de l'US : compter après, ou pas du tout, redonne exactement le
    // comportement « archivage en aveugle » qu'elle corrige.
    expect(mockUsage).toHaveBeenCalledWith('program', 'prog-1');
    expect(mockUsage.mock.invocationCallOrder[0]!).toBeLessThan(
      confirmer.mock.invocationCallOrder[0]!,
    );
  });

  it('🔴 fait figurer le décompte dans le message de confirmation', async () => {
    mockUsage.mockResolvedValue(usage([{ key: 'users', count: 3 }]));
    const user = await afficher();

    await user.click(screen.getByRole('button', { name: fr.programs.archive }));

    await waitFor(() => expect(confirmer).toHaveBeenCalled());
    const message = confirmer.mock.calls[0]![0] as string;
    // Un message générique reviendrait à ne pas avoir compté.
    expect(message).toContain('3');
  });

  it('🔴 annuler n’archive RIEN', async () => {
    confirmer.mockReturnValue(false);
    const user = await afficher();

    await user.click(screen.getByRole('button', { name: fr.programs.archive }));

    await waitFor(() => expect(confirmer).toHaveBeenCalled());
    expect(mockArchive).not.toHaveBeenCalled();
    // Et la liste n'est pas rechargée : rien n'a changé.
    expect(mockList).toHaveBeenCalledTimes(1);
  });

  it('archive et recharge la liste après confirmation', async () => {
    const user = await afficher();

    await user.click(screen.getByRole('button', { name: fr.programs.archive }));

    await waitFor(() =>
      expect(mockArchive).toHaveBeenCalledWith('prog-1', { label: 'Full body débutant' }),
    );
    // Rechargement : l'écran montre ce que la base contient, pas ce qu'il suppose avoir écrit.
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
  });

  it('signale l’échec d’un archivage sans recharger', async () => {
    mockArchive.mockResolvedValue({ error: new Error('contrainte') });
    const user = await afficher();

    await user.click(screen.getByRole('button', { name: fr.programs.archive }));

    expect(await screen.findByRole('alert')).toHaveTextContent(fr.programs.error);
    expect(mockList).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Lignes archivées
// ---------------------------------------------------------------------------

describe('ligne archivée', () => {
  const ARCHIVE = ligne({ deletedAt: '2026-07-20T09:00:00.000Z' });

  it('🔴 n’offre QUE la restauration', async () => {
    await afficher([ARCHIVE]);

    const tr = rangee('Full body débutant');
    expect(within(tr).getByRole('button', { name: fr.archive.restore })).toBeInTheDocument();
    // Éditer ou publier un contenu invisible n'a pas de sens : l'offrir mène à une impasse.
    expect(within(tr).queryByRole('button', { name: fr.programs.edit })).not.toBeInTheDocument();
    expect(within(tr).queryByRole('button', { name: fr.programs.publish })).not.toBeInTheDocument();
    expect(within(tr).queryByRole('button', { name: fr.programs.archive })).not.toBeInTheDocument();
  });

  it('écrit la date d’archivage à côté du nom', async () => {
    await afficher([ARCHIVE]);

    // La distinction ne repose pas que sur l'opacité : elle est écrite, donc lisible par tous.
    expect(screen.getByText(/20\/07\/2026/)).toBeInTheDocument();
  });

  it('restaure après confirmation et recharge', async () => {
    const user = await afficher([ARCHIVE]);

    await user.click(screen.getByRole('button', { name: fr.archive.restore }));

    await waitFor(() =>
      expect(mockRestore).toHaveBeenCalledWith('prog-1', { label: 'Full body débutant' }),
    );
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
  });

  it('🔴 annuler ne restaure RIEN', async () => {
    confirmer.mockReturnValue(false);
    const user = await afficher([ARCHIVE]);

    await user.click(screen.getByRole('button', { name: fr.archive.restore }));

    expect(mockRestore).not.toHaveBeenCalled();
  });

  it('signale l’échec d’une restauration', async () => {
    mockRestore.mockResolvedValue({ error: new Error('introuvable') });
    const user = await afficher([ARCHIVE]);

    await user.click(screen.getByRole('button', { name: fr.archive.restore }));

    expect(await screen.findByRole('alert')).toHaveTextContent(fr.programs.error);
  });
});

// ---------------------------------------------------------------------------
// Bascule de statut
// ---------------------------------------------------------------------------

describe('publication', () => {
  it('publie un brouillon', async () => {
    const user = await afficher([ligne({ status: 'draft' })]);

    await user.click(screen.getByRole('button', { name: fr.programs.publish }));

    await waitFor(() =>
      expect(mockSetStatus).toHaveBeenCalledWith('prog-1', 'published', {
        label: 'Full body débutant',
      }),
    );
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
  });

  it('🔴 repasse un programme publié en brouillon — la bascule va dans les deux sens', async () => {
    const user = await afficher([ligne({ status: 'published' })]);

    await user.click(screen.getByRole('button', { name: fr.programs.unpublish }));

    // Un `setStatus(id, 'published')` codé en dur passerait le test précédent et échouerait ici :
    // le bouton dépublierait sans rien dépublier.
    await waitFor(() =>
      expect(mockSetStatus).toHaveBeenCalledWith('prog-1', 'draft', {
        label: 'Full body débutant',
      }),
    );
  });

  it('n’exige aucune confirmation pour publier — l’action est réversible', async () => {
    const user = await afficher();

    await user.click(screen.getByRole('button', { name: fr.programs.publish }));

    await waitFor(() => expect(mockSetStatus).toHaveBeenCalled());
    expect(confirmer).not.toHaveBeenCalled();
  });

  it('signale l’échec d’une bascule sans recharger', async () => {
    mockSetStatus.mockResolvedValue({ error: new Error('refus') });
    const user = await afficher();

    await user.click(screen.getByRole('button', { name: fr.programs.publish }));

    expect(await screen.findByRole('alert')).toHaveTextContent(fr.programs.error);
    expect(mockList).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

describe('navigation', () => {
  it('ouvre le formulaire de création', async () => {
    const user = await afficher();

    await user.click(screen.getByRole('button', { name: fr.programs.new }));

    expect(navigate).toHaveBeenCalledWith('/programs/new');
  });

  it('ouvre l’édition de la ligne cliquée', async () => {
    const user = await afficher([ligne({ id: 'prog-42' })]);

    await user.click(screen.getByRole('button', { name: fr.programs.edit }));

    expect(navigate).toHaveBeenCalledWith('/programs/prog-42');
  });
});
