---
id: DASH-01
titre: "Dashboards immersifs — une atmosphère par pilier, des écrans vivants, une app qui comprend"
roadmap: [7.29]
catalogue: []
etape: recette
branche: feature/dash01-dashboards-immersifs
maj: 13/09/2026
---

# US DASH-01 — Dashboards immersifs

> **Maquettes** : [design/dash-immersifs-2026-09/](../../../../design/dash-immersifs-2026-09/) — 19 planches
> sur 3 pages (V1 l'atmosphère · V2 vivant & rétention · V3 l'app qui comprend), dont **8 téléphones
> interactifs**. Canvas en ligne : l'artefact « Dashboards immersifs ».
> **Plan** : [docs/plans/dash01-dashboards-immersifs.md](../../../plans/dash01-dashboards-immersifs.md).
> **Validation** : Florian, 13/09/2026 — maquettes validées (« c'est vraiment bien »), puis **GO pour
> tout livrer en une seule vague**, recette finale unique.

## 0. Contexte — le même écran, quatre fois

Les quatre dashboards (accueil, muscu, course, nutrition) enchaînaient la même séquence : en-tête,
carte d'action, bande, grille de tuiles, pied. ADR-007 mesure **47 % de remplissage moyen** des
widgets d'accueil après INSIGHTS-02 : « moins de widgets *et* moins d'information, sur la même
surface ». Les couleurs de pilier existaient (`DEFAULT_MENU_COLORS`) mais derrière un réglage éteint
qui ne teintait que l'icône d'onglet ; et **treize briques de rétention codées** (score de forme,
check-in, joker, bilan hebdo, objectifs, records par plage, projection SBD, régularité, prédictions
Riegel, horaire de séance, charge, suggestion d'aliment, mode vie réelle) n'apparaissaient sur aucun
dashboard.

MOTION-01 (3.60, en recette) a posé le socle d'animation : jetons, `useAppReducedMotion`,
`AnimatedNumber`, `AnimatedBar`, `Breathe`, `StaggerIn`, `PressableScale`. **Cette US s'appuie
dessus et n'écrit pas de second système de mouvement.**

## 1. Décisions actées (Florian, 13/09/2026)

| # | Décision | Motif |
|---|---|---|
| D1 | **Tout en une vague**, avant la publication Play Store, recette finale unique. | Choix de Florian. |
| D2 | **La scène se replie au défilement** (en-tête compact qui apparaît quand la scène sort de l'écran). **Ce n'est pas la parallaxe** exclue par MOTION-01 §5 : le contenu défile à 1:1, rien de ce qu'on lit ne se déplace à une autre vitesse. | Libère la place des données sans perdre le contexte. ⚠️ **Retiré le 23/09/2026** (recette MUSCU-UX06, décision Florian) : le bandeau opaque « super moche » disparaît des quatre écrans, le corps défile sous la barre d'état transparente. |
| D3 | **Pas de pastille d'onglet glissante ni de couleur qui déborde en plein écran.** L'arrivée sur un pilier passe par sa scène. | MOTION-01 §4.6 (reconstruction de la barre d'onglets) ; le flash plein écran se lisait comme un bug. |
| D4 | **Hub muscu en dernier** dans l'ordre de build (conflit avec `feature/corps02-morphologie`, qui touche `strength.tsx`). | Réduire le conflit de fusion. |
| D5 | **Les fonctions IA sont livrées avant la publication, désactivées par défaut** : consentement explicite séparé, quotas et plafond côté serveur, dégradation complète sans elles. | Choix de Florian (réserve formulée : fiche « Sécurité des données » à mettre à jour, voir §8). |
| D6 | **Correctif du « bug visuel » à l'arrivée sur la muscu** : l'impact ne boucle plus ; il joue **une fois** à l'arrivée sur l'écran. | Retour de Florian sur la maquette : le double clignotement en boucle ressemblait à un néon qui grésille. |

## 2. Règles métier — les invariants

- **R1 — Le mouvement ne porte aucune information.** Animations coupées (système ou réglage
  « Animations »), chaque écran affiche la même chose, à sa valeur finale.
- **R2 — Un seul élément vivant au repos** : la matière de la scène. Tout autre mouvement répond à un
  geste ou à un changement de donnée, puis s'arrête.
- **R3 — Aucun `setState` par image.** Toute animation continue tourne sur le thread UI (Reanimated).
- **R4 — Les boucles s'arrêtent** dès que l'écran perd le focus ou que l'app passe en arrière-plan.
- **R5 — Aucun chiffre affiché n'est produit par un modèle d'IA.** Les chiffres sortent de fonctions
  de `@wellness/shared` ; le modèle traduit une question en paramètres ou choisit une formulation.
- **R6 — Hors ligne, l'écran reste entier.** Les fonctions IA disparaissent proprement ; la photo de
  repas est gardée en file d'attente.
- **R7 — Rien n'entre au journal sans validation explicite** (photo, suggestion, réponse).
- **R8 — Aucune culpabilité.** Un retour après absence n'affiche jamais « série : 0 ».
- **R9 — Le joker reste un filet** (STREAK-01) : un par mois, jour isolé, rattrapable 7 jours.
- **R10 — Contraste WCAG AA dans les deux thèmes.** Chaque couleur de pilier a une variante sombre
  (muscu `#e07a98` 5,16:1 · course `#6fa8ef` 5,94:1 · nutrition `#a9ba7e` 6,98:1 sur surface sombre ;
  le bordeaux `#6b0028` tombait à 1,15:1).
- **R11 — Plafonds de widgets inchangés** (8 / 3 / 4, ADR-007). Les nouvelles zones sont épinglées
  hors grille ; la personnalisation de la grille survit telle quelle.
- **R12 — Contestable, jamais sur un garde-fou.** « Ce n'est pas ça » baisse le poids d'une règle
  pour l'utilisateur ; les garde-fous de sécurité (surcharge, douleur) restent actifs.

## 3. Le socle

- **Couleur de pilier toujours présente dans la scène et l'onglet actif**, indépendante du réglage
  « couleur par menu » (qui continue de piloter l'accent global). Jetons `pillar*` dans la palette,
  variantes sombres (R10).
- **La scène** (`PillarStage`) : pleine largeur, sous la barre d'état, coins bas arrondis, dégradé
  propre au pilier, un emplacement « matière ».
- **Quatre matières**, une physique chacune (MOTION-01) : anneaux qui respirent (accueil), silhouette
  et impact unique (muscu), trace parcourue en boucle (course), niveau qui monte sans dépassement
  (nutrition).
- **Repli au défilement** (D2) et **arrivée** : à chaque prise de focus, le contenu de la scène entre
  en fondu court (`DURATION.base`).

## 4. Écran par écran

### 4.1 Accueil — le souffle

**Scène**, selon le moment (fonction pure `resolveHomeMoment`) :

| Moment | Condition | Contenu |
|---|---|---|
| Matin | avant 11 h, check-in du jour absent | Check-in d'énergie en 5 pastilles (écrit via `saveWellbeing`) ; verdict TRI-03 affiché dès qu'il existe ; action du moment (`useNowAction`). |
| Soir, série en danger | à partir de 18 h (ou de l'heure de rappel si plus tardive), aucune activité aujourd'hui, série ≥ 1 | Série, temps restant jusqu'à minuit, action courte ; état du joker du mois (restant ou déjà utilisé). |
| Retour | aucune activité depuis ≥ 7 jours et historique existant | « Content de te revoir », meilleure série, proposition de reprise en douceur (`startRealLifePeriod`, VIE-01) ou plan normal. |
| Journée | sinon | Anneaux de la semaine par pilier actif, série, action du moment. |

**Corps** : « Depuis ta dernière visite » (instantané local, §4.5) · brief du matin (§6.2) · objectif à
échéance le plus proche (OBJ-01) · bilan de la semaine en cartes (BILAN-01, les deux premiers jours
de la semaine) · « Demande-moi » (§7) · actions rapides · grille personnalisable · la suite.

**Cas limites** : piliers désactivés → leurs anneaux et lignes disparaissent (décision H) ; aucune
donnée de semaine → anneaux vides sans pourcentage ; check-in hors fenêtre → pastilles masquées.

### 4.2 Nutrition — le remplissage

**Scène** : niveau = consommé / cible du jour affiché, plafonné au filet de cible (jamais de
débordement ; au-delà, texte « cible atteinte · +N kcal ») ; **7 verres** = les 7 derniers jours
(`useDailyTotals`), un tap change le jour affiché ; ajout rapide des 3 meilleurs candidats NUTR-F2
(portion par défaut, entrée réelle via `addFoodEntry`) ; photo du repas (§7.2) ; recherche.
**Brouillard de confiance** : si des jours de la semaine n'ont aucune saisie, la jauge du jour passé
concerné est dessinée en pointillé et la phrase nomme le jour manquant.

**Corps** : le journal existant (repas, hydratation, micros, qualité) inchangé fonctionnellement.

### 4.3 Course — le flux

**Scène**, 4 états de `resolveRunHubState` conservés + un moment « arrivée » (sortie terminée
aujourd'hui) : distance, allure cible, compte à rebours réel si la séance planifiée a une heure
(HORAIRE-01), trace animée ; à l'arrivée, distance qui roule, allure, écart de prédiction 10 km.

**Corps** : km par km de la dernière sortie (`computeKmSplits`, un tap par kilomètre, écart à la
cible) · chronos prédits (`resolveRacePredictions` + objectif) · ma semaine · charge (ratio
GARDE-01) · profil / programmes / historique · grille.

### 4.4 Musculation — l'impact

**Scène** : 4 états de `StrengthNowCard` conservés (reprendre / séance du jour / libre / démarrer un
programme), semaine du programme, **record à portée** du jour (§ fonction `nearRecords`) ; moment
« après la séance » (séance terminée aujourd'hui) : tonnage qui roule, record battu, partage.

**Corps** : semaine touchable séance par séance · à ta portée (3 exercices) · « Et si… » (§6.3) ·
régularité · barre de programme · annuaire · grille.

### 4.5 Depuis ta dernière visite

Instantané **local** (préférence d'appareil, comme « Animations ») pris à chaque visite : poids,
nombre de records, meilleure prédiction 10 km. À la visite suivante, seuls les écarts non nuls
s'affichent (`computeSinceLastVisit`). Premier lancement : bloc absent.

## 5. Rétention — mesure

Trois événements analytiques ajoutés : `home_checkin_done`, `weekly_recap_card`,
`streak_saved_evening` ; plus `ai_photo_used` et `ai_ask_used`. Ils se lisent contre la rétention W1 /
W4 de [metriques-succes.md](../../../product/metriques-succes.md).

## 6. L'app qui comprend — sans IA

### 6.1 « Pourquoi ? »

Sur les chiffres calculés (verdict de forme, projection SBD, prédiction de course, cible calorique) :
une feuille montre les étapes du calcul (fonctions `explain*` pures), les données utilisées et un
niveau de confiance. « Ce n'est pas ça » enregistre un poids de règle **local** (R12).

### 6.2 Brief du matin

Trois phrases au plus, construites à partir de clés i18n et de faits calculés (`buildMorningBrief`) ;
lecture vocale locale (`expo-speech`, déjà installé) ; la transcription s'allume au rythme de la
lecture. Sans réseau, sans consentement.

### 6.3 « Et si… »

Leviers : séances par semaine, sommeil, protéines. Moteur **déterministe** (`projectWhatIf`) bâti sur
la pente de `projectSbd` ; fourchette d'incertitude qui s'élargit avec la surcharge ; conséquences sur
la course (charge estimée) et la nutrition (cible). Sans historique suffisant (< 56 jours, < points
minimum) : état « pas encore assez de données », aucun chiffre.

## 7. L'app qui comprend — avec IA (surface RETIRÉE du build de lancement)

> 🔴 **Décision de Florian, 13/09/2026, après livraison.** La surface IA est **retirée du build de
> lancement** : l'app est **gratuite en V1**, et `docs/product/ia-integration-analyse.md`
> (15/07/2026) plaçait l'IA en **palier payant, post-V1**, avec une règle d'or — « le prix du palier
> doit couvrir le coût IA du user le plus actif ». La livrer gratuite revenait à payer le modèle
> pour tout le monde, sans palier pour l'absorber. **C'est un manquement de cadrage de ma part** :
> l'écart au phasage de juillet aurait dû être posé comme une question avant d'être construit, pas
> noté en §9.
>
> **Ce qui est retiré de l'app** : l'écran `meal-photo` et son entrée depuis la scène nutrition, la
> section « Assistant IA » des Réglages, la reformulation de « Demande-moi », et leur plomberie
> cliente (`ai-client`, `useAiAvailability`, `ai-photo-queue-store`, `useFoodsByNames`, les deux
> événements d'analytics `ai_photo_used` / `ai_ask_used`, les blocs i18n `ai` et `mealPhoto`).
>
> **Ce qui reste, dormant** : la migration (déjà appliquée sur le cloud), la fonction Edge
> `supabase/functions/ai-assist`, la brique pure `ai-assist.ts` (le contrat de validation des
> réponses), et `user_settings.ai_consent_at` déclarée côté client — le schéma local est le miroir
> de la base, le faire diverger rouvrirait la panne silencieuse de CYCLE-01.
>
> **« Demande-moi » (§7.3) est conservée**, dans sa version déterministe : c'est précisément
> l'inversion d'origine qui le permet — le modèle ne produisait qu'une **formulation**, jamais un
> chiffre. La carte répond exactement comme avant.
>
> La description ci-dessous décrit donc **la plomberie en place**, pas ce que l'app expose
> aujourd'hui. Elle est conservée pour le jour où le palier payant existera.

### 7.1 Architecture

- **Serveur** : Supabase Edge Function `ai-assist`. La clé du fournisseur vit dans les secrets du
  projet, **jamais dans l'app**. Vérifie le JWT, le **consentement** (`user_settings.ai_consent_at`),
  un **quota quotidien** par utilisateur (table `ai_usage`), puis appelle le modèle.
- **Consentement** : opt-in dans Réglages → Assistant IA, texte explicite de ce qui est envoyé.
  Révocable à tout moment.
- **Minimisation** : seules les données nécessaires à la question partent (agrégats, jamais
  l'historique brut) ; la photo n'est pas conservée côté serveur.

### 7.2 Photo du repas

Capture (`expo-camera`) → le modèle renvoie des aliments, des grammes estimés et une confiance → le
client les **rapproche du catalogue d'aliments** et calcule les calories (R5) → l'utilisateur ajuste
les portions (la moins sûre est signalée) → ajout au repas choisi (R7). Hors ligne : photo gardée,
analysée au retour du réseau, proposée à valider.

### 7.3 Demande-moi

Trois questions du moment. Pour chacune, **le client calcule d'abord la réponse déterministe**
(options, verdict, pistes) ; le modèle, s'il est disponible, ne fait que la formuler. Sans IA, la même
carte s'affiche avec une formulation par clés i18n. Chaque réponse montre ses sources et accepte
« Ce n'est pas ça ».

## 8. Contraintes

- **Offline-first** : aucune donnée métier nouvelle ; instantanés et poids de règles en local.
- **Migrations** : 1 migration — `user_settings.ai_consent_at` + table `ai_usage` (service role
  uniquement). `user_settings` est synchronisé en `select *` : **vérifier dans le dashboard PowerSync
  que la nouvelle colonne remonte** (redéploiement des sync rules si besoin).
- **i18n** : toutes les chaînes FR + EN, y compris les phrases du brief et les formulations de repli.
- **Accessibilité** : R1, R10 ; le brief lu et la transcription visible sont équivalents.
- **Dépendances natives** : **aucune nouvelle**.
- **Play Store** : ✅ **plus rien à déclarer** depuis le retrait de la surface (13/09/2026) — l'app
  n'envoie aucune photo ni agrégat de santé à un tiers. La déclaration « Sécurité des données »
  redeviendra nécessaire le jour où la surface revient.
- **Secrets** : ⛔ **plus nécessaire**. La clé du fournisseur n'est pas posée, et la fonction Edge
  n'est pas déployée — donc rien n'est facturé. Le jour où la surface revient :
  `supabase secrets set ANTHROPIC_API_KEY=…` puis `supabase functions deploy ai-assist`.

## 9. Hors périmètre

Dictée vocale (module natif), parallaxe au gyroscope (module natif), pastille d'onglet glissante et
couleur plein écran (D3), abonnement premium (RevenueCat inactif — les quotas en tiennent lieu),
mascotte ou avatar, conseil médical.

## 10. Critères d'acceptation

Détaillés et cochables dans [RECETTES.md](../../../../RECETTES.md) §62.
