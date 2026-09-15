/**
 * Parité des clés FR ↔ EN.
 *
 * ── Pourquoi ce test n'existait pas, et pourquoi il aurait dû ────────────────────────────────────
 * L'anglais est **obligatoire au lancement** (décision de cadrage G : « le contenu doit être
 * bilingue dès la V1 […] à intégrer dans la charge de chaque version, pas en fin de projet »).
 * Rien ne le vérifiait : une clé ajoutée en français seulement passe tous les tests, tous les
 * linters, et ne se voit qu'en basculant l'app en anglais — c'est-à-dire en recette, ou jamais.
 *
 * Le symptôme est silencieux : i18next retombe sur la **clé brute**. L'écran affiche
 * `guidance.regimes.guided.label` au lieu d'un libellé, et seul un humain anglophone le remarque.
 *
 * ── Ce que le test ne fait pas ───────────────────────────────────────────────────────────────────
 * Il ne juge **pas la qualité** d'une traduction : une clé anglaise recopiée du français passe. Il
 * garantit seulement qu'aucune n'est absente, dans les deux sens — une clé anglaise orpheline est
 * tout aussi suspecte qu'une clé française non traduite.
 */

import en from '../locales/en.json';
import fr from '../locales/fr.json';

type Tree = { [key: string]: unknown };

/** Aplatit l'arbre en chemins pointés : `guidance.regimes.guided.label`. */
function flatten(node: Tree, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flatten(value as Tree, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

const frKeys = flatten(fr as Tree).sort();
const enKeys = flatten(en as Tree).sort();

describe('locales FR ↔ EN', () => {
  it('ne laisse aucune clé française sans équivalent anglais', () => {
    const missing = frKeys.filter((k) => !enKeys.includes(k));
    expect(missing).toEqual([]);
  });

  it('ne laisse aucune clé anglaise orpheline', () => {
    const extra = enKeys.filter((k) => !frKeys.includes(k));
    expect(extra).toEqual([]);
  });

  /**
   * Une chaîne vide passe la parité (la clé existe des deux côtés) mais affiche… rien. C'est
   * presque toujours un oubli — sauf quand c'est exactement l'intention.
   *
   * `coach.*.verdict.warmup` est vide **à dessein** : sur une série d'échauffement, le coach ne
   * commente pas. Toute autre clé vide est un défaut ; l'exception est nommée ici pour qu'elle
   * reste un choix visible, et non un trou qui se confondrait avec du bruit.
   */
  const INTENTIONALLY_EMPTY = ['coach.motivant.verdict.warmup', 'coach.sobre.verdict.warmup'];

  it.each([
    ['fr', fr as Tree, frKeys],
    ['en', en as Tree, enKeys],
  ])('%s n’a aucune valeur vide non documentée', (_lang, tree, keys) => {
    const read = (path: string): unknown =>
      path.split('.').reduce<unknown>((acc, part) => (acc as Tree | undefined)?.[part], tree);
    const empty = (keys as string[])
      .filter((k) => read(k) === '')
      .filter((k) => !INTENTIONALLY_EMPTY.includes(k));
    expect(empty).toEqual([]);
  });

  it('couvre les clés de GUID-01 dans les deux langues', () => {
    for (const key of [
      'guidance.regimes.guided.label',
      'guidance.regimes.assisted.preview',
      'guidance.regimes.autonomous.description',
      'guidance.safety.body',
      'guidance.derivedFromGoal',
      'trainingContext.sheetTitle',
      'strengthProfile.title',
      'goalConflict.rules.bulkVsCut.body',
      'onboarding.guidance.title',
    ]) {
      expect(frKeys).toContain(key);
      expect(enKeys).toContain(key);
    }
  });
});
