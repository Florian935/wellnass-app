---
id: IA-LAB-01
titre: "Labo IA — évaluer un modèle sur des données factices, avec un fournisseur gratuit"
roadmap: [7.31]
catalogue: []
etape: recette
branche: dev
maj: 15/09/2026
---

# US IA-LAB-01 — Labo IA

> **Analyse de référence** : [ia-integration-analyse.md](../../../product/ia-integration-analyse.md),
> §7 « Tester en gratuit » ajouté le 15/09/2026 dans le même lot.
> **Plan** : [docs/plans/ialab01-labo-ia.md](../../../plans/ialab01-labo-ia.md).
> **Demande** : Florian, 15/09/2026 — « intègre de l'IA Gemini en mode gratuit pour que je puisse
> tester des appels IA sur des données factices », puis « fais tout d'un seul lot ».
> **Pas de maquette** : surface de test interne, jamais destinée au build de lancement (§9).

## 0. Contexte — on a chiffré l'IA sans jamais la voir tourner

L'analyse du 15/07/2026 estime ce que l'IA coûterait (§4), comment la brancher (§5) et dans quel
ordre (§8). Elle a permis de trancher la monétisation. Mais **personne n'a jamais vu ce qu'un modèle
rend sur nos données** : on a un phasage, un budget et une architecture, et zéro réponse lue.

Le 13/09/2026, la surface IA de DASH-01 a été retirée du build de lancement — à raison : l'app est
gratuite en V1 et le modèle, lui, était payant. Mais le retrait a emporté avec lui le seul moyen
d'évaluer quoi que ce soit. Il reste une fonction Edge non déployée, une migration appliquée, et une
brique de validation sans appelant.

**Ce que cette US rouvre, et à quel prix** : un chemin d'évaluation qui ne coûte **rien** (palier
gratuit), n'expose **rien** (données factices), et ne touche **pas** le build de lancement (écran
accessible uniquement via un opt-in des Réglages, désactivé par défaut).

## 1. Décisions actées (Florian, 15/09/2026)

| # | Décision |
|---|---|
| D1 | **Gemini en palier gratuit** pour l'exploration. Pas de compte facturé à ouvrir. |
| D2 | **Le fournisseur est un réglage**, pas un choix d'architecture : la fonction Edge bascule par variable d'environnement, l'app ne connaît qu'un nom de fonction. |
| D3 | **Données factices obligatoires** — un script SQL remet le compte de test à plat et le repeuple. |
| D4 | **Tout en un seul lot**, recette unique (memo « lot en oneshot »). Travail direct sur `dev`. |
| D5 | Surface **hors build de lancement** : aucun onglet, aucune entrée depuis un écran produit. |

## 2. Règles métier — les invariants

- **R1 — La clé ne quitte jamais le serveur.** Aucune clé de fournisseur dans l'app, jamais, quel
  que soit le fournisseur. Une clé dans un APK est une clé publique.
- **R2 — Quatre gardes avant tout appel** : JWT, consentement, quota quotidien, taille. Aucun n'est
  contournable côté client, et le quota vit en base (réinstaller l'app ne le remet pas à zéro).
- **R3 — Ce qui part est montré avant de partir.** L'écran affiche le **texte exact** envoyé au
  modèle. Un consentement donné sans voir les données serait décoratif.
- **R4 — Minimisation par liste blanche.** Seul le type `AiSnapshot` peut sortir de l'appareil :
  ni identité, ni date de naissance, ni texte libre (notes, douleurs), ni trace GPS. Un test-garde
  échoue dès qu'un champ est ajouté à cette liste.
- **R4 bis — Toute mesure porte sa tendance** : 28 derniers jours contre les 28 précédents.
  *Ajoutée le 16/09/2026, après la première recette.* Le contexte ne portait que des agrégats sur
  90 jours — une allure moyenne, une moyenne calorique, une charge max sans dimension temporelle.
  Cinq des six signaux plantés sont des **évolutions** : ils étaient donc structurellement
  introuvables. On demandait au modèle de repérer des tendances en ne lui montrant que des moyennes.
  Le pourcentage d'écart est calculé (arithmétique), jamais commenté (ce serait répondre à sa place).
- **R5 — Une section absente est omise, jamais mise à zéro.** « 0 sortie » et « la course n'est pas
  suivie » sont deux situations différentes : montrer des zéros fait conclure le modèle à
  l'inactivité, puis recommander un pilier que la personne a désactivé.
- **R6 — Rien n'est conservé côté serveur.** Ni la question, ni le contexte, ni la réponse.
  `ai_usage` ne porte qu'un compteur.
- **R7 — La réponse est affichée brute.** Exception assumée à la règle « aucun chiffre affiché ne
  vient d'un modèle » (DASH-01 R7), et **seule raison d'être** de cette surface : c'est la sortie
  non filtrée qu'on évalue. Elle ne peut donc jamais être réutilisée par un écran produit.
- **R8 — Garde-fous de sécurité dans la consigne** : pas de diagnostic médical, pas de chiffre
  inventé, aveu explicite quand une donnée manque, renvoi vers un professionnel devant un signe
  inquiétant. C'est le premier risque listé par l'analyse (§9).
- **R9 — Consentement désactivé par défaut**, horodaté, révocable. Même patron que
  `cycle_tracking_enabled` et `pain_journal_enabled`.

## 3. Architecture

```
App mobile ──JWT──▶ Edge Function ai-assist ──▶ ┌─ AI_PROVIDER=gemini    (gratuit, exploration)
 (aucun secret)      JWT · consentement ·       ├─ AI_PROVIDER=anthropic (cible, payant)
                     quota · taille             └─ …tout autre, via un adaptateur
```

- `supabase/functions/ai-assist/providers.ts` — **neuf**. Adaptateurs Gemini (REST `generateContent`)
  et Anthropic (REST `/v1/messages`), plus la lecture de configuration. En `fetch` pur : deux appels
  REST sans streaming ni outils ne justifient pas deux SDK `npm:` à démarrage froid.
- `supabase/functions/ai-assist/index.ts` — les gardes, inchangés dans leur ordre. Nouveau type
  d'appel `coach` (contexte agrégé + question libre) à côté de `photo` et `ask`.
- `packages/shared/src/ai-context.ts` — **neuf**. Le type `AiSnapshot` (liste blanche) et
  `buildAiContext` (sérialisation). C'est la minimisation écrite en code, testée sans React ni base.
- `apps/mobile/src/data/repositories/ai-context-repository.ts` — **neuf**. Câblage SQL pur.
- `apps/mobile/src/lib/ai/ai-client.ts` — **restauré** depuis `622339f2^`, étendu (`coach`,
  `provider`/`model` remontés, code d'erreur `misconfigured`).

### 3.1 Le modèle par défaut : `gemini-flash-latest`

Et non un numéro de version. Google renomme ses modèles Flash plusieurs fois par an (3.5 → 3.7 → 3.8
en 2026) ; un identifiant figé finit en 404 sans que personne n'ait rien changé. `GEMINI_MODEL`
permet d'épingler une version précise pour comparer deux modèles.

### 3.2 Une exception assumée : le détail d'une erreur de configuration remonte au client

La règle générale est que le message du fournisseur ne quitte jamais le serveur (il peut décrire de
l'infrastructure). Les 400/401/403/404 d'un fournisseur d'inférence font exception : ils décrivent
**notre configuration** — modèle inconnu, clé révoquée, API non activée — jamais l'utilisateur. Sans
eux, une faute de frappe dans `GEMINI_MODEL` est indiscernable d'une panne depuis le téléphone.
Tout le reste (429, 5xx, réseau) reste opaque.

## 4. L'écran

**Réglages → Labo IA** (interrupteur, désactivé par défaut) → **Ouvrir le labo**.

1. **Avertissement en tête** — surface de test, données factices uniquement. Premier élément de
   l'écran et non une note de bas de page : il conditionne tout l'usage.
2. **« Ce qui est envoyé »** — dépliant, affiche le contexte exact (R3).
3. **Six questions proposées** + champ libre (500 caractères). Les questions couvrent le bilan, la
   cause, le conseil, le croisement — et `blindSpot`, la question dont on sait qu'elle invite le
   modèle à inventer : sa réponse dit tout de sa fiabilité.
4. **La réponse**, brute, avec **fournisseur · modèle · quota consommé** en pied.

## 5. Le jeu de données — six signaux plantés

[`supabase/scripts/ia-purge-et-dataset.sql`](../../../../supabase/scripts/ia-purge-et-dataset.sql)
efface les données personnelles du compte de test (hard delete, compte et bibliothèque préservés) et
génère 120 jours d'historique.

**Un jeu aléatoire ne prouverait rien** : le modèle a toujours quelque chose à dire, et sans vérité
de référence on ne peut pas le noter. L'histoire est donc écrite à l'avance :

| # | Signal planté |
|---|---|
| S1 | Le développé couché **stagne depuis ~7 semaines** (82,5 kg), pendant que le squat continue de monter. |
| S2 | Les calories **chutent de 20 %** sur 28 jours (2700 → 2150) et les protéines de 165 → 115 g, à volume inchangé. |
| S3 | Énergie et humeur **baissent**, stress **monte**, sommeil **7 h 30 → 6 h** sur 28 jours. |
| S4 | **Angle mort** : zéro série d'épaules, de bras et de gainage en 120 jours. |
| S5 | L'allure de course **se dégrade de ~30 s/km** sur 28 jours, après avoir progressé de 5:45 à 5:11/km. |
| S6 | Le poids **stagne** sur 30 jours, après une perte régulière de 82 à 78 kg. |

> **Corrigé le 16/09/2026, après vérification en base.** S3 et S5 portaient sur 21 jours, et la
> dégradation d'allure ne valait que 18 s. Or le contexte compare deux fenêtres de **28 jours** : un
> signal plus court que la fenêtre s'y dilue dans la période saine qu'il chevauche, et l'écart net
> tombait à +2 % — que le rendu classe « stable ». **Un signal qu'on ne peut pas lire n'est pas un
> signal** : les deux ont été alignés sur 28 jours et S5 porté à 30 s.
> [`ia-verification.sql`](../../../../supabase/scripts/ia-verification.sql) contrôle chacun d'eux
> **sur les mêmes fenêtres que le contexte** — vérifier autrement que ce que le modèle voit ne
> prouverait rien sur ce qu'il peut trouver.

Les six forment **une seule histoire** : un déficit trop agressif sur un volume maintenu, qui produit
de la fatigue, qui bloque la progression. C'est la réponse attendue. Un modèle qui conclut « mange
moins » ou « entraîne-toi plus » a échoué — et c'est précisément ce qu'on veut pouvoir constater.

## 6. Contraintes

- **Offline-first** : le labo **exige** le réseau et le dit. Aucune donnée métier nouvelle, aucune
  écriture locale ; le reste de l'app est indifférent à cet écran.
- **Migrations** : **aucune**. `ai_consent_at` et `ai_usage` existent depuis DASH-01 (appliquées le
  13/09/2026). Donc **aucune sync rule à déployer** non plus.
- **i18n** : bloc `aiLab` complet FR + EN (parité vérifiée par `locale-parity.test.ts`).
- **Dépendances natives** : **aucune**. L'APK existant suffit — pas de nouveau build nécessaire.
- **Secrets** : `npx supabase secrets set GEMINI_API_KEY=…` puis
  `npx supabase functions deploy ai-assist --use-api`. **Gestes humains**, non automatisables.
  🔴 `npx` parce que le CLI est une **dépendance du projet** et non un binaire global, et
  `--use-api` parce que le bundle local réclame **Docker** — que personne n'a ici (même contrainte
  que `db:reset`). Sans clé, la fonction répond `ai_unavailable` et rien n'est facturé — c'est
  l'état par défaut du dépôt, vérifié le 16/09/2026 (`npx supabase secrets list` → aucun secret).
- **Play Store** : ✅ **rien à déclarer**. La surface n'est pas dans le build de lancement, et elle
  n'est pas atteignable sans activer un opt-in explicite.

## 7. Hors périmètre

Streaming de la réponse, historique des questions posées, comparaison automatique de deux
fournisseurs côte à côte, RAG sur la bibliothèque d'exercices, outils / function calling,
reformulation de « Demande-moi » (restée déterministe), photo de repas (restée retirée), paywall.

## 8. Ce que cette US ne décide pas

Elle ne choisit **pas** le fournisseur de production, ne rouvre **pas** la surface IA du build de
lancement, et ne préjuge **pas** de la qualité du modèle cible : une réponse de Flash gratuit ne dit
rien de ce que rendrait un Sonnet 5. C'est l'étape 1 du §7.5 de l'analyse ; les étapes 2 et 3 restent
entières.

## 9. Critères d'acceptation

Détaillés et cochables dans [RECETTES.md](../../../../RECETTES.md) §67.
