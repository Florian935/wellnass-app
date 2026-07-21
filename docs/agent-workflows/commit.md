# Préparer et livrer un commit

Ce workflow prépare et réalise un commit sûr pour Wellness App
(React Native/Expo + Supabase). L'adaptateur de l'agent courant fournit
le sujet optionnel et, pour Claude uniquement, son attribution.

## Garde-fou confidentialité

Ne jamais committer de secrets ou de credentials : `.env*`, clé Supabase
`service_role`, clés RevenueCat ou Mapbox, `google-services.json`,
`GoogleService-Info.plist`, keystores et certificats (`*.keystore`,
`*.jks`, `*.p12`, `*.pem`, `*.key`), ou credentials EAS.
En cas de doute, arrêter le workflow et prévenir l'utilisateur.

## Procédure obligatoire

1. **Analyser le périmètre**
   - Exécuter `git status`, `git diff` et, si nécessaire,
     `git diff --staged`.
   - Lire le diff complet pour comprendre ce qui a changé et pourquoi.
   - Si plusieurs sujets indépendants sont mélangés, proposer de les
     scinder avant toute action.

2. **Contrôler la confidentialité**
   - Repérer les fichiers sensibles listés ci-dessus.
   - Ne jamais les stage.
   - Vérifier qu'ils sont couverts par `.gitignore`.
   - Si un secret risque d'être committé, arrêter et prévenir.

3. **Contrôler la branche**
   - Exécuter `git rev-parse --abbrev-ref HEAD`.
   - Si la branche est `main` ou `dev`, arrêter et proposer une branche
     dédiée créée depuis `dev` avec un préfixe `feature/`, `fix/`,
     `chore/`, `docs/` ou `refactor/`.
   - Ne jamais committer directement sur `main` ou `dev`.

4. **Exécuter les contrôles qualité**
   - Si `package.json` existe, lancer `npm run lint`,
     `npm run typecheck` et `npm test`.
   - Lancer aussi `npm run agents:check` lorsque le script existe.
   - Si un contrôle échoue, arrêter sans committer et rapporter l'échec.

5. **Relire le diff**
   - Rechercher bugs, régressions, secrets, incohérences avec
     `docs/specs/` et
     `docs/specs/technical/bonnes-pratiques.md`.
   - Vérifier l'offline-first et l'i18n lorsqu'ils sont concernés.
   - Pour un diff conséquent, utiliser la capacité de revue disponible
     dans l'outil courant. Si aucun agent/skill de revue n'est
     disponible, effectuer une revue inline complète.
   - Corriger tout problème bloquant avant de poursuivre.

6. **Mettre à jour CHANGELOG.md**
   - Insérer une entrée juste sous le marqueur
     `<!-- Nouvelles entrées ajoutées ICI ... -->`.
   - Construire l'entrée depuis le diff : date JJ/MM/AAAA, sujet,
     branche, catégories, fichiers touchés, décisions et points
     d'attention.
   - Ne jamais écrire le hash du commit en cours ni amender uniquement
     pour ajouter ce hash.

7. **Mettre à jour TODO.md**
   - Cocher `[x]` ce qui est livré, passer `[~]` ce qui reste en cours,
     ajouter les tâches apparues et actualiser la date de dernière mise
     à jour.

8. **Mettre à jour la roadmap si nécessaire**
   - Si le commit fait avancer une fonctionnalité de la roadmap,
     actualiser son statut et les compteurs du récapitulatif.
   - Pour une modification documentaire, d'outillage ou hors roadmap,
     ne pas modifier la roadmap et le signaler dans le changelog.

9. **Construire le message**
   - Utiliser le format conventionnel français
     `type(scope): sujet` avec `feat`, `fix`, `docs`, `refactor`,
     `test` ou `chore`.
   - Utiliser le sujet fourni par l'utilisateur lorsqu'il existe.
   - Ajouter l'attribution uniquement si l'adaptateur courant l'exige.

10. **Créer le commit**
    - Stager uniquement les fichiers du périmètre avec des chemins
      explicites ; ne jamais utiliser aveuglément `git add .`.
    - Créer le commit, afficher son hash puis vérifier que le statut du
      périmètre est propre.

11. **Intégrer vers dev**
    - Exécuter `git fetch origin`.
    - Mettre `dev` à jour depuis `origin/dev`.
    - Faire avancer `dev` avec les commits de la branche, en
      fast-forward si possible, sinon avec un merge non forcé.
    - Exécuter `git push origin dev` puis revenir sur la branche de
      travail.
    - En cas de conflit ou de divergence, arrêter sans forcer et
      prévenir l'utilisateur.
