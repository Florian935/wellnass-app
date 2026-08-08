import { useCallback, useRef } from 'react';

/**
 * Verrou d'action asynchrone — **une seule exécution à la fois**.
 *
 * ── Pourquoi ce hook existe ──────────────────────────────────────────────────────────────────────
 *
 * Le patron naturel, et qu'on retrouvait partout dans l'app, est faux :
 *
 * ```ts
 * const [busy, setBusy] = useState(false);
 * const onPress = async () => {
 *   if (busy) return;        // ❌ ne garde rien
 *   setBusy(true);
 *   await quelqueChose();
 *   setBusy(false);
 * };
 * ```
 *
 * `busy` est un **état React** : il est lu depuis la fermeture du rendu courant. Deux appuis
 * rapides tombent dans le **même cycle de rendu**, donc dans la même fermeture, où `busy` vaut
 * encore `false` pour les deux — et le bouton n'a pas encore eu le temps de se désactiver. La
 * garde ne se déclenche jamais dans le seul cas où elle servirait.
 *
 * Les conséquences constatées les 07 et 08/08/2026, sur trois écrans : une séance clôturée **deux
 * fois** (donc deux évaluations de records, donc potentiellement deux notifications identiques),
 * une course arrêtée deux fois avec double navigation, et un programme dupliqué **deux fois** —
 * la seconde copie étant orpheline, l'utilisateur ne la verra jamais.
 *
 * Une **ref** est écrite et relue immédiatement, sans attendre un rendu : c'est le seul mécanisme
 * qui tienne dans ce cas. L'état React reste utile pour l'**affichage** (indicateur de chargement,
 * bouton désactivé) — les deux ne s'excluent pas, mais l'affichage ne peut pas servir de garde.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────────────────────────
 *
 * ```ts
 * const runExclusive = useActionLock();
 *
 * const onDuplicate = () =>
 *   void runExclusive(async () => {
 *     setDuplicating(true);          // affichage uniquement
 *     try {
 *       const id = await duplicateProgram(programId);
 *       router.replace(`/programs/${id}`);
 *     } finally {
 *       setDuplicating(false);
 *     }
 *   });
 * ```
 *
 * Le verrou est relâché quand l'action se termine, **y compris si elle lève**. Un écran qui
 * navigue ailleurs est démonté avant, ce qui revient au même.
 *
 * ⚠️ **Un verrou par action, pas un par écran.** Deux actions distinctes du même écran (dupliquer
 * et supprimer, par exemple) méritent deux appels à `useActionLock` : les partager empêcherait de
 * supprimer pendant qu'une duplication est en vol, ce qui n'est pas le but.
 */
export function useActionLock(): <T>(action: () => Promise<T>) => Promise<T | undefined> {
  const locked = useRef(false);

  return useCallback(async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    if (locked.current) return undefined;
    locked.current = true;
    try {
      return await action();
    } finally {
      locked.current = false;
    }
  }, []);
}
