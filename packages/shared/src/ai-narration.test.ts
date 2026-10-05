import { describe, it, expect } from 'vitest';
import {
  BILAN_MAX_CHARS,
  bilanNumbers,
  buildBilanPrompt,
  buildNarrationPrompt,
  checkNarration,
  dossierNumbers,
  expandAllowedNumbers,
  extractNumbers,
  NARRATION_MAX_CHARS,
  type BilanDossier,
  type NarrationDossier,
} from './ai-narration';

/**
 * US NARR-01 — le garde-fou qui empêche un modèle d'inventer un chiffre.
 *
 * Deux exigences opposées, et c'est tout l'intérêt : **attraper l'invention** (sinon la surface ne
 * peut pas exister dans une app qui affiche des chiffres de santé) et **ne pas rejeter un résumé
 * juste** (sinon personne ne garde le garde-fou branché huit jours). Les tests couvrent les deux
 * faces, et surtout la seconde — les écritures différentes d'une même valeur.
 */

const DOSSIER: NarrationDossier = {
  headline: 'Développé couché : 80 kg depuis 4 semaines',
  facts: [
    {
      label: 'Assiette × Muscu',
      detail: 'Glucides −34 % les jours de push',
      values: [0.34, 210, 318],
    },
    {
      label: 'Sommeil',
      detail: '6 h 05 avant un push, 7 h 20 les autres nuits',
      values: [365, 440],
    },
  ],
  cleared: ['Volume pectoraux — 12 séries/semaine, stable'],
  missing: ['Stress — moins de 5 saisies'],
  experiment: 'Push le mercredi pendant 3 semaines',
};

describe('extractNumbers', () => {
  it('lit les entiers et les décimales, à la française comme à l’anglaise', () => {
    expect(extractNumbers('82,5 kg puis 82.5 kg')).toEqual([82.5, 82.5]);
  });

  it('ignore le signe : on vérifie des grandeurs, pas des sens', () => {
    expect(extractNumbers('−34 % et +12 %')).toEqual([34, 12]);
  });

  it('recolle les milliers séparés par une espace', () => {
    // « 12 480 kg » ne doit pas devenir 12 puis 480 : on chercherait alors deux nombres qui
    // n'existent nulle part, et on rejetterait un résumé parfaitement juste.
    expect(extractNumbers('12 480 kg de volume')).toEqual([12480]);
    expect(extractNumbers('12 480 kg')).toEqual([12480]);
  });

  it('décompose les formes composées d’un coach', () => {
    expect(extractNumbers('5:32/km')).toEqual([5, 32]);
    expect(extractNumbers('6 h 05')).toEqual([6, 5]);
  });

  it('ne voit pas les nombres écrits en toutes lettres — et c’est assumé', () => {
    expect(extractNumbers('pendant trois semaines')).toEqual([]);
  });
});

describe('expandAllowedNumbers — ne pas rejeter un résumé juste', () => {
  it('🔴 un ratio se lit en pourcentage', () => {
    // Le dossier porte 0,34 ; le modèle écrira « 34 % ». Sans cette équivalence, le garde-fou
    // rejetterait la quasi-totalité des résumés justes.
    expect(expandAllowedNumbers([0.34])).toContain(34);
  });

  it('admet l’arrondi à l’entier et à la décimale', () => {
    const allowed = expandAllowedNumbers([82.47]);
    expect(allowed).toContain(82);
    expect(allowed).toContain(82.5);
  });

  it('une durée décimale se lit en minutes et secondes', () => {
    // 5,53 min ↔ « 5:32 » : la partie entière et les secondes doivent être admises.
    const allowed = expandAllowedNumbers([5.53]);
    expect(allowed).toContain(5);
    expect(allowed).toContain(32);
  });

  it('🔴 n’élargit pas au point d’autoriser n’importe quoi', () => {
    // 82 ne doit PAS autoriser 8 200 : l'équivalence pourcentage ne vaut que pour les petits ratios.
    expect(expandAllowedNumbers([82])).not.toContain(8200);
  });
});

describe('checkNarration — le verdict', () => {
  const allowed = dossierNumbers(DOSSIER);

  it('accepte un résumé qui ne cite que des chiffres du dossier', () => {
    const verdict = checkNarration(
      'Tes glucides chutent de 34 % les jours de push, et tu dors 6 h 05 avant ces séances. ' +
        'Le volume, lui, est stable.',
      allowed,
    );
    expect(verdict.ok).toBe(true);
  });

  it('🔴 refuse un chiffre inventé, et dit lequel', () => {
    // LE cas qui justifie toute l'US : le dossier porte 34 %, le modèle écrit 45 %.
    const verdict = checkNarration(
      'Tes glucides chutent de 45 % les jours de push, ce qui explique le plateau.',
      allowed,
    );
    expect(verdict).toEqual({ ok: false, reason: 'unknownNumber', offending: 45 });
  });

  it('🔴 le refus est TOTAL : une seule invention jette tout le texte', () => {
    const verdict = checkNarration(
      'Tes glucides chutent de 34 % les jours de push, et ton volume a baissé de 18 %.',
      allowed,
    );
    // Garder la première phrase demanderait au lecteur de deviner laquelle est fiable.
    expect(verdict.ok).toBe(false);
  });

  it('refuse une réponse vide ou tronquée', () => {
    expect(checkNarration('', allowed)).toEqual({ ok: false, reason: 'invalid' });
    expect(checkNarration('Tes glucides', allowed)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('refuse un résumé qui ne résume pas', () => {
    const verdict = checkNarration('a'.repeat(NARRATION_MAX_CHARS + 1), allowed);
    expect(verdict).toEqual({ ok: false, reason: 'invalid' });
  });

  it('accepte un texte sans aucun chiffre', () => {
    const verdict = checkNarration(
      'Trois pistes se dégagent, et le volume a été vérifié sans rien montrer d’anormal.',
      allowed,
    );
    expect(verdict.ok).toBe(true);
  });

  it('tolère l’arrondi d’une grande valeur', () => {
    const verdict = checkNarration(
      'Tu manges 318 g de glucides les autres jours, contre 210 g les jours de push.',
      allowed,
    );
    expect(verdict.ok).toBe(true);
  });
});

describe('buildNarrationPrompt', () => {
  it('met tout le dossier dans le contexte, écartés et non jugeables compris', () => {
    const { context } = buildNarrationPrompt(DOSSIER, 'fr');

    expect(context).toContain('Développé couché : 80 kg depuis 4 semaines');
    expect(context).toContain('Glucides −34 % les jours de push');
    // Les pistes écartées font partie du dossier : les taire ferait raconter une histoire plus
    // simple que la réalité, ce qui est exactement ce que la fonctionnalité refuse.
    expect(context).toContain('Volume pectoraux');
    expect(context).toContain('Stress');
    expect(context).toContain('Push le mercredi');
  });

  it('🔴 la consigne interdit d’inventer et de conclure à une cause', () => {
    const { question } = buildNarrationPrompt(DOSSIER, 'fr');

    expect(question).toContain('QUE les chiffres');
    expect(question).toContain('pas des preuves');
  });

  it('bascule en anglais', () => {
    const { context, question } = buildNarrationPrompt(DOSSIER, 'en');

    expect(context).toContain('FINDING:');
    expect(context).toContain('RULED OUT');
    expect(question).toContain('ONLY the numbers');
  });

  it('omet proprement les sections vides', () => {
    const { context } = buildNarrationPrompt(
      { ...DOSSIER, cleared: [], missing: [], experiment: null },
      'fr',
    );

    expect(context).not.toContain('ÉCARTÉES');
    expect(context).not.toContain('NON JUGEABLES');
    expect(context).not.toContain('EXPÉRIENCE');
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// US PRISME-01 — le garde-fou en anglais, la longueur par usage, et les bilans de Prisme
// ───────────────────────────────────────────────────────────────────────────────────────────────

describe('extractNumbers — en anglais, la virgule des milliers (PRISME-01 R3)', () => {
  it('🔴 lit « 12,480 » comme douze mille quatre cent quatre-vingts', () => {
    // Sans ça, un « 12,900 kg » inventé devient 12,9 : à 0,42 de 12,48, sous la tolérance d'arrondi,
    // donc accepté. La faille n'existe qu'en anglais, où la virgule sépare les milliers.
    expect(extractNumbers('12,480 kg', 'en')).toEqual([12480]);
    expect(extractNumbers('1,234,567 steps', 'en')).toEqual([1234567]);
  });

  it('garde la décimale à point, et une virgule suivie de deux chiffres reste décimale', () => {
    expect(extractNumbers('82.5 kg then 12,48', 'en')).toEqual([82.5, 12.48]);
  });

  it('ne change rien en français, langue par défaut', () => {
    expect(extractNumbers('12,480 kg')).toEqual([12.48]);
    expect(extractNumbers('12,480 kg', 'fr')).toEqual([12.48]);
  });
});

describe('checkNarration — langue et longueur par usage', () => {
  it('🔴 en anglais, refuse « 12,900 kg » quand le dossier porte 12 480', () => {
    const allowed = [12480, 4];
    expect(checkNarration('You lifted 12,480 kg over 4 sessions this week.', allowed, { lang: 'en' }).ok).toBe(true);
    expect(checkNarration('You lifted 12,900 kg over 4 sessions this week.', allowed, { lang: 'en' })).toEqual({
      ok: false,
      reason: 'unknownNumber',
      offending: 12900,
    });
  });

  it('un bilan a droit à plus de place qu’un résumé de dossier', () => {
    const text = 'Une journée calme et régulière, sans rien à signaler de particulier. '.repeat(7);
    expect(text.length).toBeGreaterThan(NARRATION_MAX_CHARS);
    expect(text.length).toBeLessThanOrEqual(BILAN_MAX_CHARS);
    expect(checkNarration(text, []).ok).toBe(false);
    expect(checkNarration(text, [], { maxChars: BILAN_MAX_CHARS }).ok).toBe(true);
  });
});

const EVENING: BilanDossier = {
  headline: 'Ta journée du vendredi 2 octobre',
  facts: [
    { label: 'Séance de musculation', detail: '52 min, 8420 kg, 18 séries sur 18', values: [52, 8420, 18, 18] },
    {
      label: 'Assiette',
      detail: '2140 kcal sur 2450, protéines 118 g sur 150 g, il manque 32 g',
      values: [2140, 2450, 118, 150, 32],
    },
  ],
  decision: null,
  realLife: false,
};

const WEEK: BilanDossier = {
  headline: 'Ta semaine du 21 au 27 septembre',
  facts: [{ label: 'Course', detail: '2 sorties, 31,5 km (+12 %)', values: [2, 31.5, 12] }],
  decision: 'Point fort : ta régularité, 5 jours actifs sur 7.',
  realLife: false,
};

describe('bilanNumbers — tout ce que le modèle a sous les yeux, et rien d’autre', () => {
  it('lit le titre, le texte des faits, leurs valeurs et la décision', () => {
    const allowed = bilanNumbers(WEEK);
    expect(allowed).toEqual(expect.arrayContaining([21, 27, 2, 31.5, 12, 5, 7]));
  });

  it('🔴 en anglais, le dossier se relit en anglais : « 12,480 kg » n’autorise pas 12 (R3)', () => {
    const english: BilanDossier = {
      headline: 'Your day on Friday',
      facts: [{ label: 'Strength session', detail: '12,480 kg lifted', values: [12480] }],
      decision: null,
      realLife: false,
    };
    // Relu à la française, « 12,480 » ajoutait 12,48 — donc 12 — aux nombres permis : un « 12 kg de
    // plus » inventé passait.
    expect(bilanNumbers(english, 'en')).not.toContain(12.48);
    expect(checkNarration('You lifted 12 kg more than last time.', bilanNumbers(english, 'en'), { lang: 'en' }).ok).toBe(
      false,
    );
    expect(checkNarration('You lifted 12,480 kg.', bilanNumbers(english, 'en'), { lang: 'en' }).ok).toBe(true);
  });

  it('🔴 une différence absente du dossier est refusée, même juste (spec R5)', () => {
    const withoutGap: BilanDossier = {
      ...EVENING,
      facts: [{ label: 'Assiette', detail: 'protéines 118 g sur 150 g', values: [118, 150] }],
    };
    // 150 − 118 = 32 : juste, mais calculé par le modèle. Le garde-fou ne sait pas vérifier un
    // calcul ; il ne laisse passer que ce que le moteur a fourni.
    const verdict = checkNarration('Il te manque 32 g de protéines ce soir.', bilanNumbers(withoutGap));
    expect(verdict).toEqual({ ok: false, reason: 'unknownNumber', offending: 32 });
    expect(checkNarration('Il te manque 32 g de protéines ce soir.', bilanNumbers(EVENING)).ok).toBe(true);
  });
});

describe('buildBilanPrompt — les bilans de Prisme', () => {
  it('met le titre et chaque fait dans le contexte', () => {
    const { context } = buildBilanPrompt(EVENING, 'fr', 'evening');
    expect(context).toContain('Ta journée du vendredi 2 octobre');
    expect(context).toContain('Séance de musculation');
    expect(context).toContain('il manque 32 g');
  });

  it('🔴 interdit d’inventer un chiffre et d’en calculer un', () => {
    const { question } = buildBilanPrompt(EVENING, 'fr', 'evening');
    expect(question).toContain('QUE les chiffres');
    expect(question).toContain('Ne calcule aucun');
  });

  it('la semaine porte la décision du moteur, et le modèle n’en propose pas d’autre (R16)', () => {
    const { context, question } = buildBilanPrompt(WEEK, 'fr', 'week');
    expect(context).toContain('DÉCISION DU BILAN : Point fort');
    expect(question).toContain('aucune autre recommandation');
  });

  it('une période « vie réelle » se raconte sans reproche (R12)', () => {
    expect(buildBilanPrompt({ ...EVENING, realLife: true }, 'fr', 'evening').question).toContain('aucun reproche');
    expect(buildBilanPrompt(EVENING, 'fr', 'evening').question).not.toContain('vie réelle');
  });

  it('bascule en anglais', () => {
    const { context, question } = buildBilanPrompt(WEEK, 'en', 'week');
    expect(context).toContain('ENGINE DECISION:');
    expect(question).toContain('ONLY the numbers');
    expect(question).toContain('Do not compute');
  });

  it('le soir en anglais, période « vie réelle » comprise', () => {
    const { context, question } = buildBilanPrompt({ ...EVENING, realLife: true }, 'en', 'evening');
    expect(context).toContain('SUMMARY:');
    expect(question).toContain('Tell this day');
    expect(question).toContain('no reproach');
  });
});
