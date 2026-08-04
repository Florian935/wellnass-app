import { describe, expect, it } from 'vitest';

import {
  WELLBEING_INDICATORS,
  WELLBEING_SCALE_MAX,
  WELLBEING_SCALE_MIN,
  WELLBEING_CATCHUP_DAYS,
  canEditDay,
  isEmptyCheckin,
  isWellbeingLevel,
  wellbeingAverages,
  wellbeingSeries,
} from './wellbeing';

describe('bornes de l’échelle', () => {
  it('accepte 1 à 5 et rien d’autre', () => {
    expect(isWellbeingLevel(WELLBEING_SCALE_MIN)).toBe(true);
    expect(isWellbeingLevel(3)).toBe(true);
    expect(isWellbeingLevel(WELLBEING_SCALE_MAX)).toBe(true);

    expect(isWellbeingLevel(0)).toBe(false);
    expect(isWellbeingLevel(6)).toBe(false);
    expect(isWellbeingLevel(2.5)).toBe(false);
    expect(isWellbeingLevel(Number.NaN)).toBe(false);
    expect(isWellbeingLevel(null)).toBe(false);
    expect(isWellbeingLevel(undefined)).toBe(false);
  });

  it('expose les 3 indicateurs de la décision D1', () => {
    expect(WELLBEING_INDICATORS).toEqual(['mood', 'energy', 'stress']);
  });
});

describe('isEmptyCheckin', () => {
  it('considère vide un check-in dont les 3 indicateurs sont absents', () => {
    expect(isEmptyCheckin({})).toBe(true);
    expect(isEmptyCheckin({ mood: null, energy: null, stress: null })).toBe(true);
    expect(isEmptyCheckin({ mood: undefined })).toBe(true);
  });

  it('considère non vide un check-in partiel — décision D3', () => {
    expect(isEmptyCheckin({ energy: 3 })).toBe(false);
    expect(isEmptyCheckin({ mood: 1, stress: 5 })).toBe(false);
  });

  it('ignore une valeur hors échelle : elle ne rend pas le check-in valide', () => {
    expect(isEmptyCheckin({ mood: 0 })).toBe(true);
    expect(isEmptyCheckin({ stress: 9 })).toBe(true);
  });
});

describe('canEditDay — fenêtre de rattrapage (décision D4)', () => {
  const today = '2026-07-28';

  it('accepte aujourd’hui', () => {
    expect(canEditDay(today, today)).toBe(true);
  });

  it('accepte hier et jusqu’à J-6 inclus', () => {
    expect(canEditDay('2026-07-27', today)).toBe(true);
    expect(canEditDay('2026-07-22', today)).toBe(true); // J-6, dernier jour ouvert
  });

  it('refuse J-7 : la fenêtre est de 7 jours au total', () => {
    expect(canEditDay('2026-07-21', today)).toBe(false);
    expect(WELLBEING_CATCHUP_DAYS).toBe(7);
  });

  it('refuse le futur', () => {
    expect(canEditDay('2026-07-29', today)).toBe(false);
    expect(canEditDay('2026-08-15', today)).toBe(false);
  });

  it('traverse correctement un changement de mois', () => {
    expect(canEditDay('2026-06-30', '2026-07-02')).toBe(true);
    expect(canEditDay('2026-06-25', '2026-07-02')).toBe(false);
  });

  it('refuse une clé de jour illisible plutôt que de laisser passer', () => {
    expect(canEditDay('', today)).toBe(false);
    expect(canEditDay('28/07/2026', today)).toBe(false);
  });
});

describe('wellbeingSeries', () => {
  const rows = [
    { logDate: '2026-07-28', mood: 4, energy: 3, stress: 1 },
    { logDate: '2026-07-27', mood: 3, energy: 2, stress: 4 },
    // 26/07 volontairement absent : c'est le cas qui compte.
    { logDate: '2026-07-25', mood: 5, energy: 5, stress: 2 },
  ];

  it('rend les points d’un indicateur, du plus ancien au plus récent', () => {
    const series = wellbeingSeries(rows, 'mood', 30, '2026-07-28');
    expect(series).toEqual([
      { dayKey: '2026-07-25', value: 5 },
      { dayKey: '2026-07-27', value: 3 },
      { dayKey: '2026-07-28', value: 4 },
    ]);
  });

  it('trie quel que soit l’ordre d’arrivée des lignes', () => {
    // Toutes les autres fixtures arrivent en ordre décroissant (l'ordre naturel d'une requête
    // SQL `ORDER BY log_date DESC`). Une source déjà croissante — un import, un test, une autre
    // requête — doit produire exactement la même série.
    const ascending = [
      { logDate: '2026-07-25', mood: 5 },
      { logDate: '2026-07-27', mood: 3 },
      { logDate: '2026-07-28', mood: 4 },
    ];
    expect(wellbeingSeries(ascending, 'mood', 30, '2026-07-28')).toEqual([
      { dayKey: '2026-07-25', value: 5 },
      { dayKey: '2026-07-27', value: 3 },
      { dayKey: '2026-07-28', value: 4 },
    ]);
  });

  it('laisse un TROU pour un jour non renseigné — jamais un zéro', () => {
    const series = wellbeingSeries(rows, 'mood', 30, '2026-07-28');
    expect(series.map((p) => p.dayKey)).not.toContain('2026-07-26');
    expect(series.every((p) => p.value > 0)).toBe(true);
  });

  it('omet un jour dont l’indicateur demandé est nul, même si les autres sont remplis', () => {
    const partial = [{ logDate: '2026-07-28', mood: null, energy: 4, stress: null }];
    expect(wellbeingSeries(partial, 'mood', 30, '2026-07-28')).toEqual([]);
    expect(wellbeingSeries(partial, 'energy', 30, '2026-07-28')).toEqual([
      { dayKey: '2026-07-28', value: 4 },
    ]);
  });

  it('borne la fenêtre glissante', () => {
    const series = wellbeingSeries(rows, 'mood', 2, '2026-07-28');
    expect(series.map((p) => p.dayKey)).toEqual(['2026-07-27', '2026-07-28']);
  });

  it('ignore les lignes supprimées', () => {
    const withDeleted = [...rows, { logDate: '2026-07-26', mood: 2, deletedAt: '2026-07-26T10:00:00Z' }];
    const series = wellbeingSeries(withDeleted, 'mood', 30, '2026-07-28');
    expect(series.map((p) => p.dayKey)).not.toContain('2026-07-26');
  });

  it('rend une série vide sans données', () => {
    expect(wellbeingSeries([], 'mood', 30, '2026-07-28')).toEqual([]);
  });
});

describe('wellbeingAverages', () => {
  it('moyenne sur les jours RENSEIGNÉS seulement, indicateur par indicateur', () => {
    const rows = [
      { logDate: '2026-07-28', mood: 4, energy: 2, stress: null },
      { logDate: '2026-07-27', mood: 2, energy: null, stress: 3 },
      // 3 jours absents : ils ne doivent pas tirer les moyennes vers le bas.
    ];
    const avg = wellbeingAverages(rows, 30, '2026-07-28');

    expect(avg.mood).toEqual({ average: 3, days: 2 });
    expect(avg.energy).toEqual({ average: 2, days: 1 });
    expect(avg.stress).toEqual({ average: 3, days: 1 });
  });

  it('rend null (et 0 jour) pour un indicateur jamais renseigné', () => {
    const avg = wellbeingAverages([{ logDate: '2026-07-28', mood: 3 }], 30, '2026-07-28');
    expect(avg.energy).toEqual({ average: null, days: 0 });
  });

  it('rend null partout sans aucune donnée', () => {
    const avg = wellbeingAverages([], 7, '2026-07-28');
    for (const indicator of WELLBEING_INDICATORS) {
      expect(avg[indicator]).toEqual({ average: null, days: 0 });
    }
  });

  it('respecte la fenêtre', () => {
    const rows = [
      { logDate: '2026-07-28', mood: 5 },
      { logDate: '2026-07-10', mood: 1 },
    ];
    expect(wellbeingAverages(rows, 7, '2026-07-28').mood).toEqual({ average: 5, days: 1 });
  });

  // Le filtre de fenêtre écarte quatre familles de lignes, et seules les plus banales étaient
  // exercées. Ces rejets ne sont pas cosmétiques : une ligne supprimée qui reviendrait dans une
  // moyenne, ou une date future qui compterait comme « aujourd'hui », faussent un indicateur que
  // l'utilisateur lit comme une observation de lui-même.
  describe('filtre de fenêtre', () => {
    it('écarte une ligne supprimée (soft delete)', () => {
      const rows = [
        { logDate: '2026-07-28', mood: 5 },
        { logDate: '2026-07-27', mood: 1, deletedAt: '2026-07-27T10:00:00.000Z' },
      ];
      expect(wellbeingAverages(rows, 7, '2026-07-28').mood).toEqual({ average: 5, days: 1 });
    });

    it('écarte une date mal formée au lieu de la compter à zéro', () => {
      const rows = [
        { logDate: '2026-07-28', mood: 4 },
        { logDate: 'pas-une-date', mood: 1 },
        { logDate: '2026-7-3', mood: 1 },
      ];
      expect(wellbeingAverages(rows, 7, '2026-07-28').mood).toEqual({ average: 4, days: 1 });
    });

    it('écarte une date dans le futur', () => {
      // Horloge décalée ou saisie erronée : un jour à venir n'est pas une observation.
      const rows = [
        { logDate: '2026-07-28', mood: 4 },
        { logDate: '2026-07-29', mood: 1 },
      ];
      expect(wellbeingAverages(rows, 7, '2026-07-28').mood).toEqual({ average: 4, days: 1 });
    });

    it('accepte deux lignes du même jour sans perdre ni dupliquer (comparateur à l’égalité)', () => {
      // Le modèle vise une ligne par jour, mais deux appareils hors réseau peuvent en produire
      // deux : la moyenne doit les compter toutes les deux plutôt que d'en écarter une au hasard.
      const rows = [
        { logDate: '2026-07-28', mood: 5 },
        { logDate: '2026-07-28', mood: 3 },
      ];
      expect(wellbeingAverages(rows, 7, '2026-07-28').mood).toEqual({ average: 4, days: 2 });
    });

    it('inclut le bord ancien de la fenêtre et exclut le jour juste au-delà', () => {
      // Fenêtre de 7 jours se terminant le 28 : le 22 est dedans (age 6), le 21 dehors (age 7).
      const rows = [
        { logDate: '2026-07-22', mood: 2 },
        { logDate: '2026-07-21', mood: 5 },
      ];
      expect(wellbeingAverages(rows, 7, '2026-07-28').mood).toEqual({ average: 2, days: 1 });
    });
  });
});
