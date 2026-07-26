---
description: Audite l'écart entre le code réel et les fichiers de suivi (roadmap, backlog, catalogue, specs)
argument-hint: [périmètre optionnel — ex. « muscu », « V0.8 »]
allowed-tools: Bash(git log:*), Bash(git status:*), Bash(npm:*), Bash(node scripts/etat.mjs:*), Read, Edit, Glob, Grep
---

Tu vérifies que la documentation de suivi dit **la vérité sur le code**. À lancer environ une fois
par mois, et **avant tout jalon** (fin de version, ouverture de bêta, soumission store).

Périmètre demandé (optionnel) : `$ARGUMENTS` — si vide, audite tout.

C'est un audit **à charge** : par défaut, on suppose que la doc a dérivé. Une ligne n'est réputée
juste que si tu as vu la preuve dans le code.

## Ce que tu vérifies

1. **Roadmap → code.** Pour chaque ligne au statut ⬜ ou 🟡, cherche activement la preuve du
   contraire (fichier, fonction, composant, route, migration). Le sens de dérive dominant est
   « **livré mais toujours affiché à faire** » : la refonte muscu à elle seule avait laissé 6 lignes
   fausses. Cite le fichier et la ligne pour chaque écart.

2. **Code → roadmap.** L'inverse, et c'est le plus vicieux : cherche les **fonctionnalités livrées
   qui n'ont aucune ligne**. Signaux — une spec dans `docs/specs/functional/us/` dont le
   `roadmap:` est `[]`, un dossier `design/` sans ligne correspondante, un chantier visible dans
   `git log` mais absent du plan de versions. → Ajouter à la section
   « Hors périmètre de cadrage » avec un numéro thématique libre.

3. **Front-matter → réalité.** Une spec `etape: close` dont la branche n'est pas mergée, ou
   `etape: code` alors que le travail est fini depuis deux semaines. Croise avec `git log`.

4. **Catalogue d'analyses.** Les lignes ⏳ / 🆕 de
   [analyses-donnees.md](../../docs/product/analyses-donnees.md) dont la brique existe déjà dans
   `packages/shared/src`.

5. **Backlog.** Des candidats de [BACKLOG.md](../../BACKLOG.md) déjà livrés (ils doivent disparaître),
   ou des trous : du reste-à-faire connu qui n'y figure pas.

6. **Cohérence des compteurs.** Le récapitulatif de la roadmap doit s'additionner
   (✅ + 🟡 + ⬜ + ⏳ + ❌ = total), et le détail par version doit sommer au total de la version.

7. **Migrations.** Chaque fichier de `supabase/migrations/` a sa ligne cochée dans
   [MIGRATIONS.md](../../supabase/MIGRATIONS.md).

## Restitution

D'abord **le compte rendu, pas les corrections** : un tableau `écart · preuve (fichier:ligne) ·
correction proposée`, trié par gravité. Puis demande le feu vert avant d'appliquer.

Une fois validé : applique les corrections, ajoute **une entrée de 3 lignes maximum** au
« Journal des réconciliations » de la roadmap, régénère `node scripts/etat.mjs`, et commite via
[`/commit`](commit.md).

## Garde-fou

Ne « corrige » jamais un statut sur la foi d'un fichier de suivi — c'est précisément lui qu'on
audite. **Seul le code fait foi.** Si tu ne trouves pas la preuve, dis « non vérifié » plutôt que
de trancher.
