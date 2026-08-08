/**
 * Back-office — constructeur de programmes (`ProgramEditScreen`, US 8.3 / RUN-F2c).
 *
 * 1 458 lignes, le plus gros écran du dépôt. Ce fichier ne cherche pas à couvrir chaque champ de
 * chaque formulaire — les écritures elles-mêmes sont testées dans `programs-detail.test.ts`. Il
 * cible **l'orchestration**, qui n'existe qu'ici et qui porte tout le risque :
 *
 *  1. **`runWrite` sérialise les écritures et resynchronise.** Chaque action réussie déclenche un
 *     re-fetch : sans lui, l'écran afficherait l'état d'avant l'écriture, et l'admin enchaînerait
 *     ses modifications sur une vue périmée — c'est comme ça qu'on ajoute deux séances en croyant
 *     n'en avoir ajouté qu'une.
 *  2. **Une écriture en échec ne resynchronise PAS**, et lève un bandeau. Recharger masquerait
 *     l'échec derrière une vue inchangée : l'admin croirait avoir enregistré.
 *  3. **Le réordonnancement est optimiste, avec rollback.** L'ordre s'applique immédiatement à
 *     l'écran (un glisser-déposer qui attend le réseau est injouable), puis se **remet à la vérité
 *     serveur** si la persistance échoue. Sans rollback, l'écran affirmerait un ordre que la base
 *     ignore, et l'admin repartirait de là.
 *  4. **Réordonner n'est PAS gaté par `busy`, mais par son propre verrou.** Les deux opérations
 *     touchent des colonnes disjointes ; les partager ferait tomber un dépôt pendant qu'un champ
 *     s'enregistre — un geste perdu sans aucun message.
 *  5. **Le contenu d'une séance dépend du pilier** : blocs de fractionné en course, exercices
 *     planifiés en muscu. Les mélanger proposerait à un coureur d'ajouter un développé couché.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useParams: () => ({ id: 'prog-1' }),
}));

vi.mock('../data/programs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/programs')>();
  return {
    ...actual,
    getProgram: vi.fn(),
    addSession: vi.fn(),
    removeSession: vi.fn(),
    reorderSessions: vi.fn(),
    updateSession: vi.fn(),
    updateProgramMeta: vi.fn(),
    setStatus: vi.fn(),
    addExercisePlan: vi.fn(),
    updateExercisePlan: vi.fn(),
    removeExercisePlan: vi.fn(),
    reorderExercisePlans: vi.fn(),
    addIntervalBlock: vi.fn(),
    updateIntervalBlock: vi.fn(),
    removeIntervalBlock: vi.fn(),
    reorderIntervalBlocks: vi.fn(),
  };
});

/**
 * `SortableList` remplacée par une sonde : le glisser-déposer @dnd-kit n'est pas rejouable en
 * jsdom (il dépend de la géométrie), mais ce qui compte ici est **ce que le parent fait du nouvel
 * ordre**. Le bouton déclenche un `onReorder` avec l'ordre inversé.
 */
vi.mock('../components/SortableList', () => ({
  SortableList: <T,>({
    items,
    getId,
    onReorder,
    renderItem,
  }: {
    items: T[];
    getId: (item: T) => string;
    onReorder: (ids: string[]) => void;
    renderItem: (item: T, dragHandle: Record<string, unknown>) => React.ReactNode;
  }) => (
    <div>
      <button
        type="button"
        onClick={() => onReorder([...items].map(getId).reverse())}
        data-testid={`inverser-${items.map(getId).join('|')}`}
      >
        inverser
      </button>
      {items.map((item) => (
        <div key={getId(item)}>{renderItem(item, {})}</div>
      ))}
    </div>
  ),
}));

vi.mock('../components/ExercisePicker', () => ({
  ExercisePicker: ({ onPick }: { onPick: (id: string) => void }) => (
    <button type="button" onClick={() => onPick('ex-nouveau')}>
      choisir-exercice
    </button>
  ),
}));

const {
  addSession,
  getProgram,
  removeSession,
  reorderExercisePlans,
  reorderSessions,
  updateSession,
} = await import('../data/programs');
const { ProgramEditScreen } = await import('./ProgramEditScreen');
const { fr } = await import('../i18n/fr');

const mockGet = vi.mocked(getProgram);
const mockAddSession = vi.mocked(addSession);
const mockRemoveSession = vi.mocked(removeSession);
const mockReorderSessions = vi.mocked(reorderSessions);
const mockReorderPlans = vi.mocked(reorderExercisePlans);
const mockUpdateSession = vi.mocked(updateSession);

/** Une séance du programme. */
const seance = (id: string, orderIndex: number, overrides: Record<string, unknown> = {}) => ({
  id,
  orderIndex,
  name: `Jour ${orderIndex + 1}`,
  sessionType: null,
  targetDistanceM: null,
  targetDurationSeconds: null,
  plans: [],
  intervals: [],
  ...overrides,
});

/** Un programme éditorial complet. */
const programme = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'prog-1',
    pillar: 'strength',
    status: 'draft',
    level: 'beginner',
    goal: null,
    durationWeeks: 8,
    nameFr: 'Prise de masse',
    nameEn: 'Mass gain',
    summaryFr: null,
    summaryEn: null,
    descriptionFr: null,
    descriptionEn: null,
    sessions: [seance('s-1', 0), seance('s-2', 1)],
    ...overrides,
  }) as Awaited<ReturnType<typeof getProgram>>['program'];

/** Rend l'écran et attend la fin du chargement initial. */
async function afficher(prog = programme()) {
  mockGet.mockResolvedValue({ program: prog, error: null });
  render(<ProgramEditScreen />);
  await waitFor(() => expect(screen.queryByText(fr.programs.loading)).toBeNull());
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue({ program: programme(), error: null });
  mockAddSession.mockResolvedValue({ id: 's-3', error: null });
  mockRemoveSession.mockResolvedValue({ error: null });
  mockReorderSessions.mockResolvedValue({ error: null });
  mockReorderPlans.mockResolvedValue({ error: null });
  mockUpdateSession.mockResolvedValue({ error: null });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

// ---------------------------------------------------------------------------
// Gardes de rendu
// ---------------------------------------------------------------------------

describe('gardes de rendu', () => {
  it('affiche un état de chargement avant la première réponse', () => {
    mockGet.mockReturnValue(new Promise(() => {}) as never);

    render(<ProgramEditScreen />);

    expect(screen.getByText(fr.programs.loading)).toBeInTheDocument();
  });

  it('🔴 une erreur de lecture est ANNONCÉE, jamais confondue avec un programme absent', async () => {
    mockGet.mockResolvedValue({ program: null, error: new Error('rls') });

    render(<ProgramEditScreen />);

    // « Programme introuvable » sur une erreur de droits ferait conclure à une suppression.
    expect(await screen.findByRole('alert')).toHaveTextContent(fr.programs.error);
    expect(screen.queryByText(fr.programs.notFound)).toBeNull();
  });

  it('programme absent → mention explicite, et un retour', async () => {
    mockGet.mockResolvedValue({ program: null, error: null });

    render(<ProgramEditScreen />);

    expect(await screen.findByText(fr.programs.notFound)).toBeInTheDocument();
    await userEvent.click(screen.getByText(fr.programs.back));
    expect(navigate).toHaveBeenCalledWith('/programs');
  });

  it('un programme sans séance le dit', async () => {
    await afficher(programme({ sessions: [] }));

    expect(screen.getByText(fr.programs.noSessions)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Écritures — sérialisation et resynchronisation
// ---------------------------------------------------------------------------

describe('écritures', () => {
  it('🔴 resynchronise après une écriture réussie', async () => {
    await afficher();

    await userEvent.click(screen.getByText(fr.programs.addSession));

    // Sans re-fetch, l'écran garde l'état d'avant : l'admin enchaîne sur une vue périmée et
    // ajoute une deuxième séance en croyant n'en avoir ajouté qu'une.
    await waitFor(() => expect(mockAddSession).toHaveBeenCalledWith('prog-1'));
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
  });

  it('🔴 une écriture en échec lève un bandeau et ne resynchronise PAS', async () => {
    mockAddSession.mockResolvedValue({ id: null, error: new Error('rls') });
    await afficher();

    await userEvent.click(screen.getByText(fr.programs.addSession));

    // Recharger masquerait l'échec derrière une vue inchangée : l'admin croirait avoir ajouté.
    expect(await screen.findByRole('alert')).toHaveTextContent(fr.programs.error);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('🔴 une écriture qui LÈVE est traitée comme un échec, pas comme un plantage', async () => {
    mockAddSession.mockRejectedValue(new Error('réseau'));
    await afficher();

    await userEvent.click(screen.getByText(fr.programs.addSession));

    // La couche data promet `{ error }`, mais une coupure réseau lève. Sans le `catch`, l'écran
    // resterait bloqué en état « occupé » avec tous ses boutons grisés.
    expect(await screen.findByRole('alert')).toHaveTextContent(fr.programs.error);
    expect(screen.getByText(fr.programs.addSession)).not.toBeDisabled();
  });

  it('🔴 le bandeau d’erreur est effacé au début de l’écriture suivante', async () => {
    mockAddSession.mockResolvedValueOnce({ id: null, error: new Error('rls') });
    await afficher();

    await userEvent.click(screen.getByText(fr.programs.addSession));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    mockAddSession.mockResolvedValue({ id: 's-3', error: null });
    await userEvent.click(screen.getByText(fr.programs.addSession));

    // Un bandeau qui persiste après une réussite fait douter d'un enregistrement qui a bien eu lieu.
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('un second clic APRÈS rendu est bloqué par le bouton désactivé', async () => {
    let resoudre: ((v: { id: string | null; error: unknown }) => void) | undefined;
    mockAddSession.mockReturnValue(
      new Promise((resolve) => {
        resoudre = resolve;
      }),
    );
    await afficher();

    const bouton = screen.getByText(fr.programs.addSession);
    await userEvent.click(bouton);
    await userEvent.click(bouton);

    // `userEvent.click` laisse React re-rendre entre les deux : c'est l'attribut `disabled` qui
    // protège ici, pas la garde applicative. Les deux comptent, ils ne se remplacent pas — voir
    // le test suivant.
    expect(bouton).toBeDisabled();
    expect(mockAddSession).toHaveBeenCalledTimes(1);
    resoudre?.({ id: 's-3', error: null });
  });

  it('🔴 deux clics dans le MÊME cycle de rendu n’ajoutent qu’UNE séance', async () => {
    let resoudre: ((v: { id: string | null; error: unknown }) => void) | undefined;
    mockAddSession.mockReturnValue(
      new Promise((resolve) => {
        resoudre = resolve;
      }),
    );
    await afficher();

    // Clics natifs successifs, sans laisser React re-rendre : le bouton n'est pas encore
    // désactivé et les deux gestionnaires partagent la même fermeture. C'est le double-clic
    // rapide réel, et le seul cas que la garde par ref protège.
    const bouton = screen.getByText(fr.programs.addSession);
    bouton.click();
    bouton.click();

    // Deux séances ajoutées, ce sont deux `order_index` calculés sur le même état — donc deux
    // séances au même rang, et un ordre que Postgres tranche au hasard.
    await waitFor(() => expect(mockAddSession).toHaveBeenCalled());
    expect(mockAddSession).toHaveBeenCalledTimes(1);
    resoudre?.({ id: 's-3', error: null });
  });

  it('le retrait d’une séance demande confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await afficher();

    await userEvent.click(screen.getAllByText(fr.programs.removeSession)[0]!);

    // Retirer une séance emporte ses exercices et ses blocs : l'action n'est pas réversible d'un clic.
    expect(mockRemoveSession).not.toHaveBeenCalled();
  });

  it('confirmer retire la séance', async () => {
    await afficher();

    await userEvent.click(screen.getAllByText(fr.programs.removeSession)[0]!);

    await waitFor(() => expect(mockRemoveSession).toHaveBeenCalledWith('s-1'));
  });
});

// ---------------------------------------------------------------------------
// Réordonnancement
// ---------------------------------------------------------------------------

describe('réordonnancement', () => {
  it('persiste le nouvel ordre des séances', async () => {
    await afficher();

    await userEvent.click(screen.getByTestId('inverser-s-1|s-2'));

    await waitFor(() =>
      expect(mockReorderSessions).toHaveBeenCalledWith('prog-1', ['s-2', 's-1']),
    );
  });

  it('🔴 applique l’ordre AVANT la réponse du serveur', async () => {
    let resoudre: ((v: { error: unknown }) => void) | undefined;
    mockReorderSessions.mockReturnValue(
      new Promise((resolve) => {
        resoudre = resolve;
      }),
    );
    await afficher();

    await userEvent.click(screen.getByTestId('inverser-s-1|s-2'));

    // Un glisser-déposer qui attend le réseau avant de bouger est injouable : l'élément
    // « revient » sous le curseur, et l'admin recommence.
    expect(screen.getByTestId('inverser-s-2|s-1')).toBeInTheDocument();
    resoudre?.({ error: null });
  });

  it('🔴 revient à la vérité serveur si la persistance échoue', async () => {
    mockReorderSessions.mockResolvedValue({ error: new Error('rls') });
    await afficher();

    await userEvent.click(screen.getByTestId('inverser-s-1|s-2'));

    // Sans rollback, l'écran affirmerait un ordre que la base ignore — et l'admin construirait la
    // suite de son programme là-dessus.
    expect(await screen.findByRole('alert')).toHaveTextContent(fr.programs.error);
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
  });

  it('un rejet réseau déclenche le même rollback', async () => {
    mockReorderSessions.mockRejectedValue(new Error('coupure'));
    await afficher();

    await userEvent.click(screen.getByTestId('inverser-s-1|s-2'));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
  });

  it('🔴 deux réordonnancements concurrents : seul le premier part', async () => {
    let resoudre: ((v: { error: unknown }) => void) | undefined;
    mockReorderSessions.mockReturnValue(
      new Promise((resolve) => {
        resoudre = resolve;
      }),
    );
    await afficher();

    await userEvent.click(screen.getByTestId('inverser-s-1|s-2'));
    await userEvent.click(screen.getByTestId('inverser-s-2|s-1'));

    // Deux écritures d'`order_index` concurrentes : la seconde écraserait la première, et l'ordre
    // final dépendrait de l'ordre d'arrivée des réponses.
    expect(mockReorderSessions).toHaveBeenCalledTimes(1);
    resoudre?.({ error: null });
  });

  it('🔴 réordonner n’est PAS bloqué par une écriture de champ en vol', async () => {
    let resoudreEcriture: ((v: { error: unknown }) => void) | undefined;
    mockUpdateSession.mockReturnValue(
      new Promise((resolve) => {
        resoudreEcriture = resolve;
      }),
    );
    await afficher();

    // Une écriture de champ démarre et occupe `busy`…
    const champNom = screen.getAllByDisplayValue('Jour 1')[0]!;
    await userEvent.clear(champNom);
    await userEvent.type(champNom, 'Jour A');
    await userEvent.tab();

    // …le dépôt doit quand même passer : les deux touchent des colonnes disjointes, et perdre un
    // geste de glisser-déposer sans aucun message est le pire des deux mondes.
    await userEvent.click(screen.getByTestId('inverser-s-1|s-2'));

    await waitFor(() => expect(mockReorderSessions).toHaveBeenCalled());
    resoudreEcriture?.({ error: null });
  });
});

// ---------------------------------------------------------------------------
// Contenu selon le pilier
// ---------------------------------------------------------------------------

describe('contenu selon le pilier', () => {
  it('🔴 une séance de muscu propose des exercices, pas des blocs de fractionné', async () => {
    await afficher();

    // Le sélecteur d'exercice n'apparaît qu'après un clic sur « Ajouter un exercice ».
    expect(screen.getAllByText(fr.programs.addExercise).length).toBeGreaterThan(0);
    expect(screen.queryByText(fr.programs.addInterval)).toBeNull();

    await userEvent.click(screen.getAllByText(fr.programs.addExercise)[0]!);
    expect(screen.getByText('choisir-exercice')).toBeInTheDocument();
  });

  it('🔴 une séance de course propose des blocs, pas des exercices', async () => {
    await afficher(
      programme({
        pillar: 'running',
        sessions: [seance('s-1', 0, { sessionType: 'fractionne' })],
      }),
    );

    // Proposer un développé couché dans une séance de fractionné n'a pas de sens, et l'écriture
    // partirait quand même : rien côté base n'interdit un `exercise_plan` sur une séance running.
    expect(screen.getByText(fr.programs.addInterval)).toBeInTheDocument();
    expect(screen.queryByText(fr.programs.addExercise)).toBeNull();
  });

  it('réordonne les exercices planifiés d’une séance', async () => {
    await afficher(
      programme({
        sessions: [
          seance('s-1', 0, {
            plans: [
              { id: 'p-1', orderIndex: 0, exerciseId: 'ex-1', exerciseNameFr: 'Squat', setType: 'normal', targetSets: 4, targetReps: '8', targetWeightKg: null, restSeconds: null },
              { id: 'p-2', orderIndex: 1, exerciseId: 'ex-2', exerciseNameFr: 'Presse', setType: 'normal', targetSets: 3, targetReps: '10', targetWeightKg: null, restSeconds: null },
            ],
          }),
        ],
      }),
    );

    await userEvent.click(screen.getByTestId('inverser-p-1|p-2'));

    // Le réordonnancement est borné à la séance : l'identifiant passé n'est pas celui du programme.
    await waitFor(() => expect(mockReorderPlans).toHaveBeenCalledWith('s-1', ['p-2', 'p-1']));
  });
});
