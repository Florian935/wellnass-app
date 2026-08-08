/**
 * Back-office — import d'aliments par CSV (US 8.6).
 *
 * C'est l'écran le plus dangereux du back-office : **un seul fichier écrit des centaines de lignes
 * dans la base d'aliments partagée par tous les utilisateurs.** Une erreur ici ne se rattrape pas
 * en corrigeant une fiche.
 *
 * D'où la forme du parcours, et ce que ce fichier verrouille :
 *
 *  1. **Rien ne s'écrit avant un aperçu et un clic explicite.** Le fichier est analysé, validé,
 *     résumé (N valides / M erreurs détaillées ligne par ligne), et c'est seulement là que le
 *     bouton d'import apparaît. Un import déclenché à la sélection du fichier serait irréparable.
 *  2. **Les lignes invalides n'empêchent pas les valides de passer**, mais elles sont **listées**
 *     avec leur numéro de ligne et leur motif. Une validation tout-ou-rien sur un fichier de 400
 *     lignes rendrait l'outil inutilisable ; une validation silencieuse ferait perdre des lignes
 *     sans le dire.
 *  3. **Zéro ligne valide → l'import reste désactivé.** Cliquer sur « Importer » sur un fichier
 *     entièrement invalide doit être impossible, pas juste inutile.
 *  4. **Un échec est rattrapable sans reprendre le fichier** : l'écran garde les données analysées
 *     et propose de réessayer. L'upsert est idempotent, réessayer ne duplique rien.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

vi.mock('../data/foods', () => ({
  importFoods: vi.fn(),
  buildCsvTemplate: vi.fn(() => 'import_key,name_fr,name_en,category,kcal_per_100g\n'),
}));

const { FoodImportScreen } = await import('./FoodImportScreen');
const { buildCsvTemplate, importFoods } = await import('../data/foods');
const { fr } = await import('../i18n/fr');

const mockImport = vi.mocked(importFoods);
const mockTemplate = vi.mocked(buildCsvTemplate);

/**
 * En-tête CSV attendu par `parseFoodCsv`, suivi des lignes fournies.
 *
 * `import_key` est **obligatoire** : c'est elle qui rend le réimport idempotent (upsert sur
 * conflit). Un fichier sans elle ne crée pas des doublons — il est refusé, ligne par ligne.
 */
const csv = (...lignes: string[]) =>
  ['import_key,name_fr,name_en,category,kcal_per_100g', ...lignes].join('\n');

/** Une ligne valide : clé d'import, noms FR + EN, catégorie du référentiel, calories numériques. */
const LIGNE_VALIDE = 'ciqual:13000,Pomme,Apple,fruits,52';
/** Une ligne invalide : catégorie hors référentiel. */
const LIGNE_INVALIDE = 'ciqual:99999,Truc,Thing,categorie_inexistante,52';

/** Sélectionne un fichier CSV dans le champ d'upload et attend la fin de l'analyse. */
async function deposer(contenu: string, nom = 'aliments.csv') {
  const fichier = new File([contenu], nom, { type: 'text/csv' });
  // `getByLabelText` ne convient pas : l'input est visuellement masqué DANS le label.
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await userEvent.upload(input, fichier);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockImport.mockResolvedValue({ created: 0, updated: 0, reactivated: 0 });
  mockTemplate.mockReturnValue('import_key,name_fr,name_en,category,kcal_per_100g\n');
});

// ---------------------------------------------------------------------------
// État initial
// ---------------------------------------------------------------------------

describe('état initial', () => {
  it('🔴 n’offre AUCUN bouton d’import tant qu’aucun fichier n’est analysé', async () => {
    render(<FoodImportScreen />);

    // Un import possible avant l'aperçu, c'est un import à l'aveugle sur la base partagée.
    expect(screen.queryByText(fr.foods.importCta)).toBeNull();
  });

  it('propose le modèle et le retour à la liste', async () => {
    render(<FoodImportScreen />);

    expect(screen.getByText(fr.foods.template)).toBeInTheDocument();
    await userEvent.click(screen.getByText(new RegExp(fr.foods.backToList)));
    expect(navigate).toHaveBeenCalledWith('/foods');
  });

  it('le modèle est construit par la couche data, pas réécrit ici', async () => {
    // Deux définitions de colonnes qui divergent, c'est un fichier modèle qui ne s'importe pas.
    const creerUrl = vi.fn(() => 'blob:test');
    vi.stubGlobal('URL', { createObjectURL: creerUrl, revokeObjectURL: vi.fn() });
    // Le téléchargement passe par un `<a>` cliqué : jsdom n'implémente pas la navigation et
    // enverrait un « Not implemented » dans la sortie de tous les runs. On neutralise le clic —
    // ce qu'on teste ici est la provenance du contenu, pas le mécanisme de téléchargement.
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<FoodImportScreen />);

    await userEvent.click(screen.getByText(fr.foods.template));

    expect(mockTemplate).toHaveBeenCalled();
    clic.mockRestore();
    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// Analyse du fichier
// ---------------------------------------------------------------------------

describe('analyse du fichier', () => {
  it('affiche le nom du fichier déposé', async () => {
    render(<FoodImportScreen />);

    await deposer(csv(LIGNE_VALIDE), 'ciqual-2026.csv');

    expect(await screen.findByText('ciqual-2026.csv')).toBeInTheDocument();
  });

  it('résume le nombre de lignes valides et en erreur', async () => {
    render(<FoodImportScreen />);

    await deposer(
      csv(
        LIGNE_VALIDE,
        LIGNE_INVALIDE,
        LIGNE_VALIDE.replace('Pomme', 'Poire').replace('13000', '13001'),
      ),
    );

    // Le résumé est ce sur quoi l'admin décide : il doit être exact avant toute écriture.
    // Le texte est découpé en plusieurs nœuds (`<strong>N</strong> ligne(s) valide(s) · …`) et les
    // libellés contiennent des parenthèses — donc ni `getByText` sur la chaîne, ni une `RegExp`
    // construite depuis le libellé, qui interpréterait `(s)` comme un groupe de capture.
    await screen.findByText(fr.foods.importCta);
    const resume = [...document.querySelectorAll('p')]
      .map((p) => p.textContent ?? '')
      .find((t) => t.includes('·'));
    expect(resume).toContain('2');
    expect(resume).toContain('1');
  });

  it('🔴 détaille CHAQUE erreur avec son numéro de ligne et son motif', async () => {
    render(<FoodImportScreen />);

    await deposer(csv(LIGNE_VALIDE, LIGNE_INVALIDE));

    // « 1 erreur » sans dire laquelle oblige à relire 400 lignes à la main.
    const tableau = await screen.findByRole('table');
    expect(tableau).toHaveTextContent('category');
  });

  it('🔴 les lignes invalides n’empêchent pas les valides de passer', async () => {
    render(<FoodImportScreen />);

    await deposer(csv(LIGNE_INVALIDE, LIGNE_VALIDE));

    // Une validation tout-ou-rien sur un fichier de 400 lignes rend l'outil inutilisable.
    await userEvent.click(await screen.findByText(fr.foods.importCta));

    await waitFor(() => expect(mockImport).toHaveBeenCalled());
    expect(mockImport.mock.calls[0]?.[0]).toHaveLength(1);
  });

  it('n’affiche aucun tableau d’erreurs quand tout est valide', async () => {
    render(<FoodImportScreen />);

    await deposer(csv(LIGNE_VALIDE));

    await screen.findByText(fr.foods.importCta);
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('🔴 un fichier sans aucune ligne est REFUSÉ, pas analysé comme vide', async () => {
    render(<FoodImportScreen />);

    await deposer('import_key,name_fr,name_en,category,kcal_per_100g');

    // « 0 valide · 0 erreur » se lirait comme un fichier correct mais inutile, alors que c'est un
    // fichier mal formé — ou le mauvais fichier.
    expect(await screen.findByText(fr.foods.parseErrorFile)).toBeInTheDocument();
    expect(screen.queryByText(fr.foods.importCta)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

describe('import', () => {
  it('🔴 zéro ligne valide → le bouton d’import est DÉSACTIVÉ', async () => {
    render(<FoodImportScreen />);

    await deposer(csv(LIGNE_INVALIDE));

    // Désactivé, et pas seulement sans effet : un clic sans réaction se lit comme un écran figé.
    expect(await screen.findByText(fr.foods.importCta)).toBeDisabled();
    expect(screen.getByText(fr.foods.noValid)).toBeInTheDocument();
  });

  it('transmet les lignes validées, telles que le parseur les a produites', async () => {
    render(<FoodImportScreen />);

    await deposer(csv(LIGNE_VALIDE));
    await userEvent.click(await screen.findByText(fr.foods.importCta));

    await waitFor(() => expect(mockImport).toHaveBeenCalled());
    expect(mockImport.mock.calls[0]?.[0][0]).toMatchObject({ nameFr: 'Pomme', kcalPer100g: 52 });
  });

  it('affiche le rapport : créés, mis à jour, réactivés', async () => {
    mockImport.mockResolvedValue({ created: 12, updated: 3, reactivated: 2 });
    render(<FoodImportScreen />);

    await deposer(csv(LIGNE_VALIDE));
    await userEvent.click(await screen.findByText(fr.foods.importCta));

    const rapport = await screen.findByText(fr.foods.reportTitle);
    expect(rapport.parentElement).toHaveTextContent('12');
    expect(rapport.parentElement).toHaveTextContent('3');
    // « Réactivé » = un aliment archivé que le réimport a remis en service. Le taire ferait
    // réapparaître du contenu sans que personne l'ait décidé.
    expect(rapport.parentElement).toHaveTextContent('2');
  });

  it('🔴 aucune réactivation → la mention n’est pas affichée à zéro', async () => {
    mockImport.mockResolvedValue({ created: 5, updated: 0, reactivated: 0 });
    render(<FoodImportScreen />);

    await deposer(csv(LIGNE_VALIDE));
    await userEvent.click(await screen.findByText(fr.foods.importCta));

    await screen.findByText(fr.foods.reportTitle);
    // Un « 0 réactivé » attire l'œil sur un non-événement, dans un rapport qu'on lit vite.
    expect(screen.queryByText(new RegExp(fr.foods.reactivatedSuffix))).toBeNull();
  });

  it('remet l’écran à zéro après le rapport', async () => {
    render(<FoodImportScreen />);

    await deposer(csv(LIGNE_VALIDE), 'ciqual.csv');
    await userEvent.click(await screen.findByText(fr.foods.importCta));
    await userEvent.click(await screen.findByText(fr.foods.reset));

    expect(screen.queryByText('ciqual.csv')).toBeNull();
    expect(screen.queryByText(fr.foods.reportTitle)).toBeNull();
  });

  it('🔴 un échec est annoncé et RATTRAPABLE sans reprendre le fichier', async () => {
    mockImport.mockRejectedValueOnce(new Error('réseau'));
    render(<FoodImportScreen />);

    await deposer(csv(LIGNE_VALIDE));
    await userEvent.click(await screen.findByText(fr.foods.importCta));

    // L'upsert est idempotent : réessayer ne duplique rien, et reprendre tout le parcours pour
    // une coupure réseau serait une punition.
    expect(await screen.findByText(fr.foods.importError)).toBeInTheDocument();
    mockImport.mockResolvedValue({ created: 1, updated: 0, reactivated: 0 });
    await userEvent.click(screen.getByText(fr.foods.importCta));

    expect(await screen.findByText(fr.foods.reportTitle)).toBeInTheDocument();
  });
});
