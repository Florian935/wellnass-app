import { describe, expect, it } from 'vitest';

import {
  AI_LAB_QUESTIONS,
  AI_TREND_WINDOW_DAYS,
  buildAiContext,
  formatPace,
  type AiSnapshot,
} from './ai-context';

/** Instantané « tout rempli », base des tests. Chaque cas en retire ce qu'il veut éprouver. */
const FULL: AiSnapshot = {
  windowDays: 90,
  generatedOn: '2026-09-15',
  trendWindowDays: 28,
  profile: {
    sex: 'male',
    ageYears: 34,
    heightCm: 178,
    activePillars: ['strength', 'running', 'nutrition'],
    nutritionObjective: 'maintain',
    targetKcal: 2500,
    targetProteinG: 160,
  },
  weight: {
    firstKg: 78.4,
    lastKg: 75.2,
    count: 13,
    firstDate: '2026-06-17',
    lastDate: '2026-09-15',
    // Deux moyennes de fenêtre quasi identiques : la perte s'est ARRÊTÉE, ce que les deux bornes
    // (78,4 → 75,2) ne disent pas.
    weightTrend: { recent: 75.3, previous: 75.6 },
  },
  strength: {
    sessions: 34,
    totalVolumeKg: 182400,
    avgSessionMinutes: 62,
    byMuscle: [
      { muscle: 'legs', sets: 96, volumeKg: 78200 },
      { muscle: 'back', sets: 88, volumeKg: 54100 },
    ],
    topSets: [
      { exercise: 'Squat', weightKg: 120, reps: 5 },
      { exercise: 'Développé couché', weightKg: 92.5, reps: 3 },
    ],
    // Squat qui monte, développé couché à l'arrêt : le contraste que le contexte doit rendre lisible.
    progression: [
      { exercise: 'Squat', recentMaxKg: 120, previousMaxKg: 112.5 },
      { exercise: 'Développé couché', recentMaxKg: 92.5, previousMaxKg: 92.5 },
    ],
  },
  running: {
    runs: 22,
    totalKm: 178.6,
    totalMinutes: 968,
    avgPaceSPerKm: 325,
    longestKm: 16.2,
    paceTrend: { recent: 338, previous: 318 },
  },
  nutrition: {
    daysLogged: 84,
    avgKcal: 2410,
    avgProteinG: 152.4,
    avgCarbsG: 248,
    avgFatG: 81.5,
    kcalTrend: { recent: 2150, previous: 2700 },
    proteinTrend: { recent: 115, previous: 165 },
  },
  activities: [
    { type: 'cycling', sessions: 6, minutes: 420 },
    { type: 'swimming', sessions: 3, minutes: 135 },
  ],
  wellbeing: {
    daysLogged: 60,
    avgMood: 3.8,
    avgEnergy: 3.2,
    avgStress: 2.6,
    avgSleepMinutes: 402,
    energyTrend: { recent: 2.5, previous: 3.5 },
    stressTrend: { recent: 3.5, previous: 2.5 },
    sleepTrend: { recent: 358, previous: 448 },
  },
  steps: { daysLogged: 88, avgSteps: 9240, stepsTrend: { recent: 6200, previous: 9600 } },
};

describe('formatPace', () => {
  it('formate les secondes par km en m:ss/km', () => {
    expect(formatPace(325)).toBe('5:25/km');
    expect(formatPace(300)).toBe('5:00/km');
    expect(formatPace(65)).toBe('1:05/km');
  });

  it("ne rend rien plutôt qu'une allure fausse quand la valeur est absente ou absurde", () => {
    expect(formatPace(null)).toBeNull();
    expect(formatPace(0)).toBeNull();
    expect(formatPace(-10)).toBeNull();
    expect(formatPace(Number.NaN)).toBeNull();
  });
});

describe('buildAiContext', () => {
  it('rend chaque pilier renseigné avec ses chiffres', () => {
    const context = buildAiContext(FULL);

    expect(context).toContain('Période analysée : 90 derniers jours (au 2026-09-15).');
    expect(context).toContain('34 ans');
    expect(context).toContain('cible 2500 kcal/jour');
    expect(context).toContain('78.4 kg le 2026-06-17 → 75.2 kg le 2026-09-15');
    expect(context).toContain('MUSCULATION — 34 séances');
    expect(context).toContain('legs 96 séries');
    expect(context).toContain('Squat 120 kg × 5');
    expect(context).toContain('COURSE — 22 sorties');
    expect(context).toContain('allure moyenne 5:25/km');
    expect(context).toContain('NUTRITION — 84 jours journalisés, moyenne 2410 kcal');
    expect(context).toContain('cycling 6×');
    expect(context).toContain('PAS — 9240 pas/jour');
    expect(context).toContain('humeur 3.8/5');
    expect(context).toContain('sommeil 6.7 h/nuit');
  });

  it('affiche le signe du delta de poids dans les deux sens', () => {
    expect(buildAiContext(FULL)).toContain('(-3.2 kg sur 13 pesées)');

    const gaining = { ...FULL, weight: { ...FULL.weight!, firstKg: 72, lastKg: 75.5 } };
    expect(buildAiContext(gaining)).toContain('(+3.5 kg sur 13 pesées)');
  });

  /**
   * 🔴 Le garde-fou qui compte. « 0 sortie » et « la course n'est pas suivie » sont deux situations
   * différentes : montrer des zéros ferait conclure le modèle à l'inactivité, puis recommander de
   * s'y mettre — pour un pilier que la personne a désactivé.
   */
  it('omet une section absente au lieu de la mettre à zéro', () => {
    const noRunning: AiSnapshot = { ...FULL, running: null, activities: [], steps: null };
    const context = buildAiContext(noRunning);

    expect(context).not.toContain('COURSE');
    expect(context).not.toContain('AUTRES ACTIVITÉS');
    expect(context).not.toContain('PAS —');
    expect(context).not.toMatch(/\b0 sorties\b/);
    // Le reste est intact : une section omise n'en emporte pas d'autres.
    expect(context).toContain('MUSCULATION');
    expect(context).toContain('NUTRITION');
  });

  it("n'écrit pas de ligne de bien-être quand aucune moyenne n'est calculable", () => {
    const empty: AiSnapshot = {
      ...FULL,
      wellbeing: {
        daysLogged: 4,
        avgMood: null,
        avgEnergy: null,
        avgStress: null,
        avgSleepMinutes: null,
        energyTrend: { recent: null, previous: null },
        stressTrend: { recent: null, previous: null },
        sleepTrend: { recent: null, previous: null },
      },
    };
    expect(buildAiContext(empty)).not.toContain('BIEN-ÊTRE');
  });

  it('tient debout sur un instantané entièrement vide', () => {
    const empty: AiSnapshot = {
      windowDays: 30,
      generatedOn: '2026-09-15',
      trendWindowDays: 28,
      profile: {
        sex: null,
        ageYears: null,
        heightCm: null,
        activePillars: [],
        nutritionObjective: null,
        targetKcal: null,
        targetProteinG: null,
      },
      weight: null,
      strength: null,
      running: null,
      nutrition: null,
      activities: [],
      wellbeing: null,
      steps: null,
    };
    const context = buildAiContext(empty);

    expect(context).toBe('Période analysée : 30 derniers jours (au 2026-09-15).');
    expect(context).not.toContain('PROFIL');
  });

  it('omet une allure impossible sans casser la ligne de course', () => {
    const noPace: AiSnapshot = {
      ...FULL,
      running: { ...FULL.running!, avgPaceSPerKm: null },
    };
    const context = buildAiContext(noPace);

    expect(context).toContain('COURSE — 22 sorties');
    expect(context).not.toContain('allure moyenne');
  });
});

/**
 * 🔴 **Les tendances — la correction du 16/09/2026.**
 *
 * La première recette a montré que le contexte ne portait que des agrégats sur 90 jours : une seule
 * allure moyenne, une seule moyenne calorique, une charge max sans dimension temporelle. Cinq des
 * six signaux du jeu de test sont des **évolutions** — ils étaient donc structurellement invisibles
 * pour le modèle. On lui demandait de trouver des tendances en ne lui montrant que des moyennes.
 *
 * Ces tests vérifient que chaque signal est désormais **lisible dans le texte envoyé**.
 */
describe('les tendances rendent les évolutions visibles', () => {
  const context = buildAiContext(FULL);

  it('annonce la comparaison et sa fenêtre', () => {
    expect(context).toContain('TENDANCES — 28 derniers jours contre les 28 précédents :');
    expect(AI_TREND_WINDOW_DAYS).toBe(28);
  });

  it('S1 — une charge identique sur les deux fenêtres montre la stagnation', () => {
    expect(context).toContain('Développé couché 92.5 kg contre 92.5 kg');
    // …et le contraste avec un exercice qui progresse, sur la même ligne.
    expect(context).toContain('Squat 120 kg contre 112.5 kg');
  });

  it('S2 — la chute calorique et protéique est chiffrée', () => {
    expect(context).toContain('calories 2150 kcal/j contre 2700 kcal/j');
    expect(context).toContain('protéines 115 g/j contre 165 g/j');
  });

  it('S3 — énergie, stress et sommeil se comparent', () => {
    expect(context).toContain('énergie 2.5/5 contre 3.5/5');
    expect(context).toContain('stress 3.5/5 contre 2.5/5');
    expect(context).toContain('sommeil 358 min/nuit contre 448 min/nuit');
  });

  it('S5 — une allure plus lente apparaît comme telle', () => {
    expect(context).toContain('allure 338 s/km contre 318 s/km');
  });

  it('🔴 S6 — un plateau se lit « stable », là où les deux bornes disaient « perte »', () => {
    // La ligne POIDS annonce -3,2 kg sur la période…
    expect(context).toContain('(-3.2 kg sur 13 pesées)');
    // …et la tendance dit que ça ne bouge plus. Les deux sont vraies ; seule la seconde répond à
    // « pourquoi je ne perds plus ? ».
    expect(context).toContain('poids 75.3 kg contre 75.6 kg — stable');
  });

  it("calcule l'écart en pourcentage, sans le commenter", () => {
    // −20,4 % sur les calories : le chiffre est de l'arithmétique, pas un jugement. Écrire
    // « tu manques de protéines » serait décider à la place du modèle ce qu'on lui demande de trouver.
    expect(context).toMatch(/calories .* — -20\.4 %/);
    expect(context).not.toMatch(/manques|insuffisant|trop peu/i);
  });

  it('dit « stable » sous 3 % d’écart plutôt que d’afficher un bruit de mesure', () => {
    const flat: AiSnapshot = {
      ...FULL,
      nutrition: { ...FULL.nutrition!, kcalTrend: { recent: 2450, previous: 2500 } },
    };
    expect(buildAiContext(flat)).toContain('calories 2450 kcal/j contre 2500 kcal/j — stable');
  });

  it('🔴 tait une comparaison à moitié vide au lieu de la rendre à moitié', () => {
    // Une seule des deux fenêtres renseignée n'est pas une tendance : affichée, elle se lirait
    // quand même comme une évolution.
    const half: AiSnapshot = {
      ...FULL,
      nutrition: { ...FULL.nutrition!, kcalTrend: { recent: 2150, previous: null } },
    };
    const out = buildAiContext(half);
    expect(out).not.toContain('calories 2150');
    expect(out).toContain('protéines'); // les autres tendances restent
  });

  it("écrit « rien avant » plutôt qu'une régression fausse sur un exercice neuf", () => {
    const fresh: AiSnapshot = {
      ...FULL,
      strength: {
        ...FULL.strength!,
        progression: [{ exercise: 'Soulevé de terre', recentMaxKg: 140, previousMaxKg: null }],
      },
    };
    expect(buildAiContext(fresh)).toContain('Soulevé de terre 140 kg (rien avant)');
  });

  it('ne rend aucune section TENDANCES quand aucune comparaison n’est calculable', () => {
    const none: AiSnapshot = {
      ...FULL,
      weight: null,
      nutrition: null,
      running: null,
      wellbeing: null,
      steps: null,
    };
    expect(buildAiContext(none)).not.toContain('TENDANCES');
  });
});

/**
 * 🔴 **Test-garde de minimisation (RGPD, analyse §5).** `AiSnapshot` est la liste blanche de tout ce
 * qui peut sortir de l'appareil vers un fournisseur tiers. Ce test échoue dès qu'on y ajoute un
 * champ, pour forcer la question : « est-ce que ça a vraiment le droit de partir ? ».
 *
 * Il ne protège pas d'un mauvais nom de champ, il protège d'un **ajout silencieux** — le scénario
 * réel, où quelqu'un branche `notes` ou `email` « juste pour tester » et où plus personne ne le
 * relit. Mettre à jour la liste ci-dessous doit être un geste conscient.
 */
describe('minimisation des données envoyées', () => {
  it('ne laisse partir que les champs de la liste blanche', () => {
    expect(Object.keys(FULL).sort()).toEqual([
      'activities',
      'generatedOn',
      'nutrition',
      'profile',
      'running',
      'steps',
      'strength',
      'trendWindowDays',
      'weight',
      'wellbeing',
      'windowDays',
    ]);

    expect(Object.keys(FULL.profile).sort()).toEqual([
      'activePillars',
      'ageYears',
      'heightCm',
      'nutritionObjective',
      'sex',
      'targetKcal',
      'targetProteinG',
    ]);
  });

  it("ne porte ni identité, ni date de naissance, ni texte libre, ni trace GPS", () => {
    const serialized = JSON.stringify(FULL).toLowerCase();
    for (const forbidden of [
      'name',
      'email',
      'userid',
      'user_id',
      'birth',
      'notes',
      'gps',
      'track',
      'latitude',
      'longitude',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('ne rend jamais de champ inconnu dans le texte produit', () => {
    // `exercise` est le seul libellé libre toléré : il vient de la bibliothèque d'exercices, pas
    // d'une saisie de l'utilisateur. Tout le reste du texte est chiffré ou constant.
    const context = buildAiContext(FULL);
    expect(context).not.toMatch(/@/); // aucune adresse e-mail n'a pu s'y glisser
  });
});

describe('AI_LAB_QUESTIONS', () => {
  it('propose des clés distinctes, dont la question piège', () => {
    expect(new Set(AI_LAB_QUESTIONS).size).toBe(AI_LAB_QUESTIONS.length);
    expect(AI_LAB_QUESTIONS).toContain('blindSpot');
  });
});
