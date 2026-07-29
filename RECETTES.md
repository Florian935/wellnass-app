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
> Dernière mise à jour : **29/07/2026** — 10 US en attente.

---

## ⛔ Prérequis bloquant — à faire AVANT les recettes device

- [ ] **Déployer les sync rules PowerSync.** Coller
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
✅ aucune sync rule · 🔴 **NÉCESSITE UN SECOND BUILD** — voir l'encadré en bas de page.

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

---

## 10. UX-LOT-01 — Lot de finitions

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

## Comment procéder

**Sept US se recettent sur le même APK** : BIEN-01, MESUR-01, NUTR-F2, STREAK-01, UX-LOT-01, OBJ-01, BILAN-01
(+ les 2 critères device d'ADMIN-01 et CONTENU-01). Un seul build suffit — mais **après** le
déploiement des sync rules, sinon MESUR-01, STREAK-01 et OBJ-01 échoueront pour une raison qui n'a
rien à voir avec leur code.

**ADMIN-01 se recette au navigateur**, indépendamment du build.

### 🔴 PARTAGE-01 exige un SECOND build — à savoir avant de planifier

`react-native-view-shot` est une **dépendance native** : le dev client **et** l'APK doivent être
reconstruits pour que la capture d'image existe. **PARTAGE-01 ne peut donc pas être recettée sur
l'APK des autres US.**

Deux façons de s'organiser, au choix :

1. **Recetter les 9 autres d'abord** sur l'APK actuel, puis reconstruire pour PARTAGE-01 seule.
   C'est le plus sûr : tu ne remets pas en jeu ce qui est déjà validé.
2. **Reconstruire tout de suite** et recetter les 10 d'un coup. Un seul build, mais le nouvel APK
   embarque une dépendance native de plus — si quelque chose d'inattendu apparaît, il faudra
   distinguer ce qui vient du code des US de ce qui vient du build.

Je recommande la **1** : on ne mélange pas une validation en cours avec un changement d'infrastructure.

**Quand une US passe** : `etape: close` dans le front-matter de sa spec, roadmap à ✅, et **on
supprime sa section ici**. Passe par [`/commit`](.claude/commands/commit.md), qui fait les trois.

**Quand un critère échoue** : ne pas cocher, noter le constat sous le critère. Si c'est un défaut
réel, il devient une entrée de [BACKLOG.md](BACKLOG.md) ou un correctif sur la branche de l'US.
