/**
 * StrengthSection.test.tsx — section « Force » de l'écran Progression (US MUSCPWR-01).
 *
 * Niveau 3 : les **états** de la section, qu'aucun test de logique pure ne voit.
 *
 * Ce qui est vérifié, et pourquoi :
 *  - la section **n'existe pas** tant que rien n'est calculable (ADR-007, décision D4). C'est le
 *    test le plus important : ce module ne sert qu'aux pratiquants de force et ne doit rien coûter
 *    aux autres — or une section vide coûte de la place et de l'attention ;
 *  - elle est **repliée par défaut** (l'écran compte déjà cinq sections) ;
 *  - chaque indisponibilité **s'explique** au lieu d'afficher « — » : sans sexe (R6), sans pesée,
 *    total incomplet (R11), projection sans matière (R8).
 */

import { act, fireEvent, render } from '@testing-library/react-native';
import type { StrengthSectionData } from '@/data/repositories/strength-repository';
import { StrengthSection } from '../strength/StrengthSection';

const mockUseStrengthSection = jest.fn();
jest.mock('@/data/repositories/strength-repository', () => ({
  useStrengthSection: (...args: unknown[]) => mockUseStrengthSection(...args),
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
      borderStrong: '#90897d',
      accent: '#b14f2b',
      accentText: '#ffffff',
      success: '#66714b',
      danger: '#b23b2e',
      warn: '#f7ead6',
      warnBorder: '#e9cfa0',
      warnText: '#8a6419',
    },
  })),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key} ${JSON.stringify(opts)}` : key,
    i18n: { language: 'fr' },
  }),
}));

/** Données complètes : les trois analyses calculables. */
function data(over: Partial<StrengthSectionData> = {}): StrengthSectionData {
  return {
    lifts: [
      { lift: 'squat', exerciseId: 'ex-s', name: 'Squat', archived: false },
      { lift: 'bench', exerciseId: 'ex-b', name: 'Développé couché', archived: false },
      { lift: 'deadlift', exerciseId: 'ex-d', name: 'Soulevé de terre', archived: false },
    ],
    oneRmByLift: { squat: 195, bench: 122.5, deadlift: 195 },
    total: { totalKg: 512.5, missing: [] },
    history: [
      { date: '2026-01-01T10:00:00.000Z', totalKg: 480 },
      { date: '2026-02-01T10:00:00.000Z', totalKg: 495 },
      { date: '2026-03-15T10:00:00.000Z', totalKg: 512.5 },
    ],
    bodyweight: { logDate: '2026-03-14', weightKg: 82.4 },
    sex: 'male',
    isLoading: false,
    ...over,
  };
}

async function setup(over: Partial<StrengthSectionData> = {}) {
  mockUseStrengthSection.mockReturnValue(data(over));
  return render(<StrengthSection />);
}

beforeEach(() => {
  mockUseStrengthSection.mockReset();
  mockPush.mockClear();
});

describe('StrengthSection — présence conditionnelle (D4)', () => {
  it('ne rend RIEN tant qu’aucun mouvement n’est désigné et qu’aucun total n’existe', async () => {
    // Le test le plus important : quelqu'un qui fait du renforcement général ne doit pas voir ce
    // module. Pas une section vide, pas un « — », pas d'invitation permanente.
    const { toJSON, getByLabelText } = await setup({
      lifts: [
        { lift: 'squat', exerciseId: null, name: null, archived: false },
        { lift: 'bench', exerciseId: null, name: null, archived: false },
        { lift: 'deadlift', exerciseId: null, name: null, archived: false },
      ],
      oneRmByLift: { squat: null, bench: null, deadlift: null },
      total: { totalKg: null, missing: ['squat', 'bench', 'deadlift'] },
      history: [],
      bodyweight: null,
    });
    expect(toJSON()).toBeNull();
  });

  it('ne rend rien pendant le chargement — jamais un squelette qui clignote', async () => {
    const { toJSON } = await setup({ isLoading: true });
    expect(toJSON()).toBeNull();
  });

  it('apparaît dès qu’un mouvement est désigné, même sans total complet', async () => {
    const { getByText } = await setup({
      lifts: [
        { lift: 'squat', exerciseId: 'ex-s', name: 'Squat', archived: false },
        { lift: 'bench', exerciseId: null, name: null, archived: false },
        { lift: 'deadlift', exerciseId: null, name: null, archived: false },
      ],
      oneRmByLift: { squat: 195, bench: null, deadlift: null },
      total: { totalKg: null, missing: ['bench', 'deadlift'] },
      history: [],
    });
    expect(getByText('strength.section.title')).toBeTruthy();
  });

  it('est REPLIÉE par défaut : le détail n’est pas monté', async () => {
    // L'écran Progression compte déjà cinq sections (ADR-007 : au-delà de ~4-5, repliable).
    const { queryByText, getByText } = await setup();
    expect(getByText('strength.section.title')).toBeTruthy();
    expect(queryByText('strength.dots.title')).toBeNull();
  });

  it('affiche le total en résumé, visible sans déplier', async () => {
    const { getByText } = await setup();
    expect(getByText(/strength\.sbd\.summary.*"total":513/)).toBeTruthy();
  });

  it('résume le nombre de mouvements manquants quand le total est incomplet', async () => {
    const { getByText } = await setup({
      total: { totalKg: null, missing: ['bench', 'deadlift'] },
    });
    expect(getByText(/strength\.sbd\.incomplete.*"count":2/)).toBeTruthy();
  });
});

describe('StrengthSection — contenu déplié', () => {
  /**
   * Déplie la section. `CollapsibleCard` ne monte ses enfants qu'une fois déplié, et son en-tête
   * est un `Pressable` portant `accessibilityLabel={title}` — c'est donc **le label** qu'il faut
   * cibler : presser le `<Text>` interne ne remonte pas jusqu'au gestionnaire.
   */
  const expand = async (getByLabelText: (t: string) => unknown) => {
    // ⚠️ `await act` obligatoire : le `setState` du repli ne se reflète dans l'arbre qu'au tour de
    // boucle suivant. Sans lui, l'assertion porte sur la version REPLIÉE et échoue en annonçant un
    // texte introuvable — piège documenté en §3.6 de strategie-tests.md.
    await act(async () => {
      fireEvent.press(getByLabelText('strength.section.title') as never);
    });
  };

  it('affiche le DOTS avec le poids et la DATE retenus (R7)', async () => {
    const { getByText, getByLabelText } = await setup();
    await expand(getByLabelText);

    // 512,5 kg à 82,4 kg pour un homme (valeur du calcul, cf. strength-dots.test.ts).
    expect(getByText('347.4')).toBeTruthy();
    // La date est affichée : sans elle, le score paraît sorti de nulle part.
    expect(getByText(/strength\.dots\.atBodyweight.*"date":"14\/03\/2026"/)).toBeTruthy();
  });

  it('explique l’absence de DOTS sans sexe renseigné, avec le chemin pour y remédier (R6)', async () => {
    const { getByText, queryByText, getByLabelText } = await setup({ sex: 'unspecified' });
    await expand(getByLabelText);

    expect(getByText('strength.dots.missingSex')).toBeTruthy();
    expect(getByText('strength.dots.completeProfile')).toBeTruthy();
    // Le total SBD, lui, ne dépend pas du sexe : il reste affiché.
    expect(queryByText('strength.sbd.title')).toBeTruthy();
  });

  it('explique l’absence de DOTS sans pesée', async () => {
    const { getByText, getByLabelText } = await setup({ bodyweight: null });
    await expand(getByLabelText);
    expect(getByText('strength.dots.missingWeight')).toBeTruthy();
  });

  it('affiche les trois mouvements et leur 1RM', async () => {
    const { getByText, getAllByText, getByLabelText } = await setup();
    await expand(getByLabelText);

    expect(getByText('Squat')).toBeTruthy();
    expect(getByText('Développé couché')).toBeTruthy();
    // Squat et soulevé de terre valent tous deux 195 kg dans la fixture : deux éléments attendus.
    expect(getAllByText(/strength\.sbd\.oneRm.*"value":"195"/)).toHaveLength(2);
    expect(getByText(/strength\.sbd\.oneRm.*"value":"122\.5"/)).toBeTruthy();
  });

  it('signale un exercice archivé au lieu de le faire disparaître (R12)', async () => {
    const { getByText, getByLabelText } = await setup({
      lifts: [
        { lift: 'squat', exerciseId: 'ex-s', name: 'Squat', archived: true },
        { lift: 'bench', exerciseId: 'ex-b', name: 'Développé couché', archived: false },
        { lift: 'deadlift', exerciseId: 'ex-d', name: 'Soulevé de terre', archived: false },
      ],
    });
    await expand(getByLabelText);
    expect(getByText('strength.sbd.archived')).toBeTruthy();
  });

  it('refuse un total partiel et dit combien il manque (R11)', async () => {
    const { getByText, queryByText, getByLabelText } = await setup({
      total: { totalKg: null, missing: ['deadlift'] },
      history: [],
    });
    await expand(getByLabelText);

    expect(getByText(/strength\.sbd\.missingLifts.*"count":1/)).toBeTruthy();
    // Pas de ligne « Total » : un total partiel n'est jamais présenté comme un total.
    expect(queryByText('strength.sbd.total')).toBeNull();
  });

  it('affiche la projection avec sa mention d’estimation (R9)', async () => {
    const { getByText, getByLabelText } = await setup();
    await expand(getByLabelText);

    expect(getByText(/strength\.projection\.value/)).toBeTruthy();
    expect(getByText('strength.projection.disclaimer')).toBeTruthy();
  });

  it('explique l’absence de projection en disant ce qui manque (R8)', async () => {
    const { getByText, getByLabelText } = await setup({
      history: [{ date: '2026-03-01T10:00:00.000Z', totalKg: 512.5 }],
    });
    await expand(getByLabelText);
    expect(getByText(/strength\.projection\.needPoints.*"count":2/)).toBeTruthy();
  });

  it('n’affiche aucune projection quand le total est incomplet', async () => {
    const { getByText, queryByText, getByLabelText } = await setup({
      total: { totalKg: null, missing: ['deadlift'] },
    });
    await expand(getByLabelText);
    expect(queryByText('strength.projection.title')).toBeNull();
  });

  it('mène à l’écran de désignation', async () => {
    const { getByText, getAllByLabelText, getByLabelText } = await setup();
    await expand(getByLabelText);

    fireEvent.press(getAllByLabelText('strength.sbd.designate')[0]!);
    expect(mockPush).toHaveBeenCalledWith('/strength-lifts');
  });
});
