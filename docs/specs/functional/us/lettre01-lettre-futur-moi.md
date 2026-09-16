---
id: LETTRE-01
titre: "Lettre à ton futur toi — un message écrit en fixant un objectif, rouvert à l'échéance"
roadmap: [7.32]
catalogue: []
etape: spec
branche: dev
maj: 16/09/2026
---

> ℹ️ **Numéro de roadmap corrigé le 16/09/2026** : cette spec revendiquait `7.31`, déjà pris par
> IA-LAB-01 (ligne créée et poussée le 15/09). Deux specs sur le même numéro font diverger
> silencieusement ETAT.md et la roadmap. IA-LAB-01 garde `7.31` — sa ligne existe et l'US est en
> recette ; LETTRE-01, encore au stade `spec` et sans ligne de roadmap, passe à `7.32`.

# US LETTRE-01 — Lettre à ton futur toi

> Issue de la salve « carnet d'innovation » du 13/09/2026, idée **(34)**, lot 1 —
> [analyse](../../../product/analyse-innovation-2026-09.md). La plus petite des quatre, et la seule
> qui joue sur la **rétention émotionnelle** plutôt que sur la donnée.
>
> ⚠️ **Travail directement sur `dev`** (décision Florian, 15/09/2026).

## 1. Le problème

OBJ-01 pose des objectifs à échéance et un anneau de progression. Il ne garde **aucune trace du
pourquoi** : trois mois plus tard, l'utilisateur voit « 68 % » sans se rappeler ce qui l'avait décidé
à s'y mettre. Et le moment où ce souvenir compte le plus — celui où il s'apprête à abandonner — est
précisément celui où l'app ne dit rien.

## 2. Ce que fait la fonctionnalité

En créant un objectif, l'utilisateur peut écrire quelques lignes à son futur lui-même. Cette lettre
est **scellée** : elle ne se relit pas au quotidien. Elle se rouvre dans exactement trois cas —
à l'échéance, quand l'objectif est atteint, ou quand il s'apprête à le supprimer.

**Hors périmètre, explicitement :**

- **la lettre enregistrée à la voix** : elle demanderait la permission micro, donc une modification de
  la déclaration « Sécurité des données » de la fiche Play — à l'instant où l'on cherche justement à
  soumettre (LANCE-00). Décision D1 ci-dessous ;
- la lettre **hors objectif** (message libre daté), et la relance d'inactivité générale (« ça fait
  5 jours ») : c'est une autre idée, non retenue dans ce lot ;
- le **partage** de la lettre ;
- toute **notification nouvelle** en dehors de celle de l'échéance, qui existe déjà.

## 3. Surfaçage (ADR-007)

| Surface | Ce qui apparaît |
|---|---|
| Création / édition d'objectif (`GoalFormSheet`) | Un champ facultatif « Écris un mot à ton futur toi », replié par défaut |
| Carte d'objectif (`GoalCard`) | Une **enveloppe scellée** discrète quand une lettre existe : date d'écriture, pas de contenu |
| Ouverture (feuille) | Le texte, la date d'écriture, l'ancienneté (« il y a 3 mois »), et un bouton « Refermer » |
| Notification d'échéance | La notification existante d'OBJ-01 mentionne la lettre quand il y en a une |
| Suppression d'objectif | Avant de confirmer : « Tu avais écrit un mot en te lançant. Le relire ? » |

**Aucun widget d'accueil.**

## 4. Décisions de cadrage

| # | Question | Décision |
|---|---|---|
| **D1** | Texte ou voix ? | **Texte en V1.** La voix suppose `RECORD_AUDIO`, une nouvelle dépendance audio et une reprise de la déclaration Play — trop cher juste avant la soumission. La forme retenue ne ferme pas la porte : un `letter_audio_path` pourra s'ajouter plus tard. |
| **D2** | Où vit la lettre ? | **Trois colonnes sur `personal_goals`**, pas une table : une lettre n'existe jamais sans son objectif, et la table est déjà synchronisée. |
| **D3** | Peut-on la relire quand on veut ? | **Oui**, depuis la carte d'objectif — mais l'app ne la montre jamais d'elle-même en dehors des trois déclencheurs (R3). Une lettre qu'on croise tous les jours ne veut plus rien dire. |
| **D4** | Peut-on la modifier ? | **Oui tant que l'objectif est en cours**, avec la date d'écriture mise à jour. Une lettre n'est pas un contrat, et bloquer l'édition ferait perdre des lettres à la première faute de frappe. |
| **D5** | Et si l'objectif est supprimé ? | La lettre part avec lui (soft delete). Elle est proposée à la relecture **avant** la confirmation (R3-c) : c'est le moment où elle sert le plus. |
| **D6** | Longueur ? | **1 000 caractères** au plus, compteur affiché à partir de 800. Assez pour un mot sincère, trop peu pour un journal. |

## 5. Règles métier

**R1 — Modèle.** Trois colonnes additives et nullables sur `personal_goals` :

| Colonne | Type | Rôle |
|---|---|---|
| `letter_text` | `text` | Le message (≤ 1 000 caractères, contrôlé côté app **et** par un `check` en base) |
| `letter_written_at` | `timestamptz` | Date d'écriture ou de dernière modification |
| `letter_opened_at` | `timestamptz` | Première ouverture **par un déclencheur** (R3), pas par une relecture volontaire |

**R2 — Scellée.** La lettre n'est **jamais** rendue dans une liste, un résumé ou une notification :
seul l'écran d'ouverture affiche son contenu. La carte d'objectif ne montre que l'enveloppe et la
date.

**R3 — Trois déclencheurs, et seulement trois.**
a. **L'échéance** : la notification datée d'OBJ-01 (`scheduleDatedReminder`, déjà en place) mentionne
   la lettre ; l'ouverture de l'objectif propose alors « Relire ton mot ».
b. **L'objectif atteint** : la célébration existante propose la même chose.
c. **La suppression** : la confirmation propose « Relire ton mot » avant de supprimer.
`letter_opened_at` est posé à la **première** ouverture par un de ces trois chemins ; une relecture
volontaire (D3) ne l'écrase pas.

**R4 — Ancienneté.** L'écran d'ouverture affiche « écrit le JJ/MM/AAAA, il y a N jours / mois »,
calculé localement, en jours pleins.

**R5 — Rien d'imposé.** Le champ est facultatif et replié. Un objectif sans lettre se comporte
**exactement** comme aujourd'hui : aucune enveloppe, aucun message, aucune notification modifiée.

**R6 — Contenu de l'utilisateur.** Le texte est affiché tel quel, sans interprétation ni mise en
forme. Il entre dans l'export RGPD des données personnelles au même titre que le reste de
`personal_goals` (à ajouter à l'export, voir les tests de complétude de CONF-01).

**R7 — Pas d'IA.** Aucune suggestion, aucune reformulation, aucune analyse du texte. Jamais envoyé à
un service tiers.

## 6. Cas limites

| Cas | Comportement |
|---|---|
| Objectif sans lettre | Rien ne change nulle part (R5) |
| Lettre vide après édition (tout effacé) | La lettre est supprimée (`letter_text = null`), l'enveloppe disparaît |
| Échéance dépassée depuis longtemps | L'ouverture reste proposée tant que l'objectif existe |
| Objectif atteint **avant** l'échéance | Déclencheur b ; le déclencheur a ne se produit plus (la notification d'échéance est déjà annulée par OBJ-01) |
| Notifications refusées | Les déclencheurs b et c fonctionnent quand même : la lettre n'est pas prisonnière d'une permission |
| 1 000 caractères atteints | La saisie s'arrête, le compteur le dit ; aucun texte tronqué en silence |
| Deux appareils | La lettre suit la synchro de `personal_goals` ; en cas de conflit, PowerSync tranche comme pour le reste (dernière écriture) |
| Objectif restauré après suppression | Hors périmètre : la suppression est définitive côté produit (soft delete) |

## 7. i18n (FR + EN)

Espace de clés `goals.letter.*` — aucune chaîne en dur.

| Clé | FR | EN |
|---|---|---|
| `letter.field.label` | « Écris un mot à ton futur toi » | “Write a note to your future self” |
| `letter.field.hint` | « Tu le reliras à l'échéance. Personne d'autre ne le verra. » | “You'll read it at the deadline. No one else will see it.” |
| `letter.field.placeholder` | « Pourquoi tu t'y mets, aujourd'hui… » | “Why you're starting, today…” |
| `letter.counter` | « {{count}} / 1000 » | “{{count}} / 1000” |
| `letter.sealed` | « Un mot scellé · {{date}} » | “A sealed note · {{date}}” |
| `letter.open` | « Relire ton mot » | “Read your note” |
| `letter.written` | « Écrit le {{date}}, il y a {{age}} » | “Written on {{date}}, {{age}} ago” |
| `letter.close` | « Refermer » | “Close” |
| `letter.onDeadline` | « Tu avais écrit un mot en te lançant. » | “You wrote a note when you started.” |
| `letter.onAchieved` | « Tu y es. Relis ce que tu écrivais en te lançant. » | “You made it. Read what you wrote when you started.” |
| `letter.onDelete` | « Tu avais écrit un mot en te lançant. Le relire avant de supprimer ? » | “You wrote a note when you started. Read it before deleting?” |
| `letter.deleted` | « Mot supprimé » | “Note deleted” |

## 8. Comportement offline

**Tout est local.** Écriture, lecture et déclencheurs viennent de SQLite. La migration ajoute trois
colonnes **additives et nullables** sur une table **déjà publiée** dans la réplication PowerSync :
aucune sync rule à redéployer, aucun rejeu, aucune donnée existante touchée. La notification
d'échéance est planifiée localement (`expo-notifications`), comme aujourd'hui.

## 9. Accessibilité

- L'enveloppe porte un libellé explicite (« un mot scellé, écrit le 15 septembre »), jamais une seule
  icône.
- Le champ de saisie a un `label` et un compteur annoncés ; il grandit avec la police système.
- La feuille d'ouverture est lisible d'un bloc par TalkBack, dans l'ordre visuel : ancienneté puis
  texte.
- Cible tactile ≥ 48 dp sur « Relire ton mot » et « Refermer ».

## 10. Critères de recette (device)

1. Créer un objectif **sans** lettre : aucun changement visible nulle part.
2. Créer un objectif **avec** lettre : l'enveloppe apparaît sur la carte, sans laisser voir le texte.
3. La saisie s'arrête à 1 000 caractères, compteur visible à partir de 800.
4. Modifier la lettre met à jour la date d'écriture.
5. Vider le texte fait disparaître l'enveloppe.
6. Atteindre l'objectif propose de relire le mot.
7. Supprimer l'objectif propose de relire le mot **avant** la confirmation ; annuler ne supprime rien.
8. À l'échéance, la notification mentionne le mot et l'ouverture de l'objectif propose de le relire.
9. Refuser les notifications n'empêche ni le déclencheur « atteint » ni le déclencheur « suppression ».
10. Mode avion : écriture et relecture fonctionnent ; la synchro rattrape au retour du réseau.
11. Sur un second appareil, la lettre apparaît après synchro.
12. TalkBack lit l'enveloppe et la feuille ; à 1,5× de police, rien n'est coupé.
13. L'export de données RGPD contient le texte de la lettre.
