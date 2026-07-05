# Changelog

Toutes les modifications notables du projet sont consignées ici — **maintenu automatiquement
par la commande [`/commit`](.claude/commands/commit.md)**. Chaque entrée est construite à partir
de l'analyse du `git diff` du commit, pour garder une **trace complète** des modifications
(utile aux devs et au débogage).

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/). Dates au format **JJ/MM/AAAA**.
Catégories : **Ajouté** · **Modifié** · **Corrigé** · **Supprimé** · **Technique / Notes**.

<!-- Nouvelles entrées ajoutées ICI (ordre anté-chronologique, la plus récente en haut) -->

## 05/07/2026 — Ajout du bundle design FitTrio (handoff Claude Design)

_Branche : `docs/verdict-spike-001`_

### Ajouté
- **`design/`** : bundle de handoff exporté depuis Claude Design (« FitTrio ») — prototype
  HTML/CSS/JS (`FitTrio.dc.html`), preview (`FitTrio.preview.webp`), `design-system.md`,
  script `support.js` et `README.md` d'instructions pour l'agent.

### Fichiers touchés
- `design/FitTrio.dc.html`, `design/FitTrio.preview.webp`, `design/README.md`,
  `design/design-system.md`, `design/support.js`

## 05/07/2026 — Spike 001 PowerSync : verdict ✅ + runbook corrigé

_Branche : `docs/verdict-spike-001`_

### Ajouté
- **ADR-001** — section « Résultat du spike 001 (05/07/2026) » : tableau des 6 critères,
  verdict (**PowerSync validé**), 2 pièges de config rencontrés, réserve sur la volumétrie GPS.

### Modifié
- **ADR-001** : statut → « ✅ Accepté et confirmé » (confirmé par le spike le 05/07/2026).
- **runbook-provisioning-spike** : rôle de réplication dédié `powersync_role` (1.3) ;
  formulaire de connexion réel + étape **Client Auth « Use Supabase Auth »** contre le 401
  `PSYNC_S2101` (2.2/2.2b) ; **Sync Streams `edition: 3` avec `auto_subscribe: true`** (2.3).

### Technique / Notes
- Le code de la mini-app du spike vit **hors du repo** (`../wellness-spike`, dépôt git séparé),
  conforme à la spec spike-001 (« jetable / archivé hors du repo principal »).

### Fichiers touchés
- `docs/adr/ADR-001-moteur-sync-offline.md`, `docs/specs/technical/runbook-provisioning-spike.md`,
  `CHANGELOG.md`, `TODO.md`

## 05/07/2026 — Ajout de `.gitignore` et `.gitattributes`

_Branche : `chore/gitignore-gitattributes` · commit précédent : `d81b11e`_

### Ajouté
- **`.gitignore`** : dépendances, secrets/env (`.env*`, clés, `google-services.json`, keystores),
  artefacts Expo/Metro/Android/iOS, Supabase local, caches, fichiers OS/IDE. Le dossier `.claude/`
  reste suivi volontairement.
- **`.gitattributes`** : normalisation des fins de ligne (LF dans le dépôt), scripts Windows en
  CRLF, fichiers binaires marqués — **supprime les avertissements « LF will be replaced by CRLF »**.

### Fichiers touchés
- `.gitignore`, `.gitattributes`

## 05/07/2026 — `/commit` : robustesse du hash CHANGELOG (pas de self-amend)

_Branche : `chore/mise-en-place-process`_

### Corrigé
- Règle CHANGELOG de `/commit` : ne plus embarquer le hash du commit courant (circulaire) ni
  faire de `--amend` pour l'insérer. Une entrée est identifiée par date + branche + sujet ; le
  hash court du **commit précédent** est renseigné au passage.
- Hash de l'entrée précédente corrigé (`e174d89`).

### Fichiers touchés
- `.claude/commands/commit.md`, `CHANGELOG.md`

## 05/07/2026 — `/commit` : revue de code, CHANGELOG et traces de diff (`e174d89`)

_Branche : `chore/mise-en-place-process`_

### Ajouté
- **`CHANGELOG.md`** : trace des modifications par commit, construite à partir du `git diff`,
  maintenue par `/commit`.
- **`/commit`** : étape de **revue de code** (relecture critique du diff, délégable à
  `superpowers:code-reviewer`) et étape de **tenue du CHANGELOG** ; l'analyse exploite le diff
  complet comme trace pour les devs / le débogage.

### Modifié
- `CLAUDE.md` : responsabilités élargies de `/commit` (revue + CHANGELOG + traçabilité) et ajout
  de `CHANGELOG.md` à la structure documentaire.

### Fichiers touchés
- `CHANGELOG.md`, `.claude/commands/commit.md`, `CLAUDE.md`

## 05/07/2026 — Adoption de `dev` comme branche d'intégration (`785459c`)

_Branche : `chore/mise-en-place-process`_

### Modifié
- **Modèle de branches** : `main` (release, protégée) · `dev` (intégration, cible du travail
  courant) · `feature/*` (travail). Les branches partent désormais de `dev`.
- **`/commit`** : refuse aussi `dev` (étape branche) et pousse le travail sur `dev` distant en
  fin de commande.

### Fichiers touchés
- `CLAUDE.md`, `.claude/commands/commit.md`

## 05/07/2026 — Base documentaire de cadrage & process de travail (`b46d458`)

_Branche : `chore/mise-en-place-process`_

### Ajouté
- Base documentaire unique sous `docs/` (product, specs functional/technical, adr, roadmap).
- `CLAUDE.md`, `SYNTHESE-CADRAGE.md`, `TODO.md` (suivi vivant), `design/` (maquettes).
- Workflow obligatoire par fonctionnalité (spec → plan → design → validation → code) et
  convention de branches dans `CLAUDE.md`.
- Commande `/commit` adaptée au projet (`.claude/commands/commit.md`).

### Supprimé
- Anciens dossiers de cadrage séparés `dams/` et `flo/` (fusionnés dans `docs/`).

### Modifié
- `README.md` (mise à jour post-fusion).
