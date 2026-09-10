import { describe, expect, it } from 'vitest';
import { parseSessionLine, SESSION_TEMPLATES } from './session-line';

describe('parseSessionLine — les formes d’un carnet d’entraînement', () => {
  it('🔴 lit la séance de référence de l’audit', () => {
    const out = parseSessionLine('2km ech + 6x400/200 + 1km rac');

    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('attendu ok');
    expect(out.segments).toEqual([
      {
        kind: 'warmup',
        reps: 1,
        fastDistanceM: 2000,
        fastDurationSeconds: null,
        recoveryDistanceM: null,
        recoveryDurationSeconds: null,
      },
      {
        kind: 'work',
        reps: 6,
        fastDistanceM: 400,
        fastDurationSeconds: null,
        recoveryDistanceM: 200,
        recoveryDurationSeconds: null,
      },
      {
        kind: 'cooldown',
        reps: 1,
        fastDistanceM: 1000,
        fastDurationSeconds: null,
        recoveryDistanceM: null,
        recoveryDurationSeconds: null,
      },
    ]);
  });

  it('lit les durées : minutes, secondes, chrono m:ss', () => {
    const out = parseSessionLine('15min ech + 3x2min/90s + 10min cd');

    if (!out.ok) throw new Error('attendu ok');
    expect(out.segments[0]).toMatchObject({ kind: 'warmup', fastDurationSeconds: 900 });
    expect(out.segments[1]).toMatchObject({
      kind: 'work',
      reps: 3,
      fastDurationSeconds: 120,
      recoveryDurationSeconds: 90,
    });
    expect(out.segments[2]).toMatchObject({ kind: 'cooldown', fastDurationSeconds: 600 });
  });

  it('lit un chrono en m:ss', () => {
    const out = parseSessionLine('3x1:30');

    if (!out.ok) throw new Error('attendu ok');
    expect(out.segments[0]).toMatchObject({ reps: 3, fastDurationSeconds: 90 });
  });

  it('accepte les espaces, les majuscules et les accents', () => {
    const a = parseSessionLine('2km ech + 6x400/200');
    const b = parseSessionLine('2 KM Échauffement  +  6 x 400 / 200');

    if (!a.ok || !b.ok) throw new Error('attendu ok');
    expect(b.segments).toEqual(a.segments);
  });

  it('accepte les mots anglais — la saisie est bilingue comme le reste (décision G)', () => {
    const fr = parseSessionLine('2km ech + 1km rac');
    const en = parseSessionLine('2km warmup + 1km cooldown');

    if (!fr.ok || !en.ok) throw new Error('attendu ok');
    expect(en.segments).toEqual(fr.segments);
  });

  it('une récupération est facultative', () => {
    const out = parseSessionLine('6x400');

    if (!out.ok) throw new Error('attendu ok');
    expect(out.segments[0]).toMatchObject({
      reps: 6,
      fastDistanceM: 400,
      recoveryDistanceM: null,
      recoveryDurationSeconds: null,
    });
  });

  it('la nature par défaut est le corps de séance', () => {
    const out = parseSessionLine('5km');

    if (!out.ok) throw new Error('attendu ok');
    expect(out.segments[0]!.kind).toBe('work');
  });

  it('une nature peut suivre un bloc de répétitions', () => {
    const out = parseSessionLine('4x30s gammes');

    if (!out.ok) throw new Error('attendu ok');
    expect(out.segments[0]).toMatchObject({ kind: 'drills', reps: 4, fastDurationSeconds: 30 });
  });

  it('lit une distance décimale, virgule ou point', () => {
    const virgule = parseSessionLine('1,5km');
    const point = parseSessionLine('1.5km');

    if (!virgule.ok || !point.ok) throw new Error('attendu ok');
    expect(virgule.segments[0]!.fastDistanceM).toBe(1500);
    expect(point.segments[0]!.fastDistanceM).toBe(1500);
  });
});

describe('parseSessionLine — tout ou rien (règle R8-1)', () => {
  it('🔴 refuse un nombre SANS unité plutôt que de deviner', () => {
    // « 400 » peut être 400 m ou 400 s. Deviner reviendrait à écrire une séance que
    // l'utilisateur n'a pas décrite.
    const out = parseSessionLine('2km ech + 400 + 1km rac');

    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('attendu échec');
    expect(out.token).toBe('400');
    expect(out.index).toBe(2);
  });

  it('🔴 n’écrit RIEN quand un seul bloc est illisible', () => {
    const out = parseSessionLine('2km ech + n’importe quoi + 1km rac');

    // Pas de structure partielle : l'utilisateur croirait avoir saisi sa séance.
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('attendu échec');
    expect(out).not.toHaveProperty('segments');
  });

  it('dit OÙ ça coince, pas seulement que ça coince', () => {
    const out = parseSessionLine('2km ech + 6x400/200 + zzz');

    if (out.ok) throw new Error('attendu échec');
    expect(out.token).toBe('zzz');
    expect(out.index).toBe(3);
  });

  it('refuse une récupération illisible plutôt que d’écrire un fractionné sans récup', () => {
    // Ignorer silencieusement la récup donnerait une autre séance.
    const out = parseSessionLine('6x400/zzz');

    expect(out.ok).toBe(false);
  });

  it('refuse une ligne vide', () => {
    expect(parseSessionLine('').ok).toBe(false);
    expect(parseSessionLine('   ').ok).toBe(false);
    expect(parseSessionLine('+++').ok).toBe(false);
  });

  it('refuse zéro répétition et une distance nulle', () => {
    expect(parseSessionLine('0x400').ok).toBe(false);
    expect(parseSessionLine('0km').ok).toBe(false);
  });

  it('refuse un nombre de répétitions absurde', () => {
    expect(parseSessionLine('200x400').ok).toBe(false);
  });
});

describe('SESSION_TEMPLATES', () => {
  it('🔴 les six modèles sont écrits dans la grammaire, donc modifiables à la main', () => {
    // Un modèle qui ne se relirait pas serait un modèle qu'on ne peut pas ajuster — c'est-à-dire
    // exactement le problème que les modèles doivent résoudre.
    for (const template of SESSION_TEMPLATES) {
      const out = parseSessionLine(template.line);
      expect(out.ok, `${template.id} : « ${template.line} » ne se relit pas`).toBe(true);
    }
  });

  it('reste un catalogue COURT — un catalogue long redevient un écran à parcourir', () => {
    expect(SESSION_TEMPLATES.length).toBeLessThanOrEqual(8);
  });

  it('chaque modèle a un identifiant unique', () => {
    const ids = SESSION_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('chaque modèle produit au moins deux segments — sinon ce n’est pas une séance', () => {
    for (const template of SESSION_TEMPLATES) {
      const out = parseSessionLine(template.line);
      if (!out.ok) throw new Error(`${template.id} illisible`);
      expect(out.segments.length).toBeGreaterThanOrEqual(2);
    }
  });
});
