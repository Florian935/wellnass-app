# ADR-007 — Surfaçage des analyses (comment exposer un catalogue de ~180 analyses sans noyer l'utilisateur)

- **Statut** : ✅ **Accepté** (Florian, 16/07/2026 — relecture Damien à faire)
- **Date** : 16/07/2026
- **Décideurs** : Florian (relecture Damien à faire).
- **Lié à** : [catalogue analyses-donnees.md](../product/analyses-donnees.md) · décision de cadrage
  [H — Intégration sans imposition](../../SYNTHESE-CADRAGE.md) · [ADR-003 — Monétisation](./ADR-003-monetisation.md) ·
  dashboard personnalisable (US 7.1-7.3, 7.11-7.12).

---

## Contexte

Le [catalogue d'analyses](../product/analyses-donnees.md) recense **~180 analyses** (intra-pilier,
inter-piliers, tri-piliers, méta/dérivées). Elles sont **toutes pertinentes**, mais on ne peut pas
en faire ~180 sections/widgets répartis dans les piliers et le dashboard : l'utilisateur **se
noierait**, et l'écran deviendrait ingérable. On a déjà commencé à empiler des sections permanentes sur
un même écran (MN-03 et MN-06 sur Nutrition → Stats) — le risque de saturation est concret et proche.

Le problème n'est donc pas « lesquelles construire » seulement, mais surtout **comment les exposer** :
il faut une **doctrine de surfaçage** qui tienne quand le nombre d'analyses grandit, cohérente avec le
différenciateur produit (intégration des piliers, décision H) et avec la frontière premium (ADR-003).

## Options envisagées

### A — Tout exposer (une section/un widget par analyse)
- **+** Rien n'est « caché ».
- **−** Saturation garantie, charge cognitive énorme, dashboards/écrans interminables, maintenance et
  perf dégradées. L'exhaustivité **détruit** la lisibilité. **Rejeté.**

### B — Ne construire qu'un petit sous-ensemble figé, ignorer le reste
- **+** Simple, écrans épurés.
- **−** Gâche la valeur du catalogue et le différenciateur (les analyses croisées) ; choix arbitraire et
  figé ; aucune règle pour arbitrer les futures analyses. **Rejeté.**

### C — Modèle de **surfaçage à niveaux** + **conditionnel par défaut** + **briques réutilisables** *(retenu)*
- **+** Découple le **catalogue** (backlog) de l'**UI** (petite surface curatée). La majorité des
  analyses ne s'affichent que **quand elles ont quelque chose à dire**, ou sont **regroupées** en
  quelques composants, ou attendent au backlog. Passe à l'échelle, reste lisible, cadre chaque future US.
- **−** Demande de la discipline (chaque analyse déclare où/quand elle se surface) et un futur écran
  « Insights » à construire. **Accepté.**

## Décision

On adopte l'**option C**. Principes normatifs :

### 1. Le catalogue est un **backlog**, pas une checklist à shipper
`analyses-donnees.md` est une **source d'idées**. Une analyse n'entre en UI que si elle passe le
**critère d'entrée** (§4). La plupart resteront non construites, fusionnées, ou purement conditionnelles.

### 2. Quatre niveaux de surfaçage (progressive disclosure)
- **Tier 0 — Dashboard (plafonné).** ~**4-6 widgets max**, uniquement le **live/actionnable du jour**.
  Déjà personnalisable + gating piliers (7.x). **On ne l'agrandit pas** : ajouter un widget « coûte » un
  arbitrage, pas un simple `+1`.
- **Tier 1 — Écran Stats/Progression du pilier (à la demande).** Home des analyses de fond du pilier,
  **hiérarchisé** : les 2-3 plus utiles visibles, le reste en **sections repliables** / « voir plus ».
  Dès qu'un écran dépasse **~4-5 sections**, il passe en repliable ou sous-onglets.
- **Tier 2 — Alertes & insights contextuels (le cœur).** La majorité des analyses « signal »
  **s'affichent uniquement si la condition est réunie** (sinon `null` — elles ne coûtent rien à
  l'écran). C'est le mécanisme déjà employé (4.32 se replie hors alerte ; MN-03/MN-06 gating).
- **Tier 3 — Écran « Insights » + premium (post-V1).** Un **moteur de sélection** choisit les **1-3
  analyses les plus pertinentes de l'instant** (celle qui a changé / alerte / célèbre) plutôt que tout
  empiler. Les **analyses poussées** (corrélations, moteur causal) vivent là, **à la demande** et
  **derrière le paywall** (ADR-003 : l'intelligence de croisement est la frontière payante).

  > 📌 **Amendement du 05/08/2026 — l'écran « Insights » est livré GRATUIT en V1** (US INSIGHTS-01,
  > roadmap 7.20, validé par Florian).
  >
  > La phrase « derrière le paywall » ci-dessus **ne décrit pas le code livré**. Motif : **SOCLE-01**
  > (câblage RevenueCat) est **différée** depuis le 30/07/2026 — aucun entitlement n'est défini,
  > LANCE-00 n'est pas fait donc aucun produit n'est configurable, et il n'existe aucun paywall.
  > Livrer l'écran gaté dans ces conditions reviendrait à **le livrer invisible**.
  >
  > Le gating n'est pas abandonné, il est **isolé en un seul point** : `canAccessInsights()` dans
  > [insights-repository.ts](../../apps/mobile/src/data/repositories/insights-repository.ts),
  > qui retourne `true` en dur. Brancher la lecture d'un entitlement RevenueCat à cet endroit suffira
  > à refermer l'accès, sans toucher au moteur, à l'écran ni au widget. **À reprendre avec la
  > première US premium / IA**, celle-là même qui débloquera SOCLE-01.
  >
  > Ce qui reste vrai de la décision d'origine : les **analyses poussées** (corrélations, moteur
  > causal) ne sont **pas** dans INSIGHTS-01 — elles restent au catalogue, et c'est là que la
  > frontière payante d'ADR-003 gardera tout son sens.

### 3. Construire des **briques**, pas 180 variantes
Beaucoup d'analyses sont des déclinaisons d'un même patron. On mutualise en **~15-20 composants
réutilisables** (courbe de tendance générique META-08/09 ; `DeltaBadge` déjà mutualisé ; carte de
records/PR ; jauge « valeur vs cible » ; tableau croisé hebdo…). 180 lignes de catalogue ≈ une
poignée de briques + des configurations.

### 4. Critère d'entrée en UI
Une analyse ne « monte » que si elle sert au moins l'un de : **rétention**, **différenciateur
inter-piliers**, **action concrète** pour l'utilisateur. Sinon elle **reste au catalogue**. (YAGNI
produit, pas seulement code.)

### 5. Règle de spec : chaque US d'analyse **déclare son surfaçage**
Toute nouvelle US d'analyse précise dans sa spec : **le tier** (0/1/2/3) et **la condition d'affichage**
(**conditionnel par défaut** ; permanent = exception justifiée). Pas de nouvelle analyse « permanente »
sans arbitrage explicite.

## Conséquences

- **Dashboard plafonné** (~4-6 widgets) ; tout ajout est un arbitrage (remplace/priorise), pas un empilement.
- **Conditionnel par défaut** : le patron « rend `null` hors condition / gating » (4.32, MN-03, MN-06)
  devient la **norme**, pas l'exception.
- **Écrans pilier hiérarchisés** : dès ~4-5 sections, passer en **sections repliables** / sous-onglets.
  ⚠️ **Point de vigilance immédiat** : **Nutrition → Stats** porte déjà poids + apports moyens + MN-03 +
  MN-06 → prévoir le regroupement/repli **à la prochaine analyse** qui s'y ajoute.
- ~~**Écran « Insights » (Tier 3)** = **US à cadrer** (post-V1)~~ → ✅ **cadré et livré le
  05/08/2026** (US INSIGHTS-01, roadmap 7.20). Moteur de sélection **déterministe** — une table
  ordonnée (`INSIGHT_ORDER`), pas un score : ni sévérité à inventer, ni pondération à défendre,
  même parti pris que le `SIGNAL_ORDER` de BILAN-01. Neuf signaux **déjà livrés** y concourent,
  aucune analyse nouvelle n'a été calculée (§3 respecté). Livré **gratuit**, voir l'amendement ci-dessus.
  ⚠️ **Le plafond du Tier 0 reste violé** : `HOME_WIDGET_IDS` compte **21 widgets** contre les 4-6
  du §2. INSIGHTS-01 crée l'endroit où les faire vivre mais **ne dégonfle pas** le dashboard —
  c'est l'objet d'**INSIGHTS-02**, délibérément placée après la recette pour ne pas refactorer des
  écrans en cours de validation.
- **Briques transverses** : privilégier des composants génériques (tendance, delta, jauge vs cible,
  record) réutilisés par configuration plutôt que du sur-mesure par analyse.
- **Rétro-compatibilité** : les analyses déjà livrées (MN-02/4.32, MN-03, MN-06, META-06, RN-01/02) sont
  **conformes** (conditionnelles / gating / auto-portantes). Rien à défaire.
- **Catalogue** : `analyses-donnees.md` reste le backlog ; on peut y noter, à terme, le **tier** cible
  de chaque analyse pour guider la priorisation.
- Cette grille **s'applique à chaque future analyse** (règle de spec §5) — c'est le garde-fou contre la
  saturation.
