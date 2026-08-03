/**
 * US LAUNCHER-01 — `resolveHomeWidgetTexts` : résout tout le texte affiché **avant** de le passer
 * au widget natif (D4 — même partage des responsabilités que `notification-repository.ts` /
 * `notifications.ts` : l'orchestration résout, l'affichage ne fait que peindre).
 */

import { resolveHomeWidgetTexts } from '../home-widget-texts';
import type { HomeWidgetSnapshot } from '../home-widget-data';

const t = ((key: string, opts?: Record<string, unknown>) => {
  const dict: Record<string, string> = {
    'homeWidget.noSession': 'Ouvre l’app pour voir tes stats',
    'homeWidget.openCta': 'Toucher pour ouvrir Wellness',
    'homeWidget.streakLabel': 'Série',
    'homeWidget.todayLabel': 'Aujourd’hui',
    'homeWidget.restLabel': 'Repos aujourd’hui',
    'homeWidget.kcalLabel': 'Restant',
    'pillars.strength': 'Musculation',
    'pillars.running': 'Course',
  };
  if (key === 'homeWidget.streakValue') return `🔥 ${opts?.count} jour(s)`;
  if (key === 'homeWidget.kcalValue') return `${opts?.kcal} kcal`;
  return dict[key] ?? key;
}) as never;

describe('resolveHomeWidgetTexts', () => {
  it('D10 — no-session : seuls les deux textes de repli sont résolus', () => {
    const snapshot: HomeWidgetSnapshot = {
      authState: 'no-session',
      streak: 0,
      todaySession: null,
      kcalRemaining: null,
    };

    expect(resolveHomeWidgetTexts(snapshot, t)).toEqual({
      authState: 'no-session',
      noSessionText: 'Ouvre l’app pour voir tes stats',
      openCta: 'Toucher pour ouvrir Wellness',
    });
  });

  it('D6 — todaySession null (piliers masqués) → sessionText et sessionSubtitle null', () => {
    const snapshot: HomeWidgetSnapshot = {
      authState: 'ready',
      streak: 5,
      todaySession: null,
      kcalRemaining: null,
    };

    const texts = resolveHomeWidgetTexts(snapshot, t);

    expect(texts.authState).toBe('ready');
    if (texts.authState !== 'ready') throw new Error('unreachable');
    expect(texts.sessionText).toBeNull();
    expect(texts.sessionSubtitle).toBeNull();
    expect(texts.kcalValue).toBeNull();
  });

  it('repos → sessionText = libellé repos, pas de sous-titre de pilier', () => {
    const snapshot: HomeWidgetSnapshot = {
      authState: 'ready',
      streak: 5,
      todaySession: { kind: 'rest' },
      kcalRemaining: 1200,
    };

    const texts = resolveHomeWidgetTexts(snapshot, t);
    if (texts.authState !== 'ready') throw new Error('unreachable');

    expect(texts.sessionText).toBe('Repos aujourd’hui');
    expect(texts.sessionSubtitle).toBeNull();
  });

  it('séance prévue → nom de la séance + sous-titre = pilier traduit', () => {
    const snapshot: HomeWidgetSnapshot = {
      authState: 'ready',
      streak: 12,
      todaySession: { kind: 'session', pillar: 'strength', name: 'Full Body B' },
      kcalRemaining: 1240,
    };

    const texts = resolveHomeWidgetTexts(snapshot, t);
    if (texts.authState !== 'ready') throw new Error('unreachable');

    expect(texts.sessionText).toBe('Full Body B');
    expect(texts.sessionSubtitle).toBe('Musculation');
    expect(texts.streakValue).toBe('🔥 12 jour(s)');
    expect(texts.kcalValue).toBe('1240 kcal');
  });

  it('kcal arrondi (pas de décimales affichées)', () => {
    const snapshot: HomeWidgetSnapshot = {
      authState: 'ready',
      streak: 0,
      todaySession: { kind: 'rest' },
      kcalRemaining: 1239.6,
    };

    const texts = resolveHomeWidgetTexts(snapshot, t);
    if (texts.authState !== 'ready') throw new Error('unreachable');

    expect(texts.kcalValue).toBe('1240 kcal');
  });
});
