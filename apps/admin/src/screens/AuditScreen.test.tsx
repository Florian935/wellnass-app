/**
 * Back-office — journal d'audit (US 8.10, réservé au `super_admin`).
 *
 * Un journal d'audit n'a de valeur que si on peut lui faire confiance. Trois mécanismes de cet
 * écran déterminent cette confiance, et aucun n'est visible :
 *
 *  1. **L'anti-obsolescence des requêtes.** Changer un filtre relance une lecture ; la réponse
 *     d'un filtre **précédent** peut arriver après. Sans le jeton de requête, elle écrase l'état
 *     et l'écran affiche des lignes qui ne correspondent pas aux filtres affichés — le pire état
 *     possible pour un journal, parce que rien ne le signale.
 *  2. **Les bornes de date sont construites depuis l'heure LOCALE.** Une chaîne `AAAA-MM-JJ` sans
 *     `Z` est lue dans le fuseau du navigateur ; l'envoyer telle quelle ferait lire à Postgres une
 *     date UTC, donc décalerait la fenêtre de plusieurs heures. Un événement de 23 h manquerait à
 *     l'appel dans sa propre journée.
 *  3. **La pagination par curseur** part de la date de la **dernière ligne affichée**, pas d'un
 *     décalage : un journal reçoit des lignes en continu, et un `offset` sauterait ou dupliquerait
 *     des entrées à chaque insertion pendant la lecture.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../data/audit', () => ({ listAudit: vi.fn() }));

const { AuditScreen } = await import('./AuditScreen');
const { listAudit } = await import('../data/audit');
const { fr } = await import('../i18n/fr');

const mockList = vi.mocked(listAudit);

const ACTOR_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

/** Une entrée du journal. */
const entree = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'log-1',
    created_at: '2026-07-15T14:30:00.000Z',
    actor_id: ACTOR_ID,
    actor_email: 'admin@wellness.app',
    action: 'exercise.archive',
    target_table: 'exercises',
    target_id: 'ex-1',
    target_label: 'Squat barre',
    ...overrides,
  }) as never;

/** `PAGE_SIZE` entrées : c'est ce qui déclenche l'offre « charger plus ». */
const pagePleine = () =>
  Array.from({ length: 50 }, (_, i) =>
    entree({ id: `log-${i}`, created_at: `2026-07-${String(15 - (i % 14)).padStart(2, '0')}T14:30:00.000Z` }),
  );

/** Rend l'écran et attend la fin du chargement initial. */
async function afficher(rows: unknown[] = [entree()]) {
  mockList.mockResolvedValue({ rows: rows as never, error: null });
  render(<AuditScreen />);
  await waitFor(() => expect(screen.queryByText(fr.audit.loading)).toBeNull());
}

/** Les filtres passés au dernier appel. */
const derniersFiltres = () => mockList.mock.calls.at(-1)?.[0] ?? {};

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue({ rows: [], error: null });
});

// ---------------------------------------------------------------------------
// États d'écran
// ---------------------------------------------------------------------------

describe('états d’écran', () => {
  it('affiche un état de chargement avant la première réponse', () => {
    mockList.mockReturnValue(new Promise(() => {}) as never);

    render(<AuditScreen />);

    expect(screen.getByText(fr.audit.loading)).toBeInTheDocument();
  });

  it('journal vide → mention explicite', async () => {
    await afficher([]);

    expect(screen.getByText(fr.audit.empty)).toBeInTheDocument();
  });

  it('🔴 une erreur est ANNONCÉE, pas confondue avec un journal vide', async () => {
    mockList.mockResolvedValue({ rows: [] as never, error: new Error('rls') });

    render(<AuditScreen />);

    // « Aucun événement » sur un journal d'audit se lit comme « rien ne s'est passé » : c'est
    // exactement l'inverse de ce qu'un journal doit permettre de conclure.
    expect(await screen.findByRole('alert')).toHaveTextContent(fr.audit.error);
  });

  it('affiche l’acteur, l’action traduite et la cible', async () => {
    await afficher();

    const tableau = within(screen.getByRole('table'));
    expect(tableau.getByText('admin@wellness.app')).toBeInTheDocument();
    expect(tableau.getByText(fr.audit.action['exercise.archive'])).toBeInTheDocument();
    expect(tableau.getByText('Squat barre')).toBeInTheDocument();
  });

  it('🔴 un acteur sans e-mail retombe sur son identifiant, jamais sur du vide', async () => {
    await afficher([entree({ actor_email: null })]);

    // Une ligne d'audit sans acteur ne prouve plus rien. L'identifiant est moins lisible qu'un
    // e-mail, mais il reste traçable.
    expect(within(screen.getByRole('table')).getByText(ACTOR_ID)).toBeInTheDocument();
  });

  it('🔴 une cible sans libellé retombe sur la table et l’identifiant', async () => {
    await afficher([entree({ target_label: null })]);

    // Le libellé est un confort, capté au moment de l'action ; la table et l'id sont la vérité.
    expect(within(screen.getByRole('table')).getByText('exercises ex-1')).toBeInTheDocument();
  });

  it('une action inconnue s’affiche telle quelle plutôt que de disparaître', async () => {
    await afficher([entree({ action: 'action.inedite' })]);

    // Une action ajoutée en base et pas encore traduite doit rester lisible : la masquer
    // supprimerait une trace.
    expect(within(screen.getByRole('table')).getByText('action.inedite')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Filtres
// ---------------------------------------------------------------------------

describe('filtres', () => {
  it('la première lecture n’applique aucun filtre', async () => {
    await afficher();

    expect(derniersFiltres()).toMatchObject({
      actorId: undefined,
      action: undefined,
      from: undefined,
      to: undefined,
      limit: 50,
    });
  });

  it('filtre par action', async () => {
    await afficher();

    await userEvent.selectOptions(
      screen.getByLabelText(fr.audit.filterAction),
      'exercise.archive',
    );

    await waitFor(() =>
      expect(derniersFiltres()).toMatchObject({ action: 'exercise.archive' }),
    );
  });

  it('🔴 la liste des acteurs est construite depuis les lignes, sans doublon', async () => {
    await afficher([
      entree({ id: 'l1' }),
      entree({ id: 'l2' }),
      entree({ id: 'l3', actor_id: 'autre', actor_email: 'autre@wellness.app' }),
    ]);

    // Le même acteur apparaît sur deux lignes : le proposer deux fois dans le filtre laisserait
    // croire à deux comptes distincts.
    const options = screen.getByLabelText(fr.audit.filterActor).querySelectorAll('option');
    expect(options).toHaveLength(3); // « tous » + 2 acteurs distincts
  });

  it('🔴 la borne « depuis » couvre le jour entier, en heure LOCALE', async () => {
    await afficher();

    await userEvent.type(screen.getByLabelText(fr.audit.filterFrom), '2026-07-01');

    // La borne doit correspondre à minuit **local** converti en UTC. Envoyer « 2026-07-01 » brut
    // ferait lire la date en UTC à Postgres, et décalerait la fenêtre de plusieurs heures.
    await waitFor(() =>
      expect(derniersFiltres().from).toBe(new Date('2026-07-01T00:00:00').toISOString()),
    );
  });

  it('🔴 la borne « jusqu’à » INCLUT la fin du jour', async () => {
    await afficher();

    await userEvent.type(screen.getByLabelText(fr.audit.filterTo), '2026-07-31');

    // Sans les 23:59:59.999, un événement du 31 juillet à 18 h serait exclu d'une fenêtre qui se
    // termine « le 31 juillet » — et personne ne comprendrait pourquoi.
    await waitFor(() =>
      expect(derniersFiltres().to).toBe(new Date('2026-07-31T23:59:59.999').toISOString()),
    );
  });

  it('réinitialiser efface tous les filtres', async () => {
    await afficher();

    await userEvent.selectOptions(
      screen.getByLabelText(fr.audit.filterAction),
      'exercise.archive',
    );
    await userEvent.type(screen.getByLabelText(fr.audit.filterFrom), '2026-07-01');
    await userEvent.click(screen.getByText(fr.audit.reset));

    await waitFor(() =>
      expect(derniersFiltres()).toMatchObject({ action: undefined, from: undefined }),
    );
  });

  it('🔴 une réponse périmée n’écrase PAS le résultat du filtre courant', async () => {
    // Première lecture lente, seconde immédiate : c'est l'ordre d'arrivée inversé.
    let resoudreLente: ((v: unknown) => void) | undefined;
    mockList.mockReturnValueOnce(
      new Promise((resolve) => {
        resoudreLente = resolve;
      }) as never,
    );
    render(<AuditScreen />);

    mockList.mockResolvedValue({ rows: [entree({ target_label: 'Résultat courant' })] as never, error: null });
    await userEvent.selectOptions(
      await screen.findByLabelText(fr.audit.filterAction),
      'exercise.archive',
    );
    await screen.findByText('Résultat courant');

    // La réponse de l'ancien filtre arrive maintenant : elle doit être ignorée. Sans le jeton de
    // requête, l'écran afficherait des lignes qui ne correspondent pas aux filtres affichés — et
    // rien ne le signalerait.
    resoudreLente?.({ rows: [entree({ id: 'perime', target_label: 'Résultat périmé' })], error: null });
    await waitFor(() => expect(screen.queryByText('Résultat périmé')).toBeNull());
    expect(screen.getByText('Résultat courant')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

describe('pagination', () => {
  it('🔴 n’offre « charger plus » que si la page est PLEINE', async () => {
    await afficher([entree()]);

    // Une page incomplète signifie qu'on a tout lu : proposer d'en charger plus enverrait une
    // requête qui ne peut rien rendre, et laisserait croire qu'il manque des lignes.
    expect(screen.queryByText(fr.audit.loadMore)).toBeNull();
  });

  it('offre « charger plus » sur une page pleine', async () => {
    await afficher(pagePleine());

    expect(screen.getByText(fr.audit.loadMore)).toBeInTheDocument();
  });

  it('🔴 pagine par CURSEUR sur la date de la dernière ligne', async () => {
    const premiere = pagePleine();
    await afficher(premiere);

    mockList.mockResolvedValue({ rows: [] as never, error: null });
    await userEvent.click(screen.getByText(fr.audit.loadMore));

    // Un journal reçoit des lignes en continu : un `offset` sauterait ou dupliquerait des entrées
    // à chaque insertion pendant la lecture.
    const derniereLigne = premiere.at(-1) as unknown as { created_at: string };
    await waitFor(() =>
      expect(derniersFiltres()).toMatchObject({ before: derniereLigne.created_at }),
    );
  });

  it('ajoute la page suivante à la suite, sans remplacer', async () => {
    await afficher(pagePleine());

    mockList.mockResolvedValue({
      rows: [entree({ id: 'suivant', target_label: 'Page deux' })] as never,
      error: null,
    });
    await userEvent.click(screen.getByText(fr.audit.loadMore));

    // Remplacer perdrait tout le contexte déjà lu — sur un journal, c'est précisément ce qu'on
    // était en train de parcourir.
    expect(await screen.findByText('Page deux')).toBeInTheDocument();
    expect(screen.getAllByText('Squat barre').length).toBeGreaterThan(1);
  });

  it('🔴 une page suivante incomplète retire l’offre', async () => {
    await afficher(pagePleine());

    mockList.mockResolvedValue({ rows: [entree({ id: 'dernier' })] as never, error: null });
    await userEvent.click(screen.getByText(fr.audit.loadMore));

    await waitFor(() => expect(screen.queryByText(fr.audit.loadMore)).toBeNull());
  });

  it('🔴 un échec de chargement suivant est annoncé et n’ampute PAS la liste', async () => {
    await afficher(pagePleine());

    mockList.mockResolvedValue({ rows: [] as never, error: new Error('rls') });
    await userEvent.click(screen.getByText(fr.audit.loadMore));

    // Vider la liste sur un échec de page 2 ferait perdre la page 1, déjà lue et légitime.
    expect(await screen.findByRole('alert')).toHaveTextContent(fr.audit.error);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
