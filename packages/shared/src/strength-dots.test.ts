import { describe, expect, it } from 'vitest';
import { bodyweightNearest, dotsScore, type BodyweightEntry } from './strength-dots';

/**
 * ⚠️ **Ce que ce fichier prouve, et ce qu'il ne prouve pas.**
 *
 * Les coefficients du DOTS viennent de l'extérieur du projet et n'ont pas pu être confrontés à une
 * source officielle (spec §4, point de vigilance). Un test à valeur figée ne peut donc pas établir
 * leur justesse — il détecterait seulement une régression. Ce fichier sépare explicitement :
 *
 *  - les **propriétés structurelles** (monotonie, sens de la normalisation, bornes, refus) : elles
 *    resteront vraies même si un coefficient est corrigé, et elles attrapent les erreurs de logique ;
 *  - les **valeurs figées** : détecteur de régression, marqué comme tel. Leur validation demande une
 *    relecture humaine (critère de recette 21).
 */

describe('dotsScore — propriétés structurelles (vraies quels que soient les coefficients)', () => {
  it('à poids égal, plus de total donne plus de score', () => {
    const light = dotsScore(400, 90, 'male')!;
    const heavy = dotsScore(500, 90, 'male')!;
    expect(heavy).toBeGreaterThan(light);
  });

  it('à total égal, plus lourd donne MOINS de score — c’est tout l’objet du DOTS', () => {
    // La normalisation existe pour qu'un total de 500 kg à 70 kg « vaille » plus que le même total
    // à 110 kg. Si ce test s'inverse, le score dit le contraire de ce qu'il prétend.
    const lightAthlete = dotsScore(500, 70, 'male')!;
    const heavyAthlete = dotsScore(500, 110, 'male')!;
    expect(lightAthlete).toBeGreaterThan(heavyAthlete);
  });

  it('est proportionnel au total à poids et sexe constants', () => {
    // Le total n'intervient qu'en facteur : doubler le total double le score.
    const single = dotsScore(250, 80, 'female')!;
    const double = dotsScore(500, 80, 'female')!;
    expect(double).toBeCloseTo(single * 2, 6);
  });

  it('donne des scores différents pour les deux sexes à total et poids égaux', () => {
    // Les deux jeux de coefficients doivent être réellement distincts (une erreur de copier-coller
    // les rendrait identiques, et le score serait faux pour l'un des deux).
    expect(dotsScore(400, 75, 'male')).not.toBeCloseTo(dotsScore(400, 75, 'female')!, 3);
  });

  it('reste dans un ordre de grandeur crédible pour un total réaliste', () => {
    // Garde-fou grossier mais utile : un DOTS de pratiquant se compte en centaines, pas en milliers
    // ni en unités. Une erreur d'échelle sur un coefficient sortirait de cette fourchette.
    const score = dotsScore(500, 90, 'male')!;
    expect(score).toBeGreaterThan(100);
    expect(score).toBeLessThan(1000);
  });

  it('borne le poids de corps au lieu de diverger (poids extrêmes)', () => {
    // Le terme en bw⁴ est négatif : hors bornes, le dénominateur s'effondre et le score
    // exploserait. On borne, donc un poids sous le minimum donne le même score que le minimum.
    expect(dotsScore(300, 30, 'male')).toBeCloseTo(dotsScore(300, 40, 'male')!, 6);
    expect(dotsScore(300, 400, 'male')).toBeCloseTo(dotsScore(300, 210, 'male')!, 6);
    expect(dotsScore(300, 400, 'female')).toBeCloseTo(dotsScore(300, 150, 'female')!, 6);
  });

  it('reste fini et positif sur toute la plage de poids valide', () => {
    for (const sex of ['male', 'female'] as const) {
      for (let bw = 40; bw <= 150; bw += 5) {
        const score = dotsScore(400, bw, sex);
        expect(score).not.toBeNull();
        expect(Number.isFinite(score!)).toBe(true);
        expect(score!).toBeGreaterThan(0);
      }
    }
  });
});

describe('dotsScore — refus explicites', () => {
  it('rend null sans sexe renseigné (R6)', () => {
    // Il n'existe pas de coefficients neutres. Inventer un sexe serait faux ET intrusif.
    expect(dotsScore(500, 90, 'unspecified')).toBeNull();
  });

  it('rend null sans poids de corps', () => {
    expect(dotsScore(500, null, 'male')).toBeNull();
    expect(dotsScore(500, undefined, 'male')).toBeNull();
    expect(dotsScore(500, 0, 'male')).toBeNull();
    expect(dotsScore(500, -70, 'male')).toBeNull();
  });

  it('rend null sans total', () => {
    expect(dotsScore(null, 90, 'male')).toBeNull();
    expect(dotsScore(undefined, 90, 'male')).toBeNull();
    expect(dotsScore(0, 90, 'male')).toBeNull();
    expect(dotsScore(-100, 90, 'male')).toBeNull();
  });

  it('rend null sur des valeurs non finies plutôt que NaN', () => {
    expect(dotsScore(Number.NaN, 90, 'male')).toBeNull();
    expect(dotsScore(500, Number.NaN, 'male')).toBeNull();
    expect(dotsScore(Number.POSITIVE_INFINITY, 90, 'male')).toBeNull();
  });
});

describe('dotsScore — valeurs figées (détecteur de RÉGRESSION, pas preuve de justesse)', () => {
  // ⚠️ Ces nombres sont dérivés des coefficients inscrits dans l'implémentation. Ils garantissent
  // qu'une modification involontaire du calcul sera détectée — ils NE garantissent PAS que les
  // coefficients eux-mêmes sont les bons. Cette validation-là est humaine (critère de recette 21).
  it('homme, 100 kg de poids de corps, total 500 kg', () => {
    expect(dotsScore(500, 100, 'male')).toBeCloseTo(307.7579, 3);
  });

  it('homme, 75 kg de poids de corps, total 500 kg', () => {
    // Même total, athlète plus léger : le score doit être nettement supérieur au cas précédent.
    expect(dotsScore(500, 75, 'male')).toBeCloseTo(358.711, 3);
  });

  it('femme, 60 kg de poids de corps, total 300 kg', () => {
    expect(dotsScore(300, 60, 'female')).toBeCloseTo(332.5637, 3);
  });
});

describe('bodyweightNearest (R7)', () => {
  const entries: BodyweightEntry[] = [
    { logDate: '2026-01-10', weightKg: 75 },
    { logDate: '2026-04-15', weightKg: 79 },
    { logDate: '2026-07-28', weightKg: 82.4 },
  ];

  it('retient la pesée la plus proche de la date du record, pas la plus récente', () => {
    // Un total réalisé en avril se normalise avec le poids d'avril, pas avec celui de juillet.
    expect(bodyweightNearest(entries, '2026-04-20')).toEqual({
      logDate: '2026-04-15',
      weightKg: 79,
    });
  });

  it('accepte une pesée POSTÉRIEURE au record si elle est la plus proche', () => {
    // Cas réel : on se pèse le lendemain d'une performance, pas la veille.
    expect(bodyweightNearest(entries, '2026-07-25')?.logDate).toBe('2026-07-28');
  });

  it('retient la plus ancienne à distance égale, de façon déterministe', () => {
    const tie: BodyweightEntry[] = [
      { logDate: '2026-01-01', weightKg: 70 },
      { logDate: '2026-01-03', weightKg: 72 },
    ];
    expect(bodyweightNearest(tie, '2026-01-02')?.logDate).toBe('2026-01-01');
  });

  it('rend null sans aucune pesée', () => {
    expect(bodyweightNearest([], '2026-04-20')).toBeNull();
  });

  it('ignore les pesées aberrantes', () => {
    const dirty: BodyweightEntry[] = [
      { logDate: '2026-04-14', weightKg: 0 },
      { logDate: '2026-04-14', weightKg: -80 },
      { logDate: '2026-04-14', weightKg: Number.NaN },
      { logDate: '2026-01-10', weightKg: 75 },
    ];
    expect(bodyweightNearest(dirty, '2026-04-15')?.weightKg).toBe(75);
  });

  it('ignore les dates illisibles', () => {
    const dirty: BodyweightEntry[] = [
      { logDate: 'pas-une-date', weightKg: 99 },
      { logDate: '2026-01-10', weightKg: 75 },
    ];
    expect(bodyweightNearest(dirty, '2026-01-11')?.weightKg).toBe(75);
  });

  it('rend null si la date cible est illisible', () => {
    expect(bodyweightNearest(entries, 'pas-une-date')).toBeNull();
  });

  it('accepte un horodatage complet comme date cible', () => {
    // `personal_records.achieved_at` est un timestamptz, pas une clé de jour.
    expect(bodyweightNearest(entries, '2026-07-28T18:42:00.000Z')?.weightKg).toBe(82.4);
  });
});
