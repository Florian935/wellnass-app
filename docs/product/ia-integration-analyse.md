# Intégration de l'IA dans l'app — analyse (modèles, architecture, coûts)

> **État : exploration / aide à la décision.** Rédigé le 15/07/2026 à la demande de Florian.
> Objectif : cadrer **quel(s) modèle(s)** utiliser, **comment** les brancher (architecture, sécurité,
> RGPD) et **combien ça coûte** pour deux usages IA envisagés. Pas encore une US ; sert de base
> d'arbitrage Florian & Damien. Tarifs Anthropic **au 24/06/2026** (cache de la doc API) — **à
> revérifier** sur platform.claude.com/pricing avant tout engagement.

## 1. Les deux usages visés

1. **Analyse de données assistée par IA (interne)** — l'IA recroise les données d'un utilisateur
   (les 3 piliers + poids), en tire des **insights**, des **causes** (« pourquoi ton allure baisse »),
   des recommandations. S'appuie directement sur le [catalogue d'analyses](analyses-donnees.md).
2. **Chatbot expert musculation (utilisateur)** — un assistant conversationnel « spécialisé muscu »
   à qui l'utilisateur demande des conseils, des programmes poussés, des explications.

Ces deux usages ont des **profils techniques et de coût différents** ; on les traite séparément.

---

## 2. Idée reçue à lever : « entraîner un chatbot pour la muscu »

**On n'entraîne pas un modèle from scratch, et on n'a quasiment jamais besoin de fine-tuning.**
Rendre un assistant « expert muscu » se fait par trois leviers, du plus simple au plus lourd :

| Levier | Ce que c'est | Effort | Quand |
|---|---|---|---|
| **A. Prompt système expert** | Un long prompt qui définit le rôle, le ton, les garde-fous, les principes d'entraînement (surcharge progressive, RPE, périodisation…). | Faible | **Toujours** — la base. |
| **B. RAG (Retrieval-Augmented Generation)** | On donne au modèle, à chaque question, des **extraits pertinents** d'une base de connaissances qu'on maîtrise (bibliothèque d'exercices, fiches, données de l'utilisateur). Le modèle répond **à partir de ces extraits**. | Moyen | Dès qu'on veut des réponses ancrées dans **nos** données (exercices, historique de l'user) et non la culture générale du modèle. |
| **C. Outils (function calling / agent)** | Le modèle peut **appeler des fonctions** : lire l'historique muscu de l'user, créer un programme via notre moteur existant, chercher un exercice. Il agit, pas seulement il parle. | Moyen-élevé | Pour « générer un programme », « analyser mes 4 dernières semaines » — actions concrètes. |
| ~~D. Fine-tuning~~ | Ré-entraîner le modèle sur nos données. | Élevé, coûteux | **À écarter** : Claude n'expose pas de fine-tuning grand public, c'est rarement utile face à A+B+C, et ça fige un modèle vite dépassé. |

**Conclusion** : un chatbot muscu = **prompt système expert (A) + RAG sur notre contenu (B) +
outils (C)**. C'est le même modèle Claude pour tout le monde ; la spécialisation vient du prompt,
du contexte injecté et des outils — pas d'un entraînement dédié.

---

## 3. Quel modèle pour quel usage

Gamme Claude (du moins cher au plus cher). Tous appelés via la même API (`/v1/messages`).

| Modèle | ID | Entrée $/M | Sortie $/M | Profil |
|---|---|---:|---:|---|
| **Haiku 4.5** | `claude-haiku-4-5` | 1 | 5 | Rapide, économique. Tâches simples/templatées, gros volume. |
| **Sonnet 5** | `claude-sonnet-5` | 3 (2 intro*) | 15 (10 intro*) | Équilibre qualité/prix, quasi niveau Opus sur le raisonnement. **Le cheval de trait.** |
| **Opus 4.8** | `claude-opus-4-8` | 5 | 25 | Le plus capable. Raisonnement complexe, root-cause, génération de programmes avancés. |
| **Fable 5** | `claude-fable-5` | 10 | 50 | Le plus puissant, très cher. **Pas justifié ici.** |

_\* Sonnet 5 : tarif d'introduction 2 $/10 $ jusqu'au 31/08/2026, puis 3 $/15 $._

**Recommandations par usage :**

- **Usage 1 — Analyse de données** :
  - **Haiku 4.5** pour les insights **routiniers/templatés** (bilan hebdo « voici tes chiffres + 2
    observations ») → volume élevé, coût minimal.
  - **Sonnet 5** pour l'**analyse croisée en profondeur** (« pourquoi », corrélations inter-piliers).
  - **Opus 4.8** réservé aux analyses les plus **exigeantes** (root-cause multi-facteurs), à la demande.
  - **Batch API (−50 %)** pour tout ce qui est **asynchrone** (le bilan hebdo n'a pas besoin d'être
    instantané).
- **Usage 2 — Chatbot muscu** :
  - **Sonnet 5** par défaut (le workhorse conversationnel : bon raisonnement, coût maîtrisé).
  - **Opus 4.8** pour la **génération de programme avancé** (raisonnement long, sortie structurée).
  - **Haiku 4.5** possible en **routage** (classer la demande, réponses très simples) pour économiser.

> On peut **router dynamiquement** : Haiku pour le simple, Sonnet par défaut, Opus pour le dur. Le
> routage lui-même peut être une règle applicative simple (mots-clés, type de demande).

**Leviers de coût transverses** (tous natifs de l'API) :
- **Prompt caching** : le prompt système + la base RAG (contenu stable) sont **mis en cache** →
  relus à ~**0,1×** le prix d'entrée. Écriture de cache : 1,25× (TTL 5 min). Gros gain sur le chatbot
  (même prompt système à chaque message).
- **Batch API** : **−50 %** sur tout traitement non temps réel (bilans, analyses de fond).
- **`effort` / thinking adaptatif** : on module la profondeur de raisonnement (donc les tokens de
  sortie facturés). `low` pour du simple, `high` pour du dur.

---

## 4. Estimation de coûts

> **Hypothèses explicites** (ordre de grandeur, à affiner). Prix standard hors intro, hors caching
> sauf mention. 1 token ≈ 0,75 mot FR.

### 4.1 Usage 1 — Bilan/insight IA (par utilisateur, par bilan)

Hypothèse : ~4 000 tokens d'entrée (prompt + données agrégées de la semaine) + ~800 tokens de sortie.

| Modèle | Coût / bilan | Coût / user / mois (~4 bilans) | 1 000 users premium / mois |
|---|---:|---:|---:|
| Haiku 4.5 | ~0,008 $ | ~0,035 $ | **~35 $** |
| Sonnet 5 | ~0,024 $ | ~0,10 $ | **~100 $** |
| Opus 4.8 | ~0,04 $ | ~0,17 $ | **~170 $** |
| Haiku + **Batch (−50 %)** | ~0,004 $ | ~0,017 $ | **~17 $** |

➡️ Le bilan hebdo est **très bon marché**, surtout en Haiku + Batch. Même en Sonnet, ~0,10 $/user/mois.

### 4.2 Usage 2 — Chatbot muscu (par message, par utilisateur)

Hypothèse par message : ~2 000 tokens de prompt système + ~2 000 de contexte RAG (**cachés**,
relus à 0,1×) + ~1 500 tokens frais (historique + question) + ~500 tokens de sortie.

| Modèle | Coût / message (avec cache) | Session ~10 msg | 30 msg / user / mois |
|---|---:|---:|---:|
| Sonnet 5 | ~0,013 $ | ~0,13 $ | **~0,40 $** |
| Opus 4.8 | ~0,025 $ | ~0,25 $ | **~0,75 $** |

**Génération de programme avancé** (Opus, entrée ~6 000, sortie ~2 000 tokens) : **~0,08 $ / programme**.

Profil d'un utilisateur premium actif (≈ 30 messages chatbot + 2 générations de programme / mois) :

| Échelle | Coût mensuel (Sonnet + Opus prog.) |
|---|---:|
| 100 users premium | **~60 $** |
| 1 000 users premium | **~600 $** |
| 10 000 users premium | **~6 000 $** |

➡️ Le chatbot est le poste **dimensionnant** : coût **proportionnel à l'usage**. À gérer par
gating premium + **plafonds** (quota de messages, cap de dépense).

### 4.3 Lecture d'ensemble

- **Analyse de données** : coût quasi négligeable par utilisateur → peut même être envisagé **gratuit**
  ou dans un premier palier, si volume maîtrisé (Haiku + Batch).
- **Chatbot** : coût réel, linéaire à l'usage → **réservé à un palier payant** avec quotas.
- Les tarifs Anthropic **baissent** régulièrement et les optimisations (cache, batch, routage Haiku)
  divisent facilement la facture par 2-4 vs un usage naïf tout-Opus.

---

## 5. Architecture & sécurité (structurant — à ne pas négliger)

**⚠️ La clé API Anthropic ne doit JAMAIS être dans l'app mobile.** Une clé embarquée dans un client
React Native est **extractible** de l'APK → n'importe qui pourrait consommer notre budget.

**Schéma cible** (cohérent avec notre stack Supabase) :

```
App mobile (RN)  ──JWT Supabase──▶  Edge Function Supabase  ──clé API──▶  API Claude
   (aucun secret)                    (détient ANTHROPIC_API_KEY,          (Anthropic)
                                      auth, rate-limit, cap coût,
                                      RLS : ne lit que les données de l'user)
```

- **Proxy backend obligatoire** : une **Supabase Edge Function** détient la clé, authentifie l'appel
  (JWT), applique **rate-limiting** + **plafond de dépense** par user, et **ne transmet à Claude que
  le nécessaire**. Elle peut **streamer** la réponse (SSE) vers l'app pour un chatbot fluide.
- **Offline-first** : les fonctions IA **nécessitent une connexion** ; dégrader proprement
  (message clair hors-ligne), ne pas casser le reste de l'app.
- **Coût maîtrisé côté serveur** : quotas, journalisation des tokens consommés (recoupe l'US 9.10
  analytics), alertes de dépassement.

### RGPD / données de santé (point dur)

Envoyer à un tiers (Anthropic) des données **nutrition/poids/activité** = données personnelles,
potentiellement **sensibles** (santé). À instruire **avant** tout déploiement :

- **Consentement explicite** de l'utilisateur pour l'usage IA (opt-in séparé), + information claire.
- **Minimisation** : n'envoyer que les agrégats/champs nécessaires à l'analyse, pas tout le brut.
- **Résidence des données** : l'API expose `inference_geo` (ex. `"eu"`) pour contraindre la région
  d'inférence — à activer pour un traitement en Europe.
- **Non-entraînement** : les entrées API ne sont pas utilisées pour entraîner les modèles par défaut ;
  vérifier/porter au contrat (DPA Anthropic) et à la politique de confidentialité de l'app.
- **Rétention** : possibilité de rétention réduite (zero-data-retention) selon l'offre — à cadrer
  (NB : certains modèles très haut de gamme l'excluent ; sans objet pour Haiku/Sonnet/Opus visés).
- Mettre à jour **CGU + politique de confidentialité** (recoupe l'US 1.21).

---

## 6. Monétisation

L'IA est **le** candidat naturel au palier payant — la roadmap le prévoit déjà : entitlement
**« IA »** dans les paliers RevenueCat (Premium muscu → Écosystème → **IA**, item 9.14, câblé mais
inactif en V1). Principe :

**Décision produit (Florian, 15/07/2026)** : les **analyses poussées et transverses (inter/tri-piliers)
sont payantes**. Modèle freemium retenu :

- **Gratuit = teaser de conversion** : **1 bilan d'analyse croisée par mois** (voire 2), et
  **volontairement bridé** — il donne un **aperçu** de ce que l'IA sait faire, **sans être exhaustif
  ni ultra-poussé**. But : donner envie de passer au payant.
- **Premium = analyses complètes** : analyses croisées **poussées, exhaustives, à la demande** +
  **chatbot muscu** (avec quota de messages/mois pour borner la dépense, surcoût au-delà si besoin).
- **Règle d'or** : le **prix du palier** doit couvrir le **coût IA du user le plus actif** du palier +
  marge. Les estimations §4 donnent la borne (chatbot ≈ 0,4-0,8 $/user/mois d'usage typique ; le
  teaser gratuit ≈ 1 bilan bridé/mois = coût négligeable).

> Rappel séquencement : gating actif ⇒ monétisation activée ⇒ **post-V1** (RevenueCat inactif en V1).

---

## 7. Recommandation : MVP et phasage

Commencer **petit, mesurable, gated**, puis étendre :

1. **Phase 1 — Insight IA hebdomadaire (le moins risqué, le moins cher).**
   - Un **bilan hebdo** généré en **Batch** (Haiku 4.5, puis Sonnet 5 si la qualité l'exige), à partir
     des analyses déjà cadrées du [catalogue](analyses-donnees.md).
   - Proxy Edge Function + consentement + `inference_geo`. Pose toute la **plomberie sécurité/RGPD**.
   - Faible coût, faible risque, valeur immédiate. Sert de socle.
2. **Phase 2 — Chatbot muscu (Sonnet 5 + prompt expert + RAG + outils).**
   - Prompt système expert, RAG sur la bibliothèque d'exercices + l'historique de l'user, outils
     (lire l'historique, générer un programme via le moteur existant).
   - Gating **premium** + quota. Streaming pour l'UX.
   - Opus 4.8 branché uniquement sur la **génération de programme avancé**.
3. **Phase 3 — Analyse « root-cause » à la demande (Opus/Sonnet).**
   - L'utilisateur demande « pourquoi X » → analyse croisée profonde, ponctuelle.

---

## 8. Risques & points d'attention

- **Hallucination / conseil santé** : un chatbot muscu/nutrition peut donner un conseil faux ou
  inadapté (blessure, pathologie). **Garde-fous** : prompt de sécurité (ne pas poser de diagnostic
  médical, renvoyer vers un professionnel), disclaimers, périmètre borné. **Point dur, à cadrer.**
- **Coût qui dérape** : sans plafonds, un power-user ou un abus peut coûter cher. Rate-limit + cap +
  quotas dès la Phase 1.
- **Dépendance fournisseur** : un seul fournisseur (Anthropic). Acceptable ; l'architecture proxy
  permettrait de changer/router si besoin.
- **Latence** : les analyses profondes (thinking élevé) prennent du temps → asynchrone/batch pour le
  bilan, streaming pour le chat.
- **Qualité des données** : une analyse IA ne vaut que par les données loggées (journal incomplet →
  insight bancal). À dire honnêtement à l'utilisateur.
- **Tarifs & modèles évoluent** : re-vérifier prix et IDs de modèles avant de figer quoi que ce soit.

---

## 9. Réponses directes aux questions posées

- **Quel modèle ?** Pas un modèle unique : **Haiku 4.5** (insights routiniers, batch), **Sonnet 5**
  (chatbot + analyses croisées — le workhorse), **Opus 4.8** (root-cause + génération de programme
  avancé). Fable 5 non justifié.
- **Comment « entraîner » le chatbot muscu ?** Pas d'entraînement : **prompt expert + RAG sur notre
  contenu + outils**. Voir §2.
- **Combien ça coûte ?** Analyse/bilan : **négligeable** (~17-100 $/mois pour 1 000 users selon le
  modèle). Chatbot : **proportionnel à l'usage** (~600 $/mois pour 1 000 users premium actifs) →
  à gater en premium avec quotas. Voir §4.
- **Prérequis non négociables** : proxy backend (clé jamais dans l'app), consentement + RGPD, plafonds
  de coût. Voir §5.
