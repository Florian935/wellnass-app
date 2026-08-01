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
> Dernière mise à jour : **01/08/2026** — 18 US en attente.

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

## ⛔ Prérequis bloquant — à faire AVANT les recettes device

- [x] **Déployer les sync rules PowerSync** — fait le 29/07/2026 (Damien). Coller
      [powersync-sync-rules.yaml](docs/specs/technical/powersync-sync-rules.yaml) dans le dashboard
      PowerSync → Settings → Sync Rules → **Deploy**.

**Quatre changements partent dans ce même collage** : les tables `body_measurements` (MESUR-01),
`streak_jokers` (STREAK-01), `personal_goals` (OBJ-01) et la **suppression du filtre `deleted_at`**
sur `exercises` / `exercise_translations` (ADMIN-01).

Sans ce déploiement : les mensurations et les jokers **ne se synchronisent jamais** — et sans aucune
erreur visible, ce qui est le piège. Le correctif d'historique d'ADMIN-01 reste inopérant.

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
⚠️ dépend du **déploiement des sync rules**

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
⚠️ dépend du **déploiement des sync rules**

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
⚠️ dépend du **déploiement des sync rules**

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

⛔ **Prérequis bloquant propre à cette US** : contrairement au lot du 29/07/2026, il n'existe
**aucune confirmation** que les sync rules PowerSync couvrant `menstrual_periods` et
`menstrual_daily_logs` (ajoutées le 30/07/2026) ont été **collées et déployées** dans le dashboard
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

## Comment procéder

**Les dix US device se recettent sur le même APK** : BIEN-01, MESUR-01, NUTR-F2, STREAK-01,
UX-LOT-01, OBJ-01, BILAN-01, UX-05, MUSC-F14, **PARTAGE-01**
(+ les 2 critères device d'ADMIN-01 et CONTENU-01). Un seul build suffit — mais **après** le
déploiement des sync rules, sinon MESUR-01, STREAK-01 et OBJ-01 échoueront pour une raison qui n'a
rien à voir avec leur code. **Sync rules déployées le 29/07/2026** (voir le prérequis en tête).

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

**Quand une US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

**Quand un critère échoue** : ne pas cocher, noter le constat sous le critère. Si c'est un défaut
réel, il devient une entrée de [BACKLOG.md](BACKLOG.md) ou un correctif sur la branche de l'US.
