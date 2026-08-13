/**
 * Back-office — création d'un programme éditorial (US 8.4).
 *
 * L'écran le plus court des cinq restants, mais celui qui **crée** l'objet que
 * `ProgramEditScreen` (1 458 lignes) passera ensuite son temps à remplir. Ce qui est mal posé ici
 * se traîne dans tout le programme.
 *
 * `programs.test.ts` couvre `createEditorialProgram`. Ce que l'écran ajoute par-dessus, et qui
 * n'est testé nulle part :
 *
 *  1. **La normalisation de la durée**, écrite à la main et non déléguée : vide, `NaN`, `0` et
 *     négatifs doivent tous retomber sur `null`. Le commentaire du code dit « parité avec l'écran
 *     d'édition » — c'est exactement le genre de règle dupliquée qui diverge en silence, et
 *     l'`input min={1}` ne protège pas (il n'empêche pas la soumission en jsdom, et un
 *     collage de « 0 » passe outre dans un navigateur).
 *  2. **Les deux noms sont requis après `trim`**, comme pour les exercices.
 *  3. **Vide ≠ absent** : niveau, objectif et durée non renseignés partent à `null`.
 *  4. **La redirection porte un état `created`** que la liste consomme pour afficher sa bannière.
 *     Naviguer sans cet état, c'est créer un programme sans le moindre accusé de réception.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

vi.mock('../data/programs', async () => {
  const shared = await import('@wellness/shared');
  return {
    PILLAR_BUILDER: ['strength', 'running'],
    PROGRAM_LEVELS: shared.PROGRAM_LEVELS,
    createEditorialProgram: vi.fn(async () => ({ id: 'prog-1', error: null })),
  };
});

const { ProgramCreateScreen } = await import('./ProgramCreateScreen');
const { createEditorialProgram } = await import('../data/programs');
const { fr } = await import('../i18n/fr');

const mockCreate = vi.mocked(createEditorialProgram);

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate.mockResolvedValue({ id: 'prog-1', error: null });
});

const enregistrer = () => screen.getByRole('button', { name: fr.programs.save });

/** Monte l'écran et renseigne les deux noms requis. */
async function creerAvecNoms(nomFr = 'Full body débutant', nomEn = 'Beginner full body') {
  render(<ProgramCreateScreen />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(fr.programs.nameFr), nomFr);
  await user.type(screen.getByLabelText(fr.programs.nameEn), nomEn);
  return user;
}

/** Ce qui a été transmis à la couche data au premier appel. */
const envoye = () => mockCreate.mock.calls[0]![0];

// ---------------------------------------------------------------------------
// Formulaire
// ---------------------------------------------------------------------------

describe('formulaire', () => {
  it('affiche le titre de création et les deux piliers', async () => {
    render(<ProgramCreateScreen />);

    expect(screen.getByText(fr.programs.createTitle)).toBeInTheDocument();
    expect(screen.getByLabelText(fr.programs.pillarLabel)).toHaveValue('strength');
    expect(screen.getByRole('option', { name: fr.programs.pillarRunning })).toBeInTheDocument();
  });

  it('part sans niveau, sans objectif et sans durée', async () => {
    render(<ProgramCreateScreen />);

    // Le niveau vide est une option offerte (« — ») et non un défaut imposé : un programme peut
    // très bien ne viser aucun niveau particulier.
    expect(screen.getByLabelText(fr.programs.level)).toHaveValue('');
    expect(screen.getByLabelText(fr.programs.goal)).toHaveValue('');
    expect(screen.getByLabelText(fr.programs.durationWeeks)).toHaveValue(null);
  });
});

// ---------------------------------------------------------------------------
// Validation des noms
// ---------------------------------------------------------------------------

describe('validation des noms', () => {
  it('🔴 refuse sans nom EN — et n’appelle pas la couche data', async () => {
    render(<ProgramCreateScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(fr.programs.nameFr), 'Full body');
    await user.click(enregistrer());

    expect(await screen.findByRole('alert')).toHaveTextContent(fr.programs.requiredBoth);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('🔴 refuse des noms faits d’espaces', async () => {
    const user = await creerAvecNoms('   ', '   ');

    await user.click(enregistrer());

    expect(await screen.findByRole('alert')).toHaveTextContent(fr.programs.requiredBoth);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('nettoie les espaces autour des noms', async () => {
    const user = await creerAvecNoms('  Full body  ', '  Full body  ');

    await user.click(enregistrer());

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(envoye()).toMatchObject({ nameFr: 'Full body', nameEn: 'Full body' });
  });
});

// ---------------------------------------------------------------------------
// Durée en semaines — la règle écrite à la main
// ---------------------------------------------------------------------------

describe('durée en semaines', () => {
  it('transmet un entier valide', async () => {
    const user = await creerAvecNoms();

    await user.type(screen.getByLabelText(fr.programs.durationWeeks), '8');
    await user.click(enregistrer());

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(envoye().durationWeeks).toBe(8);
  });

  it('🔴 transmet `null` quand la durée est vide', async () => {
    const user = await creerAvecNoms();

    await user.click(enregistrer());

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    // `Number.parseInt('')` vaut `NaN` : sans la garde, c'est `NaN` qui partirait en base, où il
    // devient `null` ou une erreur selon le pilote — un aléa qu'on ne veut pas.
    expect(envoye().durationWeeks).toBeNull();
  });

  /**
   * 🔴 **Première ligne de défense : la contrainte HTML `min={1}`.**
   *
   * Écrit d'abord en supposant qu'elle ne servait à rien (« jsdom ne l'applique pas »), et
   * **c'était faux** : jsdom implémente bien la validation de contrainte, la soumission est
   * bloquée et `createEditorialProgram` n'est jamais appelé. La supposition inverse aurait produit
   * trois tests verts pour la mauvaise raison si le comportement avait été l'autre.
   */
  it.each([
    ['zéro', '0'],
    ['une valeur négative', '-4'],
    ['une valeur décimale', '6.9'],
  ])('🔴 la contrainte du champ bloque la soumission pour %s', async (_cas, saisie) => {
    const user = await creerAvecNoms();

    await user.type(screen.getByLabelText(fr.programs.durationWeeks), saisie);
    await user.click(enregistrer());

    // Rien ne part : ni création, ni navigation. `6.9` est refusé par le `step` implicite de 1.
    expect(mockCreate).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  /**
   * 🔴 **Seconde ligne : la garde JavaScript**, atteinte en contournant la validation HTML.
   *
   * `fireEvent.submit` déclenche l'événement sans passer par la validation de contrainte —
   * c'est-à-dire exactement ce que ferait un navigateur si l'attribut sautait (champ modifié dans
   * les outils de développement, ou `novalidate` ajouté un jour). Le commentaire du code annonce
   * une « parité avec l'écran d'édition » ; c'est cette parité qu'on fige ici.
   */
  it.each([
    ['zéro', '0'],
    ['une valeur négative', '-4'],
    ['une chaîne non numérique', 'huit'],
  ])('🔴 la garde JS retombe sur `null` pour %s', async (_cas, saisie) => {
    const { container } = render(<ProgramCreateScreen />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(fr.programs.nameFr), 'Full body');
    await user.type(screen.getByLabelText(fr.programs.nameEn), 'Full body');

    const champDuree = screen.getByLabelText(fr.programs.durationWeeks) as HTMLInputElement;
    // Affectation directe : `user.type` refuserait « huit » dans un `type=number`.
    fireEvent.change(champDuree, { target: { value: saisie } });
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    // `NaN` partirait sinon en base, où il devient `null` ou une erreur selon le pilote.
    expect(envoye().durationWeeks).toBeNull();
  });

  it('tronque une durée décimale à l’entier une fois la garde HTML contournée', async () => {
    const { container } = render(<ProgramCreateScreen />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(fr.programs.nameFr), 'Full body');
    await user.type(screen.getByLabelText(fr.programs.nameEn), 'Full body');

    fireEvent.change(screen.getByLabelText(fr.programs.durationWeeks), {
      target: { value: '6.9' },
    });
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    // `parseInt` tronque : une demi-semaine n'a pas de sens, et arrondir au supérieur promettrait
    // une semaine qui n'existe pas.
    expect(envoye().durationWeeks).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Champs optionnels : vide ≠ absent
// ---------------------------------------------------------------------------

describe('champs optionnels', () => {
  it('🔴 envoie `null` — et non une chaîne vide — pour le niveau et l’objectif', async () => {
    const user = await creerAvecNoms();

    await user.click(enregistrer());

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(envoye().level).toBeNull();
    expect(envoye().goal).toBeNull();
  });

  it('transmet le niveau et l’objectif renseignés, objectif nettoyé', async () => {
    const user = await creerAvecNoms();

    await user.selectOptions(screen.getByLabelText(fr.programs.level), 'beginner');
    await user.type(screen.getByLabelText(fr.programs.goal), '  Prise de masse  ');
    await user.click(enregistrer());

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(envoye()).toMatchObject({ level: 'beginner', goal: 'Prise de masse' });
  });

  it('transmet le pilier choisi', async () => {
    const user = await creerAvecNoms();

    await user.selectOptions(screen.getByLabelText(fr.programs.pillarLabel), 'running');
    await user.click(enregistrer());

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(envoye().pillar).toBe('running');
  });
});

// ---------------------------------------------------------------------------
// Création
// ---------------------------------------------------------------------------

describe('création', () => {
  it('🔴 redirige vers la liste EN PORTANT l’état `created`', async () => {
    const user = await creerAvecNoms();

    await user.click(enregistrer());

    // C'est cet état que la liste consomme pour afficher sa bannière de succès : sans lui, on
    // crée un programme sans le moindre accusé de réception.
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/programs', { state: { created: true } }),
    );
  });

  it('🔴 ne navigue PAS quand la création échoue', async () => {
    mockCreate.mockResolvedValue({ id: null, error: new Error('conflit') });
    const user = await creerAvecNoms();

    await user.click(enregistrer());

    expect(await screen.findByRole('alert')).toHaveTextContent(fr.programs.error);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('🔴 traite « pas d’erreur mais pas d’identifiant » comme un échec', async () => {
    // Cas tordu et bien réel : une écriture qui « réussit » sans rien rendre (RLS silencieuse,
    // `maybeSingle` vide). Naviguer ici enverrait vers une liste sans le programme attendu.
    mockCreate.mockResolvedValue({ id: null, error: null });
    const user = await creerAvecNoms();

    await user.click(enregistrer());

    expect(await screen.findByRole('alert')).toHaveTextContent(fr.programs.error);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('🔴 un second appui pendant la création n’écrit pas deux fois', async () => {
    let debloquer!: (v: { id: string; error: null }) => void;
    mockCreate.mockReturnValue(new Promise((resolve) => (debloquer = resolve)));
    const user = await creerAvecNoms();

    await user.click(enregistrer());

    const bouton = await screen.findByRole('button', { name: fr.programs.saving });
    await user.click(bouton);
    await user.click(bouton);

    // Deux programmes éditoriaux identiques créés par un double clic, ce sont deux lignes à
    // nettoyer à la main dans une bibliothèque partagée.
    expect(mockCreate).toHaveBeenCalledTimes(1);
    debloquer({ id: 'prog-1', error: null });
    await waitFor(() => expect(navigate).toHaveBeenCalled());
  });

  it('rend la main après un échec', async () => {
    mockCreate.mockResolvedValue({ id: null, error: new Error('conflit') });
    const user = await creerAvecNoms();

    await user.click(enregistrer());
    await screen.findByRole('alert');

    expect(enregistrer()).toBeEnabled();
  });

  it('efface l’erreur précédente à la tentative suivante', async () => {
    mockCreate.mockResolvedValue({ id: null, error: new Error('conflit') });
    const user = await creerAvecNoms();

    await user.click(enregistrer());
    await screen.findByRole('alert');

    mockCreate.mockResolvedValue({ id: 'prog-1', error: null });
    await user.click(enregistrer());

    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Sorties sans écriture
// ---------------------------------------------------------------------------

describe('sorties', () => {
  it('le bouton « retour » ramène à la liste sans créer', async () => {
    const user = await creerAvecNoms();

    await user.click(screen.getByRole('button', { name: fr.programs.back }));

    // Retour **sans** l'état `created` : rien n'a été créé, la bannière n'aurait rien à annoncer.
    expect(navigate).toHaveBeenCalledWith('/programs');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('le bouton « annuler » ramène à la liste sans créer', async () => {
    const user = await creerAvecNoms();

    await user.click(screen.getByRole('button', { name: fr.programs.cancel }));

    expect(navigate).toHaveBeenCalledWith('/programs');
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
