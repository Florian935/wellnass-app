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
| **LANCE-00 — Compte développeur Google Play** | 9.2 | Créer le compte développeur (25 $, une fois), puis la fiche d'application dans la Play Console. | 🔴 **Rien de la chaîne de publication ne peut démarrer sans lui** — ni la fiche, ni la déclaration santé, ni la soumission. Vérification d'identité Google : compter plusieurs jours. **Non démarré au 27/07/2026.** ⚠️ **La déclaration santé doit porter 4 types de données** (`WRITE_EXERCISE`, `WRITE_DISTANCE`, `READ_WEIGHT` de CONF-06 **+ `READ_STEPS`** de PAS-01, tranché le 28/07/2026) et déclarer, en « Sécurité des données », une **donnée de santé transmise hors de l'appareil** (les pas sont synchronisés). |
| **LANCE-01 — Publication Play Store** | 9.2 | Build AAB prod (EAS) + fiche Play + soumission review. | 🔴 Dépend de **LANCE-00** + de tout le P0 + du délai de review. |

> **CONF-06 — Health Connect** (9.9) est **entré dans le pipeline** le 26/07/2026 →
> [spec](docs/specs/functional/us/conf06-health-connect.md) · [plan](docs/plans/conf06-health-connect.md).
> Code livré le 27/07/2026 ; reste la recette device et la déclaration Play (ci-dessous).

> **Prérequis hors-code du lancement**, dans l'ordre des dépendances :
> 1. **Compte développeur Play + fiche d'app** (LANCE-00) — **préalable à tout le reste**.
> 2. **Politique de confidentialité publiée à une URL publique** (pas seulement le texte in-app) —
>    exigée par la fiche Play **et** par Health Connect ; suppose la relecture juridique des
>    textes CGU / confidentialité.
> 3. **Déclaration Google Play « Health apps »** pour Health Connect : formulaire + justification
>    des 3 types de données. ~7 j d'instruction + 5-7 j ouvrés de propagation. Procédure et textes
>    prêts à coller : [health-connect-play-declaration.md](docs/specs/technical/health-connect-play-declaration.md).
> 4. SMTP custom Supabase (le service e-mail intégré est rate-limité).
> 5. ~~`app_version` réelle dans `app.json`~~ → ✅ **fait le 30/07/2026** (`0.0.0` → `1.0.0`, aligné sur
>    le `runtimeVersion` déjà présent). ⚠️ Toutes les mesures analytics collectées jusqu'ici portent
>    `0.0.0` et sont indistinguables.
>
> 📄 **Brouillons prêts à relire** :
> [lance00-fiche-play-et-confidentialite.md](docs/specs/technical/lance00-fiche-play-et-confidentialite.md)
> — politique de confidentialité publiable, fiche Play (titre / descriptions), réponses au formulaire
> « Sécurité des données » établies d'après les 41 tables réelles, et ordre d'exécution.
> **Restent à compléter par un humain** : l'identité du responsable de traitement + l'e-mail de
> contact (RGPD, je ne peux pas les inventer), la version EN, et la relecture juridique.
> 🟠 **Trouvé au passage** : l'écran de démarrage est resté au **bleu du gabarit Expo** (`#208AEF`),
> ainsi que le fond de l'icône adaptative (`#E6F4FE`), alors que la palette est crème/terracotta.
> C'est la première chose vue à chaque lancement, et c'est l'icône de la fiche Play. Décision de
> charte → Damien/Florian (proposition : `#f7eede` pour les deux).
>
> ⚠️ Les points 1 → 3 s'enchaînent **en série** et sont tous à délai externe : environ **3 semaines**
> entre « je crée le compte » et « Health Connect fonctionne en production ». À démarrer bien avant
> d'avoir fini le code, sinon ils deviennent le chemin critique du lancement.

---

## 🟠 P1 — Finitions produit

> **Élargissement du 28/07/2026.** Le code est **en avance sur le cahier des charges** alors que les
> prérequis de publication (compte Play, déclaration santé, relecture juridique) sont à **délai externe
> d'environ 3 semaines**. Décision : occuper cette fenêtre plutôt que d'attendre Google → **14 idées
> promues depuis [IDEAS.md](IDEAS.md)** et regroupées dans la nouvelle version
> **[V0.9](docs/roadmap/roadmap.md#v09--enrichissements-avant-lancement)** (~54 h).
> **Filtre appliqué** : offline-first, aucune dépendance backend/IA, hors gamification (arbitrage C),
> hors social (V2), hors paiement (arbitrage D), et réutilisation d'une infra déjà livrée. Tout ce qui
> exige un moteur de règles (détecteur de collisions, mode « vie réelle »), de l'historique long
> (simulateur what-if, rétrospective annuelle) ou une base d'utilisateurs (board de suggestions,
> compétition) est resté hors périmètre.
>
> **Ordre conseillé.** Sortis du backlog : **PAS-01** clôturé le 28/07 (9.15 ✅) ; **BIEN-01**,
> **ADMIN-01**, **CONTENU-01**, **UX-LOT-01**, **MESUR-01**, **NUTR-F2**, **STREAK-01**, **OBJ-01** et
> **BILAN-01** livrées et **en recette** (voir [RECETTES.md](RECETTES.md)).
>
> **Il ne reste donc plus aucun candidat de la salve V0.9.** La suite : les **P2** ci-dessous, puis
> **CONF-07 en dernier** des chantiers de code, délibérément — un balayage d'accessibilité refait après
> chaque nouvel écran serait du travail perdu. ✅ **CONF-07 livrée le 01/08/2026**, en recette.

### Enrichissements V0.9 — rétention & valeur produit

> ✅ **Les deux candidats de rétention sont livrés le 29/07/2026** : **OBJ-01** (7.15 🟡) et
> **BILAN-01** (7.16 🟡), tous deux en recette — voir [RECETTES.md](RECETTES.md).
>
> La contradiction du doze mode annoncée ici a été résolue en **ne mettant aucun chiffre dans la
> notification** : tout est recalculé à l'ouverture, donc une notification livrée six heures en retard
> reste exacte. **Cette section est vide, et c'est normal** — elle disparaîtra à la clôture des deux US.

### Finitions UX remontées en recette

> ✅ **Lot livré le 29/07/2026** (UX-LOT-01, roadmap 3.53 / 3.54 / 7.18 → ✅). UX-02 était en fait
> **déjà livré** depuis `12bd3a1`, et le diagnostic d'UX-04 était faux sur 2 points — voir la
> [spec](docs/specs/functional/us/uxlot01-finitions-recette.md) §0.

### Musculation

| Candidat | # | Contenu | État |
|---|---|---|---|
| ~~**MUSC-F7**~~ | 3.8 | — | ✅ **Livré le 01/08/2026** (signal `previousStruggled` câblé), en recette → [RECETTES.md](RECETTES.md). La brique de calcul, l'UI de restitution et les 2 clés i18n existaient **déjà** (Refonte-C3) — il ne manquait que le signal, jamais fourni à l'appel. **Scindé du roadmap 3.7** (voir ligne ci-dessous) : la « progression au niveau programme » est un chantier de conception à part (aucune brique de données), pas un sous-lot de ce câblage. |
| ~~**MUSC-F15 — Progression au niveau du programme**~~ | 3.7 | — | ✅ **Livré le 02/08/2026** (second gate `weightHold` sur `computeProgressionSuggestion`, adhérence de la semaine précédente du programme ≥ 80 %), en recette → [RECETTES.md](RECETTES.md). Aucune cible évolutive stockée, aucune migration.
| ~~**MUSC-F8**~~ | 3.42, 2.7, 2.4 | — | ✅ **Livré le 30/07/2026** (push agrégé + célébration + rappel de séance), en recette → [RECETTES.md](RECETTES.md). Trois constats de cadrage : la roadmap **2.4 décrivait l'impossible** (`scheduled_date` est un jour sans heure → recadré en échéance apprise sur `finished_at`) · un record est **pluriel** (jusqu'à 15 en une séance → un seul push agrégé, id **par séance**) · le push **double l'écran de résumé**, assumé et 🟠 **à réévaluer en recette** (D11). **Solde D3** : le plafond quotidien s'applique aux notifications **immédiates** seulement. Course **hors périmètre** (le backfill partirait en rafale). |
| ~~**MUSC-F9**~~ | 3.10 | — | ✅ **Livré le 01/08/2026** (glisser-déposer d'une séance planifiée + haptique D3), en recette → [RECETTES.md](RECETTES.md). Aucune migration, aucune sync rule : `reschedulePlannedSession` existait déjà et est réutilisée telle quelle. Zones de dépôt mesurées **à chaque début de geste** (`measureInWindow`, coordonnées écran absolues) plutôt qu'au montage, pour rester justes même après un défilement. Les 3 boutons de report **restent** (chemin accessible sous TalkBack). ⚠️ `expo-haptics` est une dépendance native neuve : **non recettable sur l'APK existant**, un nouveau dev build est requis. |
| ~~**MUSC-F1b**~~ | 6.2 | — | ✅ **Livré le 02/08/2026** (Voie B, anatomie fine), en recette → [RECETTES.md](RECETTES.md). `muscles_fine` **additif** aux 6 groupes larges — aucun ricochet sur les 18 fichiers qui les consomment (alerte déséquilibre, filtre, remplacement, graphique de volume). `<BodyMap/>` (11 tracés, face + dos) monté sur la fiche exercice, l'aperçu de séance (union) et le bilan hebdo (tonnage agrégé par muscle fin). Repli automatique sur les groupes larges tant qu'un exercice n'est pas tagué fin par un coach (hors dev, ~1-2h pour les 16 exercices — ne bloque pas la recette du reste). ⚠️ Critère de recette 12 (relecture anatomique des 11 tracés par quelqu'un qui connaît l'anatomie) reste à faire sur device. |

### Running

| Candidat | # | Contenu | État |
|---|---|---|---|
| ~~**RUN-F2 — Séances guidées vocales**~~ | 5.18, 5.19, 5.9, 5.23 | — | 🟡 **Scindée en 4 candidats le 02/08/2026** (cartographie du 02/08 : `run/active.tsx` ne lit aujourd'hui aucune cible ni structure de séance pendant la course — « déconnectées du tracker actif » confirmé — et aucune notion de « bloc » n'existe nulle part, ni DB ni UI, pour le fractionné). Trop hétérogène en taille et en dépendances pour un seul incrément. Ordre logique : 5.19 (autonome) → 5.23 (autonome) → 5.9 (le plus gros, structure de données neuve) → 5.18 (dépend des deux précédents). Voir sous-lignes ci-dessous. |
| ~~**RUN-F2a — Annonces audio périodiques**~~ | 5.19 | — | ✅ **Livré le 02/08/2026**, en recette → [RECETTES.md](RECETTES.md). `expo-speech` neuf → **nouveau dev build EAS requis** pour la recette (comme `expo-haptics`/MUSC-F9). Réglage opt-in (désactivé par défaut) sur `running_profiles`. ⚠️ Déclenché depuis `run/active.tsx` : aucune annonce si l'écran n'est pas monté (changement d'onglet ou verrouillage), à observer en recette réelle. |
| ~~**RUN-F2b — Prolonger ou raccourcir**~~ | 5.23 | — | ✅ **Livré le 02/08/2026**, en recette → [RECETTES.md](RECETTES.md). Réutilise `compareToTarget`/`useRunTarget`/`running.target.*` de RUN-F3 tels quels — aucune fonction ni clé neuve, `ActiveRun` étendu (`plannedSessionId`) + carte objectif dans `run/active.tsx`. |
| ~~**RUN-F2c — Blocs fractionné/intervalles**~~ | 5.9 | — | ✅ **Livré le 03/08/2026**, en recette → [RECETTES.md](RECETTES.md). Modèle : une ligne = un bloc de répétitions (comme `exercise_plans.target_sets`), nouvelle table `session_intervals`, éditeurs mobile + admin (`SortableList`), affichage lecture seule sur 2 écrans. ⚠️ **2 sync rules à déployer manuellement sur le dashboard PowerSync** (table neuve, non fait par cette session — bloquant avant recette). |
| ~~**RUN-F2d — Guidage fractionné vocal**~~ | 5.18 | — | ✅ **Livré le 03/08/2026**, en recette → [RECETTES.md](RECETTES.md). Dernier candidat de la famille RUN-F2. Annonce + vibration à **chaque changement de phase** (rapide↔récup), pas seulement de ligne de bloc. Persistance de la progression sur `runs` (3 colonnes additives, aucune sync rule) pour un rattrapage silencieux au remontage de l'écran — sans ça, reprendre l'écran en cours de récup aurait pu annoncer « rapide » par erreur. |
| ~~**RUN-F3**~~ | 5.25 | — | ✅ **Livré le 01/08/2026** (comparaison à l'objectif + terrain D3), en recette → [RECETTES.md](RECETTES.md). Découverte en cours de code : **aucun mécanisme ne reliait une course à sa séance planifiée** (ni colonne, ni paramètre de démarrage — contrairement à la musculation, déjà câblée). Construit de bout en bout : `runs.planned_session_id` (migration), `startRun(source, plannedSessionId)`, et un point d'entrée neuf sur le hub course (« Course planifiée aujourd'hui », symétrique de la carte muscu, **sans toucher** au hook `useTodaySession` existant — dédié à `strength`). |
| **RUN-F3b — Météo de course** *(scindé de RUN-F3)* | 5.24 | Conditions météo au moment de la course, et avant une sortie planifiée. | 🔴 **À trancher AVANT de soumettre la fiche Play.** Une requête météo transmet des **coordonnées à un service externe** — ce qui contredit la politique de confidentialité et le formulaire « Sécurité des données » rédigés pour [LANCE-00](docs/specs/technical/lance00-fiche-play-et-confidentialite.md), qui affirment aujourd'hui qu'aucune donnée n'est partagée. Trois questions ouvertes (spec RUN-F3 §4 D2) : fournisseur (Open-Meteo = le seul sans clé à stocker), moment de l'appel, et **assumer qu'une course hors réseau n'aura jamais de météo** — on ne récupère pas une météo passée gratuitement. Le **terrain**, lui, ne demande aucun réseau (simple saisie) et est proposé avec 5.25. |
| ~~**RUN-F1b — Dénivelé cumulé**~~ | 5.32 | — | ✅ **Livré le 02/08/2026** (blocage codec levé — deux scalaires cumulés en direct par le tracker, `gps_track` inchangé), en recette → [RECETTES.md](RECETTES.md). ⚠️ Seuils GPS (précision 30 m, bruit 3 m) non validés terrain, à ajuster en recette réelle.

### Contenu

| Candidat | # | Contenu | État |
|---|---|---|---|
| **CONTENU-01 — Seed des bibliothèques de programmes** | 3.1, 5.2 | Catalogues muscu + course, aujourd'hui **vides**. 🌐 FR+EN. | 🟡 **Méthode tranchée le 28/07/2026 (Florian) : migration SQL idempotente** (patron CIQUAL), le constructeur admin 8.4 restant le pipeline d'entretien → [spec §2](docs/specs/functional/us/contenu-01-seed-bibliotheques-programmes.md). **Reste à trancher : le contenu** — nombre de programmes par pilier au lancement, et qui fournit séances/exos/reps. C'est du travail de coach, pas de dev. |

---

## 🟢 P2 — Confort & optionnel

| Candidat | # | Contenu | État |
|---|---|---|---|
| ~~**NUTR-F1**~~ | 1.14, 2.5 | — | 🟡 **Entré dans le pipeline le 30/07/2026** → [spec](docs/specs/functional/us/nutrf1-rappels-nutrition.md) · [plan](docs/plans/nutrf1-rappels-nutrition.md) · [maquette](design/nutrf1-rappels-nutrition/nutrf1-rappels-nutrition.html). **Aucune migration, aucun nouveau build.** 7 décisions posées, dont : on apprend le **p90** de l'heure du geste (une **échéance**) et non la médiane — sinon le rappel part pendant que l'utilisateur fait le geste ; rappels **opt-in** ; heure **apprise** rabattue hors DND / heure **manuelle** respectée donc non envoyée, avec avertissement ; **pas de compteur de quota** — on corrige à la place le hint « max 3/jour », faux depuis V0.6. |
| ~~**PARTAGE-01**~~ | 7.17 | — | ✅ **Livré le 29/07/2026** (course **et** muscu), en recette → [RECETTES.md](RECETTES.md). ⚠️ exige un **second build** : `react-native-view-shot` est une dépendance native. |
| ~~**MUSC-F14**~~ | 3.52 | — | ✅ **Livré le 29/07/2026** (séance), en recette → [RECETTES.md](RECETTES.md). Motif « zone douloureuse » **retiré** : pas de donnée articulaire en base, y répondre serait un conseil de santé inventé. 🟠 **Décision attendue** : l'éditeur de programme n'a pas de parcours « remplacer ». |
| ~~**UX-05**~~ | 3.55 | — | ✅ **Livré le 29/07/2026**, en recette → [RECETTES.md](RECETTES.md). Portée réduite après inventaire au **RPE par série** : le RIR n'a aucun sens sur le ressenti de séance (échelle 1-5) ni sur une course. **1 migration, 0 sync rule.** |
| **SOCLE-01 — RevenueCat câblé inactif** | 9.14 | Entitlements posés, aucun paywall (app gratuite en V1). | ⏳ **Différée le 30/07/2026 (Florian), après cadrage.** Quatre constats : (1) [prd.md:122](docs/product/prd.md) dit les paliers Premium → Écosystème → IA « conservés **pour mémoire uniquement, non engageants** » — les définir serait les inventer ; (2) **« Premium muscu » n'a aucun contenu défini** nulle part et « Écosystème » n'est nommé que dans l'ADR-003 — seul le palier **IA** a une décision datée (15/07/2026 : 1-2 bilans croisés gratuits bridés vs exhaustif + chatbot à quota) ; (3) **aucune fonctionnalité IA n'est livrée** ([ia-integration-analyse.md](docs/product/ia-integration-analyse.md) n'est pas encore une US) → la couture n'aurait **aucun consommateur réel**, donc serait une promesse non vérifiée ; (4) LANCE-00 non fait → sans compte Play, aucun produit configurable, donc **un SDK RevenueCat n'aurait rien à récupérer** (et sa clé publique `goog_` n'est pas un secret : c'est l'inutilité qui l'écarte, pas le garde-fou). **À reprendre avec la première US IA**, qui fournira le premier point d'accès réellement gatable. |

---

## 🔵 Après V0.9 — 2ᵉ salve d'enrichissements *(arbitrage Florian, 28/07/2026)*

> **Séquencement explicite : ces candidats passent APRÈS les 13 items restants de V0.9.** Le code
> reste en avance sur le cahier des charges, mais V0.9 (~57 h) occupe déjà toute la fenêtre des
> délais externes de Google : cette salve est un **choix de capacité**, pas un manque de périmètre.
> Aucune ligne de roadmap n'est créée tant qu'un candidat n'entre pas dans le pipeline via
> [`/us`](.claude/commands/us.md).
>
> **Filtre appliqué** (identique à V0.9) : offline-first, aucune dépendance backend/IA, hors
> gamification (arbitrage C), hors social (V2), hors paiement (arbitrage D).

| Candidat | Source | Contenu | Point dur |
|---|---|---|---|
| ~~**RUN-14 — Prédiction de temps de course (Riegel)**~~ | roadmap 5.34 | — | ✅ **Livré le 02/08/2026**, en recette → [RECETTES.md](RECETTES.md). |
| ~~**NUTR-16 — Répartition calorique par repas**~~ | roadmap 4.38 | — | ✅ **Livré le 02/08/2026**, en recette → [RECETTES.md](RECETTES.md). |
| ~~**MUSC-09 — PR par plage de reps**~~ | roadmap 3.56 | — | ✅ **Livré le 02/08/2026**, en recette → [RECETTES.md](RECETTES.md). |
| ~~**Widget écran d'accueil Android**~~ | [IDEAS.md](IDEAS.md) 13/07 | — | ✅ **Livré le 03/08/2026** (LAUNCHER-01, roadmap 7.19), en recette → [RECETTES.md](RECETTES.md). Coût réel révisé à la baisse : `react-native-android-widget` (JSX → RemoteViews, config plugin Expo) a évité d'écrire du Kotlin à la main ; spike de compatibilité SDK 57/New Architecture confirmé sur device. |
| ~~**ACTIV-01 — Parcours « 7 jours pour démarrer »**~~ | roadmap 1.27 | — | ✅ **Livré le 03/08/2026**, en recette → [RECETTES.md](RECETTES.md). Widget d'accueil auto-masquant, une suggestion par jour pendant 7 jours après l'onboarding, piliers actifs lus en direct. ⚠️ **Contenu des 7 jours = brouillon** (spec R6), à valider par Florian/Damien. |

> **Écarté de cette salve à la réconciliation du 28/07/2026** : **RUN-10 — splits par km** était le
> candidat n°1 proposé… et il est **livré depuis le 25/07** (`computeKmSplits` + tableau sur le résumé
> de course, roadmap 5.26 ✅). Le catalogue le donnait ⏳. C'est la raison d'être de `/reconcilier`.

---

## 🧹 Dette & suivi technique

Petits sujets hors US, à traiter à l'occasion. Ne bloquent rien.

- [x] ~~🟢 **`training-load`/`overtraining-guard` laissent un trou dans la grille du dashboard
      quand ils rendent `null`.**~~ — **corrigé le 03/08/2026** (`fix/dashboard-widgets-tier2-vides`).
      `isWidgetActive` (`apps/mobile/src/app/(tabs)/index.tsx`) ne connaissait que `deficit-volume`
      et `activation-path` ; ajout des deux mêmes conditions pour `training-load` et
      `overtraining-guard`, réutilisant `useTrainingLoadAlert().show` /
      `useOvertrainingGuardAlert().show` déjà calculés pour l'affichage des cartes elles-mêmes.
      ⚠️ **Trouvé au passage** : `babel-plugin-dynamic-import-node` (ajouté à `package.json` par
      ACTIV-01) n'était jamais **installé** dans `node_modules` — les 65 suites mobile échouaient
      toutes à l'import du harness (`Cannot find module`). Résolu par un `npm install` (le
      lockfile était déjà correct, seul `node_modules` était désynchronisé) ; aucune modification
      de fichier suivi.

- [x] ~~🟠 **`packages/shared` n'atteint pas les 100 % de couverture exigés.**~~ — **traité et
      arbitré le 04/08/2026** (`chore/socle-tests-lot5-ecrans`). **Instructions, fonctions et lignes
      à 100 %** (99,35 % → 100 %), verrouillées dans le cliquet ; 1 503 → 1 615 tests. **Branches à
      97,35 %, seuil arbitré à 97** — c'est la décision que cette entrée demandait de prendre : les
      ~2,5 % restants ont été audités un par un et sont du **code défensif inatteignable**, de deux
      familles (cas d'égalité de comparateurs sur des clés de `Map`, uniques par construction ;
      replis `?? 0` sur des `Map.get` dont la clé vient d'être écrite). Les couvrir exigerait des
      tests figeant des comportements absurdes, ou de retirer ces filets — une métrique échangée
      contre une protection réelle. Justification complète dans
      [strategie-tests.md §5 bis](docs/specs/technical/strategie-tests.md).
      **Trois vrais trous fonctionnels trouvés au passage** : les suggestions de **glucides**
      n'étaient exercées nulle part (seuls protéines et lipides l'étaient), ni les fractionnés
      définis **en durée** (« 30/30 » — tous les tests portaient sur la distance), ni le throttle
      d'import du cycle. **Et deux défauts de code corrigés** : `bestSegmentTimeFromSamples`
      renvoyait `NaN` pour une distance cible ≤ 0, soit un record de « NaN seconde » écrivable en
      base ; et le `return null` final de `bucketOf` (`training-nutrition.ts`) était prouvé
      inatteignable.

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

- [x] ~~🟠 **BILAN-01 affiche une clé de groupe musculaire brute.**~~ — **corrigé le 05/08/2026**
      (même branche qu'INSIGHTS-01, sur demande de Florian). La décision hebdo `muscle_imbalance`
      porte `subject = balance.neglected[0]`, soit une **clé métier** (`back`) : les écrans
      affichaient « Tu délaisses un groupe musculaire : **back** » au lieu de « Dos ». Défaut
      **préexistant**, resté invisible dans BILAN-01 jusqu'à ce qu'INSIGHTS-01 l'expose sur une
      3ᵉ surface. Corrigé par une fonction unique,
      [decision-subject.ts](apps/mobile/src/lib/decision-subject.ts), désormais partagée par les
      **trois** surfaces (`review.tsx`, `ReviewCard.tsx`, la carte `weekly_decision` de l'écran
      Insights) — c'est le savoir dupliqué qui avait laissé le défaut vivre. 4 tests.

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
      commit qui en touche déjà 31 aurait été plus risqué qu'utile, et ce n'est pas le sujet de
      l'US. Du code mort est visible et inoffensif ; une suppression prématurée ne l'est pas.
      À faire en `chore/` dédié — vérifier au passage qu'aucun n'est destiné à un hub (candidats
      plausibles : `MuscleVolumeCard` et `RunningWeekCard`).

- [ ] 🟠 **Décision RGPD — `analytics_events` doit-elle entrer dans l'export de données ?**
      Soulevé le 03/08/2026 par le test de complétude de l'export (US CONF-01). La table est
      aujourd'hui **exclue** — exclusion héritée, jamais arbitrée explicitement. Elle porte un
      `user_id` et vit sur nos serveurs, donc son inclusion dans le droit à la portabilité est
      défendable ; à l'inverse c'est de la télémétrie opt-in sans donnée identifiante (allowlist
      stricte `ALLOWED_PROP_KEYS`). Décision produit/juridique → Damien/Florian. Le choix est
      matérialisé dans `EXPORT_EXCLUSIONS` (`apps/mobile/src/lib/data-export.ts`) : basculer
      revient à déplacer une ligne. **Trouvé au passage : `session_intervals` manquait vraiment**
      (blocs fractionné absents de l'export d'un programme personnel) — corrigé le jour même.

- [x] ~~**PAS-01 — l'en-tête de l'écran « Pas » est cassé**~~ — constaté puis **corrigé le
      30/07/2026** (`fix/pas01-entete-ecran-pas`). La route `steps` était **absente** de
      [_layout.tsx](apps/mobile/src/app/_layout.tsx) : sans `Stack.Screen`, aucun en-tête de
      navigation, donc le titre de page se dessinait sous la barre d'état. Vérifié sur device.
      **Leçon** : un écran ajouté sans sa déclaration de route n'échoue ni au typecheck ni aux tests
      — seul un œil sur l'écran le voit.
### Constats de la passe device automatisée du 30/07/2026

Passe adb sur 41 écrans (37 routes + 4 onglets), en 3 campagnes : nominal, police 1,5×, mode avion.
Méthode et résultats détaillés : [docs/plan-de-test.md](docs/plan-de-test.md).

- [x] ~~🟠 **`run/active` sans course active : écran vide avec un bouton « Retour » seul**~~ —
      **déjà corrigé** (`936ec81`, constaté en relisant le code le 02/08/2026) : un message
      (`running.active.ended`) précède désormais le bouton « Retour ». Entrée restée stale ici.
- [x] ~~🟢 **`planning/plan` sans programme valide est un cul-de-sac**~~ — **déjà corrigé**
      (`936ec81`, même constat). Entrée restée stale ici.
- [x] ~~🟢 **Champs de saisie sans libellé d'accessibilité.**~~ — **corrigé le 02/08/2026**
      (`fix/dette-technique-ecrans-a11y-seed`) : les chips catégorie de
      [food-custom](apps/mobile/src/app/food-custom.tsx) (`accessibilityRole`/`Label`/`State`),
      [Segment.tsx](apps/mobile/src/components/Segment.tsx) (`accessibilityLabel` — corrige
      profile **et** tous ses autres usages : thème, unités, objectif…), le bouton « Ajouter un
      ingrédient » de recipe-edit, et **`Button.tsx`** dont l'`accessibilityLabel` ne retombait pas
      sur `label` par défaut — corrige account-delete et, par construction, tout bouton de l'app
      sans override explicite (surtout utile pendant `loading`, quand le texte visible disparaît
      derrière le spinner).
- [x] ~~🟠 **Décision produit — le widget planning du hub Muscu annonce une séance de course.**~~ —
      **tranché le 02/08/2026 (Florian)** : comportement **voulu**, gardé tel quel — cohérent avec
      le planning unifié (US 3.9), les deux widgets pointent vers le même `/planning`. Seule
      l'ambiguïté était à corriger : [PlanningPreview.tsx](apps/mobile/src/components/PlanningPreview.tsx)
      préfixe désormais chaque libellé de séance par son pilier (« Musculation · … » / « Course · … »),
      même convention que le chip de pilier déjà affiché sur `/planning` lui-même.

- [x] ~~**`supabase/seed.sql` est inatteignable**~~ — **corrigé le 02/08/2026**. Les 16 exercices +
      le programme placeholder « Full Body Débutant » (US1/US2 du seed) basculés en migration
      idempotente (`20260802055147_debt_seed_exercices_programme_placeholder.sql`, patron CIQUAL),
      `seed.sql` réduit à un pointeur. ⚠️ 1ʳᵉ tentative en échec : les traductions déjà en base
      portaient des `id` différents des UUID déterministes du seed mais le même
      `(exercise_id, lang)` — conflit sur la mauvaise colonne cible, corrigé en
      `on conflict (exercise_id, lang)`. Transaction annulée proprement par le CLI, aucune ligne
      partielle.
- [ ] **`main` n'a pas bougé depuis le 04/07/2026** (972 commits de retard sur `dev` au 30/07/2026). Aucun tag,
      aucun point de repère de version. → À traiter au moment de LANCE-01.
- [x] ~~**2 tests mobile en échec par timeout** (`edit-exercise-modal-smoke`, `exercise-detail-smoke`)~~
      → **Non reproduit le 30/07/2026, constat clos.** Suite complète relancée : **44 suites / 231
      tests mobile verts en 20 s**, plus 1218 tests `shared` en 5,8 s. Les deux suites incriminées
      tournent en **6,4 s et 7,2 s** isolément — largement sous le `testTimeout` de 15 s. Le
      diagnostic « ~250 s par suite » était un artefact de poste chargé, **pas** un défaut de code
      ni de configuration. Aucun `testTimeout` à relever.
- [x] ~~**Suivi analytics (US 9.10)**~~ — **corrigé le 02/08/2026** (`fix/dette-analytics-tests-cycle`).
      **Dépendance circulaire détricotée** : `settings-repository.ts` n'importe plus `@/lib/analytics`
      — `togglePillar` retourne désormais `{ activated }`, et c'est **l'appelant**
      (`(onboarding)/pillars.tsx`, `settings.tsx`) qui décide de tracker `pillarActivated`. Un seul
      sens d'import reste (`analytics.ts → settings-repository.ts`, pour `getAnalyticsEnabled`).
      **Tests de gating de `track()` ajoutés** (4 cas : session+ON → écrit, OFF → no-op, pas de
      session → no-op **sans même consulter le consentement**, échec d'écriture → ne jette jamais).
      **Doublon `onboarding_started`** : confirmé être un artefact React StrictMode (dev uniquement,
      effet à double-invocation) — corrigé par un garde `useRef` sur `(onboarding)/intro.tsx`, qui
      rend la question sans objet plutôt que d'attendre une confirmation device. `app_version` était
      déjà réelle depuis le 30/07/2026 (`app.json` → `1.0.0`), rien à faire de ce côté.
- [ ] **Recette 2 appareils du `signOut` local** (`fix/signout-scope-local`) — déconnecter A ne doit
      pas déconnecter B. Non vérifiable sur un seul device.
- [ ] **Découpage des stats course par type de séance** — différé : les courses libres n'ont pas de
      `session_type`.
- [ ] **Collision de numéro roadmap sur 4.37** — trouvée le 02/08/2026 en cherchant un numéro libre
      pour NUTR-16. Deux fonctionnalités distinctes portent `4.37` : NUTR-F2 (table V0.9) et
      « Refonte visuelle du journal alimentaire » (table Hors périmètre de cadrage). Même défaut que
      la collision déjà connue sur 4.5/4.36 (voir roadmap.md, ligne 4.36) — pas corrigée ici, hors
      scope de NUTR-16. À trancher via [`/reconcilier`](.claude/commands/reconcilier.md) : renuméroter
      l'une des deux et propager (front-matter de sa spec, toute référence croisée).

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
Dernière révision : 28/07/2026 (réconciliation — 2ᵉ salve séquencée après V0.9 ; élargissement V0.9 :
14 idées promues depuis [IDEAS.md](IDEAS.md) ; PAS-01 clôturé).*
