import { assertOwnedCustomExercise } from '../exercise-repository';

// `exercise-repository` importe (via `@/stores/auth-store`) le module `@/lib/supabase`,
// qui lève à l'import si les variables d'environnement EXPO_PUBLIC_* sont absentes
// (cas de jest : le `.env` n'est pas chargé). La garde testée ici est **pure** et ne
// touche ni Supabase ni PowerSync ; on neutralise donc ce module (le `jest.mock` est
// hissé au-dessus des imports par jest) en fournissant le minimum utilisé au
// chargement par auth-store (`getSession`, `onAuthStateChange`).
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
  },
}));

describe('assertOwnedCustomExercise', () => {
  const U = 'user-1';
  it('accepte un exo perso de l’utilisateur', () => {
    expect(() =>
      assertOwnedCustomExercise({ source: 'custom', owner_id: 'user-1' }, U),
    ).not.toThrow();
  });
  it('refuse un exo de bibliothèque', () => {
    expect(() =>
      assertOwnedCustomExercise({ source: 'library', owner_id: null }, U),
    ).toThrow();
  });
  it('refuse l’exo perso d’un autre utilisateur', () => {
    expect(() =>
      assertOwnedCustomExercise({ source: 'custom', owner_id: 'user-2' }, U),
    ).toThrow();
  });
  it('refuse un exo introuvable (null)', () => {
    expect(() => assertOwnedCustomExercise(null, U)).toThrow();
  });
});
