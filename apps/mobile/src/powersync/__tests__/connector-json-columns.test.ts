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
});
