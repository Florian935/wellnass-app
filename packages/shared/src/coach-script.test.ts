import { describe, expect, it } from 'vitest';

import { COACH_EVENTS, parseCoachCharacter, pickCoachLine } from './coach-script';

describe('script du coach', () => {
  it('compose une clé i18n avec sa variante et ses variables', () => {
    expect(
      pickCoachLine({ event: 'verdict', character: 'motivant', variant: 'heavier', vars: { delta: '2,5 kg', day: 'mardi' } }),
    ).toEqual({ key: 'coach.motivant.verdict.heavier', vars: { delta: '2,5 kg', day: 'mardi' } });
  });

  it('ne dit jamais rien en muet, quel que soit le moment', () => {
    for (const event of COACH_EVENTS) {
      expect(pickCoachLine({ event, character: 'muet' })).toBeNull();
    }
  });

  it('en sobre, garde les chiffres et laisse tomber l\'accompagnement', () => {
    expect(pickCoachLine({ event: 'verdict', character: 'sobre', variant: 'heavier' })?.key).toBe(
      'coach.sobre.verdict.heavier',
    );
    expect(pickCoachLine({ event: 'setCue', character: 'sobre' })).toBeNull();
    expect(pickCoachLine({ event: 'sessionEnd', character: 'sobre' })).toBeNull();
    expect(pickCoachLine({ event: 'brief', character: 'sobre' })).toBeNull();
  });

  it('ne contient aucun texte affichable — uniquement des clés', () => {
    const line = pickCoachLine({ event: 'record', character: 'motivant', variant: 'maxWeight' });
    expect(line?.key.startsWith('coach.')).toBe(true);
    expect(line?.key).not.toMatch(/\s/);
  });

  it('retombe sur « motivant » devant une préférence illisible', () => {
    expect(parseCoachCharacter('sobre')).toBe('sobre');
    expect(parseCoachCharacter('bavard')).toBe('motivant');
    expect(parseCoachCharacter(null)).toBe('motivant');
  });
});
