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
| **LANCE-02 — Retirer le spike VBT-01 du build de soumission** | 9.2 | Supprimer `apps/mobile/src/app/spike-vbt.tsx`, sa ligne dans le `Stack` racine, son entrée en bas des Réglages, et les dépendances `react-native-vision-camera` / `react-native-nitro-modules` / `react-native-nitro-image` / `react-native-vision-camera-worklets`. Les modules purs `bar-velocity.ts` / `bar-tracker.ts` **restent** : ils ne coûtent rien et servent au cadrage. | 🔴 **Entré dans `dev` le 19/09/2026** par fusion de `spike/vbt01-camera`, à la demande de Florian, pour tenir l'essai en salle dans un seul APK. Écrit ici **parce que ça ne doit pas tenir à la mémoire de quelqu'un** : un écran d'essai caméra dans le build public se remarquerait à la review. ⚠️ À faire **juste avant** le build `production`, pas avant — sinon l'essai device n'est plus possible. |

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
| **CLAV-01 — Le clavier recouvre les formulaires (edge-to-edge)** | — | Reprendre le décalage clavier sur `FormScreen` et les modales d'exercice, qui passent toutes `behavior={undefined}` à `KeyboardAvoidingView` sur Android — c'est-à-dire **rien**. Le hook `useKeyboardHeight` livré pour l'écran de séance (recette MUSCU-UX01 §57.19, 11/09/2026) est réutilisable tel quel. | 🟠 **Ce n'est pas un oubli ponctuel mais un changement de plateforme** : depuis Expo SDK 54 l'edge-to-edge est **forcé** sur Android, `android:windowSoftInputMode="adjustResize"` est toujours au manifeste mais ne redimensionne plus la fenêtre. Tout écran qui comptait dessus est concerné. Moins bloquant qu'en séance (ces écrans défilent, on peut faire remonter le champ à la main), d'où P1 et non P0. **À recetter écran par écran** : le nombre de formulaires touchés n'a pas été inventorié. |
| **CARDIO-02 — Les quatre portes vers l'allure de référence** *(audit Course F2, F3, F39)* | 5.40 | Les quatre chemins pour donner son allure de référence (chrono de course, test Cooper, allure connue, « je ne sais pas ») + accueil du pilier en 3 questions. | 🟢 **Les briques de calcul sont livrées et testées** (`referencePaceFromRaceTime` — Riegel inversé — et `referencePaceFromCooperTest`, 8 tests dans `packages/shared/src/running-hub.ts`). Il ne reste que les **écrans**. Sans allure de référence, **toutes** les allures cibles du pilier sont absentes : c'est la porte d'entrée de tout le reste, donc le premier des six à reprendre. |
| **CARDIO-03 — Écran de départ + saisie rétroactive** *(audit Course F4 → F8, F26)* | 5.40 | Attendre le fix GPS avant de lancer, mémoriser le dernier mode, compte à rebours, rappel du contexte de séance, et **saisir une course déjà faite**. | 🟢 `createPastRun` est livrée et typée côté repository — **l'écran manque**. ⚠️ La saisie rétroactive n'est pas du confort : sans elle, une course oubliée ou faite sans le téléphone est **définitivement absente** de l'ACWR, de la polarisation et des records, qui pilotent ensuite les allures cibles. |
| **CARDIO-04 — Historique en trois onglets** *(audit Course F22, F23, F24)* | 5.40 | Historique filtrable (type de séance, terrain, RPE) et **liste virtualisée**. | 🟢 La requête est déjà enrichie (`SELECT_HISTORY` remonte terrain, type de séance et séance planifiée via deux `LEFT JOIN`) — **l'écran ne s'en sert pas encore**. 🟠 La virtualisation devient nécessaire au-delà de quelques centaines de courses : à recetter sur un compte chargé, pas sur un compte neuf. |
| **CARDIO-05 — Éditeur de séance à trois niveaux** *(audit Course F27 → F34)* | 5.40 | Réécrire les éditeurs : saisie **en une ligne** (`2km ech + 6x400/200 + 1km rac`), modèles, « Répéter la sélection », et repli du mode détaillé pour ceux qui le veulent. | 🟢 **La grammaire complète est livrée et testée** (`parseSessionLine` + les 6 `SESSION_TEMPLATES`, 20 tests, chaque modèle vérifié re-lisible). 🟠 C'est le plus gros des six : l'éditeur actuel demande **14 contrôles par segment**, et c'est lui qui rend le conseil « retire 25 % des répétitions » inapplicable à la main. |
| **CARDIO-06 — Les semaines qui progressent** *(audit Course F35)* | 5.40 | Étendre `planProgram` pour générer des semaines qui évoluent, et la vue par semaine de l'éditeur. | 🟢 **La colonne est livrée ET poussée** (`sessions.week_index`, 10/09/2026). ⚠️ **Pas de `default` sur la colonne, délibérément** : `null` signifie « séance de la semaine type, répétée chaque semaine » = le comportement actuel. Aucun programme existant n'est donc à retravailler — mais l'extension doit préserver cette lecture. |
| **CARDIO-07 — Import GPX et Health Connect** *(audit Course F25)* | 5.40 | Importer des courses depuis un fichier GPX ou depuis Health Connect. | 🔴 **Rien de livré, et à ne pas démarrer avant que LANCE-00 soit déposé.** La **lecture** Health Connect ajoute deux permissions et **change donc la déclaration « Health apps »** de la fiche Play — chemin critique du lancement (9.2), au même titre que **RUN-F3b** ci-dessus. L'import GPX seul, lui, ne touche à aucune déclaration : c'est la moitié livrable tout de suite si on veut découper. |
| **IDENT-01 — L'identité de pilier appartient à l'écran, pas à l'onglet** *(constat CARDIO-UX02)* | 3.63 / 4.x | Déclarer le pilier sur les écrans empilés des piliers **Musculation** et **Nutrition**, comme CARDIO-UX02 l'a fait pour la Course. | 🟢 **Le correctif tient en une ligne par écran** (`useMenuFocus('strength')`) et le **test de garde est déjà écrit** — `apps/mobile/src/app/__tests__/pillar-identity.test.ts` n'attend que l'ajout des dossiers à sa table `PILIERS`. ⚠️ **Le défaut est réel et invisible en revue** : `useMenuFocus` n'est appelé que par les cinq écrans d'onglet, donc `/workout`, `/exercises`, `/templates`, `/nutrition-stats`, `/food-picker`… héritent de la **couleur du dernier onglet visité**. Ouvrir une séance depuis l'Accueil rend tout le pilier Muscu en terracotta. Non corrigé avec CARDIO-UX02 parce que ça touche une **trentaine d'écrans sans recette** — à faire en un lot, avec une passe device par pilier. |
> **Les six lignes CARDIO ci-dessus sont les chantiers non livrés de l'audit du pilier Course**
> (CARDIO-UX01, 10/09/2026). Elles ne sont **pas** des idées neuves : chacune a ses constats
> numérotés dans [l'audit](docs/product/audit-ergonomie-pilier-course.md) (22 pages, 40 constats) et
> sa section dans la [spec](docs/specs/functional/us/cardio-ux01-refonte-pilier-course.md).
> Elles sont recopiées ici le **13/09/2026** parce qu'elles ne vivaient que dans
> [RECETTES.md](RECETTES.md) §59 — **un fichier dont la règle est de se vider dès que l'US est
> clôturée**. Elles y seraient mortes avec la recette.
>
> **À part ces neuf-là, aucun autre candidat P1.** Les 14 idées promues dans
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
| **VBT-01 — Vitesse de barre à la caméra** *(retenue le 13/09/2026, salve « carnet d'innovation »)* | — | Mesurer la vitesse de chaque répétition avec le téléphone **posé de profil** : vitesse moyenne de montée par rep, **perte de vitesse dans la série** → signal d'arrêt et RIR estimé. Squat, développé couché, soulevé de terre. **Analyse en direct sur l'appareil : aucune vidéo enregistrée ni envoyée**, seules les vitesses sont synchronisées (pas de stockage de fichiers, pas d'API d'IA). Questions pratiques, positionnement, pastille ou non : [analyse-innovation-2026-09.md §6](docs/product/analyse-innovation-2026-09.md). Maquette : [VitesseBarre.dc.html](design/innovation-2026-09/VitesseBarre.dc.html). | 🔵 **Spike démarré le 19/09/2026** → [rapport](docs/specs/technical/spike-vbt01-vitesse-barre.md). **Moitié « calcul » livrée et prouvée** (`packages/shared/src/bar-velocity.ts`, 32 tests) : 100 % des reps détectées sur trace simulée, écart ≤ 0,05 m/s **si le suivi tient ±3 px** — et surtout, la **perte de vitesse** (ce qui déclenche l'arrêt) reste juste à 1-5 points dans toutes les conditions, alors que la vitesse absolue affichée porte 0,02 à 0,08 m/s d'erreur. Le facteur limitant n'est pas la cadence mais la **précision du suivi**. Reste la moitié « caméra », sur branche dédiée : `expo-camera` en est incapable (vérifié : aucun accès aux images), il faut `react-native-vision-camera` 5.2.3 + nitro, donc un ajout natif qui **ne doit pas entrer dans le build de soumission Play**. 🟠 **Faisabilité toujours à trancher** : essai device, critères de sortie fixés d'avance — **≥ 95 % des reps détectées, écart ≤ 0,05 m/s** avec une référence, **≥ 30 i/s** sur un Android milieu de gamme, pas de chauffe sur 5 séries. Si un critère échoue, on ne cadre pas d'US. 🟠 `expo-camera` ne suffit pas : nouvelle brique caméra + module natif sous Expo, la friction connue (le dépôt en a déjà écrit : Health Connect, widget). 🟢 Se branche sur l'existant : RPE/RIR (UX-05), module force (MUSCPWR-01). ⏳ **Post-lancement** : ne démarre pas avant LANCE-01. |

---

## 🧹 Dette & suivi technique

Petits sujets hors US, à traiter à l'occasion. Ne bloquent rien.

> 🆕 **Ouvert le 12/09/2026 — code devenu orphelin par MUSCU-UX02.** Le bilan de séance passant par `useWorkoutReport`, trois hooks de `records-repository.ts` n'ont plus **aucun appelant de production** : `useWorkoutRecords` (l. 538), `useWorkoutDetail` (l. 1026) et `useExerciseDeltas` (l. 1445) — seuls `records-sql.test.ts` les touche encore. Même chose pour les clés i18n `workout.summary.records.*`, `workout.summary.density`, `workout.summary.minuteSymbol` et tout le bloc `history.detail.set*/record*/meta*`, à zéro usage dans les deux locales.
> ⚠️ **Volontairement pas supprimés dans le lot MUSCU-UX02** : la suppression touche un fichier de 1 500 lignes et ses tests, juste avant une recette de 24 critères — un dégât collatéral y coûterait plus cher que le ménage n'y rapporte. À faire **après** la clôture de l'US, d'un seul geste et avec la suite de tests en filet.
> 🔴 `SummaryExerciseList.tsx`, lui, **a bien été supprimé** dans le lot : il n'était plus référencé nulle part et ne portait aucun test.

> ✅ **Fermé le 06/08/2026 — les 15 US en recette sans critères cochables.** Ouvert le matin par
> [`/reconcilier`](.claude/commands/reconcilier.md), comblé l'après-midi : **RECETTES.md §35 à §49**
> couvrent GARDE-01, META-19, MN-04, MR-08, MUSC-12, MUSC-19, MUSC-20, MUSC-F15, NUTR-18, RN-03,
> RUN-18, RUN-F1b, RUN-F2a, RUN-F2b et TRI-03. **49 US en recette, 49 sections.** Les 4 lignes de ce
> backlog qui pointaient dans le vide résolvent à nouveau.
> 🔴 **Trouvé en écrivant** : les critères de **5** de ces specs étaient **périmés** — INSIGHTS-02 a
> sorti META-19, GARDE-01, TRI-03, MR-08 et RN-03 de l'accueil pour en faire des cartes de l'écran
> Insights, et le moteur n'en affiche que **2 par famille**. Les recetter tels quels aurait produit
> **5 faux défauts**. C'est le vrai gain de l'exercice, pas les cases à cocher.

- [ ] 🟠 **`health-connect-state.test.ts` — mode de défaillance identifié, déclencheur toujours
      inconnu.** Constaté le 07/08/2026 en intégrant ALLURE-01 : **16 des 31 tests** en échec sur un
      `npm run test` agrégé, mocks du module natif à `Number of calls: 0`, **non reproductible**
      (31/31 en isolation, suite complète verte trois fois de suite sans qu'une ligne ne change).
      ✅ **Investigué le 08/08/2026 (`fix/health-connect-test-isolation`) — le mode de défaillance est
      reproduit et mesuré** : faire résoudre à `import('react-native-health-connect')` autre chose que
      le mock du fichier donne **17 échecs sur 31**, du même genre. Les autres pistes sont écartées
      par mesure, chacune ayant une signature distincte : `Platform.OS` non-Android → **20** échecs,
      opt-in perdu → **6**, `getSdkStatus` sans implémentation → **8**.
      **Cause structurelle** : `health-connect.ts` charge le natif par `import()` **dynamique**
      (`nativeModule()`), donc la résolution a lieu à l'**appel** et dépend de l'état du registre de
      modules à cet instant — que le fichier de test ne maîtrise pas seul.
      🔴 **Ce qui reste ouvert** : le **déclencheur**. Aucun `jest.resetModules()` n'existe dans le
      dépôt, donc le vecteur de fuite n'est pas identifié — et sans reproduction, aucun correctif ne
      serait vérifiable. Une **garde d'isolation** a donc été posée en tête du fichier : à la
      prochaine occurrence, **un** test échoue avec la cause nommée au lieu de seize sans
      explication. C'était le vrai coût — pas l'échec, son opacité.
      Piste de reproduction inchangée : suite mobile sous charge (typecheck + lint + test + coverage
      enchaînés dans le même shell).

- [ ] 🟠 **`food-custom.tsx` : un échec de chargement laisse le formulaire d'édition VIDE.**
      Relevé le 12/08/2026 en corrigeant les rejets non capturés. `getFood` échoue → aucun champ
      n'est rempli, et **enregistrer écrase alors l'aliment par du vide**. Le `.catch` posé évite le
      rejet non capturé mais **ne corrige pas ce comportement** : un repli propre demande un état
      d'erreur à l'écran (« impossible de charger cet aliment ») et le blocage de l'enregistrement,
      donc un petit cadrage. Même famille que le `loadError` d'`ExerciseEditScreen` côté back-office,
      qui a exactement le même trou (noté dans son test).

- [ ] 🟢 **~287 `void appel()` nus, non couverts par le garde-fou.**
      [`no-uncaught-void-then.test.ts`](apps/mobile/src/lib/__tests__/no-uncaught-void-then.test.ts)
      ne surveille que les **chaînes** `void … .then(…)` — c'est-à-dire les cas où quelqu'un a écrit
      une suite pour le succès, et donc pensé au succès seulement. Les `void appel()` sans
      continuation sont hors périmètre **volontairement** : la plupart appellent une fonction qui
      capture déjà en interne, et leur ajouter un `.catch` produirait ~287 diffs de bruit pour une
      valeur non démontrée. À rouvrir seulement si un rejet non capturé en vient réellement.

- [ ] 🟠 **Socle de tests unitaires — lot 5 (écrans).** Chantier ouvert le 03/08/2026 :
      1 681 → **2 215 tests**, couverture mobile 15,0 % → **23,3 %**, `data/repositories`
      9 % → **31 %**, `lib` 28 % → **54 %**, `stores` 16 % → **48 %**, et `apps/admin` passé de
      **aucun runner** à **157 tests / 61 %**. **Lots 0 à 4 et 6 terminés** — les seuils de
      couverture sont désormais **appliqués par la CI** (`npm run test:coverage`). Plan, technique
      et **point de reprise §8** : [strategie-tests.md](docs/specs/technical/strategie-tests.md).
      Reste : les **écrans à état**. ⚠️ La « reprise des `*-smoke.test.tsx` » annoncée le
      03/08/2026 **n'a pas lieu d'être** : ils font tous `await render(...)`, donc leurs effets
      s'exécutent bel et bien — le diagnostic initial était faux (§3.6).
      ⚠️ **`.nvmrc` est passé à Node 24** (`node:sqlite`) : `nvm use 24` avant de lancer les tests,
      sinon la suite mobile échoue à l'import du harness sans dire pourquoi.

- [x] ✅ **Couverture de branches de `packages/shared` — réauditée le 09/08/2026, 97 → 98 %.**
      L'arbitrage de 97 % du 04/08 était juste **au jour de l'audit**, et c'est sa limite : `dev` a
      livré depuis ALLURE-01, FUEL-01 et RUN-19, dont une partie apportait des branches **réellement
      atteignables** restées nues. `running.ts` : 91,4 % → 98,6 % (traces GPS abîmées, décodage
      d'une trace tronquée). Le reste est bien du code défensif inatteignable, comme arbitré.
      **Un seuil « au-dessus c'est du code mort » se périme : réauditer à chaque palier.**

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
