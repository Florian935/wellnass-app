# 💡 Idées — boîte de dépôt

Idées brutes captées au fil de l'eau, **sans cadrage**. Le but est de ne rien perdre :
on note vite ici, on trie plus tard.

Ce fichier n'est **pas** le pipeline de travail. Une idée retenue devient une US
(spec → plan → design → validation, voir [CLAUDE.md](CLAUDE.md)) puis rejoint la
[roadmap](docs/roadmap/roadmap.md) et le [TODO.md](TODO.md). Ici, c'est le brouillon d'avant.

- **Format** : une idée = une ligne, préfixée de la date `[JJ/MM/AAAA]` et d'un statut.
- **Statuts** : 🆕 nouvelle · 🔍 à creuser · ✅ promue en US · ❌ écartée
- **Tri** : on relit ensemble régulièrement ; ce qui est promu (✅) ou écarté (❌) descend
  dans « Archives » avec un mot d'explication.

---

## À trier

<!-- Ajoute tes idées ici, la plus récente en haut. Exemple :
- [12/07/2026] 🆕 Widget écran d'accueil avec la séance du jour.
-->

- [13/07/2026] 🆕 **Bilan hebdo/mensuel automatique** : un récap périodique narratif (volume, sorties,
  calories, PR, tendance) poussé en notification — distinct des widgets dashboard (vue live). Digest
  qui raconte la période. S'appuie sur les agrégats déjà cadrés.
- [13/07/2026] 🆕 **Rétrospective annuelle façon « Wrapped »** : récap annuel imagé et partageable
  (km parcourus, tonnage total, top exercices, records…). Fort levier d'acquisition virale ; recoupe
  [[carte-seance-partageable]].
- [13/07/2026] 🆕 **Rappels intelligents contextuels** : notifications situées — « séance prévue
  aujourd'hui », « déjeuner non loggé », « streak en danger ce soir ». S'appuie sur le planning
  unifié déjà cadré.
- [13/07/2026] 🆕 **Carte de séance/course partageable en image** : export visuel (trace GPS + stats,
  ou résumé muscu) pour stories Insta/WhatsApp. _NB : le feed social est V2 ; ici c'est du partage
  sortant statique, faisable avant._
- [13/07/2026] 🆕 **Programme de parrainage** : code d'invitation + récompense. Utile quand la
  monétisation s'activera (lié à [[offre-payante-coach]] / RevenueCat câblé).
- [13/07/2026] 🆕 **Reconnaissance de repas par photo** : sous-cas concret de [[integration-ia]] —
  photo de l'assiette → estimation des aliments/macros. Recoupe [[nutrition-recettes-healthy]].
- [13/07/2026] 🆕 **Suggestions de substitution d'aliments** : « il te manque 20 g de protéines
  aujourd'hui → ajoute X ». Complète le socle calories/macros cadré (TDEE, journal).
- [13/07/2026] 🆕 **Suivi du jeûne intermittent / fenêtre alimentaire** : timer + historique de la
  fenêtre repas. Public fitness demandeur ; non couvert par le cadrage nutrition.
- [13/07/2026] 🆕 **Substitution d'exercices (matériel indispo / blessure)** : « banc pris → variante
  haltères ». Améliore le logging live muscu ; lié à [[journal-blessures]].
- [13/07/2026] 🆕 **Détection de plateau + suggestion de deload proactive** : au-delà de la surcharge
  progressive déjà cadrée, détecter la stagnation d'un exercice et proposer un deload. Recoupe
  [[analyses-croisees-poussees]].
- [13/07/2026] 🆕 **Météo avant une sortie planifiée** : aujourd'hui la météo n'est qu'un champ
  post-séance ; l'afficher **en amont** d'une sortie prévue aide à planifier. Lié aux rappels
  contextuels.
- [13/07/2026] 🆕 **Journal de bien-être / humeur / énergie** : mini-suivi quotidien (humeur, énergie,
  stress) — potentielle **4ᵉ dimension légère** cohérente avec le nom « wellness ». Nourrit
  directement [[analyses-croisees-poussees]] (corrélation récup ↔ perfs).
- [13/07/2026] 🆕 **Journal blessures/douleurs & courbatures** : noter une zone sensible → l'app évite
  de programmer ce groupe ou alerte. Complète la récup ; lié à [[substitution-exercices]] et
  [[analyses-croisees-poussees]].
- [13/07/2026] 🆕 **Widget écran d'accueil Android** : les widgets 7.x cadrés sont *in-app* ; un vrai
  widget home-screen (séance du jour, streak, calories restantes) est un gap. _Chevauchement partiel
  avec le dashboard._
- [13/07/2026] 🆕 **Commandes / annonces vocales pendant la séance** : mains occupées — « série
  validée », « prochain exercice ». Étend à la muscu les annonces audio running déjà prévues.
- [13/07/2026] 🆕 **Langues supplémentaires (ES, DE…)** : extension naturelle post-FR/EN ; l'archi
  i18n (i18next) est déjà en place.
- [13/07/2026] 🆕 **Archivage sûr du contenu éditorial (désarchiver + garde-fou d'usage)** : suite au
  CRUD exercices (US 8.2), l'archivage = soft-delete **à sens unique** (pas de « désarchiver » dans
  l'admin) et **sans garde-fou**. Or archiver un exercice **déjà utilisé** dans des séances
  d'utilisateurs (`workout_sets`/`exercise_plans` le référencent) le retire de leur base locale
  (sync `deleted_at IS NULL`) → **référence orpheline** : le nom disparaît de leur historique.
  Pistes : (a) écran des **archivés** + **restauration** (`deleted_at → null`) ; (b) **garde-fou** qui
  compte les usages (`workout_sets`/`exercise_plans` référençant l'exercice) et **prévient/empêche**
  l'archivage d'un exercice populaire ; (c) généraliser aux autres contenus éditoriaux (aliments,
  programmes). Transverse aux lots CRUD admin (8.2→8.5). _Noté le 13/07/2026._
- [13/07/2026] 🆕 **Moteur d'analyses croisées poussées (corrélations)** : au-delà du socle de
  croisement déjà cadré, un vrai moteur qui met les données en relation — tendance des PR selon le
  volume/intensité, surplus vs déficit calorique corrélé à l'évolution des perfs, impact des pas
  sur la récup et les perfs, etc.
  _Vérifié le 13/07/2026 : le **socle** du croisement EST cadré (calories ajustées aux jours
  d'entraînement + vue « séances vs apports » §7.1-7.3 ; alerte déficit + fort volume US 4.32 =
  « première stat croisée » ; courbes volume/PR 3.21/3.39/3.40 ; RPE capté 3.34/5.24). Mais ce sont
  des stats croisées simples, pas un moteur de corrélation. Les analyses causales décrites ici ne
  sont PAS au cadrage → idée neuve. Dépend en partie de [[donnees-sommeil-pas]] (pas trackés) et
  recoupe les « analyses avancées » du [[module-coach-coache]]._
- [12/07/2026] 🆕 **Intégration de l'IA** dans le produit (thème transverse à préciser).
- [12/07/2026] 🆕 **Nutrition — suggestion de recettes healthy** : l'utilisateur renseigne les
  ingrédients qu'il a, l'app propose des recettes saines correspondantes (piste IA à évaluer).
- [12/07/2026] 🆕 **Données sommeil & pas (podométrie/steps)** : indicateur + saisie/import.
  _Vérifié le 12/07/2026 : non couvert par le cadrage actuel. Health Connect (US 9.9, V1) se
  limite à l'écriture des séances + lecture du poids ; les wearables V2 (zones FC, hydratation)
  ne nomment ni le sommeil ni les pas. → idée neuve à instruire. Piste : source de vérité via
  Health Connect (Android) / Apple Health (iOS ultérieur) plutôt que saisie manuelle._
- [12/07/2026] 🆕 **Gamification ludique via équivalences parlantes** : streak/indicateurs qui
  traduisent les perfs en repères concrets — ex. « Tu as couru X km ce mois-ci, soit la distance
  Paris–Marseille » ou « Tu as soulevé X tonnes cette séance, soit l'équivalent d'un Boeing ».
- [12/07/2026] 🆕 **Module Coach ⇄ Coaché (feature complète)** : espace dédié aux coachs et à
  leurs clients — templates/programmes, suivi poussé côté coach ET coaché, volet nutrition,
  facturation (coachs auto-entrepreneurs), suivi compta, analyses avancées des coachés (tendances,
  nutrition, mensurations, PR, perf, volume, tonnage…) et croisement des données
  muscu/nutrition/bien-être/course.
- [12/07/2026] 🆕 **Offre payante dédiée** aux coachs et à leurs coachés (monétisation du module
  Coach ci-dessus).

---

## Archives

<!-- Idées tranchées (promues ou écartées), pour garder la trace de la décision. Exemple :
- [10/07/2026] ✅ Export GPX des sorties → promue en US 5.xx.
- [10/07/2026] ❌ Intégration montres Garmin → hors périmètre V1, revoir en V2.
-->
