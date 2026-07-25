/**
 * Décision de routing racine de l'app mobile (gate compte-profil-onboarding), pure et testable.
 *
 * Extraite de `_layout.tsx` pour isoler une logique subtile (race offline-first : sur une
 * réinstallation, la base locale est vide et le profil — qui porte `onboarding_completed_at` — n'est
 * pas encore redescendu de la synchro ; il ne faut pas conclure « onboarding non fait » avant la fin
 * de la synchro initiale). Aucune I/O, aucun `Date`.
 */

export type RootRoute =
  | 'wait'
  | 'auth'
  | 'onboarding'
  | 'app'
  | 'deletion-pending'
  | 'password-recovery';

export function resolveRootRoute(input: {
  /** Polices chargées (ou en erreur) — prêtes à rendre. */
  fontsReady: boolean;
  /** L'auth store est encore en initialisation (restauration de session). */
  authInitializing: boolean;
  /** Une session est ouverte. */
  hasSession: boolean;
  /** La requête locale du profil n'est pas encore résolue. */
  profileLoading: boolean;
  /** Une ligne de profil existe en base locale. */
  hasProfile: boolean;
  /** Horodatage de fin d'onboarding du profil (null si non terminé / pas de profil). */
  onboardingCompletedAt: string | null;
  /** La requête locale des réglages n'est pas encore résolue. */
  settingsLoading: boolean;
  /** La **synchro initiale** PowerSync est terminée (au moins un cycle depuis la création de la base). */
  hasSynced: boolean;
  /** Le contrôle serveur d'une demande de suppression de compte est en cours (CONF-02). */
  deletionCheckLoading?: boolean;
  /** Une demande de suppression de compte est en attente (pending) côté serveur (CONF-02). */
  deletionPending?: boolean;
  /**
   * Une réinitialisation de mot de passe est en cours : la session a été ouverte par un **lien de
   * récupération**, l'utilisateur doit choisir son nouveau mot de passe avant d'entrer dans l'app
   * (CONF-08). Drapeau **en mémoire** côté app.
   */
  recoveryPending?: boolean;
}): RootRoute {
  const {
    fontsReady,
    authInitializing,
    hasSession,
    profileLoading,
    hasProfile,
    onboardingCompletedAt,
    settingsLoading,
    hasSynced,
    deletionCheckLoading,
    deletionPending,
    recoveryPending,
  } = input;

  // Splash tant que le socle n'est pas prêt.
  if (!fontsReady || authInitializing) return 'wait';

  // Sans session, on route vers l'authentification (profil/réglages non pertinents).
  if (!hasSession) return 'auth';

  // Gate suppression de compte (CONF-02), prioritaire sur onboarding/app. Champs optionnels : falsy
  // par défaut tant que le contrôleur ne les branche pas (fail-open hors-ligne géré côté _layout).
  if (deletionCheckLoading) return 'wait';
  if (deletionPending) return 'deletion-pending';

  // Gate réinitialisation de mot de passe (CONF-08) : le lien de récupération ouvre une session, mais
  // l'utilisateur doit choisir son nouveau mot de passe avant d'entrer dans l'app — sinon il entrerait
  // avec son ancien mot de passe toujours actif.
  // Placé APRÈS la gate de suppression (qui offre l'annulation, action plus urgente) et AVANT l'attente
  // profil/réglages : l'écran de saisie n'a besoin ni du profil ni des réglages, inutile de faire
  // patienter l'utilisateur derrière la synchro.
  if (recoveryPending) return 'password-recovery';

  // Session ouverte : attendre la résolution des requêtes locales (profil + réglages) pour éviter
  // tout flash / boucle de redirection.
  if (profileLoading || settingsLoading) return 'wait';

  // ⭐ Garde anti-race (offline-first) : ne PAS conclure « onboarding non fait » sur un profil local
  // absent tant que la synchro initiale n'est pas terminée — sur une réinstallation, la ligne profil
  // n'est peut-être pas encore redescendue. On attend `hasSynced`.
  if (!hasProfile && !hasSynced) return 'wait';

  const onboardingCompleted = hasProfile && onboardingCompletedAt != null;
  if (!onboardingCompleted) return 'onboarding';

  return 'app';
}
