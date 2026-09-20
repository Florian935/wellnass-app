/**
 * US NUTRI-UX02 — la recherche de l'écran plein « Ajouter un aliment », sur du vrai SQLite.
 *
 * ── Le défaut corrigé ────────────────────────────────────────────────────────────────────────────
 * NUTRI-UX01 avait borné la requête et branché le classement par pertinence — mais **seulement sur
 * la feuille d'ajout**. L'écran plein (`food-picker.tsx`) est resté sur `useFoods()` : un
 * `SELECT` sans `LIMIT` sur les 3 244 aliments, trois `LEFT JOIN`, puis un filtre JavaScript et un
 * tri alphabétique — à chaque frappe. Le commentaire de `food-catalog-repository.ts` disait déjà
 * « indolore à 80 aliments, intenable au millier » ; le correctif n'avait simplement pas été
 * appliqué aux deux endroits.
 *
 * Ce que la requête doit garantir, et qu'aucun test de composant ne verrait :
 *
 *  1. **Le balayage est borné en SQL.** Sans `LIMIT`, deux lettres suffisent à remonter des
 *     centaines de lignes et leurs JOIN avant que le classement n'ait son mot à dire.
 *  2. **Les correspondances par début de nom passent en premier dans le SQL**, avant la coupe.
 *     Sans cette clause, la limite tranche dans un ordre alphabétique : « pomme » peut disparaître
 *     à « po » puis réapparaître à « pom ». Une liste qui rétrécit quand on précise sa recherche
 *     se lit comme un moteur cassé.
 *  3. **Les accents ne sont pas un mur.** `LIKE` de SQLite ignore la casse mais pas les accents, et
 *     la base est francophone (CIQUAL) : le filtre SQL est donc volontairement grossier, et c'est
 *     le classement en mémoire qui rattrape « creme » → « Crème ».
 *  4. **L'archivé reste dehors** (`deleted_at`), sinon on propose d'ajouter un aliment retiré.
 *
 * S'y ajoute le comptage de bibliothèque, qui sert à **distinguer une base absente d'une recherche
 * infructueuse** : avant cette US, l'app affichait « Aucun aliment trouvé » dans les deux cas —
 * c'est très exactement ce qui a permis à la panne de synchro de passer inaperçue.
 */

import { COUNT_LIBRARY_FOODS, FOOD_SEARCH_SCAN_LIMIT, selectFoodSearch } from '../food-repository';
import { resetTestDb, seed, getTestDb } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: { language: 'fr', t: (k: string) => k },
  resolveDeviceLocale: () => 'fr',
  getAppLanguage: () => 'fr',
}));

/** Sème un aliment de bibliothèque avec sa traduction FR. */
function aliment(id: string, name: string, options: { deleted?: boolean; owner?: string | null } = {}) {
  seed('foods', [
    {
      id,
      owner_id: options.owner ?? null,
      source: options.owner ? 'custom' : 'library',
      category: 'other',
      kcal_per_100g: 100,
      deleted_at: options.deleted ? new Date().toISOString() : null,
    },
  ]);
  seed('food_translations', [{ id: `${id}-fr`, food_id: id, lang: 'fr', name }]);
}

/** Exécute la recherche et rend les noms, dans l'ordre du tri SQL. */
function cherche(terme: string, limit = FOOD_SEARCH_SCAN_LIMIT): string[] {
  const rows = getTestDb()
    .prepare(selectFoodSearch(true))
    .all('fr', `%${terme}%`, `${terme}%`, limit) as { name: string | null }[];
  return rows.map((r) => r.name ?? '');
}

beforeEach(() => {
  resetTestDb();
});

describe('selectFoodSearch — la requête bornée de l’écran plein', () => {
  it('🔴 trouve « saumon » — le cas exact de la recette du 17/09/2026', () => {
    aliment('f1', 'Saumon');
    aliment('f2', 'Saumon fumé');
    aliment('f3', 'Blanc de poulet');

    expect(cherche('saumon')).toEqual(['Saumon', 'Saumon fumé']);
  });

  it('🔴 met les débuts de nom devant, AVANT la coupe — sinon la liste rétrécit quand on précise', () => {
    // L'ordre alphabétique placerait « Chapelure de pain » en tête ; la pertinence, non.
    aliment('f1', 'Chapelure de pain');
    aliment('f2', 'Pain complet');
    aliment('f3', 'Mie de pain');

    expect(cherche('pain')[0]).toBe('Pain complet');
  });

  it('🔴 respecte la limite passée — c’est tout l’objet de la correction', () => {
    for (let i = 0; i < 30; i += 1) aliment(`f${i}`, `Pomme ${i}`);

    expect(cherche('pomme', 10)).toHaveLength(10);
  });

  it('garde les aliments perso au même titre que la bibliothèque', () => {
    aliment('f1', 'Saumon');
    aliment('f2', 'Saumon de mamie', { owner: 'user-1' });

    expect(cherche('saumon')).toHaveLength(2);
  });

  it('écarte l’archivé', () => {
    aliment('f1', 'Saumon');
    aliment('f2', 'Saumon retiré', { deleted: true });

    expect(cherche('saumon')).toEqual(['Saumon']);
  });

  it('ignore la casse', () => {
    aliment('f1', 'Saumon');

    expect(cherche('SAUMON')).toEqual(['Saumon']);
  });

  it('🔴 ne trouve PAS « creme » pour « Crème » — c’est la limite assumée du LIKE SQL', () => {
    aliment('f1', 'Crème fraîche');

    // Le filtre SQL est volontairement grossier : c'est `rankFoodMatches` (repli sur les accents
    // repliés) qui rattrape ce cas côté mémoire. Ce test verrouille le partage des rôles — si
    // quelqu'un « corrige » le SQL un jour, il doit le faire en connaissance de cause.
    expect(cherche('creme')).toEqual([]);
  });

  it('sans terme, rend la base bornée et triée par nom', () => {
    aliment('f1', 'Banane');
    aliment('f2', 'Abricot');

    const rows = getTestDb().prepare(selectFoodSearch(false)).all('fr', 10) as { name: string }[];
    expect(rows.map((r) => r.name)).toEqual(['Abricot', 'Banane']);
  });
});

describe('COUNT_LIBRARY_FOODS — distinguer « base absente » de « aucun résultat »', () => {
  const compte = (): number =>
    (getTestDb().prepare(COUNT_LIBRARY_FOODS).get() as { n: number }).n;

  it('🔴 vaut 0 quand la bibliothèque n’est pas descendue — l’état que l’app ne savait pas nommer', () => {
    expect(compte()).toBe(0);
  });

  it('compte la bibliothèque, et elle seule', () => {
    aliment('f1', 'Saumon');
    aliment('f2', 'Riz');
    aliment('f3', 'Mon aliment perso', { owner: 'user-1' });

    // Un aliment perso ne prouve PAS que la bibliothèque est arrivée : quelqu'un qui a créé deux
    // aliments à la main aurait un écran « tout va bien » sur une base vide.
    expect(compte()).toBe(2);
  });

  it('ne compte pas l’archivé', () => {
    aliment('f1', 'Saumon');
    aliment('f2', 'Retiré', { deleted: true });

    expect(compte()).toBe(1);
  });
});
