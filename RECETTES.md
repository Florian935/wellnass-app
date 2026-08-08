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
> Dernière mise à jour : **07/08/2026** — **50 sections, une par US en recette**. 🔴 **Commence par
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
