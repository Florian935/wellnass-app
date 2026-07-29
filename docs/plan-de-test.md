# Plan de test — inventaire des écrans et de leurs fonctionnalités

> **But.** Recenser **tous** les écrans de l'app et, pour chacun, ce qu'on attend de lui — afin de
> pouvoir tester le produit de façon exhaustive, et pas seulement les US du moment.
>
> **Différence avec [RECETTES.md](../RECETTES.md)** : RECETTES.md est **temporaire et rétrécit** (les
> critères des US en attente de validation, une section disparaît à la clôture). Ce fichier-ci est
> **permanent et stable** : il décrit le produit tel qu'il est censé fonctionner, US ou pas. Les deux
> sont complémentaires — on recette une US dans RECETTES.md, on teste l'app avec ce plan.
>
> **Source.** Construit le 30/07/2026 depuis le code réel : arborescence de
> [apps/mobile/src/app/](../apps/mobile/src/app/), déclarations de routes de
> [_layout.tsx](../apps/mobile/src/app/_layout.tsx), docblocks d'écrans et clés i18n effectivement
> utilisées. **Ce n'est pas une liste de souhaits** : chaque case correspond à quelque chose qui
> existe dans le code.
>
> **Périmètre : 58 écrans mobile + 15 écrans back-office = 73.**

---

## 0 bis. Résultat de la première passe automatisée — 30/07/2026

Passe pilotée en adb sur **41 écrans** (37 routes atteintes par deep link `wellness://<route>` + les
4 onglets), en **3 campagnes** : nominal, police 1,5×, mode avion. Pour chaque écran : capture +
`uiautomator dump`, puis comparaison programmée des arbres d'accessibilité entre campagnes.

**Ce qui est passé — résultats solides :**

| Contrôle | Résultat |
|---|---|
| Rendu sans crash | **41/41** — aucun texte d'erreur, aucun écran figé, 37 dumps distincts |
| **Offline-first (mode avion)** | **37/37 écrans identiques à l'état en ligne**, zéro libellé perdu |
| Indicateur de synchro | « Hors ligne » correctement affiché sur le dashboard |
| Zone de danger hors ligne | Suppression de compte bloquée, « Nécessite une connexion. » |
| **Police 1,5×** | **Aucune troncature** sur aucun écran — uniquement du reflux attendu |
| **i18n FR/EN** | **1451 clés de chaque côté, zéro manquante** dans un sens ou l'autre |

⚠️ **Piège de méthode, à connaître avant de refaire la passe** : `uiautomator dump` ne capture que
le **viewport visible**. À 1,5×, le contenu descend et des libellés « disparaissent » du dump alors
qu'ils sont simplement sous la ligne de flottaison. Une comparaison brute de dumps signale donc de
fausses troncatures — il faut confirmer à l'écran. Vérifié ainsi sur `running-profile` et
`food-custom` : rien n'était tronqué.

**Ce qui a été trouvé** : 5 constats, consignés dans
[BACKLOG.md](../BACKLOG.md#-dette--suivi-technique) — dont le bandeau d'erreur affiché alors que
Health Connect est simplement désactivé, et l'écran vide de `run/active`.

**Non couvert par cette passe**, faute d'automatisation possible : tout ce qui exige une **saisie**
(création d'objectif, de mensuration, de séance), la bascule FR/EN **dans l'app** (vérifiée
statiquement à la place), la sortie vocale réelle de TalkBack, les gestes (swipe, glisser-déposer),
la caméra, le GPS, et les scénarios à horloge longue.

---

## 0. Comment utiliser ce plan

Les cases ne sont **pas** cochées et ne doivent pas l'être ici de façon permanente : ce fichier est
un **modèle** de campagne de test. Pour une campagne, copie la section qui t'intéresse dans une note
de travail, ou coche puis remets à blanc. Ce qui doit rester durablement coché va dans
[RECETTES.md](../RECETTES.md) (par US) ou devient une entrée de [BACKLOG.md](../BACKLOG.md).

**Ordre conseillé pour une passe complète** : §1 transverse d'abord (un défaut transverse fausse tout
le reste), puis §2 parcours d'entrée, puis les piliers §4→§6, puis §7 transverse-compte, puis §8
back-office.

**Priorités** : 🔴 = si ça casse, l'app est inutilisable · 🟠 = fonctionnalité dégradée mais
contournable · 🟢 = confort.

---

## 1. Contrôles transverses — à appliquer à CHAQUE écran

Ces huit points ne sont pas listés à nouveau écran par écran ; ils s'appliquent partout. C'est la
partie la plus rentable du plan : un défaut ici touche 58 écrans d'un coup.

- [ ] 🔴 **Offline-first.** En mode avion, l'écran s'affiche, la saisie fonctionne, la donnée
      survit à un redémarrage de l'app, et remonte au retour du réseau. Aucun écran ne doit dépendre
      du réseau pour **lire** (tout vient de la base locale PowerSync).
- [ ] 🔴 **Aucune chaîne en dur.** Basculer FR → EN dans [Réglages](../apps/mobile/src/app/settings.tsx)
      et vérifier que **tout** l'écran change, libellés d'accessibilité inclus. Toute chaîne restée en
      français est un défaut.
- [ ] 🟠 **Grande police.** À `font_scale` 1,5× (Réglages Android → Affichage → Taille de police),
      aucun libellé tronqué, aucun chevauchement, la page reste scrollable.
      Test rapide : `adb shell settings put system font_scale 1.5` — **et le remettre à 1.0 après**.
- [ ] 🟠 **TalkBack.** Chaque contrôle est atteignable et annoncé avec son rôle, sa valeur et son
      unité. Aucune information portée **uniquement par la couleur** (un delta doit être lisible en
      texte : « en baisse de 57 % », pas juste du rouge).
- [ ] 🟠 **Thème clair et sombre.** Contraste suffisant dans les deux ; aucun texte
      quasi-invisible.
- [ ] 🟠 **État vide.** Jamais de graphique vide ni de liste blanche : un message qui explique, et un
      CTA quand une action est possible.
- [ ] 🟠 **Sortie possible.** Chaque écran offre un retour visible **ou** un geste système qui
      fonctionne. ⚠️ Voir le point ouvert §1.1.
- [ ] 🟢 **Chargement.** Un `isLoading` visible plutôt qu'un écran vide qui clignote.

### 1.1 ⚠️ Point ouvert — écrans sans bouton retour visible

Constaté le 30/07/2026 en auditant les routes. Deux familles d'écrans coexistent :

| Famille | En-tête de navigation | Retour visible | Écrans |
|---|---|---|---|
| **Modale** | `headerShown: true` + `presentation: 'modal'` | ✅ oui | measurements, review, goals, wellbeing, steps, nutrition-stats, … |
| **Sans en-tête** | `headerShown: false`, l'écran rend son propre `ScreenHeader` | ❌ **non** | `programs/*`, `templates/*` |

[ScreenHeader](../apps/mobile/src/components/ScreenHeader.tsx) est un **bloc de titre**, il ne
contient aucun bouton retour. Les écrans de la seconde famille ne se quittent donc qu'au geste
système. C'est ce qui a été corrigé pour `steps` (la route n'était pas déclarée du tout —
[commit `ecee20e`](../CHANGELOG.md)), mais `programs/*` et `templates/*` sont toujours dans ce cas.

- [ ] 🟠 Trancher : est-ce voulu pour ces écrans, ou faut-il les aligner sur la famille modale ?
- [ ] 🟠 Vérifier que le geste retour système fonctionne bien sur `programs/index`, `programs/[id]`,
      `programs/edit`, `templates/index`, `templates/[id]`, `templates/edit`.

---

## 2. Compte & accès — 7 écrans

### 2.1 `(auth)/sign-in` — Connexion 🔴
- [ ] Connexion e-mail + mot de passe valide → arrivée sur le dashboard.
- [ ] Identifiants faux → message clair, pas d'erreur brute de Supabase.
- [ ] **Connexion Google** (bouton dédié + séparateur « ou »).
- [ ] Lien « Mot de passe oublié » → `(auth)/forgot-password`.
- [ ] Lien « Pas encore de compte » → `(auth)/sign-up`.
- [ ] Message de succès après une réinitialisation de mot de passe réussie.
- [ ] Message spécifique si le lien de réinitialisation est **expiré**.
- [ ] Hors ligne : message actionnable, pas un plantage.

### 2.2 `(auth)/sign-up` — Inscription 🔴
- [ ] Création de compte e-mail + mot de passe + **confirmation** + date de naissance (jour / mois / année).
- [ ] Mots de passe différents → message `passwordMismatch`.
- [ ] Mot de passe trop court → message `passwordTooShort`.
- [ ] Date de naissance invalide (31/02, date future) → `invalidBirthDate`.
- [ ] **Âge minimum** non atteint → `tooYoung`, inscription refusée.
- [ ] **Consentement obligatoire** : cases CGU + confidentialité, avec liens vers les deux écrans ;
      sans consentement → `consentRequired`, bouton bloqué.
- [ ] Le libellé de consentement est accessible (TalkBack lit l'ensemble, liens compris).
- [ ] Inscription Google.

### 2.3 `(auth)/forgot-password` — Mot de passe oublié 🟠
- [ ] Saisie de l'e-mail → message « envoyé », **sans révéler** si le compte existe.
- [ ] Hors ligne : message clair.

### 2.4 `(auth)/verify-email` — Vérification d'e-mail 🟠
- [ ] Message d'attente affiché après inscription.
- [ ] Action de renvoi / continuation.

### 2.5 `password-reset` — Nouveau mot de passe 🟠
- [ ] Atteint depuis le lien e-mail (deep link).
- [ ] Nouveau mot de passe + confirmation ; non concordants → `mismatch` ; trop court → `tooShort`.
- [ ] Hors ligne → message `offline` explicite (l'opération **exige** le réseau).
- [ ] Échec serveur → `updateFailed`.
- [ ] Annulation possible ; **geste retour désactivé** (`gestureEnabled: false`) — vérifier qu'on ne
      peut pas s'échapper à mi-parcours.

### 2.6 `(auth)/terms` — CGU 🟢
- [ ] Texte complet, scrollable, disponible **FR et EN**.

### 2.7 `(auth)/privacy` — Politique de confidentialité 🟢
- [ ] Texte complet, scrollable, FR + EN.
- [ ] ⚠️ Rappel : la version **publiée à une URL publique** est un prérequis de LANCE-00 et de
      Health Connect — l'écran in-app ne suffit pas.

---

## 3. Onboarding — 6 écrans

### 3.1 `(onboarding)/intro` 🔴
- [ ] Titre + sous-titre + bouton « Commencer ».
- [ ] **« Tout passer »** fonctionne et mène à une app utilisable (aucun pilier bloqué).

### 3.2 `(onboarding)/pillars` — Choix des piliers 🔴
- [ ] Sélection de 1 à 3 piliers (Musculation / Running / Nutrition).
- [ ] 🔴 **Conséquence à vérifier** : les onglets des piliers **non activés** sont masqués
      (décision H, intégration sans imposition).
- [ ] Aucun pilier sélectionné : comportement défini (refus ou app minimale) — pas d'écran mort.

### 3.3 `(onboarding)/goal` — Objectif 🟠
- [ ] Choix de l'objectif, sélection visible et persistée.

### 3.4 `(onboarding)/infos` — Informations personnelles 🟠
- [ ] Prénom, sexe, date de naissance (J/M/A), taille, poids.
- [ ] **Unités impériales** : la taille se saisit en pieds + pouces (`heightFeet` / `heightInches`).
- [ ] Valeurs aberrantes refusées avec message.

### 3.5 `(onboarding)/displayLevel` — Niveau d'affichage 🟠
- [ ] Choix du niveau de détail ; l'effet est visible ensuite en séance (cf. §4.1).

### 3.6 `(onboarding)/summary` — Récapitulatif 🟠
- [ ] Reprend prénom, objectif, piliers choisis ; « aucun » si rien n'a été choisi.
- [ ] CTA final → dashboard, et l'onboarding **ne se rejoue pas** au relancement.

---

## 4. Accueil & dashboard — 1 écran + widgets

### 4.1 `(tabs)/index` — Dashboard 🔴
- [ ] Salutation avec le prénom (`home.greetingName`), ou générique sans prénom.
- [ ] **Indicateur de synchro** visible (« Synchronisé » / en cours / hors ligne).
- [ ] Accès aux réglages et au profil.
- [ ] 🔴 **Mode personnalisation** : bouton « Personnaliser » → réorganisation par
      **glisser-déposer**, indice affiché, « Terminé » pour sortir. L'ordre **persiste** après
      redémarrage.
- [ ] Chaque widget peut être **masqué** puis réaffiché.
- [ ] Les widgets **changent de taille** (small / compact / wide / large / full selon le widget).
- [ ] 🔴 Les widgets des piliers **non activés** n'apparaissent pas.

**Widgets à vérifier un par un** (source : [widgets.ts](../packages/shared/src/widgets.ts)) —
chacun doit afficher une donnée juste, un état vide propre, et ouvrir le bon écran au tap :

- [ ] `streak` — série en cours ; **joker** proposé après un jour manqué (STREAK-01).
- [ ] `today-session` — séance du jour → hub muscu.
- [ ] `nutrition-summary` — kcal restantes + macros → onglet nutrition.
- [ ] `weight` — poids récent → stats nutrition.
- [ ] `steps` — pas du jour vs objectif → `steps` (PAS-01).
- [ ] `wellbeing` — check-in du jour, **lançable depuis le widget** (BIEN-01).
- [ ] `goals` — objectif **le plus urgent**, pas le plus avancé (OBJ-01).
- [ ] `review` — bilan hebdomadaire → `review` (BILAN-01).
- [ ] `record-recent` — dernier record personnel.
- [ ] `muscle-volume` — volume par groupe musculaire.
- [ ] `deficit-volume` — alerte déficit / volume.
- [ ] `training-time` — temps d'entraînement.
- [ ] `running-week`, `running-history`, `running-planning`, `running-programs`.
- [ ] `strength-history`, `strength-planning`, `strength-programs`, `strength-progress`,
      `strength-templates`.

---

## 5. Pilier Musculation — 16 écrans

### 5.1 `(tabs)/strength` — Hub muscu 🔴
- [ ] Séance du jour : nom, programme, nombre d'exercices, CTA de démarrage.
- [ ] « Déjà fait aujourd'hui » quand la séance est terminée.
- [ ] Prochaine séance annoncée quand rien n'est prévu aujourd'hui.
- [ ] **Reprise** d'une séance en cours (`workout.resume`).
- [ ] **Séance libre** : à blanc **ou** depuis un template.
- [ ] Accès bibliothèque d'exercices.

### 5.2 `workout` — Séance en cours 🔴
- [ ] Saisie série par série : charge, reps, durée selon le type d'exercice.
- [ ] Ajout d'un exercice en cours de séance.
- [ ] 🔴 **Substitution d'exercice** (MUSC-F14) : suggestion de remplacement, justification
      **factuelle** (variante / matériel). ⚠️ Aucun vocabulaire de douleur ou d'articulation ne doit
      apparaître.
- [ ] **Intensité en RPE ou RIR** selon le réglage (UX-05) — cf. §7.1.
- [ ] Suggestion de progression, dont **deload** le cas échéant.
- [ ] Types de série : normale, échauffement, échec, dropset, superset, au poids du corps, à la durée.
- [ ] Minuteur de repos (valeur planifiée, override de séance, défaut).
- [ ] Quitter : **mettre en pause** ou **abandonner** (double confirmation) — pas de perte silencieuse.
- [ ] Terminer **sans aucune série** → avertissement `finishNoSets`, confirmation explicite.
- [ ] Hors ligne : séance complète possible de bout en bout.

### 5.3 `workout-summary` — Résumé de séance 🟠
- [ ] Durée, nombre d'exercices, séries, volume, échauffements.
- [ ] **Ressenti** (étoiles / RPE de séance) + note libre.
- [ ] **Records battus** mis en avant.
- [ ] **Enregistrer comme template** (nom proposé par défaut, confirmation).
- [ ] 🔴 **Carte partageable** (PARTAGE-01) : génération d'image, partage natif, libellé a11y.

### 5.4 `exercises` — Bibliothèque 🟠
- [ ] Recherche par nom.
- [ ] **Filtres multicritères** (tiroir de filtres + réinitialisation).
- [ ] Badge « perso » sur les exercices créés par l'utilisateur.
- [ ] État vide **filtré** distinct de l'état vide global.
- [ ] Création d'un exercice personnalisé.
- [ ] 🔴 Un exercice **archivé** au back-office n'apparaît plus ici (ADMIN-01).

### 5.5 `exercises/[id]` — Fiche exercice 🟠
- [ ] Muscle principal, **muscles secondaires**, matériel, instructions ; « non renseigné » si vide.
- [ ] **Records** : charge max, 1RM estimé (marqué « estimé »), meilleur volume de série.
- [ ] Lien « voir la progression ».
- [ ] Favori (ajout / retrait).
- [ ] **Variantes / alternatives** : ajout, retrait, état vide.
- [ ] Édition et **suppression** (avec confirmation) d'un exercice perso.
- [ ] Exercice inexistant → `notFound` propre.

### 5.6 `history/index` — Historique des séances 🟠
- [ ] Liste des séances : date, durée, RPE.
- [ ] Filtre par période.
- [ ] État vide avec message.

### 5.7 `history/[id]` — Détail de séance 🟠
- [ ] Séries détaillées avec leur type (échauffement, échec, dropset, superset, poids du corps, durée).
- [ ] Volume, durée, RPE, notes.
- [ ] Comparaison au **planifié**.
- [ ] Records de la séance.
- [ ] 🔴 Une séance contenant un exercice **archivé** affiche toujours **son nom** (ADMIN-01 — c'est
      le test qui prouve que les sync rules sont déployées).
- [ ] Séance inexistante → `notFound`.

### 5.8 `progress/index` — Progression muscu 🟠
- [ ] Volume par groupe musculaire (semaine courante) + comparaison à la semaine précédente + total.
- [ ] **Équilibre des groupes** musculaires + alerte de déséquilibre.
- [ ] Sélecteur d'exercice (modal).
- [ ] Records de l'exercice choisi.
- [ ] Courbe de progression : bascule **charge max / volume**, périodes **30 j / 90 j / 1 an / tout**.
- [ ] 🟠 **Infobulle au tap** sur les graphiques (UX-01) : valeur exacte + date.
- [ ] Accès aux **mensurations** (MESUR-01) depuis cet écran.
- [ ] États vides : jamais de graphique vide, CTA « démarrer une séance ».

### 5.9 `planning/index` — Planning muscu 🟠
- [ ] Vue semaine, navigation semaine précédente / suivante.
- [ ] Statuts : fait / manqué / passé.
- [ ] **Séances manquées** regroupées avec leur compte.
- [ ] **Report** : aujourd'hui, demain, +7 jours.
- [ ] Marquer fait rapidement ; passer une séance.
- [ ] Jour de repos, plusieurs séances le même jour.
- [ ] Hint si aucun profil / programme actif.
- [ ] Reprise d'une séance en cours depuis le planning.

### 5.10 `planning/plan` — Planifier un programme 🟠
- [ ] Choix du programme, **date de début**, durée en semaines, jour assigné par séance.
- [ ] Nombre de séances générées annoncé.
- [ ] 🟠 **Changement de programme** alors qu'un autre est actif : choix explicite entre conserver
      et supprimer les séances existantes.
- [ ] Erreur de planification → message, pas de plantage.

### 5.11 `programs/index` — Programmes 🟠
- [ ] Deux sections : **bibliothèque** et **mes programmes**, chacune avec son état vide.
- [ ] Badge « actif » sur le programme en cours.
- [ ] Filtre par niveau.
- [ ] **Duplication** depuis la bibliothèque (a11y du bouton).
- [ ] Création d'un programme.
- [ ] 🔴 Les programmes **archivés** n'apparaissent pas (ADMIN-01).
- [ ] 🔴 **CONTENU-01** : les 3 programmes muscu de bibliothèque sont présents, en FR **et** EN.

### 5.12 `programs/[id]` — Détail programme 🟠
- [ ] Séances listées avec exercices, séries, reps, charge, repos.
- [ ] Séances **repliables**.
- [ ] Démarrer le programme / démarrer une séance précise.
- [ ] Éditer, **dupliquer**, éditer le planning.
- [ ] **Supprimer** avec confirmation ; erreur de suppression gérée.
- [ ] Exercice inconnu → libellé de repli, pas de case vide.
- [ ] États vides (aucune séance, aucun plan) ; programme inexistant → `notFound`.

### 5.13 `programs/edit` — Créer / éditer un programme 🟠
- [ ] Sans `?id=` : formulaire nom / objectif / niveau / durée → création.
- [ ] Avec `?id=` : composition, ajout de séances (nommage auto « Séance A », « Séance B »…).
- [ ] État vide « aucune séance ».
- [ ] « Terminé » enregistre.

### 5.14 `templates/index` — Templates de séance libre 🟠
- [ ] Liste avec nombre d'exercices ; état vide ; création.
- [ ] 🟠 Le tap ouvre **toujours le détail** (jamais un démarrage direct) — régression corrigée le
      22/07/2026, à ne pas réintroduire.

### 5.15 `templates/[id]` — Détail template 🟠
- [ ] Composition éditable, **Démarrer**, **Dupliquer**, **Supprimer** (confirmation + soft delete).

### 5.16 `templates/edit` — Créer / éditer un template 🟠
- [ ] Sans `?id=` : nom seul → création puis bascule en édition.
- [ ] Avec `?id=` : composition, bouton « Terminé » **toujours visible** en pied d'écran (choix
      délibéré, différent de `programs/edit`).

---

## 6. Pilier Nutrition — 9 écrans

### 6.1 `(tabs)/nutrition` — Journal du jour 🔴
- [ ] kcal restantes / dépassement, macros (protéines, glucides, lipides), sel.
- [ ] Navigation **jour précédent / suivant**, retour à « aujourd'hui ».
- [ ] Ajout d'un aliment ; **repas personnalisés** (`meals.mealN`, gestion des repas).
- [ ] **Copier la journée d'hier** / copier un repas ; message si rien à copier.
- [ ] Entrée : **swipe pour éditer**, suppression avec confirmation, indice de swipe.
- [ ] Détail d'entrée : quantité, calories, heure de log, **déplacer vers un autre repas**,
      monter / descendre, éditer, enregistrer.
- [ ] Enregistrer un repas comme **modèle**.
- [ ] Définir une cible ; accès aux stats.
- [ ] 🔴 **NUTR-F2** : carte de suggestion d'aliments pour combler un macro manquant — quantités
      réalistes, kcal affichées, ajout en un tap, **absente** si dépassement calorique ou journée à
      l'équilibre.

### 6.2 `food-picker` — Choisir un aliment 🔴
- [ ] Recherche locale ; **recherche OpenFoodFacts** en ligne, avec état « recherche… » et « aucun
      résultat ».
- [ ] Onglets : tous / **favoris** / **récents** / **recettes** / listes rapides.
- [ ] Valeurs **pour 100 g** affichées ; quantité ajustable ; ajout avec compteur.
- [ ] Appui long → édition ; suppression d'un aliment perso avec confirmation.
- [ ] Création d'aliment, **scan**, ajout rapide en calories, recettes (portions à ajouter).
- [ ] Hors ligne : la recherche **locale** fonctionne, l'OFF échoue proprement.

### 6.3 `food-custom` — Créer / éditer un aliment 🟠
- [ ] Nom, catégorie, valeurs pour 100 g (kcal, protéines, glucides, lipides).
- [ ] **Macros détaillées** : sucres, acides gras saturés, fibres.
- [ ] **Micronutriments optionnels** (mg / µg) avec leur hint.
- [ ] Enregistrement / mise à jour.

### 6.4 `food-scan` — Scanner un code-barres 🟠
- [ ] Demande de permission caméra avec message ; refus géré.
- [ ] Scan → résolution du produit ; **rescan** possible.
- [ ] Erreurs distinctes : code inconnu, données incomplètes, réseau.
- [ ] Création d'aliment si le produit est absent.

### 6.5 `meal-quick-entry` — Saisie en langage naturel 🟠
- [ ] Saisie libre en liste → **analyse** → revue des correspondances.
- [ ] Éléments **non reconnus** signalés explicitement.
- [ ] Ajout groupé avec compteur ; suppression d'une ligne ; état « rien ».

### 6.6 `recipe-edit` — Recettes 🟠
- [ ] Nom, nombre de **portions**, ingrédients (ajout / retrait).
- [ ] Totaux **et** valeurs **par portion**.

### 6.7 `nutrition-meals` — Gérer les repas 🟢
- [ ] Ajouter / renommer / supprimer un repas ; **réordonner** (monter / descendre).

### 6.8 `nutrition-profile` — Profil nutritionnel 🟠
- [ ] Niveau d'activité, objectif, **TDEE calculé** vs cible **manuelle**, recalcul.
- [ ] Profil incomplet → message + CTA de complétion.
- [ ] Macros en grammes, **réinitialisation**.
- [ ] **Bonus calorique des jours d'entraînement** + mode de bonus (RN-02).
- [ ] **Marge d'adhérence** paramétrable.
- [ ] Micronutriments **suivis** (choix).
- [ ] Restrictions / allergènes.

### 6.9 `nutrition-stats` — Statistiques nutrition 🟠
- [ ] Apports moyens par jour ; **adhérence** à la cible (dans la marge / hors cible / sans cible).
- [ ] **Régularité du journal** (jours journalisés).
- [ ] **Courbe de poids** + saisie / enregistrement d'un poids.
- [ ] Infobulle au tap (UX-01) ; états vides par section.

---

## 7. Pilier Running — 8 écrans

### 7.1 `(tabs)/running` — Hub course 🔴
- [ ] Accroche + CTA de démarrage.
- [ ] **Reprise** d'une course en cours.

### 7.2 `run/index` — Démarrer une course 🔴
- [ ] Bascule **GPS / sans GPS**, avec hint pour chaque mode.
- [ ] 🔴 Refus de permission de localisation → **on ne navigue pas** vers le suivi ; choix
      « continuer en manuel » ou « annuler la course ».
- [ ] Course déjà active → proposition de reprise, **jamais** de seconde course créée.

### 7.3 `run/active` — Course en cours 🔴
- [ ] Chronomètre qui avance (secondes depuis le départ).
- [ ] Distance, **allure instantanée**, allure moyenne.
- [ ] États GPS : recherche / actif / manuel.
- [ ] **Pause / reprise / arrêt**.
- [ ] 🔴 **Arrière-plan** : écran verrouillé puis retour, la trace n'est pas perdue.

### 7.4 `run/summary` — Résumé de course 🟠
- [ ] Distance, durée, allure moyenne ; **distance manuelle** si mode sans GPS.
- [ ] **Splits par km**.
- [ ] Carte de la trace ; message si aucune trace.
- [ ] RPE + notes.
- [ ] **Nouveau record** signalé ; allure de référence mise à jour.
- [ ] **Export GPX** ; erreurs distinctes (échec / indisponible).
- [ ] 🔴 **Carte partageable** (PARTAGE-01).

### 7.5 `running-history/index` — Historique & progression 🟠
- [ ] Stats agrégées par période (semaine / mois / depuis le début).
- [ ] Courbe d'allure moyenne 30 / 90 j + libellé de **tendance**.
- [ ] Liste des courses terminées → détail au tap.
- [ ] **Records** d'allure ; états vides par section.

### 7.6 `running-profile` — Profil coureur 🟠
- [ ] Niveau, fréquence, objectif.
- [ ] **Allures par type de séance** (course libre exclue) avec plages ; état vide.
- [ ] Référence 5 km + hint.

### 7.7 `running-programs/index` — Programmes de course 🟠
- [ ] Onglets **bibliothèque / mes programmes**.
- [ ] Filtres : niveau, objectif, durée ; badge « actif » ; « utiliser » ; création.
- [ ] 🔴 **CONTENU-01** : les 3 programmes de course de bibliothèque sont présents, FR + EN.

### 7.8 `running-programs/[id]` et `running-programs/edit` 🟠
- [ ] Détail : séances, durée, badge actif, démarrer, dupliquer, éditer, éditer le planning.
- [ ] Suppression avec confirmation ; erreur gérée ; hint si aucun profil.
- [ ] Édition : nom, niveau, objectif, durée, résumé, ajout de séances (nommage auto A, B, C…).

---

## 8. Transverse — compte, réglages, suivi — 10 écrans

### 8.1 `settings` — Réglages 🔴
- [ ] **Langue** FR / EN — bascule immédiate, sans redémarrage.
- [ ] Apparence (thème) ; **couleurs de menu** activables + réinitialisation.
- [ ] 🔴 **Notifications** : permission (refus géré), **plage Ne Pas Déranger** (début / fin),
      réglage d'heure (+ / −).
- [ ] **Heure du bilan hebdomadaire** (BILAN-01).
- [ ] 🟠 **Intensité : RPE ou RIR** (UX-05) — le changement se voit en séance (§5.2).
- [ ] **Unités** métrique / impérial — se répercute partout (taille, poids, distance, mensurations).
- [ ] 🔴 **Health Connect** (CONF-06) : activation, permissions, imports, états
      « non installé » / « à mettre à jour » / « permissions manquantes ».
- [ ] **Export de données** (RGPD) + avertissement de synchro avant export.
- [ ] Analytics : bascule on/off, et **off = aucun envoi**.
- [ ] Aide & support ; **déconnexion**.
- [ ] 🔴 **Zone de danger** : suppression de compte, désactivée hors connexion avec explication.

### 8.2 `profile` — Profil 🟠
- [ ] Prénom, sexe, date de naissance, taille, poids, **poids cible**.
- [ ] Unités impériales (pieds / pouces).
- [ ] Valeur non numérique → `invalidNumber`.
- [ ] Enregistrement persistant.

### 8.3 `help` — Aide & support 🟢
- [ ] **FAQ en accordéon mono-ouverture** : ouvrir un item ferme le précédent.
- [ ] Contact libre et **signalement de bug** → ouvrent le mail natif.
- [ ] Contenu entièrement i18n.

### 8.4 `account-delete` — Suppression de compte 🔴
- [ ] Liste explicite de **ce qui sera supprimé**.
- [ ] **Mot de passe** exigé ; mauvais mot de passe → `errorWrongPassword`.
- [ ] **Délai de grâce** annoncé ; suppression **programmée**, pas immédiate.
- [ ] Incitation à **exporter** avant.
- [ ] Mention Health Connect (les données déjà écrites chez le fournisseur ne sont pas effacées).
- [ ] Annulation possible.

### 8.5 `deletion-pending` — Suppression en attente 🔴
- [ ] Date de suppression affichée ; app **bloquée** ; geste retour désactivé.
- [ ] **Annuler la suppression** fonctionne ; échec d'annulation → message.
- [ ] Déconnexion possible.

### 8.6 `steps` — Pas quotidiens (PAS-01) 🟠
- [ ] Histogramme 30 jours, barres **teintées** selon l'atteinte de l'objectif.
- [ ] Moyenne, **meilleur jour**, nombre de jours où l'objectif est atteint, plage d'historique.
- [ ] Objectif réglable **entre 1 000 et 50 000** (+ / −), bornes respectées.
- [ ] Mention « les pas comptent pour la série ».
- [ ] États : Health Connect désactivé / permissions manquantes / non supporté / vide.
- [ ] Infobulle au tap sur l'histogramme.
- [ ] ✅ En-tête + bouton retour présents (corrigé le 30/07/2026, `ecee20e`).

### 8.7 `wellbeing` — Bien-être (BIEN-01) 🟠
- [ ] Sélecteur d'indicateur, **une seule courbe à la fois**.
- [ ] 🔴 Un jour non renseigné est un **trou**, jamais un 0.
- [ ] Journal des jours avec « non renseigné ».
- [ ] Moyenne sur la fenêtre ; fenêtres (N jours / tout) ; « pas assez de points pour une courbe ».
- [ ] Renvoi vers la courbe de poids des stats nutrition (pas de doublon).
- [ ] ⚠️ **Point ouvert** : aucun CTA pour lancer un check-in depuis cet écran (cf.
      [RECETTES.md](../RECETTES.md)).

### 8.8 `measurements` — Mensurations (MESUR-01) 🟠
- [ ] Saisie de plusieurs mesures ; feuille **pré-remplie** au dernier relevé.
- [ ] Ré-enregistrer la même date **met à jour**, pas de doublon.
- [ ] Vider un champ retire **cette** mesure seule.
- [ ] Une courbe à la fois ; relevé partiel → trou sur les autres.
- [ ] **Delta** lisible en texte (« premier relevé » au premier).
- [ ] Impérial : **13,8 in**, jamais « 1 ft 1,8 in ».
- [ ] Valeur aberrante refusée ; date future impossible.
- [ ] Renvoi vers la courbe de poids (pas de doublon).

### 8.9 `goals` — Objectifs (OBJ-01) 🟠
- [ ] Création (distance, force…) avec échéance ; **plafond de 3** expliqué (`limitReached`).
- [ ] Sections **en cours** / **terminés** avec verdict conservé.
- [ ] Progression recalculée à l'affichage, donc juste hors ligne.
- [ ] Suppression avec confirmation.
- [ ] Pourcentage **et** valeur lisibles sans l'anneau.
- [ ] ⚠️ **Point ouvert** : « Nouvel objectif » apparaît **deux fois** sur l'état vide (cf.
      [RECETTES.md](../RECETTES.md)).

### 8.10 `review` — Bilan hebdomadaire (BILAN-01) 🟠
- [ ] Période affichée (semaine complète précédente).
- [ ] **Décision de la semaine** en premier, puis « Les chiffres » qui la rendent vérifiable.
- [ ] Blocs : jours actifs, séances, tonnage, sorties, distance, jours journalisés, jours dans la
      cible, records.
- [ ] Variations **haut / bas / stable** annoncées **en texte** ; « pas de comparaison » si
      première semaine.
- [ ] Recalculé à l'ouverture → juste même si la notification arrive en retard.
- [ ] État vide.

---

## 9. Back-office web — 15 écrans

Testés **au navigateur**, indépendamment du build mobile.
Source : [apps/admin/src/screens/](../apps/admin/src/screens/).

### 9.1 Accès
- [ ] `LoginScreen` — connexion admin ; identifiants faux gérés.
- [ ] `AccessDenied` — un compte **sans rôle** voit un refus explicite, pas un écran cassé.
- [ ] `RolesScreen` — attribution / retrait de rôles ; on ne peut pas se retirer son propre accès.
- [ ] `HomePlaceholder` — page d'accueil.

### 9.2 Exercices
- [ ] `ExercisesScreen` — liste, recherche, filtres, **décompte d'usages**.
- [ ] `ExerciseEditScreen` — création / édition, traductions **FR + EN**.
- [ ] 🔴 **ADMIN-01** : archiver un exercice **utilisé** affiche un décompte exact ; **inutilisé**
      indique « aucun usage » ; filtre « archivés » avec date ; **restauration** rend le `status`
      d'avant ; entrée d'audit pour archivage **et** restauration.

### 9.3 Programmes
- [ ] `ProgramsScreen` — liste, filtre « archivés ».
- [ ] `ProgramCreateScreen` / `ProgramEditScreen` — constructeur : séances, exercices, séries, reps,
      repos ; traductions FR + EN.
- [ ] 🔴 **ADMIN-01** : restaurer un programme restaure **aussi** ses séances et ses plans d'exercice.

### 9.4 Aliments
- [ ] `FoodsScreen` — liste, recherche, filtre « archivés ».
- [ ] `FoodEditScreen` — valeurs pour 100 g, macros détaillées, micronutriments, traductions.
- [ ] `FoodImportScreen` — **import CSV CIQUAL** : aperçu, erreurs de ligne, idempotence
      (réimporter ne duplique pas).

### 9.5 Utilisateurs & audit
- [ ] `UsersScreen` — liste, recherche, pagination.
- [ ] `UserDetailScreen` — consultation ; **bannissement** et lever de bannissement.
- [ ] `AuditScreen` — journal : chaque action d'admin laisse une trace horodatée et attribuée.

---

## 10. Ce que ce plan ne couvre pas

À dire explicitement, pour que personne ne croie le périmètre plus large qu'il n'est :

- **Les prérequis de publication** (LANCE-00 compte Play, déclaration « Health apps », politique de
  confidentialité à URL publique, SMTP custom, `app_version` réelle) — voir
  [BACKLOG.md](../BACKLOG.md). Ce ne sont pas des tests d'écran.
- **L'accessibilité systématique** (CONF-07, roadmap 9.11 / 9.12) : le §1 en donne les réflexes, mais
  l'audit de contraste WCAG AA reste un chantier à part, volontairement gardé pour la fin.
- **Les tests multi-appareils** : `signOut` local (déconnecter A ne doit pas déconnecter B) exige
  deux téléphones.
- **Les scénarios à horloge longue** : joker de série (une fois par mois), objectifs à échéance
  passée, bilan hebdomadaire sur plusieurs semaines. Ils ne se testent pas en une session.
- **Health Connect en production** : en dev build, la déclaration Play n'est pas appliquée ; certains
  comportements ne se vérifieront qu'après instruction par Google.

---

**Voir aussi** · [RECETTES.md](../RECETTES.md) recettes d'US en attente ·
[BACKLOG.md](../BACKLOG.md) reste-à-faire · [roadmap](roadmap/roadmap.md) périmètre complet ·
[ETAT.md](../ETAT.md) où on en est · [specs d'US](specs/functional/us/) règles détaillées par
fonctionnalité.
