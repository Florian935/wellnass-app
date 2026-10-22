/**
 * US CIBLE-01 — la pastille de bonus d'un jour du planning repas (spec §11, C14), avec les **vraies**
 * traductions FR et EN : un libellé et une icône par origine du bonus, à la même place, dans le même style.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { MealConfigItem, MealPlanBonusKind } from '@wellness/shared';

import i18n from '@/i18n';
import { MealPlanDayCard } from '@/components/nutrition/MealPlanDayCard';

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      surface: '#fffaf2',
      border: '#ece0cd',
      accent: '#b14f2b',
      accentText: '#ffffff',
      track: '#eee',
      success: '#0a0',
      warn: '#fff4dd',
      warnBorder: '#f0d8a8',
      warnText: '#8a6419',
    },
  }),
}));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});

const CONFIG: MealConfigItem[] = [{ key: 'lunch', label: null }];

const card = (kind: MealPlanBonusKind | null, kcal: number) =>
  render(
    <MealPlanDayCard
      dayKey="2026-10-08"
      dayLabel="Jeudi 8"
      isToday
      entries={[]}
      mealConfig={CONFIG}
      mealLabels={{ lunch: 'Déjeuner' }}
      targetKcal={2659}
      trainingBonusKcal={kcal}
      bonusKind={kind}
      onAdd={jest.fn()}
      onConsume={jest.fn()}
      onUndoConsume={jest.fn()}
      onRemove={jest.fn()}
    />,
  );

const CASES: { kind: MealPlanBonusKind; kcal: number; icon: string; fr: string; en: string }[] = [
  { kind: 'planned', kcal: 300, icon: 'barbell-outline', fr: 'Séance prévue — objectif +300 kcal', en: 'Workout planned — target +300 kcal' },
  { kind: 'done', kcal: 300, icon: 'barbell-outline', fr: 'Jour d’entraînement — objectif +300 kcal', en: 'Training day — target +300 kcal' },
  { kind: 'run', kcal: 657, icon: 'walk-outline', fr: 'Course faite — objectif +657 kcal', en: 'Run done — target +657 kcal' },
  { kind: 'energy', kcal: 500, icon: 'flame-outline', fr: 'Dépense du jour — objectif +500 kcal', en: 'Energy used — target +500 kcal' },
  { kind: 'energyLater', kcal: 0, icon: 'flame-outline', fr: 'Séance prévue — sa dépense s’ajoutera', en: 'Workout planned — its energy use will be added' },
];

/** L'apostrophe des locales est droite ; le test l'écrit typographique pour la lisibilité. */
const straight = (text: string) => text.replace(/’/g, "'");

describe.each(['fr', 'en'] as const)('en %s', (lang) => {
  beforeAll(async () => {
    await i18n.changeLanguage(lang);
  });
  afterAll(async () => {
    await i18n.changeLanguage('fr');
  });

  it.each(CASES)('$kind : son libellé et son icône', async (c) => {
    await card(c.kind, c.kcal);
    expect(screen.getByText(straight(c[lang]))).toBeTruthy();
    expect(screen.getByText(`icone-${c.icon}`)).toBeTruthy();
  });

  it('aucune origine, aucun bonus : pas de pastille', async () => {
    await card(null, 0);
    expect(screen.queryByText(/icone-(barbell|walk|flame)-outline/)).toBeNull();
  });
});
