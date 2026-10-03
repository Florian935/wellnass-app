---
id: PRISME-01
titre: "Prisme raconte — le bilan du soir et de la semaine rédigés, et Prisme en recours de la saisie en phrase"
roadmap: [7.42, 4.48]
catalogue: []
etape: code
branche: feature/prisme01-prisme-raconte
maj: 03/10/2026
---

# US PRISME-01 — Prisme raconte

> **Analyse de référence** : [analyse-assistant-prisme-2026-10.md](../../../product/analyse-assistant-prisme-2026-10.md)
> (compte rendu en ligne avec maquette jouable : https://claude.ai/artifact/2zptc9GuNxMTvxWJm8nioj).
> **Plan** : [docs/plans/prisme01-prisme-raconte.md](../../../plans/prisme01-prisme-raconte.md).
> **Maquette** : [design/prisme01-prisme-raconte/](../../../../design/prisme01-prisme-raconte/) — planche
> en ligne : https://claude.ai/artifact/7CV99wcvuB1wFxvYKS9FDb
> **Demande** : Florian, 02/10/2026 — « les concurrents ont de l'IA ; on s'y met, avec des IA à usage
> gratuit ». Décisions D1 à D7 tranchées le jour même (§1).
> **Relue** le 02/10/2026 par un agent de revue : 3 bloquants et 25 autres constats, intégrés dans cette
> version (§13 « Ce que la relecture a changé »).
> ✅ **Spec, plan et maquette validés par Florian le 03/10/2026** (« je valide TOUT »), question Q1
> comprise.

## 0. Le problème

L'app calcule beaucoup — bilan hebdo, brief du matin, enquêtes du Labo, Réservoir, garde-fous —, mais
tout est rédigé par clés i18n, juste et sec. Le marché a fait de « l'app qui te parle de tes données » un
standard, presque toujours payant ; deux gestes y sont devenus le minimum : **un bilan rédigé** et **le
repas saisi sans effort**.

Ce qui existe déjà côté IA, vérifié le 02/10/2026 :

- la fonction Edge `ai-assist` (JWT, consentement, quota, taille ; fournisseur = réglage) ;
- le **Labo IA** (IA-LAB-01), outil d'évaluation sur données factices ;
- le **résumé d'un dossier d'enquête** (NARR-01) et du **Conseil des trois** (CONS-01), avec le
  garde-fou des nombres. ⚠️ Ces deux-là envoient **de vraies données** (le dossier du Labo de
  l'utilisateur) par le type `coach`, sous l'accord du Labo IA — dont le texte dit « à n'activer que
  sur des données factices » et prévient que le fournisseur gratuit peut entraîner ses modèles. Le cas
  est limité aux comptes qui ont activé le Labo IA, mais il existe : **question Q1** (§2) ;
- la **saisie d'un repas en phrase** (roadmap 4.5, `meal-quick-entry`) : un analyseur de règles FR + EN,
  hors ligne (`parseMealText`, `rankFoodMatches`, `bestMatchIndex`). Il comprend « une banane, 3
  tranches de pain de mie » ; il ne comprend pas « une grosse assiette de couscous ».

Ce qui manque :

1. **Aucun bilan du soir.** Le matin a son brief ; la journée finie n'a rien.
2. **Aucune rédaction** du bilan hebdo, exact mais à lire en entier.
3. **Aucun recours** quand la saisie en phrase ne comprend pas.
4. **Aucun fournisseur gratuit autorisé sur de vraies données** : Gemini gratuit entraîne ses modèles
   sur nos requêtes. Or les testeurs sont **la famille et les amis**, avec leurs vraies données (D5).

## 1. Décisions actées (Florian, 02/10/2026)

| # | Décision |
|---|---|
| D1 | L'assistant s'appelle **Prisme**. |
| D2 | Il vit dans le Labo (barre de question — **phase 2**, hors de cette US) et partout où un dossier existe. Pas de bouton flottant global. |
| D3 | **Première US : « Prisme raconte »** — bilans du soir et de la semaine rédigés, repas décrit en une phrase — avant la conversation libre. |
| D4 | Le fournisseur importe peu **tant que le test est gratuit**. |
| D5 | **Vraies données en bêta** : les utilisateurs sont la famille et les amis. |
| D6 | Grille gratuit / payant **à rediscuter** ; il y aura du payant. Aucun paywall ici. |
| D7 | Bien-être, cycle et douleurs : **non par défaut**, un second accord pilier par pilier. |

## 2. Décisions dérivées et questions — validées le 03/10/2026

| # | Question | Proposition | Pourquoi |
|---|---|---|---|
| **DD1** | Quel fournisseur pour Prisme ? | Un réglage **distinct** de celui du Labo IA : `PRISME_PROVIDER`. Il n'accepte que des fournisseurs **qui n'entraînent pas sur nos requêtes** : `groq`, `mistral` **seulement si** `MISTRAL_TRAINING_OPTOUT=verified`, `anthropic`. **Jamais `gemini`.** Sinon, `status` répond « indisponible ». | La relecture l'a montré : avec un seul réglage pour toute la fonction, rien n'empêchait techniquement de vraies données de partir chez Gemini, ni chez Mistral avant l'opt-out. La règle §7.2 devient un verrou de code, pas une consigne. Le Labo IA garde `AI_PROVIDER` et peut rester sur Gemini. |
| **DD2** | Lequel en premier ? | **Groq** (aucune vérification, n'entraîne pas) ; Mistral quand l'opt-out est fait et vérifié (hébergé en UE, préférable). | D4 : gratuit d'abord. Groq est aux États-Unis : le texte d'accord le dit (R6). |
| **DD3** | Un accord distinct du Labo IA ? | **Oui** : `prisme_consent_at` et `prisme_consent_provider`. **Accordé par un appel serveur** (`kind: 'consent'`), qui écrit en base et renvoie le statut ; **retiré localement**, même hors ligne. | L'accord du Labo IA a été donné sur un texte « données factices, le fournisseur peut entraîner ». Et une écriture locale remonte par PowerSync **en différé** : le premier « Prisme raconte » juste après « Activer » prendrait un refus du serveur. |
| **DD4** | Bien-être en v1 ? | **Rien du bien-être ne part** : ni nuit, ni énergie, ni humeur. Pas de second accord en v1. | D7 est respecté sans interrupteur de plus. Le second accord viendra avec la conversation (phase 2), quand un usage le justifiera. |
| **DD5** | Health Connect ? | **Rien de ce qui vient de Health Connect ne part** (pas, nuit) tant que la relecture juridique n'a pas tranché. | La politique Health Connect interdit le partage à des tiers (`health-connect-play-declaration.md` §4) ; un sous-traitant n'est peut-être pas un « partage », mais c'est au juriste de le dire. |
| **DD6** | Comment l'app sait-elle si Prisme est disponible ? | Un appel `status`, **gratuit et non décompté**, traité **avant** tout contrôle de fournisseur : disponibilité, fournisseur (nom, pays, `trains`, `retention`), accord, restes du jour. Gardé en mémoire pour la session. | Le texte d'accord doit nommer le vrai destinataire, et seul le serveur le connaît. Aujourd'hui, une fonction sans fournisseur répond 503 avant même le JWT : `status` passe devant. |
| **DD7** | Visible ou appelable ? | Deux notions : une entrée est **visible** si l'accord est donné (ou à donner) et que le dernier statut connu dit « disponible » ; elle est **appelable** si le réseau est là. Hors ligne, l'entrée reste et dit « Prisme a besoin du réseau ». | La relecture a relevé que lier les deux faisait disparaître les entrées hors ligne, contre les cas limites. |
| **DD8** | Types d'appel ? | `status`, `consent`, `narrate` (bilans, voix de Prisme), `meal_text` (recours de la saisie en phrase). `coach` reste au Labo IA. | Une consigne système et un budget de sortie par usage. |
| **DD9** | Quotas de la bêta ? | `narrate` 6/jour, `meal_text` 6/jour, `coach` 20 inchangé. **Réservés avant l'appel par une fonction SQL atomique**, rendus si le fournisseur échoue. | Le quota actuel se contourne par des appels simultanés (lecture, appel, écriture `used + 1`). Le palier gratuit est commun à tout le projet. |
| **DD10** | Le bilan du soir est-il généré d'office ? | **Non : demandé.** Les faits s'affichent toujours. | NARR-01 D2 : un appel par ouverture d'accueil brûlerait le quota pour un texte non demandé. |
| **DD11** | Où vit-il ? | Accueil, **dès 18 h** (`dayMoment === 'evening'`), zone 1, carte « Ta journée ». | L'écran qu'on ouvre le soir ; zone fixe, hors plafond de widgets (ADR-007). |
| **DD12** | Le texte est-il stocké ? | **Non.** En mémoire pour la journée ; si la journée bouge, il est marqué « ta journée a bougé depuis » avec « Relire ». | NARR-01 D6. |
| **DD13** | Le nom se traduit-il ? | **Non** : « Prisme » en FR comme en EN. | Nom propre ; « Prism » renvoie en anglais à un programme de surveillance. |
| **DD14** | Pas de notification du soir ? | **Pas en v1.** | On mesure d'abord si le bilan est lu. |
| **DD15** | Âge ? | Prisme est réservé aux **18 ans et plus**. Date de naissance connue et < 18 ans : rien de Prisme. **Date absente** : la feuille d'accord demande de confirmer « J'ai 18 ans ou plus ». C'est **déclaratif**, et assumé. | L'âge minimum de l'app est 16 ans, et la date de naissance est souvent absente (non enregistrée à l'inscription, onboarding passable). |
| **Q1** | NARR-01 et CONS-01 envoient déjà de vraies données sous l'accord « factices » du Labo IA. Que fait-on ? | ✅ **Tranchée par Florian le 03/10/2026, selon la proposition** : après leur recette, les basculer sur l'accord et le fournisseur de Prisme, **sans les suspects bien-être** (`sleepShort`) — une petite US à part, **PRISME-01b** (BACKLOG P1). D'ici là, rien ne change pour eux dans cette US. | Les modifier maintenant réécrirait leurs critères de recette en cours (« aucun bouton sans consentement »), et leur dossier peut contenir la durée de sommeil, que DD4 exclut. |

**Sortis du périmètre après relecture**, chacun pour une US à part :

- **PRISME-02 — la photo de repas** : sous Groq elle n'existe pas (le modèle par défaut ne lit pas les
  images), et elle traîne la caméra, la file hors ligne et le redimensionnement de l'image ;
- **ACCES-IA — la bêta réservée aux testeurs** : une table **dédiée** `ai_testers`, et non un rôle de
  `user_roles` — dans cette table, **n'importe quelle ligne rend administrateur** (`is_admin()`). À
  livrer **avant** que Prisme entre dans le build du Play Store (§11) ;
- **le second accord bien-être** (D7) : avec la conversation, phase 2 ;
- **PRISME-01b — NARR-01 et CONS-01 dans la voix de Prisme** : selon Q1.

## 3. Ce que fait la fonctionnalité

1. **Le bilan du soir.** Dès 18 h, l'accueil montre la carte « Ta journée » : les faits du jour
   (séances et sorties, assiette, semaine en cours, ce qui est prévu demain), toujours, sans IA. Un
   bouton **« Prisme raconte »** en fait trois ou quatre phrases, vérifiées contre ces faits.
2. **Le bilan de la semaine.** Sur l'écran du bilan hebdo, **sous les chiffres**, le même bouton raconte
   la semaine close. La décision de la semaine reste en tête, inchangée (BILAN-01 : la décision
   d'abord).
3. **Le recours de la saisie en phrase.** Dans la saisie rapide existante (`meal-quick-entry`),
   l'analyse locale passe d'abord. Pour ce qu'elle ne comprend pas, **« Demander à Prisme »** : le modèle
   rend des aliments et des grammes, l'app les rapproche de sa base avec le même classement que la
   saisie locale, et les lignes rejoignent la même revue. Rien n'est écrit avant « Ajouter ».
4. **L'identité de Prisme** sur ces trois surfaces : le prisme doré, le nom, le badge « IA », « vérifié
   contre tes chiffres ».

**Hors périmètre** : la conversation et la barre du Labo (phase 2), la mémoire, la photo (PRISME-02),
l'accès testeurs (ACCES-IA), le second accord bien-être, NARR-01/CONS-01 (Q1), tout paywall, la
notification du soir, le streaming, iOS.

## 4. Surfaçage (ADR-007)

| Surface | Ce qui apparaît | Condition |
|---|---|---|
| Accueil, zone 1, dès 18 h | Carte « Ta journée » : les faits ; bouton « Prisme raconte » | Au moins un fait ; bouton si Prisme est visible (DD7) et la carte « humeur basse » n'est pas en cours (R12) |
| Bilan hebdo | Bloc « Prisme raconte ta semaine », **sous les chiffres** | Semaine non vide ; Prisme visible |
| Saisie rapide d'un repas | « Demander à Prisme » sous les lignes non reconnues | Au moins une ligne non reconnue ; Prisme visible |
| Réglages | Section **Prisme** : accord, fournisseur et pays, « ce qui part », retrait | Toujours (pour pouvoir retirer l'accord) ; dit « réservé aux 18 ans et plus » si besoin |
| Première utilisation | **Feuille d'accord** au premier geste | Accord absent ou donné à un autre fournisseur |

**Aucun widget, aucune notification, aucun texte généré d'office.**

## 5. Règles métier

**R1 — Le moteur calcule, Prisme raconte.** Aucun chiffre affiché ne vient du modèle. Seule exception
bornée : les grammes proposés par « Demander à Prisme », affichés avant écriture et modifiables (R8).

**R2 — Le garde-fou de NARR-01 s'applique à tout texte de Prisme.** Chaque nombre du texte doit venir du
dossier, à la tolérance d'arrondi près. Au premier nombre inconnu, le texte est **jeté en entier** et
l'écran le dit ; les faits restent affichés. Aucune seconde tentative automatique ; « Relancer » est un
geste, et il consomme le quota.

**R3 — Le garde-fou lit les nombres dans la langue du texte.** En anglais, « 12,480 kg » est un nombre
avec séparateur de milliers, pas 12,48. Sans ça, un « 12,900 » inventé passerait (12,9 contre 12,48,
sous la tolérance).

**R4 — Ce que l'écran affiche, et seulement ça, part.** Chaque dossier est un type fermé dans
`packages/shared` ; un test-garde échoue si un champ interdit y entre. **Ne partent jamais** : identité
(nom, e-mail, identifiant, date de naissance), **titres et noms saisis par l'utilisateur** (séances,
programmes, objectifs personnels : on envoie leur **type**), notes, trace GPS, journal ligne à ligne,
**tout le bien-être** (nuit, énergie, humeur, stress, modules), cycle, douleurs, mensurations,
silhouette, **toute donnée lue dans Health Connect** (pas, nuit).

**R5 — Toute différence qu'un texte voudra dire doit être dans le dossier.** « Il te manque 32 g »
n'est acceptable que si le moteur a calculé 32 et l'a mis dans le dossier. Un écart calculé par le
modèle, même juste, est refusé : c'est voulu.

**R6 — On consent à un destinataire précis.** La feuille d'accord dit d'abord que Prisme est une IA,
puis ce qui part, ce qui ne part jamais, **le fournisseur, son pays, s'il entraîne et ce qu'il
conserve** — lus dans `status`, jamais écrits en dur. Pour un fournisseur hors UE (Groq), elle dit
« aux États-Unis ». Si le fournisseur change, l'accord est redemandé au geste suivant.

**R7 — Sans Prisme, rien ne change.** Accord absent, hors ligne, quota épuisé, fournisseur indisponible,
compte mineur : les écrans sont ceux d'aujourd'hui ; la carte du soir garde ses faits.

**R8 — Rien ne s'écrit sans validation.** Les lignes proposées par Prisme rejoignent la revue de la
saisie rapide : aliment rapproché par `rankFoodMatches`, grammes modifiables, ligne la moins sûre
signalée, aliment introuvable sans valeur et non ajouté. Seul « Ajouter » écrit.

**R9 — Aucune calorie du modèle.** Il nomme des aliments **dans la langue de l'app** et estime des
grammes ; la base calcule.

**R10 — Ce qu'on écrit pour Prisme part tel quel, et seulement ça.** Le texte envoyé par « Demander à
Prisme » est **la partie non reconnue** de la phrase, 300 caractères au plus, montrée avant l'envoi.
C'est la seule exception à « aucun texte libre ».

**R11 — Rien n'est conservé côté serveur.** `ai_usage` reste un compteur. Le serveur ne journalise
jamais le contenu d'une réponse de fournisseur, y compris dans ses erreurs.

**R12 — Pas de reproche, et pas de texte à côté d'une détresse.** Une journée ou une semaine en mode vie
réelle se raconte avec douceur (consigne + recette). Quand l'humeur basse est **en cours** — le seuil de
BIEN-02, **sans** son délai de 14 jours ni la fermeture de la carte —, la carte du soir garde ses faits,
sans bouton.

**R13 — 18 ans et plus** (DD15). Le serveur refuse si la date de naissance connue donne moins de 18 ans.

**R14 — Toujours dire que c'est une IA** : badge « IA » et « vérifié contre tes chiffres » sur chaque
texte ; la feuille d'accord le dit en premier (transparence de l'AI Act).

**R15 — i18n.** Textes demandés dans la langue de l'app ; faits envoyés = libellés déjà traduits ;
« Prisme » non traduit.

**R16 — La décision reste celle du moteur.** Prisme peut citer la décision de BILAN-01, jamais en
proposer une autre (limite assumée de NARR-01 D4 : le garde-fou porte sur les nombres).

## 6. Les dossiers

### 6.1 Le dossier du soir (`EveningDossier`, neuf)

Tout ce qui part est **affiché** sur la carte ; la carte peut afficher davantage (le nom de la séance),
mais rien de plus ne part.

| Bloc | Envoyé | Présent si |
|---|---|---|
| Jour | libellé du jour (traduit) | toujours |
| Séances | par séance : **type** (musculation, course, autre activité), durée ; muscu : tonnage, séries faites / prévues, records ; course : distance, allure | une séance terminée aujourd'hui |
| Assiette | kcal et protéines consommées, leurs cibles, **les écarts aux cibles** (moteur), glucides, nombre de repas saisis | pilier Nutrition actif et au moins un repas |
| Semaine | activités faites / objectif de la semaine (SERIE-01) | objectif hebdo défini |
| Demain | **type** de la séance prévue, heure, distance prévue | une séance planifiée demain |
| Mode vie réelle | indicateur | période active |

Un bloc absent est **omis**, jamais mis à zéro (IA-LAB-01 R5).

### 6.2 Le dossier de la semaine (`WeekDossier`)

`buildWeekDossier(review, goals, activePillars, t)` : `WeeklyReview` ne porte ni les objectifs ni les
piliers actifs (ce sont des entrées du calcul) ; ils sont passés à part. N'est envoyé **que ce que
l'écran du bilan affiche** : période, par pilier actif les chiffres de la semaine et leur variation,
jours actifs, records battus, progression des objectifs **en pourcentage avec leur type** (pas leur nom
saisi), jours en mode vie réelle, et la décision de la semaine déjà traduite. Rien n'est recalculé.

### 6.3 « D'où ça vient »

Sous chaque texte, un dépliant liste **les blocs envoyés**, en clair (« Séance de musculation du jour ·
Assiette du jour, 3 repas · Semaine en cours · Demain »). C'est aussi la référence du critère de recette
sur « ce qui part ».

## 7. Cas limites

| Cas | Comportement |
|---|---|
| Avant 18 h | Pas de carte du soir |
| Journée sans aucun fait | Pas de carte (R12) |
| Le dîner est saisi après lecture | Le texte reste, marqué « ta journée a bougé depuis », avec « Relire » |
| Minuit, écran ouvert | La carte et son texte disparaissent avec la journée |
| Texte qui cite un nombre absent | Jeté ; « Prisme a écarté sa réponse : elle citait un chiffre absent de tes données » ; faits intacts |
| Texte vide, tronqué (`finish_reason: length`), > 500 caractères | Jeté comme inexploitable |
| Semaine vide | Pas de bouton (BILAN-01 D4) |
| Saisie rapide entièrement comprise | Pas de « Demander à Prisme » |
| Prisme ne reconnaît aucun aliment | « Prisme n'a reconnu aucun aliment » ; rien n'est ajouté |
| Plus de 12 aliments rendus | Les 12 premiers, coupés **avant** la validation ; « vérifie qu'il ne manque rien » |
| Réponse JSON invalide du fournisseur | Échec masqué (« Prisme n'a pas pu lire ce repas ») ; rien n'est journalisé du contenu (R11) |
| Hors ligne | Les entrées restent ; le geste dit « Prisme a besoin du réseau » ; rien n'est mis en file |
| App ouverte hors ligne, aucun statut connu | Les entrées dépendent de l'accord local : visibles si accordé, et disent « réseau requis » |
| Refus `consent_required` du serveur | Relire `status`, rouvrir la feuille d'accord |
| Fournisseur changé depuis l'accord | Feuille d'accord au geste suivant (R6) |
| Fournisseur configuré non autorisé (Gemini, Mistral sans opt-out) | `status` : indisponible ; rien de Prisme dans l'app |
| Deux appuis rapides | Un seul appel ; le quota est réservé atomiquement de toute façon |
| Quota épuisé | « Tu as utilisé les demandes du jour. Retour demain. » ; faits intacts |
| Accord retiré hors ligne | Pris en compte tout de suite dans l'app ; remonte au serveur au retour du réseau |
| Moins de 18 ans | Rien de Prisme ; Réglages dit « réservé aux 18 ans et plus » |

## 8. i18n (FR + EN)

Espace de clés **`prisme.*`** ; liste complète dans le plan et les locales.

| Clé | FR | EN |
|---|---|---|
| `prisme.badge` | « IA » | “AI” |
| `prisme.tell` | « Prisme raconte » | “Prisme tells it” |
| `prisme.reading` | « Prisme lit tes chiffres… » | “Prisme is reading your numbers…” |
| `prisme.verified` | « Vérifié contre tes chiffres » | “Checked against your numbers” |
| `prisme.rejected` | « Prisme a écarté sa réponse : elle citait un chiffre absent de tes données. » | “Prisme discarded its answer: it quoted a number that isn't in your data.” |
| `prisme.stale` | « Ta journée a bougé depuis ce texte. » | “Your day has changed since this text.” |
| `prisme.evening.title` | « Ta journée » | “Your day” |
| `prisme.week.title` | « Prisme raconte ta semaine » | “Prisme tells your week” |
| `prisme.meal.ask` | « Demander à Prisme » | “Ask Prisme” |
| `prisme.meal.roles` | « Prisme propose les aliments et les grammes ; l'app calcule. » | “Prisme suggests foods and grams; the app does the maths.” |
| `prisme.consent.title` | « Prisme lit tes chiffres et les raconte » | “Prisme reads your numbers and tells them” |
| `prisme.consent.where` | « Ils partent chez {{provider}} ({{country}}). » | “They go to {{provider}} ({{country}}).” |
| `prisme.consent.training.no` | « Il ne s'en sert pas pour entraîner ses modèles. » | “It doesn't use them to train its models.” |
| `prisme.consent.adult` | « J'ai 18 ans ou plus » | “I'm 18 or older” |
| `prisme.offline` | « Prisme a besoin du réseau. » | “Prisme needs a connection.” |
| `prisme.errors.*` | messages produit (quota, indisponible…) | — |

Le nom du fournisseur et son pays viennent de `status` ; les phrases sur l'entraînement et la
conservation sont choisies selon ses attributs (`trains`, `retention`), jamais écrites en dur pour un
fournisseur donné.

## 9. Comportement offline

Tout ce qui est calculé marche hors ligne, comme aujourd'hui. Prisme exige le réseau et le dit ; rien
n'est mis en file. L'accord se **retire** hors ligne ; il ne s'**accorde** qu'en ligne (DD3).

## 10. Modèle de données et serveur

- **1 migration** :
  - `user_settings` : `prisme_consent_at timestamptz`, `prisme_consent_provider text` ;
  - une fonction `ai_reserve_quota(kind, quota)` (incrément atomique, `security definer`, appelable par
    le seul rôle de service) et `ai_release_quota(kind)` pour rendre une réservation en cas d'échec.
- **PowerSync** : `user_settings` en `select *` — aucune sync rule à modifier ; les deux colonnes
  **doivent** être déclarées dans `schema.ts` et dans le mappage de `settings-repository.ts`, et leur
  remontée vérifiée dans le dashboard.
- **Fonction `ai-assist`** : `status` et `consent` traités avant tout contrôle de fournisseur ;
  `PRISME_PROVIDER` et sa liste d'autorisés (DD1) ; `narrate`, `meal_text` ; contrôle d'âge ; accord
  Prisme pour `narrate` et `meal_text`, accord Labo IA pour `coach` ; quotas réservés ; budgets de
  sortie par type ; aucune journalisation de contenu de réponse.
- **Le Labo IA** n'est touché que par la réservation atomique du quota, qui le protège aussi.
- **Gestes humains** : compte Groq (ou Mistral + opt-out vérifié + `MISTRAL_TRAINING_OPTOUT=verified`) ;
  `npx supabase secrets set …` ; `npx supabase functions deploy ai-assist --use-api` ; `npm run db:push`.

## 11. Play Store, Health Connect et confidentialité

🔴 **Couplé à LANCE-00 et LANCE-01.** Avant que le build soumis contienne Prisme :

- **ACCES-IA livrée** (bêta réservée aux testeurs) — sinon, une fois publiée, l'app ouvrirait l'IA à
  tous (~240 $/mois pour 1 000 utilisateurs, analyse §8) ;
- **politique de confidentialité** (texte publié **et** `legal.privacy` dans l'app) : Prisme est
  facultatif ; ce qui part (R4), vers qui, dans quel pays, sans entraînement ; la base du transfert hors
  UE si le fournisseur est américain (à faire trancher par la relecture juridique) ;
- **formulaire « Sécurité des données »** : données de santé et de forme (agrégats), facultatives, vers
  un sous-traitant — la qualification « partage » ou non est à faire trancher ;
- **Health Connect** : rien de ce qui en vient ne part (DD5) ; à confirmer par la même relecture.

À défaut, **Prisme est exclu du build de soumission**, comme le spike VBT (LANCE-02).

## 12. Accessibilité

- « Prisme raconte » et « Demander à Prisme » sont de vrais boutons (≥ 48 dp), état occupé annoncé.
- Le texte de Prisme et son refus sont des **régions vivantes**.
- Le prisme est décoratif ; le nom et le badge sont du texte.
- À 1,5× de police, rien n'est tronqué.

## 13. Ce que la relecture a changé (02/10/2026)

| Constat | Effet |
|---|---|
| Un rôle dans `user_roles` rend administrateur (`is_admin()`) | Accès testeurs sorti en ACCES-IA, avec une table dédiée |
| Rien n'empêchait de vraies données de partir chez un fournisseur qui entraîne | DD1 : `PRISME_PROVIDER` et sa liste d'autorisés ; Mistral conditionné à l'opt-out |
| Le dossier d'enquête porte la durée de sommeil | NARR-01/CONS-01 hors de cette US (Q1) ; rien du bien-être ne part (DD4) |
| La saisie en phrase existait déjà (4.5) | « Décrire » devient un recours dans `meal-quick-entry` |
| `shouldShowLowMoodCard` a un délai de 14 jours et se ferme | R12 : un prédicat « humeur basse en cours » |
| Date de naissance souvent absente, âge minimum de l'app 16 ans | DD15 : confirmation déclarative |
| Accord écrit en local, remonté en différé | DD3 : accord accordé par un appel serveur |
| Visibilité et réseau confondus | DD7 |
| `WeeklyReview` sans objectifs ni piliers actifs | §6.2 : signature élargie, envoi limité à l'affiché |
| Milliers en anglais mal lus par le garde-fou | R3 |
| Health Connect, transfert hors UE | DD5, R6, §11 |
| Quota contournable par appels simultanés | DD9 : réservation atomique |
| Budget de sortie et erreurs JSON de Groq | plan, étape 4 |
| Titres de séance en texte libre | R4 : on envoie le type |
| Texte de Prisme au-dessus de la décision | sous les chiffres |
| Photo sans redimensionnement, indisponible sous Groq | PRISME-02 |

## 14. Critères de recette (device)

1. Sans accord Prisme : accueil, bilan hebdo, saisie rapide **identiques** à avant, sauf les entrées
   qui ouvrent la feuille d'accord.
2. La feuille d'accord dit « IA » en premier, nomme le fournisseur réel et son pays (« aux États-Unis »
   pour Groq) ; date de naissance absente → la case « 18 ans ou plus » est exigée.
3. « Activer » puis « Prisme raconte » tout de suite : pas de refus du serveur.
4. Après 18 h, avec une séance et deux repas saisis : la carte « Ta journée » montre ses faits.
5. « Prisme raconte » rend trois ou quatre phrases ; chaque nombre du texte est visible dans les faits ;
   « D'où ça vient » liste les blocs envoyés, **sans** nuit, pas, ni nom de séance.
6. Saisir un repas après lecture : « ta journée a bougé depuis », « Relire » relance.
7. Bilan hebdo : le texte est sous les chiffres, raconte la semaine et cite la décision sans en
   inventer une autre.
8. **Refus du garde-fou** : en build de développement, l'option « simuler un chiffre inventé » fait
   rejeter le texte ; message et faits intacts.
9. EN : un texte avec « 12,480 kg » passe quand le dossier porte 12 480 ; « 12,900 kg » est rejeté.
10. Saisie rapide d'une phrase dont une partie reste « non trouvé » localement (ex. « un yaourt et le
    reste du plat de dimanche ») : seule la partie non trouvée part avec « Demander à Prisme », et elle
    est montrée avant l'envoi ; les lignes rendues rejoignent la revue ; rien d'écrit avant « Ajouter ».
11. Un aliment introuvable reste sans valeur et n'est pas ajouté.
12. Mode vie réelle actif : sur **trois tirages**, aucun texte du soir ne contient de reproche (grille
    du plan).
13. Humeur basse en cours (5 humeurs à 1-2 sur les 7 dernières) : pas de bouton, même après avoir
    fermé la carte du hub Bien-être.
14. Compte de moins de 18 ans : rien de Prisme ; Réglages le dit.
15. Deux appuis rapides sur « Prisme raconte » : un seul appel, un seul décompte.
16. Quota épuisé, mode avion : message clair, faits intacts ; hors ligne, les entrées restent.
17. `PRISME_PROVIDER=gemini` (ou Mistral sans opt-out) : `status` dit indisponible, rien de Prisme.
18. Changer `PRISME_PROVIDER` (Groq → Mistral vérifié) : l'accord est redemandé au geste suivant.
19. Le Labo IA marche comme avant (`AI_PROVIDER`, son accord, son quota).
20. FR et EN : textes dans la langue de l'app, « Prisme » non traduit ; TalkBack lit le texte dès son
    apparition ; à 1,5× de police rien n'est coupé.
