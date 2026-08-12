/**
 * Back-office — formulaire de création / édition d'un aliment éditorial (US 8.5).
 *
 * 316 lignes, **26 champs** (2 noms, catégorie, calories, 6 macros, 10 micronutriments), et 0 %
 * de couverture jusqu'ici. Comme pour les exercices, ce qui est écrit ici est du **contenu
 * partagé** : un aliment éditorial descend dans la base locale de tous les utilisateurs et sert de
 * référence à leurs journaux.
 *
 * `foods.test.ts` couvre `saveFood`, et `food-form.test.ts` couvre `validateFoodInput` — la règle
 * de validation est donc déjà testée à 100 % côté `shared`. Ce qui reste **non couvert**, et qui
 * n'appartient qu'à l'écran :
 *
 *  1. **Le refus de valider n'écrit pas.** `validateFoodInput` peut dire « non » sans que rien
 *     n'empêche l'écran d'appeler `saveFood` derrière. C'est l'assertion centrale du fichier.
 *  2. **Chaque erreur atterrit sur SON champ.** Le mapping `errors[].field → fieldErrors[field]`
 *     est un aller simple : une clé mal recopiée affiche « nombre ≥ 0 attendu » sous le mauvais
 *     champ, ou sous aucun. Sur 26 champs, personne ne le remarque en recette.
 *  3. **Les erreurs précédentes sont effacées à la tentative suivante**, sinon une erreur corrigée
 *     reste affichée sous un champ devenu valide.
 *  4. **`importKey` ne s'affiche que s'il existe, et en lecture seule.** C'est la trace d'un import
 *     CIQUAL : la rendre éditable permettrait de casser le lien de déduplication d'un import.
 *
 * ⚠️ **Les 26 champs n'ont AUCUN label associé** : le composant `Field` rend un `<label>` sans
 * `htmlFor` et sans envelopper son contenu. `getByLabelText` est donc inutilisable ici, et surtout
 * un lecteur d'écran annonce « zone de texte » sans nom. Observation d'accessibilité relevée en
 * écrivant ces tests — non corrigée : ce lot couvre, il ne redessine pas.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks : navigation et couche data ─────────────────────────────────────────
//
// `validateFoodInput` n'est **pas** mocké : c'est la brique partagée réelle qu'on veut voir jouer
// avec l'écran. La mocker reviendrait à tester le câblage contre lui-même.

const navigate = vi.fn();
const params: { id?: string } = {};
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useParams: () => params,
}));

vi.mock('../data/foods', () => ({
  getFood: vi.fn(),
  saveFood: vi.fn(async () => ({ id: 'food-1', error: null })),
}));

const { FoodEditScreen } = await import('./FoodEditScreen');
const { getFood, saveFood } = await import('../data/foods');
const { fr } = await import('../i18n/fr');

const mockGet = vi.mocked(getFood);
const mockSave = vi.mocked(saveFood);

/** Aliment existant, importé de CIQUAL — le cas qui affiche la clé d'import. */
const ALIMENT = {
  id: 'food-1',
  nameFr: 'Blanc de poulet',
  nameEn: 'Chicken breast',
  category: 'meat' as const,
  kcalPer100g: 165,
  proteinPer100g: 31,
  carbsPer100g: 0,
  sugarsPer100g: 0,
  fatPer100g: 3.6,
  saturatedFatPer100g: 1,
  fiberPer100g: 0,
  micronutrients: { sodium_mg: 74, iron_mg: 1 } as Record<string, number>,
  importKey: 'ciqual-36001',
};

beforeEach(() => {
  vi.clearAllMocks();
  delete params.id;
  mockGet.mockResolvedValue({ food: ALIMENT, error: null });
  mockSave.mockResolvedValue({ id: ALIMENT.id, error: null });
});

/**
 * Champ de saisie, atteint **par la structure** et non par son label.
 *
 * `Field` rend `<div><label>Libellé</label><input/>…</div>` sans `htmlFor` : le seul chemin fiable
 * est de partir du libellé et de descendre dans son parent.
 */
function champ(label: string): HTMLElement {
  const libelle = screen.getAllByText(label)[0]!;
  const saisie = libelle.parentElement!.querySelector('input, select');
  if (!saisie) throw new Error(`Champ introuvable pour le libellé « ${label} »`);
  return saisie as HTMLElement;
}

/** Message d'erreur affiché sous un champ donné (ou `null`). */
function erreurDuChamp(label: string): string | null {
  const libelle = screen.getAllByText(label)[0]!;
  return libelle.parentElement!.querySelector('span')?.textContent ?? null;
}

const enregistrer = () => screen.getByRole('button', { name: fr.foods.save });

/** Monte l'écran en création et attend le formulaire. */
async function creation() {
  render(<FoodEditScreen />);
  await screen.findByText(fr.foods.macrosTitle);
  return userEvent.setup();
}

/** Monte l'écran en édition de `food-1` et attend la fin du chargement. */
async function edition() {
  params.id = 'food-1';
  render(<FoodEditScreen />);
  await waitFor(() => expect(champ(fr.foods.nameFr)).toHaveValue(ALIMENT.nameFr));
  return userEvent.setup();
}

/** Remplit le minimum que `validateFoodInput` exige : les deux noms et les calories. */
async function remplirMinimum(user: ReturnType<typeof userEvent.setup>) {
  await user.type(champ(fr.foods.nameFr), 'Riz basmati');
  await user.type(champ(fr.foods.nameEn), 'Basmati rice');
  await user.type(champ(fr.foods.kcal), '350');
}

// ---------------------------------------------------------------------------
// Création vs édition
// ---------------------------------------------------------------------------

describe('mode création', () => {
  it('affiche le titre de création sans rien charger', async () => {
    await creation();

    expect(screen.getByText(fr.foods.formNewTitle)).toBeInTheDocument();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('n’affiche pas la clé d’import', async () => {
    await creation();

    // Un aliment créé à la main n'a pas d'origine CIQUAL : afficher un champ vide laisserait
    // croire qu'on peut en saisir une.
    expect(screen.queryByText(fr.foods.importKeyLabel)).not.toBeInTheDocument();
  });

  it('part de champs vides', async () => {
    await creation();

    expect(champ(fr.foods.nameFr)).toHaveValue('');
    expect(champ(fr.foods.kcal)).toHaveValue('');
    expect(champ(fr.foods.macroNames.proteinPer100g)).toHaveValue('');
  });
});

describe('mode édition', () => {
  it('remplit les noms, la catégorie et les calories', async () => {
    await edition();

    expect(mockGet).toHaveBeenCalledWith('food-1');
    expect(champ(fr.foods.nameEn)).toHaveValue(ALIMENT.nameEn);
    expect(champ(fr.foods.category)).toHaveValue(ALIMENT.category);
    expect(champ(fr.foods.kcal)).toHaveValue('165');
    expect(screen.getByText(fr.foods.formEditTitle)).toBeInTheDocument();
  });

  it('remplit les macros, y compris les zéros', async () => {
    await edition();

    expect(champ(fr.foods.macroNames.proteinPer100g)).toHaveValue('31');
    expect(champ(fr.foods.macroNames.fatPer100g)).toHaveValue('3.6');
    // 🔴 `0` ne doit pas devenir une chaîne vide : un `numToStr` écrit avec `n || ''` afficherait
    // « rien » là où la valeur mesurée est « zéro gramme ». Les deux ne disent pas la même chose.
    expect(champ(fr.foods.macroNames.carbsPer100g)).toHaveValue('0');
    expect(champ(fr.foods.macroNames.fiberPer100g)).toHaveValue('0');
  });

  it('remplit les micronutriments renseignés et laisse les autres vides', async () => {
    await edition();

    expect(champ(fr.foods.microNames.sodium_mg)).toHaveValue('74');
    expect(champ(fr.foods.microNames.iron_mg)).toHaveValue('1');
    expect(champ(fr.foods.microNames.calcium_mg)).toHaveValue('');
  });

  it('🔴 affiche la clé d’import en LECTURE SEULE', async () => {
    await edition();

    const cle = champ(fr.foods.importKeyLabel);
    expect(cle).toHaveValue(ALIMENT.importKey);
    // La clé d'import est ce qui permet de reconnaître un aliment CIQUAL déjà présent lors d'un
    // ré-import. La rendre modifiable, c'est autoriser la création de doublons silencieux.
    expect(cle).toHaveAttribute('readonly');
  });

  it('n’affiche pas la clé pour un aliment saisi à la main', async () => {
    mockGet.mockResolvedValue({ food: { ...ALIMENT, importKey: null }, error: null });

    await edition();

    expect(screen.queryByText(fr.foods.importKeyLabel)).not.toBeInTheDocument();
  });

  it('annonce l’aliment introuvable', async () => {
    mockGet.mockResolvedValue({ food: null, error: new Error('404') });
    params.id = 'food-inconnu';

    render(<FoodEditScreen />);

    expect(await screen.findByRole('alert')).toHaveTextContent(fr.foods.notFound);
  });

  it('affiche l’indicateur de chargement avant le formulaire', async () => {
    let debloquer!: (v: { food: typeof ALIMENT; error: null }) => void;
    mockGet.mockReturnValue(new Promise((resolve) => (debloquer = resolve)));
    params.id = 'food-1';

    render(<FoodEditScreen />);

    expect(screen.getByText(fr.foods.loading)).toBeInTheDocument();
    expect(screen.queryByText(fr.foods.macrosTitle)).not.toBeInTheDocument();

    debloquer({ food: ALIMENT, error: null });
    await waitFor(() => expect(champ(fr.foods.nameFr)).toHaveValue(ALIMENT.nameFr));
  });
});

// ---------------------------------------------------------------------------
// Validation : le refus n'écrit pas, et chaque erreur trouve son champ
// ---------------------------------------------------------------------------

describe('validation', () => {
  it('🔴 refuse d’enregistrer un formulaire vide — et n’appelle pas la couche data', async () => {
    const user = await creation();

    await user.click(enregistrer());

    // L'assertion centrale : `validateFoodInput` peut dire « non » sans que rien n'empêche
    // l'écran d'écrire derrière.
    await waitFor(() => expect(erreurDuChamp(fr.foods.nameFr)).not.toBeNull());
    expect(mockSave).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('🔴 place chaque erreur sous SON champ', async () => {
    const user = await creation();

    // Noms renseignés, calories absentes : seules les calories doivent porter une erreur.
    await user.type(champ(fr.foods.nameFr), 'Riz');
    await user.type(champ(fr.foods.nameEn), 'Rice');
    await user.click(enregistrer());

    await waitFor(() => expect(erreurDuChamp(fr.foods.kcal)).not.toBeNull());
    // Sur 26 champs, une clé mal recopiée dans le mapping afficherait le message ailleurs — et
    // personne ne le verrait en recette.
    expect(erreurDuChamp(fr.foods.nameFr)).toBeNull();
    expect(erreurDuChamp(fr.foods.nameEn)).toBeNull();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('🔴 signale une macro non numérique sous la bonne ligne', async () => {
    const user = await creation();

    await remplirMinimum(user);
    await user.type(champ(fr.foods.macroNames.proteinPer100g), 'beaucoup');
    await user.click(enregistrer());

    await waitFor(() =>
      expect(erreurDuChamp(fr.foods.macroNames.proteinPer100g)).not.toBeNull(),
    );
    expect(erreurDuChamp(fr.foods.macroNames.carbsPer100g)).toBeNull();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('signale un micronutriment non numérique', async () => {
    const user = await creation();

    await remplirMinimum(user);
    await user.type(champ(fr.foods.microNames.sodium_mg), 'salé');
    await user.click(enregistrer());

    await waitFor(() => expect(erreurDuChamp(fr.foods.microNames.sodium_mg)).not.toBeNull());
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('🔴 efface les erreurs de champ à la tentative suivante', async () => {
    const user = await creation();

    await user.click(enregistrer());
    await waitFor(() => expect(erreurDuChamp(fr.foods.nameFr)).not.toBeNull());

    await remplirMinimum(user);
    await user.click(enregistrer());

    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    // Sans le `setFieldErrors({})` d'ouverture, l'erreur resterait sous un champ désormais valide.
    expect(erreurDuChamp(fr.foods.nameFr)).toBeNull();
  });

  it('accepte un formulaire minimal : deux noms et des calories', async () => {
    const user = await creation();

    await remplirMinimum(user);
    await user.click(enregistrer());

    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    // Macros et micros sont optionnels : les exiger bloquerait la saisie d'un aliment dont on n'a
    // que l'étiquette calorique.
    expect(mockSave.mock.calls[0]![0]).toMatchObject({
      nameFr: 'Riz basmati',
      nameEn: 'Basmati rice',
      kcalPer100g: 350,
    });
  });
});

// ---------------------------------------------------------------------------
// Enregistrement
// ---------------------------------------------------------------------------

describe('enregistrement', () => {
  it('transmet l’identifiant en édition', async () => {
    const user = await edition();

    await user.click(enregistrer());

    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    // Sans `id`, `saveFood` insère : une édition qui l'oublierait dupliquerait l'aliment.
    expect(mockSave.mock.calls[0]![0].id).toBe('food-1');
  });

  it('n’envoie pas d’identifiant en création', async () => {
    const user = await creation();

    await remplirMinimum(user);
    await user.click(enregistrer());

    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockSave.mock.calls[0]![0].id).toBeUndefined();
  });

  it('revient à la liste après un succès', async () => {
    const user = await creation();

    await remplirMinimum(user);
    await user.click(enregistrer());

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/foods'));
  });

  it('🔴 ne navigue PAS quand l’enregistrement échoue', async () => {
    mockSave.mockResolvedValue({ id: null, error: new Error('contrainte') });
    const user = await creation();

    await remplirMinimum(user);
    await user.click(enregistrer());

    expect(await screen.findByRole('alert')).toHaveTextContent(fr.foods.saveError);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('🔴 un second appui pendant l’enregistrement n’écrit pas deux fois', async () => {
    let debloquer!: (v: { id: string; error: null }) => void;
    mockSave.mockReturnValue(new Promise((resolve) => (debloquer = resolve)));
    const user = await creation();

    await remplirMinimum(user);
    await user.click(enregistrer());

    const bouton = await screen.findByRole('button', { name: fr.foods.saving });
    await user.click(bouton);
    await user.click(bouton);

    expect(mockSave).toHaveBeenCalledTimes(1);
    debloquer({ id: 'food-1', error: null });
    await waitFor(() => expect(navigate).toHaveBeenCalled());
  });

  it('rend la main après un échec', async () => {
    mockSave.mockResolvedValue({ id: null, error: new Error('contrainte') });
    const user = await creation();

    await remplirMinimum(user);
    await user.click(enregistrer());
    await screen.findByRole('alert');

    expect(enregistrer()).toBeEnabled();
  });

  it('le bouton d’annulation ramène à la liste sans écrire', async () => {
    const user = await creation();

    await remplirMinimum(user);
    await user.click(screen.getByRole('button', { name: fr.foods.cancel }));

    expect(navigate).toHaveBeenCalledWith('/foods');
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('transmet la catégorie choisie', async () => {
    const user = await creation();

    await remplirMinimum(user);
    await user.selectOptions(champ(fr.foods.category), 'starchy');
    await user.click(enregistrer());

    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockSave.mock.calls[0]![0].category).toBe('starchy');
  });
});
