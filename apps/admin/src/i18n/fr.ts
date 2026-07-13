/**
 * Libellés FR centralisés du back-office (admin interne, FR d'abord).
 * L'i18n complète (i18next) n'est pas requise à la fondation ; à réévaluer
 * si l'admin grossit. Aucune chaîne d'UI en dur ailleurs que dans ce module.
 */
export const fr = {
  brand: 'Wellness Admin',

  login: {
    title: 'Wellness Admin',
    emailLabel: 'E-mail',
    passwordLabel: 'Mot de passe',
    submit: 'Se connecter',
    submitting: 'Connexion…',
    hint: 'Accès réservé. Connecte-toi avec ton compte.',
  },

  errors: {
    invalidCredentials: 'Identifiants incorrects. Réessaie.',
    generic: 'Une erreur est survenue. Réessaie.',
  },

  layout: {
    homeTitle: 'Accueil',
    logout: 'Déconnexion',
    loggingOut: 'Déconnexion…',
    loading: 'Chargement…',
    nav: {
      home: 'Accueil',
      soon: 'bientôt',
      exercises: 'Exercices',
      foods: 'Aliments',
      programs: 'Programmes',
      users: 'Utilisateurs',
    },
  },

  placeholder: {
    title: 'Back-office',
    subtitle: 'La gestion du contenu arrive bientôt.',
    badge: 'Modules livrés dans les prochains lots',
    modules: [
      { name: 'Exercices', desc: 'Créer / éditer (FR+EN)' },
      { name: 'Aliments', desc: 'CRUD + import CSV' },
      { name: 'Programmes', desc: 'Constructeur' },
      { name: 'Utilisateurs', desc: 'Lecture + modération' },
    ],
  },
} as const;

export type FrLabels = typeof fr;
