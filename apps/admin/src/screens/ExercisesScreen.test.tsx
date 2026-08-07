/**
 * Back-office — écran de liste des exercices (US 8.2, ADMIN-01).
 *
 * **Premier écran React du back-office monté en test.** Jusqu'ici seule la couche data était
 * couverte : on savait que `archiveExercise` émet la bonne requête, jamais qu'un clic sur
 * « Archiver » l'appelle — ni surtout qu'il ne l'appelle **pas** quand l'admin annule.
 *
 * Ce qui se joue ici, et que la couche data ne peut pas dire :
 *
 *  1. **L'ordre « compter, puis demander confirmation ».** L'US ADMIN-01 existe parce qu'on
 *     archivait en aveugle : le nom disparaissait de l'historique d'utilisateurs qui avaient fait
 *     l'exercice. Le décompte d'usage doit donc être **lu avant** la boîte de confirmation, et son
 *     résultat figurer dans le message. Compter après, ou pas du tout, redonnerait exactement le
 *     comportement que l'US corrige.
 *  2. **Annuler n'écrit rien.** C'est la moitié du travail d'une confirmation, et la moitié qu'on
 *     oublie de tester.
 *  3. **Une ligne archivée n'a qu'une action.** Publier ou éditer un contenu invisible n'a pas de
 *     sens ; l'offrir enverrait l'admin dans une impasse silencieuse.
 *  4. **La distinction visuelle ne repose pas que sur la couleur** (opacité + fond) : la mention
 *     « Archivé le … » est écrite à côté du nom.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks : la couche data et la navigation ────────────────────────────────────

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

vi.mock('../data/exercises', async () => {
  const shared = await import('@wellness/shared');
  return {
    MUSCLE_GROUPS: shared.MUSCLE_GROUPS,
    EXERCISE_STATUSES: ['draft', 'published'],
    listEditorialExercises: vi.fn(async () => ({ rows: [], error: null })),
    archiveExercise: vi.fn(async () => ({ error: null })),
    restoreExercise: vi.fn(async () => ({ error: null })),
    setStatus: vi.fn(async () => ({ error: null })),
  };
});

vi.mock('../data/usage-counts', () => ({
  fetchUsageSummary: vi.fn(),
}));

const { ExercisesScreen } = await import('./ExercisesScreen');
const {
  archiveExercise,
  listEditorialExercises,
  restoreExercise,
  setStatus,
} = await import('../data/exercises');
const { fetchUsageSummary } = await import('../data/usage-counts');
const { fr } = await import('../i18n/fr');

const mockList = vi.mocked(listEditorialExercises);
const mockArchive = vi.mocked(archiveExercise);
const mockRestore = vi.mocked(restoreExercise);
const mockSetStatus = vi.mocked(setStatus);
const mockUsage = vi.mocked(fetchUsageSummary);

/**
 * Résumé d'usage. Trois états, et le troisième est celui qu'on oublie : `unavailable` n'est ni
 * « des usages » ni « aucun usage », c'est **« le décompte a échoué »** — l'UI doit alors avertir
 * et non rassurer.
 */
const usage = (lines: { key: string; count: number }[] = [], unavailable = false) => ({
  total: lines.reduce((s, l) => s + l.count, 0),
  lines,
  isUnused: lines.length === 0 && !unavailable,
  unavailable,
});

/** Une ligne du tableau. */
const ligne = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'ex-1',
    musclePrimary: 'legs',
    equipment: 'barbell',
    status: 'published',
    createdAt: '2026-07-01T10:00:00.000Z',
    nameFr: 'Squat barre',
    nameEn: 'Barbell squat',
    deletedAt: null,
    ...overrides,
  }) as Awaited<ReturnType<typeof listEditorialExercises>>['rows'][number];

/** Rend l'écran et attend la fin du chargement initial. */
async function afficher(rows = [ligne()]) {
  mockList.mockResolvedValue({ rows, error: null });
  render(<ExercisesScreen />);
  await waitFor(() => expect(screen.queryByText(fr.exercises.loading)).toBeNull());
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue({ rows: [], error: null });
  mockArchive.mockResolvedValue({ error: null });
  mockRestore.mockResolvedValue({ error: null });
  mockSetStatus.mockResolvedValue({ error: null });
  mockUsage.mockResolvedValue(usage());
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

// ---------------------------------------------------------------------------
// États d'écran
// ---------------------------------------------------------------------------

describe('états d’écran', () => {
  it('affiche un état de chargement avant la première réponse', () => {
    render(<ExercisesScreen />);

    expect(screen.getByText(fr.exercises.loading)).toBeInTheDocument();
  });

  it('affiche un état vide rédigé, pas un tableau sans ligne', async () => {
    await afficher([]);

    expect(screen.getByText(fr.exercises.empty)).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('🔴 une erreur de chargement est ANNONCÉE, pas confondue avec un catalogue vide', async () => {
    mockList.mockResolvedValue({ rows: [], error: new Error('rls') });
    render(<ExercisesScreen />);

    // Sans le bandeau, un admin dont la session a expiré verrait « aucun exercice » et pourrait
    // conclure que le catalogue a été vidé.
    const alerte = await screen.findByRole('alert');
    expect(alerte).toHaveTextContent(fr.exercises.error);
  });

  it('affiche le nom, le groupe traduit et la date au format JJ/MM/AAAA', async () => {
    await afficher();

    // Recherche bornée au tableau : les libellés de groupe et de statut existent aussi dans les
    // `<option>` des filtres, et une requête globale y trouverait deux nœuds.
    const tableau = screen.getByRole('table');
    expect(screen.getByText('Squat barre')).toBeInTheDocument();
    expect(within(tableau).getByText(fr.exercises.groupNames.legs)).toBeInTheDocument();
    expect(within(tableau).getByText('01/07/2026')).toBeInTheDocument();
  });

  it('un exercice sans nom français reste visible, avec une mention explicite', async () => {
    await afficher([ligne({ nameFr: null })]);

    // Le masquer rendrait invisible exactement la fiche qu'il faut corriger.
    expect(screen.getByText(fr.exercises.noName)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Filtres
// ---------------------------------------------------------------------------

describe('filtres', () => {
  it('la recherche porte sur le nom FR **et** EN', async () => {
    await afficher([ligne(), ligne({ id: 'ex-2', nameFr: 'Développé couché', nameEn: 'Bench press' })]);

    await userEvent.type(screen.getByPlaceholderText(fr.exercises.search), 'bench');

    // Le catalogue est bilingue : chercher « bench » quand on connaît le nom anglais doit marcher.
    expect(screen.getByText('Développé couché')).toBeInTheDocument();
    expect(screen.queryByText('Squat barre')).toBeNull();
  });

  it('la recherche ignore la casse et les espaces autour', async () => {
    await afficher();

    await userEvent.type(screen.getByPlaceholderText(fr.exercises.search), '  SQUAT ');

    expect(screen.getByText('Squat barre')).toBeInTheDocument();
  });

  it('filtre par groupe musculaire', async () => {
    await afficher([ligne(), ligne({ id: 'ex-2', musclePrimary: 'chest', nameFr: 'Développé' })]);

    await userEvent.selectOptions(screen.getByDisplayValue(fr.exercises.filterGroup), 'chest');

    expect(screen.getByText('Développé')).toBeInTheDocument();
    expect(screen.queryByText('Squat barre')).toBeNull();
  });

  it('filtre par statut', async () => {
    // Le nom ne réutilise aucun libellé de filtre : « Brouillon » seul existerait aussi dans les
    // `<option>`, et l'assertion trouverait deux nœuds.
    await afficher([ligne(), ligne({ id: 'ex-2', status: 'draft', nameFr: 'Brouillon éditorial' })]);

    await userEvent.selectOptions(screen.getByDisplayValue(fr.exercises.filterStatus), 'draft');

    expect(screen.getByText('Brouillon éditorial')).toBeInTheDocument();
    expect(screen.queryByText('Squat barre')).toBeNull();
  });

  it('aucun résultat de filtre → état vide, pas un tableau à zéro ligne', async () => {
    await afficher();

    await userEvent.type(screen.getByPlaceholderText(fr.exercises.search), 'introuvable');

    expect(screen.getByText(fr.exercises.empty)).toBeInTheDocument();
  });

  it('🔴 changer de portée RECHARGE depuis la base, sans filtrer côté client', async () => {
    await afficher();

    await userEvent.selectOptions(screen.getByLabelText(fr.archive.scopeActive), 'archived');

    // Les archivés ne sont jamais chargés en portée « actifs » : les filtrer côté client donnerait
    // une corbeille systématiquement vide.
    await waitFor(() => expect(mockList).toHaveBeenLastCalledWith('archived'));
  });
});

// ---------------------------------------------------------------------------
// Archivage
// ---------------------------------------------------------------------------

describe('archivage', () => {
  it('🔴 compte les usages AVANT de demander confirmation', async () => {
    mockUsage.mockResolvedValue(usage([{ key: 'workoutSets', count: 42 }]));
    await afficher();

    await userEvent.click(screen.getByText(fr.exercises.archive));

    // C'est la raison d'être de l'US ADMIN-01 : archiver en aveugle faisait disparaître le nom de
    // l'historique d'utilisateurs qui avaient fait l'exercice. Le décompte doit être dans le
    // message, donc lu avant.
    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(mockUsage).toHaveBeenCalledWith('exercise', 'ex-1');
    expect(vi.mocked(window.confirm).mock.calls[0]?.[0]).toContain('42');
  });

  it('🔴 un décompte INDISPONIBLE avertit au lieu de rassurer', async () => {
    mockUsage.mockResolvedValue(usage([], true));
    await afficher();

    await userEvent.click(screen.getByText(fr.exercises.archive));

    // Le troisième état, celui qu'on oublie : ni « des usages » ni « aucun usage ». Afficher un
    // zéro rassurant ici ramènerait exactement l'archivage en aveugle que l'US corrige.
    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(vi.mocked(window.confirm).mock.calls[0]?.[0]).toContain(fr.archive.usageUnavailable);
  });

  it('un contenu inutilisé le DIT — une liste vide se lirait comme un bug', async () => {
    await afficher();

    await userEvent.click(screen.getByText(fr.exercises.archive));

    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(vi.mocked(window.confirm).mock.calls[0]?.[0]).toContain(fr.archive.usageNone);
  });

  it('🔴 annuler n’archive RIEN', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    await afficher();

    await userEvent.click(screen.getByText(fr.exercises.archive));

    await waitFor(() => expect(mockUsage).toHaveBeenCalled());
    expect(mockArchive).not.toHaveBeenCalled();
  });

  it('confirmer archive, avec le nom en libellé d’audit', async () => {
    await afficher();

    await userEvent.click(screen.getByText(fr.exercises.archive));

    await waitFor(() =>
      expect(mockArchive).toHaveBeenCalledWith('ex-1', { label: 'Squat barre' }),
    );
  });

  it('recharge la liste après un archivage réussi', async () => {
    await afficher();

    await userEvent.click(screen.getByText(fr.exercises.archive));

    // Sans rechargement, la ligne archivée resterait affichée comme active jusqu'au prochain F5.
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
  });

  it('🔴 un échec d’archivage est annoncé et ne recharge pas', async () => {
    mockArchive.mockResolvedValue({ error: new Error('rls') });
    await afficher();

    await userEvent.click(screen.getByText(fr.exercises.archive));

    // Recharger masquerait l'échec derrière une liste inchangée : l'admin croirait avoir archivé.
    expect(await screen.findByRole('alert')).toHaveTextContent(fr.exercises.error);
    expect(mockList).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Lignes archivées
// ---------------------------------------------------------------------------

describe('lignes archivées', () => {
  const archivee = () => ligne({ deletedAt: '2026-07-15T08:00:00.000Z' });

  it('🔴 n’offrent QUE la restauration', async () => {
    await afficher([archivee()]);

    // Publier ou éditer un contenu invisible enverrait l'admin dans une impasse silencieuse.
    expect(screen.getByText(fr.archive.restore)).toBeInTheDocument();
    expect(screen.queryByText(fr.exercises.edit)).toBeNull();
    expect(screen.queryByText(fr.exercises.unpublish)).toBeNull();
    expect(screen.queryByText(fr.exercises.archive)).toBeNull();
  });

  it('🔴 portent une mention TEXTUELLE, pas seulement une nuance de couleur', async () => {
    await afficher([archivee()]);

    expect(screen.getByText(new RegExp(fr.archive.archivedOn))).toBeInTheDocument();
    expect(screen.getByText(/15\/07\/2026/)).toBeInTheDocument();
  });

  it('la restauration demande confirmation', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    await afficher([archivee()]);

    await userEvent.click(screen.getByText(fr.archive.restore));

    expect(mockRestore).not.toHaveBeenCalled();
  });

  it('confirmer restaure puis recharge', async () => {
    await afficher([archivee()]);

    await userEvent.click(screen.getByText(fr.archive.restore));

    await waitFor(() => expect(mockRestore).toHaveBeenCalledWith('ex-1', { label: 'Squat barre' }));
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
  });

  it('🔴 la restauration ne compte AUCUN usage', async () => {
    await afficher([archivee()]);

    await userEvent.click(screen.getByText(fr.archive.restore));

    // Remettre en service n'a aucun effet destructif : un décompte serait un aller-retour réseau
    // inutile, et surtout un message alarmiste sur une action inoffensive.
    expect(mockUsage).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Publication
// ---------------------------------------------------------------------------

describe('publication', () => {
  it('🔴 bascule vers l’état INVERSE de celui affiché', async () => {
    await afficher([ligne({ status: 'published' })]);

    await userEvent.click(screen.getByText(fr.exercises.unpublish));

    await waitFor(() =>
      expect(mockSetStatus).toHaveBeenCalledWith('ex-1', 'draft', { label: 'Squat barre' }),
    );
  });

  it('publie un brouillon', async () => {
    await afficher([ligne({ status: 'draft' })]);

    await userEvent.click(screen.getByText(fr.exercises.publish));

    await waitFor(() =>
      expect(mockSetStatus).toHaveBeenCalledWith('ex-1', 'published', { label: 'Squat barre' }),
    );
  });

  it('🔴 ne demande AUCUNE confirmation — l’action est réversible d’un clic', async () => {
    await afficher();

    await userEvent.click(screen.getByText(fr.exercises.unpublish));

    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('un échec est annoncé et ne recharge pas', async () => {
    mockSetStatus.mockResolvedValue({ error: new Error('rls') });
    await afficher();

    await userEvent.click(screen.getByText(fr.exercises.unpublish));

    expect(await screen.findByRole('alert')).toHaveTextContent(fr.exercises.error);
    expect(mockList).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

describe('navigation', () => {
  it('ouvre le formulaire de création', async () => {
    await afficher();

    await userEvent.click(screen.getByText(fr.exercises.new));

    expect(navigate).toHaveBeenCalledWith('/exercises/new');
  });

  it('ouvre l’édition d’une ligne', async () => {
    await afficher();

    await userEvent.click(screen.getByText(fr.exercises.edit));

    expect(navigate).toHaveBeenCalledWith('/exercises/ex-1');
  });
});
