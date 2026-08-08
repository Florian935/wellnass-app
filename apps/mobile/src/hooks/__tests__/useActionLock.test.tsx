/**
 * `useActionLock` — le verrou qui remplace les gardes par état React.
 *
 * Ce hook a été extrait après avoir trouvé **le même défaut sur trois écrans** (clôture de séance,
 * arrêt de course, duplication de programme) : `if (busy) return` sur un état React ne garde rien,
 * parce que deux appuis rapides tombent dans le même cycle de rendu et lisent la même fermeture.
 *
 * Les tests ci-dessous vérifient le contrat dans les conditions qui comptent : **appels
 * synchrones successifs**, sans rendu intercalé. C'est exactement le cas qu'une garde par état
 * laissait passer.
 */
import React from 'react';
import { act, renderHook } from '@testing-library/react-native';

import { useActionLock } from '../useActionLock';

/** Une promesse dont le test choisit le moment de résolution. */
function differee<T>() {
  let resoudre!: (value: T) => void;
  let rejeter!: (reason: unknown) => void;
  const promesse = new Promise<T>((res, rej) => {
    resoudre = res;
    rejeter = rej;
  });
  return { promesse, resoudre, rejeter };
}

describe('useActionLock', () => {
  it('exécute l’action et rend son résultat', async () => {
    const { result } = await renderHook(() => useActionLock());

    let rendu: string | undefined;
    await act(async () => {
      rendu = await result.current(async () => 'ok');
    });

    expect(rendu).toBe('ok');
  });

  it('🔴 ignore un second appel tant que le premier est en vol', async () => {
    const { result } = await renderHook(() => useActionLock());
    const action = jest.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const { promesse, resoudre } = differee<void>();
    const lente = jest.fn(() => promesse);

    await act(async () => {
      void result.current(lente);
      void result.current(lente);
      void result.current(action);
    });

    // Les trois appels partent du même cycle : seul le premier doit passer.
    expect(lente).toHaveBeenCalledTimes(1);
    expect(action).not.toHaveBeenCalled();

    await act(async () => {
      resoudre();
    });
  });

  it('rend `undefined` à l’appel ignoré — sans lever', async () => {
    const { result } = await renderHook(() => useActionLock());
    const { promesse, resoudre } = differee<string>();

    let rendu: string | undefined = 'valeur-initiale';
    await act(async () => {
      void result.current(() => promesse);
      rendu = await result.current(async () => 'jamais');
    });

    // Lever ici obligerait chaque appelant à envelopper son geste dans un `try`, pour un cas qui
    // n'est pas une erreur : l'utilisateur a simplement appuyé deux fois.
    expect(rendu).toBeUndefined();

    await act(async () => {
      resoudre('fini');
    });
  });

  it('🔴 relâche le verrou une fois l’action terminée', async () => {
    const { result } = await renderHook(() => useActionLock());
    const action = jest.fn(async () => 'ok');

    await act(async () => {
      await result.current(action);
    });
    await act(async () => {
      await result.current(action);
    });

    // Un verrou qui ne se relâche pas rend le bouton mort jusqu'au prochain montage de l'écran —
    // un défaut plus discret, et plus agaçant, que le double appui qu'il corrige.
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('🔴 relâche le verrou MÊME si l’action lève', async () => {
    const { result } = await renderHook(() => useActionLock());

    await act(async () => {
      await expect(
        result.current(async () => {
          throw new Error('réseau');
        }),
      ).rejects.toThrow('réseau');
    });

    const apres = jest.fn(async () => 'ok');
    await act(async () => {
      await result.current(apres);
    });

    // Sinon un échec réseau interdirait définitivement de réessayer.
    expect(apres).toHaveBeenCalled();
  });

  it('laisse l’erreur remonter — le verrou n’avale rien', async () => {
    const { result } = await renderHook(() => useActionLock());

    await act(async () => {
      await expect(result.current(async () => Promise.reject(new Error('rls')))).rejects.toThrow(
        'rls',
      );
    });
  });

  it('🔴 deux verrous d’un même écran sont indépendants', async () => {
    const { result } = await renderHook(() => ({
      dupliquer: useActionLock(),
      supprimer: useActionLock(),
    }));
    const { promesse, resoudre } = differee<void>();
    const suppression = jest.fn(async () => {});

    await act(async () => {
      void result.current.dupliquer(() => promesse);
      void result.current.supprimer(suppression);
    });

    // Partager un verrou entre deux actions distinctes empêcherait de supprimer pendant qu'une
    // duplication est en vol — ce n'est pas ce qu'on cherche à protéger.
    expect(suppression).toHaveBeenCalled();

    await act(async () => {
      resoudre();
    });
  });

  it('reste la même fonction d’un rendu à l’autre', async () => {
    const { result, rerender } = await renderHook(() => useActionLock());
    const premier = result.current;

    await act(async () => {
      rerender(undefined as unknown as React.ReactNode);
    });

    // Une identité stable permet de la mettre en dépendance d'un `useEffect` ou d'un `useCallback`
    // sans relancer quoi que ce soit à chaque rendu.
    expect(result.current).toBe(premier);
  });
});
