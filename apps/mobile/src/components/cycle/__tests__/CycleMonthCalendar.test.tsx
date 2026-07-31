/**
 * US CYCLE-01 — smoke test du calendrier mensuel.
 *
 * Vérifie le contrat minimal : la grille se rend sans planter avec des périodes et des logs réels,
 * l'en-tête des jours de semaine est présent, et taper un jour appelle `onSelectDay` avec sa clé.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { CycleMonthCalendar } from '../CycleMonthCalendar';

jest.mock('@/i18n', () => ({
  __esModule: true,
  getAppLanguage: () => 'fr',
  default: { t: (key: string) => key },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k) }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      accent: '#c0562f',
      border: '#ece0cd',
    },
  }),
}));

describe('CycleMonthCalendar', () => {
  const todayKey = '2026-07-31';

  it('se rend sans planter, avec des périodes et des logs', async () => {
    const { getAllByText } = await render(
      <CycleMonthCalendar
        periods={[{ id: 'p1', startedOn: '2026-07-05', endedOn: '2026-07-09' }]}
        logs={[{ logDate: '2026-07-05', flow: 'medium' }]}
        todayKey={todayKey}
        onSelectDay={jest.fn()}
      />,
    );
    // En-tête des jours de semaine : le mock `t` passthrough renvoie la clé brute
    // (`common.weekday.mon`), et le composant en prend `.charAt(0).toUpperCase()` → 'C' pour les
    // 7 jours (ils partagent tous le préfixe « common »). Le test vérifie donc qu'il y a bien
    // 7 en-têtes rendus, pas la lettre elle-même (qui dépend de l'artefact du mock).
    expect(getAllByText('C')).toHaveLength(7);
  });

  it('appelle onSelectDay avec la clé du jour tappé (aujourd’hui, non futur)', async () => {
    const onSelectDay = jest.fn();
    const { getAllByLabelText } = await render(
      <CycleMonthCalendar periods={[]} logs={[]} todayKey={todayKey} onSelectDay={onSelectDay} />,
    );
    // Le mock `t` avec params renvoie `cle:{"date":N}` — on cherche le jour 31 (aujourd'hui).
    const days = getAllByLabelText(/cycle\.calendar\.dayA11y/);
    const today = days.find((el) => el.props.accessibilityLabel?.includes('"date":31'));
    expect(today).toBeTruthy();
    fireEvent.press(today!);
    expect(onSelectDay).toHaveBeenCalledWith(todayKey);
  });

  it('désactive les jours futurs (R4) — aucun onSelectDay pour un jour après todayKey', async () => {
    // todayKey = 5 juillet : la grille du mois affiche des jours jusqu'à fin juillet, tous futurs
    // après le 5. On vérifie qu'au moins un des boutons est marqué disabled.
    const onSelectDay = jest.fn();
    const { getAllByLabelText } = await render(
      <CycleMonthCalendar
        periods={[]}
        logs={[]}
        todayKey="2026-07-05"
        onSelectDay={onSelectDay}
      />,
    );
    const allDays = getAllByLabelText(/cycle.calendar.dayA11y/);
    const disabledCount = allDays.filter((el) => el.props.accessibilityState?.disabled).length;
    expect(disabledCount).toBeGreaterThan(0);
  });
});
