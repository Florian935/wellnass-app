---
id: MUSCU-FIX02
titre: "La séance en direct doit dérouler — lenteurs, écrans noirs, bascule de mode, clôture"
roadmap: [3.59, 3.61]
catalogue: []
etape: recette
branche: dev
maj: 23/09/2026
---

# US MUSCU-FIX02 — La séance en direct doit dérouler

> Issue du retour de **Florian le 23/09/2026** : « souvent des écrans noirs », « quand je passe du
> mode immersif au mode classique, ça plante, ou j'ai pas l'affichage », « plein de petits bugs qui
> rendent l'utilisation d'une séance en direct juste impossible », et « c'est pas normal que ce
> soit long : on charge juste une séance et des séries ».
>
> ⚠️ **Traité en une passe, sans validation intermédiaire, directement sur `dev`** — décision de
> Florian (« tu fais une grosse analyse et dans la foulée les correctifs »). La spec est écrite
> **avec** le code, pas avant ; la recette sert de filet ([RECETTES.md §84](../../../../RECETTES.md)).
>
> 🔎 **Aucune fonctionnalité nouvelle, aucune migration, aucune sync rule.** Des index locaux
> PowerSync (créés au démarrage, sans resynchronisation) et des correctifs.

## 1. Le diagnostic en une phrase

Florian avait raison : charger une séance n'a **aucune** raison d'être long. Ce qui l'était, c'est
**une requête de l'écran immersif, montée aussi en classique**, dont le coût grandissait comme le
carré de l'historique, et qui se relançait **à chaque série validée** — sur une base locale où
**aucun index n'existait**. Autour de ce cœur, quatre défauts d'écran transformaient la latence en
incohérences visibles (écran vide, série validée deux fois, menu qui reste ouvert, cérémonie coupée).

## 2. Les mesures

Banc de mesure reproduisant **exactement** la structure PowerSync (vues `CAST(json_extract(data,
…))` sur des tables `ps_data__*` — format vérifié dans le binaire natif `libpowersync.so`), avec un
historique réaliste (22 séries par séance, catalogue de 350 exercices). Temps sur PC ; **compter
×5 à ×10 sur un téléphone**.

| Requête de l'écran de séance | 60 séances, avant | 60, après | 200 séances, avant | 200, après |
|---|---:|---:|---:|---:|
| Références « la dernière fois » (fantôme, verdict) | 277 ms | 1,5 ms | **2 760 ms** | 4,8 ms |
| Séries de la séance en cours | 18 ms | 0,1 ms | 20 ms | 0,2 ms |
| Bibliothèque (« Ajouter un exercice ») | 210 ms | 0,8 ms | 217 ms | 0,8 ms |
| Dernière performance | 1,7 ms | 0,2 ms | 5,6 ms | 0,7 ms |
| **Total** | **~520 ms** | **~3 ms** | **~3 000 ms** | **~6,5 ms** |

Et derrière l'écran, **le hub muscu reste monté** : sa requête d'historique (1,26 s à 200 séances,
sans index) se relançait elle aussi à chaque série validée. Avec index : **15 ms**.

Sur un téléphone, avec 60 séances d'historique, la seule requête de références coûtait donc
**1,5 à 3 s par validation** ; à 200 séances, **15 à 30 s**. Les 5 connexions de lecture de
PowerSync se remplissaient, et les requêtes légères de l'écran attendaient derrière.

## 3. Les causes, une par une

### 3.1 Base de données

| # | Cause | Effet visible | Correctif |
|---|---|---|---|
| D1 | `SELECT_SESSION_REFERENCES` : sous-requête **corrélée** rejouée pour chaque série de l'historique | écran noir au lancement, décalage de plusieurs secondes après chaque validation, **dans les deux modes** | réécrite en fonction de fenêtre (`ROW_NUMBER`) ; mêmes lignes, verrouillé par 5 tests |
| D2 | **Aucun index** dans le schéma local : toute recherche relit la table en extrayant le JSON | tout ce qui précède, plus le hub derrière | 9 index locaux sur 7 tables (`schema.ts`) |
| D3 | SQLite **n'utilise jamais un index** pour la table de droite d'un `LEFT JOIN` sur une vue PowerSync (vérifié : même avec l'index, le plan reste `SCAN`) | noms d'exercice et bibliothèque lents | `exerciseNameSql` : sous-requêtes scalaires, seule forme indexable ; appliqué aux séries, au brief, à la bibliothèque, au calcul des records |
| D4 | Les séries étaient lues **avec l'id rendu par la requête de séance** : deux requêtes en cascade | au lancement, un rendu « séance vide » (« + Ajouter un exercice ») sur une séance de programme | `SELECT_ACTIVE_SETS` lit la séance active par sous-requête ; les deux partent ensemble |
| D5 | `SELECT_SESSION_CARDS` lisait `exercises.instructions`, **colonne inexistante** en local : la requête échouait à chaque appel, en silence | en immersif, **la barre chargée ne s'affichait jamais**, le coach ne disait jamais la consigne | la consigne se lit dans `exercise_translations` |
| D6 | Réponses **périmées** de `useQuery` au changement d'exercice (dernière perf, note) | un instant, la charge du squat pré-remplie sur un curl ; une note recopiée d'un exercice à l'autre | chaque ligne porte son exercice, les autres sont écartées |
| D7 | `SELECT_SECOND_LAST_PERFORMANCE` : `OFFSET 1` sautait une **série**, pas une séance | le deload « deux séances difficiles de suite » (MUSC-F7) partait après **une seule** séance difficile | `GROUP BY` séance |
| D8 | `cancelWorkout` : une écriture **par série** (26 pour 24 séries), chacune relançant toutes les requêtes montées | « Abandonner » long, avec « Aucune séance en cours » à l'écran | une transaction |

### 3.2 Écran de séance

| # | Cause | Effet visible | Correctif |
|---|---|---|---|
| E1 | À la clôture, la séance n'est plus « active » : la requête rend `null` | en immersif, **la cérémonie de fin disparaît** au profit de « Aucune séance en cours » ; en classique, l'annonce clignote pendant le calcul des records | `closing` : l'image de la séance reste jusqu'au départ, chrono figé |
| E2 | En immersif, **« Terminer » depuis le menu ⋮** ne lançait pas la cérémonie (seul le bouton du pont le faisait) et ne naviguait pas | séance close, écran « Aucune séance en cours », aucun bilan | la cérémonie est un état de l'écran de séance (`runtime.closing`), quel que soit le bouton |
| E3 | Le menu et le sélecteur de superset vivaient **dans** chaque rendu : changer de mode depuis le menu remplaçait tout l'arbre, **modale ouverte comprise** | la bascule immersif → classique « qui plante » ou n'affiche rien ; le menu reste ouvert par-dessus le nouveau mode | les deux modales sont **hors** des rendus ; le menu se ferme au changement de mode |
| E4 | La validation attendait que la base relise la série | au repos, « Série 2/4 » puis « 3/4 » ; un second appui validait **la même** série | validation optimiste (`doneOverrides`), la base redevient seule juge dès qu'elle a rattrapé |
| E5 | Deux appuis dans le même cycle de rendu | même série validée deux fois (records comptés deux fois, repos relancé) | garde par `ref` |
| E6 | Le plan demandé par le brief se rouvrait à chaque bascule vers l'immersif | plan qui surgit sans raison | consommé une fois |
| E7 | Chargement aux couleurs du thème de l'app, même en immersif | flash clair entre le brief (sombre) et la séance | chargement aux couleurs du mode |
| E8 | Le cadran de reps (immersif) vit dans une modale Android, **hors** de la racine de gestes | le glissé vertical ne répondait pas, seuls − / + marchaient | `GestureHandlerRootView` dans la modale |

## 4. Règles

- **R1.** Un écran de séance n'affiche jamais « Aucune séance en cours » pour une séance qu'il est en
  train de clore (terminer ou abandonner).
- **R2.** Terminer une séance **avec** des séries validées, en immersif, mène **toujours** à la
  cérémonie, puis au bilan — que l'appui vienne du pont ou du menu. **Sans** série validée : pas de
  cérémonie, on part au bilan.
- **R3.** Changer de mode en pleine séance ne perd rien, ne remonte pas le menu, et le referme.
- **R4.** Après une validation, la série suivante est affichée **immédiatement**, sans attendre la
  base ; une même série n'est jamais validée deux fois par une rafale d'appuis.
- **R5.** Aucune lecture de l'écran de séance ne relit l'historique entier ; aucun `LEFT JOIN` sur
  `exercise_translations` dans le chemin de la séance.

## 5. Ce qui est livré

| Fichier | Changement |
|---|---|
| `powersync/schema.ts` | 9 index locaux (`workout_sets` ×2, `exercise_translations`, `exercise_plans`, `personal_records` ×2, `exercise_notes`, `exercise_favorites`, `workout_superset_pairs`) |
| `data/repositories/_sql.ts` | `exerciseTranslationSql` / `exerciseNameSql` — la seule forme indexable |
| `data/repositories/workout-repository.ts` | `SELECT_ACTIVE_SETS` (plus de cascade), noms indexables, dernière / avant-dernière perf corrigées et protégées, note protégée, `cancelWorkout` en transaction |
| `data/repositories/immersive-repository.ts` | références réécrites, cartes réparées (+ langue), brief indexable |
| `data/repositories/exercise-repository.ts` | bibliothèque indexable, `exercisesQuery` exportée pour le harnais |
| `data/repositories/records-repository.ts` | nom indexable dans le calcul des records de clôture |
| `app/workout.tsx` | `closing` (image gardée, chrono figé, repos arrêté, saisie refusée), `doneOverrides`, garde de double appui, modales hors des rendus, plan consommé, chargement aux couleurs du mode |
| `components/workout/immersive/ImmersiveWorkout.tsx`, `types.ts` | la cérémonie suit `runtime.closing` |
| `components/workout/immersive/RepDial.tsx` | racine de gestes dans la modale |

## 6. Tests-gardes

- `session-live-sql.test.ts` (**20**, neuf) — exécuté sur le harnais SQLite : références (les 5
  passaient **aussi** sur l'ancien SQL, preuve que la réécriture ne change aucune ligne), cartes
  (échouait sur l'ancien : `no such column: instructions`), brief, séries actives, noms (repli,
  archivé, jamais de ligne dupliquée), bibliothèque, avant-dernière séance (échouait sur l'ancien),
  exercice porté par chaque ligne.
- `workout-screen.test.tsx` (**+11**) — clôture sans « Aucune séance en cours » (classique et
  immersif), cérémonie lancée depuis le menu, pas de cérémonie sans série, clôture qui échoue,
  repos arrêté et saisie refusée pendant la clôture,
  validation optimiste, double appui, base qui fait foi, bascule de mode sans remontage du menu,
  rien de perdu à la bascule. **9 d'entre eux échouent sur l'ancien écran** (vérifié en le
  restaurant) ; les 2 autres sont des non-régressions.
- `workout-focus.test.ts` (**+6**) — `applyDoneOverrides` / `pruneDoneOverrides`.
- `ImmersiveWorkout.test.tsx` (lot de tests 11, arrivé sur `dev` pendant ce lot) — adapté au
  contrat `runtime.closing` : la cérémonie suit l'écran de séance, prime sur le repos, et le bouton
  seul ne la déclenche plus.

## 7. Ce qui n'est pas fait

- ⚠️ **Le même défaut `LEFT JOIN` existe ailleurs**, hors du chemin de la séance : ~30 requêtes
  (records, tableaux de bord, bilan de séance, hub). Elles ne se relancent pas à chaque série, donc
  ne bloquaient pas la séance ; elles pèsent sur le **bilan** (après clôture) et le **hub**. Noté
  au [BACKLOG](../../../../BACKLOG.md) — `exerciseNameSql` est l'outil pour les reprendre.
- ⚠️ **Pas de mesure sur téléphone** : les chiffres sont ceux du banc (PC). Le facteur ×5-10 est
  une estimation ; la recette dira si le lancement est devenu instantané.
- La **veille** du repos immersif (écran noir volontaire après 20 s sans toucher, spec
  MUSCU-UX03 §5.9) n'est **pas** touchée : c'est un choix de conception, désactivable dans les
  réglages de séance. Si c'est elle que désignaient certains « écrans noirs », c'est un arbitrage à
  rouvrir, pas un défaut.
- Le chrono de séance re-rend tout l'écran chaque seconde ; ce n'est pas une cause des symptômes,
  laissé tel quel.
