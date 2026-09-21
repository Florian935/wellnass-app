/**
 * US RESERV-01 — l'**assemblage** du Réservoir : quelles données entrent dans la courbe du jour.
 *
 * Le moteur (`simulateDay`, `snackAdviceG`, `levelAt`, `explainGlycogen`) est couvert chez lui dans
 * `@wellness/shared` et n'est **pas** mocké ici : on veut la chaîne réelle. Ce qui est testé, c'est
 * le tri en amont — et c'est là que vivent les défauts, parce qu'ils sont invisibles :
 *
 * - une séance **planifiée déjà passée** comptée dans la projection ferait plonger la courbe pour
 *   un effort qui n'aura pas lieu, et déclencherait un conseil de collation sans raison ;
 * - une séance **d'un autre jour** ou **annulée** ferait la même chose, en pire ;
 * - un **repas de type inconnu** sans heure conventionnelle ne doit pas être rangé à 0 h, où il
 *   fausserait tout le début de journée ;
 * - **sans poids connu**, la carte ne s'affiche pas (R9) — inventer une capacité donnerait des
 *   grammes faux affichés avec le même aplomb que des vrais.
 *
 * Fichier à **0 %** avant ce test : livré sans filet, alors qu'il compose cinq sources de données.
 */

import { renderHook } from '@testing-library/react-native';
import { GLYCOGEN_G_PER_KG, LOW_ZONE_SHARE, MEAL_HOURS } from '@wellness/shared';

import { PLANNED_MET, lowZoneG, useFuelTank } from '../fuel-repository';
import { useDayEntries } from '../journal-repository';
import { useEnergyItemsByDay, useRestingMetabolismAt } from '../energy-repository';
import { useUpcomingSessions } from '../planned-session-repository';
import { useWeightEntries } from '../bodyweight-repository';

jest.mock('../journal-repository', () => ({ useDayEntries: jest.fn() }));
jest.mock('../energy-repository', () => ({
  useEnergyItemsByDay: jest.fn(),
  useRestingMetabolismAt: jest.fn(),
}));
jest.mock('../planned-session-repository', () => ({ useUpcomingSessions: jest.fn() }));
jest.mock('../bodyweight-repository', () => ({ useWeightEntries: jest.fn() }));

const dayEntries = useDayEntries as jest.Mock;
const energyItems = useEnergyItemsByDay as jest.Mock;
const restingAt = useRestingMetabolismAt as jest.Mock;
const upcoming = useUpcomingSessions as jest.Mock;
const weightEntries = useWeightEntries as jest.Mock;

const DAY = '2026-09-18';

/** Métabolisme de repos type : ~1 700 kcal/j. `estimateMetEnergy` lit `kcalPerHour`, pas un total. */
const REPOS = { kcalPerHour: 70, personalised: true };

type PlannedItem = {
  id: string;
  scheduledDate: string;
  scheduledTime: string | null;
  status: string;
  pillar: string;
};

const planned = (over: Partial<PlannedItem> = {}): PlannedItem => ({
  id: 'p1',
  scheduledDate: DAY,
  scheduledTime: '18:00',
  status: 'planned',
  pillar: 'strength',
  ...over,
});

/** Réglage par défaut : 70 kg connus, aucun repas, aucune séance. */
function setup(over: {
  entries?: { mealType: string; carbsG: number }[];
  byDay?: Map<string, unknown[]>;
  resting?: { kcalPerHour: number; personalised: boolean } | null;
  weightKg?: number | null;
  weights?: { logDate: string; weightKg: number }[];
  items?: PlannedItem[];
  loading?: Partial<Record<'entries' | 'energy' | 'resting' | 'planned', boolean>>;
} = {}) {
  dayEntries.mockReturnValue({
    entries: over.entries ?? [],
    isLoading: over.loading?.entries ?? false,
  });
  energyItems.mockReturnValue({
    byDay: over.byDay ?? new Map(),
    isLoading: over.loading?.energy ?? false,
  });
  restingAt.mockReturnValue({
    resting: over.resting === undefined ? REPOS : over.resting,
    weightKg: over.weightKg === undefined ? 70 : over.weightKg,
    isLoading: over.loading?.resting ?? false,
  });
  weightEntries.mockReturnValue({ entries: over.weights ?? [{ logDate: DAY, weightKg: 70 }] });
  upcoming.mockReturnValue({ items: over.items ?? [], isLoading: over.loading?.planned ?? false });
}

const tankAt = async (atHour: number) => {
  const { result } = await renderHook(() => useFuelTank(DAY, atHour));
  return result.current;
};

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// R9 — sans poids, pas de carte
// ---------------------------------------------------------------------------

describe('capacité', () => {
  it('rend null sans poids connu plutôt que d’inventer une capacité (R9)', async () => {
    setup({ weightKg: null });

    expect((await tankAt(12)).tank).toBeNull();
  });

  it.each([0, -5, Number.NaN])('rend null pour un poids aberrant (%p)', async (weightKg) => {
    setup({ weightKg });

    expect((await tankAt(12)).tank).toBeNull();
  });

  it('dérive la capacité du poids du jour, pas d’une constante', async () => {
    setup({ weightKg: 80 });

    expect((await tankAt(12)).tank?.capacityG).toBe(80 * GLYCOGEN_G_PER_KG);
  });
});

// ---------------------------------------------------------------------------
// D3 — les repas, rangés à leur heure conventionnelle
// ---------------------------------------------------------------------------

describe('apports', () => {
  it('agrège les entrées d’un même repas en un seul apport', async () => {
    setup({
      entries: [
        { mealType: 'lunch', carbsG: 40 },
        { mealType: 'lunch', carbsG: 35 },
      ],
    });

    expect((await tankAt(14)).tank?.mealsCount).toBe(1);
  });

  it('compte chaque type de repas séparément', async () => {
    setup({
      entries: [
        { mealType: 'breakfast', carbsG: 60 },
        { mealType: 'lunch', carbsG: 80 },
        { mealType: 'dinner', carbsG: 70 },
      ],
    });

    expect((await tankAt(21)).tank?.mealsCount).toBe(3);
  });

  it('écarte un type de repas sans heure conventionnelle plutôt que de le ranger à 0 h (D3)', async () => {
    setup({ entries: [{ mealType: 'brunch-de-noel', carbsG: 120 }] });

    expect((await tankAt(12)).tank?.mealsCount).toBe(0);
  });

  it('écarte un repas sans glucides : il ne remplit rien', async () => {
    setup({ entries: [{ mealType: 'lunch', carbsG: 0 }] });

    expect((await tankAt(14)).tank?.mealsCount).toBe(0);
  });

  it('fait monter le niveau après l’heure du repas, pas avant', async () => {
    setup({ entries: [{ mealType: 'lunch', carbsG: 100 }] });
    const before = (await tankAt(MEAL_HOURS.lunch - 1)).tank!;
    const after = (await tankAt(MEAL_HOURS.lunch + 2)).tank!;

    expect(after.nowG).toBeGreaterThan(before.nowG);
  });
});

// ---------------------------------------------------------------------------
// D4/D5 — les séances : réalisées telles quelles, planifiées par convention
// ---------------------------------------------------------------------------

describe('séances réalisées', () => {
  it('reprend la dépense déjà estimée par DEPENSE-01, sans la recalculer (D4)', async () => {
    setup({
      byDay: new Map([
        [
          DAY,
          [
            {
              startedAt: new Date(`${DAY}T10:00:00`).toISOString(),
              durationSeconds: 3600,
              estimate: { kcal: 600, met: 8 },
            },
          ],
        ],
      ]),
    });

    expect((await tankAt(12)).tank?.sessionsCount).toBe(1);
  });

  it('ignore les séances des autres jours', async () => {
    setup({
      byDay: new Map([
        [
          '2026-09-17',
          [{ startedAt: '2026-09-17T10:00:00.000Z', durationSeconds: 3600, estimate: { kcal: 600, met: 8 } }],
        ],
      ]),
    });

    expect((await tankAt(12)).tank?.sessionsCount).toBe(0);
  });

  it('accepte une séance sans durée enregistrée sans faire tomber l’assemblage', async () => {
    setup({
      byDay: new Map([
        [
          DAY,
          [{ startedAt: new Date(`${DAY}T10:00:00`).toISOString(), durationSeconds: null, estimate: { kcal: 300, met: 6 } }],
        ],
      ]),
    });

    expect((await tankAt(12)).tank?.sessionsCount).toBe(1);
  });
});

describe('séances planifiées', () => {
  it('projette une séance du jour encore à venir', async () => {
    setup({ items: [planned({ scheduledTime: '18:00' })] });
    const tank = (await tankAt(12)).tank!;

    expect(tank.sessionsCount).toBe(1);
    expect(tank.nextSessionHour).toBe(18);
  });

  it('écarte une séance planifiée déjà passée : la projection ne refait pas le passé', async () => {
    setup({ items: [planned({ scheduledTime: '08:00' })] });
    const tank = (await tankAt(12)).tank!;

    expect(tank.sessionsCount).toBe(0);
    expect(tank.nextSessionHour).toBeNull();
  });

  it('écarte une séance planifiée un autre jour', async () => {
    setup({ items: [planned({ scheduledDate: '2026-09-19' })] });

    expect((await tankAt(12)).tank?.sessionsCount).toBe(0);
  });

  it.each(['done', 'skipped', 'cancelled'])('écarte une séance au statut « %s »', async (status) => {
    setup({ items: [planned({ status })] });

    expect((await tankAt(12)).tank?.sessionsCount).toBe(0);
  });

  it('écarte une séance sans heure : rien ne dit où la poser sur la courbe', async () => {
    setup({ items: [planned({ scheduledTime: null })] });

    expect((await tankAt(12)).tank?.sessionsCount).toBe(0);
  });

  it('écarte une heure illisible plutôt que de la lire comme minuit', async () => {
    setup({ items: [planned({ scheduledTime: 'plus tard' })] });

    expect((await tankAt(12)).tank?.sessionsCount).toBe(0);
  });

  it('lit les minutes de l’heure planifiée', async () => {
    setup({ items: [planned({ scheduledTime: '18:30' })] });

    expect((await tankAt(12)).tank?.nextSessionHour).toBe(18.5);
  });

  it('n’applique aucune convention sans métabolisme de repos connu (D5)', async () => {
    setup({ resting: null, items: [planned()] });

    expect((await tankAt(12)).tank?.sessionsCount).toBe(0);
  });

  it('coûte plus cher en course qu’en musculation, à durée égale (PLANNED_MET)', async () => {
    expect(PLANNED_MET.running).toBeGreaterThan(PLANNED_MET.strength);

    setup({ items: [planned({ pillar: 'running', scheduledTime: '18:00' })] });
    const run = (await tankAt(12)).tank!;
    setup({ items: [planned({ pillar: 'strength', scheduledTime: '18:00' })] });
    const lift = (await tankAt(12)).tank!;

    expect(run.lowest.grams).toBeLessThan(lift.lowest.grams);
  });

  it('retient la plus proche quand deux séances restent à venir', async () => {
    setup({
      items: [
        planned({ id: 'p-soir', scheduledTime: '19:00' }),
        planned({ id: 'p-aprem', scheduledTime: '15:00' }),
      ],
    });

    expect((await tankAt(12)).tank?.nextSessionHour).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// R7 — le conseil de collation
// ---------------------------------------------------------------------------

describe('conseil de collation (R7)', () => {
  it('ne conseille rien quand il n’y a plus de séance à venir', async () => {
    setup();
    const tank = (await tankAt(12)).tank!;

    expect(tank.snackG).toBeNull();
    expect(tank.curveWithSnack).toBeNull();
  });

  it('conseille des glucides quand une grosse séance arrive sur un réservoir bas', async () => {
    setup({ items: [planned({ pillar: 'running', scheduledTime: '18:00' })] });
    const tank = (await tankAt(16)).tank!;

    expect(tank.snackG).not.toBeNull();
    expect(tank.curveWithSnack).not.toBeNull();
  });

  it('la courbe avec collation passe au-dessus de la courbe nue à l’heure de la séance', async () => {
    setup({ items: [planned({ pillar: 'running', scheduledTime: '18:00' })] });
    const tank = (await tankAt(16)).tank!;

    const at = (curve: { hour: number; grams: number }[], hour: number) =>
      curve.reduce((best, p) => (Math.abs(p.hour - hour) < Math.abs(best.hour - hour) ? p : best)).grams;

    expect(at(tank.curveWithSnack!, 18)).toBeGreaterThan(at(tank.curve, 18));
  });
});

// ---------------------------------------------------------------------------
// État courant, explication, chargement
// ---------------------------------------------------------------------------

describe('état courant', () => {
  it('exprime le niveau du moment en part de la capacité', async () => {
    setup();
    const tank = (await tankAt(8)).tank!;

    expect(tank.nowShare).toBeCloseTo(tank.nowG / tank.capacityG, 10);
  });

  it('une journée passée se lit à 24 h, sans projection (R10)', async () => {
    setup();
    const tank = (await tankAt(24)).tank!;

    expect(tank.lowest.hour).toBe(24);
  });

  it('signale une pesée ancienne dans l’explication', async () => {
    setup({ weights: [{ logDate: '2026-08-19', weightKg: 70 }] });

    expect((await tankAt(12)).tank?.explanation).toBeDefined();
  });

  it('accepte de n’avoir aucune pesée : la capacité vient du poids du profil', async () => {
    setup({ weights: [] });

    expect((await tankAt(12)).tank?.capacityG).toBe(350);
  });

  it.each(['entries', 'energy', 'resting', 'planned'] as const)(
    'relaie le chargement de la source « %s »',
    async (source) => {
      setup({ loading: { [source]: true } });

      expect((await tankAt(12)).isLoading).toBe(true);
    },
  );

  it('n’est plus en chargement quand les quatre sources ont répondu', async () => {
    setup();

    expect((await tankAt(12)).isLoading).toBe(false);
  });
});

describe('lowZoneG', () => {
  it('rend le seuil de zone basse en grammes entiers', () => {
    expect(lowZoneG(350)).toBe(Math.round(350 * LOW_ZONE_SHARE));
  });

  it('vaut zéro pour une capacité nulle, sans NaN', () => {
    expect(lowZoneG(0)).toBe(0);
  });
});
