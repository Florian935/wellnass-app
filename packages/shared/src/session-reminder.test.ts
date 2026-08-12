/**
 * US HORAIRE-01 — instant de convocation d'une séance planifiée (roadmap 2.4).
 *
 * Écrit **avant** la fonction (TDD), et les cas comptent plus que le calcul : soustraire 30 minutes
 * est trivial, décider **quand ne rien programmer** ne l'est pas.
 *
 * Les trois cas qui portent le risque :
 *
 *  1. 🔴 **La convocation déjà passée ne programme RIEN** (règle R3). Le piège n'est pas d'oublier
 *     le calcul, c'est de renvoyer un instant dans le passé — que la couche notification
 *     déclencherait alors **immédiatement**. Une alerte « ça commence dans 30 min » reçue après le
 *     début est pire que pas d'alerte du tout.
 *  2. 🔴 **Minuit se traverse, il ne se tronque pas.** Une séance à 00 h 15 convoque la **veille** à
 *     23 h 45. Un calcul qui bornerait à 00 h 00 « pour rester dans la journée » perdrait le rappel.
 *  3. **Une heure malformée ne lève pas.** La valeur vient de la base, donc d'un autre appareil,
 *     d'une version antérieure ou d'un import : elle peut être vide ou aberrante, et une exception
 *     ici casserait le calcul des rappels **de tous les autres** items du plan.
 *
 * L'horloge est un **paramètre**, jamais lue dans la fonction — règle `no-frozen-clock` du dépôt.
 */

import { describe, expect, it } from 'vitest';
import { computeSessionCallTime, SESSION_LEAD_MINUTES } from './session-reminder';

/** Date locale, pour que le test ne dépende pas du fuseau du runner. */
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min, 0, 0);

describe('SESSION_LEAD_MINUTES', () => {
  it('vaut 30 — la valeur annoncée par la roadmap 2.4', () => {
    // Constante et non réglage (décision D4) : un réglage de plus serait à traduire, tester et
    // recetter pour un gain non démontré. La constante rend le passage à un réglage trivial.
    expect(SESSION_LEAD_MINUTES).toBe(30);
  });
});

describe('convocation à venir', () => {
  it('renvoie l’heure de la séance moins 30 minutes', () => {
    const call = computeSessionCallTime({
      scheduledDate: '2026-08-14',
      scheduledTime: '18:30',
      now: local(2026, 8, 14, 14, 0),
    });

    expect(call).toEqual(local(2026, 8, 14, 18, 0));
  });

  it('accepte le format `HH:MM:SS` que rend Postgres', () => {
    // La colonne est un `time` : PostgREST et SQLite la rendent en `18:30:00`, pas `18:30`.
    const call = computeSessionCallTime({
      scheduledDate: '2026-08-14',
      scheduledTime: '18:30:00',
      now: local(2026, 8, 14, 14, 0),
    });

    expect(call).toEqual(local(2026, 8, 14, 18, 0));
  });

  it('programme encore quand il reste exactement une minute avant la convocation', () => {
    const call = computeSessionCallTime({
      scheduledDate: '2026-08-14',
      scheduledTime: '18:30',
      now: local(2026, 8, 14, 17, 59),
    });

    expect(call).toEqual(local(2026, 8, 14, 18, 0));
  });

  it('programme une séance des jours suivants', () => {
    const call = computeSessionCallTime({
      scheduledDate: '2026-08-20',
      scheduledTime: '07:00',
      now: local(2026, 8, 14, 22, 0),
    });

    expect(call).toEqual(local(2026, 8, 20, 6, 30));
  });
});

describe('🔴 rien à programmer', () => {
  it('renvoie null quand la convocation est déjà passée', () => {
    // Séance à 18 h 30, il est 18 h 15 : la convocation était à 18 h 00.
    const call = computeSessionCallTime({
      scheduledDate: '2026-08-14',
      scheduledTime: '18:30',
      now: local(2026, 8, 14, 18, 15),
    });

    // Surtout : `null`, et non un instant passé que la couche notification déclencherait
    // immédiatement — ce qui produirait « ça commence dans 30 min » alors que ça a commencé.
    expect(call).toBeNull();
  });

  it('renvoie null pile à l’instant de convocation', () => {
    // Le bord : à 18 h 00 tout juste, la notification n'a plus d'avance à donner. On préfère ne
    // rien envoyer plutôt qu'un rappel sans marge.
    const call = computeSessionCallTime({
      scheduledDate: '2026-08-14',
      scheduledTime: '18:30',
      now: local(2026, 8, 14, 18, 0),
    });

    expect(call).toBeNull();
  });

  it('renvoie null quand la séance est déjà commencée', () => {
    const call = computeSessionCallTime({
      scheduledDate: '2026-08-14',
      scheduledTime: '18:30',
      now: local(2026, 8, 14, 19, 0),
    });

    expect(call).toBeNull();
  });

  it('renvoie null quand la séance est un jour passé', () => {
    const call = computeSessionCallTime({
      scheduledDate: '2026-08-10',
      scheduledTime: '18:30',
      now: local(2026, 8, 14, 9, 0),
    });

    expect(call).toBeNull();
  });

  it('renvoie null sans heure — le repli d’échéance n’est pas l’affaire de cette fonction', () => {
    const call = computeSessionCallTime({
      scheduledDate: '2026-08-14',
      scheduledTime: null,
      now: local(2026, 8, 14, 9, 0),
    });

    expect(call).toBeNull();
  });
});

describe('🔴 minuit', () => {
  it('convoque la VEILLE pour une séance à 00 h 15', () => {
    const call = computeSessionCallTime({
      scheduledDate: '2026-08-14',
      scheduledTime: '00:15',
      now: local(2026, 8, 13, 20, 0),
    });

    // Un calcul qui bornerait à 00 h 00 « pour rester dans la journée » perdrait le rappel.
    expect(call).toEqual(local(2026, 8, 13, 23, 45));
  });

  it('traverse aussi un changement de mois', () => {
    const call = computeSessionCallTime({
      scheduledDate: '2026-09-01',
      scheduledTime: '00:10',
      now: local(2026, 8, 31, 12, 0),
    });

    expect(call).toEqual(local(2026, 8, 31, 23, 40));
  });

  it('convoque à 23 h 30 la veille pour une séance à minuit pile', () => {
    const call = computeSessionCallTime({
      scheduledDate: '2026-08-14',
      scheduledTime: '00:00',
      now: local(2026, 8, 13, 20, 0),
    });

    expect(call).toEqual(local(2026, 8, 13, 23, 30));
  });
});

describe('valeurs malformées', () => {
  it.each([
    ['chaîne vide', ''],
    ['espaces', '   '],
    ['heure hors bornes', '25:00'],
    ['minutes hors bornes', '18:75'],
    ['sans séparateur', '1830'],
    ['texte', 'le soir'],
    ['heure négative', '-1:00'],
  ])('renvoie null pour %s, sans lever', (_cas, heure) => {
    // La valeur vient de la base, donc d'un autre appareil ou d'une version antérieure. Une
    // exception ici ferait échouer le calcul des rappels de repas et de pesée avec elle.
    expect(() =>
      computeSessionCallTime({
        scheduledDate: '2026-08-14',
        scheduledTime: heure,
        now: local(2026, 8, 14, 9, 0),
      }),
    ).not.toThrow();

    expect(
      computeSessionCallTime({
        scheduledDate: '2026-08-14',
        scheduledTime: heure,
        now: local(2026, 8, 14, 9, 0),
      }),
    ).toBeNull();
  });

  it('renvoie null pour une date malformée', () => {
    expect(
      computeSessionCallTime({
        scheduledDate: 'pas-une-date',
        scheduledTime: '18:30',
        now: local(2026, 8, 14, 9, 0),
      }),
    ).toBeNull();
  });

  it('accepte 23:59, la borne haute valide', () => {
    const call = computeSessionCallTime({
      scheduledDate: '2026-08-14',
      scheduledTime: '23:59',
      now: local(2026, 8, 14, 9, 0),
    });

    expect(call).toEqual(local(2026, 8, 14, 23, 29));
  });
});
