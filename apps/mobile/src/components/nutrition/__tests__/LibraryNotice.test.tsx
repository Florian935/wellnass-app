/**
 * US NUTRI-UX02 — l'état « la bibliothèque n'est pas arrivée ».
 *
 * Ce composant existe parce que l'app a été **incapable de nommer une panne** : 3 246 aliments sur
 * le cloud, zéro sur le téléphone, et un écran qui répondait « Aucun aliment trouvé » à la
 * recherche « saumon ». Personne ne cherche une panne de réplication quand l'app affirme
 * simplement que l'aliment n'existe pas.
 *
 * Ce que ces tests verrouillent :
 *  1. Les **trois causes** sont distinguées à partir de l'état réel de PowerSync — un seul message
 *     générique ne vaudrait pas mieux que l'ancien silence.
 *  2. Le cas qui compte (`notPublished`) accuse **la configuration, pas l'utilisateur**.
 *  3. Le compte local est affiché **tel quel** : c'est la donnée qui permet de dire au support
 *     « j'ai 0 aliment » plutôt que « ça ne marche pas ».
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { useStatus } from '@powersync/react';

import { LibraryNotice, resolveLibraryMissingCause } from '../LibraryNotice';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

/**
 * ⚠️ On pilote le mock **global** de `jest.setup.ts` au lieu d'en poser un local.
 *
 * Un `jest.mock('@powersync/react', …)` ici remplacerait le module entier, et `useQuery`
 * disparaîtrait avec lui — or `useTheme` en dépend indirectement. Le rendu échouait alors sans
 * message utile (« `render` function has not been called »), ce qui coûte plus cher à diagnostiquer
 * que le mock ne fait gagner.
 */
const statusMock = useStatus as jest.MockedFunction<typeof useStatus>;
const setStatus = (hasSynced: boolean, connected: boolean) =>
  statusMock.mockReturnValue({ hasSynced, connected } as ReturnType<typeof useStatus>);

describe('resolveLibraryMissingCause — la cause, pas juste « une erreur »', () => {
  it('première synchro non terminée : c’est le cas NORMAL d’une installation neuve', () => {
    expect(resolveLibraryMissingCause({ hasSynced: false, connected: true })).toBe('syncing');
    // `hasSynced` prime : hors ligne avant la première synchro, c'est encore « ça arrive ».
    expect(resolveLibraryMissingCause({ hasSynced: false, connected: false })).toBe('syncing');
  });

  it('synchro faite mais hors ligne : l’app ne peut rien inventer', () => {
    expect(resolveLibraryMissingCause({ hasSynced: true, connected: false })).toBe('offline');
  });

  it('🔴 synchro faite, en ligne, base vide : c’est la CONFIGURATION qui est en cause', () => {
    // Le cas qui a coûté des jours en septembre 2026. Il doit être nommé, et distinctement.
    expect(resolveLibraryMissingCause({ hasSynced: true, connected: true })).toBe('notPublished');
  });

  it('un statut vide ne se lit pas comme « tout va bien »', () => {
    expect(resolveLibraryMissingCause({})).toBe('syncing');
  });
});

describe('LibraryNotice — ce que l’utilisateur lit', () => {
  beforeEach(() => {
    setStatus(true, true);
  });

  it('annonce la panne et donne le compte local exact', async () => {
    await render(<LibraryNotice count={0} />);

    expect(screen.getByTestId('library-notice')).toBeTruthy();
    expect(screen.getByText(/pas encore arrivée sur cet appareil/i)).toBeTruthy();
    expect(screen.getByText(/0 aliment de bibliothèque en local/i)).toBeTruthy();
  });

  it('🔴 dit que ce n’est PAS la recherche de l’utilisateur qui est en cause', async () => {
    await render(<LibraryNotice count={0} />);

    expect(screen.getByText(/n'est pas ta recherche/i)).toBeTruthy();
  });

  it('change de message quand la synchro est encore en cours', async () => {
    setStatus(false, true);
    await render(<LibraryNotice count={0} />);

    expect(screen.getByText(/première synchronisation est en cours/i)).toBeTruthy();
    expect(screen.queryByText(/n'est pas ta recherche/i)).toBeNull();
  });

  it('change de message hors ligne', async () => {
    setStatus(true, false);
    await render(<LibraryNotice count={0} />);

    expect(screen.getByText(/hors ligne/i)).toBeTruthy();
  });

  it('🔴 ne propose AUCUN bouton — aucune API de relance ne peut le faire sans risquer la file d’écritures', async () => {
    await render(<LibraryNotice count={0} />);

    // `disconnectAndClear` re-téléchargerait tout, mais jetterait aussi les repas saisis hors
    // réseau. Un écran qui nomme la panne vaut mieux qu'un bouton qui peut détruire des données.
    expect(screen.queryByRole('button')).toBeNull();
  });
});
