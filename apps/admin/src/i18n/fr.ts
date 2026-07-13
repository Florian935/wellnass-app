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

  accessDenied: {
    title: 'Accès refusé',
    message:
      "Ton compte n'a pas les droits d'accès au back-office. Contacte un administrateur si tu penses qu'il s'agit d'une erreur.",
    logout: 'Se déconnecter',
  },

  roles: {
    title: 'Rôles',
    nav: 'Rôles',
    listTitle: 'Attributions actives',
    listEmpty: 'Aucune attribution pour le moment.',
    loading: 'Chargement des rôles…',
    colUser: 'Utilisateur (user_id)',
    colRole: 'Rôle',
    colDate: 'Attribué le',
    colActions: 'Actions',
    grantTitle: 'Attribuer un rôle',
    userIdLabel: 'Identifiant utilisateur (UUID)',
    userIdHint:
      "Copie l'UUID de l'utilisateur depuis le dashboard Supabase (Auth → Users).",
    userIdPlaceholder: '00000000-0000-0000-0000-000000000000',
    roleLabel: 'Rôle',
    grantCta: 'Attribuer',
    granting: 'Attribution…',
    revoke: 'Révoquer',
    revoking: 'Révocation…',
    revokeConfirm: 'Révoquer ce rôle pour cet utilisateur ?',
    error: 'Une erreur est survenue. Réessaie.',
    userIdRequired: "Renseigne l'identifiant utilisateur.",
    alreadyAssigned: 'Ce rôle est déjà attribué à cet utilisateur.',
    roleNames: {
      super_admin: 'Super administrateur',
      content_editor: 'Éditeur de contenu',
      moderator: 'Modérateur',
    },
  },

  exercises: {
    navTitle: 'Exercices',
    listTitle: 'Exercices éditoriaux',
    search: 'Rechercher par nom…',
    filterGroup: 'Tous les groupes',
    filterStatus: 'Tous les statuts',
    statusDraft: 'Brouillon',
    statusPublished: 'Publié',
    colName: 'Nom (FR)',
    colGroup: 'Groupe',
    colStatus: 'Statut',
    colDate: 'Créé le',
    colActions: 'Actions',
    new: 'Nouvel exercice',
    edit: 'Éditer',
    archive: 'Archiver',
    archiveConfirm: 'Archiver cet exercice (et ses traductions) ?',
    publish: 'Publier',
    unpublish: 'Repasser en brouillon',
    formTitleNew: 'Nouvel exercice',
    formTitleEdit: "Éditer l'exercice",
    groupLabel: 'Groupe musculaire',
    equipmentLabel: 'Équipement (optionnel)',
    nameFr: 'Nom (FR)',
    nameEn: 'Nom (EN)',
    instructionsFr: 'Instructions (FR)',
    instructionsEn: 'Instructions (EN)',
    statusLabel: 'Statut',
    save: 'Enregistrer',
    saving: 'Enregistrement…',
    error: 'Une erreur est survenue. Réessaie.',
    loadError: "Impossible de charger l'exercice.",
    requiredBoth: 'Le nom FR et le nom EN sont requis.',
    back: 'Retour à la liste',
    loading: 'Chargement des exercices…',
    empty: 'Aucun exercice éditorial pour le moment.',
    noName: '(sans nom)',
    groupNames: {
      chest: 'Pectoraux',
      back: 'Dos',
      legs: 'Jambes',
      shoulders: 'Épaules',
      arms: 'Bras',
      core: 'Gainage',
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
