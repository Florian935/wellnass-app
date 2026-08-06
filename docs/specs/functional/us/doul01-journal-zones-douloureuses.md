---
id: DOUL-01
titre: "Journal des zones douloureuses — déclaration, historique et signal factuel"
roadmap: [1.29]
catalogue: []
etape: recette
branche: feature/doul01-journal-zones-douloureuses
maj: 06/08/2026
---

# DOUL-01 — Journal des zones douloureuses

> **Quatre arbitrages tranchés par Florian le 06/08/2026**, avant rédaction (§2, D1 → D4). Ils sont
> **acquis**. Idée promue depuis [IDEAS.md](../../../../IDEAS.md) (13/07/2026, « Journal
> blessures/douleurs & courbatures »).

## 0. Ce qu'il faut lire avant tout le reste

### 0.1 Cette US ne débloque **pas** la substitution d'exercice

C'est la correction la plus importante du cadrage, parce que l'inverse a été annoncé à l'oral.

MUSC-F14 avait retiré le motif « zone douloureuse » de ses suggestions. Le motif invoqué **n'était
pas** « on ne sait pas où il a mal » mais, mot pour mot dans sa spec §0.1 :

> Nous n'avons en base **ni information articulaire, ni schéma de mouvement** (poussée / tirage,
> dominance hanche ou genou). `exercises` porte un groupe musculaire principal, des muscles
> secondaires et un matériel — rien qui permette d'affirmer qu'un exercice « ménage l'épaule ».

Ce journal fournit **la moitié gauche** de l'équation (où ça fait mal). La moitié droite — quel
exercice épargne cette zone — **reste absente**, et aucune donnée de cette US ne la produit.
Suggérer un remplacement resterait donc un **conseil de santé inventé**. Décision **D4** : hors
périmètre, et on ne le promet pas. Voir §8 pour ce qu'il faudrait vraiment.

### 0.2 Le vocabulaire des muscles ne suffit pas, et c'est structurant

`FINE_MUSCLES` (MUSC-F1b) liste **10 muscles** : chest, back, shoulders, biceps, triceps, abs,
glutes, quadriceps, hamstrings, calves. **Aucune articulation.**

Or les douleurs d'entraînement sont massivement **articulaires** : épaule, genou, lombaires, coude,
poignet. Un journal qui ne sait pas dire « j'ai mal au genou » ne serait pas utilisé. D'où **D1** :
une liste de zones **étendue**, qui recouvre les muscles **et** les articulations.

Conséquence directe, et il faut l'assumer plutôt que la masquer : **les zones articulaires ne
produisent aucun signal sur les séances** (§4, R4). On sait qu'un squat charge les quadriceps ; on ne
sait pas qu'il charge le genou. Le journal les accepte, l'app se tait dessus.

## 1. Périmètre

### 1.1 Dans le périmètre

- Une **table** `pain_reports` : une ligne par (jour, zone), avec un niveau.
- Une **liste fermée de zones** (`PAIN_ZONES`) couvrant muscles et articulations, et sa **projection
  partielle** vers `FINE_MUSCLES` — c'est elle qui rend le signal possible, et seulement là où elle
  existe.
- Une **saisie** sur schéma corporel, avec les 3 niveaux.
- Un **historique** par zone, avec ses tendances.
- Un **signal factuel** sur une séance planifiée qui cible fortement une zone récemment signalée.
- i18n **FR + EN**, comportement **hors ligne** complet.

### 1.2 Hors périmètre

- **La substitution d'exercice** (D4) — voir §0.1.
- **Tout conseil, tout diagnostic, toute recommandation d'arrêt ou de reprise.** L'app décrit, elle
  ne prescrit pas.
- **Toute notification.** Un carnet de douleur qui relance devient anxiogène — même arbitrage que
  CYCLE-01 (« aucune notification, jamais »).
- **Toute écriture dans Health Connect.** Volontaire, et ce n'est pas un détail : c'est ce qui évite
  de rouvrir la déclaration « Health apps » (§7).
- **Toute mise en veille des suggestions de progression** (MUSC-F7) : écarté par D2 — ce serait
  l'app qui prend une décision d'entraînement à partir d'une douleur déclarée.
- **Les courbatures comme catégorie distincte.** Le niveau « gêne » les couvre ; en faire un type à
  part demanderait de distinguer DOMS et douleur, ce qu'un auto-report ne permet pas.

## 2. Les décisions

| # | Décision | Motif | Statut |
|---|---|---|---|
| **D1** | **Zones = muscles + articulations.** Liste fermée étendue, au-delà des 10 `FINE_MUSCLES`. | Les douleurs d'entraînement sont surtout articulaires. Un journal qui ne sait pas dire « genou » ne sert à rien. Coût assumé : une liste neuve et des zones à ajouter au schéma corporel. | ✅ Florian, 06/08/2026 |
| **D2** | **Signal factuel, jamais de conseil.** « Cette séance cible le dos, que tu as signalé sensible il y a 2 jours » — un fait daté, rien d'autre. | C'est le cadre que CYCLE-01 s'est imposé (« des moyennes observées, jamais une causalité ni un conseil ») et ce que MUSC-F14 a refusé d'enfreindre. Le franchir ferait de l'app un avis médical. | ✅ Florian, 06/08/2026 |
| **D3** | **3 niveaux : gêne / douleur / bloquant.** | Assez pour porter un seuil sans prétendre à une précision qu'un auto-report n'a pas. Trois mots concrets valent mieux qu'un chiffre abstrait — et l'écart entre 3 et 4 sur une échelle de 5 ne veut rien dire. | ✅ Florian, 06/08/2026 |
| **D4** | **La substitution reste hors périmètre.** | Elle exige de taguer chaque exercice (articulation sollicitée, schéma de mouvement) : donnée absente, **travail de coach**, même blocage que CONTENU-01. | ✅ Florian, 06/08/2026 |
| **D5** | **Une ligne par (jour, zone)**, pas une période avec résolution. | Patron `daily_wellbeing` / `body_measurements`, déjà éprouvé. Une douleur ne se « clôt » pas à une date précise — l'utilisateur cesse simplement de la déclarer. Une fraîcheur glissante (R3) exprime ça mieux qu'un drapeau « résolu » que personne ne pense à cocher. | 🟠 **cadrage** |
| **D6** | **Le signal se déclenche à partir de « douleur »**, pas de « gêne ». | Une gêne après une séance de jambes est une courbature : la signaler transformerait l'app en alarme permanente, et c'est le bruit qui fait désactiver ce genre de fonctionnalité (leçon explicite de COLLIS-01). | 🟠 **cadrage** |

## 3. Le modèle

```
PAIN_ZONES  ─────────────┬──► muscles (10)  ──► projection vers FINE_MUSCLES ──► SIGNAL possible
                         │
                         └──► articulations (8) ──► aucune projection ──────────► journal seul
```

**La projection est partielle, et c'est le cœur honnête du dispositif.** Une zone musculaire se
relie au tonnage d'une séance ; une articulation, non. Le journal accepte les deux ; le signal ne
parle que de ce qu'il peut prouver.

### 3.1 Les zones

| Famille | Zones | Signal ? |
|---|---|:---:|
| Muscles | `chest` `back` `shoulders` `biceps` `triceps` `abs` `glutes` `quadriceps` `hamstrings` `calves` | ✅ |
| Articulations | `neck` `shoulder_joint` `elbow` `wrist` `lower_back` `hip` `knee` `ankle` | ❌ |

⚠️ **`shoulders` (muscle) et `shoulder_joint` (articulation) coexistent**, et c'est voulu : « j'ai les
deltoïdes en compote » et « mon épaule coince » sont deux choses différentes, et seule la première
peut se relier à une séance. La maquette les distingue visuellement plutôt que par leur nom.

### 3.2 Les niveaux

| Niveau | Sens | Déclenche un signal ? |
|---|---|:---:|
| `discomfort` | Gêne — courbature, raideur | ❌ (D6) |
| `pain` | Douleur | ✅ |
| `blocking` | Bloquant — empêche le mouvement | ✅ |

## 4. Règles

**R1 — Saisie.** Une zone se déclare sur un **schéma corporel** (face / dos), au tap, puis on choisit
un niveau. Une déclaration porte sur **aujourd'hui** par défaut, avec possibilité de dater dans le
passé (même borne que le reste du produit, 7 jours).

**R2 — Une ligne par (jour, zone).** Redéclarer la même zone le même jour **met à jour le niveau**,
elle ne crée pas de doublon. Index unique partiel `(user_id, log_date, zone) where deleted_at is null`.

**R3 — Fraîcheur.** Une zone est « actuellement sensible » si elle a été déclarée dans les
**7 derniers jours**, au niveau `pain` ou `blocking`. Au-delà, elle sort du signal sans rien effacer :
l'historique reste entier.

**R4 — Le signal, et sa borne.** Sur une séance **planifiée** dont le tonnage prévu est **majoritaire**
sur un muscle correspondant à une zone actuellement sensible, l'app affiche un **fait daté** :
« cette séance cible surtout {{zone}}, que tu as signalée {{niveau}} il y a {{n}} jours ».

- **Aucun bouton d'action, aucune suggestion.** On informe, on ne propose rien — puisqu'on n'a rien
  de fondé à proposer (§0.1).
- **Rien sur les zones articulaires** (§0.2). Le journal les garde, le signal les ignore.
- **Rien sur une séance déjà faite** : le détecteur parle du futur, comme COLLIS-01.

**R5 — Historique.** Un écran liste les zones déclarées, la plus récente d'abord, avec leur niveau et
leur date. Une zone déclarée plusieurs fois montre sa **suite de niveaux**, pas une moyenne : une
douleur qui passe de bloquant à gêne est une information, sa moyenne n'en est pas une.

**R6 — Aucune formulation médicale.** Bannis partout : « blessure », « lésion », « pathologie »,
« repos conseillé », « consulte », « guérison ». Le mot employé est **« zone sensible »**. Un test
vérifie l'absence de ce vocabulaire dans les clés i18n, comme MUSC-F14 l'avait fait.

**R7 — Opt-in.** Le journal est **désactivé par défaut** (`user_settings.pain_journal_enabled`).
Donnée de santé : rien ne s'écrit tant que l'utilisateur ne l'a pas activé — même règle que CYCLE-01.

**R8 — Aucune notification**, ni rappel, ni relance. Le journal se consulte, il ne poursuit pas.

## 5. Cas limites

| Cas | Comportement |
|---|---|
| Deux zones sensibles ciblées par la même séance | **Un seul** message, sur la zone au niveau le plus élevé ; à égalité, la plus récemment déclarée. Deux bandeaux diraient deux fois la même chose (patron COLLIS-01). |
| Zone déclarée puis re-déclarée à un niveau plus bas | Le niveau du jour remplace ; la fraîcheur repart de cette déclaration. |
| Zone `blocking` sur un muscle qu'aucune séance ne cible | Aucun signal, et c'est correct — il n'y a rien à signaler. |
| Séance libre (hors programme) | Aucun signal : le tonnage n'est pas connu à l'avance. |
| Journal désactivé après avoir déclaré | Les lignes restent (R17 de CYCLE-01 : « garder » est un choix possible) ; aucun signal, aucun écran. Une suppression explicite est proposée. |
| Zone sortie de fraîcheur | Disparaît du signal, **reste dans l'historique**. |
| Fuseau / changement d'heure | Clés `AAAA-MM-JJ` locales, arithmétique via `Date.UTC` — patron `prevKey`. |
| Lecture d'horloge | `todayKey` **en paramètre** du moteur pur, jamais lu dedans (React Compiler, cf. `selectInsights`). |

## 6. i18n (FR + EN)

Clés sous `pain.*`. Les 18 zones et les 3 niveaux ont chacun leur clé — **aucun libellé construit par
concaténation**, et **aucune clé brute affichée** : c'est le défaut corrigé le 05/08/2026, où
`muscle_imbalance` rendait « back » au lieu de « Dos » sur trois surfaces. La résolution passe par une
fonction unique, sur le modèle de [decision-subject.ts](../../../../apps/mobile/src/lib/decision-subject.ts).

| Clé | FR | EN |
|---|---|---|
| `pain.title` | Zones sensibles | Sensitive areas |
| `pain.cta` | Signaler une zone | Report an area |
| `pain.levels.discomfort` | Gêne | Discomfort |
| `pain.levels.pain` | Douleur | Pain |
| `pain.levels.blocking` | Bloquant | Blocking |
| `pain.signal` | Cette séance cible surtout {{zone}}, signalé {{level}} il y a {{count}} jour(s) | This session mostly targets {{zone}}, reported {{level}} {{count}} day(s) ago |
| `pain.empty` | Aucune zone signalée. | No areas reported. |
| `pain.zones.*` | 18 clés | 18 clés |

Pluriels i18next sur `pain.signal` (`_one` / `_other`).

## 7. Conformité — nettement plus léger que CYCLE-01

Vérifié le 06/08/2026 dans [lance00-fiche-play-et-confidentialite.md](../../technical/lance00-fiche-play-et-confidentialite.md) :

| Point | Impact |
|---|---|
| Catégorie « Santé » de la politique de confidentialité | ✅ **Existe déjà** (poids, mensurations, bien-être, pas quotidiens) → **une ligne à ajouter**, pas une catégorie à créer. |
| Disclaimer médical | ✅ **Existe déjà** (« Wellness ne fournit pas de conseil médical »). |
| Déclaration Play « Health apps » | ✅ **Inchangée, reste à 6 types** — cette US **n'écrit rien dans Health Connect**. Pas de nouveau délai d'instruction Google. |
| Formulaire « Sécurité des données » | 🟠 Un item de plus dans une catégorie existante. |
| Export RGPD | 🔴 **Obligatoire** — une donnée de santé absente de l'export est un manquement. |

**À retenir** : contrairement à CYCLE-01, qui a allongé le chemin critique de ~3 à ~5 semaines, cette
US **n'ajoute aucun délai externe**. C'est la conséquence directe de ne pas toucher Health Connect.

## 8. Ce qu'il faudrait pour débloquer la substitution (trace, pas engagement)

Pour qu'une suggestion « cet exercice ménage ta zone » soit fondée, il faudrait ajouter à chaque
exercice : **l'articulation principalement sollicitée** et son **schéma de mouvement** (poussée /
tirage, dominance hanche / genou, ouverture d'épaule). Environ 3 champs sur `exercises`.

Le coût n'est pas le schéma — c'est **taguer le catalogue**, exercice par exercice, avec une
compétence que ni le dev ni le produit n'ont. **Travail de coach**, exactement le blocage de
CONTENU-01. À ressortir si un coach rejoint le projet.

## 9. Comportement hors ligne

Table locale PowerSync, écriture par repository, UUID client, timestamps UTC, soft delete. Le moteur
(fraîcheur, projection zone → muscles, choix du signal) est **pur et local**. Déclarer une zone
fonctionne en mode avion.

**Aucune dépendance native nouvelle** → **recettable sur l'APK existant**.

## 10. Critères de recette

| # | Critère |
|---|---|
| 1 | Journal **désactivé par défaut** sur un compte neuf ; aucun écran, aucun signal. |
| 2 | Une fois activé : déclarer une zone en 2 taps (zone puis niveau). |
| 3 | Les **18 zones** sont atteignables sur le schéma, face **et** dos. |
| 4 | `shoulders` (muscle) et `shoulder_joint` sont **distinguables** sans lire leur nom. |
| 5 | Redéclarer la même zone le même jour **met à jour** le niveau, sans créer de doublon. |
| 6 | Une zone en `pain` sur un muscle → la séance planifiée qui le cible affiche le **fait daté**. |
| 7 | Une zone en `discomfort` → **aucun signal** (D6). |
| 8 | Une zone **articulaire** en `blocking` → **aucun signal** sur aucune séance (§0.2). |
| 9 | Deux zones sensibles sur la même séance → **un seul** message, sur le niveau le plus élevé. |
| 10 | Au 8ᵉ jour, la zone **sort du signal** et **reste dans l'historique**. |
| 11 | Aucun bouton d'action sur le signal — on informe, on ne propose rien. |
| 12 | Séance déjà réalisée → aucun signal. |
| 13 | 🔴 **Relecture du vocabulaire, FR et EN** : aucun « blessure », « repos conseillé », « consulte », « guérison ». C'est une règle testée (R6), pas une préférence. |
| 14 | Désactiver le journal → écrans et signaux disparaissent ; les données restent, et la suppression explicite fonctionne. |
| 15 | Mode avion → déclaration, historique et signal identiques. |
| 16 | Export RGPD : `pain_reports` est présent dans l'archive. |
| 17 | 🔴 **L'opt-in survit à une réinstallation** — le seul test qui exerce ensemble la migration et le schéma PowerSync local (panne CYCLE-01). |
| 18 | Police 1,5×, thème sombre, TalkBack : le schéma est utilisable, chaque zone est atteignable au clavier/lecteur. |
