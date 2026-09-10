/**
 * Vérifie la **parité FR / EN** des libellés de l'app mobile (décision G : bilingue dès le
 * lancement). Échoue si une clé existe d'un côté et pas de l'autre, ou si une valeur est vide.
 *
 * Écrit pendant l'US MUSCU-UX01 : la parité était une règle du CLAUDE.md que rien ne vérifiait, et
 * une clé oubliée en anglais ne se voit qu'en basculant la langue à la main. Utilisable seul :
 * `node scripts/check-i18n-parity.mjs`.
 */
import { readFileSync } from 'node:fs';

const FR = 'apps/mobile/src/i18n/locales/fr.json';
const EN = 'apps/mobile/src/i18n/locales/en.json';

/** Aplatit un objet de traductions en chemins pointés. */
function flatten(value, prefix = '') {
  if (value === null || typeof value !== 'object') return [[prefix, value]];
  return Object.entries(value).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

const fr = new Map(flatten(JSON.parse(readFileSync(FR, 'utf8'))));
const en = new Map(flatten(JSON.parse(readFileSync(EN, 'utf8'))));

/**
 * i18next choisit `_one` / `_other` selon la langue et le compte : une clé pluralisée n'a pas
 * forcément les mêmes suffixes dans les deux langues. On compare donc la **racine**.
 */
const stripPlural = (key) => key.replace(/_(zero|one|two|few|many|other)$/, '');
const roots = (map) => new Set([...map.keys()].map(stripPlural));

const frRoots = roots(fr);
const enRoots = roots(en);

const missingInEn = [...frRoots].filter((k) => !enRoots.has(k)).sort();
const missingInFr = [...enRoots].filter((k) => !frRoots.has(k)).sort();
const empty = [...fr, ...en].filter(([, v]) => typeof v === 'string' && v.trim() === '');

const show = (label, list) => {
  if (list.length === 0) return;
  console.error(`\n${label} (${list.length}) :`);
  for (const key of list.slice(0, 40)) console.error(`  ${key}`);
  if (list.length > 40) console.error(`  … et ${list.length - 40} autres`);
};

show('Clés présentes en FR, absentes en EN', missingInEn);
show('Clés présentes en EN, absentes en FR', missingInFr);
show(
  'Valeurs vides',
  empty.map(([k]) => k),
);

if (missingInEn.length || missingInFr.length || empty.length) {
  console.error('\n❌ Parité i18n rompue.');
  process.exit(1);
}
console.log(`✅ Parité i18n : ${frRoots.size} clés, FR et EN alignés.`);
