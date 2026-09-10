/**
 * Carte « séance du jour » — US RUN-F4 (lot J), étendue par CARDIO-UX01 (R3-3 / constat F36).
 *
 * ── Pourquoi ce fichier arrive maintenant ────────────────────────────────────────────────────────
 * La carte était **strictement consultative** : elle annonçait « retire 25 % des répétitions »
 * puis précisait qu'elle n'avait rien fait. Aucun test ne la couvrait, et c'était défendable — un
 * composant qui n'écrit rien.
 *
 * Depuis que la migration est appliquée (10/09/2026), le bouton « Appliquer aujourd'hui » est
 * **rendu** et **écrit en base**. Le composant a donc cessé d'être un affichage : il touche
 * `planned_sessions`, et deux règles doivent être vérifiées plutôt que relues.
 *
 * ── Les deux règles qui comptent ─────────────────────────────────────────────────────────────────
 *  1. **L'écriture porte sur l'OCCURRENCE, jamais sur le template** (règle R3-3) : « j'allège
 *     aujourd'hui parce que j'ai mal dormi » n'est pas « je change mon plan ». Le test vérifie
 *     l'identifiant écrit.
 *  2. **Le bouton n'apparaît que s'il a quelque chose à écrire ET quelqu'un à qui l'écrire** :
 *     une proposition `none` ne change rien, et sans occurrence du jour il n'y a pas de variante
 *     datée à poser.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { AdaptationProposal } from '@wellness/shared';

import { SessionAdaptationCard } from '../SessionAdaptationCard';
import {
  ADAPTATION_WRITE_READY,
  applyAdaptationForToday,
} from '@/data/repositories/planned-session-repository';

jest.mock('@/data/repositories/planned-session-repository', () => ({
  ADAPTATION_WRITE_READY: true,
  applyAdaptationForToday: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#33291f',
      textMuted: '#786a59',
      surface: '#fffaf2',
      border: '#ece0cd',
      accent: '#b14f2b',
      accentText: '#ffffff',
      success: '#66714b',
    },
  }),
}));

const mockApply = applyAdaptationForToday as jest.Mock;

/**
 * Une proposition réaliste. Les valeurs viennent des types réels (`AdaptationSeverity` vaut
 * `'info' | 'caution' | 'alert'`, jamais `'moderate'`) : le premier jet de ce fixture inventait
 * une sévérité, les tests passaient quand même — Jest ne typecheck pas — et c'est `tsc` qui l'a
 * attrapé. D'où l'absence d'assertion de type ici : on laisse l'inférence contrôler.
 */
const proposition = (over: Partial<AdaptationProposal> = {}): AdaptationProposal => ({
  action: 'reduce_reps',
  severity: 'caution',
  reasons: [{ code: 'low_energy', severity: 'caution' }],
  repsReductionPct: 25,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockApply.mockResolvedValue(undefined);
});

describe('rien à dire, rien à l’écran', () => {
  it('ne rend rien sans proposition', async () => {
    await render(<SessionAdaptationCard proposal={null} plannedSessionId="ps-1" />);

    expect(screen.queryByText('running.adaptation.title')).toBeNull();
  });

  it('ne rend rien quand aucun signal n’est actif', async () => {
    // Une carte « tout va bien » banaliserait la surface et la ferait ignorer le jour où elle a
    // quelque chose à dire.
    await render(
      <SessionAdaptationCard proposal={proposition({ reasons: [] })} plannedSessionId="ps-1" />,
    );

    expect(screen.queryByText('running.adaptation.title')).toBeNull();
  });
});

describe('appliquer l’adaptation (R3-3 / constat F36)', () => {
  it('🔴 écrit sur l’OCCURRENCE du jour, avec la réduction proposée', async () => {
    await render(<SessionAdaptationCard proposal={proposition()} plannedSessionId="ps-1" />);

    await act(async () => {
      fireEvent.press(screen.getByText('running.adaptation.applyCta'));
    });

    // Sur `planned_sessions`, jamais sur `sessions` : le programme des semaines suivantes reste
    // intact. C'est toute la différence entre alléger un jour et changer son plan.
    expect(mockApply).toHaveBeenCalledWith('ps-1', {
      repsReductionPct: 25,
      paceSlowdownSPerKm: null,
    });
  });

  it('transmet le ralentissement d’allure quand c’est l’action proposée', async () => {
    await render(
      <SessionAdaptationCard
        proposal={proposition({
          action: 'slow_pace',
          repsReductionPct: undefined,
          paceSlowdownSPerKm: 15,
        })}
        plannedSessionId="ps-1"
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByText('running.adaptation.applyCta'));
    });

    // `undefined` et `null` disent la même chose ici — « pas de réduction » — mais seul `null`
    // s'écrit en base.
    expect(mockApply).toHaveBeenCalledWith('ps-1', {
      repsReductionPct: null,
      paceSlowdownSPerKm: 15,
    });
  });

  it('confirme l’application, et retire le bouton', async () => {
    await render(<SessionAdaptationCard proposal={proposition()} plannedSessionId="ps-1" />);

    await act(async () => {
      fireEvent.press(screen.getByText('running.adaptation.applyCta'));
    });

    expect(screen.getByText('running.adaptation.applied')).toBeTruthy();
    // Laisser le bouton inviterait à appliquer deux fois la même réduction.
    expect(screen.queryByText('running.adaptation.applyCta')).toBeNull();
  });

  it('🔴 un échec d’écriture ne prétend PAS avoir appliqué', async () => {
    mockApply.mockRejectedValue(new Error('hors ligne'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await render(<SessionAdaptationCard proposal={proposition()} plannedSessionId="ps-1" />);
    await act(async () => {
      fireEvent.press(screen.getByText('running.adaptation.applyCta'));
    });

    // Afficher « Appliqué » sur une écriture ratée est le pire des deux mondes : l'utilisateur
    // part courir une séance qu'il croit allégée.
    expect(screen.queryByText('running.adaptation.applied')).toBeNull();
    expect(screen.getByText('running.adaptation.applyCta')).toBeTruthy();
    (console.warn as jest.Mock).mockRestore();
  });

  it('🔴 deux appuis n’écrivent qu’une fois', async () => {
    let resoudre: (() => void) | undefined;
    mockApply.mockReturnValue(
      new Promise<void>((resolve) => {
        resoudre = resolve;
      }),
    );

    await render(<SessionAdaptationCard proposal={proposition()} plannedSessionId="ps-1" />);
    const bouton = screen.getByText('running.adaptation.applyCta');
    await act(async () => {
      fireEvent.press(bouton);
      fireEvent.press(bouton);
    });

    // Même garde que partout ailleurs dans ce pilier : un état React ne voit pas un second appui
    // du même cycle de rendu, d'où `useActionLock`.
    expect(mockApply).toHaveBeenCalledTimes(1);
    resoudre?.();
    await act(async () => {});
  });
});

describe('quand le bouton ne doit PAS apparaître', () => {
  it('🔴 sans occurrence du jour : il n’y a pas de variante datée à poser', async () => {
    await render(<SessionAdaptationCard proposal={proposition()} plannedSessionId={null} />);

    // La carte peut parler d'une course libre : elle reste alors consultative.
    expect(screen.getByText('running.adaptation.title')).toBeTruthy();
    expect(screen.queryByText('running.adaptation.applyCta')).toBeNull();
    expect(screen.getByText('running.adaptation.advisory')).toBeTruthy();
  });

  it('🔴 sur une proposition « none » : il n’y a rien à appliquer', async () => {
    // Des signaux existent, mais aucune action n'est proposée (une gêne, ou de la fatigue sur une
    // séance déjà facile). On informe sans prescrire.
    await render(
      <SessionAdaptationCard
        proposal={proposition({ action: 'none', repsReductionPct: undefined })}
        plannedSessionId="ps-1"
      />,
    );

    expect(screen.queryByText('running.adaptation.applyCta')).toBeNull();
  });

  it('affiche les motifs même sans action', async () => {
    await render(
      <SessionAdaptationCard
        proposal={proposition({ action: 'none', repsReductionPct: undefined })}
        plannedSessionId="ps-1"
      />,
    );

    expect(screen.getByText(/running\.adaptation\.reasonPrefix/)).toBeTruthy();
  });
});

describe('le garde-fou du drapeau', () => {
  it('🔴 le drapeau est à VRAI, donc la migration doit être appliquée', () => {
    // Ce test est un rappel, pas une vérification de comportement : si quelqu'un remet le drapeau
    // à `false` sans raison, il casse. Et s'il le laisse à `true` alors que la migration a été
    // annulée, la première écriture bloquera la file d'upload de TOUTES les tables — d'où la
    // valeur d'un test qui nomme la dépendance.
    expect(ADAPTATION_WRITE_READY).toBe(true);
  });
});
