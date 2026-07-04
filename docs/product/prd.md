# PRD — V1 (Musculation · Running · Nutrition)

> **Product Requirements Document** de la V1. Décrit **quoi** on construit et **pourquoi**. Le **comment** (modèle de données, contrats d'API, architecture) vit dans les specs techniques (`../specs/technical/`) et les ADR (`../adr/`).
> Le détail fonctionnel de chaque pilier vit dans `../specs/functional/`.
> Sources : [../../SYNTHESE-CADRAGE.md](../../SYNTHESE-CADRAGE.md) (décisions) · [vision.md](./vision.md) · [personas.md](./personas.md) · PRD muscu initial de Flo · CDC par pilier de Dams.
> Statut : **Brouillon issu de la fusion** · Date : 04/07/2026.

---

## 1. Résumé exécutif

La V1 est une app mobile de suivi bien-être **tout-en-un** couvrant **trois piliers interconnectés — musculation, running, nutrition**. Chaque pilier est un **tracker autonome de qualité**, utile seul ; leur **intégration** (données croisées, planning unifié, progression globale) est la vraie proposition de valeur, posée en couche opt-in par-dessus.

L'app fonctionne **hors-ligne** (réalité terrain : réseau souvent absent en salle), est conçue pour le **pratiquant assidu** (intermédiaire à avancé) tout en restant **accessible au débutant**, et se lance **en Android d'abord**, **bilingue FR + EN**, **entièrement gratuite** (monétisation câblée mais inactive).

La V1 se livre **par versions successives** (V0.1 → V1.1) : chaque version produit un build installable, testable avec de vrais utilisateurs, sans attendre que les trois piliers soient finis.

---

## 2. Problème & opportunité

**Problème utilisateur.** Le pratiquant régulier jongle avec des apps cloisonnées : un tracker de séances (Hevy, Strong…), une app nutrition (MyFitnessPal…), une app running (Strava…). Ces silos ne communiquent pas → aucune vue d'ensemble, aucune optimisation croisée (les calories ignorent le volume d'entraînement, les plannings se chevauchent), et une lassitude à ressaisir les mêmes données partout.

**Opportunité.** Construire le **hub unique** où les trois piliers vivent au même endroit et **se parlent**. C'est un créneau que les leaders, chacun spécialisé sur un pilier, ne couvrent pas.

**Réalité concurrentielle assumée.** Pris pilier par pilier, chaque marché est saturé (trackers muscu, apps GPS, apps nutrition). On ne gagne donc **pas** sur « être le seul » sur un pilier, mais sur **la qualité de chaque tracker** + **leur intégration** + **la motivation durable**. Risque à surveiller : ne pas livrer « juste un Hevy / un Strava / un MyFitnessPal de plus » sans le liant.

---

## 3. Proposition de valeur & différenciation

> **« Tout au même endroit, interconnecté — sans jamais rien t'imposer. »**

- **Valeur n°1** : l'**intégration** des trois piliers (données croisées, planning unifié, progression globale).
- **Principe directeur** : *intégration sans imposition* — chaque pilier est utile seul ; l'intégration est une couche **opt-in** par-dessus (voir [vision.md](./vision.md)).
- **Différenciation au lancement** : profondeur de chaque tracker + le liant inter-piliers + motivation (streak / records / célébrations), le tout **hors-ligne** et **fiable**.

Positionnement face aux concurrents (Strava / MyFitnessPal / Strong-Hevy) : détaillé dans [vision.md](./vision.md#positionnement).

---

## 4. Périmètre V1

Trois piliers, plus un socle transverse. Détail fonctionnel exhaustif dans `../specs/functional/`.

### Pilier Musculation → `../specs/functional/musculation.md`
Compte & synchro · onboarding minimal · bibliothèque d'exercices (préchargée + custom, groupes musculaires, équipement) · templates/programmes et séance à blanc · logging live (poids × reps, RPE optionnel, types de séries : normale, échauffement, dropset, superset, échec, durée, poids de corps ± lest) · timer de repos configurable · historique éditable · records auto (meilleur poids, 1RM Epley, volume, PR par plage de reps) · courbes d'évolution · volume par groupe musculaire · surcharge progressive assistée · deload · notes de séance et par exercice · mesures corporelles et photos de progression · graphiques avancés.

### Pilier Running → `../specs/functional/running.md`
Profil coureur (objectif, niveau, allure de référence, fréquence) · programmes (bibliothèque + custom) · types de séance (endurance fondamentale, fractionné/VMA, sortie longue, récupération active, course libre) · suivi GPS temps réel (distance, allure instantanée/moyenne, carte en direct) · guidage fractionné (annonce vocale + vibration) · annonces audio périodiques · auto-pause · contrôle écran verrouillé (notification persistante Android) · mode manuel de repli si pas de GPS · résumé post-séance (tracé, dénivelé, pace/km, records) · historique + statistiques · évolution de l'allure · records d'allure auto-détectés (segment glissant) · export GPX.

### Pilier Nutrition → `../specs/functional/alimentation.md`
Profil nutritionnel (objectif, restrictions/allergènes) · calcul TDEE (Mifflin-St Jeor) + facteur d'activité + ajustement selon le planning d'entraînement · répartition macros (défaut par objectif, éditable) · base d'aliments (vérifiée + custom + OpenFoodFacts par scan de code-barres) · journal quotidien (4 repas par défaut, personnalisables) · portions usuelles · quick add · copie/duplication de repas et de journée · saisie par liste en langage naturel (hors-ligne, avec écran de revue) · recettes et repas types · planning repas à la semaine · liste de courses générée · suivi du poids et évolution des apports.

### Socle transverse → `../specs/functional/compte-profil-onboarding.md`, `../specs/functional/navigation-ux.md`
Auth Supabase (email/mot de passe + Google ; **pas** OAuth Apple en V1) · onboarding minimal par défaut + parcours guidé 5 étapes optionnel et skippable · profil et paramètres (unités kg/lb, langue FR/EN, notifications, thème) · streak + records + notifications de célébration · import GPX/CSV (Strava, Hevy, Strong, MyFitnessPal) · export des données · planning unifié muscu + running (détection des chevauchements) · analyses croisées opt-in (calories ↔ entraînement).

### Administration → `../specs/functional/administration.md`
Back-office web (repris de Dams) : CRUD exercices / programmes / aliments, gestion des rôles, modération du contenu contributif, gestion du contenu éditorial **bilingue FR + EN**.

---

## 5. Hors périmètre

Voir la liste complète et motivée dans [vision.md](./vision.md#hors-périmètre). En résumé :

- **Gamification complète** (boucle jeu / RPG) → V3/V4 (on garde streak + records + notifications).
- **iOS, OAuth Apple, publication App Store** → plus tard (Android d'abord, libs cross-platform).
- **Social** (feed, follows, kudos) → V2.
- **Wearables / zones cardio FC** → V2 (allures seules en V1).
- **Hydratation** → V2.
- **Sync continue Strava/Garmin** → post-V1 (import GPX/CSV en V1).
- **IA** (programmes assistés, désambiguïsation avancée du langage naturel) → plus tard.
- **Animations 3D** → hors périmètre (GIF en V1).
- **Aucun paywall / palier payant** en V1.

---

## 6. Parcours utilisateur clés (happy paths)

### Transverse — Premier lancement
Inscription (email/mot de passe ou Google) → **entrée directe** dans l'app (onboarding guidé proposé mais skippable via « Passer ») → tableau de bord → l'utilisateur active le(s) pilier(s) qu'il veut.

### Musculation
1. **Première séance** : démarrage d'une séance à blanc → ajout d'exercices depuis la bibliothèque → log des séries (poids × reps) → fin de séance → célébration (1ʳᵉ séance).
2. **Séance récurrente** : démarrage depuis un template → log série par série avec timer de repos → PR détecté et célébré → synchro au retour du réseau.
3. **Progression** : consultation de l'historique / d'un exercice → courbes et records → suggestion de surcharge progressive pour la prochaine fois.

### Running
1. **Sortie libre** : démarrage GPS + chrono → écran de suivi temps réel (distance, allure) → annonces audio au km → fin → résumé (tracé, allure moyenne, records) → enregistrement.
2. **Séance planifiée (fractionné)** : ouverture de la séance du programme → démarrage → guidage vocal aux changements de bloc → résumé comparé à l'objectif → mise à jour de l'allure de référence si record 5 km.
3. **Repli sans GPS** : mode manuel (durée saisie, distance optionnelle) → compte pour le streak et les statistiques, exclu des records d'allure.

### Nutrition
1. **Journée type** : ouverture du journal → ajout d'aliments par recherche/scan (portion par défaut) → total du jour vs objectif (calories restantes, barres de macros).
2. **Saisie rapide** : saisie par liste en langage naturel (« 1 banane avec 4 tranches de pain de mie et du beurre de cacahuète ») → écran de revue → confirmation → ajout au journal.
3. **Réutilisation** : « même petit-déj qu'hier » (copie de repas) ou ajout d'un repas type en 1 tap.

### Intégration (opt-in)
Un jour d'entraînement (muscu ou running) planifié → objectif calorique du jour ajusté automatiquement dans le journal → vue croisée « séances vs apports » sur la semaine, avec alerte si déficit sur une semaine à fort volume.

---

## 7. Exigences non-fonctionnelles

- **Offline-first complet (non négociable, via PowerSync).** Logging de séance, consultation de l'historique, création de templates, journal alimentaire, suivi GPS : **tout fonctionne sans réseau** ; synchro Supabase **en arrière-plan** au retour du réseau, **gestion de conflits incluse**. Moteur retenu : **PowerSync** (SQLite local + synchro bidirectionnelle managée), à confirmer par spike (repli : Legend-State puis WatermelonDB). Conséquence : **dev build Expo obligatoire** dès le départ. C'est une exigence **structurante** du modèle de données et de l'ordre de build. Voir [../../SYNTHESE-CADRAGE.md](../../SYNTHESE-CADRAGE.md) §B.
- **Performance.** Fluidité pendant la séance (saisie rapide, aucune latence réseau bloquante). Le suivi GPS running doit tenir **écran verrouillé** et gérer les traces volumineuses (point de vigilance PowerSync à valider).
- **Internationalisation — FR + EN dès le lancement.** i18n câblé dès le départ (aucune chaîne en dur) **et** contenu bilingue : UI, contenu éditorial (exercices, programmes) et bases de données (ex. traduction EN des aliments d'origine FR). À intégrer dans la charge de chaque version, pas en fin de projet.
- **Plateforme — Android d'abord.** iOS plus tard ; rester sur des libs cross-platform pour ne pas fermer la porte. Pas de compte Apple Developer requis au lancement.
- **Fiabilité des données.** Aucune perte de séance / de repas / de sortie ; écriture locale immédiate, synchro résiliente.
- **Sécurité & confidentialité.** Isolation par utilisateur via **Row-Level Security** (RLS) Supabase ; données personnelles (poids, photos, traces GPS) protégées ; **Storage privé** pour les photos de progression. Âge minimum 16 ans (déclaratif, RGPD), CGU + politique de confidentialité acceptées à l'inscription.
- **Stack imposée.** React Native + Expo + TypeScript · Supabase (Postgres, Auth, Storage, RLS) · PowerSync · RevenueCat (câblé) · monorepo modulaire (feature-modules front, monolithe modulaire back).

---

## 8. Monétisation

**RevenueCat est la solution retenue, mais aucune monétisation n'est active en V1 : l'app est entièrement gratuite au lancement.**

- **Aucun paywall, aucun palier payant** n'est présenté à l'utilisateur en V1.
- Les **entitlements RevenueCat sont câblés tôt** dans l'architecture : c'est peu coûteux et cela évite une refonte le jour où la monétisation sera activée. Mais **rien n'est activé commercialement**.
- La monétisation viendra **bien plus tard**, à rediscuter le moment venu (grille de prix, paliers). Les pistes évoquées lors du cadrage (freemium généreux, paliers Premium → Écosystème → IA) sont conservées **pour mémoire uniquement**, non engageantes.

Conséquence produit : toutes les fonctionnalités de la V1 sont **accessibles gratuitement**. On ne bride pas la profondeur ni l'intégration au lancement.

---

## 9. Roadmap post-V1

Ordre indicatif, à ajuster selon les métriques (voir [metriques-succes.md](./metriques-succes.md)) :

1. **V2** — Couche sociale (feed, follows, kudos, scopée fitness/course) · wearables + zones cardio FC · suivi de l'hydratation · sync continue Strava/Garmin.
2. **iOS** — connexion Apple, publication App Store (à planifier indépendamment).
3. **Activation de la monétisation** — grille de prix, paliers, offre de lancement (le câblage RevenueCat est déjà en place).
4. **V3/V4** — Gamification complète (boucle activité → énergie → exploration) si la rétention le justifie ; l'historique horodaté sert déjà de journal d'événements pour cette future couche.
5. **IA** — programmes/plans assistés, meilleure désambiguïsation de la saisie langage naturel.

---

## 10. Questions ouvertes

- **Nom du produit** (candidats : Atlas, Orbit…) — non bloquant pour le build.
- **Spike PowerSync** : confirmer le moteur de synchro avant de figer le modèle de données (comportement sur les traces GPS volumineuses en particulier).
- **Interprétation en ligne de la saisie par liste** (nutrition) : garder ou non une amélioration optionnelle via service en ligne — la saisie de base doit rester 100 % hors-ligne, sans dépendance réseau obligatoire.
- **Détails d'UX fins** à préciser en specs fonctionnelles : ergonomie exacte de l'écran de logging muscu, comportement précis du timer de repos, liste initiale d'exercices/programmes/aliments préchargés, contenu éditorial bilingue à produire avant lancement.
