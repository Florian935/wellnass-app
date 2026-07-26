# Backlog — ce qu'il reste à faire

Une ligne par **candidat**, priorisé. Un candidat n'a **pas encore de spec** : dès qu'il entre
dans le pipeline (`/us`), il devient une spec dans [docs/specs/functional/us/](docs/specs/functional/us/)
avec son front-matter, disparaît d'ici et apparaît dans [ETAT.md](ETAT.md).

- **Où est quoi** : l'état courant → [ETAT.md](ETAT.md) · le périmètre complet →
  [roadmap](docs/roadmap/roadmap.md) · les analyses → [catalogue](docs/product/analyses-donnees.md)
  · les idées non cadrées → [IDEAS.md](IDEAS.md) · l'historique → [CHANGELOG.md](CHANGELOG.md).
- **Priorités** : **P0** bloquant le lancement · **P1** finition produit visible · **P2** confort / optionnel.
- Les `#` renvoient aux numéros de la [roadmap](docs/roadmap/roadmap.md).

---

## 🔴 P0 — Bloquant MVP1 (V0.8 → V1.0)

| Candidat | # | Contenu | Point dur |
|---|---|---|---|
| **CONF-06 — Health Connect** | 9.9 | Écriture des séances + lecture du poids (Android). | Module natif → dev build ; API Health Connect à cadrer. |
| **CONF-07 — Accessibilité** | 9.11, 9.12 | Dynamic Type explicite (`maxFontSizeMultiplier` / `fontScale`) + audit contraste WCAG AA. | Revue visuelle humaine, non outillée à ce jour. |
| **LANCE-01 — Publication Play Store** | 9.2 | Build AAB prod (EAS) + fiche Play + soumission review. | 🔴 Compte Google Play + délai de review. Dépend de tout le P0. |

> **Prérequis hors-code du lancement** : textes CGU / politique de confidentialité (relecture
> juridique), SMTP custom Supabase (le service e-mail intégré est rate-limité), `app_version`
> réelle dans `app.json` (aujourd'hui `0.0.0`).

---

## 🟠 P1 — Finitions produit

### Musculation

| Candidat | # | Contenu | État |
|---|---|---|---|
| **MUSC-F7 — Progression assistée** | 3.7, 3.8 | Progression auto de charge au niveau programme + câblage du deload. | 🟡 La brique pure `computeProgressionSuggestion` (kind `deload`) est **livrée et testée mais non déclenchée** : il manque le signal `previousStruggled` (séance avant-dernière) et la validation de la règle par Florian. |
| **MUSC-F8 — Notifications push muscu** | 3.42, 2.7, 2.4 | Push nouveau record + rappel de séance planifiée. | ⬜ L'infra notif existe (streak, DND) → à étendre. |
| **MUSC-F9 — Décalage en glisser-déposer** | 3.10 | Déplacer une séance planifiée au doigt. | ⬜ Aujourd'hui report par action seulement. Aucune lib DnD sur le planning. |
| **MUSC-F1b — Muscles ciblés sur schéma SVG** | 6.2 | Corps humain SVG avec muscles travaillés en évidence. | ⬜ Sujet **distinct** des GIF abandonnés (6.1) — reste ouvert. |
| **MUSC-F6 — Fenêtre de reprise de séance** | 3.36 | Réconcilier les seuils : la spec dit 4 h, la clôture auto (3.37) borne à 3 h. | 🟡 Décision produit à trancher avant code. |

### Running

| Candidat | # | Contenu | État |
|---|---|---|---|
| **RUN-F2 — Séances guidées vocales** | 5.18, 5.19, 5.9, 5.23 | Annonces audio par km + guidage fractionné + blocs rapide/récup structurés + cible prolonger/raccourcir. | ⬜ Les séances guidées sont **déconnectées du tracker actif** — c'est le vrai chantier. Dépend de `expo-speech` (absent). |
| **RUN-F3 — Résumé de course enrichi** | 5.24, 5.25 | Météo / terrain + comparaison à l'objectif. | ⬜ |
| **RUN-F1b — Dénivelé cumulé** | 5.32 | Dénivelé positif par semaine / mois. | ⛔ **Bloqué** : la trace GPS ne capte pas l'altitude (`GpsPoint = {lat,lng,t}`). Nécessite de modifier le tracker R1, étendre le codec, et **les courses déjà enregistrées resteront sans dénivelé**. |

### Contenu

| Candidat | # | Contenu | État |
|---|---|---|---|
| **CONTENU-01 — Seed des bibliothèques de programmes** | 3.1, 5.2 | Catalogues muscu + course, aujourd'hui **vides**. 🌐 FR+EN. | 🟡 **Spec draftée, en attente d'arbitrage** → [spec](docs/specs/functional/us/contenu-01-seed-bibliotheques-programmes.md). À trancher : migration idempotente (précédent CIQUAL) **vs** saisie via le constructeur admin (8.4, livré). |

---

## 🟢 P2 — Confort & optionnel

| Candidat | # | Contenu | État |
|---|---|---|---|
| **NUTR-F1 — Rappels programmés nutrition** | 1.14, 2.5 | Rappel de pesée + rappel de repas. | ⬜ Étend l'infra notif existante. |
| **SOCLE-01 — RevenueCat câblé inactif** | 9.14 | Entitlements posés, aucun paywall (app gratuite en V1). | ⬜ Optionnel — posé tôt, évite une refonte ([ADR-003](docs/adr/ADR-003-monetisation.md)). |

---

## 🧹 Dette & suivi technique

Petits sujets hors US, à traiter à l'occasion. Ne bloquent rien.

- [ ] **`supabase/seed.sql` est inatteignable** — il n'est joué que par `db:reset`, qui exige Docker
      (que personne n'a). Les 16 exercices de bibliothèque sont donc arrivés sur le cloud par un
      chemin non tracé. → Les basculer en **migration idempotente** (comme le seed CIQUAL), ou
      documenter explicitement que `seed.sql` ne sert qu'au futur usage Docker.
- [ ] **`main` n'a pas bougé depuis le 04/07/2026** (927 commits de retard sur `dev`). Aucun tag,
      aucun point de repère de version. → À traiter au moment de LANCE-01.
- [ ] **2 tests mobile en échec par timeout** (`edit-exercise-modal-smoke`, `exercise-detail-smoke`) :
      dépassement des 15 s sur poste lent (jest y met ~250 s par suite). Pas une régression logique.
      → Vérifier sur CI ; si rouge, relever le `testTimeout` de ces deux suites.
- [ ] **Suivi analytics (US 9.10)** : dépendance circulaire bénigne `analytics.ts ↔ settings-repository.ts` ·
      test du gating `track()` (OFF → no-op) · doublon `onboarding_started` observé en dev (probable
      StrictMode, à confirmer hors dev) · renseigner une vraie `app_version` avant la bêta.
- [ ] **Recette 2 appareils du `signOut` local** (`fix/signout-scope-local`) — déconnecter A ne doit
      pas déconnecter B. Non vérifiable sur un seul device.
- [ ] **Découpage des stats course par type de séance** — différé : les courses libres n'ont pas de
      `session_type`.

---

## ⏳ Reporté / abandonné (trace)

| Item | # | Décision |
|---|---|---|
| Modération des aliments signalés | 8.7 | ⏳ **Reportée** (16/07/2026) : modèle **privé par utilisateur** (RLS `owner_id`), aucun mécanisme de signalement → file sans objet. À redéfinir avant reprise. |
| Démonstrations visuelles d'exercices (GIF) | 6.1, 3.18, 6.3, 8.3 | ❌ **Abandonné** (Florian/Damien, 20/07/2026) : trop complexe pour la valeur (sourcing + hébergement + import en masse). `media_url` reste stocké mais ne sera jamais rendu. |
| App iOS + OAuth Apple | 9.1, 1.3 | ⏳ Hors périmètre de lancement ([ADR-004](docs/adr/ADR-004-plateforme-lancement.md)) — portage après stabilisation Android. |
| Import de données (GPX, CSV Hevy/Strong/MFP) | 1.20 | V1.1 post-lancement — à remonter en V0.8 si la bêta le réclame. |
| Planning repas + liste de courses | 4.27, 4.28, 4.29 | V1.1 post-lancement. |

---

*Tenu à jour par [`/commit`](.claude/commands/commit.md) et [`/etat`](.claude/commands/etat.md).
Dernière révision : 26/07/2026.*
