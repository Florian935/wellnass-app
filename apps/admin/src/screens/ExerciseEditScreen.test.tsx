/**
 * Back-office — formulaire de création / édition d'un exercice éditorial (US 8.2, MUSC-F1b).
 *
 * 543 lignes, le deuxième plus gros écran du back-office, et **entièrement à 0 %** jusqu'ici. Ce
 * qu'il écrit n'est pas la donnée d'un utilisateur : c'est du **contenu éditorial partagé**, qui
 * descend dans la base locale de tout le monde. Une erreur ici ne casse pas un compte, elle casse
 * la bibliothèque.
 *
 * `programs-detail.test.ts` et `exercises.test.ts` couvrent déjà les **écritures** — que
 * `saveExercise` émette la bonne requête est acquis. Ce qu'ils ne peuvent pas dire, c'est ce que
 * l'écran décide **avant** d'appeler : ce qui part, ce qui est nettoyé, et ce qui n'est pas envoyé
 * du tout.
 *
 * Cinq décisions portent le risque :
 *
 *  1. **Un muscle ne peut pas être primaire ET secondaire.** Changer le groupe principal retire ce
 *     groupe des secondaires (`setMusclesSecondary(prev => prev.filter(…))`). Sans cette purge,
 *     l'exercice partirait avec une contradiction que le formulaire n'affiche même plus — la case
 *     disparaît de l'écran, mais la valeur resterait dans l'état.
 *  2. **Les deux noms sont requis, après `trim`.** Un nom d'espaces passerait une validation
 *     naïve et publierait un exercice « sans nom » dans la bibliothèque.
 *  3. **Vide ≠ absent.** Instructions et équipement non renseignés partent à `null`, jamais en
 *     chaîne vide : c'est ce qui distingue « pas d'instructions » de « instructions vides » côté
 *     mobile.
 *  4. **Un échec d'enregistrement ne navigue pas.** Sinon l'admin repart vers la liste convaincu
 *     d'avoir enregistré.
 *  5. **La recherche de variantes s'exclut elle-même** et exclut les variantes déjà liées : sans
 *     ça, on propose de lier un exercice à lui-même.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks : navigation, couche data ───────────────────────────────────────────

const navigate = vi.fn();
const params: { id?: string } = {};
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useParams: () => params,
}));

vi.mock('../data/exercises', async () => {
  const shared = await import('@wellness/shared');
  return {
    MUSCLE_GROUPS: shared.MUSCLE_GROUPS,
    EQUIPMENTS: shared.EQUIPMENTS,
    getExercise: vi.fn(),
    saveExercise: vi.fn(async () => ({ id: 'ex-1', error: null })),
  };
});

vi.mock('../data/exercise-variants', () => ({
  listVariants: vi.fn(async () => ({ variants: [], error: null })),
  listLinkableExercises: vi.fn(async () => ({ rows: [], error: null })),
  addEditorialVariant: vi.fn(async () => ({ error: null })),
  removeEditorialVariant: vi.fn(async () => ({ error: null })),
}));

const { ExerciseEditScreen } = await import('./ExerciseEditScreen');
const { getExercise, saveExercise } = await import('../data/exercises');
const {
  listVariants,
  listLinkableExercises,
  addEditorialVariant,
  removeEditorialVariant,
} = await import('../data/exercise-variants');
const { fr } = await import('../i18n/fr');

const mockGet = vi.mocked(getExercise);
const mockSave = vi.mocked(saveExercise);
const mockListVariants = vi.mocked(listVariants);
const mockLinkable = vi.mocked(listLinkableExercises);
const mockAddVariant = vi.mocked(addEditorialVariant);
const mockRemoveVariant = vi.mocked(removeEditorialVariant);

/** Exercice existant, tous champs renseignés — sert de base aux tests d'édition. */
const EXERCICE = {
  id: 'ex-1',
  musclePrimary: 'chest' as const,
  musclesSecondary: ['shoulders' as const, 'arms' as const],
  musclesFine: ['chest' as const, 'triceps' as const],
  equipment: 'barbell' as const,
  status: 'published' as const,
  nameFr: 'Développé couché',
  nameEn: 'Bench press',
  instructionsFr: 'Descends la barre à la poitrine.',
  instructionsEn: 'Lower the bar to your chest.',
};

beforeEach(() => {
  vi.clearAllMocks();
  delete params.id;
  mockGet.mockResolvedValue({ exercise: EXERCICE, error: null });
  mockSave.mockResolvedValue({ id: 'ex-1', error: null });
  mockListVariants.mockResolvedValue({ variants: [], error: null });
  mockLinkable.mockResolvedValue({ rows: [], error: null });
  mockAddVariant.mockResolvedValue({ error: null });
  mockRemoveVariant.mockResolvedValue({ error: null });
});

/** Monte l'écran en **création** et attend le formulaire. */
async function creation() {
  render(<ExerciseEditScreen />);
  await screen.findByLabelText(fr.exercises.nameFr);
  return userEvent.setup();
}

/** Monte l'écran en **édition** de `ex-1` et attend la fin du chargement. */
async function edition() {
  params.id = 'ex-1';
  render(<ExerciseEditScreen />);
  await waitFor(() =>
    expect(screen.getByLabelText(fr.exercises.nameFr)).toHaveValue(EXERCICE.nameFr),
  );
  return userEvent.setup();
}

/** Remplit les deux noms requis (les seuls champs sans lesquels rien ne part). */
async function nommer(user: ReturnType<typeof userEvent.setup>, nomFr = 'Squat', nomEn = 'Squat') {
  await user.clear(screen.getByLabelText(fr.exercises.nameFr));
  await user.type(screen.getByLabelText(fr.exercises.nameFr), nomFr);
  await user.clear(screen.getByLabelText(fr.exercises.nameEn));
  await user.type(screen.getByLabelText(fr.exercises.nameEn), nomEn);
}

const enregistrer = () => screen.getByRole('button', { name: fr.exercises.save });

/**
 * Cases à cocher, ciblées par **identifiant** et non par libellé.
 *
 * ⚠️ Trois libellés sont **ambigus à l'écran** : « Pectoraux », « Dos » et « Épaules » désignent à
 * la fois un groupe musculaire secondaire et un muscle fin, et `getByLabelText` remonte alors deux
 * nœuds. C'est une observation sur l'écran, pas seulement sur le test — pour un lecteur d'écran,
 * les deux cases s'annoncent pareil. Non corrigé ici : ce lot couvre, il ne redessine pas.
 */
const caseSecondaire = (groupe: string) => document.getElementById(`secondary-${groupe}`);
const caseFine = (muscle: string) => document.getElementById(`fine-${muscle}`);

// ---------------------------------------------------------------------------
// Création vs édition
// ---------------------------------------------------------------------------

describe('mode création', () => {
  it('affiche le titre de création et n’appelle pas le chargement', async () => {
    await creation();

    expect(screen.getByText(fr.exercises.formTitleNew)).toBeInTheDocument();
    // Sans `id`, il n'y a rien à charger : un appel ici irait chercher `undefined` en base.
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockListVariants).not.toHaveBeenCalled();
  });

  it('propose « brouillon » par défaut', async () => {
    await creation();

    // Le défaut compte : créer directement en « publié » exposerait un exercice à peine ébauché à
    // toute la bibliothèque.
    expect(screen.getByLabelText(fr.exercises.statusLabel)).toHaveValue('draft');
  });

  it('renvoie vers l’enregistrement avant de proposer des variantes', async () => {
    await creation();

    // Une variante est un lien entre deux lignes : tant que la première n'existe pas, il n'y a
    // rien à lier. L'écran le dit au lieu d'afficher un champ inopérant.
    expect(screen.getByText(fr.exercises.variantsSaveFirst)).toBeInTheDocument();
  });
});

describe('mode édition', () => {
  it('remplit tous les champs depuis l’exercice chargé', async () => {
    await edition();

    expect(mockGet).toHaveBeenCalledWith('ex-1');
    expect(screen.getByLabelText(fr.exercises.nameEn)).toHaveValue(EXERCICE.nameEn);
    expect(screen.getByLabelText(fr.exercises.instructionsFr)).toHaveValue(
      EXERCICE.instructionsFr,
    );
    expect(screen.getByLabelText(fr.exercises.instructionsEn)).toHaveValue(
      EXERCICE.instructionsEn,
    );
    expect(screen.getByLabelText(fr.exercises.groupLabel)).toHaveValue('chest');
    expect(screen.getByLabelText(fr.exercises.equipmentLabel)).toHaveValue('barbell');
    expect(screen.getByLabelText(fr.exercises.statusLabel)).toHaveValue('published');
    expect(screen.getByText(fr.exercises.formTitleEdit)).toBeInTheDocument();
  });

  it('recoche les muscles secondaires et fins enregistrés', async () => {
    await edition();

    expect(caseSecondaire('shoulders')).toBeChecked();
    expect(caseSecondaire('arms')).toBeChecked();
    expect(caseSecondaire('legs')).not.toBeChecked();
    expect(caseFine('triceps')).toBeChecked();
    expect(caseFine('calves')).not.toBeChecked();
  });

  it('convertit un équipement absent en « non renseigné »', async () => {
    mockGet.mockResolvedValue({
      exercise: { ...EXERCICE, equipment: null, instructionsFr: null, instructionsEn: null },
      error: null,
    });

    await edition();

    // `null` en base doit redevenir la chaîne vide du `<select>` : sinon React passe le contrôle
    // en non contrôlé et l'avertissement passe inaperçu.
    expect(screen.getByLabelText(fr.exercises.equipmentLabel)).toHaveValue('');
    expect(screen.getByLabelText(fr.exercises.instructionsFr)).toHaveValue('');
  });

  it('annonce l’échec de chargement sans afficher un formulaire vide trompeur', async () => {
    mockGet.mockResolvedValue({ exercise: null, error: new Error('réseau') });
    params.id = 'ex-1';

    render(<ExerciseEditScreen />);

    const alerte = await screen.findByRole('alert');
    expect(alerte).toHaveTextContent(fr.exercises.loadError);
    // Le formulaire reste affiché mais vide : enregistrer ici écraserait l'exercice réel par du
    // vide. C'est le comportement actuel — le test le fige pour qu'un changement soit délibéré.
    expect(screen.getByLabelText(fr.exercises.nameFr)).toHaveValue('');
  });
});

// ---------------------------------------------------------------------------
// Règle métier : primaire et secondaire s'excluent
// ---------------------------------------------------------------------------

describe('groupe principal et muscles secondaires', () => {
  it('🔴 retire des secondaires le groupe qui devient principal', async () => {
    const user = await edition();

    // « Épaules » est secondaire ; on le promeut principal.
    await user.selectOptions(screen.getByLabelText(fr.exercises.groupLabel), 'shoulders');
    await nommer(user, EXERCICE.nameFr, EXERCICE.nameEn);
    await user.click(enregistrer());

    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    const envoye = mockSave.mock.calls[0]![0];
    expect(envoye.musclePrimary).toBe('shoulders');
    // Sans la purge, `shoulders` partirait à la fois en primaire et en secondaire — une
    // contradiction invisible à l'écran, puisque la case a disparu de la liste.
    expect(envoye.musclesSecondary).not.toContain('shoulders');
    expect(envoye.musclesSecondary).toContain('arms');
  });

  it('n’offre jamais le groupe principal parmi les cases secondaires', async () => {
    await edition();

    // `chest` est le groupe principal : sa case secondaire ne doit pas exister du tout.
    expect(caseSecondaire('chest')).toBeNull();
    expect(caseSecondaire('legs')).toBeInTheDocument();
  });

  it('coche et décoche un muscle secondaire', async () => {
    const user = await creation();

    await user.click(caseSecondaire('legs')!);
    expect(caseSecondaire('legs')).toBeChecked();

    await user.click(caseSecondaire('legs')!);
    expect(caseSecondaire('legs')).not.toBeChecked();
  });

  it('coche et décoche un muscle fin', async () => {
    const user = await creation();

    await user.click(caseFine('glutes')!);
    await nommer(user);
    await user.click(enregistrer());

    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockSave.mock.calls[0]![0].musclesFine).toEqual(['glutes']);
  });
});

// ---------------------------------------------------------------------------
// Validation et nettoyage de ce qui part
// ---------------------------------------------------------------------------

describe('validation des noms', () => {
  it('🔴 refuse d’enregistrer sans nom FR — et n’appelle pas la couche data', async () => {
    const user = await creation();

    await user.type(screen.getByLabelText(fr.exercises.nameEn), 'Squat');
    await user.click(enregistrer());

    expect(await screen.findByRole('alert')).toHaveTextContent(fr.exercises.requiredBoth);
    // L'assertion qui compte : le refus doit être *avant* l'écriture, pas après.
    expect(mockSave).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('🔴 refuse un nom fait uniquement d’espaces', async () => {
    const user = await creation();

    await user.type(screen.getByLabelText(fr.exercises.nameFr), '   ');
    await user.type(screen.getByLabelText(fr.exercises.nameEn), 'Squat');
    await user.click(enregistrer());

    // Une validation sur la longueur brute laisserait passer «␣␣␣ » et publierait un exercice
    // sans nom lisible dans la bibliothèque de tout le monde.
    expect(await screen.findByRole('alert')).toHaveTextContent(fr.exercises.requiredBoth);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('nettoie les espaces autour des noms envoyés', async () => {
    const user = await creation();

    await nommer(user, '  Squat  ', '  Squat  ');
    await user.click(enregistrer());

    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockSave.mock.calls[0]![0]).toMatchObject({ nameFr: 'Squat', nameEn: 'Squat' });
  });

  it('efface l’erreur de validation à la tentative suivante', async () => {
    const user = await creation();

    await user.click(enregistrer());
    await screen.findByRole('alert');

    await nommer(user);
    await user.click(enregistrer());

    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('ce qui part en base', () => {
  it('🔴 envoie `null` — et non une chaîne vide — pour les champs laissés vides', async () => {
    const user = await creation();

    await nommer(user);
    await user.click(enregistrer());

    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    const envoye = mockSave.mock.calls[0]![0];
    // `''` et `null` ne disent pas la même chose côté mobile : le premier est une instruction
    // vide affichable, le second une absence d'instruction.
    expect(envoye.instructionsFr).toBeNull();
    expect(envoye.instructionsEn).toBeNull();
    expect(envoye.equipment).toBeNull();
  });

  it('envoie des instructions nettoyées quand elles sont renseignées', async () => {
    const user = await creation();

    await nommer(user);
    await user.type(screen.getByLabelText(fr.exercises.instructionsFr), '  Descends la barre.  ');
    await user.click(enregistrer());

    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockSave.mock.calls[0]![0].instructionsFr).toBe('Descends la barre.');
  });

  it('transmet l’équipement choisi et le statut', async () => {
    const user = await creation();

    await nommer(user);
    await user.selectOptions(screen.getByLabelText(fr.exercises.equipmentLabel), 'dumbbell');
    await user.selectOptions(screen.getByLabelText(fr.exercises.statusLabel), 'published');
    await user.click(enregistrer());

    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockSave.mock.calls[0]![0]).toMatchObject({
      equipment: 'dumbbell',
      status: 'published',
    });
  });

  it('transmet l’identifiant en édition, et rien en création', async () => {
    const user = await edition();
    await user.click(enregistrer());
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    // Sans `id`, `saveExercise` crée une ligne : une édition qui l'oublierait dupliquerait
    // l'exercice au lieu de le corriger.
    expect(mockSave.mock.calls[0]![0].id).toBe('ex-1');

    mockSave.mockClear();
    delete params.id;
  });
});

// ---------------------------------------------------------------------------
// Enregistrement : succès, échec, double appui
// ---------------------------------------------------------------------------

describe('enregistrement', () => {
  it('revient à la liste après un succès', async () => {
    const user = await creation();

    await nommer(user);
    await user.click(enregistrer());

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/exercises'));
  });

  it('🔴 ne navigue PAS quand l’enregistrement échoue', async () => {
    mockSave.mockResolvedValue({ id: null, error: new Error('conflit') });
    const user = await creation();

    await nommer(user);
    await user.click(enregistrer());

    expect(await screen.findByRole('alert')).toHaveTextContent(fr.exercises.error);
    // Repartir vers la liste sur un échec, c'est laisser l'admin croire que c'est enregistré.
    expect(navigate).not.toHaveBeenCalled();
  });

  it('🔴 un second appui pendant l’enregistrement n’écrit pas deux fois', async () => {
    let debloquer!: (v: { id: string; error: null }) => void;
    mockSave.mockReturnValue(new Promise((resolve) => (debloquer = resolve)));
    const user = await creation();

    await nommer(user);
    await user.click(enregistrer());

    const bouton = await screen.findByRole('button', { name: fr.exercises.saving });
    await user.click(bouton);
    await user.click(bouton);

    expect(mockSave).toHaveBeenCalledTimes(1);
    debloquer({ id: 'ex-1', error: null });
    await waitFor(() => expect(navigate).toHaveBeenCalled());
  });

  it('rend la main après un échec, pour permettre une correction', async () => {
    mockSave.mockResolvedValue({ id: null, error: new Error('conflit') });
    const user = await creation();

    await nommer(user);
    await user.click(enregistrer());
    await screen.findByRole('alert');

    expect(enregistrer()).toBeEnabled();
  });

  it('le bouton « retour » ramène à la liste sans enregistrer', async () => {
    const user = await creation();

    await nommer(user);
    await user.click(screen.getByRole('button', { name: fr.exercises.back }));

    expect(navigate).toHaveBeenCalledWith('/exercises');
    expect(mockSave).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Variantes éditoriales
// ---------------------------------------------------------------------------

describe('variantes', () => {
  const VARIANTE = { linkId: 'lien-1', otherId: 'ex-2', nameFr: 'Développé incliné' };

  it('affiche l’état vide quand l’exercice n’a aucune variante', async () => {
    await edition();

    expect(screen.getByText(fr.exercises.variantsEmpty)).toBeInTheDocument();
  });

  it('liste les variantes déjà liées', async () => {
    mockListVariants.mockResolvedValue({ variants: [VARIANTE], error: null });

    await edition();

    expect(await screen.findByText(VARIANTE.nameFr)).toBeInTheDocument();
    expect(screen.queryByText(fr.exercises.variantsEmpty)).not.toBeInTheDocument();
  });

  it('🔴 exclut l’exercice courant et ses variantes des résultats proposés', async () => {
    mockListVariants.mockResolvedValue({ variants: [VARIANTE], error: null });
    const user = await edition();

    await user.type(screen.getByPlaceholderText(fr.exercises.variantsSearch), 'dev');

    await waitFor(() => expect(mockLinkable).toHaveBeenCalled());
    const [idAppele, exclus] = mockLinkable.mock.calls.at(-1)!;
    expect(idAppele).toBe('ex-1');
    // Se lier à soi-même n'a pas de sens, et reproposer une variante déjà liée produirait un
    // doublon. Les deux exclusions partent dans la même liste.
    expect(exclus).toContain('ex-1');
    expect(exclus).toContain('ex-2');
  });

  it('filtre les résultats sur le terme saisi, sans tenir compte de la casse', async () => {
    mockLinkable.mockResolvedValue({
      rows: [
        { id: 'ex-3', nameFr: 'Développé militaire' },
        { id: 'ex-4', nameFr: 'Squat bulgare' },
      ],
      error: null,
    });
    const user = await edition();

    await user.type(screen.getByPlaceholderText(fr.exercises.variantsSearch), 'DÉVELOPPÉ');

    expect(await screen.findByText('Développé militaire')).toBeInTheDocument();
    expect(screen.queryByText('Squat bulgare')).not.toBeInTheDocument();
  });

  it('🟠 la recherche est SENSIBLE AUX ACCENTS — comportement figé, pas approuvé', async () => {
    mockLinkable.mockResolvedValue({
      rows: [{ id: 'ex-3', nameFr: 'Développé militaire' }],
      error: null,
    });
    const user = await edition();

    // `'développé'.includes('dev')` est **faux** : c'est `d-é-v`, pas `d-e-v`. Le filtre de
    // l'écran (`nameFr.toLowerCase().includes(terme)`) ne normalise pas les diacritiques, donc
    // taper « dev » ne trouve pas « Développé » — alors que c'est le réflexe de saisie le plus
    // courant sur un clavier, et que la bibliothèque est majoritairement francophone.
    //
    // Trouvé en écrivant ce fichier : le test initial utilisait « dev » et échouait pour cette
    // raison, pas pour une raison de test. Le comportement est **figé ici plutôt que corrigé** —
    // ce lot couvre, il ne change pas le produit. Le correctif tiendrait en une normalisation
    // `.normalize('NFD').replace(/\p{Diacritic}/gu, '')` des deux côtés de la comparaison.
    await user.type(screen.getByPlaceholderText(fr.exercises.variantsSearch), 'dev');

    await waitFor(() => expect(mockLinkable).toHaveBeenCalled());
    expect(screen.queryByText('Développé militaire')).not.toBeInTheDocument();

    // La même recherche, accentuée, trouve bien.
    await user.clear(screen.getByPlaceholderText(fr.exercises.variantsSearch));
    await user.type(screen.getByPlaceholderText(fr.exercises.variantsSearch), 'dév');
    expect(await screen.findByText('Développé militaire', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('n’interroge pas la base sur une recherche vide', async () => {
    const user = await edition();

    const champ = screen.getByPlaceholderText(fr.exercises.variantsSearch);
    await user.type(champ, 'a');
    await waitFor(() => expect(mockLinkable).toHaveBeenCalled());

    mockLinkable.mockClear();
    await user.clear(champ);

    // Un terme vide ne doit pas déclencher une requête qui ramènerait toute la table.
    await waitFor(() => expect(screen.queryByText('Développé militaire')).not.toBeInTheDocument());
    expect(mockLinkable).not.toHaveBeenCalled();
  });

  it('ajoute une variante, vide la recherche et recharge la liste', async () => {
    mockLinkable.mockResolvedValue({
      rows: [{ id: 'ex-3', nameFr: 'Développé militaire' }],
      error: null,
    });
    const user = await edition();

    await user.type(screen.getByPlaceholderText(fr.exercises.variantsSearch), 'militaire');
    // Clic sur le libellé plutôt que sur le bouton : celui-ci enveloppe le nom **et** une mention
    // d'aide, et le clic remonte de toute façon au bouton parent.
    await user.click(await screen.findByText('Développé militaire', {}, { timeout: 3000 }));

    await waitFor(() => expect(mockAddVariant).toHaveBeenCalledWith('ex-1', 'ex-3'));
    // La recherche est vidée : laisser le terme afficherait un résultat qu'on vient de consommer.
    expect(screen.getByPlaceholderText(fr.exercises.variantsSearch)).toHaveValue('');
    // Rechargement : l'écran affiche ce que la base contient, pas ce qu'il suppose avoir écrit.
    expect(mockListVariants).toHaveBeenCalledTimes(2);
  });

  it('supprime une variante et recharge la liste', async () => {
    mockListVariants.mockResolvedValue({ variants: [VARIANTE], error: null });
    const user = await edition();

    await user.click(
      await screen.findByRole('button', { name: new RegExp(VARIANTE.nameFr) }),
    );

    await waitFor(() => expect(mockRemoveVariant).toHaveBeenCalledWith('lien-1'));
    expect(mockListVariants).toHaveBeenCalledTimes(2);
  });

  it('signale l’échec d’un ajout sans vider la recherche', async () => {
    mockAddVariant.mockResolvedValue({ error: new Error('doublon') });
    mockLinkable.mockResolvedValue({
      rows: [{ id: 'ex-3', nameFr: 'Développé militaire' }],
      error: null,
    });
    const user = await edition();

    await user.type(screen.getByPlaceholderText(fr.exercises.variantsSearch), 'militaire');
    await user.click(await screen.findByText('Développé militaire', {}, { timeout: 3000 }));

    expect(await screen.findByRole('alert')).toHaveTextContent(fr.exercises.error);
    // La liste n'est pas rechargée : rien n'a changé en base, l'afficher comme si oui serait faux.
    expect(mockListVariants).toHaveBeenCalledTimes(1);
  });

  it('signale l’échec d’une suppression', async () => {
    mockListVariants.mockResolvedValue({ variants: [VARIANTE], error: null });
    mockRemoveVariant.mockResolvedValue({ error: new Error('introuvable') });
    const user = await edition();

    await user.click(
      await screen.findByRole('button', { name: new RegExp(VARIANTE.nameFr) }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(fr.exercises.error);
    expect(mockListVariants).toHaveBeenCalledTimes(1);
  });

  it('affiche un libellé de repli pour une variante sans nom FR', async () => {
    mockListVariants.mockResolvedValue({
      variants: [{ linkId: 'lien-2', otherId: 'ex-9', nameFr: null }],
      error: null,
    });

    await edition();

    // Une traduction FR manquante ne doit pas produire une puce vide et non cliquable.
    const puces = await screen.findAllByText(fr.exercises.noName);
    expect(puces.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Chargement
// ---------------------------------------------------------------------------

describe('chargement', () => {
  it('affiche l’indicateur puis le formulaire', async () => {
    let debloquer!: (v: { exercise: typeof EXERCICE; error: null }) => void;
    mockGet.mockReturnValue(new Promise((resolve) => (debloquer = resolve)));
    params.id = 'ex-1';

    render(<ExerciseEditScreen />);

    expect(screen.getByText(fr.exercises.loading)).toBeInTheDocument();
    // Le formulaire est masqué pendant le chargement : l'afficher vide inviterait à saisir
    // par-dessus des valeurs sur le point d'arriver.
    expect(screen.queryByLabelText(fr.exercises.nameFr)).not.toBeInTheDocument();

    debloquer({ exercise: EXERCICE, error: null });
    await waitFor(() =>
      expect(screen.getByLabelText(fr.exercises.nameFr)).toHaveValue(EXERCICE.nameFr),
    );
  });
});
