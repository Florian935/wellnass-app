---
id: LAUNCHER-01
titre: "Widget écran d'accueil Android"
roadmap: [7.19]
catalogue: []
etape: recette
branche: feature/launcher01-widget-ecran-accueil
maj: 03/08/2026
---

# US LAUNCHER-01 — Widget écran d'accueil Android

> Idée retenue le 13/07/2026 ([IDEAS.md](../../../../IDEAS.md)), différée « après V0.9 » (choix de
> capacité). Cadrée aujourd'hui : c'est le **dernier candidat non démarré** de cette salve (RUN-14,
> NUTR-16, MUSC-09, ACTIV-01 sont tous livrés). Vrai gap identifié dès l'idée : les 16 widgets
> existants (roadmap 7.x, WIDGETS-01) sont **in-app** — rien n'est visible sans ouvrir
> l'application. Objectif : rétention passive dès le J1, un coup d'œil sans déverrouiller l'app.

## 0. Terminologie — lever l'ambiguïté avant tout le reste

Dans ce dépôt, **« widget » désigne déjà** une carte réordonnable du dashboard **in-app**
(`WidgetGrid`, roadmap 7.13/WIDGETS-01, 16 widgets × 3 formes). Cette US porte sur un objet
différent : un **widget de l'écran d'accueil du téléphone** (le launcher Android), qui existe
**en dehors** de l'application, rendu par le système alors même que l'app n'est pas ouverte.

**Décision D0 — identifiant et vocabulaire.** Cette US porte l'identifiant **`LAUNCHER-01`** (pas
`WIDGET-xx`, déjà pris par WIDGETS-01) et le terme **« widget launcher »** ou **« widget d'écran
d'accueil »** est toujours qualifié dans la spec, jamais « widget » seul — pour ne jamais confondre
avec les 16 widgets dashboard existants.

## 1. Ce que la recherche technique a changé par rapport à l'hypothèse de départ

BACKLOG.md/IDEAS.md posaient l'hypothèse d'un widget **natif Kotlin écrit à la main**
(AppWidgetProvider ou Jetpack Glance), « le plus cher des 5 » candidats de la salve. Vérification
avant d'écrire cette spec : **ce n'est pas nécessaire**.

**[`react-native-android-widget`](https://github.com/sAleksovski/react-native-android-widget)**
(MIT, ~6 400 téléchargements/semaine, dernière version 0.21.0 au 03/08/2026) permet d'écrire la UI
du widget **en JSX** (composants dédiés : `FlexWidget`, `TextWidget`, `ImageWidget`, `IconWidget`,
`SvgWidget`, `ListWidget`, `OverlapWidget` — pas les composants RN standards), rendue ensuite en
`RemoteViews` natif. **Zéro Kotlin/Java à écrire à la main.** Config plugin Expo prêt à l'emploi
(`app.config.ts` → `plugins: [['react-native-android-widget', config]]`), `npx expo prebuild`
génère tout — cohérent avec le fait que `apps/mobile/android/` est **entièrement gitignored** (CNG,
comme documenté pour CONF-06/`withHealthConnect.js`, qui lui ne fait que patcher du Manifest/
MainActivity existant — un cas plus simple que ce que cette US demandait de croire au départ).

**Conséquence directe sur le point dur annoncé** : le coût réel de cette US n'est plus « écrire un
widget natif », mais « intégrer une dépendance native tierce + relier ses données à
`packages/shared`/PowerSync » — un profil de risque bien plus proche de `react-native-view-shot`
(PARTAGE-01) ou `expo-speech`/`expo-haptics` (RUN-F2a/MUSC-F9) que d'un chantier natif inédit.

⚠️ **Ce que la recherche n'a PAS confirmé** : la compatibilité nommée avec Expo SDK 57 / RN 0.86
(la doc de la lib s'arrête à « Expo 55 canary » comme dernière mention explicite ; le support de la
New Architecture est documenté depuis la 0.16.0, largement antérieure). **Un spike de compatibilité
(prebuild + build + affichage d'un widget minimal) est donc le premier incrément du plan**, avant
tout développement de contenu — voir [plan](../../../plans/launcher01-widget-ecran-accueil.md).

## 2. Décisions arbitrées

| # | Question | Décision | Pourquoi |
|---|---|---|---|
| **D1** | Techno | **`react-native-android-widget`**, pas de Kotlin/Glance écrit à la main | Seule lib maintenue qui tient la promesse « JSX → RemoteViews, zéro natif ». Voir §1. *Recommandation à valider par Florian/Damien avant le spike — c'est le choix qui déclasse cette US de « le plus cher » à un profil de coût standard.* |
| **D2** | Accès aux données | La tâche **Headless JS** de la lib réutilise **le même singleton** `powerSync` déjà exporté par [`system.ts`](../../../../apps/mobile/src/powersync/system.ts) — **jamais** une seconde instance/connexion | PowerSync documente explicitement le risque d'une seconde instance sur le même fichier : verrous « database is locked », sync client dupliqué, `watch()` qui ne notifie plus la bonne instance. Headless JS tourne par défaut dans le **même process** que l'app (pas de `android:process` séparé prévu) — le partage d'un module JS singleton est donc naturel, pas un pont à construire |
| **D3** | Logique métier | **Aucune duplication** : les mêmes fonctions pures déjà testées (`computeStreak`/`computeStreakWithJokers` de `packages/shared/src/streak.ts`, le calcul kcal restantes déjà utilisé par `NutritionSummaryCard`) sont appelées depuis la tâche headless via des requêtes SQL directes (`powerSync.getAll()`/`getOptional()`), **pas** via les hooks React (`useTodaySession`/`useStreakData`/`useNutritionSummary`, indisponibles hors arbre React) | Deux implémentations de la même règle (une en JS hook, une dupliquée pour le widget) divergeraient tôt ou tard. Voir §3 pour le détail par métrique |
| **D4** | i18n | Les chaînes sont **résolues côté JS** (`i18n.t()`) avant d'être passées au widget — **aucune** duplication dans un `strings.xml` par locale | Aucun précédent de lecture i18next depuis du natif dans ce dépôt ; dupliquer les traductions créerait une deuxième source de vérité. C'est déjà le patron des notifications : [`notifications.ts`](../../../../apps/mobile/src/lib/notifications.ts) reçoit un contenu **déjà résolu par l'appelant** (« résolu par l'appelant via i18next », son propre commentaire) — l'appel réel à `i18n.t()` vit dans [`notification-repository.ts`](../../../../apps/mobile/src/data/repositories/notification-repository.ts). Le widget suit le même partage des responsabilités : la couche d'orchestration résout le texte, la couche d'affichage (natif) ne fait que le peindre |
| **D5** | Rafraîchissement | `updatePeriodMillis` (plafond **30 min**, imposé par Android, pas par la lib) **+** mise à jour déclenchée à chaque foreground/background de l'app **et** après toute action qui change une des 3 métriques (fin de séance, fin de course, entrée de journal, jour de streak franchi) | Pas de temps réel possible sur un widget launcher (contrainte OS). Combiner filet périodique + déclenchement applicatif couvre l'essentiel : les données ne changent que quand l'utilisateur agit *dans* l'app de toute façon |
| **D6** | Piliers actifs | Le widget **n'affiche que les métriques des piliers actifs** (masque « séance du jour » si musculation ET running désactivés, masque « kcal restantes » si nutrition désactivée). Si **aucun** pilier n'est actif, seul le streak reste affiché — jamais un widget vide | Cohérent avec la décision H (intégration sans imposition) déjà appliquée partout ailleurs (onglets masqués, widgets dashboard filtrés par pilier) |
| **D7** | Données de santé | **Aucune** donnée de poids, mensuration ou bien-être sur le widget | Même raison que PARTAGE-01/D7 : une donnée visible sur l'écran d'accueil du téléphone peut être vue par n'importe qui ayant l'appareil déverrouillé en main. Streak/séance du jour/kcal restantes sont déjà des données d'activité publiques (dashboard, carte de partage) |
| **D8** | Interaction | **V1 : un seul tap global**, ouvre l'app sur l'écran d'accueil (`(tabs)/index.tsx`) | La lib permet des zones cliquables distinctes par métrique (deep-link ciblé par zone), mais c'est un raffinement post-V1 — pas nécessaire pour valider l'usage de base |
| **D9** | Taille | **Une seule taille** au lancement (~4×2 cellules, équivalent des widgets `wide` in-app), pas de multi-layout | Réduit le travail de design/test du premier incrément ; Android autorise un redimensionnement dans une plage même avec un layout unique (`minWidth`/`minHeight` + `targetCellWidth`/`targetCellHeight`) |
| **D10** | Angle mort trouvé en relecture — démarrage sans session | **État de repli explicite**, jamais un crash ni une requête sur `userId` absent : si `powerSync.connect()` n'a jamais tourné sur cet appareil (app jamais ouverte) **ou** si la session est expirée/déconnectée au moment où le Headless JS Service se déclenche, le widget affiche un état neutre (« Ouvre l'app pour voir tes stats ») plutôt que d'interroger la base avec un `userId` vide | `powerSync.connect(connector)` n'est appelé que depuis `PowerSyncProvider.tsx` (composant React, jamais au niveau module) et `useAuthStore` s'hydrate de façon asynchrone au démarrage — un déclenchement du widget **avant** ce cycle (alarme périodique sur un appareil où l'app n'a jamais tourné, ou après une déconnexion) ne doit pas planter silencieusement |

## 3. Contenu affiché — 3 métriques, sources existantes

| Métrique | Source (déjà testée) | Calcul pour le widget (hors contexte hook) |
|---|---|---|
| **Streak** | `computeStreak`/`computeStreakWithJokers` (`packages/shared/src/streak.ts`, `streak-joker.ts`) | Requête `activeDayKeys` sur les mêmes tables que `useStreakData` (`workouts`, `runs`, `food_entries`/journal, `daily_steps`), puis appel direct à la fonction pure — identique au calcul du widget dashboard `StreakCard` |
| **Séance du jour** | Logique de `useTodaySession` (`dashboard-repository.ts`), requêtes `SELECT_TODAY_OCCURRENCES`/`SELECT_NEXT_UPCOMING` déjà exportées pour les tests | Rejouer les mêmes requêtes SQL (déjà nommées, déjà couvertes par des tests) via `powerSync.getAll()`, sans passer par le hook React. `useTodaySession(pillar)` est appelé par pilier : si musculation **et** running ont chacun une séance/course prévue le même jour, priorité **musculation > running** (même ordre déjà acté ailleurs — CLAUDE.md « ordre de build », repris tel quel par ACTIV-01/R7 — pas une préférence inventée pour l'occasion) |
| **Kcal restantes** | `tdee()`/`targetCalories()`/`dayCalorieBonus()`/`trainingDayCalories()` (`@wellness/shared`) + total du journal du jour | `effectiveTarget − kcal consommées aujourd'hui`, même soustraction que `NutritionSummaryCard`, recalculée depuis les mêmes tables |

**Aucune nouvelle brique de calcul** : ce tableau ne fait que rejouer, hors du contexte React, des
requêtes et fonctions pures qui existent et sont déjà testées. Le seul code réellement nouveau est
la **couche d'orchestration** (assembler les 3 métriques + résoudre l'i18n + appeler l'API de la lib
pour peindre le widget).

## 4. Mécanisme de mise à jour

1. **Périodique** : `updatePeriodMillis` (config plugin), plafonné à 30 min par l'OS — filet de
   sécurité, pas le mécanisme principal.
2. **Foreground/background de l'app** : à chaque passage de l'app au premier plan et à chaque
   fermeture, la tâche de mise à jour du widget est déclenchée (`requestWidgetUpdate`, JS).
3. **Après une action qui change une métrique affichée** : fin de séance (`workouts.finished_at`),
   fin de course (`runs.status = 'completed'`), ajout d'une entrée de journal, jour où le streak
   avance — mêmes points d'écriture déjà identifiés par le reste de l'app (comparables aux
   déclencheurs de notifications MUSC-F8).
4. **Tap sur le widget** (`WIDGET_CLICK`) : ouvre l'app **et** peut servir de point de
   rafraîchissement supplémentaire, gratuit.

## 5. Comportement offline

**Total** — comme tous les widgets dashboard : lecture 100 % locale (PowerSync/SQLite), aucun appel
réseau. Le widget peut afficher des données légèrement périmées si l'app n'a pas été ouverte
récemment et que le filet périodique de 30 min n'a pas encore tourné (contrainte OS, pas un défaut
applicatif) — jamais une valeur fausse, seulement une valeur pas encore rafraîchie.

## 6. Accessibilité — risque levé pendant l'implémentation

**Risque initial (§1 de la recherche technique) : résolu.** `react-native-android-widget` rend la
UI du widget en **bitmap**, mais expose bien un `accessibilityLabel` (`ClickActionProps`) posable
sur le composant racine — appliqué à **tout le widget**. `HomeWidget.tsx` construit une phrase
complète à partir des mêmes textes déjà résolus (« Série : 🔥 12 jours. Aujourd'hui : Full Body B
(Musculation). Restant : 1 240 kcal. »), lue d'un bloc par TalkBack. Aucun defect d'accessibilité
résiduel identifié pour cette US.

## 7. i18n

Nouvelle famille `homeWidget.*` (ou équivalent), FR + EN : libellés courts adaptés à un espace
contraint (« Série », « Aujourd'hui », « Restant »), réutilisation des chaînes de nombre déjà
formatées (`Intl.NumberFormat`, comme `StepsCard`/`StreakCard`). Résolution **avant** l'appel à la
lib (D4) — jamais de texte en dur dans la couche natif/config plugin.

## 8. Ce qui est explicitement hors périmètre (V1)

- **Personnalisation du contenu affiché** (choix des 3 métriques, thème visuel) — post-V1, comme
  pour la carte de partage (PARTAGE-01 hors périmètre équivalent).
- **Zones cliquables distinctes par métrique** (D8) — un seul tap global en V1.
- **Plusieurs tailles/layouts** (D9) — une seule taille au lancement.
- **`previewImage`** (aperçu visuel dans le sélecteur de widgets Android) — non fourni en V1,
  faute d'asset dédié ; Android affiche un repli générique. Ajout trivial plus tard (config
  plugin déjà prêt à le recevoir).
- **Séance du jour simplifiée** (implémentation) : contrairement à `useTodaySession`, ne
  distingue pas une séance déjà **en cours** (`useActiveWorkout`) ni les replis riches (déjà
  faite / prochaine à venir) — seulement « prévue aujourd'hui » ou « repos ».
- **Kcal restantes sans bonus jour d'entraînement** (implémentation) : utilise l'objectif de
  **base** (TDEE + objectif), sans le bonus de `useDayCalorieTarget` — sous-estime le restant les
  jours de séance, jamais un sur-estimé. Évite de dupliquer toute la chaîne
  profil/activité/courses du jour pour un gain marginal sur un widget « en un coup d'œil ».
- **Description du sélecteur de widgets non traduite** (implémentation) : le config plugin
  écrit une seule chaîne (`translatable: 'false'`), en français, quel que soit l'appareil — les
  **textes du widget lui-même** (D4) restent, eux, entièrement FR/EN.
- **iOS** : les widgets iOS (WidgetKit) sont une technologie et un code totalement différents —
  hors périmètre de lancement (décision E, Android d'abord).
- **Widget de séance en cours** (affichage live pendant un entraînement/une course) — distinct,
  candidat pour une US séparée si retenu plus tard.

## 9. Second build requis

`react-native-android-widget` est une **dépendance native neuve** : comme `react-native-view-shot`
(PARTAGE-01), `expo-haptics` (MUSC-F9) et `expo-speech` (RUN-F2a) avant elle, le dev client **et**
l'APK doivent être reconstruits avant toute recette. Coût déjà connu et documenté dans ce dépôt —
pas une surprise de calendrier cette fois.

## 10. Critères de recette

- [ ] 1. Le widget est ajoutable depuis le sélecteur de widgets du launcher Android (preview,
      nom, description conformes à la config).
- [ ] 2. Affiche la série (streak), la séance du jour (ou son absence) et les kcal restantes,
      cohérents avec ce qu'affiche l'app au même moment.
- [ ] 3. **Un pilier désactivé** (ex. nutrition) fait disparaître sa métrique du widget, sans
      trou visuel — jamais un widget à moitié vide.
- [ ] 4. **Aucun pilier actif** : seul le streak reste affiché.
- [ ] 5. Terminer une séance/course puis revenir à l'écran d'accueil du téléphone : le widget
      reflète le changement (au pire après le prochain foreground/background de l'app).
- [ ] 6. Mode avion : le widget continue d'afficher les données locales, sans erreur ni blocage.
- [ ] 7. Tap sur le widget : ouvre l'app sur l'écran d'accueil.
- [ ] 8. En **EN** : tous les libellés du widget sont en anglais.
- [ ] 9. **TalkBack annonce un contenu textuel cohérent** (voir §6 — à confirmer que ce n'est pas
      un bitmap muet).
- [ ] 10. Widget redimensionné par l'utilisateur (si le launcher le permet) : reste lisible, pas
      de texte tronqué de façon illisible.
- [ ] 11. Suppression du widget puis ré-ajout : réapparaît avec des données à jour, sans crash.
- [ ] 12. **Déconnexion** puis déclenchement du widget (attendre le rafraîchissement périodique ou
      forcer une mise à jour) : état neutre affiché (D10), pas de crash ni de requête sur un
      `userId` vide.
