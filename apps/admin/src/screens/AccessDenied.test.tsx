/**
 * Back-office — écran « Accès refusé ».
 *
 * Petit écran (81 lignes), mais c'est le **filet d'habilitation** : il s'affiche quand quelqu'un
 * est bien authentifié et n'a **aucun rôle** — ou quand la lecture des rôles a échoué. Les deux cas
 * mènent ici, et c'est délibéré : en cas de doute sur les droits, on refuse.
 *
 * Deux points portent le risque, et aucun n'est visible à la lecture rapide :
 *
 *  1. **Aucune redirection vers `/login`.** L'utilisateur EST connecté ; le renvoyer au formulaire
 *     produirait une boucle — il se reconnecterait avec succès pour revenir ici. La seule sortie
 *     offerte est la déconnexion, et c'est ce que le test fige.
 *  2. **Le `finally` rend la main.** Si `signOut` échoue, le bouton doit redevenir actionnable :
 *     sans ce `finally`, un échec réseau laisse l'écran mort, sans autre issue qu'un rechargement.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const signOut = vi.fn();
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ signOut }) }));

const { AccessDenied } = await import('./AccessDenied');
const { fr } = await import('../i18n/fr');

beforeEach(() => {
  vi.clearAllMocks();
  signOut.mockResolvedValue(undefined);
});

const bouton = () => screen.getByRole('button', { name: fr.accessDenied.logout });

describe('AccessDenied', () => {
  it('explique la situation sans proposer de se reconnecter', () => {
    render(<AccessDenied />);

    expect(screen.getByText(fr.accessDenied.title)).toBeInTheDocument();
    expect(screen.getByText(fr.accessDenied.message)).toBeInTheDocument();
    // 🔴 Pas de lien vers `/login` : l'utilisateur est déjà connecté, l'y renvoyer boucle.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(bouton()).toBeInTheDocument();
  });

  it('cache l’icône décorative aux lecteurs d’écran', () => {
    render(<AccessDenied />);

    // Le cadenas répète visuellement ce que le titre dit déjà : l'annoncer serait du bruit.
    const icone = screen.getByText('🔒');
    expect(icone).toHaveAttribute('aria-hidden');
  });

  it('déconnecte au clic', async () => {
    render(<AccessDenied />);
    const user = userEvent.setup();

    await user.click(bouton());

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });

  it('🔴 un second appui pendant la déconnexion n’en déclenche pas une deuxième', async () => {
    let debloquer!: () => void;
    signOut.mockReturnValue(new Promise<void>((resolve) => (debloquer = resolve)));
    render(<AccessDenied />);
    const user = userEvent.setup();

    await user.click(bouton());

    const enCours = await screen.findByRole('button', { name: fr.layout.loggingOut });
    expect(enCours).toBeDisabled();
    await user.click(enCours);

    expect(signOut).toHaveBeenCalledTimes(1);
    debloquer();
    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
  });

  it('🔴 rend la main si la déconnexion échoue', async () => {
    // Sans le `finally`, l'écran resterait figé sur « Déconnexion… », bouton désactivé, sans autre
    // issue qu'un rechargement de page — sur le seul écran que la personne peut atteindre.
    signOut.mockRejectedValue(new Error('réseau'));
    render(<AccessDenied />);
    const user = userEvent.setup();

    await user.click(bouton()).catch(() => undefined);

    await waitFor(() => expect(bouton()).toBeEnabled());
  });
});
