/**
 * Non-régression du blocage de synchro trouvé en recette device du 01/08/2026.
 *
 * PowerSync stocke les colonnes `jsonb` en TEXT côté SQLite. Remontées telles quelles, elles
 * arrivaient dans Postgres comme des **chaînes JSON** :
 *  - `menstrual_daily_logs.symptoms` a un `check (jsonb_typeof(symptoms) = 'array')` → upload
 *    rejeté, opération rejouée en boucle, **file d'envoi bloquée** (plus rien ne monte ni ne
 *    descend, sans aucune erreur visible dans l'UI) ;
 *  - `foods.portions`, sans garde, se corrompait en silence.
 *
 * Le connecteur n'est pas testable de bout en bout sans PowerSync ni Supabase : on teste donc la
 * transformation, qui est la partie où était le bug.
 */
import { decodeJsonColumnsForTest as decodeJsonColumns } from '../connector';

describe('decodeJsonColumns', () => {
  it('déballe un tableau JSON stocké en texte (le cas qui bloquait la synchro)', () => {
    const out = decodeJsonColumns('menstrual_daily_logs', {
      flow: 'medium',
      symptoms: '["cramps","fatigue"]',
    });
    expect(out).toEqual({ flow: 'medium', symptoms: ['cramps', 'fatigue'] });
  });

  it('déballe un tableau vide — la corruption silencieuse de foods.portions', () => {
    const out = decodeJsonColumns('foods', { portions: '[]' });
    expect(out!.portions).toEqual([]);
    expect(typeof out!.portions).not.toBe('string');
  });

  it('déballe plusieurs colonnes de la même table', () => {
    const out = decodeJsonColumns('user_settings', {
      active_pillars: '["strength","nutrition"]',
      notifications: '{"records":true}',
      theme: 'dark',
    });
    expect(out).toEqual({
      active_pillars: ['strength', 'nutrition'],
      notifications: { records: true },
      theme: 'dark',
    });
  });

  it('laisse intactes les tables sans colonne JSON', () => {
    const data = { name: 'Séance A', duration: 3600 };
    expect(decodeJsonColumns('workouts', data)).toBe(data);
  });

  it('ne touche pas aux colonnes non déclarées', () => {
    const out = decodeJsonColumns('foods', { portions: '[]', name: '["pas du json"]' });
    expect(out!.name).toBe('["pas du json"]');
  });

  it('laisse passer une valeur déjà décodée', () => {
    const out = decodeJsonColumns('foods', { portions: [{ grams: 120 }] });
    expect(out!.portions).toEqual([{ grams: 120 }]);
  });

  it('laisse passer null sans le transformer', () => {
    const out = decodeJsonColumns('foods', { portions: null });
    expect(out!.portions).toBeNull();
  });

  it('laisse une chaîne illisible telle quelle plutôt que de bloquer la transaction', () => {
    const out = decodeJsonColumns('foods', { portions: 'pas du json' });
    expect(out!.portions).toBe('pas du json');
  });

  it('ne modifie pas l’objet source', () => {
    const data = { symptoms: '["cramps"]' };
    decodeJsonColumns('menstrual_daily_logs', data);
    expect(data.symptoms).toBe('["cramps"]');
  });

  it('gère opData absent', () => {
    expect(decodeJsonColumns('foods', undefined)).toBeUndefined();
  });

  it('déplie le document de silhouette avant son upload JSONB', () => {
    expect(
      decodeJsonColumns('user_settings', {
        body_visual_state: '{"version":1}',
      }),
    ).toEqual({ body_visual_state: { version: 1 } });
  });

  it('déplie le matériel du contexte musculation avant son upload JSONB', () => {
    expect(
      decodeJsonColumns('profiles', {
        strength_equipment: '["barbell","band"]',
        strength_session_minutes: 60,
      }),
    ).toEqual({
      strength_equipment: ['barbell', 'band'],
      strength_session_minutes: 60,
    });
  });

  it('deplie les priorites d entrainement avant leur upload JSONB', () => {
    expect(
      decodeJsonColumns('user_settings', {
        body_training_state: '{"version":1,"priorities":["arms"]}',
      }),
    ).toEqual({ body_training_state: { version: 1, priorities: ['arms'] } });
  });

  // Revue du chantier Labo (30/09/2026) : quatre tables écrivaient du jsonb en TEXT sans être
  // déclarées ici — le verdict figé d'une expérience (LABO-04) aurait été stocké en chaîne.
  it('déplie le protocole et le verdict figé d’une expérience du Labo', () => {
    expect(
      decodeJsonColumns('lab_experiments', {
        schedule: '["test","usual","usual","test"]',
        verdict: '{"status":"effect","delta":-4,"better":true,"testCount":4,"usualCount":5}',
        status: 'finished',
      }),
    ).toEqual({
      schedule: ['test', 'usual', 'usual', 'test'],
      verdict: { status: 'effect', delta: -4, better: true, testCount: 4, usualCount: 5 },
      status: 'finished',
    });
  });

  it('laisse un verdict figé à null (expérience close sans verdict)', () => {
    expect(decodeJsonColumns('lab_experiments', { status: 'finished', verdict: null })).toEqual({ status: 'finished', verdict: null });
  });

  it('déplie le plan d’allure d’une séance, les charges SBD et les entrées d’un repas prévu', () => {
    expect(decodeJsonColumns('sessions', { pacing_plan: '{"kind":"even"}' })).toEqual({ pacing_plan: { kind: 'even' } });
    expect(decodeJsonColumns('user_settings', { sbd_lifts: '{"squat":"e-1"}' })).toEqual({ sbd_lifts: { squat: 'e-1' } });
    expect(decodeJsonColumns('meal_plan_entries', { consumed_entry_ids: '["a","b"]' })).toEqual({ consumed_entry_ids: ['a', 'b'] });
  });
});
