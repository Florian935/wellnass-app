---
id: ACCES-IA
titre: "Prisme réservé aux testeurs — un interrupteur serveur et une table dédiée, gérée depuis le back-office"
roadmap: [7.43]
catalogue: []
etape: close
branche: feature/acces-ia-testeurs
maj: 23/10/2026
---

# US ACCES-IA — Prisme réservé aux testeurs

> **Demande** : Florian, 23/10/2026 — reprendre la ligne ACCES-IA du [BACKLOG](../../../../BACKLOG.md)
> (P1), suite de [PRISME-01](prisme01-prisme-raconte.md) §11 : avant que Prisme entre dans le build Play,
> l'IA ne doit s'ouvrir qu'aux testeurs. Sinon elle s'ouvre à tous (~240 $/mois pour 1 000 utilisateurs,
> [analyse](../../../product/analyse-assistant-prisme-2026-10.md) §8).
> **Plan** : [docs/plans/acces-ia-testeurs.md](../../../plans/acces-ia-testeurs.md).
> **Maquette** : [design/acces-ia-testeurs/](../../../../design/acces-ia-testeurs/) — toile en ligne :
> https://claude.ai/artifact/28oTXd2EK8pFvm2ZKXRyUZ
> **Roadmap** : 7.43 (ligne neuve, section « Hors périmètre de cadrage »).
> **Vérifié dans le code** le 23/10/2026 sur `origin/dev` (`d604dec2`) ; **relue** le même jour par un
> agent de revue : 1 bloquant et 20 autres constats, intégrés dans cette version (§15).
> ✅ **Spec, plan et maquette validés par Florian le 23/10/2026** (« Je valide, go ») — **QA1 et QA2
> telles que proposées** : le Labo IA passe sous le même verrou, et `ai_testers` reste hors de l'export
> RGPD de l'app.
> ✅ **Clôturée le 23/10/2026** dans le commit qui livre le code (règle « recette à la demande »).
> 🛠️ **Codée le 23/10/2026**, en un lot (règle partagée et sa copie gardée, migration, fonction,
> back-office, app, Labo IA). Écarts au plan — des moyens, pas des règles — en fin de plan. **Reste à
> déployer**, avec l'accord de Florian (§12) : `db:push` + `db:types`, la liste remplie au back-office,
> puis la fonction `ai-assist`. Aucune sync rule, aucun build natif.

## 0. Le besoin

Prisme est servi par la fonction `ai-assist` à **quiconque** a donné son accord. Tant que l'app ne
circule qu'en APK entre la famille et les amis, c'est sans conséquence. Publiée sur le Play Store, elle
ouvrirait l'IA à tous : la facture d'un fournisseur payant (~240 $/mois pour 1 000 utilisateurs), ou
l'épuisement du palier gratuit — aujourd'hui celui de Mistral, commun à tout le projet, qui ne tient
qu'une poignée de testeurs actifs (analyse §7).

Il faut donc un **verrou côté serveur** — un interrupteur `open` / `testers` — et une **liste de
testeurs** que Florian ou Damien tiennent depuis le back-office, sans SQL. Un non-testeur ne voit rien
de Prisme : pas de bouton mort, pas de section vide.

## 1. Ce que dit le code

| Constat | Où | Conséquence |
|---|---|---|
| `ai-assist` vérifie le JWT, l'accord, l'âge, le fournisseur, la taille et le quota — **jamais qui est autorisé** | [index.ts](../../../../supabase/functions/ai-assist/index.ts) | Le verrou entre dans la fonction, avant tout appel au modèle et avant le quota. |
| `status` est traité **avant** tout contrôle de fournisseur, gratuit, non décompté ; `consent` renvoie lui aussi un statut | index.ts, `prismeStatus`, `prismeConsent` | C'est `status` qui dira « bêta fermée » : l'app sait déjà se taire quand `available` est faux. |
| Toutes les surfaces Prisme passent par `usePrismeVisibility().visible` | `EveningCard`, `PrismeWeek`, `PrismeMealRecourse` | Un statut « fermé » les éteint **sans toucher** aux écrans Accueil, Bilan ni Saisie rapide. |
| La section Réglages › Prisme est **toujours visible** (pour retirer l'accord) ; sans statut connu, elle dit « il faut le réseau » | [PrismeSettingsSection.tsx](../../../../apps/mobile/src/components/prisme/PrismeSettingsSection.tsx) | Elle doit apprendre à disparaître, sauf s'il reste un accord à retirer. |
| L'accord au **Labo IA** s'écrit **en local** (`updateSettings({ aiConsentAt })`), sans le serveur, et la section est toujours montée | [AiLabSection.tsx](../../../../apps/mobile/src/components/AiLabSection.tsx) | Hors ligne, un non-testeur pourrait créer seul un accord : la section ne doit s'offrir qu'à un accès **confirmé** (D15). |
| Le Labo IA (`coach`, et `photo` / `ask` dormants) suit `AI_PROVIDER`, Gemini gratuit compris ; NARR-01 et CONS-01 y envoient le **vrai** dossier du Labo | index.ts, `narrate.ts`, `LabWhyPanel` (`canNarrate`), `CouncilSheet` | Dans un build public, n'importe qui pourrait envoyer ses vraies données à un fournisseur qui entraîne ses modèles (QA1). |
| `is_admin()` vaut vrai pour **n'importe quelle ligne** de `user_roles` | migration `20260713100000_admin_user_roles.sql` | Un « rôle testeur » rendrait administrateur : table **dédiée** (relecture PRISME-01 du 02/10/2026). |
| `audit_log` est en **ajout seul** (déclencheurs qui refusent toute modification et suppression) et la purge des comptes ne le touche pas | migrations `admin_audit_log`, `conf02_account_deletion` | Le journal ne doit porter **aucun e-mail** d'utilisateur : il y resterait à vie (D12). |
| Les précédents d'audit nomment un compte par son **identifiant** (`role.grant`, `user.ban`) | `apps/admin/src/data/roles.ts`, `users.ts` | Même règle ici. |
| PostgREST lit `*` comme un joker dans `like` / `ilike`, et `*`, `_`, `%` sont permis dans un e-mail | — | Retrouver un compte par e-mail se fait **côté serveur**, par égalité (D7). |
| Le store de Prisme n'est **pas** remis à zéro à la déconnexion | `stores/prisme-store.ts`, `stores/auth-store.ts` | Sur un téléphone partagé, le statut d'un testeur survivrait au compte suivant (D17). |
| Une table neuve de `public` n'est plus exposée d'office aux rôles de l'API | `config.toml`, `auto_expose_new_tables` (définitif le 30/10/2026) | Droits **explicites** dans la migration, `service_role` compris (leçon NORYN-01). |
| Le test de complétude de l'export RGPD lit **le schéma PowerSync** de l'app, et seulement lui | `data-export.test.ts` | Il ne verra `ai_testers` **que si** la table est synchronisée — voir D9 et QA2. |
| `user_bans.acted_by` bloquait la purge d'un compte admin supprimé, corrigé en `on delete set null` | migration `conf02_account_deletion` | `ai_testers.added_by` naît en `set null`. |

## 2. Décisions — validées le 23/10/2026

| # | Décision | Pourquoi |
|---|---|---|
| **D1** | **Un secret de la fonction, `AI_ACCESS`**, comme `PRISME_PROVIDER`. Deux valeurs : `testers` et `open`. **Absent ou inconnu → `testers`.** | Un oubli ou une faute de frappe doit fermer, pas ouvrir : c'est une protection de coût. Changer de mode = `npx supabase secrets set AI_ACCESS=…`, sans toucher à l'app. |
| **D2 — QA1** | **Le verrou couvre toute la fonction** : Prisme (`narrate`, `meal_text`, l'accord) **et le Labo IA** (`coach`, `photo`, `ask`). Côté app, la section Réglages › Labo IA, « Résumer le dossier » (NARR-01) et le récit du Conseil des trois (CONS-01) suivent. | Le Labo IA envoie aujourd'hui de vraies données à un fournisseur qui entraîne ses modèles, sous un accord qui dit « données factices » (PRISME-01, question Q1). Dans un build public, c'est un problème de confidentialité, pas seulement de coût. L'analyse §8 range déjà « Enquête racontée » dans la colonne « testeurs ». *Alternative* : verrouiller Prisme seul et retirer le Labo IA du build de soumission, comme le spike VBT (LANCE-02). |
| **D3** | Restent ouverts à tous : **`status`** (c'est lui qui dit « bêta fermée ») et le **retrait** d'un accord (`consent` avec `grant: false`). | Retirer un accord doit rester aussi simple que le donner (RGPD), y compris pour un testeur retiré de la liste. |
| **D4** | `status` répond, dans cet ordre : **bêta fermée** → âge → fournisseur. À un non-testeur, il ne dit rien d'autre. | Un non-testeur mineur ne doit pas voir « Prisme est réservé aux 18 ans et plus » : ce serait encore « quelque chose de Prisme ». |
| **D5** | `status` gagne un champ **`access`** (`open` / `testers`), facultatif dans le schéma de l'app. | Il sert deux fois : les Réglages d'un testeur disent « bêta fermée — tu fais partie des testeurs », et le back-office affiche le mode réellement en service. Facultatif : une app récente doit lire une fonction pas encore redéployée. |
| **D6** | **Table dédiée `ai_testers`** — jamais `user_roles`. Une ligne active par compte au plus, retrait en *soft delete*, ré-ajout = **nouvelle ligne** (la date « testeur depuis » reste juste ; l'historique vit dans le journal d'audit). | Être testeur n'est pas un droit d'administration. Une table à part ne peut pas, par construction, rendre `is_admin()` vrai. |
| **D7** | **Aucune écriture directe** : trois fonctions SQL `security definer` (patron `ban_user`) — `grant_ai_tester(target_user_id)` pour la fiche, `grant_ai_tester_by_email(target_email)` pour l'écran, qui retrouve le compte **par égalité** sur l'e-mail (casse et espaces ignorés), et `revoke_ai_tester(target_user_id)`. Lecture par une **vue** `admin_ai_testers`. La table n'est lisible que par la fonction Edge (`service_role`). | `added_by` est posé par le serveur (impossible à usurper), l'ajout est atomique, un e-mail ne désigne jamais un autre compte (pas de motif `ilike`), et la table reste invisible pour l'app. |
| **D8** | **Qui gère la liste : super_admin et modérateur** (`can_manage_users()`), comme la consultation et le bannissement des utilisateurs. *Alternative* : super_admin seul, comme les rôles. | C'est une action sur un compte utilisateur. Chaque ajout reste borné par les quotas du compte : 6 bilans et 6 repas par jour chez le fournisseur de Prisme, et, avec QA1, 20 questions par jour au Labo IA, sur le palier gratuit de Gemini, partagé par tout le projet. |
| **D9** | **`ai_testers` n'est pas synchronisée par PowerSync.** L'app l'apprend par `status`. | ① La ligne seule ne dit rien : en mode `open`, un non-testeur a accès, et le mode n'existe que sur le serveur. ② Une table synchronisée, c'est une sync rule à coller à la main (oubliée trois fois) pour un booléen. ③ Elle porterait `added_by`, l'identifiant d'un administrateur. ④ Même famille que `user_roles`, `user_bans`, `audit_log`, `ai_usage` : aucune n'est sur le téléphone. |
| **D10 — QA2** | **Export RGPD** : `ai_testers` **n'entre pas** dans l'export de l'app, et le test de complétude ne la verra pas (il ne lit que le schéma PowerSync, D9). Le statut de testeur est **dit dans l'app** (Réglages, D5), mentionné dans la politique de confidentialité, et fourni sur demande (droit d'accès). Les tables serveur à donnée personnelle (`ai_testers`, `ai_usage`, `user_bans`, `account_deletion_requests`, `sync_receipts`) passent au BACKLOG, en dette, pour un arbitrage d'ensemble. | La portabilité (art. 20) porte sur les données **fournies par l'utilisateur** ; être testeur est une décision de l'éditeur. Le droit d'accès (art. 15), lui, couvre tout — il se sert sur demande, comme aujourd'hui pour `ai_usage`. *Alternative* : synchroniser la table en lecture seule (sans `added_by`) pour qu'elle entre dans l'export et sous le test — au prix de D9 ②. |
| **D11** | Côté back-office : un **écran « Testeurs IA »** (mode en service, liste, ajout par e-mail, retrait, usage des 7 derniers jours) et un **bloc « Bêta IA »** dans la fiche d'un utilisateur. | La liste se tient d'un coup d'œil ; la fiche répond à « est-ce que Paul est testeur ? » là où on le cherche déjà. |
| **D12** | **Journal d'audit (8.10)** : deux actions, `ai_tester.grant` et `ai_tester.revoke`. Cible = **l'identifiant du compte** (`auth.users`), **jamais son e-mail**. Rien n'est journalisé quand rien n'est écrit (déjà testeur, déjà retiré, compte introuvable). | Le journal est en ajout seul et survit à la suppression du compte : un e-mail y resterait à vie, contre la « purge totale » de CONF-02. Même règle que `role.grant` et `user.ban`. |
| **D13** | Un changement de liste vaut **tout de suite côté serveur**, et **au prochain démarrage** côté app (le statut est lu une fois par session, PRISME-01 DD6). Un testeur retiré pendant une session le découvre à son geste suivant : la surface du geste dit « bêta fermée » ; tout disparaît au démarrage suivant. | Relire le statut à chaque écran coûterait un appel réseau pour un cas rare. Et le relire **au moment du refus** démonterait la surface du geste avec son message : le bouton disparaîtrait sans un mot. Le back-office prévient au moment de l'ajout et du retrait. |
| **D14** | **Ordre de déploiement** : migration → ajout des testeurs au back-office → fonction. | D1 ferme par défaut : déployer la fonction avant d'avoir rempli la liste éteindrait Prisme chez les testeurs actuels. |
| **D15** | **Trois états d'accès dans l'app** : `allowed` (statut connu, pas fermé), `closed` (statut « bêta fermée »), `unknown` (pas encore de statut : hors ligne, premier rendu, appel en échec, app ancienne). Chaque surface suit le tableau du §4.1. Tant que l'état est `unknown`, l'écran suivant qui en a besoin **redemande** le statut (une seule requête à la fois). | Hors ligne, `closed` ne se sait pas. Les surfaces Prisme gardent la règle de PRISME-01 (l'accord local décide, DD7) ; le **Labo IA**, dont l'accord s'écrit en local, ne s'offre qu'à un accès confirmé — hors ligne il n'a de toute façon rien à faire. |
| **D16** | Si la liste est **illisible** côté serveur (erreur de base), les appels au modèle et l'accord sont refusés en **indisponible** (`ai_unavailable`), et `status` répond une **erreur** — l'app reste sur `unknown`. | Fermer, oui ; mais dire « bêta fermée » à un testeur à cause d'une panne lui montrerait « pas ouvert sur ton compte » pour toute la session. |
| **D17** | Le statut de Prisme en mémoire est **effacé à la déconnexion** (et à tout changement de compte) ; une demande partie avant n'écrit plus rien à son retour. | Sur un téléphone partagé, le compte suivant hériterait du statut du précédent jusqu'à son premier geste. |

QA1 et QA2 sont les deux décisions qui changent le périmètre ; les autres découlent de la demande et de
la relecture. Sans QA1, les lignes et critères marqués *(QA1)* tombent.

## 3. Ce que fait la fonctionnalité

1. **Le serveur décide.** Avec `AI_ACCESS=testers` (ou rien), seuls les comptes de `ai_testers` passent :
   les autres reçoivent « bêta fermée » à `status`, et un refus `ai_closed` à tout appel au modèle et à
   tout accord — **avant** le fournisseur et **avant** le quota. Avec `AI_ACCESS=open`, la liste est
   ignorée : comportement de PRISME-01.
2. **L'app se tait.** Un non-testeur ne voit rien de Prisme ni du Labo IA : ni bouton, ni section —
   sauf de quoi retirer un accord qui resterait (§4.3), et le message d'un geste refusé en cours de
   session (R10). La carte « Ta journée » garde ses faits (ils ne sont pas de l'IA, PRISME-01 R7).
3. **Un testeur le sait.** Dans Réglages › Prisme, une ligne « Bêta fermée — tu fais partie des
   testeurs. »
4. **Le back-office tient la liste.** Ajouter par e-mail, retirer, voir qui s'en sert ; chaque geste
   est journalisé.

## 4. Surfaçage

### 4.1 App — chaque surface selon l'état d'accès (D15)

| Surface | `allowed` | `closed` | `unknown` |
|---|---|---|---|
| Accueil, dès 18 h — « Prisme raconte » dans « Ta journée » | comme PRISME-01 | **absent** (les faits restent) | l'accord local décide (PRISME-01 DD7) |
| Bilan hebdo — « Prisme raconte ta semaine » | comme PRISME-01 | **absent** | l'accord local décide |
| Saisie rapide — « Demander à Prisme » | comme PRISME-01 | **absent** | l'accord local décide |
| Réglages › Prisme | comme PRISME-01, plus la ligne « bêta » si `access = testers` | **absente** ; **réduite au retrait** s'il reste un accord (§4.3) | **absente** sans accord ; avec un accord, comme aujourd'hui (« il faut le réseau », « Vérifier à nouveau ») |
| Réglages › Labo IA *(QA1)* | comme IA-LAB-01 | **absente** ; réduite au retrait s'il reste un accord | **absente** sans accord ; avec un accord, l'interrupteur (pour le retirer) |
| Labo › Apprendre — « Résumer le dossier » (NARR-01) *(QA1)* | si accord Labo IA | **absent** | **absent** |
| Conseil des trois — le récit (CONS-01) *(QA1)* | si accord Labo IA | **absent** | **absent** |
| Écran Labo IA (`/ai-lab`, lien direct) *(QA1)* | formulaire | « réservé aux testeurs », sans formulaire | « il faut le réseau », sans formulaire |

Aucun écran Accueil, Bilan, Saisie rapide, Muscu ni Nutrition n'est modifié : ces surfaces suivent
déjà `usePrismeVisibility().visible`.

### 4.2 App — testeur, mode `testers`

Tout est identique à PRISME-01, plus la ligne « Bêta fermée — tu fais partie des testeurs. » dans
Réglages › Prisme.

### 4.3 Le cas de l'accord orphelin

Un compte peut porter un accord sans être testeur : accord donné **avant** ACCES-IA, ou testeur
**retiré** de la liste. Rien ne part (le serveur refuse), mais l'accord doit pouvoir être retiré.
Réglages › Prisme se réduit alors à une carte : « Prisme est en bêta fermée et n'est pas ouvert sur
ton compte. Ton accord du {date} reste enregistré : tu peux le retirer. » et un bouton « Retirer mon
accord » — un bouton plutôt qu'un interrupteur allumé, qui laisserait croire que Prisme marche et se
lirait à l'envers au lecteur d'écran. Le retrait s'écrit en local (PRISME-01 DD3) ; la section
disparaît. Même règle pour le Labo IA *(QA1)*.

### 4.4 Back-office

| Écran | Contenu | Accès |
|---|---|---|
| **Testeurs IA** (`/ai-testers`, menu latéral) | Bandeau du mode en service ; ajout par e-mail ; liste (e-mail, prénom, testeur depuis, ajouté par, dernière utilisation, appels sur 7 jours) ; « Retirer » avec confirmation | `can_manage_users()` (D8) |
| **Fiche utilisateur** — bloc « Bêta IA » | « Testeur depuis le JJ/MM/AAAA » ou « Pas testeur », et le bouton inverse (retrait confirmé) | idem |
| **Journal d'audit** | deux actions de plus dans le filtre et les libellés ; cible affichée = `auth.users` + identifiant (D12) | super_admin (inchangé) |

## 5. Règles métier

**R1 — Le serveur fait foi.** L'app ne fait que se taire ; elle ne décide jamais seule qu'un compte
est testeur. Un client modifié qui afficherait les boutons n'obtiendrait que des refus.

**R2 — Fermé par défaut.** `AI_ACCESS` absent, vide ou inconnu vaut `testers` (D1). Seule la valeur
`open` (casse et espaces ignorés) ouvre. Une liste illisible refuse aussi, en « indisponible » (D16).

**R3 — Le verrou passe avant le fournisseur et avant le quota.** Un non-testeur ne consomme ni quota,
ni appel au fournisseur, ni lecture du dossier.

**R4 — Ce qui reste ouvert** : `status`, et le retrait d'un accord (`consent` avec `grant: false`)
(D3). Tout le reste exige d'être testeur en mode `testers` : accorder l'accord à Prisme, `consent` sans
`grant` (refusé en `ai_closed` avant même d'être jugé mal formé), `narrate`, `meal_text`, et *(QA1)*
`coach`, `photo`, `ask`. Un type d'appel futur est fermé tant qu'il n'est pas explicitement ouvert.

**R5 — Ordre de `status`** : bêta fermée, puis âge, puis fournisseur (D4). La réponse « fermée » porte
`available: false`, `reason: 'closed'`, `provider: null`, l'accord, les restes du jour, et `access`.
`consent` renvoie un statut construit de la même façon.

**R6 — Testeur ≠ administrateur.** Rien dans `ai_testers` n'entre dans `is_admin()`,
`is_super_admin()` ni `can_manage_users()`. Un testeur qui se connecte au back-office reçoit « Accès
refusé ».

**R7 — Une ligne active par compte.** Ajouter un testeur déjà actif ne change rien et ne journalise
rien. Ajouter un e-mail sans compte ne crée rien et ne journalise rien.

**R8 — La liste s'écrit par le serveur, au nom de l'administrateur.** `added_by` = l'appelant, posé
par la fonction SQL ; jamais fourni par le client.

**R9 — Rien de l'IA n'est montré à qui ne peut pas s'en servir** — sauf le retrait d'un accord
orphelin (§4.3) et le message d'un geste refusé (R10).

**R10 — Un changement de liste est pris en compte par l'app au démarrage suivant** (D13). Un refus
`ai_closed` reçu en cours de session s'affiche **sur la surface du geste**, sans relire le statut :
« Prisme est en bêta fermée : il n'est pas ouvert sur ton compte. » pour Prisme (bilan, repas, feuille
d'accord), « Le Labo IA est réservé aux testeurs de la bêta. » pour le Labo IA *(QA1)* (résumé du
dossier, récit du Conseil, écran du labo).

**R11 — Le compte supprimé emporte sa ligne** (`on delete cascade`). L'administrateur supprimé ne bloque
rien : `added_by` passe à `null`. Le journal d'audit ne garde que des identifiants (D12).

## 6. Le serveur

| Appel | Non-testeur, mode `testers` | Testeur, ou mode `open` | Liste illisible (D16) |
|---|---|---|---|
| `status` | 200 `{ available: false, reason: 'closed', provider: null, consent, remaining, access: 'testers' }` | comme PRISME-01, plus `access` | 503 `{ error: 'ai_unavailable' }` |
| `consent`, `grant: true` ou absent | 403 `{ error: 'ai_closed' }` | comme PRISME-01 | 503 `ai_unavailable` |
| `consent`, `grant: false` | comme PRISME-01 (retrait accepté) | comme PRISME-01 | comme PRISME-01 |
| `narrate`, `meal_text` | 403 `{ error: 'ai_closed' }`, sans quota | comme PRISME-01 | 503 `ai_unavailable`, sans quota |
| `coach`, `photo`, `ask` *(QA1)* | 403 `{ error: 'ai_closed' }`, sans quota | comme IA-LAB-01 | 503 `ai_unavailable`, sans quota |

- La lecture de `ai_testers` n'a lieu qu'en mode `testers` (une requête indexée par appel).
- Une erreur de lecture se journalise **sans aucun contenu**.
- La règle (lecture de `AI_ACCESS`, verdict par type d'appel, ordre de `status`) est **pure** et
  **testée** ; la fonction en porte une copie qu'un test-garde compare au texte près (plan, étape 2).

## 7. Modèle de données

**Une migration**, strictement additive :

- **Table `ai_testers`** : `id`, `user_id` (→ `auth.users`, `on delete cascade`), `added_by`
  (→ `auth.users`, `on delete set null`), `created_at`, `updated_at`, `deleted_at`. Index unique
  partiel sur `user_id` `where deleted_at is null`. RLS activée **sans politique**, droits retirés à
  `anon` et `authenticated`, `select` **explicite** à `service_role`.
- **`grant_ai_tester(target_user_id)`** → `'added'` | `'already'` ;
  **`grant_ai_tester_by_email(target_email)`** → `(outcome, user_id)` avec `outcome` ∈ `'added'` |
  `'already'` | `'not_found'` ; **`revoke_ai_tester(target_user_id)`** → `'removed'` | `'absent'`.
  `security definer`, première instruction : `can_manage_users()`. `execute` à `authenticated` seul.
- **Vue `admin_ai_testers`** (`security_barrier`, `where can_manage_users()`) : testeurs actifs avec
  e-mail, prénom, date, e-mail de l'ajouteur, dernière utilisation et appels des 7 derniers jours (lus
  dans `ai_usage`). Le *Security Advisor* de Supabase la signalera, comme il signale déjà `admin_users`
  (vue aux droits du propriétaire qui lit `auth.users`) : connu et accepté, la seule barrière est le
  `where`.
- **PowerSync** : rien — ni publication, ni sync rule, ni schéma local (D9).
- **Export RGPD** : rien dans l'export de l'app (D10, QA2) ; ligne de dette au BACKLOG.
- **Suppression de compte** : couverte par les clés étrangères (R11) — `purge_expired_accounts` supprime
  `auth.users`, la cascade fait le reste.

## 8. Cas limites

| Cas | Comportement |
|---|---|
| `AI_ACCESS` absent, liste vide | Prisme et le Labo IA éteints pour tous — c'est l'état sûr (D1, D14) |
| `AI_ACCESS=Open ` (casse, espaces) | Ouvert |
| `AI_ACCESS=ouvert` (faute) | Fermé |
| Ajout d'un e-mail sans compte | « Aucun compte avec cet e-mail » ; rien n'est écrit ni journalisé |
| Ajout d'un e-mail déjà testeur | « Déjà testeur » ; rien n'est écrit ni journalisé |
| E-mail saisi avec majuscules ou espaces | Reconnu (égalité sans casse, espaces retirés, côté serveur) |
| E-mail contenant `*`, `_` ou `%` | Comparé par égalité, jamais comme motif : jamais un autre compte |
| Deux ajouts simultanés du même compte | Une seule ligne active (index unique) ; le second répond « déjà testeur » |
| Retrait d'un testeur déjà retiré | Rien n'est écrit ni journalisé |
| Testeur retiré pendant que l'app est ouverte | Les entrées restent ; le geste suivant reçoit « bêta fermée » et le dit sur sa surface, sans rien consommer ; tout disparaît au démarrage suivant (R10) |
| Testeur ajouté pendant que l'app est ouverte | Prisme apparaît au prochain démarrage (D13) ; le back-office le dit |
| Non-testeur avec accord orphelin | Carte réduite au retrait (§4.3) |
| Démarrage hors ligne, non-testeur sans accord | Rien de Prisme ni du Labo IA (`unknown` sans accord, §4.1) ; le statut est redemandé à l'écran suivant |
| Démarrage hors ligne, accord orphelin | Entrées Prisme visibles « réseau requis », section Réglages comme aujourd'hui, jusqu'au premier statut, qui les éteint |
| Hors ligne, non-testeur, Labo IA | Section absente sans accord : pas d'accord créé hors ligne (D15) |
| Liste illisible côté serveur | Appels refusés en « indisponible » ; l'app reste sur `unknown` (D16) |
| Téléphone partagé : un testeur se déconnecte, un non-testeur se connecte | Statut effacé à la déconnexion (D17) ; le nouveau compte relit le sien |
| Fonction pas encore redéployée, app récente | Pas de champ `access` : pas de ligne « bêta » ; le back-office dit « mode inconnu » ; comportement de PRISME-01 |
| App ancienne (APK de la famille), fonction redéployée, non-testeur | Le statut « fermé » est rejeté par l'ancien schéma : Réglages › Prisme reste sur « il faut le réseau », le Labo IA reste visible et activable, et un refus `ai_closed` s'affiche « Prisme n'a pas pu répondre ». **Rien ne part** : le serveur refuse. Disparaît avec la mise à jour de l'APK |
| Testeur mineur | `status` dit « âge » (D4) : comme PRISME-01 |
| Testeur banni | Ne peut plus se connecter ; sa ligne reste, inerte |
| Compte supprimé | Sa ligne disparaît avec lui (R11) |
| Administrateur supprimé | Les lignes qu'il a ajoutées restent, `added_by` à `null`, « ajouté par » affiche « — » |
| Mode `open` | La liste est ignorée ; le back-office l'écrit en tête de l'écran |

## 9. i18n

**App (FR + EN)**, espaces `prisme.*` et `aiLab.*` :

| Clé | FR | EN |
|---|---|---|
| `prisme.settings.betaTester` | « Bêta fermée — tu fais partie des testeurs. » | “Closed beta — you're one of the testers.” |
| `prisme.settings.closed` | « Prisme est en bêta fermée et n'est pas ouvert sur ton compte. Ton accord du {{date}} reste enregistré : tu peux le retirer. » | “Prisme is in closed beta and isn't open on your account. Your consent from {{date}} is still on record: you can withdraw it.” |
| `prisme.settings.withdraw` | « Retirer mon accord » | “Withdraw my consent” |
| `prisme.errors.closed` | « Prisme est en bêta fermée : il n'est pas ouvert sur ton compte. » | “Prisme is in closed beta: it isn't open on your account.” |
| `aiLab.settings.closed` *(QA1)* | « Le Labo IA est réservé aux testeurs de la bêta. Ton accord reste enregistré : tu peux le retirer. » | “The AI lab is for beta testers only. Your consent is still on record: you can withdraw it.” |
| `aiLab.settings.withdraw` *(QA1)* | « Retirer mon accord » | “Withdraw my consent” |
| `aiLab.closed` *(QA1)* | « Le Labo IA est réservé aux testeurs de la bêta. » | “The AI lab is for beta testers only.” |
| `aiLab.unknown` *(QA1)* | « Il faut le réseau pour vérifier ton accès au Labo IA. » | “A connection is needed to check your access to the AI lab.” |
| `aiLab.errors.closed` *(QA1)* | « Le Labo IA est réservé aux testeurs de la bêta. » | “The AI lab is for beta testers only.” |
| `aiLab.errors.not-allowed`, `adult-required`, `settings-missing` | manquants aujourd'hui ; ajoutés (§14, critère 12) | — |

« Prisme » reste non traduit (PRISME-01 DD13). **Back-office** : français seul, comme tout `apps/admin`
(`fr.ts`) — espace `aiTesters.*`, bloc `users.aiBeta.*`, deux libellés `audit.action.ai_tester.*`.

## 10. Comportement offline

Rien de nouveau ne s'écrit sur l'appareil, hormis le retrait d'un accord, qui s'écrit en local même hors
ligne et remonte à la synchronisation. Hors ligne au démarrage, l'état d'accès est `unknown` (D15) :
les surfaces Prisme suivent l'accord local, comme aujourd'hui ; un non-testeur n'en a pas, puisque
l'accord à Prisme ne s'accorde que par le serveur, qui le refuse. Le Labo IA, dont l'accord s'écrit en
local, ne s'offre pas tant que l'accès n'est pas confirmé. Le statut est redemandé tant qu'il est
inconnu. Le back-office est en ligne par nature.

## 11. Accessibilité

- App : la carte réduite est une région ordinaire ; « Retirer mon accord » est un vrai bouton (≥ 48 dp) ;
  le message « bêta fermée » d'un geste refusé est une région vivante ; aucune nouvelle couleur.
- Back-office : en-têtes de colonnes, champ e-mail étiqueté, messages en `role="alert"` /
  `role="status"` (patron `RolesScreen`), confirmation avant tout retrait.

## 12. Déploiement — gestes humains, avec l'accord de Florian

1. `npm run db:push` (la migration), puis `npm run db:types`.
2. Back-office (local) : ajouter les testeurs actuels — Florian, Damien, la famille.
3. `npx supabase functions deploy ai-assist --use-api` ; `AI_ACCESS` reste absent (= `testers`).
4. `npx supabase secrets set AI_ACCESS=open` / `testers` pour basculer, sans redéploiement.

Aucune sync rule, aucun build natif : un APK de développement suffit pour voir l'app se taire.

## 13. Hors périmètre

- Le contenu de la politique de confidentialité et du formulaire « Sécurité des données » (LANCE-00) —
  une phrase est seulement ajoutée au brouillon (plan, étape 9).
- PRISME-01b (NARR-01 / CONS-01 dans la voix de Prisme) : ACCES-IA les éteint pour les non-testeurs
  *(QA1)*, sans changer leur accord ni leur fournisseur.
- Un paywall, des paliers (D6 de PRISME-01), RevenueCat.
- L'export des autres tables serveur (D10, dette au BACKLOG).
- L'auto-inscription à la bêta, une liste d'attente, une invitation par e-mail.
- Le contraste des couleurs du back-office existant (accent `#dd6e40`, gris `#8a7a68` sous 4,5:1 pour le
  petit texte) : dette commune à tout `apps/admin`, reprise telle quelle.
- Le pilier Course, les écrans Muscu et Nutrition, `lab-repository.ts`.

## 13 bis. Écarts au cadrage reçu

- **« Le test de complétude de l'export la verra »** : pas tel quel — il ne lit que le schéma PowerSync.
  Il la verrait si la table était synchronisée ; D9 et QA2 proposent de ne pas le faire, et de le dire.
- **RECETTES §96** : réservé dans le cadrage, devenu sans objet le 23/10/2026 (fin de la recette
  consignée). Les preuves sont les tests du §14 ; les contrôles sur le cloud font partie du déploiement
  (§12, plan étape 9).

## 14. Critères d'acceptation — ce que les tests doivent prouver

**La règle (pure, `packages/shared`)**

1. `AI_ACCESS` : `open`, ` Open ` → ouvert ; absent, vide, `ouvert`, `true` → testeurs.
2. Mode `testers` + non-testeur : `narrate`, `meal_text`, l'accord (`grant` vrai ou absent), un type
   inconnu, et *(QA1)* `coach`, `photo`, `ask` refusés ; `status` et le retrait d'accord passent.
3. Mode `testers` + testeur, et mode `open` + n'importe qui : tout passe.
4. Ordre de `status` : fermé l'emporte sur l'âge et sur le fournisseur ; âge sur fournisseur.
5. **Test-garde** : la copie de la règle dans `supabase/functions/ai-assist/` est identique à la source
   (fins de ligne normalisées).
6. Le schéma de statut accepte `reason: 'closed'` et `access`, et reste valide sans `access`.

**L'app (Jest)**

7. L'état d'accès vaut `allowed` / `closed` / `unknown` selon le statut ; tant qu'il est `unknown`, le
   statut est redemandé (une requête à la fois) ; il est effacé à la déconnexion.
8. Statut fermé → les trois surfaces Prisme ne rendent rien.
9. Réglages › Prisme dans les cinq cas du §4.1 : fermé sans accord → rien ; fermé avec accord → carte
   réduite, et le bouton retire l'accord ; inconnu sans accord → rien ; inconnu avec accord → section
   actuelle ; autorisé en mode `testers` → la ligne « bêta ».
10. `ai_closed` → code `closed`, message traduit sur la surface du geste, statut **non** relu.
11. *(QA1)* Réglages › Labo IA, « Résumer » (Labo), récit du Conseil et écran `/ai-lab` suivent le
    tableau du §4.1 dans les trois états — « Résumer » et le Conseil par un seul crochet, testé une fois.
12. Chaque code d'échec de l'app a son message dans `prisme.errors` **et** `aiLab.errors`, en FR et en
    EN (test-garde) ; les nouvelles clés existent dans les deux langues (parité).

**Le back-office (Vitest)**

13. Ajout par e-mail : `grant_ai_tester_by_email` ; `added` → audit `ai_tester.grant` avec la cible
    `auth.users` + identifiant et **aucun e-mail** ; `already` et `not_found` → message, pas d'audit ;
    saisie vide → rien n'est appelé.
14. Retrait : confirmation, `revoke_ai_tester`, audit `ai_tester.revoke` (identifiant seul) ; `absent` →
    pas d'audit ; annulation → rien.
15. L'écran liste les testeurs, affiche le mode lu dans `status` (ou « mode inconnu »), et le menu
    n'apparaît qu'aux gestionnaires d'utilisateurs.
16. La fiche utilisateur affiche « testeur depuis » / « pas testeur » et le bouton inverse.
17. Le journal d'audit connaît les deux actions (union partagée, libellés).

**Vérifiés au déploiement (cloud, §12)** — pas de runner Deno ni de base locale : un non-testeur
reçoit « fermé » et aucun quota ne bouge ; un testeur passe ; `open` ouvre ; un compte testeur n'ouvre
pas le back-office ; un utilisateur ordinaire ne lit pas `ai_testers` et ne peut appeler aucune des
trois fonctions SQL.

## 15. Ce que la relecture a changé (23/10/2026)

| Constat | Effet |
|---|---|
| 🔴 L'e-mail écrit dans `audit_log` y resterait à vie (ajout seul, hors purge) | D12 : identifiant seul, comme `role.grant` et `user.ban` |
| Hors ligne, `closed` ne se sait pas ; l'accord au Labo IA s'écrit en local | D15 : trois états, tableau par surface ; Labo IA seulement sur accès confirmé |
| `ilike` : `*` est un joker PostgREST, l'échappement ne suffit pas | D7 : `grant_ai_tester_by_email`, égalité côté serveur |
| Relire le statut après un refus démonte la surface et son message | R10 : message sur la surface, statut non relu, sur **tous** les chemins (Prisme et Labo IA) |
| Store non remis à zéro à la déconnexion | D17 |
| Une panne de lecture de la liste dirait « fermé » à un testeur | D16 : « indisponible », statut en erreur |
| `consent` sans `grant`, types futurs | R4 |
| `consent` renvoie aussi un statut | R5 ; plan, étape 4 |
| App ancienne + fonction redéployée : décrit incomplètement | §8 |
| `aiLab.errors` incomplet (`not-allowed`, `adult-required`, `settings-missing`) | §9 ; critère 12 (test-garde) |
| Interrupteur « Retirer mon accord » allumé, lu à l'envers | §4.3 : un bouton |
| PRISME-01 §4 dit la section Réglages « toujours » visible | Plan, étape 9 : annoter PRISME-01 §4 et §11, et le commentaire du composant |
| « Q1 » déjà pris par PRISME-01 | QA1 / QA2 |
| Groq cité, Mistral en service | §0 |
| Coût par testeur sans le Labo IA | D8 |
| Le Security Advisor signalera la vue | §7 |
