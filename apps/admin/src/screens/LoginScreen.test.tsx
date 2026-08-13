/**
 * Back-office — écran de connexion (public).
 *
 * C'est la **porte d'entrée du back-office**, et le seul écran que quelqu'un de non authentifié
 * peut atteindre. La couche data ne dit rien de ce qui se joue ici : elle sait que `signIn` parle à
 * Supabase, jamais que l'écran l'appelle avec ce qui a été saisi, ni qu'il refuse d'entrer quand
 * Supabase refuse.
 *
 * Quatre comportements portent le risque, et trois sont invisibles à la lecture :
 *
 *  1. **La garde de redirection est un ET, pas un OU** : `!loading && session`. Rediriger sur la
 *     seule présence d'une `session` **pendant** que l'auth se résout enverrait l'utilisateur vers
 *     `/` sur la foi d'un état non encore établi ; ne pas rediriger du tout laisserait un admin
 *     déjà connecté coincé sur le formulaire. Les deux moitiés sont testées séparément.
 *  2. **Un échec de connexion ne navigue pas.** C'est la moitié du travail d'un formulaire d'auth,
 *     et celle qu'on oublie de vérifier : un test qui n'assure que « le message d'erreur
 *     s'affiche » passerait au vert même si l'écran redirigeait quand même derrière.
 *  3. **L'erreur précédente est effacée à la nouvelle tentative.** Sans ça, un message
 *     « Identifiants incorrects » resterait affiché au-dessus d'une connexion en cours, puis
 *     réussie — on annonce un échec qui n'a pas eu lieu.
 *  4. **Le message d'erreur porte `role="alert"`.** C'est ce qui le fait annoncer par un lecteur
 *     d'écran ; sans lui, l'échec est purement visuel. Assertion faite via `getByRole`, donc le
 *     rôle est bien exercé et pas seulement présent dans le style.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks : navigation et authentification ────────────────────────────────────
//
// `Navigate` est rendu en **sonde** plutôt qu'en vraie redirection : l'écran ne dépend pas du
// routeur pour ce qu'on teste, et monter un `MemoryRouter` ferait porter le test sur le routeur
// autant que sur l'écran. La sonde rend la cible et le `replace` lisibles dans le DOM.
const navigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  Navigate: ({ to, replace }: { to: string; replace?: boolean }) => (
    <div data-testid="navigate" data-to={to} data-replace={String(Boolean(replace))} />
  ),
}));

const signIn = vi.fn();
const auth = { session: null as unknown, loading: false, signIn };
vi.mock('../auth/useAuth', () => ({ useAuth: () => auth }));

const { LoginScreen } = await import('./LoginScreen');
const { fr } = await import('../i18n/fr');

/** Une session Supabase suffisamment réelle pour ce que l'écran en fait : elle existe, ou non. */
const SESSION = { user: { id: 'admin-1', email: 'admin@wellness.fr' } };

beforeEach(() => {
  vi.clearAllMocks();
  auth.session = null;
  auth.loading = false;
  signIn.mockResolvedValue({ error: null });
});

/** Saisit des identifiants valides et soumet. Retourne l'utilisateur `userEvent` pour la suite. */
async function seConnecter(email = 'admin@wellness.fr', motDePasse = 'secret-correct') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(fr.login.emailLabel), email);
  await user.type(screen.getByLabelText(fr.login.passwordLabel), motDePasse);
  await user.click(screen.getByRole('button', { name: fr.login.submit }));
  return user;
}

// ---------------------------------------------------------------------------
// Redirection de l'admin déjà connecté
// ---------------------------------------------------------------------------

describe('admin déjà connecté', () => {
  it('redirige vers l’accueil, en remplaçant l’entrée d’historique', async () => {
    auth.session = SESSION;

    render(<LoginScreen />);

    const redirection = screen.getByTestId('navigate');
    expect(redirection).toHaveAttribute('data-to', '/');
    // `replace` : sans lui, le bouton « retour » du navigateur ramènerait sur le formulaire de
    // connexion d'un utilisateur déjà connecté.
    expect(redirection).toHaveAttribute('data-replace', 'true');
    expect(screen.queryByRole('button', { name: fr.login.submit })).not.toBeInTheDocument();
  });

  it('n’a PAS redirigé tant que l’authentification se résout', () => {
    // Le cas que la garde `!loading && session` protège : une session présente mais pas encore
    // établie. Rediriger ici, c'est décider sur un état transitoire.
    auth.session = SESSION;
    auth.loading = true;

    render(<LoginScreen />);

    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: fr.login.submit })).toBeInTheDocument();
  });

  it('affiche le formulaire quand il n’y a pas de session', () => {
    render(<LoginScreen />);

    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
    expect(screen.getByLabelText(fr.login.emailLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(fr.login.passwordLabel)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Connexion réussie
// ---------------------------------------------------------------------------

describe('connexion réussie', () => {
  it('transmet à `signIn` exactement ce qui a été saisi', async () => {
    render(<LoginScreen />);

    await seConnecter('admin@wellness.fr', 'secret-correct');

    // Les champs sont contrôlés : une liaison inversée ou un état partagé enverrait le mot de
    // passe dans le champ e-mail sans que le rendu ne s'en plaigne.
    expect(signIn).toHaveBeenCalledWith('admin@wellness.fr', 'secret-correct');
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it('redirige vers l’accueil en remplaçant l’entrée d’historique', async () => {
    render(<LoginScreen />);

    await seConnecter();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }));
  });

  it('n’affiche aucune erreur', async () => {
    render(<LoginScreen />);

    await seConnecter();

    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Échec de connexion
// ---------------------------------------------------------------------------

describe('échec de connexion', () => {
  beforeEach(() => {
    signIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
  });

  it('annonce l’échec dans une zone d’alerte', async () => {
    render(<LoginScreen />);

    await seConnecter('admin@wellness.fr', 'mauvais-mot-de-passe');

    // `getByRole('alert')` et non `getByText` : c'est le rôle qui fait annoncer le message par un
    // lecteur d'écran. Le chercher par son texte laisserait passer sa disparition.
    const alerte = await screen.findByRole('alert');
    expect(alerte).toHaveTextContent(fr.errors.invalidCredentials);
  });

  it('🔴 ne navigue PAS', async () => {
    render(<LoginScreen />);

    await seConnecter('admin@wellness.fr', 'mauvais-mot-de-passe');

    await screen.findByRole('alert');
    // Le cœur du test : afficher une erreur *et* entrer quand même serait un défaut de sécurité
    // que le seul contrôle du message ne verrait pas.
    expect(navigate).not.toHaveBeenCalled();
  });

  it('ne divulgue pas le message brut du fournisseur', async () => {
    render(<LoginScreen />);

    await seConnecter('admin@wellness.fr', 'mauvais-mot-de-passe');

    const alerte = await screen.findByRole('alert');
    // Le libellé est le nôtre, en français : ni « Invalid login credentials », ni la distinction
    // « compte inconnu » / « mot de passe faux », qui renseignerait sur l'existence d'un compte.
    expect(alerte).toHaveTextContent(fr.errors.invalidCredentials);
    expect(alerte).not.toHaveTextContent('Invalid login credentials');
  });

  it('efface l’erreur précédente à la tentative suivante', async () => {
    render(<LoginScreen />);

    const user = await seConnecter('admin@wellness.fr', 'mauvais-mot-de-passe');
    await screen.findByRole('alert');

    // Deuxième tentative, réussie cette fois.
    signIn.mockResolvedValue({ error: null });
    await user.click(screen.getByRole('button', { name: fr.login.submit }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }));
    // Sans le `setError(null)` d'ouverture, l'écran annoncerait un échec qui n'a pas eu lieu.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('laisse retenter sans recharger la page', async () => {
    render(<LoginScreen />);

    const user = await seConnecter('admin@wellness.fr', 'mauvais-mot-de-passe');
    await screen.findByRole('alert');

    const bouton = screen.getByRole('button', { name: fr.login.submit });
    // Le bouton est **réactivé** après l'échec : rester désactivé enfermerait l'admin sur un
    // formulaire mort, sans autre issue qu'un rechargement.
    expect(bouton).toBeEnabled();

    await user.click(bouton);
    expect(signIn).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// État de soumission
// ---------------------------------------------------------------------------

describe('pendant la soumission', () => {
  it('désactive le bouton et bascule son libellé', async () => {
    // `signIn` suspendue : c'est le seul moyen d'observer l'état transitoire, qui disparaîtrait
    // avant toute assertion avec une promesse déjà résolue.
    let debloquer!: (v: { error: null }) => void;
    signIn.mockReturnValue(new Promise((resolve) => (debloquer = resolve)));

    render(<LoginScreen />);
    await seConnecter();

    const bouton = await screen.findByRole('button', { name: fr.login.submitting });
    expect(bouton).toBeDisabled();

    debloquer({ error: null });
    await waitFor(() => expect(navigate).toHaveBeenCalled());
  });

  it('🔴 un second appui pendant la soumission n’envoie pas une deuxième requête', async () => {
    let debloquer!: (v: { error: null }) => void;
    signIn.mockReturnValue(new Promise((resolve) => (debloquer = resolve)));

    render(<LoginScreen />);
    const user = await seConnecter();

    const bouton = await screen.findByRole('button', { name: fr.login.submitting });
    await user.click(bouton);
    await user.click(bouton);

    // Même famille que les quatorze verrous de double appui du reste du dépôt : ici c'est le
    // `disabled` qui garde, et c'est ce qu'on vérifie — pas sa présence dans le JSX.
    expect(signIn).toHaveBeenCalledTimes(1);

    debloquer({ error: null });
    await waitFor(() => expect(navigate).toHaveBeenCalled());
  });

  it('rend le bouton à son libellé initial une fois la réponse reçue', async () => {
    signIn.mockResolvedValue({ error: { message: 'nope' } });

    render(<LoginScreen />);
    await seConnecter();

    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: fr.login.submit })).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// Formulaire
// ---------------------------------------------------------------------------

describe('formulaire', () => {
  it('associe chaque libellé à son champ et pose les bons types', () => {
    render(<LoginScreen />);

    const email = screen.getByLabelText(fr.login.emailLabel);
    const motDePasse = screen.getByLabelText(fr.login.passwordLabel);

    // `getByLabelText` ne trouve le champ que si `htmlFor`/`id` se répondent : l'assertion couvre
    // l'accessibilité du formulaire en même temps que son typage.
    expect(email).toHaveAttribute('type', 'email');
    expect(motDePasse).toHaveAttribute('type', 'password');
    expect(email).toBeRequired();
    expect(motDePasse).toBeRequired();
  });

  it('déclare l’auto-complétion attendue par les gestionnaires de mots de passe', () => {
    render(<LoginScreen />);

    expect(screen.getByLabelText(fr.login.emailLabel)).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText(fr.login.passwordLabel)).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
  });

  it('affiche le titre et la mention d’accès réservé', () => {
    render(<LoginScreen />);

    expect(screen.getByText(fr.login.title)).toBeInTheDocument();
    expect(screen.getByText(fr.login.hint)).toBeInTheDocument();
  });
});
