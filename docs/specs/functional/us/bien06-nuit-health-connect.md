---
id: BIEN-06
titre: "La nuit lue dans Health Connect — durée, coucher, lever, régularité"
roadmap: [1.35]
catalogue: [BW-06]
etape: recette
branche: dev
maj: 01/10/2026
---

# US BIEN-06 — La nuit lue dans Health Connect

> Chantier « pilier Bien-être » — contexte et décisions dans [BIEN-02](bien02-pilier-bien-etre.md).
> Décision appliquée : **D3** (« Ok pour la nuit lue par Health Connect », Florian, 01/10/2026). Elle
> renverse l'arbitrage du 28/07/2026 (LABO-01 : « une déclaration Play de plus pour une donnée que
> personne ne mesure la nuit ») : avec un pilier dédié, la nuit devient la donnée centrale.
> Plan : [docs/plans/bien06-nuit-health-connect.md](../../../plans/bien06-nuit-health-connect.md).

## 1. Comment ça marche

Le téléphone **ne mesure pas** le sommeil. Une **application source** — Samsung Health, Fitbit, Google
Fit, Garmin Connect, Withings, Sleep as Android, une montre ou une bague connectée — écrit dans Health
Connect des **sessions de sommeil** (`SleepSession`) : un début, une fin, et parfois des **phases**
(éveillé, léger, profond, paradoxal). Avec la permission **`READ_SLEEP`**, l'app relit ces sessions et
en tire **une nuit par matin**, qu'elle écrit dans le check-in du jour.

Sans application source qui écrit le sommeil, il n'y a **rien à lire** : la saisie manuelle du matin
reste là, et c'est elle qui fait foi.

## 2. Ce que fait l'US

### 2.1 L'activer (réglages du pilier › « Ta nuit, lue dans Health Connect »)

- Un interrupteur, **éteint par défaut**, visible pilier allumé, sur Android avec Health Connect
  installé (sinon : « indisponible sur ce téléphone »).
- L'allumer **demande d'abord la permission** (écran système) ; le réglage n'est posé que si elle est
  accordée — sinon un message dit qu'elle a été refusée et comment la donner.
- **Permission à part** : `READ_SLEEP` n'entre **pas** dans la liste des permissions générales
  (séances, distance, poids, pas). Sinon, tous les comptes qui synchronisent leurs séances
  basculeraient en « permissions manquantes » le jour de la livraison (même règle que le cycle, R20).
- **Indépendante de la synchro générale** : lire sa nuit ne demande pas d'écrire ses séances dans
  Health Connect. Il faut le pilier **et** l'interrupteur **et** la permission.
- Allumé : la date du dernier import, « Importer maintenant », le nombre de nuits écrites, un lien vers
  les réglages Health Connect (revoir ou retirer l'accès). Permission retirée depuis : le dire et
  proposer de la redonner.

### 2.2 L'import

- **Quand** : au retour au premier plan, **au plus une fois par heure** (`importSleepIfDue`), à
  l'activation et sur « Importer maintenant ».
- **Quoi** : les sessions des **7 derniers jours** (+ 1 jour : la nuit du plus vieux matin a commencé
  la veille au soir). Les sessions écrites par l'app elle-même sont ignorées.
- **Les règles** (`nightsFromSleepSessions`, partagées et testées) :
  1. **une nuit appartient au matin du réveil** : une session qui finit entre **3 h et 14 h** (heure
     locale du record) et dure **au moins 3 h** est une nuit ; ailleurs, c'est une sieste (non lue) ;
  2. **les phases d'éveil ne comptent pas** (éveillé, hors du lit, éveillé au lit) : 7 h au lit dont
     50 min réveillé font 6 h 10. Sans phases, la durée de la session ;
  3. **une nuit coupée en deux sessions reste une nuit** : les sessions d'un même réveil s'additionnent ;
  4. bornée à 14 h (le maximum de la saisie).
- **L'écriture** (`upsertImportedNights`) :
  - **une nuit saisie à la main n'est jamais écrasée** (`sleep_source = 'manual'`) ;
  - seuls les matins **ouverts à la saisie** (J-6 → aujourd'hui) sont écrits : une nuit d'il y a trois
    semaines ne réécrit pas l'historique sur lequel les liens ont été calculés ;
  - une nuit identique n'est pas réécrite (aucune synchro pour rien) ;
  - **les écritures de `daily_wellbeing` passent l'une après l'autre** (import, check-in) : deux
    écritures simultanées sur un jour sans ligne en créeraient deux, rejetées par l'index unique de
    Postgres — et la file d'envoi de PowerSync se figerait (trouvé à la revue du 01/10/2026) ;
  - la nuit lue porte `sleep_source = 'health_connect'`, son **début** et sa **fin**
    (`sleep_start_at`, `sleep_end_at`).
- Un compte rendu de diagnostic (Réglages › Health Connect) distingue « aucune session de sommeil
  lue » (cas le plus courant : pas d'app source) d'une panne.

### 2.3 Dans le check-in du matin

La nuit lue s'affiche avec un badge **« lue par Health Connect »**. Non touchée, elle n'est pas
renvoyée ; corrigée avec − / +, elle devient la nuit de l'utilisateur ([BIEN-03](bien03-checkin-deux-temps.md) R2-R3).

### 2.4 La régularité, dérivée sans rien demander

Avec au moins **5 nuits lues sur 14 jours**, l'onglet « Ce qui compte » dit l'heure de coucher moyenne
et l'écart type des couchers (`bedtimeSpread`). Les nuits saisies à la main n'ont pas d'heure de
coucher : sans lecture, l'onglet dit qu'il faut la nuit lue pour parler de régularité.

## 3. Hors-code — à faire avant la publication

- 🔴 **Nouvel APK** : la permission `android.permission.health.READ_SLEEP` est ajoutée à `app.json` —
  un dev client ou un APK construit **avant** ne la déclare pas et la demande échoue.
- 🔴 **Déclaration Play « Health apps »** : **7 types au lieu de 6** (lecture du sommeil), avec sa
  justification — voir [health-connect-play-declaration.md](../../technical/health-connect-play-declaration.md).
- **Politique de confidentialité** : mentionner la lecture du sommeil et les données du pilier.

## 4. Cas limites

| Cas | Comportement |
|---|---|
| Aucune app source | 0 nuit, compte rendu « aucune session lue », saisie manuelle inchangée |
| Sieste de 14 h à 15 h 30 | pas une nuit |
| Nuit de 23 h à 2 h 30 (fin avant 3 h) | pas une nuit (fin de soirée) |
| Montre retirée à 4 h, remise à 5 h | deux sessions, additionnées sur le même matin |
| Nuit saisie à 6 h 40, montre à 7 h 05 | la saisie reste |
| Nuit lue, puis corrigée, puis nouvel import | la correction reste (devenue manuelle) |
| Pilier éteint, interrupteur resté allumé | rien n'est lu |
| iOS | interrupteur indisponible |

## 5. Offline

La lecture est locale (Health Connect est sur le téléphone) ; l'écriture passe par PowerSync.

## 6. i18n

FR + EN : `wellbeingSettings.sleep.*` (interrupteur, indisponible, permission, refus, dernier import,
import, « comment ça marche »), `wellbeing.moments.fromHealthConnect`.

## 7. Ce qui n'est pas fait

- **Sieste lue automatiquement** (le module sieste reste déclaratif).
- **Fréquence cardiaque au repos et VFC** : plus tard, avec une montre (planche « Les capteurs »).
- Les **phases** (profond, paradoxal) ne sont pas affichées : seule la durée de sommeil est retenue.

## 8. Critères d'acceptation

[RECETTES.md](../../../../RECETTES.md) §90 E.
