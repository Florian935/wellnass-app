# Prisme — l'assistant IA du Labo : marché, minimum à aligner, tests gratuits

Date : 02/10/2026. Statut : **analyse tranchée** — décisions D1 à D7 prises par Florian le jour même
(§9). Première US issue de l'analyse : [PRISME-01](../specs/functional/us/prisme01-prisme-raconte.md),
validée le 03/10/2026 ; suites au BACKLOG : PRISME-01b, PRISME-02, ACCES-IA.

Demande (Florian, 02/10/2026) : « un peu toutes les applications concurrentes ont de l'IA
maintenant ; on commence à s'y mettre, avec des IA à usage gratuit ». Une analyse de l'app entière
(tous les piliers, les croisements) face au marché : ce qu'on doit aligner a minima, où, gratuit ou
payant ; un nom pour l'assistant qu'on retrouve dans le Labo, avec qui on parle, qui analyse les
piliers et fait les bilans du jour et de la semaine.

- **Compte rendu en ligne** (privé, à partager depuis son menu Partager), avec une **maquette
  jouable** de l'assistant dans le Labo : https://claude.ai/artifact/2zptc9GuNxMTvxWJm8nioj
- **Fondations** : [ia-integration-analyse.md](ia-integration-analyse.md) (coûts, architecture, §7
  « tester en gratuit »), [analyse-innovation-2026-09.md](analyse-innovation-2026-09.md) (les trois
  règles), [analyse-labo-2026-09.md](analyse-labo-2026-09.md).

---

## 1. Ce que l'app sait déjà faire — sans IA

L'IA n'a pas à être le cerveau : l'app calcule déjà beaucoup, sur le téléphone et hors ligne. Elle
peut être **la voix et l'oreille** d'un cerveau qui existe.

| Pilier | Ce qui existe | L'intelligence déjà calculée |
|---|---|---|
| Musculation | séance classique et immersive, programmes, planning, hub trois onglets | progression et décharge, substitution, prévu / réalisé, module force, records par plage |
| Course | GPS, fractionné guidé à la voix, Fantôme, meilleurs efforts | Riegel, ACWR, courbe d'allure, cible en direct |
| Nutrition | journal, code-barres, CIQUAL, planning repas et courses | cible qui suit la dépense réelle, Réservoir, glucides péri-séance, suggestion d'aliments |
| Bien-être | check-in matin et soir, nuit Health Connect, modules | la boucle, « Ce qui compte », garde-fou « humeur basse » |
| Socle | silhouette, mensurations, cycle, douleurs, objectifs, autres activités | score de forme, garde-fou charge, collisions, mode vie réelle |
| Labo | Croiser, Composer, Apprendre, registre des liens, échos, Conseil | enquêtes, expériences N=1, compromis chiffrés |
| Accueil et bilans | brief du matin lu, « Demande-moi », Insights, bilan hebdo | tout déterministe, en clés i18n |

**Les briques IA déjà posées** : la fonction Edge `ai-assist` (quatre gardes : JWT, consentement,
quota, taille ; aucun contenu conservé ; fournisseur = réglage, Gemini ou Anthropic), le Labo IA
(IA-LAB-01, données factices), le garde-fou des nombres de NARR-01 (tout nombre absent du dossier
fait jeter le résumé), CONS-01 qui le réutilise, et la photo de repas — prête côté serveur, retirée
de l'app le 13/09/2026. **Sans IA**, la saisie d'un repas en phrase existe aussi (4.5,
`meal-quick-entry`) : un analyseur de règles FR + EN, hors ligne.

⚠️ **Constaté à la relecture** : NARR-01 et CONS-01 envoient déjà le **vrai** dossier du Labo de
l'utilisateur (qui peut contenir sa durée de sommeil) par le type `coach`, sous l'accord du Labo IA —
dont le texte dit « à n'activer que sur des données factices ». Limité aux comptes qui ont activé le
Labo IA ; question Q1 de [PRISME-01](../specs/functional/us/prisme01-prisme-raconte.md).

**Ce qui manque** : un adaptateur pour les fournisseurs compatibles OpenAI (Mistral, Groq,
OpenRouter, Cerebras), un verrou qui empêche de vraies données de partir chez un fournisseur qui
entraîne, la conversation sur plusieurs tours, la mémoire, un bilan du soir, un recours quand la saisie
en phrase ne comprend pas, et surtout **une surface pour l'utilisateur final**.

## 2. Le marché, octobre 2026

| App | Son IA | Accès | Prix (USD sauf mention) |
|---|---|---|---|
| MyFitnessPal | coach conversationnel sur l'historique des repas, Meal Scan (moteur de Cal AI, racheté), voix | Premium + AI | 19,99/mois · 79,99/an |
| Google Health (ex-Fitbit) | coach Gemini, plans adaptatifs, saisie texte / photo / voix | Premium | 9,99/mois · 99,99/an |
| Strava | résumés Athlete Intelligence ; connecteur MCP vers Claude, lecture seule (06/2026) | abonnés | 11,99/mois · 79,99/an |
| Garmin Connect+ | Active Intelligence (réveil, après séance, soir) ; nutrition avec reconnaissance d'image | abonnement | 6,99/mois |
| Whoop | coach ; **My Memory** (voir, corriger, effacer ce que l'IA retient) ; check-ins proactifs | inclus au capteur | 199 à 359/an |
| Oura | Advisor ; repas en photo | inclus à l'anneau | abonnement |
| Apple (watchOS 26) | Workout Buddy, coach vocal en séance | gratuit | appareil |
| Hevy | Hevy Trainer | inclus dans Pro | 23,99/an |
| Fitbod | programmation automatique (muscu seule) | abonnement | 95,99/an |
| MacroFactor | photo, code-barres, étiquette ; cible recalée chaque semaine | abonnement | 71,99/an |
| Cal AI | calories depuis une photo | abonnement | ~40-60/an |
| Freeletics | coach IA au poids du corps | abonnement | ~55-80 €/an |

**Cinq leçons** :
1. Le coach conversationnel est partout, **derrière un abonnement** ou un capteur.
2. En nutrition, **la saisie sans saisie** (photo, voix, phrase) est le minimum. Sa précision reste
   discutée : une étude citée par MacroFactor (concurrent direct) mesure une sous-estimation moyenne
   de 345 kcal par repas chez Cal AI.
3. **La confiance devient une fonction** (Whoop My Memory = l'idée 10 du carnet).
4. **Les données s'ouvrent** (Strava → Claude par MCP, coût d'inférence nul pour Strava).
5. **Personne ne croise les quatre domaines.** C'est le différenciateur de l'app, et là que
   l'assistant doit briller.

## 3. Le minimum à aligner

| Capacité | Chez nous | Verdict | Accès (le jour où le payant existe) |
|---|---|---|---|
| Parler à son app de ses données | Labo IA (outil de dev) | **à aligner** — l'assistant du Labo | gratuit avec quota |
| Bilan du jour rédigé | brief du matin chiffré, aucun bilan du soir | **à aligner** | gratuit |
| Bilan de semaine rédigé | BILAN-01 chiffré | **à aligner** (rédaction par-dessus) | gratuit |
| Repas en photo | prêt côté serveur, retiré | **à aligner** (réactiver) | gratuit avec quota |
| Repas en texte ou à la voix | saisie en phrase par règles (4.5), hors ligne ; dictée du clavier | **à compléter** : Prisme en recours de ce que les règles ne comprennent pas | gratuit avec quota |
| Mémoire visible | idée (10) | **à aligner** avec la conversation | gratuit |
| « D'où vient ce chiffre ? » | « Pourquoi ? » déterministe | déjà mieux sans IA | gratuit |
| Coach vocal en séance | annonces audio, fractionné guidé, brief lu | déjà là sans IA | gratuit |
| Alerte au bon moment | Insights, garde-fous, notifications | déjà là sans IA | gratuit |
| Générer un programme | programmes éditoriaux, CORPS-04 | plus tard | payant |
| Plan de repas IA | REPAS-01 manuel | plus tard | payant |
| Apporte ton IA (MCP) | idée (36) | plus tard | à décider |

## 4. Pilier par pilier

Règle qui tient partout : **le moteur calcule, l'IA raconte.** Elle lit, choisit, rédige, comprend une
phrase ; elle ne produit jamais un chiffre affiché.

- **Musculation** — « pourquoi je stagne » raconté ; résumé d'après-séance ; « le banc est pris » en
  langage naturel (MUSC-F14 calcule). *Pas ici* : charges et progression (moteur testé).
- **Course** — lire une sortie (allure, dénivelé, nuit, Réservoir) ; préparer une course ; questions
  libres sur l'historique. *Pas ici* : générer un plan (risque de blessure, contenu de coach).
- **Nutrition** — repas en photo ou en une phrase ; « que manger ce soir » (NUTR-F2 calcule, l'IA
  propose des plats) ; bilan nutrition rédigé. *Pas ici* : estimer des calories.
- **Bien-être** — check-in du soir dicté → étiquettes proposées ; « pourquoi je dors mal » raconté.
  *Pas ici* : parler de l'humeur — le garde-fou « humeur basse » reste déterministe.
- **Socle** — raconter cycle × performance ; expliquer programme × priorités. *Pas ici* : diagnostiquer
  une douleur. Cycle exclu par défaut.
- **Labo** — la maison de l'assistant : expliquer un lien (Croiser), « compose avec moi » (Composer,
  rien ne s'écrit sans la feuille), enquête et Conseil racontés (Apprendre).

## 5. L'assistant

**Nom : Prisme** (D1). Un prisme décompose la lumière en couleurs ; l'assistant décompose la journée
dans les couleurs des piliers et montre où elles se mélangent — la triade du Labo, sans rien ajouter.
Nom d'objet plutôt que prénom : la voix du produit est sobre, et un prénom promettrait un ami.
Écartés : Tandem, Élan, Mendel, Iris ; Lumen (déjà un appareil de mesure du métabolisme connu).
⚠️ Dépôt de marque à vérifier (INPI, EUIPO) avant la fiche Play.

**Sa voix** : tutoie, phrases courtes, constat avant conseil ; cite ses chiffres, tous vérifiés ; dit
« je ne sais pas » ; propose, ne prescrit pas ; se présente comme une IA sur chaque réponse (obligation
de transparence de l'AI Act).

**Ce qu'il ne fait jamais** : écrire dans le plan (la feuille du Labo écrit) ; estimer des calories ;
prescrire un régime restrictif ; poser un diagnostic ; remplacer le garde-fou « humeur basse » ;
recevoir cycle, humeur ou alcool sans second accord.

**Où il vit** (D2) : une barre « Demande à Prisme » en bas des trois onglets du Labo, qui ouvre une
feuille de conversation ; et une entrée « Prisme raconte » partout où un dossier existe (bilan du
soir, bilan hebdo, enquête, Conseil). Pas de bouton flottant global, pas de quatrième onglet.

## 6. Comment il répond sans pouvoir inventer

1. Tu demandes (ou tu ouvres ton bilan). 2. Le téléphone choisit le dossier. 3. Les moteurs locaux
calculent. 4. Seul le dossier part (agrégats, aucune identité, 8 000 caractères au plus) ; `ai-assist`
applique ses quatre gardes. 5. Le modèle rédige. 6. **Le garde-fou relit** : un nombre absent du
dossier fait jeter la réponse, les faits bruts restent affichés. 7. Rien ne s'écrit sans validation.

Phase 3 seulement : de vrais appels d'outils (le modèle demande, le téléphone calcule).

## 7. Tester gratuitement

Règle du dépôt (§7.2 de l'analyse IA) : **un fournisseur qui entraîne ses modèles sur nos requêtes ne
voit que des données factices.**

| Fournisseur | Gratuit | Entraîne sur nos requêtes ? | Où | Usage |
|---|---|---|---|---|
| Mistral (mode gratuit) | texte, vision, outils ; quota large ; vérification d'identité | oui par défaut, **opt-out possible** | UE | bêta sur vraies données **une fois l'opt-out vérifié** |
| Groq | gpt-oss-120b/20b, Qwen ; ~30 req/min, ~1 000/jour, ~200 k jetons/jour | **non** (DPA, pas de rétention) | US | bêta sur vraies données (transfert hors UE annoncé) |
| Gemini (AI Studio) | Flash, vision ; le plus généreux | **oui, sans opt-out** | mondial | données factices uniquement (déjà branché) |
| OpenRouter `:free` | 20+ modèles ; 20 req/min, 50/jour | selon le modèle | variable | comparer, sur factices |
| Cerebras | ~1 M jetons/jour | non documenté | US | secours |
| Ollama (local) | illimité | non | PC de dev | mise au point des consignes |
| Anthropic | pas de gratuit | non | région réglable | phase payante |

**Capacité** : un bilan pèse 3 000 à 4 000 jetons ; à ~200 000 jetons/jour (Groq), le projet tient une
cinquantaine de réponses par jour, soit 5 à 10 testeurs actifs. Aucun palier gratuit ne tient une app
publiée — ce n'est pas leur rôle.

**Travail technique préalable** : Mistral, Groq, Cerebras et OpenRouter parlent tous le format
compatible OpenAI ; un adaptateur de plus dans `providers.ts`, et changer de fournisseur ne touche plus
jamais l'app.

## 8. Gratuit ou payant

Principe d'ADR-003 : on fait payer la profondeur et l'intégration, jamais l'accès de base. Tout ce que
le moteur calcule reste gratuit. Proposition (à rediscuter, D6) :

| Fonction | Bêta (maintenant) | Gratuit (plus tard) | Premium (plus tard) |
|---|---|---|---|
| Bilan du soir rédigé | testeurs | 1/jour | 1/jour + « creuser » |
| Bilan de semaine rédigé | testeurs | 1/semaine | + comparaison 4 et 12 semaines |
| Repas en photo ou en texte | testeurs | 3/jour | 30/jour |
| Questions à Prisme | testeurs | 5/jour | 300/mois |
| Enquête racontée | testeurs | résumé du dossier | à la demande + suivi d'expérience |
| Compose avec moi, plan de repas IA | — | — | oui |

**Coûts en payant** (tarifs Anthropic au 25/09/2026 — Haiku 4.5 : 1 $ / 5 $ par million de jetons ;
Sonnet 5.5 : 2 $ / 10 $) : bilan du soir ~0,004 $ ; bilan de semaine 0,008-0,016 $ ; photo ~0,003 $ ;
question 0,005-0,010 $. Profils mensuels : gratuit typique ~0,24 $, gratuit au plafond ~1,17 $, premium
typique ~1,34 $, premium au plafond ~3,54 $. **1 000 utilisateurs gratuits typiques ≈ 240 $/mois** :
l'IA ne peut pas être ouverte à tous sans revenu. Un Premium vers 4-5 €/mois couvre le profil au
plafond ; le marché facture son IA 7 à 20 $/mois.

## 9. Décisions (Florian, 02/10/2026)

| # | Question | Décision |
|---|---|---|
| **D1** | Nom de l'assistant | **Prisme** |
| **D2** | Où vit-il | Barre en bas du Labo + entrées « Prisme raconte » sur les dossiers ; pas de bouton flottant |
| **D3** | Première US IA | **« Prisme raconte »** (bilans du soir et de la semaine, repas en une phrase) avant la conversation libre → [PRISME-01](../specs/functional/us/prisme01-prisme-raconte.md) |
| **D4** | Fournisseur gratuit | Peu importe **tant que le test est gratuit**. Mise en œuvre (PRISME-01) : Groq d'abord, Mistral une fois l'opt-out vérifié, **jamais Gemini** pour Prisme — verrou côté serveur ; Gemini reste au Labo IA, sur factices |
| **D5** | Vraies données en bêta | **Oui** — les vrais utilisateurs sont la famille et les amis |
| **D6** | Grille gratuit / payant | **À rediscuter** ; il y aura du payant (« je ne peux pas tout sortir de ma poche ») |
| **D7** | Bien-être, cycle, douleurs envoyés à l'IA | **Non par défaut** ; un second accord, pilier par pilier |

Au passage : avec le Bien-être, « FitTrio » croise quatre piliers ; le nom de l'app reste ouvert
(PRD : Atlas, Orbit…) — à reprendre avant la fiche Play.

## 10. Phasage

| Phase | Contenu | Coût |
|---|---|---|
| 0 · banc d'essai | adaptateur compatible OpenAI, questions de référence × fournisseurs sur dossiers factices, taux de rejet du garde-fou | 0 €, factices |
| 1 · Prisme raconte | **PRISME-01** : bilan du soir et de semaine rédigés, Prisme en recours de la saisie en phrase, accord Prisme, fournisseur verrouillé (jamais un fournisseur qui entraîne) | 0 €, famille et amis |
| 1 bis | **PRISME-01b** (NARR-01 / CONS-01 dans la voix de Prisme, selon Q1), **PRISME-02** (photo de repas), **ACCES-IA** (bêta réservée aux testeurs, avant le build Play) | 0 € |
| 2 · Parler à Prisme | barre du Labo, feuille de conversation, intentions routées sur le téléphone, mémoire visible, second accord bien-être | 0 €, testeurs |
| 3 · Il agit | appels d'outils, Compose avec moi, plan de repas IA, MCP ; fournisseur payant UE | payant |

La phase 0 est absorbée par PRISME-01 (l'adaptateur). Le périmètre de PRISME-01 a été resserré après
la relecture du 02/10/2026 (spec §13). Rien de tout ça ne doit retarder LANCE-00 / LANCE-01.

## 11. Sources

Marché : [MyFitnessPal AI Coach](https://www.wareable.com/health-and-wellbeing/myfitnesspal-nutrition-ai-coach-feature-announcement) ·
[rachat de Cal AI](https://insider.fitt.co/myfitnesspal-acquires-rival-food-tracker-cal-ai/) ·
[Google Health Premium](https://www.androidauthority.com/google-health-premium-price-inclusions-features-3664507/) ·
[Strava et Claude](https://marathonhandbook.com/strava-now-lets-runners-talk-to-their-training-data-through-claude/) ·
[Garmin Connect+](https://the5krunner.com/2026/04/20/garmin-connect-plus-review/) ·
[Whoop My Memory](https://www.whoop.com/us/en/thelocker/my-memory-whoop/) ·
[Oura Advisor](https://www.businesswire.com/news/home/20250331565896/en/Oura-Advisor-an-AI-powered-Personal-Health-Companion-Now-Rolling-Out-to-All-Oura-Members) ·
[Apple Workout Buddy](https://techcrunch.com/2025/06/09/apples-new-workout-buddy-helps-you-sweat-smarter) ·
[tarifs Hevy, Strong, Fitbod](https://www.sensai.fit/blog/fitness-app-pricing-free-tier-comparison) ·
[MacroFactor contre Cal AI](https://macrofactor.com/macrofactor-vs-cal-ai/).
Fournisseurs : [API gratuites, août 2026](https://continuumcode.ai/guides/free-llm-api/) ·
[Groq, données](https://apistatuscheck.com/blog/groq-api-data-privacy-guide) ·
[Mistral, entraînement et opt-out](https://help.mistral.ai/en/articles/323757-do-you-use-my-user-data-to-train-your-artificial-intelligence-models) ·
[Gemini, limites](https://ai.google.dev/gemini-api/docs/rate-limits).

**Périmètre** : analyse et décisions. Les tarifs et quotas sont ceux relevés entre mai et septembre
2026 ; ils bougent sans préavis et sont à revérifier avant tout engagement.
