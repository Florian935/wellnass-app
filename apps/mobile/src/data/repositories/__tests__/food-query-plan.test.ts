/**
 * Le catalogue d'aliments sur les **vraies vues PowerSync** : aucune requête ne doit relire les
 * traductions, les favoris ou le journal **pour chaque aliment**.
 *
 * ── Le défaut (recette PRISME-01, 08/10/2026) ───────────────────────────────────────────────────
 * Sur le téléphone, chercher « riz » tournait sans fin, la saisie par liste ne reconnaissait plus
 * rien (« riz », « avocat », « yaourt nature » : « non reconnu »), et l'accord à Prisme mettait dix
 * minutes à s'enregistrer. Une seule cause : chaque requête du catalogue nommait l'aliment par
 * `LEFT JOIN food_translations`. Sur une vue PowerSync, SQLite n'utilise jamais d'index pour la
 * table de droite d'un `LEFT JOIN` : pour chacun des 3 244 aliments, les 6 488 traductions étaient
 * relues deux fois. **29 s sur PC**, des minutes sur un téléphone ; et la base locale n'a que
 * 5 connexions de lecture — trois frappes (« r », « ri », « riz ») et la saisie par liste suffisaient
 * à les occuper toutes, et toute autre lecture de l'app attendait derrière (dont celle de l'accord).
 *
 * Le harnais `sqlite-harness` ne peut pas le voir : ses tables sont de vraies tables. Ce test juge le
 * **plan** sur une base construite comme PowerSync construit la sienne (`powersync-views.ts`).
 */

import { ORDER_BY_NAME, SELECT_FAVORITE_FOODS, SELECT_FOODS, SELECT_RECENT_FOODS, selectDenseFoods, selectFoodSearch } from '../food-repository';
import { SELECT_HABIT_FOODS, selectCandidateSearch } from '../food-catalog-repository';
import { SELECT_FOOD_TO_PLAN } from '../meal-plan-repository';
import { createPowerSyncViewsDb, perRowRereads, queryPlan } from '@/test-utils/powersync-views';

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: { language: 'fr', t: (k: string) => k },
  resolveDeviceLocale: () => 'fr',
  getAppLanguage: () => 'fr',
}));

const WATCHED = ['food_translations', 'food_favorites', 'food_entries'] as const;

const QUERIES: [string, string][] = [
  ['tout le catalogue (saisie par liste, menu de la semaine)', `${SELECT_FOODS} ${ORDER_BY_NAME}`],
  ['un aliment par id (édition)', `${SELECT_FOODS} AND f.id = ? LIMIT 1`],
  ['la recherche de l’écran plein, avec un terme', selectFoodSearch(true)],
  ['la recherche de l’écran plein, sans terme', selectFoodSearch(false)],
  ['les favoris', SELECT_FAVORITE_FOODS],
  ['les récents', SELECT_RECENT_FOODS],
  ['le vivier des aliments denses', selectDenseFoods('protein')],
  ['la feuille d’ajout, avec un terme', selectCandidateSearch(true)],
  ['la feuille d’ajout, sans terme', selectCandidateSearch(false)],
  ['« tes habitudes »', SELECT_HABIT_FOODS],
  ['planifier un aliment', SELECT_FOOD_TO_PLAN],
];

describe('le catalogue d’aliments passe par les index — vues PowerSync (recette du 08/10/2026)', () => {
  const db = createPowerSyncViewsDb();

  it.each(QUERIES)('🔴 %s : rien n’est relu pour chaque aliment', (_label, sql) => {
    expect(perRowRereads(queryPlan(db, sql), WATCHED)).toEqual([]);
  });
});

describe('le banc lui-même', () => {
  const db = createPowerSyncViewsDb();

  it('voit la relecture d’un LEFT JOIN sur une vue — sinon le test ci-dessus ne prouverait rien', () => {
    const plan = queryPlan(
      db,
      `SELECT f.id FROM foods f LEFT JOIN food_translations t ON t.food_id = f.id AND t.lang = 'fr'`,
    );
    expect(perRowRereads(plan, WATCHED)).toHaveLength(1);
  });

  it('ne compte pas le passage unique sur la table pilote', () => {
    expect(perRowRereads(queryPlan(db, 'SELECT id FROM food_translations'), WATCHED)).toEqual([]);
  });
});
