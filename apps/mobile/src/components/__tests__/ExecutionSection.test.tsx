/**
 * ExecutionSection.test.tsx — section « Exécution » de l'écran Progression (US EXEC-01).
 *
 * Niveau 3 : les **états** de la section, qu'aucun test de logique pure ne voit.
 *
 * Ce qui est vérifié, et pourquoi chacun compte :
 *  - la section **n'existe pas** tant qu'aucune des 4 analyses n'a de quoi parler. C'est le test le
 *    plus important du fichier : l'écran Progression était **déjà au seuil de repli d'ADR-007** avant
 *    cette US, et c'est ce silence qui rend l'ajout acceptable. Une régression ici ne casserait rien
 *    de visible — elle ajouterait juste une section vide à un écran saturé, ce que personne ne
 *    remarquerait en recette ;
 *  - chaque analyse se tait **individuellement** : trois muettes ne doivent pas emporter la quatrième ;
 *  - le taux d'exécution se tait pendant une **période « vie réelle »** (VIE-01, spec D3) — c'est le
 *    seul des quatre qui puisse se lire comme un reproche, et les trois autres doivent rester ;
 *  - chaque chiffre porte **sa base** (spec R2) : « 94 % » sans « sur 87 séries » est une affirmation
 *    nue, et c'est précisément ce que le lot s'interdit.
 */

import { act, fireEvent, render } from '@testing-library/react-native';

import { ExecutionSection } from '../progress/ExecutionSection';

const mockCompliance = jest.fn();
const mockDuration = jest.fn();
const mockMix = jest.fn();
const mockNeglected = jest.fn();
const mockRealLife = jest.fn();

jest.mock('@/data/repositories/records-repository', () => ({
  useExecutionCompliance: () => mockCompliance(),
  useSessionDurationStats: () => mockDuration(),
  useSetTypeMix: () => mockMix(),
  useNeglectedFavorites: () => mockNeglected(),
}));

jest.mock('@/data/repositories/real-life-repository', () => ({
  useRealLifeState: () => mockRealLife(),
}));

jest.mock('react-i18next', () => ({
  // Les clés sont rendues telles quelles, avec leurs nombres interpolés : c'est ce qui permet de
  // vérifier qu'un chiffre est accompagné de sa base sans dépendre des formulations FR.
  //
  // ⚠️ Le second argument de `t` est **tantôt un objet d'options, tantôt une chaîne de repli** —
  // la section utilise les deux formes (`t('...setType.normal', 'normal')` pour un type inconnu).
  // Un mock qui suppose l'objet plante sur la seconde.
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown> | string) => {
      if (typeof opts !== 'object' || opts === null) return key;
      if ('count' in opts) return `${key}:${String(opts.count)}`;
      if ('minutes' in opts) return `${key}:${String(opts.minutes)}`;
      return key;
    },
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: jest.fn(() => ({
    scheme: 'light',
    colors: {
      text: '#33291f',
      textMuted: '#786a59',
      background: '#f7eede',
      surface: '#fffaf2',
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      accent: '#b14f2b',
    },
  })),
}));

/** Tout muet : l'état d'un compte neuf. */
function silence() {
  mockCompliance.mockReturnValue({ compliance: null, isLoading: false });
  mockDuration.mockReturnValue({ duration: null, isLoading: false });
  mockMix.mockReturnValue({ mix: null, isLoading: false });
  mockNeglected.mockReturnValue({ neglected: [], isLoading: false });
  mockRealLife.mockReturnValue({ inRealLifePeriod: false });
}


/**
 * Déplie la section. `CollapsibleCard` **ne monte ses enfants qu'une fois déplié**, et son en-tête est
 * un `Pressable` portant `accessibilityLabel={title}` — c'est donc **le label** qu'il faut cibler :
 * presser le `<Text>` interne ne remonte pas jusqu'au gestionnaire.
 *
 * ⚠️ `await act` obligatoire : le `setState` du repli ne se reflète dans l'arbre qu'au tour de boucle
 * suivant. Sans lui, l'assertion porte sur la version REPLIÉE et échoue en annonçant un texte
 * introuvable — piège documenté en §3.6 de strategie-tests.md, et rencontré en écrivant ce fichier.
 */
async function expand(getByLabelText: (t: string) => unknown) {
  await act(async () => {
    fireEvent.press(getByLabelText('progress.execution.title') as never);
  });
}

const COMPLIANCE = {
  loadRatio: 0.94,
  loadSetCount: 87,
  repsRatio: 1.01,
  repsSetCount: 62,
  sessionCount: 12,
};

beforeEach(() => {
  jest.clearAllMocks();
  silence();
});

describe('ExecutionSection — le silence (spec R3, ADR-007)', () => {
  it('🔴 ne rend RIEN quand les quatre analyses se taisent', async () => {
    // Le test qui protège l'écran : un compte neuf ne doit voir aucune section de plus qu'avant.
    const { toJSON } = await render(<ExecutionSection />);
    expect(toJSON()).toBeNull();
  });

  it('ne rend rien pendant le chargement — pas de section qui clignote', async () => {
    mockCompliance.mockReturnValue({ compliance: COMPLIANCE, isLoading: true });
    const { toJSON } = await render(<ExecutionSection />);
    expect(toJSON()).toBeNull();
  });

  it('se tait quand le moteur rend un objet SANS aucun ratio calculable', async () => {
    // Le moteur rend un objet dès qu'il a assez de séances (il porte `sessionCount`), même si les
    // deux taux sont nuls. C'est à l'écran de constater qu'il n'a aucun chiffre à montrer.
    mockCompliance.mockReturnValue({
      compliance: { loadRatio: null, loadSetCount: 0, repsRatio: null, repsSetCount: 0, sessionCount: 5 },
      isLoading: false,
    });
    const { toJSON } = await render(<ExecutionSection />);
    expect(toJSON()).toBeNull();
  });
});

describe('ExecutionSection — chaque analyse se tait seule', () => {
  it('rend la section pour le seul taux d’exécution', async () => {
    mockCompliance.mockReturnValue({ compliance: COMPLIANCE, isLoading: false });
    const { toJSON } = await render(<ExecutionSection />);
    expect(toJSON()).not.toBeNull();
  });

  it('rend la section pour la seule durée', async () => {
    mockDuration.mockReturnValue({
      duration: { medianSeconds: 3120, trendSeconds: 360, sessionCount: 12, excludedCount: 0 },
      isLoading: false,
    });
    const { toJSON } = await render(<ExecutionSection />);
    expect(toJSON()).not.toBeNull();
  });

  it('rend la section pour les seuls types de série', async () => {
    mockMix.mockReturnValue({
      mix: [{ setType: 'normal', count: 30, percent: 100 }],
      isLoading: false,
    });
    const { toJSON } = await render(<ExecutionSection />);
    expect(toJSON()).not.toBeNull();
  });

  it('rend la section pour les seuls délaissés', async () => {
    mockNeglected.mockReturnValue({
      neglected: [{ exerciseId: 'a', name: 'Rowing barre', weeksSince: 7, neverPracticed: false }],
      isLoading: false,
    });
    const { getByText, getByLabelText } = await render(<ExecutionSection />);
    await expand(getByLabelText);
    expect(getByText('Rowing barre')).toBeTruthy();
  });
});

describe('ExecutionSection — les chiffres portent leur base (spec R2)', () => {
  it('affiche le nombre de séries ET le nombre de séances', async () => {
    mockCompliance.mockReturnValue({ compliance: COMPLIANCE, isLoading: false });
    const { getByText, getByLabelText } = await render(<ExecutionSection />);
    await expand(getByLabelText);

    // Les deux dénominateurs de séries, distincts par nature (R6), et la base en séances.
    expect(getByText('progress.execution.compliance.basisSets:87')).toBeTruthy();
    expect(getByText('progress.execution.compliance.basisSets:62')).toBeTruthy();
    expect(getByText('progress.execution.compliance.basis:12')).toBeTruthy();
  });

  it('affiche un taux > 100 % tel quel — dépasser n’est pas une anomalie', async () => {
    mockCompliance.mockReturnValue({
      compliance: { ...COMPLIANCE, loadRatio: 1.12 },
      isLoading: false,
    });
    const { getByText, getByLabelText } = await render(<ExecutionSection />);
    await expand(getByLabelText);
    expect(getByText('112 %')).toBeTruthy();
  });

  it('dit combien de séances ont été écartées, quand il y en a (spec R10)', async () => {
    mockDuration.mockReturnValue({
      duration: { medianSeconds: 3120, trendSeconds: 0, sessionCount: 12, excludedCount: 2 },
      isLoading: false,
    });
    const { getByText, getByLabelText } = await render(<ExecutionSection />);
    await expand(getByLabelText);
    expect(getByText('progress.execution.duration.excluded:2')).toBeTruthy();
  });

  it('ne dit rien des écartées quand il n’y en a aucune', async () => {
    mockDuration.mockReturnValue({
      duration: { medianSeconds: 3120, trendSeconds: 0, sessionCount: 12, excludedCount: 0 },
      isLoading: false,
    });
    const { queryByText, getByLabelText } = await render(<ExecutionSection />);
    await expand(getByLabelText);
    expect(queryByText('progress.execution.duration.excluded:0')).toBeNull();
  });
});

describe('ExecutionSection — période « vie réelle » (VIE-01, spec D3)', () => {
  beforeEach(() => {
    mockRealLife.mockReturnValue({ inRealLifePeriod: true });
    mockCompliance.mockReturnValue({ compliance: COMPLIANCE, isLoading: false });
  });

  it('🔴 fait taire le taux d’exécution — « tu suis ton programme à 60 % » est un reproche déguisé', async () => {
    const { toJSON } = await render(<ExecutionSection />);
    // Seul le taux était disponible : la section entière disparaît donc.
    expect(toJSON()).toBeNull();
  });

  it('garde les trois autres analyses — elles constatent sans reprocher', async () => {
    mockMix.mockReturnValue({
      mix: [{ setType: 'normal', count: 30, percent: 100 }],
      isLoading: false,
    });
    const { getByText, queryByText, getByLabelText } = await render(<ExecutionSection />);
    await expand(getByLabelText);

    expect(getByText('progress.execution.setTypes.title')).toBeTruthy();
    expect(queryByText('progress.execution.compliance.basis:12')).toBeNull();
  });
});
