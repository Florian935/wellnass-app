import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { usePreventRemove } from 'expo-router/react-navigation';
import { createBodyTrainingDocument, createBodyVisualDocument, createBodyVisualGoal, prepareBodyVisualSave, type BodyTrainingProgram } from '@wellness/shared';
import { useBodyVisual } from '@/data/repositories/body-visual-repository';
import { useBodyTraining, saveBodyTraining } from '@/data/repositories/body-training-repository';
import { useBodyTrainingProgram } from '@/data/repositories/body-training-program-repository';
import BodyTrainingScreen from '../body-training';

const mockPush = jest.fn();
const mockDispatch = jest.fn();
let mockUser = 'user-1';
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }), useNavigation: () => ({ dispatch: mockDispatch }) }));
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: jest.fn() }));
jest.mock('@/data/repositories/body-visual-repository', () => ({ useBodyVisual: jest.fn() }));
jest.mock('@/data/repositories/body-training-repository', () => ({ useBodyTraining: jest.fn(), saveBodyTraining: jest.fn() }));
jest.mock('@/data/repositories/body-training-program-repository', () => ({ useBodyTrainingProgram: jest.fn() }));
jest.mock('@/data/repositories/settings-repository', () => ({ useSettings: () => ({ settings: { units: 'metric' } }) }));
jest.mock('@/stores/auth-store', () => ({ useAuthStore: (selector: (state: unknown) => unknown) => selector({ session: { user: { id: mockUser } } }) }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light', colors: require('@/theme/colors').palettes.light }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'fr' }, t: (key: string, values?: Record<string, unknown>) => values?.count === undefined ? key : `${key}:${values.count}` }) }));

const source = useBodyTraining as jest.Mock;
const visual = useBodyVisual as jest.Mock;
const program = useBodyTrainingProgram as jest.Mock;
const save = saveBodyTraining as jest.Mock;
function visualDocument() {
  const doc = createBodyVisualDocument();
  doc.goal = createBodyVisualGoal(doc);
  doc.goal.emphasis.shoulders = 3;
  return prepareBodyVisualSave(doc, null, '2026-09-13T12:00:00.000Z');
}
const state = (document: unknown) => ({ document, raw: document ? JSON.stringify(document) : null, status: document ? 'ready' : 'empty', isLoading: false, error: null });
const tap = async (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const choose = async (zone: string) => fireEvent.press(screen.getByRole('checkbox', { name: `bodyShape.zones.${zone}` }));
const confirmExisting = () => {
  const doc = createBodyTrainingDocument(['arms'], visualDocument().goal!, '2026-09-13T12:01:00.000Z');
  source.mockReturnValue(state(doc));
  return doc;
};
beforeEach(() => {
  jest.clearAllMocks(); mockUser = 'user-1';
  visual.mockReturnValue(state(visualDocument())); source.mockReturnValue(state(null));
  program.mockReturnValue({ program: null, isLoading: false, error: null });
  save.mockImplementation(async priorities => priorities === null ? null : createBodyTrainingDocument(priorities, visual.mock.results.at(-1)!.value.document.goal, '2026-09-14T10:00:00.000Z'));
});
afterEach(() => jest.restoreAllMocks());

it('sans objectif propose de le créer et ne persiste rien', async () => {
  visual.mockReturnValue(state(null)); await render(<BodyTrainingScreen />);
  await tap('bodyTraining.createGoal');
  expect(mockPush).toHaveBeenCalledWith('/body-shape'); expect(save).not.toHaveBeenCalled();
  expect(screen.queryByRole('checkbox')).toBeNull();
});
it('suggère sans écrire, borne les choix puis confirme les deux snapshots', async () => {
  await render(<BodyTrainingScreen />);
  expect(screen.getByRole('checkbox', { name: 'bodyShape.zones.shoulders' }).props.accessibilityState.checked).toBe(true);
  await choose('arms'); await choose('back'); await choose('calves');
  expect(screen.getByRole('checkbox', { name: 'bodyShape.zones.calves' }).props.accessibilityState.checked).toBe(false);
  expect(save).not.toHaveBeenCalled(); await tap('bodyTraining.confirm');
  expect(save).toHaveBeenCalledWith(['shoulders', 'back', 'arms'], null, JSON.stringify(visualDocument()));
  expect(screen.getByText('bodyTraining.confirmed')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'bodyTraining.reload' })).toBeNull();
});
it('un conflit conserve le choix et une arrivée visuelle ne remplace pas le brouillon', async () => {
  await render(<BodyTrainingScreen />); await choose('arms');
  save.mockRejectedValue(Object.assign(new Error('conflict'), { code: 'conflict' }));
  await tap('bodyTraining.confirm');
  expect(screen.getByText('bodyTraining.errors.conflict')).toBeTruthy();
  const next = visualDocument(); next.goal!.emphasis.back = 4;
  visual.mockReturnValue(state(next)); await screen.rerender(<BodyTrainingScreen />);
  expect(screen.getByRole('checkbox', { name: 'bodyShape.zones.arms' }).props.accessibilityState.checked).toBe(true);
  expect(screen.getByRole('button', { name: 'bodyTraining.confirm' }).props.accessibilityState.disabled).toBe(true);
});
it('protège le retour sale et Annuler rétablit la sélection confirmée', async () => {
  confirmExisting(); const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render(<BodyTrainingScreen />); await tap('bodyTraining.modify'); await choose('shoulders');
  const [blocked, callback] = (usePreventRemove as jest.Mock).mock.calls.at(-1)!;
  expect(blocked).toBe(true);
  await act(async () => callback({ data: { action: { type: 'GO_BACK' } } }));
  expect(alert).toHaveBeenCalled(); expect(mockDispatch).not.toHaveBeenCalled();
  await tap('common.cancel'); expect(screen.queryByRole('checkbox')).toBeNull();
  expect(screen.getByText('bodyShape.zones.arms')).toBeTruthy();
});
it('efface seulement après confirmation et ignore le vieil écho de la valeur supprimée', async () => {
  const old = confirmExisting(); const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render(<BodyTrainingScreen />); await tap('bodyTraining.clear');
  expect(save).not.toHaveBeenCalled();
  await act(async () => { await alert.mock.calls.at(-1)![2]![1]!.onPress!(); });
  expect(save).toHaveBeenCalledWith(null, JSON.stringify(old), JSON.stringify(visualDocument()));
  expect(screen.queryByText('bodyTraining.confirmed')).toBeNull();
  expect(screen.queryByRole('button', { name: 'bodyTraining.reload' })).toBeNull();
  source.mockReturnValue(state(null)); await screen.rerender(<BodyTrainingScreen />);
  expect(screen.getByRole('button', { name: 'bodyTraining.confirm' }).props.accessibilityState.disabled).toBe(false);
});
it('garde les priorités lisibles et effaçables lorsque le goal a disparu', async () => {
  confirmExisting(); visual.mockReturnValue(state(createBodyVisualDocument()));
  await render(<BodyTrainingScreen />);
  expect(screen.getByText('bodyTraining.goalChanged')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'bodyTraining.clear' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'bodyTraining.createGoal' })).toBeTruthy();
});
it.each(['invalid', 'unsupported'])('bloque une version %s au lieu de la remplacer', async status => {
  source.mockReturnValue({ ...state(null), status, raw: '{"version":99}' });
  await render(<BodyTrainingScreen />);
  expect(screen.getByText(`bodyTraining.${status}`)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'bodyTraining.confirm' })).toBeNull();
});
it('affiche le programme, nomme les sous-muscles et ouvre le contexte correct', async () => {
  confirmExisting();
  const data: BodyTrainingProgram = { id: 'p', name: 'Programme test', sessions: [{ id: 's', name: 'Séance A', plans: [
    { id: 'ep', exerciseId: 'e', exerciseName: 'Curl', setType: 'bodyweight', targetSets: 3, musclePrimary: 'arms', musclesFine: ['biceps'], musclesSecondary: [] },
  ] }] };
  program.mockReturnValue({ program: data, isLoading: false, error: null });
  await render(<BodyTrainingScreen />);
  expect(screen.getByText('bodyTraining.exactSets:3')).toBeTruthy();
  expect(screen.getByText('bodyTraining.noFineMuscle')).toBeTruthy();
  await tap('bodyTraining.explore.biceps');
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/body', params: { muscle: 'biceps' } });
  await tap('bodyTraining.openProgram'); expect(mockPush).toHaveBeenCalledWith('/programs/p');
  expect(save).not.toHaveBeenCalled();
});
it('distingue une erreur du programme de son absence', async () => {
  confirmExisting(); program.mockReturnValue({ program: null, isLoading: false, error: new Error('read') });
  await render(<BodyTrainingScreen />);
  expect(screen.getByText('bodyTraining.programError')).toBeTruthy();
  expect(screen.queryByText('bodyTraining.noProgram')).toBeNull();
});
it('un changement de compte remonte un écran sans les choix de l’ancien compte', async () => {
  await render(<BodyTrainingScreen />); await choose('arms');
  mockUser = 'user-2'; visual.mockReturnValue(state(null));
  await screen.rerender(<BodyTrainingScreen />);
  expect(screen.queryByRole('checkbox')).toBeNull(); expect(save).not.toHaveBeenCalled();
});

it('bloque les appuis pendant la sauvegarde et attend l’écho local avant une nouvelle écriture', async () => {
  let resolve!: (value: unknown) => void;
  save.mockImplementation(() => new Promise(done => { resolve = done; }));
  await render(<BodyTrainingScreen />);
  await tap('bodyTraining.confirm');
  expect(screen.getByRole('button', { name: 'bodyTraining.saving' }).props.accessibilityState.disabled).toBe(true);
  await tap('bodyTraining.saving');
  expect(save).toHaveBeenCalledTimes(1);
  const next = createBodyTrainingDocument(['shoulders'], visualDocument().goal!, '2026-09-14T10:00:00.000Z');
  await act(async () => { resolve(next); });
  expect(screen.getByRole('button', { name: 'bodyTraining.clear' }).props.accessibilityState.disabled).toBe(true);
  source.mockReturnValue(state(next)); await screen.rerender(<BodyTrainingScreen />);
  expect(screen.getByRole('button', { name: 'bodyTraining.clear' }).props.accessibilityState.disabled).toBe(false);
});

it('conserve le brouillon pendant erreur/chargement puis exige un rechargement explicitement confirmé', async () => {
  await render(<BodyTrainingScreen />); await choose('arms');
  visual.mockReturnValue({ ...state(visualDocument()), isLoading: true, error: new Error('read') });
  await screen.rerender(<BodyTrainingScreen />);
  expect(screen.getByRole('checkbox', { name: 'bodyShape.zones.arms' }).props.accessibilityState.checked).toBe(true);
  expect(screen.getByRole('button', { name: 'bodyTraining.confirm' }).props.accessibilityState.disabled).toBe(true);
  const next = visualDocument(); next.goal!.emphasis = { ...next.goal!.emphasis, shoulders: 0, back: 4 };
  visual.mockReturnValue(state(next)); await screen.rerender(<BodyTrainingScreen />);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await tap('bodyTraining.reload');
  expect(screen.getByRole('checkbox', { name: 'bodyShape.zones.arms' }).props.accessibilityState.checked).toBe(true);
  await act(async () => alert.mock.calls.at(-1)![2]![1]!.onPress!());
  expect(screen.getByRole('checkbox', { name: 'bodyShape.zones.arms' }).props.accessibilityState.checked).toBe(false);
  expect(screen.getByRole('checkbox', { name: 'bodyShape.zones.back' }).props.accessibilityState.checked).toBe(true);
  await tap('bodyTraining.confirm');
  expect(save).toHaveBeenCalledWith(['back'], null, JSON.stringify(next));
});

it('suit un JSON équivalent sans perdre les choix et détecte un vrai changement de priorités', async () => {
  await render(<BodyTrainingScreen />); await choose('arms');
  const visualRaw = JSON.stringify(visualDocument(), null, 2);
  visual.mockReturnValue({ ...state(visualDocument()), raw: visualRaw });
  await screen.rerender(<BodyTrainingScreen />); await tap('bodyTraining.confirm');
  expect(save).toHaveBeenCalledWith(['shoulders', 'arms'], null, visualRaw);
  const changed = createBodyTrainingDocument(['back'], visualDocument().goal!, '2026-09-14T11:00:00.000Z');
  source.mockReturnValue(state(changed)); await screen.rerender(<BodyTrainingScreen />);
  expect(screen.getByRole('button', { name: 'bodyTraining.reload' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'bodyTraining.clear' }).props.accessibilityState.disabled).toBe(true);
});

it('un départ modifié seul ne périme pas les priorités mais un nouvel objectif oui', async () => {
  confirmExisting(); await render(<BodyTrainingScreen />);
  const next = visualDocument(); next.baseline.proportions.shoulders = 1;
  visual.mockReturnValue(state(next)); await screen.rerender(<BodyTrainingScreen />);
  expect(screen.queryByText('bodyTraining.goalChanged')).toBeNull();
  next.goal!.emphasis.arms = 2;
  visual.mockReturnValue(state(next)); await screen.rerender(<BodyTrainingScreen />);
  expect(screen.getByText('bodyTraining.goalChanged')).toBeTruthy();
});

it('annonce la nouvelle référence pendant la révision au lieu de présenter le dessin comme déjà confirmé', async () => {
  confirmExisting();
  const next = visualDocument(); next.goal!.emphasis.back = 3;
  visual.mockReturnValue(state(next)); await render(<BodyTrainingScreen />);
  expect(screen.getByText('bodyTraining.goalChangedHint')).toBeTruthy();
  await tap('bodyTraining.modify');
  expect(screen.queryByText('bodyTraining.goalChangedHint')).toBeNull();
  expect(screen.getByText('bodyTraining.reviewGoalHint')).toBeTruthy();
  expect(save).not.toHaveBeenCalled();
  await tap('bodyTraining.confirm');
  expect(save).toHaveBeenCalledWith(['arms'], expect.any(String), JSON.stringify(next));
});
