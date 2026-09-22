/**
 * US RUN-F2c / RUN-F4 — la ligne de résumé d'un segment de séance structurée. Fichier à **0 %**.
 *
 * Ce fichier existe parce qu'une combinatoire (nature × allure × chrono × récup × groupe) ne se
 * met pas dans des clés i18n : il **assemble des fragments**. Un assemblage n'a pas de garde-fou
 * naturel, et son mode de panne est toujours le même — **une information saisie qui disparaît de
 * la ligne**. C'est exactement ce qu'RUN-F4 a corrigé : on saisissait « 8 × 400 m à 4:05 » et la
 * ligne rendait « 8 × 400 m ». Ça ne se lit pas comme un manque, ça se lit comme une perte.
 *
 * Trois règles qui ne sautent pas aux yeux, et que ces tests figent :
 *
 * - **L'ordre de priorité de l'intensité** : allure absolue > chrono cible > %VMA, et **sans repli
 *   calculé**. Une ligne de résumé affiche ce qui est ÉCRIT sur le segment, jamais ce qu'on en
 *   déduirait avec le profil du coureur — une conversion silencieuse ici serait indétectable.
 * - **Le chrono cible n'a de sens qu'avec une distance.** Sur une phase bornée en durée il ferait
 *   doublon avec l'étendue elle-même.
 * - **`groupReps` sans `groupKey` est ignoré**, comme le fait le moteur : afficher « 3 × » sur un
 *   segment qui ne se répète pas serait un mensonge, et il serait cru.
 *
 * `t` rend ici la clé et ses variables, ce qui permet d'affirmer **ce qui est écrit** plutôt que
 * de constater qu'une chaîne non vide est sortie.
 */

import type { TFunction } from 'i18next';

import { formatIntervalBlockSummary } from '../interval-summary';
import type { IntervalBlockItem } from '@/data/repositories/program-repository';

/** Traduction de test : `clé(var=valeur)`, lisible et assertable. */
const t = ((key: string, vars?: Record<string, unknown>) => {
  if (!vars) return key;
  const args = Object.entries(vars)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(' ');
  return `${key}(${args})`;
}) as unknown as TFunction;

const block = (over: Partial<IntervalBlockItem> = {}): IntervalBlockItem =>
  ({
    id: 'blk-1',
    reps: 1,
    fastDistanceM: null,
    fastDurationSeconds: null,
    fastPacePctVma: null,
    recoveryDistanceM: null,
    recoveryDurationSeconds: null,
    kind: 'work',
    label: null,
    fastPaceMinSPerKm: null,
    fastPaceMaxSPerKm: null,
    fastTargetTimeMinSeconds: null,
    fastTargetTimeMaxSeconds: null,
    recoveryKind: null,
    recoveryPaceMinSPerKm: null,
    recoveryPaceMaxSPerKm: null,
    groupKey: null,
    groupReps: null,
    fastPaceProgressive: null,
    ...over,
  }) as IntervalBlockItem;

const summary = (over: Partial<IntervalBlockItem> = {}) =>
  formatIntervalBlockSummary(t, block(over));

// ---------------------------------------------------------------------------
// L'étendue de la phase
// ---------------------------------------------------------------------------

describe('l’étendue', () => {
  it('dit une distance en mètres', () => {
    expect(summary({ fastDistanceM: 400 })).toContain('running.intervals.distanceLabel(value=400)');
  });

  it('dit une durée en minutes entières quand elle tombe juste', () => {
    expect(summary({ fastDurationSeconds: 720 })).toContain(
      'running.intervals.durationLabel(value=12)',
    );
  });

  it('arrondit une durée non ronde au dixième de minute, pas plus', () => {
    // 90 s = 1,5 min. Sans arrondi on lirait « 1.5000000000000002 min » sur d'autres valeurs.
    expect(summary({ fastDurationSeconds: 90 })).toContain(
      'running.intervals.durationLabel(value=1.5)',
    );
  });

  it('préfère la distance à la durée quand les deux sont présentes', () => {
    const line = summary({ fastDistanceM: 400, fastDurationSeconds: 90 });

    expect(line).toContain('distanceLabel');
    expect(line).not.toContain('durationLabel');
  });

  it('ne dit rien d’une phase sans étendue plutôt que d’inventer une valeur', () => {
    expect(summary()).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Les répétitions
// ---------------------------------------------------------------------------

describe('les répétitions', () => {
  it('annonce le nombre de répétitions au-delà de une', () => {
    expect(summary({ reps: 8, fastDistanceM: 400 })).toContain('running.intervals.repsTimes');
  });

  it('n’annonce pas « 1 × » : un échauffement se lit « Échauffement — 12 min »', () => {
    expect(summary({ reps: 1, fastDurationSeconds: 720 })).not.toContain('repsTimes');
  });
});

// ---------------------------------------------------------------------------
// L'intensité — l'ordre de priorité
// ---------------------------------------------------------------------------

describe('l’intensité', () => {
  it('dit une allure unique quand les deux bornes sont égales', () => {
    const line = summary({ fastDistanceM: 400, fastPaceMinSPerKm: 245, fastPaceMaxSPerKm: 245 });

    expect(line).toContain('running.intervals.atPace');
    expect(line).toContain('4:05');
  });

  it('dit une fourchette d’allure quand les bornes diffèrent', () => {
    const line = summary({ fastDistanceM: 400, fastPaceMinSPerKm: 240, fastPaceMaxSPerKm: 250 });

    expect(line).toContain('running.intervals.atPaceRange');
    expect(line).toContain('4:00');
    expect(line).toContain('4:10');
  });

  it('🔴 fait passer l’allure absolue AVANT le chrono cible', () => {
    const line = summary({
      fastDistanceM: 400,
      fastPaceMinSPerKm: 245,
      fastPaceMaxSPerKm: 245,
      fastTargetTimeMinSeconds: 98,
    });

    expect(line).toContain('atPace');
    expect(line).not.toContain('inTime');
  });

  it('🔴 fait passer le chrono cible AVANT le %VMA', () => {
    const line = summary({
      fastDistanceM: 400,
      fastTargetTimeMinSeconds: 98,
      fastPacePctVma: 105,
    });

    expect(line).toContain('running.intervals.inTime');
    expect(line).not.toContain('atPctVma');
  });

  it('dit une fourchette de chrono quand les deux bornes diffèrent', () => {
    const line = summary({
      fastDistanceM: 400,
      fastTargetTimeMinSeconds: 95,
      fastTargetTimeMaxSeconds: 100,
    });

    expect(line).toContain('running.intervals.inTimeRange');
  });

  it('ne dit pas une fourchette quand les deux bornes sont identiques', () => {
    const line = summary({
      fastDistanceM: 400,
      fastTargetTimeMinSeconds: 98,
      fastTargetTimeMaxSeconds: 98,
    });

    expect(line).toContain('running.intervals.inTime(');
    expect(line).not.toContain('inTimeRange');
  });

  it('accepte un chrono borné d’un seul côté', () => {
    expect(summary({ fastDistanceM: 400, fastTargetTimeMaxSeconds: 100 })).toContain(
      'running.intervals.inTime(',
    );
  });

  it('🔴 n’affiche AUCUN chrono sur une phase bornée en durée — ce serait un doublon', () => {
    const line = summary({ fastDurationSeconds: 180, fastTargetTimeMinSeconds: 180 });

    expect(line).not.toContain('inTime');
  });

  it('retombe sur le %VMA quand rien d’absolu n’est écrit', () => {
    expect(summary({ fastDistanceM: 400, fastPacePctVma: 105 })).toContain(
      'running.intervals.atPctVma(pct=105)',
    );
  });

  it('🔴 ne convertit JAMAIS un %VMA en allure : le profil du coureur n’est pas connu ici', () => {
    const line = summary({ fastDistanceM: 400, fastPacePctVma: 105 });

    expect(line).not.toContain('atPace');
  });

  it('ne dit rien d’une intensité absente', () => {
    const line = summary({ fastDistanceM: 400 });

    expect(line).not.toContain('atPace');
    expect(line).not.toContain('atPctVma');
    expect(line).not.toContain('inTime');
  });
});

// ---------------------------------------------------------------------------
// La récupération
// ---------------------------------------------------------------------------

describe('la récupération', () => {
  it('annonce une récupération en distance', () => {
    expect(summary({ fastDistanceM: 400, recoveryDistanceM: 200 })).toContain(
      'running.intervals.recovery',
    );
  });

  it('annonce une récupération en durée', () => {
    expect(summary({ fastDistanceM: 400, recoveryDurationSeconds: 90 })).toContain(
      'running.intervals.recovery',
    );
  });

  it('nomme la nature de la récupération quand elle est précisée', () => {
    const line = summary({
      fastDistanceM: 400,
      recoveryDistanceM: 200,
      recoveryKind: 'jog',
    });

    expect(line).toContain('running.intervals.recoveryWithKind');
    expect(line).toContain('kind=running.recoverykind.jog');
  });

  it('ne dit rien d’une récupération absente', () => {
    expect(summary({ fastDistanceM: 400 })).not.toContain('recovery');
  });
});

// ---------------------------------------------------------------------------
// La nature du segment
// ---------------------------------------------------------------------------

describe('la nature du segment', () => {
  it.each(['warmup', 'cooldown', 'drills'])(
    'annonce la nature « %s » en tête de ligne',
    (kind) => {
      const line = summary({ kind: kind as never, fastDurationSeconds: 720 });

      expect(line).toContain(`running.segmentKind.${kind} —`);
    },
  );

  it('🔴 n’annonce pas « corps de séance » : c’est le défaut, le dire serait du bruit', () => {
    expect(summary({ kind: 'work', fastDistanceM: 400 })).not.toContain('segmentKind');
  });
});

// ---------------------------------------------------------------------------
// Le groupe
// ---------------------------------------------------------------------------

describe('le groupe', () => {
  it('annonce le groupe en tête : c’est lui qui donne le vrai volume', () => {
    const line = summary({
      fastDistanceM: 400,
      reps: 4,
      groupKey: 'g1',
      groupReps: 3,
    });

    expect(line.startsWith('running.intervals.groupPrefix(reps=3)')).toBe(true);
  });

  it('🔴 ignore `groupReps` sans `groupKey` — le moteur l’ignore aussi', () => {
    expect(summary({ fastDistanceM: 400, groupReps: 3 })).not.toContain('groupPrefix');
  });

  it('n’annonce pas un groupe qui ne se répète qu’une fois', () => {
    expect(summary({ fastDistanceM: 400, groupKey: 'g1', groupReps: 1 })).not.toContain(
      'groupPrefix',
    );
  });

  it('place le groupe avant la nature du segment', () => {
    const line = summary({
      fastDurationSeconds: 720,
      kind: 'warmup',
      groupKey: 'g1',
      groupReps: 2,
    });

    expect(line.indexOf('groupPrefix')).toBeLessThan(line.indexOf('segmentKind'));
  });
});

// ---------------------------------------------------------------------------
// La ligne complète
// ---------------------------------------------------------------------------

describe('la ligne assemblée', () => {
  it('ne perd aucune information d’un segment complet', () => {
    const line = summary({
      reps: 8,
      fastDistanceM: 400,
      fastPaceMinSPerKm: 245,
      fastPaceMaxSPerKm: 245,
      recoveryDurationSeconds: 90,
      recoveryKind: 'jog',
      kind: 'cooldown',
      groupKey: 'g1',
      groupReps: 3,
    });

    // Le défaut qu'RUN-F4 a corrigé : chacune de ces cinq informations était saisie et
    // n'apparaissait pas. Elles doivent toutes être là, dans la même ligne.
    for (const fragment of [
      'groupPrefix',
      'segmentKind.cooldown',
      'repsTimes',
      'atPace',
      'recoveryWithKind',
    ]) {
      expect(line).toContain(fragment);
    }
  });

  it('sépare les fragments par des virgules', () => {
    const line = summary({
      reps: 8,
      fastDistanceM: 400,
      fastPacePctVma: 105,
      recoveryDurationSeconds: 90,
    });

    expect(line.split(', ')).toHaveLength(3);
  });
});
