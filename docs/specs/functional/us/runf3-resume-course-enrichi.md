---
id: RUN-F3
titre: "Résumé de course enrichi — objectif atteint et conditions"
roadmap: [5.24, 5.25]
catalogue: []
etape: validation
branche: feature/runf3-resume-course-enrichi
maj: 30/07/2026
---

# US RUN-F3 — Résumé de course enrichi

> ⚠️ **Correction d'un constat du backlog.** L'entrée RUN-F3 affirme : « aujourd'hui la météo n'est
> qu'un champ post-séance ». **C'est faux.** Vérifié le 30/07/2026 : la table `runs`
> ([schema.ts](../../../../apps/mobile/src/powersync/schema.ts)) contient `distance_m`,
> `duration_seconds`, `avg_pace_s_per_km`, `gps_track`, `rpe`, `notes` — et **rien d'autre**.
> `grep -i "weather|temperature|terrain|elevation"` sur les **58 migrations** ne renvoie
> **aucun résultat**. Il n'existe ni champ météo, ni champ terrain, nulle part.
>
> Cette US ne « surface » donc pas une donnée existante : elle en **crée** une. Ce qui change son coût
> et son arbitrage.

## 0. L'US se scinde en deux, et une seule est simple

La roadmap groupe deux sujets qui n'ont **ni la même donnée, ni le même risque** :

| | **5.25 — Comparaison à l'objectif** | **5.24 — Météo / terrain** |
|---|---|---|
| Donnée | **déjà là** (`planned_sessions.target_distance_m`, `target_duration_seconds`) | **inexistante** |
| Réseau | aucun | ⚠️ **API météo tierce** |
| Offline | ✅ total | ❌ une course hors ligne n'aura **pas** de météo |
| Migration | **aucune** | oui, + sync rules |
| Coût | ~3 h | ~8 h + choix de fournisseur |

→ **Recommandation : livrer 5.25 seule dans cette US**, et sortir 5.24 en candidat distinct.
5.25 est du calcul pur sur des données présentes ; 5.24 introduit une **dépendance réseau** dans une
app dont c'est l'argument principal de ne pas en avoir. **→ Décision Damien / Florian (§4, D1).**

Le corps de la spec décrit **5.25**. La partie 5.24 est cadrée en §4 pour que la décision soit
prise en connaissance de cause, pas pour être codée ici.

## 1. Périmètre (5.25)

Sur l'écran de résumé d'une course **issue d'une séance planifiée**, afficher l'écart à la cible :
distance visée vs parcourue, durée visée vs réalisée.

**Hors périmètre** : les courses libres (sans `planned_session`) — elles n'ont pas de cible, et leur
en inventer une serait inventer une intention.

## 2. Règles

**R1 — Pas de cible, pas de bloc.** Une course libre affiche le résumé actuel, inchangé. **Aucun
encart vide, aucun « — ».**

**R2 — L'écart se dit en clair, pas seulement en pourcentage.** « 5,2 km sur 5,0 km visés — objectif
dépassé de 200 m ». Un pourcentage seul (« 104 % ») ne dit pas si c'est bien.

**R3 — Une cible partielle est un cas normal.** Une séance peut ne viser qu'une distance, ou qu'une
durée. On compare **ce qui est visé**, on ne complète pas l'autre.

**R4 — Ne pas atteindre l'objectif n'est pas un échec.** Ton neutre et factuel : « 4,1 km sur
5,0 km visés ». **Ni rouge, ni « raté »** — c'est la règle déjà appliquée au dépassement calorique
en nutrition, on la reconduit.

**R5 — Tolérance de 2 % pour « atteint ».** Un GPS ne rend jamais 5,000 km exactement. Sans marge,
une séance réussie s'afficherait presque toujours comme manquée de quelques mètres. À 5 km, cela
représente ±100 m.

**R6 — Unités impériales respectées.** Le réglage existant s'applique ; la tolérance de R5 est
**relative**, donc insensible à l'unité.

## 3. Le lien course ↔ séance planifiée

⚠️ **Point à vérifier au démarrage du code, il conditionne tout.** La table `runs` n'a **pas** de
colonne `planned_session_id` : le rattachement se fait aujourd'hui par le statut de la
`planned_session`, pas par une clé portée par la course.

Deux issues possibles, à trancher **par lecture du code**, pas par supposition :
- **(a)** Le lien est reconstituable de façon fiable (même jour, même utilisateur, pilier course) →
  aucune migration, l'US reste à ~3 h.
- **(b)** Il ne l'est pas → il faut **ajouter `planned_session_id` à `runs`** : migration **+ sync
  rules à redéployer** (étape manuelle, déjà oubliée une fois — cf. CLAUDE.md).

C'est la seule inconnue technique de 5.25, et elle double le coût si c'est (b).

## 4. 🔴 Décisions

**D1 — Scinder ou non 5.24 de cette US ?** Recommandation : **oui** (voir §0).

**D2 — Si 5.24 est retenue malgré tout**, trois questions à trancher **avant** toute ligne de code :
1. **Quel fournisseur ?** Open-Meteo est gratuit et sans clé — c'est le seul qui n'ajoute pas de
   secret à gérer. Les autres imposent une clé d'API, donc un stockage de secret dans l'app.
2. **Quand appelle-t-on ?** À la fin de la course, avec la position de départ. Si le réseau manque,
   le champ reste **vide définitivement** — on ne peut pas récupérer une météo passée gratuitement.
   **Une course sur sentier sans réseau n'aura jamais de météo**, et il faut l'assumer explicitement.
3. **Envoie-t-on la position à un tiers ?** Oui — une requête météo, c'est des coordonnées transmises
   à un service externe. Cela **modifie la politique de confidentialité et le formulaire Sécurité des
   données** de LANCE-00, qui affirment aujourd'hui qu'aucune donnée n'est partagée. ⚠️ **À trancher
   avant de soumettre la fiche Play**, sinon la déclaration sera à refaire.

**D3 — Le terrain (route / sentier / piste / tapis).** N'a **pas** besoin de réseau : c'est un simple
choix de l'utilisateur. Il pourrait être livré avec 5.25, à faible coût (une colonne, un sélecteur).
Recommandation : **oui, l'inclure** — c'est la moitié utile de 5.24 sans aucun de ses inconvénients.

## 5. i18n

FR + EN. Nouvelles clés : `run.target.title`, `run.target.reached`, `run.target.distanceOf`,
`run.target.durationOf`, `run.target.over`, `run.target.under`. Si D3 est retenue :
`run.terrain.{road,trail,track,treadmill}`.

⚠️ Les écarts sont des **phrases à variables** (`{{done}}`, `{{target}}`), pas des concaténations —
l'ordre des mots diffère entre FR et EN.

## 6. Comportement offline

**5.25 : total.** Cible et réalisé sont tous deux locaux, le calcul est pur. Aucun réseau.
**D3 (terrain) : total** également — c'est une saisie.
**5.24 (météo) : partiel par nature**, et c'est irréductible. Voir §4 D2-2.

## 7. Critères de recette

- [ ] 1. Course issue d'une séance visant 5 km, 5,2 km parcourus → « objectif dépassé », ton positif.
- [ ] 2. Même séance, 4,1 km parcourus → écart affiché **sans rouge ni « raté »** (R4).
- [ ] 3. Course de **4,95 km** sur 5 km visés → **« atteint »** grâce à la tolérance de 2 % (R5).
- [ ] 4. Séance ne visant qu'une **durée** → seule la durée est comparée, aucune ligne distance (R3).
- [ ] 5. **Course libre** → résumé strictement inchangé, aucun encart vide (R1).
- [ ] 6. Réglage **impérial** → miles, et la tolérance se comporte pareil (R6).
- [ ] 7. **Mode avion** : la comparaison s'affiche normalement (elle ne dépend d'aucun réseau).
- [ ] 8. En **EN** : les phrases d'écart sont grammaticales, pas des mots collés.
- [ ] 9. Si D3 : le terrain choisi est **persistant** et visible dans l'historique.
- [ ] 10. Si 5.24 : une course **sans réseau** affiche le résumé **sans bloc météo** — pas un bloc
      météo vide.

## 8. Ce que cette US absorbe, et ce qu'elle n'absorbe pas

**Absorbe** — l'idée « météo **avant** une sortie planifiée » du backlog : même source de données,
donc à traiter avec 5.24 s'il est retenu.

**N'absorbe pas** — **RUN-F1b (dénivelé)**. Le backlog le note bloqué, et la vérification le confirme :
`GpsPoint` ne porte que `{lat, lng, t}`, **aucune altitude**, et aucune colonne d'élévation n'existe
dans les 58 migrations. Le dénivelé exige de modifier le tracker R1 et le codec — et **les courses
déjà enregistrées resteront sans dénivelé pour toujours**. Sujet distinct, à ne pas mélanger ici.
