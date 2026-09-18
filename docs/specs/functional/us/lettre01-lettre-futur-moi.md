---
id: LETTRE-01
titre: "Lettre à ton futur toi — un message écrit en fixant un objectif, rouvert à l'échéance"
roadmap: [7.32]
catalogue: []
etape: recette
branche: dev
maj: 18/09/2026
---

> ℹ️ **Numéro de roadmap corrigé le 16/09/2026** : cette spec revendiquait `7.31`, déjà pris par
> IA-LAB-01 (ligne créée et poussée le 15/09). Deux specs sur le même numéro font diverger
> silencieusement ETAT.md et la roadmap. IA-LAB-01 garde `7.31` — sa ligne existe et l'US est en
> recette ; LETTRE-01, encore au stade `spec` et sans ligne de roadmap, passe à `7.32`.

> ⚠️ **Correction du 18/09/2026, constatée à l'implémentation** : cette spec annonçait une
> notification d'échéance « déjà en place » côté OBJ-01. **Elle n'existe pas.** OBJ-01 l'a
> explicitement écartée (sa décision D4 : « jalons visuels seuls, aucune notification, aucun
> badge ») et la renvoyait à la famille MUSC-F8 / NUTR-F1. Or LETTRE-01 s'interdit **toute
> notification nouvelle** (§2) : en créer une pour porter la lettre sortirait du périmètre et
> ajouterait une permission juste avant la soumission Play. Le déclencheur « échéance » devient donc
> **in-app** — quand l'objectif est terminé, sa carte propose de relire le mot. Les trois
> déclencheurs restent trois, et **aucun** ne dépend désormais d'une permission. Les sections 3, 5
> (R3), 6, 8 et 10 ci-dessous sont à jour de cette correction.

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
- **toute notification**, sans exception : OBJ-01 n'en planifie aucune (sa décision D4) et cette US
  n'en ajoute pas. Les trois déclencheurs sont in-app.

## 3. Surfaçage (ADR-007)

| Surface | Ce qui apparaît |
|---|---|
| Création / édition d'objectif (`GoalFormSheet`) | Un champ facultatif « Écris un mot à ton futur toi », replié par défaut |
| Carte d'objectif (`GoalCard`) | Une **enveloppe scellée** discrète quand une lettre existe : date d'écriture, pas de contenu |
| Ouverture (feuille) | Le texte, la date d'écriture, l'ancienneté (« il y a 3 mois »), et un bouton « Refermer » |
| Objectif terminé (carte d'objectif) | Échéance passée ou objectif atteint : la carte propose « Relire ton mot », une fois |
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
a. **L'échéance passée** : l'objectif rejoint « Terminés » avec son verdict ; sa carte propose alors
   « Relire ton mot ». Aucune notification n'est planifiée (voir la correction du 18/09).
b. **L'objectif atteint** : la carte à 100 % propose la même chose.
c. **La suppression** : la confirmation propose « Relire ton mot » avant de supprimer.
`letter_opened_at` est posé à la **première** ouverture par un de ces trois chemins ; une relecture
volontaire (D3) ne l'écrase pas.

**R4 — Ancienneté.** L'écran d'ouverture affiche « écrit le JJ/MM/AAAA, il y a N jours / mois »,
calculé localement, en jours pleins.

**R5 — Rien d'imposé.** Le champ est facultatif et replié. Un objectif sans lettre se comporte
**exactement** comme aujourd'hui : aucune enveloppe, aucun message, aucune notification modifiée.

**R6 — Contenu de l'utilisateur.** Le texte est affiché tel quel, sans interprétation ni mise en
forme. Il entre dans l'export RGPD **sans rien à ajouter** : l'export de CONF-01 lit
`SELECT * FROM personal_goals` (vérifié le 18/09), donc les trois colonnes en font partie dès leur
création. C'est précisément ce qu'on attend d'un export par table plutôt que par liste de colonnes.

**R7 — Pas d'IA.** Aucune suggestion, aucune reformulation, aucune analyse du texte. Jamais envoyé à
un service tiers.

## 6. Cas limites

| Cas | Comportement |
|---|---|
| Objectif sans lettre | Rien ne change nulle part (R5) |
| Lettre vide après édition (tout effacé) | La lettre est supprimée (`letter_text = null`), l'enveloppe disparaît |
| Échéance dépassée depuis longtemps | L'ouverture reste proposée tant que l'objectif existe |
| Objectif atteint **avant** l'échéance | Déclencheur b ; le statut « atteint » l'emporte, le déclencheur a ne se produit pas |
| Mot déjà ouvert par un déclencheur | La proposition disparaît ; « Relire ton mot » reste accessible depuis la carte (D3) |
| Notifications refusées | **Sans effet** : aucun déclencheur ne passe par une notification |
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
| `letter.counter` | « {{chars}} / {{max}} » | “{{chars}} / {{max}}” |
| `letter.sealed` | « Un mot scellé · {{date}} » | “A sealed note · {{date}}” |
| `letter.open` | « Relire ton mot » | “Read your note” |
| `letter.written` | « Écrit le {{date}}, il y a {{age}} » | “Written on {{date}}, {{age}} ago” |
| `letter.close` | « Refermer » | “Close” |
| `letter.onDeadline` | « Tu avais écrit un mot en te lançant. » | “You wrote a note when you started.” |
| `letter.onAchieved` | « Tu y es. Relis ce que tu écrivais en te lançant. » | “You made it. Read what you wrote when you started.” |
| `letter.onDelete` | « Tu avais écrit un mot en te lançant. Le relire avant de supprimer ? » | “You wrote a note when you started. Read it before deleting?” |
| `letter.deleted` | « Mot supprimé » | “Note deleted” |

## 8. Comportement offline

**Tout est local.** Écriture, lecture et déclencheurs viennent de SQLite — et les trois déclencheurs
sont des états calculés à l'affichage, donc rien à planifier ni à rattraper au retour du réseau. La migration ajoute trois
colonnes **additives et nullables** sur une table **déjà publiée** dans la réplication PowerSync :
aucune sync rule à redéployer, aucun rejeu, aucune donnée existante touchée. Aucune notification
n'est planifiée.

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
8. À l'échéance passée, la carte de l'objectif terminé propose de relire le mot ; après l'avoir
   relu par ce chemin, la proposition ne revient pas (le bouton de relecture, lui, reste).
9. Couper toutes les notifications ne change rien : les trois déclencheurs restent opérants.
10. Mode avion : écriture et relecture fonctionnent ; la synchro rattrape au retour du réseau.
11. Sur un second appareil, la lettre apparaît après synchro.
12. TalkBack lit l'enveloppe et la feuille ; à 1,5× de police, rien n'est coupé.
13. L'export de données RGPD contient le texte de la lettre.
