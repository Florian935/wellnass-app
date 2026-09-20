# Recettes en attente

> **À quoi sert ce fichier.** Les US arrivées à `etape: recette` attendent une validation **humaine
> sur device ou navigateur** — c'est la seule étape que je ne peux pas faire moi-même, et donc la
> seule qui se perd quand on change de session. Ce fichier est la **liste actionnable** de ce qui
> reste à vérifier, cochable au fil de l'eau depuis le téléphone.
>
> **La source de vérité reste la spec de chaque US** (lien en tête de section) : ici on ne stocke que
> l'**avancement** de la recette, pas les règles.
>
> **Règle de purge — elle compte.** Dès qu'une US est recettée et clôturée (`etape: close`), on
> **supprime sa section**. Ce fichier doit **rétrécir**, sinon il redevient l'ancien `TODO.md`.
>
> Dernière mise à jour : **20/09/2026** — **80 sections**.
>
> ### 📦 L'APK de cette campagne — un seul pour §68, §69 et §70
>
> `builds/mon-corps-spike3d-16092026.apk`, construit le **17/09/2026 à 15:56** depuis le dépôt
> principal sur `dev`, **212,0 Mo**, SHA-256
> `4aa7eba43ee483d7dfbf30e70ff297238896759ecdd75f1e0c6d1ec9391fa68c`, signature **v2**.
> ⚠️ **Tous les APK précédents sont périmés.**
>
> **Maillage v4** — l'approche est inversée : enveloppe corporelle lisse d'abord, muscles lus par
> des **sillons creusés** et un relief de quelques millimètres, au lieu de volumes ajoutés qui
> saillaient de 2 à 3 cm. Mesuré au repos : le creux de l'abdomen de profil passe de 25 mm à 13 mm
> sur 30 cm, le relief moyen des 28 ventres musculaires de 20-30 mm à **4,5 mm**. 35 324 triangles,
> **−22 % de poids**. Planches dans `builds/apercu-maillage-v4/` — regarder d'abord
> `ctrl-silhouette.png` (contour pur, v3 contre v4) et `ctrl-profil.png`.
>
> Vérifié dans l'archive : bundle DOM du spike **3 854 Ko** (contre 4 657 à la v3), Labo 1 001 Ko.
> 🔴 **Le poids reste un sujet** pour un éditeur livré : n'embarquer que la variante découpée,
> baisser la finesse de grille (une variante à 915 Ko existe), ou ouvrir la voie `assetExts` restée
> non testée.
> ⚠️ `gradlew clean` casse le codegen JNI ; des bundles DOM orphelins s'accumulent dans les assets.
> Inoffensif en recette, à traiter avant le Play Store.
> ⚠️ **Tout le JS est cuit dans l'APK** : pour itérer vite, dev client + Metro (mode A de
> [dev-build-android-local.md](docs/specs/technical/dev-build-android-local.md)).
> **⑪ une §70 est arrivée, et ce n'est pas une fonctionnalité** : le **spike 3D** de la silhouette.
> Un écran de mesure volontairement moche, qui sera **supprimé** après. 🔴 Ne pas y chercher de
> qualité visuelle : on compte des zones qui bougent et des images par seconde. Quatre des six
> inconnues sont **déjà répondues** — la section dit lesquelles pour ne pas les re-chercher.
>
> **⑩ deux sections « Mon corps » sont arrivées** : **§68 CORPS-03** (priorités confirmées) et
> **§69 CORPS-04** (programme compatible). Elles se jouent dans **une seule campagne, sur le même APK**.
> 🔴 **Aucune sync rule à déployer** et **aucune migration à pousser** : tout est déjà au cloud.
> ⚠️ **Il faut un objectif visuel enregistré** (CORPS-02) : sans lui, §68 ne propose que de le créer,
> et §69 renvoie vers §68. Commencer par §68.
>
> **⑨ une §65 est arrivée** : la **dépense d'une séance** et les **autres activités** (vélo, natation…),
> livrées en une passe. 🔴 **Une sync rule est à coller à la main avant de commencer** (table neuve
> `activities`). 🔴 **Commencer par les critères 2 et 22** : ils vérifient que le bilan de séance et la
> cible calorique **n'ont rien changé** pour qui ne demande rien — le reste est un ajout.
> ⚠️ **Il faut un poids** (pesée ou profil) : sans lui, toutes les cartes affichent leur remède.
>
> **⑧ une §63 est arrivée** : MUSCU-UX03, le **mode immersif** de la séance de musculation.
> 🔴 **Son premier critère est que le mode classique n'ait bougé en rien** : l'immersif est un
> mode **en plus**, pas un remplacement (décision D1 de Florian). Le classique ne gagne qu'une
> seule chose, la pastille de record au repos.
> ✅ **Aucune migration, aucune sync rule, aucune dépendance native** → recettable sur un build
> de la branche. ⚠️ **Il faut un historique** : verdict, fantôme, records en direct et défi de
> dernière série se taisent sur un compte neuf — c'est le comportement attendu.

> **② une §60 est arrivée** : MUSCU-UX02, le bilan de séance — suite directe de MUSCU-UX01 (§57).
> 🔴 **Son cœur n'est pas l'ergonomie mais l'ISO** : le récap de fin de séance et l'écran
> d'historique sont désormais **le même composant**, là où deux écrans de 1 107 lignes racontaient
> la même séance différemment — jusqu'à afficher le ressenti « 8/10 » d'un côté et « Difficile »
> de l'autre. Ses critères **1 à 4** vérifient cela et sont à passer en premier.
> ⚠️ **Il faut un historique** : la moitié des blocs se taisent délibérément sur un compte neuf.
>
> **⑦ une §62 est arrivée** : DASH-01, les dashboards immersifs — la plus grosse du lot, **37
> critères**, et la seule à toucher les **quatre** écrans d'atterrissage en même temps.
> ✅ **Rien à préparer** : la surface IA a été retirée du build (décision du 13/09/2026), donc ni
> secret, ni déploiement, ni coût d'API — et son dernier critère vérifie justement cette **absence**.
> ⚠️ Sa migration est déjà poussée et **aucune sync rule n'est à déployer** (pour une fois que le
> réflexe ne s'applique pas).

> **⑥ une §61 est arrivée** : MOTION-01, le langage de mouvement. C'est la première US du dépôt qui
> ne change **ni une donnée, ni un écran** : elle ajoute la couche de réponse qui manquait (appuis,
> anneaux, cascades). ✅ **Aucune migration, aucune sync rule, aucune dépendance native** — donc
> recettable sur un build de la branche. 🔴 **Commencer par ses critères 1 à 3** : ils vérifient
> qu'on peut tout couper sans rien perdre, et c'est ce qui rend le reste acceptable.
> ⚠️ Sa dernière sous-section liste **26 effets non livrés** sur les 45 analysés : ne pas les
> chercher dans l'app.
>
> **③ une §58 est arrivée** : NUTRI-UX01, refonte du pilier Nutrition — troisième pilier repris
> dans la même semaine, après l'accueil et la musculation. 🔴 **Elle a deux prérequis**, dont un
> geste manuel dans le dashboard PowerSync : lire son encadré avant de commencer.
>
> **④ et une §59, le même jour** : CARDIO-UX01, refonte du pilier Course — **quatrième** pilier de
> la semaine, et le dernier. ⚠️ **Cinq de ses critères ne relèvent pas de l'ergonomie mais de la
> justesse** : l'app affichait un chrono qui n'était pas celui qu'elle enregistrait, et une course
> sans GPS ne gardait aucune durée. Ce sont les critères **1, 3, 5, 11 et 12** — à passer en
> premier. ⚠️ Sa dernière sous-section liste **six chantiers non livrés** : ne pas les chercher
> dans l'app.
>
> *Historique du jour :* Deux mouvements le même jour, en
> sens inverse :
> **① l'ancienne §57 est partie** (refonte de l'accueil, ACCUEIL-01 → 06, recette validée par
> Florian après une passe de 5 correctifs) — supprimée conformément à la règle de purge ci-dessus ;
> ses critères restent lisibles dans l'historique (`git show 67e0755:RECETTES.md`).
> **② une nouvelle §57 est arrivée** : MUSCU-UX01, refonte du pilier Musculation, qui a repris le
> numéro libéré. Ne pas confondre les deux si vous relisez un message antérieur au 10/09.
> Restent **57 sections** : 55 US en recette, plus le lot de correctifs §55 (rejets de promesse non capturés), qui est de la **non-régression** et non une US. 🔴 **Commence par
> l'encadré du 06/08 ci-dessous** : VIE-01 et DOUL-01 ont modifié du code appartenant à **8 sections
> déjà écrites**, dont les critères sont antérieurs à ces changements.
>
> ✅ **Toutes les sync rules PowerSync sont déployées** (confirmé par Florian le 06/08/2026) : le
> prérequis qui bloquait MESUR-01, STREAK-01, OBJ-01, ADMIN-01, RUN-F2c, REPAS-01, VIE-01 et DOUL-01
> **est levé**. Ce qui reste par section n'est plus qu'un **build** ou une **manipulation**.
> **MUSCPWR-01** (§29) a un critère (21) qui demande une relecture par un pratiquant, pas une
> manipulation ; **INSIGHTS-01** (§30), **INSIGHTS-02** (§31), **COLLIS-01** (§32), **VIE-01** (§33) et
> **DOUL-01** (§34) sont recettables **sur l'APK existant**.
>
> ✅ **Trou comblé le 06/08/2026** (ouvert le matin par [`/reconcilier`](.claude/commands/reconcilier.md),
> fermé l'après-midi) : les **15 US qui étaient à `etape: recette` sans aucun critère cochable** ont
> désormais leur section — **§35 à §49** (GARDE-01, META-19, MN-04, MR-08, MUSC-12, MUSC-19, MUSC-20,
> MUSC-F15, NUTR-18, RN-03, RUN-18, RUN-F1b, RUN-F2a, RUN-F2b, TRI-03). **49 US en recette,
> 49 sections** : le fichier couvre à nouveau tout ce qu'il doit couvrir.
> 🔴 **Lis l'encadré en tête des §35-49 avant de les dérouler** : cinq de ces signaux ont **changé
> d'écran** (INSIGHTS-02 les a sortis de l'accueil), et le moteur d'insights n'en affiche que **2 par
> famille** — recetter « le widget apparaît sur l'accueil » ferait remonter un faux défaut.

---

## ⚠️ À lire avant de recetter (06/08/2026) — VIE-01 et DOUL-01 ont modifié du code déjà en recette

Les deux US livrées les 05 et 06/08 (`a26d685`, `b470d85`) n'ont pas fait qu'ajouter des fichiers :
elles ont **modifié des fonctions partagées** appartenant à **huit US déjà listées ici**, dont les
critères ont été écrits **avant** ces changements. Une section peut donc passer au vert sans que la
modification qui la traverse ait été regardée.

**Le principe qui limite le risque** : tous les paramètres ajoutés sont **optionnels avec un défaut
neutre**. Sans période « vie réelle » déclarée et sans journal de douleurs activé, le comportement
doit être **exactement** celui d'avant. C'est cette non-régression qu'il faut vérifier — pas la
nouvelle fonctionnalité, qui a ses propres sections (§33, §34).

| Section à recetter | Ce que VIE-01 / DOUL-01 y ont touché | À vérifier **sans rien activer** |
|---|---|---|
| **§6 STREAK-01** | 🔴 `computeStreakWithJokers` : 4ᵉ paramètre **et condition de sortie de boucle réécrite** (`counts` → `traversable`). `findRestorableGap` : nouvelle notion de « couvert ». | La série et la proposition de joker se comportent **comme avant**. C'est le changement le plus profond de la session — la boucle de comptage elle-même. |
| **§8 BILAN-01** | `decide()` peut désormais écarter 4 de ses 6 signaux ; `WeeklyReview` porte un champ de plus. | Hors période, le bilan rend **la même décision** qu'avant (y compris `volume_drop`, `consistency_drop`, `muscle_imbalance`, `nutrition_drift`). |
| **§30 INSIGHTS-01** et **§31 INSIGHTS-02** | `selectInsights` a un paramètre de filtrage de plus. **Et l'accueil passe de 7 à 8 widgets déclarés** (`MAX_HOME_WIDGETS` relevé). | La sélection d'insights est identique hors période. L'accueil reste lisible avec le widget de plus — c'est l'arbitrage du critère 21 de §33. |
| **§20 MUSC-F1b** | `BodyMap` : **une seule ligne**, `MUSCLE_PATHS` est exporté. Le composant n'a pas changé. | Les 3 écrans qui l'utilisent (fiche exercice, fiche programme, bilan) rendent le schéma à l'identique. |
| **§19 MUSC-F9** et **§32 COLLIS-01** | `planning/index.tsx` rend un bandeau de plus (signal de zone sensible). | Le glisser-déposer et le bandeau de conflit sont intacts ; aucun bandeau parasite. |
| **§27 LAUNCHER-01** | `home-widget-data.ts` : série **et** kcal restantes passent par les nouvelles fonctions. | Le widget du launcher affiche **les mêmes chiffres que l'app**. Une divergence ici serait le symptôme d'un appelant oublié. |
| **§22 NUTR-16** — et **NUTR-18**, qui ⚠️ **n'a aucune section ici** alors qu'elle est à `etape: recette` | 🔴 `useDayCalorieTarget` et `useGoalAdherenceForRange` : la cible de base n'est plus **une valeur** mais **une fonction du jour**. `computeCaloricBalance` (le cœur de NUTR-18) consomme directement ce changement. | Adhérence, **bilan calorique hebdomadaire** et répartition par repas donnent **les mêmes chiffres qu'avant** sur une fenêtre sans période déclarée. |
| **Export RGPD** *(CONF-01, clôturée)* | Deux tables ajoutées : `real_life_periods`, `pain_reports`. | L'archive exportée **contient les deux**. Une donnée de santé absente de l'export est un manquement, pas une finition. |

**Le raccourci le plus efficace** : recetter §33 et §34 **avec les deux fonctionnalités éteintes
d'abord**. Si tout le reste de l'app se comporte normalement dans cet état, la non-régression est
faite ; il ne reste qu'à activer et dérouler les critères propres à chaque US.

Deux réglages, tous deux **désactivés par défaut** : le mode « vie réelle » (aucun réglage — déclarer
une période **est** l'activation) et le journal des zones sensibles (Réglages → *Zones sensibles*).

---

## ⚠️ À lire avant de recetter (30/07/2026) — le code des surfaces « aujourd'hui » a changé

Le correctif `e3fe754` a modifié **19 sites** portant des décisions « aujourd'hui » : dashboard
(séance du jour, résumé nutrition, série, temps d'entraînement, alerte déficit), objectifs, planning,
pas, bien-être, records, journal nutrition. Motif : React Compiler **gelait la date au montage**, donc
en build release ces écrans répondaient éternellement sur le jour de leur premier affichage. Détail
complet dans le [CHANGELOG](CHANGELOG.md).

Deux conséquences pour ta recette :

1. **Tu recettes du code modifié aujourd'hui** sur ces surfaces. Si un critère échoue, regarde d'abord
   s'il touche l'une d'elles.
2. **Ce défaut-là n'est pas observable sur un dev build** : le cache du compilateur est réinitialisé à
   chaque sauvegarde de fichier, et Jest n'applique pas le plugin. Le vérifier demande un **build
   release**, avec ce scénario : ouvrir l'app, laisser en arrière-plan **sans tuer le process**,
   revenir le lendemain, et vérifier que la séance du jour, le journal nutrition, le widget bien-être
   et la série ont bien suivi le changement de jour.

Un test de non-régression a été ajouté pour cette classe de bugs (il compile le code et échoue si une
date est gelée) — mais il protège l'avenir, il ne remplace pas cette vérification-là.

---

## ✅ Prérequis sync rules — levé le 06/08/2026

**Une case par collage** — la version d'avant n'en avait qu'une, cochée le 29/07, alors que 6 lignes
de sync rule ont été ajoutées après : l'encadré annonçait « prérequis levé » pendant deux semaines
où il ne l'était pas. Coller [powersync-sync-rules.yaml](docs/specs/technical/powersync-sync-rules.yaml)
dans le dashboard PowerSync → Settings → Sync Rules → **Deploy**.

- [x] **Collage du 29/07/2026** (Damien) — `body_measurements` (MESUR-01), `streak_jokers`
      (STREAK-01), `personal_goals` (OBJ-01) et la **suppression du filtre `deleted_at`** sur
      `exercises` / `exercise_translations` (ADMIN-01).
- [x] **Collages du 03 → 06/08/2026** — confirmé à jour par **Florian le 06/08/2026** :
      `session_intervals` ×2 (RUN-F2c, buckets `user_data` **et** `shared_content`),
      `meal_plan_entries` / `shopping_lists` / `shopping_list_items` (REPAS-01),
      `real_life_periods` (VIE-01), `pain_reports` (DOUL-01).

> **Règle** : à chaque table neuve, ajouter une case ici **en même temps** que la ligne dans le YAML.
> L'étape a déjà été oubliée deux fois (BIEN-01, RUN-F2c) et elle échoue **sans aucune erreur
> visible** — la donnée reste locale et ne remonte jamais.

**Le test le plus rapide pour confirmer que c'est actif** : archiver un exercice depuis le
back-office, puis vérifier qu'une séance qui l'utilise **affiche toujours son nom** dans
l'historique. Nom vide = sync rule pas déployée.

---

## 1. ADMIN-01 — Archivage sûr du contenu éditorial

📄 [spec](docs/specs/functional/us/admin01-archivage-sur.md) · roadmap 8.11 ·
**🌐 navigateur** (6 critères) **+ 📱 device** (2 critères)

### Au navigateur (back-office)

- [ ] 1. Archiver un exercice **utilisé** affiche un décompte d'usages exact (recoupé en base).
- [ ] 2. Archiver un exercice **inutilisé** indique explicitement « aucun usage ».
- [ ] 3. Le filtre « archivés » montre le contenu archivé, avec sa date, dans les **3 écrans**
      (exercices, programmes, aliments).
- [ ] 4. Restaurer le fait réapparaître dans la liste active, **avec son `status` d'avant**.
- [ ] 5. Restaurer un **programme** restaure aussi ses séances et ses plans d'exercice.
- [ ] 6. Le journal d'audit porte une entrée pour l'archivage **et** pour la restauration.

### Sur device — c'est le test qui compte

- [ ] 7. Une séance contenant un exercice archivé **affiche toujours son nom** dans l'historique, et
      cet exercice **n'apparaît plus** dans la liste de sélection.
- [ ] 8. Le parcours « adopter un programme » **ignore** les programmes archivés.

---

## 2. BIEN-01 — Check-in quotidien de bien-être

📄 [spec](docs/specs/functional/us/bien01-checkin-bien-etre.md) · roadmap 1.24 · **📱 device**

- [ ] 1. Depuis l'accueil, un check-in complet en **≤ 10 s, chronomètre en main**. Plus long = le
      rituel est raté, il faut réduire (pas expliquer).
- [ ] 2. Rouvrir le check-in le même jour affiche les valeurs saisies et permet de les corriger.
- [ ] 3. Un check-in **partiel** (énergie seule) s'enregistre sans erreur.
- [ ] 4. Le poids saisi apparaît dans la courbe de poids existante — **une seule** entrée.
- [ ] 5. Mode avion : saisie OK, données présentes après redémarrage, remontée au retour du réseau.
- [ ] 6. La série (streak) **ne bouge pas** après un check-in seul.
- [ ] 7. L'historique montre un **trou**, pas un zéro, pour un jour non renseigné.
- [ ] 8. TalkBack annonce chaque niveau avec son libellé et l'état sélectionné.
- [ ] 9. Le widget est visible pour un utilisateur n'ayant activé que la **nutrition**.
- [ ] 10. À grande taille de police système, aucun libellé tronqué.
- [ ] 11. L'export RGPD contient les lignes de bien-être.

> ✅ **Constat corrigé le 30/07/2026.** L'état vide de `wellness://wellbeing` n'offrait **aucune
> action** pour lancer un check-in (celui-ci ne s'ouvrait qu'en tapant un jour du journal — donc
> jamais quand le journal est vide) : cul-de-sac atteint par lien direct ou par le widget d'accueil.
> Bouton « Faire mon check-in » ajouté, sur le patron de « Prendre mes mesures » (MESUR-01).
> **À vérifier en recette** : le bouton ouvre bien le check-in du **jour**, et disparaît dès qu'un
> premier check-in existe (le journal reprend alors la main).

---

## 3. CONTENU-01 — Seed des bibliothèques de programmes

📄 [spec](docs/specs/functional/us/contenu-01-seed-bibliotheques-programmes.md) · roadmap 3.1 + 5.2 ·
**📱 device + relecture éditoriale**

- [ ] 1. Les **6 programmes** (3 muscu + 3 course) sont visibles dans les 2 bibliothèques et
      **duplicables**.
- [ ] 2. Parcours complet : biblio → dupliquer → planifier la copie → activer **sur la copie**.
- [ ] 3. Les 2 programmes de test (passés en `draft`) **n'apparaissent plus** côté utilisateur.
- [ ] 4. ⚠️ **Relecture du contenu** des 2 nouveaux programmes muscu (PPL et Half Body) : je les ai
      rédigés **sans ta voix de coach**. Séries, répétitions, temps de repos, progression et
      formulation sont à valider ou à corriger — c'est le seul livrable de la session dont le fond
      dépend de ton expertise, pas de la mienne.

---

## 4. MESUR-01 — Mensurations corporelles

📄 [spec](docs/specs/functional/us/mesur01-mensurations.md) · roadmap 3.51 · **📱 device**
✅ sync rules déployées (06/08/2026)

- [ ] 1. Saisir 3 mesures, enregistrer, les retrouver dans l'historique à la bonne date.
- [ ] 2. Ré-ouvrir la feuille : champs pré-remplis avec le dernier relevé.
- [ ] 3. Ré-enregistrer la même date **met à jour** — aucun doublon.
- [ ] 4. Vider un champ retire cette mesure de cette date, **et elle seule**.
- [ ] 5. Relevé **partiel** : la courbe de cette mesure a un point, les autres un trou.
- [ ] 6. Bascule en impérial : **13,8 in**, pas « 1 ft 1,8 in ». Historique **inchangé** au retour en
      métrique.
- [ ] 7. Une valeur aberrante (500) est refusée avec un message.
- [ ] 8. La saisie porte sur **aujourd'hui** ; une date future est impossible par construction.
- [ ] 9. Mode avion : saisie OK, données après redémarrage, remontée au retour du réseau.
- [ ] 10. Le delta est lisible **sans la couleur** (texte « −1,5 »).
- [ ] 11. TalkBack annonce chaque champ avec son unité.
- [ ] 12. L'export RGPD contient les mensurations.

---

## 5. NUTR-F2 — Suggestion d'aliments pour combler un macro

📄 [spec](docs/specs/functional/us/nutrf2-substitution-aliments.md) · roadmap 4.37 · **📱 device**

> ⚠️ **Le critère 2 a échoué le 01/08/2026, et le contrat de la fonctionnalité a changé en conséquence.**
> La carte proposait *Chipolatas 350 g · 952 kcal* : la quantité visait à combler **100 % de l'écart**, ce
> qu'aucun aliment seul ne peut faire dans une portion mangeable. Une suggestion est désormais une **portion**
> (plafonnée par la portion de référence de l'aliment, un tiers du budget calorique, écartée sous 25 % de
> couverture) et la carte **annonce son apport réel**. 50 portions manquantes ont été renseignées en base.
> **À recetter avec ce nouveau contrat en tête** : le critère 1 ne doit plus se lire « 3 aliments qui comblent
> l'écart » mais « 3 portions plausibles qui en rapprochent ». Les aliments **OpenFoodFacts scannés** restent
> à 200 g : ils n'ont pas de portion déclarée, c'est attendu.

- [ ] 1. Journée avec un manque de protéines net : la carte apparaît, 3 aliments plausibles.
- [ ] 2. Quantités **réalistes** — aucun « 900 g », aucun « 8 g ».
- [ ] 3. L'apport calorique de chaque suggestion est affiché.
- [ ] 4. Un tap ajoute l'entrée au journal, à la quantité annoncée.
- [ ] 5. Basculer sur un autre macro change les suggestions.
- [ ] 6. Journée en **dépassement calorique** : aucune carte, même avec un macro manquant.
- [ ] 7. Journée à l'équilibre (< 10 % d'écart) : aucune carte.
- [ ] 8. Un aliment récemment consommé est privilégié à densité comparable.
- [ ] 9. **La question ouverte** : les aliments **récents** suffisent-ils à produire des suggestions
      utiles ? Si « aucun aliment ne comble cet écart » revient souvent, c'est le signal qu'il faut
      ouvrir le repli sur la base CIQUAL (déféré volontairement pour raison de performance).
- [ ] 10. La limite « ne tient pas compte du régime déclaré » est visible.
- [ ] 11. Mode avion : la carte fonctionne à l'identique.

---

## 6. STREAK-01 — Joker de série

📄 [spec](docs/specs/functional/us/streak01-joker.md) · roadmap 7.14 · **📱 device**
✅ sync rules déployées (06/08/2026)

- [ ] 1. Manquer un jour, ouvrir l'app le lendemain : la proposition apparaît et **annonce le nombre
      de jours sauvés**.
- [ ] 2. Utiliser le joker : la série repart de sa valeur d'avant la rupture, **sans repasser par 0**.
- [ ] 3. Le mois même, manquer un autre jour : **plus de proposition**.
- [ ] 4. Manquer **deux jours d'affilée** : aucune proposition (interruption réelle).
- [ ] 5. Le jour couvert reste **vide** dans le journal et les statistiques — vérifier l'adhérence.
- [ ] 6. Au 1er du mois suivant, un joker est de nouveau disponible.
- [ ] 7. Mode avion : proposition et consommation OK, remontée au retour du réseau.
- [ ] 8. L'export RGPD contient les jokers consommés.

---

## 7. OBJ-01 — Objectifs personnels à échéance

📄 [spec](docs/specs/functional/us/obj01-objectifs.md) · roadmap 7.15 · **📱 device**
✅ sync rules déployées (06/08/2026)

- [ ] 1. Créer « 50 km d'ici 4 semaines » : l'anneau reflète les courses **déjà faites** dans la
      fenêtre (la fenêtre part d'aujourd'hui, donc l'anneau démarre à 0 si tu n'as pas couru depuis).
- [ ] 2. Créer « +5 kg au développé couché d'ici 8 semaines » : le 1RM de départ affiché est bien
      **celui du jour**, et il est annoncé avant validation.
- [ ] 3. Enregistrer une course puis revenir : la progression a **augmenté** sans aucune action.
- [ ] 4. Tenter un 4ᵉ objectif : le bouton est désactivé et le plafond est expliqué.
- [ ] 5. Tenter une cible de force **inférieure ou égale** au 1RM actuel : refus avec message.
- [ ] 6. Un objectif dont l'échéance est passée apparaît en « Terminés » avec son verdict.
- [ ] 7. Le verdict d'un objectif terminé **ne change pas** après un record hors fenêtre.
- [ ] 8. Le pourcentage **et** la valeur sont lisibles sans l'anneau, et les repères 25/50/75 % se
      voient sur l'anneau.
- [ ] 9. Mode avion : création et progression fonctionnent (tout le calcul est local).
- [ ] 10. Le widget d'accueil montre l'objectif le plus **urgent** (pas le plus avancé) ; il est
      **absent** si seul le pilier nutrition est activé.
- [ ] 11. L'export RGPD contient les objectifs.

> ✅ **Constat corrigé le 30/07/2026.** L'état vide affichait **deux fois** l'action « Nouvel
> objectif » (bouton du haut **et** CTA de l'`EmptyState`) — confirmé dans l'arbre d'accessibilité,
> `content-desc="Nouvel objectif"` × 2, donc annoncé deux fois par TalkBack. Le bouton du haut est
> désormais masqué tant que la liste est vide : c'est l'`EmptyState` qui porte l'action.
> **À vérifier en recette** : une seule action visible sur l'état vide, et le bouton du haut
> réapparaît dès le premier objectif créé.

---

## 8. BILAN-01 — Bilan hebdomadaire automatique

📄 [spec](docs/specs/functional/us/bilan01-bilan-hebdo.md) · roadmap 7.16 · **📱 device**
✅ **aucune sync rule à déployer** pour celle-ci — rien n'est stocké.

- [ ] 1. L'écran affiche les chiffres **de la semaine close** (lundi→dimanche précédents), avec ses
      dates, et la comparaison à la semaine d'avant.
- [ ] 2. **Une seule** décision est affichée, et les chiffres qui la justifient sont **à côté**.
- [ ] 3. Ajouter une séance dans la semaine close puis rouvrir : les chiffres suivent (tout est
      recalculé à l'affichage).
- [ ] 4. Semaine vide : **aucune notification**, mais l'écran s'ouvre sur un message de reprise.
- [ ] 5. Première semaine d'utilisation : **aucune comparaison** affichée (pas de « +100 % »).
- [ ] 6. Pilier nutrition désactivé : aucun chiffre nutritionnel, ni dans l'écran ni dans la décision.
- [ ] 7. Désactiver « Bilan hebdomadaire » dans les réglages : plus de notification, écran toujours
      accessible.
- [ ] 8. Régler l'heure du bilan **dans** la fenêtre Ne pas déranger (ex. 23 h) : **aucune
      notification**. C'est le comportement attendu, pas un bug — à vérifier explicitement.
- [ ] 9. Le widget d'accueil montre la décision **et** des chiffres, et ouvre l'écran.
- [ ] 10. Les variations sont lisibles **sans la couleur** (texte « en hausse de 12 % »).
- [ ] 11. Mode avion : tout fonctionne à l'identique.
- [ ] 12. TalkBack lit la décision puis ses chiffres.

⏳ **Le test qui demande de la patience** : la notification part **le lundi** à l'heure réglée. Pour
ne pas attendre, règle l'heure du bilan sur l'heure suivante un lundi — ou vérifie au moins que
désactiver/réactiver la préférence ne casse rien.

---

## 9. PARTAGE-01 — Carte de séance / course partageable

📄 [spec](docs/specs/functional/us/partage01-carte-partageable.md) · roadmap 7.17 · **📱 device**
✅ aucune sync rule · ✅ **recettable sur l'APK du 29/07/2026** — voir l'encadré en bas de page.
🎨 **Habillage revu le 30/07/2026** (bordeaux → thème sombre) : changement **JS pur**, aucune
dépendance native ajoutée → **le même APK reste valable**, un simple rechargement du bundle suffit.

- [ ] 1. Résumé d'une course GPS → « Partager » ouvre un aperçu **avec le tracé**.
- [ ] 2. Le tracé **ressemble au parcours réel** (comparer à la carte de l'écran de résumé) : ni
      miroir, ni écrasé, ni étiré. C'est le critère le plus important de cette US.
- [ ] 3. Second appui → feuille de partage, et l'image envoyée est **carrée et lisible**.
- [ ] 4. Course **sans GPS** (distance saisie à la main) : carte sans tracé, chiffres présents.
- [ ] 5. Résumé d'une séance muscu : carte avec exercices, séries, tonnage.
- [ ] 6. Séance **avec** record → le record apparaît ; séance **sans** record → **pas** de section vide.
- [ ] 7. En réglage **impérial** : miles / livres sur l'image.
- [ ] 8. Le nom de l'app est visible **sans dominer** l'image.
- [ ] 9. **Aucune donnée de santé** sur la carte : ni poids de corps, ni mensuration, ni bien-être.
- [ ] 10. En **EN** : les libellés imprimés **sur l'image** sont en anglais.
- [ ] 11. Mode avion : génération et partage fonctionnent (le tracé ne dépend d'aucune tuile).
- [ ] 12. TalkBack annonce le contenu chiffré de l'aperçu.
- [ ] 13. **Charte revue le 30/07/2026** — la carte est **sombre** (fond `#1c130c`, accent orange
      `#dd6e40`), plus bordeaux/doré. Le bloc records est posé sur un **cadre orangé translucide**.
- [ ] 14. **Le critère qui piège** : basculer l'app en thème **clair**, régénérer une carte → elle
      doit rester **identiquement sombre**. Une carte qui suivrait le thème de l'utilisateur serait
      un bug (les couleurs sont figées exprès, cf. CHANGELOG du 30/07/2026).

---

## 10. UX-05 — Intensité en RPE ou en RIR

📄 [spec](docs/specs/functional/us/ux05-rpe-ou-rir.md) · roadmap 3.55 · **📱 device**
✅ aucune sync rule · ✅ recettable sur **l'APK actuel** (aucune dépendance native ajoutée)

- [ ] 1. Réglages → **Échelle d'intensité** : les 2 choix, avec l'aide de l'échelle active.
- [ ] 2. En mode **RPE** : la saisie par série propose **1 → 10**, l'affichage dit « RPE 8 ».
- [ ] 3. En mode **RIR** : la saisie propose **0 → 9**, l'affichage dit « RIR 2 » pour la même série.
- [ ] 4. **Le test qui compte** : saisir une série à RPE 8, basculer en RIR → « RIR 2 ». Rebasculer en
      RPE → « RPE 8 ». **Aucune donnée n'a bougé.**
- [ ] 5. Une série **sans** intensité reste sans intensité dans les deux modes (pas de « RIR 10 »).
- [ ] 6. L'historique détaillé d'une séance affiche l'échelle choisie.
- [ ] 7. Le **ressenti de séance** (5 étoiles) et le **ressenti de course** sont **inchangés** — c'est
      volontaire, à vérifier explicitement.
- [ ] 8. En **EN** : « RIR » et son aide sont en anglais.
- [ ] 9. Mode avion : le changement s'applique tout de suite, et remonte au retour du réseau.

⚠️ La saisie du RPE/RIR par série n'apparaît qu'au niveau d'affichage **« detailed »** (MUSC-F13) : si
tu ne vois pas le bouton, vérifie ce réglage d'abord.

---

## 11. MUSC-F14 — Suggestion de substitution d'exercice

📄 [spec](docs/specs/functional/us/muscf14-substitution-exercice.md) · roadmap 3.52 · **📱 device**
✅ aucune sync rule · ✅ recettable sur **l'APK actuel**

- [ ] 1. En séance, « Remplacer » sur un exercice : une section **Suggestions** apparaît au-dessus de
      la liste, avec **au plus 4** propositions.
- [ ] 2. Toutes travaillent le **même groupe musculaire** (sauf variante déclarée).
- [ ] 3. Une **variante déclarée** apparaît **en premier**, marquée « Variante ».
- [ ] 4. Les autres portent leur **matériel** en justification (« Machine guidée »).
- [ ] 5. Taper une suggestion **remplace** l'exercice, comme depuis la liste complète.
- [ ] 6. Un exercice **déjà dans la séance** n'est jamais suggéré.
- [ ] 7. Exercice sans alternative du même groupe : **aucune section** (et non une section vide).
- [ ] 8. **Aucune mention de douleur, blessure ou articulation** nulle part — c'est volontaire.

🟠 **Une décision t'attend** : l'éditeur de programme n'a **pas de parcours « remplacer »**, donc les
suggestions n'y ont pas de source. Soit on ajoute le remplacement dans l'éditeur (US à part), soit on
en reste là — voir [spec §0.2](docs/specs/functional/us/muscf14-substitution-exercice.md).

---

## 12. UX-LOT-01 — Lot de finitions

📄 [spec](docs/specs/functional/us/uxlot01-finitions-recette.md) · roadmap 3.53, 3.54, 7.18 ·
**📱 device**

- [ ] 1. Exercice **perso sans instructions** : les 3 sections sont présentes, les vides affichent
      « Non renseigné ».
- [ ] 2. Exercice **de bibliothèque** : même structure, valeurs réelles.
- [ ] 3. Modifier un exercice perso permet toujours de saisir instructions et muscles secondaires.
- [ ] 4. Modifier / Supprimer restent **absents** sur un exercice de bibliothèque.
- [ ] 5. Mode édition du dashboard : la **poignée** est visible sur chaque carte, l'indice de geste
      s'affiche dans le bandeau.
- [ ] 6. Les chips afficher/masquer et changer-de-forme se tapent **sans viser** (cible 48 dp).
- [ ] 7. L'appui long déplace toujours la carte, le glissement conserve son retour visuel.
- [ ] 8. En **EN**, les deux nouvelles chaînes sont traduites.

---

## 13. NUTR-F1 — Rappels programmés nutrition (repas + pesée)

📄 [spec](docs/specs/functional/us/nutrf1-rappels-nutrition.md) · roadmap 1.14 + 2.5 ·
**📱 device** (13 critères) · **aucun nouveau build nécessaire** (`expo-notifications` était déjà là)

> ⚠️ **Un critère exige un build release** (le premier, marqué 🔴). Le bug qu'il vérifie est masqué
> en dev par le cache de React Compiler. Si tu recettes sur le dev build, note-le comme **non
> vérifié** plutôt que comme passé.

> ⏱️ **Cette recette demande de la patience ou de la triche.** Les rappels partent à une heure de la
> journée. Pour ne pas attendre 13 h, coupe « Caler sur mes habitudes » et règle l'heure au stepper
> **une heure après l'heure courante** — le rappel se planifie à l'ouverture suivante de l'app.
> Rappelle-toi qu'une échéance **déjà passée** ne planifie rien (c'est voulu, décision D7).

- [ ] **Les deux rappels sont éteints à l'ouverture des réglages.** C'est l'opt-in : une mise à jour
      ne doit pas se mettre à notifier quelqu'un qui n'a rien demandé.
- [ ] **Rappel de repas** activé, journal du jour vide → notification reçue à l'heure attendue,
      titre « Ton journal est encore vide ».
- [ ] **Logger un repas annule le rappel en attente.** Vérifiable en rouvrant l'app puis en
      attendant l'heure : rien ne doit arriver.
- [ ] **Rappel de pesée** activé, aucune pesée du jour → notification reçue, titre « Pas encore de
      pesée aujourd'hui ». Puis saisir une pesée → plus rien pour la journée.
- [ ] 🔴 **Le rappel repart bien le lendemain** (décision D9, bug bloquant trouvé en revue) : logger
      un repas le soir, laisser l'app en arrière-plan **sans la tuer**, revenir le lendemain matin →
      le rappel doit se reprogrammer. ⚠️ **Observable uniquement en build release** : en dev, le cache
      de React Compiler est réinitialisé à chaque sauvegarde, ce qui masque le défaut. C'est le
      critère le plus important de cette recette.
- [ ] **Ouvrir l'app APRÈS l'échéance ne déclenche aucune notification.** C'est le critère qui
      vérifie la décision D7 : on ne notifie pas quelqu'un qui est déjà dans l'app.
- [ ] **Ouvrir l'app MOINS DE 15 MIN avant l'échéance ne déclenche rien non plus** (D8) : régler
      l'heure au stepper à l'heure courante + 1, ouvrir l'app dans le dernier quart d'heure → aucune
      notification. Sans cette marge, elle arrivait pendant qu'on remplissait le journal.
- [ ] **« Caler sur mes habitudes » actif** : sous chaque rappel, la ligne de provenance s'affiche
      (« D'après tes habitudes : 13:00 » ou « Pas encore assez d'historique — 13:00 en attendant »),
      et les steppers sont **grisés et inertes**.
- [ ] **« Caler sur mes habitudes » coupé** : le stepper reprend la main, effet immédiat sans
      redémarrage.
- [ ] **Heure apprise tombant dans le « Ne pas déranger »** → le rappel arrive à l'heure
      **rabattue** (pas dans la nuit, et pas jamais), et la ligne le dit : « — décalé avant ta plage
      Ne pas déranger ». *Mise en condition : régler la fenêtre DND pour qu'elle englobe l'heure
      apprise affichée.*
- [ ] **Heure réglée à la main dans la fenêtre DND** → **aucun rappel**, et l'avertissement
      « ⚠️ Cette heure est dans ta plage Ne pas déranger… » est affiché sous la ligne.
- [ ] **Le hint de section ne promet plus « max 3 notifications par jour »** mais « Au plus un
      rappel par type et par jour ».
- [ ] **Parité FR/EN** : basculer la langue et revérifier les 3 nouveaux libellés, les lignes de
      provenance et le **contenu des notifications**. ⚠️ Un rappel **déjà posé** garde la langue
      d'alors (limite connue, déjà vraie pour le streak) — reposer le rappel après la bascule.

**Le rappel n'arrive pas ?** Dans l'ordre : notifications autorisées au niveau système (le bandeau
des réglages le dit) · le rappel est-il activé · le geste n'est-il pas **déjà fait** aujourd'hui ·
l'heure effective (ligne de provenance) est-elle bien **dans le futur** · l'heure n'est-elle pas dans
le DND avec un réglage manuel. Ces cinq refus sont exactement les `reason` de la règle métier.

---

## 14. MUSC-F8 — Notifications muscu (push de record, célébration, rappel de séance)

📄 [spec](docs/specs/functional/us/muscf8-notifications-muscu.md) · roadmap 3.42 + 2.7 + 2.4 ·
**📱 device** (10 critères) · **aucun nouveau build nécessaire**

- [ ] **Séance sur des exercices neufs → une seule notification.** Termine une séance de plusieurs
      exercices jamais travaillés (donc plusieurs records par exercice) → une **seule** notification
      de record, pas une par ligne battue.
- [ ] **3 types battus sur un seul exercice → titre au singulier** (« Nouveau record ! »), pas
      « records battus sur 1 exercice ».
- [ ] **4 exercices ou plus → 3 nommés + « et N autres »** dans le corps de la notification.
- [ ] **La célébration animée apparaît au résumé de séance** quand il y a un record — juste après le
      titre de l'écran, pas plus bas — et **pas du tout** sinon.
- [ ] Réglage système « **réduire les animations** » actif → la bannière s'affiche directement à son
      état final, sans transition.
- [ ] **Désactiver « Nouveau record »** dans les réglages → plus aucune notification de record ;
      l'animation du résumé, elle, reste (elle est indépendante).
- [ ] **4 séances à record le même jour → 3 notifications**, la 4ᵉ silencieuse (plafond).
- [ ] **Deux séances à record le même jour → 2 notifications distinctes** dans le tiroir (contrairement
      aux autres rappels, celui-ci n'efface pas la précédente — c'est voulu, D10).
- [ ] **Rappel de séance** : une occurrence muscu planifiée aujourd'hui, non faite → notification à
      l'échéance affichée dans les réglages ; la valider (terminer la séance) **annule** le rappel.
- [ ] **Aucune séance muscu planifiée aujourd'hui** (y compris s'il n'y a qu'une **course** planifiée)
      → **aucun** rappel de séance.

⚠️ **Point à surveiller en priorité** : le push de record part **même si l'app est au premier
plan**, donc il arrive alors que l'écran de résumé affiche déjà les mêmes records (décision D11,
assumée mais contestable — voir la spec). Si ça gêne à l'usage, c'est le premier réglage à
reconsidérer, pas un bug.

**Quand une US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 15. CYCLE-01 — Suivi du cycle menstruel (journal, prédiction, croisement, Health Connect)

📄 [spec](docs/specs/functional/us/cycle01-suivi-menstruel.md) · roadmap 1.25 + 1.26 ·
**📱 device** (20 critères, §7 de la spec) · **nouveau build probablement nécessaire** (voir
prérequis ci-dessous)

✅ **Prérequis levé le 06/08/2026** : les sync rules PowerSync couvrant `menstrual_periods` et
`menstrual_daily_logs` (ajoutées le 30/07/2026) sont **déployées** — confirmé par Florian. Ce bloc
signalait jusqu'ici qu'aucune confirmation n'existait ; elle existe. Le dashboard
PowerSync — seul le fichier [powersync-sync-rules.yaml](docs/specs/technical/powersync-sync-rules.yaml)
les contient. Sans ce déploiement, le suivi du cycle **ne se synchronise jamais entre appareils**,
sans erreur visible. Vérifier avec Florian/Damien avant de recetter, et cocher ici une fois fait :

- [ ] Sync rules PowerSync (menstrual_periods, menstrual_daily_logs) confirmées déployées.

⚠️ **Le build actuel embarque-t-il les permissions Health Connect du cycle ?** `app.json` déclare
`READ_MENSTRUATION`/`WRITE_MENSTRUATION`, mais Android **exige** qu'une permission figure dans le
manifest **au moment du build** pour qu'elle soit demandable à l'exécution. Si l'écran système de
demande de permissions (interrupteur « Synchroniser avec Health Connect » dans Réglages) n'affiche
pas les deux types Menstruation, ou si `requestCyclePermissions()` échoue silencieusement : le dev
build est antérieur à ces lignes → `npx expo prebuild --platform android --clean` puis un nouveau
build (même piège que documenté plus bas pour PARTAGE-01).

> ✅ **Deux bloquants levés le 01/08/2026** (passe device automatisée). (a) Le suivi était **impossible à
> activer** : les colonnes `cycle_tracking_enabled` / `cycle_health_connect_enabled` manquaient au schéma
> PowerSync local, l'écriture échouait et l'erreur était avalée — l'interrupteur ne bougeait pas, sans message.
> (b) Les routes `wellness://cycle` et `/cycle/insights` s'ouvraient **entièrement** suivi éteint (critère 1),
> désormais fermées par un garde. **Le manifest embarque bien les 2 permissions Menstruation** après un
> `prebuild --clean` — le dossier `android/` local était antérieur à l'US, exactement le piège documenté en bas
> de page. **Déjà vérifiés automatiquement** : 1, 1 bis, 2, 6 (R8), 10 (R13), 13 (R17), 16 partiel (les 2
> interrupteurs apparaissent). **Non testé** : Health Connect de bout en bout (permissions système à valider
> à la main).

- [ ] 1. Réglage **désactivé par défaut** : aucun widget, aucune route atteignable, aucune trace.
- [ ] 1 bis. **La barre du bas n'a PAS gagné d'onglet** (R16 bis).
- [ ] 1 ter. Widget `cycle` disponible dans les **3 formes** du dashboard.
- [ ] 2. Activation → saisir un début de règles → il apparaît au calendrier.
- [ ] 3. Saisir un **nouveau début** sans avoir clos le précédent → l'ancien se clôt tout seul (R2).
- [ ] 4. Période laissée ouverte **16 jours** → close automatiquement et signalée (R3).
- [ ] 5. Saisie **rétroactive** d'un cycle d'il y a 3 mois : acceptée (R4). Date **future** : refusée.
- [ ] 6. Avec **2 cycles** : aucune prédiction, message « encore 1 cycle » (R8).
- [ ] 7. Avec **3 cycles réguliers** : date estimée **avec sa fourchette ±** (R9).
- [ ] 8. Avec 3 cycles **très irréguliers** (écart-type > 7 j) : **pas de date**, explication (R10).
- [ ] 9. Un cycle de 120 jours dans l'historique : **exclu** de la moyenne, **toujours visible** (R6).
- [ ] 10. Onglet croisement (`/cycle/insights`) avec peu de données : dit ce qui manque (R13).
- [ ] 11. Croisement nourri, **6 métriques** (énergie, humeur, stress, tonnage, kcal, allure) :
      moyennes par phase affichées **sans une seule formule causale** (R14).
- [ ] 12. **Export RGPD** : les deux tables sont dans le JSON exporté (R18).
- [ ] 13. Désactiver le suivi → la suppression des données est **proposée** explicitement (R17).
- [ ] 14. 🔴 **Le critère qui prime sur tous les autres** : relire chaque écran et chaque chaîne, FR
      et EN, en cherchant tout ce qui pourrait se lire comme un **conseil médical, une garantie de
      fiabilité ou une aide à la contraception**. Une seule formulation ambiguë = **rejet**.
- [ ] 15. **Mode avion** : saisie, prédiction et croisement fonctionnent intégralement.
- [ ] 16. **Health Connect** : activer la synchro (Réglages → Suivi du cycle → interrupteur dédié) →
      les permissions système s'affichent pour les 2 types Menstruation ; une période **close**
      saisie dans Wellness apparaît dans une autre app santé (ou le hub Health Connect) ; une
      période créée dans le hub apparaît dans Wellness au retour au premier plan (throttle 6 h,
      ou en forçant via le débogage) ; une **saisie manuelle n'est jamais écrasée** par un import
      (R21) — modifier la date de fin d'une période saisie à la main dans le hub ne doit **rien**
      changer côté Wellness.
- [ ] 17. Health Connect **refusé** ou indisponible : le journal fonctionne normalement, sans erreur
      (couper la permission système en cours de route ne doit rien casser, juste arrêter la synchro).
- [ ] 18. **Aucune notification** n'est jamais émise par cette fonctionnalité (R11).
- [ ] 19. Carte partageable d'une séance : **aucune** mention du cycle (R19).
- [ ] 20. En **EN** : phases, flux, symptômes et avertissement sont en anglais **relu**, pas traduits
      mot à mot.

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 16. MUSC-F7 — Deload sur stagnation

📄 [spec](docs/specs/functional/us/muscf7-progression-assistee.md) · roadmap 3.8 · **📱 device**
✅ aucune migration, aucune sync rule · ✅ recettable sur **l'APK actuel** (aucune UI nouvelle)

- [ ] 1. Deux séances d'affilée en échec (ou RPE ≥ 8) sur le **même exercice** → à la 3ᵉ, la
      suggestion affichée est « 2 séances difficiles de suite — tu peux alléger à X kg ».
- [ ] 2. Une seule séance difficile (la précédente était correcte) → **aucune** suggestion de deload.
- [ ] 3. Exercice au poids du corps (pas de charge) → jamais de deload, même après 2 séances
      difficiles de suite.
- [ ] 4. La suggestion reste **une proposition** : rien ne pré-remplit la série à la baisse
      automatiquement (même comportement que les autres suggestions de progression).

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 17. CONF-07 — Accessibilité : contraste WCAG AA

📄 [spec](docs/specs/functional/us/conf07-accessibilite.md) · roadmap 9.11 + 9.12 · **📱 device**
✅ aucune migration, aucune sync rule · ✅ recettable sur **l'APK actuel** (diff = 4 constantes couleur)

⚠️ **Le vrai test est visuel, pas fonctionnel** — la palette a changé, rien d'autre.

- [ ] 1. **Thème sombre, écran avec un bouton plein** (« Démarrer la séance ») : le libellé est
      lisible sans effort (D1 — le changement le plus visible de cette US, blanc → brun foncé).
- [ ] 2. Thème **clair**, dashboard : le message d'alerte de volume/déficit se lit sans forcer.
- [ ] 3. Thème **clair**, nutrition : la barre **glucides** (ambre) se distingue du fond crème.
- [ ] 4. Thème **clair**, écran Pas : « Objectif atteint » en vert se lit sans forcer.
- [ ] 5. Thème **clair**, création de compte : le message de succès se lit sans forcer.
- [ ] 6. **Le test qui compte** : l'app ne paraît **pas** plus terne. Si l'identité chaude a viré au
      boueux, c'est un rejet — même si les ratios sont techniquement bons.
- [ ] 7. Les **graphes** n'ont pas noirci (`chartGreen` n'a volontairement pas bougé).
- [ ] 8. `font_scale` 1,5× sur 3 écrans au hasard : toujours aucune troncature (non-régression 9.11).

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 18. RUN-F3 — Résumé de course enrichi (objectif atteint + terrain)

📄 [spec](docs/specs/functional/us/runf3-resume-course-enrichi.md) · roadmap 5.24 (D3) + 5.25 ·
**📱 device** · migration poussée, **aucune sync rule à redéployer** (`runs` déjà en `select *`)

⚠️ **Le point à vérifier en priorité** : le lien course↔séance planifiée est **neuf** (rien
n'existait avant cette US) — démarrer une course *sans* passer par la carte « Course planifiée
aujourd'hui » doit rester un comportement parfaitement normal (course libre, R1).

- [ ] 1. Depuis le hub course, une séance planifiée aujourd'hui affiche la carte **« Course
      planifiée aujourd'hui »** avec sa cible (distance et/ou durée) — pas si aucune séance
      planifiée ce jour, ou si elle est `done`/`skipped`.
- [ ] 2. Démarrer cette course, la terminer, réussir la cible (dans la tolérance de 2 %) → le
      résumé affiche « objectif atteint ».
- [ ] 3. Même parcours, distance nettement sous la cible → écart affiché **sans rouge ni « raté »**
      (R4) — ton neutre.
- [ ] 4. Dépasser nettement la cible → « objectif dépassé de X » (R2, phrase en clair, pas juste un %).
- [ ] 5. Une séance ne visant qu'une **durée** → seule la durée est comparée, aucune ligne distance
      (R3).
- [ ] 6. **Course libre** (bouton « Démarrer une course libre », pas depuis la carte planifiée) →
      résumé strictement inchangé, **aucun encart objectif** (R1).
- [ ] 7. Réglage **impérial** → miles, tolérance inchangée (R6).
- [ ] 8. **Terrain** (D3) : sélecteur à 4 choix sur le résumé, facultatif, persistant (visible en
      rouvrant le résumé/l'historique).
- [ ] 9. **Mode avion** : comparaison à l'objectif et sélecteur de terrain fonctionnent
      normalement (aucun réseau requis).
- [ ] 10. En **EN** : les phrases d'écart sont grammaticales (« exceeded by », pas de mots collés).

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 19. MUSC-F9 — Décalage d'une séance planifiée en glisser-déposer

📄 [spec](docs/specs/functional/us/muscf9-planning-glisser-deposer.md) · roadmap 3.10 ·
**📱 device — ⚠️ nouveau dev build requis** (`expo-haptics`, dépendance native neuve non présente
sur l'APK existant), aucune migration, aucune sync rule.

⚠️ **Le point à vérifier en priorité** : la **cohabitation de trois gestes** sur la même surface
(défilement vertical, changement de semaine, glissement) — critère 10.

- [ ] 1. Appui long sur une séance `planned` → elle « décolle » visuellement.
- [ ] 2. La déposer sur un autre jour de la semaine → elle s'y affiche immédiatement.
- [ ] 3. Fermer puis rouvrir l'app → **le déplacement a tenu**.
- [ ] 4. Déposer une séance sur son propre jour → **rien ne se passe**, aucun toast.
- [ ] 5. Relâcher en dehors de tout jour → retour à la place d'origine, aucune écriture.
- [ ] 6. Une séance **terminée** ne se saisit pas.
- [ ] 7. Deux séances sur le même jour cible : les deux s'affichent, aucune n'est perdue.
- [ ] 8. **Mode avion** : le déplacement s'affiche tout de suite ; réseau rétabli → il remonte.
- [ ] 9. **TalkBack actif** : les trois boutons de report restent atteignables et fonctionnels.
- [ ] 10. Le **défilement vertical** de l'écran fonctionne toujours normalement (le geste de
      glissement ne doit pas l'avoir capturé).
- [ ] 11. En **EN** : l'indice et le toast sont en anglais.

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 20. MUSC-F1b — Muscles ciblés sur schéma corporel (anatomie fine, Voie B)

📄 [spec](docs/specs/functional/us/muscf1b-schema-muscles.md) · roadmap 6.2 ·
**📱 device** · migration poussée (`exercises.muscles_fine`), **aucune sync rule à redéployer**
(`exercises` déjà en `select *`), **aucune dépendance native neuve** (`react-native-svg` déjà
présent) → recettable sur l'APK existant.

⚠️ **Le critère qui juge tout le reste** (12) : montrer les deux vues (face/dos) à quelqu'un qui
connaît l'anatomie. Un rejet renvoie au dessin (maquette), pas au modèle de données.

- [ ] 1. Fiche d'un exercice **non tagué fin** (les 16 actuels, au départ) : repli large identique
      au comportement d'avant cette US (primaire plein, secondaires à ~35 %).
- [ ] 2. Depuis l'admin, tague un exercice (ex. Curl biceps → `biceps`) : sa fiche mobile affiche
      **seulement** biceps, plus le triceps qu'affichait le repli large.
- [ ] 3. Fiche d'un exercice sans secondaire : un seul muscle éclairé, aucun résidu.
- [ ] 4. Aperçu d'une séance mêlant exercices tagués et non tagués : l'union se fait correctement
      dans les deux cas, sans doublon d'émphase.
- [ ] 5. Bilan hebdo : le muscle le plus travaillé (par tonnage agrégé) est le plus marqué.
- [ ] 6. Semaine sans séance muscu : silhouette neutre sur le bilan, pas d'écran cassé.
- [ ] 7. Vue de dos atteignable et correcte (6 des 10 muscles n'existent que là).
- [ ] 8. Thème clair et sombre : la silhouette reste lisible dans les deux.
- [ ] 9. TalkBack énonce les muscles sollicités ; la liste textuelle reste affichée à côté.
- [ ] 10. Mode avion : le schéma s'affiche (aucune ressource distante, tracés en dur).
- [ ] 11. En EN : « Front »/« Back », les 10 noms de muscles et l'annonce d'accessibilité sont en
      anglais.
- [ ] 12. 🔴 **Montrer les deux vues à quelqu'un qui connaît l'anatomie.** S'il dit « ça ne
      ressemble pas à des biceps » ou « je ne distingue pas quadriceps et ischio-jambiers », c'est
      un rejet — retour au dessin, pas au modèle de données.
- [ ] 13. Écran admin : les 10 checkboxes « Muscles fins » sont groupées par région (Haut du
      corps / Bas du corps / Tronc), pas un mur en vrac.

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 21. RUN-14 — Prédiction de temps de course (formule de Riegel)

📄 [spec](docs/specs/functional/us/run14-prediction-riegel.md) · roadmap 5.34 ·
**📱 device** · aucune migration, aucune dépendance native → recettable sur l'APK existant.

- [ ] 1. Un coureur avec un record 5 km et aucun autre record → 3 prédictions (10 km, semi,
      marathon), chacune avec sa source visible (« D'après ton 5 km du … »).
- [ ] 2. Un coureur avec un record 5 km **et** un record semi réel → la prédiction semi **ne
      s'affiche pas** ; 10 km et marathon estimés restent affichés (R3).
- [ ] 3. Un coureur sans aucun record 5 km (ex. n'a couru que du 1 km) → bloc vide explicite, pas de
      calcul, pas d'écran cassé (R1).
- [ ] 4. La prédiction marathon affiche l'avertissement dédié (R5) ; 10 km et semi n'en ont pas.
- [ ] 5. Battre son record 5 km met à jour les 3 prédictions au prochain affichage (recalcul à la
      lecture, pas de valeur mise en cache périmée).
- [ ] 6. **Mode avion** : le bloc s'affiche normalement (aucun réseau requis).
- [ ] 7. Réglage **impérial** : les temps s'affichent identiques (la formule ne dépend pas de
      l'unité).
- [ ] 8. En **EN** : toutes les phrases (source, avertissement, état vide) sont grammaticales.
- [ ] 9. TalkBack énonce chaque ligne comme un bloc cohérent (distance + temps + source), pas des
      fragments disjoints.

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 22. NUTR-16 — Répartition calorique par repas

📄 [spec](docs/specs/functional/us/nutr16-repartition-calorique-repas.md) · roadmap 4.38 ·
**📱 device** · aucune migration, aucune dépendance native → recettable sur l'APK existant.

- [ ] 1. Journal avec les 4 repas par défaut renseignés → 4 lignes, part (%) + moyenne (kcal/j),
      dans l'ordre petit-déj/déjeuner/dîner/collation.
- [ ] 2. Un repas personnalisé renommé (ex. « Brunch ») → sa ligne affiche le libellé personnalisé,
      pas sa clé technique.
- [ ] 3. Des entrées existent sous un repas depuis supprimé de la config → elles apparaissent sous
      « Autres », pas perdues, pas sous leur ancienne clé technique.
- [ ] 4. La somme des parts (%) des repas affichés ≈ 100 % (à l'arrondi près).
- [ ] 5. Bascule 7 j ↔ 30 j (toggle existant) → les deux métriques se recalculent pour chaque repas.
- [ ] 6. Aucune entrée dans la fenêtre → état vide, pas de graphique à zéro ni d'erreur.
- [ ] 7. **Mode avion** : le bloc s'affiche normalement (aucun réseau requis).
- [ ] 8. En **EN** : la phrase part/moyenne est grammaticale dans l'ordre anglais.
- [ ] 9. TalkBack énonce chaque ligne comme un bloc cohérent, pas des fragments disjoints.

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 23. MUSC-09 — Record personnel par plage de répétitions

📄 [spec](docs/specs/functional/us/musc09-record-plage-reps.md) · roadmap 3.56 ·
**📱 device** · aucune migration, aucune dépendance native → recettable sur l'APK existant.

- [ ] 1. Un exercice avec des séries loggées à 1, 5 et 10 reps (charges différentes) → 3 lignes,
      dans l'ordre 1 → 5 → 10, chacune avec sa charge et sa date.
- [ ] 2. Une plage jamais travaillée pour cet exercice → **absente** du tableau, pas une ligne à
      0 kg.
- [ ] 3. Aucune série éligible pour cet exercice → état vide explicite, pas de tableau cassé.
- [ ] 4. Une série d'échauffement (`warmup`) à charge élevée n'apparaît **dans aucune** plage.
- [ ] 5. Deux séries à charge égale dans la même plage → la plus récente est celle affichée.
- [ ] 6. **Mode avion** : le tableau s'affiche normalement (aucun réseau requis).
- [ ] 7. En **EN** : les 6 libellés de plage et l'état vide sont grammaticaux.
- [ ] 8. TalkBack énonce chaque ligne comme un bloc cohérent, pas des fragments disjoints.

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 24. RUN-F2c — Blocs fractionné / intervalles

📄 [spec](docs/specs/functional/us/runf2c-blocs-fractionne.md) · roadmap 5.9 ·
**📱 device + 🌐 navigateur (admin)** · migration poussée (nouvelle table `session_intervals`)

✅ **Prérequis levé le 06/08/2026** : `session_intervals` est une **table neuve** (contrairement aux
3 précédentes de la famille RUN-F2, qui n'ajoutaient que des colonnes à des tables déjà publiées) et
exigeait ses **deux propres lignes** de sync rule — buckets `user_data` **et** `shared_content`. Elles
sont écrites dans [powersync-sync-rules.yaml](docs/specs/technical/powersync-sync-rules.yaml) **et
déployées** (confirmé par Florian). Cette US n'est plus bloquée que par son build.
Sans ce déploiement, les blocs créés **ne synchroniseraient jamais**, sans erreur visible — c'est
exactement le piège déjà rencontré une fois sur CYCLE-01. Vérifier avec Florian/Damien avant de
recetter, et cocher ici une fois fait :

- [ ] Sync rules PowerSync (`session_intervals`, owner + éditorial) confirmées déployées.

- [ ] 1. Ajouter un bloc « 6×400 m, 95 % VMA, récup 200 m » à une séance fractionné (mobile ou
      admin), le retrouver affiché correctement sur l'écran de détail du programme.
- [ ] 2. Un bloc échauffement (reps=1, distance seule, pas de %VMA, pas de récup) s'affiche sans
      ligne d'allure ni de récup vide.
- [ ] 3. Changer le type de séance de fractionné vers endurance masque les blocs sans les
      supprimer ; revenir à fractionné les fait réapparaître intacts (R5).
- [ ] 4. Réordonner les blocs dans l'admin persiste l'ordre ; l'app mobile affiche le nouvel ordre
      sans permettre de le modifier elle-même (R6, pas de réordonnancement mobile).
- [ ] 5. Supprimer un bloc côté mobile ou admin ne supprime pas les autres blocs de la même séance.
- [ ] 6. **Mode avion** : ajout/édition/suppression de blocs fonctionne normalement côté mobile.
- [ ] 7. En **EN** : les gabarits de résumé de bloc (avec/sans allure, avec/sans récup) sont tous
      grammaticaux.
- [ ] 8. TalkBack énonce chaque bloc comme un ensemble cohérent.
- [ ] 9. Dupliquer un programme running contenant une séance fractionné avec des blocs : la copie
      a bien les **mêmes blocs** (cascade `duplicateProgram`, trouvée en préparant le plan, pas
      dans la spec initiale).

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 25. RUN-F2d — Guidage fractionné vocal

📄 [spec](docs/specs/functional/us/runf2d-guidage-fractionne-vocal.md) · roadmap 5.18 ·
**📱 device** · migration poussée (colonnes additives), ✅ **aucune sync rule à déployer**
(contrairement à RUN-F2c) — dernier candidat de la famille RUN-F2, tous ses prérequis livrés.
⚠️ **Précision ajoutée le 06/08/2026** : sa spec dit « aucun nouveau build », ce qui est vrai
**relativement à RUN-F2a** — mais `interval-guidance.ts` importe bien `expo-speech`. Cette US exige
donc, comme la §36, un **APK postérieur au 02/08/2026** ; sur un APK plus ancien, le guidage est
muet **sans erreur**. Voir « Comment procéder » en bas de page.

⚠️ **Le point à vérifier en priorité** : le rattrapage silencieux après un changement d'onglet en
cours de séance (critère 4 bis) — c'est le point le plus délicat de cette US, celui qu'une
relecture de spec a identifié comme absent de la première version.

- [ ] 1. Séance fractionné avec un bloc « 6×400 m à 95 % VMA, récup 200 m », guidage activé,
      course GPS : une annonce + une vibration à **chaque** passage rapide↔récup (12 transitions
      pour ce bloc), pas seulement 2 fois.
- [ ] 2. La toute première annonce (phase 0) part **au démarrage de la course**, avant tout mètre
      parcouru.
- [ ] 3. Un bloc échauffement sans récup (reps=1, distance seule) : une seule transition vers la
      phase suivante, sans annonce de récupération fantôme.
- [ ] 4. **Changer d'onglet puis revenir** (carte « Reprendre ») en cours de séance ne redémarre
      pas la séquence de phases à 0 — la phase courante correspond à la progression réelle.
- [ ] 4 bis. **Changer d'onglet pendant une durée qui couvre plusieurs phases** (ex. tout un
      rapide + sa récup), puis revenir : aucune rafale d'annonces des phases sautées, seule la
      phase réellement en cours au retour est annoncée une fois.
- [ ] 4 ter. Une séance avec **au moins 2 blocs** (échauffement puis série principale) : la
      transition à la frontière des deux blocs est annoncée normalement, sans saut ni doublon.
- [ ] 5. Séance **fractionné sans bloc défini** : aucune annonce ni vibration liée à cette US.
- [ ] 6. **Course libre** (sans séance planifiée) : aucune annonce ni vibration liée à cette US.
- [ ] 7. **Mode manuel (sans GPS)** : aucune annonce ni vibration liée à cette US, même sur une
      séance fractionné structurée.
- [ ] 8. Le réglage est **désactivé par défaut** et indépendant de celui de RUN-F2a (activer l'un
      sans l'autre fonctionne).
- [ ] 9. La dernière phase franchie déclenche une annonce de fin de séance distincte.
- [ ] 10. **Mode avion** : guidage complet (annonce + vibration) fonctionne normalement.
- [ ] 11. En **EN** : les gabarits de phase rapide/récup/fin sont tous grammaticaux, y compris au
      pluriel des comptages.
- [ ] 12. Une durée de récupération courte (ex. 30 s) est annoncée **en secondes**, pas arrondie à
      « 0 minute » ou « 1 minute ».

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 26. ACTIV-01 — Parcours « 7 jours pour démarrer »

📄 [spec](docs/specs/functional/us/activ01-parcours-7-jours.md) · roadmap 1.27 ·
**📱 device** · migration poussée (colonne additive), ✅ **aucune sync rule à déployer**,
✅ aucune dépendance native — recettable sur l'APK existant.

⚠️ **Le contenu des 7 jours est un brouillon** (spec R6) — avant de cocher les critères de
contenu (11), relire les 7 titres/descriptions/CTA et les corriger si besoin plutôt que de juger
l'US sur des mots qui ne sont pas encore les bons.

- [ ] 1. Onboarding terminé aujourd'hui → le widget d'accueil affiche « Jour 1 sur 7 », ciblé sur
      le pilier prioritaire actif (muscu＞running＞nutrition).
- [ ] 2. Le lendemain (ou date système avancée) → « Jour 2 sur 7 », contenu universel.
- [ ] 3. Sauter un jour sans ouvrir l'app puis rouvrir affiche le **jour calendaire réel**, pas le
      jour suivant celui vu en dernier (aucun rattrapage).
- [ ] 4. Faire l'action suggérée (ex. une séance) fait apparaître la coche « Déjà fait ! » sur le
      jour concerné, sans changer le jour affiché.
- [ ] 5. Un seul pilier actif (ex. nutrition seule) : les jours 3 et 5 basculent sur leur variante
      universelle plutôt que de cibler un pilier absent.
- [ ] 6. Désactiver un pilier au jour 3 (Réglages) change immédiatement le contenu proposé si ce
      jour cible ce pilier — pas d'instantané figé à l'inscription.
- [ ] 7. Bouton « Passer » : le widget disparaît immédiatement, **sans laisser de trou** dans la
      grille du tableau de bord, et ne réapparaît pas même avant le jour 7.
- [ ] 8. Au jour 8 (ou après), le widget a disparu de lui-même, **sans trou dans la grille**
      (point technique le plus sensible de cette US — voir spec R4).
- [ ] 9. Rejouer l'onboarding (Réglages) puis le reterminer relance un parcours neuf au jour 1.
- [ ] 10. **Mode avion** : le widget, sa progression et le dismiss fonctionnent normalement.
- [ ] 11. **Contenu** : les 7 titres/descriptions/CTA se lisent bien en FR et en EN — c'est le
      critère qui compte le plus vu le statut brouillon (spec R6).
- [ ] 12. TalkBack annonce le widget comme un seul bloc cohérent (jour + contenu + état).

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 27. LAUNCHER-01 — Widget écran d'accueil Android

📄 [spec](docs/specs/functional/us/launcher01-widget-ecran-accueil.md) · roadmap 7.19 ·
**📱 device** · ✅ aucune sync rule (aucune nouvelle table/colonne) · ⚠️ **dépendance native
neuve** (`react-native-android-widget`) — **build dédié déjà réalisé** (spike de compatibilité
SDK 57/New Architecture confirmé), donc recettable directement sur cet APK, mais **pas** sur un
APK antérieur à cette US.

⚠️ **Distinct des 16 widgets du tableau de bord in-app** (WIDGETS-01) : celui-ci vit sur l'écran
d'accueil **du téléphone** (le launcher Android), en dehors de l'application.

> ✅ **Bug « widget transparent » corrigé et validé sur device le 03/08/2026** (Florian, Pixel 6a).
> Deux causes racines trouvées par `adb logcat` : une course entre l'invocation native et
> l'enregistrement JS de la tâche de fond (déplacé dans `apps/mobile/index.js`), et une
> incompatibilité React Compiler sur `HomeWidget.tsx` (`'use no memo';` manquant). Détail dans le
> [CHANGELOG](CHANGELOG.md). Les 13 critères ci-dessous restent à parcourir un par un.

- [ ] 1. Le widget « Wellness » est proposé dans le sélecteur de widgets du launcher (appui long
      sur l'écran d'accueil → Widgets).
- [ ] 2. Une fois posé, affiche la série, la séance du jour (ou « Repos aujourd'hui ») et les kcal
      restantes — cohérents avec ce qu'affiche l'app au même moment.
- [ ] 3. **Désactiver un pilier** (Réglages) fait disparaître sa métrique du widget au prochain
      rafraîchissement (retour au premier plan de l'app) — jamais un trou visuel à moitié vide.
- [ ] 4. **Aucun pilier actif** : seule la série reste affichée.
- [ ] 5. Terminer une séance ou une course, revenir à l'écran d'accueil du téléphone : le widget
      reflète le changement (au pire après le prochain passage de l'app au premier plan/arrière-plan).
- [ ] 6. Ajouter un aliment au journal fait bouger les kcal restantes du widget de la même façon.
- [ ] 7. **Mode avion** : le widget continue d'afficher les données locales, sans erreur.
- [ ] 8. Tap n'importe où sur le widget : ouvre l'app.
- [ ] 9. En **EN** (Réglages → langue) : tous les libellés du widget passent en anglais.
- [ ] 10. **TalkBack** : appui long sur le widget puis balayage → une phrase unique et cohérente
      est annoncée (série + séance du jour + kcal restantes).
- [ ] 11. Widget redimensionné (si le launcher le permet) : reste lisible, texte non tronqué de
      façon illisible.
- [ ] 12. Suppression du widget puis ré-ajout : réapparaît avec des données à jour, sans crash.
- [ ] 13. **Déconnexion** (Réglages → déconnexion) puis rafraîchissement du widget (retour au
      premier plan) : affiche « Ouvre l'app pour voir tes stats », jamais un crash.

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 28. REPAS-01 — Planning repas, liste de courses et partage

📄 [spec](docs/specs/functional/us/repas01-planning-repas-liste-courses.md) · roadmap 4.27 / 4.28 /
4.29 · **📱 device** · ✅ **3 sync rules déployées** le 06/08/2026 (tables neuves `meal_plan_entries`,
`shopping_lists`, `shopping_list_items`) · ✅ **aucune dépendance native neuve → recettable sur
l'APK existant** (le partage passe par `Share.share()` de React Native, décision D8).

🔴 **À faire AVANT de recetter** : coller
[powersync-sync-rules.yaml](docs/specs/technical/powersync-sync-rules.yaml) dans le dashboard
PowerSync et déployer. Sans ça le planning saisi **ne survit pas à une resynchro** — étape manuelle
déjà oubliée deux fois (BIEN-01, RUN-F2c).

> **Le critère 8 est le plus important du lot.** Toute la valeur du planning repose sur le fait
> qu'il n'est **pas** le journal : si planifier faisait bouger les totaux consommés, l'adhérence,
> la série et le bilan hebdo seraient faussés silencieusement, et l'historique pollué serait
> irrattrapable. C'est testé en CI (assertion « `food_entries` vide après planification »), mais
> c'est aussi ce qu'il faut vérifier de ses yeux en premier.

- [ ] 1. Le planning s'ouvre depuis la **carte « Planning repas »** du hub Nutrition, et affiche la
      semaine courante, lundi en premier.
- [ ] 2. Les cases de chaque jour correspondent **exactement** aux repas configurés — à tester avec
      une config personnalisée : un repas renommé, un ajouté, un supprimé (Réglages → Gérer les repas).
- [ ] 3. Déposer une recette en choisissant **2 portions** : le total du jour augmente des macros de
      2 portions (et non du rendement complet de la recette).
- [ ] 4. Déposer un repas type : total cohérent avec le template, et **aucun sélecteur de portions**
      proposé (un repas type n'a pas cette notion).
- [ ] 5. Un jour avec **séance muscu planifiée** affiche un objectif supérieur à un jour de repos,
      avec la mention du bonus.
- [ ] 6. Désactiver les piliers **muscu et course** (Réglages) : la mention d'entraînement disparaît
      complètement du planning.
- [ ] 7. ◀ ▶ naviguent de semaine en semaine **sans décalage de date** — à vérifier autour d'un
      changement de mois.
- [ ] 8. 🔴 **Planifier ne touche pas au journal** : après avoir rempli une journée, le journal
      alimentaire du même jour est **inchangé** (totaux, barres de macros), et la série n'a pas bougé.
- [ ] 9. « J'ai mangé ça » crée les lignes dans **le bon repas du bon jour** ; le total du journal
      bouge alors, et l'entrée du planning s'affiche « Porté au journal ».
- [ ] 10. La même entrée **ne peut pas être portée deux fois** ; « Annuler » retire bien les lignes
      créées — et **rien d'autre** du journal du jour (tester avec un repas qui contenait déjà autre
      chose).
- [ ] 11. « Dupliquer la semaine précédente » recopie toutes les entrées, **et rien dans le journal**.
      Une entrée déjà portée arrive dans la copie **non portée**.
- [ ] 11 bis. Sur une semaine dont la **précédente est vide**, le bouton de duplication est **absent**,
      remplacé par « Rien à dupliquer : la semaine précédente est vide ». Il **réapparaît** dès qu'on
      planifie quelque chose la semaine d'avant, **sans quitter l'écran** (la requête est réactive).
- [ ] 12. Générer la liste : deux recettes partageant un aliment donnent **une seule ligne**, quantité
      sommée.
- [ ] 13. Une recette de **4 portions planifiée pour 2** contribue **la moitié** de ses ingrédients —
      à vérifier au gramme sur un cas préparé exprès.
- [ ] 14. Un ingrédient **sans quantité** produit une ligne portant la mention « quantité non
      précisée » ou « + N sans quantité », et **n'est pas compté 0**.
- [ ] 15. Les lignes sont groupées par rayon dans l'ordre du parcours de magasin (légumes, fruits,
      viandes, poissons, laitiers, féculents, oléagineux, boissons, autre), alphabétique à l'intérieur.
- [ ] 16. Supprimer une recette **après** l'avoir planifiée, puis régénérer : la liste **annonce**
      les repas sans ingrédients au lieu de les taire.
- [ ] 17. Cocher des articles, **fermer complètement l'app**, rouvrir : les cases restent cochées.
- [ ] 18. **D13** — tap sur un en-tête de rayon partiellement coché : coche le reste **sans
      confirmation**. Re-tap sur le rayon désormais complet : **demande confirmation** avant de
      dé-cocher, et « Annuler » ne dé-coche rien.
- [ ] 19. « Régénérer » **avertit de la perte des cases cochées** (avec leur nombre) ; annuler ne
      régénère rien.
- [ ] 20. « Partager la liste » ouvre la feuille Android ; le texte collé dans une note est lisible,
      complet, groupé par rayon, sans émoji ni lien.
- [ ] 21. **Sans profil nutritionnel** : le planning fonctionne et la ligne d'objectif est **masquée**
      (jamais « / 0 kcal »).
- [ ] 22. **Mode avion** : planifier, générer, cocher, partager — tout fonctionne. Retour en ligne :
      tout remonte (à vérifier sur un **second appareil**, c'est aussi ce qui valide les sync rules).
- [ ] 23. Basculer **FR → EN** : tous les libellés changent, **y compris les rayons et le texte
      partagé**.
- [ ] 24. **Police système à 1,5×** : aucune troncature ni chevauchement sur la vue semaine (l'écran
      le plus dense de l'US).
- [ ] 25. **TalkBack** : les cases à cocher annoncent leur état, et un en-tête de rayon annonce son
      décompte (« Légumes, 3 sur 5 cochés »).
- [ ] 26. **Export RGPD** (Réglages → exporter mes données) : le fichier contient bien les entrées de
      planning et la liste de courses.

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap 4.27/4.28/4.29 à ✅,
et **on supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md).

---

## 29. MUSCPWR-01 — Module force (%1RM, DOTS, total SBD)

📄 [spec](docs/specs/functional/us/muscpwr01-module-force.md) · catalogue **MUSC-16 / MUSC-27 /
MUSC-29** · **📱 device** · ✅ **aucune sync rule** (`user_settings` déjà publiée) · ✅ **aucune
dépendance native → recettable sur l'APK existant**.

> 🔴 **Le critère 21 ne peut pas être coché par moi.** Les coefficients du DOTS viennent de
> l'extérieur du projet et n'ont pas pu être confrontés à une source officielle. Un coefficient faux
> produit un score **plausible mais faux** — donc invisible en recette ordinaire. Il faut que
> quelqu'un qui pratique regarde si les valeurs sont crédibles pour des totaux connus.

- [ ] 1. Compte neuf, sans séance : la section « Force » est **absente** de Progression (pas vide).
- [ ] 2. Après une séance sur un exercice, la fiche de cet exercice affiche l'intensité relative.
- [ ] 3. Le %1RM se calcule contre le **meilleur** 1RM connu, pas le dernier : faire une séance
      légère après une lourde, les pourcentages ne doivent **pas** bondir.
- [ ] 4. Une série qui dépasse le 1RM connu affiche **plus de 100 %** (barre verte), pas 100 %.
- [ ] 5. Les séries d'échauffement ne tirent pas la moyenne de séance vers le bas.
- [ ] 6. Profil **sans sexe renseigné** : le DOTS est masqué avec l'invitation à compléter le profil ;
      le renseigner le fait apparaître.
- [ ] 7. **Sans poids de corps** : DOTS masqué, mais le total SBD reste affiché.
- [ ] 8. Le DOTS affiche **à quel poids et à quelle date** il a été calculé.
- [ ] 9. Désigner les 3 mouvements : le total apparaît, égal à la somme des 3 e1RM.
- [ ] 10. N'en désigner que 2 : le total **n'est pas affiché**, et l'écran dit lequel manque.
- [ ] 11. Archiver un exercice désigné : signalé « exercice archivé », les autres analyses continuent.
- [ ] 12. Avec 2 mesures de total seulement : **pas de projection**, et la raison est affichée.
- [ ] 13. Avec ≥ 3 mesures sur ≥ 8 semaines : projection affichée, **libellée comme une estimation**,
      à 12 semaines maximum.
- [ ] 14. Progression en baisse : la projection **descend** au lieu de disparaître.
- [ ] 15. Corriger une série passée met à jour les trois analyses **immédiatement**.
- [ ] 16. Unités impériales : les charges s'affichent en lb, **le DOTS ne change pas** (calculé en kg).
- [ ] 17. **Mode avion** : tout est calculé et affiché normalement (rien n'est stocké, tout est dérivé).
- [ ] 18. FR → EN : tous les libellés changent ; « DOTS » et « SBD » restent tels quels.
- [ ] 19. Police 1,5× : la section reste lisible, aucune troncature sur les scores.
- [ ] 20. TalkBack : la section repliable annonce son état, les scores et la projection sont annoncés.
- [ ] 21. 🔴 **Relecture par un pratiquant** : les valeurs de DOTS sont-elles crédibles pour des
      totaux connus ? (Point de vigilance de la spec §4.)
- [ ] 22. La section est **repliée par défaut** — l'écran Progression compte déjà cinq sections.
- [ ] 23. Le réglage des mouvements survit à une **fermeture complète de l'app** (c'est ce que les
      pannes de CYCLE-01 et PAS-01 avaient cassé silencieusement).

**Quand l'US passe** : `etape: close`, catalogue MUSC-16/27/29 déjà à ✅, et **on supprime cette
section**. Passe par [`/commit`](.claude/commands/commit.md).

---

## 30. INSIGHTS-01 — Écran « Insights » (Tier 3)

📄 [spec](docs/specs/functional/us/insights01-ecran-insights.md) · roadmap **7.20** · **📱 device** ·
✅ **aucune migration, aucune sync rule** · ✅ **aucune dépendance native → recettable sur l'APK
existant**.

> **Comment provoquer des insights.** L'écran ne montre que ce qui est vrai : sur un compte propre,
> il sera vide, et c'est le critère 6. Pour voir des cartes, le plus simple est d'enchaîner
> quelques séances (charge → alerte), de battre un record (célébration), ou d'attendre la clôture
> d'une semaine ISO (bilan + variations).

- [ ] 1. Le widget « Insight du jour » apparaît sur l'accueil **quand il y a quelque chose à dire**,
      et ouvre l'écran.
- [ ] 2. **L'en-tête de l'écran s'affiche correctement** (titre au-dessus de la barre d'état, pas
      dessous) — c'est le défaut PAS-01, invisible au typecheck comme aux tests.
- [ ] 3. Chaque carte affiche **au moins un chiffre**. Une carte sans nombre est un défaut bloquant.
- [ ] 4. Aucune carte n'énonce une **causalité** ni un conseil de santé qui ne soit pas déjà validé
      ailleurs dans l'app.
- [ ] 5. Les nombres sont **formatés** : pas de `41.2000001`, pas de séparateur décimal anglais en FR.
- [ ] 6. Compte sans donnée → **état vide lisible**, aucune carte inventée.
- [ ] 7. Désactiver un pilier → ses insights disparaissent ; le réactiver → ils reviennent.
- [ ] 8. **Mode avion** → écran identique, aucun indicateur d'erreur réseau.
- [ ] 9. FR ⇄ EN → aucune chaîne non traduite, **aucun `insights.` brut** à l'écran.
- [ ] 10. Unités impériales → charges et distances converties. ⚠️ Vérifier en particulier un
      **objectif de course atteint** : la cible est stockée en mètres, « 50 km » ne doit pas
      s'afficher « 50 000 ».
- [ ] 11. Police système 1,5× → aucun texte tronqué ni chevauché.
- [ ] 12. Thème sombre → contrastes corrects (CONF-07 vient de solder ce chantier).
- [ ] 13. TalkBack → chaque carte est annoncée d'un bloc, famille puis titre puis corps, dans
      l'ordre visuel.
- [ ] 14. 🔴 **La sélection n'est pas gelée** : terminer une séance, puis rouvrir l'écran **sans
      redémarrer l'app** — le contenu doit refléter le nouvel état. *(Ce critère remplace un
      « même résultat en rouvrant dans la minute » qui aurait aussi été vert si la sélection était
      figée à vie par React Compiler — précisément le bug qu'il faut détecter.)*
- [ ] 15. 🔴 **Aucun trou dans la grille de l'accueil** quand le widget est muet — le défaut qui
      s'est produit quatre fois sur ce dashboard.
- [ ] 16. L'accueil **ne devient pas sensiblement plus lent** à l'ouverture (l'agrégateur monte 8
      hooks ; il est mutualisé, mais ça se vérifie à l'usage).
- [ ] 17. La carte du **bilan hebdomadaire**, si elle sort, affiche le **même texte** que l'écran
      « Bilan de la semaine » — les deux partagent volontairement la même clé i18n.

> Les plafonds « au plus 3 cartes » et « au plus 2 par famille » **ne sont pas ici** : difficiles à
> provoquer à la main, ils sont prouvés exhaustivement par les tests unitaires du moteur. Les
> inscrire donnerait l'illusion d'une vérification qui n'aurait pas lieu.

**Quand l'US passe** : `etape: close`, roadmap 7.20 à ✅, et **on supprime cette section**. Passe
par [`/commit`](.claude/commands/commit.md).

---

## 31. INSIGHTS-02 — Dégonflage du Tier 0 (accueil 21 → 7)

📄 [spec](docs/specs/functional/us/insights02-degonflage-tier0.md) · roadmap **7.21** · **📱 device** ·
✅ **aucune migration, aucune sync rule** · ✅ **aucune dépendance native → recettable sur l'APK
existant**.

> 🔴 **Le critère 4 est le seul qui compte vraiment.** Retirer 14 widgets de l'accueil n'a de sens
> que si aucun signal n'a disparu du produit. Les destinations sont vérifiées par un test unitaire,
> mais un test ne prouve pas qu'un humain les trouve : c'est ce que cette recette vérifie.

- [ ] 1. Accueil d'un compte installé tri-pilier : **4 à 6 widgets**, jamais plus.
- [ ] 2. 🔴 Compte ayant **personnalisé son accueil avant la mise à jour** : aucune cellule vide,
      aucun doublon, aucun des 7 widgets restants perdu. *(À tester avec un compte réel qui avait
      réorganisé sa grille — pas un compte neuf.)*
- [ ] 3. Deux petits widgets côte à côte dont celui de **gauche** a été retiré → celui de droite
      **glisse à gauche**, il ne reste pas une demi-cellule vide.
- [ ] 4. 🔴 **Les 14 widgets retirés sont tous atteignables en 2 gestes**, un par un :
      Réglages › Suivi → **Objectifs**, **Bien-être**, **Bilan de la semaine** ·
      Muscu › hub → **Records récents**, **Temps d'entraînement** ·
      Muscu › Progression → **Volume hebdomadaire**, **Équilibre**, **Mensurations** (poids) ·
      Course › hub → **Temps d'entraînement** · Course › Historique › Stats → **semaine** ·
      et les 5 alertes (déficit+volume, charge, garde-fou, score de forme, niveau d'activité,
      interférence) sur l'écran **Insights** quand leur condition est réunie.
- [ ] 5. Réordonner, redimensionner et masquer un widget conservé fonctionne comme avant.
- [ ] 6. Le **glisser-déposer** place toujours le widget dans la colonne visée — la compaction
      horizontale ne doit **pas** le rabattre à gauche pendant le geste.
- [ ] 7. Les 3 nouvelles cartes d'insight s'affichent avec leurs chiffres : score de forme
      (« 2 signaux sur 3 »), interférence (deux ratios), niveau d'activité (jours de course).
- [ ] 8. **Pluriel du score de forme** : avec **1** signal au rouge, la phrase doit être au
      singulier (« 1 signal **est** au rouge »), pas « 1 signaux sont ».
- [ ] 9. Mono-pilier nutrition : l'accueil se réduit sans trou et reste utile.
- [ ] 10. Cycle activé → widget présent ; désactivé → absent, sans cellule vide.
- [ ] 11. Mode avion → identique. FR ⇄ EN → aucune chaîne brute (surveiller `settings.tracking.*`).
- [ ] 12. Police 1,5× et thème sombre → aucune régression sur l'accueil réduit ni sur les hubs
      élargis.
- [ ] 13. TalkBack → accueil et hubs navigables, ordre de lecture = ordre visuel.
- [ ] 14. **L'accueil s'ouvre au moins aussi vite qu'avant** — 7 hooks lourds cessent d'y être
      montés en double, dont le bilan hebdo et ses ≥ 13 requêtes.

**Quand l'US passe** : `etape: close`, roadmap 7.21 à ✅, et **on supprime cette section**. Passe
par [`/commit`](.claude/commands/commit.md).

---

## 51. EXEC-01 — Écart entre le prévu et le réalisé (lot de 4 analyses)

📄 [spec](docs/specs/functional/us/exec01-prevu-vs-realise.md) · roadmap **3.58** · **📱 device** ·
✅ **aucune migration, aucune sync rule, aucune dépendance native → recettable sur l'APK existant**.

> **Où ça se trouve** : écran **Progression**, section « Exécution du programme », **repliée par
> défaut** — il faut la déplier. ⚠️ **Elle n'apparaît pas du tout** tant qu'aucune des 4 analyses n'a
> assez de données : c'est **voulu** (l'écran était déjà au seuil de repli d'ADR-007). Le critère 1
> vérifie ce silence, les autres supposent d'avoir de l'historique.
>
> **Comment fabriquer les données** : il faut **au moins 3 séances issues d'un programme** (pas des
> séances libres) pour le taux d'exécution, et **5 séances** pour la durée.

- [ ] 1. Compte neuf → **aucune section « Exécution »** sur l'écran Progression. Pas de section vide,
      pas de « — ».
- [ ] 2. Une seule séance de programme → la section reste absente ou muette sur ce point.
- [ ] 3. Après ≥ 3 séances de programme : le taux d'exécution de la **charge** apparaît, **avec le
      nombre de séries** et **le nombre de séances** sur lequel il porte.
- [ ] 4. Faire une séance **libre** (hors programme) → elle **n'entre pas** dans le taux d'exécution.
      C'est le critère qui protège le pratiquant qui s'entraîne beaucoup hors programme.
- [ ] 5. Faire une séance en **dépassant** les charges prescrites → taux **> 100 %**, affiché tel
      quel, sans félicitation ni alerte.
- [ ] 6. Abandonner une séance en cours (séries non validées) → **pas** de chute du taux d'exécution.
- [ ] 7. 🔴 Programme avec `reps cibles` = **« AMRAP »** → **aucun** taux de répétitions, **et le taux
      de charge reste affiché**. C'est le critère qui exerce le parsing tolérant.
- [ ] 8. Programme avec reps cibles **« 8-12 »**, réalisé à 10 → compté **conforme**, pas en écart.
- [ ] 9. 🔴 **Modifier la charge cible d'un programme APRÈS avoir fait la séance** → le taux passé
      **ne bouge pas**. C'est le critère qui prouve qu'on lit la prescription **du moment**, pas le
      plan actuel — sinon éditer un programme réécrirait l'historique des écarts.
- [ ] 10. Durée : la médiane apparaît après ≥ 5 séances. Laisser une séance **ouverte plusieurs
      heures** → elle est **écartée**, et le nombre d'écartées est **affiché**.
- [ ] 11. Répartition par type de série : les parts **somment à 100 %** et les libellés sont traduits.
- [ ] 12. Ajouter un exercice en **favori** et le pratiquer hier → **pas** dans les délaissés.
- [ ] 13. Favori non pratiqué depuis **plus de 4 semaines** → apparaît ; le pratiquer → disparaît.
- [ ] 14. **Archiver** un exercice favori → il **sort** de la liste des délaissés.
- [ ] 15. Aucun favori déclaré → la sous-carte « délaissés » se tait, les trois autres restent.
- [ ] 16. La section **ne redit pas** ce que dit la carte d'**équilibre musculaire** (elle raisonne
      **exercice**, jamais groupe musculaire).
- [ ] 17. Déclarer une période **« vie réelle »** (VIE-01) → le **taux d'exécution disparaît**, les
      trois autres analyses **restent**. Fin de période → il revient.
- [ ] 18. Désactiver le pilier **muscu** → aucune section.
- [ ] 19. FR ⇄ EN → aucune chaîne brute ; pourcentages et durées cohérents.
- [ ] 20. Police **1,5×** et thème **sombre** → lisible, non tronqué, contrastes corrects.
- [ ] 21. **TalkBack** → chaque analyse est annoncée **avec son chiffre et sa base** ; l'en-tête
      repliable annonce son état (déplié / replié).
- [ ] 22. Mode avion → identique.
- [ ] 23. 🔴 **L'écran Insights n'a pas changé** : toujours au plus 3 cartes, même sélection qu'avant.
- [ ] 24. 🔴 **Calibrage des trois seuils**, jugement de pratiquant : **3 séances** pour le taux
      d'exécution, **5** pour la durée, **4 semaines** pour « délaissé ». Trop bas (bruit) ? Trop haut
      (muet) ? Chacun est une constante nommée, le changer coûte une ligne.

**Quand l'US passe** : `etape: close`, roadmap 3.58 à ✅, et **on supprime cette section**. Passe
par [`/commit`](.claude/commands/commit.md).

---

## 52. ALLURE-01 — La courbe d'allure (lot de 4 analyses)

📄 [spec](docs/specs/functional/us/allure01-courbe-allure.md) · roadmap **5.35** · **📱 device** ·
✅ **aucune migration, aucune sync rule, aucune dépendance native → recettable sur l'APK existant**.

> **Où ça se trouve** : 3 cartes sur le **résumé de course** (après les splits par km), et 1 section
> **Polarisation** en bas de l'**historique course**.
>
> ⚠️ **Il faut de vraies courses GPS.** Une course saisie à la main ne produit **rien**, et c'est
> voulu (critère 1). Pour le fade il faut **plus de 10 km**, pour la polarisation **2 courses avec
> trace sur 4 semaines**.

- [ ] 1. Course **saisie à la main** → aucune des 3 cartes du résumé, **et aucune erreur**.
- [ ] 2. Course GPS de **moins de 2 km** → pas de carte « gestion d'effort ».
- [ ] 3. Course GPS de 4-5 km → « gestion d'effort » **présente**, « dégradation » **absente**.
- [ ] 4. Course de **plus de 10 km en accélérant** sur la fin → verdict **Negative split**, avec les
      deux allures de moitié et l'écart.
- [ ] 5. Même distance en **ralentissant** → verdict **Positive split**.
- [ ] 6. Course à allure **très régulière** → **Allure régulière**, pas un faux « positive ».
- [ ] 7. 🔴 Fade : sortie longue avec fin nettement plus lente → **pourcentage positif**. Et sur une
      sortie où tu **accélères** à la fin → **pourcentage négatif**, affiché tel quel (ce n'est pas un
      défaut, c'est une bonne gestion d'effort).
- [ ] 8. 🔴 **Allure de référence 5 km non renseignée** (profil coureur) → la carte des zones **reste
      affichée** et propose de **renseigner l'allure**, avec un accès au profil. **Jamais un « — »**, et
      surtout pas une carte disparue : sinon tu ne saurais jamais qu'il te manque un réglage.
- [ ] 9. Renseigner l'allure de référence → les zones apparaissent **sans redémarrer l'app**.
- [ ] 10. Les parts de zones **somment à 100 %**.
- [ ] 11. Une course entièrement **marchée** → tout en **Récupération**, sans erreur.
- [ ] 12. Un **fractionné** rapide → des kilomètres en **Seuil** ou **VMA**.
- [ ] 13. Polarisation : après ≥ 2 courses avec trace sur 4 semaines, les deux parts apparaissent
      **avec le volume en km et le nombre de sorties**, et le repère ~80/20 **nommé sans reproche**.
- [ ] 14. Aucune course sur 4 semaines → **aucune section** Polarisation (pas de titre orphelin).
- [ ] 15. 🔴 La polarisation pèse les **kilomètres** : fais une **sortie longue** et un **court
      fractionné**, la sortie longue doit peser beaucoup plus. Si tu vois ~50/50, c'est le bug.
- [ ] 16. Désactiver le pilier **running** → rien nulle part.
- [ ] 17. FR ⇄ EN → aucune chaîne brute ; allures et pourcentages cohérents. En **impérial**, les
      allures des cartes suivent le réglage (min/mile).
- [ ] 18. Police **1,5×** et thème **sombre** → lisible, non tronqué, contrastes corrects.
- [ ] 19. **TalkBack** → chaque carte annoncée d'un bloc **avec son chiffre** ; le lien vers le profil
      coureur est atteignable quand l'allure de référence manque.
- [ ] 20. Mode avion → identique.
- [ ] 21. **L'écran Insights et l'accueil n'ont pas changé.** ⚠️ Vérifier aussi que **l'historique
      course ne rame pas** : la polarisation décode les traces de 4 semaines. Si c'est lent, dis-le —
      la parade est de borner et de l'afficher, jamais de tronquer en silence.
- [ ] 22. 🔴 **Calibrage**, jugement de pratiquant : **10 km** est-il le bon seuil de dégradation ?
      **2 %** la bonne tolérance d'« allure régulière » ? Et surtout — **la frontière Tempo
      correspond-elle à ton ressenti** ? C'est le seul vrai choix de conception du lot (spec §2.1).

**Quand l'US passe** : `etape: close`, roadmap 5.35 à ✅, et **on supprime cette section**. Passe
par [`/commit`](.claude/commands/commit.md).

---

## 53. APPORT-01 — Manges-tu comme tu t'entraînes ? (lot de 4 analyses croisées)

📄 [spec](docs/specs/functional/us/apport01-manger-comme-on-sentraine.md) · roadmap **4.40** ·
**📱 device** · ✅ **aucune migration, aucune sync rule, aucune dépendance native → recettable sur
l'APK existant**.

> **Où ça se trouve** : écran **Nutrition** (stats), section « Manges-tu comme tu t'entraînes ? »,
> **repliée par défaut** — il faut la déplier.
> ⚠️ **Elle n'apparaît pas du tout** tant que les 4 analyses se taisent : c'est **voulu**.
> **Ce qu'il faut fabriquer** : au moins **3 jours de séance ET 3 jours de repos** journalisés dans les
> 4 dernières semaines. Les deux groupes, sinon rien ne s'affiche.

- [ ] 1. Compte neuf → **aucune section** sur l'écran Nutrition.
- [ ] 2. Journaliser **uniquement des jours de repos** → le bilan et l'adhérence restent muets.
- [ ] 3. Après ≥ 3 jours de séance et 3 de repos journalisés → le bilan apparaît, **avec l'écart signé
      et le nombre de jours de chaque côté**.
- [ ] 4. 🔴 Manger **plus** les jours de séance → écart **positif**. Manger **moins** → écart
      **négatif**, affiché tel quel, **sans reproche ni commentaire**.
- [ ] 5. 🔴 **La marge affichée est la tienne.** Change `marge d'adhérence` dans le profil nutrition
      → le taux **bouge**, et il reste **cohérent avec celui de l'accueil**. C'est le critère qui
      prouve qu'on n'a pas inventé une seconde tolérance.
- [ ] 6. 🔴 Faire une **course** (sans muscu) un jour journalisé → ce jour compte comme **jour
      d'entraînement** dans le bilan et l'adhérence, mais **jamais** dans « disponibilité énergétique »,
      qui lit le volume **muscu**.
- [ ] 7. Faire une séance nettement plus grosse que d'habitude **avec un apport bas** → elle apparaît
      en « disponibilité énergétique », avec son volume et ses kcal. Volume régulier → la carte se tait.
- [ ] 8. Un jour de **gros volume non journalisé** → **pas** signalé (on ne sait pas ce qui a été mangé).
- [ ] 9. 🔴 **Aucune pesée** → la carte protéines **reste affichée** et propose d'en ajouter une, avec
      l'accès aux mensurations. **Jamais un « — »**, jamais une carte disparue.
- [ ] 10. Ajouter une pesée → les g/kg apparaissent **sans redémarrer l'app**.
- [ ] 11. Tout manger au **dîner** vs répartir sur 4 repas, à protéines égales → **le nombre de prises
      au-dessus du repère change**. C'est toute la raison d'être de cette carte.
- [ ] 12. Un **repas personnalisé** (hors config) → rangé en **« Autre », en dernier** (convention
      NUTR-16, la même que la répartition calorique).
- [ ] 13. Les jours **non journalisés** ne comptent pas comme des jours à zéro : vérifier que le
      nombre de jours annoncé correspond bien aux jours réellement renseignés.
- [ ] 14. Désactiver le pilier **nutrition** ou **muscu** → aucune section.
- [ ] 15. FR ⇄ EN → aucune chaîne brute ; kcal et grammes cohérents.
- [ ] 16. Police **1,5×** et thème **sombre** → lisible, non tronqué, contrastes corrects.
- [ ] 17. **TalkBack** → chaque carte annoncée avec son chiffre et sa base ; le lien vers les
      mensurations est atteignable quand la pesée manque.
- [ ] 18. Mode avion → identique. **L'écran Insights, l'accueil et le reste de l'écran Nutrition
      n'ont pas changé** (la carte MN-03 déjà présente notamment).
- [ ] 19. 🔴 **Calibrage**, jugement de pratiquant : **1,25× la médiane** est-il le bon seuil de « gros
      volume » ? **3 jours** par groupe suffisent-ils ? Et **0,3 g/kg par prise** est-il le bon repère
      à afficher, ou trop bas ?

**Quand l'US passe** : `etape: close`, roadmap 4.40 à ✅, et **on supprime cette section**. Passe
par [`/commit`](.claude/commands/commit.md).

---

## 32. COLLIS-01 — Détecteur de collisions entre séances

> 🔴 **Correctif du 07/08/2026 intégré — 5 critères de plus (18 à 22).** La détection ne regardait que
> la **semaine affichée** alors que la règle dit « le lendemain » : le conflit **dimanche → lundi**
> n'était **jamais** détecté, soit une paire de jours sur sept. Corrigé avant recette, pour ne pas te
> faire recetter deux fois la même fonctionnalité. **Commence par le 18** : c'est celui qui justifie
> le correctif. Spec §4.1 · [plan](docs/plans/collis01-conflit-veille-hors-semaine.md).

📄 [spec](docs/specs/functional/us/collis01-detecteur-collisions.md) · roadmap **3.57** ·
**📱 device** · ⚠️ **1 migration poussée le 05/08/2026** · ✅ **aucune sync rule**
(`user_settings` lue en `select *`) · ✅ **aucune dépendance native → recettable sur l'APK
existant**.

> **Comment provoquer un conflit.** Active le réglage, puis planifie sur deux jours consécutifs :
> une séance de muscu où les **jambes dominent** avec **≥ 8 séries**, suivie d'une **sortie longue**
> ou d'un **fractionné**. Sans ces deux conditions, rien ne s'affiche — et c'est voulu.

- [ ] 1. Réglage **désactivé par défaut** sur un compte neuf ; aucun bandeau nulle part.
- [ ] 2. Une fois activé, le conflit canonique affiche le bandeau **sur le jour de la course**.
- [ ] 3. Le bandeau **affiche le nombre de séries** et le type de course.
- [ ] 4. « Déplacer au {{jour}} » déplace **la course**, jamais la séance de muscu.
- [ ] 5. Après déplacement, le bandeau **disparaît** et n'en crée pas un nouveau ailleurs.
- [ ] 6. Semaine pleine → bandeau **sans bouton**, avec sa raison.
- [ ] 7. Jambes minoritaires (full body) ou < 8 séries → **aucun bandeau**.
- [ ] 8. Course `endurance` ou `récupération` le lendemain → **aucun bandeau**.
- [ ] 9. Course ou séance de muscu déjà réalisée / sautée → **aucun bandeau**.
- [ ] 10. Le repli proposé **n'est jamais un jour passé** : sur une semaine en cours, vérifier qu'il
      ne propose pas un jour antérieur à aujourd'hui.
- [ ] 11. Désactiver le réglage → les bandeaux disparaissent immédiatement.
- [ ] 12. Mode avion → identique.
- [ ] 13. FR ⇄ EN → aucune chaîne brute ; **le jour du repli est traduit** (« Déplacer au Thu » en
      anglais, pas « Déplacer au jeu »).
- [ ] 14. Police 1,5× et thème sombre → bandeau lisible, non tronqué, contrastes corrects.
- [ ] 15. TalkBack → le bandeau est annoncé d'un bloc, le bouton est atteignable séparément.
- [ ] 16. 🔴 **L'interrupteur survit à une réinstallation.** Activer, désinstaller, réinstaller, se
      reconnecter : il doit revenir **activé**. C'est le seul test qui exerce **ensemble** la
      migration et le schéma PowerSync local — et c'est la panne exacte de CYCLE-01, où
      l'interrupteur restait éteint en silence parce que la colonne manquait au schéma local.
- [ ] 17. 🔴 **Calibrage du seuil.** Sur ton propre planning : **8 séries** est-il le bon
      déclencheur, ou est-ce trop bas (bruit) / trop haut (muet) ? C'est le **seul nombre inventé**
      du dispositif, il ne repose sur rien de mesuré. Jugement de pratiquant, pas manipulation —
      et le changer coûte une ligne (`LEG_SETS_CONFLICT_THRESHOLD`).

### Correctif « veille hors semaine » du 07/08/2026 (D7)

- [ ] 18. 🔴 **Le conflit dimanche → lundi est détecté.** Planifie une séance jambes (**≥ 8 séries**,
      majoritaires) un **dimanche**, puis une **sortie longue le lundi suivant**. Place-toi sur la
      semaine **du lundi** : le bandeau doit apparaître sur ce lundi. **Avant correctif, il
      n'apparaissait jamais.** Si ce critère échoue, rien d'autre dans cette section ne compte.
- [ ] 19. 🔴 **Le repli ne fabrique pas le conflit qu'il résout.** Jambes lourdes le **dimanche**
      (hors semaine), un conflit **mardi → mercredi**, tous les jours après mercredi occupés, et
      **rien le lundi**. Le bouton ne doit **jamais** proposer « Déplacer au lundi » — ce serait
      recréer le conflit un jour plus tôt. Il doit proposer un autre jour, ou aucun.
- [ ] 20. **L'écran affiche toujours 7 jours.** Vérifie qu'aucune **8ᵉ carte de jour** n'est apparue
      en haut de `/planning` : la fenêtre élargie ne sert qu'à la détection, jamais à l'affichage.
- [ ] 21. **Rien n'a bougé sur les autres jours.** Rejoue les critères **2, 5 et 7** (conflit nominal
      en milieu de semaine, disparition après déplacement, jambes minoritaires) : le correctif ne doit
      **rien changer** aux six jours qui fonctionnaient déjà.
- [ ] 22. **DOUL-01 n'a pas bougé.** Le journal des zones douloureuses partage la requête
      d'enrichissement. Journal activé : ses bandeaux apparaissent comme avant, et **aucun** sur une
      séance de la veille hors semaine.

**Quand l'US passe** : `etape: close`, roadmap 3.57 à ✅, et **on supprime cette section**. Passe
par [`/commit`](.claude/commands/commit.md).

---

## 33. VIE-01 — Mode « vie réelle » (dégradation gracieuse)

📄 [spec](docs/specs/functional/us/vie01-mode-vie-reelle.md) · roadmap **1.28** · **📱 device** ·
✅ **aucune dépendance native → recettable sur l'APK existant**.

✅ **Les 2 migrations sont poussées** (05/08/2026). Le CLI a émis le warning
`failed to cache migrations catalog` — **connu et bénin**, identique à celui du push de REPAS-01 : il
porte sur la mise en cache du catalogue pg-delta, pas sur l'exécution du SQL. Vérifié par
`npm run db:types`, qui fait apparaître `real_life_periods` et ses 7 colonnes **depuis le cloud**.

✅ **Plus aucun bloquant** : la sync rule de la table **neuve** `real_life_periods` est **déployée**
(confirmé par Florian le 06/08/2026). Cette section annonçait jusqu'ici « un seul bloquant avant de
recetter » — il est levé, l'US est recettable sur l'APK existant.

⚠️ Étape **déjà oubliée deux fois** (BIEN-01, puis RUN-F2c qui reste bloquée pour ça). Sans elle, les
périodes restent locales : le mode marcherait sur un téléphone et pas sur l'autre, **sans aucune
erreur visible**. Le critère 1 ci-dessous passerait quand même — c'est ce qui rend l'oubli si facile.

> **Comment provoquer l'état.** Depuis l'accueil, la ligne « Ça se complique ? Allège la semaine » →
> choisir 7 jours → valider. Pour les critères de série, il faut un compte avec une série en cours et
> des jours vides ensuite.

- [ ] 1. Déclarer une période de 7 jours en **un tap** depuis l'accueil ; la carte apparaît.
- [ ] 2. La carte affiche la date de fin et les jours restants, avec le **bon pluriel** à 1 jour, et
      « Dernier jour » le dernier jour.
- [ ] 3. L'objectif de semaine minimal n'affiche **que les piliers actifs** (tester en mono-pilier).
- [ ] 4. Cible muscu = **moitié du plan habituel, plancher à 1** — vérifier avec un programme à
      2 séances/semaine : la cible doit être **1**, pas 2.
- [ ] 5. Objectif calorique passé **au maintien** : vérifier sur un profil en `cut` (il doit remonter
      au TDEE, delta −400) **et** sur un `bulk` (il doit descendre, delta +300 neutralisé).
- [ ] 6. Un `manualOverride` de calories **n'est pas modifié** par la période.
- [ ] 6b. 🔴 **Accueil, onglet Nutrition, planning repas et widget launcher affichent le MÊME
      chiffre.** C'est le critère qui attrape un appelant oublié — il y a **7 appels** de
      `targetCalories` dans 5 fichiers.
- [ ] 6c. L'écran de **réglage de l'objectif nutritionnel** continue d'afficher la cible du `cut`,
      **pas** le maintien (exclusion volontaire, R4).
- [ ] 7. Deux jours inactifs consécutifs en période : la série **ne tombe pas** et **n'augmente pas**.
- [ ] 8. Une séance faite pendant la période : la série **augmente de 1**.
- [ ] 9. Aucun joker n'est proposé sur un jour couvert par une période.
- [ ] 10. Une chute de tonnage ≥ 15 % en période **n'affiche aucune carte d'insight** ; une **hausse**
      ≥ 15 % l'affiche bien.
- [ ] 11. `overtraining_guard` / `training_load` **s'affichent quand même** en période — les
      garde-fous de sécurité ne se taisent jamais.
- [ ] 12. Le bilan hebdo porte « N jours en mode vie réelle », avec le **bon décompte par semaine**
      sur une période à cheval sur deux semaines.
- [ ] 12b. Le bilan d'une semaine en période **n'affiche aucun** `volume_drop` / `consistency_drop` /
      `muscle_imbalance` / `nutrition_drift` — sur une semaine qui, hors période, les déclencherait.
- [ ] 12c. En revanche, un objectif OBJ-01 qui décroche **s'affiche toujours** (`goal_behind`) :
      contrepartie assumée de D6, et elle doit rester visible.
- [ ] 13. À l'échéance, la sortie est **automatique** : cibles et signaux reviennent à la normale,
      **sans notification et sans écran de bilan**.
- [ ] 14. « Prolonger » (+7 j) et « Reprendre le plan normal » fonctionnent, y compris **en mode
      avion**.
- [ ] 15. Rétro-déclaration : l'option « il y a 7 jours » est acceptée ; il n'existe **aucune** option
      au-delà.
- [ ] 16. Les moyennes, tendances et ACWR **contiennent toujours** les jours de la période (D2) —
      vérifier qu'aucune valeur n'a été retirée.
- [ ] 17. Relecture du **ton**, FR **et** EN : aucun « seulement », « manqué », « raté », aucun
      compteur d'écart négatif. C'est une règle de la spec (R9), pas une préférence.
- [ ] 18. Export RGPD : la table `real_life_periods` est présente dans l'archive.
- [ ] 19. Police 1,5× et thème sombre → carte et feuille lisibles, non tronquées.
- [ ] 20. TalkBack → la carte est annoncée d'un bloc ; les 3 chips de durée et les 2 actions sont
      atteignables séparément.
- [ ] 21. 🟠 **Arbitrage produit à confirmer** : l'accueil passe de **7 à 8 widgets déclarés**
      (plafond `MAX_HOME_WIDGETS` relevé). Le compte **visible** typique reste 5-6, dans la fourchette
      d'ADR-007 §2 — mais INSIGHTS-02 vient de ramener le registre de 21 à 7, donc c'est **ta**
      décision. Si non : rendre `real-life` conditionnel et déplacer son point d'entrée.
- [ ] 22. 🟠 **Décisions D5 et D6 à confirmer sur device** : la rétro-déclaration à 7 jours permet de
      **rattraper une série rompue** (est-ce acceptable ?), et une période **ne décale pas** une
      échéance d'objectif (est-ce le bon choix ?).

**Quand l'US passe** : `etape: close`, roadmap 1.28 à ✅, et **on supprime cette section**. Passe
par [`/commit`](.claude/commands/commit.md).

---

## 34. DOUL-01 — Journal des zones douloureuses

📄 [spec](docs/specs/functional/us/doul01-journal-zones-douloureuses.md) · roadmap **1.29** ·
**📱 device** · ✅ **aucune dépendance native → recettable sur l'APK existant**.

✅ **Aucun bloquant : tout est en place.** Les 3 migrations sont poussées (06/08/2026) et la **sync
rule PowerSync est déployée**. `npm run db:types` confirme `pain_reports` et `pain_journal_enabled`
depuis le cloud. La recette peut commencer.

> **Comment provoquer l'état.** Réglages → *Zones sensibles* → activer, puis *Signaler une zone*.
> Pour le signal, il faut une séance de muscu **planifiée** dont un groupe musculaire domine.

- [ ] 1. Réglage **désactivé par défaut** sur un compte neuf ; aucun écran, aucun signal.
- [ ] 2. Une fois activé : déclarer une zone en 2 taps (zone puis niveau).
- [ ] 3. Les **18 zones** sont atteignables, face **et** dos, sur le schéma **et** dans la liste.
- [ ] 4. `Épaules` (muscle) et `Articulation de l'épaule` sont **distinguables** : plaque contre
      pastille sur le schéma, libellés différents dans la liste.
- [ ] 5. Les petites articulations (poignet, cheville) sont **tapables au doigt** — c'est le point le
      plus incertain du dessin, à juger sur device.
- [ ] 6. Redéclarer la même zone le même jour **met à jour** le niveau, sans créer de doublon.
- [ ] 7. Les 3 niveaux se distinguent **par la couleur** sur le schéma (gêne / douleur / bloquant).
- [ ] 8. Une zone **musculaire** en `douleur` → la séance planifiée qui la cible affiche le **fait
      daté**, **sans aucun bouton**.
- [ ] 9. Une zone en `gêne` → **aucun signal** (une courbature n'est pas une alerte).
- [ ] 10. 🔴 Une zone **articulaire** en `bloquant` (ex. genou) → **aucun signal**, même sur une
      séance de jambes. C'est le comportement le plus contre-intuitif de l'US, et il est **voulu** :
      on ne sait pas qu'un squat charge un genou.
- [ ] 11. Deux zones sensibles sur la même séance → **un seul** message, sur la plus grave.
- [ ] 12. Au 8ᵉ jour, la zone **sort du signal** et **reste dans l'historique**.
- [ ] 13. L'historique montre la **suite** des niveaux d'une zone, jamais une moyenne.
- [ ] 14. 🔴 **Relecture du vocabulaire, FR et EN** : aucun « blessure », « repos conseillé »,
      « consulte », « guérison ». Un test automatique couvre les clés i18n — mais **relis l'écran**,
      il ne couvre pas ce que le schéma suggère.
- [ ] 15. Désactiver le journal → écrans et signaux disparaissent ; les données restent.
- [ ] 16. Mode avion → déclaration, historique et signal identiques.
- [ ] 17. Export RGPD : `pain_reports` est présent dans l'archive.
- [ ] 18. 🔴 **L'opt-in survit à une réinstallation** — le seul test qui exerce ensemble la migration,
      la colonne et le schéma PowerSync local (panne CYCLE-01).
- [ ] 19. **Deuxième appareil** : une zone déclarée sur A apparaît sur B. C'est **le seul critère qui
      vérifie la sync rule** — sans elle, tout le reste passe et la donnée ne remonte jamais.
- [ ] 20. Police 1,5×, thème sombre : schéma et liste lisibles, non tronqués.
- [ ] 21. TalkBack : les zones sont déclarables **par la liste** (le schéma SVG n'expose que des
      libellés — `react-native-svg` n'accepte pas `accessibilityRole` sur ses formes).
- [ ] 22. 🟠 **Jugement de pratiquant** : la fenêtre de **7 jours** est-elle la bonne ? Trop longue
      (l'app radote sur une douleur passée) ou trop courte ? Changer coûte une ligne
      (`PAIN_FRESHNESS_DAYS`).

**Quand l'US passe** : `etape: close`, roadmap 1.29 à ✅, et **on supprime cette section**. Passe
par [`/commit`](.claude/commands/commit.md).

---

## ⚠️ À lire avant de recetter les §35 à §49 — 5 de ces signaux ont changé d'écran

Sections écrites le **06/08/2026** par [`/reconcilier`](.claude/commands/reconcilier.md) : ces 15 US
étaient à `etape: recette` **sans aucun critère cochable ici**. Leurs critères viennent de la section
« Critères d'acceptation » de chaque spec, **relus contre le code du 06/08** — et cinq d'entre eux
étaient périmés.

🔴 **META-19, GARDE-01, TRI-03, MR-08 et RN-03 ne sont plus des widgets d'accueil.** INSIGHTS-02
(7.21, 05/08/2026) a ramené l'accueil de 21 à 7 widgets : leurs signaux sont devenus des **cartes
d'insight** sur l'**écran Insights** (7.20). Vérifié dans
[widget-destinations.ts](packages/shared/src/widget-destinations.ts) — `training_load`,
`overtraining_guard`, `readiness`, `concurrent_interference`, `activity_level`. Recetter « le widget
apparaît sur l'accueil » ferait remonter un faux défaut.

🔴 **Et surtout : un signal armé n'est pas forcément affiché.** Le moteur d'insights plafonne à
**3 cartes** (`MAX_INSIGHTS`) et **2 par famille** (`MAX_PER_FAMILY`). Or ces 5 signaux sont **tous
de la famille `alert`**, avec `deficit_volume` : **au plus 2 peuvent s'afficher en même temps**, dans
l'ordre de `INSIGHT_ORDER` — `overtraining_guard` › `training_load` › `readiness` ›
`concurrent_interference` › `deficit_volume` › `activity_level`.
⚠️ **L'absence d'une carte moins prioritaire, quand une alerte plus prioritaire est affichée, est le
comportement voulu — ne pas la remonter comme un bug.** Pour recetter un signal en particulier, il
faut donc l'isoler : vérifier d'abord qu'aucune alerte au-dessus de lui ne se déclenche.

---

## 35. RUN-F1b — Dénivelé cumulé

📄 [spec](docs/specs/functional/us/runf1b-denivele-cumule.md) · roadmap 5.32 · **📱 device** ·
1 migration poussée (`runs.elevation_gain_m` / `elevation_loss_m`, additives) · ✅ aucune sync rule
(`runs` déjà lue en `select *`) · ✅ aucune dépendance native → recettable sur l'APK existant.

- [ ] 1. Une sortie sur terrain vallonné affiche un dénivelé positif et négatif plausibles — à
      comparer visuellement avec un tracé de référence (Strava / Garmin / IGN) sur le même parcours.
      **Un ordre de grandeur cohérent, pas un chiffre exact** (R7).
- [ ] 2. Une sortie sur terrain **plat** n'affiche pas un dénivelé qui grimpe anormalement au fil des
      minutes — c'est ce qui vérifie que le filtre de bruit (R3) marche réellement, pas en théorie.
- [ ] 3. Une pause manuelle suivie d'une reprise ne produit **aucun saut** de dénivelé au moment de
      la reprise (R4).
- [ ] 4. Une course **manuelle** (sans GPS) n'affiche **aucune ligne** de dénivelé (R5 : absent, pas
      zéro).
- [ ] 5. Une course enregistrée **avant** cette US n'affiche aucune ligne de dénivelé sur son résumé
      (donnée absente) **mais** n'empêche pas les stats de période de sommer les autres courses.
- [ ] 6. Le bloc stats par période (semaine / mois / depuis le début) affiche un dénivelé cumulé
      cohérent avec la **somme** des sorties individuelles de la période.
- [ ] 7. **Mode avion** : le dénivelé se calcule normalement pendant toute la course.
- [ ] 8. En **EN** : les libellés `running.elevation.*` sont grammaticaux.
- [ ] 9. TalkBack énonce les valeurs de dénivelé normalement — pas de régression sur le résumé ni sur
      l'historique.

⚠️ **Seuils GPS non validés terrain** (précision 30 m, bruit 3 m) : à juger en course réelle. Si le
critère 2 échoue, c'est un réglage de seuil, pas un défaut de logique.

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 36. RUN-F2a — Annonces audio périodiques

📄 [spec](docs/specs/functional/us/runf2a-annonces-audio.md) · roadmap 5.19 · **📱 device** ·
✅ aucune sync rule · 🔴 **`expo-speech` est une dépendance native neuve** : un APK antérieur au
02/08/2026 n'a **aucune voix**, et l'échec serait silencieux. Le build LAUNCHER-01 du **03/08/2026**
lui est postérieur et devrait l'embarquer — **à confirmer par le critère 2 avant de dérouler le
reste** ; si aucune annonce ne sort réglage activé, c'est l'APK, pas le code.

- [ ] 1. Réglage **désactivé** (défaut) → aucune annonce pendant toute une course GPS.
- [ ] 2. Réglage activé, intervalle **1 km** → une annonce à 1, 2, 3 km… **jamais deux fois au même
      kilomètre**. *(C'est aussi le test qui prouve que l'APK embarque `expo-speech`.)*
- [ ] 3. Intervalle changé à **500 m** → annonces deux fois plus fréquentes.
- [ ] 4. Rouvrir l'écran de suivi après avoir navigué ailleurs, **à 3,4 km**, ne redéclenche pas les
      annonces de 1, 2 et 3 km (R2).
- [ ] 5. Une course **manuelle** n'émet jamais d'annonce, quel que soit le réglage (R4).
- [ ] 6. La phrase annoncée est **prononçable et grammaticale** en FR **et** en EN : pas de nombre à
      rallonge, pas de décimale lue à voix haute.
- [ ] 7. **Écran verrouillé pendant le suivi** : noter si les annonces continuent ou s'arrêtent.
      Comportement **non garanti** (§1) — le critère est de **documenter l'observé**, pas de valider.
- [ ] 8. **Changer d'onglet (ex. Nutrition) pendant la course puis revenir via « Reprendre »** :
      aucune annonce pendant l'absence de l'écran, et **aucune rafale** au retour des seuils franchis
      entre-temps (R2). *C'est le cas le plus probable en usage réel — à ne pas confondre avec le 7.*
- [ ] 9. **Mode avion** : les annonces fonctionnent normalement (aucun réseau requis).
- [ ] 10. Une **pause manuelle** suspend les annonces ; la reprise ne rattrape pas les seuils
      « manqués » pendant l'arrêt — ils n'ont pas été franchis (R6).

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 37. RUN-F2b — Prolonger ou raccourcir : cible visible en direct

📄 [spec](docs/specs/functional/us/runf2b-cible-en-direct.md) · roadmap 5.23 · **📱 device** ·
✅ aucune migration, aucune sync rule, aucune dépendance native → **recettable sur l'APK existant**
(réutilise `compareToTarget` / `useRunTarget` / `running.target.*` de RUN-F3 tels quels).

- [ ] 1. Une course démarrée **depuis une séance planifiée** avec cible de distance affiche
      « X sur Y visés », qui **progresse en direct** pendant la course.
- [ ] 2. La cible franchie fait passer le libellé à « objectif atteint », **sans interruption ni
      couleur alarmante** (R4).
- [ ] 3. Continuer à courir après la cible affiche « dépassé de Z », qui continue de progresser —
      rien n'empêche ni ne signale négativement la poursuite (R5).
- [ ] 4. Une course **libre** (sans séance planifiée) n'affiche **aucune** carte objectif.
- [ ] 5. Une séance planifiée **sans cible chiffrée** n'affiche aucune carte objectif — pas un encart
      vide.
- [ ] 6. Une cible **de durée** ne s'affiche **jamais** comme « dépassée » dans les toutes premières
      secondes, avant le premier flush GPS (R1 bis). *Le cas le plus facile à manquer.*
- [ ] 7. Le bouton **Stop** fonctionne à tout moment, avant ou après la cible, sans changement de
      comportement (R5 : « terminer avant la cible » était déjà natif).
- [ ] 8. **Mode avion** : la carte objectif s'affiche normalement.
- [ ] 9. En **EN** : aucune régression sur les clés `running.target.*` déjà traduites (R2).

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 38. RUN-18 — Charge d'entraînement & ACWR (running seul)

📄 [spec](docs/specs/functional/us/run18-acwr-running.md) · catalogue **RUN-18** · **📱 device** ·
✅ aucune migration, aucune sync rule → recettable sur l'APK existant.
ℹ️ **Section d'écran, pas un widget** : RUN-18 n'a pas été touchée par INSIGHTS-02 — contrairement à
META-19, avec laquelle elle se confond facilement (voir le critère 6).

- [ ] 1. ≥ 28 jours d'historique de course, ratio en **zone saine** → la section affiche le ratio et
      « zone saine ».
- [ ] 2. Ratio **> 1,3** → « zone de risque », **ton factuel** — pas de rouge alarmiste.
- [ ] 3. Ratio **< 0,8** → « zone basse » **affichée**. ⚠️ Contrairement à META-19, elle **n'est pas
      masquée** ici : c'est voulu, ne pas le remonter comme une incohérence entre les deux.
- [ ] 4. **Aucune course** sur les 28 derniers jours (compte neuf) → section **absente**, pas de
      ratio à 0, pas d'erreur (R5).
- [ ] 5. Ajouter une course **sans RPE** à côté de courses avec RPE ne fait pas baisser le ratio de
      façon disproportionnée : elle contribue **zéro**, elle n'est pas retirée du calcul.
- [ ] 6. Le pilier **muscu actif ou non ne change rien** à cette section : elle ne lit que `runs`.
      *C'est la différence de fond avec META-19, qui exige les deux piliers.*
- [ ] 7. **Mode avion** : la section s'affiche normalement.
- [ ] 8. En **EN** : les trois libellés de zone **et** l'état vide sont grammaticaux.
- [ ] 9. TalkBack énonce chaque ligne comme un ensemble cohérent (libellé + zone + ratio), pas des
      fragments disjoints.

ℹ️ Le seuil 1,3 est une invariante de code couverte par les tests de `computeAcwr` — **pas** un
critère de recette humaine.

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 39. META-19 — Garde-fou surentraînement (ACWR combiné)

📄 [spec](docs/specs/functional/us/meta19-acwr-garde-fou.md) · catalogue **META-19** ·
**📱 device** · ✅ aucune migration, aucune sync rule → recettable sur l'APK existant.
🔴 **Surface déplacée par INSIGHTS-02** : ce signal n'est plus un widget d'accueil, c'est la carte
d'insight `training_load` sur l'**écran Insights**. Elle est **2ᵉ** de `INSIGHT_ORDER` — donc masquée
si `overtraining_guard` (§49) occupe déjà la famille avec un autre. Voir l'encadré en tête des §35-49.

- [ ] 1. Charge des **7 derniers jours** nettement supérieure à la moyenne des **28** → la carte
      apparaît sur l'écran Insights, avec son message **et** sa recommandation.
- [ ] 2. Ratio en **zone saine (0,8-1,3)** → **aucune carte** : pas un affichage neutre, pas de
      « tout va bien ».
- [ ] 3. Ratio **bas (< 0,8)** → **aucune carte non plus** (R5, hors périmètre). ⚠️ RUN-18 (§38)
      affiche, elle, sa zone basse — les deux comportements sont voulus.
- [ ] 4. **Aucune séance** sur 28 jours (compte neuf) → pas de carte, pas d'erreur, **pas de division
      par zéro** (R6).
- [ ] 5. Une séance **sans RPE** ne fausse le calcul ni vers le haut ni vers le bas : elle contribue
      **zéro** (R1).
- [ ] 6. Un **seul** pilier actif (muscu **ou** course) → la carte n'apparaît **jamais**, quelle que
      soit la charge.
- [ ] 7. **Pendant une période « vie réelle »** (VIE-01) : le signal **reste armé** — les garde-fous
      de charge ne sont jamais mis en sourdine (`REAL_LIFE_MUTED_INSIGHTS` ne les contient pas).
      **Ce n'est pas un oubli**, c'est un principe : quelqu'un qui rattrape trop fort au retour est
      précisément qui il faut prévenir.
- [ ] 8. **Mode avion** : la carte s'affiche normalement s'il y a lieu.
- [ ] 9. En **EN** : message et recommandation grammaticaux.
- [ ] 10. TalkBack énonce la carte comme un bloc cohérent.
- [ ] 11. Un dashboard **personnalisé avant INSIGHTS-02** contenant encore `training-load` se résout
      **sans trou ni doublon** (id inconnu ignoré par `resolveScreenLayout`).

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 40. MUSC-F15 — Progression au niveau du programme

📄 [spec](docs/specs/functional/us/muscf15-progression-programme.md) · roadmap 3.7 ·
**📱 device** · ✅ aucune donnée nouvelle, aucune migration, aucune sync rule → recettable sur
l'APK existant.

- [ ] 1. Semaine `N-1` du programme complétée à **100 %** → la séance de la semaine `N` propose une
      **hausse de charge** (comportement inchangé).
- [ ] 2. Semaine `N-1` complétée à **moins de 80 %** (ex. 2 séances sur 4 `done`) → la séance de la
      semaine `N` affiche « Reste à P kg, essaie N reps… » (`weightHold`), **jamais** une hausse de
      poids, **et le message explique la cause** (l'adhérence).
- [ ] 3. **Première** semaine d'un programme (`week_index = 0`) → hausse pleine (R2, inchangé).
- [ ] 4. **Séance libre** (non planifiée) → hausse pleine (R3, inchangé).
- [ ] 5. Un exercice **en deload** (2 séances difficiles d'affilée, MUSC-F7) **reste en deload** même
      si l'adhérence de la semaine précédente est bonne — R4 ne s'applique qu'à la branche de hausse.
- [ ] 6. **Mode avion** : comportement identique (aucun réseau requis).
- [ ] 7. En **EN** : `workout.suggestion.weightHold` est grammaticale **et distincte** de
      `workout.suggestion.reps` — pas de confusion avec le cas « poids du corps ».

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 41. TRI-03 — Score de forme / readiness global

📄 [spec](docs/specs/functional/us/tri03-score-readiness.md) · catalogue **TRI-03** ·
**📱 device** · ✅ aucune migration, aucune sync rule → recettable sur l'APK existant.
🔴 **Surface déplacée par INSIGHTS-02** : carte d'insight `readiness` sur l'**écran Insights**, plus
un widget d'accueil. Elle est **3ᵉ** de `INSIGHT_ORDER` : si `overtraining_guard` **et**
`training_load` se déclenchent tous les deux, la famille `alert` est pleine et **readiness
n'apparaît pas** — comportement voulu. Voir l'encadré en tête des §35-49.

- [ ] 1. 3 piliers actifs + historique + check-ins récents → verdict **cohérent avec les 3
      composantes** affichées dans le détail.
- [ ] 2. **Nutrition seule** activée, check-ins faits → verdict basé sur le **bien-être seul** : pas
      de trou, et **aucune composante muscu/course inventée**.
- [ ] 3. Compte **tout neuf** → **aucune** carte readiness tant qu'aucune composante n'a de données.
- [ ] 4. Une composante indisponible (ex. nutrition, faute de jours loggés) est explicitement dite
      **« indisponible »** dans le détail — jamais confondue avec un état neutre.
- [ ] 5. **Un seul** signal négatif suffit à afficher « Repos conseillé », même si les deux autres
      sont bons.
- [ ] 6. **Pendant une période « vie réelle »** : le signal **reste armé** (garde-fou de charge, cf.
      §39 critère 7).
- [ ] 7. **Mode avion** : la carte s'affiche normalement s'il y a lieu.
- [ ] 8. TalkBack énonce la carte comme un bloc cohérent, **et le détail dépliable est atteignable**.
- [ ] 9. En **EN** : verdicts et libellés de composantes grammaticaux.
- [ ] 10. Un dashboard personnalisé contenant encore `readiness` se résout sans trou ni doublon.

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 42. MN-04 — Macros ajustées jours muscu (glucides péri-séance)

📄 [spec](docs/specs/functional/us/mn04-glucides-peri-seance.md) · catalogue **MN-04** ·
**📱 device** · ✅ aucune migration (les colonnes `training_bonus_mode` / `training_day_bonus`
préexistaient), aucune sync rule, **aucune nouvelle chaîne i18n** → recettable sur l'APK existant.

- [ ] 1. **Jour de repos** : cibles macro **identiques à avant** cette US.
- [ ] 2. **Jour de séance muscu** (bonus forfait) : la cible **glucides** augmente visiblement ;
      **protéines et lipides ne bougent pas**.
- [ ] 3. **Jour de course** (bonus auto) : même effet, cohérent avec la dépense réelle de la course.
- [ ] 4. **Macros manuelles actives** → **aucun** changement, quel que soit le bonus du jour.
- [ ] 5. Un jour de séance, les **3 barres macro** (grammes cibles) **totalisent** l'objectif
      calorique affiché en haut de l'écran. *Ce n'était pas le cas avant cette US — critère central.*
- [ ] 6. **Mode avion** : fonctionne normalement (calcul local).
- [ ] 7. **Cohérence entre les deux surfaces** : le widget d'accueil « nutrition » et l'écran
      Nutrition affichent **la même cible**.
- [ ] 8. **Pendant une période « vie réelle »** (VIE-01) : la cible du jour suit la règle de VIE-01,
      **mais l'écran de réglage de l'objectif continue d'afficher la cible du `cut`** — la
      distinction cible-du-jour / réglage-de-l'objectif est voulue, pas un oubli.

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 43. MR-08 — Interférence concurrent training

📄 [spec](docs/specs/functional/us/mr08-interference-concurrent-training.md) · catalogue **MR-08** ·
**📱 device** · ✅ aucune migration, aucune sync rule → recettable sur l'APK existant.
🔴 **Surface déplacée par INSIGHTS-02** : carte d'insight `concurrent_interference` sur l'**écran
Insights**. **4ᵉ** de `INSIGHT_ORDER`, donc la plus facilement évincée des cinq — deux alertes
au-dessus d'elle suffisent à la masquer légitimement. Voir l'encadré en tête des §35-49.

- [ ] 1. Volume de course en **forte hausse** (> 1,3 × moyenne 4 sem) **et** tonnage muscu en **forte
      baisse** (< 0,8 ×) → carte visible, message cohérent avec le sens « course en hausse ».
- [ ] 2. Situation **inverse** (muscu en hausse, course en baisse) → carte visible, **message
      inversé**. *Le sens du message est le vrai enjeu de cette recette.*
- [ ] 3. Les deux piliers **stables**, ou évoluant **dans le même sens** → **aucune** carte.
- [ ] 4. Un des deux piliers **sans historique** sur 28 j → aucune carte.
- [ ] 5. `strength` **ou** `running` désactivé → aucune carte, quelle que soit la divergence
      calculée.
- [ ] 6. **Pendant une période « vie réelle »** : le signal **reste armé** (cf. §39 critère 7).
- [ ] 7. **Mode avion** : fonctionne normalement.
- [ ] 8. En **EN** : message grammatical **et sens cohérent** avec la direction détectée.
- [ ] 9. TalkBack énonce la carte comme un bloc cohérent.
- [ ] 10. Un dashboard personnalisé contenant encore `concurrent-training-interference` se résout
      sans trou ni doublon.

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 44. MUSC-12 — Densité d'entraînement (volume / temps)

📄 [spec](docs/specs/functional/us/musc12-densite-entrainement.md) · catalogue **MUSC-12** ·
**📱 device** · ✅ aucune migration, aucune sync rule, 1 clé i18n (`workout.summary.density`) →
recettable sur l'APK existant.

- [ ] 1. Après une séance terminée, le résumé affiche une ligne **Densité** cohérente avec les
      **Volume ÷ Durée** affichés juste au-dessus. *Le calcul doit se vérifier à la main sur l'écran.*
- [ ] 2. Une séance **sans série validée** affiche une densité de **0**, pas une ligne **absente**.
- [ ] 3. La densité respecte la **préférence d'unité** (kg / lb) comme le reste de l'écran.
- [ ] 4. **Mode avion** : fonctionne normalement.
- [ ] 5. En **EN** : libellé **et formatage** cohérents (séparateur décimal compris).
- [ ] 6. TalkBack énonce la ligne comme un ensemble cohérent (libellé + valeur + unité).

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 45. MUSC-19 — Tonnage cumulé (lifetime / annuel)

📄 [spec](docs/specs/functional/us/musc19-tonnage-cumule.md) · catalogue **MUSC-19** ·
**📱 device** · ✅ aucune migration, aucune sync rule → recettable sur l'APK existant.
Surface : écran **Progression**, famille i18n `progress.lifetimeTonnage.*`.

- [ ] 1. L'écran Progression affiche un total **à vie** et un total **« cette année »** cohérents
      avec l'historique réel des séances **terminées**.
- [ ] 2. Compte neuf sans séance → **`0 kg` aux deux endroits**, pas une section absente.
- [ ] 3. Un compte au-delà de **1 000 000 kg** cumulés affiche le **badge** ; un compte en dessous
      ne l'affiche pas.
- [ ] 4. **Mode avion** : la section s'affiche normalement.
- [ ] 5. En **EN** : libellés **et séparateurs de milliers** cohérents avec la langue.
- [ ] 6. TalkBack énonce la section comme un bloc cohérent.

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 46. MUSC-20 — Régularité & consistance d'entraînement

📄 [spec](docs/specs/functional/us/musc20-regularite-entrainement.md) · catalogue **MUSC-20** ·
**📱 device** · ✅ aucune migration, aucune sync rule → recettable sur l'APK existant.
Surface : écran **Progression**, famille i18n `progress.regularity.*`.

- [ ] 1. Un utilisateur avec un **programme planifié** voit ses **3 métriques** cohérentes avec son
      historique réel des 4 dernières semaines.
- [ ] 2. Un utilisateur **« séance libre » sans planning** voit **uniquement l'écart-type des
      intervalles**, les deux autres métriques marquées **indisponibles** — **jamais un chiffre
      inventé**. *Critère le plus important : c'est la règle « aucune affirmation sans chiffre ».*
- [ ] 3. Compte neuf → **état vide explicite**, pas une section absente ni un calcul sur zéro donnée.
- [ ] 4. Un taux de séances tenues **bas** ne déclenche **aucune alerte** et **aucun ton négatif**.
- [ ] 5. **Mode avion** : fonctionne normalement.
- [ ] 6. En **EN** : libellés et pourcentages cohérents.
- [ ] 7. TalkBack énonce la section comme un bloc cohérent.

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 47. NUTR-18 — Bilan calorique hebdomadaire

📄 [spec](docs/specs/functional/us/nutr18-bilan-calorique-hebdo.md) · catalogue **NUTR-18** ·
**📱 device** · ✅ aucune migration, aucune sync rule, 2 clés i18n (`stats.adherence.balance`,
`stats.adherence.aboveBelow`) → recettable sur l'APK existant.
ℹ️ **Deux lignes ajoutées à la carte Adhérence existante** (NUTR-10), pas un écran neuf.

- [ ] 1. La carte **Adhérence** affiche un bilan **cumulé** cohérent avec les apports et l'objectif
      **effectif** des jours **loggés** de la fenêtre sélectionnée.
- [ ] 2. Le décompte **jours au-dessus / en dessous** est cohérent avec les jours effectivement
      au-dessus ou en dessous de l'**objectif** — ⚠️ **pas de la marge de NUTR-10**. *Les deux
      chiffres peuvent donc légitimement diverger de l'adhérence affichée juste au-dessus : c'est
      voulu, ne pas le remonter comme une incohérence.*
- [ ] 3. Basculer **7 j ↔ 30 j** recalcule les deux nouvelles lignes **sans latence perceptible**.
- [ ] 4. **Sans objectif configuré** : **aucune** des 2 lignes n'apparaît.
- [ ] 5. **Mode avion** : fonctionne normalement.
- [ ] 6. En **EN** : **signe** (+ / −) et libellés cohérents.
- [ ] 7. **Pendant une période « vie réelle »** : les deux lignes restent **vraies et annotées**,
      jamais amputées (décision D2 de VIE-01).

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 48. RN-03 — Ajustement auto du TDEE selon le volume de course

📄 [spec](docs/specs/functional/us/rn03-tdee-ajuste-course.md) · catalogue **RN-03** ·
**📱 device** · ✅ aucune migration, aucune sync rule → recettable sur l'APK existant.
🔴 **Surface déplacée par INSIGHTS-02** : carte d'insight `activity_level` sur l'**écran Insights**.
**Dernière** de la famille `alert` dans `INSIGHT_ORDER` — donc la plus souvent évincée. Et
🔴 **la seule des cinq à être mise en sourdine pendant une période « vie réelle »**
(`REAL_LIFE_MUTED_INSIGHTS`) : ce n'est pas un garde-fou de sécurité, et apprendre d'une fenêtre
atypique proposerait un réglage à refaire au retour.

- [ ] 1. Profil **`sedentary`**, ≥ 6 courses distinctes sur 14 j → suggestion vers un **palier
      supérieur**, message cohérent avec le nombre de jours **réellement** courus.
- [ ] 2. Profil **`active`**, **0 course** sur 14 j → suggestion **à la baisse**.
- [ ] 3. Fréquence de course correspondant **déjà** au palier déclaré → **aucune** carte.
- [ ] 4. **Nutrition désactivée** → aucune carte, quelle que soit la fréquence de course.
- [ ] 5. **`manualCalories` actif** → la carte **reste visible** si l'écart existe (D3 / R6).
      *Contre-intuitif : à vérifier explicitement.*
- [ ] 6. **Jamais** de suggestion vers **`very_active`**, même à 7+ courses/semaine sur toute la
      fenêtre.
- [ ] 7. 🔴 **Pendant une période « vie réelle »** : la carte est **silencieuse**, et elle
      **réapparaît** à la fin de la période si l'écart persiste. *C'est le comportement inverse des
      §39, §41 et §43 — le distinguer est tout l'intérêt de ce critère.*
- [ ] 8. **Mode avion** : fonctionne normalement.
- [ ] 9. En **EN** : message grammatical, libellés de palier **cohérents avec l'écran profil
      nutrition** (mêmes mots aux deux endroits).
- [ ] 10. TalkBack énonce la carte comme un bloc cohérent.
- [ ] 11. Un dashboard personnalisé contenant encore `activity-level-suggestion` se résout sans trou
      ni doublon.

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

---

## 49. GARDE-01 — Garde-fou unifié charge & récupération (ex TRI-12 + MR-14)

📄 [spec](docs/specs/functional/us/garde01-fusion-garde-fou-charge-repos.md) · catalogue **TRI-12** +
**MR-14** · **📱 device** · ✅ aucune migration, aucune sync rule, **aucun seuil ni texte modifié** →
recettable sur l'APK existant.
🔴 **Surface déplacée par INSIGHTS-02** : carte d'insight `overtraining_guard`, **1ʳᵉ de
`INSIGHT_ORDER`** — c'est celle qui évince les autres, jamais l'inverse.
ℹ️ **Cette liste remplace celles de TRI-12 (§8) et MR-14 (§11)**, toutes deux passées à `close` :
leurs critères décrivaient deux cartes et un masquage mutuel qui **n'existent plus**.

- [ ] 1. Streak ≥ 6 j de charge **et** ≥ 4 jours sur 7 en déficit ≥ 15 % → niveau **surcharge**
      (titre « Signal de surcharge », message et recommandation enrichis).
- [ ] 2. Streak ≥ 6 j de charge, apports **dans la cible** → niveau **repos** (titre « N jours sans
      repos »). *Comportement **nouveau** : TRI-12 seule n'affichait rien dans ce cas.*
- [ ] 3. **Nutrition désactivée**, streak ≥ 6 j → niveau **repos**, **jamais** le niveau surcharge.
- [ ] 4. Streak **< 6 j** → aucune carte, quel que soit le déficit.
- [ ] 5. `strength` **ou** `running` désactivé → aucune carte.
- [ ] 6. 🔴 **Le déficit passe sous son seuil pendant la session** (on log un repas) → la carte **ne
      change pas de place** et **ne disparaît pas** : seul son **texte** retombe au niveau repos.
      *C'est le défaut que cette US corrige — **le critère le plus important de la liste**.*
- [ ] 7. Le nombre de jours affiché au niveau **repos** correspond au streak réel. ⚠️ **Au niveau
      surcharge, il n'y a volontairement pas de compteur** (« Signal de surcharge ») : le titre de
      TRI-12 n'en a jamais eu et D3 le conserve tel quel — **ce n'est pas un bug, ne pas le remonter
      comme tel.**
- [ ] 8. Un jour **sans RPE** renseigné ne compte pas comme repos s'il existe une autre séance à
      charge ce jour-là.
- [ ] 9. Un jour de nutrition **non loggé** ne fait pas à lui seul retomber sous le seuil de 4 jours.
- [ ] 10. ⚠️ **Jour de repos en cours** (streak ≥ 6 jusqu'à hier, rien fait aujourd'hui) → la carte
      est **encore visible**. **Comportement conservé tel quel** de MR-14 §9, hors périmètre : le
      corriger demanderait de changer la sémantique de `computeStreak` pour TRI-01 aussi.
      **Ne pas le remonter comme un défaut.**
- [ ] 11. **Pendant une période « vie réelle »** : le signal **reste armé** (cf. §39 critère 7).
- [ ] 12. Aucun trou dans la grille du dashboard, en affichage **et** en mode édition.
- [ ] 13. Un dashboard personnalisé d'**avant** cette US (contenant `load-streak-alert`) ou d'avant
      INSIGHTS-02 (contenant `overtraining-guard`) retrouve ses widgets, **sans trou ni doublon**.
- [ ] 14. **Mode avion** : fonctionne normalement.
- [ ] 15. En **EN** : les **deux niveaux** sont grammaticaux.
- [ ] 16. TalkBack énonce la carte comme un bloc cohérent, **à chacun des deux niveaux**.

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec **et** dans celles de TRI-12 /
MR-14 si besoin, catalogue à ✅, et **on supprime sa section ici**. Passe par
[`/commit`](.claude/commands/commit.md).

---

## 50. FUEL-01 — Socle glucidique du coureur (g/kg selon la charge)

📄 [spec](docs/specs/functional/us/fuel01-socle-glucidique-coureur.md) · catalogue **RN-05** +
**RN-06** · **📱 device** · ✅ aucune migration, aucune sync rule, aucune dépendance native →
**recettable sur l'APK existant**.
ℹ️ **Ligne ajoutée à une carte existante**, pas un écran neuf : la carte « Protéines par kg » de
Nutrition › Stats devient **« Macros par kg »** et porte les deux macros (décision D2 — zéro bloc
ajouté à un écran déjà à 8 quand ADR-007 en prévoit 4-5).

- [ ] 1. Coureur ~70 kg, **2 h de course** sur les 7 derniers jours, journal renseigné → la carte
      affiche une ligne **Glucides** avec la référence **3-5 g/kg** (volume léger).
- [ ] 2. Même compte, **7 h de course** sur 7 jours → la référence passe à **7-10 g/kg** (gros
      volume). *C'est le test qui prouve que les paliers de durée fonctionnent.*
- [ ] 3. **Aucune course** sur 7 jours → la ligne Glucides **disparaît**, la ligne Protéines
      **reste**. Pas de « 0 g/kg », pas de carte vide.
- [ ] 4. **Poids de corps absent** (aucune pesée, rien au profil) → ligne Glucides masquée.
- [ ] 5. **Pilier course désactivé** → ligne Glucides masquée, quelles que soient les données.
- [ ] 6. 🔴 **La cible glucides du journal n'a pas bougé** : ouvrir l'onglet Nutrition et vérifier que
      les grammes cibles sont **identiques à avant cette US**, et que les 3 barres macro totalisent
      toujours l'objectif calorique. *Critère central — il vérifie la décision D1 et protège la
      recette de MN-04 (§42 critère 5). Si celui-ci échoue, tout le reste est sans objet.*
- [ ] 7. Journée avec un **fractionné planifié** → mention « Journée dure ». Avec une **endurance** →
      « Journée facile ». **Sans séance planifiée** → « Aucune course planifiée aujourd'hui ».
- [ ] 8. Journée avec une **course libre** → **aucune mention** de journée (ni dure, ni facile, ni
      repos). ⚠️ **Ce n'est pas un oubli d'affichage** (D4) : une course libre n'a pas de type en
      base, et le deviner serait inventer une donnée.
- [ ] 9. 🔴 **Relecture par un pratiquant d'endurance** : les 3 fourchettes (**3-5 / 5-7 / 7-10
      g/kg**) et les 2 seuils de durée (**3 h**, **6 h**) sont-ils crédibles ? ⚠️ **Critère de
      jugement, pas de manipulation** — un seuil faux produit un chiffre plausible, donc invisible en
      recette fonctionnelle (leçon des coefficients DOTS, §29 critère 21). Les 5 valeurs sont des
      constantes nommées (`CARB_TARGETS_G_PER_KG`, `CARB_LOAD_THRESHOLDS_H`) : les corriger est une
      ligne, pas un chantier.
- [ ] 10. Un jour de journal **non renseigné** dans la fenêtre ne fait pas chuter les g/kg affichés.
- [ ] 11. Basculer **7 j ↔ 30 j** : la ligne reste cohérente. ⚠️ Sur 30 j la charge est ramenée à son
      **équivalent hebdomadaire** (R6 bis) — 20 h sur 30 jours ≈ 4,7 h/semaine, donc « volume
      modéré », **pas** « gros volume ». Sans cette normalisation, tout un mois basculerait au
      palier haut.
- [ ] 12. **Mode avion** : la carte s'affiche et se calcule normalement.
- [ ] 13. En **EN** : les 3 libellés de volume, les 3 de journée et la référence sont grammaticaux ;
      le séparateur décimal suit la langue.
- [ ] 14. TalkBack énonce la ligne Glucides comme **un seul bloc cohérent** (macro + valeur +
      référence + statut), pas des fragments disjoints.
- [ ] 15. **Période « vie réelle » active** → la ligne reste affichée normalement. Ce n'est ni un
      reproche ni un objectif : c'est un fait mesuré et un repère physiologique.

**Quand l'US passe** : `etape: close` dans le front-matter de sa spec, catalogue RN-05/RN-06 à ✅
(déjà fait), et **on supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md).

---

## Comment procéder

**La très grande majorité se recette sur le même APK.** Sans dépendance native neuve :
BIEN-01, MESUR-01, NUTR-F2, STREAK-01, UX-LOT-01, OBJ-01, BILAN-01, UX-05, MUSC-F14,
**PARTAGE-01**, **MUSC-F1b**, **RUN-14**, **NUTR-16**, **MUSC-09**, **INSIGHTS-01**, **INSIGHTS-02**,
**COLLIS-01**, **VIE-01**, **DOUL-01**, **REPAS-01** — et les **14 sections ajoutées le 06/08/2026**
sauf une : **RUN-F1b, RUN-F2b, RUN-18, META-19, MUSC-F15, TRI-03, MN-04, MR-08, MUSC-12, MUSC-19,
MUSC-20, NUTR-18, RN-03, GARDE-01** (calcul pur, `react-native-svg` déjà en place)
(+ les 2 critères navigateur d'ADMIN-01 et CONTENU-01).

✅ **Toutes les sync rules sont déployées au 06/08/2026** (voir le prérequis en tête, une case par
collage) : le piège qui faisait échouer MESUR-01, STREAK-01 et OBJ-01 pour une raison étrangère à
leur code n'existe plus.

⚠️ **Les trois exceptions, qui exigent un APK précis** :
- **MUSC-F9** — `expo-haptics` (01/08/2026) ;
- **RUN-F2a** (§36) et **RUN-F2d** — `expo-speech` (02/08/2026) ;
- **LAUNCHER-01** — `react-native-android-widget` (voir l'encadré dédié ci-dessous).

Les quatre paquets sont bien déclarés dans [`apps/mobile/package.json`](apps/mobile/package.json), et
le build du **03/08/2026** est postérieur aux trois premiers — il **devrait** donc tous les embarquer.
🔴 **« Devrait » n'est pas « embarque »** : les APK ne sont pas versionnés, le dépôt ne peut pas le
prouver. **Vérifie-le en 30 secondes avant de dérouler une liste** — une annonce audio qui sort
(§36 critère 2) et une vibration au glisser-déposer suffisent. Sans ça, on recette dix critères contre
un module absent, et l'échec est **silencieux**.

**ADMIN-01 se recette au navigateur**, indépendamment du build.

### ✅ Le second build pour PARTAGE-01 est fait (29/07/2026)

`react-native-view-shot` (5.1.0) est une **dépendance native** : l'APK devait être reconstruit pour
que la capture d'image existe. C'est le cas — le dev build du **29/07/2026** est postérieur à
PARTAGE-01 et embarque le module (vérifié : `project :react-native-view-shot` présent dans le
`debugRuntimeClasspath`). **PARTAGE-01 se recette donc avec les neuf autres, sur le même APK.**

> ⚠️ **Piège rencontré ce jour-là, à retenir.** Le dossier `apps/mobile/android/` n'est pas
> versionné : après un `git pull` qui touche `app.json` ou un plugin natif, il reste tel quel et le
> build échoue sur une incohérence héritée (ici `minSdkVersion 24` contre les 26 exigés par
> `androidx.health.connect`, alors que `expo-build-properties` déclarait bien 26). Le réflexe :
> `npx expo prebuild --platform android --clean` avant de rebuilder.

### ⚠️ LAUNCHER-01 exige son propre build (03/08/2026), distinct des dix ci-dessus

`react-native-android-widget` est une **dépendance native neuve**, absente de tous les APK
précédents. Un build dédié a été fait le 03/08/2026 (spike de compatibilité + contenu réel) —
**c'est l'APK à utiliser pour recetter LAUNCHER-01**, pas un APK antérieur.

**Quand une US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

**Quand un critère échoue** : ne pas cocher, noter le constat sous le critère. Si c'est un défaut
réel, il devient une entrée de [BACKLOG.md](BACKLOG.md) ou un correctif sur la branche de l'US.

---

## 54. HORAIRE-01 — Heure d'une séance planifiée et convocation

Spec : [horaire01-heure-seance-planifiee.md](docs/specs/functional/us/horaire01-heure-seance-planifiee.md) ·
roadmap **2.4** (🟡 → ✅ le 12/08/2026).

> 🔴 **Le critère 4 est le plus important, et c'est le seul qui vérifie une NON-action.** Une
> notification « ça commence dans 30 min » reçue **après** le début est pire que pas de notification :
> c'est ce que la règle R3 empêche, et un test de scheduler le couvre — mais seul un device dit si la
> chaîne complète (calcul → programmation → Android) se comporte pareil.
>
> ⚠️ **La précision n'est pas garantie**, et c'est un choix assumé (décision D5) : pas de permission
> `SCHEDULE_EXACT_ALARM`, parce qu'elle est sensible au Play Store et que LANCE-00 est déjà sur le
> chemin critique. Un rappel qui arrive à 18 h 03 pour une séance de 18 h 30 **n'est pas un défaut**.
> Ne le remonter que s'il dérive de plus de ~10 minutes.
>
> ✅ **Aucune sync rule à déployer** — `planned_sessions` est lue en `select *`, la colonne descend
> seule. (Le cadrage affirmait le contraire ; c'était faux, corrigé le 12/08.)

### Saisie de l'heure — planning

- [ ] 1. Ouvrir la feuille d'actions d'une séance muscu planifiée : la section « Heure de la séance »
      propose **Définir une heure**.
- [ ] 2. Appuyer : l'heure se pose à **18:00** et le sélecteur apparaît.
- [ ] 3. Les boutons **+ / −** des minutes avancent par pas de **5** ; ceux des heures par pas de 1.
- [ ] 4. 🔴 **Les minutes bouclent sans changer l'heure** : à 18:55, « + » donne **18:00** et non 19:00.
- [ ] 5. Les heures bouclent aussi : à 23:15, « + » donne **00:15**.
- [ ] 6. **Retirer l'heure** : la section repasse sur « Définir une heure ».
- [ ] 7. L'heure posée s'affiche **sur la ligne** du planning, au format `18:30` — **jamais**
      `18:30:00`.
- [ ] 8. Une séance **déjà faite** n'offre **pas** la section « Heure de la séance ».
- [ ] 9. L'avertissement de précision est visible sous le sélecteur.
- [ ] 10. En **anglais** : les 11 libellés sont traduits (dont « Hours » / « Minutes » et les libellés
      d'accessibilité des boutons).

### Le rappel — c'est là que ça compte

- [ ] 11. Poser une heure à **H+40 min** sur une séance muscu du jour → la notification arrive
      **autour de H+10** (soit 30 min avant), titre « Ta séance commence bientôt », corps
      « <nom> dans 30 min ».
- [ ] 12. 🔴 Poser une heure à **H+10 min** (convocation déjà passée) → **AUCUNE notification**, ni
      différée **ni immédiate**. C'est le critère qui protège R3.
- [ ] 13. **Non-régression** : une séance **sans heure** déclenche toujours le rappel d'échéance
      apprise (« Ta séance du jour t'attend »), comme avant cette US.
- [ ] 14. 🔴 **Jamais deux notifications** pour la même séance : après avoir posé une heure, on ne
      reçoit **pas** aussi l'échéance apprise.
- [ ] 15. Marquer la séance **faite** avant l'heure → aucune notification.
- [ ] 16. Désactiver **Rappel de séance** dans les réglages → aucune notification malgré l'heure.
- [ ] 17. Deux séances muscu le même jour, à deux heures différentes, toutes deux à venir → **une
      seule** notification, pour la **plus proche**.

### Persistance et offline

- [ ] 18. 🔴 Poser une heure, **fermer et relancer l'app** : l'heure est toujours là. (Si elle
      disparaît, c'est la panne de schéma que le test d'écriture-relecture couvre — mais un device
      reste la preuve finale.)
- [ ] 19. **Mode avion** : poser, modifier et retirer une heure fonctionne ; la notification se
      programme quand même.
- [ ] 20. Poser une heure sur l'appareil A → après synchro, elle apparaît sur l'appareil B *(si un
      second appareil est disponible ; sinon, cocher après vérification dans Supabase)*.
- [ ] 21. Déplacer la séance en **glisser-déposer** vers un autre jour : l'heure **suit** la séance.

---

## 55. Rejets de promesse non capturés — 13 correctifs (`fix/promesses-non-capturees`)

Commit `46a6692` · garde-fou :
[`no-uncaught-void-then.test.ts`](apps/mobile/src/lib/__tests__/no-uncaught-void-then.test.ts).

> **Ce n'est pas une US, et la recette est surtout de la NON-RÉGRESSION.** Treize chaînes
> `void … .then(…)` ont reçu un `.catch`. Dans douze cas sur treize, le comportement visible est
> **inchangé** — c'est le rejet non capturé qui disparaît, et il n'était visible que dans les logs
> natifs. Il n'y a donc rien de nouveau à admirer : il faut vérifier que **rien n'a bougé** sur des
> chemins que ces correctifs traversent tous.
>
> 🔴 **La seule exception, et c'est le critère 1 : le démarrage de l'app.** `auth-store` a changé de
> comportement en cas d'échec — c'est le seul correctif qui répare un vrai blocage.
>
> ⚠️ **Un critère est difficile à provoquer honnêtement** (le 2) : forcer `getSession()` à rejeter
> demande de corrompre le stockage sécurisé. S'il n'est pas reproductible, **le cocher « non
> testé »** plutôt que de le supposer bon — un test unitaire ne couvre pas ce chemin natif.

### Démarrage — le seul changement de comportement

- [ ] 1. **Non-régression** : lancer l'app avec une session valide → on arrive normalement sur
      l'accueil, sans écran de chargement prolongé.
- [ ] 2. 🔴 *(si reproductible)* Provoquer un échec de lecture de session — **désinstaller /
      réinstaller** puis lancer **en mode avion**, ou vider le stockage de l'app. Attendu :
      l'app arrive sur **l'écran de connexion**, et **ne reste pas bloquée** sur le chargement.
      Avant ce correctif, elle y restait **indéfiniment**.
- [ ] 3. **Lien magique / réinitialisation de mot de passe** : ouvrir le lien reçu par e-mail →
      la connexion aboutit comme avant (`useAuthDeepLink`).

### Interrupteurs de piliers — l'ancienne panne CYCLE-01

- [ ] 4. **À l'onboarding** : activer et désactiver chaque pilier → l'interrupteur suit, et l'état
      persiste après un aller-retour d'écran.
- [ ] 5. **Dans les réglages** : même vérification. *(C'est le code où vivait la panne CYCLE-01 :
      l'interrupteur restait éteint sans message quand l'écriture échouait.)*
- [ ] 6. Désactiver un pilier → son onglet **disparaît** de la navigation ; le réactiver → il revient.

### Journal nutrition — les trois sites

- [ ] 7. **Copier la journée d'hier** sur un jour vide : les entrées arrivent. Sur un hier **vide** :
      l'alerte « rien à copier » s'affiche toujours.
- [ ] 8. **Copier un repas depuis hier** : même double vérification (avec et sans contenu).
- [ ] 9. **Enregistrer un repas comme modèle** : l'alerte de confirmation s'affiche, et le modèle est
      réutilisable.

### Le reste des chemins touchés

- [ ] 10. **Éditer un aliment perso** : le formulaire **se remplit** avec les valeurs existantes
      (`food-custom`). ⚠️ Voir la réserve ci-dessous.
- [ ] 11. **Résumé de fin de séance** : terminer une séance muscu → le résumé s'affiche
      (`workout-summary`).
- [ ] 12. **Cycle** : clôturer une période en cours → elle se ferme et la vue se met à jour.
- [ ] 13. **Réglages / Health Connect** : l'état affiché (connecté, permissions, indisponible) est
      correct, et se rafraîchit au retour en avant-plan.
- [ ] 14. **Notifications** : refuser la permission système → le **bandeau d'information** s'affiche
      bien dans les réglages. *(Correctif réel : un échec d'interrogation vaut désormais « non
      accordée », alors qu'il laissait le bandeau masqué.)*

### ⚠️ Réserve connue, à ne PAS remonter comme un défaut

- **`food-custom` (critère 10) : si le chargement échoue, le formulaire reste vide** — et
  enregistrer écraserait alors l'aliment par du vide. Le `.catch` posé **ne corrige pas** ce
  comportement, il évite seulement le rejet non capturé. Un repli propre demande un état d'erreur à
  l'écran et le blocage de l'enregistrement → **inscrit au [BACKLOG](BACKLOG.md)** (🟠), même famille
  que le `loadError` d'`ExerciseEditScreen`.

---

## 56. RUN-F4 — La séance de course porte enfin sa consigne

> [Spec](docs/specs/functional/us/runf4-seances-structurees.md) · Roadmap 5.36 → 5.39 ·
> Branche `feature/run-seances-structurees` · Livré le **05/09/2026**
>
> Origine : [analyse du 04/09/2026](docs/product/analyse-seances-structurees-running.md).
> 10 lots livrés en une passe, à ta demande, retours reportés à cette recette.

### 🔴 AVANT TOUT — deux étapes manuelles, sinon rien ne marche

- [x] 0a. ~~`npm run db:push` puis `npm run db:types`~~ — **fait par Florian le 09/09/2026.**
      `db:push:dry` répond « Remote database is up to date », et les types régénérés contiennent
      bien les 2 tables et les colonnes RUN-F4.
- [ ] 0b. **Déployer 2 sync rules à la main** dans le dashboard PowerSync (`run_intervals`,
      `session_translations`) depuis
      [powersync-sync-rules.yaml](docs/specs/technical/powersync-sync-rules.yaml).
      ⚠️ Étape **oubliée trois fois** au registre : sans elle, tout reste local et ne remonte
      jamais, **sans aucune erreur visible**.
- [ ] 0c. 🔴 **L'APK doit être construit depuis le commit `421e948` ou plus récent.**
      Aucune dépendance native neuve — donc **pas besoin d'un nouveau dev build EAS** — mais le
      JS est figé dans l'APK release : un APK plus ancien ne contient **rien** de RUN-F4, et la
      recette porterait sur l'app d'avant.

      ```powershell
      Remove-Item -Force -ErrorAction SilentlyContinue `
        apps/mobile/android/app/build/generated/assets/react/release/index.android.bundle, `
        apps/mobile/android/app/build/intermediates/assets/release/mergeReleaseAssets/index.android.bundle
      cd apps/mobile/android ; .\gradlew.bat assembleRelease
      ```

      ⚠️ **La purge du bundle n'est pas optionnelle** : Gradle ne déclare pas `packages/shared`
      comme entrée, se croit à jour et réemballe l'ancien JS — `BUILD SUCCESSFUL` avec le
      correctif absent (piège documenté, deux itérations perdues en recette de CONF-06).
      Contrôle avant d'envoyer l'APK, depuis la racine :

      ```powershell
      Select-String -SimpleMatch -Pattern "intervalsF4" `
        apps/mobile/android/app/build/generated/assets/react/release/index.android.bundle
      ```

      Rien en retour = le bundle est l'ancien, recommence.

### Lot A — l'allure cible saisie (le cœur)

- [ ] 1. Éditer une séance de programme running : les champs **Allure cible** (deux bornes),
      **RPE cible**, **Consigne** et **Critère d'adaptation** sont présents.
- [ ] 2. Saisir `4:05` et `4:10` → quitter le champ → rouvrir l'écran : **les valeurs sont
      toujours là** (c'est le test de la panne d'écriture silencieuse).
- [ ] 3. Saisir **une seule** borne (`4:00`) → elle est acceptée et s'affiche telle quelle.
- [ ] 4. Saisir les bornes **à l'envers** (`4:10` puis `4:05`) → l'app les remet dans l'ordre.
- [ ] 5. Saisir n'importe quoi (`abc`) → le champ **revient à sa valeur d'origine**, la consigne
      existante n'est pas effacée.
- [ ] 6. Vider les deux bornes → l'allure **redevient dérivée** de l'allure de réf. 5 km.

### Lot B — segments typés, et le verrou levé

- [ ] 7. Sur une séance **d'endurance** (pas fractionné) : le bouton **« + Ajouter un segment »
      est présent**. *(C'était impossible avant : c'est le changement le plus structurant.)*
- [ ] 8. Créer un segment **Échauffement** de 12 min, un **Corps** 8×400 m, un **Retour au
      calme** 8 min → les trois s'affichent dans l'ordre avec leur nature.
- [ ] 9. Choisir une **nature de récupération** (Trot / Marche) → elle se garde.

### Lot C/D — chrono cible et groupes

- [ ] 10. Sur un segment 400 m, saisir un **chrono cible** `1:38` → la distance **et** le chrono
      coexistent (avant, c'était l'un OU l'autre).
- [ ] 11. Créer deux segments qui se suivent avec le **même groupe** (`g1`) et **3 répétitions**
      → au démarrage de la course, le guidage annonce bien **3 passages** des deux fractions.

### Lot E — piloter à l'allure (⚠️ demande de sortir courir)

- [ ] 12. Démarrer une séance qui porte une allure cible → **« Allure cible »** s'affiche sous les
      allures, avec la plage.
- [ ] 13. Courir nettement trop lentement → l'allure instantanée **passe en teinte d'accent** et
      une annonce vocale dit l'écart. ⚠️ **Jamais en rouge** : hors plage n'est pas une faute.
- [ ] 14. Rester hors plage longtemps → l'annonce **ne se répète pas** en boucle.
- [ ] 15. ⚠️ **Juge le seuil de tolérance (5 s/km)** : trop bavard ? pas assez réactif ?
      C'est le **seul nombre inventé** du lot, il attend ton verdict terrain.

### Lot F — le réalisé par répétition (⚠️ demande une séance de fractionné réelle)

- [ ] 16. Faire une séance structurée → au résumé, la section **« Fraction par fraction »**
      liste chaque fraction avec son allure prévue et réalisée.
- [ ] 17. Les fractions **hors plage** ressortent en accent.
- [ ] 18. **Allure moyenne**, **régularité (± x s/km)** et **« X sur Y dans la plage »** s'affichent.
- [ ] 19. **Quitter l'écran de suivi pendant la séance puis y revenir** → au résumé, il n'y a
      **ni doublon ni trou** dans les fractions. *(Les fractions rattrapées peuvent afficher
      « — » en allure : c'est **voulu**, la durée par fraction n'est pas mesurable dans ce cas.)*
- [ ] 20. Une **course libre** n'affiche **pas** cette section (et non une section vide).

### Lot G/H — test, course, échéance

- [ ] 21. Les types **« Test chronométré »** et **« Course objectif »** apparaissent au choix du
      type de séance (app **et** back-office).
- [ ] 22. Sur ces deux types seulement, le champ **Objectif chrono** apparaît.

### Non-régression (le plus important)

- [ ] 23. Une séance de fractionné **créée avant cette US** s'affiche et se joue **exactement
      comme avant** (blocs, %VMA, guidage vocal).
- [ ] 24. **Dupliquer un programme** running → la copie garde allures, consignes et segments.
      La **date de course n'est PAS recopiée** (voulu : on refait le plan sur une autre échéance).
- [ ] 25. Une séance **muscu** n'est pas affectée.
- [ ] 26. **Export RGPD** (Réglages → Exporter mes données) : le JSON contient bien
      `run_intervals` et `session_translations`.

### Migration de l'allure progressive (poussée le 09/09)

- [x] 27. ~~`npm run db:push` — `20260909120000_runf4_segment_progression`~~ — **fait par Florian
      le 09/09/2026** (`db:push:dry` : « Remote database is up to date », types régénérés).

### Surfaces posées le 09/09/2026 (à recetter aussi)

- [ ] 28. **Allure progressive** : sur un segment, cocher « Allure progressive » avec les bornes
      4:25 et 4:35 → en course, la cible **se déplace** de 4:35 vers 4:25 au fil du segment
      (au lieu de rester une fourchette).
- [ ] 29. **Carte « séance du jour »** (hub course) : elle n'apparaît **que** si un signal est
      actif (douleur déclarée sur une zone de course, énergie basse, charge en zone risque,
      grosse séance de jambes hier). ⚠️ Elle doit dire explicitement qu'elle **ne modifie rien**.
- [ ] 30. **Carte « J-42 »** : renseigner une date de course sur un programme (édition →
      *Date de la course*, format `2026-10-25`) → le détail du programme affiche le compte à
      rebours, et « Semaine d'affûtage » dans les 7 derniers jours.
- [ ] 31. **Taux de réalisation** : après avoir posé le programme au calendrier, la carte affiche
      « X séances sur Y ». Une séance **sautée** doit compter au dénominateur, pas au numérateur.
- [ ] 32. **Plan de passage** : sur une séance de type *Course objectif* avec distance + chrono,
      « Générer un plan régulier » → la liste des km avec leur temps de passage cumulé.
- [ ] 33. **Back-office** : sur une séance de course d'un programme éditorial, les champs
      Allure cible / RPE / Consigne / Critère d'adaptation sont présents et s'enregistrent.
      L'objectif chrono n'apparaît que sur *Test* et *Course objectif*.

### Traductions de séance — back-office (ajouté le 09/09)

- [ ] 34. Sur une séance d'un programme éditorial, les champs **Nom de la séance (EN)** et
      **Consigne (EN)** sont présents et s'enregistrent.
- [ ] 35. Renseigner le nom EN, puis **basculer l'app mobile en anglais** → la séance s'affiche
      avec son nom anglais. Repasser en français → le nom français revient.
- [ ] 36. **Laisser le champ EN vide** → la séance s'affiche avec son nom français en anglais
      aussi (repli), et **jamais** un nom vide.

### 🟡 Ce qui n'est PAS à recetter — et pourquoi

Le lot RUN-F4 est **complet** : les 10 lots et les 15 murs de l'analyse sont traités. Restent
deux exclusions, toutes deux extérieures à cette US :

- **La règle « chaleur »** (lot J) ne se déclenchera **jamais** : la météo est RUN-F3b, bloquée
  avant lancement sur l'arbitrage de confidentialité. La règle est écrite et testée, aucune
  source ne l'alimente. C'est voulu.
- **FC, cadence, foulée** (mur M14) : tranché avant cette US (V2 wearables, RUN-23/RUN-24 du
  catalogue). Rien à chercher de ce côté.

---

## 57. MUSCU-UX01 — Refonte UX du pilier Musculation (`feature/muscu-refonte-ux`)

> Spec : [muscu-ux01-refonte-pilier-musculation.md](docs/specs/functional/us/muscu-ux01-refonte-pilier-musculation.md) ·
> Audit : [audit-ux-2026-09.md](docs/refonte-muscu/audit-ux-2026-09.md) ·
> Maquettes : [design/refonte-muscu-2026-09/](design/refonte-muscu-2026-09/) (19 planches avant/après).
> **Aucune migration, aucune sync rule à déployer.** Recettable dès qu'un build embarque la branche.
>
> ⚠️ **Cette US touche les cinq écrans du pilier.** Elle a été développée dans un worktree isolé,
> en parallèle de `feature/accueil-refonte` : au merge, vérifier que l'accueil n'a pas bougé.

### Le hub muscu — quatre états, un seul à la fois

- [ ] 1. **Aucun programme actif** : le hub propose « Choisis un programme » en **action
      principale**, avec trois programmes suggérés dessous. « Séance libre » reste accessible,
      en second. ⚠️ C'est l'inverse d'avant — si « Séance libre » domine encore, c'est un défaut.
- [ ] 2. **Compte neuf** : aucune tuile vide. Le hub tient en **un écran ou peu s'en faut**
      (il en faisait 2,4 avant). Les widgets Historique et Progression n'apparaissent qu'une
      fois une séance faite.
- [ ] 3. **Séance prévue aujourd'hui** : la carte donne le **nom**, les **trois premiers
      exercices**, le total (« + N autres ») et une **durée estimée**. Démarrer part bien sur
      cette séance.
- [ ] 4. **Séance en cours** : elle passe devant tout, avec son avancement (« 7/18 séries ») et
      une barre de progression. « Reprendre » rouvre la bonne séance.
- [ ] 5. **Jour de repos** (programme actif, rien aujourd'hui) : carte « Repos aujourd'hui » +
      la prochaine séance datée + deux sorties (planning, séance libre). ⚠️ **Cet état n'existait
      pas** : avant, on ne voyait que « Séance libre ».
- [ ] 6. **Séance du jour déjà faite** : la carte le dit et **ne repropose pas** de la démarrer.
- [ ] 7. **Barre de progression du programme** : « PPL 6 jours · semaine 3 sur 8 · 14/24 séances ».
      Vérifier que la semaine est juste après une séance faite, et qu'elle ne dépasse jamais la
      durée du programme.
- [ ] 8. Un tap dessus ouvre les programmes.

### Entrer dans un programme — le gain de six jours

- [ ] 9. Sur un programme **de la bibliothèque** : un seul bouton, « **Suivre ce programme** ».
      Ni « Dupliquer », ni « Démarrer » séparés.
- [ ] 10. L'appuyer crée la copie **en silence**, l'annonce **après** (« Copie personnelle
      créée »), et ouvre l'assistant sur **la copie** — pas sur l'original.
- [ ] 11. Un programme **sans séance** ne peut pas être suivi (bouton grisé).
- [ ] 12. **Assistant** : la date de début est **aujourd'hui** par défaut. « Lundi prochain » est
      à un tap. ⚠️ C'était « lundi prochain » d'office : un mardi, on attendait six jours.
- [ ] 13. **Les jours sont déjà proposés** et espacés (3 séances → L/M/V, 4 → L/M/J/V). Le bouton
      est actionnable **sans rien toucher**.
- [ ] 14. Déplacer une séance sur un autre jour : la suggestion cède, le choix est respecté.
- [ ] 15. Démarrer **aujourd'hui un mercredi** : les séances du lundi et du mardi de cette semaine
      **ne sont pas créées** (elles naîtraient « manquées »). La semaine suivante est complète.
      Le bouton annonce le bon compte, première semaine partielle comprise.
- [ ] 16. Après validation : on atterrit sur le **hub**, la carte du jour prête — plus sur le
      calendrier.
- [ ] 17. **Non-régression course** : planifier un programme de course fonctionne comme avant,
      et atterrit sur le hub course.

### La séance — la barre qui ne bouge pas

- [ ] 18. La saisie et « Valider la série » sont **fixées en bas de l'écran**, toujours visibles.
- [ ] 19. **Ouvrir le clavier ne les recouvre pas.** ⚠️ C'était le défaut principal : le bouton
      passait sous le clavier à chaque saisie de reps.
- [ ] 20. Les **steppers − / +** permettent de valider une série **sans ouvrir le clavier**.
- [ ] 21. **Valider produit un retour haptique** — discret. ⚠️ Il n'y en avait aucun.
- [ ] 22. La barre haute montre l'**avancement de la séance** (« 7/18 séries »), pas seulement le
      rang dans l'exercice.
- [ ] 23. **Changer de niveau d'affichage** (menu ⋮ → Épuré / Normal / Détaillé) : la zone du haut
      change, **la barre du bas ne bouge pas d'un pixel**. C'est la règle qui rend le réglage sûr.
- [ ] 24. Le **réglage du repos** n'est plus sur chaque série : il est dans le menu ⋮ et sur
      l'écran de repos.
- [ ] 25. **Série à la durée** (gainage) : les champs deviennent « durée » et « lest », le lest
      est facultatif (bordure pointillée) et peut rester vide.
- [ ] 26. **Poids de corps** (traction) : « reps » et « lest », lest facultatif.
- [ ] 27. **Superset** : après validation, on bascule sur le partenaire **sans repos**, le nom
      change dans la barre, et le bouton annonce « Valider — puis enchaîner ».
- [ ] 28. **Liste d'exercices** : taper le **nom** va à l'exercice ; taper le **chevron** déplie.
      ⚠️ Retaper l'exercice courant **ne le replie plus**.
- [ ] 29. **Écran de repos** : il annonce la série suivante et son exercice, et propose de passer
      durablement à un repos plus long sur cet exercice.
- [ ] 30. L'écran de repos est aux **couleurs du thème** (brun sombre), plus en bordeaux.
- [ ] 31. **Toutes les séries validées** : la barre du bas devient « **Terminer la séance** »,
      avec durée et séries. ⚠️ Avant, c'était un texte « Séance terminée ? » sans bouton.
- [ ] 32. **Écourter une séance** (il reste des séries à faire) : menu ⋮ → « Terminer la séance ».
      🔴 **Cas important** : sans ce chemin, la seule sortie serait d'abandonner et tout perdre.
- [ ] 33. La croix quitte **sans rien demander** et ramène au hub, où la séance est reprenable.
      Le libellé « Mettre en pause » a disparu (il nommait un état inexistant).
- [ ] 34. « Abandonner » (menu ⋮) demande toujours confirmation et supprime bien la séance.

### Le résumé de fin

- [ ] 35. Le résumé montre **ce que tu as fait**, exercice par exercice, avec les charges.
      ⚠️ Il ne montrait que cinq agrégats.
- [ ] 36. Chaque exercice porte son **écart depuis la dernière fois** (« ▲ +2,5 kg », « ▲ +1 rep »,
      « = »). Un exercice fait pour la **première fois** n'affiche **aucun** écart — surtout pas « = ».
- [ ] 37. Les statistiques tiennent en **une bande** (durée, séries, tonnage, kg/min).
- [ ] 38. Si la séance comptait des échauffements, la mention « N séries d'échauffement » apparaît.
- [ ] 39. Le **ressenti** propose cinq niveaux **nommés** (Facile → Max), plus des étoiles.
      Retaper le niveau déjà choisi l'efface.
- [ ] 40. Rouvrir le résumé plus tard : le ressenti choisi est **relu correctement**.
- [ ] 41. 🟡 **Séance ancienne** (notée avant cette US, en 1-5 étoiles) : son ressenti se relit
      dans les cinq niveaux **sans être aberrant** — un ancien « 5 étoiles » doit se lire « Solide »
      et non « Facile ». C'est un compromis assumé, faute de migration.
- [ ] 42. La note de séance est repliée derrière « Ajouter une note » quand il n'y en a pas.

### L'historique

- [ ] 43. Chaque ligne porte le **nom de la séance**, sa date, sa **durée**, son **tonnage** et son
      **nombre d'exercices**. ⚠️ Il n'y avait que date + durée + RPE.
- [ ] 44. Une séance libre est nommée « Séance libre » et porte le badge **LIBRE**.
- [ ] 45. Une séance avec record porte une pastille **🏆**.
- [ ] 46. Les séances sont **groupées par mois**, avec le cumul du mois en en-tête.
- [ ] 47. L'en-tête de l'écran annonce le total (« 32 séances · 214 t soulevées »).
- [ ] 48. **Filtre 7 j / 30 j / 90 j** : une séance faite il y a exactement 7 jours reste visible
      toute la journée (borne à minuit, pas 7×24 h glissantes).
- [ ] 49. Un filtre **sans résultat** affiche un message spécifique et un bouton pour le retirer —
      pas « Démarre ta première séance ».
- [ ] 50. 🔴 **Suppression** : appui long sur une séance → confirmation → elle disparaît de
      l'historique. Vérifier ensuite que **son tonnage n'est plus compté** et que ses **records
      ont disparu**.
- [ ] 51. 🔴 **Suppression d'une séance issue du planning** : le jour correspondant **redevient
      « à faire »** dans le calendrier. C'est l'effet le plus facile à casser.

### La progression

- [ ] 52. L'écran s'ouvre sur **trois onglets** : Vue d'ensemble · Par exercice · Mon corps.
      ⚠️ Il empilait huit sections en scroll continu.
- [ ] 53. **Vue d'ensemble** : volume, régularité, équilibre musculaire, exécution du programme,
      tonnage cumulé, records récents et temps d'entraînement.
- [ ] 54. **Par exercice** : le sélecteur, la courbe et les records fonctionnent comme avant, y
      compris l'arrivée depuis une fiche exercice (l'exercice est pré-sélectionné).
- [ ] 55. **Mon corps** : mensurations et module force (%1RM, DOTS, total SBD).
- [ ] 56. 🔴 **Les états vides** proposent « Démarrer une séance » et mènent au **hub muscu**.
      ⚠️ Ils menaient vers un écran « Aucune séance en cours » — un cul-de-sac, quatre fois.

### Transverse

- [ ] 57. **En anglais** : basculer la langue et reparcourir hub, séance, résumé, historique,
      progression. Aucune clé brute (`strengthHub.…`) ne doit apparaître.
- [ ] 58. **Accessibilité** : au lecteur d'écran, la barre d'action de séance annonce l'exercice,
      le rang de série et l'action. La barre de progression du programme est annoncée avec ses
      valeurs.
- [ ] 59. **Hors ligne** : couper le réseau, faire une séance complète, la terminer, la supprimer.
      Tout doit fonctionner ; la synchro rattrape au retour du réseau.

### Correctifs de la 1ʳᵉ passe de recette — 11/09/2026 (7 constats)

> ⚠️ Ces sept critères avaient été **cochés au développement** et sont tombés sur device. Les
> re-passer **avant** le reste de la section : deux d'entre eux masquaient un état entier.
>
> 🔴 **Deux défauts étaient la même panne, et la plus sournoise du dépôt** : une requête qui
> référence une colonne absente du schéma PowerSync local. `useQuery` avale l'erreur, `data` reste
> vide, et l'écran affiche son état « pas de donnée » — qui est un état légitime. Aucun crash,
> aucun log. Un test global (`sql-prepare-sweep.test.ts`) prépare désormais **les 162 requêtes**
> des repositories contre le schéma local : la classe entière ne peut plus repasser.

- [x] 60. 🔴 **§57.3 — la séance du jour s'affiche enfin.** Avec une occurrence muscu `planned`
      aujourd'hui, le hub doit montrer l'état B (nom, trois exercices, « + N autres », durée
      estimée), **pas** « Repos aujourd'hui ». ⚠️ L'état B était **inatteignable pour tout le
      monde depuis le premier jour** : `SELECT_TODAY_PLAN` lisait `e.name` alors que `exercises`
      n'a pas de colonne `name` (les noms vivent dans `exercise_translations`).
      Vérifier aussi qu'une séance **déjà faite** aujourd'hui donne bien « Séance du jour faite »,
      et un jour vide « Repos aujourd'hui » — les trois états se distinguent.
- [x] 61. 🔴 **§57.36 — les écarts s'affichent sur le résumé.** Refaire un exercice plus lourd ou
      avec plus de reps que la fois d'avant : la carte porte « ▲ +2,5 kg » ou « ▲ +1 rep ». ⚠️ Même
      panne : `SELECT_PREVIOUS_SETS` filtrait `w2.owner_id` là où `workouts` porte `user_id` —
      aucun écart n'a jamais pu s'afficher, pas même sur une séance à deux records.
      Vérifier **aussi** qu'un exercice fait pour la **première fois** n'affiche **rien** (surtout
      pas « = »), et qu'un exercice refait à l'identique affiche « = ».
- [x] 62. ✅ *Ne déborde plus (11/09).* L’esthétique a été reprise ensuite — voir §72.
      **§57.35 + §57.37 — la bande de stats ne déborde plus.** Avec un tonnage à quatre
      chiffres (≥ 1 000 kg), les quatre colonnes (durée, séries, tonnage, kg/min) tiennent dans la
      carte : **« DENSITÉ » est lisible en entier** et la dernière valeur n'est pas coupée au bord
      de l'écran. Vérifier en **très grande police système** aussi.
- [x] 63. **§57.23 — plus de clé brute dans le menu ⋮.** Ouvrir le menu pendant une séance : le
      titre du sélecteur affiche « Niveau d'affichage » (« Display level » en anglais), plus
      `workout.displayLevel.title`.
- [x] 64. ✅ *Tombé le 11/09, validé le 13/09 après le second correctif (§70).*
      **§57.21 — le retour haptique existe.** Valider une série produit une vibration brève.
      ⚠️ **Deux conditions à vérifier avant de conclure à un échec** : que la vibration système du
      téléphone soit active, et que le téléphone ne soit pas en mode silencieux total. Le correctif
      repasse par l'API `Vibrator` (celle qui marchait déjà pour le planning et le fractionné) au
      lieu de `performAndroidHapticsAsync`, qu'Android ignore sans rien dire quand le réglage
      « vibration au toucher » est coupé.
- [x] 65. ✅ *Tombé le 11/09, validé le 13/09 après le second correctif (§71).*
      **La fin de repos vibre toujours.** Même correctif, même code : lancer un repos et le
      laisser aller à 0. C'est la vibration qui marchait **avant** cette US — vérifier qu'elle n'a
      pas été perdue en route.
- [x] 66. 🔴 **§57.55 — le module force est atteignable.** Progression → **Mon corps** : sous les
      mensurations, une entrée « Désigner mes mouvements » mène à l'écran de désignation. La
      désigner (squat, développé couché, soulevé de terre) fait apparaître la section Force
      (%1RM, DOTS, total SBD) à sa place. ⚠️ **Boucle fermée avant correctif** : les deux seules
      entrées vers cet écran vivaient **dans** la section, qui se masquait tant que rien n'était
      désigné — le module était donc invisible pour tout le monde depuis MUSCPWR-01.
- [x] 67. **Non-régression : une fois désigné, le doublon n'apparaît pas.** Avec les mouvements
      désignés, l'onglet « Mon corps » ne doit afficher **qu'un seul** titre « Force » — celui de
      la section repliable, pas deux.

### Correctifs de la 2ᵉ passe de recette — 11/09/2026 (3 constats) · ✅ validés le 13/09/2026

> ✅ **Les six critères de ce bloc sont validés** (Florian, 13/09/2026), et avec eux les §64 et §65
> restés en suspens. ⚠️ **Cela ne clôt pas l'US** : les 59 critères d'origine (§57.1 à 57.59)
> attendent toujours leur passage sur device — c'est le gros de la recette.
>
> Sur les huit critères de la passe précédente, **six passent**. Restent les deux haptiques, tombés
> pour une raison qui n'avait rien à voir avec la première, plus une remarque d'esthétique et **un
> défaut nouveau, le plus gênant des trois** : le clavier recouvre la barre de saisie (§57.19).
>
> 🔴 **§57.19 était un critère de cette US, coché au développement, et il n'avait jamais marché.**
> La barre collante avait bien été livrée ; le décalage clavier, non. Depuis Expo SDK 54
> l'edge-to-edge est **forcé** sur Android : `adjustResize` est toujours au manifeste mais ne
> redimensionne plus la fenêtre. Un montage en colonne correct ne suffit donc plus.

- [x] 68. 🔴 **§57.19 — le clavier ne recouvre plus la saisie.** En séance, taper dans le champ de
      **charge** puis dans celui des **reps** : la barre (les deux champs **et** « Valider la
      série ») doit rester **entièrement visible au-dessus du clavier**, et on doit lire ce qu'on
      tape. C'est le critère le plus important de cette passe : sans lui, on saisit à l'aveugle.
- [x] 69. **Rien ne saute à la fermeture du clavier.** Valider avec le clavier ouvert, puis le
      fermer (retour arrière du téléphone) : la barre redescend à sa place, sans laisser de bande
      vide en bas ni chevaucher la barre de navigation gestuelle.
- [x] 70. 🔴 **§57.21 — le retour haptique à la validation, seconde tentative.** Valider une série
      doit produire une vibration brève et **nette**. ⚠️ Le premier correctif passait par
      `expo-haptics`, qui n'expose pas une « vibration » mais une **forme d'onde à amplitude
      imposée** : `impactAsync('light')` vaut 30 sur 255, soit 12 % de la puissance du moteur
      pendant 50 ms — sous le seuil de perception d'un Pixel 6a. On repasse sur `Vibration` de
      React Native, qui laisse l'amplitude **par défaut du constructeur** : c'est l'API qui
      marchait avant cette US, et celle du guidage de fractionné.
- [x] 71. **La fin de repos vibre, et plus fort que la validation.** Lancer un repos, le laisser
      aller à 0 : la vibration doit être franchement plus longue que celle d'une série validée
      (140 ms contre 30). Les deux doivent se distinguer les yeux fermés — c'est tout l'intérêt
      d'avoir deux niveaux.
- [x] 72. **La bande de statistiques est présentable.** Sur une séance à gros tonnage : les quatre
      nombres ont **la même taille de police** (c'était le défaut — chaque cellule rétrécissait
      différemment, la densité finissait deux fois plus petite que la durée), l'unité est en petit
      à côté du nombre, et le tonnage n'a **plus de décimale** (« 5 500 kg », pas « 5 500,0 kg »).
      Les libellés longs passent à la ligne au lieu de rapetisser.
- [x] 73. **Non-régression : les autres vibrations de l'app.** Le glisser-déposer du **planning** et
      les annonces du **fractionné** vibrent toujours — ils n'ont pas été touchés, mais ils
      partagent le moteur.

### 🟡 Ce qui n'est PAS dans cette US — et pourquoi

- **L'édition d'une séance passée.** Seule la **suppression** est livrée. Modifier une série après
  coup demande de rejouer records, volume et streak : c'est un cadrage à part.
- **Le recalcul du record précédent** après suppression. Le record disparaît, le second meilleur
  n'est pas rétabli — il faudrait rejouer tout l'historique de l'exercice. Le prochain dépassement
  recrée le record normalement.
- **Les filtres par programme et par groupe musculaire** de l'historique : la spec §6.1 les
  demande, ils ne sont **pas** livrés ici. Seul le filtre de période l'est.
- **La fréquence hebdomadaire à l'onboarding.** Les trois programmes suggérés se trient sur le
  niveau d'affichage, seul signal d'expérience disponible — le profil ne stocke ni niveau de
  pratique ni disponibilité. Le vrai tri demanderait une US d'onboarding.

## 58. NUTRI-UX01 — Refonte UX du pilier Nutrition (`feature/nutri-refonte-ux`)

> Spec : [nutri-ux01-refonte-pilier-nutrition.md](docs/specs/functional/us/nutri-ux01-refonte-pilier-nutrition.md) ·
> Plan : [nutri-ux01-refonte-pilier-nutrition.md](docs/plans/nutri-ux01-refonte-pilier-nutrition.md) ·
> Audit : [audit-nutrition-2026-09.md](docs/product/audit-nutrition-2026-09.md) (13 pages) ·
> Maquettes : [design/nutrition-refonte-2026-09/](design/nutrition-refonte-2026-09/) (7 planches).
>
> 🔴 **DEUX PRÉREQUIS AVANT DE COMMENCER — dans cet ordre.**
>
> **① Déployer la sync rule PowerSync — ✅ FAIT, confirmé par Florian le 13/09/2026.**
> `water_entries` est une **table neuve**. Coller
> [powersync-sync-rules.yaml](docs/specs/technical/powersync-sync-rules.yaml) dans le dashboard
> PowerSync (Settings → Sync Rules) puis **Deploy**. Sans ce geste, les verres bus restent
> **locaux** et ne remontent jamais — *sans aucune erreur visible*. Étape déjà oubliée **trois
> fois** dans ce projet (BIEN-01, RUN-F2c, VIE-01).
>
> **② Un build neuf est obligatoire.** Trois migrations sont déjà poussées sur le cloud
> (cochées dans [MIGRATIONS.md](supabase/MIGRATIONS.md)), mais le **schéma local** a changé :
> `water_entries`, `foods.preparation_state`, `meal_plan_entries.food_id`/`quantity_g`,
> `nutrition_profiles.water_target_ml`/`glass_size_ml`. Un APK antérieur écrira dans des
> colonnes qui n'existent pas chez lui — et **avalera l'erreur**.
>
> **③ La bibliothèque est passée à 3 244 aliments le 13/09/2026** (import CIQUAL, section K).
> C'est une donnée de référence : rien à installer, elle **descend par la synchro**. À la
> première ouverture après le build, laisser la synchro finir — ~3 200 aliments et ~6 500
> traductions arrivent une fois, puis plus rien.
>
> ⚠️ **Trois sessions ont travaillé la même semaine** (accueil, musculation, course). Cette US
> vit dans un worktree isolé et ne touche que le pilier nutrition, mais au merge : vérifier que
> l'accueil et le hub muscu n'ont pas bougé.

### A. L'objectif calorique devient juste (R1) — le défaut le plus grave

- [ ] 1. **Compte neuf, pilier nutrition actif** : l'onboarding pose une **5ᵉ étape « À quel
      point bouges-tu ? »**, après le niveau d'affichage. Le badge indique « étape 5 sur 5 ».
- [ ] 2. Chaque niveau porte une **description concrète** (« Travail assis, peu de marche, pas
      de sport ») et son facteur en petit (×1,2). ⚠️ Si tu ne vois que « Sédentaire ×1,2 » sans
      la phrase, c'est un défaut : c'est la phrase qui permet de se reconnaître.
- [ ] 3. **Pilier nutrition désactivé** à l'étape 2 : l'étape n'apparaît pas, et le badge
      affiche « étape 4 sur 4 ». La question n'a pas de sens sans nutrition (décision H).
- [ ] 4. **Passer l'étape n'écrit rien.** Ouvrir ensuite Nutrition → réglages (icône options) :
      un bandeau ambre dit « Valeur par défaut — tu n'as pas encore répondu », et **aucun
      niveau n'est coché**.
- [ ] 5. 🔴 **Le cœur du correctif** : avant cette US, « Modérément actif » était coché comme si
      tu l'avais choisi. Pour un sédentaire, l'objectif était surestimé de **~600 kcal/jour** —
      de quoi annuler entièrement un déficit de sèche, sans le moindre signal.
- [ ] 6. Choisir un niveau : le bandeau **disparaît**, le niveau est coché, et l'objectif
      calorique du journal **change immédiatement** (vérifier l'anneau du bilan).
- [ ] 7. Le **TDEE est expliqué** en une phrase sous le chiffre (« ce que ton corps dépense en
      une journée… »). Le sigle nu ne veut rien dire pour qui n'est pas nutritionniste.

### B. Le geste de saisie (R2) — ce qui se fait cinq fois par jour

- [ ] 8. Depuis le journal, « + Ajouter un aliment » ouvre une **feuille par le bas**, plus un
      écran plein. Elle nomme le repas visé dans son titre.
- [ ] 9. La feuille expose **trois modes** en haut : `Rechercher · Scanner · Texte libre`.
      ⚠️ Avant : 5 onglets + 4 boutons de pied, soit **9 entrées de même poids**.
- [ ] 10. **Le budget reste affiché** pendant toute la saisie : « Il te reste N kcal · P g de
      protéines ». ⚠️ C'est l'information qui disparaissait au moment précis où l'on décide.
- [ ] 11. **À l'ouverture, la liste montre tes habitudes** (récents + favoris), pas la base par
      ordre alphabétique. Sur un compte neuf, elle invite à chercher ou scanner.
- [ ] 12. Un aliment déjà consommé affiche « 150 g · **ta quantité habituelle** », en vert.
- [ ] 13. **Le « + » de la ligne journalise en UN tap**, avec cette quantité. Vérifier que
      l'entrée apparaît bien dans le bon repas, avec le bon poids.
- [ ] 14. **Toucher la ligne** (et non le +) ouvre le détail pour ajuster la quantité.
- [ ] 15. **La recherche mélange les trois familles** : tape un mot qui existe à la fois comme
      aliment et comme recette → les deux apparaissent dans **une seule liste**, avec un
      sous-titre « Recette · N portions » ou « Repas type · N aliments ».
- [ ] 16. 🔴 **Le classement est par pertinence, pas alphabétique.** Tape « pain » : « Pain »
      doit sortir **avant** « Chapelure de pain ».
- [ ] 17. 🔴 **Tolérance aux fautes** : tape « poullet » → le poulet doit sortir. Avant, la
      recherche ne rendait rien.
- [ ] 18. **Scanner** depuis la feuille ouvre la caméra sur le bon jour et le bon repas.
- [ ] 19. **Le scan est aussi en en-tête du journal** (bouton terracotta) : deux taps depuis
      l'ouverture de l'app. Avant : six.
- [ ] 20. **Le repas se déduit de l'heure.** Ouvre le scan à 20 h sans passer par un repas :
      l'entrée doit tomber au **dîner**, pas au petit-déjeuner.

### C. La quantité (R2.5)

- [ ] 21. Le panneau de quantité a un **stepper − / +** : plus besoin du clavier pour ajuster.
      Le pas s'adapte (1 g sous 20 g, 5 g sous 100, 10 au-delà).
- [ ] 22. Les portions sont **multipliables** : « ½ bol · 1 bol · 2 bols », avec les grammes de
      chacune. ⚠️ Avant, une puce **écrasait** la quantité : « deux bananes » imposait un calcul
      mental.
- [ ] 23. Un aliment déjà journalisé affiche « **La dernière fois : 65 g** » et pré-remplit
      cette quantité.
- [ ] 24. Le bloc sombre « CE QUE ÇA CHANGE » montre les kcal de la quantité **et** ce qu'il
      restera après l'ajout. En cas de dépassement, il l'annonce sans dramatiser.
- [ ] 25. Les « Valeurs détaillées » (micros) sont **repliées**. Avant, jusqu'à 33 lignes
      s'ouvraient au-dessus des boutons d'action.

### D. Le journal (R3)

- [ ] 26. La **date est tapable** (chevron ▾) et ouvre un **calendrier mensuel**.
- [ ] 27. Les jours renseignés portent une **pastille** : vert (journée complète), ambre
      (partielle), gris (rien). Les jours à venir n'en ont pas.
- [ ] 28. Naviguer sur un mois passé fonctionne, et sélectionner un jour ramène au journal de
      ce jour. ⚠️ Avant : **15 taps sur ◀** pour remonter de deux semaines.
- [ ] 29. Sous la barre de jour, une **trame de la semaine** (7 pastilles) montre la régularité.
      Un tap sur une pastille change de jour.
- [ ] 30. **Hydratation** : la carte affiche « 0 / 2 L » et une grille de verres vides.
- [ ] 31. **Un tap sur +** ajoute un verre (250 ml par défaut) : la grille se remplit, le total
      monte. 🔴 Fermer et rouvrir l'app : le verre est **toujours là** (c'est ce qui teste la
      persistance locale).
- [ ] 32. Le bouton **annuler** n'apparaît que s'il y a quelque chose à défaire, et retire
      **le dernier verre**.
- [ ] 33. Dépasser l'objectif **n'est pas traité comme une faute** : pas de rouge, pas d'alerte.
- [ ] 34. 🔴 **Sur un second appareil** (ou après réinstallation) : les verres bus remontent.
      *C'est ce critère qui teste la sync rule du prérequis ①.*
- [ ] 35. **Les micronutriments sont visibles par défaut** : fer, calcium, magnésium, vitamine D,
      vitamine C, potassium — avec leurs anneaux de couverture. ⚠️ Avant, la grille était vide
      tant qu'on n'allait pas cocher dans un mur de 33 pastilles.
- [ ] 36. Tout décocher dans les réglages **masque** la grille : le suivi reste refusable.
- [ ] 37. 🔴 **Les micros sont SOUS les repas**, plus au-dessus. Vérifier qu'au chargement du
      journal, **le premier repas est visible sans scroller**.
- [ ] 38. **Repères de qualité** (fibres / sucres / AGS) sous les repas, avec la plage de
      référence. Ils n'apparaissent que si la journée a des aliments identifiés.

### E. Le suivi (R4)

- [ ] 39. L'écran Suivi s'ouvre sur **quatre sous-onglets** : `Régularité · Apports · Poids ·
      Qualité`. ⚠️ Avant : 8 sections + 4 cartes dans un seul scroll.
- [ ] 40. **Régularité** : une **heatmap de 30 cases** remplace le pourcentage nu, avec série en
      cours, meilleure série et jours vides.
- [ ] 41. **Compte neuf** : la heatmap ne dit **pas** « 0 % » — elle affiche l'état vide.
      Reprocher une régularité nulle à quelqu'un qui vient d'installer l'app serait absurde.
- [ ] 42. **Adhérence** : un graphe à **zone-cible**, un trait par jour, sous / dans / au-dessus.
      Le bilan cumulé est une phrase, plus une ligne en texte mono.
- [ ] 43. Changer la fenêtre (7 j / 30 j) déplace **la heatmap et le graphe ensemble** : deux
      périodes différentes côte à côte se croiraient comparables.
- [ ] 44. **Poids** : la courbe et l'objectif sont en haut, **la saisie de la pesée en bas**.
      Avant, saisir son poids était le premier bloc d'un écran de lecture.
- [ ] 45. **Qualité** : fibres, sucres et AGS face à leurs repères, plus protéines/kg. Si une
      partie des calories vient d'ajouts rapides, une phrase dit sur quel pourcentage le calcul
      porte — l'app annonce ce qu'elle ne sait pas.

### F. Le planning (R7)

- [ ] 46. Le planning s'ouvre en **grille de semaine** (7 colonnes × repas), plus en pile de
      sept cartes. Le total du jour est en tête de colonne.
- [ ] 47. La bascule en haut à droite ramène à la **liste**, qui reste la vue de détail.
- [ ] 48. 🔴 **La feuille d'ajout propose QUATRE sources** : Recettes · Repas types · **Aliments**
      · **Calories**. ⚠️ Avant, seules les deux premières existaient : planifier son premier
      repas imposait d'aller créer une recette (~20 taps).
- [ ] 49. Planifier un **aliment simple** avec une quantité : il apparaît dans la case, avec ses
      kcal.
- [ ] 50. Planifier un **ajout rapide** (« Restaurant, 800 kcal ») : accepté sans aliment.
- [ ] 51. **Le planning n'écrit toujours pas dans le journal** (règle R1 de REPAS-01) : seul
      « J'ai mangé ça » crée des entrées, et il reste réversible.
- [ ] 52. La **liste de courses** fonctionne toujours ; un ajout rapide y est compté comme non
      résolu, ce qu'elle annonce.

### G. Recettes et aliments perso (R6)

- [ ] 53. Une recette se **renomme** (crayon à côté du titre) et se **supprime** (corbeille).
      Aucun des deux n'était possible.
- [ ] 54. La **quantité d'un ingrédient se modifie** (crayon sur la ligne) : les kcal de la
      recette suivent.
- [ ] 55. Supprimer un ingrédient a une **corbeille visible**. ⚠️ Avant : appui long, sans la
      moindre affordance.
- [ ] 56. **Créer un aliment** : on peut déclarer une **portion usuelle** (« 1 tranche · 25 g »)
      et l'état **cru / cuit**.
- [ ] 57. Cette portion se retrouve ensuite dans le panneau de quantité, multipliable.
      ⚠️ Avant, un aliment perso ou scanné se saisissait **en grammes à vie**.
- [ ] 58. Les **allergènes** se cochent dans une liste (gluten, arachides, lait…) en plus de la
      saisie libre (spec §2.4).

### H. Saisie en texte libre (R6.5)

- [ ] 59. Décrire un repas puis analyser : les lignes reconnues s'affichent avec leur quantité.
- [ ] 60. 🔴 **Une ligne non reconnue n'est plus un cul-de-sac** : elle propose les **meilleures
      correspondances**, plus « Rechercher » et « Créer l'aliment ».
- [ ] 61. Choisir une proposition **remplit la ligne**, qui redevient modifiable.
- [ ] 62. Un bouton **« Ajouter une ligne »** permet de compléter à la main (spec §4.5).

### I. Non-régression — ce qui ne doit PAS avoir bougé

- [ ] 63. Le **bilan du jour** (anneau, badge de séance) est inchangé.
- [ ] 64. Les **macros en trois colonnes** sont inchangées.
- [ ] 65. « **Copier hier** » (menu ⋯ d'un repas) fonctionne toujours.
- [ ] 66. Le **détail d'une entrée** (tap sur une ligne) : modifier, supprimer, déplacer vers un
      autre repas.
- [ ] 67. Les réglages du profil nutritionnel s'enregistrent — mais **à la sortie du champ**,
      plus à chaque frappe. Taper « 2500 » ne doit plus produire quatre écritures.
- [ ] 68. Vider un champ de macro puis quitter le champ : la valeur passe à 0. Vider **sans**
      quitter : rien n'est écrit.
- [ ] 69. Le **widget nutrition de l'accueil** ouvre toujours le bon repas selon l'heure.
- [ ] 70. **Aucun texte anglais** n'apparaît en français, et inversement (basculer la langue).

### J. La bibliothèque d'aliments — import CIQUAL du 13/09/2026

> **80 → 3 244 aliments** (table CIQUAL 2025 de l'ANSES, Licence Ouverte). Toute la nutrition
> vient du fichier ANSES : **aucune valeur saisie à la main**. Ces critères n'existaient pas à
> la livraison du 10/09 — le lot était alors impossible, faute du fichier source.

- [ ] 71. Chercher **« courgette »**, **« cabillaud »**, **« emmental »**, **« lentilles »**,
      **« jus d'orange »** : chacun existe. Aucun n'était dans les 80 aliments d'avant — c'est
      précisément le « mur au deuxième repas » que l'audit décrivait.
- [ ] 72. 🔴 **Taper lettre par lettre : « p », « po », « pom », « pomme ».** La liste se
      **resserre** à chaque lettre, sans jamais faire disparaître un résultat déjà vu. Un
      aliment qui s'affiche puis s'efface quand on **précise** sa recherche = le plafond de
      balayage a sauté ; c'est le défaut que l'import a révélé et que cette livraison corrige.
- [ ] 73. La recherche reste **immédiate** — aucun blanc perceptible — malgré les 3 244 entrées.
- [ ] 74. Chercher **« boeuf »** puis **« saumon »** : les versions **crues** et **cuites** sont
      distinguées par le badge cru / cuit. L'information vient désormais de CIQUAL (498 aliments
      la portent) et non plus de la lecture du nom.
- [ ] 75. Ajouter un aliment importé au journal, ouvrir son détail : les **micronutriments** sont
      renseignés. Un nutriment absent de CIQUAL doit rester **absent**, jamais affiché à 0.
- [ ] 76. ⚠️ Un aliment importé n'a **pas de portion usuelle** : la quantité s'ouvre sur 100 g
      et le stepper fonctionne normalement. C'est **attendu** (CIQUAL ne fournit pas de
      portions), pas un défaut — voir 78.
- [ ] 77. Les 80 aliments d'origine sont **intacts** : « Poulet (blanc, cuit) » garde son nom
      retouché, sa traduction anglaise et sa portion « 1 blanc = 120 g ». L'import **ajoute**,
      il ne réécrit pas.

### K. Ce qui reste ouvert après cette recette

- [ ] 78. La **traduction EN de 3 164 noms** reste à faire : CIQUAL est monolingue, donc en
      anglais ces aliments s'affichent en français. Dette **tracée** (marqueur
      `needsTranslation`, comptée à chaque import), pas un oubli — décision G.
- [ ] 79. Les **portions usuelles** des aliments importés (voir 76), à compléter au fil de
      l'eau : patron dans la migration `…nutrf2_portions_reference_aliments.sql`.
---

## 59. CARDIO-UX01 — Refonte UX du pilier Course (`feature/cardio-refonte-ux`)

> **42 critères.** Spec : [cardio-ux01-refonte-pilier-course.md](docs/specs/functional/us/cardio-ux01-refonte-pilier-course.md) ·
> Plan : [cardio-ux01-refonte-pilier-course.md](docs/plans/cardio-ux01-refonte-pilier-course.md) ·
> Audit : [audit-ergonomie-pilier-course.md](docs/product/audit-ergonomie-pilier-course.md) (22 pages, 40 constats) ·
> Maquettes : [design/audit-course/](design/audit-course/) (11 planches, dont 2 relevés de l'existant).
>
> ✅ **Migration appliquée le 10/09/2026** —
> `20260910214329_cardio_ux01_semaines_et_adaptation` (3 colonnes additives), types régénérés et
> `ADAPTATION_WRITE_READY` basculé. Toute cette section est donc recettable, y compris les
> critères 40 à 42 sur la carte d'adaptation.
> ⚠️ Elle a dû être **redatée** avant de passer : voir
> [MIGRATIONS.md](supabase/MIGRATIONS.md) pour la raison et la leçon.
>
> **✅ Aucune sync rule à redéployer** (`sessions` et `planned_sessions` sont déjà lues en
> `select *`) · **aucune dépendance native neuve** → recettable sur un build de la branche.
>
> ⚠️ **Deux critères exigent de courir dehors** (les 7 et 8). Les autres se passent au chaud, y
> compris le mode sans GPS.

### La justesse — les cinq constats bloquants

C'est la partie qui compte le plus : jusqu'ici l'app **affichait à l'utilisateur des chiffres qui
n'étaient pas les siens**.

- [ ] 1. **Le chrono affiché est celui qui sera enregistré.** Démarrer une course GPS, laisser
      tourner 2 min, **mettre en pause 1 min**, reprendre 1 min, terminer. Le résumé doit afficher
      **≈ 3 min**, pas 4 — et c'est ce que le chrono affichait déjà pendant la course.
      *Avant : l'écran comptait 4 min (horloge murale) et le résumé en enregistrait 3.*
- [ ] 2. **La pause se voit.** Pendant la pause : un bandeau « En pause » apparaît, le grand chiffre
      **se grise** et se **fige**, et le libellé porte « figé ». Aucun chiffre ne continue d'avancer.
- [ ] 3. **🔴 Le mode sans GPS enregistre sa durée.** Démarrer une course en mode **manuel**,
      laisser tourner **3 minutes**, terminer. Le résumé doit afficher **≈ 3:00 de durée** et
      proposer deux champs (distance **et** durée).
      *Avant : « Durée — », « Allure — », et un seul champ de distance. Les minutes étaient perdues.*
- [ ] 4. **Le mode sans GPS a une pause.** Sur la même course : le bouton Pause existe, il fige le
      chrono, la reprise repart sans rattraper le temps de pause.
- [ ] 5. **🔴 Terminer une course coche la séance planifiée.** Avoir une séance de course planifiée
      aujourd'hui. La démarrer **depuis le hub**, la terminer. Le résumé affiche « Séance validée ».
      Revenir au hub : il ne propose **plus** cette séance, et le planning la montre **faite**.
      *Avant : le lendemain, le hub proposait encore de la faire.*
- [ ] 6. **La validation est réversible.** Sur le même résumé, taper « Annuler » à côté de
      « Séance validée » : le bandeau disparaît, et le planning remet la séance **à faire**.
- [ ] 7. **📍 dehors — L'arrêt se fait en deux temps.** En course, taper « Arrêter » : la course
      passe **en pause** et trois issues apparaissent — *Reprendre* · *Terminer et enregistrer* ·
      *Supprimer*. **Rien n'est clôturé à ce stade.**
      *Avant : un seul appui clôturait, quittait, et il n'y avait aucun retour possible.*
- [ ] 8. **📍 dehors — « Reprendre » repart vraiment.** Depuis ce panneau, taper « Reprendre » : la
      course continue, la distance et le chrono repartent, rien n'a été enregistré.
- [ ] 9. **Supprimer une course en cours.** Depuis le panneau d'issues, « Supprimer » demande
      confirmation, puis ramène au hub course. La course **n'apparaît pas** dans l'historique.
- [ ] 10. **L'écran se verrouille.** En course, taper « Bloquer » : les commandes disparaissent, seul
      le grand chiffre reste. Un **appui simple** sur « Déverrouiller » ne suffit pas ; un **appui
      long** déverrouille.
      *Sans ça, `useKeepAwake` laisse l'écran tactile toute la course — poche, pluie, main mouillée.*
- [ ] 11. **🔴 Supprimer une course terminée.** Depuis le résumé **ou** depuis l'analyse : suppression
      avec confirmation. Vérifier ensuite que la course a disparu de l'historique **et** des
      statistiques de la semaine.
- [ ] 12. **Une suppression rend son record.** Faire une course courte qui décroche un record
      (ex. record du 1 km sur un compte neuf), vérifier le record dans l'historique, **supprimer la
      course**, puis revenir aux records : le record doit avoir disparu ou être revenu au précédent.
      ⚠️ **Le critère le plus important de ce lot** : c'est le mécanisme par lequel un seul fix GPS
      aberrant pouvait dérégler l'allure de référence — donc **toutes** les allures cibles — sans
      recours.
- [ ] 13. **Corriger une distance.** Analyse → « Corriger la distance » → saisir une valeur →
      enregistrer. La distance **et l'allure moyenne** changent ; la carte du parcours est
      **inchangée**.
- [ ] 14. **L'écart de pause est expliqué.** Sur une course qui a eu des pauses, le résumé affiche
      une ligne du type « 1:00 de pause exclues · 4:00 écoulées ». Sur une course sans pause, cette
      ligne est **absente** (et non « 0:00 »).

### Le bandeau de segment — le cœur de la refonte

- [ ] 15. **🔴 📍 dehors — La séance structurée se voit.** Avoir une séance planifiée avec une
      structure (par ex. `2 km éch + 6×400/200 + 1 km rac`). La démarrer. En haut de l'écran, un
      bandeau sombre affiche : la **nature du segment**, la **répétition** (« 3 / 6 »), ce qui
      **reste** (« 250 m »), l'**allure cible**, et « Puis : … ». Deux barres de progression : celle
      du segment, celle de la séance.
      *Avant : rien. Tout était à la voix, et la voix est désactivée par défaut.*
- [ ] 16. **🔴 Le bandeau marche AVEC LA VOIX COUPÉE.** Vérifier dans **Réglages → Profil coureur**
      que « Guidage fractionné » est **désactivé**, puis refaire le critère 15.
      ⚠️ **C'est un défaut trouvé en implémentant** : le curseur de phase n'avançait que si le
      guidage vocal était activé. Donc, pour la majorité des utilisateurs, ni le bandeau ni le
      tableau « fraction par fraction » du résumé n'auraient jamais rien affiché.
- [ ] 17. **Le bandeau est absent sur une course libre.** Démarrer une course sans séance : aucun
      bandeau — pas un bandeau vide.
- [ ] 18. **Fin de séance annoncée.** Franchir tous les segments : le bandeau annonce « Séance
      terminée » et **jamais** « fraction 15 sur 14 ».
- [ ] 19. **Le grand chiffre dépend de la séance.** Sur un **fractionné**, l'**allure** est en grand.
      Sur une **sortie longue**, la **distance**. Sur une séance bornée en durée, le **chrono**.
- [ ] 20. **Le grand chiffre se change d'un tap.** Taper dessus : il passe à la métrique suivante
      (allure → distance → temps), et les deux autres restent lisibles en dessous.
- [ ] 21. **Le mot « net » est écrit.** À côté du temps, la mention « hors pauses » est visible.

### Le hub course

- [ ] 22. **Quatre états, jamais deux cartes.** Vérifier les quatre, dans l'ordre de priorité :
      (a) une course **en cours** → « Reprendre » ; (b) une séance **aujourd'hui** → la carte de
      séance ; (c) un **programme actif sans séance aujourd'hui** → « Rien de prévu aujourd'hui »
      + la date de la prochaine ; (d) **aucun programme** → « Par où commencer ? » avec deux
      propositions.
      *Avant : trois états, et (c) et (d) affichaient la même carte.*
- [ ] 23. **La carte du jour porte le CONTENU de la séance.** Structure en puces
      (`Échauffement — 2 km`, `6 × 400 m…`), **volume total**, **durée estimée**, allure cible et la
      **consigne rédigée**.
- [ ] 24. **🔴 Le profil coureur est accessible depuis le pilier.** Un bouton « Profil coureur » en
      en-tête du hub.
      *Avant : uniquement depuis les **Réglages de l'application** — alors qu'il porte l'allure de
      référence, qui pilote toutes les allures cibles, et les deux réglages audio, désactivés par
      défaut.*
- [ ] 25. **Ma semaine.** Une bande affiche : « n / m faites », les **sept jours** (couru = coche
      verte, aujourd'hui = accent, prévu = pointillés), et distance / temps / D+ de la semaine.
- [ ] 26. **La fréquence hebdo visée sert enfin.** Renseigner « Fréquence hebdo visée » dans le
      profil coureur, revenir au hub : le compte de la bande se lit sur cet objectif, et une ligne
      le rappelle quand il diffère du nombre de séances prévues.
      *Avant : ce champ était saisi et **lu nulle part**.*
- [ ] 27. **Une tuile vide ne réserve plus sa case.** Sur un **compte neuf** (aucune course, aucun
      programme), la grille du hub ne montre pas quatre tuiles à zéro.
- [ ] 28. **La bande « Ma semaine » se tait.** Sur un compte neuf, elle n'apparaît pas du tout.

### Le résumé, en deux temps

- [ ] 29. **🔴 Le premier écran tient sans défilement.** Après une course : quatre chiffres, la
      séance validée, le ressenti, et **deux boutons** — *Enregistrer* et *Analyser*. Vérifier sur
      un téléphone réel qu'aucun défilement n'est nécessaire pour atteindre *Enregistrer*.
      *Avant : douze sections, et « Terminé » tout en bas.*
- [ ] 30. **Le ressenti est nommé.** Cinq niveaux **Facile → Max** (les mêmes que la muscu), et non
      dix boutons numérotés. Un ressenti saisi **avant** cette US se relit correctement.
- [ ] 31. **« Analyser » porte tout le reste.** Splits par km, fraction par fraction, courbes
      d'allure, carte, terrain, export GPX, partage, corriger, supprimer.
- [ ] 32. **🔴 Le tableau des fractions affiche la PLAGE complète.** Sur une séance dont les
      fractions visaient une plage (ex. 4:05–4:10), la colonne « Prévu » affiche **4:05 – 4:10**.
      *Avant : « 4:05 » seul, ce qui se lit comme une cible unique — et faisait passer pour hors
      cible une fraction courue à 4:09.*
- [ ] 33. **Le libellé « Récupération » n'est pas tronqué** dans ce tableau.

### Non-régression — à vérifier, cette US touche des écrans partagés

- [ ] 34. **La musculation n'a pas bougé.** MUSCU-UX01 a été livrée la veille : ouvrir le hub muscu,
      démarrer une séance, valider une série, terminer. Rien ne doit avoir changé.
      ⚠️ Les deux US touchent `packages/shared/src/widgets.ts` — régions distinctes
      (`RUNNING_*` contre `STRENGTH_*`), mais à vérifier.
- [ ] 35. **Le planning reste pilier-agnostique.** Ouvrir `/planning` : les séances muscu **et**
      course s'affichent, « Marquer fait » fonctionne pour les deux.
- [ ] 36. **L'accueil n'a pas bougé.** La carte de séance du jour et le widget de course s'affichent
      normalement.
- [ ] 37. **Les annonces vocales périodiques fonctionnent toujours.** Activer « Annonces vocales »
      dans le profil coureur, courir 1 km : l'annonce se déclenche.
- [ ] 38. **L'export GPX fonctionne toujours** (depuis « Analyser »).
- [ ] 39. **La carte partageable fonctionne toujours** (depuis « Analyser »).

### La carte d'adaptation — ✅ migration passée le 10/09/2026, c'est recettable

> `npm run db:push` a été joué par Florian le 10/09/2026, les 3 colonnes sont confirmées dans
> `database.types.ts`, et `ADAPTATION_WRITE_READY` est passé à `true`. Le bouton est donc rendu.

- [ ] 40. **🔴 La carte d'adaptation agit.** Provoquer une proposition (déclarer une douleur ou une
      énergie basse la veille d'une séance planifiée), puis taper **« Appliquer aujourd'hui »** sur
      le hub course. La carte confirme « Appliqué à la séance d'aujourd'hui » et le bouton
      disparaît.
- [ ] 41. **🔴 Appliquer n'allège QUE le jour.** Après le critère 40 : ouvrir le **programme** et
      vérifier que la séance type est **inchangée** (mêmes répétitions, même allure), puis vérifier
      que la **semaine suivante** l'est aussi.
      ⚠️ **C'est le critère qui compte** : « j'allège aujourd'hui parce que j'ai mal dormi » ne doit
      jamais devenir « j'ai changé mon plan ». L'écriture porte sur l'occurrence
      (`planned_sessions`), jamais sur le template (`sessions`) — 11 tests le vérifient, mais c'est
      sur device que ça se voit.
- [ ] 42. **Appliquer deux fois n'écrit qu'une fois.** Le bouton disparaît après le premier appui ;
      il n'y a pas de moyen d'empiler deux réductions.

### 🟡 Ce qui reste ouvert dans cette US — à ne pas chercher dans l'app

Six chantiers de l'audit ne sont **pas** livrés dans ce lot. Ils ont leur spec, leur plan et,
pour deux d'entre eux, leurs briques de calcul déjà écrites et testées :

> 📌 **Ils sont désormais aussi dans [BACKLOG.md](BACKLOG.md) (P1, CARDIO-02 → CARDIO-07)**, recopiés
> le 13/09/2026. C'est volontaire : ce fichier-ci **se vide dès qu'une US est clôturée**, et ces six
> chantiers n'existaient nulle part ailleurs — ils seraient morts avec la recette.

| Constats | Sujet | État |
|---|---|---|
| F2, F3, F39 | Les **quatre portes** vers l'allure de référence + accueil du pilier en 3 questions | Brique de calcul livrée et testée (`referencePaceFromRaceTime`, `referencePaceFromCooperTest`, 8 tests) — **écrans à faire** |
| F4 → F8, F26 | Écran de **départ** : fix GPS attendu, mode mémorisé, compte à rebours, contexte de séance, **saisie rétroactive** | `createPastRun` livrée et typée côté repository — **écran à faire** |
| F22, F23, F24 | **Historique** en trois onglets, liste virtualisée et filtrable | Requête enrichie livrée (type de séance, terrain, RPE remontent déjà) — **écran à faire** |
| F27 → F34 | **Éditeur de séance** à trois niveaux, « Répéter la sélection », modèles, saisie en une ligne | Grammaire complète livrée et testée (`parseSessionLine`, `SESSION_TEMPLATES`, 20 tests) — **éditeurs à réécrire** |
| F35 | Génération des **semaines qui progressent** | Colonne livrée **et poussée** (10/09/2026) — il reste `planProgram` à étendre et la vue par semaine de l'éditeur. Rien à chercher dans l'app aujourd'hui |
| F25 | **Import** GPX et Health Connect | Rien de livré. ⚠️ La lecture Health Connect ajoute deux permissions, donc **change la déclaration « Health apps » du Play Store** — chemin critique du lancement (9.2) |

## 60. MUSCU-UX02 — Bilan de séance, 3 niveaux de lecture (`feature/muscu-ux02-bilan-seance`)

> **24 critères.** Spec : [muscuux02-bilan-seance.md](docs/specs/functional/us/muscuux02-bilan-seance.md) ·
> Plan : [muscuux02-bilan-seance.md](docs/plans/muscuux02-bilan-seance.md) ·
> Maquettes : [design/recap-seance-muscu/](design/recap-seance-muscu/) (5 planches, 2 pages).
>
> ✅ **Migration appliquée le 12/09/2026** —
> `20260912050404_muscuux02_summary_display_level` (1 colonne additive sur `profiles`), types
> régénérés, colonne déclarée dans `powersync/schema.ts`. Toute la section est recettable.
>
> **✅ Aucune sync rule à redéployer** (`profiles` est déjà publiée et lue en `select *`) ·
> **aucune dépendance native neuve** → recettable sur un build de la branche.
>
> 🔴 **Le cœur de l'US est l'ISO récap ↔ historique** : les deux écrans sont désormais le **même
> composant**. Les critères 1 à 4 le vérifient et sont à passer **en premier** — si l'un d'eux tombe,
> le reste de la section n'a plus de sens.
>
> ⚠️ **Deux écrans à ouvrir pour chaque critère de contenu** : la fin de séance **et**
> Historique → une séance. C'est le but : ils doivent montrer la même chose.
>
> ⚠️ **Il faut un historique pour tout voir.** Les blocs comparatifs se taisent délibérément sous
> 3 séances de même nom (critère 13). Sur un compte neuf, la moitié de l'écran sera absente —
> **c'est le comportement attendu**, pas un bug.

### L'iso — à passer en premier

- [ ] **1.** Terminer une séance, noter ce qu'affiche le récap. Ouvrir **Historique → cette même
  séance** : mêmes blocs, mêmes chiffres, même ordre. Seuls diffèrent l'**en-tête** (date + flèche
  retour au lieu de « Séance terminée ») et l'absence du bouton « Retour à l'accueil ».
- [ ] **2.** 🔴 Battre un record → le récap de fin joue l'**animation de célébration**. Rouvrir la
  même séance depuis l'historique → **aucune célébration ne rejoue** (mais le verdict, lui, est
  bien là).
- [ ] **3.** 🔴 Le **ressenti** se lit **de la même façon** des deux côtés : l'échelle nommée
  (Facile → Max). L'historique ne doit **plus jamais** afficher un « 8/10 » brut — c'était le
  défaut corrigé par cette US.
- [ ] **4.** Modifier le ressenti **depuis l'historique**, revenir, rouvrir : la modification a
  bien été enregistrée (la section est éditable des deux côtés, plus seulement en fin de séance).

### Les 3 niveaux

- [ ] **5.** Le sélecteur **Simple / Intermédiaire / Avancé** est visible en haut du bilan, et le
  niveau actif est lisible d'un coup d'œil.
- [ ] **6.** **Simple** : verdict, bande de 3 chiffres (durée / tonnage / séries), « Ce que tu as
  fait », ressenti. **Rien d'autre** — ni comparaison, ni groupes musculaires, ni analyse.
- [ ] **7.** **Intermédiaire** ajoute : 3 pastilles (kg/min, % du 1RM, RPE moyen), « Vs ton
  habitude », « Ce que tu as travaillé », « Ton programme ». Les cartes d'exercice deviennent
  **dépliables** (chevron), repliées par défaut.
- [ ] **8.** **Avancé** ajoute : 3 pastilles de plus (charge UA, séries dures, 1RM max), intensité
  relative, plages de reps, types de séries, records détaillés, « Ce que ça pèse ». Les cartes
  d'exercice sont **dépliées d'emblée**.
- [ ] **9.** 🔴 En montant de niveau, **aucun bloc ne disparaît ni ne change de place** : on ajoute
  en dessous. Passer Simple → Intermédiaire → Avancé et vérifier que le haut de l'écran ne bouge pas.
- [ ] **10.** Le niveau choisi **persiste** : quitter l'app, la rouvrir, rouvrir un bilan → même
  niveau. Il vaut aussi pour l'historique.
- [ ] **11.** Réglages → **« Niveau du bilan de séance »** existe, **distinct** de « Niveau
  d'affichage de la séance ». Changer l'un **ne change pas** l'autre.

### Le verdict — la phrase qui conclut

- [ ] **12.** Le bilan se **termine par une phrase**, jamais par un écran de chiffres. Selon le cas :
  un record battu → « Ton meilleur ‹exercice› » ; sinon plus gros tonnage sur ce type de séance ;
  sinon progression en charge ; sinon « nᵉ séance cette semaine » ; sinon « Séance bouclée en n min ».
  **Il y a toujours une phrase**, même sur une séance ordinaire.

### Vs ton habitude

- [ ] **13.** 🔴 Sur une séance dont le nom compte **moins de 3 séances précédentes**, le bloc
  « Vs ton habitude » est **absent**. Il n'affiche **jamais** « +0 % » — deux séances ne font pas
  une habitude.
- [ ] **14.** Avec au moins 3 séances de même nom : le bloc compare tonnage, densité, durée et
  charge à la **médiane**, avec un trait repère sur chaque barre.
- [ ] **15.** ⚠️ Une séance **plus courte** que d'habitude affiche son écart en **neutre**, pas en
  rouge : une séance plus efficace n'est pas un échec.
- [ ] **16.** Sans ressenti saisi, la ligne « Charge (UA) » disparaît — mais le reste du bloc reste.

### Les blocs d'analyse

- [ ] **17.** « Ce que tu as travaillé » liste les groupes musculaires **de cette séance**, triés du
  plus travaillé au moins. Un groupe non sollicité est **absent**, jamais à 0. En Avancé, chaque
  ligne montre aussi les **séries dures** (« 6 · 4d »).
- [ ] **18.** « Ton programme » n'apparaît que sur une séance **issue d'un programme**. Sur une
  séance libre : **absent** (et non « 0 % »).
- [ ] **19.** ⚠️ Faire **plus lourd** que le plan compte comme **conforme**, pas comme un écart : la
  surcharge progressive est le but. Seul un réalisé **sous** la prescription est relevé.
- [ ] **20.** « Intensité relative » (Avancé) n'affiche que les exercices ayant un **1RM connu** ; les
  autres sont **absents**, et la note du bas dit combien ne sont pas comptés.
- [ ] **21.** « Où est parti ton volume » : les parts somment à **100 %** exactement, la barre atteint
  son bord, et l'ordre reste **Force → Hypertrophie → Endurance** même si l'endurance domine.
  ⚠️ Une séance **100 % poids du corps** fait disparaître le bloc — c'est une limite assumée.

### Le détail des séries

- [ ] **22.** 🔴 Une séance **interrompue** (séries prévues non validées) montre bien ces séries dans
  le détail déplié, avec un **cercle vide** au lieu de la coche. Elles ne comptent ni dans le
  tonnage ni dans le nombre de séries.
- [ ] **23.** Un **gainage** (série à la durée) se lit en **m:ss**, et un gainage **lesté** affiche
  la charge préfixée d'un « + » — jamais comme une charge soulevée.
- [ ] **24.** Un exercice **jamais fait auparavant** n'affiche **aucun badge d'écart**, et sa carte
  dépliée dit « Premier passage sur cet exercice ». Un « = » y serait un contresens.

### Hors périmètre — ne pas les chercher

Quatre choses ont été **délibérément laissées de côté** (décisions D3 à D6 de la spec) :
**temps de repos réel** (demanderait une colonne `completed_at` dédiée — `updated_at` donnerait un
repos de 14 h dès qu'une série est corrigée le lendemain) · **ratio pousser/tirer** (le type de
mouvement n'est pas modélisé sur `exercises`) · **contexte nutritionnel des records** (dépend du
pilier nutrition) · **tendance historique de la densité**.

---

## 61. MOTION-01 — Langage de mouvement (`feature/motion01-langage-mouvement`)

> **24 critères.** Spec : [motion01-langage-mouvement.md](docs/specs/functional/us/motion01-langage-mouvement.md) ·
> Plan : [motion01-langage-mouvement.md](docs/plans/motion01-langage-mouvement.md) ·
> Maquettes animées : [design/motion-01/](design/motion-01/) (6 planches).
>
> ✅ **Aucune migration, aucune sync rule, aucune dépendance native** — `react-native-reanimated`,
> `react-native-worklets`, `expo-haptics` et `react-native-svg` étaient déjà au `package.json`.
> **Recettable sur un build de la branche**, sans repasser par EAS.
>
> 🔴 **Le critère 1 conditionne tous les autres.** Si les animations sont coupées côté système,
> rien de ce qui suit ne bougera — et ce sera le comportement correct.
>
> ⚠️ **Lot volontairement incomplet.** L'analyse proposait 45 effets ; **19 sont livrés**. La
> dernière sous-section liste les 26 autres et dit pourquoi. Ne pas les chercher dans l'app.

### Le garde-fou d'abord

- [ ] 1. **Couper « Animations » dans Réglages → Animations** : plus aucun mouvement nulle part,
      mais **rien ne disparaît** — anneaux, chiffres et barres s'affichent directement à leur
      valeur. Rallumer : le mouvement revient.
- [ ] 2. **Activer « Supprimer les animations » dans les réglages Android** : même effet, et
      l'interrupteur de l'app ne peut **pas** le contredire (garder « Animations » activé dans
      l'app : rien ne doit bouger malgré tout).
- [ ] 3. **Les vibrations continuent** dans les deux cas ci-dessus. Couper le mouvement visuel
      n'est pas couper le retour tactile.

### Partout dans l'app

- [ ] 4. **Appuyer sur n'importe quel bouton** : il s'enfonce légèrement et vibre brièvement.
      *Avant : un simple changement d'opacité, invisible sous le pouce.*
- [ ] 5. **Ouvrir l'accueil** : les cartes arrivent **en cascade**, pas toutes d'un coup.
      Revenir depuis une sous-page ne rejoue **pas** la cascade.
- [ ] 6. **Changer d'onglet** : l'icône de l'onglet qui prend le focus grossit brièvement.
- [ ] 7. **Régler la langue sur English** : les chiffres animés (streak, bilan calorique) utilisent
      `1,234.5` et non `1 234,5`.

### Musculation

- [ ] 8. **Démarrer une séance, valider une série, laisser le repos se lancer** : un **anneau**
      entoure le compte à rebours et se vide régulièrement, sans à-coup entre deux secondes.
      *Avant : un texte qui décrémente, et rien d'autre.*
- [ ] 9. **Dans les 5 dernières secondes**, l'arc passe du beige au **vert**.
- [ ] 10. **Appuyer sur « + 15 s » pendant le repos** : l'anneau **se remplit** (la durée totale a
      augmenté), il ne saute pas.
- [ ] 11. **Repos de 10 minutes** (régler un exercice à 600 s) : « 10:00 » tient dans l'anneau sans
      toucher l'arc.
- [ ] 12. **Valider une série** : le bouton encaisse le coup et la vibration part **à l'appui**,
      pas au relâchement. Aucune latence ajoutée — la série est validée instantanément.
- [ ] 13. **Boutons « − » et « + »** de poids / répétitions : ils s'enfoncent nettement (cible
      plus petite, donc enfoncement plus marqué).
- [ ] 14. **Terminer une séance avec un record** : la carte de célébration arrive en **ressort avec
      dépassement**, et deux ondes partent du centre. *Pas de confettis.*

### Course

- [ ] 15. **Démarrer une course GPS** : un halo se propage en continu autour du point de position,
      en boucle, pendant toute la course.
- [ ] 16. **Mettre l'app en arrière-plan pendant une course, puis revenir** : le halo s'était
      arrêté et repart. *C'est le garde-fou batterie — invisible, mais c'est le point.*
- [ ] 17. **Écran de résumé de course** (mode bornes, pas suivi) : **aucun halo** — le dernier
      point n'est plus au centre, un halo y serait à côté de la plaque.
- [ ] 18. **Terminer une course avec un record** : même célébration qu'en muscu (composant partagé).

### Nutrition

- [ ] 19. **Ajouter un aliment au journal** : l'anneau du bilan monte **depuis sa valeur
      précédente**, jamais depuis zéro, et le chiffre central roule vers la nouvelle valeur.
- [ ] 20. **Les trois barres de macros** se remplissent **décalées**, pas ensemble.
- [ ] 21. **Aucune barre ne dépasse puis ne revient** : elles décélèrent et se posent.
- [ ] 22. **Carte « Bilan du jour »** : son halo d'accent respire très lentement (~6 s par cycle).

### Accueil

- [ ] 23. **Carte de régularité** : le chiffre de la série transite au lieu de sauter (se constate
      au changement de jour, ou en clôturant la séance du jour).
- [ ] 24. **Carte « Séance du jour »** : son halo respire, comme celui du bilan nutrition. Les
      **autres** cartes de la grille ne respirent pas — c'est voulu.

### 🔴 Ce qui n'est PAS livré — ne pas le chercher

L'analyse listait 45 effets, **19 sont dans ce lot**. Les 26 autres, et pourquoi :

**Écartés pour une raison de fond** (ne seront pas faits tels quels)

- **S6 — pastille d'onglet glissante** : demande de remplacer la barre d'onglets d'`expo-router` par
  une barre maison, qui porte déjà le masquage des piliers désactivés (décision H), la couleur par
  menu et les libellés i18n. C'est de la reconstruction, pas du mouvement.
- **C2 — `dashmove` (pointillés qui défilent sur le tracé)** : `line-dasharray` est une propriété de
  **style de carte** MapLibre ; l'animer demanderait un rafraîchissement JS par image, ce que la
  règle R3 interdit — sur l'écran qui tourne le plus longtemps de l'app.
- **M7 en séance (toast de record live)** : les records ne sont évalués qu'à la **clôture** de la
  séance (`evaluateWorkoutRecords`). Un toast en direct demanderait une évaluation par série, c'est
  du travail de données, pas d'animation. La célébration existe, au résumé.
- **M11 — transition séance → résumé** : `workout-summary.tsx` est en cours de réécriture sur
  `feature/muscu-ux02-bilan-seance`. Y toucher aurait garanti un conflit de fusion pénible.

**Reste à faire, sans obstacle identifié** — M2, M5, M6, M9, M10 · C3 à C10 · N3, N5 à N9 ·
A2, A3, A5, A6 · S8 à S10, S12 à S14. Le socle est posé, ce sont des branchements.
---

## 62. DASH-01 — Dashboards immersifs (`feature/dash01-dashboards-immersifs`)

> **37 critères.** Spec : [dash01-dashboards-immersifs.md](docs/specs/functional/us/dash01-dashboards-immersifs.md) ·
> Plan : [dash01-dashboards-immersifs.md](docs/plans/dash01-dashboards-immersifs.md) ·
> Maquettes : [design/dash-immersifs-2026-09/](design/dash-immersifs-2026-09/) (19 planches, 3 pages).
>
> ✅ **Rien à préparer : ni secret, ni déploiement, ni migration à pousser.** La surface IA a été
> **retirée du build** (décision de Florian du 13/09/2026, spec §7) : l'app n'envoie rien à personne,
> et il n'y a aucun coût d'API. La carte « Demande-moi » reste, dans sa version **déterministe** —
> c'est le critère 37.
>
> ℹ️ La migration `20260913163130_dash01_ai_consent_usage` est appliquée sur le cloud et y reste
> (colonne + table dormantes) ; **aucune sync rule à déployer**.
>
> ⚠️ **Recettable sur un build de la branche** : aucune dépendance native nouvelle
> (`expo-speech` était déjà là).
>
> ⚠️ **Le mouvement se coupe avec MOTION-01** : si « Animations » est désactivé (app ou Android),
> tout ce qui suit s'affiche **directement à sa valeur finale**. C'est le comportement correct, et
> le critère 2 le vérifie.

### Le socle des quatre scènes

- [ ] 1. **Ouvrir chaque onglet** : chacun a **sa couleur** — bordeaux (muscu), bleu (course), vert
      (nutrition), terracotta clair (accueil) — quelle que soit la « couleur par menu » réglée.
- [ ] 2. **Couper « Animations »** (app ou Android) : les scènes s'affichent d'un coup, chiffres et
      jauges **déjà à leur valeur**. Rien ne disparaît, rien ne clignote.
- [ ] 3. **Arriver sur le pilier Musculation** : les muscles de la séance s'allument **une seule
      fois**, puis se posent. *C'est le correctif du « bug visuel » relevé sur la maquette : plus
      aucun clignotement en boucle.*
- [ ] 4. **Faire défiler un pilier vers le bas** : la scène sort de l'écran et un **bandeau compact**
      apparaît en haut, avec le titre et le chiffre clé. Remonter : il disparaît.
- [ ] 5. **En lecteur d'écran (TalkBack)** : le bandeau compact **n'est pas annoncé** tant que la
      scène est dépliée — l'information n'est pas lue deux fois.
- [ ] 6. **Thème sombre** : les quatre scènes restent lisibles, textes compris (contraste AA).

### Nutrition — le remplissage

- [ ] 7. **Ouvrir le journal** : la scène se remplit à hauteur de ce qui a été mangé, avec une
      **vague** lente en surface. Le niveau **ne dépasse jamais** le filet de cible.
- [ ] 8. **Dépasser la cible du jour** : le niveau s'arrête au filet et le texte dit l'excédent
      (« 240 kcal au-dessus »). *Aucune jauge qui déborde.*
- [ ] 9. **Les sept verres** de la semaine : taper un jour passé change de jour ; un **jour à venir
      ne répond pas**.
- [ ] 10. **Laisser un jour de la semaine sans rien saisir** : son verre est en **pointillé**, et la
      scène nomme le trou le plus récent. Le taper ouvre ce jour.
- [ ] 11. **Aujourd'hui, avec des aliments récents** : trois boutons d'ajout rapide ; un tap ajoute
      l'aliment à sa portion de référence. Sur un **jour passé**, ils disparaissent.
- [ ] 12. **Sans objectif calorique** : aucun niveau, aucun pourcentage — un lien « définir un
      objectif ».
- [ ] 13. **Le reste du journal est intact** : repas, hydratation, micros, qualité, planning repas.
- [ ] 14. **« Pourquoi ? » à côté du reste à manger** : les étapes du calcul (dépense estimée,
      ajustement d'objectif, bonus de séance) et un niveau de confiance.

### Course — le flux

- [ ] 15. **Ouvrir le pilier** : une trace parcourue en boucle, lente. **Mettre l'app en
      arrière-plan puis revenir** : elle s'était arrêtée et repart.
- [ ] 16. **Avec une séance prévue aujourd'hui** : type, structure (« 6 × 400 m »), volume, durée
      estimée et allure cible. Avec une **heure** saisie (HORAIRE-01) : l'heure et « dans ~3 h ».
- [ ] 17. **Sans heure saisie** : aucun compte à rebours inventé.
- [ ] 18. **Après une sortie terminée aujourd'hui** : la scène **change** — distance qui roule,
      durée, allure, et le 10 km estimé. *Avant, l'écran disait « rien de prévu ».*
- [ ] 19. **Km par km** (sortie GPS d'au moins 2 km) : une barre par kilomètre, un tap affiche son
      temps et son écart. Sans trace GPS, la carte **n'apparaît pas**.
- [ ] 20. **Chronos prédits** : n'apparaissent qu'avec un record de 5 km. Taper une distance ouvre
      « Pourquoi ? » (Riegel, depuis ton record).
- [ ] 21. **Charge** : le curseur se place entre les deux seuils, et la zone est **nommée**. Sans
      4 semaines d'historique, la carte se tait.

### Musculation — l'impact

- [ ] 22. **Avec une séance prévue** : nom, programme, exercices, durée estimée, les trois premiers
      exercices en pastilles et « + N autres ».
- [ ] 23. **Le record à portée** apparaît sous la séance (« Squat : 2,5 kg du record »). S'il n'y en
      a pas, la ligne devient « Semaine 3 sur 8 ».
- [ ] 24. **Après une séance terminée aujourd'hui** : tonnage qui roule, exercices, records battus.
      *Avant : « repos mérité », sans un chiffre.*
- [ ] 25. **La semaine séance par séance** : sept jours, les jours faits marqués, un tap ouvre le
      planning.
- [ ] 26. **À ta portée** : jusqu'à trois exercices avec l'écart au record ; un tap ouvre la fiche.
      Rien à portée → la carte se tait.
- [ ] 27. **« Et si… »** : changer les séances par semaine fait bouger la projection **et** la cible
      calorique. Deux séances de plus avec « sommeil comme d'habitude » : un avertissement de
      surcharge, et la projection **baisse**. Sans historique suffisant : ce qui manque, et **aucun
      chiffre**.
- [ ] 28. **« Pourquoi ? » sur la projection, puis « ce n'est pas ça » sur le sommeil** : la règle
      est atténuée, la projection change, et le bouton propose de la restaurer. *Trois refus la
      neutralisent ; elle ne s'inverse jamais.*

### Accueil — le souffle

- [ ] 29. **Avant 11 h, sans check-in** : cinq pastilles d'énergie. En taper une l'enregistre, et la
      scène affiche le verdict de forme.
- [ ] 30. **Le soir (après 20 h par défaut), sans activité du jour, avec une série en cours** : la
      série, le temps restant, l'état du joker, et un bouton d'action courte.
- [ ] 31. **Après 7 jours sans rien** : « content de te revoir », la meilleure série, et deux
      reprises proposées (douce / plan normal). *Aucun reproche.*
- [ ] 32. **Le reste du temps** : les anneaux de la semaine, un par pilier **actif** (désactiver un
      pilier retire son anneau).
- [ ] 33. **« Depuis ta dernière visite »** : après une pesée ou un record, la carte apparaît au
      retour ; sinon elle **ne s'affiche pas**.
- [ ] 34. **Le lundi ou le mardi** : le bilan de la semaine en cartes. Le mercredi : plus rien.
- [ ] 35. **Le matin** : le brief, trois phrases au plus. **Écouter** : la voix lit, et la phrase en
      cours s'éclaircit. Quitter l'écran : la voix s'arrête.
- [ ] 36. **« Demande-moi »** : les trois questions répondent **même sans réseau** et sans assistant
      IA activé.

### L'absence d'IA (décision du 13/09/2026)

- [ ] 37. **Aucune surface IA nulle part** : pas de bouton photo dans le journal (le geste principal
      de la scène nutrition est « Chercher »), **pas de section « Assistant IA »** dans les Réglages,
      et « Demande-moi » répond **sans jamais mentionner de reformulation**. *Rien ne doit sortir de
      l'appareil vers un tiers.*

### 🔴 Ce qui n'est PAS livré — ne pas le chercher

- **La photo de repas et l'assistant IA** : la plomberie existe (migration appliquée, fonction Edge
  `ai-assist` dans le dépôt), mais **la surface est retirée du build de lancement** — l'app est
  gratuite en V1 et l'IA était cadrée en palier payant post-V1
  ([analyse du 15/07/2026](docs/product/ia-integration-analyse.md)). Aucun secret n'est posé, aucune
  fonction n'est déployée, **aucun coût d'API**. « Demande-moi » reste, en version déterministe.
- **Le partage de la carte de séance depuis le hub muscu** : il reste sur l'écran de bilan, à un tap
  de plus. Le dupliquer aurait demandé de recharger tout le rapport de séance dans le hub.
- **L'écart de prédiction 10 km à l'arrivée d'une sortie** : l'app ne garde pas l'historique des
  records, donc l'écart avec l'estimation d'hier n'est **pas calculable**. La scène affiche
  l'estimation courante et dit quand elle vient de cette sortie. Un écart inventé serait pire.
- **Le compte à rebours à la minute** : il reste à l'heure (« dans ~3 h », « environ 4 h »). La seule
  horloge autorisée dans un hook est réactive à l'heure pile ; une minuterie à la minute ferait
  re-rendre l'écran soixante fois par heure pour une précision que personne ne lit.

## 63. MUSCU-UX03 — Mode immersif de la séance (`feature/muscu-ux03-mode-immersif`)

> **56 critères.** Spec : [muscu-ux03-mode-immersif.md](docs/specs/functional/us/muscu-ux03-mode-immersif.md) ·
> Plan : [muscu-ux03-mode-immersif.md](docs/plans/muscu-ux03-mode-immersif.md) ·
> Maquettes : [design/muscu-ux03-mode-immersif/](design/muscu-ux03-mode-immersif/) (2 toiles, dont un
> prototype jouable).
>
> ✅ **Aucune migration, aucune sync rule à redéployer, aucune dépendance native neuve.** Le mode et
> ses réglages vivent dans `secureStorage` ; le ressenti s'écrit dans la colonne `rpe` existante ;
> `expo-speech`, `expo-notifications`, `react-native-svg` et Reanimated étaient déjà là. **Recettable
> sur un build de la branche.**
>
> 🔴 **Le premier critère est le plus important : le mode classique ne doit avoir bougé en rien.**
> C'est tout le contrat de l'US (décision D1). S'il tombe, le reste de la section n'a plus d'intérêt.
> Le classique gagne **une seule chose** : la pastille de record en tête du repos (critères 7-8).
>
> ⚠️ **Il faut un historique pour voir la moitié de l'immersif.** Verdict, fantôme, records en direct
> et défi de dernière série comparent à la **dernière séance terminée du même exercice** : sur un
> compte neuf, ils se taisent — **c'est le comportement attendu**, pas un bug. Prévoir deux séances
> du même programme à quelques minutes d'intervalle pour les déclencher.
>
> ⚠️ **Le mode par défaut est Classique.** Pour recetter l'immersif, le choisir explicitement :
> sélecteur de la carte « Séance du jour », menu ⋮ en séance, ou Réglages › Séance.

### 🔴 Le classique n'a pas bougé — à passer en premier

- [ ] **1.** Mode **Classique**, niveau **Simplifiée** puis **Normale** puis **Détaillée** : l'écran
  de séance est identique à avant (carte de contexte, liste des exercices, barre d'action fixe,
  repos plein écran). Aucun fond sombre, aucune voix, aucun cadran, aucun brief.
- [ ] **2.** Superset, échauffement, RPE/RIR, note d'exercice, « Plus tard », « Remplacer »,
  dé-validation sans repos, « + Série » : tout se comporte comme avant.
- [ ] **3.** Le **niveau d'affichage** (profil) vaut pour les **deux** modes et reste synchronisé
  entre appareils ; le **mode**, lui, est local à l'appareil.

### Choix du mode

- [ ] **4.** Compte neuf (aucune séance terminée), premier « Commencer » : la feuille
  « Comment veux-tu t'entraîner ? » s'ouvre, **rien n'est coché**, « Retenir mon choix » l'est.
- [ ] **5.** Compte **avec historique** : la feuille ne s'ouvre jamais, le mode reste Classique.
- [ ] **6.** Le sélecteur **Classique · Immersif** de la carte « Séance du jour » change le mode et
  le retient **après redémarrage de l'app**.
- [ ] **7.** Menu ⋮ en pleine séance → « Mode d'affichage » : la bascule garde les **séries
  validées**, la **série courante**, le **repos en cours** (l'échéance ne repart pas de zéro) et les
  valeurs en cours de saisie.
- [ ] **8.** Réglages › Séance : chaque interrupteur agit et survit au redémarrage.

### Classique — la pastille de record (le seul ajout)

- [ ] **9.** Battre la **charge max** d'un exercice **qui a déjà un record** : pastille ambre
  « Record : … (avant …) » **en tête de l'écran de repos**, avec vibration. Aucune voix, aucun plein
  écran, aucun verdict.
- [ ] **10.** Premier passage sur un exercice **jamais fait** : aucune pastille (on n'invente pas un
  record sur une première fois).

### Immersif — la séance

- [ ] **11.** Fond **sombre** en thème clair comme en thème sombre. La surcharge « Couleurs des
  menus » ne s'y applique pas — c'est voulu.
- [ ] **12.** Le **ruban segmenté** de l'en-tête a un segment par exercice, large comme son nombre de
  séries ; il vire au vert quand un exercice est bouclé.
- [ ] **13.** « Ensuite » (pont ou repos) ouvre le **plan de séance** : aller à un exercice,
  dé-valider **sans relancer le repos**, supprimer, « + Série », monter, descendre, « Plus tard »,
  « Remplacer », « Ajouter un exercice ». Tout doit fonctionner comme dans la liste classique.
- [ ] **14.** Les trois niveaux montrent exactement le tableau §4.4 de la spec (écart au prévu,
  suggestion, échauffement, options de série, enjeu).
- [ ] **15.** Le **brief** s'affiche en immersif pour une séance de programme lancée depuis
  l'**accueil du pilier**, l'**accueil général**, le **planning** et la **fiche programme**, ainsi
  que pour une séance issue d'un **modèle**. Jamais pour une séance libre, jamais à la reprise.
- [ ] **16.** 🔴 Ouvrir le brief, **attendre deux minutes**, puis « C'est parti » : le chrono de la
  séance démarre **à zéro** (rien n'est créé tant qu'on n'a pas dit oui). Revenir en arrière depuis
  le brief ne laisse **aucune séance active** derrière soi.

### Barre chargée, effort, cadran

- [ ] **17.** Développé couché à **82,5 kg** : « Par côté : 25 + 5 + 1,25 · barre 20 kg ».
- [ ] **18.** Réglages › Séance, barre à **15 kg** : le calcul change (« 25 + 15 + 1,25 · barre 15 kg »).
- [ ] **19.** Exercice à **haltères** ou sur **machine** : aucune barre dessinée.
- [ ] **20.** Charge **inférieure ou égale** à la barre : « Barre seule ». Reste non chargeable :
  « + 0,5 kg non chargeable ».
- [ ] **21.** « Lancer la série » : l'écran passe en plein cadre et **bat au tempo**. Toucher le
  cercle compte une rép et vibre ; la **8ᵉ** rép sur un objectif de 7 passe en **or**.
- [ ] **22.** Réglages › « Guide de tempo » coupé : l'écran d'effort ne bat plus, tout le reste est
  identique.
- [ ] **23.** « Terminé » : le cadran s'ouvre sur les **reps comptées** ; **sans aucun comptage**,
  sur l'**objectif**. Le glissé vertical avance cran par cran et vibre.
- [ ] **24.** 🔴 Choisir **« Solide »** enregistre **RPE 7** (visible au niveau Détaillée). La séance
  suivante propose toujours une **progression** sur cet exercice — MUSC-F7 ne doit **pas** se
  déclencher. *(Un RPE 8 ici couperait silencieusement la progression assistée.)*
- [ ] **25.** Choisir **« Limite »** enregistre RPE 10 et propose **−2,5 kg** sur la série suivante
  du même exercice ; « Garder » ne change rien. Choisir **« Facile »** propose **+2,5 kg**.
- [ ] **26.** Aucun ajustement proposé sur un **échauffement**, ni si la charge suivante tomberait
  **sous la barre à vide**, ni s'il n'y a pas de série suivante.
- [ ] **27.** « Valider directement » (pont) valide la série **sans** effort ni cadran, avec les
  valeurs des champs.
- [ ] **28.** Série **à la durée** : l'effort affiche un **compte à rebours** ; à zéro, le cadran
  s'ouvre tout seul avec la durée atteinte.

### Retours après la série

- [ ] **29.** Verdicts du tableau §5.3 : « +2,5 kg vs mardi », « +1 rép vs mardi », « Comme mardi »,
  « 6 reps · mardi 8 », « Première référence posée ». **Aucun rouge** sur une série en dessous.
- [ ] **30.** Une référence de **plus de 7 jours** est nommée par sa **date** (« vs 02/08 »), pas par
  son jour.
- [ ] **31.** **Charge max battue** : plein écran de record pendant le repos (ressort, deux ondes,
  ancien record). Un toucher le ferme, le **repos continue dessous**, il se ferme seul au bout de
  ~2,6 s.
- [ ] **32.** Une **deuxième** charge max dans la même séance → **pastille** seulement (le plein
  écran ne se joue qu'une fois par séance).
- [ ] **33.** **1RM estimé** battu sans charge max → pastille ambre « 1RM estimé ».
- [ ] **34.** Les records **enregistrés à la clôture** sont les mêmes qu'en mode classique pour une
  séance identique. *(⚠️ écart connu et assumé : un exercice sans record antérieur n'est **pas**
  célébré en séance mais apparaît bien dans les records du bilan.)*

### Le repos

- [ ] **35.** Disque de **respiration** (2 s inspire / 3 s expire), « Prépare-toi » à T−5 s, trois
  vibrations à T−3, T−2, T−1, vibration longue à la fin.
- [ ] **36.** **Veille** : 20 s sans toucher → écran noir, chiffres braise, « Touche pour réveiller ».
  Réveil au toucher **et automatiquement à T−5 s**. Réglage « Veille » coupé → jamais de veille.
- [ ] **37.** Réduire le repos (chevron) : la barre compacte se pose **au-dessus du pont** sans le
  recouvrir, et la série suivante reste réglable pendant que le temps tourne.
- [ ] **38.** Onglet **« Le fantôme de mardi »** : écart chiffré et courbe cohérents avec les séries
  faites (vérifier à la main sur 2 séries). Réglage « Fantôme » coupé → onglet et pastille absents.
- [ ] **39.** Onglet **« Le corps qui chauffe »** : les pectoraux chauffent sur un développé couché,
  et la **légende écrite** nomme les deux muscles les plus chauds avec leur nombre de séries.
- [ ] **40.** **Exercice bouclé** : carte en tête du repos (séries, tonnage, écart en % vs la
  dernière fois, records), puis « Ensuite » présente l'exercice suivant.
- [ ] **41.** **Dernière série** derrière le fantôme : défi « N reps à X kg et mardi est battu » avec
  N correct. Devant : « mardi est déjà battu de X kg ». Après un ressenti **« Limite »** sur la série
  précédente : **aucun défi**.

### Coach vocal

- [ ] **42.** **Motivant** : voix audible, phrases complètes. **Sobre** : chiffres seuls, et rien au
  brief ni en fin de séance. **Muet** : aucune voix, **les légendes écrites restent**.
- [ ] **43.** Aucune parole **pendant l'effort** en dehors de la consigne dite au lancement ; une
  nouvelle réplique **coupe** la précédente.
- [ ] **44.** App en **anglais** : répliques écrites et voix en anglais.

### Fin de séance

- [ ] **45.** « Terminer la séance » : la **cérémonie** s'affiche pendant la clôture (titre, corps
  chauffé, durée, tonnage, séries, records, verdict du fantôme), puis « Voir le bilan » ouvre le
  bilan MUSCU-UX02.
- [ ] **46.** **Relais nutrition** présent **seulement** si le pilier Nutrition est actif **et** que
  le bonus glucides du jour est non nul. Pilier coupé → aucune ligne, pas même grisée.
- [ ] **47.** Carte à partager du bilan : **schéma corporel chauffé** + tonnage, séries, record.
  **Aucune donnée de santé** (ni poids du corps, ni nutrition).

### Le fil (notifications)

- [ ] **48.** Immersif, app en **arrière-plan** pendant le repos : notification **continue**
  « Repos jusqu'à 18:42 · … » (non sonore, non balayable), puis rappel **« C'est reparti »** à
  l'échéance.
- [ ] **49.** App au **premier plan** : la notification de fin de repos ne s'affiche **jamais** par
  dessus l'écran de repos.
- [ ] **50.** « Passer » ou « +15 s » dans l'app : le rappel est annulé / replanifié en conséquence.
- [ ] **51.** **Classique** : aucune notification de repos tant que le réglage est désactivé (défaut).
- [ ] **52.** 🔴 Une séance de 18 séries **ne consomme pas** le quota de 3 notifications immédiates
  par jour : un rappel du soir (streak, repas) arrive quand même.

### Transverse

- [ ] **53.** **Mode avion** toute la séance : tout fonctionne, voix comprise (si une voix est
  installée sur l'appareil).
- [ ] **54.** Réglage **« Animations »** coupé (ou « réduire les animations » du système) : mêmes
  informations, sans battement, sans ondes, sans pulsation.
- [ ] **55.** Unités en **livres** : disques américains (45/35/25/10/5/2,5 lb), barre 45 lb, verdicts
  et tonnages en lb.
- [ ] **56.** Aucune **clé brute** affichée (`immersive.…`, `coach.…`) en FR comme en EN.

---

## 64. GUID-01 — Objectif utile et régime de guidage (`feature/guid01-objectif-regime-guidage`)

[Spec](docs/specs/functional/us/guid01-objectif-regime-guidage.md) ·
[plan](docs/plans/guid01-objectif-regime-guidage.md) ·
[analyse](docs/product/analyse-objectif-guidage-2026-09.md) ·
[maquettes](design/objectif-guidage-2026-09/) · roadmap **1.30**

> ✅ **La migration est poussée** (13/09/2026) et le drapeau `GUIDANCE_WRITE_READY` est à `true` :
> la recette peut démarrer, rien à préparer côté base.
> ⚠️ Le push a d'abord été **refusé** — le cloud portait une migration (`20260913182920`, seed
> CIQUAL v2) dont le fichier n'était pas encore commité. Débloqué le jour même par `89396aa0` sur
> `dev`. Mentionné ici parce que si un symptôme d'écriture perdue apparaît en recette, c'est le
> premier endroit où regarder : vérifier que `GUIDANCE_WRITE_READY` vaut bien `true`.
> ✅ **Aucune sync rule à déployer** : `profiles` est déjà publiée en `select *`.

> ⚠️ **Il faut un compte NEUF** pour les critères 1 à 6 (l'onboarding ne rejoue pas tout seul —
> passer par Réglages → **Rejouer l'onboarding**).

### L'onboarding

- [ ] **1.** Compte neuf, onboarding complet : l'**étape 4 demande le guidage**, plus le niveau
  d'affichage. Le parcours compte toujours **5 étapes** (4 si la nutrition est coupée).
- [ ] **2.** Étape 3, chaque objectif affiche **ce qu'il décide** (« +300 kcal · progression en
  charge · endurance »), et ces mentions **changent** selon les piliers actifs.
- [ ] **3.** Choisir **Performance** avec muscu **et** course actifs → la question « Performance en
  quoi ? » apparaît. Avec un seul des deux → elle **n'apparaît pas**.
- [ ] **4.** Les chips d'échéance (3 mois / 6 mois / 1 an) se sélectionnent et se désélectionnent ;
  « Pas de date » est le défaut.
- [ ] **5.** Récapitulatif : la ligne **Guidage** affiche le régime choisi. En ayant **passé**
  l'étape 4, elle affiche « Accompagné » **avec la mention « Déduit de ton objectif »**.
- [ ] **6.** La carte sombre **« Ta première action »** pointe le bon pilier (muscu > course >
  nutrition) et son bouton mène au bon endroit.

### Le régime, vu de l'intérieur

- [ ] **7.** 🔴 **Régime guidé + collision de séances** (il faut une séance jambes lourde la veille
  d'un fractionné, et `Réglages → Détecteur de collisions` **activé**) : la séance est
  **déplacée toute seule**, et le bandeau annonce « Je l'ai déplacée à … ».
- [ ] **8.** Le bouton **« Annuler le déplacement »** de ce bandeau remet la séance à sa place —
  **et elle n'est pas re-déplacée dans la foulée**.
- [ ] **9.** **Régime accompagné**, même situation : la séance **ne bouge pas**, le bandeau propose
  « Déplacer à … ».
- [ ] **10.** **Régime autonome**, même situation : **aucun bandeau** sur le planning.
- [ ] **11.** 🔴 **`Détecteur de collisions` désactivé + régime guidé** : **rien ne bouge**, aucun
  bandeau. Le régime ne rallume jamais un réglage éteint.
- [ ] **12.** Changer le régime **global** après avoir posé une surcharge dans un pilier : la
  **surcharge gagne**, elle n'est pas écrasée.

### Les programmes

- [ ] **13.** Compte neuf sans programme, hub Muscu : toucher une suggestion ouvre la feuille
  **« Deux questions, et on affine »**. Y répondre **change le tri** des propositions.
- [ ] **14.** La feuille **ne revient plus** ensuite. « Plus tard » la referme **sans rien écrire**
  (le profil muscu affiche toujours « Pas encore renseigné »).
- [ ] **15.** Déclarer **« Je suis confirmé »** puis mettre le niveau d'affichage sur **Simplifiée** :
  les suggestions restent **avancées**. (C'est le bug historique : l'affichage servait de proxy.)
- [ ] **16.** Déclarer **1 jour / semaine** : la liste des suggestions **n'est jamais vide**.
- [ ] **17.** **Régime guidé**, compte neuf, muscu actif : le récapitulatif propose **« Je pose
  “<nom>” dans ton planning »**, et le toucher rend le programme **actif** dans le hub.

### Les profils de pilier

- [ ] **18.** **Réglages → Profil musculation** existe et s'ouvre (écran neuf).
- [ ] **19.** Les écrans de profil **Course** et **Nutrition** portent le sélecteur de régime, en
  haut. ⚠️ Le profil **Musculation n'en a pas**, et c'est voulu : aucun moteur muscu ne lit encore
  le régime, un curseur y décrirait des comportements qui ne se produisent pas.
- [ ] **20.** Tant qu'on n'a pas touché le sélecteur d'un pilier, il affiche **« Hérité de ton
  réglage général »** (ou « Déduit de ton objectif » si l'étape 4 a été passée). Après un toucher,
  **plus aucune mention**.
- [ ] **21.** Le texte sous le sélecteur **change** avec le régime choisi, et parle bien **du
  pilier** affiché.

### Les contradictions

- [ ] **22.** Régler objectif principal = **Prise de masse** et objectif nutritionnel = **Sèche** :
  la carte « Tes deux objectifs se contredisent » apparaît sur l'**accueil**.
- [ ] **23.** **« Pourquoi je te dis ça »** déplie une explication, et se replie.
- [ ] **24.** **« Garder mon objectif »** met la nutrition en prise de masse ; **« Garder ce
  réglage »** met l'objectif principal en perte de poids. La carte disparaît dans les deux cas.
- [ ] **25.** 🔴 **« Cette règle ne me correspond pas »** fait disparaître la carte, et elle **ne
  revient pas après un redémarrage complet de l'app** (le conflit, lui, existe toujours).
- [ ] **26.** **Régime autonome** (nutrition) : la carte **n'apparaît pas**, même avec le conflit.
- [ ] **27.** Poser **deux** conflits à la fois (masse + sèche **et** masse + marathon) : **une
  seule** carte à l'écran.

### Transverse

- [ ] **28.** Bascule **FR ↔ EN** sur les 6 écrans touchés (objectif, guidage, récap, feuille de
  contexte, profil muscu, carte de contradiction) : **aucune clé brute**, aucun texte tronqué.
- [ ] **29.** **Mode avion** : changer de régime, répondre aux deux questions et rejeter une règle
  fonctionnent. Tout est **retrouvé** au retour du réseau (et après redémarrage).
- [ ] **30.** **Police système à 1,5×** : les trois cartes de régime, la feuille et le segment
  restent lisibles et cliquables.
- [ ] **31.** **TalkBack** sur l'étape 4 : chaque régime s'annonce avec son libellé **et** sa
  description ; le segment des profils annonce l'état sélectionné.
- [ ] **32.** Compte **existant** (déjà onboardé) : son niveau d'affichage n'a **pas changé**, et
  son régime s'affiche comme **déduit** tant qu'il n'y touche pas.

---

## 65. DEPENSE / AUTRE-01 — La dépense d'une séance, et les autres activités (`dev`)

[Analyse](docs/product/analyse-depense-activites-2026-09.md) ·
[spec moteur DEPENSE-01](docs/specs/functional/us/depense01-moteur-depense.md) ·
[spec AUTRE-01](docs/specs/functional/us/autre01-autres-activites.md) ·
[spec DEPENSE-00](docs/specs/functional/us/depense00-socle-hors-sport.md) ·
[maquettes](design/depense-activites-2026-09/) · roadmap **4.41 · 4.42 · 4.43**

> ✅ **Les 3 migrations sont poussées** (15/09/2026) : table `activities`, `sport_free_level`,
> `show_energy_estimates`. Types régénérés.
> 🔴 **UNE SYNC RULE EST À COLLER À LA MAIN AVANT LA RECETTE** — table **neuve**. Dashboard
> PowerSync → Sync Rules → coller
> [powersync-sync-rules.yaml](docs/specs/technical/powersync-sync-rules.yaml) → **Deploy**.
> Sans ça : les activités restent **locales**, sans aucune erreur visible, et la cible calorique
> diffère d'un téléphone à l'autre (le piège déjà tombé sur BIEN-01 et RUN-F2c).
> ⚠️ **Le poids est obligatoire** pour voir le moindre chiffre : sans pesée ni poids de profil,
> toutes les cartes affichent « Il manque ton poids » — c'est le comportement attendu, pas un bug.
> ⚠️ **Livré en une passe, sans validation intermédiaire** (demande du 15/09). Les specs ont été
> écrites **avec** le code.

### Le moteur, vu de l'écran

- [ ] **1.** Finir une séance de muscu → le bilan affiche **« Dépense estimée ≈ X kcal »** avec sa
  fourchette (« entre … et … »), sous le bilan habituel.
- [ ] **2.** 🔴 **Le bilan lui-même n'a bougé en rien** : mêmes blocs, mêmes chiffres, même verdict
  qu'avant. La dépense est un **ajout en bas**, jamais une modification.
- [ ] **3.** « **D'où vient ce chiffre ?** » ouvre la feuille d'explication : corps au repos (kcal/h),
  intensité (MET), temps actif, résultat, **la phrase sur la montre** et **celle sur le niveau**.
- [ ] **4.** Le chiffre **change avec le ressenti** : refaire une séance équivalente en notant 4/10
  puis 9/10 → la dépense est nettement plus basse dans le premier cas.
- [ ] **5.** **Séance oubliée ouverte** (démarrer, laisser tourner > 1 h sans rien faire, terminer) :
  la dépense reste **plausible** — le temps actif est plafonné à 4 min par série validée.
- [ ] **6.** Terminer une **course avec GPS** → le résumé affiche la dépense, et **le dénivelé est
  mentionné** s'il y en a (« +120 m de dénivelé comptés »).
- [ ] **7.** 🔴 **Course sans GPS / tapis** (mode sans GPS, sans distance) : la dépense **n'est plus
  0** — elle est estimée sur la durée, avec la mention « estimée sur la durée et le ressenti ».
- [ ] **8.** Rouvrir une **vieille séance** dans l'historique : la dépense est calculée avec le poids
  **de l'époque** (vérifiable si une pesée ancienne existe et que le poids a changé depuis).

### Les autres activités

- [ ] **9.** Journal Nutrition → carte **« Ta journée en énergie »** → **« Ajouter une activité »**.
  L'écran s'ouvre en modale.
- [ ] **10.** Choisir **Vélo**, 1 h 30, **Soutenu** → la dépense estimée s'affiche **en bas, en
  direct**, et change quand on touche à la durée ou à l'intensité.
- [ ] **11.** « **Tout voir** » déplie les 22 types ; « Voir moins » les replie.
- [ ] **12.** Saisir une **distance** sur un vélo (ex. 30 km pour 1 h 30) → la dépense s'ajuste
  (la vitesse prime sur l'intensité déclarée).
- [ ] **13.** Saisir un **chiffre de montre** → il est **repris tel quel**, sans fourchette, avec la
  mention « Chiffre de ta montre ».
- [ ] **14.** Enregistrer → l'écran **« Ce que ça change »** liste : cible du jour, série, charge de
  la semaine, Health Connect.
- [ ] **15.** Le jour devient **actif dans la série** (widget d'accueil) alors qu'il n'y a **ni
  séance ni course** ce jour-là. 🔴 C'est le défaut principal que l'US répare.
- [ ] **16.** **Réglages → Suivi → Mes autres activités** : l'historique liste l'activité ; un tap
  ouvre l'**édition**, où l'on peut modifier puis **supprimer**.
- [ ] **17.** Refaire **deux fois** la même combinaison (même type, même durée, même intensité) →
  elle apparaît ensuite dans « **Tes habituelles** », et un tap la préremplit.
- [ ] **18.** Le **temps d'entraînement** de la semaine (widget accueil) inclut la durée de
  l'activité.
- [ ] **19.** Avec muscu **et** course activés, une grosse activité fait **monter la charge** (widget
  de charge / score de forme) — elle ne pèse plus zéro.
- [ ] **20.** **Health Connect activé** : l'activité apparaît dans Health Connect **avec son type**
  (Vélo, Natation…) et **sans calories**. 🔴 Vérifier l'absence de calories : en ajouter demanderait
  un 7ᵉ type dans la déclaration Play, qui ne se dépose qu'une fois.
- [ ] **21.** **Hors ligne** (mode avion) : saisir une activité fonctionne ; elle remonte au retour du
  réseau. **Sur un 2ᵉ appareil**, elle apparaît (c'est ce qui valide la sync rule).

### La cible calorique (le sujet sensible)

- [ ] **22.** 🔴 **Rien ne change tant qu'on ne demande rien** : sur un compte existant en mode
  **Forfait** ou **Auto**, la cible du jour est **exactement la même qu'avant** cette livraison.
- [ ] **23.** Profil nutrition → **Bonus jour d'entraînement** propose désormais **trois** modes.
  En mode **Auto** avec un niveau d'activité « modérément actif » ou plus, un **encadré ambre**
  prévient que le sport est compté deux fois.
- [ ] **24.** Choisir « **Selon ce que tu fais** » → la question « **Hors sport, tu es plutôt…** »
  apparaît (Assis / Debout / Physique), avec la mention « appliqué par défaut » tant qu'on n'a pas
  choisi.
- [ ] **25.** Dans ce mode, la **cible d'un jour de repos baisse** (socle hors sport) et **monte avec
  chaque séance ou activité** du jour.
- [ ] **26.** La carte « Ta journée en énergie » montre le calcul : **socle + objectif → + dépenses →
  cible → reste**. Les chiffres **collent** à ceux de la scène Nutrition (même cible, même reste).
- [ ] **27.** 🔴 **Deux chiffres différents par ligne, et c'est voulu** : « ≈ 370 » (ce que ça a
  coûté) et « +260 » (ce que la cible autorise en plus, bas de fourchette).
- [ ] **28.** Revenir **en arrière** (mode Forfait) → la cible redevient celle d'avant, sans perte.
- [ ] **29.** **Adhérence / bilan calorique** (Nutrition → Stats) : les jours passés restent
  cohérents avec le mode choisi, sans cible recalculée à l'envers.

### Le garde-fou

- [ ] **30.** **Réglages → Calories dépensées → interrupteur OFF** : les chiffres disparaissent des
  bilans, de la carte du jour et de l'historique. 🔴 **Mais la cible continue de s'ajuster** — on a
  retiré l'affichage, pas le calcul.
- [ ] **31.** Aucun écran ne propose d'**équivalence alimentaire** (« = 1 part de pizza ») ni de ton
  de récompense (« tu l'as bien mérité »). C'est une règle produit, pas une finition.
- [ ] **32.** **Sans poids renseigné** : les cartes affichent « Il manque ton poids » **et le
  raccourci pour se peser**, jamais un chiffre par défaut.
- [ ] **33.** **Pilier Nutrition désactivé** : la dépense s'affiche toujours en fin de séance, mais
  **sans aucune ligne de cible**.

### Ce qui n'est PAS livré (ne pas le chercher)

- L'**aperçu avant/après chiffré** au basculement de mode (la maquette en montrait un).
- L'**anticipation** d'une séance planifiée sur la cible du matin en mode « Selon ce que tu fais ».
- L'**import des activités d'une montre** (Health Connect en lecture) et l'écriture des **calories**.
- La **calibration du socle par le poids** (« l'app apprend ton vrai socle »).
- Les **récurrences** (« vélotaf tous les mardis ») et la **planification** d'une activité.
- L'entrée dans la **barre d'actions rapides** de l'accueil (limitée à 4 pastilles par ACCUEIL-03).
- Le **détecteur de collisions** ne lit pas encore la sollicitation (`focus`) des activités.
- L'**édition** d'une activité ne réécrit pas son record Health Connect.
- Les **MET** viennent du Compendium **2011** : si un chiffre paraît franchement faux en recette,
  c'est la **donnée d'entrée** qu'il faut corriger, pas la formule.

---

## 66. LABO-01 — Le Labo (`dev`)

[Spec](docs/specs/functional/us/labo01-labo.md) · [plan](docs/plans/labo01-labo.md) ·
[analyse](docs/product/analyse-labo-2026-09.md) ·
[maquettes + prototype jouable](design/labo-2026-09/) ·
[ADR-008](docs/adr/ADR-008-scene-3d-composant-dom.md) · roadmap **7.30**

> ✅ **Base prête, la recette peut démarrer** (16/09/2026) :
> les **2 migrations sont poussées** (`npx supabase db push --include-all`), `npm run db:types` a
> confirmé `daily_wellbeing.sleep_minutes` et la table `lab_experiments`, la **sync rule est
> déployée** dans le dashboard PowerSync, les deux lignes sont cochées au
> [registre](supabase/MIGRATIONS.md), et **`LAB_WRITE_READY` est à `true`**.
>
> ⚠️ `--include-all` a été nécessaire : ces migrations sont horodatées **avant** celles de DEPENSE-01
> déjà appliquées, et le CLI refuse par défaut d'insérer dans le passé de l'historique distant. Sans
> conséquence — les deux jeux sont strictement additifs et disjoints. Mentionné ici parce que si un
> symptôme d'écriture perdue apparaît en recette, c'est le premier endroit où regarder : vérifier que
> `LAB_WRITE_READY` vaut bien `true` et que la sync rule contient bien `lab_experiments`.
>
> 🔴 **Nouvelle dépendance : un build est requis.** La scène 3D est un **composant DOM**
> (`@expo/dom-webview`, déjà fourni par `expo` 57) et `three` est une dépendance neuve : l'APK
> existant **ne suffit pas**. Même contrainte que PARTAGE-01, RUN-F2a, MUSC-F9 et LAUNCHER-01.
>
> 🔵 **Pour voir les TROIS disques** : sur un compte à 0 séance et 0 km cette semaine, seule
> l'assiette s'affiche — c'est exact, mais increcettable. Jouer
> [supabase/scripts/labo-dataset.sql](supabase/scripts/labo-dataset.sql) dans le SQL Editor
> (e-mail à renseigner en tête). Il fabrique la semaine en cours sur les trois piliers — muscu
> 2 faites / 4 prévues, course 14,5 km courus / 24 prévus, nutrition et sommeil — plus 8 semaines
> d'historique pour que « Pourquoi ? » et « Acquis » aient de quoi calculer.
> ⚠️ **Il efface les données personnelles du compte visé** (hard delete). Il ne touche **ni**
> l'authentification, **ni** les profils, **ni** la bibliothèque partagée. Une requête de
> vérification est fournie à la fin du fichier.
>
> ⚠️ Les onglets « Pourquoi ? » et « Acquis » ont besoin d'**historique** : sur un compte neuf ils
> afficheront légitimement leur état vide. C'est un critère à part entière (§66.30), pas un défaut.

### La scène et l'entrée

- [ ] **1.** L'onglet **Labo** apparaît dans la barre du bas (icône `aperture`), et **disparaît** si
  on coupe les trois piliers dans les réglages.
- [ ] **2.** 🔴 **La 3D démarre.** À l'ouverture : le podium, la **pile de disques de fonte**, la
  **piste** et l'**assiette** sont visibles et nets — pas un carré noir ni une image figée. Faire
  tourner la scène au doigt : elle suit, sans à-coups.
- [ ] **3.** Toucher un disque : la caméra s'en approche. Toucher le vide : elle revient à
  l'ensemble. Le texte d'aide sous la scène change en conséquence.
- [ ] **4.** 🔴 **La scène ne vole pas le défilement.** Faire défiler le corps de l'écran en partant
  **juste sous** la scène, puis en partant **sur** elle : le corps défile normalement dans le
  premier cas, et la scène reste à sa place (hauteur fixe) dans les deux.
- [ ] **5.** Les **lampes-nuits** du socle correspondent aux nuits notées : allumées au-dessus de
  7 h, éteintes en dessous, **absentes** les jours sans check-in — jamais « éteintes » par défaut
  sur un jour non renseigné.
- [ ] **6.** Réglages → **Mouvement réduit** : la scène passe d'un état à l'autre sans animer, et
  rien ne clignote.
- [ ] **7.** Changer d'onglet (Semaine → Composer → Pourquoi ? → Acquis) : la légende en haut à
  gauche de la scène change à chaque fois, et la scène change avec elle.
- [ ] **8.** Basculer **FR ↔ EN** : les textes **dessinés dans la scène** (« SÉANCE », « SUR 30 KM »,
  les initiales des jours) changent eux aussi. Aucune clé brute nulle part.

### Onglet Semaine

- [ ] **9.** « Où tu en es » affiche les **vrais** chiffres de la semaine en cours : séances faites
  sur prévues, kilomètres, protéines par kilo, nuits. Les comparer à ceux des écrans Muscu, Course
  et Nutrition — ils doivent **coïncider**.
- [ ] **10.** Un pilier **désactivé** n'a ni bloc de progression, ni proposition le concernant.
- [ ] **11.** La grille montre les séances **faites en plein** et les **prévues en pointillé**, et
  le jour courant est surligné.
- [ ] **12.** 🔴 **Un jour sans donnée est un trou.** Un jour sans repas saisi n'affiche pas
  « 0 g/kg » ; un jour sans check-in n'affiche pas « 0 h ».
- [ ] **13.** Chaque proposition porte **un chiffre qui la justifie** (« 12 séries de jambes la
  veille », « protéines à 1,4 g/kg ») et **un seul geste**.
- [ ] **14.** 🔴 **Rien ne s'écrit au tap.** Appuyer sur le geste d'une proposition qui touche le
  plan (décaler, alléger) : elle passe à **« Prêt »** et **rien ne bouge** dans le planning — le
  vérifier sur l'écran Planning **avant** de confirmer.
- [ ] **15.** « Retirer » sur une proposition prête la remet à son état initial, et le bouton
  d'application disparaît s'il n'en reste aucune.
- [ ] **16.** 🔴 **La feuille dit la vérité.** Appuyer sur « Appliquer … » : elle nomme le
  changement, son pilier et **les écrans où ça se verra**. Confirmer, puis vérifier sur **chacun**
  de ces écrans que le changement y est — et **nulle part ailleurs**.
- [ ] **17.** Une séance **décalée** l'est au jour annoncé par la proposition, pas un autre.
- [ ] **18.** Une séance **allégée** l'est de **25 % de répétitions**, **aujourd'hui seulement** :
  rouvrir le programme, les séances des semaines suivantes sont intactes.
- [ ] **19.** Une proposition qui **ouvre un écran** (protéines, glucides, planning) y va
  **directement**, **sans** passer par la feuille de confirmation.
- [ ] **20.** Une proposition appliquée reste marquée **« Dans ton plan »** et ne se re-propose pas.
- [ ] **21.** Semaine sans rien à signaler : l'écran le dit (« ta semaine est calée ») au lieu de
  rester vide.

### Onglet Composer

- [ ] **22.** Les leviers affichés correspondent aux **piliers actifs**, et chaque « + » / « − »
  change **immédiatement** la scène et les cartes de conséquence.
- [ ] **23.** 🔴 **Aucune projection d'allure ni de chrono nulle part** : ni « −25 s au 10 km », ni
  temps estimé. La phrase d'honnêteté en bas de l'onglet est présente et lisible.
- [ ] **24.** La projection de **force à 8 semaines** et sa fourchette correspondent à ce qu'affiche
  « Et si… » sur le dashboard Musculation pour les mêmes réglages.
- [ ] **25.** Monter les séances **et** passer les nuits sous 7 h fait apparaître le croisement de
  **surcharge**, marqué comme garde-fou (bordure d'alerte).
- [ ] **26.** 🔴 **Les séances de musculation ne s'écrivent pas.** Ne régler **que** ce levier :
  aucun bouton « Appliquer » n'apparaît, et la phrase qui l'explique s'affiche.
- [ ] **27.** Régler la fréquence de course puis confirmer : la valeur est bien celle du **profil
  coureur** (Course → profil).
- [ ] **28.** Régler la cible de protéines puis confirmer : la cible du profil nutrition change, et
  **en grammes par jour** cohérents avec le poids (g/kg × poids).
- [ ] **29.** « Revenir à mes réglages » remet tout à l'état initial et fait disparaître le bouton.

### Onglets Pourquoi ? et Acquis

- [ ] **30.** Sans historique : les deux onglets affichent leur **état vide expliqué**, pas une page
  blanche ni un chiffre à zéro.
- [ ] **31.** Avec de l'historique : les suspects sont **classés**, chacun avec sa preuve chiffrée,
  et l'écran dit que ce sont des **associations, pas des preuves**.
- [ ] **32.** 🔴 **Aucune expérience sur les calories.** Sur « mon poids ne bouge plus », la
  proposition est de **mesurer** (saisir aussi les week-ends), **jamais** de manger moins.
- [ ] **33.** Lancer une expérience : elle démarre au **lundi suivant** (la date est affichée), son
  verdict est annoncé **scellé**, et le même modèle ne peut pas être relancé tant qu'il tourne.
  L'arrêter depuis « Acquis » fonctionne.
- [ ] **34.** Chaque acquis dit **d'où il vient** (expérience ou association), **sur combien de
  cas**, et **à quoi il sert** dans l'app.

### La note de nuit (check-in)

- [ ] **35.** Réglages → Suivi → Bien-être → check-in : le bloc **Nuit** est présent, à « non
  renseignée » par défaut.
- [ ] **36.** Le premier **« + »** pose **7 h**, puis les crans suivants valent **un quart d'heure**.
  « effacer » ramène à « non renseignée ».
- [ ] **37.** 🔴 **Une nuit seule suffit à enregistrer** : sans toucher humeur, énergie ni stress, le
  bouton s'active, et la valeur est retrouvée en rouvrant la feuille.
- [ ] **38.** La nuit saisie apparaît dans le Labo (bloc « Sommeil », grille de la semaine, lampes du
  socle).

### Transverse

- [ ] **39.** **Mode avion** : mettre une proposition prête, confirmer, lancer une expérience — tout
  est enregistré, retrouvé après redémarrage, et **remonte** au retour du réseau (vérifier la ligne
  côté Supabase).
- [ ] **40.** **Police système à 1,5×** : les quatre onglets, les cartes de conséquence et la feuille
  restent lisibles ; rien n'est tronqué ni superposé.
- [ ] **41.** **TalkBack** : les boutons « + » / « − » s'annoncent avec leur **libellé explicite**
  (« Augmenter : cible de protéines »), pas « plus » ; la feuille se lit dans l'ordre.
- [ ] **42.** **WebGL indisponible / appareil modeste** : la scène bascule sur les **mêmes disques en
  2D**, le message le dit, et **tout le reste de l'écran fonctionne normalement**. 🔴 **La zone ne
  doit JAMAIS rester vide sans message** : si la scène ne répond pas en 5 s, le repli 2D part tout
  seul. Une bande vide et muette est un défaut à remonter, pas une lenteur.
- [ ] **49.** 🔴 **La 3D remplit bien sa zone** (correctif du 16/09). Sur le premier APK, le canvas
  faisait **zéro pixel de haut** : WebGL tournait, la scène se déclarait OK, et on ne voyait rien.
  Vérifier que les disques occupent toute la hauteur de la scène, en portrait **et** après une
  rotation de l'écran.
- [ ] **50.** 🔴 **La scène montre le VÉCU, pas le prévu** (correctif du 17/09). Sur une semaine où
  l'on a couru **sans l'avoir planifié** (0 km prévu, des km faits), la **piste doit être visible**.
  Idem pour une séance de muscu faite hors programme : elle doit poser son disque. ⚠️ Un pilier
  actif dont la semaine est **réellement vide** (0 prévu, 0 fait) n'a pas de disque — c'est voulu,
  ce n'est pas un défaut.
- [ ] **51.** **L'attente est dite.** À l'arrivée sur le Labo, pendant les 3-4 s de montage de la
  scène : un indicateur et « La scène se monte… ». Le texte d'aide (« Glisse pour tourner ») ne doit
  apparaître qu'**après**. Avec **Mouvement réduit** activé : le texte reste, le tourniquet non.
- [ ] **43.** Ouvrir et quitter l'onglet Labo **dix fois** de suite : pas de ralentissement
  progressif ni de chauffe anormale — la scène doit se libérer à la sortie.

### Les correctifs de revue (à vérifier spécifiquement)

- [ ] **44.** 🔴 **Une expérience terminée se relance.** Sur un compte dont une expérience a dépassé
  ses 4 semaines : l'onglet « Pourquoi ? » doit reproposer « Lancer l'expérience » (et **non**
  « déjà en cours »), la relance doit fonctionner, et l'ancienne doit rester visible avec son verdict
  dans « Acquis ».
- [ ] **45.** 🔴 **Le check-in rapide de l'accueil n'efface plus la nuit.** Saisir une nuit dans la
  feuille de check-in, puis taper le widget « énergie » depuis l'accueil : rouvrir la feuille — la
  nuit **et** l'humeur **et** le stress doivent être intacts.
- [ ] **46.** **Un échec d'écriture se voit.** En **mode avion coupé au mauvais moment** (ou en
  supprimant la séance visée depuis un autre appareil), confirmer la feuille : un message doit
  s'afficher, la feuille rester ouverte, et la proposition **ne pas** être marquée « Dans ton plan ».
- [ ] **47.** **L'assiette grossit pour une prise de masse.** Onglet Composer, passer « maintien » →
  « prise de masse » : la carte calorique monte **et** la portion de l'assiette grossit (avant
  correctif, elle rétrécissait comme pour une sèche).
- [ ] **48.** **Les dates sont au format français** : « démarre le 21/09 », jamais « 2026-09-21 ».

> ⚠️ **Cinq constats de revue restent ouverts** (détail au [CHANGELOG](CHANGELOG.md) et dans la
> [spec §4 bis](docs/specs/functional/us/labo01-labo.md)). Le plus visible en recette longue :
> **un acquis peut se désapprendre** — 28 jours après le verdict d'une expérience, ses premières
> semaines sortent de la fenêtre de 56 jours et la carte « vérifié » peut redevenir « pas assez de
> mesures ». Ce n'est pas un défaut à remonter, c'est une limite connue, à corriger ensuite.

---

## 67. IA-LAB-01 — Labo IA, un modèle gratuit sur des données factices (`dev`)

[Spec](docs/specs/functional/us/ialab01-labo-ia.md) · [plan](docs/plans/ialab01-labo-ia.md) ·
[analyse §7](docs/product/ia-integration-analyse.md) · roadmap **7.31**

> 🔴 **À préparer AVANT de recetter, dans cet ordre.** Les trois premiers gestes sont **humains** —
> aucun agent ne peut les faire.
>
> 1. **Créer une clé Gemini gratuite** sur <https://aistudio.google.com/apikey> (compte Google, pas
>    de carte bancaire). Quota du palier gratuit : ~10 requêtes/min, ~1 500/jour.
> 2. Poser le secret et déployer. 🔴 **`npx`, et `--use-api`** :
>    ```
>    npx supabase secrets set GEMINI_API_KEY=…
>    npx supabase functions deploy ai-assist --use-api
>    ```
>    Le CLI est une **dépendance du projet**, pas un binaire global : `supabase` seul renvoie
>    « n'est pas reconnu ». Et `--use-api` fait faire le bundle côté serveur — sans lui, le
>    déploiement réclame **Docker**, que ni Florian ni Damien n'ont.
>    Le projet est déjà lié (`nsxzflxsgovriwwvflxe`) : rien d'autre à passer.
>    Tant que ce n'est pas fait, la fonction répond `ai_unavailable` — **et rien n'est facturé**.
> 3. Jouer [`supabase/scripts/ia-purge-et-dataset.sql`](supabase/scripts/ia-purge-et-dataset.sql)
>    dans le **SQL Editor** du cloud. ⚠️ Il **efface** toutes tes données d'entraînement, de course,
>    de nutrition et de suivi (le compte, les profils et la bibliothèque sont conservés).
> 4. *Facultatif mais recommandé* : `npm run db:push` **avant** (3), pour que LABO-01
>    (`sleep_minutes`) soit en place et que le signal S3 soit complet. Sans ça le script tourne
>    quand même, en le disant, mais sans le sommeil.
>
> ✅ **Aucune migration, aucune sync rule, aucun nouveau build.** `ai_consent_at` et `ai_usage`
> datent de DASH-01 (13/09), aucune dépendance native n'est ajoutée : **l'APK existant suffit**.
>
> 🔴 **Données factices uniquement.** Le palier gratuit de Gemini peut utiliser les requêtes pour
> entraîner ses modèles ([analyse §7.2](docs/product/ia-integration-analyse.md)). Ne jamais activer
> ce labo sur un compte portant de vraies données.

### Le jeu de données

- [ ] **1.** Le script s'exécute **sans erreur** (« Success. No rows returned »). ⚠️ Le SQL Editor
  de Supabase n'affiche **que des lignes** : les `raise notice` du script, donc son compte rendu,
  n'y apparaissent jamais. Jouer ensuite
  [`supabase/scripts/ia-verification.sql`](supabase/scripts/ia-verification.sql), qui rend un
  tableau : volumétrie (~68 séances, ~680 séries, ~51 sorties, ~460 lignes de repas, 18 pesées)
  **et surtout la confirmation des six signaux**, chaque ligne portant sa valeur attendue.
- [ ] **1 bis.** 🔴 **Les six signaux sont bien dans les données** avant d'interroger l'IA. Juger
  une réponse contre un signal non confirmé, c'est tester deux choses à la fois et n'en conclure
  aucune : la vérité de référence se vérifie **d'abord**. Chaque ligne « 28 j / 28 précédents » doit
  montrer l'écart annoncé : pectoraux identiques, jambes en hausse, −20 % de calories, énergie en
  baisse, stress en hausse, allure ~30 s plus lente, poids quasi identique.
- [ ] **1 ter.** ⚠️ **Si tu as joué le script AVANT le 16/09/2026 (correction des fenêtres),
  rejoue-le** : S3 et S5 portaient sur 21 jours au lieu de 28, et la dégradation d'allure était deux
  fois trop faible pour être lisible. Le script est rejouable autant de fois que voulu — il commence
  par tout effacer.
- [ ] **2.** 🔴 **Le compte survit.** Après exécution, l'app se **reconnecte normalement** avec le
  même identifiant : le script n'a effacé que des données, jamais le compte.
- [ ] **3.** 🔴 **La bibliothèque survit.** La liste des exercices et le catalogue d'aliments
  (3 244 entrées) sont intacts — le script ne touche que ce qui porte `owner_id = toi`.
- [ ] **4.** Sur le téléphone connecté, **PowerSync propage** : l'historique muscu, course et
  nutrition se remplit. Si un résidu local subsiste, Android → Paramètres → App → Effacer les
  données, puis reconnexion.
- [ ] **5.** Les écrans existants tiennent debout sur ce jeu : historique muscu, historique course,
  journal nutrition, courbe de poids, accueil. **Aucun écran ne plante ni n'affiche `NaN`.**

### Le consentement (le garde qu'on veut éprouver)

- [ ] **6.** 🔴 **Réglages → Labo IA existe**, l'interrupteur est **éteint** (le script laisse
  volontairement `ai_consent_at` à NULL). Le bouton « Ouvrir le labo » **n'apparaît pas**.
- [ ] **7.** Le texte sous l'interrupteur dit **ce qui part** (des agrégats), **ce qui ne part pas**
  (nom, notes, traces GPS) et **que le fournisseur gratuit peut s'en servir pour s'entraîner**.
- [ ] **8.** Activer : une **confirmation** s'affiche avant tout changement. « Annuler » laisse
  l'interrupteur éteint.
- [ ] **9.** Accepter : l'interrupteur passe à ON, « Ouvrir le labo » apparaît.
- [ ] **10.** Éteindre puis rallumer : pas de confirmation à l'extinction (on retire un droit, on ne
  le demande pas), confirmation de nouveau à l'allumage.

### Ce qui est envoyé (R3 — le cœur du sujet)

- [ ] **11.** Dans le labo, l'**avertissement rouge est le premier élément** de l'écran.
- [ ] **12.** Déplier « Ce qui est envoyé » : le texte affiché est **lisible**, chiffré, et
  ressemble à `PROFIL — … / POIDS — … / MUSCULATION — … / COURSE — … / NUTRITION — …`.
- [ ] **12 bis.** 🔴 **La section `TENDANCES` est présente en fin de bloc**, avec une ligne par
  mesure au format « X contre Y — ±Z % ». C'est elle qui rend les signaux trouvables : sans elle, le
  modèle ne voit que des moyennes sur 90 jours et **aucune** évolution. Vérifier qu'y figurent au
  moins : poids, calories, protéines, allure, énergie, stress.
- [ ] **12 ter.** La ligne « Charge max, 28 derniers jours contre les 28 précédents » du bloc
  MUSCULATION montre le **développé couché à l'identique** et le **squat en hausse**. C'est la forme
  exacte sous laquelle S1 devient trouvable.
- [ ] **13.** 🔴 **Aucune identité.** Ni prénom, ni e-mail, ni date de naissance (l'**âge** y est,
  la date non), ni note de séance, ni note d'exercice, ni coordonnée GPS. Relire le bloc en entier.
- [ ] **14.** Les **pas**, le **bien-être** et les **autres activités** (vélo, natation) y figurent.
- [ ] **15.** Aller couper le pilier **Course** dans les réglages, revenir : la ligne `COURSE`
  **disparaît** du contexte — elle n'est pas remplacée par « 0 sortie » (R5).
- [ ] **16.** Le texte est **sélectionnable** (appui long) : on doit pouvoir le copier pour le
  comparer à une réponse.

### Les questions et les réponses

- [ ] **17.** Les **six questions** proposées s'affichent. En toucher une remplit le champ ; le
  texte reste **modifiable**.
- [ ] **18.** Modifier le texte après avoir choisi une puce : la puce **se désélectionne** (elle ne
  correspond plus à ce qui partira).
- [ ] **19.** 🔴 **Une réponse arrive**, en français, en moins de ~15 s. Le pied de réponse indique
  **`gemini` · `gemini-flash-latest` · 1/20 questions utilisées**.
- [ ] **20.** La réponse est **sélectionnable** (pour la coller dans un compte rendu).
- [ ] **21.** Poser une question en anglais : la réponse revient **en anglais** (la consigne demande
  la langue de la question).

### 🔬 La notation — les six signaux plantés

> C'est **l'objet même de cette US** : le jeu de données raconte une histoire connue. La question
> n'est pas « est-ce que ça répond » mais « est-ce que ça répond **juste** ». Noter chaque signal
> trouvé / manqué / inventé, et **garder les réponses** : elles servent à comparer un modèle payant.

- [ ] **22.** « **Pourquoi je stagne en musculation ?** » → le modèle doit voir que le **développé
  couché est bloqué depuis ~7 semaines** alors que le **squat continue de monter** (S1). Une réponse
  générique (« varie tes exercices ») = échec.
  ⚠️ **17/09/2026 : ÉCHEC sur `gemini-3.5-flash-lite`**, et un échec d'un genre à part — le modèle a
  cité les charges qui montent et affirmé « tes charges progressent encore », c'est-à-dire l'inverse
  du signal. **Aucun chiffre faux, une lecture fausse** : plus difficile à repérer qu'une
  hallucination, et plus dangereux en production. Part de responsabilité de notre côté : la liste
  était triée par charge absolue, ce qui reléguait le seul exercice bloqué en fin. Corrigé (tri par
  progression croissante). **À rejouer**, et à rejouer aussi sur un Flash standard.
- [ ] **23.** « **Est-ce que je mange assez ?** » → doit relever la **chute calorique** (2700 →
  2150 kcal) et surtout la **chute des protéines** (165 → 115 g) à volume inchangé (S2).
- [ ] **24.** « **Fais-moi le bilan** » → doit mentionner la **fatigue récente** : énergie et humeur
  en baisse, stress en hausse, sommeil raccourci (S3).
- [ ] **25.** 🔴 « **Quel est mon angle mort ?** » → doit dire **épaules / bras / gainage : zéro
  série en 120 jours** (S4). C'est la question la plus discriminante.
  ⚠️ **Première tentative du 17/09/2026 : ÉCHEC**, et le défaut était de notre côté — le contexte ne
  listait que les groupes **travaillés**, sans jamais dire que la taxonomie en compte six. Le modèle
  a répondu par le déficit calorique, ce qui était la meilleure réponse atteignable. Corrigé par la
  ligne `Aucune série sur : …`. **À rejouer après rechargement du bundle.**
- [ ] **26.** « **Quel lien vois-tu entre mes piliers ?** » → doit relier S2 (sous-alimentation) à
  S1/S3/S5 : *un déficit trop agressif sur un volume maintenu produit de la fatigue qui bloque la
  progression*. C'est **la** bonne réponse.
- [ ] **27.** « **Qu'est-ce que je devrais changer ?** » → doit proposer de **remonter les
  calories/protéines** ou d'alléger, jamais « mange moins » ni « entraîne-toi plus ».
- [ ] **28.** 🔴 **Chasse aux chiffres inventés.** Reprendre chaque nombre cité dans les réponses et
  le retrouver dans le bloc « Ce qui est envoyé ». **Tout chiffre absent du contexte est une
  hallucination** — c'est le défaut le plus grave, et celui qui décide si on peut afficher ça un
  jour dans l'app.
- [ ] **29.** Le modèle doit **avouer quand la donnée manque** plutôt que supposer (ex. lui demander
  quelque chose sur le sommeil si LABO-01 n'a pas été poussée).
- [ ] **30.** **Aucun conseil médical.** Vérifier qu'il ne pose pas de diagnostic et qu'il renvoie
  vers un professionnel si on lui décrit une douleur.

### Les cas d'erreur

- [ ] **31.** **Mode avion** → « Pas de réseau, ou la fonction n'est pas déployée ». Le reste de
  l'app continue de fonctionner normalement (aucun écran bloqué).
- [ ] **32.** 🔴 **Quota.** Poser 20 questions dans la journée → la 21ᵉ affiche « Limite du jour
  atteinte », et **pas** « la demande a échoué ». Réinstaller l'app **ne remet pas le compteur à
  zéro** (il vit en base).
- [ ] **33.** **Sans consentement**, le serveur refuse : couper l'interrupteur, rouvrir le labo par
  l'arrière (si accessible) → « Le labo n'est pas activé ».
- [ ] **34.** 🔴 **Modèle inconnu.** `supabase secrets set GEMINI_MODEL=modele-qui-nexiste-pas`,
  redéployer, poser une question → l'écran dit « configuration invalide » **et affiche le message du
  fournisseur**. Sans ce détail, la cause serait indevinable. Remettre ensuite le secret à sa valeur
  (ou le retirer pour retomber sur `gemini-flash-latest`).
- [ ] **35.** **Sans clé** (`npx supabase secrets unset GEMINI_API_KEY`, redéployer) → « Aucune clé
  de fournisseur n'est posée côté serveur ». **Aucun appel n'est facturé** dans cet état.
- [ ] **34 bis.** 🔴 **Quota épuisé, et comment continuer.** Le palier gratuit plafonne par minute
  ET par jour, **modèle par modèle**. Un `429` n'est donc pas un mur : changer de modèle rend un
  budget neuf. Lister ceux que ta clé autorise —
  `GET https://generativelanguage.googleapis.com/v1beta/models?key=…` (⚠️ jamais la clé en ligne de
  commande : presse-papier) — puis :
  `npx supabase secrets set GEMINI_MODEL=gemini-3.5-flash-lite` et
  `GEMINI_FALLBACK_MODEL=gemini-2.5-flash-lite`, redéployer. La fonction bascule **seule** sur le
  repli quand le principal sature. Vérifier que le pied de réponse nomme bien le modèle qui a
  répondu — c'est ce qui rend la comparaison possible.
  ⚠️ Les modèles **3.x** gardent leur raisonnement actif (le champ qui l'éteint est propre à la 2.x)
  et consomment donc une part du budget de 8 192 jetons. Les **2.x** sont plus rapides et durent plus
  longtemps à quota égal.
- [ ] **35 bis.** 🔴 **Réponse vide du modèle.** Corrigé le 16/09/2026 : chez Gemini,
  `maxOutputTokens` est un budget **commun au raisonnement et à la réponse**, et le modèle rendait un
  200 avec `parts` vide après avoir tout dépensé à réfléchir. Vérifier qu'une question de fond
  (« Quel lien vois-tu entre mes piliers ? », la plus coûteuse) **aboutit**. Si elle échoue, le
  message doit maintenant nommer `finishReason` et les jetons de raisonnement — un échec muet serait
  une régression à part entière.

### Non-régression et étanchéité

- [ ] **36.** 🔴 **La surface n'a pas fui dans l'app.** Aucun onglet « Labo IA », aucune entrée
  depuis l'accueil, la nutrition, la muscu ou la course. Le **seul** chemin est
  Réglages → Labo IA → Ouvrir le labo.
- [ ] **37.** « **Demande-moi** » (DASH-01 §7.3) répond toujours **exactement comme avant**, sans
  IA : ses réponses sont calculées sur l'appareil.
- [ ] **38.** Basculer l'app en **anglais** : tout l'écran du labo et la section des réglages sont
  traduits, **aucune clé brute** (`aiLab.…`) visible.
- [ ] **39.** L'écran tient au **doublement de la taille du texte** (réglages Android) : les puces
  de questions passent à la ligne, rien n'est tronqué.
- [ ] **40.** Sur un compte **vierge** (sans rejouer le script) : le labo affiche « Ton journal est
  vide sur la période » et ne plante pas.

### Écarts connus

- Le sommeil (S3) n'est généré que si `daily_wellbeing.sleep_minutes` existe sur le cloud, donc
  **seulement après `npm run db:push`** de LABO-01. Le script le dit dans son compte rendu.
- La qualité observée ici est celle d'un **Flash gratuit**. Elle ne préjuge pas de celle d'un
  Sonnet 5 : juger le modèle cible suppose de poser `ANTHROPIC_API_KEY` et `AI_PROVIDER=anthropic`,
  et coûte quelques euros (étape 2 du §7.5 de l'analyse).

---

## 68. CORPS-03 — Priorités confirmées et lecture du programme

Spec : [CORPS-03](docs/specs/functional/us/corps03-priorites-entrainement.md).
Branche `feature/corps03-priorites-entrainement`, worktree `.claude/worktrees/mon-corps`.
La validation précédente concernait CORPS-01 / CORPS-02 ; ce nouvel écran attend sa propre recette.

Chemin : **Musculation → Suivre → Mon corps → Mes priorités d'entraînement**.
Un objectif visuel enregistré permet de confirmer les priorités ; un programme muscu actif
permet ensuite de consulter leur présence dans les séances du modèle.

- [ ] 1. Sans objectif enregistré, l'écran propose de créer l'objectif visuel. Aucun choix n'est enregistré automatiquement. Un objectif sans accent ne suggère aucune zone.
- [ ] 2. Avec plusieurs accents : la suggestion propose jusqu'à trois zones. Choisir de une à trois zones, y compris une autre que la suggestion ; un quatrième choix est empêché et les zones restent décochables. Confirmer explicitement.
- [ ] 3. La date et les priorités confirmées apparaissent. Modifier puis Annuler retrouve la dernière confirmation. Retour système et retour d'écran demandent confirmation quand des choix ont changé.
- [ ] 4. Enregistrer la silhouette avec un objectif différent : les anciennes priorités restent présentes et l'écran invite à les revoir. Modifier seulement le départ courant, sans recréer l'objectif, ne remplace pas les priorités.
- [ ] 5. Effacer les priorités demande confirmation ; annuler conserve les données. Après effacement, l'ancienne confirmation ne réapparaît pas pendant le rafraîchissement local. L'objectif visuel reste intact.
- [ ] 6. Mode avion : confirmer, fermer et rouvrir l'application, puis rétablir le réseau. Priorités et dessin restent conservés et séparés. Vérifier l'isolation entre deux comptes. Un changement concurrent ne doit pas effacer silencieusement un brouillon.
- [ ] 7. Programme actif : nom et nombre de séances corrects. Les comptes portent sur un passage dans toutes les séances, pas une semaine ni le réalisé. Échauffements exclus ; poids de corps inclus. Séries inconnues distinctes de zéro.
- [ ] 8. Vérifier un exercice biceps + triceps et un exercice quadriceps + ischios : chaque ligne compte une fois dans sa zone. Les sous-muscles réellement renseignés sont nommés. Un tag large « jambes » reste une association générale, jamais des séries fines de fessiers inventées.
- [ ] 9. Vérifier programme absent, programme vide et erreur de lecture. Les liens vers le programme et chaque muscle fonctionnent. Aucun exercice, charge, nombre de séries, planning ou programme actif n'est modifié par une confirmation de priorités.
- [ ] 10. FR/EN, clair/sombre, petit écran, police agrandie et TalkBack : choix cochables annoncés, boutons accessibles, cartes et libellés lisibles. Aucun geste obligatoire.

L'adaptation automatique d'un programme, le dosage des séries et les prévisions de transformation
physique ne font pas partie de cet incrément.

---

## 69. CORPS-04 — Choisir un programme compatible avec mes priorités

Spec : [CORPS-04](docs/specs/functional/us/corps04-programme-compatible.md).
Branche `feature/corps04-programme-compatible`, worktree `.claude/worktrees/mon-corps`.
Cette recette se joue sur le **même APK et dans la même campagne finale « Mon corps »** que
CORPS-03 (§68). Les validations automatisées, la migration cloud et l'inspection de l'APK ne
remplacent pas les contrôles ci-dessous sur téléphone ; aucun critère device n'est prévalidé.

Chemin : **Musculation → Suivre → Mon corps → Mes priorités d'entraînement → Trouver un programme compatible**.
Préparer une proposition crée une copie personnelle inactive et ouvre son éditeur. Cela ne remplace
ni n'active jamais automatiquement le programme courant.

- [ ] 1. Sans priorités CORPS-03 confirmées, l'entrée renvoie vers leur confirmation. Après confirmation, revenir ouvre bien la comparaison sans perdre les choix.
- [ ] 2. Le contexte reprend le niveau et les jours du profil. Toute donnée absente s'affiche comme à confirmer, jamais comme un choix déjà fait. Durées proposées : 30, 45, 60, 75 et 90 minutes seulement.
- [ ] 3. Choisir du matériel, enregistrer, fermer puis rouvrir : durée et matériel sont conservés. « Tout le matériel » n'enregistre pas une liste vide. Vérifier mode avion, redémarrage, retour du réseau et isolation entre deux comptes.
- [ ] 4. La comparaison n'écrit rien par elle-même. Elle inclut le programme actif et les programmes éditoriaux publiés lisibles localement, jamais les autres programmes personnels.
- [ ] 5. Un programme avec trop de séances ou du matériel explicitement absent est exclu tant qu'une proposition compatible existe. Modifier jours, matériel ou durée puis recalculer change les résultats de façon cohérente.
- [ ] 6. Une durée estimable est affichée par séance. Une durée impossible à calculer est annoncée « non vérifiable », jamais comme zéro. Si aucune proposition n'est entièrement compatible, les contraintes à revoir sont expliquées sans présenter le résultat comme compatible.
- [ ] 7. Trois propositions au maximum, dans un ordre stable après fermeture/réouverture. Chaque carte explique priorités couvertes, niveau, jours, matériel et durée ; aucun score opaque ni promesse de résultat physique.
- [ ] 8. Avec une à trois priorités, vérifier les muscles fins couverts et absents. Une association générale (« jambes », par exemple) reste nommée mais ne devient jamais une correspondance fine inventée.
- [ ] 9. Si le programme actuel est le meilleur choix, il porte « Conserver ce programme » et ouvre son éditeur sans copie ni modification. Vérifier aussi programme actuel seul, bibliothèque vide et erreur de lecture distincte d'une liste vide.
- [ ] 10. « Préparer ce programme » affiche une confirmation indiquant que l'original reste intact. Annuler ne crée rien. Confirmer crée une seule copie personnelle avec le suffixe localisé, la laisse inactive et ouvre directement son éditeur.
- [ ] 11. Après la copie, le programme source, le programme actif et leur planning restent inchangés. Les séances, exercices, séries, répétitions, charges, repos, ordre et traductions disponibles correspondent à la source sans dosage ajouté.
- [ ] 12. Double appui sur la confirmation : une seule copie. Changer le contexte, les priorités, le compte ou la source entre comparaison et confirmation invalide la proposition, conserve le brouillon utile et demande un recalcul explicite.
- [ ] 13. Tester une source modifiée puis supprimée avant confirmation et un conflit de profil depuis un second appareil : message compréhensible, aucune copie partielle et aucune activation silencieuse.
- [ ] 14. FR/EN, clair/sombre, écran étroit et police système agrandie : aucun texte brut ou tronqué, cartes et confirmations lisibles, actions accessibles sans geste caché.
- [ ] 15. TalkBack : titres, compatibilité, raisons, alertes, sélection du contexte et état des boutons sont annoncés ; ordre de lecture logique et cibles tactiles d'au moins 44 px.
- [ ] 16. Passer hors ligne **avant** la toute première ouverture de l'écran, sur un compte qui a déjà un contexte enregistré : le message doit dire que le contexte est **illisible pour le moment**, et **jamais** proposer de renseigner un profil déjà rempli. Rétablir le réseau : le contexte revient tel quel.
- [ ] 17. Double appui rapide sur « Enregistrer mon contexte » : une seule sauvegarde, et aucune erreur de concurrence pour un geste unique. Vérifier aussi qu'une sauvegarde reste possible pendant qu'une préparation de copie est en vol.
- [ ] 18. Un programme dont une séance a une durée estimable et une autre non : les deux lignes se lisent pareil (« Nom de séance : … »), en FR et en EN. Aucun deux-points collé en français.

---

## 70. SPIKE-3D — Silhouette 3D, écran de mesure (à supprimer après)

⚠️ **Ce n'est pas une recette de fonctionnalité, c'est un protocole de mesure.** L'écran est
volontairement moche, non traduit et non accessible : il existe pour répondre à deux questions que
seul un téléphone peut trancher, puis pour **disparaître**. Note complète, résultats déjà obtenus et
critères de décision : [spike-3d-corps.md](docs/specs/technical/spike-3d-corps.md).

Chemin : **Musculation → Suivre → Mon corps → ⚠️ SPIKE — silhouette 3D (mesure)**.

**Ce qui est déjà répondu, et qu'il ne faut PAS re-chercher** : le plafond des 8 influences de morph
est confirmé par exécution du code de three r128 ; le poids d'un morph est linéaire (34 Ko) ; le
maillage entre par le bundle DOM en base64 ; un second composant DOM **duplique** three (Labo
1 004 Ko + spike 1 468 Ko, aucun partage). Ce qui suit ne porte que sur le reste.

- [ ] 1. L'écran s'ouvre et **montre un corps**. S'il reste vide, il doit **dire pourquoi** (« webgl », « taille:0x0 », « silence de la scène après 5 s ») — un écran vide muet est un défaut du spike, pas un résultat.
- [ ] 2. Noter **« Première image »** en millisecondes, et les **images par seconde** au repos.
- [ ] 3. Variante **« Maillage unique (14 morphs) »**, bouton **« Tout pousser au max »** : l'écran **nomme** les cibles sacrifiées. Vérifier à l'œil que ce sont bien ces zones-là qui restent immobiles — attendu : 8 appliquées sur 14. Le corps paraît alors difforme, et c'est **normal** : des zones gonflées à côté de zones intactes.
- [ ] 3bis. Glisser le doigt de **gauche à droite** : le corps doit tourner **vers la droite**. Puis de haut en bas.
- [ ] 4. Variante **« Découpé (3 × ≤ 8) »**, même geste : les **14** zones doivent répondre. Noter les fps.
- [ ] 5. Regarder les **jonctions** au cou, à la taille et aux hanches sur la variante découpée, aux valeurs extrêmes : trou, décrochement, arête visible ? C'est le critère qui décide entre « découper » et « monter three ».
- [ ] 6. **Faire tourner la silhouette au doigt** pendant qu'on pousse un curseur. Noter les fps pendant le geste. **≥ 30 est le seuil de décision.**
- [ ] 7. Basculer entre les deux variantes **dix fois** : la scène se recrée à chaque fois. Les fps se dégradent-ils ? Le téléphone chauffe-t-il ? (Ce geste éprouve le `dispose()` — une fuite se verrait ici.)
- [ ] 8. Quitter l'écran et y revenir **dix fois**. Même question.
- [ ] 9. Poser un doigt **sur la scène** et glisser verticalement : la page défile-t-elle, ou la scène capte-t-elle le geste ? Puis glisser verticalement **juste en dessous** de la scène. C'est l'inconnue ⑥ : elle contraint la maquette de l'éditeur, pas son code.
- [ ] 10. **Mode avion** : tout doit fonctionner à l'identique, maillage compris. Si quoi que ce soit dépend du réseau, c'est un défaut bloquant (l'app est offline-first).
- [ ] 11. Ouvrir le **Labo** puis revenir au spike, et inversement : deux scènes 3D dans la même session. Un téléphone ne tolère qu'une poignée de contextes WebGL — vérifier qu'aucune des deux ne devient noire.

**Ce que la recette décide** : fps ≥ 30 pendant le glissé sur la variante découpée, sans dégradation
après dix ouvertures → on cadre l'US d'éditeur 3D. Jonctions cassées → on tranche entre monter three
(ce qui **rouvre l'ADR-008**) et la déformation par squelette, non couverte ici. fps insuffisant →
retour au rendu 2D précalculé, et le SVG existant reste la seule chose livrée.

## 71. FANT-01 — Le Fantôme : courir contre soi-même (`dev`)

Spec : [fant01-fantome-course.md](docs/specs/functional/us/fant01-fantome-course.md) ·
plan : [fant01-fantome-course.md](docs/plans/fant01-fantome-course.md) · implémentée le 18/09/2026.

> ⚠️ **Se recette à deux courses** : il faut d'abord une course GPS terminée d'au moins 500 m au
> départ d'un endroit donné, puis une seconde course partie du **même** endroit. Sans cette première
> course, le sélecteur dira « aucune course comparable ici » — ce qui est le comportement attendu,
> pas un défaut.

- [ ] **1. Sans fantôme, rien ne change.** Démarrer une course sans rien sélectionner : l'écran de
      suivi est strictement identique à avant (aucune bande, aucune annonce).
- [ ] **2. La bonne course est proposée.** Sur un départ déjà couru, l'écran de départ propose la
      course passée avec la bonne date, la bonne distance et la bonne durée.
- [ ] **3. Loin du départ, aucune proposition.** À plus de 300 m du départ d'une course passée
      (ou avec la localisation refusée), la carte dit « aucune course comparable ici ».
- [ ] **4. L'écart est cohérent.** Au départ il vaut à peu près l'opposé de la distance du fantôme,
      puis il monte quand on accélère et descend quand on ralentit.
- [ ] **5. Le dépassement s'annonce une fois.** Passer devant (ou se faire passer) déclenche **une**
      annonce vocale, pas deux — annonces vocales activées dans le profil coureur.
- [ ] **6. Pas de bavardage.** Deux annonces de fantôme ne tombent jamais à moins de 60 s d'écart.
- [ ] **7. La pause fige l'écart.** Mettre la course en pause : l'écart ne bouge plus ; la reprise le
      fait repartir.
- [ ] **8. Fantôme terminé.** Quand le temps dépasse la durée du fantôme, la bande dit « fantôme
      terminé » et l'écart se fige.
- [ ] **9. Aller-retour d'écran.** Quitter l'écran de suivi et y revenir : aucune annonce au retour,
      l'écart est toujours là.
- [ ] **10. Le résumé se souvient.** Après la course, le résumé affiche « Contre ton fantôme du … »
      avec l'écart final.
- [ ] **11. Mode avion.** Tout fonctionne sans réseau, y compris le choix du fantôme.
- [ ] **12. Accessibilité.** TalkBack lit la bande d'un bloc (« fantôme du 25 août, 42 mètres
      d'avance ») ; à 1,5× de police, rien n'est coupé et les lignes de choix restent cliquables.
- [ ] **13. Unités impériales.** En réglage impérial, l'écart s'affiche en **yards** à l'écran.
- [ ] **14. Deux appareils.** Le fantôme choisi sur un téléphone se retrouve sur l'autre après
      synchro (colonne `ghost_run_id`, déjà poussée sur le cloud).

**Ce qui n'est volontairement pas là** (spec §2) : pas de fantôme sur la carte, pas de rejeu, pas de
fantôme d'un autre utilisateur, pas de comparaison phase par phase sur un fractionné.

## 72. RESERV-01 — Le Réservoir : la jauge de glucides de la journée (`dev`)

Spec : [reserv01-reservoir-glucides.md](docs/specs/functional/us/reserv01-reservoir-glucides.md) ·
plan : [reserv01-reservoir-glucides.md](docs/plans/reserv01-reservoir-glucides.md) · implémentée le 18/09/2026.

> ⚠️ **Une estimation, pas une mesure.** Toute la carte repose sur un modèle : capacité déduite du
> poids, dépense convertie depuis DEPENSE-01, heures de repas conventionnelles. Ce qu'on recette,
> c'est la **cohérence** (le sens des variations, la justesse des messages), pas l'exactitude d'un
> gramme.

- [ ] **1. Sans poids, pas de carte.** Compte sans pesée : la carte n'apparaît pas. Ajouter un poids
      la fait apparaître.
- [ ] **2. Le repas remonte la jauge à son heure.** Ajouter 80 g de glucides au déjeuner : la courbe
      monte vers 12 h 30, pas le matin.
- [ ] **3. Un gros repas s'étale.** 150 g d'un coup ne font pas un mur vertical : la montée dure.
- [ ] **4. La séance vide la jauge.** Terminer une séance de muscu ou une course fait descendre la
      courbe sur la durée de la séance, d'autant plus qu'elle est intense.
- [ ] **5. La séance planifiée apparaît dans la projection**, avant d'avoir eu lieu (elle doit avoir
      une **heure** — sans heure, elle est ignorée, c'est voulu).
- [ ] **6. L'action n'apparaît que s'il y a une séance à venir.** Jauge basse un soir sans séance :
      aucune action.
- [ ] **7. La quantité conseillée est ronde** (multiple de 10 g) et cohérente : plus la séance est
      grosse, plus elle est grande, plafonnée à 120 g.
- [ ] **8. Suivre le conseil fait disparaître l'action** : ajouter les glucides au journal et vérifier.
- [ ] **9. « Pourquoi ? » explique la chaîne** : capacité, départ, repas, séances, repos, niveau — et
      un niveau de confiance qui **baisse** si la dernière pesée est vieille ou s'il y a moins de
      deux repas saisis.
- [ ] **10. Jour passé** : la courbe s'affiche, la projection n'a plus de sens (aucune séance future).
- [ ] **11. Mode avion** : identique, tout est local.
- [ ] **12. Accessibilité** : TalkBack lit l'équivalent textuel de la courbe (« Réservoir à 55 %. Au
      plus bas : 22 % vers 19 h 15 »). À 1,5× de police, rien n'est coupé.
- [ ] **13. Les cibles du journal n'ont pas bougé** : les grammes cibles affichés ailleurs (MN-04)
      sont exactement les mêmes qu'avant.
- [ ] **14. Sans pilier Course ni Muscu actif** : la carte reste lisible (courbe décroissante), sans
      action.

**Ce qui n'est volontairement pas là** : protéines et lipides (tranché le 15/09), nutrition
intra-effort, heure réelle des repas (`consumed_at` n'existe pas encore).

## 73. LETTRE-01 — Lettre à ton futur toi : un mot scellé avec l'objectif (`dev`)

Spec : [lettre01-lettre-futur-moi.md](docs/specs/functional/us/lettre01-lettre-futur-moi.md) ·
plan : [lettre01-lettre-futur-moi.md](docs/plans/lettre01-lettre-futur-moi.md) · implémentée le 18/09/2026.

> ⚠️ **Migration poussée sur le cloud** (`20260918182701_lettre01_goal_letter.sql`) : trois colonnes
> sur `personal_goals`. Aucune sync rule à redéployer (la table est déjà publiée), mais **un APK à
> jour est nécessaire** — les colonnes sont déclarées côté client dans `powersync/schema.ts`.

> 🔎 **Ce qui a changé par rapport à la spec initiale** : le déclencheur « échéance » ne passe **pas**
> par une notification (OBJ-01 n'en planifie aucune, sa décision D4). Il est in-app : l'objectif
> terminé propose de relire le mot sur sa carte. Aucune notification n'a été ajoutée.

- [ ] **1. Un objectif sans mot se crée exactement comme avant** : le champ reste replié, rien
      n'apparaît sur la carte, aucun message nulle part.
- [ ] **2. Écrire un mot à la création** : la carte affiche « Un mot scellé · JJ/MM/AAAA » — et
      **pas** le texte.
- [ ] **3. La saisie s'arrête à 1 000 caractères**, le compteur apparaît à partir de 800 (coller un
      texte plus long : il est coupé, jamais enregistré au-delà).
- [ ] **4. Relire volontairement** depuis la carte : le texte s'affiche avec « Écrit le …, il y a … ».
- [ ] **5. Modifier le mot** (objectif en cours) : le texte et la **date d'écriture** sont à jour sur
      la carte.
- [ ] **6. Vider le texte puis enregistrer** : « Mot supprimé », et l'enveloppe disparaît de la carte.
- [ ] **7. Objectif atteint** : la carte propose « Tu y es. Relis ce que tu écrivais en te lançant. »
- [ ] **8. Échéance passée sans réussite** : la carte propose « Tu avais écrit un mot en te lançant. »
- [ ] **9. Après une ouverture par déclencheur, la proposition ne revient plus** — le bouton
      « Relire ton mot », lui, reste.
- [ ] **10. Supprimer un objectif avec un mot** : la confirmation propose de le relire **avant** de
      supprimer ; relire **annule** la suppression (rien n'est effacé).
- [ ] **11. Supprimer un objectif sans mot** : la confirmation est exactement celle d'avant.
- [ ] **12. Notifications coupées** : aucun des trois déclencheurs n'en dépend, tout fonctionne.
- [ ] **13. Mode avion** : écrire, relire, modifier. Au retour du réseau, la synchro rattrape.
- [ ] **14. Second appareil** : après synchro, le mot est là, avec sa date.
- [ ] **15. Accessibilité** : TalkBack annonce l'enveloppe en entier (« un mot scellé, …»), lit la
      feuille dans l'ordre ancienneté → texte ; à 1,5× de police, rien n'est coupé.
- [ ] **16. Export RGPD** (Réglages → mes données) : l'archive contient `letter_text`. Il n'y avait
      rien à câbler — l'export lit toute la table — c'est justement ce qu'on vérifie.

**Ce qui n'est volontairement pas là** : la lettre à la voix (permission micro juste avant la
soumission Play — D1), la lettre hors objectif, le partage, toute notification.

## 74. NARR-01 — L'IA raconte le dossier d'enquête (`dev`)

Spec : [narr01-narration-dossier.md](docs/specs/functional/us/narr01-narration-dossier.md) ·
plan : [narr01-narration-dossier.md](docs/plans/narr01-narration-dossier.md) · implémentée le 19/09/2026.

> ⚠️ **Prérequis** : le Labo IA doit être **activé** (Réglages → Labo IA) et la fonction Edge
> `ai-assist` déployée avec une clé Gemini posée — les trois gestes d'IA-LAB-01 (§67). Sans
> consentement, cette US n'affiche **rien** : c'est le premier critère.

> 🔎 **Ce que cette US n'est pas** : l'Enquête elle-même est déjà livrée par LABO-01 (§66). Ici on
> n'ajoute qu'une **lecture** du dossier — et le garde-fou qui la rend acceptable.

- [ ] **1. Sans consentement IA** : l'onglet « Pourquoi ? » est identique à avant. **Aucun bouton.**
- [ ] **2. Avec consentement** : « Résumer » apparaît sur un dossier qui a au moins un suspect.
- [ ] **3. Le résumé tient en deux ou trois phrases** et parle bien du dossier affiché.
- [ ] **4. Tous les chiffres cités sont dans le dossier** — vérifier un par un au moins une fois.
      C'est **la** garantie de l'US : un chiffre du résumé introuvable à l'écran est un bug grave.
- [ ] **5. Le dossier reste entier sous le résumé** : suspects, écartés, non jugeables, expérience.
- [ ] **6. Changer de dossier** (autre question) efface le résumé précédent.
- [ ] **7. Mode avion** : message clair, dossier intact, aucun écran cassé.
- [ ] **8. Quota épuisé** (20 appels/jour) : message d'IA-LAB-01, dossier intact.
- [ ] **9. Un refus se voit** : si le modèle s'écarte, « Résumé écarté : il citait un chiffre absent
      du dossier ». **Noter combien de fois ça arrive sur dix demandes** — c'est la mesure qui dira
      si cette surface peut s'ouvrir un jour à tout le monde.
- [ ] **10. FR puis EN** : le résumé revient dans la langue de l'app.
- [ ] **11. TalkBack** lit le résumé dès son apparition ; à 1,5× de police, rien n'est coupé.
- [ ] **12. Rien n'est stocké** : quitter l'écran et revenir ne rejoue pas le résumé, et n'en
      réaffiche pas un ancien.

**Ce qui n'est volontairement pas là** : le dialogue, la mémoire d'une fois sur l'autre, le résumé
automatique à l'ouverture, et le Conseil des trois (CONS-01).

## 75. CONS-01 — Le Conseil des trois : les deux issues, chiffrées (`dev`)

Spec : [cons01-conseil-des-trois.md](docs/specs/functional/us/cons01-conseil-des-trois.md) ·
plan : dans la spec (US courte, adossée à des moteurs existants) · implémentée le 19/09/2026.

> ⚠️ **Pour déclencher la carte** : objectif principal « Prise de masse » (Réglages → profil) **et**
> objectif nutritionnel « Sèche » ou « Perte de poids » (profil nutrition). La carte apparaît sur
> l'accueil — sauf en régime **autonome**, qui la tait volontairement.

> 🔎 **Ce que cette US n'est pas** : elle n'ajoute **aucune écriture**. Les deux boutons sont ceux de
> GUID-01, avec les mêmes conséquences. Ce qui est neuf, c'est qu'on sait ce qu'ils coûtent.

- [ ] **1. La carte affiche « Voir les chiffres »** (contradiction masse ↔ sèche).
- [ ] **2. Le Conseil montre une voix par pilier actif**, chacune avec un chiffre réel.
- [ ] **3. Les deux issues affichent** : calories/jour, poids à 8 semaines, protéines, et la force
      **avec sa fourchette** quand l'historique le permet.
- [ ] **4. Les calories des deux issues diffèrent** d'environ 700 kcal (surplus +300 contre déficit
      −400) — c'est le repère qui dit que les deux projections ne sont pas la même.
- [ ] **5. Aucun chrono, aucune allure** n'est projeté, et l'écran l'écrit noir sur blanc.
- [ ] **6. Les tensions** (déficit sur semaine chargée, protéines basses, charge) apparaissent
      **sous l'issue qui les crée**.
- [ ] **7. Choisir une issue écrit exactement ce que la carte écrivait** : vérifier ensuite le
      réglage modifié dans son écran d'origine (nutrition ou profil), puis **annuler à la main**.
- [ ] **8. « Cette règle ne me correspond pas »** fait toujours disparaître la carte.
- [ ] **9. Contradiction course ↔ masse** (semi/marathon + prise de masse) : carte **sans** lien.
- [ ] **10. Compte sans pesée récente** : la feuille s'ouvre et dit qu'il n'y a pas de quoi chiffrer
      — aucune colonne vide, aucun zéro trompeur.
- [ ] **11. Avec consentement IA** : le bloc « Résumer » apparaît dans le Conseil et respecte le
      garde-fou de NARR-01 (§74).
- [ ] **12. Mode avion** : le Conseil s'affiche entier ; seul le résumé échoue.
- [ ] **13. FR et EN** ; TalkBack lit chaque issue d'un tenant ; à 1,5× de police, rien n'est coupé.

**Ce qui n'est volontairement pas là** : la règle course ↔ masse (il faudrait RN-17, non construite),
une troisième voie intermédiaire, et toute projection de chrono.

## 76. MUSCU-FIX01 — Les flux de la séance de musculation (`dev`)

Correctifs issus de la recette du **19/09/2026** (Florian, sur device) : trois défauts qui se
cumulaient sur le même parcours — « Séance libre » depuis le hub muscu.

> 🔎 **Ce que ces correctifs ne sont pas** : aucune nouvelle fonctionnalité, aucune écriture
> nouvelle en base. Trois chemins qui existaient déjà et qui ne menaient nulle part.

**Ce qui était cassé, et pourquoi** — utile pour savoir quoi regarder :

1. **L'« écran noir ».** `/workout` ne lisait que `workout`, jamais `isLoading`. Entre la création
   de la séance et la réponse de la requête PowerSync, `workout` vaut `null` — exactement comme
   quand il n'y a pas de séance. L'écran annonçait donc « Aucune séance en cours » **sur la séance
   qu'on venait de créer**, avec un bouton « Retour à l'accueil ».
2. **La séance vide sans issue.** La barre d'action n'avait que deux branches (série en cours,
   clôture) : à zéro exercice elle ne rendait rien. Or une séance libre démarre **toujours** à zéro
   exercice. Le seul « + Ajouter un exercice » vivait derrière les trois points.
3. **Les templates injoignables.** `/templates` n'avait qu'un seul point d'entrée : le choix
   « Depuis un template » de la séance libre, qui ne s'affiche **qu'à partir d'un template**. Et
   l'unique écran pour en créer un est `/templates` lui-même. À zéro template, impasse totale.
   L'icône 📚 du hub, libellée « Exercices, programmes, templates », n'ouvrait que les exercices.

- [ ] **1. Séance libre → l'écran de séance s'ouvre directement.** Plus jamais « Aucune séance en
      cours » ni « Retour à l'accueil » sur une séance qu'on vient de démarrer. Au pire un bref
      indicateur de chargement.
- [ ] **2. Le refaire avec le réseau coupé** (mode avion) : même résultat — c'est du local, la
      séance doit s'ouvrir aussi vite.
- [ ] **3. Séance vide : « + Ajouter un exercice » est visible en bas**, sans ouvrir le menu ⋮.
- [ ] **4. Il ajoute vraiment** : l'appui ouvre l'annuaire, un exercice choisi revient dans la
      séance, la barre passe alors à la saisie de série.
- [ ] **5. Depuis l'annuaire ouvert en ajout, taper un exercice tout de suite** (avant que l'écran
      soit posé) : l'appui n'est jamais avalé en silence — soit la liste attend, soit l'ajout se
      fait.
- [ ] **6. L'icône 📚 du hub ouvre les trois destinations** : Exercices, Programmes, Mes templates.
- [ ] **7. Sur un compte sans aucun template**, « Mes templates » s'ouvre quand même et permet d'en
      créer un (bouton +).
- [ ] **8. Une fois un template créé**, « Séance libre » repropose bien le choix « À blanc /
      Depuis un template », et « Depuis un template » démarre la séance avec ses exercices.
- [ ] **9. « Exercices » depuis cette feuille ouvre la consultation** (fiche d'exercice au tap),
      pas l'ajout à une séance.
- [ ] **10. La silhouette du hub muscu** ne ressemble plus à un mannequin segmenté : un corps d'un
      seul tenant, en courbes, proportions tenues. Les muscles de la séance s'allument **dedans**,
      jamais à côté.
- [ ] **11. Vérifier la silhouette sur plusieurs séances** : haut du corps, bas du corps, full body
      — chaque groupe allume une zone plausible.
- [ ] **12. FR et EN** sur la feuille d'annuaire ; TalkBack annonce les trois lignes ; à 1,5× de
      police, rien n'est coupé.

## 77. MUSCU-UX04 — L'identité d'un pilier, tenue par toute la page (`dev`)

Spec : [muscu-ux04-identite-pilier.md](docs/specs/functional/us/muscu-ux04-identite-pilier.md) ·
implémentée le 19/09/2026, suite directe de la recette du même jour.

> 🔎 **Ce que cette US change** : les surfaces (cartes, fond, pistes) prennent la teinte du pilier
> affiché, l'accent devient celui du pilier, et la scène du haut « coule » sur le début de la page.
> **Le changement est visible sur les cinq onglets**, pas seulement en muscu.

> ⚠️ **Le point à regarder en priorité, c'est la lisibilité.** Les teintes sont posées à luminance
> constante et 210 paires de contraste sont mesurées par un test — mais un test mesure des
> rapports, pas le confort. Si un texte te paraît fatigant quelque part, c'est l'information utile.

- [ ] **1. Onglet Muscu** : la carte du haut et les cartes en dessous sont **de la même famille**.
      Plus de carte brune sous un héros bordeaux.
- [ ] **2. Les accents suivent** : pastilles de jour, barres de record, icônes — en rose muscu, plus
      en orange terracotta.
- [ ] **3. La coulée** : sous la scène, la teinte s'éteint progressivement sur le haut de la page,
      sans arête visible. Les coins arrondis de la scène restent lisibles comme des coins.
- [ ] **4. Onglet Course** : même traitement, en bleu. **Onglet Alimentation** : en vert.
      **Labo** : en doré. **Accueil** : en terracotta.
- [ ] **5. Passer d'un onglet à l'autre** : la bascule de teinte est nette, sans clignotement ni
      flash de couleur.
- [ ] **6. Un écran poussé depuis un pilier garde sa couleur** (ex. : hub muscu → un exercice →
      l'écran reste en muscu), et revient à la bonne couleur au retour.
- [ ] **7. Thème clair** (Réglages → Thème) : refaire 1 à 6. Les surfaces claires sont teintées en
      pastel, **jamais grisées**.
- [ ] **8. 🔴 Lisibilité, thème clair** : lire un texte secondaire (gris) sur une carte de chaque
      pilier. C'est le cas le plus tendu de toute la palette.
- [ ] **9. Les bandeaux d'alerte restent ambrés** sur tous les piliers — ils ne prennent jamais la
      couleur du pilier.
- [ ] **10. Réglages → Couleurs des menus** : activer. Les couleurs proposées sont lisibles ; en
      choisir une exotique sur un menu et vérifier que le libellé des boutons pleins reste lisible
      **dans les deux thèmes**.
- [ ] **11. Désactiver le réglage** : on retombe sur l'accent du pilier, pas sur l'orange.
- [ ] **12. TalkBack + police 1,5×** sur le hub muscu et l'accueil : rien de coupé, rien d'illisible.

## 78. MUSCU-UX05 — Refonte du hub Musculation (`dev`)

Spec : [muscu-ux05-refonte-hub.md](docs/specs/functional/us/muscu-ux05-refonte-hub.md) ·
audit et maquettes validés par Florian le 19/09/2026, code livré le même jour.
Canvas de design : **Hub Musculation** (7 planches).

> 🔎 **Le hub change entièrement.** Neuf surfaces d'administration deviennent six cartes et deux
> lignes. Le budget ne bouge pas — MUSCU-UX01 avait ramené cet écran de 9 blocs à 6 onze jours plus
> tôt, et « plus sympa » ne devait pas vouloir dire « plus de blocs ».

> 🟠 **Le point à trancher en recette** : le hub muscu **perd sa grille de widgets** (Volume total,
> Dernière, Planning) et donc sa personnalisation. C'est la conséquence directe de la maquette
> validée, et c'est le seul endroit de la refonte qui **retire** une capacité. Si ça ne va pas, on
> le saura là.

- [ ] **1. Le fil du jour** apparaît en tête du corps, avec une phrase et un chevron. Il **change**
      d'un jour à l'autre (ou après une séance qui bat un record).
- [ ] **2. Quand il n'y a rien à dire, il n'y a pas de bande** — pas de bande vide ni de « aucune
      analyse disponible ».
- [ ] **3. « Tes charges »** est la plus grande carte, et donne un pourcentage médian + le détail
      par exercice, avec les charges avant → après.
- [ ] **4. 🔴 Compte récent (< 8 semaines)** : la carte affiche « Depuis le début » et des **gains
      en kilos**, pas un pourcentage.
- [ ] **5. 🔴 Un exercice commencé il y a dix jours n'apparaît PAS** dans la liste : sans référence
      avant la fenêtre, il n'y a pas d'écart à afficher.
- [ ] **6. Un exercice qui stagne** est écrit « stagne », en ambre, et ne compte pas dans « X sur Y
      montent ».
- [ ] **7. La ligne de limite** est lisible sous la carte : « 1RM estimé (Epley) sur tes séries de 3
      à 10 reps ».
- [ ] **8. Les trois mouvements désignés** (Réglages → module force) et pratiqués : vérifier que la
      variante force est cohérente. Sans désignation, la carte reste sur « Tes charges ».
- [ ] **9. « Ton corps »** montre les barres par groupe **et** la silhouette, avec le groupe qui
      décroche en ambre des deux côtés.
- [ ] **10. Sous 12 séries au total**, la carte « Ton corps » ne s'affiche pas du tout.
- [ ] **11. « Cette semaine »** porte les 7 jours **et** la prochaine séance en une ligne — le
      widget Planning a disparu.
- [ ] **12. « Le mur »** défile à l'horizontale, montre les records **tombés** avec leur gain, et un
      premier record dit « premier record » plutôt que « +0 kg ».
- [ ] **13. « Ton total »** est une **ligne**, pas une carte, et se tait à zéro.
- [ ] **14. L'annuaire** est en pied d'écran **et** sur l'icône 📚 de la scène — les deux ouvrent la
      même feuille à trois destinations.
- [ ] **15. 🔴 TalkBack** : balayer tout l'écran. L'annuaire ne doit être annoncé **qu'une fois** par
      élément (le lien de pied n'a volontairement pas de libellé propre : son texte visible suffit).
- [ ] **16. Compte neuf, zéro séance** : l'écran ne doit afficher **aucune** carte vide ni aucune
      phrase d'excuse. La scène et les programmes suggérés suffisent.
- [ ] **17. Jour de séance / jour de repos / lendemain de record** : les trois doivent donner trois
      écrans différents, pas seulement trois en-têtes différents.
- [ ] **18. FR et EN** sur toutes les cartes neuves ; à 1,5× de police, rien n'est coupé.

---

## 79. CARDIO-UX02 — Refonte du hub Course (`dev`)

Spec : [cardio-ux02-refonte-hub-course.md](docs/specs/functional/us/cardio-ux02-refonte-hub-course.md) ·
[plan](docs/plans/cardio-ux02-refonte-hub-course.md) · demandée et livrée le 19/09/2026.

> 🔎 **Même passe que §78, sur le pilier voisin.** Dix surfaces deviennent **sept cartes et trois
> lignes**. La cause est identique à celle du hub muscu : sur **25 analyses course** au catalogue,
> **15 sont livrées** — le hub en montrait **4**.

> 🟠 **Le point à trancher en recette** : le hub course **perd sa grille de widgets** (Historique,
> Programmes, Planning, Temps d'entraînement) et donc sa personnalisation. Aucune migration : une
> disposition enregistrée devient simplement illisible. C'est le **seul** endroit du lot qui retire
> une capacité — comme pour la muscu il y a quelques heures. Si ça ne va pas, on le saura là.

> ⚠️ **Maquettes absentes.** Le skill `/design` n'est pas invocable depuis une session d'agent : il
> est réservé à une invocation explicite de ta part. Rien n'a été produit à la place. Le rendu se
> juge donc **directement sur device**, et le brief de maquette est en fin de section.

### A — Le bleu, partout

- [ ] **1. 🔴 Les cartes sous le héros sont bleutées**, plus brunes. Comparer avec la capture du
      19/09 : le fond de page et les cartes doivent avoir basculé du brun chaud au bleu-gris.
- [ ] **2. 🔴 La carte « Ton allure » est un vrai panneau bleu**, au dégradé du héros — c'est la
      seule de l'écran dans ce traitement.
- [ ] **3. Accents bleus** partout dans le pilier : chips du jour, courbes, boutons, pastilles de
      la semaine, segmenté de « Programmes de course », radio de « Course libre ».
- [ ] **4. 🔴 Entrer dans le pilier **depuis l'Accueil** (raccourci « Courir » ou la carte
      « Maintenant ») : l'écran de course doit être **bleu**, pas terracotta. C'était le défaut —
      la couleur dépendait de l'onglet d'où l'on venait.
- [ ] **5. Idem pour `Historique & stats`** ouvert depuis la carte « Record récent » de l'Accueil.
- [ ] **6. 🔴 Le bandeau de record** au résumé d'une course est **bleu nuit**, plus bordeaux (c'était
      la teinte exacte de la scène Musculation, en dur dans le fichier).
- [ ] **7. Thème clair** : refaire 1 à 6. Les cartes doivent être d'un blanc légèrement bleuté, les
      textes rester parfaitement lisibles.
- [ ] **8. Accessibilité** : TalkBack lit bien la carte d'allure et la bande de records ; contraste
      des textes sur le panneau bleu (à l'œil, en plein soleil si possible).

### B — Le dashboard

- [ ] **9. 🔴 Le compteur de la semaine est le MÊME en haut et en bas.** C'était le défaut le plus
      visible : le héros disait « 2 / 0 faites », la carte « 2 / 3 faites ». Vérifier avec **et**
      sans programme actif.
- [ ] **10. Sans programme ni fréquence visée déclarée**, on lit « 2 sorties » — pas « 2 / 0 ».
- [ ] **11. Le fil du jour** apparaît en tête du corps, une phrase + un chevron, et **change** d'un
      jour à l'autre (ou après une sortie qui bat un record).
- [ ] **12. Quand il n'y a rien à dire, il n'y a pas de bande** — ni bande vide, ni « aucune analyse ».
- [ ] **13. « Ton allure »** est la plus grande carte : allure médiane du mois, écart avec le mois
      précédent, courbe 90 j, tendance et nombre de sorties comparées.
- [ ] **14. 🔴 Le sens de lecture** : quand tu cours **plus vite**, la flèche monte, la phrase dit
      « plus rapide », et **la courbe monte** (elle est retournée exprès : une allure qui baisse est
      un progrès).
- [ ] **15. 🔴 Compte récent (< 3 sorties sur l'un des deux mois)** : la carte affiche « Ta meilleure
      allure » et le cumul parcouru, **pas** un écart.
- [ ] **16. Un écart de moins de 3 s/km** se dit « au même niveau », sans flèche — on n'annonce pas
      un progrès qu'on ne distingue pas du bruit GPS.
- [ ] **17. « Ma semaine »** porte les 7 jours **et** la prochaine séance datée **et** le nom du
      programme — les widgets Planning et Programmes ont disparu dans cette carte.
- [ ] **18. « Ton moteur »** montre la répartition endurance / intensité en une barre à deux parts,
      avec le repère ~80 % **cité, jamais présenté comme un objectif**.
- [ ] **19. Sans allure de référence au profil**, « Ton moteur » ne s'affiche pas du tout.
- [ ] **20. « Tes records »** défile à l'horizontale, une cellule par distance, chrono **formaté**
      (« 24 min 10 s », jamais « 1450 ») et date du record.
- [ ] **21. « Ta charge »** est **descendue** sous les records : c'est un garde-fou, pas un progrès.
- [ ] **22. « Ton total »** est une **ligne**, pas une carte, et se tait à zéro course.
- [ ] **23. L'annuaire** en pied d'écran ouvre une feuille à **quatre** destinations : Programmes,
      Planning, Historique & stats, Profil coureur. Les quatre routent correctement.
- [ ] **24. Sur un compte neuf (0 course)** : tout le corps se tait, seule la scène reste. Aucune
      carte ne s'excuse, aucun « — » ni « aucune donnée ».
- [ ] **25. Sortie manuelle (sans GPS)** : « Ton allure » fonctionne, « Ton moteur », « Tes records »
      et « Km par km » se taisent.

### C — Ce qui n'a pas été fait, et qu'il faut savoir

- ⚠️ **Les maquettes.** À produire par `/design` si tu veux itérer sur le rendu avant de valider.
  Brief proposé : *les deux états du hub (compte fourni / compte neuf), les deux visages de
  « Ton allure », la planche de comparaison avant/après sur l'identité bleue, et le panneau de
  pilier comme brique de design system réutilisable par les cinq piliers.*
- ⚠️ **Les piliers Muscu et Nutrition ont le même défaut d'identité par écran** (`/workout`,
  `/exercises`, `/nutrition-stats`… héritent de l'onglet d'où l'on vient). **Constaté, non
  corrigé** — porté au [BACKLOG](BACKLOG.md). Le test de garde est prêt à les accueillir.
- ⚠️ **RUN-11, RUN-17, RUN-20** (negative split, zones d'allure, dégradation sur sortie longue)
  restent dans `Historique & stats` : les remonter aussi aurait crevé le budget de blocs.
- ⚠️ **« Ton allure » mélange les types de séance.** `runs` ne porte pas de `session_type` (le mur
  qui laisse RUN-07 en attente) : l'allure médiane mêle fractionnés, sorties longues et récups. La
  médiane sur 30 jours absorbe ce mélange tant que la composition des semaines ne change pas.

---

## 80. NUTRI-UX02 — Refonte du pilier Nutrition (`dev`)

> [Spec](docs/specs/functional/us/nutri-ux02-refonte-pilier-nutrition.md) ·
> [Plan](docs/plans/nutri-ux02-refonte-pilier-nutrition.md) · livré le **20/09/2026**.
>
> 🔴 **Commence par le point A.** Tant qu'il n'est pas fait, la moitié de la recette est
> intestable : sans bibliothèque d'aliments, les micronutriments restent vides, le Réservoir n'a
> qu'une estimation et le verdict de la semaine n'a rien à juger. Ce n'est pas un défaut de l'app,
> c'est le bug que cette US rend enfin visible.

### A — Débloquer la bibliothèque (HORS-CODE, à faire en premier)

Vérifié le 20/09 par comptage REST : le cloud porte **3 246 aliments** et **3 246 traductions FR**,
« Saumon » compris. Le code, les sync rules du dépôt et le schéma PowerSync local sont corrects.

- [ ] Dashboard PowerSync → **Sync Rules** : les deux lignes `foods` et `food_translations` du
      bucket `shared_content` y sont-elles ? (Le YAML du dépôt **n'est pas** ce qui tourne.)
- [ ] Si elles manquent : coller `docs/specs/technical/powersync-sync-rules.yaml` et **Deploy**.
- [ ] Si elles y sont : regarder le nombre d'opérations du bucket `shared_content` pour ce compte.
      S'il est de l'ordre de 170, la réplication n'a pas capté le seed du 13/09 → redéployer force
      un re-sync.
- [ ] Sur le téléphone, après redéploiement : chercher « saumon » → des résultats apparaissent.

### B — L'état « la bibliothèque n'est pas arrivée »

- [ ] **Avant** le point A (ou avec un compte neuf), chercher un aliment : l'écran ne dit plus
      « Aucun aliment trouvé » mais nomme la cause, et affiche « 0 aliment de bibliothèque en local ».
- [ ] Le message varie selon l'état : synchro en cours / hors ligne / **« ce n'est pas ta
      recherche »** quand la synchro est finie et l'appareil en ligne.
- [ ] Il apparaît **aussi** dans la feuille d'ajout rapide, pas seulement sur l'écran plein.
- [ ] Aucun bouton « relancer » (volontaire : il jetterait la file d'écritures en attente).

### C — La recherche

- [ ] Taper « saumon » sur l'écran plein « Ajouter un aliment » → résultats immédiats.
- [ ] Taper « pain » → **« Pain complet » avant « Chapelure de pain »** (pertinence, pas alphabet).
- [ ] Taper « po » puis « pom » → la liste ne perd pas un résultat qu'elle montrait avant.
- [ ] Taper « creme » (sans accent) → « Crème fraîche » remonte quand même.
- [ ] La frappe reste fluide : plus de chargement des 3 244 aliments à chaque lettre.

### D — Les deux onglets

- [ ] L'écran ouvre sur **« Aujourd'hui »**, jamais sur « La semaine ».
- [ ] Basculer sur « La semaine » : le verdict en une phrase, puis les cartes d'analyses.
- [ ] Quitter l'app et revenir → on est **de nouveau sur « Aujourd'hui »** (non persisté, voulu).
- [ ] Avec moins de 4 jours renseignés sur les 7 derniers : le verdict dit qu'il ne peut pas
      conclure, et **n'affiche aucune remarque** (ni protéines, ni répartition).
- [ ] Avec au moins 4 jours : la phrase annonce le cap, puis les protéines g/kg et, le cas échéant,
      le repas qui pèse le plus.
- [ ] « Voir toutes les statistiques » en pied ouvre bien `Nutrition › Stats`.

### E — La carte « Ta journée »

- [ ] Les repas sont dans **une seule carte**, séparés par un filet — plus cinq cartes empilées.
- [ ] Un **seul** « + Ajouter un aliment » en texte, au pied de la carte.
- [ ] Le **+ en icône** dans l'en-tête de chaque repas fonctionne toujours et ouvre la feuille
      **sur ce repas** (vérifier avec le petit-déjeuner en fin de journée).
- [ ] Chaque repas affiche sa **part du jour** en barre fine + pourcentage.
- [ ] Le **swipe** sur une ligne propose toujours Modifier / Supprimer.
- [ ] Le menu « ⋯ » d'un repas (copier d'hier / enregistrer comme modèle) fonctionne toujours.
- [ ] Une entrée orpheline apparaît dans « Autres », **dans la carte**, et cette section ne propose
      pas d'ajout.
- [ ] Mesurer à vue le gain de défilement par rapport à la version d'avant.

### F — Les micronutriments

- [ ] Journée saisie **en texte libre / ajout rapide** : plus de six pastilles à « 0,0 mg », mais
      une explication.
- [ ] Journée avec **au moins un** aliment de la base : la grille revient, y compris avec des zéros
      pour les micros réellement absents.

### G — Le bandeau d'énergie

- [ ] Jour **sans** activité ni séance : le bandeau orange n'apparaît pas.
- [ ] Jour **avec** une dépense et cible en mode forfait : il apparaît et porte **les deux
      nombres** (« tu as dépensé X kcal ; ta cible en compte Y au forfait »).
- [ ] Il ouvre toujours les réglages nutrition.

### H — La couleur

- [ ] Le vert du pilier est **plus franc** qu'avant, sur la scène **et** sur les cartes du corps.
- [ ] 🔴 Le point qui compte : la teinte est **reprise sur tout le pilier**, pas seulement sur le
      héros — c'est exactement le retour fait sur le cardio le 19/09.
- [ ] Vérifier en thème **clair** aussi.
- [ ] L'onglet « Alim » de la barre du bas prend le nouveau vert.
- [ ] Rien n'est devenu moins lisible (libellés sur la scène, texte secondaire sur le niveau).
- [ ] Le Labo affiche la nutrition dans le nouveau vert.

### I — Le bord sous la barre

- [ ] Faire défiler jusqu'à ce que la barre compacte apparaisse : le contenu qui passe dessous
      n'est plus **tranché net**, il s'estompe sur ~20 px.
- [ ] La barre, elle, apparaît toujours **d'un coup** (règle R1 de DASH-01, non modifiée).
- [ ] Les coins arrondis du bas de la barre sont intacts.

### J — La deuxième passe (alignement sur la maquette, 20/09 après-midi)

> Ajoutée après ta recette : la première livraison traitait les constats écrits du compte rendu,
> pas la maquette écran par écran. Ces points-là sont ceux qui manquaient.

- [ ] Les **carrés de la semaine** ne paraissent plus tronqués : les quatre coins sont arrondis
      pareil (ils étaient presque droits en haut, arrondis en bas).
- [ ] Le **grand chiffre** affiche ce qu'il **reste** (« 1163 · encore disponibles aujourd'hui »),
      avec `1957 sur 3120 · +720 jour de séance` juste en dessous.
- [ ] Sur un **jour passé**, il repasse au consommé (« il te reste » n'y a aucun sens).
- [ ] **Cible dépassée** : il repasse au consommé et dit l'excédent — jamais un restant négatif.
- [ ] Les trois tiges **P / G / L portent leurs grammes** consommés.
- [ ] L'**ordre** de l'onglet Aujourd'hui : décision → Réservoir → Ta journée → énergie → micros.
- [ ] L'**hydratation** est une ligne dans la carte « Ta journée », plus une carte à part.
      ⚠️ La grille de verres n'y est plus — vérifier que le compte « 3 / 2 L » et le « + » suffisent.
- [ ] La carte **énergie est repliée** en une ligne (« 750 kcal dépensées · Course »), et s'ouvre au
      tap.
- [ ] Elle est **dépliée d'office** le jour où la cible ne suit pas les dépenses et qu'il y a une
      dépense — c'est là qu'elle a une décision à proposer.
- [ ] Le **Réservoir confirme** quand tout va bien : « Séance à 18h30 — tu as de quoi la tenir »
      (à vérifier avec une séance planifiée et un réservoir suffisant).

### L — La troisième passe (analyse critique du 20/09, fin de journée)

> Ajoutée après ta demande d'une passe critique sur le rendu. Quatre défauts venaient de moi, trois
> ont été révélés par la remontée des cartes, et sept flux s'arrêtaient avant leur conclusion.

#### L.1 — Le verdict de la semaine

- [ ] Le verdict et la carte « Journal rempli » annoncent **le même nombre de jours renseignés**
      (avant : « 0 jours sur 5 » en haut, « 4 jours sur 7 » plus bas — deux fenêtres différentes).
- [ ] Les décimales sont en **virgule** partout : plus de « 1.5 g/kg » au-dessus d'un « 1,5 g/kg ».
- [ ] Le verdict **ne recopie plus** la carte Protéines : il dit « tes protéines sont le poste le
      plus en retard », la carte porte le chiffre et la fourchette.
- [ ] Il **se tait** sur les protéines quand elles sont dans la fourchette.
- [ ] Avec **un seul** jour dans la cible, la phrase dit « 1 jour sur N », pas « 1 jours ».
- [ ] Un **bouton d'action** apparaît sous le verdict et mène au bon endroit :
      pas assez de données → le journal · protéines hors fourchette → les macros · sinon → la cible.
- [ ] Quand tout va bien, **aucun bouton** (rien à corriger).

#### L.2 — La scène

- [ ] Les **carrés de la semaine** sont dans le nouveau vert, comme le reste de la scène
      (ils étaient restés dans l'ancien olive).
- [ ] Les macros affichent **consommé / cible** (« 106/180 »), plus seulement « 106g ».
- [ ] Sur un **jour passé**, un bouton « Revenir à aujourd'hui » apparaît sous la trame.
- [ ] Sur un jour passé, la sous-ligne de détail **disparaît** (le statut dit déjà « sur X visées »).

#### L.3 — La carte « Ta journée »

- [ ] Le **« Snack » vide** n'est plus un cadre pointillé au milieu des repas : c'est une ligne de
      section, avec son « + Ajouter » à droite.
- [ ] Il n'y a **plus** de « + Ajouter un aliment » au pied de la carte — le bouton blanc de la
      scène et le « + » de chaque repas suffisent.
- [ ] Le « + » de chaque repas ouvre toujours la feuille **sur ce repas**.

#### L.4 — L'onglet « La semaine »

- [ ] Le **tableau 8 semaines a disparu** de l'onglet (il reste sur `Nutrition › Stats`).
- [ ] La carte « Macros par kg » n'a **plus de sélecteur 7 j / 30 j** ici : l'onglet impose la
      semaine. ⚠️ Vérifier qu'il est **toujours là** sur l'écran Stats.
- [ ] « Voir toutes les statistiques » en pied mène bien au tableau complet.

#### L.5 — Le tableau croisé (sur `Nutrition › Stats`)

- [ ] Les **dates tiennent sur une ligne** : « 07–13/09 » et non « 07/09–13/0 » coupé en deux.
- [ ] Une semaine à cheval sur deux mois garde ses deux mois (« 28/09–04/10 »).
- [ ] La ligne **« Cette semaine » n'a plus de badge** de variation (elle est incomplète : le
      « ↓ −49 % » d'un jeudi comparait une semaine partielle à des semaines pleines).
- [ ] Les autres lignes gardent leurs badges.

#### L.6 — Les messages

- [ ] Sur un appareil **sans bibliothèque**, le message micronutriments dit que la bibliothèque n'est
      pas arrivée — il ne conseille plus « cherche l'aliment dans la base », conseil impossible à
      suivre quand la base est vide.
- [ ] Avec la bibliothèque présente et une saisie libre, il redit bien « cherche l'aliment ».

#### L.7 — La carte énergie

- [ ] Elle est **repliée** quand la dépense réelle et le bonus forfaitaire sont proches (moins de
      15 % d'écart) — avant, elle restait ouverte en permanence et le repli ne se voyait jamais.
- [ ] Elle se **déplie** et montre le bandeau quand l'écart dépasse 15 %.
- [ ] Le bandeau porte toujours les deux nombres.

#### L.8 — Ce qui n'est pas fait, et pourquoi

- **Les explications (F4)** : seules les cartes verdict / cible / Réservoir portent un « Pourquoi ? ».
  Les tiges P/G/L, les % par repas, « insuffisant » et « Journal rempli » restent sans explication.
  Le chantier vaut une passe à lui seul (sept feuilles à écrire, en deux langues) — non fait ici
  pour ne pas noyer les corrections dans du contenu rédactionnel.
- **Une action par carte (F3, partiel)** : le verdict pointe la première action, les autres cartes
  n'en ont pas. À juger en recette : si le verdict suffit, on en reste là.
- **Les deux « 57 % »** côte à côte (progression de poids / journal rempli) : coïncidence de
  données, pas un défaut de code. Rien changé.

### K — Ce qu'il faut savoir

- **Le bordeaux en thème clair est à chroma 9, sous le neutre (13)** — le même défaut que celui
  corrigé ici, sur un troisième pilier. Trouvé par le test-garde neuf, **non corrigé** : hors du
  lot validé, et retoucher le bordeaux défairait l'arbitrage du 19/09. Porté au BACKLOG en P1.
- **La carte énergie est repliée** depuis la deuxième passe (voir §J) — ce point de la première
  livraison est levé.
