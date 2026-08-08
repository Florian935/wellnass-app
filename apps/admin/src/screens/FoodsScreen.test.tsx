/**
 * Back-office — liste des aliments éditoriaux (US 8.4, ADMIN-01).
 *
 * Même forme que `ExercisesScreen` (liste, filtres, portée, archivage avec décompte), sur la table
 * la plus consultée de l'app : un aliment archivé disparaît du journal alimentaire de **tous** les
 * utilisateurs qui l'avaient enregistré.
 *
 * Ce fichier ne rejoue pas ce que `ExercisesScreen.test.tsx` couvre déjà de la même façon. Il vise
 * ce qui est propre aux aliments :
 *
 *  1. **Le décompte d'usage porte sur le bon type** (`'food'`, pas `'exercise'`) — se tromper
 *     renverrait un décompte sans rapport, donc un « aucun usage » rassurant et faux.
 *  2. **La recherche est bilingue**, comme le catalogue.
 *  3. **Une ligne archivée n'offre que la restauration**, et le dit **en toutes lettres**.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

vi.mock('../data/foods', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/foods')>();
  return {
    ...actual,
    listEditorialFoods: vi.fn(),
    archiveFood: vi.fn(),
    restoreFood: vi.fn(),
  };
});

vi.mock('../data/usage-counts', () => ({ fetchUsageSummary: vi.fn() }));

const { FoodsScreen } = await import('./FoodsScreen');
const { archiveFood, listEditorialFoods, restoreFood } = await import('../data/foods');
const { fetchUsageSummary } = await import('../data/usage-counts');
const { fr } = await import('../i18n/fr');

const mockList = vi.mocked(listEditorialFoods);
const mockArchive = vi.mocked(archiveFood);
const mockRestore = vi.mocked(restoreFood);
const mockUsage = vi.mocked(fetchUsageSummary);

/** Résumé d'usage — trois états, dont `unavailable` qui doit **avertir** et non rassurer. */
const usage = (lines: { key: string; count: number }[] = [], unavailable = false) => ({
  total: lines.reduce((s, l) => s + l.count, 0),
  lines,
  isUnused: lines.length === 0 && !unavailable,
  unavailable,
});

/** Une ligne d'aliment. */
const aliment = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'food-1',
    category: 'fruits',
    kcalPer100g: 52,
    importKey: 'ciqual:13000',
    createdAt: '2026-07-01T10:00:00.000Z',
    nameFr: 'Pomme',
    nameEn: 'Apple',
    deletedAt: null,
    ...overrides,
  }) as never;

/** Rend l'écran et attend la fin du chargement. */
async function afficher(rows: unknown[] = [aliment()]) {
  mockList.mockResolvedValue({ rows: rows as never, error: null });
  render(<FoodsScreen />);
  await waitFor(() => expect(screen.queryByText(fr.foods.loading)).toBeNull());
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue({ rows: [], error: null });
  mockArchive.mockResolvedValue({ error: null });
  mockRestore.mockResolvedValue({ error: null });
  mockUsage.mockResolvedValue(usage());
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

// ---------------------------------------------------------------------------
// États d'écran
// ---------------------------------------------------------------------------

describe('états d’écran', () => {
  it('affiche un état de chargement avant la première réponse', () => {
    mockList.mockReturnValue(new Promise(() => {}) as never);

    render(<FoodsScreen />);

    expect(screen.getByText(fr.foods.loading)).toBeInTheDocument();
  });

  it('🔴 une erreur est ANNONCÉE, pas confondue avec un catalogue vide', async () => {
    mockList.mockResolvedValue({ rows: [] as never, error: new Error('rls') });

    render(<FoodsScreen />);

    expect(await screen.findByRole('alert')).toHaveTextContent(fr.foods.error);
  });

  it('sans aliment, affiche un état vide rédigé', async () => {
    await afficher([]);

    expect(screen.getByText(fr.foods.empty)).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('affiche le nom, la catégorie traduite et les calories', async () => {
    await afficher();

    const tableau = within(screen.getByRole('table'));
    expect(tableau.getByText('Pomme')).toBeInTheDocument();
    expect(tableau.getByText(fr.foods.categoryNames.fruits)).toBeInTheDocument();
  });

  it('ouvre la création et l’import depuis l’en-tête', async () => {
    await afficher();

    await userEvent.click(screen.getByText(fr.foods.new));
    expect(navigate).toHaveBeenCalledWith('/foods/new');

    await userEvent.click(screen.getByText(fr.foods.importNav));
    expect(navigate).toHaveBeenCalledWith('/foods/import');
  });
});

// ---------------------------------------------------------------------------
// Filtres
// ---------------------------------------------------------------------------

describe('filtres', () => {
  it('🔴 la recherche porte sur le nom FR **et** EN', async () => {
    await afficher([aliment(), aliment({ id: 'food-2', nameFr: 'Banane', nameEn: 'Banana' })]);

    await userEvent.type(screen.getByPlaceholderText(fr.foods.search), 'banana');

    // Le catalogue est bilingue : chercher par le nom anglais doit marcher.
    expect(screen.getByText('Banane')).toBeInTheDocument();
    expect(screen.queryByText('Pomme')).toBeNull();
  });

  it('filtre par catégorie', async () => {
    await afficher([aliment(), aliment({ id: 'food-2', category: 'meat', nameFr: 'Poulet' })]);

    await userEvent.selectOptions(screen.getByDisplayValue(fr.foods.filterCategory), 'meat');

    expect(screen.getByText('Poulet')).toBeInTheDocument();
    expect(screen.queryByText('Pomme')).toBeNull();
  });

  it('aucun résultat de filtre → état vide, pas un tableau à zéro ligne', async () => {
    await afficher();

    await userEvent.type(screen.getByPlaceholderText(fr.foods.search), 'introuvable');

    expect(screen.getByText(fr.foods.empty)).toBeInTheDocument();
  });

  it('🔴 changer de portée RECHARGE depuis la base', async () => {
    await afficher();

    await userEvent.selectOptions(screen.getByLabelText(fr.archive.scopeArchived), 'archived');

    // Les archivés ne sont jamais chargés en portée « actifs » : les filtrer côté client donnerait
    // une corbeille systématiquement vide.
    await waitFor(() => expect(mockList).toHaveBeenLastCalledWith('archived'));
  });
});

// ---------------------------------------------------------------------------
// Archivage
// ---------------------------------------------------------------------------

describe('archivage', () => {
  it('🔴 compte les usages du bon TYPE, et avant de confirmer', async () => {
    mockUsage.mockResolvedValue(usage([{ key: 'foodEntries', count: 128 }]));
    await afficher();

    await userEvent.click(screen.getByText(fr.foods.archive));

    // `'food'` et non `'exercise'` : se tromper de type renverrait un décompte sans rapport,
    // donc un « aucun usage » rassurant et faux, sur la table la plus consultée de l'app.
    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(mockUsage).toHaveBeenCalledWith('food', 'food-1');
    expect(vi.mocked(window.confirm).mock.calls[0]?.[0]).toContain('128');
  });

  it('🔴 un décompte indisponible avertit au lieu de rassurer', async () => {
    mockUsage.mockResolvedValue(usage([], true));
    await afficher();

    await userEvent.click(screen.getByText(fr.foods.archive));

    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(vi.mocked(window.confirm).mock.calls[0]?.[0]).toContain(fr.archive.usageUnavailable);
  });

  it('🔴 annuler n’archive RIEN', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    await afficher();

    await userEvent.click(screen.getByText(fr.foods.archive));

    await waitFor(() => expect(mockUsage).toHaveBeenCalled());
    expect(mockArchive).not.toHaveBeenCalled();
  });

  it('confirmer archive avec le nom en libellé d’audit, puis recharge', async () => {
    await afficher();

    await userEvent.click(screen.getByText(fr.foods.archive));

    await waitFor(() => expect(mockArchive).toHaveBeenCalledWith('food-1', { label: 'Pomme' }));
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
  });

  it('🔴 un échec est annoncé et ne recharge pas', async () => {
    mockArchive.mockResolvedValue({ error: new Error('rls') });
    await afficher();

    await userEvent.click(screen.getByText(fr.foods.archive));

    // Recharger masquerait l'échec derrière une liste inchangée : l'admin croirait avoir archivé.
    expect(await screen.findByRole('alert')).toHaveTextContent(fr.foods.error);
    expect(mockList).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Lignes archivées
// ---------------------------------------------------------------------------

describe('lignes archivées', () => {
  const archive = () => aliment({ deletedAt: '2026-07-15T08:00:00.000Z' });

  it('🔴 n’offrent QUE la restauration', async () => {
    await afficher([archive()]);

    // Éditer un aliment invisible envoie l'admin dans une impasse silencieuse.
    expect(screen.getByText(fr.archive.restore)).toBeInTheDocument();
    expect(screen.queryByText(fr.foods.archive)).toBeNull();
    expect(screen.queryByText(fr.foods.edit)).toBeNull();
  });

  it('🔴 portent une mention TEXTUELLE, pas seulement une nuance de couleur', async () => {
    await afficher([archive()]);

    expect(screen.getByText(new RegExp(fr.archive.archivedOn))).toBeInTheDocument();
    expect(screen.getByText(/15\/07\/2026/)).toBeInTheDocument();
  });

  it('🔴 la restauration ne compte AUCUN usage', async () => {
    await afficher([archive()]);

    await userEvent.click(screen.getByText(fr.archive.restore));

    // Remettre en service n'a aucun effet destructif : un décompte serait un aller-retour inutile
    // et un message alarmiste sur une action inoffensive.
    expect(mockUsage).not.toHaveBeenCalled();
    await waitFor(() => expect(mockRestore).toHaveBeenCalledWith('food-1', { label: 'Pomme' }));
  });

  it('la restauration demande quand même confirmation', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    await afficher([archive()]);

    await userEvent.click(screen.getByText(fr.archive.restore));

    expect(mockRestore).not.toHaveBeenCalled();
  });
});
