---
description: Régénère ETAT.md et affiche où en est le projet — à lancer en début de session
argument-hint: (aucun)
allowed-tools: Bash(node scripts/etat.mjs:*), Bash(git status:*), Bash(git log:*), Bash(git fetch:*), Bash(git rev-list:*), Read, Edit
---

Tu fais le point sur l'avancement du projet. **C'est la première chose à lancer dans une session** :
en sortie, tu dois savoir où en est le projet sans avoir lu un seul fichier de suivi à la main.

1. **Rafraîchis git** : `git fetch origin` (silencieux, sans rien modifier localement).

2. **Régénère** : `node scripts/etat.mjs`. Le script lit le front-matter des specs
   ([docs/specs/functional/us/](../../docs/specs/functional/us/)), [BACKLOG.md](../../BACKLOG.md),
   les compteurs de la [roadmap](../../docs/roadmap/roadmap.md), le registre des migrations et git,
   puis réécrit [ETAT.md](../../ETAT.md).

3. **Lis [ETAT.md](../../ETAT.md)** et **restitue-le à l'oral en ≤ 12 lignes** :
   - le cap (% MVP1, version en cours, nombre de P0 restants) ;
   - ce qui est **en cours** et à quelle étape du workflow ;
   - la **prochaine action évidente** — s'il n'y a aucune US en cours, propose les 2-3 meilleurs
     candidats du backlog **avec un mot sur leur point dur**, et demande lequel démarrer ;
   - toute **alerte** remontée par le script (spec sans front-matter, migration non poussée,
     working tree sale…).

4. **Ne raconte pas l'historique.** Personne n'a besoin du récit des trois dernières semaines.
   Seulement : où on est, ce qui bloque, quoi faire ensuite.

## Règles

- **ETAT.md ne s'édite jamais à la main.** Si une ligne est fausse, la source est fausse : corrige
  le front-matter de la spec, le backlog ou la roadmap, puis relance le script.
- Si le script signale des **specs sans front-matter**, propose de les compléter — c'est un trou
  dans le suivi, pas un détail cosmétique.
- Si `main` a beaucoup de retard sur `dev`, ne le signale que si un lancement approche (c'est
  normal tant qu'aucune release n'est sortie).
