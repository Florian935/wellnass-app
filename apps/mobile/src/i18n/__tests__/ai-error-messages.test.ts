/**
 * US ACCES-IA — chaque échec de l'IA a son message, dans les deux familles d'écrans et les deux langues
 * (spec §14, critère 12).
 *
 * Les écrans de Prisme affichent `prisme.errors.<code>`, ceux du Labo IA (labo, résumé d'un dossier,
 * Conseil des trois) `aiLab.errors.<code>`. Un code sans message s'affiche en **clé brute** — et le test
 * de parité FR ↔ EN ne le voit pas, puisque la clé manque des deux côtés. C'était déjà le cas de trois
 * codes de PRISME-01 côté Labo IA (`not-allowed`, `adult-required`, `settings-missing`), trouvés en
 * relisant ACCES-IA.
 *
 * La liste des codes est lue dans `ai-client.ts` (`AI_ERROR_CODES`), pas recopiée : un code ajouté là
 * sans message fait échouer ce test.
 */

import en from '../locales/en.json';
import fr from '../locales/fr.json';
import { AI_ERROR_CODES } from '@/lib/ai/ai-client';

type Messages = Record<string, unknown>;

const families: [string, (locale: typeof fr) => Messages][] = [
  ['prisme.errors', (locale) => locale.prisme.errors as Messages],
  ['aiLab.errors', (locale) => locale.aiLab.errors as Messages],
];

describe.each([
  ['fr', fr],
  ['en', en],
])('messages d’échec de l’IA (%s)', (_lang, locale) => {
  it.each(families)('%s couvre chaque code de `AI_ERROR_CODES`', (_family, pick) => {
    const messages = pick(locale as typeof fr);
    const missing = AI_ERROR_CODES.filter((code) => {
      const text = messages[code];
      return typeof text !== 'string' || text.trim().length === 0;
    });

    expect(missing).toEqual([]);
  });
});
