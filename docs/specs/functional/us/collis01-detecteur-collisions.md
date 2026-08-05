---
id: COLLIS-01
titre: "Détecteur de collisions entre séances — séquençage muscu ↔ course"
roadmap: [3.57]
catalogue: []
etape: recette
branche: feature/collis01-detecteur-collisions
maj: 05/08/2026
---

# COLLIS-01 — Détecteur de collisions entre séances

> **Design brainstormé et validé par Florian le 05/08/2026.** Cette spec le formalise ; les six
> décisions du §3 sont **acquises**, elles ne se rouvrent pas en codant. Idée promue depuis
> [IDEAS.md](../../../../IDEAS.md) (25/07/2026), où elle est le **signal le plus fort du benchmark
> IA** — retenue par les 4 modèles sur 4.

## 0. Ce que ça résout

Le planning **place** les séances ; il ne dit rien de leur **enchaînement**. Une grosse séance de
jambes la veille d'une sortie longue est une combinaison qui s'auto-sabote, et rien dans l'app ne le
signale aujourd'hui.

Vérifié dans le code le 05/08/2026 : **aucune détection de conflit physiologique n'existe** dans
tout `apps/mobile/src`. L'unique occurrence du mot « conflit » dans le planning porte sur un
conflit de **gestes** (appui long contre défilement). L'US 3.9
(planning unifié) avait explicitement différé la « coordination avancée charge/récup », et le
« chevauchement » qu'elle cadre est un **conflit d'agenda** (deux séances au même moment), pas un
conflit **physiologique**.

C'est le cœur du différenciateur d'intégration : deux piliers qui se parlent pour de bon.

## 1. Périmètre

### 1.1 Dans le périmètre

- Un **moteur pur** (`packages/shared/src/session-conflicts.ts`) : reçoit une semaine de séances
  déjà décrites, rend les conflits et leur jour de repli.
- Une **requête d'enrichissement** du planning : part de jambes et nombre de séries d'une séance
  planifiée. **Seule donnée nouvelle du chantier.**
- Un **bandeau** sur `/planning`, sur le jour en conflit, avec l'échange en un tap.
- Un **réglage opt-in**, désactivé par défaut.
- i18n FR + EN.

### 1.2 Hors périmètre

- **Les autres familles de conflit** (course ↔ course, charge ↔ nutrition, densité de semaine) :
  écartées en brainstorming. Voir §7.
- **Toute notion horaire.** `scheduled_date` est **un jour sans heure** — on ne peut ni proposer
  « déplace la course au matin », ni raisonner en heures de récupération. Limite du modèle de
  données, pas un choix. Même constat que celui qui avait fait recadrer l'US 2.4.
- **L'allègement d'une séance** (« garde les deux, mais raccourcis ») : demanderait un coefficient
  que rien dans nos données ne justifie.
- **Toute notification.** Le détecteur se consulte, il ne poursuit pas.
- **Toute IA.** Moteur de règles déterministe, 100 % hors ligne.

## 2. La règle — une seule, et c'est délibéré

> Une séance de **musculation** où **les jambes sont le groupe majoritaire** et qui prévoit **au
> moins 8 séries** sur ce groupe, suivie **le lendemain** d'une course de type **`sortie_longue`**
> ou **`fractionne`**.

Quatre règles moyennes valent moins qu'une règle juste : chacune multiplie les faux positifs, et
c'est le bruit qui fait désactiver ce genre de fonctionnalité. On en livre **une**, on la calibre à
l'usage, et on en ajoute quand celle-ci a fait ses preuves.

**Sens unique.** Une grosse séance de jambes compromet la course du lendemain ; l'inverse est
marginal. Le détecteur ne signale donc jamais « tu as couru hier, allège tes jambes ».

**Les courses faciles ne sont pas un conflit.** `endurance` et `recuperation` au lendemain de jambes
sont neutres, voire bénéfiques. Seules les séances de **qualité** comptent.

⚠️ **Le seuil de 8 séries est le seul nombre inventé du dispositif.** Il ne repose sur rien de
mesuré dans ce produit — c'est un point de départ explicite, à calibrer en recette puis à l'usage.
Il est exporté comme constante nommée, pas enfoui dans une condition.

## 3. Les six décisions acquises

| # | Décision | Motif |
|---|---|---|
| D1 | **Muscle ↔ course**, pas les 3 autres familles | Le vrai croisé inter-piliers ; les autres sont mono-pilier ou redondantes avec GARDE-01 |
| D2 | Seuil = **part dominante ET ≥ 8 séries** | Ne se déclenche pas sur les 3 séries de mollets d'un full body |
| D3 | Sortie = **informe + échange en un tap** | « Propose une correction » est la promesse d'IDEAS ; informer seul s'arrête à mi-chemin |
| D4 | Repli = **premier jour de la semaine ISO qui résout**, après puis avant | Seul algorithme qui reste explicable sur un planning dense (voir §4) |
| D5 | Surface = **bandeau en ligne sur `/planning`** | On voit le problème là où on le règle, avec les deux séances sous les yeux |
| D6 | **Opt-in strict, désactivé par défaut** | Décision H — intégration sans imposition |

## 4. Le repli

**Le détecteur suit la semaine affichée**, pas la semaine réelle : l'écran de planning se navigue
d'une semaine à l'autre, et un bandeau qui parlerait d'une autre semaine que celle sous les yeux
serait incompréhensible. En revanche **aucun repli ne peut tomber avant aujourd'hui** (R1) — sur une
semaine passée, le détecteur informe donc sans jamais proposer.

Balayage de la **semaine affichée**, en préférant les jours **après** le conflit, puis avant.
Un jour convient s'il **ne porte aucune course** et **ne recrée pas le conflit**.

**La séance de musculation ne bouge jamais** : elle est l'ancre du programme.

**Aucun jour valable → on informe sans proposer.** C'est la dégradation propre, et elle reste
conforme à « jamais un blocage ».

Les deux alternatives ont été écartées en brainstorming : **échanger** les deux séances est plus
élégant (volume et densité inchangés) mais peut **déplacer le problème sans le résoudre**, et c'est
un mode d'échec silencieux ; **reculer d'un jour** est trivial mais échoue précisément sur les
plannings denses, ceux qui produisent les conflits.

## 5. Règles

### R1 — Le moteur ne lit ni base, ni horloge, ni React

Il reçoit une semaine décrite **et un `todayKey`**. Même discipline que `selectInsights`
(INSIGHTS-01) : lire l'heure dans un hook la ferait geler par React Compiler dans un slot
mount-only.

⚠️ **`todayKey` n'est pas décoratif** : le repli balaie « après puis **avant** ». Sans lui, le
moteur peut proposer de déplacer une course vers un **jour déjà passé** — elle deviendrait
instantanément « manquée » au sens d'`isMissed` (`planning.ts`). Un jour antérieur à `todayKey`
n'est jamais un repli valable.

### R2 — Opt-in : éteint, la requête n'est pas montée

Pas seulement l'affichage. Tant que le réglage est faux, l'enrichissement du planning (la requête
neuve) **n'est pas exécuté** — sinon on ferait payer à tout le monde une fonctionnalité que
personne n'a demandée.

### R3 — On constate, on ne prescrit pas

Ton de GARDE-01, déjà validé. « Séance jambes lourde la veille de ta sortie longue » et non « tu
vas te blesser ». Toutes les formulations vivent en i18n ; le moteur ne rend que des identifiants,
des dates et des nombres.

### R4 — Le bandeau porte ses chiffres

« 12 séries sur les jambes », jamais une affirmation nue. Même contrainte que `InsightCandidate`
(INSIGHTS-01, R1), et pour la même raison : une alerte sans chiffre n'est pas vérifiable par celui
qui la lit.

### R5 bis — « Majoritaire » veut dire strictement dominant

Le groupe `legs` doit porter **strictement plus** de séries que tout autre groupe de la séance.
Égalité → aucun dominant → pas de conflit. Et **seul `muscle_primary` compte** : les muscles
secondaires d'un squat ne sont pas comptés, sinon la part de jambes deviendrait ininterprétable.

### R5 — Un conflit par jour, au plus

Si plusieurs séances de muscu précèdent la même course — cas théorique mais possible — un seul
bandeau, sur la séance qui pèse le plus. Deux bandeaux le même jour diraient deux fois la même
chose.

### R6 — Aucune écriture propre à l'US

L'échange réutilise `reschedulePlannedSession`, déjà livrée et éprouvée par MUSC-F9. **Aucune
migration, aucune table, aucune sync rule** — sauf pour le réglage opt-in, voir §6.

## 6. Données

**Une requête neuve, et une seule.** `PlannedSessionItem` porte aujourd'hui le pilier, le nom, le
type de séance (course uniquement), les cibles et `exerciseCount` — **pas les muscles**. Il faut
donc, pour les séances de muscu de la semaine affichée : la somme des `target_sets` par
`muscle_primary`, via `exercise_plans` → `exercises`.

**Le réglage opt-in** : une colonne booléenne sur `user_settings`, comme `cycleTrackingEnabled`.
C'est donc **une migration**.

✅ **Aucune sync rule à redéployer** — et la première rédaction affirmait le contraire, à tort.
`user_settings` est déjà publiée et lue en **`select *`**
([powersync-sync-rules.yaml:20](../../technical/powersync-sync-rules.yaml)) : y ajouter une colonne
ne change pas une ligne du YAML. La migration `20260804210516_muscpwr01_sbd_lifts.sql` — la veille,
sur cette même table — le dit déjà explicitement.

🔴 **Le vrai risque est ailleurs, et il est plus sournois : `powersync/schema.ts`.** Toute colonne
absente du **schéma local** n'existe pas dans la base SQLite embarquée : l'écriture échoue et
`void updateSettings()` **avale l'erreur** — l'interrupteur reste éteint sans le moindre message.
C'est exactement la panne de CYCLE-01, constatée en recette device le 31/07/2026, et que la première
rédaction attribuait à tort aux sync rules.

## 7. Ce qui viendra après, si celle-ci tient

Les trois autres familles écartées en brainstorming, dans l'ordre où elles se justifieraient :
**course ↔ course** (fractionné deux jours de suite), **densité de semaine** (5 séances en 6 jours),
**charge ↔ nutrition** (déficit agressif pendant une semaine de records — mais attention au doublon
avec GARDE-01). Le moteur est conçu pour les accueillir : une règle s'ajoute à une table, elle ne
réécrit rien.

## 8. Cas limites

| Cas | Comportement |
|---|---|
| Opt-in éteint | Rien, et la requête d'enrichissement n'est pas montée (R2) |
| Séance muscu sans exercices planifiés | Aucune part de jambes calculable → jamais un conflit |
| Jambes majoritaires mais 5 séries | Sous le seuil → pas de conflit |
| 12 séries de jambes dans un full body où le dos domine | Part non dominante → pas de conflit (D2) |
| Course `endurance` le lendemain | Pas un conflit |
| Course déjà réalisée (`status: 'done'`) | Pas un conflit — on ne commente pas le passé |
| Séance de muscu `skipped` ou `done` | Pas un conflit non plus : une séance sautée n'a fatigué personne |
| Repli qui tomberait **avant aujourd'hui** | Écarté — il rendrait la course « manquée » à l'instant même |
| Course sans `session_type` (colonne nullable) | Jamais un conflit : on ne devine pas le type |
| Exercice **archivé** dans un programme | Ses séries **comptent** — l'utilisateur les fera quand même |
| Deux groupes musculaires à égalité de séries | Aucun n'est dominant → pas de conflit |
| Conflit le dernier jour de la semaine ISO | Repli cherché **avant** uniquement |
| Aucun jour libre | Bandeau informatif, sans bouton d'échange |
| Deux conflits la même semaine | Deux bandeaux, sur deux jours différents |
| Utilisateur mono-pilier | Aucun conflit possible — il faut les deux piliers |
| Mode avion | Identique : tout est local |

## 9. i18n — FR + EN

```
planning.conflict.title            // « Séance jambes lourde la veille de ta sortie longue »
planning.conflict.body             // porte les chiffres : séries, type de course
planning.conflict.swap             // « Déplacer au {{day}} »
planning.conflict.noSlot           // aucun jour valable cette semaine
settings.conflicts.title / .enable / .hint
```

Nombres **formatés avant** `t()` — i18next n'a aucun formatage par défaut (piège n° 3 de
[bonnes-pratiques](../../technical/bonnes-pratiques.md)).

## 10. Comportement offline

**Intégralement local.** Aucun appel réseau, aucune dépendance native. La migration du réglage est
la seule dépendance d'infrastructure, et elle ne bloque que la **synchro** du réglage, pas son
fonctionnement local.

## 11. Critères de recette

1. Réglage éteint par défaut sur un compte neuf ; aucun bandeau nulle part.
2. Une fois activé : planifier une séance jambes (≥ 8 séries, groupe majoritaire) puis une sortie
   longue le lendemain → **le bandeau apparaît sur le jour de la course**.
3. Le bandeau **affiche le nombre de séries** et le type de course.
4. « Déplacer au {{jour}} » déplace **la course**, jamais la séance de muscu.
5. Après déplacement, **le bandeau disparaît** et n'en crée pas un nouveau ailleurs.
6. Semaine pleine, aucun jour valable → bandeau **sans bouton**, avec sa raison.
7. Jambes minoritaires, ou < 8 séries → **aucun bandeau**.
8. Course `endurance` ou `recuperation` le lendemain → **aucun bandeau**.
9. Course déjà réalisée → aucun bandeau.
10. Désactiver le réglage → les bandeaux disparaissent immédiatement.
11. Mode avion → identique.
12. FR ⇄ EN → aucune chaîne brute ; le jour du repli est localisé.
13. Police 1,5× et thème sombre → bandeau lisible, non tronqué.
14. TalkBack → le bandeau est annoncé d'un bloc, le bouton d'échange est atteignable.
15. 🔴 **L'interrupteur survit à une réinstallation.** Activer le réglage, désinstaller, réinstaller,
    se reconnecter : il doit revenir activé. C'est le seul test qui exerce **ensemble** la migration
    et le schéma PowerSync local — et c'est la panne exacte de CYCLE-01, où l'interrupteur restait
    éteint en silence parce que la colonne manquait au schéma local.
16. 🔴 **Calibrage du seuil** : sur ton propre planning, 8 séries est-il le bon déclencheur, ou
    est-ce trop bas / trop haut ? C'est un jugement de pratiquant, pas une manipulation.

## 12. Definition of Done

- [ ] `typecheck`, `lint`, `test:coverage` verts, cliquets tenus.
- [ ] Moteur **pur** : zéro React, zéro base, zéro lecture d'horloge.
- [ ] Migration créée, **poussée** (`db:push`), cochée dans [MIGRATIONS.md](../../../../supabase/MIGRATIONS.md).
- [ ] 🔴 **Colonne ajoutée à `apps/mobile/src/powersync/schema.ts`** — sans elle l'interrupteur
      échoue en silence. Aucune sync rule à redéployer (`user_settings` est lue en `select *`).
- [ ] Champ ajouté à `userSettingsRowSchema` (`packages/shared/src/settings.ts`) avec `.default(false)`.
- [ ] Le seuil est une **constante nommée et exportée**, pas un littéral enfoui.
- [ ] FR + EN symétriques, nombres formatés avant interpolation.
- [ ] Idée archivée dans IDEAS.md avec la décision.
- [ ] CHANGELOG, front-matter, roadmap 3.57, RECETTES.md, ETAT.
