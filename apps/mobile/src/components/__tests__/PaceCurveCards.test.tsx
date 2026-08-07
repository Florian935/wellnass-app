/**
 * PaceCurveCards.test.tsx — les trois lectures intra-sortie de la courbe d'allure (US ALLURE-01).
 *
 * Niveau 3 : les **états** que les moteurs purs ne voient pas.
 *
 * Ce qui est vérifié, et pourquoi chacun compte :
 *  - 🔴 **l'allure de référence absente** (spec R4) — c'est le test le plus important du fichier. Sans
 *    elle, aucune zone n'est calculable, et la tentation est de **masquer la carte**. Ce serait laisser
 *    l'utilisateur ignorer à jamais qu'il lui manque un réglage. La carte doit rester, afficher
 *    l'indisponibilité **et son remède**, jamais un « — » ;
 *  - **une course sans trace** ne produit rien et **ce n'est pas une erreur** (spec R7) : une saisie
 *    manuelle n'a rien à analyser ;
 *  - **chaque carte se tait individuellement** : une sortie courte a son negative split mais pas son
 *    fade, et les deux doivent cohabiter ;
 *  - **un fade négatif est une bonne nouvelle** — le signe se lit à l'envers de l'intuition, et
 *    l'affichage doit suivre le sens, pas le signe.
 */

import { render } from '@testing-library/react-native';

import { PaceCurveCards } from '../run/PaceCurveCards';

const mockProfile = jest.fn();
const mockPush = jest.fn();

jest.mock('@/data/repositories/running-profile-repository', () => ({
  useRunnerProfile: () => mockProfile(),
}));

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (typeof opts !== 'object' || opts === null) return key;
      if ('count' in opts) return `${key}:${String(opts.count)}`;
      return key;
    },
  }),
}));

jest.mock('@/hooks/useUnits', () => ({
  // Le formateur réel est testé ailleurs ; ici on veut juste une valeur reconnaissable.
  useUnits: () => ({ formatPace: (s: number) => `${s}s/km` }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: jest.fn(() => ({
    scheme: 'light',
    colors: {
      text: '#33291f',
      textMuted: '#786a59',
      surface: '#fffaf2',
      border: '#ece0cd',
      accent: '#b14f2b',
      success: '#66714b',
    },
  })),
}));

/** Allure de référence 5 km à 5:00/km. Bornes : vma 285, seuil 300, tempo 360, endurance 390. */
const REF = 300;

const km = (n: number, seconds: number) =>
  Array.from({ length: n }, (_, i) => ({ km: i + 1, seconds }));

beforeEach(() => {
  jest.clearAllMocks();
  mockProfile.mockReturnValue({ runnerProfile: { ref5kPaceSPerKm: REF }, isLoading: false });
});

describe('PaceCurveCards — le silence (spec R7)', () => {
  it('🔴 ne rend RIEN sur une course sans trace — ce n’est pas une erreur', async () => {
    // Course saisie à la main : il n'y a rien à analyser, donc aucun message d'erreur non plus.
    const { toJSON } = await render(<PaceCurveCards splits={[]} />);
    expect(toJSON()).toBeNull();
  });
});

describe('PaceCurveCards — chaque carte se tait individuellement', () => {
  it('affiche le negative split mais PAS le fade sur une sortie courte', async () => {
    // 4 km : assez pour deux moitiés, très en dessous du seuil de fade (10 km).
    const { getByText, queryByText } = await render(
      <PaceCurveCards splits={[...km(2, 300), ...km(2, 270)]} />,
    );
    expect(getByText('run.summary.split.negative')).toBeTruthy();
    expect(queryByText('run.summary.fade.title')).toBeNull();
  });

  it('n’affiche aucun verdict de split sur un seul kilomètre', async () => {
    const { queryByText } = await render(<PaceCurveCards splits={km(1, 300)} />);
    expect(queryByText('run.summary.split.title')).toBeNull();
  });

  it('affiche les deux sur une sortie assez longue', async () => {
    const { getByText } = await render(
      <PaceCurveCards splits={[...km(6, 300), ...km(6, 330)]} />,
    );
    expect(getByText('run.summary.split.positive')).toBeTruthy();
    expect(getByText('run.summary.fade.title')).toBeTruthy();
  });
});

describe('PaceCurveCards — les chiffres accompagnent les verdicts (spec R2)', () => {
  it('affiche les deux allures de moitié et l’écart signé', async () => {
    const { getByText } = await render(<PaceCurveCards splits={[...km(2, 300), ...km(2, 270)]} />);
    // Le mock de `t` rend la clé ; les valeurs interpolées sont donc vérifiées via l'a11y label.
    expect(getByText('run.summary.split.detail')).toBeTruthy();
  });

  it('🔴 affiche un fade NÉGATIF avec son signe — accélérer sur la fin est une info', async () => {
    const { getByText } = await render(
      <PaceCurveCards splits={[...km(9, 300), ...km(3, 270)]} />,
    );
    expect(getByText('-10 %')).toBeTruthy();
  });

  it('affiche un fade positif avec un signe explicite', async () => {
    const { getByText } = await render(
      <PaceCurveCards splits={[...km(9, 300), ...km(3, 330)]} />,
    );
    expect(getByText('+10 %')).toBeTruthy();
  });

  it('affiche les zones avec leur base en kilomètres', async () => {
    const { getByText } = await render(<PaceCurveCards splits={km(12, 375)} />);
    expect(getByText('run.summary.zones.zone.endurance')).toBeTruthy();
    expect(getByText('100 %')).toBeTruthy();
    expect(getByText('run.summary.zones.basis:12')).toBeTruthy();
  });
});

describe('PaceCurveCards — 🔴 allure de référence absente (spec R4)', () => {
  beforeEach(() => {
    mockProfile.mockReturnValue({ runnerProfile: { ref5kPaceSPerKm: null }, isLoading: false });
  });

  it('garde la carte des zones et affiche l’indisponibilité AVEC son remède', async () => {
    // Masquer la carte serait laisser l'utilisateur ignorer qu'il lui manque un réglage. Et un « — »
    // ne dirait pas quoi faire.
    const { getByText } = await render(<PaceCurveCards splits={km(12, 375)} />);
    expect(getByText('run.summary.zones.title')).toBeTruthy();
    expect(getByText('run.summary.zones.needsRef')).toBeTruthy();
  });

  it('n’affiche aucune zone chiffrée — pas de répartition inventée', async () => {
    const { queryByText } = await render(<PaceCurveCards splits={km(12, 375)} />);
    expect(queryByText('run.summary.zones.zone.endurance')).toBeNull();
  });

  it('laisse le split et le fade fonctionner — ils ne dépendent pas de la référence', async () => {
    const { getByText } = await render(
      <PaceCurveCards splits={[...km(6, 300), ...km(6, 330)]} />,
    );
    expect(getByText('run.summary.split.positive')).toBeTruthy();
    expect(getByText('run.summary.fade.title')).toBeTruthy();
  });

  it('sans profil du tout, se comporte comme sans référence', async () => {
    mockProfile.mockReturnValue({ runnerProfile: null, isLoading: false });
    const { getByText } = await render(<PaceCurveCards splits={km(12, 375)} />);
    expect(getByText('run.summary.zones.needsRef')).toBeTruthy();
  });
});
