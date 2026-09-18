/**
 * GhostBand.test.tsx — la bande « fantôme » de l'écran de suivi (US FANT-01).
 *
 * Trois contrats, dans l'ordre des critères de recette :
 *  1. **sans fantôme, rien** — critère 1 : l'écran de suivi doit rester identique à avant ;
 *  2. l'écart est dit **en toutes lettres**, jamais par la seule couleur (CONF-07) ;
 *  3. l'unité suit le réglage — mètres ou yards (spec §7).
 *
 * Le calcul lui-même n'est pas retesté ici : il vit dans `run-ghost.ts`, pur et couvert par
 * 30 cas côté `@wellness/shared`.
 */
import { render } from '@testing-library/react-native';
import type { GhostGap } from '@wellness/shared';
import { GhostBand, formatGapDistance } from '../GhostBand';

jest.mock('@/hooks/useUnits', () => ({
  // `useUnits` tire `settings-repository`, donc l'initialisation i18n de l'app : on le coupe ici,
  // comme le font les autres tests de composants. Le formatage des unités est testé à part, sur
  // `formatGapDistance` (fonction pure exportée par le composant).
  useUnits: () => ({ system: 'metric' }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    scheme: 'light',
    colors: {
      text: '#33291f',
      textMuted: '#786a59',
      surface: '#fffaf2',
      border: '#ece0cd',
      accent: '#b14f2b',
      success: '#66714b',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Restitue la clé et ses valeurs : on teste ce qui est demandé à i18n, pas la traduction.
    t: (key: string, params?: Record<string, string>) =>
      params ? `${key}|${Object.values(params).join('|')}` : key,
    i18n: { language: 'fr' },
  }),
}));

const GHOST_DATE = '2026-08-25T18:00:00.000Z';

function gapOf(partial: Partial<GhostGap>): GhostGap {
  return { meters: 42, status: 'ahead', seconds: null, ...partial };
}

describe('GhostBand', () => {
  it('ne rend rien sans fantôme (critère de recette 1)', async () => {
    const { toJSON } = await render(<GhostBand gap={null} ghostDate={null} />);
    expect(toJSON()).toBeNull();
  });

  it('ne rend rien si la date du fantôme manque', async () => {
    const { toJSON } = await render(<GhostBand gap={gapOf({})} ghostDate={null} />);
    expect(toJSON()).toBeNull();
  });

  it('dit l’avance en toutes lettres, avec l’unité', async () => {
    const { getByText } = await render(<GhostBand gap={gapOf({})} ghostDate={GHOST_DATE} />);
    expect(getByText('running.ghost.ahead|42 m')).toBeTruthy();
  });

  it('dit le retard avec une valeur positive (le mot porte le signe)', async () => {
    const { getByText } = await render(
      <GhostBand gap={gapOf({ meters: -30, status: 'behind' })} ghostDate={GHOST_DATE} />,
    );
    expect(getByText('running.ghost.behind|30 m')).toBeTruthy();
  });

  it('annonce le coude à coude sans chiffre', async () => {
    const { getByText } = await render(
      <GhostBand gap={gapOf({ meters: 2, status: 'level' })} ghostDate={GHOST_DATE} />,
    );
    expect(getByText('running.ghost.level')).toBeTruthy();
  });

  it('dit que le fantôme est terminé, écart compris', async () => {
    const { getByText } = await render(
      <GhostBand gap={gapOf({ meters: 120, status: 'finished' })} ghostDate={GHOST_DATE} />,
    );
    expect(getByText('running.ghost.finished|running.ghost.ahead|120 m')).toBeTruthy();
  });

  it('affiche la conversion en secondes quand elle existe', async () => {
    const { getByText } = await render(
      <GhostBand gap={gapOf({ seconds: -12 })} ghostDate={GHOST_DATE} />,
    );
    expect(getByText('running.ghost.seconds|12')).toBeTruthy();
  });
});

describe('formatGapDistance (spec §7 — l’unité suit le réglage)', () => {
  it('mètres en métrique, valeur absolue', () => {
    expect(formatGapDistance(-42, 'metric')).toEqual({ value: '42', symbol: 'm' });
  });

  it('yards en impérial', () => {
    expect(formatGapDistance(100, 'imperial')).toEqual({ value: '109', symbol: 'yd' });
  });
});
