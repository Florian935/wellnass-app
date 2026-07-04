---
description: Analyse les changements, met à jour le TODO, puis crée un commit propre et sûr
argument-hint: [sujet de commit optionnel]
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git rev-parse:*), Bash(git branch:*), Bash(git log:*), Bash(npm:*), Bash(npx:*), Bash(pnpm:*), Read, Edit, Write
---

Tu prépares et réalises un commit propre pour ce dépôt (Wellness App — RN/Expo + Supabase).

⚠️ **Garde-fou confidentialité** : ne committe **JAMAIS** de secrets ni de credentials —
`.env*`, clés Supabase (`service_role`), clés RevenueCat / Mapbox, `google-services.json`,
`GoogleService-Info.plist`, keystores et certificats (`*.keystore`, `*.jks`, `*.p12`,
`*.pem`, `*.key`), fichiers de credentials EAS. En cas de doute, **stoppe et préviens**.

Sujet fourni par l'utilisateur (optionnel) : `$ARGUMENTS`

Exécute ces étapes dans l'ordre, et arrête-toi en cas de doute :

1. **Analyse** : lance `git status` et `git diff` (+ `git diff --staged` si besoin) pour
   comprendre précisément _ce qui a changé et pourquoi_.

2. **Garde-fou confidentialité** : repère tout fichier sensible (voir liste ci-dessus).
   Ne le stage pas ; vérifie qu'il est couvert par `.gitignore`. Si un secret risque
   d'être committé et n'est pas ignoré, **stoppe** et préviens l'utilisateur.

3. **Branche** : vérifie la branche courante (`git rev-parse --abbrev-ref HEAD`). Si tu es
   sur `main`, **stoppe** et propose de créer une branche dédiée (`feature/…`, `fix/…`,
   `chore/…`, `docs/…`, `refactor/…`) avant de committer — on ne commit pas sur `main`.

4. **Qualité** (si le scaffolding existe, c.-à-d. un `package.json` est présent) : lance
   lint + typecheck + tests selon les scripts définis (ex. `npm run lint`, `npm run typecheck`,
   `npm test`). Si l'un échoue, **stoppe** et rapporte l'échec (pas de commit sur du rouge).
   Tant que le scaffolding n'est pas initialisé, saute cette étape.

5. **TODO** : mets à jour [`TODO.md`](../../TODO.md) — coche `[x]` ce qui est désormais fait,
   passe en `[~]` ce qui est en cours, ajoute les nouvelles tâches apparues, et actualise la
   date de « Dernière mise à jour ».

6. **Message de commit** : format conventionnel `type(scope): sujet` **en français**
   (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`). Si `$ARGUMENTS` est non vide,
   utilise-le comme base du sujet. Ajoute un corps concis si utile.
   Termine **toujours** le message par :

   `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

7. **Commit** : `git add` uniquement les fichiers pertinents (jamais les sensibles), puis
   `git commit`. Affiche ensuite le hash du commit et un `git status` final propre.

Si le périmètre à committer est ambigu (mélange de sujets sans rapport), propose de scinder
en plusieurs commits **avant** d'agir.
