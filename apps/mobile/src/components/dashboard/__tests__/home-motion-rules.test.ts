/**
 * US ACCUEIL-09 — garde de source de la règle R2 de DASH-01 sur l'accueil : **un seul élément vivant
 * au repos**, les lueurs d'Aurore (`AuroraGlows`).
 *
 * Toute autre boucle (`withRepeat`, `Breathe`, un halo qui respire) posée sur l'accueil ferait deux
 * choses qui bougent sans qu'on ait rien touché — l'œil ne saurait plus laquelle regarder, et la
 * batterie paierait pour un décor. Les animations des gestes (cadrans, ligne cochée, carte, visages,
 * feuille, toast) jouent une fois, en réponse à quelque chose : elles ne sont pas concernées.
 *
 * Le test lit les sources, comme `pillar-identity.test.ts` : la règle porte sur ce qui est écrit, pas
 * sur un rendu qu'un mock de Reanimated rendrait immobile de toute façon.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..');
const DASHBOARD = join(ROOT, 'components', 'dashboard');

/** Les sources qui composent l'accueil : l'écran, et les composants du dossier `dashboard`. */
const sources = [
  join(ROOT, 'app', '(tabs)', 'index.tsx'),
  ...readdirSync(DASHBOARD)
    .filter((name) => name.endsWith('.tsx'))
    .map((name) => join(DASHBOARD, name)),
];

const LOOP = /withRepeat\(|<Breathe\b|\bbreathe\b(?!\s*=\s*\{?false)/;

it.each(sources.map((path) => [path.slice(ROOT.length + 1), path]))(
  '🔴 %s ne pose aucune boucle : les lueurs sont le seul élément vivant au repos',
  (_name, path) => {
    const code = readFileSync(path, 'utf8')
      // Les commentaires peuvent parler de souffle : seul le code compte.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(LOOP);
  },
);

it('les lueurs, elles, respirent — et s’arrêtent hors focus (R4)', () => {
  const glows = readFileSync(join(ROOT, 'components', 'stage', 'matter', 'AuroraGlows.tsx'), 'utf8');
  expect(glows).toMatch(/withRepeat\(/);
  const stage = readFileSync(join(DASHBOARD, 'HomeStage.tsx'), 'utf8');
  expect(stage).toMatch(/useLoopActive\('home'\)/);
});
