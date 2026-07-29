# Backlog — ce qu'il reste à faire

Une ligne par **candidat**, priorisé. Un candidat n'a **pas encore de spec** : dès qu'il entre
dans le pipeline (`/us`), il devient une spec dans [docs/specs/functional/us/](docs/specs/functional/us/)
avec son front-matter, disparaît d'ici et apparaît dans [ETAT.md](ETAT.md).

- **Où est quoi** : l'état courant → [ETAT.md](ETAT.md) · le périmètre complet →
  [roadmap](docs/roadmap/roadmap.md) · les analyses → [catalogue](docs/product/analyses-donnees.md)
  · les idées non cadrées → [IDEAS.md](IDEAS.md) · l'historique → [CHANGELOG.md](CHANGELOG.md).
- **Priorités** : **P0** bloquant le lancement · **P1** finition produit visible · **P2** confort / optionnel.
- Les `#` renvoient aux numéros de la [roadmap](docs/roadmap/roadmap.md).

---

## 🔴 P0 — Bloquant MVP1 (V0.8 → V1.0)

| Candidat | # | Contenu | Point dur |
|---|---|---|---|
| **CONF-07 — Accessibilité** | 9.11, 9.12 | Dynamic Type explicite (`maxFontSizeMultiplier` / `fontScale`) + audit contraste WCAG AA. | Revue visuelle humaine, non outillée à ce jour. |
| **LANCE-00 — Compte développeur Google Play** | 9.2 | Créer le compte développeur (25 $, une fois), puis la fiche d'application dans la Play Console. | 🔴 **Rien de la chaîne de publication ne peut démarrer sans lui** — ni la fiche, ni la déclaration santé, ni la soumission. Vérification d'identité Google : compter plusieurs jours. **Non démarré au 27/07/2026.** ⚠️ **La déclaration santé doit porter 4 types de données** (`WRITE_EXERCISE`, `WRITE_DISTANCE`, `READ_WEIGHT` de CONF-06 **+ `READ_STEPS`** de PAS-01, tranché le 28/07/2026) et déclarer, en « Sécurité des données », une **donnée de santé transmise hors de l'appareil** (les pas sont synchronisés). |
| **LANCE-01 — Publication Play Store** | 9.2 | Build AAB prod (EAS) + fiche Play + soumission review. | 🔴 Dépend de **LANCE-00** + de tout le P0 + du délai de review. |

> **CONF-06 — Health Connect** (9.9) est **entré dans le pipeline** le 26/07/2026 →
> [spec](docs/specs/functional/us/conf06-health-connect.md) · [plan](docs/plans/conf06-health-connect.md).
> Code livré le 27/07/2026 ; reste la recette device et la déclaration Play (ci-dessous).

> **Prérequis hors-code du lancement**, dans l'ordre des dépendances :
> 1. **Compte développeur Play + fiche d'app** (LANCE-00) — **préalable à tout le reste**.
> 2. **Politique de confidentialité publiée à une URL publique** (pas seulement le texte in-app) —
>    exigée par la fiche Play **et** par Health Connect ; suppose la relecture juridique des
>    textes CGU / confidentialité.
> 3. **Déclaration Google Play « Health apps »** pour Health Connect : formulaire + justification
>    des 3 types de données. ~7 j d'instruction + 5-7 j ouvrés de propagation. Procédure et textes
>    prêts à coller : [health-connect-play-declaration.md](docs/specs/technical/health-connect-play-declaration.md).
> 4. SMTP custom Supabase (le service e-mail intégré est rate-limité).
> 5. `app_version` réelle dans `app.json` (aujourd'hui `0.0.0`).
>
> ⚠️ Les points 1 → 3 s'enchaînent **en série** et sont tous à délai externe : environ **3 semaines**
> entre « je crée le compte » et « Health Connect fonctionne en production ». À démarrer bien avant
> d'avoir fini le code, sinon ils deviennent le chemin critique du lancement.

---

## 🟠 P1 — Finitions produit

> **Élargissement du 28/07/2026.** Le code est **en avance sur le cahier des charges** alors que les
> prérequis de publication (compte Play, déclaration santé, relecture juridique) sont à **délai externe
> d'environ 3 semaines**. Décision : occuper cette fenêtre plutôt que d'attendre Google → **14 idées
> promues depuis [IDEAS.md](IDEAS.md)** et regroupées dans la nouvelle version
> **[V0.9](docs/roadmap/roadmap.md#v09--enrichissements-avant-lancement)** (~54 h).
> **Filtre appliqué** : offline-first, aucune dépendance backend/IA, hors gamification (arbitrage C),
> hors social (V2), hors paiement (arbitrage D), et réutilisation d'une infra déjà livrée. Tout ce qui
> exige un moteur de règles (détecteur de collisions, mode « vie réelle »), de l'historique long
> (simulateur what-if, rétrospective annuelle) ou une base d'utilisateurs (board de suggestions,
> compétition) est resté hors périmètre.
>
> **Ordre conseillé.** Déjà sortis du backlog : **PAS-01** clôturé le 28/07 (9.15 ✅), **BIEN-01** et
> **ADMIN-01** en recette (1.24 et 8.11 🟡 — voir [ETAT.md](ETAT.md)). Reste, dans cet ordre : les
> **STREAK-01**, puis **OBJ-01** et **BILAN-01** — les 3 UX de recette, **MESUR-01** et **NUTR-F2**
> sont livrées (29/07). Et
> **CONF-07 en dernier** des chantiers de code, délibérément : un balayage d'accessibilité refait
> après chaque nouvel écran serait du travail perdu.

### Enrichissements V0.9 — rétention & valeur produit

| Candidat | # | Contenu | Point dur |
|---|---|---|---|
| **STREAK-01 — Joker / gel de streak** | 7.14 | 1 joker/mois protège la série sur un jour manqué. | Décider la règle exacte (recharge, rétroactivité, effet sur les stats) **avant** de coder : c'est de la mécanique produit, pas de la technique. **Gratuit en V1** (arbitrage D). Ne pas glisser vers une boucle de jeu (arbitrage C). |
| **OBJ-01 — Objectifs personnels à échéance** | 7.15 | « 50 km ce mois », « +5 kg au développé en 8 semaines » — anneau de progression, jalons, célébration. | **Non social** et **mono-objectif** (l'objectif hybride à arbitrage de compromis reste post-V1). Le calcul de progression doit se brancher sur les agrégats existants, pas en créer de nouveaux. |
| **BILAN-01 — Bilan hebdomadaire automatique** | 7.16 | Récap en notification : ce qui progresse, ce qui bloque, **une seule décision** pour la semaine. | Règle non négociable : **aucune narration sans les chiffres affichés à côté**. Texte assemblé depuis des clés i18n (pas de texte libre), agrégats calculés localement, **pas d'IA**. Survivre au doze mode Android. |

### Finitions UX remontées en recette

> ✅ **Lot livré le 29/07/2026** (UX-LOT-01, roadmap 3.53 / 3.54 / 7.18 → ✅). UX-02 était en fait
> **déjà livré** depuis `12bd3a1`, et le diagnostic d'UX-04 était faux sur 2 points — voir la
> [spec](docs/specs/functional/us/uxlot01-finitions-recette.md) §0.

### Musculation

| Candidat | # | Contenu | État |
|---|---|---|---|
| **MUSC-F7 — Progression assistée** | 3.7, 3.8 | Progression auto de charge au niveau programme + câblage du deload. | 🟡 La brique pure `computeProgressionSuggestion` (kind `deload`) est **livrée et testée mais non déclenchée** : il manque le signal `previousStruggled` (séance avant-dernière) et la validation de la règle par Florian. **Absorbe** l'idée « détection de plateau + deload proactif » : c'est le même déclencheur, à étendre à la stagnation sur N séances. |
| **MUSC-F8 — Notifications push muscu** | 3.42, 2.7, 2.4 | Push nouveau record + rappel de séance planifiée. | ⬜ L'infra notif existe (streak, DND) → à étendre. **Absorbe** l'idée « rappels contextuels » côté muscu (séance prévue aujourd'hui, streak en danger ce soir) — voir la note d'heure apprise sur NUTR-F1. |
| **MUSC-F9 — Décalage en glisser-déposer** | 3.10 | Déplacer une séance planifiée au doigt. | ⬜ Aujourd'hui report par action seulement. Aucune lib DnD sur le planning. |
| **MUSC-F1b — Muscles ciblés sur schéma SVG** | 6.2 | Corps humain SVG avec muscles travaillés en évidence. | ⬜ Sujet **distinct** des GIF abandonnés (6.1) — reste ouvert. |
| **MUSC-F6 — Fenêtre de reprise de séance** | 3.36 | Réconcilier les seuils : la spec dit 4 h, la clôture auto (3.37) borne à 3 h. | 🟡 Décision produit à trancher avant code. |

### Running

| Candidat | # | Contenu | État |
|---|---|---|---|
| **RUN-F2 — Séances guidées vocales** | 5.18, 5.19, 5.9, 5.23 | Annonces audio par km + guidage fractionné + blocs rapide/récup structurés + cible prolonger/raccourcir. | ⬜ Les séances guidées sont **déconnectées du tracker actif** — c'est le vrai chantier. Dépend de `expo-speech` (absent). |
| **RUN-F3 — Résumé de course enrichi** | 5.24, 5.25 | Météo / terrain + comparaison à l'objectif. | ⬜ **Absorbe** l'idée « météo **avant** une sortie planifiée » : aujourd'hui la météo n'est qu'un champ post-séance ; l'afficher en amont d'une sortie prévue aide à planifier — même source de données. |
| **RUN-F1b — Dénivelé cumulé** | 5.32 | Dénivelé positif par semaine / mois. | ⛔ **Bloqué** : la trace GPS ne capte pas l'altitude (`GpsPoint = {lat,lng,t}`). Nécessite de modifier le tracker R1, étendre le codec, et **les courses déjà enregistrées resteront sans dénivelé**. |

### Contenu

| Candidat | # | Contenu | État |
|---|---|---|---|
| **CONTENU-01 — Seed des bibliothèques de programmes** | 3.1, 5.2 | Catalogues muscu + course, aujourd'hui **vides**. 🌐 FR+EN. | 🟡 **Méthode tranchée le 28/07/2026 (Florian) : migration SQL idempotente** (patron CIQUAL), le constructeur admin 8.4 restant le pipeline d'entretien → [spec §2](docs/specs/functional/us/contenu-01-seed-bibliotheques-programmes.md). **Reste à trancher : le contenu** — nombre de programmes par pilier au lancement, et qui fournit séances/exos/reps. C'est du travail de coach, pas de dev. |

---

## 🟢 P2 — Confort & optionnel

| Candidat | # | Contenu | État |
|---|---|---|---|
| **NUTR-F1 — Rappels programmés nutrition** | 1.14, 2.5 | Rappel de pesée + rappel de repas. | ⬜ Étend l'infra notif existante. **Absorbe** l'idée « rappels contextuels » : viser l'**heure apprise** du comportement (moyenne glissante des heures de log sur ~2 semaines, calcul 100 % local) plutôt qu'une heure fixe, avec une fenêtre de repli de ~30 min pour le doze mode et un plafond de notifications/jour. |
| **PARTAGE-01 — Carte de séance / course partageable** | 7.17 | Export image (trace GPS + stats, ou résumé muscu) pour les stories. | ⬜ **Partage sortant statique, zéro backend** — le feed social reste V2. Levier d'acquisition disponible dès le lancement → à remonter en P1 si le calendrier le permet. |
| **MUSC-F14 — Suggestion de substitution d'exercice** | 3.52 | Matériel pris ou zone douloureuse → alternatives du même groupe musculaire. | ⬜ Le **remplacement en direct existe déjà** (3.32) ; il ne manque que la **suggestion**. |
| **UX-05 — RPE ou RIR au choix** | 3.55 | Préférence de profil : intensité en RPE ou en RIR (RIR ≈ 10 − RPE). | ⬜ Évolution du RPE par série (3.34). Une seule donnée en base, conversion à l'affichage. |
| **SOCLE-01 — RevenueCat câblé inactif** | 9.14 | Entitlements posés, aucun paywall (app gratuite en V1). | ⬜ Optionnel — posé tôt, évite une refonte ([ADR-003](docs/adr/ADR-003-monetisation.md)). |

---

## 🔵 Après V0.9 — 2ᵉ salve d'enrichissements *(arbitrage Florian, 28/07/2026)*

> **Séquencement explicite : ces candidats passent APRÈS les 13 items restants de V0.9.** Le code
> reste en avance sur le cahier des charges, mais V0.9 (~57 h) occupe déjà toute la fenêtre des
> délais externes de Google : cette salve est un **choix de capacité**, pas un manque de périmètre.
> Aucune ligne de roadmap n'est créée tant qu'un candidat n'entre pas dans le pipeline via
> [`/us`](.claude/commands/us.md).
>
> **Filtre appliqué** (identique à V0.9) : offline-first, aucune dépendance backend/IA, hors
> gamification (arbitrage C), hors social (V2), hors paiement (arbitrage D).

| Candidat | Source | Contenu | Point dur |
|---|---|---|---|
| **RUN-14 — Prédiction de temps de course (Riegel)** | [catalogue](docs/product/analyses-donnees.md) RUN-14 | `T2 = T1×(D2/D1)^1,06` depuis un record récent → 10 km / semi / marathon, + allure cible. | Formule pure sur `running_pace_records`, **aucune donnée nouvelle** → effort très faible. Point dur = **honnêteté** : afficher le record source et ne rien promettre ; l'exposant dérape sur marathon pour un coureur peu entraîné (prévoir une réserve explicite). |
| **NUTR-16 — Répartition calorique par repas** | [catalogue](docs/product/analyses-donnees.md) NUTR-16 | Part des kcal/macros par repas (petit-déj / déj / dîner / collations). | `meal_type` est **déjà en base**, aucun agrégat par repas n'existe → migration inutile. Point dur : les **repas personnalisés** (`nutrition_profiles.meals`) rendent les libellés variables → pas de liste de repas figée dans le calcul. |
| **MUSC-09 — PR par plage de reps** | [catalogue](docs/product/analyses-donnees.md) MUSC-09 | Meilleure charge par tranche de reps (1/3/5/8/10/12+), courbe charge↔reps. | ⚠️ **Aucune ligne roadmap** — le lien vers 6.3 était erroné (6.3 = accès démo pendant la séance, ❌ abandonné). Une ligne « Hors périmètre de cadrage » est à créer à l'entrée en pipeline. Données déjà là ; définir les buckets et l'état vide des plages non travaillées. |
| **Widget écran d'accueil Android** | [IDEAS.md](IDEAS.md) 13/07 | Séance du jour / streak / kcal restantes **sur l'écran d'accueil** — les widgets 7.x sont *in-app*. | 🔴 **Le plus cher du lot, et c'est du natif** : React Native ne rend pas de widget → AppWidget/Glance + pont vers la base locale. Atténuation : le plugin Expo maison écrit pour Health Connect prouve que le savoir-faire est là. Rétention passive dès le J1, sans historique. |
| **Parcours « 7 jours pour démarrer »** | [IDEAS.md](IDEAS.md) 13/07 | Mini-programme d'activation guidé, tous piliers, pour atteindre vite le « aha moment ». | La **seule** feature de rétention qui fonctionne le jour du lancement : contrairement au bilan hebdo, aux souvenirs ou au wrapped, elle n'exige **aucun historique**. Surtout du **contenu FR+EN** + un écran de progression. À ne pas confondre avec l'onboarding (1.7-1.9) : activation, pas inscription. |

> **Écarté de cette salve à la réconciliation du 28/07/2026** : **RUN-10 — splits par km** était le
> candidat n°1 proposé… et il est **livré depuis le 25/07** (`computeKmSplits` + tableau sur le résumé
> de course, roadmap 5.26 ✅). Le catalogue le donnait ⏳. C'est la raison d'être de `/reconcilier`.

---

## 🧹 Dette & suivi technique

Petits sujets hors US, à traiter à l'occasion. Ne bloquent rien.

- [ ] **`supabase/seed.sql` est inatteignable** — il n'est joué que par `db:reset`, qui exige Docker
      (que personne n'a). Les 16 exercices de bibliothèque sont donc arrivés sur le cloud par un
      chemin non tracé. → Les basculer en **migration idempotente** (comme le seed CIQUAL), ou
      documenter explicitement que `seed.sql` ne sert qu'au futur usage Docker.
- [ ] **`main` n'a pas bougé depuis le 04/07/2026** (927 commits de retard sur `dev`). Aucun tag,
      aucun point de repère de version. → À traiter au moment de LANCE-01.
- [ ] **2 tests mobile en échec par timeout** (`edit-exercise-modal-smoke`, `exercise-detail-smoke`) :
      dépassement des 15 s sur poste lent (jest y met ~250 s par suite). Pas une régression logique.
      → Vérifier sur CI ; si rouge, relever le `testTimeout` de ces deux suites.
- [ ] **Suivi analytics (US 9.10)** : dépendance circulaire bénigne `analytics.ts ↔ settings-repository.ts` ·
      test du gating `track()` (OFF → no-op) · doublon `onboarding_started` observé en dev (probable
      StrictMode, à confirmer hors dev) · renseigner une vraie `app_version` avant la bêta.
- [ ] **Recette 2 appareils du `signOut` local** (`fix/signout-scope-local`) — déconnecter A ne doit
      pas déconnecter B. Non vérifiable sur un seul device.
- [ ] **Découpage des stats course par type de séance** — différé : les courses libres n'ont pas de
      `session_type`.

---

## ⏳ Reporté / abandonné (trace)

| Item | # | Décision |
|---|---|---|
| Modération des aliments signalés | 8.7 | ⏳ **Reportée** (16/07/2026) : modèle **privé par utilisateur** (RLS `owner_id`), aucun mécanisme de signalement → file sans objet. À redéfinir avant reprise. |
| Démonstrations visuelles d'exercices (GIF) | 6.1, 3.18, 6.3, 8.3 | ❌ **Abandonné** (Florian/Damien, 20/07/2026) : trop complexe pour la valeur (sourcing + hébergement + import en masse). `media_url` reste stocké mais ne sera jamais rendu. |
| App iOS + OAuth Apple | 9.1, 1.3 | ⏳ Hors périmètre de lancement ([ADR-004](docs/adr/ADR-004-plateforme-lancement.md)) — portage après stabilisation Android. |
| Import de données (GPX, CSV Hevy/Strong/MFP) | 1.20 | V1.1 post-lancement — à remonter en V0.8 si la bêta le réclame. |
| Planning repas + liste de courses | 4.27, 4.28, 4.29 | V1.1 post-lancement. |

---

*Tenu à jour par [`/commit`](.claude/commands/commit.md) et [`/etat`](.claude/commands/etat.md).
Dernière révision : 28/07/2026 (réconciliation — 2ᵉ salve séquencée après V0.9 ; élargissement V0.9 :
14 idées promues depuis [IDEAS.md](IDEAS.md) ; PAS-01 clôturé).*
