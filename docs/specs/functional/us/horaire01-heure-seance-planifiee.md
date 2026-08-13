---
id: HORAIRE-01
titre: "Heure d'une séance planifiée — et le rappel « ça commence bientôt »"
roadmap: [2.4]
catalogue: []
etape: code
branche: feature/horaire01-heure-seance
maj: 12/08/2026
---

# US HORAIRE-01 — Heure d'une séance planifiée, et le rappel « ça commence bientôt »

> **Origine** : la roadmap **2.4** (« Notif — Rappel séance : push 30 min avant une séance
> planifiée ») est 🟡 depuis MUSC-F8, avec une remarque explicite : « `scheduled_date` est un jour
> **sans heure**, “30 min avant” est **incalculable** en l'état. Vrai horaire = **US à part** ».
> C'est cette US.
>
> **Vérifié avant d'écrire** : `planned_sessions` (migration `20260712110000`) porte
> `scheduled_date date not null` et **aucune** colonne d'heure ; le schéma client
> ([schema.ts:423](../../../../apps/mobile/src/powersync/schema.ts)) le reflète. Le rappel de séance
> existe et fonctionne, mais comme **échéance apprise** (`useSessionDeadline`, p90 de `finished_at`).

## 0. Objectif

Le rappel de séance actuel dit, en substance : **« la journée avance, ta séance n'est pas faite »**.
C'est une **échéance**, et c'est utile — mais ce n'est pas ce que 2.4 demande. 2.4 demande une
**convocation** : « ça commence dans 30 minutes ». Les deux sont légitimes, ils ne répondent pas à la
même question, et le second est impossible sans savoir **à quelle heure** la séance est prévue.

On ajoute donc une **heure facultative** à une séance planifiée, et le rappel qui va avec.

## 1. Décisions de cadrage

| # | Question | Décision retenue | Pourquoi |
|---|---|---|---|
| **D1** | L'heure est-elle obligatoire ? | **Non — facultative**, et c'est structurant | Planifier « jeudi » sans savoir quand est un usage **normal**, pas un oubli à corriger. La rendre obligatoire casserait la planification existante (toutes les lignes en base sont sans heure) et imposerait une décision à chaque création. |
| **D2** | Que devient l'échéance apprise de MUSC-F8 ? | Elle **reste**, comme régime de **repli**. Heure posée → convocation à H−30. Pas d'heure → échéance apprise, **comportement actuel inchangé** | On n'enlève rien. Une US qui remplacerait l'échéance par la convocation ferait **régresser** tous ceux qui planifient sans heure — c'est-à-dire tout le monde aujourd'hui. |
| **D3** | Un rappel ou deux quand l'heure est connue ? | **Un seul** : la convocation remplace l'échéance pour cette séance-là | Deux notifications pour la même séance, c'est du spam. Les deux régimes sont **exclusifs**, jamais cumulés. |
| **D4** | Combien de minutes avant ? | **30 min, fixe** (constante `SESSION_LEAD_MINUTES`), pas de réglage en V1 | La roadmap dit 30. Un réglage de plus est un réglage à tester, à traduire et à recetter, pour un gain non démontré. La constante rend le passage à un réglage trivial plus tard. |
| **D5** | Notification **exacte** (alarme précise) ? | **Non.** On reste sur le déclencheur programmé standard, et on assume l'imprécision | 🔴 Décisif, et pas pour une raison technique : la précision demanderait la permission Android **`SCHEDULE_EXACT_ALARM`**, qui est **sensible au Play Store** et exige une justification dédiée. Or **LANCE-00 est sur le chemin critique** avec la déclaration « Health apps ». Ajouter une permission sensible maintenant, c'est prendre le risque d'un aller-retour de review sur la fiche Play pour gagner quelques minutes de précision. |
| **D6** | Plusieurs séances le même jour ? | **La prochaine à venir** seulement, un seul rappel | Il n'y a qu'un `SESSION_REMINDER_ID`, et c'est volontaire (MUSC-F8, quota de notifications). Notifier chaque séance d'une journée chargée retournerait l'outil contre son utilisateur. |
| **D7** | Où saisit-on l'heure ? | Dans le **détail d'une occurrence planifiée**, via un sélecteur natif, avec une action « **retirer l'heure** » | Pas un champ de plus à la création : on planifie d'abord, on précise ensuite si on veut. Le retrait explicite est le pendant de D1 — sans lui, l'heure serait irréversible. |
| **D8** | Type en base ? | Colonne **`scheduled_time time`**, nullable — **heure locale**, jamais un `timestamptz` | Même raisonnement que `scheduled_date` : une séance à 18 h reste à 18 h. Un `timestamptz` la déplacerait au changement de fuseau, ce qui est faux pour un rendez-vous récurrent avec soi-même. |

## 2. Périmètre

**Dans le périmètre**
- Migration : `planned_sessions.scheduled_time time null` + schéma client PowerSync.
- Saisie / modification / retrait de l'heure sur une occurrence planifiée.
- Affichage de l'heure là où l'occurrence est listée (planning, hub muscu, widget du jour).
- Rappel de convocation à H−30 quand l'heure est connue, en **remplacement** de l'échéance apprise
  pour cette séance.
- Reprogrammation du rappel quand la séance est **déplacée** (MUSC-F9, glisser-déposer) ou son heure
  changée.
- i18n FR + EN. Comportement offline identique.

**Hors périmètre, explicitement**
- **Rendre le délai réglable** (D4) — constante, pas réglage.
- **Notifications exactes** et la permission `SCHEDULE_EXACT_ALARM` (D5).
- **Une heure sur le gabarit de séance** (`sessions`), qui vaudrait pour toutes les occurrences :
  c'est un autre objet et un autre besoin (« mes séances sont toujours à 18 h »). À reprendre si la
  saisie par occurrence se révèle fastidieuse à l'usage.
- **Durée prévue** de la séance, et donc tout calendrier à créneaux. On pose un début, pas un bloc.
- **Les séances de course** : `planned_sessions` est pilier-agnostique et la colonne servira aux
  deux, mais le rappel de course a sa propre famille (RUN-F1) — la brancher ici mélangerait deux
  parcours de notification. La colonne est donc posée pour tous, le **rappel** reste muscu.

## 3. Règles métier

- **R1** — `scheduled_time` est `NULL` ou une heure locale valide `HH:MM`. Aucune valeur par défaut :
  l'absence est un état, pas un trou à combler.
- **R2** — Le rappel de convocation part à `scheduled_date` + `scheduled_time` − **30 min**.
- **R3** — 🔴 **Un instant déjà passé ne programme rien.** Si l'heure de convocation est dépassée au
  moment du calcul (séance ce soir 18 h, il est 17 h 45), **aucun rappel** n'est posé — et surtout
  **pas** un rappel immédiat. Une notification « ça commence dans 30 min » reçue après le début est
  pire que pas de notification.
- **R4** — Une séance `status != 'planned'` (faite ou sautée) ne produit **aucun** rappel, heure ou
  pas. C'est déjà la règle de MUSC-F8 (`useHasPlannedStrengthSessionToday` filtre strictement).
- **R5** — Régimes **exclusifs** (D3) : si la prochaine séance planifiée du jour a une heure, le
  rappel est la convocation ; sinon c'est l'échéance apprise. Jamais les deux.
- **R6** — Le rappel respecte le **plafond de notifications par jour** et la préférence
  `sessionReminder` existants. Une nouvelle raison de notifier n'est pas une dérogation au quota.
- **R7** — Déplacer une séance ou changer son heure **reprogramme** le rappel ; retirer l'heure fait
  **retomber** sur l'échéance apprise.
- **R8** — L'heure s'affiche dans la langue et le format de l'utilisateur (`useUnits` / i18n), jamais
  en `HH:MM:SS` brut venu de la base.

## 4. i18n (FR + EN)

| Clé | FR | EN |
|---|---|---|
| `planning.timeLabel` | Heure de la séance | Session time |
| `planning.timeNone` | Pas d'heure définie | No time set |
| `planning.timeSet` | Définir une heure | Set a time |
| `planning.timeClear` | Retirer l'heure | Remove time |
| `notifications.sessionSoon.title` | Ta séance commence bientôt | Your session starts soon |
| `notifications.sessionSoon.body` | {{name}} dans {{minutes}} min | {{name}} in {{minutes}} min |
| `planning.timeHint` | À l'heure près n'est pas garanti : Android peut retarder un rappel pour économiser la batterie | Exact timing isn't guaranteed: Android may delay a reminder to save battery |

> ⚠️ `planning.timeHint` n'est pas une précaution juridique, c'est la **conséquence de D5** dite
> honnêtement. Sans elle, un rappel arrivé à 17 h 50 pour 18 h passe pour un bug.

## 5. Comportement offline

Rien de nouveau : l'heure est écrite en base locale (SQLite), la synchro suit, et la programmation
des notifications est **entièrement locale** (`expo-notifications`). Un vol en mode avion planifie et
notifie normalement. La seule chose qui attend le réseau, c'est la remontée de la valeur vers
Supabase — invisible à l'usage.

## 6. Cas limites

| Cas | Attendu |
|---|---|
| Séance sans heure | Échéance apprise, exactement comme aujourd'hui (D2). |
| Heure de convocation déjà passée | Aucun rappel, et **pas** de rappel immédiat (R3). |
| Séance déjà faite / sautée | Aucun rappel (R4). |
| Deux séances le même jour, l'une à 12 h l'autre à 19 h | Un seul rappel, pour la **prochaine à venir** (D6). |
| Séance à 00 h 15 | Convocation la **veille** à 23 h 45 — le calcul traverse le minuit, il ne le tronque pas. |
| Heure retirée après avoir été posée | Retour à l'échéance apprise (R7), rappel reprogrammé. |
| Séance déplacée par glisser-déposer | L'heure suit la séance, le rappel est reprogrammé (R7). |
| Préférence `sessionReminder` désactivée | Aucun rappel, heure ou pas (R6). |
| Plafond de notifications atteint | Aucun rappel (R6). |
| Permission de notification refusée | Aucun rappel ; l'heure reste saisissable et affichée (elle a une valeur propre). |
| Changement de fuseau horaire | L'heure ne bouge pas (D8) : 18 h reste 18 h. |

## 7. Definition of Done

- [ ] Migration `scheduled_time` poussée via le CLI + cochée dans
      [MIGRATIONS.md](../../../../supabase/MIGRATIONS.md).
- [x] ✅ **Aucune sync rule à redéployer — le cadrage se trompait.** Vérifié le 12/08/2026 :
      `planned_sessions` est lue en **`select *`** dans
      [powersync-sync-rules.yaml:89](../../technical/powersync-sync-rules.yaml), donc une colonne
      ajoutée descend **automatiquement**, comme pour `user_settings` (5 colonnes dans ce cas).
      ⚠️ **C'est exactement l'erreur qu'avait faite le cadrage de COLLIS-01**, qui en avait aussi
      fait son risque n° 1 avant d'être démenti. Leçon : vérifier le YAML **avant** d'écrire qu'une
      étape manuelle est nécessaire — la réponse est dans le fichier, pas dans l'habitude.
- [ ] 🔴 **Colonne déclarée dans le schéma PowerSync client** (`powersync/schema.ts`) **et couverte
      par un test d'écriture-relecture** — c'est **le** vrai risque n° 1, et la checklist laissée par
      la panne silencieuse de CYCLE-01 : sans la déclaration, l'écriture échoue, l'erreur est avalée,
      et l'heure ne se pose jamais sans aucun message.
- [ ] Saisie, modification et **retrait** de l'heure.
- [ ] Rappel de convocation, régimes exclusifs (R5), et non-programmation dans le passé (R3).
- [ ] Tests : brique pure du calcul de convocation (dont minuit et passé), SQL de lecture, scheduler.
- [ ] i18n FR + EN, `planning.timeHint` comprise.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test` verts.
- [ ] Roadmap **2.4 → ✅** (🟡 aujourd'hui, motif : « 30 min avant incalculable »).

## 8. Critères de recette (device)

1. Poser une heure sur une séance planifiée : elle s'affiche au bon format, dans les deux langues.
2. La retirer : l'écran retombe sur « pas d'heure définie ».
3. Séance à H+40 min → le rappel arrive **autour** de H−30 (à la tolérance de D5 près).
4. 🔴 Séance à H+10 min (convocation déjà passée) → **aucune notification**, ni différée ni immédiate.
5. Séance sans heure → le rappel d'échéance apprise fonctionne **comme avant** (non-régression).
6. Séance déjà faite → aucun rappel malgré l'heure.
7. Déplacer la séance au lendemain → le rappel suit.
8. Deux séances le même jour → une seule notification.
9. Mode avion : saisie, affichage et notification fonctionnent.
10. `sessionReminder` désactivé dans les réglages → aucune notification.
11. La mention de `planning.timeHint` est visible là où l'heure se règle.

## 9. Points durs assumés

- 🔴 **La précision n'est pas garantie (D5)**, et c'est un choix produit lié au **calendrier de
  publication**, pas à la technique. À rouvrir **après** le lancement si les retours le réclament :
  la permission exacte se demandera alors sans encombrer la review initiale.
- ✅ ~~**La sync rule est une étape manuelle**, risque n° 1 de cette US~~ — **faux, corrigé le
  12/08/2026** : `planned_sessions` est lue en `select *`, la colonne descend seule. Le réflexe
  « migration ⇒ sync rule à la main » ne vaut que pour une **table neuve**, pas pour une colonne
  ajoutée à une table déjà publiée et lue en `select *`. Vérifier le YAML coûte dix secondes ;
  l'avoir supposé a produit un risque n° 1 imaginaire — et le même que celui de COLLIS-01.
- 🔴 **Le vrai risque n° 1 : la colonne manquante dans le schéma PowerSync client.** Sans elle
  l'écriture échoue et `void`-avale l'erreur : l'heure ne se pose pas, sans message. C'est la panne
  de CYCLE-01, et la raison pour laquelle un **test d'écriture-relecture** est en DoD.
- **Le rappel reste muscu** alors que la colonne sert aux deux piliers (§2). Écart volontaire, à
  dire dans le plan pour qu'il ne passe pas pour un oubli.
