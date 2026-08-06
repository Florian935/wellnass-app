# Backlog — ce qu'il reste à faire

Une ligne par **candidat**, priorisé. Un candidat n'a **pas encore de spec** : dès qu'il entre
dans le pipeline (`/us`), il devient une spec dans [docs/specs/functional/us/](docs/specs/functional/us/)
avec son front-matter, **disparaît d'ici** et apparaît dans [ETAT.md](ETAT.md).

- **Où est quoi** : l'état courant → [ETAT.md](ETAT.md) · le périmètre complet →
  [roadmap](docs/roadmap/roadmap.md) · les analyses → [catalogue](docs/product/analyses-donnees.md)
  · les idées non cadrées → [IDEAS.md](IDEAS.md) · l'historique → [CHANGELOG.md](CHANGELOG.md).
- **Priorités** : **P0** bloquant le lancement · **P1** finition produit visible · **P2** confort / optionnel.
- Les `#` renvoient aux numéros de la [roadmap](docs/roadmap/roadmap.md).

> 🧹 **Purgé le 06/08/2026** par [`/reconcilier`](.claude/commands/reconcilier.md) : **34 lignes de
> candidats barrées** (déjà livrés, donc sortis du backlog par définition) et **11 entrées de dette
> cochées** ont été retirées, avec les 3 sections devenues vides. Le fichier passe de **338 à ~150
> lignes**. Leur trace vit dans le [CHANGELOG](CHANGELOG.md) — c'est son rôle, pas le nôtre.
> **La règle, redite** : ce fichier ne garde que ce qui reste **à faire**. Une ligne barrée ici est
> une ligne à supprimer, pas à conserver « pour mémoire ».

---

## 🔴 P0 — Bloquant MVP1 (V0.8 → V1.0)

| Candidat | # | Contenu | Point dur |
|---|---|---|---|
| **LANCE-00 — Compte développeur Google Play** | 9.2 | Créer le compte développeur (25 $, une fois), puis la fiche d'application dans la Play Console. | 🔴 **Rien de la chaîne de publication ne peut démarrer sans lui** — ni la fiche, ni la déclaration santé, ni la soumission. Vérification d'identité Google : compter plusieurs jours. **Non démarré au 06/08/2026.** ⚠️ **La déclaration santé doit porter 6 types de données** (`WRITE_EXERCISE`, `WRITE_DISTANCE`, `READ_WEIGHT`, `READ_STEPS`, `READ_MENSTRUATION`, `WRITE_MENSTRUATION`) et déclarer, en « Sécurité des données », une **donnée de santé transmise hors de l'appareil** (les pas sont synchronisés). |
| **LANCE-01 — Publication Play Store** | 9.2 | Build AAB prod (EAS) + fiche Play + soumission review. | 🔴 Dépend de **LANCE-00** + de tout le P0 + du délai de review. |

> **Prérequis hors-code du lancement**, dans l'ordre des dépendances :
> 1. **Compte développeur Play + fiche d'app** (LANCE-00) — **préalable à tout le reste**.
> 2. **Politique de confidentialité publiée à une URL publique** (pas seulement le texte in-app) —
>    exigée par la fiche Play **et** par Health Connect ; suppose la relecture juridique des
>    textes CGU / confidentialité. ⚠️ **Rouverte par CYCLE-01 et DOUL-01** (données de santé
>    sensibles) : la relecture doit porter sur la version qui les mentionne.
> 3. **Déclaration Google Play « Health apps »** pour Health Connect : formulaire + justification
>    des **6 types de données**. ~7 j d'instruction + 5-7 j ouvrés de propagation. Procédure et
>    textes prêts à coller :
>    [health-connect-play-declaration.md](docs/specs/technical/health-connect-play-declaration.md).
>    🔴 **Elle se dépose une seule fois** : la déposer incomplète impose une re-déclaration et
>    ~2 semaines de délai externe de plus.
> 4. SMTP custom Supabase (le service e-mail intégré est rate-limité).
>
> 📄 **Brouillons prêts à relire** :
> [lance00-fiche-play-et-confidentialite.md](docs/specs/technical/lance00-fiche-play-et-confidentialite.md)
> — politique de confidentialité publiable, fiche Play (titre / descriptions), réponses au formulaire
> « Sécurité des données » établies d'après les tables réelles, et ordre d'exécution.
> **Restent à compléter par un humain** : l'identité du responsable de traitement + l'e-mail de
> contact (RGPD, je ne peux pas les inventer), la version EN, et la relecture juridique.
> 🟠 **Décision de charte en attente** : l'écran de démarrage est resté au **bleu du gabarit Expo**
> (`#208AEF`), ainsi que le fond de l'icône adaptative (`#E6F4FE`), alors que la palette est
> crème/terracotta. C'est la première chose vue à chaque lancement, et c'est l'icône de la fiche
> Play. → Damien/Florian (proposition : `#f7eede` pour les deux).
> ⚠️ **Analytics** : toutes les mesures collectées avant le 30/07/2026 portent `app_version = 0.0.0`
> et sont indistinguables entre elles (corrigé depuis, `app.json` → `1.0.0`).
>
> ⚠️ Les points 1 → 3 s'enchaînent **en série** et sont tous à délai externe : environ **3 semaines**
> entre « je crée le compte » et « Health Connect fonctionne en production ». À démarrer bien avant
> d'avoir fini le code, sinon ils deviennent le chemin critique du lancement.

---

## 🟠 P1 — Finitions produit

| Candidat | # | Contenu | Point dur |
|---|---|---|---|
| **RUN-F3b — Météo de course** *(scindé de RUN-F3)* | 5.24 | Conditions météo au moment de la course, et avant une sortie planifiée. | 🔴 **À trancher AVANT de soumettre la fiche Play.** Une requête météo transmet des **coordonnées à un service externe** — ce qui contredit la politique de confidentialité et le formulaire « Sécurité des données » rédigés pour [LANCE-00](docs/specs/technical/lance00-fiche-play-et-confidentialite.md), qui affirment aujourd'hui qu'aucune donnée n'est partagée. Trois questions ouvertes (spec RUN-F3 §4 D2) : fournisseur (Open-Meteo = le seul sans clé à stocker), moment de l'appel, et **assumer qu'une course hors réseau n'aura jamais de météo** — on ne récupère pas une météo passée gratuitement. Le **terrain**, lui, ne demande aucun réseau et est livré depuis le 01/08/2026. |

> **Il ne reste aucun autre candidat P1.** Les 14 idées promues dans
> [V0.9](docs/roadmap/roadmap.md#v09--enrichissements-avant-lancement) le 28/07/2026 sont **toutes
> livrées** et en recette ([RECETTES.md](RECETTES.md)), CONF-07 comprise (01/08/2026), ainsi que la
> 2ᵉ salve du 28/07 (RUN-14, NUTR-16, MUSC-09, LAUNCHER-01, ACTIV-01) et les 4 enrichissements
> ouverts après elle (INSIGHTS-01/02, COLLIS-01, VIE-01, DOUL-01).
>
> ⚠️ **CONTENU-01 n'est plus un candidat** : il a une spec depuis le 28/07/2026
> ([contenu-01…md](docs/specs/functional/us/contenu-01-seed-bibliotheques-programmes.md),
> `etape: recette`) et devait donc quitter ce fichier — il y était resté jusqu'au 06/08/2026, en
> contradiction avec [ETAT.md](ETAT.md) qui l'excluait déjà. Ce qui reste ouvert dessus est une
> **décision de contenu**, pas un candidat de dev : combien de programmes par pilier au lancement, et
> qui fournit séances/exos/reps. C'est du travail de coach → Damien/Florian. Critères de recette en
> [RECETTES.md](RECETTES.md) §3.

---

## 🟢 P2 — Confort & optionnel

| Candidat | # | Contenu | Point dur |
|---|---|---|---|
| **SOCLE-01 — RevenueCat câblé inactif** | 9.14 | Entitlements posés, aucun paywall (app gratuite en V1). | ⏳ **Différée le 30/07/2026 (Florian), après cadrage.** Quatre constats : (1) [prd.md:122](docs/product/prd.md) dit les paliers Premium → Écosystème → IA « conservés **pour mémoire uniquement, non engageants** » — les définir serait les inventer ; (2) **« Premium muscu » n'a aucun contenu défini** nulle part et « Écosystème » n'est nommé que dans l'ADR-003 — seul le palier **IA** a une décision datée (15/07/2026 : 1-2 bilans croisés gratuits bridés vs exhaustif + chatbot à quota) ; (3) **aucune fonctionnalité IA n'est livrée** ([ia-integration-analyse.md](docs/product/ia-integration-analyse.md) n'est pas encore une US) → la couture n'aurait **aucun consommateur réel** ; (4) LANCE-00 non fait → sans compte Play, aucun produit configurable, donc **un SDK RevenueCat n'aurait rien à récupérer**. **À reprendre avec la première US IA**, qui fournira le premier point d'accès réellement gatable. |

---

## 🧹 Dette & suivi technique

Petits sujets hors US, à traiter à l'occasion. Ne bloquent rien — **sauf le premier**.

- [ ] 🔴 **15 US en recette n'ont aucune section dans [RECETTES.md](RECETTES.md).** Trouvé le
      06/08/2026 par [`/reconcilier`](.claude/commands/reconcilier.md) : **49 US** sont à
      `etape: recette`, **34 sections** existent. Manquent **GARDE-01, META-19, MN-04, MR-08,
      MUSC-12, MUSC-19, MUSC-20, MUSC-F15, NUTR-18, RN-03, RUN-18, RUN-F1b, RUN-F2a, RUN-F2b,
      TRI-03**. Leurs critères vivent dans leur spec, mais **rien n'est cochable** : personne ne sait
      ce qu'il reste à vérifier sur device, et c'est précisément l'information que RECETTES.md existe
      pour empêcher de mourir avec la session qui l'a produite (voir [CLAUDE.md](CLAUDE.md), « la
      recette est la seule étape qu'un agent ne peut pas franchir »). **À écrire avant la prochaine
      campagne de recette.** 4 lignes de ce backlog pointaient vers ces sections inexistantes.

- [ ] 🟠 **Socle de tests unitaires — lot 5 (écrans).** Chantier ouvert le 03/08/2026 :
      1 681 → **2 215 tests**, couverture mobile 15,0 % → **23,3 %**, `data/repositories`
      9 % → **31 %**, `lib` 28 % → **54 %**, `stores` 16 % → **48 %**, et `apps/admin` passé de
      **aucun runner** à **157 tests / 61 %**. **Lots 0 à 4 et 6 terminés** — les seuils de
      couverture sont désormais **appliqués par la CI** (`npm run test:coverage`). Plan, technique
      et **point de reprise §8** : [strategie-tests.md](docs/specs/technical/strategie-tests.md).
      Reste : les **écrans à état**, et surtout la **reprise des `*-smoke.test.tsx` existants** —
      écrits sans attendre de tour de boucle, leurs effets n'ont jamais tourné : ils n'assertent
      que du rendu statique (§3.6). C'est là que se cache le plus gros écart entre couverture
      affichée et couverture réelle.
      ⚠️ **`.nvmrc` est passé à Node 24** (`node:sqlite`) : `nvm use 24` avant de lancer les tests,
      sinon la suite mobile échoue à l'import du harness sans dire pourquoi.

- [ ] 🟠 **~12 composants de carte devenus du code mort après INSIGHTS-02.** Le dégonflage du Tier 0
      a ramené le dispatch d'accueil de 21 à 7 entrées ; les composants correspondants ne sont plus
      référencés que par leurs propres tests et par des **mentions en commentaire** dans d'autres
      cartes. Liste vérifiée le 05/08/2026 dans `apps/mobile/src/components/dashboard/` :
      `DeficitVolumeAlertCard`, `TrainingLoadAlertCard`, `OvertrainingGuardCard`, `ReadinessCard`,
      `ActivityLevelSuggestionCard`, `ConcurrentTrainingInterferenceCard` (leur signal vit
      désormais en **carte d'insight**) · `GoalsCard`, `WellbeingCard`, `ReviewCard`,
      `MuscleVolumeCard`, `RunningWeekCard`, `WeightCard` (leur **écran** existe et a sa propre
      mise en page — la carte ne servait qu'à l'accueil).
      ⚠️ **Volontairement non supprimés** : effacer 12 composants et leurs suites de tests dans un
      commit qui en touche déjà 31 aurait été plus risqué qu'utile. Du code mort est visible et
      inoffensif ; une suppression prématurée ne l'est pas.
      À faire en `chore/` dédié — vérifier au passage qu'aucun n'est destiné à un hub (candidats
      plausibles : `MuscleVolumeCard` et `RunningWeekCard`).

- [ ] 🟠 **COLLIS-01 — le conflit dimanche → lundi n'est jamais détecté.** Soulevé le 05/08/2026 en
      revue de code, **non tranché**. La détection est bornée à la **semaine affichée** : une grosse
      séance de jambes le dimanche suivie d'un fractionné le lundi est donc structurellement
      invisible — **une paire de jours sur sept**, et pas la plus rare. Ce n'est pas un défaut
      d'implémentation : c'est conforme à la spec validée (§4) et **figé par un test**
      (`session-conflicts.test.ts`, « ne déclenche pas sur une course le premier jour de la
      semaine »). Correctif possible sans toucher au repli : charger **un jour de plus en amont**
      pour la seule détection, en gardant le repli borné à la semaine affichée.
      **Décision produit → Florian.**

- [ ] 🟠 **Décision RGPD — `analytics_events` doit-elle entrer dans l'export de données ?**
      Soulevé le 03/08/2026 par le test de complétude de l'export (US CONF-01). La table est
      aujourd'hui **exclue** — exclusion héritée, jamais arbitrée explicitement. Elle porte un
      `user_id` et vit sur nos serveurs, donc son inclusion dans le droit à la portabilité est
      défendable ; à l'inverse c'est de la télémétrie opt-in sans donnée identifiante (allowlist
      stricte `ALLOWED_PROP_KEYS`). Décision produit/juridique → Damien/Florian. Le choix est
      matérialisé dans `EXPORT_EXCLUSIONS` (`apps/mobile/src/lib/data-export.ts`) : basculer
      revient à déplacer une ligne.

- [ ] 🟠 **`main` n'a pas bougé depuis le 04/07/2026** — **1 088 commits de retard sur `dev`** au
      06/08/2026. Aucun tag, aucun point de repère de version. → À traiter au moment de LANCE-01.

- [ ] 🟢 **Recette 2 appareils du `signOut` local** (`fix/signout-scope-local`) — déconnecter A ne
      doit pas déconnecter B. Non vérifiable sur un seul device.

- [ ] 🟢 **Découpage des stats course par type de séance** — différé : les courses libres n'ont pas
      de `session_type`. Correspond à **RUN-07** du [catalogue](docs/product/analyses-donnees.md),
      seul ⏳ actionnable qui reste avec META-18.

- [ ] 🟢 **Deux branches locales mortes à supprimer.**
      `feature/1.15-unites-metrique-imperial` porte **1 commit orphelin** (`5c4901b`) qui ne touche
      que `TODO.md`, fichier supprimé depuis — l'US est `close` et son code est dans `dev`.
      `chore/compatibilite-claude-codex` porte les **5 commits du chantier Codex abandonné le
      06/08/2026** (voir [IDEAS.md](IDEAS.md)) : à conserver tant que la décision n'est pas
      définitive, c'est la seule trace du travail.

---

## ⏳ Reporté / abandonné (trace)

| Item | # | Décision |
|---|---|---|
| Modération des aliments signalés | 8.7 | ⏳ **Reportée** (16/07/2026) : modèle **privé par utilisateur** (RLS `owner_id`), aucun mécanisme de signalement → file sans objet. À redéfinir avant reprise. |
| Démonstrations visuelles d'exercices (GIF) | 6.1, 3.18, 6.3, 8.3 | ❌ **Abandonné** (Florian/Damien, 20/07/2026) : trop complexe pour la valeur (sourcing + hébergement + import en masse). `media_url` reste stocké mais ne sera jamais rendu. |
| App iOS + OAuth Apple | 9.1, 1.3 | ⏳ Hors périmètre de lancement ([ADR-004](docs/adr/ADR-004-plateforme-lancement.md)) — portage après stabilisation Android. |
| Import de données (GPX, CSV Hevy/Strong/MFP) | 1.20 | V1.1 post-lancement. US **IMPORT-01** cadrée (spec + plan + maquette) mais **développement en pause** : il faut un export réel de Hevy, Strong et MyFitnessPal pour figer les alias de colonnes → [import-samples/README.md](docs/specs/technical/import-samples/README.md). Seul item encore ⬜ de V1.1. |
| Compatibilité Claude Code ↔ Codex | — | ❌ **Abandonné le 06/08/2026 (Florian).** Chantier de 5 commits resté sur `chore/compatibilite-claude-codex`, jamais mergé et tracé nulle part avant cette réconciliation. Décision et contenu : [IDEAS.md](IDEAS.md). |

---

*Tenu à jour par [`/commit`](.claude/commands/commit.md) et [`/etat`](.claude/commands/etat.md).
Dernière révision : **06/08/2026** — réconciliation : purge de 34 candidats livrés + 11 dettes
closes, CONTENU-01 sorti des candidats, déclaration Health portée de 4 à **6 types**, chantier Codex
abandonné, et ouverture de la dette 🔴 des 15 recettes sans critères.*
