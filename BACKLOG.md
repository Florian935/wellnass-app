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
| **CONF-07 — Accessibilité** | 9.11, 9.12 | Dynamic Type explicite (`maxFontSizeMultiplier` / `fontScale`) + audit contraste WCAG AA. | 🟢 **Dynamic Type : rien à faire.** 41 écrans vérifiés à 1,5× le 30/07/2026, aucune troncature — uniquement du reflux attendu.<br>🔴 **Contraste : 3 non-conformités mesurées sur la palette** ([colors.ts](apps/mobile/src/theme/colors.ts)), **toutes en thème clair** — le sombre passe partout.<br>• `textMuted` / fond = **3,10** et / surface = **3,44** (AA texte normal exige **4,5**). Touche *tout* le texte secondaire : dates, unités, hints, libellés de champ, « en baisse de 57 % ». Sombre : 9,22 / 7,47 ✅.<br>• `accent` / fond = **3,95** (< 4,5). Touche les liens et libellés accentués. Sombre : 5,48 ✅.<br>• **Champs de saisie sans limite perceptible, dans les deux thèmes** : `surface`/fond = 1,11 (clair) et 1,23 (sombre), `border`/fond = 1,13 / 1,37 — loin des **3,0** exigés pour un composant d'interface non textuel. Très visible en clair, où un champ vide se confond avec la page.<br>→ Le correctif est **central** (assombrir `textMuted` et `accent` en clair, renforcer `border`), pas écran par écran. La revue humaine reste utile, mais elle n'est plus le point de départ. |
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
> 5. ~~`app_version` réelle dans `app.json`~~ → ✅ **fait le 30/07/2026** (`0.0.0` → `1.0.0`, aligné sur
>    le `runtimeVersion` déjà présent). ⚠️ Toutes les mesures analytics collectées jusqu'ici portent
>    `0.0.0` et sont indistinguables.
>
> 📄 **Brouillons prêts à relire** :
> [lance00-fiche-play-et-confidentialite.md](docs/specs/technical/lance00-fiche-play-et-confidentialite.md)
> — politique de confidentialité publiable, fiche Play (titre / descriptions), réponses au formulaire
> « Sécurité des données » établies d'après les 41 tables réelles, et ordre d'exécution.
> **Restent à compléter par un humain** : l'identité du responsable de traitement + l'e-mail de
> contact (RGPD, je ne peux pas les inventer), la version EN, et la relecture juridique.
> 🟠 **Trouvé au passage** : l'écran de démarrage est resté au **bleu du gabarit Expo** (`#208AEF`),
> ainsi que le fond de l'icône adaptative (`#E6F4FE`), alors que la palette est crème/terracotta.
> C'est la première chose vue à chaque lancement, et c'est l'icône de la fiche Play. Décision de
> charte → Damien/Florian (proposition : `#f7eede` pour les deux).
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
> **Ordre conseillé.** Sortis du backlog : **PAS-01** clôturé le 28/07 (9.15 ✅) ; **BIEN-01**,
> **ADMIN-01**, **CONTENU-01**, **UX-LOT-01**, **MESUR-01**, **NUTR-F2**, **STREAK-01**, **OBJ-01** et
> **BILAN-01** livrées et **en recette** (voir [RECETTES.md](RECETTES.md)).
>
> **Il ne reste donc plus aucun candidat de la salve V0.9.** La suite : les **P2** ci-dessous, puis
> **CONF-07 en dernier** des chantiers de code, délibérément — un balayage d'accessibilité refait après
> chaque nouvel écran serait du travail perdu.

### Enrichissements V0.9 — rétention & valeur produit

> ✅ **Les deux candidats de rétention sont livrés le 29/07/2026** : **OBJ-01** (7.15 🟡) et
> **BILAN-01** (7.16 🟡), tous deux en recette — voir [RECETTES.md](RECETTES.md).
>
> La contradiction du doze mode annoncée ici a été résolue en **ne mettant aucun chiffre dans la
> notification** : tout est recalculé à l'ouverture, donc une notification livrée six heures en retard
> reste exacte. **Cette section est vide, et c'est normal** — elle disparaîtra à la clôture des deux US.

### Finitions UX remontées en recette

> ✅ **Lot livré le 29/07/2026** (UX-LOT-01, roadmap 3.53 / 3.54 / 7.18 → ✅). UX-02 était en fait
> **déjà livré** depuis `12bd3a1`, et le diagnostic d'UX-04 était faux sur 2 points — voir la
> [spec](docs/specs/functional/us/uxlot01-finitions-recette.md) §0.

### Musculation

| Candidat | # | Contenu | État |
|---|---|---|---|
| **MUSC-F7 — Progression assistée** | 3.7, 3.8 | Progression auto de charge au niveau programme + câblage du deload. | 🟡 La brique pure `computeProgressionSuggestion` (kind `deload`) est **livrée et testée mais non déclenchée** : il manque le signal `previousStruggled` (séance avant-dernière) et la validation de la règle par Florian. **Absorbe** l'idée « détection de plateau + deload proactif » : c'est le même déclencheur, à étendre à la stagnation sur N séances. |
| ~~**MUSC-F8**~~ | 3.42, 2.7, 2.4 | — | ✅ **Livré le 30/07/2026** (push agrégé + célébration + rappel de séance), en recette → [RECETTES.md](RECETTES.md). Trois constats de cadrage : la roadmap **2.4 décrivait l'impossible** (`scheduled_date` est un jour sans heure → recadré en échéance apprise sur `finished_at`) · un record est **pluriel** (jusqu'à 15 en une séance → un seul push agrégé, id **par séance**) · le push **double l'écran de résumé**, assumé et 🟠 **à réévaluer en recette** (D11). **Solde D3** : le plafond quotidien s'applique aux notifications **immédiates** seulement. Course **hors périmètre** (le backfill partirait en rafale). |
| ~~**MUSC-F9**~~ | 3.10 | — | 🟡 **Entré dans le pipeline le 30/07/2026** → [spec](docs/specs/functional/us/muscf9-planning-glisser-deposer.md) · [plan](docs/plans/muscf9-planning-glisser-deposer.md) · [maquette](design/muscf9-planning-glisser-deposer/muscf9-planning-glisser-deposer.html). **Aucune migration, aucune sync rule** : `reschedulePlannedSession` existe déjà et est testé, l'US n'ajoute qu'un geste. Le risque est ailleurs — **trois gestes cohabitent** sur la même surface (défilement, changement de semaine, glissement). Les 3 boutons de report **restent** : un glisser-déposer est inutilisable sous TalkBack. 3 décisions d'interaction en attente ; seule D3 (haptique, `expo-haptics`) déciderait d'un nouveau build. |
| ~~**MUSC-F1b**~~ | 6.2 | — | 🟡 **Entré dans le pipeline le 30/07/2026** → [spec](docs/specs/functional/us/muscf1b-schema-muscles.md) · [plan](docs/plans/muscf1b-schema-muscles.md) · [maquette](design/muscf1b-schema-muscles/muscf1b-schema-muscles.html). 🔴 **Le point dur n'est pas le dessin : la base ne connaît que 6 groupes** (`chest`/`back`/`legs`/`shoulders`/`arms`/`core`), et `musclesSecondary` puise dans la même liste. Une planche anatomique fine promettrait une précision inexistante (sur un curl, il faudrait allumer « arms » → tout le bras, triceps compris). **Voie A** (6 zones stylisées, 0 migration) recommandée contre **voie B** (enrichir la donnée), qui ferait dépendre une US P1 d'un travail de contenu pas commencé — la bibliothèque est encore vide (CONTENU-01). |
| **MUSC-F6 — Fenêtre de reprise de séance** | 3.36 | Réconcilier les seuils : la spec dit 4 h, la clôture auto (3.37) borne à 3 h. | 🟡 Décision produit à trancher avant code. |

### Running

| Candidat | # | Contenu | État |
|---|---|---|---|
| **RUN-F2 — Séances guidées vocales** | 5.18, 5.19, 5.9, 5.23 | Annonces audio par km + guidage fractionné + blocs rapide/récup structurés + cible prolonger/raccourcir. | ⬜ Les séances guidées sont **déconnectées du tracker actif** — c'est le vrai chantier. Dépend de `expo-speech` (absent). |
| ~~**RUN-F3**~~ | 5.25 | — | 🟡 **Entré dans le pipeline le 30/07/2026** → [spec](docs/specs/functional/us/runf3-resume-course-enrichi.md) · [plan](docs/plans/runf3-resume-course-enrichi.md). ⚠️ **Ce que disait cette ligne était faux** : « la météo n'est qu'un champ post-séance ». Il n'existe **aucun** champ météo — `runs` porte distance, durée, allure, tracé, rpe, notes, et **aucune des 58 migrations** ne mentionne `weather`/`terrain`/`elevation`. L'US **crée** la donnée. D'où la scission : **5.25** (comparaison à l'objectif) = calcul pur, offline total, 0 migration ; **5.24** (météo) = dépendance réseau + **position transmise à un tiers**. |
| **RUN-F3b — Météo de course** *(scindé de RUN-F3)* | 5.24 | Conditions météo au moment de la course, et avant une sortie planifiée. | 🔴 **À trancher AVANT de soumettre la fiche Play.** Une requête météo transmet des **coordonnées à un service externe** — ce qui contredit la politique de confidentialité et le formulaire « Sécurité des données » rédigés pour [LANCE-00](docs/specs/technical/lance00-fiche-play-et-confidentialite.md), qui affirment aujourd'hui qu'aucune donnée n'est partagée. Trois questions ouvertes (spec RUN-F3 §4 D2) : fournisseur (Open-Meteo = le seul sans clé à stocker), moment de l'appel, et **assumer qu'une course hors réseau n'aura jamais de météo** — on ne récupère pas une météo passée gratuitement. Le **terrain**, lui, ne demande aucun réseau (simple saisie) et est proposé avec 5.25. |
| **RUN-F1b — Dénivelé cumulé** | 5.32 | Dénivelé positif par semaine / mois. | ⛔ **Bloqué** : la trace GPS ne capte pas l'altitude (`GpsPoint = {lat,lng,t}`). Nécessite de modifier le tracker R1, étendre le codec, et **les courses déjà enregistrées resteront sans dénivelé**. |

### Contenu

| Candidat | # | Contenu | État |
|---|---|---|---|
| **CONTENU-01 — Seed des bibliothèques de programmes** | 3.1, 5.2 | Catalogues muscu + course, aujourd'hui **vides**. 🌐 FR+EN. | 🟡 **Méthode tranchée le 28/07/2026 (Florian) : migration SQL idempotente** (patron CIQUAL), le constructeur admin 8.4 restant le pipeline d'entretien → [spec §2](docs/specs/functional/us/contenu-01-seed-bibliotheques-programmes.md). **Reste à trancher : le contenu** — nombre de programmes par pilier au lancement, et qui fournit séances/exos/reps. C'est du travail de coach, pas de dev. |

---

## 🟢 P2 — Confort & optionnel

| Candidat | # | Contenu | État |
|---|---|---|---|
| ~~**NUTR-F1**~~ | 1.14, 2.5 | — | 🟡 **Entré dans le pipeline le 30/07/2026** → [spec](docs/specs/functional/us/nutrf1-rappels-nutrition.md) · [plan](docs/plans/nutrf1-rappels-nutrition.md) · [maquette](design/nutrf1-rappels-nutrition/nutrf1-rappels-nutrition.html). **Aucune migration, aucun nouveau build.** 7 décisions posées, dont : on apprend le **p90** de l'heure du geste (une **échéance**) et non la médiane — sinon le rappel part pendant que l'utilisateur fait le geste ; rappels **opt-in** ; heure **apprise** rabattue hors DND / heure **manuelle** respectée donc non envoyée, avec avertissement ; **pas de compteur de quota** — on corrige à la place le hint « max 3/jour », faux depuis V0.6. |
| ~~**PARTAGE-01**~~ | 7.17 | — | ✅ **Livré le 29/07/2026** (course **et** muscu), en recette → [RECETTES.md](RECETTES.md). ⚠️ exige un **second build** : `react-native-view-shot` est une dépendance native. |
| ~~**MUSC-F14**~~ | 3.52 | — | ✅ **Livré le 29/07/2026** (séance), en recette → [RECETTES.md](RECETTES.md). Motif « zone douloureuse » **retiré** : pas de donnée articulaire en base, y répondre serait un conseil de santé inventé. 🟠 **Décision attendue** : l'éditeur de programme n'a pas de parcours « remplacer ». |
| ~~**UX-05**~~ | 3.55 | — | ✅ **Livré le 29/07/2026**, en recette → [RECETTES.md](RECETTES.md). Portée réduite après inventaire au **RPE par série** : le RIR n'a aucun sens sur le ressenti de séance (échelle 1-5) ni sur une course. **1 migration, 0 sync rule.** |
| **REFACTO-01 — Unifier la décision d'accès par pilier** | 9.x | Un point de décision unique pour « cette fonctionnalité est-elle accessible ? », au lieu de ~12 copies. | 🆕 **Trouvé le 30/07/2026** en cadrant SOCLE-01. Le gating de la décision H (`settings?.activePillars ?? [...PILLARS]` puis `.includes()`) est **recopié en ligne dans ~12 endroits** — `(tabs)/_layout.tsx`, `settings.tsx`, `dashboard-repository`, `records-repository`, `weekly-review-repository`, `widget-layout-repository` — **sans aucun helper partagé**. La seule version propre est interne aux widgets (`WIDGET_REGISTRY.pillars` + son sentinelle `'always'`), et c'est exactement la forme cible. **C'est la vraie dette que l'ADR-003 croyait prévenir** — elle existe déjà et ne concerne pas RevenueCat. Y brancher les entitlements plus tard devient alors une entrée de plus, pas une refonte. ⚠️ Touche du code **livré et recetté en 12 endroits** : à faire en refacto dédiée, jamais en passager clandestin d'une autre US. Estimation ~6-8 h. |
| **SOCLE-01 — RevenueCat câblé inactif** | 9.14 | Entitlements posés, aucun paywall (app gratuite en V1). | ⏳ **Différée le 30/07/2026 (Florian), après cadrage.** Quatre constats : (1) [prd.md:122](docs/product/prd.md) dit les paliers Premium → Écosystème → IA « conservés **pour mémoire uniquement, non engageants** » — les définir serait les inventer ; (2) **« Premium muscu » n'a aucun contenu défini** nulle part et « Écosystème » n'est nommé que dans l'ADR-003 — seul le palier **IA** a une décision datée (15/07/2026 : 1-2 bilans croisés gratuits bridés vs exhaustif + chatbot à quota) ; (3) **aucune fonctionnalité IA n'est livrée** ([ia-integration-analyse.md](docs/product/ia-integration-analyse.md) n'est pas encore une US) → la couture n'aurait **aucun consommateur réel**, donc serait une promesse non vérifiée ; (4) LANCE-00 non fait → sans compte Play, aucun produit configurable, donc **un SDK RevenueCat n'aurait rien à récupérer** (et sa clé publique `goog_` n'est pas un secret : c'est l'inutilité qui l'écarte, pas le garde-fou). **À reprendre avec la première US IA**, qui fournira le premier point d'accès réellement gatable. |

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

- [x] ~~**PAS-01 — l'en-tête de l'écran « Pas » est cassé**~~ — constaté puis **corrigé le
      30/07/2026** (`fix/pas01-entete-ecran-pas`). La route `steps` était **absente** de
      [_layout.tsx](apps/mobile/src/app/_layout.tsx) : sans `Stack.Screen`, aucun en-tête de
      navigation, donc le titre de page se dessinait sous la barre d'état. Vérifié sur device.
      **Leçon** : un écran ajouté sans sa déclaration de route n'échoue ni au typecheck ni aux tests
      — seul un œil sur l'écran le voit.
### Constats de la passe device automatisée du 30/07/2026

Passe adb sur 41 écrans (37 routes + 4 onglets), en 3 campagnes : nominal, police 1,5×, mode avion.
Méthode et résultats détaillés : [docs/plan-de-test.md](docs/plan-de-test.md).

- [ ] 🟠 **Réglages affiche une erreur rouge alors que Health Connect est simplement désactivé.**
      Bandeau bordé `danger` : « Dernière tentative (steps) en échec : **[r4] synchronisation
      désactivée (opt-in OFF)** ». Un opt-in sur OFF n'est pas une panne — c'est l'état par défaut de
      tout utilisateur qui n'a rien activé. Deux problèmes distincts : (a) l'état normal est présenté
      comme un échec ; (b) la raison interpolée est une **chaîne de diagnostic non traduite** portant
      le tag de build `SERVICE_REV = 'r4'` — délibéré et commenté dans
      [HealthConnectSection.tsx](apps/mobile/src/components/HealthConnectSection.tsx#L299), mais un
      utilisateur **anglophone** lit alors du français technique. ⚠️ CONF-06 est clôturée (9.9 ✅) et
      Health Connect est sur le chemin critique de la déclaration Play.
      → Ne pas traiter `opt-in OFF` comme une erreur ; réserver le bandeau aux échecs réels.
- [ ] 🟠 **`run/active` sans course active : écran vide avec un bouton « Retour » seul**, sans aucun
      message. C'est le seul écran de l'app à violer la convention « jamais d'écran vide : un message
      qui explique » — les 40 autres ont un état vide rédigé.
- [ ] 🟢 **`planning/plan` sans programme valide est un cul-de-sac** : « Ce programme n'existe pas ou
      a été supprimé. » sans bouton retour ni CTA.
- [ ] 🟢 **Champs de saisie sans libellé d'accessibilité.** 8 sur
      [food-custom](apps/mobile/src/app/food-custom.tsx), 1 sur profile, recipe-edit et
      account-delete : cliquables, sans `text` ni `content-desc`, ils s'appuient sur le libellé
      visuel adjacent. À reprendre avec CONF-07.
- [ ] 🟠 **Décision produit — le widget planning du hub Muscu annonce une séance de course.**
      Constaté : « Prochaine : Fractionné (VMA) » sous l'en-tête *Musculation*, à côté de « Aucun
      programme actif ». Ce n'est **pas un bug de filtre** : les requêtes de
      [planned-session-repository.ts](apps/mobile/src/data/repositories/planned-session-repository.ts#L100)
      sont explicitement « TOUS piliers » (planning unifié, US 3.9) et `StrengthPlanningWidget` rend
      `PlanningPreview` sans filtre. **À trancher** : est-ce le comportement voulu, ou le widget d'un
      pilier doit-il se limiter à son pilier ?

- [ ] **`supabase/seed.sql` est inatteignable** — il n'est joué que par `db:reset`, qui exige Docker
      (que personne n'a). Les 16 exercices de bibliothèque sont donc arrivés sur le cloud par un
      chemin non tracé. → Les basculer en **migration idempotente** (comme le seed CIQUAL), ou
      documenter explicitement que `seed.sql` ne sert qu'au futur usage Docker.
- [ ] **`main` n'a pas bougé depuis le 04/07/2026** (972 commits de retard sur `dev` au 30/07/2026). Aucun tag,
      aucun point de repère de version. → À traiter au moment de LANCE-01.
- [x] ~~**2 tests mobile en échec par timeout** (`edit-exercise-modal-smoke`, `exercise-detail-smoke`)~~
      → **Non reproduit le 30/07/2026, constat clos.** Suite complète relancée : **44 suites / 231
      tests mobile verts en 20 s**, plus 1218 tests `shared` en 5,8 s. Les deux suites incriminées
      tournent en **6,4 s et 7,2 s** isolément — largement sous le `testTimeout` de 15 s. Le
      diagnostic « ~250 s par suite » était un artefact de poste chargé, **pas** un défaut de code
      ni de configuration. Aucun `testTimeout` à relever.
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
