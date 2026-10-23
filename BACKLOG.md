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
| **LANCE-00 — Compte développeur Google Play** | 9.2 | Créer le compte développeur (25 $, une fois), puis la fiche d'application dans la Play Console. | 🔴 **Rien de la chaîne de publication ne peut démarrer sans lui** — ni la fiche, ni la déclaration santé, ni la soumission. Vérification d'identité Google : compter plusieurs jours. **Non démarré au 06/08/2026.** ⚠️ **La déclaration santé doit porter 7 types de données** (`WRITE_EXERCISE`, `WRITE_DISTANCE`, `READ_WEIGHT`, `READ_STEPS`, `READ_MENSTRUATION`, `WRITE_MENSTRUATION`, `READ_SLEEP` — BIEN-06, 01/10/2026) et déclarer, en « Sécurité des données », une **donnée de santé transmise hors de l'appareil** (les pas sont synchronisés). La politique de confidentialité doit aussi mentionner le sommeil. |
| **LANCE-01 — Publication Play Store** | 9.2 | Build AAB prod (EAS) + fiche Play + soumission review. | 🔴 Dépend de **LANCE-00** + de tout le P0 + du délai de review. |
| **LANCE-03 — Retirer le spike 3D de « Mon corps » du build de soumission** *(reporté de RECETTES §70, 23/10/2026)* | 9.2 | Supprimer `apps/mobile/src/app/spike-corps-3d.tsx`, son entrée volontairement voyante et **non traduite** « ⚠️ SPIKE — silhouette 3D (mesure) » dans `app/body.tsx` (l. 67-72), `components/body/spike3d/` et la copie de three qu'il embarque (~1,4 Mo de bundle DOM). | 🔴 Écran de mesure « à supprimer après », jamais supprimé : il est **visible de tout utilisateur** dans Mon corps. La décision du spike (≥ 30 i/s ou non) n'a jamais été prise — si la piste 3D est gardée, la sortir du build Play comme LANCE-02 plutôt que de la livrer. |
| **LANCE-02 — Retirer le spike VBT-01 du build de soumission** | 9.2 | Supprimer `apps/mobile/src/app/spike-vbt.tsx`, sa ligne dans le `Stack` racine, son entrée en bas des Réglages, et les dépendances `react-native-vision-camera` / `react-native-nitro-modules` / `react-native-nitro-image` / `react-native-vision-camera-worklets`. Les modules purs `bar-velocity.ts` / `bar-tracker.ts` **restent** : ils ne coûtent rien et servent au cadrage. | 🔴 **Entré dans `dev` le 19/09/2026** par fusion de `spike/vbt01-camera`, à la demande de Florian, pour tenir l'essai en salle dans un seul APK. Écrit ici **parce que ça ne doit pas tenir à la mémoire de quelqu'un** : un écran d'essai caméra dans le build public se remarquerait à la review. ⚠️ À faire **juste avant** le build `production`, pas avant — sinon l'essai device n'est plus possible. |

> **Prérequis hors-code du lancement**, dans l'ordre des dépendances :
> 1. **Compte développeur Play + fiche d'app** (LANCE-00) — **préalable à tout le reste**.
> 2. **Politique de confidentialité publiée à une URL publique** (pas seulement le texte in-app) —
>    exigée par la fiche Play **et** par Health Connect ; suppose la relecture juridique des
>    textes CGU / confidentialité. ⚠️ **Rouverte par CYCLE-01 et DOUL-01** (données de santé
>    sensibles) : la relecture doit porter sur la version qui les mentionne.
> 3. **Déclaration Google Play « Health apps »** pour Health Connect : formulaire + justification
>    des **7 types de données** (`READ_SLEEP` ajouté par BIEN-06). ~7 j d'instruction + 5-7 j ouvrés de propagation. Procédure et
>    textes prêts à coller :
>    [health-connect-play-declaration.md](docs/specs/technical/health-connect-play-declaration.md).
>    🔴 **Elle se dépose une seule fois** : la déposer incomplète impose une re-déclaration et
>    ~2 semaines de délai externe de plus.
> 4. SMTP custom Supabase (le service e-mail intégré est rate-limité).
> 5. **Relecture du garde-fou « humeur basse »** (BIEN-02, spec §8) par une personne compétente : seuil
>    et texte du renvoi vers le **3114**, avant que le pilier Bien-être sorte. Ajouter un numéro d'aide
>    **hors de France** : le 3114 s'affiche aussi dans l'app en anglais.
> 6. **Sync rules PowerSync à jour** : coller le YAML complet et cocher le collage dans
>    [MIGRATIONS.md](supabase/MIGRATIONS.md#déploiements-des-sync-rules-powersync). 🔴 Le collage qui
>    ajoute `cross_link_weeks` (LIENS-01, 30/09/2026) **n'a jamais été confirmé** : sans lui, l'histoire
>    des liens du Labo se perd à la resynchro, sans erreur visible.
>
> 📄 **Brouillons prêts à relire** :
> [lance00-fiche-play-et-confidentialite.md](docs/specs/technical/lance00-fiche-play-et-confidentialite.md)
> — politique de confidentialité publiable, fiche Play (titre / descriptions), réponses au formulaire
> « Sécurité des données » établies d'après les tables réelles, et ordre d'exécution.
> **Restent à compléter par un humain** : l'identité du responsable de traitement + l'e-mail de
> contact (RGPD, je ne peux pas les inventer), la version EN, et la relecture juridique.
> 🔴 **Rouverte par PRISME-01** (validée le 03/10/2026) : avec Prisme, des agrégats
> d'entraînement et de nutrition partent chez un fournisseur IA (Groq aux États-Unis, ou Mistral) pour
> qui l'active. Avant que Prisme entre dans le build soumis : politique de confidentialité (publiée et
> `legal.privacy`), formulaire « Sécurité des données », base du transfert hors UE, et **accès réservé
> aux testeurs (ACCES-IA, table dédiée — pas `user_roles`, où toute ligne rend administrateur)** — spec
> [§11](docs/specs/functional/us/prisme01-prisme-raconte.md). ACCES-IA est entrée dans le pipeline le 23/10/2026 →
> [spec](docs/specs/functional/us/acces-ia-testeurs.md) (roadmap 7.43). À défaut, l'exclure du build comme LANCE-02.
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
| **PRISME-01b — Les résumés du Labo dans la voix de Prisme** *(Q1 de PRISME-01, tranchée par Florian le 03/10/2026)* | 7.33, 7.34 | NARR-01 et CONS-01 passent sur l'accord et le fournisseur de Prisme (type `narrate`), **sans les suspects bien-être** (`sleepShort`) tant que le second accord n'existe pas ; libellé « Prisme raconte ». | 🔴 **Ils envoient aujourd'hui de vraies données sous l'accord du Labo IA**, dont le texte dit « à n'activer que sur des données factices » (limité aux comptes qui ont activé le Labo IA). Rien n’attend plus : NARR-01 et CONS-01 sont clôturées (23/10/2026) ; leurs critères (« aucun bouton sans consentement ») changent. |
| **RUN-F3b — Météo de course** *(scindé de RUN-F3)* | 5.24 | Conditions météo au moment de la course, et avant une sortie planifiée. | 🔴 **À trancher AVANT de soumettre la fiche Play.** Une requête météo transmet des **coordonnées à un service externe** — ce qui contredit la politique de confidentialité et le formulaire « Sécurité des données » rédigés pour [LANCE-00](docs/specs/technical/lance00-fiche-play-et-confidentialite.md), qui affirment aujourd'hui qu'aucune donnée n'est partagée. Trois questions ouvertes (spec RUN-F3 §4 D2) : fournisseur (Open-Meteo = le seul sans clé à stocker), moment de l'appel, et **assumer qu'une course hors réseau n'aura jamais de météo** — on ne récupère pas une météo passée gratuitement. Le **terrain**, lui, ne demande aucun réseau et est livré depuis le 01/08/2026. |
| **CARDIO-02 — Les quatre portes vers l'allure de référence** *(audit Course F2, F3, F39)* | 5.40 | Les quatre chemins pour donner son allure de référence (chrono de course, test Cooper, allure connue, « je ne sais pas ») + accueil du pilier en 3 questions. | 🟢 **Les briques de calcul sont livrées et testées** (`referencePaceFromRaceTime` — Riegel inversé — et `referencePaceFromCooperTest`, 8 tests dans `packages/shared/src/running-hub.ts`). Il ne reste que les **écrans**. Sans allure de référence, **toutes** les allures cibles du pilier sont absentes : c'est la porte d'entrée de tout le reste, donc le premier des six à reprendre. |
| **CARDIO-03 — Écran de départ + saisie rétroactive** *(audit Course F4 → F8, F26)* | 5.40 | Attendre le fix GPS avant de lancer, mémoriser le dernier mode, compte à rebours, rappel du contexte de séance, et **saisir une course déjà faite**. | 🟢 `createPastRun` est livrée et typée côté repository — **l'écran manque**. ⚠️ La saisie rétroactive n'est pas du confort : sans elle, une course oubliée ou faite sans le téléphone est **définitivement absente** de l'ACWR, de la polarisation et des records, qui pilotent ensuite les allures cibles. 🔵 **Absorbé en partie par [CARDIO-UX03](docs/specs/functional/us/cardio-ux03-hub-onglets.md) (25/09/2026)** : l’écran de départ porte le nom de la séance, la rappelle (F7) et **retient le dernier mode** (la moitié de F4 : le hub ne part pas encore en un geste). Restent le départ direct depuis le hub, le décompte, l’attente du fix GPS (F5, F6), la permission avant `startRun` (F8) et la saisie rétroactive (F26, Q6 : hors CARDIO-UX03). |
| **CARDIO-04 — Historique en trois onglets** *(audit Course F22, F23, F24)* | 5.40 | Historique filtrable (type de séance, terrain, RPE) et **liste virtualisée**. | 🟢 La requête est déjà enrichie (`SELECT_HISTORY` remonte terrain, type de séance et séance planifiée via deux `LEFT JOIN`) — **l'écran ne s'en sert pas encore**. 🟠 La virtualisation devient nécessaire au-delà de quelques centaines de courses : à vérifier sur un compte chargé, pas sur un compte neuf. 🔵 **Absorbé en partie par [CARDIO-UX03](docs/specs/functional/us/cardio-ux03-hub-onglets.md) (25/09/2026)** : l’historique devient l’onglet Historique du hub (calendrier du mois, lignes enrichies du type, du terrain et du ressenti, « Par type » comme filtre) ; Progression et Records vont dans Progrès. Restent le filtre par période au-delà du mois, le RPE en filtre et la **virtualisation**. |
| **CARDIO-05 — Éditeur de séance à trois niveaux** *(audit Course F27 → F34)* | 5.40 | Réécrire les éditeurs : saisie **en une ligne** (`2km ech + 6x400/200 + 1km rac`), modèles, « Répéter la sélection », et repli du mode détaillé pour ceux qui le veulent. | 🟢 **La grammaire complète est livrée et testée** (`parseSessionLine` + les 6 `SESSION_TEMPLATES`, 20 tests, chaque modèle vérifié re-lisible). 🟠 C'est le plus gros des six : l'éditeur actuel demande **14 contrôles par segment**, et c'est lui qui rend le conseil « retire 25 % des répétitions » inapplicable à la main. |
| **CARDIO-06 — Les semaines qui progressent** *(audit Course F35)* | 5.40 | Étendre `planProgram` pour générer des semaines qui évoluent, et la vue par semaine de l'éditeur. | 🟢 **La colonne est livrée ET poussée** (`sessions.week_index`, 10/09/2026). ⚠️ **Pas de `default` sur la colonne, délibérément** : `null` signifie « séance de la semaine type, répétée chaque semaine » = le comportement actuel. Aucun programme existant n'est donc à retravailler — mais l'extension doit préserver cette lecture. |
| **CARDIO-07 — Import GPX et Health Connect** *(audit Course F25)* | 5.40 | Importer des courses depuis un fichier GPX ou depuis Health Connect. | 🔴 **Rien de livré, et à ne pas démarrer avant que LANCE-00 soit déposé.** La **lecture** Health Connect ajoute deux permissions et **change donc la déclaration « Health apps »** de la fiche Play — chemin critique du lancement (9.2), au même titre que **RUN-F3b** ci-dessus. L'import GPX seul, lui, ne touche à aucune déclaration : c'est la moitié livrable tout de suite si on veut découper. |
| **TRAD-01 — Les aliments CIQUAL en anglais** *(reporté de RECETTES §58, 23/10/2026)* | 4.8 | Les **3 164** noms d'aliments CIQUAL n'ont pas de traduction EN (`needsTranslation`) et s'affichent en français dans l'app anglaise ; leurs portions usuelles manquent aussi. | 🔴 **Contredit la décision G** (FR + EN au lancement) alors que la roadmap marque 4.8 « traduction EN incluse » ✅ : traduire, ou assumer une app anglaise partielle — **à trancher avant LANCE-01**. Matière : spec NUTRI-UX01 §9, `supabase/scripts/enrich-ciqual/`. |
| **SIGNOUT-01 — La déconnexion ne vide pas la base locale** *(reporté de RECETTES §89, 23/10/2026)* | — | Une déconnexion ordinaire (`auth-store.ts`, `signOut` en scope local) ne passe pas par `disconnectAndClear` : au changement de compte sur le même téléphone, le premier état est calculé sur les données du compte précédent. | 🟠 **Confidentialité sur un appareil partagé.** Vider la base PowerSync à la déconnexion, et vérifier que rien ne se perd pour un utilisateur qui se reconnecte (écritures en file non synchronisées). Constat : spec LIENS-01 (l. 226). |
| **LABO-05 — Deux constats ouverts de la revue du Labo** *(LABO-01 §4 bis, reporté de RECETTES §66/§89)* | 7.30 | **n° 3** : sans protéines saisies, l'assiette s'affiche pleine — la même image que « cible atteinte ». **n° 5** : la famille `loadRisk` ne dit rien quand un seul pilier est actif. | 🟢 Deux corrections localisées, notées « à traiter après la recette » dans la spec LABO-01 (l. 220-226) — plus rien n'attend. |
| **CONTENU-02 — Relire les contenus écrits sans coach** *(reporté de RECETTES §3 et §26)* | 3.1 · 1.27 | Les programmes **PPL** et **Half Body** (CONTENU-01), écrits « sans voix de coach », et les **7 jours** d'ACTIV-01, encore en brouillon. | 🟠 Travail de coach → Damien/Florian, **avant publication** : c'est le premier contenu qu'un nouvel utilisateur lit. |
| **IDENT-02 — L'identité des écrans empilés du Bien-être et du Labo** *(constat IDENT-01, 23/10/2026)* | — | Déclarer l'identité de `wellbeing.tsx`, `wellbeing-settings.tsx`, `pain.tsx` (`useMenuFocus('wellbeing')`) et de `lab-link.tsx` (`'lab'`), et les sortir de `SANS_PILIER` dans `apps/mobile/src/app/__tests__/pillar-identity.test.ts`. | 🟢 **Une ligne par écran, et le garde est déjà exhaustif** (IDENT-01 classe les 66 écrans empilés). Même défaut que IDENT-01, laissé hors de son périmètre (Musculation et Nutrition seulement) : ces écrans prennent l'identité de leur porte d'entrée — la fiche d'un lien, ouverte depuis l'Accueil, a une scène dorée et des cartes terracotta. IDENT-01 garantit seulement qu'ils **ne changent plus** de couleur au retour d'un autre pilier. ⚠️ **`cycle/index.tsx` est à trancher** : CYCLE-01 l'a écrit « dimension transverse, pas un 4ᵉ pilier » (31/07/2026), avant que le Bien-être devienne un pilier. La fiche d'un lien force aussi une barre d'état claire tant qu'elle est ouverte (voir BARRE-01). Vérification : une passe Bien-être, une passe Labo. |
| **BARRE-01 — La barre d'état suit le dernier composant monté, pas l'écran affiché** *(constat IDENT-01, 23/10/2026)* | — | Faire déclarer le style de la barre d'état par l'écran, comme son identité. Trois cas lus dans le code : (1) **séance immersive et brief** (`immersivePalette`, fond sombre fixe) — la barre suit le thème, donc en thème clair **icônes sombres sur fond sombre** ; (2) **l'onglet Labo** monte un `<StatusBar style="light" />` (`(tabs)/lab.tsx:378`) jamais démonté, qui l'emporte **pour toute la session** dès la première visite du Labo — icônes claires partout, y compris sur l'Accueil en thème clair *(retiré par IDENT-01 si sa décision D12 est retenue)* ; (3) **la fiche d'un lien** (`lab-link.tsx`) fait de même tant qu'elle est ouverte, donc sur les écrans qu'elle ouvre. | 🟠 **La cause est unique** : React Native fusionne les `StatusBar` montés **dans l'ordre de montage**, le dernier gagne — la racine, l'onglet, le Labo et la fiche se battent. Constaté à la lecture du code, **à confirmer sur téléphone en thème clair** (en thème sombre, des icônes claires sont justes partout, ce qui explique que rien n'ait été remonté). |
| **VIE-02 — La « reprise en douceur » de l'Accueil mène à une route qui n'existe pas** *(constat IDENT-01, 23/10/2026)* | — | `onGentleRestart` (`(tabs)/index.tsx:186-187`) démarre la période « vie réelle » puis pousse `/real-life` ; aucun écran `real-life` n'existe dans `apps/mobile/src/app/`, ni dans l'historique git. | 🔴 **L'utilisateur qui revient après une absence et choisit la reprise en douceur tombe sur l'écran « Unmatched Route »** (la période, elle, est bien enregistrée). À trancher : écran à créer (que montre-t-il ?) ou simple retour à l'Accueil. Le typecheck ne l'attrape pas (`typedRoutes` est déclaré dans `app.json`, mais la suite passe avec ce lien). |
> **Les six lignes CARDIO ci-dessus sont les chantiers non livrés de l'audit du pilier Course**
> (CARDIO-UX01, 10/09/2026). Elles ne sont **pas** des idées neuves : chacune a ses constats
> numérotés dans [l'audit](docs/product/audit-ergonomie-pilier-course.md) (22 pages, 40 constats) et
> sa section dans la [spec](docs/specs/functional/us/cardio-ux01-refonte-pilier-course.md).
>
> **À part ces quatorze-là, aucun autre candidat P1.** Les 14 idées promues dans
> [V0.9](docs/roadmap/roadmap.md#v09--enrichissements-avant-lancement) le 28/07/2026 sont **toutes
> livrées**, CONF-07 comprise (01/08/2026), ainsi que la
> 2ᵉ salve du 28/07 (RUN-14, NUTR-16, MUSC-09, LAUNCHER-01, ACTIV-01) et les 4 enrichissements
> ouverts après elle (INSIGHTS-01/02, COLLIS-01, VIE-01, DOUL-01).
>
> ⚠️ **CONTENU-01 n'est plus un candidat** : il a une spec depuis le 28/07/2026
> ([contenu-01…md](docs/specs/functional/us/contenu-01-seed-bibliotheques-programmes.md))
> et devait donc quitter ce fichier — il y était resté jusqu'au 06/08/2026, en
> contradiction avec [ETAT.md](ETAT.md) qui l'excluait déjà. Ce qui reste ouvert dessus est une
> **décision de contenu**, pas un candidat de dev : combien de programmes par pilier au lancement, et
> qui fournit séances/exos/reps. C'est du travail de coach → Damien/Florian.

---

## 🟢 P2 — Confort & optionnel

| Candidat | # | Contenu | Point dur |
|---|---|---|---|
| **PRISME-02 — La photo de repas, avec Prisme** *(suite de PRISME-01, 03/10/2026)* | — | Revenir à la photo de DASH-01 (écran `meal-photo` retiré le 13/09/2026, restaurable depuis `622339f2^`) sur la revue de la saisie rapide : aliments et grammes par le modèle, calories par la base, file d'une photo hors ligne. | 🟠 **Il faut un fournisseur qui lit les images** et qui n'entraîne pas sur nos requêtes (le modèle Groq par défaut ne lit pas les images ; Mistral après opt-out, ou payant). **Redimensionner l'image** avant l'envoi (aucun `expo-image-manipulator` aujourd'hui, la fonction refuse au-delà de 4 Mo). |
| **SOCLE-01 — RevenueCat câblé inactif** | 9.14 | Entitlements posés, aucun paywall (app gratuite en V1). | ⏳ **Différée le 30/07/2026 (Florian), après cadrage.** Quatre constats : (1) [prd.md:122](docs/product/prd.md) dit les paliers Premium → Écosystème → IA « conservés **pour mémoire uniquement, non engageants** » — les définir serait les inventer ; (2) **« Premium muscu » n'a aucun contenu défini** nulle part et « Écosystème » n'est nommé que dans l'ADR-003 — seul le palier **IA** a une décision datée (15/07/2026 : 1-2 bilans croisés gratuits bridés vs exhaustif + chatbot à quota) ; (3) **aucune fonctionnalité IA n'est livrée** ([ia-integration-analyse.md](docs/product/ia-integration-analyse.md) n'est pas encore une US) → la couture n'aurait **aucun consommateur réel** ; (4) LANCE-00 non fait → sans compte Play, aucun produit configurable, donc **un SDK RevenueCat n'aurait rien à récupérer**. **À reprendre avec la première US IA**, qui fournira le premier point d'accès réellement gatable. |
| **VBT-01 — Vitesse de barre à la caméra** *(retenue le 13/09/2026, salve « carnet d'innovation »)* | — | Mesurer la vitesse de chaque répétition avec le téléphone **posé de profil** : vitesse moyenne de montée par rep, **perte de vitesse dans la série** → signal d'arrêt et RIR estimé. Squat, développé couché, soulevé de terre. **Analyse en direct sur l'appareil : aucune vidéo enregistrée ni envoyée**, seules les vitesses sont synchronisées (pas de stockage de fichiers, pas d'API d'IA). Questions pratiques, positionnement, pastille ou non : [analyse-innovation-2026-09.md §6](docs/product/analyse-innovation-2026-09.md). Maquette : [VitesseBarre.dc.html](design/innovation-2026-09/VitesseBarre.dc.html). | 🔵 **Spike démarré le 19/09/2026** → [rapport](docs/specs/technical/spike-vbt01-vitesse-barre.md). **Moitié « calcul » livrée et prouvée** (`packages/shared/src/bar-velocity.ts`, 32 tests) : 100 % des reps détectées sur trace simulée, écart ≤ 0,05 m/s **si le suivi tient ±3 px** — et surtout, la **perte de vitesse** (ce qui déclenche l'arrêt) reste juste à 1-5 points dans toutes les conditions, alors que la vitesse absolue affichée porte 0,02 à 0,08 m/s d'erreur. Le facteur limitant n'est pas la cadence mais la **précision du suivi**. Reste la moitié « caméra », sur branche dédiée : `expo-camera` en est incapable (vérifié : aucun accès aux images), il faut `react-native-vision-camera` 5.2.3 + nitro, donc un ajout natif qui **ne doit pas entrer dans le build de soumission Play**. 🟠 **Faisabilité toujours à trancher** : essai device, critères de sortie fixés d'avance — **≥ 95 % des reps détectées, écart ≤ 0,05 m/s** avec une référence, **≥ 30 i/s** sur un Android milieu de gamme, pas de chauffe sur 5 séries. Si un critère échoue, on ne cadre pas d'US. 🟠 `expo-camera` ne suffit pas : nouvelle brique caméra + module natif sous Expo, la friction connue (le dépôt en a déjà écrit : Health Connect, widget). 🟢 Se branche sur l'existant : RPE/RIR (UX-05), module force (MUSCPWR-01). ⏳ **Post-lancement** : ne démarre pas avant LANCE-01. |
| **CIBLE-02 — Une séance planifiée d'un pilier éteint donne-t-elle le forfait ?** *(constat CIBLE-01 D7, 21/10/2026)* | 4.7 | `trainedOnDay` compte une séance planifiée `planned`/`done` (aujourd'hui et après) **quel que soit le pilier**, et `togglePillar` ne touche pas aux séances planifiées : éteindre muscu et course avec un programme en cours laisse le forfait dans Aujourd'hui et Noryn. Seul le planning repas le coupe (REPAS-01 R5, décision H) — CIBLE-01 l'y garde (D7-B), c'est la seule exception à sa règle « une cible par jour ». Trancher pour **tous** les écrans à la fois. | 🟠 Change `trainedOnDay`, donc **Noryn** : à cadrer avec le filet de NORYN-02 et un redéploiement. Pas un cas rare : quiconque éteint un pilier en cours de programme. |
| **CIBLE-03 — La séance marquée faite sans séance enregistrée** *(constat CIBLE-01 C5, 21/10/2026)* | 4.7 | Une occurrence passée à `done` depuis le planning (`markPlannedSessionDone`), sans séance ni course enregistrée, donne le forfait **le jour même** (anticipation) et plus **le lendemain** (le passé ne lit que le réalisé) : la cible d'hier change à minuit. Compter `done` comme du réalisé ? | 🟠 Change `trainedOnDay`, donc **Noryn**. Une ligne de règle, mais toutes les cibles passées des comptes concernés bougent : à vérifier sur l'historique. |
| **CIBLE-05 — Les fenêtres jugées sur la cible d'aujourd'hui** *(constat CIBLE-01 D12, 22/10/2026)* | 4.32 | Quatre analyses comparent une **fenêtre** d'apports à la cible de base **d'aujourd'hui**, appliquée à tous ses jours : alerte « déficit + gros volume » (`useDeficitVolumeAlert`, J−7 → J), garde-fou charge & repos (`useOvertrainingGuardAlert`, jours en déficit J−6 → J), score de forme (`useReadiness` → `composeReadiness`, moyenne 7 j), enquête « déficit » du Labo (`lab-investigations.ts:205-211`). Les juger sur la cible **de chaque jour** (`useDailyCalorieTargets`). | 🟠 Le score de forme passe par `composeReadiness`, **partagée avec Noryn** : le changer change Noryn (filet NORYN-02, redéploiement). Les trois autres changent des alertes et une enquête : à vérifier une à une. |
| **CIBLE-06 — La cible du contexte du Labo IA** *(constat CIBLE-01 D12, 22/10/2026)* | 7.31 | Le contexte que le Labo IA envoie au modèle (`ai-context-repository.ts:406`, lu par `ai-lab.tsx`) porte `targetKcal` = la **surcharge manuelle seule**, `null` sinon : le modèle évalué ne connaît pas la cible que l'app affiche dès qu'aucune surcharge n'est posée. Y mettre la cible effective du jour. | 🟢 Une lecture ; mais ce qui part vers un fournisseur d'IA change : relire la liste blanche du contexte (IA-LAB-01). |
| **CALIB-01 — Calibrer les seuils posés sans mesure** *(reporté de RECETTES, 23/10/2026)* | — | Seuils écrits au jugé, que la recette devait faire juger par un pratiquant : COLLIS `LEG_SETS_CONFLICT_THRESHOLD` = 8 · EXEC 3 séances / 5 séances / 4 semaines · ALLURE 10 km, 2 % et frontière Tempo · APPORT 1,25×, 3 jours, 0,3 g/kg · DOUL `PAIN_FRESHNESS_DAYS` = 7 · RUN-F1b filtres GPS 30 m / 3 m · FUEL `CARB_TARGETS_G_PER_KG` et `CARB_LOAD_THRESHOLDS_H` · RUN-F4 tolérance 5 s/km. | 🟢 Constantes exportées et testées : changer une valeur = une ligne + ses tests. À reprendre sur retour d'usage réel plutôt qu'en bloc. |
| **MUSC-F14b — « Remplacer » dans l'éditeur de programme** *(reporté de RECETTES §11)* | 3.52 | Décider si la substitution d'exercice, livrée en séance, doit aussi exister dans l'éditeur de programme. | 🟢 Décision produit d'abord (spec MUSC-F14 §0.2). |
| **MUSCU-UX01b — Les manques de l'historique muscu** *(reporté de RECETTES §57)* | 3.59 | Filtres d'historique **par programme** et **par groupe musculaire** (promis par la spec §6.1, jamais livrés), **édition d'une séance passée**, et retour du **record précédent** après suppression de la séance qui le portait. | 🟢 Listés dans la spec MUSCU-UX01 (l. 98 et §7). Le dernier touche aux records : test SQL de niveau 2. |
| **CLAV-02 — Le champ actif remonte seul sur iOS** *(constat CLAV-01 D3, 22/10/2026)* | — | CLAV-01 pose un conteneur commun qui fait remonter le contenu au-dessus du clavier sur les deux plateformes ; sur Android, le champ qui a le focus défile ensuite **seul** à l'écran (comportement natif d'un `ScrollView` qui rétrécit). iOS n'a pas cet équivalent : le champ reste atteignable en faisant défiler, mais ne remonte pas tout seul. Ajouter dans `KeyboardAwareScrollView` un défilement vers le champ actif, **iOS seulement**. | 🟢 Aucune régression d'ici là (iOS n'a ce défilement nulle part aujourd'hui). ⏳ **Avec le portage iOS** (décision E) : rien à vérifier sans build iOS. |

---

## 🧹 Dette & suivi technique

Petits sujets hors US, à traiter à l'occasion. Ne bloquent rien.

> 🆕 **Ouvert le 23/10/2026 par ACCES-IA (spec D10, QA2) — export RGPD et tables serveur.** L'export de
> l'app ([data-export.ts](apps/mobile/src/lib/data-export.ts)) lit la **base locale** ; son test de
> complétude ne voit donc que le schéma PowerSync. Cinq tables serveur portent pourtant une donnée
> personnelle et n'y entrent pas : `ai_testers` (statut de testeur de l'IA), `ai_usage` (compteur de
> demandes à l'IA), `user_bans` (motif de bannissement), `account_deletion_requests`, `sync_receipts`.
> Position prise pour `ai_testers` : hors de la portabilité (art. 20 — ce n'est pas une donnée fournie par
> l'utilisateur), dite dans l'app et la politique, servie sur demande (art. 15). **À arbitrer d'ensemble**
> pour les cinq, avec la relecture juridique de LANCE-00 : les lister explicitement quelque part (un
> registre des tables serveur, gardé par un test comme `EXPORT_EXCLUSIONS`), et décider pour chacune.

> 🆕 **Ouvert le 12/09/2026 — code devenu orphelin par MUSCU-UX02.** Le bilan de séance passant par `useWorkoutReport`, trois hooks de `records-repository.ts` n'ont plus **aucun appelant de production** : `useWorkoutRecords` (l. 538), `useWorkoutDetail` (l. 1026) et `useExerciseDeltas` (l. 1445) — seuls `records-sql.test.ts` les touche encore. Même chose pour les clés i18n `workout.summary.records.*`, `workout.summary.density`, `workout.summary.minuteSymbol` et tout le bloc `history.detail.set*/record*/meta*`, à zéro usage dans les deux locales.
> ⚠️ **Volontairement pas supprimés dans le lot MUSCU-UX02** : la suppression touche un fichier de 1 500 lignes et ses tests — un dégât collatéral y aurait coûté plus cher que le ménage n'y rapportait. MUSCU-UX02 est clôturée (23/10/2026) : à faire d'un seul geste, avec la suite de tests en filet.
> 🔴 `SummaryExerciseList.tsx`, lui, **a bien été supprimé** dans le lot : il n'était plus référencé nulle part et ne portait aucun test.

- [ ] 🟢 **`WeekStrip.tsx` n'a plus aucun appelant** (relevé par CIBLE-01, 21/10/2026) : la trame des
      sept verres a quitté l'onglet Aujourd'hui avec NUTRI-UX03 ; le composant est resté (sans test).
      Il jugeait chaque jour sur **une seule** cible : à supprimer, pas à rebrancher.

- [ ] 🟠 **~30 requêtes lisent encore les traductions d'exercice par `LEFT JOIN` — non indexable.**
      Relevé le 23/09/2026 par MUSCU-FIX02 (mesuré sur un banc qui reproduit les vues PowerSync) :
      SQLite **n'utilise jamais un index** pour la table de droite d'un `LEFT JOIN` sur une vue
      PowerSync — chaque ligne relit toute la table `exercise_translations` (185 ms sur PC pour
      350 exercices, contre 0,6 ms en sous-requête). Le chemin de la **séance** est corrigé ; restent
      notamment `records-repository.ts` (12 sites, dont `SELECT_WEIGHT_RECORDS` du hub, relancée à
      chaque clôture), `workout-report-repository.ts` (le **bilan** : `SELECT_SETS`,
      `SELECT_RECORDS`), `dashboard-repository.ts` (4), `strength-cards-repository.ts` (4),
      `strength-hub-repository.ts` (`SELECT_TODAY_PLAN`), `exercise-repository.ts`
      (`SELECT_EXERCISE_DETAIL`), `goal-repository.ts` (2). **Outil prêt** : `exerciseNameSql` /
      `exerciseTranslationSql` (`data/repositories/_sql.ts`) ; un test sur le harnais par requête
      reprise, sur le modèle de `session-live-sql.test.ts`. Même remarque pour les autres
      `LEFT JOIN` sur de grosses tables (`program_translations`, `sessions`).
      ✅ **Aliments faits le 08/10/2026** (recette PRISME-01) : le catalogue (3 244 aliments) prenait
      29 s sur PC et bloquait les 5 connexions de lecture du téléphone → 22 ms (`foodNameSql`).
      **Banc prêt pour la suite** : `test-utils/powersync-views.ts` construit la base comme PowerSync
      (vues JSON + index d'expression de `schema.ts`) et `perRowRereads` nomme les tables relues par
      ligne — modèle : `food-query-plan.test.ts`, une ligne par requête reprise.

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
Dernière révision : **23/10/2026** — fin de la recette consignée : RECETTES.md supprimé, les items
de recette retirés, les constats encore ouverts qu'il était seul à porter reportés ici.*
