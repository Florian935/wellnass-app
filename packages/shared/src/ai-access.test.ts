/**
 * US ACCES-IA — la règle de la bêta fermée (spec §14, critères 1 à 5).
 *
 * Le dernier bloc est le **test-garde** de la copie serveur : la fonction Edge `ai-assist` porte sa
 * propre copie de cette règle (elle ne partage pas le bundle de l'app). Une copie tenue de mémoire finit
 * par dériver — c'est ce qui guette `DAILY_QUOTA` ; celle-ci est comparée au caractère près.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { aiAccessAllows, aiGate, parseAiAccess, prismeStatusReason, type PrismeProviderState } from './ai-access';

describe('parseAiAccess — fermé par défaut (D1, R2)', () => {
  it.each(['open', ' Open ', 'OPEN', 'open\n'])('« %s » ouvre', (raw) => {
    expect(parseAiAccess(raw)).toBe('open');
  });

  it.each([undefined, null, '', '   ', 'ouvert', 'true', 'opened', 'testers', 'TESTERS'])(
    '« %s » ferme : seule « open » ouvre',
    (raw) => {
      expect(parseAiAccess(raw)).toBe('testers');
    },
  );
});

describe('aiAccessAllows — qui passe (R4)', () => {
  const MODEL_KINDS = ['narrate', 'meal_text', 'coach', 'photo', 'ask'];

  it.each(MODEL_KINDS)('mode testers, non-testeur : « %s » est refusé', (kind) => {
    expect(aiAccessAllows({ kind }, 'testers', false)).toBe(false);
  });

  it.each(MODEL_KINDS)('mode testers, testeur : « %s » passe', (kind) => {
    expect(aiAccessAllows({ kind }, 'testers', true)).toBe(true);
  });

  it.each(MODEL_KINDS)('mode open, non-testeur : « %s » passe', (kind) => {
    expect(aiAccessAllows({ kind }, 'open', false)).toBe(true);
  });

  it('status passe toujours — c’est lui qui dit « bêta fermée »', () => {
    expect(aiAccessAllows({ kind: 'status' }, 'testers', false)).toBe(true);
  });

  it('le retrait d’un accord passe toujours ; l’accorder exige d’être testeur', () => {
    expect(aiAccessAllows({ kind: 'consent', grant: false }, 'testers', false)).toBe(true);
    expect(aiAccessAllows({ kind: 'consent', grant: true }, 'testers', false)).toBe(false);
    expect(aiAccessAllows({ kind: 'consent', grant: true }, 'testers', true)).toBe(true);
  });

  it('un accord sans `grant`, ou avec la chaîne « false », est fermé — refusé avant d’être jugé mal formé', () => {
    expect(aiAccessAllows({ kind: 'consent' }, 'testers', false)).toBe(false);
    expect(aiAccessAllows({ kind: 'consent', grant: 'false' }, 'testers', false)).toBe(false);
  });

  it('un type d’appel inconnu naît fermé', () => {
    expect(aiAccessAllows({ kind: 'chat' }, 'testers', false)).toBe(false);
    expect(aiAccessAllows({ kind: 'chat' }, 'testers', true)).toBe(true);
  });
});

describe('aiGate — le verdict que la fonction Edge applique (R3, R4, D16)', () => {
  const MODEL_KINDS = ['narrate', 'meal_text', 'coach', 'photo', 'ask'];
  const PASS_OPEN = { verdict: 'pass', closed: false, statusReadable: true };

  describe('mode testers, non-testeur', () => {
    it.each(MODEL_KINDS)('« %s » → bêta fermée', (kind) => {
      expect(aiGate({ kind }, 'testers', false)).toEqual({ verdict: 'closed' });
    });
    it('accorder l’accord (vrai ou absent) → bêta fermée', () => {
      expect(aiGate({ kind: 'consent', grant: true }, 'testers', false)).toEqual({ verdict: 'closed' });
      expect(aiGate({ kind: 'consent' }, 'testers', false)).toEqual({ verdict: 'closed' });
    });
    it('status et retrait d’accord passent, et le statut dira « fermé »', () => {
      const expected = { verdict: 'pass', closed: true, statusReadable: true };
      expect(aiGate({ kind: 'status' }, 'testers', false)).toEqual(expected);
      expect(aiGate({ kind: 'consent', grant: false }, 'testers', false)).toEqual(expected);
    });
  });

  describe('mode testers, testeur', () => {
    it.each([...MODEL_KINDS, 'status'])('« %s » passe, statut ouvert', (kind) => {
      expect(aiGate({ kind }, 'testers', true)).toEqual(PASS_OPEN);
    });
    it('accorder ou retirer l’accord passe', () => {
      expect(aiGate({ kind: 'consent', grant: true }, 'testers', true)).toEqual(PASS_OPEN);
      expect(aiGate({ kind: 'consent', grant: false }, 'testers', true)).toEqual(PASS_OPEN);
    });
  });

  describe('mode open : la liste est ignorée', () => {
    it.each([...MODEL_KINDS, 'status'])('« %s » passe pour un non-testeur', (kind) => {
      expect(aiGate({ kind }, 'open', false)).toEqual(PASS_OPEN);
    });
    it('même une liste illisible ne ferme rien (elle n’est pas lue en mode open)', () => {
      expect(aiGate({ kind: 'narrate' }, 'open', 'error')).toEqual(PASS_OPEN);
    });
  });

  describe('🔴 liste illisible (D16) : indisponible, jamais « bêta fermée »', () => {
    it.each([...MODEL_KINDS, 'status'])('« %s » → indisponible', (kind) => {
      expect(aiGate({ kind }, 'testers', 'error')).toEqual({ verdict: 'unavailable' });
    });
    it('accorder l’accord → indisponible', () => {
      expect(aiGate({ kind: 'consent', grant: true }, 'testers', 'error')).toEqual({ verdict: 'unavailable' });
    });
    it('le retrait d’accord passe, mais sa réponse ne doit pas dire le statut', () => {
      expect(aiGate({ kind: 'consent', grant: false }, 'testers', 'error')).toEqual({
        verdict: 'pass',
        closed: true,
        statusReadable: false,
      });
    });
  });
});

describe('prismeStatusReason — fermé, puis âge, puis fournisseur (D4, R5)', () => {
  const providers: PrismeProviderState[] = ['ok', 'provider', 'unconfigured'];

  it.each(providers)('fermé l’emporte sur tout (fournisseur « %s »)', (provider) => {
    expect(prismeStatusReason({ closed: true, minor: false, provider })).toBe('closed');
    expect(prismeStatusReason({ closed: true, minor: true, provider })).toBe('closed');
  });

  it.each(providers)('ouvert et mineur : l’âge l’emporte sur le fournisseur (« %s »)', (provider) => {
    expect(prismeStatusReason({ closed: false, minor: true, provider })).toBe('age');
  });

  it('ouvert et majeur : la raison du fournisseur, ou rien', () => {
    expect(prismeStatusReason({ closed: false, minor: false, provider: 'ok' })).toBeNull();
    expect(prismeStatusReason({ closed: false, minor: false, provider: 'provider' })).toBe('provider');
    expect(prismeStatusReason({ closed: false, minor: false, provider: 'unconfigured' })).toBe('unconfigured');
  });
});

describe('test-garde — la copie de la règle dans la fonction Edge est identique à la source', () => {
  const MARKER = '// ─── règle ACCES-IA (copie vérifiée par packages/shared/src/ai-access.test.ts) ───';
  const read = (relative: string): string =>
    readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
  const ruleOf = (source: string, file: string): string => {
    const at = source.indexOf(MARKER);
    if (at < 0) throw new Error(`${file} : repère introuvable — il doit précéder la règle, mot pour mot.`);
    return source.slice(at + MARKER.length);
  };

  it('supabase/functions/ai-assist/access.ts recopie, sous le repère, exactement ai-access.ts', () => {
    const source = ruleOf(read('./ai-access.ts'), 'packages/shared/src/ai-access.ts');
    const copy = ruleOf(read('../../../supabase/functions/ai-assist/access.ts'), 'supabase/functions/ai-assist/access.ts');

    // En cas d'échec : recopier tout ce qui suit le repère de `packages/shared/src/ai-access.ts` dans
    // `supabase/functions/ai-assist/access.ts`, puis redéployer la fonction (spec §12).
    expect(copy).toBe(source);
  });
});
