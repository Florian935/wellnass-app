# Préparer et livrer un commit

Ce workflow prépare et réalise un commit propre pour Wellness App (RN/Expo + Supabase). Il est
**commun à Claude Code et à Codex** : l'adaptateur de l'agent courant
(`.claude/skills/commit/SKILL.md`, `.claude/commands/commit.md`, `.agents/skills/commit/SKILL.md`)
fournit le sujet optionnel et, pour Claude uniquement, la ligne d'attribution.

⚠️ **Garde-fou confidentialité** : ne committe **JAMAIS** de secrets ni de credentials —
`.env*`, clés Supabase (`service_role`), clés RevenueCat / Mapbox, `google-services.json`,
`GoogleService-Info.plist`, keystores et certificats (`*.keystore`, `*.jks`, `*.p12`,
`*.pem`, `*.key`), fichiers de credentials EAS. En cas de doute, **stoppe et préviens**.

Exécute ces étapes dans l'ordre, et arrête-toi en cas de doute :

1. **Analyse** : lance `git status` et `git diff` (+ `git diff --staged` si besoin) pour
   comprendre précisément _ce qui a changé et pourquoi_. **Lis le diff en entier** : il sert
   de matière première à la revue (étape 5) et au CHANGELOG (étape 6) — c'est la trace des
   modifications sur laquelle s'appuieront les devs et le débogage.

2. **Garde-fou confidentialité** : repère tout fichier sensible (voir liste ci-dessus).
   Ne le stage pas ; vérifie qu'il est couvert par `.gitignore`. Si un secret risque
   d'être committé et n'est pas ignoré, **stoppe** et préviens l'utilisateur.

3. **Branche** : vérifie la branche courante (`git rev-parse --abbrev-ref HEAD`). Si tu es
   sur `main` **ou `dev`**, **stoppe** et propose de créer une branche dédiée depuis `dev`
   (`feature/…`, `fix/…`, `chore/…`, `docs/…`, `refactor/…`) avant de committer — on ne
   commit jamais directement sur `main` ni `dev`.

4. **Qualité** : lance `npm run lint`, `npm run typecheck`, `npm run test` et
   `npm run agents:check`. Si l'un échoue, **stoppe** et rapporte l'échec (pas de commit sur
   du rouge).

   ⚠️ **Lis le code de sortie sans pipe.** `npm run test | tail -20` renvoie le code de sortie de
   `tail`, donc **toujours 0** : un test rouge passe alors inaperçu. Lance la commande nue, ou
   redirige vers un fichier puis lis-le. Le piège s'est déjà refermé sur nous.

5. **Revue de code** : relis le diff de façon critique avant de committer — bugs, régressions,
   secrets oubliés, incohérences avec les specs (`docs/specs/`) et les bonnes pratiques
   ([bonnes-pratiques.md](../../docs/specs/technical/bonnes-pratiques.md)), respect de l'offline-first
   et de l'i18n (aucune chaîne en dur). Pour un diff conséquent, délègue à la capacité de revue
   de l'outil courant (Claude Code : agent `superpowers:code-reviewer` ou skill `/code-review`) ;
   s'il n'y en a pas, fais une revue complète toi-même. Si un problème **bloquant** ressort,
   **stoppe** et corrige (ou préviens) avant de committer ; sinon consigne les points d'attention
   dans le CHANGELOG (étape 6).

6. **CHANGELOG** : ajoute une entrée dans [`CHANGELOG.md`](../../CHANGELOG.md), insérée **juste
   sous** la ligne `<!-- Nouvelles entrées ajoutées ICI ... -->` (ordre anté-chronologique).
   Construis-la **à partir du `git diff`** pour une trace complète : date (JJ/MM/AAAA), sujet,
   branche, catégories (Ajouté / Modifié / Corrigé / Supprimé / Technique-Notes), fichiers
   touchés, et toute note utile au débogage (décision, contournement, point d'attention issu de
   la revue). **N'écris pas le hash de ce commit ici** : un commit ne peut pas contenir son propre
   hash. L'entrée est identifiée par date + branche + sujet ; le hash court du **commit précédent**
   peut être renseigné au passage. **Ne fais jamais de `--amend` juste pour insérer un hash.**

7. **Front-matter de l'US** : si le commit fait avancer une US, ouvre sa spec dans
   [`docs/specs/functional/us/`](../../docs/specs/functional/us/) et **fais avancer le champ
   `etape`** (`spec` → `plan` → `design` → `validation` → `code` → `recette` → `relecture` →
   `close`) + la date `maj`. C'est **la** source de vérité de l'avancement d'une US — pas un
   commentaire dans un fichier de suivi. Si l'US vient d'être clôturée, retire aussi son entrée de
   [`BACKLOG.md`](../../BACKLOG.md) le cas échéant.

8. **Roadmap — statut** (obligatoire si le commit touche une fonctionnalité de la roadmap) :
   ouvre [`docs/roadmap/roadmap.md`](../../docs/roadmap/roadmap.md) et **mets à jour la colonne
   Statut** de la/les ligne(s) concernée(s) selon le **réel du code** livré par ce commit :
   ✅ Livré (fonctionnalité complète et vérifiée) · 🟡 Partiel (socle présent mais incomplet —
   précise le manque en Remarques) · ⏳ Reporté. Repère la ligne par son **numéro thématique**
   (ex. `3.34`, `1.18`), donné par le champ `roadmap:` du front-matter de l'US.
   **Actualise aussi le [Récapitulatif]** (compteurs Livré / Partiel / À faire + tableau
   « Détail par version ») et ajoute **une entrée de 3 lignes maximum** au « Journal des
   réconciliations » — le détail va dans le CHANGELOG, pas là.

   ⚠️ Si la fonctionnalité livrée **n'a aucune ligne de roadmap**, ne saute pas l'étape :
   **crée-la** dans la section « Hors périmètre de cadrage » avec un numéro thématique libre.
   C'est ce qui manquait avant le 26/07/2026, et 15 fonctionnalités livrées étaient devenues
   invisibles. Si le commit ne touche vraiment aucune fonctionnalité (doc, outillage), saute
   l'étape et signale-le brièvement.

8 bis. **État** : lance `node scripts/etat.mjs` pour régénérer [`ETAT.md`](../../ETAT.md), et
   **stage le fichier régénéré**. Ne l'édite jamais à la main. Signale toute alerte remontée par
   le script (spec sans front-matter, migration non poussée).

9. **Message de commit** : format conventionnel `type(scope): sujet` **en français**
   (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`). Si l'adaptateur fournit un sujet non
   vide, utilise-le comme base du sujet. Ajoute un corps concis si utile. Termine par la ligne
   d'attribution **uniquement si l'adaptateur en fournit une** (Claude oui, Codex non).

10. **Commit** : `git add` uniquement les fichiers pertinents, par chemins explicites (jamais les
    sensibles, jamais un `git add .` aveugle), puis `git commit`. Affiche ensuite le hash du
    commit et un `git status` final propre.

11. **Push sur `dev`** : intègre le travail de la branche courante dans `dev` puis pousse.
    `git fetch origin`, puis mets `dev` à jour depuis `origin/dev` et fais avancer `dev` avec
    les commits de la branche (fast-forward si possible, sinon merge), enfin
    `git push origin dev`. Reviens ensuite sur la branche de travail. En cas de conflit ou de
    divergence de `dev`, **stoppe** et préviens l'utilisateur plutôt que de forcer.

Si le périmètre à committer est ambigu (mélange de sujets sans rapport), propose de scinder
en plusieurs commits **avant** d'agir.
